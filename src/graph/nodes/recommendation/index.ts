import { IGraphState } from '../../../types/graph.types';
import { createNodeTimer } from '../../../lib/node-metrics';
import { AIMessage } from '@langchain/core/messages';
import { getRandomVariation } from '../../../config/conversation-style';
import { handlers } from './handlers';
import { formatRecommendations } from './utils/formatters';

/**
 * RecommendationNode - Present recommendations to customer
 *
 * Refactored from a 680-line monolith into a handler-based architecture.
 * Each intent (schedule, handoff, financing, etc.) is handled by a dedicated handler.
 */
export async function recommendationNode(state: IGraphState): Promise<Partial<IGraphState>> {
  const timer = createNodeTimer('recommendation');

  if (!state.messages.length) {
    timer.logSuccess(state, {});
    return {};
  }

  const lastMessage = state.messages[state.messages.length - 1];

  if (typeof lastMessage.content !== 'string') {
    timer.logSuccess(state, {});
    return {};
  }

  const message = lastMessage.content;
  const lowerMessage = message.toLowerCase();
  const context = { state, message, lowerMessage };

  // Run handlers in priority order
  for (const handler of handlers) {
    if (handler.canHandle(context)) {
      const result = await handler.handle(context);
      if (result.handled && result.result) {
        timer.logSuccess(state, result.result);
        return result.result;
      }
    }
  }

  // Show recommendations if available
  if (state.recommendations.length > 0) {
    const recommendationsMessage = formatRecommendations(state.recommendations);
    const result = {
      messages: [new AIMessage(recommendationsMessage)],
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
    timer.logSuccess(state, result);
    return result;
  }

  // Fallback
  const result = {
    messages: [
      new AIMessage(
        getRandomVariation([
          'Posso te ajudar com algo mais? Se quiser, chamo um vendedor!',
          'Quer ver mais alguma coisa? Ou prefere falar com alguém da equipe?',
          'Tô por aqui se precisar de algo mais, ou posso chamar um atendente humano.',
        ])
      ),
    ],
    metadata: {
      ...state.metadata,
      lastMessageAt: Date.now(),
    },
  };
  timer.logSuccess(state, result);
  return result;
}
