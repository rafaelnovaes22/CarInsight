/**
 * Post-Recommendation Handler Types
 * 
 * Types and interfaces used by post-recommendation handlers.
 */

import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';
import { ConversationContext, ConversationResponse } from '../../../types/conversation.types';

/**
 * Shown vehicle info for handler context
 */
export interface ShownVehicle {
    vehicleId: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    bodyType?: string;
}

/**
 * Context passed to post-recommendation handlers
 */
export interface PostRecommendationContext {
    userMessage: string;
    lastShownVehicles: ShownVehicle[];
    lastSearchType?: 'specific' | 'recommendation' | 'similar';
    extracted: {
        extracted: Partial<CustomerProfile>;
    };
    updatedProfile: Partial<CustomerProfile>;
    context: ConversationContext;
    startTime: number;
}

/**
 * Result returned by post-recommendation handlers
 */
export interface HandlerResult {
    handled: boolean;
    response?: ConversationResponse;
}

/**
 * Handler function signature
 */
export type PostRecommendationHandler = (
    ctx: PostRecommendationContext
) => Promise<HandlerResult> | HandlerResult;
