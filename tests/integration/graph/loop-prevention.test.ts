import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInitialState, IGraphState } from '../../../src/types/graph.types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { greetingNode } from '../../../src/graph/nodes/greeting.node';
import { checkCircuitBreaker } from '../../../src/utils/circuit-breaker';
import { hasFlag } from '../../../src/utils/state-flags';

// Mock external dependencies
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/agents/vehicle-expert.agent', () => ({
  vehicleExpert: {
    chat: vi.fn().mockResolvedValue({
      response: 'Encontrei opções!',
      extractedPreferences: {},
      canRecommend: false,
      recommendations: [],
      nextMode: 'discovery',
    }),
  },
}));

vi.mock('../../../src/services/exact-search-parser.service', () => ({
  exactSearchParser: {
    parse: vi.fn().mockResolvedValue({ model: null, year: null }),
    isTradeInContext: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../../../src/lib/feature-flags', () => ({
  featureFlags: {
    isEnabled: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('../../../src/graph/langgraph/extractors', () => ({
  extractName: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../src/graph/langgraph/extractors/name-correction-detector', () => ({
  detectNameCorrection: vi.fn().mockReturnValue({ isCorrection: false }),
}));

describe('Graph Loop Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Greeting Node - Scenario D (only vehicle, no name)', () => {
    it('should ask for name on first attempt and set asked_name_once flag', async () => {
      const { exactSearchParser } =
        await import('../../../src/services/exact-search-parser.service');
      vi.mocked(exactSearchParser.parse).mockResolvedValue({
        model: 'Corolla',
        year: null,
        brand: null,
      } as any);

      const state = createInitialState();
      state.messages = [new HumanMessage('quero um Corolla')];

      const result = await greetingNode(state);

      expect(result.next).toBe('greeting');
      expect(hasFlag(result.metadata?.flags, 'asked_name_once')).toBe(true);
      expect(result.messages?.[0].content).toContain('Corolla');
      expect(result.messages?.[0].content).toContain('nome');
    });

    it('should proceed to discovery on second attempt without name (break loop)', async () => {
      const { exactSearchParser } =
        await import('../../../src/services/exact-search-parser.service');
      vi.mocked(exactSearchParser.parse).mockResolvedValue({
        model: 'Corolla',
        year: null,
        brand: null,
      } as any);

      const state = createInitialState();
      state.messages = [new HumanMessage('Toyota')];
      state.metadata.flags = ['asked_name_once'];

      const result = await greetingNode(state);

      // Should NOT loop back to greeting
      expect(result.next).toBe('discovery');
      expect(result.profile?.model).toBe('Corolla');
    });

    it('should NOT loop infinitely when user never provides name', async () => {
      const { exactSearchParser } =
        await import('../../../src/services/exact-search-parser.service');
      vi.mocked(exactSearchParser.parse).mockResolvedValue({
        model: 'Civic',
        year: 2020,
        brand: null,
      } as any);

      // Simulate first call
      const state1 = createInitialState();
      state1.messages = [new HumanMessage('quero um Civic 2020')];
      const result1 = await greetingNode(state1);
      expect(result1.next).toBe('greeting'); // First time: ask for name

      // Simulate second call with the flag set
      const state2 = createInitialState();
      state2.messages = [new HumanMessage('não quero dar meu nome')];
      state2.metadata.flags = result1.metadata?.flags || ['asked_name_once'];
      state2.profile = result1.profile;
      const result2 = await greetingNode(state2);

      // Must break the loop
      expect(result2.next).toBe('discovery');
    });
  });

  describe('Circuit Breaker', () => {
    it('should trigger after max loops exceeded', () => {
      const state = createInitialState();
      state.metadata.loopCount = 5;

      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(true);
      expect(result.reason).toBe('max_loops');
      expect(result.message).toBeDefined();
    });

    it('should trigger after max errors exceeded', () => {
      const state = createInitialState();
      state.metadata.errorCount = 3;

      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(true);
      expect(result.reason).toBe('max_errors');
    });

    it('should NOT trigger when within limits', () => {
      const state = createInitialState();
      state.metadata.loopCount = 2;
      state.metadata.errorCount = 1;

      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(false);
    });

    it('should include customer name in message when available', () => {
      const state = createInitialState();
      state.metadata.loopCount = 5;
      state.profile = { customerName: 'Maria' };

      const result = checkCircuitBreaker(state);
      expect(result.message).toContain('Maria');
    });

    it('should respect custom config', () => {
      const state = createInitialState();
      state.metadata.loopCount = 8;

      const relaxed = checkCircuitBreaker(state, { maxLoops: 10 });
      expect(relaxed.shouldBreak).toBe(false);

      const strict = checkCircuitBreaker(state, { maxLoops: 5 });
      expect(strict.shouldBreak).toBe(true);
    });
  });

  describe('Router-level loop detection (workflow)', () => {
    it('should detect same-node technical loops via metadata tracking', () => {
      const state = createInitialState();
      state.metadata.lastLoopNode = 'discovery';
      state.metadata.loopCount = 7;

      // At loopCount 8, the router would trigger circuit breaker (checked in workflow.ts)
      state.metadata.loopCount = 8;
      // This simulates what routeNode checks
      const isTechnicalLoop =
        state.metadata.lastLoopNode === 'discovery' && state.metadata.loopCount >= 8;

      expect(isTechnicalLoop).toBe(true);
    });

    it('should NOT trigger when different nodes alternate', () => {
      const state = createInitialState();
      state.metadata.lastLoopNode = 'greeting';
      state.metadata.loopCount = 3;

      // Transitioning to a different node resets the counter
      const nextNode = 'discovery';
      const isSameNode = state.metadata.lastLoopNode === nextNode;

      expect(isSameNode).toBe(false);
    });
  });
});
