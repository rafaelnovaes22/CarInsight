/**
 * Data Rights Service - LGPD Compliance
 * Gerencia direitos dos titulares de dados (Art. 18 LGPD)
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface DataExportResult {
  solicitacao: string;
  telefone: string;
  conversa?: unknown;
  mensagens: unknown[];
  lead?: unknown;
  recomendacoes: unknown[];
  totalRegistros: number;
}

export class DataRightsService {
  /**
   * Exclui todos os dados de um usuário (direito ao esquecimento - LGPD Art. 18, III)
   *
   * @param phoneNumber - Telefone do usuário
   * @returns true se exclusão bem-sucedida
   */
  async deleteUserData(phoneNumber: string): Promise<boolean> {
    try {
      logger.info({ phoneNumber }, 'LGPD: Solicitação de exclusão de dados');

      // Realizar exclusão em transação (tudo ou nada)
      await prisma.$transaction(async tx => {
        // Primeiro, buscar conversationId do usuário
        const conversation = await tx.conversation.findFirst({
          where: { phoneNumber },
          select: { id: true },
        });

        if (!conversation) {
          logger.info({ phoneNumber }, 'LGPD: Nenhuma conversa encontrada para este número');
          return;
        }

        // 1. Deletar mensagens (através da conversa, por causa do cascade)
        const deletedMessages = await tx.message.deleteMany({
          where: { conversationId: conversation.id },
        });

        // 2. Deletar eventos
        const deletedEvents = await tx.event.deleteMany({
          where: { conversationId: conversation.id },
        });

        // 3. Deletar recomendações
        const deletedRecommendations = await tx.recommendation.deleteMany({
          where: { conversationId: conversation.id },
        });

        // 4. Deletar lead (se existir)
        const deletedLeads = await tx.lead.deleteMany({
          where: { phone: phoneNumber },
        });

        // 5. Deletar conversas
        const deletedConversations = await tx.conversation.deleteMany({
          where: { phoneNumber },
        });

        if (conversation) {
          logger.info(
            {
              phoneNumber,
              messages: deletedMessages.count,
              events: deletedEvents.count,
              recommendations: deletedRecommendations.count,
              leads: deletedLeads.count,
              conversations: deletedConversations.count,
            },
            'LGPD: Dados excluídos com sucesso'
          );
        }
      });

      // Log para auditoria (manter registro da solicitação por 5 anos - LGPD Art. 37)
      await this.logDataDeletionRequest(phoneNumber);

      return true;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'LGPD: Erro ao excluir dados');
      return false;
    }
  }

  /**
   * Exporta dados de um usuário (portabilidade - LGPD Art. 18, V)
   *
   * @param phoneNumber - Telefone do usuário
   * @returns Objeto com todos os dados do usuário
   */
  async exportUserData(phoneNumber: string): Promise<DataExportResult> {
    try {
      logger.info({ phoneNumber }, 'LGPD: Solicitação de exportação de dados');

      const [conversation, messages, lead, recommendations] = await Promise.all([
        prisma.conversation.findFirst({
          where: { phoneNumber },
          select: {
            id: true,
            phoneNumber: true,
            status: true,
            currentStep: true,
            startedAt: true,
            lastMessageAt: true,
          },
        }),

        prisma.message.findMany({
          where: {
            conversation: {
              phoneNumber: phoneNumber,
            },
          },
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            content: true,
            direction: true,
            timestamp: true,
          },
        }),

        prisma.lead.findFirst({
          where: { phone: phoneNumber },
          select: {
            id: true,
            name: true,
            phone: true,
            budget: true,
            usage: true,
            people: true,
            hasTradeIn: true,
            urgency: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        }),

        prisma.recommendation.findMany({
          where: {
            conversation: {
              phoneNumber: phoneNumber,
            },
          },
          include: {
            vehicle: {
              select: {
                id: true,
                marca: true,
                modelo: true,
                ano: true,
                preco: true,
                descricao: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const exportData: DataExportResult = {
        solicitacao: new Date().toISOString(),
        telefone: phoneNumber,
        conversa: conversation,
        mensagens: messages,
        lead: lead,
        recomendacoes: recommendations,
        totalRegistros:
          messages.length + recommendations.length + (lead ? 1 : 0) + (conversation ? 1 : 0),
      };

      logger.info(
        {
          phoneNumber,
          totalRecords: exportData.totalRegistros,
        },
        'LGPD: Dados exportados com sucesso'
      );

      // Log para auditoria
      await this.logDataExportRequest(phoneNumber);

      return exportData;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'LGPD: Erro ao exportar dados');
      throw error;
    }
  }

  /**
   * Verifica se um usuário possui dados no sistema
   *
   * @param phoneNumber - Telefone do usuário
   * @returns true se usuário possui dados
   */
  async hasUserData(phoneNumber: string): Promise<boolean> {
    try {
      const counts = await Promise.all([
        prisma.conversation.count({ where: { phoneNumber } }),
        prisma.lead.count({ where: { phone: phoneNumber } }),
      ]);

      return counts.some(count => count > 0);
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Erro ao verificar dados do usuário');
      return false;
    }
  }

  /**
   * Registra solicitação de exclusão para auditoria
   * (Registro deve ser mantido por 5 anos - LGPD Art. 37)
   */
  private async logDataDeletionRequest(phoneNumber: string): Promise<void> {
    try {
      // TODO: Criar tabela DataRightRequest no schema se necessário
      // Temporariamente, apenas log
      logger.info(
        {
          type: 'DATA_DELETION',
          phoneNumber,
          timestamp: new Date().toISOString(),
        },
        'LGPD: Registro de solicitação de exclusão'
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao registrar solicitação de exclusão');
    }
  }

  /**
   * Registra solicitação de exportação para auditoria
   */
  private async logDataExportRequest(phoneNumber: string): Promise<void> {
    try {
      logger.info(
        {
          type: 'DATA_EXPORT',
          phoneNumber,
          timestamp: new Date().toISOString(),
        },
        'LGPD: Registro de solicitação de exportação'
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao registrar solicitação de exportação');
    }
  }

  /**
   * Limpa dados antigos (retenção automática - 90 dias de inatividade)
   * Deve ser executado via cron job diário
   */
  async cleanupInactiveData(): Promise<number> {
    try {
      const RETENTION_DAYS = 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      logger.info({ cutoffDate }, 'LGPD: Iniciando limpeza de dados antigos');

      // Encontrar conversas inativas
      const inactiveConversations = await prisma.conversation.findMany({
        where: {
          lastMessageAt: { lt: cutoffDate },
          status: { not: 'active' }, // Não deletar conversas ativas
        },
        select: { phoneNumber: true },
      });

      let deletedCount = 0;

      // Deletar dados de cada conversa inativa
      for (const { phoneNumber } of inactiveConversations) {
        const success = await this.deleteUserData(phoneNumber);
        if (success) deletedCount++;
      }

      logger.info(
        {
          deletedCount,
          totalInactive: inactiveConversations.length,
        },
        'LGPD: Limpeza de dados concluída'
      );

      return deletedCount;
    } catch (error) {
      logger.error({ error }, 'LGPD: Erro na limpeza de dados antigos');
      return 0;
    }
  }
}

export const dataRightsService = new DataRightsService();
