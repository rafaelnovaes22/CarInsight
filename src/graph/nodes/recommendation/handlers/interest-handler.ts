import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { logger } from '../../../../lib/logger';

export const interestHandler: IntentHandler = {
  name: 'interest',
  priority: 60,

  canHandle({ lowerMessage }: HandlerContext): boolean {
    const hasNegativePreference = /\bn[ãa]o\s+(gostei|quero|curti)\b/i.test(lowerMessage);
    if (hasNegativePreference) return false;
    return /gostei|interessei|quero esse|quero o|vou levar|fechar|comprar/i.test(lowerMessage);
  },

  handle({ state }: HandlerContext): HandlerResult {
    logger.info('RecommendationNode: Interest intent detected -> negotiation');
    return {
      handled: true,
      result: {
        next: 'negotiation',
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      },
    };
  },
};
