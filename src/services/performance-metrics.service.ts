/**
 * Performance Metrics Service
 *
 * Provides comprehensive performance metrics logging for the recommendation flow.
 * Tracks timing for each stage, alerts when total time exceeds 5s, and counts LLM calls.
 *
 * **Feature: latency-optimization**
 * Requirements: 6.3, 6.4 - Performance monitoring and alerting
 */

import { logger } from '../lib/logger';

// Threshold for performance alerts (5 seconds)
const LATENCY_ALERT_THRESHOLD_MS = 5000;

// Stage names for the recommendation flow
export type RecommendationStage =
  | 'preference_extraction'
  | 'vehicle_search'
  | 'deterministic_ranking'
  | 'fallback_search'
  | 'response_generation'
  | 'total';

// Metrics for a single recommendation request
export interface RecommendationMetrics {
  conversationId: string;
  requestId: string;
  startTime: number;
  stages: Map<RecommendationStage, StageMetrics>;
  llmCallCount: number;
  llmTotalTime: number;
  vehiclesProcessed: number;
  vehiclesReturned: number;
}

// Metrics for a single stage
export interface StageMetrics {
  stage: RecommendationStage;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// Summary of a completed recommendation request
export interface MetricsSummary {
  conversationId: string;
  requestId: string;
  totalDurationMs: number;
  stages: {
    stage: RecommendationStage;
    durationMs: number;
    success: boolean;
  }[];
  llmCallCount: number;
  llmTotalTimeMs: number;
  vehiclesProcessed: number;
  vehiclesReturned: number;
  exceededThreshold: boolean;
}

/**
 * Performance Metrics Service
 *
 * Tracks and logs performance metrics for the recommendation flow.
 */
export class PerformanceMetricsService {
  private activeRequests: Map<string, RecommendationMetrics> = new Map();

  /**
   * Start tracking a new recommendation request
   */
  startRequest(conversationId: string, requestId?: string): string {
    const id = requestId || this.generateRequestId();
    const metrics: RecommendationMetrics = {
      conversationId,
      requestId: id,
      startTime: Date.now(),
      stages: new Map(),
      llmCallCount: 0,
      llmTotalTime: 0,
      vehiclesProcessed: 0,
      vehiclesReturned: 0,
    };

    this.activeRequests.set(id, metrics);

    logger.debug(
      {
        event: 'recommendation_request_started',
        conversationId,
        requestId: id,
      },
      'Recommendation request started'
    );

    return id;
  }

  /**
   * Start tracking a specific stage
   */
  startStage(requestId: string, stage: RecommendationStage, metadata?: Record<string, unknown>): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) {
      logger.warn({ requestId, stage }, 'Attempted to start stage for unknown request');
      return;
    }

    const stageMetrics: StageMetrics = {
      stage,
      startTime: Date.now(),
      success: false,
      metadata,
    };

    metrics.stages.set(stage, stageMetrics);

