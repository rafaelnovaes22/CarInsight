/**
 * Conversation Fiber Decomposition
 *
 * Computes a deterministic "fiber" (phase) from the conversation state,
 * decomposing the complex 3D graph (identity × preferences × progress)
 * into ordered 2D layers.
 *
 * Each fiber represents a conversation phase with clear entry/exit criteria.
 * The fiber number is monotonically non-decreasing during a healthy conversation,
 * providing a formal guarantee of forward progress.
 *
 * Based on the quotient map: s = f(identity, preferences, engagement) → fiber
 */

import { IGraphState } from '../types/graph.types';
import { hasFlag } from './state-flags';

/**
 * Conversation fibers ordered by progression.
 * Higher number = further along in the sales funnel.
 */
export enum ConversationFiber {
  /** No identity, no preferences. First contact. */
  INITIAL_CONTACT = 0,

  /** Name collected but no vehicle preferences yet. */
  DISCOVERY = 1,

  /** Has preferences but profile incomplete for recommendation. */
  PROFILING = 2,

  /** Profile complete enough for recommendations (budget + usage/bodyType). */
  RECOMMENDATION_READY = 3,

  /** Recommendations have been shown to the user. */
  EVALUATION = 4,

  /** User engaged post-recommendation (interest, financing, trade-in). */
  ENGAGEMENT = 5,

  /** Handoff or visit requested — closing the deal. */
  CLOSING = 6,
}

export interface FiberResult {
  fiber: ConversationFiber;
  label: string;
  completeness: number; // 0.0 - 1.0
  missingForNext: string[];
}

/**
 * Dimension weights for the fiber computation.
 * Each dimension contributes independently to the overall phase.
 */
interface FiberDimensions {
  identity: number; // 0 or 1 (has name)
  preferences: number; // 0-3 (budget, usage/bodyType, model)
  engagement: number; // 0-3 (recommendations shown, interest, closing)
}

function computeDimensions(state: IGraphState): FiberDimensions {
  const profile = state.profile || {};

  // Identity dimension: does the user have a name?
  const identity = profile.customerName ? 1 : 0;

  // Preferences dimension: how much do we know about what they want?
  let preferences = 0;
  if (profile.budget || profile.budgetMax || profile.orcamento) preferences++;
  if (profile.usage || profile.usoPrincipal || profile.bodyType) preferences++;
  if (profile.model || profile.brand) preferences++;

  // Engagement dimension: how far along in the funnel?
  let engagement = 0;
  if (
    profile._showedRecommendation ||
    state.recommendations.length > 0 ||
    profile._lastShownVehicles?.length
  ) {
    engagement++;
  }
  if (
    profile.wantsFinancing ||
    profile.hasTradeIn ||
    profile._awaitingFinancingDetails ||
    profile._awaitingTradeInDetails
  ) {
    engagement++;
  }
  if (
    hasFlag(state.metadata.flags, 'handoff_requested') ||
    hasFlag(state.metadata.flags, 'visit_requested')
  ) {
    engagement++;
  }

  return { identity, preferences, engagement };
}

/**
 * Computes the current conversation fiber from state.
 *
 * The mapping uses the quotient map principle:
 *   raw_score = identity + preferences + engagement  (range: 0-7)
 *   fiber = floor(raw_score * 6 / 7)                 (range: 0-6)
 *
 * But we apply semantic rules for accuracy over pure arithmetic.
 */
export function computeFiber(state: IGraphState): FiberResult {
  const dims = computeDimensions(state);
  const profile = state.profile || {};

  // Semantic fiber assignment (more accurate than pure arithmetic)
  let fiber: ConversationFiber;
  const missingForNext: string[] = [];

  if (dims.engagement >= 3) {
    fiber = ConversationFiber.CLOSING;
  } else if (dims.engagement >= 2) {
    fiber = ConversationFiber.ENGAGEMENT;
    if (
      !hasFlag(state.metadata.flags, 'handoff_requested') &&
      !hasFlag(state.metadata.flags, 'visit_requested')
    ) {
      missingForNext.push('decisão de compra ou agendamento');
    }
  } else if (dims.engagement >= 1) {
    fiber = ConversationFiber.EVALUATION;
    if (!profile.wantsFinancing && !profile.hasTradeIn) {
      missingForNext.push('interesse em financiamento ou troca');
    }
  } else if (dims.identity >= 1 && dims.preferences >= 2) {
    fiber = ConversationFiber.RECOMMENDATION_READY;
    missingForNext.push('busca e exibição de veículos');
  } else if (dims.identity >= 1 && dims.preferences >= 1) {
    fiber = ConversationFiber.PROFILING;
    if (!profile.budget && !profile.budgetMax) missingForNext.push('orçamento');
    if (!profile.usage && !profile.usoPrincipal && !profile.bodyType) {
      missingForNext.push('uso ou tipo de veículo');
    }
  } else if (dims.identity >= 1) {
    fiber = ConversationFiber.DISCOVERY;
    missingForNext.push('orçamento', 'uso ou tipo de veículo');
  } else {
    fiber = ConversationFiber.INITIAL_CONTACT;
    missingForNext.push('nome do cliente');
  }

  const labels: Record<ConversationFiber, string> = {
    [ConversationFiber.INITIAL_CONTACT]: 'Contato Inicial',
    [ConversationFiber.DISCOVERY]: 'Descoberta',
    [ConversationFiber.PROFILING]: 'Perfilamento',
    [ConversationFiber.RECOMMENDATION_READY]: 'Pronto para Recomendar',
    [ConversationFiber.EVALUATION]: 'Avaliação',
    [ConversationFiber.ENGAGEMENT]: 'Engajamento',
    [ConversationFiber.CLOSING]: 'Fechamento',
  };

  // Completeness = how far through the total funnel (0.0 to 1.0)
  const maxFiber = ConversationFiber.CLOSING;
  const completeness = Math.round((fiber / maxFiber) * 100) / 100;

  return {
    fiber,
    label: labels[fiber],
    completeness,
    missingForNext,
  };
}

