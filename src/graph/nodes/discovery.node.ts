import { vehicleExpert } from '../../agents/vehicle-expert.agent';
import { ConversationContext } from '../../types/conversation.types';
import { IGraphState } from '../../types/graph.types';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { logger } from '../../lib/logger';

/**
 * Discovery Node
 * Analyzes user input to understand vehicle preferences
 */
export async function discoveryNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];

  if (!lastMessage || typeof lastMessage.content !== 'string') {
    return {};
  }

  const messageContent = lastMessage.content;
  logger.info({ messageLength: messageContent.length }, 'DiscoveryNode: Processing message');

  // 1. Detect handoff request (vendedor, humano, atendente)
  const lowerMessage = messageContent.toLowerCase();
  const isHandoffRequest =
    lowerMessage.includes('vendedor') ||
    lowerMessage.includes('humano') ||
    lowerMessage.includes('atendente');

  // 2. Build Context for Vehicle Expert
  // We need to map LangChain messages to the format expected by VehicleExpert (Role/Content)
  // or update VehicleExpert to accept BaseMessage[]. For now, mapping is safer.
  const mappedMessages = state.messages.map(m => {
    let role = 'assistant';

    // Robust type checking handling both class instances and serialized JSON objects
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

  const context: ConversationContext = {
    conversationId: 'graph-execution', // TODO: Get from config/state if available
    phoneNumber: state.phoneNumber || 'unknown',
    mode: 'discovery',
    profile: state.profile || {},
    messages: mappedMessages as any, // Cast to satisfy interface if needed
    metadata: {
      startedAt: new Date(state.metadata.startedAt),
      lastMessageAt: new Date(state.metadata.lastMessageAt),
      messageCount: state.messages.filter(m => {
        if (typeof m._getType === 'function') return m._getType() === 'human';
        return (m as any).type === 'human' || (m as any).id?.includes('HumanMessage');
      }).length,
      extractionCount: 0,
      questionsAsked: 0,
      userQuestions: 0,
    },
  };

  // Call Vehicle Expert
  const response = await vehicleExpert.chat(messageContent, context);

  // Update Profile
  const updatedProfile = {
    ...state.profile,
    ...response.extractedPreferences,
  };

  // Determine Next Node
  let next = 'discovery'; // Default: stay in discovery/loop

  if (response.nextMode) {
    // Respect agent's decision (e.g., financing, trade_in, recommendation)
    next = response.nextMode;
  } else if (
    response.canRecommend &&
    response.recommendations &&
    response.recommendations.length > 0
  ) {
    next = 'recommendation';
  } else if (updatedProfile.budget || updatedProfile.usage || updatedProfile.bodyType) {
    // If we have some info but no recs yet, maybe clarify or just loop
    next = 'discovery';
  }

  const result: Partial<IGraphState> = {
    next,
    profile: updatedProfile,
    recommendations: response.recommendations || [],
  };

  // Propagate handoff_requested flag if detected
  if (isHandoffRequest) {
    result.metadata = {
      ...state.metadata,
      lastMessageAt: Date.now(),
      flags: state.metadata.flags.includes('handoff_requested')
        ? state.metadata.flags
        : [...state.metadata.flags, 'handoff_requested'],
    };
  }

  // Only add message if there is actual content
  // If response is empty (delegation), we don't add AIMessage so the Router
  // sees the User message as the last one and continues execution.
  if (response.response && response.response.trim() !== '') {
    result.messages = [new AIMessage(response.response)];
  }

  return result;
}
