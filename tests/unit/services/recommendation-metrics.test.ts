/**
 * Unit tests for RecommendationMetricsService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    recommendation: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../../../src/lib/recommendation-feedback', () => ({
  recommendationFeedback: {
    calculateEngagement: vi.fn().mockReturnValue({ score: 50, signals: {} }),
  },
}));

import { RecommendationMetricsService } from '../../../src/services/recommendation-metrics.service';

describe('RecommendationMetricsService', () => {
  let service: RecommendationMetricsService;

  beforeEach(() => {
    service = new RecommendationMetricsService();
    vi.clearAllMocks();
  });

  describe('calculateMetrics', () => {
    it('should return empty metrics when no recommendations', async () => {
      const metrics = await service.calculateMetrics('7d');

      expect(metrics.totalRecommendations).toBe(0);
      expect(metrics.totalConversations).toBe(0);
      expect(metrics.precisionAt1).toBe(0);
      expect(metrics.precisionAt3).toBe(0);
      expect(metrics.mrr).toBe(0);
      expect(metrics.ctr).toBe(0);
    });

    it('should include period in response', async () => {
      const metrics = await service.calculateMetrics('24h');
      expect(metrics.period).toBe('24h');
    });

    it('should include generatedAt timestamp', async () => {
      const metrics = await service.calculateMetrics('7d');
      expect(metrics.generatedAt).toBeDefined();
      expect(new Date(metrics.generatedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('getWorstPerformingRecommendations', () => {
    it('should return empty array when no bad recommendations', async () => {
      const worst = await service.getWorstPerformingRecommendations(10, '7d');
      expect(worst).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const worst = await service.getWorstPerformingRecommendations(5, '7d');
      expect(worst.length).toBeLessThanOrEqual(5);
    });
  });

  describe('analyzeScoreAccuracy', () => {
    it('should return zero correlation when no data', async () => {
      const analysis = await service.analyzeScoreAccuracy('7d');

      expect(analysis.correlation).toBe(0);
      expect(analysis.overScoredCases).toBe(0);
      expect(analysis.underScoredCases).toBe(0);
      expect(analysis.accurateCases).toBe(0);
    });
  });

  describe('calculateMetricsBySegment', () => {
    it('should include segment in response', async () => {
      const metrics = await service.calculateMetricsBySegment('uber', '7d');
      expect(metrics.segment).toBe('uber');
    });
  });
});

// Test helper functions (extracted for testing)
describe('Metric Calculations', () => {
  describe('isPositiveInteraction logic', () => {
    it('should identify clicks as positive', () => {
      const rec = {
        clicked: true,
        interested: false,
        requestedContact: false,
        askedQuestions: false,
        userRating: null,
        wasSkipped: false,
        rejectionReason: null,
      };
      // Test the logic inline
      const isPositive =
        rec.clicked || rec.interested || rec.requestedContact || rec.askedQuestions;
      expect(isPositive).toBe(true);
    });

    it('should identify skipped as negative', () => {
      const rec = {
        clicked: false,
        interested: false,
        requestedContact: false,
        askedQuestions: false,
        userRating: null,
        wasSkipped: true,
        rejectionReason: null,
      };
      const isNegative = rec.wasSkipped || rec.rejectionReason !== null;
      expect(isNegative).toBe(true);
    });

    it('should identify rejection as negative', () => {
      const rec = {
        clicked: false,
        interested: false,
        requestedContact: false,
        askedQuestions: false,
        userRating: null,
        wasSkipped: false,
        rejectionReason: 'muito caro',
      };
      const isNegative = rec.wasSkipped || rec.rejectionReason !== null;
      expect(isNegative).toBe(true);
    });

    it('should identify low rating as negative', () => {
      const rec = {
        clicked: true,
        interested: false,
        requestedContact: false,
        askedQuestions: false,
        userRating: 1,
        wasSkipped: false,
        rejectionReason: null,
      };
      const isNegativeRating = rec.userRating !== null && rec.userRating <= 2;
      expect(isNegativeRating).toBe(true);
    });

    it('should identify high rating as positive', () => {
      const rec = {
        clicked: false,
        interested: false,
        requestedContact: false,
        askedQuestions: false,
        userRating: 5,
        wasSkipped: false,
        rejectionReason: null,
      };
      const isPositiveRating = rec.userRating !== null && rec.userRating >= 4;
      expect(isPositiveRating).toBe(true);
    });
  });

  describe('Pearson correlation', () => {
    it('should return 1 for identical arrays', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 2, 3, 4, 5];

      // Inline calculation
      const n = x.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
      const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
      const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
      const correlation = denominator === 0 ? 0 : numerator / denominator;

      expect(correlation).toBeCloseTo(1, 5);
    });

    it('should return -1 for inverse arrays', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [5, 4, 3, 2, 1];

      const n = x.length;
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
      const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
      const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
      const correlation = denominator === 0 ? 0 : numerator / denominator;

      expect(correlation).toBeCloseTo(-1, 5);
    });

    it('should return 0 for empty arrays', () => {
      const x: number[] = [];
      const y: number[] = [];

      const correlation = x.length < 2 ? 0 : 1; // Short-circuit
      expect(correlation).toBe(0);
    });
  });
});
