import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { AIMessage } from '@langchain/core/messages';
import { getHandoffMessage } from '../../../../config/conversation-style';
import { detectHandoffRequest, addHandoffFlag } from '../../../../utils/handoff-detector';
import { generateWhatsAppLink } from '../utils/vehicle-helpers';
import { logger } from '../../../../lib/logger';

export const handoffHandler: IntentHandler = {
  name: 'handoff',
  priority: 90,

  canHandle({ message }: HandlerContext): boolean {
    return detectHandoffRequest(message).isHandoffRequest;
  },

  handle({ state }: HandlerContext): HandlerResult {
    logger.info('RecommendationNode: Human handoff requested');
    const waInfo = generateWhatsAppLink(state.profile ?? undefined);
    const linkMessage = waInfo
      ? `\n\n📱 *Fale com nosso consultor:*\n👉 ${waInfo.link}\n_ou salve o número: ${waInfo.formattedPhone}_`
      : '';

    return {
      handled: true,
      result: {
        messages: [
          new AIMessage(
            `${getHandoffMessage()}${linkMessage}\n\n_Já passei suas informações pra ele!_`
          ),
        ],
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
          flags: addHandoffFlag(state.metadata.flags),
        },
      },
    };
  },
};
