/**
 * Feedback Service
 *
 * Handles submission of user feedback and effectiveness metrics to LangSmith.
 * Tracks "User Feedback" (explicit) and "Conversion Events" (implicit).
 */

import { Client } from 'langsmith';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export class FeedbackService {
  private client: Client;
  private enabled: boolean;

  constructor() {
    this.enabled = !!env.LANGCHAIN_API_KEY;
    if (this.enabled) {
      this.client = new Client({
        apiKey: env.LANGCHAIN_API_KEY,
        apiUrl: env.LANGCHAIN_ENDPOINT,
      });
    } else {
      // Mock client or disable
      this.client = null as any;
    }
  }

  /**
   * Submit explicit user feedback (e.g. Thumbs Up/Down)
   *
   * @param runId - The run ID of the agent interaction (usually gathered from trace header or state)
   * @param score - 1.0 (positive) or 0.0 (negative)
   * @param comment - Optional comment from user
   */
  async submitUserFeedback(runId: string, score: number, comment?: string): Promise<void> {
    if (!this.enabled || !runId) return;

    try {
      await this.client.createFeedback(runId, 'user_score', {
        score,
        comment,
      });
      logger.info({ runId, score }, 'Feedback submitted to LangSmith');
    } catch (error) {
      logger.error({ error, runId }, 'Failed to submit feedback to LangSmith');
    }
  }

  /**
   * Track a business conversion event
   *
   * @param runId - The run ID of the conversation that led to conversion
   * @param event - The type of conversion event
   */
  async trackConversion(
    runId: string,
    event: 'whatsapp_click' | 'test_drive' | 'financing_started'
  ): Promise<void> {
    if (!this.enabled || !runId) return;

    try {
      await this.client.createFeedback(runId, 'conversion_event', {
        score: 1.0,
        value: event,
        comment: `User Triggered: ${event}`,
      });
      logger.info({ runId, event }, 'Conversion event tracked in LangSmith');
    } catch (error) {
      logger.error({ error, runId }, 'Failed to track conversion in LangSmith');
    }
  }

  /**
   * Track retrieval relevance (RAG Effectiveness)
   * can be used by an evaluator or manually logged
   */
  async trackRelevance(runId: string, retrieved: number, relevant: number): Promise<void> {
    if (!this.enabled || !runId) return;

    // Precision @ k metric
    const precision = retrieved > 0 ? relevant / retrieved : 0;

    try {
      await this.client.createFeedback(runId, 'retrieval_precision', {
        score: precision,
        comment: `Retrieved: ${retrieved}, Relevant/Used: ${relevant}`,
      });
    } catch (error) {
      logger.error({ error, runId }, 'Failed to track relevance metrics');
    }
  }
}

export const feedbackService = new FeedbackService();
