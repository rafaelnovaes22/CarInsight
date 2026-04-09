/**
 * Schedule Handler
 *
 * Handles the case when user wants to schedule a visit or talk to a seller.
 */

import { PostRecommendationContext, HandlerResult } from './types';

/**
 * Handle schedule/seller intent
 *
 * When user says something like "quero agendar", "falar com vendedor"
 */
export const handleSchedule = (ctx: PostRecommendationContext): HandlerResult => {
  const { lastShownVehicles, extracted, startTime } = ctx;

  const scheduleResponse = `Perfeito! 🙌

Já encaminhei seu atendimento para nossa equipe.

📲 Um vendedor vai falar com você em breve por outro número para dar continuidade.
📍 Se quiser agendar uma visita na Renatinhu's Cars, ele também pode combinar isso com você.`;

  return {
    handled: true,
    response: {
      response: scheduleResponse,
      extractedPreferences: {
        ...extracted.extracted,
        _showedRecommendation: false,
        _lastShownVehicles: lastShownVehicles,
      },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: 'recommendation',
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        llmUsed: 'rule-based',
      },
    },
  };
};
