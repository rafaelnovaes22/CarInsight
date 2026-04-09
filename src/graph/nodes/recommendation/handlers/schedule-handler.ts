import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { AIMessage } from '@langchain/core/messages';
import { getRandomVariation } from '../../../../config/conversation-style';
import { addFlag } from '../../../../utils/state-flags';
import { generateWhatsAppLink } from '../utils/vehicle-helpers';
import { logger } from '../../../../lib/logger';

export const scheduleHandler: IntentHandler = {
  name: 'schedule',
  priority: 100,

  canHandle({ lowerMessage }: HandlerContext): boolean {
    return (
      lowerMessage.includes('agendar') ||
      lowerMessage.includes('visita') ||
      lowerMessage.includes('test drive')
    );
  },

  handle({ state }: HandlerContext): HandlerResult {
    logger.info('RecommendationNode: Visit requested');
    const waInfo = generateWhatsAppLink(state.profile ?? undefined);
    const linkMessage = waInfo
      ? `\n\n📱 *Fale com nosso consultor:*\n👉 ${waInfo.link}\n_ou salve o número: ${waInfo.formattedPhone}_`
      : '';

    return {
      handled: true,
      result: {
        messages: [
          new AIMessage(
            `${getRandomVariation(['Ótimo!', 'Maravilha!', 'Excelente!'])} 🎉\n\nVou pedir pro nosso consultor agendar sua visita rapidinho.${linkMessage}\n\n_Ele confirma o horário com você, tá bom?_\n\nObrigado por escolher a Inovais! 🚗`
          ),
        ],
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
          flags: addFlag(state.metadata.flags, 'visit_requested'),
        },
      },
    };
  },
};
