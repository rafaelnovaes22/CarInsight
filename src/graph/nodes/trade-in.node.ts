
import { IGraphState } from '../../types/graph.types';
import { tradeInAgent } from '../../agents/trade-in.agent';
import { AIMessage } from '@langchain/core/messages';
import { logger } from '../../lib/logger';
import { ConversationContext } from '../../types/conversation.types';

export async function tradeInNode(state: IGraphState): Promise<Partial<IGraphState>> {
    logger.info('TradeInNode: Processing message');

    const lastMessage = state.messages[state.messages.length - 1];
    const userMessage = lastMessage.content.toString();

    // Context adapter
    const context: ConversationContext = {
        conversationId: 'graph-exec',
        phoneNumber: state.phoneNumber || 'unknown',
        mode: 'negotiation',
        profile: state.profile || {},
        messages: [] as any,
        metadata: {} as any
    };

    const response = await tradeInAgent.processTradeIn(userMessage, context);

    if (response) {
        return {
            messages: [new AIMessage(response.response)],
            profile: {
                ...state.profile,
                ...response.extractedPreferences
            },
            next: response.nextMode || 'negotiation',
            metadata: {
                ...state.metadata,
                lastMessageAt: Date.now()
            }
        };
    }

    return {
        next: 'negotiation'
    };
}
