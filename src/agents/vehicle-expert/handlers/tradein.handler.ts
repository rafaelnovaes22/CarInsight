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
    const modelName = `${firstVehicle.brand} ${firstVehicle.model}`;

    logger.info({ modelName }, 'User wants to use trade-in for shown vehicle');

    return {
        handled: true,
        response: {
            response: `Show! Ter um carro na troca facilita muito! 🚗🔄\n\nMe conta sobre o seu veículo:\n• Qual é a marca e modelo?\n• Qual o ano?\n• Mais ou menos quantos km rodou?\n\n_Com essas informações consigo dar uma estimativa do valor!_`,
            extractedPreferences: {
                ...extracted.extracted,
                hasTradeIn: true,
                _showedRecommendation: true,
                _lastShownVehicles: lastShownVehicles,
            },
            needsMoreInfo: ['tradeInBrand', 'tradeInModel', 'tradeInYear', 'tradeInKm'],
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
