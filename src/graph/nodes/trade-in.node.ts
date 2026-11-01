import { IGraphState } from '../../types/graph.types';
import { tradeInAgent } from '../../agents/trade-in.agent';
import { AIMessage } from '@langchain/core/messages';
import { createNodeTimer } from '../../lib/node-metrics';
import { ConversationContext } from '../../types/conversation.types';

export async function tradeInNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const timer = createNodeTimer('tradeIn');

  const lastMessage = state.messages[state.messages.length - 1];

  if (!lastMessage || typeof lastMessage.content !== 'string') {
    timer.logError(state, 'No valid message to process');
    return {
      next: 'end',
      messages: [new AIMessage('Desculpe, não entendi. Posso transferir você para um consultor?')],
    };
  }

  const userMessage = lastMessage.content;

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
        tradeInVehicle:
          response.extractedPreferences?.tradeInVehicle || state.profile?.tradeInVehicle,
      },
      // Use nextMode from agent response, fallback to 'end'
      next: (response as any).nextMode || 'end',
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
