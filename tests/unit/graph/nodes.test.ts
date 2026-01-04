import { describe, it, expect, vi, beforeEach } from 'vitest';
import { greetingNode } from '../../../src/graph/nodes/greeting.node';
import { discoveryNode } from '../../../src/graph/nodes/discovery.node';
import { searchNode } from '../../../src/graph/nodes/search.node';
import { recommendationNode } from '../../../src/graph/nodes/recommendation.node';
import { createInitialState } from '../../../src/types/graph.types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Mocks
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Vehicle Expert
const mockChat = vi.fn();
vi.mock('../../../src/agents/vehicle-expert.agent', () => ({
  vehicleExpert: {
    chat: (...args: any[]) => mockChat(...args),
  },
}));

// Mock Vector Search
const { mockSearchVehicles } = vi.hoisted(() => {
  return { mockSearchVehicles: vi.fn() };
});

vi.mock('../../../src/services/vector-search.service', () => {
  return {
    VectorSearchService: class {
      searchVehicles = mockSearchVehicles;
    },
  };
});

// Mock Exact Search Parser
vi.mock('../../../src/services/exact-search-parser.service', () => ({
  exactSearchParser: {
    parse: vi.fn().mockImplementation(async (msg: string) => {
      if (msg.toLowerCase().includes('civic')) {
        const yearMatch = msg.match(/20\d\d/);
        return {
          model: 'Civic',
          year: yearMatch ? parseInt(yearMatch[0]) : null,
          rawQuery: msg,
        };
      }
      return { model: null, rawQuery: msg };
    }),
    isTradeInContext: vi.fn().mockImplementation((msg: string) => {
      const lower = msg.toLowerCase();
      return lower.includes('troca') || lower.includes('meu');
    }),
  },
}));

