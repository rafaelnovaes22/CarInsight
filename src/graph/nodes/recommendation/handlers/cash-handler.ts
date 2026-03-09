import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { AIMessage } from '@langchain/core/messages';
import { generateWhatsAppLink } from '../utils/vehicle-helpers';
import { addFlag } from '../../../../utils/state-flags';
import { logger } from '../../../../lib/logger';

export const cashHandler: IntentHandler = {
  name: 'cash',
  priority: 78,

  canHandle({ lowerMessage }: HandlerContext): boolean {
    return /[àa]\s*vista|a vista|pagamento.*vista|pagar.*vista|dinheiro|pix/i.test(lowerMessage);
  },

  handle({ state }: HandlerContext): HandlerResult {
    logger.info('RecommendationNode: Cash payment intent detected');
    const waInfo = generateWhatsAppLink(state.profile ?? undefined);
    const linkMessage = waInfo
      ? `\n\n📱 *Fale com nosso consultor para fechar:*\n👉 ${waInfo.link}\n_ou salve o número: ${waInfo.formattedPhone}_`
      : '';

    return {
      handled: true,
      result: {
        messages: [
          new AIMessage(
            `Ótima escolha! 💰 Pagamento à vista tem condições especiais de desconto.\n\nVou direcionar você para nosso consultor que pode passar o melhor valor.${linkMessage}\n\nObrigado por escolher o CarInsight! 🚗`
          ),
        ],
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
          flags: addFlag(state.metadata.flags, 'cash_payment_requested'),
        },
      },
    };
  },
};
