import { describe, it, expect, vi, beforeEach } from 'vitest';
import { financingNode } from '../../../src/graph/nodes/financing.node';
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

const mockProcessReference = vi.fn();
vi.mock('../../../src/agents/financing.agent', () => ({
  financingAgent: {
    processReference: (...args: any[]) => mockProcessReference(...args),
  },
}));

describe('FinancingNode routing + state merge (golden)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps next=negotiation when financingAgent returns nextMode negotiation', async () => {
    const state = createInitialState();
    state.profile = {
      _showedRecommendation: true,
      _lastShownVehicles: [
        { vehicleId: 'v1', brand: 'VW', model: 'Polo', year: 2020, price: 70000 },
      ],
    };
    state.messages = [new HumanMessage('Quero financiar com 10 mil de entrada')];

    mockProcessReference.mockResolvedValue({
      response: 'Simulação de financiamento',
      extractedPreferences: { wantsFinancing: true, financingDownPayment: 10000 },
      needsMoreInfo: [],
      canRecommend: false,
      nextMode: 'negotiation',
    });

    const result = await financingNode(state);

    expect(result.next).toBe('negotiation');
    expect(result.profile?.wantsFinancing).toBe(true);
    expect(result.profile?.financingDownPayment).toBe(10000);
    expect(result.messages?.[0].content).toContain('financiamento');
  });
});
