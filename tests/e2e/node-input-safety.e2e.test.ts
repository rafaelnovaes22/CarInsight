import { describe, it, expect, vi } from 'vitest';
import { createInitialState } from '../../src/types/graph.types';
import { financingNode } from '../../src/graph/nodes/financing.node';
import { tradeInNode } from '../../src/graph/nodes/trade-in.node';

vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('E2E: Node input safety fallbacks', () => {
  it('financing node should end safely when no valid message exists', async () => {
    const state = createInitialState();
    state.messages = [];

    const result = await financingNode(state);

    expect(result.next).toBe('end');
    expect(result.messages).toBeDefined();
    expect(result.messages).toHaveLength(1);
    expect(String(result.messages?.[0].content).toLowerCase()).toContain('consultor');
  });

  it('trade-in node should end safely when no valid message exists', async () => {
    const state = createInitialState();
    state.messages = [];

    const result = await tradeInNode(state);

    expect(result.next).toBe('end');
    expect(result.messages).toBeDefined();
    expect(result.messages).toHaveLength(1);
    expect(String(result.messages?.[0].content).toLowerCase()).toContain('consultor');
  });
});
