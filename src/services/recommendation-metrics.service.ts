/**
 * Recommendation Metrics Service
 *
 * Calculates recommendation accuracy metrics using ML-style evaluation:
 * - Precision@K: % of top-K recommendations with positive interaction
 * - CTR: Click-through rate
 * - MRR: Mean Reciprocal Rank
 * - Conversion Rate: Leads generated / Conversations with recommendations
 * - Rejection Rate: Negative feedback / Total feedback
 * - Match Score Correlation: Correlation between predicted score and actual engagement
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { recommendationFeedback } from '../lib/recommendation-feedback';

// ============================================================================
// Types
// ============================================================================

export interface AccuracyMetrics {
  period: string;
  generatedAt: string;

  // Sample size
  totalConversations: number;
  totalRecommendations: number;
  conversationsWithFeedback: number;

  // Precision@K: % of recommendations in top-K that had positive interaction
  precisionAt1: number;
  precisionAt3: number;
  precisionAt5: number;

  // Mean Reciprocal Rank: 1/position of first clicked item (average)
  mrr: number;

  // Click-through rate
  ctr: number;

  // Conversion: Leads / Conversations with recommendations
  conversionRate: number;

  // Rejection: Negative feedback / Total interactions
  rejectionRate: number;

  // Engagement: Average engagement score
  avgEngagement: number;

  // Match Score accuracy: correlation between score and actual engagement
  matchScoreCorrelation: number;
}

export interface SegmentMetrics extends AccuracyMetrics {
  segment: string;
}

export interface WorstPerformingRecommendation {
  recommendationId: string;
  conversationId: string;
  vehicle: {
    brand: string;
    model: string;
    year: number;
    price: number | null;
  };
  matchScore: number;
  engagementScore: number;
  issues: string[];
  rejectionReason: string | null;
}

export interface ScoreAnalysis {
  correlation: number;
  overScoredCases: number;
  underScoredCases: number;
  accurateCases: number;
  avgScoreDifference: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Determine if a recommendation had positive interaction
 */
function isPositiveInteraction(rec: {
  clicked: boolean;
  interested: boolean;
  requestedContact: boolean;
  askedQuestions: boolean;
  userRating: number | null;
  wasSkipped: boolean;
  rejectionReason: string | null;
}): boolean {
  // Explicit negative signals
  if (rec.wasSkipped || rec.rejectionReason) return false;
  if (rec.userRating && rec.userRating <= 2) return false;

  // Positive signals
  if (rec.clicked) return true;
  if (rec.interested) return true;
  if (rec.requestedContact) return true;
  if (rec.askedQuestions) return true;
  if (rec.userRating && rec.userRating >= 4) return true;

  return false;
}

/**
 * Get period start date
 */
