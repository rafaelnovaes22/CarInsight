/**
 * Details Handler
 *
 * Handles the case when user wants more details about a shown vehicle.
 */

import { PostRecommendationContext, HandlerResult } from './types';

/**
 * Handle details/more info intent
 *
 * When user says something like "mais detalhes", "quilometragem", "gostei desse"
 */
export const handleDetails = (ctx: PostRecommendationContext): HandlerResult => {
  const { lastShownVehicles, extracted, startTime } = ctx;

  const firstVehicle = lastShownVehicles[0];

  const detailsResponse =
    lastShownVehicles.length === 1
      ? `Claro! Sobre o ${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}:\n\n📋 Para informações detalhadas como quilometragem exata, opcionais, histórico e fotos, sugiro falar com nosso vendedor que pode te passar tudo em tempo real!\n\n_Digite "vendedor" para ser atendido por nossa equipe._`
      : `Qual dos veículos você gostaria de saber mais detalhes?\n\n${lastShownVehicles.map((v, i) => `${i + 1}. ${v.brand} ${v.model} ${v.year}`).join('\n')}\n\n_Ou digite "vendedor" para falar com nossa equipe._`;

  return {
    handled: true,
    response: {
      response: detailsResponse,
      extractedPreferences: {
        ...extracted.extracted,
        _showedRecommendation: true,
      },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: 'recommendation',
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.9,
        llmUsed: 'rule-based',
      },
    },
  };
};
