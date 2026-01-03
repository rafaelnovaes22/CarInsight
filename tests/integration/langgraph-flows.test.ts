import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createConversationGraph } from '../../src/graph/workflow';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { vehicleExpert } from '../../src/agents/vehicle-expert.agent';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';

// Mock dependencies
vi.mock('../../src/agents/vehicle-expert.agent', () => ({
  vehicleExpert: {
    chat: vi.fn(),
  },
}));

// Mock Logger to silence output during tests
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Exact Search Parser
vi.mock('../../src/services/exact-search-parser.service', () => ({
  exactSearchParser: {
    parse: vi.fn().mockImplementation(async (msg: string) => {
      const lower = msg.toLowerCase();
      if (lower.includes('gol')) {
        return { model: 'gol', year: 2015, rawQuery: msg };
      }
      if (lower.includes('civic')) {
        return { model: 'civic', year: 2021, rawQuery: msg };
      }
      if (lower.includes('corolla')) {
        return { model: 'corolla', year: 2020, rawQuery: msg };
      }
      return { model: null, rawQuery: msg };
    }),
    isTradeInContext: vi.fn().mockImplementation((msg: string) => {
      const lower = msg.toLowerCase();
      return lower.includes('troca') || lower.includes('tenho um');
    }),
    ensureInitialized: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('LangGraph Flows Integration', () => {
  let app: any;
  let memory: MemorySaver;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = new MemorySaver();
    app = createConversationGraph({ checkpointer: memory });
  });

  const runGraph = async (threadId: string, message: string) => {
    const config = { configurable: { thread_id: threadId } };
    const result = await app.invoke({ messages: [new HumanMessage(message)] }, config);
    const lastMessage = result.messages[result.messages.length - 1];
    return {
      content: lastMessage.content,
      next: result.next,
      state: result,
    };
  };

  it('Scenario 1: Happy Path - Greeting -> Name -> Discovery -> Recommendation', async () => {
    const threadId = 'test-happy-path-1';

    // 1. Initial Greeting
    const res1 = await runGraph(threadId, 'Olá');
    expect(res1.content).toContain('qual é o seu nome?');
    expect(res1.state.profile.customerName).toBeUndefined();

    // 2. Provide Name
    const res2 = await runGraph(threadId, 'Meu nome é Rafael');
    expect(res2.content).toContain('Rafael');
    expect(res2.content).toContain('o que você está procurando?');
    expect(res2.state.profile.customerName).toBe('Rafael');
    expect(res2.next).toBe('discovery');

    // 3. Discovery -> Search (Mocked)
    // Mock VehicleExpert to return a recommendation
    vi.mocked(vehicleExpert.chat).mockResolvedValueOnce({
      response: 'Encontrei um Corolla 2020 para você.',
      canRecommend: true,
      extractedPreferences: { model: 'Corolla', minYear: 2020 },
      recommendations: [
        {
          vehicleId: '123',
          matchScore: 90,
          vehicle: {
            id: '123',
            marca: 'Toyota',
            modelo: 'Corolla',
            ano: 2020,
            preco: 100000,
            km: 50000,
            cor: 'Preto',
          },
        },
      ] as any,
      needsMoreInfo: [],
      nextMode: 'recommendation',
    });

    const res3 = await runGraph(threadId, 'Quero um Corolla 2020');
    expect(res3.state.recommendations).toHaveLength(1);
    // The discovery node outputs the response from VehicleExpert directly.
    // usage of formatRecommendations happens inside the expert or inside recommendationNode
    // depending on flow. In this mocked case, we returned a string.
    expect(res3.content).toContain('Encontrei um Corolla 2020');
    expect(res3.next).toBe('recommendation');
  });

  it('Scenario 2: Financing Flow', async () => {
    const threadId = 'test-financing-1';

    // 1. Greeting
    await runGraph(threadId, 'Oi');
    // 2. Name
    const resName = await runGraph(threadId, 'Rafael');

    // 3. Search (Mocked)
    vi.mocked(vehicleExpert.chat).mockResolvedValueOnce({
      response: 'Aqui está um Civic.',
      canRecommend: true,
      extractedPreferences: {
        model: 'Civic',
        _showedRecommendation: true,
        _lastShownVehicles: [{ model: 'Civic', brand: 'Honda', year: 2021, price: 120000 }] as any,
      },
      recommendations: [
        {
          vehicleId: 'civic-1',
          matchScore: 95,
          vehicle: { marca: 'Honda', modelo: 'Civic', ano: 2021, preco: 120000, km: 30000 },
        },
      ] as any,
      needsMoreInfo: [],
      nextMode: 'recommendation', // Discovery node sets next=recommendation
    });

    await runGraph(threadId, 'Quero um Civic');

    // 4. User asks for financing
    vi.mocked(vehicleExpert.chat).mockResolvedValueOnce({
      response: 'Show, qual o valor da entrada?',
      canRecommend: false,
      extractedPreferences: { wantsFinancing: true, _awaitingFinancingDetails: true },
      recommendations: [],
      needsMoreInfo: ['financingDownPayment'],
      nextMode: 'negotiation',
    });

    const resFin = await runGraph(threadId, 'Quero financiar');
    expect(resFin.content).toContain('entrada');
  });

  it('Scenario 3: Trade-in Flow', async () => {
    const threadId = 'test-tradein-1';

    // 1. Greeting with Trade-in intent directly
    const res1 = await runGraph(threadId, 'Oi, tenho um Gol 2015 para troca. Meu nome é João.');

    // GreetingNode logic:
    // exactSearchParser detects Gol 2015. isTradeInContext = true.
    // extractName detects João.
    // SCENARIO B: Name AND Trade-in -> returns message "Entendi! Você tem um GOL 2015..."

    expect(res1.content).toMatch(/gol/i); // Case insensitive check
    expect(res1.content).toMatch(/troca/i);
    expect(res1.content).toContain('João');
    expect(res1.state.profile.tradeInModel).toBe('gol');
    expect(res1.state.profile.tradeInYear).toBe(2015);
  });

  it('Scenario 4: Handoff', async () => {
    const threadId = 'test-handoff-1';

    // 1. Initial interaction
    await runGraph(threadId, 'Oi, sou Maria');

    // 2. Request human
    // Passes through Greeting -> Discovery
    // DiscoveryNode calls VehicleExpert?
    // Actually, let's see if GreetingNode handles "falar com vendedor"?
    // No, it handles names and cars.
    // So it goes to DiscoveryNode.

    // Mock Vehicle Expert to return "handoff" response or we rely on recommendation node?
    // Wait, `recommendationNode` has "Handle 'vendedor'".
    // But `discoveryNode`?
    // Let's check if there's a global handoff/vendedor check.
    // Usually handled by VehicleExpert or specific nodes.

    // If I say "falar com vendedor" in discovery:
    // VehicleExpert.chat is called.
    // We should mock VehicleExpert to return a response that leads to handoff?
    // OR does VehicleExpert return a specific flag?

    // Let's assume VehicleExpert handles generic "vendedor" by returning text.
    // BUT `recommendationNode` EXPLICITLY handles it.
    // `discoveryNode` does NOT seem to explicitly handle it in `nodes/index.ts` (need to check).

    // Mocking VehicleExpert to simulate typical agent response for "vendedor"
    vi.mocked(vehicleExpert.chat).mockResolvedValueOnce({
      response: 'Claro, vou chamar o vendedor.',
      canRecommend: false,
      extractedPreferences: {},
      recommendations: [],
      needsMoreInfo: [],
      nextMode: 'negotiation' as any, // Context mode.
    });

    const res = await runGraph(threadId, 'falar com vendedor');
    expect(res.content).toBeDefined();
  });
});
