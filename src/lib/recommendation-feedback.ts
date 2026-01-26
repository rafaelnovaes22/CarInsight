/**
 * Recommendation Feedback Service
 *
 * Captures and analyzes user feedback on vehicle recommendations
 * to evaluate and improve recommendation accuracy.
 *
 * Features:
 * - Record explicit feedback (ratings, text)
 * - Track implicit signals (clicks, views, questions)
 * - Detect rejection patterns via NLP
 * - Calculate engagement scores
 */

import { prisma } from './prisma';
import { logger } from './logger';
import { chatCompletion } from './llm-router';

// ============================================================================
// Types
// ============================================================================

export type FeedbackType = 'positive' | 'negative' | 'neutral';
export type SignalType = 'click' | 'view' | 'question' | 'contact' | 'skip' | 'reject' | 'rating';

export interface FeedbackSignal {
  recommendationId: string;
  type: SignalType;
  value?: string | number;
  timestamp?: Date;
}

export interface RejectionAnalysis {
  isRejection: boolean;
  rejectedRecId?: string;
  reason?: string;
  confidence: number;
}

export interface EngagementScore {
  score: number; // 0-100
  signals: {
    clicked: boolean;
    viewed: boolean;
    askedQuestion: boolean;
    requestedContact: boolean;
    wasSkipped: boolean;
    hasRejection: boolean;
    rating?: number;
  };
}

// ============================================================================
// Rejection Detection Patterns
// ============================================================================

const REJECTION_PATTERNS = {
  price: [
    /muito caro/i,
    /fora do (meu )?orçamento/i,
    /não tenho (esse|tanto) dinheiro/i,
    /acima do (meu )?limite/i,
    /preço (muito )?alto/i,
    /pagar menos/i,
    /mais barato/i,
  ],
  age: [
    /muito (antigo|velho)/i,
    /ano muito baixo/i,
    /quero (\w+ )?mais novo/i,
    /quero (\w+ )?(mais )?recente/i,
    /carro (mais )?recente/i,
    /não quero (carro )?usado/i,
    /carro mais novo/i,
    /veículo mais novo/i,
  ],
  condition: [/muita quilometragem/i, /km (muito )?alto/i, /rodou demais/i, /muito rodado/i],
  type: [
    /não gosto de (hatch|sedan|suv|pickup)/i,
    /não quero (hatch|sedan|suv|pickup)/i,
    /prefiro (hatch|sedan|suv|pickup)/i,
    /quero (hatch|sedan|suv|pickup)/i,
  ],
  brand: [/não gosto (d[aeo] )?(\w+)/i, /não quero (\w+)/i, /prefiro outra marca/i],
  general: [
    /não gostei/i,
    /não (me )?serve/i,
    /não é (o )?que (eu )?procuro/i,
    /não (é )?isso/i,
    /não quero (esse|este|nenhum)/i,
    /descarta/i,
    /passa para o próximo/i,
    /tem outro/i,
    /mostra outro/i,
  ],
};

// ============================================================================
// Service Class
// ============================================================================

export class RecommendationFeedbackService {
  /**
   * Record a feedback signal for a recommendation
   */
  async recordSignal(signal: FeedbackSignal): Promise<void> {
    const { recommendationId, type, value, timestamp = new Date() } = signal;

    try {
      const updateData: Record<string, unknown> = {};

      switch (type) {
        case 'click':
          updateData.clicked = true;
          break;

        case 'view':
          updateData.viewedAt = timestamp;
          if (typeof value === 'number') {
            updateData.viewDurationSec = value;
          }
          break;

        case 'question':
          updateData.askedQuestions = true;
          break;

        case 'contact':
          updateData.requestedContact = true;
          updateData.interested = true;
          break;

        case 'skip':
          updateData.wasSkipped = true;
          break;

        case 'reject':
          updateData.feedbackType = 'negative';
          updateData.feedbackAt = timestamp;
          if (typeof value === 'string') {
            updateData.rejectionReason = value;
          }
          break;

        case 'rating':
          if (typeof value === 'number' && value >= 1 && value <= 5) {
            updateData.userRating = value;
            updateData.feedbackAt = timestamp;
            updateData.feedbackType = value >= 4 ? 'positive' : value <= 2 ? 'negative' : 'neutral';
          }
          break;
      }

      await prisma.recommendation.update({
        where: { id: recommendationId },
        data: updateData,
      });

      logger.info({ recommendationId, type, value }, 'Recommendation feedback signal recorded');
    } catch (error) {
      logger.error({ error, recommendationId, type }, 'Failed to record feedback signal');
      throw error;
    }
  }

