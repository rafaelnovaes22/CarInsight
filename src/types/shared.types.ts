/**
 * Shared Types for FaciliAuto
 * 
 * This file contains common type definitions used across the codebase
 * to replace `any` types with proper typing.
 */

import { Vehicle as PrismaVehicle } from '@prisma/client';

// Re-export PrismaVehicle for convenience
export type { PrismaVehicle };

/**
 * Generic record type for user answers/preferences
 */
export interface UserAnswers {
    usage?: string;
    bodyType?: string;
    preferredModel?: string;
    freeText?: string;
    budget?: number;
    minYear?: number;
    maxKm?: number;
    usageContext?: string;
    people?: number;
    hasTradeIn?: boolean;
    [key: string]: unknown; // Allow additional dynamic properties
}

/**
 * LLM Suggestion from parsed JSON response
 */
export interface LLMSuggestion {
    vehicleId: string;
    score: number;
    reasoning: string;
}

/**
 * LLM Evaluation response
 */
export interface LLMEvaluation {
    vehicleId: string;
    score: number;
    reasoning: string;
    isAdequate: boolean;
}

/**
 * Generic metadata object
 */
export type Metadata = Record<string, unknown>;

/**
 * Handler result pattern used across handlers
 */
export interface HandlerResult<T = unknown> {
    handled: boolean;
    response?: T;
    continueProcessing?: boolean;
}

/**
 * Shown vehicle info stored in profile
 */
export interface ShownVehicleInfo {
    vehicleId: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    bodyType?: string;
}
