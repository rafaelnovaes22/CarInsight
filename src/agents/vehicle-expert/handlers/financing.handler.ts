/**
 * Financing Handler
 *
 * Handles the case when user wants to finance a shown vehicle.
 */

import { logger } from '../../../lib/logger';
import { PostRecommendationContext, HandlerResult } from './types';
import { capitalizeWords } from '../constants';

/**
 * Handle financing intent
 *
 * When user says something like "quero financiar", "gostei, vou financiar"
 */
export const handleFinancing = (ctx: PostRecommendationContext): HandlerResult => {
  const { lastShownVehicles, extracted, updatedProfile, startTime } = ctx;

  const firstVehicle = lastShownVehicles[0];
  const modelName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;
  const vehiclePrice = firstVehicle.price;

  logger.info({ modelName, vehiclePrice }, 'User wants financing for shown vehicle');

  // Verificar se usuário já informou carro de troca (capitalizado)
  const hasTradeIn = updatedProfile.hasTradeIn && updatedProfile.tradeInModel;
  const tradeInInfo = hasTradeIn
    ? updatedProfile.tradeInYear
      ? `${capitalizeWords(updatedProfile.tradeInModel)} ${updatedProfile.tradeInYear}`
      : capitalizeWords(updatedProfile.tradeInModel)
    : null;

  // Se tem troca, o carro É a entrada - vai direto pro vendedor
  if (hasTradeIn) {
    return {
      handled: true,
      response: {
        response: `Perfeito! Vou encaminhar você para nosso consultor! 🏦

📋 *Resumo:*
🚗 *Veículo:* ${modelName}
💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}
🔄 *Entrada:* ${tradeInInfo} (troca)
💳 *Pagamento:* Financiamento

Nosso consultor vai avaliar seu ${tradeInInfo} e apresentar a melhor proposta!

_Digite "vendedor" para falar com nossa equipe!_`,
        extractedPreferences: {
          ...extracted.extracted,
          wantsFinancing: true,
          _showedRecommendation: true,
          _lastShownVehicles: lastShownVehicles,
          _awaitingFinancingDetails: false,
        },
        needsMoreInfo: [],
        canRecommend: false,
        nextMode: 'negotiation',
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.95,
          llmUsed: 'rule-based',
        },
      },
    };
  }

  // Se não tem troca, perguntar sobre entrada em dinheiro ou troca
  return {
    handled: true,
    response: {
      response: `Ótimo! Financiamento do ${modelName}! 🏦

💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}

Pra encaminhar pro nosso consultor, me conta:
• Tem algum valor de **entrada**?
• Ou tem algum **carro pra dar na troca**?

_Exemplo: "10 mil de entrada" ou "tenho um Gol 2018 pra trocar"_`,
      extractedPreferences: {
        ...extracted.extracted,
        wantsFinancing: true,
        _showedRecommendation: true,
        _lastShownVehicles: lastShownVehicles,
        _awaitingFinancingDetails: true,
      },
      needsMoreInfo: ['financingDownPayment', 'tradeIn'],
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
