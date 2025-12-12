/**
 * LangGraph Types
 *
 * Type definitions for the conversation graph.
 */

import { CustomerProfile, VehicleRecommendation } from '../../types/state.types';

/**
 * Graph states for conversation flow
 */
export type GraphState =
  | 'START'
  | 'GREETING' // Welcome and name collection
  | 'DISCOVERY' // Initial discovery: what the client is looking for
  | 'CLARIFICATION' // Questions to refine profile
  | 'SEARCH' // Vehicle search (internal transition)
  | 'RECOMMENDATION' // Presenting recommendations
  | 'NEGOTIATION' // Negotiation (trade-in, financing)
  | 'FOLLOW_UP' // Post-recommendation follow-up
  | 'HANDOFF' // Transfer to salesperson
  | 'END';

/**
 * State transition result
 */
export interface StateTransition {
  nextState: GraphState;
  response: string;
  profile: Partial<CustomerProfile>;
  recommendations?: VehicleRecommendation[];
  metadata?: Record<string, any>;
}

/**
 * Transition conditions between states
 */
export interface TransitionConditions {
  hasName: boolean;
  hasContext: boolean; // Knows what the client is looking for
  hasMinimalProfile: boolean; // budget + usage + people
  hasCompleteProfile: boolean;
  hasRecommendations: boolean;
  wantsHandoff: boolean;
  wantsRestart: boolean;
}

/**
 * Valid graph states list
 */
export const VALID_GRAPH_STATES: GraphState[] = [
  'START',
  'GREETING',
  'DISCOVERY',
  'CLARIFICATION',
  'SEARCH',
  'RECOMMENDATION',
  'NEGOTIATION',
  'FOLLOW_UP',
  'HANDOFF',
  'END',
];

/**
 * Check if a string is a valid graph state
 */
export function isValidGraphState(state: string): state is GraphState {
  return VALID_GRAPH_STATES.includes(state as GraphState);
}
