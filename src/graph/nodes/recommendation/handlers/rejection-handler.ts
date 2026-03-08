import { IntentHandler, HandlerContext, HandlerResult } from './base-handler';
import { AIMessage } from '@langchain/core/messages';
import { getRandomVariation } from '../../../../config/conversation-style';
import { vehicleSearchAdapter } from '../../../../services/vehicle-search-adapter.service';
import { logger } from '../../../../lib/logger';
import { formatRecommendations } from '../utils/formatters';
import {
  isRecommendationRejectionMessage,
  extractRejectedRecommendationIds,
  getVehicleName,
  toShownVehicles,
  profileToSearchFilters,
} from '../utils/vehicle-helpers';

export const rejectionHandler: IntentHandler = {
  name: 'rejection',
  priority: 70,

  canHandle({ state, lowerMessage }: HandlerContext): boolean {
    return state.recommendations.length > 0 && isRecommendationRejectionMessage(lowerMessage);
  },

  async handle({ state, lowerMessage }: HandlerContext): Promise<HandlerResult> {
    const rejectedIds = extractRejectedRecommendationIds(lowerMessage, state.recommendations);

    if (rejectedIds.length === 0) {
      return { handled: false };
    }

    const rejectedSet = new Set(rejectedIds);
    const keptRecommendations = state.recommendations.filter(
      rec => !rejectedSet.has(rec.vehicleId)
    );
    const targetCount = Math.max(state.recommendations.length, 1);
    const replacementsNeeded = Math.max(targetCount - keptRecommendations.length, 0);
    const previouslyExcluded = state.profile?._excludeVehicleIds || [];
    const excludeIds = Array.from(
      new Set([...previouslyExcluded, ...state.recommendations.map(rec => rec.vehicleId)])
    );

    let replacements: any[] = [];
    if (replacementsNeeded > 0) {
      const firstRejected = state.recommendations.find(rec => rejectedSet.has(rec.vehicleId));
      const fallbackBodyType =
        firstRejected?.vehicle?.carroceria || firstRejected?.vehicle?.bodyType || '';
      const filters = profileToSearchFilters(state.profile, fallbackBodyType);
      filters.excludeIds = excludeIds;
      filters.limit = Math.max(replacementsNeeded * 3, 8);

      const replacementQuery = [
        state.profile?.bodyType,
        state.profile?.usage || state.profile?.usoPrincipal,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      try {
        const searchResults = await vehicleSearchAdapter.search(replacementQuery, filters);
        replacements = searchResults
          .filter(rec => !excludeIds.includes(rec.vehicleId))
          .slice(0, replacementsNeeded);
      } catch (error) {
        logger.warn({ error }, 'RecommendationNode: Failed to fetch replacement recommendations');
      }
    }

    const updatedRecommendations = [...keptRecommendations, ...replacements].slice(0, targetCount);

    if (updatedRecommendations.length > 0) {
      const rejectedNames = state.recommendations
        .filter(rec => rejectedSet.has(rec.vehicleId))
        .map(getVehicleName)
        .filter(Boolean);
      const removedText =
        rejectedNames.length > 0
          ? rejectedNames.join(', ')
          : getRandomVariation(['essa opção', 'esse carro', 'essa recomendação']);
      const intro = `Perfeito, tirei ${removedText} da lista. Separei novas opções para você:`;

      return {
        handled: true,
        result: {
          messages: [new AIMessage(`${intro}\n\n${formatRecommendations(updatedRecommendations)}`)],
          recommendations: updatedRecommendations,
          profile: {
            ...state.profile,
            _excludeVehicleIds: Array.from(new Set([...previouslyExcluded, ...rejectedIds])),
            _showedRecommendation: true,
            _lastSearchType: 'recommendation',
            _lastShownVehicles: toShownVehicles(updatedRecommendations),
          },
          metadata: {
            ...state.metadata,
            lastMessageAt: Date.now(),
          },
        },
      };
    }

    return {
      handled: true,
      result: {
        messages: [
          new AIMessage(
            'Sem problemas! Tirei essa opção, mas não encontrei outra com os mesmos critérios agora. Quer ajustar orçamento, ano ou tipo de carro para eu buscar de novo?'
          ),
        ],
        profile: {
          ...state.profile,
          _excludeVehicleIds: Array.from(new Set([...previouslyExcluded, ...rejectedIds])),
          _showedRecommendation: false,
        },
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      },
    };
  },
};
