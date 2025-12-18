/**
 * E2E Tests for Critical Business Flows
 *
 * Covers:
 * 1. Financing (Simulation & Down Payment)
 * 2. Trade-In (Vehicle Evaluation)
 * 3. Schedule (Test Drive/Visit)
 * 4. Handoff (Salesperson Connection)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationState } from '../../src/types/state.types';

// Mock the LLM router
vi.mock('../../src/lib/llm-router', () => ({
    chatCompletion: vi.fn(async (messages: any[]) => {
        const systemMessage = messages.find((m: any) => m.role === 'system')?.content || '';
        const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

        // Check if this is an extraction call (look for keywords in system prompt)
        const isExtraction = systemMessage.includes('extrair preferências') || systemMessage.includes('JSON');

        if (isExtraction) {
            // --- FINANCING EXTRACTION ---
            if (userMessage.includes('financiar') || userMessage.includes('financiamento')) {
                return JSON.stringify({
                    extracted: { wantsFinancing: true },
                    confidence: 0.95,
                    reasoning: 'Financing intent detected',
                    fieldsExtracted: ['wantsFinancing'],
                });
            }

            if (userMessage.includes('entrada de 10 mil') || userMessage.includes('10000')) {
                return JSON.stringify({
                    extracted: { financingDownPayment: 10000 },
                    confidence: 0.95,
                    reasoning: 'Down payment extracted',
                    fieldsExtracted: ['financingDownPayment'],
                });
            }

            // --- TRADE-IN EXTRACTION ---
            if (userMessage.includes('tenho um carro') || userMessage.includes('troca')) {
                return JSON.stringify({
                    extracted: { hasTradeIn: true },
                    confidence: 0.95,
                    reasoning: 'Trade-in intent detected',
                    fieldsExtracted: ['hasTradeIn'],
                });
            }

            if (userMessage.includes('gol 2015')) {
                return JSON.stringify({
                    extracted: {
                        tradeInModel: 'gol',
                        tradeInYear: 2015,
                        tradeInBrand: 'volkswagen'
                    },
                    confidence: 0.95,
                    reasoning: 'Trade-in details extracted',
                    fieldsExtracted: ['tradeInModel', 'tradeInYear', 'tradeInBrand'],
                });
            }

            // Default Extraction
            return JSON.stringify({
                extracted: {},
                confidence: 0.1,
                reasoning: 'No preferences',
                fieldsExtracted: [],
            });
        } else {
            // --- CONVERSATIONAL GENERATION ---

            // Handoff response
            if (userMessage.includes('falar com vendedor')) {
                return 'Entendi. Vou te conectar com um de nossos vendedores. Clique no link: https://wa.me/5511999999999';
            }

            // Schedule response
            if (userMessage.includes('visita') || userMessage.includes('agendar')) {
                return 'Podemos agendar uma visita sim! Qual horário fica melhor para você?';
            }

            // Financing response
            if (userMessage.includes('financiar')) {
                return 'Claro, podemos simular um financiamento. Qual valor você daria de entrada?';
            }

            if (userMessage.includes('entrada')) {
                return 'Perfeito, com essa entrada conseguimos parcelas a partir de R$ 900,00.';
            }

            // Trade-in response
            if (userMessage.includes('troca') || userMessage.includes('tenho um carro')) {
                return 'Aceitamos seu carro na troca! Qual é o modelo e ano dele?';
            }

            if (userMessage.includes('gol 2015')) {
                return 'Ótimo, o Gol tem boa liquidez. Podemos avaliar seu carro.';
            }

            // Generic fallback
            return 'Posso ajudar com mais alguma coisa sobre os veículos?';
        }
    }),
    resetCircuitBreaker: vi.fn(),
    getLLMProvidersStatus: vi.fn(() => []),
}));

// Mock logger
vi.mock('../../src/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import { conversationalHandler } from '../../src/services/conversational-handler.service';

describe('Business Flows E2E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create initial state
    const createInitialState = (phoneNumber: string = '5511999999999'): ConversationState => ({
        conversationId: `test-${Date.now()}`,
        phoneNumber,
        messages: [],
        quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
        profile: null,
        recommendations: [],
        graph: { currentNode: 'greeting', nodeHistory: [], errorCount: 0, loopCount: 0 },
        metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: [] },
    });

    async function simulateConversation(messages: string[]): Promise<{
        state: ConversationState;
        responses: string[];
    }> {
        let state = createInitialState();
        const responses: string[] = [];

        for (const message of messages) {
            state.messages.push({ role: 'user', content: message, timestamp: new Date() });
            const result = await conversationalHandler.handleMessage(message, state);
            state = result.updatedState;
            responses.push(result.response);
        }
        return { state, responses };
    }

    describe('Financing Flow', () => {
        it('should handle financing request and down payment', async () => {
            const result = await simulateConversation([
                'Oi',
                'Quero financiar',
                'Tenho entrada de 10 mil'
            ]);

            // Expect bot to acknowledge financing and ask for details or simulate
            // Response 2 (after "Quero financiar") should probably ask for down payment or CPF or similar
            // Response 3 should acknowledge the 10k

            expect(result.responses.length).toBe(3);

            // Verify state update (if profile captures formatting)
            // Note: conversationalHandler might not persist profile changes to state *object* returned if it's deep cloned?
            // But let's check result state.
            expect(result.state.profile?.wantsFinancing).toBe(true);
            expect(result.state.profile?.financingDownPayment).toBe(10000);
        });
    });

    describe('Trade-In Flow', () => {
        it('should capture trade-in vehicle details', async () => {
            const result = await simulateConversation([
                'Oi',
                'Tenho um carro na troca',
                'É um Gol 2015'
            ]);

            expect(result.responses.length).toBe(3);
            expect(result.state.profile?.hasTradeIn).toBe(true);
            expect(result.state.profile?.tradeInModel).toBe('gol');
            expect(result.state.profile?.tradeInYear).toBe(2015);
        });
    });

    describe('Handoff Flow', () => {
        it('should generate whatsapp link when requested', async () => {
            const result = await simulateConversation([
                'Oi',
                'Quero falar com vendedor'
            ]);

            const lastResponse = result.responses[result.responses.length - 1];
            expect(lastResponse).toContain('wa.me'); // Expect WhatsApp link
            expect(lastResponse.toLowerCase()).toContain('vendedor');
        });
    });

    // Note: Schedule flow might depend on hardcoded keywords or specific graph transitions 
    // that we need to verify exist. For now, we test if it doesn't crash and gives A response.
    describe('Schedule Flow', () => {
        it('should respond to visit requests', async () => {
            const result = await simulateConversation([
                'Oi',
                'Quero agendar uma visita'
            ]);

            expect(result.responses.length).toBe(2);
            // We expect some confirmation or question about time
            const lastResponse = result.responses[1].toLowerCase();
            const validKeywords = ['visita', 'agendar', 'horário', 'endereço', 'loja'];
            expect(validKeywords.some(k => lastResponse.includes(k))).toBe(true);
        });
    });

});
