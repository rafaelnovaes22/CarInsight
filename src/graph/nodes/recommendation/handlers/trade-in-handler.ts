import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { logger } from '../../../../lib/logger';

export const tradeInHandler: IntentHandler = {
  name: 'trade-in',
  priority: 75,

  canHandle({ lowerMessage }: HandlerContext): boolean {
    return /troca|meu carro|tenho um|minha|dar na troca/i.test(lowerMessage);
  },

  handle({ state }: HandlerContext): HandlerResult {
    logger.info('RecommendationNode: Trade-in intent detected');
    return {
      handled: true,
      result: {
        next: 'trade_in',
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      },
    };
  },
};
