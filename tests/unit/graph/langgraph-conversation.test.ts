import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LangGraphConversation } from '../../../src/graph/langgraph-conversation';
import { ConversationState } from '../../../src/types/state.types';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Mock Logger
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Workflow creation to avoid complex persistence checks in unit test
// We want to test the *wrapper* logic (mapping) here, assuming the graph works (tested in nodes.test.ts)
const mockInvoke = vi.fn();
vi.mock('../../../src/graph/workflow', () => ({
  createConversationGraph: () => ({
    invoke: mockInvoke,
  }),
}));

describe('LangGraphConversation Integration', () => {
  let langGraph: LangGraphConversation;

  beforeEach(() => {
    vi.clearAllMocks();
    langGraph = new LangGraphConversation();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockState = (): ConversationState => ({
    conversationId: 'test-id',
    phoneNumber: '5511999999999',
    messages: [],
    profile: {},
    quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
    recommendations: [],
    graph: { currentNode: 'greeting', nodeHistory: [], errorCount: 0, loopCount: 0 },
    metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: [] },
  });

  it('should process message and map response correctly', async () => {
    const currentState = createMockState();
    const userMessage = 'Olá';

    // Mock Graph Response
    mockInvoke.mockResolvedValue({
      messages: [new HumanMessage(userMessage), new AIMessage('Olá! Qual seu nome?')],
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
      quiz: {},
    });

    const result = await langGraph.processMessage(userMessage, currentState);

    expect(mockInvoke).toHaveBeenCalled();
    expect(result.response).toBe('Olá! Qual seu nome?');
    expect(result.newState.conversationId).toBe(currentState.conversationId);
    expect(result.newState.graph.currentNode).toBe('greeting');
  });

  it('should handle errors gracefully', async () => {
    const currentState = createMockState();
    mockInvoke.mockRejectedValue(new Error('Graph failure'));

    const result = await langGraph.processMessage('Oi', currentState);

    expect(result.response).toContain('problema');
    // Should return original state or safe fallback
    expect(result.newState).toBe(currentState);
  });
});
