/**
 * Domain Plugin System — Central Contract
 *
 * Every business domain (automotive, healthcare, real-estate, etc.)
 * implements this interface to plug into the conversation platform.
 *
 * Phase 0: scaffolding only — no runtime consumers yet.
 */

import { BaseMessage } from '@langchain/core/messages';

// ─── Generic Graph State ─────────────────────────────────────────────

/**
 * Generic graph state that all domains share.
 * Domain-specific fields live in `profile` (generic Record) and `domainData`.
 */
export interface IGenericGraphState {
  messages: BaseMessage[];
  phoneNumber: string;
  profile: Record<string, unknown>;
  recommendations: GenericRecommendation[];
  next: string;
  metadata: GraphMetadata;
  domainData: Record<string, unknown>;
}

export interface GraphMetadata {
  startedAt: number;
  lastMessageAt: number;
  loopCount: number;
  lastLoopNode?: string;
  errorCount: number;
  flags: string[];
  tokenUsage?: { prompt_tokens: number; completion_tokens: number; total_tokens?: number };
  llmUsed?: string;
  currentFiber?: number;
  lastFiberValue?: number;
  fiberStagnationCount?: number;
  autoHandoffReason?: string;
}

// ─── Generic Recommendation ──────────────────────────────────────────

export interface GenericRecommendation {
  itemId: string;
  matchScore: number;
  reasoning: string;
  highlights: string[];
  concerns: string[];
  item: Record<string, unknown>;
}

// ─── Fiber Definition ────────────────────────────────────────────────

export interface FiberPhase {
  id: number;
  label: string;
  description: string;
}

export interface FiberDefinition {
  phases: FiberPhase[];
  computeFiber: (state: IGenericGraphState) => FiberResult;
  checkGuard: (state: IGenericGraphState, nextNode: string, sourceNode?: string) => string | null;
}

export interface FiberResult {
  fiber: number;
  label: string;
  completeness: number;
  missingForNext: string[];
}

// ─── Node Definition ─────────────────────────────────────────────────

export interface DomainNodeDefinition {
  name: string;
  handler: (state: IGenericGraphState) => Promise<Partial<IGenericGraphState>>;
}

// ─── Search Adapter ──────────────────────────────────────────────────

export interface ISearchAdapter {
  search(query: string, filters: Record<string, unknown>): Promise<GenericRecommendation[]>;
  getById(id: string): Promise<Record<string, unknown> | null>;
}

// ─── Disclosure Messages ─────────────────────────────────────────────

export interface DisclosureMessages {
  greeting: string;
  handoff: string;
  aiDisclaimer: string;
}

// ─── Domain Plugin Interface ─────────────────────────────────────────

/**
 * The central contract that each domain must implement.
 *
 * A domain plugin encapsulates everything needed to run a
 * complete conversational experience for a specific business vertical.
 */
export interface DomainPlugin {
  // ── Identity ──
  readonly id: string;
  readonly name: string;
  readonly version: string;

  // ── Conversation Graph ──
  readonly nodes: DomainNodeDefinition[];
  readonly entryPoint: string;
  routeResolver: (state: IGenericGraphState) => string;

  // ── Conversational Flow (fiber) ──
  readonly fiberDefinition: FiberDefinition;

  // ── Initial State ──
  createInitialProfile(): Record<string, unknown>;
  createInitialState(): Partial<IGenericGraphState>;

  // ── Prompts & Messages ──
  readonly systemPrompts: Record<string, string>;
  readonly disclosureMessages: DisclosureMessages;
  readonly exitResponse: string;
  readonly welcomeResponse: string;

  // ── Search / Inventory ──
  readonly searchAdapter: ISearchAdapter;

  // ── Lifecycle Hooks (optional) ──
  onConversationStart?(state: IGenericGraphState): Promise<void>;
  onHandoff?(state: IGenericGraphState): Promise<string>;
}
