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
        // Store trade-in info if provided
        tradeInVehicle: response.extractedPreferences?.tradeInVehicle || state.profile?.tradeInVehicle,
      },
      // FIX: Go to END after trade-in processing, not negotiation
      // This prevents duplicate processing of the same message
      next: 'end',
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
        tradeInProcessed: true,
      },
    };
    timer.logSuccess(state, result);
    return result;
  }

  // If no response, end conversation gracefully
  timer.logSuccess(state, { next: 'end' });
  return {
    next: 'end',
  };
}
