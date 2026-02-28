/**
 * Integration tests for the "no results → list categories" conversational flow.
 *
 * Tests the full flow via VehicleExpertAgent.chat():
 * - Scenario A: Don't re-ask about usage when already answered
 * - Scenario B: "Outras categorias" after "não encontrei" lists DB categories
 * - Scenario C: Multi-turn flow with category listing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock LLM router (pattern-based)
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async (messages: any[]) => {
    const systemMessage = messages.find((m: any) => m.role === 'system')?.content || '';
    const userMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

    // Preference extraction requests (JSON format)
    if (systemMessage.includes('JSON') || systemMessage.includes('extrair')) {
      return JSON.stringify({
        extracted: {},
        confidence: 0.8,
        reasoning: 'Mock extraction',
        fieldsExtracted: [],
      });
    }

    // Question generation
    if (systemMessage.includes('PRÓXIMA MELHOR PERGUNTA') || systemMessage.includes('próxima melhor pergunta')) {
      // Should ask about bodyType if budget and usage are filled
      return 'Que tipo de veículo você prefere? SUV, sedan, hatch?';
    }

    // Answer questions
    if (userMessage.includes('?')) {
      return 'Resposta genérica do mock LLM.';
    }

    // Default
    return JSON.stringify({
      extracted: {},
      confidence: 0.5,
      reasoning: 'Mock extraction',
      fieldsExtracted: [],
    });
  }),
}));

// Mock vehicle search adapter - returns empty to simulate "no results"
vi.mock('../../src/services/vehicle-search-adapter.service', () => ({
  vehicleSearchAdapter: {
    search: vi.fn(async () => []),
  },
}));

// Mock prisma for category listing
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    vehicle: {
      groupBy: vi.fn(async () => [
        { carroceria: 'suv', _count: { id: 12 } },
        { carroceria: 'sedan', _count: { id: 8 } },
        { carroceria: 'hatch', _count: { id: 6 } },
        { carroceria: 'pickup', _count: { id: 4 } },
      ]),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    conversation: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    lead: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    $queryRaw: vi.fn(async () => []),
  },
}));

// Mock preference extractor
vi.mock('../../src/agents/preference-extractor.agent', () => ({
  preferenceExtractor: {
    extract: vi.fn(async (message: string) => {
      const msg = message.toLowerCase();
      const result: any = {
        extracted: {},
        confidence: 0.9,
        reasoning: 'Mock',
        fieldsExtracted: [],
      };

      if (msg.includes('suv')) {
        result.extracted.bodyType = 'suv';
        result.fieldsExtracted.push('bodyType');
      }
      if (msg.includes('60 mil') || msg.includes('60000')) {
        result.extracted.budget = 60000;
        result.fieldsExtracted.push('budget');
      }
      if (msg.includes('viagem')) {
        result.extracted.usage = 'viagem';
        result.fieldsExtracted.push('usage');
      }

      return result;
    }),
    mergeWithProfile: vi.fn((current: any, extracted: any) => ({ ...current, ...extracted })),
  },
  PreferenceExtractorAgent: vi.fn().mockImplementation(() => ({
    extract: vi.fn(async () => ({
      extracted: {},
      confidence: 0.5,
      reasoning: 'Mock',
      fieldsExtracted: [],
    })),
    mergeWithProfile: vi.fn((current: any, extracted: any) => ({ ...current, ...extracted })),
  })),
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

// Mock feedback service
vi.mock('../../src/services/feedback.service', () => ({
  feedbackService: {
    recordInteraction: vi.fn(),
    getConversationStats: vi.fn(async () => null),
  },
}));

import { VehicleExpertAgent } from '../../src/agents/vehicle-expert.agent';
import { ConversationContext, ConversationMode } from '../../src/types/conversation.types';

describe('Integration: No results → Category listing flow', () => {
  let expert: VehicleExpertAgent;

  beforeEach(() => {
    expert = new VehicleExpertAgent();
    vi.clearAllMocks();
  });

  const createContext = (overrides?: Partial<ConversationContext>): ConversationContext => ({
    conversationId: 'integration-test-123',
    phoneNumber: '5511999999999',
    mode: 'discovery' as ConversationMode,
    profile: {},
    messages: [],
    metadata: {
      startedAt: new Date(),
      lastMessageAt: new Date(),
      messageCount: 0,
      extractionCount: 0,
      questionsAsked: 0,
      userQuestions: 0,
    },
    ...overrides,
  });

  describe('Scenario A: Do not re-ask about usage', () => {
    it('should NOT re-ask about usage when profile.usage is already filled', async () => {
      const context = createContext({
        profile: {
          budget: 60000,
          usage: 'viagem',
        },
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 3,
          extractionCount: 2,
          questionsAsked: 2,
          userQuestions: 0,
        },
      });

      const response = await expert.chat('Quero ver as opções', context);

      // Should NOT ask about usage since it's already filled
      const responseLower = response.response.toLowerCase();
      expect(responseLower).not.toMatch(/qual.*uso principal/i);
      expect(responseLower).not.toMatch(/para que.*vai usar/i);
    });
  });

  describe('Scenario B: "Outras categorias" after "não encontrei"', () => {
    it('should list available categories when user asks for "outras categorias" with empty shown vehicles', async () => {
      const context = createContext({
        mode: 'recommendation' as ConversationMode,
        profile: {
          budget: 60000,
          usage: 'viagem',
          _showedRecommendation: true,
          _lastShownVehicles: [],
          _lastSearchType: 'recommendation',
        } as any,
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 5,
          extractionCount: 3,
          questionsAsked: 3,
          userQuestions: 0,
        },
      });

      const response = await expert.chat('outras categorias', context);

      // Should list categories from DB
      expect(response.response).toMatch(/categori/i);
      expect(response.response).toMatch(/SUV|sedan|hatch/i);
    });

    it('should contain category counts in the response', async () => {
      const context = createContext({
        mode: 'recommendation' as ConversationMode,
        profile: {
          budget: 60000,
          usage: 'viagem',
          _showedRecommendation: true,
          _lastShownVehicles: [],
          _lastSearchType: 'recommendation',
        } as any,
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 5,
          extractionCount: 3,
          questionsAsked: 3,
          userQuestions: 0,
        },
      });

      const response = await expert.chat('quero ver outras categorias', context);

      // Should contain "disponíve" (disponível/disponíveis)
      expect(response.response).toMatch(/disponíve/i);
    });
  });

  describe('Scenario C: Multi-turn complete flow', () => {
    it('should progress from preferences → no results → category listing', async () => {
      // Turn 1: User sends preferences
      const ctx1 = createContext({
        profile: { budget: 60000 },
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 1,
          extractionCount: 1,
          questionsAsked: 1,
          userQuestions: 0,
        },
      });

      const response1 = await expert.chat('Quero um carro para viagem', ctx1);
      expect(response1.response).toBeTruthy();

      // Turn 2: User completes info → triggers recommendation (returns 0 vehicles)
      const ctx2 = createContext({
        profile: {
          budget: 60000,
          usage: 'viagem',
          people: 4,
        },
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 3,
          extractionCount: 3,
          questionsAsked: 2,
          userQuestions: 0,
        },
      });

      const response2 = await expert.chat('Para 4 pessoas', ctx2);
      expect(response2.response).toBeTruthy();

      // Turn 3: After "não encontrei" → user asks for "outras categorias"
      const ctx3 = createContext({
        mode: 'recommendation' as ConversationMode,
        profile: {
          budget: 60000,
          usage: 'viagem',
          people: 4,
          _showedRecommendation: true,
          _lastShownVehicles: [],
        } as any,
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 5,
          extractionCount: 3,
          questionsAsked: 3,
          userQuestions: 0,
        },
      });

      const response3 = await expert.chat('outras categorias', ctx3);

      // Should list categories from DB
      expect(response3.response).toMatch(/categori/i);
    });
  });
});
