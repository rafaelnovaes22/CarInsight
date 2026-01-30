import pino from 'pino';
import { isDev } from '../config/env';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
});

/**
 * Structured business event logging helpers
 * Provides standardized event tracking for observability
 */
export const logEvent = {
  /**
   * Log when a new conversation starts
   */
  conversationStarted: (data: { conversationId: string; phoneNumber: string; source?: string }) => {
    logger.info({ event: 'conversation_started', ...data });
  },

  /**
   * Log when a lead is created (high-value business event)
   */
  leadCreated: (data: {
    conversationId: string;
    phoneNumber?: string;
    vehicleId?: string;
    source: string;
  }) => {
    logger.info({ event: 'lead_created', ...data });
  },

  /**
   * Log when recommendations are shown to user
   */
  recommendationShown: (data: {
    conversationId: string;
    vehicleIds: string[];
    matchScores: number[];
    count: number;
  }) => {
    logger.info({ event: 'recommendation_shown', ...data });
  },

  /**
   * Log node execution results (for latency tracking)
   */
  nodeExecuted: (data: {
    node: string;
    conversationId: string;
    latencyMs: number;
    success: boolean;
    nextNode?: string;
    error?: string;
  }) => {
    if (data.success) {
      logger.info({ event: 'node_executed', ...data });
    } else {
      logger.error({ event: 'node_executed', ...data });
    }
  },

  /**
   * Log LLM API calls (for cost and performance tracking)
   */
  llmCalled: (data: {
    provider: 'openai' | 'groq' | 'mock';
    model: string;
    latencyMs: number;
    tokensUsed?: number;
    promptTokens?: number;
    completionTokens?: number;
    success: boolean;
    error?: string;
  }) => {
    logger.info({ event: 'llm_called', ...data });
  },

  /**
   * Log embedding generation
   */
  embeddingGenerated: (data: {
    provider: 'openai' | 'cohere';
    model: string;
    latencyMs: number;
    dimensions: number;
    vehicleId?: string;
  }) => {
    logger.info({ event: 'embedding_generated', ...data });
  },

  /**
   * Log vehicle search execution
   */
  vehicleSearched: (data: {
    conversationId: string;
    query: string;
    searchType: 'semantic' | 'exact' | 'direct' | 'fallback';
    resultsCount: number;
    latencyMs: number;
    filters?: Record<string, unknown>;
  }) => {
    logger.info({ event: 'vehicle_searched', ...data });
  },

  /**
   * Log user intent detection
   */
  intentDetected: (data: {
    conversationId: string;
    intent: string;
    confidence?: number;
    extractedEntities?: Record<string, unknown>;
  }) => {
    logger.info({ event: 'intent_detected', ...data });
  },

  /**
   * Log handoff to human agent
   */
  handoffRequested: (data: { conversationId: string; phoneNumber: string; reason?: string }) => {
    logger.info({ event: 'handoff_requested', ...data });
  },

  // ============================================================================
  // Performance Metrics Events (Feature: latency-optimization)
  // Requirements: 6.3, 6.4 - Performance monitoring and alerting
  // ============================================================================

  /**
   * Log recommendation flow stage timing
   */
  recommendationStage: (data: {
    conversationId: string;
    requestId: string;
    stage: string;
    durationMs: number;
    success: boolean;
    metadata?: Record<string, unknown>;
  }) => {
    logger.info({ event: 'recommendation_stage', ...data });
  },

  /**
   * Log recommendation flow completion with total metrics
   */
  recommendationCompleted: (data: {
    conversationId: string;
    requestId: string;
    totalDurationMs: number;
    llmCallCount: number;
    llmTotalTimeMs: number;
    vehiclesProcessed: number;
    vehiclesReturned: number;
    stages: { stage: string; durationMs: number; success: boolean }[];
  }) => {
    logger.info({ event: 'recommendation_completed', ...data });
  },

  /**
   * Log latency alert when recommendation exceeds threshold (5s)
   * **Feature: latency-optimization** - Requirements: 6.4
   */
  latencyAlert: (data: {
    conversationId: string;
    requestId: string;
    totalDurationMs: number;
    thresholdMs: number;
    llmCallCount: number;
    slowestStage?: string;
    slowestStageDurationMs?: number;
  }) => {
    logger.warn({ event: 'latency_alert', ...data });
  },

  /**
   * Log deterministic ranking execution
   */
  deterministicRanking: (data: {
    conversationId?: string;
    useCase: string;
    filterTimeMs: number;
    vehiclesFound: number;
    vehiclesReturned: number;
    budget?: number;
  }) => {
    logger.info({ event: 'deterministic_ranking', ...data });
  },

  /**
   * Log LLM call with timing for performance tracking
   * **Feature: latency-optimization** - Requirements: 6.3
   */
  llmCallTimed: (data: {
    conversationId?: string;
    requestId?: string;
    purpose: 'preference_extraction' | 'response_generation' | 'classification' | 'other';
    provider: string;
    model: string;
    durationMs: number;
    success: boolean;
    tokensUsed?: number;
    error?: string;
  }) => {
    logger.info({ event: 'llm_call_timed', ...data });
  },
};

export default logger;
