import { IGraphState } from '../../types/graph.types';
import { AIMessage } from '@langchain/core/messages';
import { logger } from '../../lib/logger';
import { VectorSearchService, VehicleSearchCriteria } from '../../services/vector-search.service';

const vectorSearchService = new VectorSearchService();

/**
 * SearchNode - Find vehicles matching customer profile using vector search
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
    const criteria: VehicleSearchCriteria = {
      budget: profile.budget,
      usage: profile.usagePattern,
      persons: profile.familySize,
      bodyType: profile.vehicleType !== 'qualquer' ? profile.vehicleType : undefined,
      year: profile.minYear,
      mileage: profile.maxKm,
    };

    const scoredVehicles = await vectorSearchService.searchVehicles(criteria, 3);

    logger.info(
      {
        vehiclesFound: scoredVehicles.length,
        topScores: scoredVehicles.map(v => v.matchScore),
      },
      'SearchNode: Vehicles found'
    );

    if (scoredVehicles.length === 0) {
      return {
        messages: [
          new AIMessage(
            `Desculpe, não encontrei veículos que atendam exatamente suas necessidades no momento. 😔\n\nMas nossa equipe pode ajudar!\n\nDigite "vendedor" para falar com um especialista que pode buscar opções especiais para você.`
          ),
        ],
        recommendations: [],
        next: 'recommendation', // State transition
        metadata: {
          ...state.metadata,
          lastMessageAt: Date.now(),
        },
      };
    }

    const topRecommendations = scoredVehicles.map(sv => {
      return {
        vehicleId: sv.id,
        matchScore: sv.matchScore,
        reasoning: sv.matchReasons.join(', '),
        highlights: sv.matchReasons,
        concerns: [],
        vehicle: {
          id: sv.id,
          brand: sv.brand,
          model: sv.model,
          version: sv.version,
          year: sv.year,
          mileage: sv.mileage,
          price: sv.price ?? null,
          fuelType: sv.fuelType,
          transmission: sv.transmission,
          color: sv.color,
          bodyType: profile.vehicleType || 'SUV', // Default or from profile
          imageUrl: sv.photos?.[0] || null,
          detailsUrl: null,
        },
      };
    });

    return {
      recommendations: topRecommendations,
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
      next: 'greeting', // Reset on error
    };
  }
}
