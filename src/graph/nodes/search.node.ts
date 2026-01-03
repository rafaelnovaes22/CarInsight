import { IGraphState } from '../../types/graph.types';
import { AIMessage } from '@langchain/core/messages';
import { logger } from '../../lib/logger';
import { vehicleSearchAdapter } from '../../services/vehicle-search-adapter.service';

/**
 * SearchNode - Find vehicles matching customer profile using SQL search + AI Reranker
 * (Simplified: removed vector search, uses SQL-based adapter)
 */
export async function searchNode(state: IGraphState): Promise<Partial<IGraphState>> {
  logger.info({ profile: state.profile }, 'SearchNode: Searching vehicles');

  if (!state.profile) {
    logger.error('SearchNode: No profile available');
    return {
      messages: [new AIMessage('Ops! Algo deu errado. Vamos recomeçar?')],
      metadata: {
        ...state.metadata,
        errorCount: state.metadata.errorCount + 1,
        lastMessageAt: Date.now(),
      },
      next: 'greeting',
    };
  }

  const profile = state.profile;

  try {
    // Build search query from profile
    const searchQuery =
      [profile.vehicleType !== 'qualquer' ? profile.vehicleType : '', profile.usagePattern || '']
        .filter(Boolean)
        .join(' ') || 'carro';

    const recommendations = await vehicleSearchAdapter.search(searchQuery, {
      maxPrice: profile.budget,
      minYear: profile.minYear,
      maxKm: profile.maxKm,
      bodyType: profile.vehicleType !== 'qualquer' ? profile.vehicleType : undefined,
      limit: 5,
    });

    logger.info(
      {
        vehiclesFound: recommendations.length,
        topScores: recommendations.map(v => v.matchScore),
      },
      'SearchNode: Vehicles found'
    );

    if (recommendations.length === 0) {
      return {
        messages: [
          new AIMessage(
            `Desculpe, não encontrei veículos que atendam exatamente suas necessidades no momento. 😔\n\nMas nossa equipe pode ajudar!\n\nDigite "vendedor" para falar com um especialista que pode buscar opções especiais para você.`
          ),
        ],
        recommendations: [],
        next: 'recommendation',
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      };
    }

    return {
      recommendations: recommendations,
      next: 'recommendation',
      metadata: {
        ...state.metadata,
        lastMessageAt: Date.now(),
      },
    };
  } catch (error) {
    logger.error({ error }, 'SearchNode: Error searching vehicles');

    return {
      messages: [
        new AIMessage('Desculpe, houve um erro ao buscar veículos. Por favor, tente novamente.'),
      ],
      metadata: {
        ...state.metadata,
        errorCount: state.metadata.errorCount + 1,
        lastMessageAt: Date.now(),
      },
      next: 'greeting',
    };
  }
}
