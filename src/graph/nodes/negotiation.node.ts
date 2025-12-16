import { vehicleExpert } from '../../agents/vehicle-expert.agent';
import { ConversationContext } from '../../types/conversation.types';
import { IGraphState } from '../../types/graph.types';
import { AIMessage } from '@langchain/core/messages';
import { logger } from '../../lib/logger';

/**
 * Negotiation Node
 * Handles questions and discussions after vehicle recommendation,
 * including logic for "vendedor", financing details, and trade-in.
 */
export async function negotiationNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];

  if (!lastMessage || typeof lastMessage.content !== 'string') {
    return {};
  }

  const messageContent = lastMessage.content;
  logger.info({ messageLength: messageContent.length }, 'NegotiationNode: Processing message');

  // 1. Map messages
  const mappedMessages = state.messages.map(m => {
    let role = 'assistant';
    if (typeof m._getType === 'function') {
      role = m._getType() === 'human' ? 'user' : 'assistant';
    } else if ((m as any).type === 'human' || (m as any).id?.includes('HumanMessage')) {
      role = 'user';
    }
    return {
      role,
      content: m.content ? m.content.toString() : '',
    };
  });

  // 2. Context with mode='negotiation'
  const context: ConversationContext = {
    conversationId: 'graph-execution',
    phoneNumber: state.phoneNumber || 'unknown',
    mode: 'negotiation',
    profile: state.profile || {},
    messages: mappedMessages as any,
    metadata: {
      startedAt: new Date(state.metadata.startedAt),
      lastMessageAt: new Date(state.metadata.lastMessageAt),
      messageCount: state.messages.length,
      extractionCount: 0,
      questionsAsked: 0,
      userQuestions: 0,
    },
  };

  // 3. Call Vehicle Expert
  // The expert will handle "vendedor" logic, specific vehicle questions, etc.
  // It delegates 'financing' and 'trade_in' intents back to us via nextMode.
  const response = await vehicleExpert.chat(messageContent, context);

  // 4. Update State
  const updatedProfile = {
    ...state.profile,
    ...response.extractedPreferences,
  };

  // 5. Determine Next Node
  // Default to staying in negotiation unless expert says otherwise
  let next = response.nextMode || 'negotiation';

  // If expert suggests recommendation (e.g. "here is the car again"), we might go to recommendation node
  // But usually we stay here to answer questions.
  // If nextMode is 'financing' or 'trade_in', the router will handle it.

  return {
    next,
    profile: updatedProfile,
    // Update recommendations if changed? Usually they persist unless filtered
    recommendations: response.recommendations || state.recommendations,
    messages: [new AIMessage(response.response)],
  };
}
