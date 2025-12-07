/**
 * Financing Handler
 * 
 * Handles the case when user wants to finance a shown vehicle.
 */

import { logger } from '../../../lib/logger';
import { PostRecommendationContext, HandlerResult } from './types';

/**
 * Handle financing intent
 * 
 * When user says something like "quero financiar", "gostei, vou financiar"
 */
export const handleFinancing = (ctx: PostRecommendationContext): HandlerResult => {
    const { lastShownVehicles, extracted, startTime } = ctx;

    const firstVehicle = lastShownVehicles[0];
    const modelName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;
    const vehiclePrice = firstVehicle.price;

    logger.info({ modelName, vehiclePrice }, 'User wants financing for shown vehicle');

    return {
        handled: true,
        response: {
            response: `Ótimo! Vamos simular o financiamento do ${modelName}! 🏦

💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}

Pra eu calcular as parcelas, me conta:
• Tem algum valor de **entrada**? (pode ser zero)
• Tem algum **carro pra dar na troca**?

_Exemplo: "5 mil de entrada" ou "tenho um Gol 2018 pra trocar"_`,
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
                llmUsed: 'rule-based'
            }
        }
    };
};
