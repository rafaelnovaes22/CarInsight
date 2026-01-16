import { IGraphState } from '../../types/graph.types';
import { financingAgent } from '../../agents/financing.agent';
import { AIMessage } from '@langchain/core/messages';
import { createNodeTimer } from '../../lib/node-metrics';
import { ConversationContext, ConversationResponse } from '../../types/conversation.types';

export async function financingNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const timer = createNodeTimer('financing');

  const lastMessage = state.messages[state.messages.length - 1];
  const userMessage = lastMessage.content.toString();

  // Context adapter
  const context: ConversationContext = {
    conversationId: 'graph-exec',
    phoneNumber: state.phoneNumber || 'unknown',
    mode: 'negotiation',
    profile: state.profile || {},
    messages: [] as any, // Not heavily used by the agent method we built
    metadata: {} as any,
  };

  const response = await financingAgent.processReference(userMessage, context);

  if (response) {
    const result = {
      messages: [new AIMessage(response.response)],
      profile: {
        ...state.profile,
        ...response.extractedPreferences,
      },
      next: response.nextMode || 'negotiation',
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
    timer.logSuccess(state, result);
    return result;
  }

  // Fallback if not handled (shouldn't happen if routed correctly, or maybe user said something unrelated)
  timer.logSuccess(state, { next: 'negotiation' });
  return {
    next: 'negotiation', // default fallthrough
  };
}
