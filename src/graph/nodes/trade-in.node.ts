import { IGraphState } from '../../types/graph.types';
import { tradeInAgent } from '../../agents/trade-in.agent';
import { AIMessage } from '@langchain/core/messages';
import { logger } from '../../lib/logger';
import { ConversationContext } from '../../types/conversation.types';

export async function tradeInNode(state: IGraphState): Promise<Partial<IGraphState>> {
  logger.info('TradeInNode: Processing message');

  const lastMessage = state.messages[state.messages.length - 1];
  const userMessage = lastMessage?.content?.toString?.() ?? '';

  if (!userMessage.trim()) {
    return {
      messages: [
        new AIMessage(
          'Para eu avaliar a troca, me diga por favor:\n• Qual é o seu carro (modelo e ano)\n• Km aproximado\n\nEx: "Gol 2018 com 80 mil km"'
        ),
      ],
      next: 'negotiation',
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
  }

  // Context adapter
  const context: ConversationContext = {
    conversationId: 'graph-exec',
    phoneNumber: state.phoneNumber || 'unknown',
    mode: 'trade_in',
    profile: state.profile || {},
    messages: [] as any,
    metadata: {} as any,
  };

  const response = await tradeInAgent.processTradeIn(userMessage, context);

  if (response) {
    const responseText = (response.response ?? '').toString();
    const responseTextTrimmed = responseText.trim();

    return {
      messages: [
        new AIMessage(
          responseTextTrimmed.length > 0
            ? responseText
            : 'Para eu avaliar a troca, me diga por favor:\n• Qual é o seu carro (modelo e ano)\n• Km aproximado\n\nEx: "Gol 2018 com 80 mil km"'
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

  // Not handled by agent — ask for the missing trade-in details explicitly.
  return {
    messages: [
      new AIMessage(
        'Beleza! Qual é o seu carro para troca (modelo e ano) e qual a quilometragem aproximada?\n\nEx: "Onix 2020 com 55 mil km"'
      ),
    ],
    next: 'negotiation',
    metadata: {
      ...state.metadata,
      lastMessageAt: Date.now(),
    },
  };
}
