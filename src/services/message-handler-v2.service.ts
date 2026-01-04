import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { guardrails } from './guardrails.service';
import { conversationGraph } from '../graph/conversation-graph';
import { LangGraphConversation } from '../graph/langgraph-conversation';
import { Conversation } from '@prisma/client';
import { ConversationState } from '../types/state.types';
import { featureFlags } from '../lib/feature-flags';
import { leadService } from './lead.service';
import { sessionManager } from './session-manager.service';
import { messageCommandHandler } from '../handlers/message-command.handler';

// Re-export types that might be used elsewhere
export interface AudioMessageOptions {
  /** Original media ID from Meta API for audio messages */
  mediaId?: string;
}

/**
 * MessageHandlerV2 - Refactored Orchestrator
 * Delegates logic to specialized services:
 * - SessionManager: State & Lifecycle
 * - LeadService: CRM & Notifications
 * - MessageCommandHandler: System commands & Greetings
 * - LangGraph: Conversation flow
 */
export class MessageHandlerV2 {
  async handleMessage(
    phoneNumber: string,
    message: string,
    audioOptions?: AudioMessageOptions
  ): Promise<string> {
    try {
      // 1. 🛡️ GUARDRAIL: Validate input
      const inputValidation = guardrails.validateInput(phoneNumber, message);
      if (!inputValidation.allowed) {
        logger.warn({ phoneNumber, reason: inputValidation.reason }, 'Input blocked by guardrails');
        return inputValidation.reason || 'Desculpe, não consegui processar sua mensagem.';
      }

      // Use sanitized input
      const sanitizedMessage = inputValidation.sanitizedInput || message;

      // 2. 🔄 Check for system commands (Exit, Restart, LGPD)
      const commandResponse = await messageCommandHandler.handleSystemCommands(
        phoneNumber,
        sanitizedMessage
      );
      if (commandResponse) {
        return commandResponse;
      }

      // 3. 👋 Check for greetings
      const { isGreeting, isJustGreeting } = messageCommandHandler.checkGreeting(sanitizedMessage);

      // 4. Session Management & Stale Check
      if (isJustGreeting) {
        // If it's just a greeting, check if we need to restart a stale session
        const existingConversation = await prisma.conversation.findFirst({
          where: { phoneNumber, status: 'active' },
        });

        if (existingConversation) {
          const timeDiff = Date.now() - existingConversation.lastMessageAt.getTime();
          const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

          if (timeDiff >= SESSION_TIMEOUT) {
            // Session is stale, restart
            logger.info(
              { phoneNumber, timeDiff },
              'User sent greeting in stale session (>10m), restarting'
            );
            await sessionManager.resetConversation(phoneNumber);

            // Create new session via SessionManager
            const newConversation = await sessionManager.getOrCreateConversation(phoneNumber);
            const initialState = sessionManager.initializeState(newConversation.id, phoneNumber);

            const greetingResponse = `👋 Olá! Sou a assistente virtual do *CarInsight*.

🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.

💡 _A qualquer momento, digite *sair* para encerrar a conversa._

Para começar, qual é o seu nome?`;

            // Update state with initial exchange
            initialState.messages = [
              { role: 'user', content: sanitizedMessage, timestamp: new Date() },
              { role: 'assistant', content: greetingResponse, timestamp: new Date() },
            ];

            // Save state
            await sessionManager.saveState(newConversation.id, initialState);

            // Log messages
            await this.logMessage(newConversation.id, sanitizedMessage, 'incoming', 'text');
            await this.logMessage(newConversation.id, greetingResponse, 'outgoing', 'text');

            return greetingResponse;
          } else {
            logger.info(
              { phoneNumber },
              'User sent greeting in active session (<10m), passing to graph'
            );
          }
        }
      }

      // If greeting with content (e.g. "Oi, quero Civic"), reset but continue processing
      if (isGreeting && !isJustGreeting) {
        const existingConversation = await prisma.conversation.findFirst({
          where: { phoneNumber, status: 'active' },
        });

        if (existingConversation) {
          await sessionManager.resetConversation(phoneNumber);
          logger.info({ phoneNumber }, 'User sent greeting with content, resetting and processing');
        }
      }

      // 5. Get or create conversation (if not handled above)
      const conversation = await sessionManager.getOrCreateConversation(phoneNumber);

      // 6. Log incoming message
      const isAudioMessage = !!audioOptions?.mediaId;
      const messageType = isAudioMessage ? 'audio_transcription' : 'text';

      await this.logMessage(
        conversation.id,
        sanitizedMessage,
        'incoming',
        messageType,
        audioOptions?.mediaId
      );

      // 7. Load State
      let currentState = await sessionManager.loadState(conversation.id);

      // 8. Routing (Feature Flags)
      const useConversational = featureFlags.shouldUseConversationalMode(phoneNumber);
      const useLangGraph = featureFlags.isEnabled('USE_LANGGRAPH', phoneNumber);

      logger.info(
        {
          conversationId: conversation.id,
          useConversational,
          useLangGraph,
          hasCache: !!currentState,
        },
        'Routing decision'
      );

      let newState: ConversationState;
      let response: string;

      if (useLangGraph || useConversational) {
        // LangGraph Mode
        if (!currentState) {
          currentState = sessionManager.initializeState(conversation.id, phoneNumber);
        }

        const langGraph = new LangGraphConversation();
        const result = await langGraph.processMessage(sanitizedMessage, currentState);
        newState = result.newState;
        response = result.response;
      } else {
        // Legacy Mode
        newState = await conversationGraph.invoke({
          conversationId: conversation.id,
          phoneNumber,
          message: sanitizedMessage,
          currentState,
        });

        response = conversationGraph.getLastResponse(newState);
      }

      // 9. 🛡️ GUARDRAIL: Validate output
      const outputValidation = guardrails.validateOutput(response);
      let finalResponse = response;

      if (!outputValidation.allowed) {
        logger.error(
          { conversationId: conversation.id, reason: outputValidation.reason },
          'Output blocked by guardrails'
        );
        finalResponse =
          'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente ou digite "vendedor" para falar com nossa equipe.';
      }

      // 10. Save State & Update DB
      await sessionManager.saveState(conversation.id, newState);

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentStep: newState.graph.currentNode,
          lastMessageAt: new Date(),
          quizAnswers: newState.quiz.isComplete ? JSON.stringify(newState.quiz.answers) : null,
          profileData: newState.profile ? JSON.stringify(newState.profile) : null,
        },
      });

      // 11. Log outgoing message
      await this.logMessage(conversation.id, finalResponse, 'outgoing', 'text');

      // 12. Handle Post-Processing (Quiz Completion, Recommendations, Leads)
      this.handlePostProcessing(conversation, currentState, newState, phoneNumber);

      return finalResponse;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error handling message');
      return 'Desculpe, ocorreu um erro. Por favor, tente novamente.';
    }
  }

  /**
   * Helper to log messages to DB
   */
  private async logMessage(
    conversationId: string,
    content: string,
    direction: 'incoming' | 'outgoing',
    messageType: string,
    originalMediaId?: string
  ) {
    await prisma.message.create({
      data: {
        conversationId,
        direction,
        content,
        messageType,
        originalMediaId,
      },
    });
  }

  /**
   * Handle side effects like Event logging, Recommendations saving, and Lead creation
   */
  private async handlePostProcessing(
    conversation: Conversation & { customerName?: string | null },
    currentState: ConversationState | undefined,
    newState: ConversationState,
    phoneNumber: string
  ) {
    // A. Quiz Completion Event
    if (newState.quiz.isComplete && !currentState?.quiz.isComplete) {
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'quiz_completed',
          metadata: JSON.stringify({ answers: newState.quiz.answers }),
        },
      });
    }

    // B. Save Recommendations
    if (
      newState.recommendations.length > 0 &&
      (!currentState || currentState.recommendations.length === 0)
    ) {
      for (const rec of newState.recommendations) {
        await prisma.recommendation
          .create({
            data: {
              conversationId: conversation.id,
              vehicleId: rec.vehicleId,
              matchScore: rec.matchScore,
              reasoning: rec.reasoning,
            },
          })
          .catch(error => {
            if (!error.message.includes('Unique constraint')) {
              logger.error({ error }, 'Error saving recommendation');
            }
          });
      }
    }

    // C. Check for Lead Handoff
    const shouldCreateLead =
      !currentState?.metadata.flags.includes('lead_sent') &&
      newState.metadata.flags.includes('handoff_requested') &&
      !currentState?.metadata.flags.includes('handoff_requested');

    if (shouldCreateLead) {
      await leadService.createLead(conversation, newState, phoneNumber);

      // Update state flag
      newState.metadata.flags = [...newState.metadata.flags, 'lead_sent'];
      await sessionManager.saveState(conversation.id, newState);
    }
  }
}
