/**
 * Recommendation Analysis Service
 *
 * Analyzes recommendation failures to identify patterns and suggest improvements.
 *
 * Features:
 * - Detect recurring failure patterns
 * - Suggest prompt/scoring improvements
 * - Compare performance before/after changes
 * - Generate improvement reports
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { recommendationFeedback } from '../lib/recommendation-feedback';
import { recommendationMetrics, AccuracyMetrics } from './recommendation-metrics.service';

// ============================================================================
// Types
// ============================================================================

export interface FailurePattern {
  id: string;
  pattern: string;
  category:
    | 'over_scoring'
    | 'under_scoring'
    | 'wrong_type'
    | 'wrong_price'
    | 'rejection'
    | 'anti_pattern';
  description: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  suggestedFix: string;
  examples: Array<{
    conversationId: string;
    vehicleBrand: string;
    vehicleModel: string;
    matchScore: number;
    engagementScore: number;
    rejectionReason?: string;
  }>;
}

export interface ImprovementSuggestion {
  priority: 'high' | 'medium' | 'low';
  area: 'scoring' | 'filtering' | 'ranking' | 'anti_patterns' | 'context';
  suggestion: string;
  expectedImpact: string;
  relatedPatterns: string[];
}

export interface VersionComparison {
  beforeDate: string;
  afterDate: string;
  before: AccuracyMetrics;
  after: AccuracyMetrics;
  improvement: {
    precisionAt1: number;
    precisionAt3: number;
    ctr: number;
    mrr: number;
    rejectionRate: number;
    overall: number;
  };
  verdict: 'improved' | 'degraded' | 'neutral';
}

export interface AnalysisReport {
  generatedAt: string;
  period: string;
  failurePatterns: FailurePattern[];
  suggestions: ImprovementSuggestion[];
  topIssues: string[];
  overallHealth: 'healthy' | 'needs_attention' | 'critical';
  metrics: AccuracyMetrics;
}

// ============================================================================
// Pattern Detection Rules
// ============================================================================

const FAILURE_PATTERNS = {
  // Over-scoring patterns
  HATCH_FOR_FAMILY: {
    id: 'hatch_for_family',
    pattern: 'Hatch pequeno recomendado para família com crianças',
    category: 'wrong_type' as const,
    description: 'Carros pequenos como Mobi, Kwid sendo recomendados para famílias',
    suggestedFix: 'Adicionar penalidade de score para hatches compactos em contexto de família',
  },
  OLD_CAR_FOR_UBER: {
    id: 'old_car_for_uber',
    pattern: 'Carro antigo recomendado para Uber',
    category: 'wrong_type' as const,
    description: 'Veículos com ano inferior a 2016 sendo recomendados para Uber',
    suggestedFix: 'Filtrar veículos com ano < 2016 para uso Uber antes do ranking',
  },
  HIGH_SCORE_LOW_ENGAGEMENT: {
    id: 'high_score_low_engagement',
    pattern: 'Alto matchScore mas baixo engagement',
    category: 'over_scoring' as const,
    description: 'Veículos com score > 80 mas engagement < 30',
    suggestedFix: 'Revisar critérios de scoring do VehicleRanker',
  },
  LOW_SCORE_HIGH_ENGAGEMENT: {
    id: 'low_score_high_engagement',
    pattern: 'Baixo matchScore mas alto engagement',
    category: 'under_scoring' as const,
    description: 'Veículos com score < 60 sendo escolhidos pelo usuário',
    suggestedFix: 'Analisar critérios que estão sendo subvalorizados',
  },
  PRICE_MISMATCH: {
    id: 'price_mismatch',
    pattern: 'Veículo fora do orçamento sendo recomendado',
    category: 'wrong_price' as const,
    description: 'Recomendações com preço muito acima do orçamento declarado',
    suggestedFix: 'Aplicar filtro de preço mais estrito antes do ranking',
  },
  FREQUENT_REJECTION: {
    id: 'frequent_rejection',
    pattern: 'Rejeições frequentes do mesmo tipo',
    category: 'rejection' as const,
    description: 'Mesmo motivo de rejeição aparecendo repetidamente',
    suggestedFix: 'Adicionar regra para prevenir recomendações do tipo rejeitado',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

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

function determineImpact(frequency: number, totalRecs: number): 'high' | 'medium' | 'low' {
  const rate = frequency / totalRecs;
  if (rate >= 0.1) return 'high'; // 10%+
  if (rate >= 0.05) return 'medium'; // 5-10%
  return 'low';
}

// ============================================================================
// Service Class
// ============================================================================

export class RecommendationAnalysisService {
  /**
   * Detect recurring failure patterns in recommendations
   */
  async detectFailurePatterns(period: '24h' | '7d' | '30d' = '7d'): Promise<FailurePattern[]> {
    const startDate = getPeriodStart(period);
    const patterns: FailurePattern[] = [];

    // Fetch all recommendations with issues
    const recommendations = await prisma.recommendation.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      include: {
        vehicle: {
          select: {
            marca: true,
            modelo: true,
            ano: true,
            preco: true,
            carroceria: true,
            aptoFamilia: true,
            aptoUber: true,
          },
        },
        conversation: {
          select: {
            profileData: true,
            lead: {
              select: {
                usage: true,
                budget: true,
                people: true,
              },
            },
          },
        },
      },
    });

    if (recommendations.length === 0) {
      return [];
    }

    // Calculate engagement for each recommendation
    const recsWithEngagement = recommendations.map(rec => {
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
      return { ...rec, engagementScore: engagement.score };
    });

    // Pattern 1: High score, low engagement (over-scoring)
    const overScoredRecs = recsWithEngagement.filter(
      r => r.matchScore >= 80 && r.engagementScore < 30
    );
    if (overScoredRecs.length > 0) {
      patterns.push({
        ...FAILURE_PATTERNS.HIGH_SCORE_LOW_ENGAGEMENT,
        frequency: overScoredRecs.length,
        impact: determineImpact(overScoredRecs.length, recommendations.length),
        examples: overScoredRecs.slice(0, 5).map(r => ({
          conversationId: r.conversationId,
          vehicleBrand: r.vehicle.marca,
          vehicleModel: r.vehicle.modelo,
          matchScore: r.matchScore,
          engagementScore: r.engagementScore,
          rejectionReason: r.rejectionReason || undefined,
        })),
      });
    }

    // Pattern 2: Low score, high engagement (under-scoring)
    const underScoredRecs = recsWithEngagement.filter(
      r => r.matchScore < 60 && r.engagementScore >= 70
    );
    if (underScoredRecs.length > 0) {
      patterns.push({
        ...FAILURE_PATTERNS.LOW_SCORE_HIGH_ENGAGEMENT,
        frequency: underScoredRecs.length,
        impact: determineImpact(underScoredRecs.length, recommendations.length),
        examples: underScoredRecs.slice(0, 5).map(r => ({
          conversationId: r.conversationId,
          vehicleBrand: r.vehicle.marca,
          vehicleModel: r.vehicle.modelo,
          matchScore: r.matchScore,
          engagementScore: r.engagementScore,
        })),
      });
    }

    // Pattern 3: Hatch for family (wrong type)
    const hatchForFamilyRecs = recsWithEngagement.filter(r => {
      const isHatch =
        r.vehicle.carroceria?.toLowerCase().includes('hatch') ||
        ['Mobi', 'Kwid', 'Up', 'Uno'].some(m =>
          r.vehicle.modelo.toLowerCase().includes(m.toLowerCase())
        );
      const isFamily =
        r.conversation?.lead?.usage?.toLowerCase().includes('familia') ||
        r.conversation?.lead?.usage?.toLowerCase().includes('família') ||
        (r.conversation?.lead?.people && r.conversation.lead.people >= 4);
      const wasRejected = r.wasSkipped || r.rejectionReason !== null;
      return isHatch && isFamily && wasRejected;
    });
    if (hatchForFamilyRecs.length > 0) {
      patterns.push({
        ...FAILURE_PATTERNS.HATCH_FOR_FAMILY,
        frequency: hatchForFamilyRecs.length,
        impact: determineImpact(hatchForFamilyRecs.length, recommendations.length),
        examples: hatchForFamilyRecs.slice(0, 5).map(r => ({
          conversationId: r.conversationId,
          vehicleBrand: r.vehicle.marca,
          vehicleModel: r.vehicle.modelo,
          matchScore: r.matchScore,
          engagementScore: r.engagementScore,
          rejectionReason: r.rejectionReason || undefined,
        })),
      });
    }

    // Pattern 4: Old car for Uber
    const oldCarForUberRecs = recsWithEngagement.filter(r => {
      const isOld = r.vehicle.ano < 2016;
      const isUber =
        r.conversation?.lead?.usage?.toLowerCase().includes('uber') ||
        r.conversation?.lead?.usage?.toLowerCase().includes('99');
      const wasRejected = r.wasSkipped || r.rejectionReason !== null;
      return isOld && isUber && wasRejected;
    });
    if (oldCarForUberRecs.length > 0) {
      patterns.push({
        ...FAILURE_PATTERNS.OLD_CAR_FOR_UBER,
        frequency: oldCarForUberRecs.length,
        impact: determineImpact(oldCarForUberRecs.length, recommendations.length),
        examples: oldCarForUberRecs.slice(0, 5).map(r => ({
          conversationId: r.conversationId,
          vehicleBrand: r.vehicle.marca,
          vehicleModel: r.vehicle.modelo,
          matchScore: r.matchScore,
          engagementScore: r.engagementScore,
          rejectionReason: r.rejectionReason || undefined,
        })),
      });
    }

    // Pattern 5: Price mismatch
    const priceMismatchRecs = recsWithEngagement.filter(r => {
      const budget = r.conversation?.lead?.budget;
      const price = r.vehicle.preco;
      if (!budget || !price) return false;
      const wasRejected = r.wasSkipped || r.rejectionReason?.toLowerCase().includes('caro');
      return price > budget * 1.2 && wasRejected; // 20% acima do orçamento
    });
    if (priceMismatchRecs.length > 0) {
      patterns.push({
        ...FAILURE_PATTERNS.PRICE_MISMATCH,
        frequency: priceMismatchRecs.length,
        impact: determineImpact(priceMismatchRecs.length, recommendations.length),
        examples: priceMismatchRecs.slice(0, 5).map(r => ({
          conversationId: r.conversationId,
          vehicleBrand: r.vehicle.marca,
          vehicleModel: r.vehicle.modelo,
          matchScore: r.matchScore,
          engagementScore: r.engagementScore,
          rejectionReason: r.rejectionReason || undefined,
        })),
      });
    }

    // Pattern 6: Frequent rejection reasons
    const rejectionReasons = recsWithEngagement
      .filter(r => r.rejectionReason)
      .map(r => r.rejectionReason!.toLowerCase());

    const reasonCounts: Record<string, number> = {};
    for (const reason of rejectionReasons) {
      // Normalize reasons
      let normalized = reason;
      if (reason.includes('caro') || reason.includes('preço') || reason.includes('orçamento')) {
        normalized = 'preço alto';
      } else if (reason.includes('antigo') || reason.includes('velho') || reason.includes('ano')) {
        normalized = 'veículo antigo';
      } else if (reason.includes('pequeno') || reason.includes('espaço')) {
        normalized = 'veículo pequeno';
      }
      reasonCounts[normalized] = (reasonCounts[normalized] || 0) + 1;
    }

    // Find frequent rejection reasons (> 3 occurrences)
    for (const [reason, count] of Object.entries(reasonCounts)) {
      if (count >= 3) {
        const exampleRecs = recsWithEngagement
          .filter(r => r.rejectionReason?.toLowerCase().includes(reason.split(' ')[0]))
          .slice(0, 5);

        patterns.push({
          id: `rejection_${reason.replace(/\s/g, '_')}`,
          pattern: `Rejeição frequente: "${reason}"`,
          category: 'rejection',
          description: `${count} rejeições com motivo "${reason}"`,
          frequency: count,
          impact: determineImpact(count, recommendations.length),
          suggestedFix: `Adicionar filtro ou penalidade para evitar recomendações que causam "${reason}"`,
          examples: exampleRecs.map(r => ({
            conversationId: r.conversationId,
            vehicleBrand: r.vehicle.marca,
            vehicleModel: r.vehicle.modelo,
            matchScore: r.matchScore,
            engagementScore: r.engagementScore,
            rejectionReason: r.rejectionReason || undefined,
          })),
        });
      }
    }

    // Sort by impact
    const impactOrder = { high: 0, medium: 1, low: 2 };
    patterns.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

    logger.info({ patternCount: patterns.length, period }, 'Failure patterns detected');

    return patterns;
  }

  /**
   * Generate improvement suggestions based on failure patterns
   */
  async suggestImprovements(period: '24h' | '7d' | '30d' = '7d'): Promise<ImprovementSuggestion[]> {
    const patterns = await this.detectFailurePatterns(period);
    const suggestions: ImprovementSuggestion[] = [];

    // Group patterns by category
    const patternsByCategory: Record<string, FailurePattern[]> = {};
    for (const pattern of patterns) {
      if (!patternsByCategory[pattern.category]) {
        patternsByCategory[pattern.category] = [];
      }
      patternsByCategory[pattern.category].push(pattern);
    }

    // Generate suggestions based on patterns
    if (patternsByCategory.over_scoring?.length > 0) {
      suggestions.push({
        priority: patternsByCategory.over_scoring.some(p => p.impact === 'high')
          ? 'high'
          : 'medium',
        area: 'scoring',
        suggestion:
          'Revisar critérios de scoring do VehicleRanker. Considerar reduzir peso de características genéricas e aumentar peso de match específico com requisitos do usuário.',
        expectedImpact: 'Redução de 15-20% em recomendações ignoradas',
        relatedPatterns: patternsByCategory.over_scoring.map(p => p.id),
      });
    }

    if (patternsByCategory.under_scoring?.length > 0) {
      suggestions.push({
        priority: 'medium',
        area: 'scoring',
        suggestion:
          'Analisar veículos com baixo score que tiveram alto engagement. Identificar critérios relevantes não considerados no ranking.',
        expectedImpact: 'Melhoria de 10% no MRR (Mean Reciprocal Rank)',
        relatedPatterns: patternsByCategory.under_scoring.map(p => p.id),
      });
    }

    if (patternsByCategory.wrong_type?.length > 0) {
      suggestions.push({
        priority: 'high',
        area: 'filtering',
        suggestion:
          'Implementar filtros pré-ranking mais estritos baseados no contexto do usuário. Exemplo: excluir hatches compactos para famílias, excluir carros antigos para Uber.',
        expectedImpact: 'Redução de 25-30% em rejeições',
        relatedPatterns: patternsByCategory.wrong_type.map(p => p.id),
      });
    }

    if (patternsByCategory.wrong_price?.length > 0) {
      suggestions.push({
        priority: 'high',
        area: 'filtering',
        suggestion:
          'Aplicar filtro de preço mais restritivo. Considerar no máximo 10% acima do orçamento declarado ao invés de 20%.',
        expectedImpact: 'Redução significativa em rejeições por preço',
        relatedPatterns: patternsByCategory.wrong_price.map(p => p.id),
      });
    }

    if (patternsByCategory.rejection?.length > 0) {
      const topRejectionReasons = patternsByCategory.rejection
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3)
        .map(p => p.pattern);

      suggestions.push({
        priority: patternsByCategory.rejection.some(p => p.impact === 'high') ? 'high' : 'medium',
        area: 'anti_patterns',
        suggestion: `Adicionar regras de anti-pattern para os motivos de rejeição mais comuns: ${topRejectionReasons.join(', ')}`,
        expectedImpact: 'Redução de 20% na taxa de rejeição',
        relatedPatterns: patternsByCategory.rejection.map(p => p.id),
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions;
  }

  /**
   * Compare metrics before and after a specific date
   */
  async compareVersions(beforeDate: Date, afterDate: Date): Promise<VersionComparison> {
    // Get metrics for "before" period (7 days before the date)
    const beforeStart = new Date(beforeDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const afterEnd = new Date(afterDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Calculate metrics for each period
    const [beforeMetrics, afterMetrics] = await Promise.all([
      this.calculateMetricsForDateRange(beforeStart, beforeDate),
      this.calculateMetricsForDateRange(afterDate, afterEnd),
    ]);

    // Calculate improvements
    const improvement = {
      precisionAt1: afterMetrics.precisionAt1 - beforeMetrics.precisionAt1,
      precisionAt3: afterMetrics.precisionAt3 - beforeMetrics.precisionAt3,
      ctr: afterMetrics.ctr - beforeMetrics.ctr,
      mrr: afterMetrics.mrr - beforeMetrics.mrr,
      rejectionRate: beforeMetrics.rejectionRate - afterMetrics.rejectionRate, // Negative is good
      overall: 0,
    };

    // Calculate overall improvement score
    improvement.overall =
      (improvement.precisionAt1 / 10 +
        improvement.precisionAt3 / 10 +
        improvement.ctr / 10 +
        improvement.mrr * 10 +
        improvement.rejectionRate / 10) /
      5;

    // Determine verdict
    let verdict: 'improved' | 'degraded' | 'neutral';
    if (improvement.overall > 2) {
      verdict = 'improved';
    } else if (improvement.overall < -2) {
      verdict = 'degraded';
    } else {
      verdict = 'neutral';
    }

    return {
      beforeDate: beforeDate.toISOString(),
      afterDate: afterDate.toISOString(),
      before: beforeMetrics,
      after: afterMetrics,
      improvement,
      verdict,
    };
  }

  /**
   * Generate comprehensive analysis report
   */
  async generateReport(period: '24h' | '7d' | '30d' = '7d'): Promise<AnalysisReport> {
    const [failurePatterns, suggestions, metrics] = await Promise.all([
      this.detectFailurePatterns(period),
      this.suggestImprovements(period),
      recommendationMetrics.calculateMetrics(period),
    ]);

    // Determine overall health
    const highImpactPatterns = failurePatterns.filter(p => p.impact === 'high').length;
    let overallHealth: 'healthy' | 'needs_attention' | 'critical';

    if (highImpactPatterns >= 3 || metrics.rejectionRate > 30) {
      overallHealth = 'critical';
    } else if (highImpactPatterns >= 1 || metrics.rejectionRate > 20 || metrics.precisionAt3 < 60) {
      overallHealth = 'needs_attention';
    } else {
      overallHealth = 'healthy';
    }

    // Top issues summary
    const topIssues = failurePatterns.slice(0, 3).map(p => p.description);

    return {
      generatedAt: new Date().toISOString(),
      period,
      failurePatterns,
      suggestions,
      topIssues,
      overallHealth,
      metrics,
    };
  }

  /**
   * Calculate metrics for a specific date range
   */
  private async calculateMetricsForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<AccuracyMetrics> {
    const periodLabel = `${startDate.toISOString().slice(0, 10)}..${endDate
      .toISOString()
      .slice(0, 10)}`;
    return recommendationMetrics.calculateMetricsForRange(startDate, endDate, periodLabel);
  }
}

// Singleton export
export const recommendationAnalysis = new RecommendationAnalysisService();
