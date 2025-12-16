import { IGraphState } from '../../types/graph.types';
import { financingAgent } from '../../agents/financing.agent';
import { AIMessage } from '@langchain/core/messages';
import { logger } from '../../lib/logger';
import { ConversationContext, ConversationResponse } from '../../types/conversation.types';

export async function financingNode(state: IGraphState): Promise<Partial<IGraphState>> {
  logger.info('FinancingNode: Processing message');

  const lastMessage = state.messages[state.messages.length - 1];
  const userMessage = lastMessage?.content?.toString?.() ?? '';

  // Context adapter
  const context: ConversationContext = {
    conversationId: 'graph-exec',
    phoneNumber: state.phoneNumber || 'unknown',
    mode: 'financing',
    profile: state.profile || {},
    messages: [] as any, // Not heavily used by the agent method we built
    metadata: {} as any,
  };

  const response = await financingAgent.processReference(userMessage, context);

  if (response) {
    const responseText = (response.response ?? '').toString();
    const responseTextTrimmed = responseText.trim();
    return {
      messages: [
        new AIMessage(
          responseTextTrimmed.length > 0
            ? responseText
            : 'Me diz por favor qual seria o valor de entrada (em dinheiro) e se tem carro na troca.'
        ),
      ],
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
  }

  // Fallback if not handled (shouldn't happen if routed correctly, or maybe user said something unrelated)
  return {
    messages: [
      new AIMessage(
        'Para simular o financiamento, me diga:\n• Valor de entrada (se tiver)\n• Se tem carro na troca\n\nEx: "Entrada 10 mil" ou "tenho um Gol 2018 na troca"'
      ),
    ],
    next: 'negotiation', // default fallthrough
    metadata: {
      ...state.metadata,
      lastMessageAt: Date.now(),
    },
  };
}
