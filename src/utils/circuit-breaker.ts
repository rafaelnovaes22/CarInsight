/**
 * Graph Circuit Breaker Utility
 * Prevents infinite loops and excessive errors in LangGraph nodes.
 */

import { IGraphState } from '../types/graph.types';

export interface CircuitBreakerConfig {
  maxLoops: number;
  maxErrors: number;
  maxFiberStagnation: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxLoops: 5,
  maxErrors: 3,
  maxFiberStagnation: 6,
};

export interface CircuitBreakerResult {
  shouldBreak: boolean;
  reason?: 'max_loops' | 'max_errors' | 'fiber_stagnation';
  message?: string;
}

/**
 * Checks if the circuit breaker should trigger based on loop/error counts.
 */
export function checkCircuitBreaker(
  state: IGraphState,
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreakerResult {
  const { maxLoops, maxErrors, maxFiberStagnation } = { ...DEFAULT_CONFIG, ...config };

  const loopCount = state.metadata?.loopCount || 0;
  const errorCount = state.metadata?.errorCount || 0;

  if (loopCount >= maxLoops) {
    const name = state.profile?.customerName;
    return {
      shouldBreak: true,
      reason: 'max_loops',
      message: name
        ? `${name}, estou tendo dificuldades para entender. Vou transferir você para um de nossos consultores que poderá ajudar melhor.`
        : 'Estou tendo dificuldades para entender. Vou transferir você para um de nossos consultores.',
    };
  }

  if (errorCount >= maxErrors) {
    return {
      shouldBreak: true,
      reason: 'max_errors',
      message:
        'Desculpe, estou com problemas técnicos. Vou transferir você para um consultor humano.',
    };
  }

  const fiberStagnation = state.metadata?.fiberStagnationCount || 0;
  if (fiberStagnation >= maxFiberStagnation) {
    const name = state.profile?.customerName;
    return {
      shouldBreak: true,
      reason: 'fiber_stagnation',
      message: name
        ? `${name}, parece que não estou conseguindo avançar no seu atendimento. Vou transferir você para um consultor especializado.`
        : 'Parece que não estou conseguindo avançar no seu atendimento. Vou transferir você para um consultor especializado.',
    };
  }

  return { shouldBreak: false };
}

/**
 * Returns incremented loop count, considering whether we're still in the same node.
 */
export function computeLoopCount(
  state: IGraphState,
  currentNode: string,
  isLoop: boolean
): { loopCount: number; lastLoopNode: string | undefined } {
  if (!isLoop) {
    return { loopCount: 0, lastLoopNode: undefined };
  }

  const count =
    state.metadata.lastLoopNode === currentNode ? (state.metadata.loopCount || 0) + 1 : 1;

  return { loopCount: count, lastLoopNode: currentNode };
}
