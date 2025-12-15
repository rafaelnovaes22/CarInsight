
import { logger } from '../lib/logger';
import { CustomerProfile } from '../types/state.types';
import { ConversationContext, ConversationResponse } from '../types/conversation.types';
import {
    simulateFinancing,
    formatFinancingSimulation,
    extractMoneyValue,
} from '../services/financing-simulator.service';
import { extractTradeInInfo } from './vehicle-expert/extractors'; // Reusing existing extractor if suitable, or copy logic

// Import types for internal use
interface FinancingContext {
    userMessage: string;
    profile: Partial<CustomerProfile>;
    lastShownVehicles: any[];
}

export class FinancingAgent {
    /**
     * Process financing intents
     */
    public async processReference(
        userMessage: string,
        context: ConversationContext
    ): Promise<ConversationResponse | null> {
        const { profile } = context;
        const lastShownVehicles = profile._lastShownVehicles || [];

        if (lastShownVehicles.length === 0) {
            return null; // Can't finance nothing
        }

        const firstVehicle = lastShownVehicles[0];
        const vehiclePrice = firstVehicle.price;
        const vehicleName = `${firstVehicle.brand} ${firstVehicle.model} ${firstVehicle.year}`;
        const normalized = userMessage.toLowerCase().trim();

        // 1. Check for cash payment
        if (/[àa]\s*vista|pagar\s*tudo|pagamento\s*total|inteiro/i.test(normalized)) {
            return {
                response: `Perfeito! Pagamento à vista do ${vehicleName}! 💰✨\n\n*Valor:* R$ ${vehiclePrice.toLocaleString('pt-BR')}\n\nExcelente escolha! 🎉\n\nQuer que eu te passe para um vendedor finalizar a compra? Ele pode dar mais detalhes sobre:\n• Condições especiais para pagamento à vista\n• Documentação necessária\n• Agendamento para ver o carro\n\n_Digite "vendedor" para falar com nossa equipe!_`,
                extractedPreferences: {
                    wantsFinancing: false,
                    _awaitingFinancingDetails: false,
                },
                needsMoreInfo: [],
                canRecommend: false,
                nextMode: 'negotiation'
            };
        }

        // 2. Extract Entry / Down Payment
        let downPayment = 0;
        const noEntry = /sem\s*entrada|zero|nada de entrada|^0$|não tenho entrada|nao tenho/i.test(normalized);
        const onlyTradeIn = /s[óo]\s*(a\s*)?troca|apenas\s*(a\s*)?troca|dar\s*s[óo]\s*(na\s*)?troca/i.test(normalized);

        if (noEntry || onlyTradeIn) {
            downPayment = 0;
        } else {
            const extractedValue = extractMoneyValue(normalized);
            if (extractedValue !== null) {
                downPayment = extractedValue;
            }
        }

        // 3. Check for Trade-In mention in the same message
        // Reusing the extractor logic or importing it
        const tradeInInfo = extractTradeInInfo(userMessage);
        const hasTradeIn = onlyTradeIn || tradeInInfo.model || /troca|meu\s*carro|tenho\s*um/i.test(normalized);

        // Update Profile
        const updatedPrefs: any = {
            wantsFinancing: true,
            financingDownPayment: downPayment,
            _awaitingFinancingDetails: false
        };

        if (hasTradeIn) {
            updatedPrefs.hasTradeIn = true;
            if (tradeInInfo.model) updatedPrefs.tradeInModel = tradeInInfo.model;
            if (tradeInInfo.year) updatedPrefs.tradeInYear = tradeInInfo.year;
            if (tradeInInfo.brand) updatedPrefs.tradeInBrand = tradeInInfo.brand;
        }

        // 4. Generate Response
        // Logic similar to handleFinancingResponse
        const tradeInName = tradeInInfo.model
            ? `${tradeInInfo.brand || ''} ${tradeInInfo.model} ${tradeInInfo.year || ''}`.trim()
            : 'seu veículo';

        if (hasTradeIn) {
            // Financing + TradeIn involved
            return {
                response: `Perfeito! Anotei as informações: 💰🚗\n\n• *Entrada em dinheiro:* R$ ${downPayment.toLocaleString('pt-BR')}\n• *Carro na troca:* ${tradeInName}\n\n⚠️ O valor final do ${tradeInName} na troca depende de uma avaliação presencial.\n\nVou conectar você com um consultor para:\n• Avaliar o ${tradeInName}\n• Calcular a proposta final com entrada + troca\n• Finalizar a negociação\n\n_Digite "vendedor" para falar com nossa equipe!_`,
                extractedPreferences: updatedPrefs,
                needsMoreInfo: [],
                canRecommend: false,
                nextMode: 'negotiation'
            };
        }

        // Simulation
        const simulation = simulateFinancing(vehiclePrice, downPayment, 0);
        let simulationMessage = formatFinancingSimulation(simulation, vehicleName);

        const entryPercent = (downPayment / vehiclePrice) * 100;
        if (entryPercent >= 30) {
            simulationMessage += `\n\n🎯 Ótima entrada! Com ${entryPercent.toFixed(0)}% você consegue as melhores taxas.`;
        } else if (entryPercent > 0) {
            simulationMessage += `\n\n💡 Dica: Aumentando a entrada para 30%, as parcelas ficam ainda menores!`;
        }

        simulationMessage += `\n\n*Tem interesse?* Posso te passar para um vendedor dar continuidade! 🚗\n_Digite "vendedor" para falar com nossa equipe._`;

        return {
            response: simulationMessage,
            extractedPreferences: updatedPrefs,
            needsMoreInfo: [],
            canRecommend: false,
            nextMode: 'negotiation'
        };
    }
}

export const financingAgent = new FinancingAgent();
