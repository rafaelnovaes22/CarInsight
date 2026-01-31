/**
 * Property-Based Tests for Greeting Node Name Correction
 *
 * **Feature: conversation-state-fixes**
 *
 * Tests the name correction handling in the greeting node.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { greetingNode } from '../../../src/graph/nodes/greeting.node';
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

// Mock exact search parser
vi.mock('../../../src/services/exact-search-parser.service', () => ({
  exactSearchParser: {
    parse: vi.fn().mockResolvedValue({}),
    isTradeInContext: vi.fn().mockReturnValue(false),
  },
}));

// ============================================================================
// Generators for property-based testing
// ============================================================================

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

// ============================================================================
// Property Tests
// ============================================================================

describe('Greeting Node Name Correction Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChat.mockResolvedValue({
      extractedPreferences: {},
      response: 'Test response',
      canRecommend: false,
    });
  });

  /**
   * **Property 2: Profile Update After Name Correction**
   * **Validates: Requirements 1.2**
   *
   * For any detected name correction with a valid corrected name,
   * the resulting state SHALL have profile.customerName equal to the corrected name.
   */
  describe('Property 2: Profile Update After Name Correction', () => {
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

            const result = await greetingNode(state);

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

    it('preserves other profile fields when updating name (Requirement 1.2)', async () => {
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
            // Add some extra profile data
            state.profile = {
              ...state.profile,
              budget: 100000,
              bodyType: 'suv',
              usage: 'cidade',
            };

            const message = `é ${correctedName} na verdade`;
            state.messages = [new HumanMessage(message)];

            const result = await greetingNode(state);

            // Other profile fields should be preserved
            expect(result.profile?.budget).toBe(100000);
            expect(result.profile?.bodyType).toBe('suv');
            expect(result.profile?.usage).toBe('cidade');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 3: Acknowledgment Response Contains Corrected Name**
   * **Validates: Requirements 1.3**
   *
   * For any name correction that is detected and processed,
   * the response message SHALL contain the corrected name (or its first name portion).
   */
  describe('Property 3: Acknowledgment Response Contains Corrected Name', () => {
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

            const result = await greetingNode(state);

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

    it('response includes apology/acknowledgment phrase (Requirement 1.3)', async () => {
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

            const result = await greetingNode(state);

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
   * **Property 4: State Preservation After Name Correction**
   * **Validates: Requirements 1.4, 1.5**
   *
   * For any name correction detected in any conversation state,
   * the `next` field in the returned state SHALL equal the current state
   * (no state transition occurs).
   */
  describe('Property 4: State Preservation After Name Correction', () => {
    it('stays in greeting state after name correction (Requirement 1.4, 1.5)', async () => {
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

            const result = await greetingNode(state);

            // The next state should be 'greeting' (stay in current state)
            expect(result.next).toBe('greeting');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('does not transition to discovery after name correction (Requirement 1.4)', async () => {
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
            const message = `meu nome é ${correctedName}`;
            state.messages = [new HumanMessage(message)];

            const result = await greetingNode(state);

            // Should NOT transition to discovery
            expect(result.next).not.toBe('discovery');
            expect(result.next).not.toBe('recommendation');
            expect(result.next).toBe('greeting');
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
            // Even with vehicle info in profile, should stay in greeting
            state.profile = {
              ...state.profile,
              model: 'Civic',
              budget: 100000,
            };

            const message = `não, é ${correctedName}`;
            state.messages = [new HumanMessage(message)];

            const result = await greetingNode(state);

            // Should NOT transition to recommendation
            expect(result.next).not.toBe('recommendation');
            expect(result.next).toBe('greeting');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
