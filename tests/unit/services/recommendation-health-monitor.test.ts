import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from '../../../src/lib/alerts';
import { RecommendationHealthMonitorService } from '../../../src/services/recommendation-health-monitor.service';

const mockCalculateMetrics = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/recommendation-metrics.service', () => ({
  recommendationMetrics: {
    calculateMetrics: (...args: any[]) => mockCalculateMetrics(...args),
  },
}));

describe('RecommendationHealthMonitorService', () => {
  let service: RecommendationHealthMonitorService;

  beforeEach(() => {
    vi.clearAllMocks();
    AlertService.clear();
    service = new RecommendationHealthMonitorService();
  });

  it('returns healthy when metrics are above thresholds and drift is stable', async () => {
    mockCalculateMetrics.mockImplementation(async (period: string) => {
      if (period === '7d') {
        return {
          period: '7d',
          generatedAt: new Date().toISOString(),
          totalConversations: 40,
          totalRecommendations: 140,
          conversationsWithFeedback: 25,
          precisionAt1: 62,
          precisionAt3: 72,
          precisionAt5: 78,
          mrr: 0.71,
          ctr: 27,
          conversionRate: 18,
          rejectionRate: 16,
          avgEngagement: 58,
          matchScoreCorrelation: 0.5,
        };
      }

      return {
        period: '30d',
        generatedAt: new Date().toISOString(),
        totalConversations: 120,
        totalRecommendations: 430,
        conversationsWithFeedback: 90,
        precisionAt1: 60,
        precisionAt3: 70,
        precisionAt5: 77,
        mrr: 0.7,
        ctr: 26,
        conversionRate: 17,
        rejectionRate: 17,
        avgEngagement: 57,
        matchScoreCorrelation: 0.48,
      };
    });

    const snapshot = await service.evaluateHealth('7d', '30d');

    expect(snapshot.status).toBe('healthy');
    expect(snapshot.checks.every(c => c.status === 'healthy')).toBe(true);
  });

  it('returns critical when precision and rejection thresholds are violated', async () => {
    mockCalculateMetrics.mockImplementation(async (period: string) => {
      if (period === '7d') {
        return {
          period: '7d',
          generatedAt: new Date().toISOString(),
          totalConversations: 30,
          totalRecommendations: 110,
          conversationsWithFeedback: 22,
          precisionAt1: 42,
          precisionAt3: 49,
          precisionAt5: 61,
          mrr: 0.45,
          ctr: 13,
          conversionRate: 10,
          rejectionRate: 34,
          avgEngagement: 41,
          matchScoreCorrelation: 0.2,
        };
      }

      return {
        period: '30d',
        generatedAt: new Date().toISOString(),
        totalConversations: 120,
        totalRecommendations: 430,
        conversationsWithFeedback: 90,
        precisionAt1: 58,
        precisionAt3: 68,
        precisionAt5: 75,
        mrr: 0.65,
        ctr: 24,
        conversionRate: 16,
        rejectionRate: 20,
        avgEngagement: 54,
        matchScoreCorrelation: 0.4,
      };
    });

    const snapshot = await service.evaluateHealth('7d', '30d');

    expect(snapshot.status).toBe('critical');
    expect(snapshot.checks.find(c => c.id === 'precision_at_3')?.status).toBe('critical');
    expect(snapshot.checks.find(c => c.id === 'rejection_rate')?.status).toBe('critical');
  });

  it('returns warning when drift degrades even if absolute thresholds are still met', async () => {
    mockCalculateMetrics.mockImplementation(async (period: string) => {
      if (period === '7d') {
        return {
          period: '7d',
          generatedAt: new Date().toISOString(),
          totalConversations: 35,
          totalRecommendations: 125,
          conversationsWithFeedback: 20,
          precisionAt1: 55,
          precisionAt3: 61,
          precisionAt5: 73,
          mrr: 0.63,
          ctr: 21,
          conversionRate: 15,
          rejectionRate: 22,
          avgEngagement: 52,
          matchScoreCorrelation: 0.39,
        };
      }

      return {
        period: '30d',
        generatedAt: new Date().toISOString(),
        totalConversations: 130,
        totalRecommendations: 460,
        conversationsWithFeedback: 95,
        precisionAt1: 64,
        precisionAt3: 74,
        precisionAt5: 79,
        mrr: 0.72,
        ctr: 31,
        conversionRate: 18,
        rejectionRate: 11,
        avgEngagement: 60,
        matchScoreCorrelation: 0.52,
      };
    });

    const snapshot = await service.evaluateHealth('7d', '30d', {
      thresholds: {
        precisionAt3DropWarning: 8,
        rejectionRateIncreaseWarning: 8,
        ctrDropWarning: 6,
      },
    });

    expect(snapshot.status).toBe('warning');
    expect(snapshot.checks.find(c => c.id === 'precision_drift')?.status).toBe('warning');
    expect(snapshot.checks.find(c => c.id === 'rejection_drift')?.status).toBe('warning');
    expect(snapshot.checks.find(c => c.id === 'ctr_drift')?.status).toBe('warning');
  });

  it('emits critical alert and then recovery alert when quality returns to healthy', async () => {
    mockCalculateMetrics
      .mockResolvedValueOnce({
        period: '7d',
        generatedAt: new Date().toISOString(),
        totalConversations: 20,
        totalRecommendations: 90,
        conversationsWithFeedback: 14,
        precisionAt1: 40,
        precisionAt3: 50,
        precisionAt5: 60,
        mrr: 0.4,
        ctr: 12,
        conversionRate: 9,
        rejectionRate: 33,
        avgEngagement: 39,
        matchScoreCorrelation: 0.19,
      })
      .mockResolvedValueOnce({
        period: '30d',
        generatedAt: new Date().toISOString(),
        totalConversations: 120,
        totalRecommendations: 420,
        conversationsWithFeedback: 90,
        precisionAt1: 62,
        precisionAt3: 70,
        precisionAt5: 78,
        mrr: 0.7,
        ctr: 26,
        conversionRate: 17,
        rejectionRate: 17,
        avgEngagement: 57,
        matchScoreCorrelation: 0.48,
      })
      .mockResolvedValueOnce({
        period: '7d',
        generatedAt: new Date().toISOString(),
        totalConversations: 28,
        totalRecommendations: 100,
        conversationsWithFeedback: 16,
        precisionAt1: 63,
        precisionAt3: 71,
        precisionAt5: 79,
        mrr: 0.72,
        ctr: 27,
        conversionRate: 18,
        rejectionRate: 15,
        avgEngagement: 58,
        matchScoreCorrelation: 0.5,
      })
      .mockResolvedValueOnce({
        period: '30d',
        generatedAt: new Date().toISOString(),
        totalConversations: 120,
        totalRecommendations: 420,
        conversationsWithFeedback: 90,
        precisionAt1: 62,
        precisionAt3: 70,
        precisionAt5: 78,
        mrr: 0.7,
        ctr: 26,
        conversionRate: 17,
        rejectionRate: 17,
        avgEngagement: 57,
        matchScoreCorrelation: 0.48,
      });

    const first = await service.evaluateHealth('7d', '30d', { emitAlerts: true });
    const second = await service.evaluateHealth('7d', '30d', { emitAlerts: true });

    expect(first.status).toBe('critical');
    expect(second.status).toBe('healthy');

    const recent = AlertService.getRecent(5);
    expect(recent.length).toBe(2);
    expect(recent[0].title).toBe('Recommendation Quality Drift');
    expect(recent[0].severity).toBe('critical');
    expect(recent[1].title).toBe('Recommendation Quality Recovered');
    expect(recent[1].severity).toBe('info');
  });
});
