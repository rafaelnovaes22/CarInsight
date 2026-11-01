/**
 * E2E Tests for Handoff Flow and Lead Creation
 *
 * Tests the complete flow when a user requests to talk to a human agent
 * (vendedor, humano, atendente) which should:
 * 1. Set handoff_requested flag in metadata
 * 2. Trigger lead creation in message-handler-v2
 * 3. Notify sales team
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createInitialState } from '../../../src/types/graph.types';
import { discoveryNode } from '../../../src/graph/nodes/discovery.node';
import { negotiationNode } from '../../../src/graph/nodes/negotiation.node';
import { HumanMessage } from '@langchain/core/messages';

// Mock logger
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Vehicle Expert
const mockChat = vi.fn();
vi.mock('../../../src/agents/vehicle-expert.agent', () => ({
  vehicleExpert: {
    chat: (...args: any[]) => mockChat(...args),
  },
}));

describe('Handoff Flow E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock response
    mockChat.mockResolvedValue({
      extractedPreferences: {},
      response: 'Vou conectar você com um vendedor.',
      canRecommend: false,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Handoff Detection in Discovery Node', () => {
    it('should set handoff_requested flag when user types "vendedor"', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('vendedor')];

      const result = await discoveryNode(state);

      expect(result.metadata?.flags).toContain('handoff_requested');
    });

    it('should set handoff_requested flag when user types "quero falar com humano"', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('quero falar com um humano')];

      const result = await discoveryNode(state);

      expect(result.metadata?.flags).toContain('handoff_requested');
    });

    it('should set handoff_requested flag when user types "atendente"', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('me passa pra um atendente')];

      const result = await discoveryNode(state);

      expect(result.metadata?.flags).toContain('handoff_requested');
    });

    it('should NOT set handoff_requested flag for normal messages', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('Quero um SUV até 80 mil')];

      mockChat.mockResolvedValue({
        extractedPreferences: { bodyType: 'SUV', budget: 80000 },
        response: 'Entendi! Qual o uso principal?',
        canRecommend: false,
      });

      const result = await discoveryNode(state);

      expect(result.metadata?.flags || []).not.toContain('handoff_requested');
    });

    it('should set flag even with mixed content like "quero ver opções ou falar com vendedor"', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('quero ver opções ou falar com vendedor')];

      const result = await discoveryNode(state);

      expect(result.metadata?.flags).toContain('handoff_requested');
    });
  });

  describe('Handoff Detection in Negotiation Node', () => {
    it('should set handoff_requested flag when user types "vendedor" in negotiation', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('quero falar com vendedor agora')];

      const result = await negotiationNode(state);

      expect(result.metadata?.flags).toContain('handoff_requested');
    });

    it('should preserve existing flags when adding handoff_requested', async () => {
      const state = createInitialState();
      state.metadata.flags = ['visit_requested']; // Existing flag
      state.messages = [new HumanMessage('vendedor')];

      const result = await negotiationNode(state);

      expect(result.metadata?.flags).toContain('handoff_requested');
      expect(result.metadata?.flags).toContain('visit_requested');
    });

    it('should NOT duplicate handoff_requested if already present', async () => {
      const state = createInitialState();
      state.metadata.flags = ['handoff_requested']; // Already set
      state.messages = [new HumanMessage('vendedor por favor')];

      const result = await negotiationNode(state);

      const handoffCount = result.metadata?.flags.filter(
        (f: string) => f === 'handoff_requested'
      ).length;
      expect(handoffCount).toBe(1);
    });
  });

  describe('Handoff Trigger Variations', () => {
    // These triggers match the implementation in discovery.node.ts and negotiation.node.ts
    // which check for: 'vendedor', 'humano', 'atendente'
    const handoffTriggers = [
      'vendedor',
      'VENDEDOR',
      'Vendedor',
      'quero vendedor',
      'me passa pro vendedor',
      'falar com vendedor',
      'humano',
      'quero falar com humano',
      'atendente',
      'quero um atendente',
      'falar com atendente humano',
    ];

    it.each(handoffTriggers)('should detect handoff request for: "%s"', async message => {
      const state = createInitialState();
      state.messages = [new HumanMessage(message)];

      const result = await discoveryNode(state);

      expect(result.metadata?.flags, `Failed for message: "${message}"`).toContain(
        'handoff_requested'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message gracefully', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('')];

      const result = await discoveryNode(state);

      // Should not crash and not set handoff flag
      expect(result.metadata?.flags || []).not.toContain('handoff_requested');
    });

    it('should handle message with only spaces', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('   ')];

      const result = await discoveryNode(state);

      expect(result.metadata?.flags || []).not.toContain('handoff_requested');
    });

    it('should handle partial match like "vendedores" (should still trigger)', async () => {
      const state = createInitialState();
      state.messages = [new HumanMessage('vocês tem vendedores?')];

      const result = await discoveryNode(state);

      // "vendedores" includes "vendedor" so should trigger
      expect(result.metadata?.flags).toContain('handoff_requested');
    });
  });

  describe('Profile Preservation During Handoff', () => {
    it('should preserve profile data when handoff is requested', async () => {
      const state = createInitialState();
      state.profile = {
        budget: 80000,
        bodyType: 'SUV',
        usage: 'family',
        customerName: 'João',
      };
      state.messages = [new HumanMessage('quero falar com vendedor')];

      const result = await discoveryNode(state);

      // Profile should be preserved or merged
      expect(result.profile?.budget).toBe(80000);
      expect(result.profile?.bodyType).toBe('SUV');
      expect(result.metadata?.flags).toContain('handoff_requested');
    });
  });
});
