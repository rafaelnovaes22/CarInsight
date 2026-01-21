/**
 * Node Metrics Helper
 *
 * Provides standardized logging and metrics collection for LangGraph nodes.
 * Used to track latency, execution status, and flags across all conversation nodes.
 */

import { logger } from './logger';
import { IGraphState } from '../types/graph.types';

/**
 * Metrics data collected during node execution
 */
export interface NodeMetrics {
  /** Name of the node (e.g., 'discovery', 'recommendation') */
  node: string;
  /** Execution latency in milliseconds */
  latencyMs: number;
  /** Phone number (partially masked) */
  phoneNumber: string;
  /** Current flags in state */
  flags: string[];
  /** Next node to transition to */
  nextNode?: string;
  /** Whether recommendations were generated */
  hasRecommendations?: boolean;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Timer class for measuring node execution time
 */
export class NodeTimer {
  private startTime: number;
  private nodeName: string;

  constructor(nodeName: string) {
    this.nodeName = nodeName;
    this.startTime = Date.now();
    logger.debug({ node: nodeName }, `${nodeName}Node: Starting execution`);
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Log successful node execution with metrics
   */
  logSuccess(state: IGraphState, result: Partial<IGraphState>): void {
    const metrics: NodeMetrics = {
      node: this.nodeName,
      latencyMs: this.getElapsedMs(),
      phoneNumber: this.maskPhone(state.phoneNumber),
      flags: result.metadata?.flags || state.metadata?.flags || [],
      nextNode: result.next,
      hasRecommendations:
        (result.recommendations?.length || 0) > 0 || (state.recommendations?.length || 0) > 0,
    };

    logger.info(metrics, `${this.nodeName}Node: Execution complete`);
  }

  /**
   * Log failed node execution with error
   */
  logError(state: IGraphState, error: Error | string): void {
    const metrics: NodeMetrics = {
      node: this.nodeName,
      latencyMs: this.getElapsedMs(),
      phoneNumber: this.maskPhone(state.phoneNumber),
      flags: state.metadata?.flags || [],
      error: error instanceof Error ? error.message : String(error),
    };

    logger.error(metrics, `${this.nodeName}Node: Execution failed`);
  }

  /**
   * Mask phone number for privacy (show first 8 digits only)
   */
  private maskPhone(phone: string | undefined): string {
    if (!phone) return 'unknown';
    if (phone.length <= 8) return phone;
    return phone.substring(0, 8) + '****';
  }
}

/**
 * Create a timer for measuring node execution
 *
 * @param nodeName Name of the node (e.g., 'discovery', 'recommendation')
 * @returns NodeTimer instance
 *
 * @example
 * ```typescript
 * export async function discoveryNode(state: IGraphState) {
 *   const timer = createNodeTimer('discovery');
 *
 *   try {
 *     // ... node logic ...
 *     timer.logSuccess(state, result);
 *     return result;
 *   } catch (error) {
 *     timer.logError(state, error);
 *     throw error;
 *   }
 * }
 * ```
 */
export function createNodeTimer(nodeName: string): NodeTimer {
  return new NodeTimer(nodeName);
}

/**
 * Wrap a node function with automatic metrics collection
 *
 * @param nodeName Name of the node
 * @param nodeFunction The node function to wrap
 * @returns Wrapped function with metrics
 */
export function withMetrics<T extends (state: IGraphState) => Promise<Partial<IGraphState>>>(
  nodeName: string,
  nodeFunction: T
): T {
  return (async (state: IGraphState): Promise<Partial<IGraphState>> => {
    const timer = createNodeTimer(nodeName);

    try {
      const result = await nodeFunction(state);
      timer.logSuccess(state, result);
      return result;
    } catch (error) {
      timer.logError(state, error as Error);
      throw error;
    }
  }) as T;
}
