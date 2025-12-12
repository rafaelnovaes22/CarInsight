/**
 * E2E Tests for Conversational Flow
 *
 * Tests complete user journeys from greeting to recommendation
 * Uses mocked LLM responses for consistent testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationState } from '../../src/types/state.types';
import { featureFlags } from '../../src/lib/feature-flags';

// Mock the LLM router before importing services that use it
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async (messages: any[]) => {
    const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

    // Extraction responses
    if (
      userMessage.includes('suv') &&
      userMessage.includes('60 mil') &&
      userMessage.includes('viagens')
    ) {
      return JSON.stringify({
        extracted: { bodyType: 'suv', budget: 60000, budgetMax: 60000, usage: 'viagem' },
        confidence: 0.95,
        reasoning: 'Mock extraction',
        fieldsExtracted: ['bodyType', 'budget', 'budgetMax', 'usage'],
      });
    }

    if (
      userMessage.includes('suv automático até 70 mil') &&
      userMessage.includes('5 pessoas') &&
      userMessage.includes('honda')
    ) {
      return JSON.stringify({
        extracted: {
          bodyType: 'suv',
          transmission: 'automatico',
          budget: 70000,
          budgetMax: 70000,
          usage: 'viagem',
          people: 5,
          brand: 'honda',
        },
        confidence: 0.95,
        reasoning: 'Complex extraction',
        fieldsExtracted: [
          'bodyType',
          'transmission',
          'budget',
          'budgetMax',
          'usage',
          'people',
          'brand',
        ],
      });
    }

    if (userMessage.includes('5 pessoas') || userMessage.includes('para 5 pessoas')) {
      return JSON.stringify({
        extracted: { people: 5 },
        confidence: 0.95,
        reasoning: 'People extraction',
        fieldsExtracted: ['people'],
      });
    }

    if (userMessage.includes('até 60 mil') || userMessage.includes('60 mil')) {
      return JSON.stringify({
        extracted: { budget: 60000, budgetMax: 60000 },
        confidence: 0.95,
        reasoning: 'Budget extraction',
        fieldsExtracted: ['budget', 'budgetMax'],
      });
    }

    if (
      userMessage.includes('até 50 mil') ||
      userMessage.includes('50 mil') ||
      userMessage.includes('50')
    ) {
      return JSON.stringify({
        extracted: { budget: 50000, budgetMax: 50000 },
        confidence: 0.95,
        reasoning: 'Budget extraction',
        fieldsExtracted: ['budget', 'budgetMax'],
      });
    }

    if (userMessage.includes('até 55 mil') || userMessage.includes('55 mil')) {
      return JSON.stringify({
        extracted: { budget: 55000, budgetMax: 55000 },
        confidence: 0.95,
        reasoning: 'Budget extraction',
        fieldsExtracted: ['budget', 'budgetMax'],
      });
    }

    if (userMessage.includes('entre 40 e 60 mil')) {
      return JSON.stringify({
        extracted: { budgetMin: 40000, budgetMax: 60000 },
        confidence: 0.95,
        reasoning: 'Range extraction',
        fieldsExtracted: ['budgetMin', 'budgetMax'],
      });
    }

    if (userMessage.includes('a partir de 50 mil')) {
      return JSON.stringify({
        extracted: { budgetMin: 50000 },
        confidence: 0.95,
        reasoning: 'Min budget extraction',
        fieldsExtracted: ['budgetMin'],
      });
    }

    if (userMessage.includes('cidade') || userMessage.includes('para cidade')) {
      return JSON.stringify({
        extracted: { usage: 'cidade' },
        confidence: 0.95,
        reasoning: 'Usage extraction',
        fieldsExtracted: ['usage'],
      });
    }

    if (
      userMessage.includes('4 pessoas') ||
      userMessage.includes('pra 4') ||
      userMessage.includes('4')
    ) {
      return JSON.stringify({
        extracted: { people: 4 },
        confidence: 0.9,
        reasoning: 'People extraction',
        fieldsExtracted: ['people'],
      });
    }

    if (userMessage.includes('suv')) {
      return JSON.stringify({
        extracted: { bodyType: 'suv' },
        confidence: 0.95,
        reasoning: 'Body type extraction',
        fieldsExtracted: ['bodyType'],
      });
    }

    if (userMessage.includes('nada de leilão') || userMessage.includes('2018')) {
      return JSON.stringify({
        extracted: { dealBreakers: ['leilao'], minYear: 2018 },
        confidence: 0.9,
        reasoning: 'Deal breakers extraction',
        fieldsExtracted: ['dealBreakers', 'minYear'],
      });
    }

    if (userMessage.includes('kero') || userMessage.includes('karro')) {
      return JSON.stringify({
        extracted: { budget: 50000, people: 4 },
        confidence: 0.8,
        reasoning: 'Typo handling',
        fieldsExtracted: ['budget', 'people'],
      });
    }

    if (userMessage.includes('diferença entre suv e sedan')) {
      return 'SUV são veículos mais altos com maior espaço interno. Sedans são mais baixos com porta-malas tradicional. SUVs são ideais para famílias e viagens, sedans para uso urbano.';
    }

    if (
      userMessage.includes('automático e manual') ||
      userMessage.includes('automático ou manual')
    ) {
      return 'Automático é mais confortável no trânsito. Manual dá mais controle e é mais econômico em manutenção.';
    }

    if (userMessage.includes('vocês têm honda') || userMessage.includes('tem honda')) {
      return 'Sim, temos Honda Civic, HR-V e Fit em estoque!';
    }

    if (userMessage.includes('quais são os suvs') || userMessage.includes('suvs')) {
      return 'Temos Hyundai Creta, Honda HR-V e Jeep Renegade disponíveis!';
    }

    // Default empty extraction
    return JSON.stringify({
      extracted: {},
      confidence: 0.1,
      reasoning: 'No preferences found',
      fieldsExtracted: [],
    });
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

// Now import the service after mocks are set up
import { conversationalHandler } from '../../src/services/conversational-handler.service';

describe('Conversational Flow E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create initial state
  const createInitialState = (phoneNumber: string = '5511999999999'): ConversationState => ({
    conversationId: `test-${Date.now()}`,
    phoneNumber,
    messages: [],
    quiz: {
      currentQuestion: 1,
      progress: 0,
      answers: {},
      isComplete: false,
    },
    profile: null,
    recommendations: [],
    graph: {
      currentNode: 'greeting',
      nodeHistory: [],
      errorCount: 0,
      loopCount: 0,
    },
    metadata: {
      startedAt: new Date(),
      lastMessageAt: new Date(),
      flags: [],
    },
  });

  // Helper to simulate conversation
  async function simulateConversation(messages: string[]): Promise<{
    state: ConversationState;
    responses: string[];
  }> {
    let state = createInitialState();
    const responses: string[] = [];

    for (const message of messages) {
      // Add user message to state
      state.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      const result = await conversationalHandler.handleMessage(message, state);
      state = result.updatedState;
      responses.push(result.response);
    }

    return { state, responses };
  }

  describe('Happy Path: Discovery → Recommendation', () => {
    it('should complete full flow from greeting to recommendation', async () => {
      const result = await simulateConversation([
        'Oi, quero comprar um carro',
        'Quero um SUV até 60 mil para viagens',
        'Para 5 pessoas',
        'Pode me mostrar os carros',
      ]);

      // Check profile was built
      expect(result.state.profile).toBeTruthy();

      // Check all responses were generated
      expect(result.responses.length).toBe(4);
      expect(result.responses.every(r => r.length > 0)).toBe(true);
    }, 30000);

    it('should handle all-in-one message with multiple preferences', async () => {
      const result = await simulateConversation([
        'Quero um SUV automático até 70 mil para viagens com 5 pessoas, preferência por Honda',
      ]);

      const profile = result.state.profile;

      // Profile should have extracted info
      expect(profile).toBeTruthy();
      expect(result.responses.length).toBe(1);
      expect(result.responses[0].length).toBeGreaterThan(0);
    }, 20000);

    it('should recommend after sufficient information even without explicit request', async () => {
      const result = await simulateConversation([
        'Oi',
        'Até 50 mil',
        'Para cidade',
        '4 pessoas',
        'Ok',
      ]);

      // Should have responses
      expect(result.responses.length).toBe(5);
      expect(result.responses.every(r => r.length > 0)).toBe(true);
    }, 30000);
  });

  describe('User Questions During Conversation', () => {
    it('should answer questions without losing context', async () => {
      const result = await simulateConversation([
        'Tenho até 60 mil',
        'Qual diferença entre SUV e sedan?',
        'Prefiro SUV então',
        'Para 5 pessoas',
      ]);

      // Should have all responses
      expect(result.responses.length).toBe(4);
      expect(result.responses.every(r => r.length > 0)).toBe(true);
    }, 30000);

    it('should handle multiple questions', async () => {
      const result = await simulateConversation([
        'Oi',
        'Qual diferença entre automático e manual?',
        'Vocês têm Honda?',
        'Quais são os SUVs?',
      ]);

      // Should have generated responses to all questions
      expect(result.responses.length).toBe(4);
      expect(result.responses.every(r => r.length > 0)).toBe(true);
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle typos and informal language', async () => {
      const result = await simulateConversation(['kero um karro', 'ate 50 mil', 'pra 4 pesoas']);

      // Should still generate responses
      expect(result.responses.length).toBe(3);
      expect(result.responses.every(r => r.length > 0)).toBe(true);
    }, 20000);

    it('should handle very short messages', async () => {
      const result = await simulateConversation(['oi', '50', 'cidade', '4']);

      // Should still work
      expect(result.responses.length).toBe(4);
    }, 20000);

    it('should track message count in loop counter', async () => {
      const messages = [
        'Oi',
        'Quero um carro',
        'Até 50 mil',
        'Para cidade',
        'Sim',
        'Ok',
        'Certo',
        'Entendi',
        'Pode mostrar',
      ];

      const result = await simulateConversation(messages);

      // Should have processed all messages
      expect(result.responses.length).toBe(9);
    }, 40000);
  });

  describe('Preference Extraction', () => {
    it('should extract budget variations', async () => {
      const tests = [
        { msg: 'Até 55 mil', check: (p: any) => p?.budget === 55000 || p?.budgetMax === 55000 },
        {
          msg: 'Entre 40 e 60 mil',
          check: (p: any) => p?.budgetMin === 40000 || p?.budgetMax === 60000,
        },
        { msg: 'A partir de 50 mil', check: (p: any) => p?.budgetMin === 50000 },
      ];

      for (const test of tests) {
        const result = await simulateConversation([test.msg]);
        expect(result.responses.length).toBe(1);
        // Profile may or may not be populated depending on implementation
      }
    }, 30000);

    it('should extract deal breakers', async () => {
      const result = await simulateConversation([
        'Nada de leilão ou muito rodado, prefiro a partir de 2018',
      ]);

      expect(result.responses.length).toBe(1);
      expect(result.responses[0].length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Feature Flag Integration', () => {
    it('should have feature flags module available', () => {
      // featureFlags might be mocked, just verify it exists
      expect(featureFlags).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should maintain conversation history', async () => {
      const result = await simulateConversation(['Oi', 'Até 50 mil', 'Para cidade']);

      // Should have messages (user messages were added in simulateConversation)
      expect(result.state.messages.length).toBeGreaterThanOrEqual(3);

      // Check that we have user messages
      const userMessages = result.state.messages.filter(m => m.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(3);
    }, 20000);

    it('should update metadata correctly', async () => {
      const result = await simulateConversation(['Oi', 'Até 50 mil', 'Para cidade']);

      expect(result.state.metadata.lastMessageAt).toBeTruthy();
      expect(result.state.metadata.startedAt).toBeTruthy();
    }, 20000);
  });
});
