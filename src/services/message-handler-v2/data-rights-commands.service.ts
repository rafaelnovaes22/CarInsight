import { cache } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { maskPhoneNumber } from '../../lib/privacy';
import { dataRightsService } from '../data-rights.service';

export class MessageHandlerDataRightsCommandsService {
  async handle(phoneNumber: string, message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase().trim();
    const confirmationKey = `lgpd:confirmation:${phoneNumber}`;
    const pendingAction = await cache.get(confirmationKey);

    if (pendingAction) {
      if (lowerMessage === 'sim') {
        await cache.del(confirmationKey);

        if (pendingAction === 'DELETE_DATA') {
          logger.info(
            { phoneNumber: maskPhoneNumber(phoneNumber) },
            'LGPD: User confirmed data deletion'
          );
          const success = await dataRightsService.deleteUserData(phoneNumber);

          if (success) {
            return '\u2705 Seus dados foram excluidos com sucesso!\n\nObrigado por usar o CarInsight. Se precisar de algo no futuro, estaremos aqui! \uD83D\uDC4B';
          }

          return '\u274C Desculpe, houve um erro ao excluir seus dados. Por favor, entre em contato com nosso suporte: suporte@faciliauto.com.br';
        }
      } else if (
        lowerMessage === 'nao' ||
        lowerMessage === 'n\u00E3o' ||
        lowerMessage === 'cancelar'
      ) {
        await cache.del(confirmationKey);
        return '\u2705 Operacao cancelada. Como posso ajudar voce?';
      } else {
        return '\u26A0\uFE0F Por favor, responda *SIM* para confirmar ou *NAO* para cancelar.';
      }
    }

    if (
      lowerMessage.includes('deletar meus dados') ||
      lowerMessage.includes('excluir meus dados') ||
      lowerMessage.includes('remover meus dados') ||
      lowerMessage.includes('apagar meus dados')
    ) {
      logger.info(
        { phoneNumber: maskPhoneNumber(phoneNumber) },
        'LGPD: Data deletion request received'
      );

      const hasData = await dataRightsService.hasUserData(phoneNumber);
      if (!hasData) {
        return '\u2705 Nao encontramos dados associados ao seu numero.';
      }

      await cache.set(confirmationKey, 'DELETE_DATA', 300);

      return (
        '\u26A0\uFE0F *Confirmacao de Exclusao de Dados*\n\n' +
        'Voce solicitou a exclusao de todos os seus dados pessoais (LGPD Art. 18).\n\n' +
        'Isso incluira:\n' +
        '\u2022 Historico de conversas\n' +
        '\u2022 Recomendacoes de veiculos\n' +
        '\u2022 Informacoes de cadastro\n\n' +
        'Esta acao e *irreversivel*.\n\n' +
        'Tem certeza que deseja continuar?\n\n' +
        'Digite *SIM* para confirmar ou *NAO* para cancelar.\n\n' +
        '_Esta confirmacao expira em 5 minutos._'
      );
    }

    if (
      lowerMessage.includes('exportar meus dados') ||
      lowerMessage.includes('baixar meus dados') ||
      lowerMessage.includes('meus dados')
    ) {
      logger.info(
        { phoneNumber: maskPhoneNumber(phoneNumber) },
        'LGPD: Data export request received'
      );

      try {
        const data = await dataRightsService.exportUserData(phoneNumber);

        return (
          '\u2705 *Seus Dados Pessoais (LGPD Art. 18)*\n\n' +
          '\uD83D\uDCCA *Resumo:*\n' +
          `\u2022 Total de registros: ${data.totalRegistros}\n` +
          `\u2022 Mensagens trocadas: ${data.mensagens.length}\n` +
          `\u2022 Recomendacoes: ${data.recomendacoes.length}\n` +
          `\u2022 Status: ${data.conversa?.status || 'N/A'}\n\n` +
          '\uD83D\uDCE7 Para receber seus dados completos em formato JSON, por favor entre em contato:\n' +
          '\u2022 Email: privacidade@faciliauto.com.br\n' +
          `\u2022 Assunto: "Exportacao de Dados - ${phoneNumber}"\n\n` +
          'Responderemos em ate 15 dias uteis, conforme LGPD.'
        );
      } catch (error) {
        logger.error(
          { error, phoneNumber: maskPhoneNumber(phoneNumber) },
          'LGPD: Error exporting data'
        );
        return '\u274C Desculpe, houve um erro ao exportar seus dados. Por favor, tente novamente ou contate suporte@faciliauto.com.br';
      }
    }

    return null;
  }
}
