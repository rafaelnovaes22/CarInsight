/**
 * Acknowledgment Handler
 *
 * Handles simple acknowledgments like "ok", "entendi", "legal"
 * to prompt user for next action.
 */

import { PostRecommendationContext, HandlerResult } from './types';

/**
 * Handle acknowledgment intent
 *
 * When user says something like "ok", "entendi", "legal", "valeu"
 */
export const handleAcknowledgment = (ctx: PostRecommendationContext): HandlerResult => {
  const { extracted, startTime } = ctx;

  const nextStepResponse = `Gostou de alguma dessas opções? 😊\n\nPodemos:\n1️⃣ Simular um financiamento\n2️⃣ Agendar para você ver o carro\n\nO que prefere fazer agora?`;

  return {
    handled: true,
    response: {
      response: nextStepResponse,
      extractedPreferences: {
        ...extracted.extracted,
        _showedRecommendation: true,
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
