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

    logger.info({ modelName }, 'User wants to use trade-in for shown vehicle');

    return {
        handled: true,
        response: {
            response: `Show! Ter um carro na troca ajuda muito na negociação do ${modelName}! 🚗🔄

Me conta sobre o seu veículo:

• *Qual carro é?* (ex: Fiat Argo 2019, VW Polo 2020)
• *Km aproximado*

_Exemplo: "Gol 2018 com 80 mil km"_`,
            extractedPreferences: {
                ...extracted.extracted,
                hasTradeIn: true,
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
                llmUsed: 'rule-based'
            }
        }
    };
};
