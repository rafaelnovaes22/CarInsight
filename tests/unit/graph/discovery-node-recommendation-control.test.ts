/**
 * Property-Based Tests for Discovery Node Recommendation Control
 *
 * **Feature: conversation-state-fixes**
 *
 * Tests the recommendation transition control and "ask before showing" behavior
 * in the discovery node.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { discoveryNode } from '../../../src/graph/nodes/discovery.node';
import { createInitialState, IGraphState } from '../../../src/types/graph.types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { COMMON_BRAZILIAN_NAMES } from '../../../src/graph/langgraph/constants';
import { extractName } from '../../../src/graph/langgraph/extractors/name-extractor';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/lib/node-metrics', () => ({
  createNodeTimer: () => ({
    logSuccess: vi.fn(),
    logError: vi.fn(),
  }),
}));

// Mock Vehicle Expert
const mockChat = vi.fn();
vi.mock('../../../src/agents/vehicle-expert.agent', () => ({
  vehicleExpert: {
    chat: (...args: any[]) => mockChat(...args),
  },
}));

// ============================================================================
// Generators for property-based testing
// ============================================================================

/**
 * Generator for budget values (pure numbers)
 */
const budgetValueGenerator = fc.integer({ min: 10000, max: 500000 });

/**
 * Generator for budget suffixes
 */
const budgetSuffixGenerator = fc.constantFrom('', ' mil', ' k', ' reais', ' r$');

/**
 * Generator for usage descriptions (single-word)
 */
const usageDescriptionGenerator = fc.constantFrom(
  'trabalho',
  'família',
  'familia',
  'lazer',
  'viagem',
  'uber',
  '99',
  'app',
  'dia a dia'
);

/**
 * Generator for body type descriptions
 */
const bodyTypeGenerator = fc.constantFrom('suv', 'sedan', 'hatch', 'pickup', 'picape');

/**
 * Generator for explicit recommendation request messages
 */
const explicitRequestGenerator = fc.constantFrom(
  'mostra carros',
  'quero ver opções',
  'me indica um carro',
  'o que vocês tem',
  'tem algum suv',
  'quais opções',
  'pode mostrar',
  'sim',
  'pode',
  'quero',
  'mostra',
  'manda',
  'beleza',
  'ok',
  'claro'
);

/**
 * Generator for non-recommendation messages (information provision)
 */
const informationProvisionGenerator = fc.oneof(
  budgetValueGenerator.map(b => b.toString()),
  usageDescriptionGenerator,
  bodyTypeGenerator
);

/**
 * Creates a state with a complete profile (budget AND usage/bodyType)
 */
function createStateWithCompleteProfile(): IGraphState {
  const state = createInitialState();
  state.profile = {
    ...state.profile,
    customerName: 'João',
    budget: 100000,
    usage: 'cidade',
  };
  return state;
}

/**
 * Creates a state with partial profile (only budget)
 */
function createStateWithPartialProfile(): IGraphState {
  const state = createInitialState();
  state.profile = {
    ...state.profile,
    customerName: 'João',
    budget: 100000,
  };
  return state;
}

/**
 * Creates a state with no profile data
 */