describe('LangGraph Nodes Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // greetingNode Tests
  // ============================================
  describe('greetingNode', () => {
    it('should welcome user on first message and ask for name (stay in greeting)', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Oi')];

      const result = await greetingNode(state);

      expect(result.next).toBe('greeting');
      expect(result.messages?.[0].content).toContain('nome');
    });

    it('should extract name when provided', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Oi, sou o Rafael')];

      const result = await greetingNode(state);

      expect(result.profile?.customerName).toBe('Rafael');
      expect(result.next).toBe('discovery');
      expect(result.messages?.[0].content).toContain('Rafael');
    });

    it('should detect trade-in intent from greeting', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Oi, sou Rafael e quero trocar meu Civic 2018')];

      const result = await greetingNode(state);

      expect(result.profile?.hasTradeIn).toBe(true);
      expect(result.profile?.tradeInModel).toBe('civic');
      expect(result.profile?.tradeInYear).toBe(2018);
      expect(result.next).toBe('discovery');
      // Should respond with acknowledgement about trade-in
      expect(result.messages?.[0].content).toContain('troca');
    });

    it('should immediate search if name and DESIRED vehicle provided', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Oi, sou Rafael e quero um Civic 2020')];

      // Mock vehicle expert returning results
      mockChat.mockResolvedValue({
        canRecommend: true,
        recommendations: [{ vehicleId: 'v1' }],
        response: 'Here is your civic',
      });

      const result = await greetingNode(state);

      expect(result.profile?.model).toBe('Civic');
      expect(result.profile?.minYear).toBe(2020);
      expect(result.next).toBe('recommendation'); // Jump straight to recommendation
      expect(mockChat).toHaveBeenCalled();
    });
  });

  // ============================================
  // discoveryNode Tests
  // ============================================
  describe('discoveryNode', () => {
    it('should call vehicle expert and update profile', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Quero um SUV para família')];

      mockChat.mockResolvedValue({
        extractedPreferences: { bodyType: 'SUV', usage: 'family' },
        response: 'Entendi, qual faixa de preço?',
        canRecommend: false,
      });

      const result = await discoveryNode(state);

      expect(mockChat).toHaveBeenCalled();
      expect(result.profile?.bodyType).toBe('SUV');
      expect(result.next).toBe('discovery'); // Still in discovery
    });

    it('should move to recommendation if expert returns recommendations', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Quero um Civic 2020')];

      mockChat.mockResolvedValue({
        extractedPreferences: { model: 'Civic' },
        response: 'Encontrei este Civic:',
        canRecommend: true,
        recommendations: [{ vehicleId: 'v1' }],
      });

      const result = await discoveryNode(state);

      expect(result.next).toBe('recommendation');
    });
  });

  // ============================================
  // searchNode Tests
  // ============================================
  describe('searchNode', () => {
    it('should return error if no profile', async () => {
      const state = createInitialState();
      // Force profile to undefined to test the guard clause
      (state as any).profile = null;

      const result = await searchNode(state);
      expect(result.messages?.[0].content).toContain('Ops');
    });

    it('should search vehicles and return recommendations', async () => {
      const state = createInitialState();
      state.profile = { budget: 100000, vehicleType: 'SUV' };

      mockSearchVehicles.mockResolvedValue([
        {
          id: 'v1',
          matchScore: 90,
          matchReasons: ['Good price'],
          brand: 'Jeep',
          model: 'Renegade',
        },
      ]);

      const result = await searchNode(state);

      expect(mockSearchVehicles).toHaveBeenCalled();
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations?.[0].vehicleId).toBe('v1');
      expect(result.next).toBe('recommendation');
    });

    it('should handle no results', async () => {
      const state = createInitialState();
      state.profile = { budget: 10000 };
      mockSearchVehicles.mockResolvedValue([]);

      const result = await searchNode(state);

      expect(result.recommendations).toHaveLength(0);
      expect(result.messages?.[0].content).toContain('não encontrei');
      expect(result.next).toBe('recommendation'); // Or loop back, but current logic says recommendation w/ empty message
    });
  });

  // ============================================
  // recommendationNode Tests
  // ============================================
  describe('recommendationNode', () => {
    it('should format recommendations if present', async () => {
      const state = createInitialState();
      state.recommendations = [
        {
          vehicleId: 'v1',
          matchScore: 90,
          reasoning: 'Good',
          highlights: ['Feature A'],
          concerns: [],
          vehicle: {
            id: 'v1',
            brand: 'Jeep',
            model: 'Renegade',
            year: 2021,
            mileage: 30000,
            price: 90000,
            color: 'Preto',
          } as any,
        },
      ];
      state.messages = [new HumanMessage('Mostre opções')];

      const result = await recommendationNode(state);

      expect(result.messages?.[0].content).toContain('Jeep Renegade');
    });

    it('should handle vehicle with missing details gracefully', async () => {
      const state = createInitialState();
      state.recommendations = [
        {
          vehicleId: 'v2',
          matchScore: 80,
          reasoning: 'Fallback test',
          highlights: [],
          concerns: [],
          vehicle: {
            id: 'v2',
            brand: 'Fiat',
            model: 'Uno',
            // Missing year, mileage, price to test fallbacks
          } as any,
        },
      ];
      state.messages = [new HumanMessage('Ver opções')];

      const result = await recommendationNode(state);

      const content = result.messages?.[0].content as string;
      expect(content).toContain('Fiat Uno');
      expect(content).toContain('Ano: 0'); // Fallback for year
      expect(content).toContain('0 km');   // Fallback for mileage
      expect(content).toContain('Consulte'); // Fallback for price
    });

    it('should handle handoff request', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Quero falar com vendedor')];

      const result = await recommendationNode(state);

      expect(result.messages?.[0].content).toContain('conectar você');
      expect(result.metadata?.flags).toContain('handoff_requested');
    });

    it('should handle schedule request', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Quero agendar visita')];

      const result = await recommendationNode(state);

      expect(result.messages?.[0].content).toContain('agendar sua visita');
      expect(result.metadata?.flags).toContain('visit_requested');
    });
  });
});
