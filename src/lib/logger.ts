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
};

export default logger;
