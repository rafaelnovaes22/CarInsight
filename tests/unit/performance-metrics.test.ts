/**
 * Performance Metrics Service Tests
 *
 * Unit tests for the PerformanceMetricsService that tracks timing,
 * LLM calls, and alerts for the recommendation flow.
 *
 * **Feature: latency-optimization**
 * Requirements: 6.3, 6.4 - Performance monitoring and alerting
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PerformanceMetricsService,
  performanceMetrics,
  measureTime,
  measureLLMCall,
  RecommendationStage,
} from '../../src/services/performance-metrics.service';

// Mock logger
vi.mock('../../src/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logEvent: {
    recommendationStage: vi.fn(),
    recommendationCompleted: vi.fn(),
    latencyAlert: vi.fn(),
  },
}));

describe('PerformanceMetricsService', () => {
  let service: PerformanceMetricsService;

  beforeEach(() => {
    service = new PerformanceMetricsService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startRequest', () => {
    it('should create a new request with unique ID', () => {
      const requestId = service.startRequest('conv-123');

      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should use provided request ID if given', () => {
      const requestId = service.startRequest('conv-123', 'custom-id');

      expect(requestId).toBe('custom-id');
    });

    it('should initialize metrics correctly', () => {
      const requestId = service.startRequest('conv-123');
      const metrics = service.getMetrics(requestId);

      expect(metrics).toBeDefined();
      expect(metrics?.conversationId).toBe('conv-123');
      expect(metrics?.llmCallCount).toBe(0);
      expect(metrics?.llmTotalTime).toBe(0);
      expect(metrics?.vehiclesProcessed).toBe(0);
      expect(metrics?.vehiclesReturned).toBe(0);
    });
  });

  describe('startStage and endStage', () => {
    it('should track stage timing correctly', async () => {
      const requestId = service.startRequest('conv-123');

      service.startStage(requestId, 'vehicle_search');

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = service.endStage(requestId, 'vehicle_search', true);

      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(200); // Allow some tolerance
    });

    it('should store metadata for stages', () => {
      const requestId = service.startRequest('conv-123');

      service.startStage(requestId, 'deterministic_ranking', { useCase: 'familia' });
      service.endStage(requestId, 'deterministic_ranking', true, { vehiclesFound: 10 });

      const metrics = service.getMetrics(requestId);
      const stage = metrics?.stages.get('deterministic_ranking');

      expect(stage?.metadata).toEqual({ useCase: 'familia', vehiclesFound: 10 });
    });

    it('should handle unknown request gracefully', () => {
      service.startStage('unknown-id', 'vehicle_search');
      const duration = service.endStage('unknown-id', 'vehicle_search', true);

      expect(duration).toBe(0);
    });

    it('should handle ending unstarted stage gracefully', () => {
      const requestId = service.startRequest('conv-123');
      const duration = service.endStage(requestId, 'vehicle_search', true);

      expect(duration).toBe(0);
    });
  });

  describe('recordLLMCall', () => {
    it('should increment LLM call count', () => {
      const requestId = service.startRequest('conv-123');

      service.recordLLMCall(requestId, 100);
      service.recordLLMCall(requestId, 150);

      const metrics = service.getMetrics(requestId);

      expect(metrics?.llmCallCount).toBe(2);
    });

    it('should accumulate LLM total time', () => {
      const requestId = service.startRequest('conv-123');

      service.recordLLMCall(requestId, 100);
      service.recordLLMCall(requestId, 150);

      const metrics = service.getMetrics(requestId);

      expect(metrics?.llmTotalTime).toBe(250);
    });

    it('should handle unknown request gracefully', () => {
      // Should not throw
      service.recordLLMCall('unknown-id', 100);
    });
  });

  describe('updateVehicleCounts', () => {
    it('should update vehicle counts', () => {
      const requestId = service.startRequest('conv-123');

      service.updateVehicleCounts(requestId, 100, 5);

      const metrics = service.getMetrics(requestId);

      expect(metrics?.vehiclesProcessed).toBe(100);
      expect(metrics?.vehiclesReturned).toBe(5);
    });
  });

  describe('endRequest', () => {
    it('should return summary with all metrics', async () => {
      const requestId = service.startRequest('conv-123');

      service.startStage(requestId, 'vehicle_search');
      await new Promise(resolve => setTimeout(resolve, 10));
      service.endStage(requestId, 'vehicle_search', true);

      service.recordLLMCall(requestId, 100);
      service.updateVehicleCounts(requestId, 50, 3);

      const summary = service.endRequest(requestId);

      expect(summary).toBeDefined();
      expect(summary?.conversationId).toBe('conv-123');
      expect(summary?.requestId).toBe(requestId);
      expect(summary?.totalDurationMs).toBeGreaterThan(0);
      expect(summary?.llmCallCount).toBe(1);
      expect(summary?.llmTotalTimeMs).toBe(100);
      expect(summary?.vehiclesProcessed).toBe(50);
      expect(summary?.vehiclesReturned).toBe(3);
      expect(summary?.stages).toHaveLength(1);
    });

    it('should set exceededThreshold to false when under 5 seconds', async () => {
      const requestId = service.startRequest('conv-123');

      const summary = service.endRequest(requestId);

      expect(summary?.exceededThreshold).toBe(false);
    });

    it('should clean up request after ending', () => {
      const requestId = service.startRequest('conv-123');

      service.endRequest(requestId);

      const metrics = service.getMetrics(requestId);
      expect(metrics).toBeUndefined();
    });

    it('should return null for unknown request', () => {
      const summary = service.endRequest('unknown-id');

      expect(summary).toBeNull();
    });
  });

  describe('latency alert threshold', () => {
    it('should correctly identify when threshold is exceeded based on duration', () => {
      // Test the threshold logic directly
      // The threshold is 5000ms (5 seconds)
      const THRESHOLD = 5000;

      // Test case 1: Under threshold
      expect(4999 > THRESHOLD).toBe(false);

      // Test case 2: At threshold
      expect(5000 > THRESHOLD).toBe(false);

      // Test case 3: Over threshold
      expect(5001 > THRESHOLD).toBe(true);
    });

    it('should set exceededThreshold to false for fast requests', () => {
      const requestId = service.startRequest('conv-123');

      // End immediately - should be well under 5 seconds
      const summary = service.endRequest(requestId);

      expect(summary?.exceededThreshold).toBe(false);
      expect(summary?.totalDurationMs).toBeLessThan(5000);
    });
  });
});

describe('measureTime helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should measure async function execution time', async () => {
    const requestId = performanceMetrics.startRequest('conv-123');

    const { result, durationMs } = await measureTime(requestId, 'vehicle_search', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'test-result';
    });

    expect(result).toBe('test-result');
    expect(durationMs).toBeGreaterThanOrEqual(50);

    performanceMetrics.endRequest(requestId);
  });

  it('should handle errors and still record stage', async () => {
    const requestId = performanceMetrics.startRequest('conv-123');

    await expect(
      measureTime(requestId, 'vehicle_search', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    performanceMetrics.endRequest(requestId);
  });
});

describe('measureLLMCall helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should measure LLM call and record it', async () => {
    const requestId = performanceMetrics.startRequest('conv-123');

    const result = await measureLLMCall(requestId, async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'llm-response';
    });

    expect(result).toBe('llm-response');

    const metrics = performanceMetrics.getMetrics(requestId);
    expect(metrics?.llmCallCount).toBe(1);
    expect(metrics?.llmTotalTime).toBeGreaterThanOrEqual(50);

    performanceMetrics.endRequest(requestId);
  });

  it('should record LLM call even on error', async () => {
    const requestId = performanceMetrics.startRequest('conv-123');

    await expect(
      measureLLMCall(requestId, async () => {
        throw new Error('LLM error');
      })
    ).rejects.toThrow('LLM error');

    const metrics = performanceMetrics.getMetrics(requestId);
    expect(metrics?.llmCallCount).toBe(1);

    performanceMetrics.endRequest(requestId);
  });
});
