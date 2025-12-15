/**
 * Trade-In Handler
 *
 * Handles the case when user wants to trade in their current vehicle.
 */

import { logger } from '../../../lib/logger';
import { PostRecommendationContext, HandlerResult } from './types';

/**
 * Handle trade-in intent
 *
 * When user says something like "tenho um carro", "quero dar meu carro na troca"
 */
export const handleTradeIn = (ctx: PostRecommendationContext): HandlerResult => {
  const { lastShownVehicles, extracted, startTime } = ctx;

  const firstVehicle = lastShownVehicles[0];
  const modelName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;

  const wantsFinancing = extracted.extracted.wantsFinancing;

  let responseText = `Show! Ter um carro na troca ajuda muito na negociação do ${modelName}! 🚗🔄`;

  if (wantsFinancing) {
    responseText += `\n\nE com o financiamento a gente consegue condições ainda melhores!`;
  }

  responseText += `\n\nMe conta sobre o seu veículo:\n\n• *Qual carro é?* (ex: Fiat Argo 2019, VW Polo 2020)\n• *Km aproximado*\n\n_Exemplo: "Gol 2018 com 80 mil km"_`;

  logger.info({ modelName, wantsFinancing }, 'Trade-in handler processing (with financing check)');

  return {
    handled: true,
    response: {
      response: responseText,
      extractedPreferences: {
        ...extracted.extracted,
        hasTradeIn: true,
        wantsFinancing: wantsFinancing || extracted.extracted.wantsFinancing,
        _showedRecommendation: true,
        _lastShownVehicles: lastShownVehicles,
        _awaitingTradeInDetails: true,
      },
      needsMoreInfo: ['tradeInModel', 'tradeInYear'],
      canRecommend: false,
      nextMode: 'negotiation',
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        llmUsed: 'rule-based',
      },
    },
  };
};