  /**
   * Record explicit text feedback from user
   */
  async recordTextFeedback(
    recommendationId: string,
    feedback: string,
    type: FeedbackType = 'neutral'
  ): Promise<void> {
    await prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        userFeedback: feedback,
        feedbackType: type,
        feedbackAt: new Date(),
      },
    });

    logger.info({ recommendationId, type }, 'Text feedback recorded');
  }

  /**
   * Detect rejection in user message using pattern matching
   * Fast, deterministic, no LLM call
   */
  detectRejectionPatterns(message: string): {
    isRejection: boolean;
    reason?: string;
    category?: string;
  } {
    const normalizedMessage = message.toLowerCase().trim();

    for (const [category, patterns] of Object.entries(REJECTION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          // Extract the matched reason
          const match = normalizedMessage.match(pattern);
          return {
            isRejection: true,
            reason: match ? match[0] : category,
            category,
          };
        }
      }
    }

    return { isRejection: false };
  }

  /**
   * Detect which recommendation was rejected using LLM (more accurate)
   * Use when pattern matching is insufficient
   */
  async detectRejectionWithLLM(
    message: string,
    recentRecommendations: Array<{
      id: string;
      brand: string;
      model: string;
      year: number;
      price: number;
    }>
  ): Promise<RejectionAnalysis> {
    if (recentRecommendations.length === 0) {
      return { isRejection: false, confidence: 1.0 };
    }

    // First, quick pattern check
    const patternResult = this.detectRejectionPatterns(message);
    if (!patternResult.isRejection) {
      return { isRejection: false, confidence: 0.9 };
    }

    // If pattern detected, use LLM to identify which vehicle
    try {
      const vehicleList = recentRecommendations
        .map(
          (r, i) =>
            `${i + 1}. ${r.brand} ${r.model} ${r.year} - R$ ${r.price.toLocaleString('pt-BR')} (ID: ${r.id})`
        )
        .join('\n');

      const prompt = `Analise esta mensagem do usuário e identifique se ele está rejeitando algum veículo das recomendações recentes.

MENSAGEM DO USUÁRIO:
"${message}"

VEÍCULOS RECOMENDADOS RECENTEMENTE:
${vehicleList}

Responda em JSON:
{
  "isRejection": true/false,
  "vehicleId": "id do veículo rejeitado ou null se geral",
  "reason": "motivo da rejeição em português",
  "confidence": 0.0-1.0
}

Se o usuário está rejeitando todos, vehicleId = null.
Se não está rejeitando nenhum, isRejection = false.`;

      const response = await chatCompletion([{ role: 'user', content: prompt }], {
        temperature: 0.1,
        maxTokens: 200,
      });

      // Parse response
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      return {
        isRejection: parsed.isRejection === true,
        rejectedRecId: parsed.vehicleId || undefined,
        reason: parsed.reason || patternResult.reason,
        confidence: parsed.confidence || 0.7,
      };
    } catch (error) {
      logger.error({ error, message }, 'LLM rejection detection failed, using pattern result');

      // Fallback to pattern result
      return {
        isRejection: patternResult.isRejection,
        reason: patternResult.reason,
        confidence: 0.5,
      };
    }
  }

  /**
   * Calculate engagement score for a recommendation
   * Higher score = more engaged user = likely good recommendation
   */
  calculateEngagement(rec: {
    clicked: boolean;
    viewedAt: Date | null;
    viewDurationSec: number | null;
    askedQuestions: boolean;
    requestedContact: boolean;
    wasSkipped: boolean;
    rejectionReason: string | null;
    userRating: number | null;
    interested: boolean;
  }): EngagementScore {
    let score = 50; // Base score

    const signals = {
      clicked: rec.clicked,
      viewed: rec.viewedAt !== null,
      askedQuestion: rec.askedQuestions,
      requestedContact: rec.requestedContact,
      wasSkipped: rec.wasSkipped,
      hasRejection: rec.rejectionReason !== null,
      rating: rec.userRating ?? undefined,
    };

    // Positive signals
    if (rec.clicked) score += 10;
    if (rec.viewedAt) score += 5;
    if (rec.viewDurationSec && rec.viewDurationSec > 30) score += 10;
    if (rec.askedQuestions) score += 15;
    if (rec.requestedContact) score += 25;
    if (rec.interested) score += 20;

    // Rating impact
    if (rec.userRating) {
      score += (rec.userRating - 3) * 10; // 1★=-20, 5★=+20
    }

    // Negative signals
    if (rec.wasSkipped) score -= 20;
    if (rec.rejectionReason) score -= 30;

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    return { score, signals };
  }

  /**
   * Get feedback summary for a conversation
   */
  async getConversationFeedbackSummary(conversationId: string): Promise<{
    totalRecommendations: number;
    clicked: number;
    skipped: number;
    rejected: number;
    positiveRatings: number;
    negativeRatings: number;
    avgEngagement: number;
    topRejectionReasons: string[];
  }> {
    const recommendations = await prisma.recommendation.findMany({
      where: { conversationId },
      select: {
        clicked: true,
        wasSkipped: true,
        rejectionReason: true,
        userRating: true,
        viewedAt: true,
        viewDurationSec: true,
        askedQuestions: true,
        requestedContact: true,
        interested: true,
      },
    });

    if (recommendations.length === 0) {
      return {
        totalRecommendations: 0,
        clicked: 0,
        skipped: 0,
        rejected: 0,
        positiveRatings: 0,
        negativeRatings: 0,
        avgEngagement: 0,
        topRejectionReasons: [],
      };
    }

    // Calculate engagement for each
    const engagements = recommendations.map(r =>
      this.calculateEngagement({
        clicked: r.clicked,
        viewedAt: r.viewedAt,
        viewDurationSec: r.viewDurationSec,
        askedQuestions: r.askedQuestions,
        requestedContact: r.requestedContact,
        wasSkipped: r.wasSkipped,
        rejectionReason: r.rejectionReason,
        userRating: r.userRating,
        interested: r.interested,
      })
    );

    // Aggregate rejection reasons
    const rejectionReasons = recommendations
      .filter(r => r.rejectionReason)
      .map(r => r.rejectionReason as string);

    const reasonCounts = rejectionReasons.reduce(
      (acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason]) => reason);

    return {
      totalRecommendations: recommendations.length,
      clicked: recommendations.filter(r => r.clicked).length,
      skipped: recommendations.filter(r => r.wasSkipped).length,
      rejected: rejectionReasons.length,
      positiveRatings: recommendations.filter(r => r.userRating && r.userRating >= 4).length,
      negativeRatings: recommendations.filter(r => r.userRating && r.userRating <= 2).length,
      avgEngagement: engagements.reduce((sum, e) => sum + e.score, 0) / engagements.length,
      topRejectionReasons: topReasons,
    };
  }

  /**
   * Mark all uninteracted recommendations as skipped
   * Called when conversation ends or moves to next phase
   */
  async markUninteractedAsSkipped(conversationId: string): Promise<number> {
    const result = await prisma.recommendation.updateMany({
      where: {
        conversationId,
        clicked: false,
        viewedAt: null,
        askedQuestions: false,
        requestedContact: false,
        interested: false,
        wasSkipped: false,
      },
      data: {
        wasSkipped: true,
      },
    });

    if (result.count > 0) {
      logger.info(
        { conversationId, count: result.count },
        'Marked uninteracted recommendations as skipped'
      );
    }

    return result.count;
  }
}

// Singleton export
export const recommendationFeedback = new RecommendationFeedbackService();
