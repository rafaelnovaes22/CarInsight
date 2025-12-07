/**
 * Schedule Handler
 * 
 * Handles the case when user wants to schedule a visit or talk to a seller.
 */

import { PostRecommendationContext, HandlerResult } from './types';

/**
 * Handle schedule/seller intent
 * 
 * When user says something like "quero agendar", "falar com vendedor"
 */
export const handleSchedule = (ctx: PostRecommendationContext): HandlerResult => {
    const { lastShownVehicles, extracted, startTime } = ctx;

    const scheduleResponse = `Perfeito! 🙌\n\nPara agendar uma visita ou falar diretamente com nosso vendedor, me envia seu nome completo que já passo para a equipe te atender!\n\n📍 Estamos na Robust Car\n📞 Ou se preferir, digite "vendedor" para iniciar o atendimento.`;

    return {
        handled: true,
        response: {
            response: scheduleResponse,
            extractedPreferences: {
                ...extracted.extracted,
                _showedRecommendation: false,
                _lastShownVehicles: lastShownVehicles,
            },
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'recommendation',
            metadata: {
                processingTime: Date.now() - startTime,
                confidence: 0.95,
                llmUsed: 'rule-based'
            }
        }
    };
};
