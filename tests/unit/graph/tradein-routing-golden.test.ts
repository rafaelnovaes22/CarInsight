import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tradeInNode } from '../../../src/graph/nodes/trade-in.node';
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

const mockProcessTradeIn = vi.fn();
vi.mock('../../../src/agents/trade-in.agent', () => ({
  tradeInAgent: {
    processTradeIn: (...args: any[]) => mockProcessTradeIn(...args),
  },
}));

describe('TradeInNode routing + state merge (golden)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps next=negotiation when tradeInAgent returns nextMode negotiation', async () => {
    const state = createInitialState();
    state.profile = { _showedRecommendation: true, _lastShownVehicles: [] };
    state.messages = [new HumanMessage('Tenho um Polo 2020 na troca')];

    mockProcessTradeIn.mockResolvedValue({
      response: 'Ok, vou avaliar seu carro',
      extractedPreferences: { hasTradeIn: true, tradeInModel: 'polo', tradeInYear: 2020 },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: 'negotiation',
    });

    const result = await tradeInNode(state);

    expect(result.next).toBe('negotiation');
    expect(result.profile?.hasTradeIn).toBe(true);
    expect(result.profile?.tradeInModel).toBe('polo');
    expect(result.messages?.[0].content).toContain('avaliar');
  });
});