function createStateWithEmptyProfile(): IGraphState {
  const state = createInitialState();
  state.profile = {
    ...state.profile,
    customerName: 'João',
  };
  return state;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Discovery Node Recommendation Control Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock response - agent says we can recommend
    mockChat.mockResolvedValue({
      extractedPreferences: {},
      response: 'Test response',
      canRecommend: true,
      recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
    });
  });

  // ============================================================================
  // Property 7: Recommendation Transition Only On Explicit Request
  // ============================================================================

  /**
   * **Property 7: Recommendation Transition Only On Explicit Request**
   * **Validates: Requirements 2.4**
   *
   * For any state transition to 'recommendation' from 'discovery',
   * there SHALL have been either an explicit recommendation request
   * OR an affirmative response to a "want to see options?" question.
   */
  describe('Property 7: Recommendation Transition Only On Explicit Request', () => {
    it('does NOT transition to recommendation on pure budget input (Requirement 2.4)', async () => {
      await fc.assert(
        fc.asyncProperty(budgetValueGenerator, async budget => {
          const state = createStateWithEmptyProfile();
          state.messages = [new HumanMessage(budget.toString())];

          // Mock agent response that would normally trigger recommendation
          mockChat.mockResolvedValue({
            extractedPreferences: { budget },
            response: 'Entendi seu orçamento',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: budget }],
          });

          const result = await discoveryNode(state);

          // Should NOT transition to recommendation
          expect(result.next).not.toBe('recommendation');
          expect(result.next).toBe('discovery');
        }),
        { numRuns: 100 }
      );
    });

    it('does NOT transition to recommendation on usage input (Requirement 2.4)', async () => {
      await fc.assert(
        fc.asyncProperty(usageDescriptionGenerator, async usage => {
          const state = createStateWithPartialProfile();
          state.messages = [new HumanMessage(usage)];

          // Mock agent response that would normally trigger recommendation
          mockChat.mockResolvedValue({
            extractedPreferences: { usage },
            response: 'Entendi o uso',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
          });

          const result = await discoveryNode(state);

          // Should NOT transition to recommendation
          expect(result.next).not.toBe('recommendation');
          expect(result.next).toBe('discovery');
        }),
        { numRuns: 100 }
      );
    });

    it('does NOT transition to recommendation on body type input (Requirement 2.4)', async () => {
      await fc.assert(
        fc.asyncProperty(bodyTypeGenerator, async bodyType => {
          const state = createStateWithPartialProfile();
          state.messages = [new HumanMessage(bodyType)];

          // Mock agent response that would normally trigger recommendation
          mockChat.mockResolvedValue({
            extractedPreferences: { bodyType },
            response: 'Entendi o tipo',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
          });

          const result = await discoveryNode(state);

          // Should NOT transition to recommendation
          expect(result.next).not.toBe('recommendation');
          expect(result.next).toBe('discovery');
        }),
        { numRuns: 100 }
      );
    });

    it('DOES transition to recommendation on explicit request (Requirement 2.4)', async () => {
      await fc.assert(
        fc.asyncProperty(explicitRequestGenerator, async request => {
          const state = createStateWithCompleteProfile();
          state.messages = [new HumanMessage(request)];

          // Mock agent response with recommendations
          mockChat.mockResolvedValue({
            extractedPreferences: {},
            response: 'Aqui estão as opções',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
          });

          const result = await discoveryNode(state);

          // Should transition to recommendation
          expect(result.next).toBe('recommendation');
        }),
        { numRuns: 100 }
      );
    });

    it('blocks automatic recommendation transition even when agent says canRecommend (Requirement 2.4)', async () => {
      await fc.assert(
        fc.asyncProperty(informationProvisionGenerator, async infoMessage => {
          const state = createStateWithCompleteProfile();
          state.messages = [new HumanMessage(infoMessage)];

          // Mock agent response that explicitly wants to recommend
          mockChat.mockResolvedValue({
            extractedPreferences: {},
            response: 'Vou te mostrar opções',
            canRecommend: true,
            nextMode: 'recommendation', // Agent explicitly wants to go to recommendation
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
          });

          const result = await discoveryNode(state);

          // Should NOT transition to recommendation without explicit request
          expect(result.next).not.toBe('recommendation');
          expect(result.next).toBe('discovery');
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 8: Ask Before Showing When Profile Complete
  // ============================================================================

  /**
   * **Property 8: Ask Before Showing When Profile Complete**
   * **Validates: Requirements 2.5**
   *
   * For any discovery state where budget AND (usage OR bodyType) are present
   * AND no explicit recommendation request was made, the response SHALL
   * contain a question asking if the user wants to see options.
   */
  describe('Property 8: Ask Before Showing When Profile Complete', () => {
    it('asks if user wants to see options when profile becomes complete with budget input (Requirement 2.5)', async () => {
      await fc.assert(
        fc.asyncProperty(budgetValueGenerator, async budget => {
          // State already has usage, now receiving budget
          const state = createInitialState();
          state.profile = {
            ...state.profile,
            customerName: 'João',
            usage: 'cidade',
          };
          state.messages = [new HumanMessage(budget.toString())];

          // Mock agent response that extracts budget
          mockChat.mockResolvedValue({
            extractedPreferences: { budget },
            response: 'Entendi seu orçamento',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: budget }],
          });

          const result = await discoveryNode(state);

          // Should ask if user wants to see options
          expect(result.messages).toBeDefined();
          expect(result.messages).toHaveLength(1);
          const responseContent = result.messages![0].content as string;
          // Match "quer que eu te mostre algumas opções" or similar patterns
          expect(responseContent.toLowerCase()).toMatch(/quer.*mostr.*opç/i);
        }),
        { numRuns: 100 }
      );
    });

    it('asks if user wants to see options when profile becomes complete with usage input (Requirement 2.5)', async () => {
      await fc.assert(
        fc.asyncProperty(usageDescriptionGenerator, async usage => {
          // State already has budget, now receiving usage
          const state = createInitialState();
          state.profile = {
            ...state.profile,
            customerName: 'João',
            budget: 100000,
          };
          state.messages = [new HumanMessage(usage)];

          // Mock agent response that extracts usage
          mockChat.mockResolvedValue({
            extractedPreferences: { usage },
            response: 'Entendi o uso',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
          });

          const result = await discoveryNode(state);

          // Should ask if user wants to see options
          expect(result.messages).toBeDefined();
          expect(result.messages).toHaveLength(1);
          const responseContent = result.messages![0].content as string;
          // Match "quer que eu te mostre algumas opções" or similar patterns
          expect(responseContent.toLowerCase()).toMatch(/quer.*mostr.*opç/i);
        }),
        { numRuns: 100 }
      );
    });

    it('asks if user wants to see options when profile becomes complete with bodyType input (Requirement 2.5)', async () => {
      await fc.assert(
        fc.asyncProperty(bodyTypeGenerator, async bodyType => {
          // State already has budget, now receiving bodyType
          const state = createInitialState();
          state.profile = {
            ...state.profile,
            customerName: 'João',
            budget: 100000,
          };
          state.messages = [new HumanMessage(bodyType)];

          // Mock agent response that extracts bodyType
          mockChat.mockResolvedValue({
            extractedPreferences: { bodyType },
            response: 'Entendi o tipo',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
          });

          const result = await discoveryNode(state);

          // Should ask if user wants to see options
          expect(result.messages).toBeDefined();
          expect(result.messages).toHaveLength(1);
          const responseContent = result.messages![0].content as string;
          // Match "quer que eu te mostre algumas opções" or similar patterns
          expect(responseContent.toLowerCase()).toMatch(/quer.*mostr.*opç/i);
        }),
        { numRuns: 100 }
      );
    });

    it('does NOT ask when explicit recommendation request is made (Requirement 2.5)', async () => {
      await fc.assert(
        fc.asyncProperty(explicitRequestGenerator, async request => {
          const state = createStateWithCompleteProfile();
          state.messages = [new HumanMessage(request)];

          // Mock agent response with recommendations
          mockChat.mockResolvedValue({
            extractedPreferences: {},
            response: 'Aqui estão as opções',
            canRecommend: true,
            recommendations: [{ id: '1', brand: 'Honda', model: 'Civic', price: 90000 }],
          });

          const result = await discoveryNode(state);

          // Should transition to recommendation, not ask
          expect(result.next).toBe('recommendation');
          // Response should NOT contain the "want to see options?" question
          if (result.messages && result.messages.length > 0) {
            const responseContent = result.messages[0].content as string;
            // The response should be the agent's response, not the "want to see options?" question
            expect(responseContent).toBe('Aqui estão as opções');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('does NOT ask when profile is incomplete (only budget) (Requirement 2.5)', async () => {
      await fc.assert(
        fc.asyncProperty(budgetValueGenerator, async budget => {
          // State has no usage or bodyType
          const state = createInitialState();
          state.profile = {
            ...state.profile,
            customerName: 'João',
          };
          state.messages = [new HumanMessage(budget.toString())];

          // Mock agent response that extracts budget but profile is still incomplete
          mockChat.mockResolvedValue({
            extractedPreferences: { budget },
            response: 'Entendi seu orçamento. E pra que você vai usar o carro?',
            canRecommend: false,
            recommendations: [],
          });

          const result = await discoveryNode(state);

          // Should NOT ask about options since profile is incomplete
          expect(result.messages).toBeDefined();
          const responseContent = result.messages![0].content as string;
          // Response should be the agent's follow-up question, not "want to see options?"
          expect(responseContent).not.toMatch(/quer.*mostrar.*opç/i);
        }),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Discovery Node Name Correction Property Tests
// ============================================================================

describe('Discovery Node Name Correction Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({
      extractedPreferences: {},
      response: 'Test response',
      canRecommend: false,
    });
  });

  /**
   * Names that work reliably with extractName (no edge cases with accented first chars)
   */
  const RELIABLE_NAMES = Array.from(COMMON_BRAZILIAN_NAMES).filter(name => {
    const firstChar = name.charAt(0).toLowerCase();
    return !/[àáâãäåèéêëìíîïòóôõöùúûü]/.test(firstChar);
  });

  /**
   * Generator for valid Brazilian names that work reliably with extractName
   */
  const brazilianNameGenerator = fc.constantFrom(...RELIABLE_NAMES).map(name => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  });

  /**
   * Generator for name correction patterns
   */
  const correctionPatternGenerator = fc.constantFrom(
    'é {name} na verdade',
    'na verdade é {name}',
    'não, é {name}',
    'meu nome é {name}',
    'me chama de {name}',
    'pode me chamar de {name}',
    'o nome é {name}',
    'errou, é {name}'
  );

  /**
   * Creates a state with an existing name in the profile
   */
  function createStateWithName(existingName: string): IGraphState {
    const state = createInitialState();
    state.profile = {
      ...state.profile,
      customerName: existingName,
    };
    return state;
  }

  /**
   * Creates a correction message from a pattern and name
   */
  function createCorrectionMessage(pattern: string, name: string): string {
    return pattern.replace('{name}', name);
  }

  /**
   * **Property 2 (Discovery): Profile Update After Name Correction**
   * **Validates: Requirements 1.2**
   *
   * For any detected name correction with a valid corrected name in discovery node,
   * the resulting state SHALL have profile.customerName equal to the corrected name.
   */
  describe('Property 2: Profile Update After Name Correction (Discovery)', () => {
    it('updates profile.customerName to the corrected name (Requirement 1.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          brazilianNameGenerator,
          brazilianNameGenerator,
          correctionPatternGenerator,
          async (correctedName, existingName, pattern) => {
            // Skip if names are the same (case-insensitive)
            if (correctedName.toLowerCase() === existingName.toLowerCase()) return;

            // Get what extractName would return for this name
            const expectedExtracted = extractName(correctedName);
            if (!expectedExtracted) return;

            const state = createStateWithName(existingName);
            const message = createCorrectionMessage(pattern, correctedName);
            state.messages = [new HumanMessage(message)];

            const result = await discoveryNode(state);

            // The profile should be updated with the corrected name
            expect(result.profile).toBeDefined();
            expect(result.profile?.customerName).toBeDefined();
            expect(result.profile?.customerName?.toLowerCase()).toBe(
              expectedExtracted.toLowerCase()
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 3 (Discovery): Acknowledgment Response Contains Corrected Name**
   * **Validates: Requirements 1.3**
   *
   * For any name correction that is detected and processed in discovery node,
   * the response message SHALL contain the corrected name (or its first name portion).
   */
  describe('Property 3: Acknowledgment Response Contains Corrected Name (Discovery)', () => {
    it('response contains the corrected name (Requirement 1.3)', async () => {
      await fc.assert(
        fc.asyncProperty(
          brazilianNameGenerator,
          brazilianNameGenerator,
          correctionPatternGenerator,
          async (correctedName, existingName, pattern) => {
            // Skip if names are the same
            if (correctedName.toLowerCase() === existingName.toLowerCase()) return;

            const expectedExtracted = extractName(correctedName);
            if (!expectedExtracted) return;

            const state = createStateWithName(existingName);
            const message = createCorrectionMessage(pattern, correctedName);
            state.messages = [new HumanMessage(message)];

            const result = await discoveryNode(state);

            // The response should contain the corrected name (first name portion)
            expect(result.messages).toBeDefined();
            expect(result.messages).toHaveLength(1);

            const responseContent = result.messages![0].content;
            expect(typeof responseContent).toBe('string');

            // Get the first name from the corrected name
            const firstName = expectedExtracted.split(' ')[0];
            expect((responseContent as string).toLowerCase()).toContain(firstName.toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('response includes apology phrase (Requirement 1.3)', async () => {
      await fc.assert(
        fc.asyncProperty(
          brazilianNameGenerator,
          brazilianNameGenerator,
          async (correctedName, existingName) => {
            // Skip if names are the same
            if (correctedName.toLowerCase() === existingName.toLowerCase()) return;

            const expectedExtracted = extractName(correctedName);
            if (!expectedExtracted) return;

            const state = createStateWithName(existingName);
            const message = `é ${correctedName} na verdade`;
            state.messages = [new HumanMessage(message)];

            const result = await discoveryNode(state);

            expect(result.messages).toBeDefined();
            const responseContent = result.messages![0].content as string;

            // Response should contain "Desculpa" (apology)
            expect(responseContent.toLowerCase()).toContain('desculpa');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 4 (Discovery): State Preservation After Name Correction**
   * **Validates: Requirements 1.4, 1.5**
   *
   * For any name correction detected in discovery state,
   * the `next` field in the returned state SHALL equal 'discovery'
   * (no state transition occurs).
   */
  describe('Property 4: State Preservation After Name Correction (Discovery)', () => {
    it('stays in discovery state after name correction (Requirement 1.4, 1.5)', async () => {
      await fc.assert(
        fc.asyncProperty(
          brazilianNameGenerator,
          brazilianNameGenerator,
          correctionPatternGenerator,
          async (correctedName, existingName, pattern) => {
            // Skip if names are the same
            if (correctedName.toLowerCase() === existingName.toLowerCase()) return;

            const expectedExtracted = extractName(correctedName);
            if (!expectedExtracted) return;

            const state = createStateWithName(existingName);
            const message = createCorrectionMessage(pattern, correctedName);
            state.messages = [new HumanMessage(message)];

            const result = await discoveryNode(state);

            // The next state should be 'discovery' (stay in current state)
            expect(result.next).toBe('discovery');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('does not transition to recommendation after name correction (Requirement 1.4)', async () => {
      await fc.assert(
        fc.asyncProperty(
          brazilianNameGenerator,
          brazilianNameGenerator,
          async (correctedName, existingName) => {
            // Skip if names are the same
            if (correctedName.toLowerCase() === existingName.toLowerCase()) return;

            const expectedExtracted = extractName(correctedName);
            if (!expectedExtracted) return;

            const state = createStateWithName(existingName);
            // Even with vehicle info in profile, should stay in discovery
            state.profile = {
              ...state.profile,
              model: 'Civic',
              budget: 100000,
            };

            const message = `não, é ${correctedName}`;
            state.messages = [new HumanMessage(message)];

            const result = await discoveryNode(state);

            // Should NOT transition to recommendation
            expect(result.next).not.toBe('recommendation');
            expect(result.next).toBe('discovery');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
