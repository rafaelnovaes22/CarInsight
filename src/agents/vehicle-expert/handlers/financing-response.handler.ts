/**
 * Financing Response Handler
 * 
 * Handles the user response when they provide down payment or trade-in info
 * for financing simulation.
 */

import { logger } from '../../../lib/logger';
import { PostRecommendationContext, HandlerResult } from './types';
import { simulateFinancing, formatFinancingSimulation, extractMoneyValue } from '../../../services/financing-simulator.service';

/**
 * Patterns to detect financing response with down payment info
 */
const ENTRY_PATTERNS = {
    // Valor específico: "10 mil", "5000 de entrada", "R$ 15.000"
    withValue: /(\d+(?:[.,]\d+)?)\s*(mil|k|reais|r\$)?(\s*(de\s*)?(entrada)?)?/i,

    // Sem entrada: "sem entrada", "zero", "nada", "0"
    noEntry: /sem\s*entrada|zero|nada de entrada|^0$|não tenho entrada|nao tenho/i,

    // À vista: "à vista", "a vista", "pagar tudo"
    cashPayment: /[àa]\s*vista|pagar\s*tudo|pagamento\s*total|inteiro/i,

    // Tem troca mas sem valor de entrada em dinheiro
    onlyTradeIn: /s[óo]\s*(a\s*)?troca|apenas\s*(a\s*)?troca|dar\s*s[óo]\s*(na\s*)?troca/i,
};

/**
 * Detect if message is a financing response with entry info
 */
export const isFinancingResponse = (message: string, awaitingFinancingDetails: boolean): boolean => {
    if (!awaitingFinancingDetails) return false;

    const normalized = message.toLowerCase().trim();

    // Check all entry patterns
    return (
        ENTRY_PATTERNS.noEntry.test(normalized) ||
        ENTRY_PATTERNS.cashPayment.test(normalized) ||
        ENTRY_PATTERNS.onlyTradeIn.test(normalized) ||
        extractMoneyValue(normalized) !== null
    );
};

/**
 * Handle financing response with down payment info
 */
export const handleFinancingResponse = (ctx: PostRecommendationContext): HandlerResult => {
    const { userMessage, lastShownVehicles, extracted, startTime } = ctx;

    const normalized = userMessage.toLowerCase().trim();
    const firstVehicle = lastShownVehicles[0];

    if (!firstVehicle) {
        return { handled: false };
    }

    const vehiclePrice = firstVehicle.price;
    const vehicleName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;

    // Check for cash payment (à vista)
    if (ENTRY_PATTERNS.cashPayment.test(normalized)) {
        logger.info({ vehicleName, vehiclePrice }, 'User wants to pay cash');

        return {
            handled: true,
            response: {
                response: `Perfeito! Pagamento à vista do ${vehicleName}! 💰✨

*Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}

Excelente escolha! 🎉 

Quer que eu te passe para um vendedor finalizar a compra? Ele pode dar mais detalhes sobre:
• Condições especiais para pagamento à vista
• Documentação necessária
• Agendamento para ver o carro

_Digite "vendedor" para falar com nossa equipe!_`,
                extractedPreferences: {
                    ...extracted.extracted,
                    wantsFinancing: false,
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
                    llmUsed: 'rule-based'
                }
            }
        };
    }

    // Extract down payment value
    let downPayment = 0;

    if (ENTRY_PATTERNS.noEntry.test(normalized) || ENTRY_PATTERNS.onlyTradeIn.test(normalized)) {
        downPayment = 0;
    } else {
        const extractedValue = extractMoneyValue(normalized);
        if (extractedValue !== null) {
            downPayment = extractedValue;
        }
    }

    logger.info({ vehicleName, vehiclePrice, downPayment }, 'Processing financing simulation');

    // Run simulation
    const simulation = simulateFinancing(vehiclePrice, downPayment, 0);
    const simulationMessage = formatFinancingSimulation(simulation, vehicleName);

    // Build response with simulation
    let response = simulationMessage;

    // Add follow-up based on entry percentage
    const entryPercent = (downPayment / vehiclePrice) * 100;

    if (entryPercent >= 30) {
        response += `\n\n🎯 Ótima entrada! Com ${entryPercent.toFixed(0)}% você consegue as melhores taxas.`;
    } else if (entryPercent > 0) {
        response += `\n\n💡 Dica: Aumentando a entrada para 30%, as parcelas ficam ainda menores!`;
    }

    response += `\n\n*Tem interesse?* Posso te passar para um vendedor dar continuidade! 🚗`;
    response += `\n_Digite "vendedor" para falar com nossa equipe._`;

    return {
        handled: true,
        response: {
            response,
            extractedPreferences: {
                ...extracted.extracted,
                wantsFinancing: true,
                financingDownPayment: downPayment,
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
                llmUsed: 'rule-based'
            }
        }
    };
};
