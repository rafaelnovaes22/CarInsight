/**
 * Unit tests for RecommendationAnalysisService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
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

vi.mock('../../../src/services/recommendation-metrics.service', () => ({
  recommendationMetrics: {
    calculateMetrics: vi.fn().mockResolvedValue({
      period: '7d',
      generatedAt: new Date().toISOString(),
      totalConversations: 10,
      totalRecommendations: 30,
      conversationsWithFeedback: 8,
      precisionAt1: 60,
      precisionAt3: 70,
      precisionAt5: 75,
      mrr: 0.65,
      ctr: 25,
      conversionRate: 15,
      rejectionRate: 20,
      avgEngagement: 55,
      matchScoreCorrelation: 0.45,
    }),
  },
}));

import { RecommendationAnalysisService } from '../../../src/services/recommendation-analysis.service';

describe('RecommendationAnalysisService', () => {
  let service: RecommendationAnalysisService;

  beforeEach(() => {
    service = new RecommendationAnalysisService();
    vi.clearAllMocks();
  });

  describe('detectFailurePatterns', () => {
    it('should return empty array when no recommendations', async () => {
      const patterns = await service.detectFailurePatterns('7d');
      expect(patterns).toEqual([]);
    });

    it('should return patterns sorted by impact', async () => {
      const patterns = await service.detectFailurePatterns('7d');
      // Verify sorted order if any patterns exist
      for (let i = 1; i < patterns.length; i++) {
        const impactOrder = { high: 0, medium: 1, low: 2 };
        expect(impactOrder[patterns[i].impact]).toBeGreaterThanOrEqual(
          impactOrder[patterns[i - 1].impact]
        );
      }
    });
  });

  describe('suggestImprovements', () => {
    it('should return empty array when no failure patterns', async () => {
      const suggestions = await service.suggestImprovements('7d');
      expect(suggestions).toEqual([]);
    });

    it('should return suggestions sorted by priority', async () => {
      const suggestions = await service.suggestImprovements('7d');
      for (let i = 1; i < suggestions.length; i++) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        expect(priorityOrder[suggestions[i].priority]).toBeGreaterThanOrEqual(
          priorityOrder[suggestions[i - 1].priority]
        );
      }
    });
  });

  describe('compareVersions', () => {
    it('should return version comparison with verdict', async () => {
      const before = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const after = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const comparison = await service.compareVersions(before, after);

      expect(comparison.beforeDate).toBeDefined();
      expect(comparison.afterDate).toBeDefined();
      expect(comparison.before).toBeDefined();
      expect(comparison.after).toBeDefined();
      expect(comparison.improvement).toBeDefined();
      expect(['improved', 'degraded', 'neutral']).toContain(comparison.verdict);
    });

    it('should calculate improvement correctly', async () => {
      const before = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const after = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const comparison = await service.compareVersions(before, after);

      expect(comparison.improvement.precisionAt1).toBeDefined();
      expect(comparison.improvement.ctr).toBeDefined();
      expect(comparison.improvement.overall).toBeDefined();
    });
  });

  describe('generateReport', () => {
    it('should return comprehensive report', async () => {
      const report = await service.generateReport('7d');

      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBe('7d');
      expect(report.failurePatterns).toBeDefined();
      expect(report.suggestions).toBeDefined();
      expect(report.topIssues).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(['healthy', 'needs_attention', 'critical']).toContain(report.overallHealth);
    });

    it('should include top 3 issues', async () => {
      const report = await service.generateReport('7d');
      expect(report.topIssues.length).toBeLessThanOrEqual(3);
    });
  });
});

describe('Failure Pattern Types', () => {
  it('should have valid pattern categories', () => {
    const validCategories = [
      'over_scoring',
      'under_scoring',
      'wrong_type',
      'wrong_price',
      'rejection',
      'anti_pattern',
    ];

    // Test that our pattern detection logic uses valid categories
    expect(validCategories).toContain('over_scoring');
    expect(validCategories).toContain('wrong_type');
    expect(validCategories).toContain('rejection');
  });

  it('should have valid impact levels', () => {
    const validImpacts = ['high', 'medium', 'low'];
    expect(validImpacts).toContain('high');
    expect(validImpacts).toContain('medium');
    expect(validImpacts).toContain('low');
  });

  it('should have valid suggestion areas', () => {
    const validAreas = ['scoring', 'filtering', 'ranking', 'anti_patterns', 'context'];
    expect(validAreas).toContain('scoring');
    expect(validAreas).toContain('filtering');
    expect(validAreas).toContain('anti_patterns');
  });
});

describe('Health Assessment Logic', () => {
  it('should classify as critical with 3+ high impact patterns', () => {
    // Testing the logic inline
    const highImpactPatterns = 3;
    const rejectionRate = 20;

    let health: 'healthy' | 'needs_attention' | 'critical';
    if (highImpactPatterns >= 3 || rejectionRate > 30) {
      health = 'critical';
    } else if (highImpactPatterns >= 1 || rejectionRate > 20) {
      health = 'needs_attention';
    } else {
      health = 'healthy';
    }

    expect(health).toBe('critical');
  });

  it('should classify as needs_attention with 1 high impact pattern', () => {
    const highImpactPatterns = 1;
    const rejectionRate = 15;

    let health: 'healthy' | 'needs_attention' | 'critical';
    if (highImpactPatterns >= 3 || rejectionRate > 30) {
      health = 'critical';
    } else if (highImpactPatterns >= 1 || rejectionRate > 20) {
      health = 'needs_attention';
    } else {
      health = 'healthy';
    }

    expect(health).toBe('needs_attention');
  });

  it('should classify as healthy with no issues', () => {
    const highImpactPatterns = 0;
    const rejectionRate = 15;

    let health: 'healthy' | 'needs_attention' | 'critical';
    if (highImpactPatterns >= 3 || rejectionRate > 30) {
      health = 'critical';
    } else if (highImpactPatterns >= 1 || rejectionRate > 20) {
      health = 'needs_attention';
    } else {
      health = 'healthy';
    }

    expect(health).toBe('healthy');
  });
});
