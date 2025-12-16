/**
 * Response Builder Utility
 *
 * Standardizes the construction of ConversationResponse objects.
 */

import { ConversationResponse } from '../../../types/conversation.types';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';

export interface ResponseBuilderOptions {
  needsMoreInfo?: string[];
  canRecommend?: boolean;
  recommendations?: VehicleRecommendation[];
  nextMode?: string;
  startTime: number;
  confidence?: number;
  llmUsed?: string;
  extraMetadata?: Record<string, any>;
}

/**
 * Build a standard ConversationResponse object
 */
export function buildResponse(
  response: string,
  preferences: Partial<CustomerProfile>,
  options: ResponseBuilderOptions
): ConversationResponse {
  return {
    response,
    extractedPreferences: preferences,
    needsMoreInfo: options.needsMoreInfo || [],
    canRecommend: options.canRecommend ?? false,
    recommendations: options.recommendations,
    nextMode: options.nextMode || 'discovery',
    metadata: {
      processingTime: Date.now() - options.startTime,
      confidence: options.confidence ?? 0.9,
      llmUsed: options.llmUsed || 'rule-based',
      ...options.extraMetadata,
    },
  } as ConversationResponse;
}
