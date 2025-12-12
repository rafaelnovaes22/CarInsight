/**
 * Conversational Handler
 *
 * Handles natural language conversations using VehicleExpertAgent
 * Alternative to quiz-based flow
 */

import { logger } from '../lib/logger';
import { vehicleExpert } from '../agents/vehicle-expert.agent';
import { onboardingHandler } from './onboarding-handler.service';
import { ConversationState, CustomerProfile } from '../types/state.types';
import { ConversationContext, ConversationMode } from '../types/conversation.types';

export class ConversationalHandler {
  /**
   * Handle message using conversational mode
   */
  async handleMessage(
    message: string,
    state: ConversationState
  ): Promise<{ response: string; updatedState: ConversationState }> {
    const startTime = Date.now();

    try {
      // Add user message to state BEFORE checking onboarding
      const stateWithUserMessage: ConversationState = {
        ...state,
        messages: [
          ...state.messages,
          {
            role: 'user',
            content: message,
            timestamp: new Date(),
          },
        ],
      };

      // Check if needs onboarding (greeting + name + context)
      // But skip if user already asked for specific brand/model
      const shouldSkipOnboarding = stateWithUserMessage.profile?._skipOnboarding;

      if (onboardingHandler.needsOnboarding(stateWithUserMessage) && !shouldSkipOnboarding) {
        logger.debug(
          {
            conversationId: stateWithUserMessage.conversationId,
            messageCount: stateWithUserMessage.messages.length,
          },
          'Conversational: handling onboarding'
        );

        const onboardingResult = await onboardingHandler.handleOnboarding(
          message,
          stateWithUserMessage
        );

        // If onboarding detected brand/model, skip onboarding and let vehicle expert handle it
        if (onboardingResult.updatedProfile._skipOnboarding || onboardingResult.response === '') {
          logger.info(
            {
              brand: onboardingResult.updatedProfile.brand,
              model: onboardingResult.updatedProfile.model,
            },
            'Conversational: User mentioned brand/model, skipping onboarding to vehicle expert'
          );

          // Update state with brand/model and continue to vehicle expert
          stateWithUserMessage.profile = {
            ...stateWithUserMessage.profile,
            ...onboardingResult.updatedProfile,
          };
          // Don't return here - let it fall through to vehicle expert
        } else {
          // Normal onboarding flow
          const updatedState: ConversationState = {
            ...stateWithUserMessage,
            profile: {
              ...stateWithUserMessage.profile,
              ...onboardingResult.updatedProfile,
            },
            messages: [
              ...stateWithUserMessage.messages,
              {
                role: 'assistant',
                content: onboardingResult.response,
                timestamp: new Date(),
              },
            ],
            metadata: {
              ...stateWithUserMessage.metadata,
              lastMessageAt: new Date(),
            },
          };

          logger.info(
            {
              conversationId: state.conversationId,
              hasName: !!updatedState.profile?.customerName,
              hasContext: !!updatedState.profile?.usoPrincipal,
              processingTime: Date.now() - startTime,
            },
            'Conversational: onboarding processed'
          );

          return {
            response: onboardingResult.response,
            updatedState,
          };
        }
      }

      // Build conversation context from state (with user message already added)
      const context = this.buildConversationContext(stateWithUserMessage);

      logger.debug(
        {
          conversationId: stateWithUserMessage.conversationId,
          mode: context.mode,
          messageCount: context.metadata.messageCount,
          profileFields: Object.keys(context.profile).length,
        },
        'Conversational: processing message'
      );

      // Call VehicleExpert
      const response = await vehicleExpert.chat(message, context);

      // Update state with extracted preferences
      const updatedProfile = this.mergeProfiles(
        stateWithUserMessage.profile,
        response.extractedPreferences
      );

      // Update state
      const updatedState: ConversationState = {
        ...stateWithUserMessage,
        profile: updatedProfile,
        recommendations: response.recommendations || stateWithUserMessage.recommendations,
        messages: [
          ...stateWithUserMessage.messages,
          {
            role: 'assistant',
            content: response.response,
            timestamp: new Date(),
          },
        ],
        graph: {
          ...state.graph,
          currentNode: this.mapConversationalModeToNode(response.nextMode || context.mode),
          loopCount: state.graph.loopCount + 1,
        },
        metadata: {
          ...state.metadata,
          lastMessageAt: new Date(),
        },
      };

      // Log success
      logger.info(
        {
          conversationId: state.conversationId,
          canRecommend: response.canRecommend,
          extractedFields: Object.keys(response.extractedPreferences),
          processingTime: Date.now() - startTime,
          nextMode: response.nextMode,
        },
        'Conversational: message processed'
      );

      return {
        response: response.response,
        updatedState,
      };
    } catch (error) {
      logger.error(
        {
          error,
          conversationId: state.conversationId,
          message: message.substring(0, 100),
        },
        'Conversational: error processing message'
      );

      // Fallback response
      return {
        response: 'Desculpe, tive um problema ao processar sua mensagem. Pode reformular? 🤔',
        updatedState: state,
      };
    }
  }

