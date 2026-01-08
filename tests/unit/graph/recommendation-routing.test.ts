import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendationNode } from '../../../src/graph/nodes/recommendation.node';
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
});
