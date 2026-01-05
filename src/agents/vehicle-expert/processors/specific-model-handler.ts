/**
 * Specific Model Handler
 *
 * Handles searches when user mentions a specific model or brand.
 * Includes logic for:
 * - Searching for exact model/brand/year matches
 * - Offering alternative years when exact year not found
 * - Suggesting similar vehicles when model not in stock
 */

import { logger } from '../../../lib/logger';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { exactSearchParser } from '../../../services/exact-search-parser.service';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';
import { formatRecommendations as formatRecommendationsUtil } from '../formatters';
import { capitalize } from '../constants';
import type { HandlerResult } from '../handlers/types';
import { buildResponse } from '../utils/response-builder';
import { inferBodyType } from '../utils/vehicle-inference';

// ============================================================================
// TYPES
// ============================================================================

export interface SpecificModelContext {
  userMessage: string;
  extracted: {
    extracted: Partial<CustomerProfile>;
  };
  updatedProfile: Partial<CustomerProfile>;
  startTime: number;
  /** Function to get recommendations from the agent */
  getRecommendations: (profile: Partial<CustomerProfile>) => Promise<{
    recommendations: VehicleRecommendation[];
  }>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract searchable item from user message
 */
function extractSearchedItem(
  userMessage: string,
  requestedModel?: string,
  extractedModel?: string,
  extractedBrand?: string
): string | undefined {
  let searchedItem = requestedModel || extractedModel || extractedBrand;

  if (!searchedItem) {
    const wordsFromMessage = userMessage
      .toLowerCase()
      .replace(/\d{4}/g, '')
      .replace(/\b(um|uma|o|a|de|do|da|para|pra|quero|tem|tenho|busco|procuro)\b/gi, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)[0];
    searchedItem = wordsFromMessage ? capitalize(wordsFromMessage) : undefined;
  }

  return searchedItem;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle specific model/brand search
 *
 * @param ctx - Specific model context
 * @returns Handler result with response or indication to continue
 */
export async function handleSpecificModel(ctx: SpecificModelContext): Promise<HandlerResult> {
  const { userMessage, extracted, updatedProfile, startTime, getRecommendations } = ctx;

  // Check if user mentioned specific model or brand
  const hasSpecificModel = !!(extracted.extracted.model || extracted.extracted.brand);

  // Parse for exact model+year
  const exactFilters = exactSearchParser.parse(userMessage);
  const hasExactModelYear = !!(exactFilters.model && (exactFilters.year || exactFilters.yearRange));

  // Guard: No specific model or brand mentioned
  if (!hasSpecificModel && !hasExactModelYear) {
    return { handled: false };
  }

  // Guard: User asking for similar, not specific
  if (userMessage.match(/parecid|similar|tipo\s|estilo|como\s|igual/i)) {
    return { handled: false };
  }

  const requestedBrand = extracted.extracted.brand?.toLowerCase();
  const requestedModel = (exactFilters.model || extracted.extracted.model)?.toLowerCase();
  const requestedYear = exactFilters.year;
  const requestedYearRange = exactFilters.yearRange;

  logger.info(
    {
      brand: requestedBrand,
      model: requestedModel,
      year: requestedYear,
      yearRange: requestedYearRange,
      hasExactModelYear,
    },
    'VehicleExpert: Specific model/brand/year mentioned, searching directly'
  );

  // Get recommendations
  const result = await getRecommendations(updatedProfile);

  // Filter for exact matches
  const matchingResults = result.recommendations.filter(rec => {
    const vehicleBrand = rec.vehicle.brand?.toLowerCase() || '';
    const vehicleModel = rec.vehicle.model?.toLowerCase() || '';
    const vehicleYear = rec.vehicle.year;

    if (requestedBrand && !vehicleBrand.includes(requestedBrand)) return false;
    if (requestedModel && !vehicleModel.includes(requestedModel)) return false;
    if (requestedYear && vehicleYear !== requestedYear) return false;
    if (
      requestedYearRange &&
      (vehicleYear < requestedYearRange.min || vehicleYear > requestedYearRange.max)
    ) {
      return false;
    }

    return true;
  });

  logger.info(
    {
      totalResults: result.recommendations.length,
      matchingResults: matchingResults.length,
      requestedBrand,
      requestedModel,
      requestedYear,
    },
    'VehicleExpert: Filtered results for specific brand/model/year'
  );

  // Found matching results
  if (matchingResults.length > 0) {
    const formattedResponse = await formatRecommendationsUtil(
      matchingResults,
      updatedProfile,
      'specific'
    );

    return {
      handled: true,
      response: buildResponse(
        formattedResponse,
        {
          ...extracted.extracted,
          _showedRecommendation: true,
          _lastSearchType: 'specific' as const,
          _lastShownVehicles: matchingResults.map(r => ({
            vehicleId: r.vehicleId,
            brand: r.vehicle.brand,
            model: r.vehicle.model,
            year: r.vehicle.year,
            price: r.vehicle.price,
          })),
        },
        {
          canRecommend: true,
          recommendations: matchingResults,
          nextMode: 'recommendation',
          startTime,
        }
      ),
    };
  }

  // No matches - try alternatives
  const searchedItem = extractSearchedItem(
    userMessage,
    requestedModel,
    extracted.extracted.model,
    extracted.extracted.brand
  );

  const yearText = requestedYear
    ? ` ${requestedYear}`
    : requestedYearRange
      ? ` ${requestedYearRange.min}-${requestedYearRange.max}`
      : '';

  // Check for same model different year
  if (requestedYear && requestedModel) {
    const sameModelResults = result.recommendations.filter(rec => {
      const vehicleModel = rec.vehicle.model?.toLowerCase() || '';
      return vehicleModel.includes(requestedModel);
    });

    if (sameModelResults.length > 0) {
      const availableYears = [...new Set(sameModelResults.map(r => r.vehicle.year))].sort(
        (a, b) => b - a
      );
      const yearsText = availableYears.slice(0, 5).join(', ');
      const isPlural = availableYears.length > 1;

      return {
        handled: true,
        response: buildResponse(
          `Não encontramos ${capitalize(searchedItem || '')}${yearText} disponível. 😕\n\nTemos ${capitalize(searchedItem || '')} ${isPlural ? 'dos anos' : 'do ano'}: ${yearsText}\n\nGostaria de ver ${isPlural ? 'algum desses' : 'esse'}?`,
          {
            ...extracted.extracted,
            _waitingForSuggestionResponse: true,
            _searchedItem: searchedItem,
            _availableYears: availableYears,
          },
          {
            nextMode: 'clarification',
            startTime,
            confidence: 0.8,
          }
        ),
      };
    }
  }

  // Try to find similar vehicles
  const vehicleDescription = searchedItem
    ? `${capitalize(searchedItem)}${yearText}`
    : `esse modelo${yearText}`;

  const bodyTypeInfo = inferBodyType(searchedItem || '');

  if (bodyTypeInfo) {
    logger.info(
      { searchedItem, inferredBodyType: bodyTypeInfo.type },
      'Searching for similar vehicles of same type'
    );

    const { recommendations: similarResults } = await vehicleSearchAdapter.search(`${bodyTypeInfo.type} usado`, {
      bodyType: bodyTypeInfo.type,
      limit: 10,
    });

    if (similarResults.length > 0) {
      similarResults.sort((a, b) => a.vehicle.price - b.vehicle.price);

      const firstPrice = similarResults[0].vehicle.price.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
      });

      return {
        handled: true,
        response: buildResponse(
          `Não temos ${vehicleDescription} disponível no momento. 😕\n\nMas encontrei algumas opções de ${bodyTypeInfo.name} similares (a partir de R$ ${firstPrice}).\n\nGostaria de ver essas opções?`,
          {
            ...extracted.extracted,
            _waitingForSimilarApproval: true,
            _pendingSimilarResults: similarResults.slice(0, 5),
          },
          {
            nextMode: 'clarification',
            startTime,
            confidence: 0.85,
          }
        ),
      };
    }
  }

  // No similar vehicles - ask for preferences
  return {
    handled: true,
    response: buildResponse(
      `Não temos ${vehicleDescription} disponível no estoque no momento. 😕\n\nQuer responder algumas perguntas rápidas para eu te dar sugestões personalizadas?`,
      {
        ...extracted.extracted,
        _waitingForSuggestionResponse: true,
        _searchedItem: searchedItem,
      },
      {
        nextMode: 'clarification',
        startTime,
        confidence: 0.8,
      }
    ),
  };
}
