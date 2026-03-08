import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { AIMessage } from '@langchain/core/messages';
import { logger } from '../../../../lib/logger';

export const criteriaHandler: IntentHandler = {
  name: 'criteria',
  priority: 40,

  canHandle({ lowerMessage }: HandlerContext): boolean {
    return (
      /crit[eé]rio/i.test(lowerMessage) ||
      /prefer[eê]ncia/i.test(lowerMessage) ||
      /que (voc[eê]|vc) (sabe|tem|coletou)/i.test(lowerMessage) ||
      /quais (s[aã]o|eram) (os|as)/i.test(lowerMessage)
    );
  },

  handle({ state }: HandlerContext): HandlerResult {
    const profile = state.profile || {};
    const collected: string[] = [];
    const missing: string[] = [];

    if (profile.budget)
      collected.push(`💰 Orçamento: até R$ ${profile.budget.toLocaleString('pt-BR')}`);
    else missing.push('orçamento');

    if (profile.usage || profile.usoPrincipal)
      collected.push(`🎯 Uso: ${profile.usage || profile.usoPrincipal}`);
    else missing.push('uso principal');

    if (profile.bodyType) collected.push(`🚗 Tipo: ${profile.bodyType}`);
    if (profile.minYear) collected.push(`📅 Ano mínimo: ${profile.minYear}`);
    if (profile.transmission) collected.push(`⚙️ Câmbio: ${profile.transmission}`);

    let response = '';
    if (collected.length > 0) {
      response += `Até agora, tenho essas informações:\n${collected.join('\n')}`;
    }
    if (missing.length > 0) {
      response += `\n\nAinda preciso saber: *${missing.join('* e *')}*`;
      response += '\n\nPode me contar?';
    }

    logger.info(
      { collected: collected.length, missing },
      'RecommendationNode: Criteria question detected, redirecting to discovery'
    );

    return {
      handled: true,
      result: {
        messages: [new AIMessage(response)],
        next: 'discovery',
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      },
    };
  },
};
