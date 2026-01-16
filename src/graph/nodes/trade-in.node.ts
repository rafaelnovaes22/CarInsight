import { IGraphState } from '../../types/graph.types';
import { tradeInAgent } from '../../agents/trade-in.agent';
import { AIMessage } from '@langchain/core/messages';
import { createNodeTimer } from '../../lib/node-metrics';
import { ConversationContext } from '../../types/conversation.types';

export async function tradeInNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const timer = createNodeTimer('tradeIn');

  const lastMessage = state.messages[state.messages.length - 1];
  const userMessage = lastMessage.content.toString();

  // Context adapter
  const context: ConversationContext = {
    conversationId: 'graph-exec',
    phoneNumber: state.phoneNumber || 'unknown',
    mode: 'negotiation',
    profile: state.profile || {},
    messages: [] as any,
    metadata: {} as any,
  };

  const response = await tradeInAgent.processTradeIn(userMessage, context);

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

  timer.logSuccess(state, { next: 'negotiation' });
  return {
    next: 'negotiation',
  };
}
