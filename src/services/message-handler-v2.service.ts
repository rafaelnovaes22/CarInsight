import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { guardrails } from './guardrails.service';
import { LangGraphConversation } from '../graph/langgraph-conversation';
import { ConversationState } from '../types/state.types';
import { maskPhoneNumber } from '../lib/privacy';
import { MessageHandlerDataRightsCommandsService } from './message-handler-v2/data-rights-commands.service';
import { MessageHandlerFollowUpService } from './message-handler-v2/follow-up.service';
import { MessageHandlerLeadService } from './message-handler-v2/lead.service';
import { MessageHandlerPersistenceService } from './message-handler-v2/persistence.service';
import { MessageHandlerSessionService } from './message-handler-v2/session.service';
import { buildAskNameGreeting, buildRestartGreeting } from '../config/disclosure.messages';

const EXIT_COMMANDS = ['sair', 'encerrar', 'tchau', 'bye', 'adeus'];
const RESTART_COMMANDS = ['reiniciar', 'recomeçar', 'voltar', 'cancelar', 'reset', 'nova busca'];
const GREETING_COMMANDS = [
  'oi',
  'olá',
  'ola',
  'bom dia',
  'boa tarde',
  'boa noite',
  'hey',
  'hello',
  'hi',
];
const SESSION_TIMEOUT_MS = 10 * 60 * 1000;

const EXIT_RESPONSE = `Obrigado por usar a Inovais! 👋

Foi um prazer ajudar você.

Se precisar de algo, é só enviar uma mensagem novamente! 😊

Até logo! 🚗

🤖 _Você foi atendido pela assistente virtual com IA da Inovais._`;

const WELCOME_RESPONSE = buildAskNameGreeting();

const RESTART_RESPONSE = buildRestartGreeting();

/**
 * Options for audio message handling
 * Requirements: 5.4
 */
export interface AudioMessageOptions {
  /** Original media ID from Meta API for audio messages */
  mediaId?: string;
  /** Original incoming message ID from WhatsApp provider */
  waMessageId?: string;
}

/**
 * MessageHandlerV2 - New implementation using LangGraph
 */
export class MessageHandlerV2 {
  private readonly dataRightsCommands = new MessageHandlerDataRightsCommandsService();
  private readonly followUpService = new MessageHandlerFollowUpService();
  private readonly leadService = new MessageHandlerLeadService();
  private readonly persistence = new MessageHandlerPersistenceService();
  private readonly sessionService = new MessageHandlerSessionService();

