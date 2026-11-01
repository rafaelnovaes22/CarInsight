/**
 * Fallback Types and Interfaces
 *
 * Type definitions for the vehicle fallback recommendations feature.
 * These types support the intelligent fallback system that provides
 * alternative vehicle recommendations when exact matches are unavailable.
 *
 * **Feature: vehicle-fallback-recommendations**
 * Requirements: 2.6, 5.2, 5.3
 */

import { Vehicle } from './exact-search.service';

/**
 * Configuration for the fallback service
 */
export interface FallbackConfig {
  /** Maximum number of alternatives to return (default: 5) */
  maxResults: number;
  /** Price range tolerance as percentage (default: 20) */
  priceTolerancePercent: number;
  /** Maximum year difference to consider (default: 5) */
  maxYearDistance: number;
}

/**
 * Type discriminator for fallback strategies
 */
export type FallbackType =
  | 'year_alternative'
  | 'same_brand'
  | 'same_category'
  | 'price_range'
  | 'no_results';

/**
 * Criteria types for matching vehicles
 */
export type CriterionType = 'year' | 'brand' | 'category' | 'price' | 'transmission' | 'fuel';

/**
 * Represents a single matching criterion with details
 */
export interface MatchingCriterion {
  /** The type of criterion being evaluated */
  criterion: CriterionType;
  /** Whether this criterion matched */
  matched: boolean;
  /** Human-readable details about the match */
  details: string;
}

/**
 * A vehicle match with similarity scoring and reasoning
 */
export interface FallbackVehicleMatch {
  /** The matched vehicle */
  vehicle: Vehicle;
  /** Similarity score (0-100) */
  similarityScore: number;
  /** List of criteria that were evaluated */
  matchingCriteria: MatchingCriterion[];
  /** Human-readable explanation of why this vehicle is relevant */
  reasoning: string;
}

/**
 * Metadata about the fallback operation
 */
export interface FallbackMetadata {
  /** The fallback strategy that was used */
  strategyUsed: FallbackType;
  /** Total number of candidate vehicles evaluated */
  totalCandidates: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Complete result from a fallback search operation
 */
export interface FallbackResult {
  /** The type of fallback that was applied */
  type: FallbackType;
  /** List of alternative vehicles found */
  vehicles: FallbackVehicleMatch[];
  /** User-facing message explaining the result */
  message: string;
  /** The model that was originally requested */
  requestedModel: string;
  /** The year that was originally requested (null if not specified) */
  requestedYear: number | null;
  /** Available years for the requested model (for year_alternative type) */
  availableYears?: number[];
  /** Metadata about the fallback operation */
  metadata: FallbackMetadata;
}

/**
 * Criteria used for calculating vehicle similarity
 */
export interface SimilarityCriteria {
  /** Target vehicle category (sedan, suv, hatch, pickup) */
  targetCategory: string;
  /** Target brand (optional) */
  targetBrand?: string;
  /** Target price for comparison */
  targetPrice: number;
  /** Target year (optional) */
  targetYear?: number;
  /** Target transmission type (optional) */
  targetTransmission?: string;
  /** Target fuel type (optional) */
  targetFuel?: string;
}

/**
 * Weights for similarity score calculation
 */
export interface SimilarityWeights {
  /** Weight for category match (default: 40) */
  category: number;
  /** Weight for brand match (default: 25) */
  brand: number;
  /** Weight for price proximity (default: 20) */
  price: number;
  /** Weight for feature matches like transmission/fuel (default: 15) */
  features: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  maxResults: 5,
  priceTolerancePercent: 20,
  maxYearDistance: 5,
};

/**
 * Default similarity weights
 */
export const DEFAULT_SIMILARITY_WEIGHTS: SimilarityWeights = {
  category: 40,
  brand: 25,
  price: 20,
  features: 15,
};

/**
 * Fallback priority configuration
 */
export interface FallbackPriority {
  /** Priority order (lower = higher priority) */
  order: number;
  /** The fallback type */
  type: FallbackType;
  /** Minimum score required to include results */
  minScore: number;
  /** Maximum results for this strategy */
  maxResults: number;
}

/**
 * Default fallback priorities in order of preference
 */
export const FALLBACK_PRIORITIES: FallbackPriority[] = [
  { order: 1, type: 'year_alternative', minScore: 70, maxResults: 5 },
  { order: 2, type: 'same_brand', minScore: 60, maxResults: 5 },
  { order: 3, type: 'same_category', minScore: 50, maxResults: 5 },
  { order: 4, type: 'price_range', minScore: 40, maxResults: 5 },
];

/**
 * Formatted response for WhatsApp display
 */
export interface FormattedFallbackResponse {
  /** Acknowledgment that the exact vehicle is unavailable */
  acknowledgment: string;
  /** List of formatted alternatives */
  alternatives: FormattedAlternative[];
  /** Summary message */
  summary: string;
}

/**
 * A single formatted alternative for display
 */
export interface FormattedAlternative {
  /** Description of the vehicle */
  vehicleDescription: string;
  /** Explanation of why this vehicle is relevant */
  relevanceExplanation: string;
  /** Key highlights (max 3) */
  highlights: string[];
}

/**
 * Error information for fallback operations
 */
export interface FallbackError {
  /** The strategy that failed */
  strategy: FallbackType;
  /** Error message */
  error: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
}