/**
 * Checks if a transition would cause a regression (going backward in the funnel).
 * Returns true if the new state's fiber is LOWER than the current one.
 *
 * This can be used as a guardrail to prevent unintentional regressions.
 */
export function isRegression(currentState: IGraphState, nextState: IGraphState): boolean {
  const currentFiber = computeFiber(currentState).fiber;
  const nextFiber = computeFiber(nextState).fiber;
  return nextFiber < currentFiber;
}

/**
 * Returns the suggested next node based on the current fiber.
 * This provides a deterministic mapping from fiber → expected node.
 */
export function suggestedNodeForFiber(fiber: ConversationFiber): string {
  const mapping: Record<ConversationFiber, string> = {
    [ConversationFiber.INITIAL_CONTACT]: 'greeting',
    [ConversationFiber.DISCOVERY]: 'discovery',
    [ConversationFiber.PROFILING]: 'discovery',
    [ConversationFiber.RECOMMENDATION_READY]: 'search',
    [ConversationFiber.EVALUATION]: 'recommendation',
    [ConversationFiber.ENGAGEMENT]: 'negotiation',
    [ConversationFiber.CLOSING]: 'end',
  };
  return mapping[fiber];
}

/**
 * Maps a graph node name to its minimum fiber level.
 * Inverse of suggestedNodeForFiber — used by the fiber guard
 * to determine if a proposed transition would regress.
 */
export function fiberForNode(nodeName: string): ConversationFiber {
  const mapping: Record<string, ConversationFiber> = {
    greeting: ConversationFiber.INITIAL_CONTACT,
    discovery: ConversationFiber.DISCOVERY,
    search: ConversationFiber.RECOMMENDATION_READY,
    recommendation: ConversationFiber.EVALUATION,
    financing: ConversationFiber.ENGAGEMENT,
    trade_in: ConversationFiber.ENGAGEMENT,
    negotiation: ConversationFiber.ENGAGEMENT,
    end: ConversationFiber.CLOSING,
  };
  return mapping[nodeName] ?? ConversationFiber.INITIAL_CONTACT;
}

/**
 * Allowed fiber regressions — specific transitions where going backward
 * is a legitimate user intent (e.g., "quero ver outros carros" after recommendation).
 *
 * Format: [fromNode, toNode] — the transition is allowed even if it regresses fiber.
 */
const ALLOWED_REGRESSIONS: ReadonlyArray<[string, string]> = [
  // From recommendation/negotiation back to discovery for new search
  ['recommendation', 'discovery'],
  ['negotiation', 'discovery'],
  // From recommendation back to search for refined criteria
  ['recommendation', 'search'],
  // From financing/trade_in back to recommendation to see other vehicles
  ['financing', 'recommendation'],
  ['trade_in', 'recommendation'],
];

const ALLOWED_POST_VISIT_TARGETS = new Set([
  'discovery',
  'search',
  'recommendation',
  'negotiation',
  'financing',
  'trade_in',
]);

/**
 * Checks if a proposed node transition would regress the conversation fiber,
 * considering the current state and allowed exceptions.
 *
 * Returns the corrected node name if regression is blocked, or null if the
 * transition is allowed (either no regression, or it's in the allowlist).
 */
export function checkFiberGuard(
  state: IGraphState,
  targetNode: string,
  sourceNode?: string
): string | null {
  const currentFiber = computeFiber(state).fiber;
  const targetFiber = fiberForNode(targetNode);
  const hasVisitRequested = hasFlag(state.metadata.flags, 'visit_requested');
  const hasHandoffRequested = hasFlag(state.metadata.flags, 'handoff_requested');

  // No regression — transition is fine
  if (targetFiber >= currentFiber) {
    return null;
  }

  if (
    currentFiber === ConversationFiber.CLOSING &&
    hasVisitRequested &&
    !hasHandoffRequested &&
    ALLOWED_POST_VISIT_TARGETS.has(targetNode)
  ) {
    return null;
  }

  // Check if this specific regression is allowed
  if (sourceNode) {
    const isAllowed = ALLOWED_REGRESSIONS.some(
      ([from, to]) => from === sourceNode && to === targetNode
    );
    if (isAllowed) {
      return null;
    }
  }

  // Regression blocked — return the suggested node for the current fiber
  return suggestedNodeForFiber(currentFiber);
}
