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
    const modelName = `${firstVehicle.brand} ${firstVehicle.model}`;
    const vehiclePrice = firstVehicle.price;

    logger.info({ modelName, vehiclePrice }, 'User wants financing for shown vehicle');

    return {
        handled: true,
        response: {
            response: `Ótimo! Vamos ver o financiamento do ${modelName}! 🏦\n\n💰 O veículo está por R$ ${vehiclePrice.toLocaleString('pt-BR')}.\n\nPara simular as parcelas, me conta:\n1️⃣ Você tem algum valor de entrada?\n2️⃣ Tem algum carro para dar na troca?\n\n_Pode me contar que calculo rápido!_`,
            extractedPreferences: {
                ...extracted.extracted,
                wantsFinancing: true,
                _showedRecommendation: true,
                _lastShownVehicles: lastShownVehicles,
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
