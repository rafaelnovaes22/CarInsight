import { describe, it, expect } from 'vitest';
import {
  computeFiber,
  ConversationFiber,
  isRegression,
  suggestedNodeForFiber,
  fiberForNode,
  checkFiberGuard,
} from '../../../src/utils/conversation-fiber';
import { createInitialState, IGraphState } from '../../../src/types/graph.types';

function stateWith(overrides: {
  profile?: Partial<IGraphState['profile']>;
  recommendations?: any[];
  flags?: string[];
}): IGraphState {
  const state = createInitialState();
  if (overrides.profile) state.profile = overrides.profile;
  if (overrides.recommendations) state.recommendations = overrides.recommendations;
  if (overrides.flags) state.metadata.flags = overrides.flags;
  return state;
}

describe('conversation-fiber', () => {
  describe('computeFiber', () => {
    it('should return INITIAL_CONTACT for empty state', () => {
      const state = createInitialState();
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.INITIAL_CONTACT);
      expect(result.label).toBe('Contato Inicial');
      expect(result.completeness).toBe(0);
      expect(result.missingForNext).toContain('nome do cliente');
    });

    it('should return DISCOVERY when only name is provided', () => {
      const state = stateWith({ profile: { customerName: 'João' } });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.DISCOVERY);
      expect(result.missingForNext).toContain('orçamento');
    });

    it('should return PROFILING when name + partial preferences', () => {
      const state = stateWith({
        profile: { customerName: 'Maria', budget: 80000 },
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.PROFILING);
      expect(result.missingForNext).toContain('uso ou tipo de veículo');
    });

    it('should return RECOMMENDATION_READY when name + budget + usage', () => {
      const state = stateWith({
        profile: { customerName: 'Carlos', budget: 80000, usage: 'cidade' },
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.RECOMMENDATION_READY);
      expect(result.completeness).toBe(0.5);
    });

    it('should return RECOMMENDATION_READY with bodyType instead of usage', () => {
      const state = stateWith({
        profile: { customerName: 'Ana', budget: 60000, bodyType: 'suv' },
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.RECOMMENDATION_READY);
    });

    it('should return EVALUATION when recommendations were shown', () => {
      const state = stateWith({
        profile: { customerName: 'Pedro', budget: 90000, bodyType: 'sedan' },
        recommendations: [{ vehicleId: 'v1', vehicle: {} }],
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.EVALUATION);
    });

    it('should return EVALUATION with _showedRecommendation flag', () => {
      const state = stateWith({
        profile: {
          customerName: 'Lucas',
          budget: 70000,
          usage: 'trabalho',
          _showedRecommendation: true,
        },
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.EVALUATION);
    });

    it('should return ENGAGEMENT when financing or trade-in is active', () => {
      const state = stateWith({
        profile: {
          customerName: 'Julia',
          budget: 100000,
          bodyType: 'suv',
          _showedRecommendation: true,
          wantsFinancing: true,
        },
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.ENGAGEMENT);
    });

    it('should return CLOSING when handoff is requested', () => {
      const state = stateWith({
        profile: {
          customerName: 'Roberto',
          budget: 120000,
          bodyType: 'pickup',
          _showedRecommendation: true,
          wantsFinancing: true,
        },
        flags: ['handoff_requested'],
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.CLOSING);
      expect(result.completeness).toBe(1);
    });

    it('should return CLOSING when visit is requested', () => {
      const state = stateWith({
        profile: {
          customerName: 'Fernanda',
          budget: 80000,
          usage: 'misto',
          _showedRecommendation: true,
          hasTradeIn: true,
        },
        flags: ['visit_requested'],
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.CLOSING);
    });

    it('should handle budgetMax as budget alternative', () => {
      const state = stateWith({
        profile: { customerName: 'Teste', budgetMax: 50000, bodyType: 'hatch' },
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.RECOMMENDATION_READY);
    });

    it('should handle orcamento as budget alternative', () => {
      const state = stateWith({
        profile: { customerName: 'Teste', orcamento: 50000, usage: 'diario' },
      });
      const result = computeFiber(state);

      expect(result.fiber).toBe(ConversationFiber.RECOMMENDATION_READY);
    });

    it('should count model/brand as preference dimension', () => {
      const state = stateWith({
        profile: { customerName: 'Teste', model: 'Corolla', budget: 90000 },
      });
      const result = computeFiber(state);

      // name(1) + budget(1) + model(1) = 3 preferences → RECOMMENDATION_READY
      expect(result.fiber).toBe(ConversationFiber.RECOMMENDATION_READY);
    });
  });

  describe('isRegression', () => {
    it('should detect regression from EVALUATION to DISCOVERY', () => {
      const current = stateWith({
        profile: { customerName: 'A', budget: 80000, bodyType: 'suv' },
        recommendations: [{ vehicleId: 'v1', vehicle: {} }],
      });
      const next = stateWith({
        profile: { customerName: 'A' },
      });

      expect(isRegression(current, next)).toBe(true);
    });

    it('should NOT detect regression on forward progress', () => {
      const current = stateWith({
        profile: { customerName: 'A' },
      });
      const next = stateWith({
        profile: { customerName: 'A', budget: 80000, bodyType: 'suv' },
      });

      expect(isRegression(current, next)).toBe(false);
    });

    it('should NOT detect regression on same fiber', () => {
      const current = stateWith({
        profile: { customerName: 'A', budget: 80000 },
      });
      const next = stateWith({
        profile: { customerName: 'A', budget: 90000 },
      });

      expect(isRegression(current, next)).toBe(false);
    });
  });

  describe('suggestedNodeForFiber', () => {
    it('should map INITIAL_CONTACT to greeting', () => {
      expect(suggestedNodeForFiber(ConversationFiber.INITIAL_CONTACT)).toBe('greeting');
    });

    it('should map DISCOVERY to discovery', () => {
      expect(suggestedNodeForFiber(ConversationFiber.DISCOVERY)).toBe('discovery');
    });

    it('should map RECOMMENDATION_READY to search', () => {
      expect(suggestedNodeForFiber(ConversationFiber.RECOMMENDATION_READY)).toBe('search');
    });

    it('should map EVALUATION to recommendation', () => {
      expect(suggestedNodeForFiber(ConversationFiber.EVALUATION)).toBe('recommendation');
    });

    it('should map ENGAGEMENT to negotiation', () => {
      expect(suggestedNodeForFiber(ConversationFiber.ENGAGEMENT)).toBe('negotiation');
    });

    it('should map CLOSING to end', () => {
      expect(suggestedNodeForFiber(ConversationFiber.CLOSING)).toBe('end');
    });
  });

  describe('fiberForNode', () => {
    it('should map greeting to INITIAL_CONTACT', () => {
      expect(fiberForNode('greeting')).toBe(ConversationFiber.INITIAL_CONTACT);
    });

    it('should map discovery to DISCOVERY', () => {
      expect(fiberForNode('discovery')).toBe(ConversationFiber.DISCOVERY);
    });

    it('should map search to RECOMMENDATION_READY', () => {
      expect(fiberForNode('search')).toBe(ConversationFiber.RECOMMENDATION_READY);
    });

    it('should map recommendation to EVALUATION', () => {
      expect(fiberForNode('recommendation')).toBe(ConversationFiber.EVALUATION);
    });

    it('should map financing to ENGAGEMENT', () => {
      expect(fiberForNode('financing')).toBe(ConversationFiber.ENGAGEMENT);
    });

    it('should map trade_in to ENGAGEMENT', () => {
      expect(fiberForNode('trade_in')).toBe(ConversationFiber.ENGAGEMENT);
    });

    it('should map negotiation to ENGAGEMENT', () => {
      expect(fiberForNode('negotiation')).toBe(ConversationFiber.ENGAGEMENT);
    });

    it('should map end to CLOSING', () => {
      expect(fiberForNode('end')).toBe(ConversationFiber.CLOSING);
    });

    it('should default to INITIAL_CONTACT for unknown nodes', () => {
      expect(fiberForNode('unknown_node')).toBe(ConversationFiber.INITIAL_CONTACT);
    });
  });

  describe('checkFiberGuard', () => {
    it('should allow forward transitions', () => {
      // State at DISCOVERY (has name), target = search (RECOMMENDATION_READY)
      const state = stateWith({ profile: { customerName: 'João' } });
      expect(checkFiberGuard(state, 'search')).toBeNull();
    });

    it('should allow same-fiber transitions', () => {
      // State at DISCOVERY, target = discovery
      const state = stateWith({ profile: { customerName: 'João' } });
      expect(checkFiberGuard(state, 'discovery')).toBeNull();
    });

    it('should block regression from EVALUATION to greeting', () => {
      const state = stateWith({
        profile: {
          customerName: 'João',
          budget: 80000,
          bodyType: 'suv',
          _showedRecommendation: true,
        },
      });
      // Fiber is EVALUATION (4), greeting is INITIAL_CONTACT (0)
      const corrected = checkFiberGuard(state, 'greeting');
      expect(corrected).toBe('recommendation'); // suggestedNodeForFiber(EVALUATION)
    });

    it('should block regression from ENGAGEMENT to greeting', () => {
      const state = stateWith({
        profile: {
          customerName: 'João',
          budget: 80000,
          bodyType: 'suv',
          _showedRecommendation: true,
          wantsFinancing: true,
        },
      });
      const corrected = checkFiberGuard(state, 'greeting');
      expect(corrected).toBe('negotiation'); // suggestedNodeForFiber(ENGAGEMENT)
    });

    it('should allow regression from recommendation to discovery (allowlisted)', () => {
      const state = stateWith({
        profile: {
          customerName: 'João',
          budget: 80000,
          bodyType: 'suv',
          _showedRecommendation: true,
        },
      });
      // recommendation → discovery is in ALLOWED_REGRESSIONS
      const corrected = checkFiberGuard(state, 'discovery', 'recommendation');
      expect(corrected).toBeNull();
    });

    it('should allow regression from negotiation to discovery (allowlisted)', () => {
      const state = stateWith({
        profile: {
          customerName: 'João',
          budget: 80000,
          bodyType: 'suv',
          _showedRecommendation: true,
          wantsFinancing: true,
        },
      });
      const corrected = checkFiberGuard(state, 'discovery', 'negotiation');
      expect(corrected).toBeNull();
    });

    it('should allow regression from recommendation to search (allowlisted)', () => {
      const state = stateWith({
        profile: {
          customerName: 'João',
          budget: 80000,
          bodyType: 'suv',
          _showedRecommendation: true,
        },
      });
      const corrected = checkFiberGuard(state, 'search', 'recommendation');
      expect(corrected).toBeNull();
    });

    it('should allow regression from financing to recommendation (allowlisted)', () => {
      const state = stateWith({
        profile: {
          customerName: 'João',
          budget: 80000,
          bodyType: 'suv',
          _showedRecommendation: true,
          wantsFinancing: true,
        },
      });
      const corrected = checkFiberGuard(state, 'recommendation', 'financing');
      expect(corrected).toBeNull();
    });

    it('should allow financing after visit_requested without forcing the conversation to end', () => {
      const state = stateWith({
        profile: {
          customerName: 'Rafael',
          budget: 150000,
          usage: 'familia',
          _showedRecommendation: true,
          wantsFinancing: true,
        },
        flags: ['visit_requested'],
      });

      const corrected = checkFiberGuard(state, 'financing', 'negotiation');
      expect(corrected).toBeNull();
    });

    it('should block non-allowlisted regression even with sourceNode', () => {
      const state = stateWith({
        profile: {
          customerName: 'João',
          budget: 80000,
          bodyType: 'suv',
          _showedRecommendation: true,
          wantsFinancing: true,
        },
      });
      // financing → greeting is NOT in the allowlist
      const corrected = checkFiberGuard(state, 'greeting', 'financing');
      expect(corrected).toBe('negotiation');
    });
  });

  describe('fiber progression (monotonicity guarantee)', () => {
    it('should progress monotonically through the full funnel', () => {
      const fibers: ConversationFiber[] = [];

      // Step 1: Initial contact
      fibers.push(computeFiber(createInitialState()).fiber);

      // Step 2: Name provided
      fibers.push(computeFiber(stateWith({ profile: { customerName: 'João' } })).fiber);

      // Step 3: Budget added
      fibers.push(
        computeFiber(stateWith({ profile: { customerName: 'João', budget: 80000 } })).fiber
      );

      // Step 4: Usage added → ready
      fibers.push(
        computeFiber(
          stateWith({ profile: { customerName: 'João', budget: 80000, usage: 'cidade' } })
        ).fiber
      );

      // Step 5: Recommendations shown
      fibers.push(
        computeFiber(
          stateWith({
            profile: {
              customerName: 'João',
              budget: 80000,
              usage: 'cidade',
              _showedRecommendation: true,
            },
          })
        ).fiber
      );

      // Step 6: Financing interest
      fibers.push(
        computeFiber(
          stateWith({
            profile: {
              customerName: 'João',
              budget: 80000,
              usage: 'cidade',
              _showedRecommendation: true,
              wantsFinancing: true,
            },
          })
        ).fiber
      );

      // Step 7: Handoff → closing
      fibers.push(
        computeFiber(
          stateWith({
            profile: {
              customerName: 'João',
              budget: 80000,
              usage: 'cidade',
              _showedRecommendation: true,
              wantsFinancing: true,
            },
            flags: ['handoff_requested'],
          })
        ).fiber
      );

      // Verify monotonic progression: each fiber >= previous
      for (let i = 1; i < fibers.length; i++) {
        expect(fibers[i]).toBeGreaterThanOrEqual(fibers[i - 1]);
      }

      // Verify we covered the full range
      expect(fibers[0]).toBe(ConversationFiber.INITIAL_CONTACT);
      expect(fibers[fibers.length - 1]).toBe(ConversationFiber.CLOSING);
    });
  });
});
