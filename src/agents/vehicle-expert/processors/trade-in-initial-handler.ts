/**
 * Trade-In Initial Handler
 *
 * Handles trade-in detection from initial messages and post-selection.
 */

import { logger } from '../../../lib/logger';
import { CustomerProfile } from '../../../types/state.types';
import { ConversationResponse } from '../../../types/conversation.types';
import { inferBrandFromModel } from '../extractors';
import { capitalize } from '../constants';

export interface TradeInHandlerResult {
  handled: boolean;
  response?: ConversationResponse;
}

interface ExactMatch {
  model?: string | null;
  year?: number | null;
}

interface ExtractedPrefs {
  extracted: Partial<CustomerProfile>;
}

/**
 * Handle trade-in detection in initial message (before any vehicle was shown)
 */
export function handleTradeInInitial(
  exactMatch: ExactMatch,
  isTradeInContext: boolean,
  alreadyHasSelectedVehicle: boolean,
  extracted: ExtractedPrefs,
  startTime: number
): TradeInHandlerResult {
  if (!isTradeInContext || !exactMatch.model || !exactMatch.year || alreadyHasSelectedVehicle) {
    return { handled: false };
  }

  logger.info(
    {
      tradeInModel: exactMatch.model,
      tradeInYear: exactMatch.year,
    },
    'VehicleExpert: Detected trade-in vehicle from initial message'
  );

  return {
    handled: true,
    response: {
      response: `Entendi! Você tem um ${exactMatch.model} ${exactMatch.year} para dar na troca. 🚗🔄\n\nPra te ajudar a encontrar o carro ideal, me conta:\n\n• Qual tipo de carro você está procurando? (SUV, sedan, hatch...)\n• Tem um orçamento em mente?\n\n_Ou me fala um modelo específico se já sabe o que quer!_`,
      extractedPreferences: {
        ...extracted.extracted,
        hasTradeIn: true,
        tradeInBrand: inferBrandFromModel(exactMatch.model),
        tradeInModel: exactMatch.model.toLowerCase(),
        tradeInYear: exactMatch.year,
        model: undefined,
        minYear: undefined,
      },
      needsMoreInfo: ['bodyType', 'budget'],
      canRecommend: false,
      nextMode: 'discovery',
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        llmUsed: 'rule-based',
        tradeInDetected: true,
      } as any,
    },
  };
}

interface ShownVehicle {
  vehicleId: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  bodyType?: string;
}

/**
 * Handle trade-in mentioned after vehicle was already selected
 */
export function handleTradeInAfterSelection(
  exactMatch: ExactMatch,
  isTradeInContext: boolean,
  alreadyHasSelectedVehicle: boolean,
  lastShownVehicles: ShownVehicle[],
  extracted: ExtractedPrefs,
  startTime: number
): TradeInHandlerResult {
  if (!isTradeInContext || !exactMatch.model || !exactMatch.year || !alreadyHasSelectedVehicle) {
    return { handled: false };
  }

  const selectedVehicle = lastShownVehicles[0];
  const selectedVehicleName = `${selectedVehicle.brand} ${selectedVehicle.model} ${selectedVehicle.year}`;
  const tradeInBrand = inferBrandFromModel(exactMatch.model);
  const tradeInText = `${tradeInBrand ? capitalize(tradeInBrand) + ' ' : ''}${capitalize(exactMatch.model)} ${exactMatch.year}`;

  logger.info(
    {
      tradeInModel: exactMatch.model,
      tradeInYear: exactMatch.year,
      selectedVehicle: selectedVehicleName,
    },
    'VehicleExpert: Detected trade-in vehicle AFTER vehicle selection - maintaining context'
  );

  return {
    handled: true,
    response: {
      response: `Perfeito! O ${tradeInText} pode entrar na negociação do ${selectedVehicleName}! 🚗🔄\n\n⚠️ O valor do seu carro na troca depende de uma avaliação presencial pela nossa equipe.\n\nVou conectar você com um consultor para:\n• Avaliar o ${tradeInText}\n• Apresentar a proposta final para o ${selectedVehicleName}\n• Tirar todas as suas dúvidas\n\n_Digite "vendedor" para falar com nossa equipe!_`,
      extractedPreferences: {
        ...extracted.extracted,
        hasTradeIn: true,
        tradeInBrand: tradeInBrand,
        tradeInModel: exactMatch.model.toLowerCase(),
        tradeInYear: exactMatch.year,
        _awaitingTradeInDetails: false,
        _showedRecommendation: true,
        _lastShownVehicles: lastShownVehicles,
      },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: 'negotiation',
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95,
        llmUsed: 'rule-based',
        tradeInDetected: true,
        maintainedContext: true,
      } as any,
    },
  };
}
