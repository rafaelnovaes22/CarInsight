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
import { detectHandoffRequest } from '../../utils/handoff-detector';
import { mapMessagesToContext, countUserMessages } from '../../utils/message-mapper';
import { computeLoopCount } from '../../utils/circuit-breaker';
import { addFlagIf } from '../../utils/state-flags';

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
  const handoffResult = detectHandoffRequest(messageContent);
  const isHandoffRequest = handoffResult.isHandoffRequest;

  // 3. Check if this is pure information provision (not a recommendation request)
  // Requirements: 2.1, 2.2, 4.2
  const isInfoProvision = isInformationProvision(messageContent);

  // 4. Check for explicit recommendation request
  // Requirements: 2.3, 4.1
  const isExplicitRequest = detectExplicitRecommendationRequest(messageContent);

  // 5. Build Context for Vehicle Expert
  const mappedMessages = mapMessagesToContext(state.messages);

  const context: ConversationContext = {
    conversationId: resolveConversationId(state, config),
    phoneNumber: state.phoneNumber || 'unknown',
    mode: 'discovery',
    profile: state.profile || {},
    messages: mappedMessages as any,
    metadata: {
      startedAt: new Date(state.metadata.startedAt),
      lastMessageAt: new Date(state.metadata.lastMessageAt),
      messageCount: countUserMessages(state.messages),
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
  const hasBudgetAfterUpdate = !!updatedProfile.budget;
  const hasUseCaseAfterUpdate = !!(
    updatedProfile.usage ||
    updatedProfile.usoPrincipal ||
    updatedProfile.bodyType
  );
  const hasRecommendationReadyProfile = hasBudgetAfterUpdate && hasUseCaseAfterUpdate;

  // 6. Determine Next Node with recommendation control
  let next = 'discovery'; // Default: stay in discovery/loop
  const responseMessage = response.response;
  const hasAssistantMessage = !!(responseMessage && responseMessage.trim() !== '');

  // Check if we have valid recommendations
  const hasRecommendations =
    response.canRecommend && response.recommendations && response.recommendations.length > 0;

  if (isInfoProvision) {
    // Pure information provision only auto-transitions when the profile is
    // recommendation-ready: budget plus use context or body type.
    if (hasRecommendations && hasRecommendationReadyProfile) {
      next = 'recommendation';
    } else {
      next = 'discovery';
    }
  } else if (isExplicitRequest) {
    // Even explicit requests must respect the minimum recommendation profile.
    if (hasRecommendations && hasRecommendationReadyProfile) {
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
  const tokenUsage = response.metadata?.tokenUsage;
  const llmUsed = response.metadata?.llmUsed;
  const isTechnicalLoop = next === 'discovery' && !hasAssistantMessage;
  const { loopCount, lastLoopNode } = computeLoopCount(state, 'discovery', isTechnicalLoop);

  result.metadata = {
    ...state.metadata,
    lastMessageAt: Date.now(),
    loopCount,
    lastLoopNode,
    flags: addFlagIf(state.metadata.flags, 'handoff_requested', isHandoffRequest),
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
