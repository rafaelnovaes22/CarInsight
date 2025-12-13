/**
 * Uber Handler
 *
 * Handles Uber Black/X category questions and searches.
 */

import { logger } from '../../../lib/logger';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';
import { ConversationContext, ConversationResponse } from '../../../types/conversation.types';

export interface UberHandlerResult {
  handled: boolean;
  response?: ConversationResponse;
}

/**
 * Handle Uber Black specific questions
 */
export async function handleUberBlackQuestion(
  userMessage: string,
  context: ConversationContext,
  updatedProfile: Partial<CustomerProfile>,
  extracted: { extracted: Partial<CustomerProfile> },
  startTime: number,
  getAppCategoryName: (
    profile: Partial<CustomerProfile>,
    category: 'x' | 'black' | 'comfort'
  ) => string
): Promise<UberHandlerResult> {
  const lowerMessage = userMessage.toLowerCase();

  if (!lowerMessage.includes('uber black') && !lowerMessage.includes('uberblack')) {
    return { handled: false };
  }

  logger.info('UberHandler: Processing Uber Black question');

  // Search for Uber Black eligible vehicles
  const uberBlackVehicles = await vehicleSearchAdapter.search('', {
    aptoUberBlack: true,
    limit: 10,
  });

  let response = `🚖 *Critérios para Uber Black:*\n\n`;
  response += `• Ano: 2018 ou mais recente\n`;
  response += `• Tipo: APENAS Sedan PREMIUM\n`;
  response += `• Portas: 4\n`;
  response += `• Ar-condicionado: Obrigatório\n`;
  response += `• Interior: Couro (preferencial)\n`;
  response += `• Cor: Preto (preferencial)\n\n`;

  if (uberBlackVehicles.length > 0) {
    response += `✅ *Temos ${uberBlackVehicles.length} veículos aptos para Uber Black:*\n\n`;
    uberBlackVehicles.slice(0, 5).forEach((rec, i) => {
      const v = rec.vehicle;
      response += `${i + 1}. ${v.brand} ${v.model} ${v.year}\n`;
      response += `   💰 R$ ${v.price.toLocaleString('pt-BR')}\n`;
      response += `   📍 ${v.mileage.toLocaleString('pt-BR')}km\n\n`;
    });
    response += `_Quer saber mais sobre algum?_`;
  } else {
    const altCategory = getAppCategoryName(updatedProfile, 'x');
    response += `❌ No momento não temos veículos aptos para Uber Black no estoque.\n\n`;
    response += `Mas temos veículos aptos para ${altCategory}. Quer ver?`;
  }

  return {
    handled: true,
    response: {
      response,
      extractedPreferences: {
        ...extracted.extracted,
        _waitingForUberXAlternatives: true,
      },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: context.mode,
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 1.0,
        llmUsed: 'rule-based',
      },
    },
  };
}