function getPeriodStart(period: '24h' | '7d' | '30d'): Date {
  const now = new Date();
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

// ============================================================================
// Service Class
// ============================================================================

export class RecommendationMetricsService {
  /**
   * Calculate comprehensive accuracy metrics for a period
   */
  async calculateMetrics(
    period: '24h' | '7d' | '30d' = '7d',
    dateRange?: { startDate: Date; endDate?: Date; periodLabel?: string }
  ): Promise<AccuracyMetrics> {
    const startDate = dateRange?.startDate ?? getPeriodStart(period);
    const endDate = dateRange?.endDate;
    const resolvedPeriod = dateRange?.periodLabel ?? period;

    logger.info(
      { period: resolvedPeriod, startDate, endDate },
      'Calculating recommendation metrics'
    );

    // Fetch all recommendations with feedback data
    const recommendations = await prisma.recommendation.findMany({
      where: {
        createdAt: endDate ? { gte: startDate, lte: endDate } : { gte: startDate },
      },
      include: {
        vehicle: {
          select: { marca: true, modelo: true, ano: true, preco: true },
        },
        conversation: {
          select: {
            id: true,
            lead: { select: { id: true } },
          },
        },
      },
      orderBy: [{ conversationId: 'asc' }, { position: 'asc' }],
    });

    if (recommendations.length === 0) {
      return this.emptyMetrics(resolvedPeriod);
    }

    // Group by conversation
    const byConversation = new Map<string, typeof recommendations>();
    for (const rec of recommendations) {
      const existing = byConversation.get(rec.conversationId) || [];
      existing.push(rec);
      byConversation.set(rec.conversationId, existing);
    }

    // Calculate metrics
    const totalConversations = byConversation.size;
    const totalRecommendations = recommendations.length;

    // Precision@K
    let precision1Sum = 0;
    let precision3Sum = 0;
    let precision5Sum = 0;
    let conversationsWithInteraction = 0;

    // MRR
    let mrrSum = 0;
    let mrrCount = 0;

    // CTR
    let clicked = 0;

    // Conversion
    let conversionsWithLead = 0;

    // Rejection
    let rejections = 0;
    let totalWithFeedback = 0;

    // Engagement scores and match scores for correlation
    const engagementScores: number[] = [];
    const matchScores: number[] = [];

    for (const [convId, recs] of byConversation) {
      // Sort by position
      const sortedRecs = recs.sort((a, b) => a.position - b.position);

      // Check if any rec had interaction
      const hasInteraction = sortedRecs.some(r =>
        isPositiveInteraction({
          clicked: r.clicked,
          interested: r.interested,
          requestedContact: r.requestedContact,
          askedQuestions: r.askedQuestions,
          userRating: r.userRating,
          wasSkipped: r.wasSkipped,
          rejectionReason: r.rejectionReason,
        })
      );

      if (hasInteraction) {
        conversationsWithInteraction++;
      }

      // Precision@1
      if (sortedRecs.length >= 1) {
        const rec = sortedRecs[0];
        if (
          isPositiveInteraction({
            clicked: rec.clicked,
            interested: rec.interested,
            requestedContact: rec.requestedContact,
            askedQuestions: rec.askedQuestions,
            userRating: rec.userRating,
            wasSkipped: rec.wasSkipped,
            rejectionReason: rec.rejectionReason,
          })
        ) {
          precision1Sum++;
        }
      }

      // Precision@3
      const top3 = sortedRecs.slice(0, 3);
      const top3Positive = top3.filter(r =>
        isPositiveInteraction({
          clicked: r.clicked,
          interested: r.interested,
          requestedContact: r.requestedContact,
          askedQuestions: r.askedQuestions,
          userRating: r.userRating,
          wasSkipped: r.wasSkipped,
          rejectionReason: r.rejectionReason,
        })
      ).length;
      if (top3Positive > 0) {
        precision3Sum++;
      }

      // Precision@5
      const top5 = sortedRecs.slice(0, 5);
      const top5Positive = top5.filter(r =>
        isPositiveInteraction({
          clicked: r.clicked,
          interested: r.interested,
          requestedContact: r.requestedContact,
          askedQuestions: r.askedQuestions,
          userRating: r.userRating,
          wasSkipped: r.wasSkipped,
          rejectionReason: r.rejectionReason,
        })
      ).length;
      if (top5Positive > 0) {
        precision5Sum++;
      }

      // MRR: Find first clicked position
      const firstClickedIdx = sortedRecs.findIndex(r => r.clicked);
      if (firstClickedIdx >= 0) {
        mrrSum += 1 / (firstClickedIdx + 1);
        mrrCount++;
      }

      // Check for lead
      if (recs[0]?.conversation?.lead) {
        conversionsWithLead++;
      }

      // Process individual recommendations
      for (const rec of recs) {
        if (rec.clicked) clicked++;

        // Track rejections
        if (rec.rejectionReason || rec.wasSkipped) {
          rejections++;
          totalWithFeedback++;
        } else if (rec.clicked || rec.interested || rec.askedQuestions || rec.requestedContact) {
          totalWithFeedback++;
        }

        // Calculate engagement for correlation
        const engagement = recommendationFeedback.calculateEngagement({
          clicked: rec.clicked,
          viewedAt: rec.viewedAt,
          viewDurationSec: rec.viewDurationSec,
          askedQuestions: rec.askedQuestions,
          requestedContact: rec.requestedContact,
          wasSkipped: rec.wasSkipped,
          rejectionReason: rec.rejectionReason,
          userRating: rec.userRating,
          interested: rec.interested,
        });

        engagementScores.push(engagement.score);
        matchScores.push(rec.matchScore);
      }
    }

    // Calculate final metrics
    const precisionAt1 = totalConversations > 0 ? (precision1Sum / totalConversations) * 100 : 0;
    const precisionAt3 = totalConversations > 0 ? (precision3Sum / totalConversations) * 100 : 0;
    const precisionAt5 = totalConversations > 0 ? (precision5Sum / totalConversations) * 100 : 0;
    const mrr = mrrCount > 0 ? mrrSum / mrrCount : 0;
    const ctr = totalRecommendations > 0 ? (clicked / totalRecommendations) * 100 : 0;
    const conversionRate =
      totalConversations > 0 ? (conversionsWithLead / totalConversations) * 100 : 0;
    const rejectionRate = totalWithFeedback > 0 ? (rejections / totalWithFeedback) * 100 : 0;
    const avgEngagement =
      engagementScores.length > 0
        ? engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length
        : 50;
    const matchScoreCorrelation = pearsonCorrelation(matchScores, engagementScores);

    const metrics: AccuracyMetrics = {
      period: resolvedPeriod,
      generatedAt: new Date().toISOString(),
      totalConversations,
      totalRecommendations,
      conversationsWithFeedback: conversationsWithInteraction,
      precisionAt1: Math.round(precisionAt1 * 10) / 10,
      precisionAt3: Math.round(precisionAt3 * 10) / 10,
      precisionAt5: Math.round(precisionAt5 * 10) / 10,
      mrr: Math.round(mrr * 100) / 100,
      ctr: Math.round(ctr * 10) / 10,
      conversionRate: Math.round(conversionRate * 10) / 10,
      rejectionRate: Math.round(rejectionRate * 10) / 10,
      avgEngagement: Math.round(avgEngagement * 10) / 10,
      matchScoreCorrelation: Math.round(matchScoreCorrelation * 100) / 100,
    };

    logger.info(
      {
        period: resolvedPeriod,
        precisionAt3: metrics.precisionAt3,
        ctr: metrics.ctr,
        mrr: metrics.mrr,
      },
      'Recommendation metrics calculated'
    );

    return metrics;
  }

  /**
   * Calculate metrics for an explicit date range
   */
  async calculateMetricsForRange(
    startDate: Date,
    endDate: Date,
    periodLabel: string = 'custom'
  ): Promise<AccuracyMetrics> {
    const normalizedStart = new Date(startDate);
    const normalizedEnd = new Date(endDate);
    const [from, to] =
      normalizedStart.getTime() <= normalizedEnd.getTime()
        ? [normalizedStart, normalizedEnd]
        : [normalizedEnd, normalizedStart];

    return this.calculateMetrics('7d', {
      startDate: from,
      endDate: to,
      periodLabel,
    });
  }

  /**
   * Get metrics by use-case segment (uber, family, travel, work)
   */
  async calculateMetricsBySegment(
    segment: string,
    period: '24h' | '7d' | '30d' = '7d'
  ): Promise<SegmentMetrics> {
    // For now, we return the overall metrics with segment label
    // In future, we can filter by conversation.profileData or lead.usage
    const metrics = await this.calculateMetrics(period);

    return {
      ...metrics,
      segment,
    };
  }

  /**
   * Get worst performing recommendations for analysis
   */
  async getWorstPerformingRecommendations(
    limit: number = 10,
    period: '24h' | '7d' | '30d' = '7d'
  ): Promise<WorstPerformingRecommendation[]> {
    const startDate = getPeriodStart(period);

    // Get recommendations with negative signals
    const recommendations = await prisma.recommendation.findMany({
      where: {
        createdAt: { gte: startDate },
        OR: [{ wasSkipped: true }, { rejectionReason: { not: null } }, { userRating: { lte: 2 } }],
      },
      include: {
        vehicle: {
          select: { marca: true, modelo: true, ano: true, preco: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Get more to filter
    });

    // Calculate engagement and identify issues
    const results: WorstPerformingRecommendation[] = [];

    for (const rec of recommendations) {
      const engagement = recommendationFeedback.calculateEngagement({
        clicked: rec.clicked,
        viewedAt: rec.viewedAt,
        viewDurationSec: rec.viewDurationSec,
        askedQuestions: rec.askedQuestions,
        requestedContact: rec.requestedContact,
        wasSkipped: rec.wasSkipped,
        rejectionReason: rec.rejectionReason,
        userRating: rec.userRating,
        interested: rec.interested,
      });

      // Identify issues
      const issues: string[] = [];
      if (rec.wasSkipped) issues.push('Ignorado pelo usuário');
      if (rec.rejectionReason) issues.push(`Rejeitado: ${rec.rejectionReason}`);
      if (rec.userRating && rec.userRating <= 2) issues.push(`Rating baixo: ${rec.userRating}★`);
      if (rec.matchScore >= 80 && engagement.score < 30) {
        issues.push('Alto matchScore mas baixo engagement (over-scored)');
      }

      results.push({
        recommendationId: rec.id,
        conversationId: rec.conversationId,
        vehicle: {
          brand: rec.vehicle.marca,
          model: rec.vehicle.modelo,
          year: rec.vehicle.ano,
          price: rec.vehicle.preco,
        },
        matchScore: rec.matchScore,
        engagementScore: engagement.score,
        issues,
        rejectionReason: rec.rejectionReason,
      });
    }

    // Sort by worst engagement first
    results.sort((a, b) => a.engagementScore - b.engagementScore);

    return results.slice(0, limit);
  }

  /**
   * Analyze correlation between matchScore and actual engagement
   */
  async analyzeScoreAccuracy(period: '24h' | '7d' | '30d' = '7d'): Promise<ScoreAnalysis> {
    const startDate = getPeriodStart(period);

    const recommendations = await prisma.recommendation.findMany({
      where: {
        createdAt: { gte: startDate },
        // Only include recommendations with some feedback
        OR: [
          { clicked: true },
          { wasSkipped: true },
          { rejectionReason: { not: null } },
          { userRating: { not: null } },
          { interested: true },
        ],
      },
    });

    if (recommendations.length === 0) {
      return {
        correlation: 0,
        overScoredCases: 0,
        underScoredCases: 0,
        accurateCases: 0,
        avgScoreDifference: 0,
      };
    }

    const matchScores: number[] = [];
    const engagementScores: number[] = [];
    let overScored = 0;
    let underScored = 0;
    let accurate = 0;
    let totalDiff = 0;

    for (const rec of recommendations) {
      const engagement = recommendationFeedback.calculateEngagement({
        clicked: rec.clicked,
        viewedAt: rec.viewedAt,
        viewDurationSec: rec.viewDurationSec,
        askedQuestions: rec.askedQuestions,
        requestedContact: rec.requestedContact,
        wasSkipped: rec.wasSkipped,
        rejectionReason: rec.rejectionReason,
        userRating: rec.userRating,
        interested: rec.interested,
      });

      matchScores.push(rec.matchScore);
      engagementScores.push(engagement.score);

      const diff = rec.matchScore - engagement.score;
      totalDiff += Math.abs(diff);

      // Tolerance of 20 points
      if (diff > 20) {
        overScored++;
      } else if (diff < -20) {
        underScored++;
      } else {
        accurate++;
      }
    }

    return {
      correlation: Math.round(pearsonCorrelation(matchScores, engagementScores) * 100) / 100,
      overScoredCases: overScored,
      underScoredCases: underScored,
      accurateCases: accurate,
      avgScoreDifference: Math.round((totalDiff / recommendations.length) * 10) / 10,
    };
  }

  /**
   * Return empty metrics when no data available
   */
  private emptyMetrics(period: string): AccuracyMetrics {
    return {
      period,
      generatedAt: new Date().toISOString(),
      totalConversations: 0,
      totalRecommendations: 0,
      conversationsWithFeedback: 0,
      precisionAt1: 0,
      precisionAt3: 0,
      precisionAt5: 0,
      mrr: 0,
      ctr: 0,
      conversionRate: 0,
      rejectionRate: 0,
      avgEngagement: 0,
      matchScoreCorrelation: 0,
    };
  }
}

// Singleton export
export const recommendationMetrics = new RecommendationMetricsService();
