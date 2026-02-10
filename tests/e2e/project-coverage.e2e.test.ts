/**
 * Comprehensive E2E Tests for Project Coverage
 *
 * Covers major flows:
 * 1. Specific Search (Specific brand/model)
 * 2. Uber Eligibility (Uber Black/Comfort/X)
 * 3. Trade-In (Troca)
 * 4. Financing (Financiamento)
 * 5. General Recommendation (Body type/Budget)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationState } from '../../src/types/state.types';
import { conversationalHandler } from '../../src/services/conversational-handler.service';

// Mock the LLM router to return deterministic responses for test cases
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async (messages: any[]) => {
    const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const systemMessage = messages.find((m: any) => m.role === 'system')?.content || '';
    const isExtraction =
      userMessage.includes('json') || userMessage.includes('mensagem do cliente');

    const mockResponse = (content: string) => ({
      content,
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      model: 'mock-model',
    });

    // --- 1. Specific Search Mock ---
    if (userMessage.includes('hb20') && userMessage.includes('tem')) {
      // Intent Classification would happen first, assuming getting directly to extraction/search
      if (isExtraction) {
        return mockResponse(
          JSON.stringify({
            extracted: { brand: 'Hyundai', model: 'HB20' },
            confidence: 0.95,
            reasoning: 'Specific model extraction',
            fieldsExtracted: ['brand', 'model'],
          })
        );
      }
      return mockResponse('Temos ótimas opções de Hyundai HB20 para você!');
    }

    if (userMessage.includes('uber black')) {
      if (isExtraction) {
        return mockResponse(
          JSON.stringify({
            extracted: { usage: 'trabalho', tipoUber: 'black' },
            confidence: 0.95,
            reasoning: 'Uber Black extraction',
            fieldsExtracted: ['usage', 'tipoUber'],
          })
        );
      }
      return mockResponse('Para Uber Black, temos sedans e SUVs de luxo.');
    }

    // --- 2. Uber Flow Mock (General) ---
    if (userMessage.includes('sou uber') || userMessage.includes('para uber')) {
      if (isExtraction) {
        return mockResponse(
          JSON.stringify({
            extracted: { usage: 'trabalho', tipoUber: 'uberx' },
            confidence: 0.95,
            reasoning: 'Uber extraction',
            fieldsExtracted: ['usage', 'tipoUber'],
          })
        );
      }
      return mockResponse('Para Uber, temos opções econômicas e aceitas na plataforma.');
    }

    // --- 3. Trade-In Flow Mock ---
    if (userMessage.includes('tenho troca') || userMessage.includes('na troca')) {
      // Assuming user provides details in same message or subsequent
      if (userMessage.includes('onix') && userMessage.includes('2019')) {
        if (isExtraction) {
          return mockResponse(
            JSON.stringify({
              extracted: {
                hasTradeIn: true,
                tradeInBrand: 'Chevrolet',
                tradeInModel: 'Onix',
                tradeInYear: 2019,
              },
              confidence: 0.95,
              reasoning: 'Trade-in extraction',
              fieldsExtracted: ['hasTradeIn', 'tradeInBrand', 'tradeInModel', 'tradeInYear'],
            })
          );
        }
      }
      return mockResponse('Aceitamos seu usado na troca! Qual o modelo e ano?');
    }

    // --- 4. Financing Flow Mock ---
    if (userMessage.includes('financiar') || userMessage.includes('financiamento')) {
      if (userMessage.includes('20 mil')) {
        if (isExtraction) {
          return mockResponse(
            JSON.stringify({
              extracted: { wantsFinancing: true, financingDownPayment: 20000 },
              confidence: 0.95,
              reasoning: 'Financing extraction',
              fieldsExtracted: ['wantsFinancing', 'financingDownPayment'],
            })
          );
        }
      }
      return mockResponse('Podemos simular o financiamento. Quanto você daria de entrada?');
    }

    // --- 5. CRM / Handoff Mock ---
    if (userMessage.includes('falar com vendedor') || userMessage.includes('humano')) {
      // This likely triggers a handoff flag in intent classifier
      return mockResponse(
        JSON.stringify({
          extracted: {}, // No profile extraction
          intent: 'HUMANO',
        })
      );
    }

    // Default Fallback
    return mockResponse(
      JSON.stringify({
        extracted: {},
        confidence: 0.1,
        reasoning: 'No specific match in mock',
        fieldsExtracted: [],
      })
    );
  }),
  resetCircuitBreaker: vi.fn(),
  getLLMProvidersStatus: vi.fn(() => []),
  // Mock traceable to just pass through
  traceable: (fn: any) => fn,
}));

// Mock logger to reduce noise
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock feature flags if needed
vi.mock('../../src/lib/feature-flags', () => ({
  featureFlags: {
    useNewRecAlgorithm: true,
    enableLangSmith: false, // Turn off for tests
  },
}));

// Mock feedback service
vi.mock('../../src/services/feedback.service', () => ({
  feedbackService: {
    submitUserFeedback: vi.fn().mockResolvedValue({}),
    trackConversion: vi.fn().mockResolvedValue({}),
    trackRelevance: vi.fn().mockResolvedValue({}),
  },
}));

import { getCurrentRunTree } from 'langsmith/traceable';

// Mock langsmith/traceable
vi.mock('langsmith/traceable', () => ({
  traceable: (fn: any) => fn,
  getCurrentRunTree: vi.fn().mockReturnValue({
    id: 'mock-run-id',
    metadata: {},
    add_metadata: vi.fn(),
  }),
  RunTree: {
    current: vi.fn(),
  },
}));

describe('Project-Wide E2E Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createInitialState = (
    phoneNumber = '5511999999999',
    skipOnboarding = true // Default to true for these functional tests
  ): ConversationState => ({
    conversationId: `e2e-test-${Date.now()}-${Math.random()}`,
    phoneNumber,
    messages: [],
    quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
    profile: skipOnboarding
      ? {
          customerName: 'Test User',
          _skipOnboarding: true,
          // Add minimal fields to satisfy "ready_to_recommend" if needed,
          // but we just want to test extraction, so minimal is fine.
        }
      : null,
    recommendations: [],
    graph: { currentNode: 'greeting', nodeHistory: [], errorCount: 0, loopCount: 0 },
    metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: [] },
  });

  async function simulateMessage(message: string, state: ConversationState) {
    // Manually add message to state as the real handler would (or rely on handler to do it)
    // conversationalHandler.handleMessage adds it to state internally
    return conversationalHandler.handleMessage(message, state);
  }

  describe('Flow 1: Specific Vehicle Search', () => {
    it('should identify specific model request and skip onboarding', async () => {
      let state = createInitialState();

      // User asks directly for HB20
      const result = await simulateMessage('Olá, tem HB20?', state);

      // Verification
      // The mock returns extraction for "HB20", so the profile should update
      expect(result.updatedState.profile?.brand).toBe('hyundai');
      expect(result.updatedState.profile?.model).toBe('hb20');

      // Should likely skip straight to results or confirmation
      expect(result.response).toBeTruthy();
    });
  });

  describe('Flow 2: Uber Driver Flow', () => {
    it('should correctly configure profile for Uber usage', async () => {
      let state = createInitialState();

      // User identifies as Uber
      const result = await simulateMessage('Oi, sou Uber e procuro carro', state);

      // Verification
      expect(result.updatedState.profile?.usage).toBe('trabalho');
      expect(result.updatedState.profile?.tipoUber).toBe('uberx');

      // Should acknowledge Uber context
      expect(result.response).toBeTruthy();
    });

    it('should handle Uber Black specifically', async () => {
      let state = createInitialState();

      const result = await simulateMessage('Quero carro para Uber Black', state);

      expect(result.updatedState.profile?.tipoUber).toBe('black');
      expect(result.updatedState.profile?.usage).toBe('trabalho');
    });
  });

  describe('Flow 3: Trade-In (Troca)', () => {
    it('should capture trade-in details', async () => {
      let state = createInitialState();

      // User mentions trade-in with details
      const result = await simulateMessage('Quero comprar e tenho um Onix 2019 na troca', state);

      // Verification
      expect(result.updatedState.profile?.hasTradeIn).toBe(true);
      expect(result.updatedState.profile?.tradeInModel).toBe('onix');
      expect(result.updatedState.profile?.tradeInYear).toBe(2019);
    });
  });

  describe('Flow 4: Financing', () => {
    it('should captur financing intent and down payment', async () => {
      let state = createInitialState();

      const result = await simulateMessage('Quero financiar, dou 20 mil de entrada', state);

      expect(result.updatedState.profile?.wantsFinancing).toBe(true);
      expect(result.updatedState.profile?.financingDownPayment).toBe(20000);
    });
  });
});
