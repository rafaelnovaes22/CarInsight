/**
 * Post-Recommendation Handlers
 *
 * Central export file for all post-recommendation handlers.
 * These handlers process user intents after showing vehicle recommendations.
 */

// Types
export * from './types';

// Individual handlers
export { handleFinancing } from './financing.handler';
export { handleFinancingResponse, isFinancingResponse } from './financing-response.handler';
export { handleTradeIn } from './tradein.handler';
export { handleSchedule } from './schedule.handler';
export { handleDetails } from './details.handler';
export { handleAcknowledgment } from './acknowledgment.handler';
export { handleInterest } from './interest.handler';
export { handleWantOthers, type WantOthersContext } from './want-others.handler';

// Import for router
import { detectPostRecommendationIntent, PostRecommendationIntent } from '../intent-detector';
import { PostRecommendationContext, HandlerResult } from './types';
import { handleFinancing } from './financing.handler';
import { handleFinancingResponse, isFinancingResponse } from './financing-response.handler';
import { handleTradeIn } from './tradein.handler';
import { handleSchedule } from './schedule.handler';
import { handleDetails } from './details.handler';
import { handleAcknowledgment } from './acknowledgment.handler';
import { handleInterest } from './interest.handler';

/**
 * Route post-recommendation intent to appropriate handler
 *
 * @param intent - The detected post-recommendation intent
 * @param ctx - The handler context
 * @returns Handler result (handled + optional response)
 */
export const routePostRecommendationIntent = (
  intent: PostRecommendationIntent,
  ctx: PostRecommendationContext
): HandlerResult => {
  switch (intent) {
    case 'want_financing':
      return handleFinancing(ctx);

    case 'want_tradein':
      return handleTradeIn(ctx);

    case 'want_schedule':
      return handleSchedule(ctx);

    case 'want_details':
      return handleDetails(ctx);

    case 'acknowledgment':
      return handleAcknowledgment(ctx);

    case 'want_interest':
      return handleInterest(ctx);

    // 'want_others' is handled separately due to async search logic
    // 'new_search' and 'none' fall through to normal processing
    default:
      return { handled: false };
  }
};

/**
 * Process post-recommendation intent
 *
 * Detects intent and routes to appropriate handler.
 * Note: 'want_others' requires async search and should be handled separately.
 *
 * @param ctx - The handler context
 * @returns Handler result
 */
export const processPostRecommendationIntent = (ctx: PostRecommendationContext): HandlerResult => {
  // First, check if we're awaiting financing details (user just said they want to finance)
  // and the message contains entry information (value, "sem entrada", etc.)
  const awaitingFinancing =
    ctx.updatedProfile?._awaitingFinancingDetails ||
    ctx.extracted?.extracted?._awaitingFinancingDetails;

  if (awaitingFinancing && isFinancingResponse(ctx.userMessage, true)) {
    return handleFinancingResponse(ctx);
  }

  // Otherwise, detect intent normally
  const intent = detectPostRecommendationIntent(ctx.userMessage, ctx.lastShownVehicles);

  return routePostRecommendationIntent(intent, ctx);
};
