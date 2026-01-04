/**
 * Want Others Handler
 *
 * Handles "want others" intent when user wants to see alternative vehicles
 * after viewing a recommendation.
 *
 * Responsibilities:
 * - Detect price adjustment intent (cheaper/more expensive)
 * - Infer body type from shown vehicle
 * - Search for similar vehicles excluding already shown
 * - Format and return new recommendations
 */

import { logger } from '../../../lib/logger';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';
import { formatRecommendations as formatRecommendationsUtil } from '../formatters';
import type { ShownVehicle, HandlerResult } from '../handlers/types';
import { buildResponse } from '../utils/response-builder';
import { inferBodyType, determineCategory } from '../utils/vehicle-inference';

// ============================================================================
// TYPES
// ============================================================================

export interface WantOthersContext {
  userMessage: string;
  lastShownVehicles: ShownVehicle[];
  lastSearchType?: 'specific' | 'recommendation' | 'similar';
  extracted: {
    extracted: Partial<CustomerProfile>;
  };
  updatedProfile: Partial<CustomerProfile>;
  startTime: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Detect price adjustment intent from message
 */
function detectPriceIntent(message: string): 'cheaper' | 'expensive' | 'none' {
  const msgLower = message.toLowerCase();

  const isCheaper =
    /barato|em conta|menos|menor|acess[íi]vel|abaixo/i.test(msgLower) &&
    !msgLower.includes('menos caro de manter');

  const isExpensive =
    /caro|alto|melhor|maior|acima|top|premium/i.test(msgLower) && !msgLower.includes('muito caro');

  if (isCheaper) return 'cheaper';
  if (isExpensive) return 'expensive';
  return 'none';
}

/**
 * Calculate price range for search based on reference and intent
 */
function calculatePriceRange(
  referencePrice: number,
  userBudget: number | undefined,
  priceIntent: 'cheaper' | 'expensive' | 'none'
): { min: number; max: number } {
  let max = userBudget || Math.round(referencePrice * 1.3);
  let min = Math.round(referencePrice * 0.7);

  if (priceIntent === 'cheaper') {
    max = Math.min(referencePrice, userBudget || referencePrice);
    min = Math.round(referencePrice * 0.5);
  } else if (priceIntent === 'expensive') {
    min = referencePrice;
    max = userBudget || Math.round(referencePrice * 1.8);
  }

  return { min, max };
}

/**
 * Build search query based on body type and category
 */
function buildSearchQuery(bodyType: string, category: string): string {
  if (bodyType && category) {
    return `${bodyType} ${category} usado`;
  }
  if (bodyType) {
    return `${bodyType} usado`;
  }
  return 'carro usado';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle "want others" intent - search for similar/alternative vehicles
 *
 * @param ctx - Want others context
 * @returns Handler result with response or indication to continue
 */
export async function handleWantOthers(ctx: WantOthersContext): Promise<HandlerResult> {
  const { userMessage, lastShownVehicles, lastSearchType, extracted, updatedProfile, startTime } =
    ctx;

  // Guard: Need at least one shown vehicle
  if (!lastShownVehicles || lastShownVehicles.length === 0) {
    return { handled: false };
  }

  const firstVehicle = lastShownVehicles[0];
  const wasSpecificSearch = lastSearchType === 'specific';

  logger.info(
    { userMessage, lastShownVehicles, extractedBudget: extracted.extracted.budget },
    'User wants other options after seeing recommendation'
  );

  // 1. Detect price intent
  const priceIntent = detectPriceIntent(userMessage);
  if (priceIntent !== 'none') {
    logger.info(`User specifically asked for ${priceIntent.toUpperCase()} options`);
  }

  // 2. Calculate price range
  const referencePrice = firstVehicle.price;
  const userBudget = extracted.extracted.budget || extracted.extracted.budgetMax;
  const priceRange = calculatePriceRange(referencePrice, userBudget, priceIntent);

  // 3. Infer body type
  const bodyTypeInfo = inferBodyType(firstVehicle.model, firstVehicle.bodyType);
  const bodyType = bodyTypeInfo ? bodyTypeInfo.type : '';
  const category = determineCategory(firstVehicle.model, bodyType, referencePrice);

  // 4. Build search query
  const searchQuery = buildSearchQuery(bodyType, category);

  logger.info(
    {
      searchQuery,
      searchMaxPrice: priceRange.max,
      searchMinPrice: priceRange.min,
      userBudget,
      referencePrice,
      bodyType,
    },
    'Searching for similar vehicles by type'
  );

  // 5. Search for similar vehicles
  const similarResults = await vehicleSearchAdapter.search(searchQuery, {
    maxPrice: priceRange.max,
    minYear: firstVehicle.year - 5,
    bodyType: bodyType || undefined,
    limit: 20,
  });

  // 6. Filter out already shown vehicles
  const shownVehicleIds = lastShownVehicles.map(v => v.vehicleId);
  const newResults = similarResults.filter(r => {
    if (shownVehicleIds.includes(r.vehicleId)) return false;
    if (bodyType && r.vehicle?.bodyType) {
      const resultBodyType = r.vehicle.bodyType.toLowerCase();
      if (!resultBodyType.includes(bodyType)) return false;
    }
    return true;
  });

  // 7. Sort by price (most expensive first - benefits dealership)
  newResults.sort((a, b) => (b.vehicle?.price ?? 0) - (a.vehicle?.price ?? 0));

  // 8. Handle results
  if (newResults.length > 0) {
    const formattedResponse = await formatRecommendationsUtil(
      newResults.slice(0, 5),
      updatedProfile,
      'similar'
    );

    const intro = wasSpecificSearch
      ? `Entendi! Aqui estão outras opções similares ao ${firstVehicle.brand} ${firstVehicle.model}:\n\n`
      : `Sem problemas! Encontrei outras opções para você:\n\n`;

    return {
      handled: true,
      response: buildResponse(
        intro + formattedResponse.replace(/^.*?\n\n/, ''),
        {
          ...extracted.extracted,
          _showedRecommendation: true,
          _lastSearchType: 'recommendation' as const,
          _lastShownVehicles: newResults.slice(0, 5).map(r => ({
            vehicleId: r.vehicleId,
            brand: r.vehicle?.brand || 'N/A',
            model: r.vehicle?.model || 'N/A',
            year: r.vehicle?.year || 0,
            price: r.vehicle?.price ?? 0,
          })),
        },
        {
          canRecommend: true,
          recommendations: newResults.slice(0, 5),
          nextMode: 'recommendation',
          startTime,
        }
      ),
    };
  }

  // No similar vehicles found
  const hasBudget = !!(updatedProfile.budget || updatedProfile.budgetMax);
  const nextQuestion = hasBudget
    ? 'Prefere algum tipo específico (SUV, sedan, hatch) ou tem outra marca em mente?'
    : 'Qual seu orçamento máximo?';

  const missingInfo = hasBudget ? ['bodyType', 'brand'] : ['budget', 'bodyType'];

  return {
    handled: true,
    response: buildResponse(
      `Não encontrei mais opções similares ao ${firstVehicle.brand} ${firstVehicle.model} com esses critérios. 🤔\n\n📋 Me conta: ${nextQuestion}`,
      {
        ...extracted.extracted,
        _showedRecommendation: false,
        _lastShownVehicles: lastShownVehicles,
        _lastSearchType: undefined,
        _waitingForSuggestionResponse: true,
        _excludeVehicleIds: lastShownVehicles.map(v => v.vehicleId),
      },
      {
        needsMoreInfo: missingInfo,
        nextMode: 'discovery',
        startTime,
        confidence: 0.8,
      }
    ),
  };
}
