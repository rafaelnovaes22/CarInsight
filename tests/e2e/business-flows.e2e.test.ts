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


// Mock the LLM router - MUST BE BEFORE IMPORTS of modules that use it
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async (messages: any[]) => {
    const systemMessage = messages.find((m: any) => m.role === 'system')?.content || '';
    const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    console.log('MOCK CALL:', { userMessage, systemMessage: systemMessage.substring(0, 50), msgCount: messages.length });

    // --- FINANCING MOCK ---
    if (userMessage.includes('financiar') || userMessage.includes('financiamento')) {
      if (systemMessage.includes('JSON') || systemMessage.includes('extrair')) {
        return JSON.stringify({
          extracted: { wantsFinancing: true },
          confidence: 0.95,
          reasoning: 'Financing intent detected',
          fieldsExtracted: ['wantsFinancing'],
        });
      }
      return 'Claro, podemos simular um financiamento. Qual valor você daria de entrada?';
    }

    if (userMessage.includes('entrada de 10 mil') || userMessage.includes('10000')) {
      if (systemMessage.includes('JSON') || systemMessage.includes('extrair')) {
        return JSON.stringify({
          extracted: { financingDownPayment: 10000 },
          confidence: 0.95,
          reasoning: 'Down payment extracted',
          fieldsExtracted: ['financingDownPayment'],
        });
      }
      return 'Perfeito, com essa entrada conseguimos parcelas a partir de R$ 900,00.';
    }

    // --- TRADE-IN MOCK ---
    if (userMessage.includes('tenho um carro') || userMessage.includes('troca')) {
      if (systemMessage.includes('JSON') || systemMessage.includes('extrair')) {
        return JSON.stringify({
          extracted: { hasTradeIn: true },
          confidence: 0.95,
          reasoning: 'Trade-in intent detected',
          fieldsExtracted: ['hasTradeIn'],
        });
      }
      return 'Aceitamos seu carro na troca! Qual é o modelo e ano dele?';
    }

    if (userMessage.includes('gol 2015')) {
      if (systemMessage.includes('JSON') || systemMessage.includes('extrair')) {
        return JSON.stringify({
          extracted: {
            tradeInModel: 'gol',
            tradeInYear: 2015,
            tradeInBrand: 'volkswagen',
          },
          confidence: 0.95,
          reasoning: 'Trade-in details extracted',
          fieldsExtracted: ['tradeInModel', 'tradeInYear', 'tradeInBrand'],
        });
      }
      return 'Ótimo, o Gol tem boa liquidez. Podemos avaliar seu carro.';
    }

    // --- EXTRACTION FALLBACK (must come BEFORE conversational checks for non-specific intents) ---
    // If it's an extraction call and no specific intent matched above, return empty extraction
    if (systemMessage.includes('JSON') || systemMessage.includes('extrair')) {
      return JSON.stringify({
        extracted: {},
        confidence: 0.1,
        reasoning: 'No preferences',
        fieldsExtracted: [],
      });
    }

    // --- HANDOFF/SCHEDULE MOCK (conversational only - AFTER extraction check) ---
    if (userMessage.includes('vendedor')) {
      return 'Entendi. Vou te conectar com um de nossos vendedores. Clique no link: https://wa.me/5511999999999';
    }

    if (userMessage.includes('visita') || userMessage.includes('agendar')) {
      return 'Podemos agendar uma visita sim! Qual horário fica melhor para você?';
    }

    // --- GENERIC FALLBACK FOR CONVERSATION ---
    return 'Posso ajudar com mais alguma coisa sobre os veículos?';
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

  // Helper to create initial state - SKIPS ONBOARDING for business flow tests
  const createInitialState = (phoneNumber: string = '5511999999999'): ConversationState => ({
    conversationId: `test-${Date.now()}`,
    phoneNumber,
    messages: [],
    quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
    profile: { customerName: 'Teste', usoPrincipal: 'outro' }, // Skip onboarding
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
        'Tenho entrada de 10 mil',
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
      const result = await simulateConversation(['Oi', 'Tenho um carro na troca', 'É um Gol 2015']);

      expect(result.responses.length).toBe(3);
      expect(result.state.profile?.hasTradeIn).toBe(true);
      expect(result.state.profile?.tradeInModel).toBe('gol');
      expect(result.state.profile?.tradeInYear).toBe(2015);
    });
  });

  describe('Handoff Flow', () => {
    it('should respond when user asks for salesperson', async () => {
      const result = await simulateConversation(['Oi', 'Quero falar com vendedor']);

      // Verify flow completes without crashing and generates responses
      expect(result.responses.length).toBe(2);
      expect(result.responses[1]).toBeTruthy(); // Response is not empty
      expect(result.responses[1].length).toBeGreaterThan(10); // Response has meaningful content
    });
  });

  describe('Schedule Flow', () => {
    it('should respond when user asks to schedule', async () => {
      const result = await simulateConversation(['Oi', 'Quero agendar uma visita']);

      // Verify flow completes without crashing and generates responses
      expect(result.responses.length).toBe(2);
      expect(result.responses[1]).toBeTruthy(); // Response is not empty
      expect(result.responses[1].length).toBeGreaterThan(10); // Response has meaningful content
    });
  });
});
