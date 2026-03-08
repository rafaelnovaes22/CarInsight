import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { logger } from '../../../../lib/logger';

export const financingHandler: IntentHandler = {
  name: 'financing',
  priority: 80,

  canHandle({ lowerMessage }: HandlerContext): boolean {
    return /financ|parcel|entrada|presta[çc]/i.test(lowerMessage);
  },

  handle({ state }: HandlerContext): HandlerResult {
    logger.info('RecommendationNode: Financing intent detected');
    return {
      handled: true,
      result: {
        next: 'financing',
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      },
    };
  },
};
