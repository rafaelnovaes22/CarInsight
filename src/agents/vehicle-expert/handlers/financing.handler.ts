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
    const { lastShownVehicles, extracted, updatedProfile, startTime } = ctx;

    const firstVehicle = lastShownVehicles[0];
    const modelName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;
    const vehiclePrice = firstVehicle.price;

    logger.info({ modelName, vehiclePrice }, 'User wants financing for shown vehicle');

    // Verificar se usuário já informou carro de troca
    const hasTradeIn = updatedProfile.hasTradeIn && updatedProfile.tradeInModel;
    const tradeInInfo = hasTradeIn
        ? (updatedProfile.tradeInYear 
            ? `${updatedProfile.tradeInModel} ${updatedProfile.tradeInYear}` 
            : updatedProfile.tradeInModel)
        : null;

    // Mensagem diferente se já tem troca informada
    const responseMessage = hasTradeIn
        ? `Ótimo! Vamos simular o financiamento do ${modelName}! 🏦

💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}
🚗 *Troca:* ${tradeInInfo} (valor a definir na avaliação)

Pra eu calcular as parcelas, me conta:
• Tem algum valor de **entrada** além da troca? (pode ser zero)

_Exemplo: "5 mil de entrada" ou "só a troca"_`
        : `Ótimo! Vamos simular o financiamento do ${modelName}! 🏦

💰 *Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}

Pra eu calcular as parcelas, me conta:
• Tem algum valor de **entrada**? (pode ser zero)
• Tem algum **carro pra dar na troca**?

_Exemplo: "5 mil de entrada" ou "tenho um Gol 2018 pra trocar"_`;

    return {
        handled: true,
        response: {
            response: responseMessage,
            extractedPreferences: {
                ...extracted.extracted,
                wantsFinancing: true,
                _showedRecommendation: true,
                _lastShownVehicles: lastShownVehicles,
                _awaitingFinancingDetails: true,
            },
            needsMoreInfo: hasTradeIn ? ['financingDownPayment'] : ['financingDownPayment', 'tradeIn'],
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
