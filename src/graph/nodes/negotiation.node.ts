import { vehicleExpert } from '../../agents/vehicle-expert.agent';
import { ConversationContext } from '../../types/conversation.types';
import { IGraphState } from '../../types/graph.types';
import { AIMessage } from '@langchain/core/messages';
import { createNodeTimer } from '../../lib/node-metrics';
import { getTimeSlot, getEmotionalMode } from '../../config/time-context';
import { featureFlags } from '../../lib/feature-flags';
import { detectHandoffRequest, addHandoffFlag } from '../../utils/handoff-detector';
import { mapMessagesToContext } from '../../utils/message-mapper';

/**
 * Negotiation Node
 * Handles questions and discussions after vehicle recommendation,
 * including logic for "vendedor", financing details, and trade-in.
 */
export async function negotiationNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const timer = createNodeTimer('negotiation');

  const lastMessage = state.messages[state.messages.length - 1];

  if (!lastMessage || typeof lastMessage.content !== 'string') {
    timer.logSuccess(state, {});
    return {};
  }

  const messageContent = lastMessage.content;

  // 1. Detect handoff request (vendedor, humano, atendente)
  const handoffResult = detectHandoffRequest(messageContent);
  const isHandoffRequest = handoffResult.isHandoffRequest;

  // 2. Map messages
  const mappedMessages = mapMessagesToContext(state.messages);

  // 3. Context with mode='negotiation'
  const emotionalEnabled = featureFlags.isEnabled('ENABLE_EMOTIONAL_SELLING');
  const timeSlot = emotionalEnabled ? getTimeSlot() : undefined;
  const emotionalMode = emotionalEnabled ? getEmotionalMode() : undefined;

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
    timeSlot,
    emotionalMode,
  };

  // 4. Call Vehicle Expert
  // The expert will handle "vendedor" logic, specific vehicle questions, etc.
  // It delegates 'financing' and 'trade_in' intents back to us via nextMode.
  const response = await vehicleExpert.chat(messageContent, context);

  // 5. Update State
  const updatedProfile = {
    ...state.profile,
    ...response.extractedPreferences,
  };

  // 6. Determine Next Node
  // Default to staying in negotiation unless expert says otherwise
  const next = response.nextMode || 'negotiation';

  // If expert suggests recommendation (e.g. "here is the car again"), we might go to recommendation node
  // But usually we stay here to answer questions.
  // If nextMode is 'financing' or 'trade_in', the router will handle it.

  const result: Partial<IGraphState> = {
    next,
    profile: updatedProfile,
    // Update recommendations if changed? Usually they persist unless filtered
    recommendations: response.recommendations || state.recommendations,
    messages: [new AIMessage(response.response)],
  };

  // Propagate handoff_requested flag if detected
  if (isHandoffRequest) {
    result.metadata = {
      ...state.metadata,
      lastMessageAt: Date.now(),
      flags: addHandoffFlag(state.metadata.flags),
    };
  }

  timer.logSuccess(state, result);
  return result;
}
