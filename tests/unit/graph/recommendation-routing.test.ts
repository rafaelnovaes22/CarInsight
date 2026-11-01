import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendationNode } from '../../../src/graph/nodes/recommendation';
import { createInitialState } from '../../../src/types/graph.types';
import { HumanMessage } from '@langchain/core/messages';

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RecommendationNode routing (golden)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to financing when user asks to finance', async () => {
    const state = createInitialState();
    state.recommendations = [];
    state.messages = [new HumanMessage('Quero financiar com 10 mil de entrada')];

    const result = await recommendationNode(state);

    expect(result.next).toBe('financing');
    expect(result.messages).toBeUndefined();
  });

  it('routes to trade_in when user mentions trade-in', async () => {
    const state = createInitialState();
    state.recommendations = [];
    state.messages = [new HumanMessage('Tenho um carro na troca')];

    const result = await recommendationNode(state);

    expect(result.next).toBe('trade_in');
    expect(result.messages).toBeUndefined();
  });

  it('routes to negotiation when user shows interest', async () => {
    const state = createInitialState();
    state.recommendations = [];
    state.messages = [new HumanMessage('Gostei, quero fechar')];

    const result = await recommendationNode(state);

    expect(result.next).toBe('negotiation');
    expect(result.messages).toBeUndefined();
  });

  it('selects vehicle by model name', async () => {
    const state = createInitialState();
    state.recommendations = [
      {
        vehicleId: 'v1',
        vehicle: { modelo: 'Santana', marca: 'Volkswagen', ano: 2020 } as never,
        score: 0.9,
        rank: 1,
        reasons: [],
      },
    ];
    state.messages = [new HumanMessage('O Santana')];

    const result = await recommendationNode(state);

    expect(result.messages).toBeDefined();
    expect(result.messages?.length).toBe(1);
    const content = String(result.messages![0].content);
    expect(content).toContain('Santana');
    expect(content).toContain('Ano');
  });

  it('selects vehicle by name with article prefix', async () => {
    const state = createInitialState();
    state.recommendations = [
      {
        vehicleId: 'v1',
        vehicle: { modelo: 'Gol', marca: 'Volkswagen', ano: 2019 } as never,
        score: 0.8,
        rank: 1,
        reasons: [],
      },
      {
        vehicleId: 'v2',
        vehicle: { modelo: 'Onix', marca: 'Chevrolet', ano: 2021 } as never,
        score: 0.7,
        rank: 2,
        reasons: [],
      },
    ];
    state.messages = [new HumanMessage('o onix')];

    const result = await recommendationNode(state);

    expect(result.messages).toBeDefined();
    const content = String(result.messages![0].content);
    expect(content).toContain('Onix');
  });

  it('asks for confirmation instead of replaying recommendations on ambiguous seller typo', async () => {
    const state = createInitialState();
    state.profile = {
      _lastShownVehicles: [
        { vehicleId: 'v1', brand: 'RENAULT', model: 'CAPTUR', year: 2019, price: 76990 },
      ],
    } as never;
    state.recommendations = [
      {
        vehicleId: 'v1',
        vehicle: { modelo: 'Captur', marca: 'Renault', ano: 2019, preco: 76990 } as never,
        score: 0.8,
        rank: 1,
        reasons: [],
      },
    ];
    state.messages = [new HumanMessage('Vendedoe')];

    const result = await recommendationNode(state);

    const content = String(result.messages?.[0].content || '');
    expect(content).toContain('quis dizer');
    expect(content).toContain('vendedor');
    expect(content).not.toContain('Encontrei');
  });
});
