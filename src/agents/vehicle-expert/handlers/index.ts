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
export { handleTradeIn } from './tradein.handler';
export { handleSchedule } from './schedule.handler';
export { handleDetails } from './details.handler';
export { handleAcknowledgment } from './acknowledgment.handler';

// Import for router
import { detectPostRecommendationIntent, PostRecommendationIntent } from '../intent-detector';
import { PostRecommendationContext, HandlerResult } from './types';
import { handleFinancing } from './financing.handler';
import { handleTradeIn } from './tradein.handler';
import { handleSchedule } from './schedule.handler';
import { handleDetails } from './details.handler';
import { handleAcknowledgment } from './acknowledgment.handler';

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
export const processPostRecommendationIntent = (
    ctx: PostRecommendationContext
): HandlerResult => {
    const intent = detectPostRecommendationIntent(
        ctx.userMessage,
        ctx.lastShownVehicles
    );

    return routePostRecommendationIntent(intent, ctx);
};
