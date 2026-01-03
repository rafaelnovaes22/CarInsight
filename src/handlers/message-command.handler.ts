import { logger } from '../lib/logger';
import { sessionManager } from '../services/session-manager.service';
import { dataRightsService } from '../services/data-rights.service';
import { cache } from '../lib/redis';

export class MessageCommandHandler {
  private readonly exitCommands = ['sair', 'encerrar', 'tchau', 'bye', 'adeus'];
  private readonly restartCommands = [
    'reiniciar',
    'recomeçar',
    'voltar',
    'cancelar',
    'reset',
    'nova busca',
  ];
  private readonly greetingCommands = [
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

  /**
   * Check for system commands (Exit, Restart) or LGPD commands
   * Returns response string if a command was handled, null otherwise.
   */
  async handleSystemCommands(phoneNumber: string, message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase().trim();

    // 1. Exit Commands
    if (this.exitCommands.some(cmd => lowerMessage.includes(cmd))) {
      await sessionManager.resetConversation(phoneNumber);
      logger.info({ phoneNumber }, 'User requested exit');
      return `Obrigado por usar o CarInsight! 👋

Foi um prazer ajudar você.

Se precisar de algo, é só enviar uma mensagem novamente! 😊

Até logo! 🚗`;
    }

    // 2. Restart Commands
    if (this.restartCommands.some(cmd => lowerMessage.includes(cmd))) {
      await sessionManager.resetConversation(phoneNumber);
      logger.info({ phoneNumber }, 'User requested restart');
      return `🔄 Conversa reiniciada!

👋 Olá! Sou a assistente virtual do *CarInsight*.

🤖 *Importante:* Sou uma inteligência artificial e posso cometer erros. Para informações mais precisas, posso transferir você para nossa equipe humana.

💡 _A qualquer momento, digite *sair* para encerrar a conversa._

Para começar, qual é o seu nome?`;
    }

    // 3. LGPD Commands (delegated to DataRightsService)
    // Note: dataRightsService.handleDataRightsCommands needs slightly different args if reused directly?
    // In original code MessageHandlerV2 had `handleDataRightsCommands` which called `dataRightsService` methods.
    // But here I'm using the `handleDataRightsCommands` logic that WAS in MessageHandlerV2 (lines 620-723).
    // I should move THAT logic here or to DataRightsService.
    // DataRightsService already has `deleteUserData` etc.
    // The "Command Interpretation" logic fits here or in DataRightsService.
    // I'll implement the interpretation logic here to keep DataRightsService pure business logic.

    const lgpdResponse = await this.processDataRightsCommands(phoneNumber, message);
    if (lgpdResponse) {
      return lgpdResponse;
    }

    return null;
  }

  /**
   * Analyze if the message is a greeting
   */
  checkGreeting(message: string): { isGreeting: boolean; isJustGreeting: boolean } {
    const lowerMessage = message.toLowerCase().trim();

    // Check if it's a greeting (start with or exact match)
    const isGreeting = this.greetingCommands.some(
      cmd =>
        lowerMessage === cmd ||
        lowerMessage.startsWith(cmd + ' ') ||
        lowerMessage.startsWith(cmd + ',') ||
        lowerMessage.startsWith(cmd + '!')
    );

    // Check if it's JUST a greeting (exact match)
    const isJustGreeting = this.greetingCommands.some(
      cmd => lowerMessage === cmd || lowerMessage === cmd + '!'
    );

    return { isGreeting, isJustGreeting };
  }

  /**
   * Process LGPD commands interpretation
   * (Logic extracted from MessageHandlerV2.handleDataRightsCommands)
   */
  private async processDataRightsCommands(
    phoneNumber: string,
    message: string
  ): Promise<string | null> {
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
            return '✅ Seus dados foram excluídos com sucesso!\n\nObrigado por usar o CarInsight. Se precisar de algo no futuro, estaremos aqui! 👋';
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
    if (
      lowerMessage.includes('deletar meus dados') ||
      lowerMessage.includes('excluir meus dados') ||
      lowerMessage.includes('remover meus dados') ||
      lowerMessage.includes('apagar meus dados')
    ) {
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
    if (
      lowerMessage.includes('exportar meus dados') ||
      lowerMessage.includes('baixar meus dados') ||
      lowerMessage.includes('meus dados')
    ) {
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

    return null;
  }
}

export const messageCommandHandler = new MessageCommandHandler();
