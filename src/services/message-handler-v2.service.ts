import { prisma } from '../lib/prisma';
import { cache } from '../lib/redis';
import { logger } from '../lib/logger';
import { guardrails } from './guardrails.service';
import { conversationGraph } from '../graph/conversation-graph';
import { langGraphConversation } from '../graph/langgraph-conversation';
import { ConversationState } from '../types/state.types';
import { dataRightsService } from './data-rights.service';
import { featureFlags } from '../lib/feature-flags';
import { conversationalHandler } from './conversational-handler.service';
import { getClientName, getBusinessHours, clientConfig } from '../config/client.config';
import { getInitialGreeting } from '../config/disclosure.messages';

/**
 * MessageHandlerV2 - New implementation using LangGraph
 */
export class MessageHandlerV2 {
  async handleMessage(phoneNumber: string, message: string): Promise<string> {
    try {
      // 🛡️ GUARDRAIL: Validate input
      const inputValidation = guardrails.validateInput(phoneNumber, message);
      if (!inputValidation.allowed) {
        logger.warn({ phoneNumber, reason: inputValidation.reason }, 'Input blocked by guardrails');
        return inputValidation.reason || 'Desculpe, não consegui processar sua mensagem.';
      }

      // Use sanitized input
      const sanitizedMessage = inputValidation.sanitizedInput || message;
      const lowerMessage = sanitizedMessage.toLowerCase().trim();

      // 🔄 Check for exit/restart commands (available at any time)
      const exitCommands = ['sair', 'encerrar', 'tchau', 'bye', 'adeus'];
      const restartCommands = ['reiniciar', 'recomeçar', 'voltar', 'cancelar', 'reset', 'nova busca'];
      const greetingCommands = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'hello', 'hi'];

      if (exitCommands.some(cmd => lowerMessage.includes(cmd))) {
        await this.resetConversation(phoneNumber);
        logger.info({ phoneNumber }, 'User requested exit');
        return `Obrigado por usar a ${getClientName()}! 👋

Foi um prazer ajudar você.

Se precisar de algo, é só enviar uma mensagem novamente! 😊

Até logo! 🚗`;
      }

      if (restartCommands.some(cmd => lowerMessage.includes(cmd))) {
        await this.resetConversation(phoneNumber);
        logger.info({ phoneNumber }, 'User requested restart');
        return `🔄 Conversa reiniciada!

👋 Olá! Sou a ${clientConfig.botConfig.assistantName} da *${getClientName()}*.

🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.

💡 _A qualquer momento, digite *sair* para encerrar a conversa._

Para começar, qual é o seu nome?`;
      }

      // 👋 Check for greetings (restart conversation if in the middle)
      const isGreeting = greetingCommands.some(cmd => lowerMessage === cmd || lowerMessage.startsWith(cmd + ' ') || lowerMessage.startsWith(cmd + ','));
      if (isGreeting) {
        // Check if there's an existing conversation
        const existingConversation = await prisma.conversation.findFirst({
          where: { phoneNumber, status: 'active' },
        });

        if (existingConversation) {
          await this.resetConversation(phoneNumber);
          logger.info({ phoneNumber }, 'User sent greeting, restarting conversation');
        }

        return `👋 Olá! Sou a ${clientConfig.botConfig.assistantName} da *${getClientName()}*.

🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.

💡 _A qualquer momento, digite *sair* para encerrar a conversa._

Para começar, qual é o seu nome?`;
      }

      // 🔒 LGPD: Check for data rights commands
      const lgpdResponse = await this.handleDataRightsCommands(phoneNumber, sanitizedMessage);
      if (lgpdResponse) {
        return lgpdResponse;
      }

      // Get or create conversation
      let conversation = await this.getOrCreateConversation(phoneNumber);

      // Log incoming message to database
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'incoming',
          content: sanitizedMessage,
          messageType: 'text',
        },
      });

      // Load state from cache
      const stateKey = `conversation:${conversation.id}:state`;
      const cachedStateJson = await cache.get(stateKey);
      let currentState: ConversationState | undefined;

      if (cachedStateJson) {
        try {
          currentState = JSON.parse(cachedStateJson);
          // Restore Date objects
          currentState.metadata.startedAt = new Date(currentState.metadata.startedAt);
          currentState.metadata.lastMessageAt = new Date(currentState.metadata.lastMessageAt);
          currentState.messages = currentState.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        } catch (error) {
          logger.error({ error }, 'Error parsing cached state');
          currentState = undefined;
        }
      }

      // 🚦 FEATURE FLAG: Decide between conversational or quiz mode
      const useConversational = featureFlags.shouldUseConversationalMode(phoneNumber);
      const useLangGraph = featureFlags.isEnabled('USE_LANGGRAPH', phoneNumber);

      logger.info({
        conversationId: conversation.id,
        phoneNumber: phoneNumber.substring(0, 8) + '****',
        useConversational,
        useLangGraph,
        hasCache: !!currentState,
        currentNode: currentState?.graph.currentNode,
      }, 'Routing decision');

      let newState: ConversationState;
      let response: string;

      if (useLangGraph || useConversational) {
        // 🆕 Use integrated LangGraph + VehicleExpertAgent
        logger.debug({ conversationId: conversation.id }, 'Processing with LangGraph (integrated mode)');

        // Initialize state if new conversation
        if (!currentState) {
          currentState = this.initializeState(conversation.id, phoneNumber);
        }

        const result = await langGraphConversation.processMessage(sanitizedMessage, currentState);
        newState = result.newState;
        response = result.response;

      } else {
        // 📋 Use legacy quiz mode (old LangGraph)
        logger.debug({ conversationId: conversation.id }, 'Processing with legacy quiz mode');

        newState = await conversationGraph.invoke({
          conversationId: conversation.id,
          phoneNumber,
          message: sanitizedMessage,
          currentState,
        });

        response = conversationGraph.getLastResponse(newState);
      }

      // 🛡️ GUARDRAIL: Validate output
      const outputValidation = guardrails.validateOutput(response);
      let finalResponse = response;

      if (!outputValidation.allowed) {
        logger.error({ conversationId: conversation.id, reason: outputValidation.reason }, 'Output blocked by guardrails');
        finalResponse = 'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente ou digite "vendedor" para falar com nossa equipe.';
      }

      // Save state to cache (24h TTL)
      await cache.set(stateKey, JSON.stringify(newState), 86400);

      // Update conversation in database
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentStep: newState.graph.currentNode,
          lastMessageAt: new Date(),
          quizAnswers: newState.quiz.isComplete ? JSON.stringify(newState.quiz.answers) : null,
          profileData: newState.profile ? JSON.stringify(newState.profile) : null,
        },
      });

      // Log outgoing message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'outgoing',
          content: finalResponse,
          messageType: 'text',
        },
      });

      // If quiz is complete, log event
      if (newState.quiz.isComplete && !currentState?.quiz.isComplete) {
        await prisma.event.create({
          data: {
            conversationId: conversation.id,
            eventType: 'quiz_completed',
            metadata: JSON.stringify({ answers: newState.quiz.answers }),
          },
        });
      }

      // If recommendations were generated, save them
      if (newState.recommendations.length > 0 && (!currentState || currentState.recommendations.length === 0)) {
        for (const rec of newState.recommendations) {
          await prisma.recommendation.create({
            data: {
              conversationId: conversation.id,
              vehicleId: rec.vehicleId,
              matchScore: rec.matchScore,
              reasoning: rec.reasoning,
            },
          }).catch(error => {
            // Ignore duplicate errors
            if (!error.message.includes('Unique constraint')) {
              logger.error({ error }, 'Error saving recommendation');
            }
          });
        }
      }

      // Create lead if conversation reached recommendation stage
      if (newState.graph.currentNode === 'recommendation' &&
        newState.metadata.flags.includes('visit_requested') &&
        !currentState?.metadata.flags.includes('visit_requested')) {
        await this.createLead(conversation, newState);
      }

      return finalResponse;

    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error handling message');
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
      profile: {}, // Initialize as empty object instead of null
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
    // Check for existing active conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        phoneNumber,
        status: 'active',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.conversation.create({
        data: {
          phoneNumber,
          status: 'active',
          currentStep: 'greeting',
        },
      });

      // Log event
      await prisma.event.create({
        data: {
          conversationId: conversation.id,
          eventType: 'started',
        },
      });

      logger.info({ conversationId: conversation.id, phoneNumber }, 'New conversation created');
    }

    return conversation;
  }

  private async createLead(conversation: any, state: ConversationState) {
    try {
      const answers = state.quiz.answers;
      const profile = state.profile;

      await prisma.lead.create({
        data: {
          conversationId: conversation.id,
          name: conversation.customerName || 'Cliente WhatsApp',
          phone: conversation.phoneNumber,
          budget: answers.budget || profile?.budget || null,
          usage: answers.usage || null,
          people: answers.people || null,
          hasTradeIn: answers.hasTradeIn || false,
          urgency: answers.urgency || null,
          status: 'new',
          source: 'whatsapp_bot',
        },
      });

      logger.info({ conversationId: conversation.id }, 'Lead created');
    } catch (error) {
      logger.error({ error, conversationId: conversation.id }, 'Error creating lead');
    }
  }

  /**
   * Reset/clear conversation for a phone number
   */
  private async resetConversation(phoneNumber: string): Promise<void> {
    try {
      // Find all conversations for this phone
      const conversations = await prisma.conversation.findMany({
        where: { phoneNumber },
      });

      // Clear cache for each conversation
      for (const conv of conversations) {
        const stateKey = `conversation:${conv.id}:state`;
        await cache.del(stateKey);
      }

      // Delete or mark conversations as closed
      await prisma.conversation.updateMany({
        where: {
          phoneNumber,
          status: 'active'
        },
        data: {
          status: 'closed',
          closedAt: new Date()
        }
      });

      logger.info({ phoneNumber, count: conversations.length }, 'Conversation reset');
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Error resetting conversation');
    }
  }

  /**
   * LGPD Compliance: Handle data rights commands
   * Art. 18 - Direitos do titular (esquecimento, portabilidade)
   */
  private async handleDataRightsCommands(phoneNumber: string, message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase().trim();

    // Check for pending confirmation
    const confirmationKey = `lgpd:confirmation:${phoneNumber}`;
    const pendingAction = await cache.get(confirmationKey);

    // Handle confirmation responses
    if (pendingAction) {
      if (lowerMessage === 'sim') {
        await cache.del(confirmationKey);

        if (pendingAction === 'DELETE_DATA') {
          logger.info({ phoneNumber }, 'LGPD: User confirmed data deletion');
          const success = await dataRightsService.deleteUserData(phoneNumber);

          if (success) {
            return '✅ Seus dados foram excluídos com sucesso!\n\nObrigado por usar a FaciliAuto. Se precisar de algo no futuro, estaremos aqui! 👋';
          } else {
            return '❌ Desculpe, houve um erro ao excluir seus dados. Por favor, entre em contato com nosso suporte: suporte@faciliauto.com.br';
          }
        }
      } else if (lowerMessage === 'não' || lowerMessage === 'nao' || lowerMessage === 'cancelar') {
        await cache.del(confirmationKey);
        return '✅ Operação cancelada. Como posso ajudar você?';
      } else {
        return '⚠️ Por favor, responda *SIM* para confirmar ou *NÃO* para cancelar.';
      }
    }

    // Check for data deletion command
    if (lowerMessage.includes('deletar meus dados') ||
      lowerMessage.includes('excluir meus dados') ||
      lowerMessage.includes('remover meus dados') ||
      lowerMessage.includes('apagar meus dados')) {

      logger.info({ phoneNumber }, 'LGPD: Data deletion request received');

      // Check if user has data
      const hasData = await dataRightsService.hasUserData(phoneNumber);
      if (!hasData) {
        return '✅ Não encontramos dados associados ao seu número.';
      }

      // Set pending confirmation (expires in 5 minutes)
      await cache.set(confirmationKey, 'DELETE_DATA', 300);

      return `⚠️ *Confirmação de Exclusão de Dados*

Você solicitou a exclusão de todos os seus dados pessoais (LGPD Art. 18).

Isso incluirá:
• Histórico de conversas
• Recomendações de veículos
• Informações de cadastro

Esta ação é *irreversível*.

Tem certeza que deseja continuar?

Digite *SIM* para confirmar ou *NÃO* para cancelar.

_Esta confirmação expira em 5 minutos._`;
    }

    // Check for data export command
    if (lowerMessage.includes('exportar meus dados') ||
      lowerMessage.includes('baixar meus dados') ||
      lowerMessage.includes('meus dados')) {

      logger.info({ phoneNumber }, 'LGPD: Data export request received');

      try {
        const data = await dataRightsService.exportUserData(phoneNumber);

        // Note: WhatsApp Cloud API can send documents
        // For now, we'll provide a summary
        return `✅ *Seus Dados Pessoais (LGPD Art. 18)*

📊 *Resumo:*
• Total de registros: ${data.totalRegistros}
• Mensagens trocadas: ${data.mensagens.length}
• Recomendações: ${data.recomendacoes.length}
• Status: ${data.conversa?.status || 'N/A'}

📧 Para receber seus dados completos em formato JSON, por favor entre em contato:
• Email: privacidade@faciliauto.com.br
• Assunto: "Exportação de Dados - ${phoneNumber}"

Responderemos em até 15 dias úteis, conforme LGPD.`;
      } catch (error) {
        logger.error({ error, phoneNumber }, 'LGPD: Error exporting data');
        return '❌ Desculpe, houve um erro ao exportar seus dados. Por favor, tente novamente ou contate suporte@faciliauto.com.br';
      }
    }

    // No data rights command detected
    return null;
  }
}
