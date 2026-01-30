import { vehicleExpert } from '../../agents/vehicle-expert.agent';
import { ConversationContext } from '../../types/conversation.types';
import { IGraphState } from '../../types/graph.types';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { createNodeTimer } from '../../lib/node-metrics';
import { detectNameCorrection } from '../langgraph/extractors/name-correction-detector';
import {
  detectExplicitRecommendationRequest,
  isInformationProvision,
} from '../../agents/vehicle-expert/intent-detector';

/**
 * Discovery Node
 * Analyzes user input to understand vehicle preferences
 */
export async function discoveryNode(state: IGraphState): Promise<Partial<IGraphState>> {
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
          new AIMessage(`Desculpa pelo erro, ${firstName}! Continuando... o que você está procurando?`),
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

  // 6. Determine Next Node with recommendation control
  // Requirements: 2.1, 2.2, 2.4, 2.5
  let next = 'discovery'; // Default: stay in discovery/loop
  let responseMessage = response.response;

  // Check if profile is complete (has budget AND usage/bodyType)
  const hasCompletedProfile =
    updatedProfile.budget && (updatedProfile.usage || updatedProfile.bodyType);

  if (isInfoProvision) {
    // Pure information provision - stay in discovery, don't auto-trigger recommendations
    // Requirements: 2.1, 2.2
    next = 'discovery';

    // If profile is now complete after this info provision, ask if they want to see options
    // Requirements: 2.5
    if (hasCompletedProfile && !isExplicitRequest) {
      responseMessage = response.response
        ? `${response.response} Quer que eu te mostre algumas opções?`
        : 'Entendi! Quer que eu te mostre algumas opções de veículos?';
    }
  } else if (isExplicitRequest) {
    // Explicit recommendation request - allow transition
    // Requirements: 2.4
    if (response.nextMode) {
      next = response.nextMode;
    } else if (
      response.canRecommend &&
      response.recommendations &&
      response.recommendations.length > 0
    ) {
      next = 'recommendation';
    }
  } else if (response.nextMode) {
    // Respect agent's decision for non-recommendation modes (e.g., financing, trade_in)
    // But block automatic recommendation transitions
    if (response.nextMode === 'recommendation') {
      // Don't auto-transition to recommendation without explicit request
      next = 'discovery';
      // Ask if they want to see options when profile is complete
      // Requirements: 2.5
      if (hasCompletedProfile) {
        responseMessage = response.response
          ? `${response.response} Quer que eu te mostre algumas opções?`
          : 'Quer que eu te mostre algumas opções de veículos?';
      }
    } else {
      next = response.nextMode;
    }
  } else if (
    response.canRecommend &&
    response.recommendations &&
    response.recommendations.length > 0
  ) {
    // Agent says we can recommend, but we need explicit request
    // Requirements: 2.4
    next = 'discovery';
    // Ask if they want to see options
    // Requirements: 2.5
    if (hasCompletedProfile) {
      responseMessage = response.response
        ? `${response.response} Quer que eu te mostre algumas opções?`
        : 'Quer que eu te mostre algumas opções de veículos?';
    }
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
  if (responseMessage && responseMessage.trim() !== '') {
    result.messages = [new AIMessage(responseMessage)];
  }

  timer.logSuccess(state, result);
  return result;
}