  /**
   * Build ConversationContext from ConversationState
   */
  private buildConversationContext(state: ConversationState): ConversationContext {
    // Infer mode from current state
    const mode = this.inferConversationalMode(state);

    return {
      conversationId: state.conversationId,
      phoneNumber: state.phoneNumber,
      mode,
      profile: state.profile || {},
      messages: state.messages,
      metadata: {
        startedAt: state.metadata.startedAt,
        lastMessageAt: state.metadata.lastMessageAt,
        messageCount: state.messages.filter(m => m.role === 'user').length,
        extractionCount: 0, // Could track this separately
        questionsAsked: 0, // Could track this separately
        userQuestions: state.messages.filter(m => m.role === 'user' && m.content.includes('?'))
          .length,
      },
    };
  }

  /**
   * Infer conversational mode from current state
   */
  private inferConversationalMode(state: ConversationState): ConversationMode {
    // If we have recommendations, we're in recommendation mode
    if (state.recommendations.length > 0) {
      return 'recommendation';
    }

    // If profile is mostly complete, ready to recommend
    const profile = state.profile;
    if (profile?.budget && profile?.usage && profile?.people) {
      return 'ready_to_recommend';
    }

    // If we have some info but not all, clarifying
    const profileKeys = Object.keys(profile || {});
    if (profileKeys.length > 0 && profileKeys.length < 3) {
      return 'clarification';
    }

    // Otherwise, still in discovery
    return 'discovery';
  }

  /**
   * Map conversational mode to graph node for compatibility
   */
  private mapConversationalModeToNode(mode: ConversationMode): string {
    const modeToNode: Record<ConversationMode, string> = {
      discovery: 'greeting',
      clarification: 'quiz',
      ready_to_recommend: 'search',
      recommendation: 'recommendation',
      negotiation: 'recommendation',
      refinement: 'recommendation',
    };

    return modeToNode[mode] || 'greeting';
  }

  /**
   * Merge profiles intelligently
   */
  private mergeProfiles(
    current: CustomerProfile | null,
    extracted: Partial<CustomerProfile>
  ): CustomerProfile {
    // If no current profile, use extracted as base
    if (!current) {
      return extracted as CustomerProfile;
    }

    // Merge, preferring newer extracted values
    return {
      ...current,
      ...extracted,

      // Merge arrays intelligently
      priorities: this.mergeArrays(current.priorities, extracted.priorities),
      dealBreakers: this.mergeArrays(current.dealBreakers, extracted.dealBreakers),
    };
  }

  /**
   * Merge arrays removing duplicates
   */
  private mergeArrays(arr1?: string[], arr2?: string[]): string[] | undefined {
    if (!arr1 && !arr2) return undefined;
    if (!arr1) return arr2;
    if (!arr2) return arr1;

    const merged = [...arr1, ...arr2];
    return Array.from(new Set(merged)); // Remove duplicates
  }

  /**
   * Check if conversation should switch to conversational mode
   * (for mid-conversation switches if we enable that later)
   */
  canSwitchToConversational(state: ConversationState): boolean {
    // Don't switch if quiz is already complete
    if (state.quiz.isComplete) {
      return false;
    }

    // Don't switch if we already have recommendations
    if (state.recommendations.length > 0) {
      return false;
    }

    // Could add more complex logic here
    return true;
  }
}

// Singleton export
export const conversationalHandler = new ConversationalHandler();
