import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LangGraphConversation } from '../../src/graph/langgraph-conversation';
import { randomUUID } from 'crypto';
import { ConversationState } from '../../src/types/state.types';

describe('E2E: Moto Flow', () => {
  let graph: LangGraphConversation;
  const conversationId = randomUUID();
  const phoneNumber = '5511999999999';

  beforeEach(async () => {
    graph = new LangGraphConversation();
  });

  it('should handle "moto" message without crashing', async () => {
    // 1. User expresses interest in a motorcycle
    const message = 'Estou procurando uma moto, vocês tem?';

    // Create initial dummy state
    const initialState: ConversationState = {
      conversationId,
      phoneNumber,
      messages: [],
      quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
      profile: null,
      recommendations: [],
      graph: { currentNode: 'start', nodeHistory: [], errorCount: 0, loopCount: 0 },
      metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: [] },
    };

    const result = await graph.processMessage(message, initialState);

    // Check if the bot generated a response without crashing
    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle specific moto model request without crashing', async () => {
    const message = 'Tem Honda CG 160?';
    const newConversationId = randomUUID();

    const initialState: ConversationState = {
      conversationId: newConversationId,
      phoneNumber,
      messages: [],
      quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
      profile: null,
      recommendations: [],
      graph: { currentNode: 'start', nodeHistory: [], errorCount: 0, loopCount: 0 },
      metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: [] },
    };

    const result = await graph.processMessage(message, initialState);

    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
  }, 30000);
});
