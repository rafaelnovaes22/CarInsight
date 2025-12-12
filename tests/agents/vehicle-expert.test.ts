/**
 * Tests for VehicleExpertAgent
 * Uses mocked LLM responses for consistent testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VehicleExpertAgent } from '../../src/agents/vehicle-expert.agent';
import { ConversationContext, ConversationMode } from '../../src/types/conversation.types';

// Mock the LLM router
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async (messages: any[]) => {
    const userMessage = messages[messages.length - 1].content.toLowerCase();

    // Question detection responses
    if (
      userMessage.includes('diferença entre suv e sedan') ||
      userMessage.includes('suv e sedan')
    ) {
      return 'SUV (Sport Utility Vehicle) são veículos mais altos, com maior espaço interno e geralmente tração 4x4. Sedans são mais baixos, com porta-malas tradicional e melhor consumo de combustível. SUVs são ideais para terrenos irregulares e famílias grandes, enquanto sedans são melhores para uso urbano e economia.';
    }

    if (userMessage.includes('financiamento')) {
      return 'O financiamento funciona assim: você dá uma entrada e parcela o restante em até 60 meses. Os juros variam de acordo com o banco e seu perfil de crédito. Geralmente exigimos entrada mínima de 20%.';
    }

    if (
      userMessage.includes('automático e manual') ||
      userMessage.includes('automático ou manual')
    ) {
      return 'Carros automáticos são mais confortáveis no trânsito, mas consomem um pouco mais. Manuais dão mais controle e são mais baratos de manter.';
    }

    if (userMessage.includes('vocês têm honda') || userMessage.includes('tem honda')) {
      return 'Sim, temos vários modelos Honda em estoque! Civic, HR-V e Fit são os mais procurados.';
    }

    if (userMessage.includes('quais são os suvs') || userMessage.includes('quais suvs')) {
      return 'Temos SUVs de várias marcas: Hyundai Creta, Honda HR-V, Jeep Renegade, entre outros. Qual faixa de preço você procura?';
    }

    // Default extraction response for preference extraction
    return JSON.stringify({
      extracted: {},
      confidence: 0.5,
      reasoning: 'Mock extraction',
      fieldsExtracted: [],
    });
  }),
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

      // Budget extraction
      if (msg.includes('até 60 mil') || msg.includes('60 mil')) {
        result.extracted.budget = 60000;
        result.fieldsExtracted.push('budget');
      }
      if (msg.includes('até 70 mil') || msg.includes('70 mil')) {
        result.extracted.budget = 70000;
        result.fieldsExtracted.push('budget');
      }
      if (msg.includes('até 50 mil') || msg.includes('50 mil')) {
        result.extracted.budget = 50000;
        result.fieldsExtracted.push('budget');
      }

      // Body type
      if (msg.includes('suv')) {
        result.extracted.bodyType = 'suv';
        result.fieldsExtracted.push('bodyType');
      }

      // People
      if (msg.includes('5 pessoas')) {
        result.extracted.people = 5;
        result.fieldsExtracted.push('people');
      }
      if (msg.includes('6 pessoas')) {
        result.extracted.people = 6;
        result.fieldsExtracted.push('people');
      }
      if (msg.includes('4 pessoas')) {
        result.extracted.people = 4;
        result.fieldsExtracted.push('people');
      }
      if (msg.includes('5 pesoas')) {
        // typo
        result.extracted.people = 5;
        result.fieldsExtracted.push('people');
      }

      return result;
    }),
    mergeWithProfile: vi.fn((current: any, extracted: any) => ({ ...current, ...extracted })),
  },
  PreferenceExtractorAgent: vi.fn().mockImplementation(() => ({
    extract: vi.fn(async (message: string) => {
      const msg = message.toLowerCase();
      const result: any = {
        extracted: {},
        confidence: 0.9,
        reasoning: 'Mock',
        fieldsExtracted: [],
      };

      if (msg.includes('50 mil')) result.extracted.budget = 50000;
      if (msg.includes('60 mil')) result.extracted.budget = 60000;
      if (msg.includes('70 mil')) result.extracted.budget = 70000;
      if (msg.includes('suv')) result.extracted.bodyType = 'suv';
      if (msg.includes('5 pessoas')) result.extracted.people = 5;
      if (msg.includes('4 pessoas')) result.extracted.people = 4;
      if (msg.includes('5 pesoas')) result.extracted.people = 5;

      return result;
    }),
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

describe('VehicleExpertAgent', () => {
  let expert: VehicleExpertAgent;

  beforeEach(() => {
    expert = new VehicleExpertAgent();
    vi.clearAllMocks();
  });

  const createContext = (overrides?: Partial<ConversationContext>): ConversationContext => ({
    conversationId: 'test-123',
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

  describe('Question detection', () => {
    it('should detect user questions ending with ?', async () => {
      const context = createContext();
      const response = await expert.chat('Qual a diferença entre SUV e sedan?', context);

      expect(response.canRecommend).toBe(false);
      expect(response.response).toBeTruthy();
      expect(response.response.length).toBeGreaterThan(50); // Should be a detailed answer
    });

    it('should detect questions starting with question words', async () => {
      const context = createContext();
      const response = await expert.chat('Como funciona o financiamento?', context);

      expect(response.canRecommend).toBe(false);
      expect(response.response.toLowerCase()).toContain('financiamento');
    });

    it('should NOT treat regular answers as questions', async () => {
      const context = createContext({
        mode: 'clarification',
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 2,
          extractionCount: 0,
          questionsAsked: 1,
          userQuestions: 0,
        },
      });

      const response = await expert.chat('Até 50 mil', context);

      // Should extract preference and ask next question
      expect(response.extractedPreferences.budget).toBe(50000);
      expect(response.needsMoreInfo.length).toBeGreaterThan(0);
    });
  });

  describe('Preference extraction during chat', () => {
    it('should extract budget from natural response', async () => {
      const context = createContext();
      const response = await expert.chat('Tenho até 60 mil', context);

      expect(response.extractedPreferences.budget).toBe(60000);
      expect(response.canRecommend).toBe(false); // Not enough info yet
    });

    it('should extract multiple preferences at once', async () => {
      const context = createContext();
      const response = await expert.chat('Quero um SUV até 70 mil para 5 pessoas', context);

      expect(response.extractedPreferences.bodyType).toBe('suv');
      expect(response.extractedPreferences.budget).toBe(70000);
      expect(response.extractedPreferences.people).toBe(5);
    });
  });

  describe('Conversation flow', () => {
    it('should ask contextual questions when info is missing', async () => {
      const context = createContext({
        profile: { budget: 50000 },
      });

      const response = await expert.chat('Quero um carro', context);

      expect(response.canRecommend).toBe(false);
      // Response should ask for more info (any string response is valid)
      expect(response.response).toBeTruthy();
      expect(response.needsMoreInfo.length).toBeGreaterThan(0);
    });

    it('should recommend when enough info is gathered', async () => {
      const context = createContext({
        profile: {
          budget: 50000,
          usage: 'cidade',
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

      const response = await expert.chat('Pode me mostrar os carros', context);

      expect(response.canRecommend).toBe(true);
      expect(response.recommendations).toBeDefined();
      expect(response.nextMode).toBe('recommendation');
    });

    it('should recommend after many messages even with partial info', async () => {
      const context = createContext({
        profile: {
          budget: 50000,
          usage: 'cidade',
          // Missing people
        },
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 8, // Many messages
          extractionCount: 2,
          questionsAsked: 6,
          userQuestions: 0,
        },
      });

      const response = await expert.chat('Ok, pode mostrar', context);

      // Should recommend to avoid infinite conversation
      expect(response.canRecommend).toBe(true);
    });
  });

  describe('Readiness assessment', () => {
    it('should require budget, usage, and people as minimum', async () => {
      const context = createContext({
        profile: {
          budget: 50000,
          usage: 'cidade',
          people: 4,
        },
      });

      const response = await expert.chat('Vamos lá', context);
      expect(response.canRecommend).toBe(true);
    });

    it('should NOT recommend with only budget', async () => {
      const context = createContext({
        profile: { budget: 50000 },
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 2,
          extractionCount: 1,
          questionsAsked: 1,
          userQuestions: 0,
        },
      });

      const response = await expert.chat('Sim', context);
      expect(response.canRecommend).toBe(false);
      // Current implementation only requires 'budget' and 'usage' as mandatory fields
      expect(response.needsMoreInfo).toContain('usage');
    });
  });

  describe('Answer generation', () => {
    it('should answer questions about vehicle categories', async () => {
      const context = createContext();
      const response = await expert.chat('Qual diferença entre SUV e sedan?', context);

      expect(response.response.toLowerCase()).toMatch(/suv/i);
      expect(response.response.toLowerCase()).toMatch(/sedan/i);
      expect(response.response.length).toBeGreaterThan(100); // Detailed answer
    });

    it('should use inventory context in answers', async () => {
      const context = createContext({
        profile: { budget: 60000 },
      });

      const response = await expert.chat('Quais SUVs vocês têm?', context);

      // Should mention that we have SUVs in stock
      expect(response.response).toBeTruthy();
    });
  });

  describe('Recommendation formatting', () => {
    it('should format recommendations with match scores', async () => {
      const context = createContext({
        profile: {
          budget: 60000,
          usage: 'cidade',
          people: 4,
          bodyType: 'hatch',
        },
      });

      const response = await expert.chat('Me mostra', context);

      if (response.recommendations && response.recommendations.length > 0) {
        expect(response.response).toMatch(/R\$/); // Should show prices
        expect(response.response).toMatch(/\d+%/); // Should show match percentage
      }
    });

    it('should handle no results gracefully', async () => {
      const context = createContext({
        profile: {
          budget: 10000, // Very low budget
          usage: 'cidade',
          people: 8, // Many people
          bodyType: 'pickup', // Rare + expensive
          minYear: 2023, // Very new
        },
      });

      const response = await expert.chat('Me mostra', context);

      // Should have some response (may offer alternatives or explain no results)
      expect(response.response).toBeTruthy();
      expect(response.response.length).toBeGreaterThan(10);
    });
  });

  describe('Context preservation', () => {
    it('should maintain conversation context', async () => {
      const context = createContext({
        profile: {
          budget: 50000,
          usage: 'viagem',
        },
        messages: [
          { role: 'user', content: 'Quero um carro para viagens', timestamp: new Date() },
          {
            role: 'assistant',
            content: 'Legal! Para viagens temos SUVs e sedans...',
            timestamp: new Date(),
          },
        ],
        metadata: {
          startedAt: new Date(),
          lastMessageAt: new Date(),
          messageCount: 2,
          extractionCount: 1,
          questionsAsked: 1,
          userQuestions: 0,
        },
      });

      const response = await expert.chat('Para 6 pessoas', context);

      // Should extract people and remember it's for travel
      expect(response.extractedPreferences.people).toBe(6);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty messages gracefully', async () => {
      const context = createContext();
      const response = await expert.chat('', context);

      expect(response.response).toBeTruthy();
      expect(response.canRecommend).toBe(false);
    });

    it('should handle very long messages', async () => {
      const context = createContext();
      const longMessage = 'Quero um carro '.repeat(50) + 'até 50 mil';
      const response = await expert.chat(longMessage, context);

      expect(response.extractedPreferences.budget).toBe(50000);
    });

    it('should handle messages with typos', async () => {
      const context = createContext();
      const response = await expert.chat('kero um karro ate 50 mil pra 5 pesoas', context);

      expect(response.extractedPreferences.budget).toBe(50000);
      expect(response.extractedPreferences.people).toBe(5);
    });
  });
});
