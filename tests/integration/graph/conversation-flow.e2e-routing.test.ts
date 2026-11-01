import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LangGraphConversation } from '../../../src/graph/langgraph-conversation';
import { ConversationState } from '../../../src/types/state.types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// We mock the workflow to simulate a multi-turn graph execution without hitting persistence.
const mockInvoke = vi.fn();
vi.mock('../../../src/graph/workflow', () => ({
  createConversationGraph: () => ({
    invoke: mockInvoke,
  }),
}));

function createBaseState(): ConversationState {
  return {
    conversationId: 'conv-1',
    phoneNumber: '5511999999999',
    messages: [],
    profile: {},
    quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
    recommendations: [],
    graph: { currentNode: 'greeting', nodeHistory: [], errorCount: 0, loopCount: 0 },
    metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: [] },
  };
}

describe('Conversation flow (routing) - greeting -> recommendation -> negotiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advances graph currentNode across turns based on graph next', async () => {
    const langGraph = new LangGraphConversation();

    // Turn 1: greeting response
    mockInvoke.mockResolvedValueOnce({
      messages: [new HumanMessage('Oi'), new AIMessage('Olá! Qual seu nome?')],
      next: 'greeting',
      profile: {},
      recommendations: [],
      metadata: {
        startedAt: Date.now(),
        lastMessageAt: Date.now(),
        flags: [],
        loopCount: 0,
        errorCount: 0,
      },
      quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
      phoneNumber: '5511999999999',
    });

    const state0 = createBaseState();
    const turn1 = await langGraph.processMessage('Oi', state0);
    expect(turn1.response).toContain('Qual seu nome');
    expect(turn1.newState.graph.currentNode).toBe('greeting');

    // Turn 2: graph jumps to recommendation
    mockInvoke.mockResolvedValueOnce({
      messages: [new HumanMessage('Sou Rafael'), new AIMessage('Encontrei 3 opções para você')],
      next: 'recommendation',
      profile: { customerName: 'Rafael' },
      recommendations: [{ vehicleId: 'v1' }],
      metadata: {
        startedAt: Date.now(),
        lastMessageAt: Date.now(),
        flags: [],
        loopCount: 0,
        errorCount: 0,
      },
      quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
      phoneNumber: '5511999999999',
    });

    const turn2 = await langGraph.processMessage('Sou Rafael', turn1.newState);
    expect(turn2.newState.graph.currentNode).toBe('recommendation');
    expect(turn2.newState.profile?.customerName).toBe('Rafael');

    // Turn 3: user shows interest -> negotiation
    mockInvoke.mockResolvedValueOnce({
      messages: [new HumanMessage('Gostei, quero esse'), new AIMessage('Perfeito, vamos negociar')],
      next: 'negotiation',
      profile: { customerName: 'Rafael', _showedRecommendation: true },
      recommendations: [{ vehicleId: 'v1' }],
      metadata: {
        startedAt: Date.now(),
        lastMessageAt: Date.now(),
        flags: [],
        loopCount: 0,
        errorCount: 0,
      },
      quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
      phoneNumber: '5511999999999',
    });

    const turn3 = await langGraph.processMessage('Gostei, quero esse', turn2.newState);
    expect(turn3.newState.graph.currentNode).toBe('negotiation');
    expect(turn3.response).toContain('negoci');
  });
});
