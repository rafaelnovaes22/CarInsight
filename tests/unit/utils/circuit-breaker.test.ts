import { describe, it, expect } from 'vitest';
import { checkCircuitBreaker, computeLoopCount } from '../../../src/utils/circuit-breaker';
import { IGraphState } from '../../../src/types/graph.types';

function createMockState(overrides: Partial<IGraphState['metadata']> = {}): IGraphState {
  return {
    messages: [],
    phoneNumber: '',
    profile: {},
    recommendations: [],
    next: 'greeting',
    metadata: {
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
      loopCount: 0,
      lastLoopNode: undefined,
      errorCount: 0,
      flags: [],
      ...overrides,
    },
    quiz: {
      currentQuestion: 1,
      progress: 0,
      answers: {},
      isComplete: false,
    },
  };
}

describe('circuit-breaker', () => {
  describe('checkCircuitBreaker', () => {
    it('should not break when counts are low', () => {
      const state = createMockState({ loopCount: 1, errorCount: 0 });
      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(false);
    });

    it('should break when loopCount exceeds maxLoops', () => {
      const state = createMockState({ loopCount: 5 });
      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(true);
      expect(result.reason).toBe('max_loops');
      expect(result.message).toBeDefined();
    });

    it('should break when errorCount exceeds maxErrors', () => {
      const state = createMockState({ errorCount: 3 });
      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(true);
      expect(result.reason).toBe('max_errors');
    });

    it('should use custom config', () => {
      const state = createMockState({ loopCount: 3 });
      const result = checkCircuitBreaker(state, { maxLoops: 10 });
      expect(result.shouldBreak).toBe(false);
    });

    it('should personalize message with customer name', () => {
      const state = createMockState({ loopCount: 5 });
      state.profile = { customerName: 'João' };
      const result = checkCircuitBreaker(state);
      expect(result.message).toContain('João');
    });

    it('should use generic message without customer name', () => {
      const state = createMockState({ loopCount: 5 });
      const result = checkCircuitBreaker(state);
      expect(result.message).not.toContain('undefined');
      expect(result.message).toContain('consultores');
    });

    it('should break when fiberStagnationCount exceeds maxFiberStagnation', () => {
      const state = createMockState({ fiberStagnationCount: 6 });
      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(true);
      expect(result.reason).toBe('fiber_stagnation');
      expect(result.message).toContain('consultor especializado');
    });

    it('should not break when fiberStagnationCount is below threshold', () => {
      const state = createMockState({ fiberStagnationCount: 3 });
      const result = checkCircuitBreaker(state);
      expect(result.shouldBreak).toBe(false);
    });

    it('should personalize fiber stagnation message with customer name', () => {
      const state = createMockState({ fiberStagnationCount: 6 });
      state.profile = { customerName: 'Maria' };
      const result = checkCircuitBreaker(state);
      expect(result.reason).toBe('fiber_stagnation');
      expect(result.message).toContain('Maria');
    });

    it('should use custom maxFiberStagnation config', () => {
      const state = createMockState({ fiberStagnationCount: 3 });
      const result = checkCircuitBreaker(state, { maxFiberStagnation: 3 });
      expect(result.shouldBreak).toBe(true);
      expect(result.reason).toBe('fiber_stagnation');
    });

    it('should prioritize max_loops over fiber_stagnation', () => {
      const state = createMockState({ loopCount: 5, fiberStagnationCount: 6 });
      const result = checkCircuitBreaker(state);
      expect(result.reason).toBe('max_loops');
    });
  });

  describe('computeLoopCount', () => {
    it('should reset when not a loop', () => {
      const state = createMockState({ loopCount: 3, lastLoopNode: 'discovery' });
      const result = computeLoopCount(state, 'discovery', false);
      expect(result.loopCount).toBe(0);
      expect(result.lastLoopNode).toBeUndefined();
    });

    it('should increment when same node loops', () => {
      const state = createMockState({ loopCount: 2, lastLoopNode: 'discovery' });
      const result = computeLoopCount(state, 'discovery', true);
      expect(result.loopCount).toBe(3);
      expect(result.lastLoopNode).toBe('discovery');
    });

    it('should reset to 1 when different node starts looping', () => {
      const state = createMockState({ loopCount: 2, lastLoopNode: 'greeting' });
      const result = computeLoopCount(state, 'discovery', true);
      expect(result.loopCount).toBe(1);
      expect(result.lastLoopNode).toBe('discovery');
    });
  });
});