    logger.debug(
      {
        event: 'recommendation_stage_started',
        conversationId: metrics.conversationId,
        requestId,
        stage,
        metadata,
      },
      `Stage ${stage} started`
    );
  }

  /**
   * End tracking a specific stage
   */
  endStage(
    requestId: string,
    stage: RecommendationStage,
    success: boolean,
    metadata?: Record<string, unknown>
  ): number {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) {
      logger.warn({ requestId, stage }, 'Attempted to end stage for unknown request');
      return 0;
    }

    const stageMetrics = metrics.stages.get(stage);
    if (!stageMetrics) {
      logger.warn({ requestId, stage }, 'Attempted to end stage that was not started');
      return 0;
    }

    stageMetrics.endTime = Date.now();
    stageMetrics.durationMs = stageMetrics.endTime - stageMetrics.startTime;
    stageMetrics.success = success;
    if (metadata) {
      stageMetrics.metadata = { ...stageMetrics.metadata, ...metadata };
    }

    logger.info(
      {
        event: 'recommendation_stage_completed',
        conversationId: metrics.conversationId,
        requestId,
        stage,
        durationMs: stageMetrics.durationMs,
        success,
        metadata: stageMetrics.metadata,
      },
      `Stage ${stage} completed in ${stageMetrics.durationMs}ms`
    );

    return stageMetrics.durationMs;
  }

  /**
   * Record an LLM call
   */
  recordLLMCall(requestId: string, durationMs: number, metadata?: Record<string, unknown>): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) {
      logger.warn({ requestId }, 'Attempted to record LLM call for unknown request');
      return;
    }

    metrics.llmCallCount++;
    metrics.llmTotalTime += durationMs;

    logger.info(
      {
        event: 'llm_call_recorded',
        conversationId: metrics.conversationId,
        requestId,
        callNumber: metrics.llmCallCount,
        durationMs,
        totalLLMTime: metrics.llmTotalTime,
        metadata,
      },
      `LLM call #${metrics.llmCallCount} recorded (${durationMs}ms)`
    );
  }

  /**
   * Update vehicle counts
   */
  updateVehicleCounts(requestId: string, processed: number, returned: number): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) {
      return;
    }

    metrics.vehiclesProcessed = processed;
    metrics.vehiclesReturned = returned;
  }

  /**
   * End tracking a recommendation request and generate summary
   */
  endRequest(requestId: string): MetricsSummary | null {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) {
      logger.warn({ requestId }, 'Attempted to end unknown request');
      return null;
    }

    const totalDurationMs = Date.now() - metrics.startTime;
    const exceededThreshold = totalDurationMs > LATENCY_ALERT_THRESHOLD_MS;

    const summary: MetricsSummary = {
      conversationId: metrics.conversationId,
      requestId,
      totalDurationMs,
      stages: Array.from(metrics.stages.values()).map(s => ({
        stage: s.stage,
        durationMs: s.durationMs || 0,
        success: s.success,
      })),
      llmCallCount: metrics.llmCallCount,
      llmTotalTimeMs: metrics.llmTotalTime,
      vehiclesProcessed: metrics.vehiclesProcessed,
      vehiclesReturned: metrics.vehiclesReturned,
      exceededThreshold,
    };

    // Log summary
    if (exceededThreshold) {
      // ALERT: Total time exceeded 5 seconds
      logger.warn(
        {
          event: 'recommendation_latency_alert',
          conversationId: metrics.conversationId,
          requestId,
          totalDurationMs,
          thresholdMs: LATENCY_ALERT_THRESHOLD_MS,
          stages: summary.stages,
          llmCallCount: summary.llmCallCount,
          llmTotalTimeMs: summary.llmTotalTimeMs,
        },
        `⚠️ LATENCY ALERT: Recommendation took ${totalDurationMs}ms (threshold: ${LATENCY_ALERT_THRESHOLD_MS}ms)`
      );
    } else {
      logger.info(
        {
          event: 'recommendation_request_completed',
          conversationId: metrics.conversationId,
          requestId,
          totalDurationMs,
          stages: summary.stages,
          llmCallCount: summary.llmCallCount,
          llmTotalTimeMs: summary.llmTotalTimeMs,
          vehiclesProcessed: summary.vehiclesProcessed,
          vehiclesReturned: summary.vehiclesReturned,
        },
        `Recommendation completed in ${totalDurationMs}ms`
      );
    }

    // Clean up
    this.activeRequests.delete(requestId);

    return summary;
  }

  /**
   * Get current metrics for a request (for debugging)
   */
  getMetrics(requestId: string): RecommendationMetrics | undefined {
    return this.activeRequests.get(requestId);
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton export
export const performanceMetrics = new PerformanceMetricsService();

/**
 * Helper function to measure execution time of an async function
 */
export async function measureTime<T>(
  requestId: string,
  stage: RecommendationStage,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<{ result: T; durationMs: number }> {
  performanceMetrics.startStage(requestId, stage, metadata);

  try {
    const result = await fn();
    const durationMs = performanceMetrics.endStage(requestId, stage, true);
    return { result, durationMs };
  } catch (error) {
    performanceMetrics.endStage(requestId, stage, false, {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Helper function to measure LLM call time
 */
export async function measureLLMCall<T>(
  requestId: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    performanceMetrics.recordLLMCall(requestId, durationMs, metadata);
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    performanceMetrics.recordLLMCall(requestId, durationMs, {
      ...metadata,
      error: (error as Error).message,
      success: false,
    });
    throw error;
  }
}
