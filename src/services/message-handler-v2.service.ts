import { prisma } from '../lib/prisma';
import { cache } from '../lib/redis';
import { logger } from '../lib/logger';
import { guardrails } from './guardrails.service';
import { conversationGraph } from '../graph/conversation-graph';
import { ConversationState } from '../types/state.types';
import { dataRightsService } from './data-rights.service';

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

      logger.debug({
        conversationId: conversation.id,
        hasCache: !!currentState,
        currentNode: currentState?.graph.currentNode,
      }, 'Processing message with LangGraph');

      // Execute conversation graph
      const newState = await conversationGraph.invoke({
        conversationId: conversation.id,
        phoneNumber,
        message: sanitizedMessage,
        currentState,
      });

      // Get bot response
      const response = conversationGraph.getLastResponse(newState);

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
