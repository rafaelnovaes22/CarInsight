/**
 * Types for Conversational System
 * Supports natural language interaction with VehicleExpertAgent
 */

import { CustomerProfile, VehicleRecommendation, BotMessage } from './state.types';

/**
 * Conversation modes (lifecycle stages)
 */
export type ConversationMode =
  | 'discovery' // Understanding client needs (messages 1-2)
  | 'clarification' // Asking contextual questions (messages 3-6)
  | 'ready_to_recommend' // Ready to show vehicles
  | 'recommendation' // Showing vehicle recommendations
  | 'negotiation' // Discussing trade-in and financing (LEGACY)
  | 'financing' // Dedicated financing flow
  | 'trade_in' // Dedicated trade-in flow
  | 'refinement'; // Adjusting based on feedback

/**
 * Main conversation context (replaces quiz state)
 */
export interface ConversationContext {
  conversationId: string;
  phoneNumber: string;

  // Current conversation state
  mode: ConversationMode;

  // Incrementally built customer profile
  profile: Partial<CustomerProfile>;

  // Conversation history
  messages: BotMessage[];

  // Metadata
  metadata: {
    startedAt: Date;
    lastMessageAt: Date;
    messageCount: number;
    extractionCount: number;
    questionsAsked: number;
    userQuestions: number;
  };
}

/**
 * Response from VehicleExpertAgent
 */
export interface ConversationResponse {
  // Message to send to user
  response: string;

  // Preferences extracted from this interaction
  extractedPreferences: Partial<CustomerProfile>;

  // Information still needed
  needsMoreInfo: string[];

  // Can we recommend vehicles now?
  canRecommend: boolean;

  // Recommendations (if canRecommend is true)
  recommendations?: VehicleRecommendation[];

  // Suggested next mode
  nextMode?: ConversationMode;

  // Metadata
  metadata?: {
    processingTime?: number;
    confidence?: number;
    llmUsed?: string;
    noPickupsFound?: boolean; // Indicates no pickups were found for user request
    noMotosFound?: boolean; // Indicates no motorcycles were found for user request
    noSevenSeaters?: boolean; // Indicates no 7-seat vehicles were found for user request
    exactMatch?: boolean; // Indicates if response comes from exact model+year search
    alternativeYears?: boolean; // Indicates if response suggests alternative years
  };
}

/**
 * Result from PreferenceExtractor
 */
export interface ExtractionResult {
  // Extracted preferences from message
  extracted: Partial<CustomerProfile>;

  // Confidence score (0-1)
  confidence: number;

  // Brief reasoning for logging/debugging
  reasoning: string;

  // Fields that were extracted
  fieldsExtracted: string[];
}

/**
 * Configuration for preference extraction
 */
export interface ExtractionConfig {
  // Minimum confidence to accept extraction
  minConfidence?: number;

  // Current profile context
  currentProfile?: Partial<CustomerProfile>;

  // Additional context (previous messages)
  conversationHistory?: string[];
}

/**
 * Question generation options
 */
export interface QuestionGenerationOptions {
  // Current profile
  profile: Partial<CustomerProfile>;

  // Fields still missing
  missingFields: string[];

  // Prioritize certain fields
  priorityFields?: string[];

  // Conversation context
  context?: string;

  // Tone adjustment
  tone?: 'friendly' | 'professional' | 'casual';
}

/**
 * Vehicle search query built from profile
 */
export interface VehicleSearchQuery {
  // Semantic search text
  searchText: string;

  // Hard filters
  filters: {
    maxPrice?: number;
    minPrice?: number;
    minYear?: number;
    maxKm?: number;
    minSeats?: number; // Número mínimo de lugares (ex: 7)
    bodyType?: string[];
    transmission?: string[];
    fuelType?: string[];
    brand?: string[];
    model?: string[]; // Modelo específico (ex: "Compass", "Civic")
  };

  // Soft preferences (for scoring)
  preferences: {
    usage?: string;
    people?: number;
    priorities?: string[];
    dealBreakers?: string[];
  };

  // Search config
  limit?: number;
  minMatchScore?: number;
}

/**
 * Assessment of conversation readiness
 */
export interface ReadinessAssessment {
  // Can we recommend vehicles?
  canRecommend: boolean;

  // Confidence in current profile (0-100)
  confidence: number;

  // Required fields still missing
  missingRequired: string[];

  // Optional fields that would improve recommendations
  missingOptional: string[];

  // Recommendation
  action: 'continue_asking' | 'recommend_now' | 'ask_confirmation';

  // Reason for decision
  reasoning: string;
}

/**
 * Stats for monitoring conversation quality
 */
export interface ConversationStats {
  totalMessages: number;
  averageMessageLength: number;
  timeToRecommendation: number; // seconds
  extractionAccuracy: number; // 0-1
  userSatisfaction?: number; // if we collect feedback
  completionRate: number; // did they get recommendations?
}
