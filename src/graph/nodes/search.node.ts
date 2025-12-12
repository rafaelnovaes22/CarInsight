import { ConversationState, StateUpdate, VehicleRecommendation } from '../../types/state.types';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { VectorSearchService, VehicleSearchCriteria } from '../../services/vector-search.service';

const vectorSearchService = new VectorSearchService();

/**
 * Calculate match score between vehicle and customer profile
 */
function calculateMatchScore(vehicle: any, profile: any): number {
  let score = 100;

  // Price matching (-20 points if over budget)
  const priceFloat = parseFloat(vehicle.preco);
  if (priceFloat > profile.budget * 1.1) {
    score -= 20;
  } else if (priceFloat > profile.budget) {
    score -= 10;
  } else if (priceFloat < profile.budget * 0.7) {
    score -= 5; // Suspiciously cheap
  }

  // Year matching
  if (vehicle.ano < profile.minYear) {
    score -= 15;
  } else if (vehicle.ano >= profile.minYear + 2) {
    score += 5; // Newer is better
  }

  // KM matching
  if (vehicle.km > profile.maxKm) {
    score -= 15;
  } else if (vehicle.km < profile.maxKm * 0.5) {
    score += 5; // Low km is good
  }

  // Type matching
  if (profile.vehicleType !== 'qualquer' && vehicle.tipo) {
    if (vehicle.tipo.toLowerCase() === profile.vehicleType) {
      score += 10;
    } else {
      score -= 5;
    }
  }

  // Usage pattern matching
  if (profile.usagePattern === 'cidade') {
    if (
      vehicle.tipo &&
      (vehicle.tipo.toLowerCase() === 'hatch' || vehicle.tipo.toLowerCase() === 'sedan')
    ) {
      score += 5;
    }
    if (vehicle.combustivel && vehicle.combustivel.toLowerCase().includes('flex')) {
      score += 3;
    }
  }

  if (profile.usagePattern === 'viagem') {
    if (
      vehicle.tipo &&
      (vehicle.tipo.toLowerCase() === 'sedan' || vehicle.tipo.toLowerCase() === 'suv')
    ) {
      score += 5;
    }
  }

  // Family size matching
  if (profile.familySize >= 5) {
    if (
      vehicle.tipo &&
      (vehicle.tipo.toLowerCase() === 'suv' || vehicle.tipo.toLowerCase() === 'sedan')
    ) {
      score += 5;
    }
  }

  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate reasoning for recommendation
 */
function generateReasoning(vehicle: any, profile: any, matchScore: number): string {
  const reasons: string[] = [];

  const priceFloat = parseFloat(vehicle.preco);

  if (priceFloat <= profile.budget) {
    reasons.push('Dentro do orçamento');
  }

  if (vehicle.ano >= profile.minYear + 2) {
    reasons.push('Modelo recente');
  }

  if (vehicle.km < 50000) {
    reasons.push('Baixa quilometragem');
  } else if (vehicle.km < profile.maxKm * 0.7) {
    reasons.push('Quilometragem aceitável');
  }

  if (profile.vehicleType !== 'qualquer' && vehicle.tipo?.toLowerCase() === profile.vehicleType) {
    reasons.push('Exatamente o tipo que você procura');
  }

  if (profile.usagePattern === 'cidade' && vehicle.combustivel?.toLowerCase().includes('flex')) {
    reasons.push('Econômico para uso urbano');
  }

  if (reasons.length === 0) {
    reasons.push('Boa opção custo-benefício');
  }

  return reasons.join(', ');
}

/**
 * SearchNode - Find vehicles matching customer profile using vector search
 */
export async function searchNode(state: ConversationState): Promise<StateUpdate> {
  logger.info(
    { conversationId: state.conversationId, profile: state.profile },
    'SearchNode: Searching vehicles'
  );

  if (!state.profile) {
    logger.error({ conversationId: state.conversationId }, 'SearchNode: No profile available');
    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: 'Ops! Algo deu errado. Vamos recomeçar?',
          timestamp: new Date(),
        },
      ],
      graph: {
        ...state.graph,
        currentNode: 'greeting',
        errorCount: state.graph.errorCount + 1,
      },
    };
  }

  const profile = state.profile;

  try {
    logger.info(
      {
        conversationId: state.conversationId,
        profile,
      },
      'SearchNode: Searching vehicles with vector search'
    );

    // Build search criteria from profile
    const criteria: VehicleSearchCriteria = {
      budget: profile.budget,
      usage: profile.usagePattern,
      persons: profile.familySize,
      bodyType: profile.vehicleType !== 'qualquer' ? profile.vehicleType : undefined,
      year: profile.minYear,
      mileage: profile.maxKm,
    };

    // Use vector search service (with automatic fallback to SQL)
    const scoredVehicles = await vectorSearchService.searchVehicles(criteria, 3);

    logger.info(
      {
        conversationId: state.conversationId,
        vehiclesFound: scoredVehicles.length,
        topScores: scoredVehicles.map(v => v.matchScore),
      },
      'SearchNode: Vehicles found'
    );

    if (scoredVehicles.length === 0) {
      // No vehicles found
      return {
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: `Desculpe, não encontrei veículos que atendam exatamente suas necessidades no momento. 😔\n\nMas nossa equipe pode ajudar!\n\nDigite "vendedor" para falar com um especialista que pode buscar opções especiais para você.`,
            timestamp: new Date(),
          },
        ],
        recommendations: [],
        graph: {
          ...state.graph,
          currentNode: 'recommendation',
          previousNode: 'search',
          nodeHistory: [...state.graph.nodeHistory, 'search'],
        },
      };
    }

    // Convert vector search results to recommendation format
    const topRecommendations = scoredVehicles.map(sv => {
      return {
        vehicleId: sv.id,
        matchScore: sv.matchScore,
        reasoning: sv.matchReasons.join(', '),
        highlights: sv.matchReasons,
        concerns: [],
        vehicle: {
          id: sv.id,
          marca: sv.brand,
          modelo: sv.model,
          versao: sv.version,
          ano: sv.year,
          km: sv.mileage,
          preco: sv.price.toString(),
          combustivel: sv.fuelType,
          cambio: sv.transmission,
          cor: sv.color,
          opcionais: sv.features,
          fotos: sv.photos || [],
        },
      };
    });

    logger.info(
      {
        conversationId: state.conversationId,
        topScores: topRecommendations.map(r => r.matchScore),
      },
      'SearchNode: Top recommendations selected'
    );

    return {
      recommendations: topRecommendations,
      graph: {
        ...state.graph,
        currentNode: 'recommendation',
        previousNode: 'search',
        nodeHistory: [...state.graph.nodeHistory, 'search'],
      },
      metadata: {
        ...state.metadata,
        lastMessageAt: new Date(),
      },
    };
  } catch (error) {
    logger.error(
      { error, conversationId: state.conversationId },
      'SearchNode: Error searching vehicles'
    );

    return {
      messages: [
        ...state.messages,
        {
          role: 'assistant',
          content: 'Desculpe, houve um erro ao buscar veículos. Por favor, tente novamente.',
          timestamp: new Date(),
        },
      ],
      graph: {
        ...state.graph,
        errorCount: state.graph.errorCount + 1,
      },
    };
  }
}