  async handleMessage(
    phoneNumber: string,
    message: string,
    audioOptions?: AudioMessageOptions
  ): Promise<string> {
    try {
      const inputValidation = await guardrails.validateInput(phoneNumber, message);
      if (!inputValidation.allowed) {
        logger.warn(
          { phoneNumber: maskPhoneNumber(phoneNumber), reason: inputValidation.reason },
          'Input blocked by guardrails'
        );
        return inputValidation.reason || 'Desculpe, não consegui processar sua mensagem.';
      }

      const sanitizedMessage = inputValidation.sanitizedInput || message;
      const lowerMessage = sanitizedMessage.toLowerCase().trim();

      const followUpCommandResponse = await this.followUpService.handleReengagement(
        phoneNumber,
        lowerMessage
      );
      if (followUpCommandResponse) {
        return followUpCommandResponse;
      }

      if (EXIT_COMMANDS.some(command => lowerMessage.includes(command))) {
        await this.followUpService.scheduleExitFollowUp(phoneNumber);
        await this.sessionService.resetConversation(phoneNumber);
        logger.info({ phoneNumber: maskPhoneNumber(phoneNumber) }, 'User requested exit');
        return EXIT_RESPONSE;
      }

      if (RESTART_COMMANDS.some(command => lowerMessage.includes(command))) {
        await this.sessionService.resetConversation(phoneNumber);
        logger.info({ phoneNumber: maskPhoneNumber(phoneNumber) }, 'User requested restart');
        return RESTART_RESPONSE;
      }

      const isGreeting = GREETING_COMMANDS.some(
        command =>
          lowerMessage === command ||
          lowerMessage.startsWith(command + ' ') ||
          lowerMessage.startsWith(command + ',')
      );
      const isJustGreeting = GREETING_COMMANDS.some(command => lowerMessage === command);

      if (isJustGreeting) {
        const existingConversation = await prisma.conversation.findFirst({
          where: { phoneNumber, status: 'active' },
        });

        if (existingConversation) {
          const timeDiff = Date.now() - existingConversation.lastMessageAt.getTime();

          if (timeDiff < SESSION_TIMEOUT_MS) {
            logger.info(
              { phoneNumber: maskPhoneNumber(phoneNumber) },
              'User sent greeting in active session (<10m), passing to graph'
            );
          } else {
            await this.sessionService.resetConversation(phoneNumber);
            logger.info(
              { phoneNumber: maskPhoneNumber(phoneNumber), timeDiff },
              'User sent greeting in stale session (>10m), restarting'
            );

            const newConversation = await prisma.conversation.create({
              data: {
                phoneNumber,
                status: 'active',
                currentStep: 'greeting',
              },
            });

            const initialState = this.initializeState(newConversation.id, phoneNumber);
            initialState.messages = [
              { role: 'user' as const, content: sanitizedMessage, timestamp: new Date() },
              { role: 'assistant' as const, content: WELCOME_RESPONSE, timestamp: new Date() },
            ];

            await this.persistence.saveState(newConversation.id, initialState);
            await this.persistence.logIncomingMessage(
              newConversation.id,
              sanitizedMessage,
              audioOptions
            );
            await this.persistence.logOutgoingMessage(newConversation.id, WELCOME_RESPONSE);

            return WELCOME_RESPONSE;
          }
        }
      }

      if (isGreeting) {
        const existingConversation = await prisma.conversation.findFirst({
          where: { phoneNumber, status: 'active' },
        });

        if (existingConversation) {
          await this.sessionService.resetConversation(phoneNumber);
          logger.info(
            {
              phoneNumber: maskPhoneNumber(phoneNumber),
              message: sanitizedMessage.substring(0, 50),
            },
            'User sent greeting with content, resetting and processing'
          );
        }
      }

      const lgpdResponse = await this.dataRightsCommands.handle(phoneNumber, sanitizedMessage);
      if (lgpdResponse) {
        return lgpdResponse;
      }

      const conversation = await this.getOrCreateConversation(phoneNumber);
      await this.persistence.logIncomingMessage(conversation.id, sanitizedMessage, audioOptions);

      let currentState = await this.persistence.loadState(conversation.id);

      logger.info(
        {
          conversationId: conversation.id,
          phoneNumber: maskPhoneNumber(phoneNumber),
          hasCache: !!currentState,
          currentNode: currentState?.graph.currentNode,
        },
        'Processing message via LangGraph'
      );

      const startTime = Date.now();
      logger.debug(
        { conversationId: conversation.id },
        'Processing with LangGraph (integrated mode)'
      );

      if (!currentState) {
        currentState = this.initializeState(conversation.id, phoneNumber);
      }

      const langGraph = new LangGraphConversation();
      const result = await langGraph.processMessage(sanitizedMessage, currentState);
      const newState = result.newState;
      const response = result.response;
      const processingTimeMs = Date.now() - startTime;

      const outputValidation = guardrails.validateOutput(response);
      let finalResponse = response;

      if (!outputValidation.allowed) {
        logger.error(
          { conversationId: conversation.id, reason: outputValidation.reason },
          'Output blocked by guardrails'
        );
        finalResponse =
          'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente ou digite "vendedor" para falar com nossa equipe.';
      } else if (outputValidation.sanitizedInput) {
        finalResponse = outputValidation.sanitizedInput;
      }

      await this.persistence.persistGraphResult({
        conversationId: conversation.id,
        previousState: currentState,
        newState,
        finalResponse,
        processingTimeMs,
      });

      const shouldCreateLead =
        !currentState.metadata.flags.includes('lead_sent') &&
        newState.metadata.flags.includes('handoff_requested') &&
        !currentState.metadata.flags.includes('handoff_requested');

      if (shouldCreateLead) {
        await this.leadService.createLead(conversation, newState, phoneNumber);
        newState.metadata.flags = [...newState.metadata.flags, 'lead_sent'];
        await this.persistence.saveState(conversation.id, newState);
      }

      const followUpScheduled = await this.followUpService.scheduleRecommendationFollowUp(
        conversation.id,
        phoneNumber,
        newState,
        async score => this.persistence.updateConversionScore(conversation.id, score)
      );

      if (followUpScheduled) {
        await this.persistence.saveState(conversation.id, newState);
      }

      return finalResponse;
    } catch (error) {
      logger.error({ error, phoneNumber: maskPhoneNumber(phoneNumber) }, 'Error handling message');
      return 'Desculpe, ocorreu um erro. Por favor, tente novamente.';
    }
  }

  /**
   * Initialize conversation state for new conversations
   */
  private initializeState(conversationId: string, phoneNumber: string): ConversationState {
    return {
      conversationId,
      phoneNumber,
      messages: [],
      quiz: {
        currentQuestion: 1,
        progress: 0,
        answers: {},
        isComplete: false,
      },
      profile: {},
      recommendations: [],
      graph: {
        currentNode: 'greeting',
        nodeHistory: [],
        errorCount: 0,
        loopCount: 0,
      },
      metadata: {
        startedAt: new Date(),
        lastMessageAt: new Date(),
        flags: [],
      },
    };
  }

  private async getOrCreateConversation(phoneNumber: string) {
    let conversation = await prisma.conversation.findFirst({
      where: {
        phoneNumber,
        status: 'active',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          phoneNumber,
          status: 'active',
          currentStep: 'greeting',
        },
      });

      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'started',
        },
      });

      logger.info(
        { conversationId: conversation.id, phoneNumber: maskPhoneNumber(phoneNumber) },
        'New conversation created'
      );
    }

    return conversation;
  }
}
