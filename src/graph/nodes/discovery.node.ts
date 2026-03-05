import { vehicleExpert } from '../../agents/vehicle-expert.agent';
import { ConversationContext } from '../../types/conversation.types';
import { IGraphState } from '../../types/graph.types';
import { AIMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { createNodeTimer } from '../../lib/node-metrics';
import { detectNameCorrection } from '../langgraph/extractors/name-correction-detector';
import {
  detectExplicitRecommendationRequest,
  isInformationProvision,
} from '../../agents/vehicle-expert/intent-detector';
import { logger } from '../../lib/logger';

function resolveConversationId(state: IGraphState, config?: RunnableConfig): string {
  const threadId = (config?.configurable as Record<string, unknown> | undefined)?.thread_id;
  if (typeof threadId === 'string' && threadId.trim().length > 0) {
    return threadId.trim();
  }

  if (state.phoneNumber && state.phoneNumber.trim().length > 0) {
    return `graph-${state.phoneNumber.trim()}`;
  }

  return `graph-${state.metadata.startedAt}`;
}

/**
 * Discovery Node
 * Analyzes user input to understand vehicle preferences
 */
export async function discoveryNode(
  state: IGraphState,
  config?: RunnableConfig
): Promise<Partial<IGraphState>> {
  const timer = createNodeTimer('discovery');

  const lastMessage = state.messages[state.messages.length - 1];

  if (!lastMessage || typeof lastMessage.content !== 'string') {
    timer.logSuccess(state, {});
    return {};
  }

  const messageContent = lastMessage.content;

  // 1. Check for name correction FIRST if we already have a name
  // Requirements: 1.2, 1.3, 1.4, 1.5
  if (state.profile?.customerName) {
    const correctionResult = detectNameCorrection(messageContent, {
      existingName: state.profile.customerName,
    });

    if (correctionResult.isCorrection && correctionResult.correctedName) {
      const firstName = correctionResult.correctedName.split(' ')[0];
      const result: Partial<IGraphState> = {
        next: 'discovery', // Stay in discovery state
        profile: {
          ...state.profile,
          customerName: correctionResult.correctedName,
        },
        messages: [
          new AIMessage(
            `Desculpa pelo erro, ${firstName}! Continuando... o que você está procurando?`
          ),
        ],
      };
      timer.logSuccess(state, result);
      return result;
    }
  }

  // 2. Detect handoff request (vendedor, humano, atendente)
  const lowerMessage = messageContent.toLowerCase();
  const isHandoffRequest =
    lowerMessage.includes('vendedor') ||
    lowerMessage.includes('humano') ||
    lowerMessage.includes('atendente');

  // 3. Check if this is pure information provision (not a recommendation request)
  // Requirements: 2.1, 2.2, 4.2
  const isInfoProvision = isInformationProvision(messageContent);

  // 4. Check for explicit recommendation request
  // Requirements: 2.3, 4.1
  const isExplicitRequest = detectExplicitRecommendationRequest(messageContent);

  // 5. Build Context for Vehicle Expert
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
    conversationId: resolveConversationId(state, config),
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

  // 6. Determine Next Node with recommendation control
  // FIXED: Prioritize canRecommend over hasCompletedProfile
  let next = 'discovery'; // Default: stay in discovery/loop
  const responseMessage = response.response;
  const hasAssistantMessage = !!(responseMessage && responseMessage.trim() !== '');

  // Check if we have valid recommendations
  const hasRecommendations =
    response.canRecommend && response.recommendations && response.recommendations.length > 0;

  if (isInfoProvision) {
    // Pure information provision - auto-transition when we have recommendations
    // FIXED: Prioritize canRecommend over hasCompletedProfile
    if (hasRecommendations) {
      next = 'recommendation';
    } else {
      next = 'discovery';
    }
  } else if (isExplicitRequest) {
    // Explicit recommendation request - allow transition
    if (hasRecommendations) {
      next = 'recommendation';
    } else if (response.nextMode) {
      next = response.nextMode;
    }
  } else if (response.nextMode) {
    next = response.nextMode;
  }

  // Safety check: if expert says recommendation but no recommendations, stay in discovery
  if (next === 'recommendation' && !hasRecommendations && !state.recommendations?.length) {
    logger.warn('DiscoveryNode: Attempted transition to recommendation without recommendations');
    next = 'discovery';
  }

  const result: Partial<IGraphState> = {
    next,
    profile: updatedProfile,
    recommendations: response.recommendations || [],
  };

  // Propagate handoff_requested flag if detected
  // Propagate handoff_requested flag if detected
  const tokenUsage = response.metadata?.tokenUsage;
  const llmUsed = response.metadata?.llmUsed;
  const isTechnicalLoop = next === 'discovery' && !hasAssistantMessage;
  const loopCount = isTechnicalLoop
    ? state.metadata.lastLoopNode === 'discovery'
      ? (state.metadata.loopCount || 0) + 1
      : 1
    : 0;

  result.metadata = {
    ...state.metadata,
    lastMessageAt: Date.now(),
    loopCount,
    lastLoopNode: isTechnicalLoop ? 'discovery' : undefined,
    flags:
      isHandoffRequest && !state.metadata.flags.includes('handoff_requested')
        ? [...state.metadata.flags, 'handoff_requested']
        : state.metadata.flags,
    tokenUsage,
    llmUsed,
  };

  // Only add message if there is actual content
  // If response is empty (delegation), we don't add AIMessage so the Router
  // sees the User message as the last one and continues execution.
  if (hasAssistantMessage) {
    result.messages = [new AIMessage(responseMessage)];
  }

  timer.logSuccess(state, result);
  return result;
}
