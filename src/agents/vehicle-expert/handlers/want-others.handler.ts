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
import { prisma } from '../../../lib/prisma';
import { vehicleSearchAdapter } from '../../../services/vehicle-search-adapter.service';
import { CustomerProfile } from '../../../types/state.types';
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
// CATEGORY LISTING (when no vehicles were shown)
// ============================================================================

const CATEGORY_LABELS: Record<string, { name: string; emoji: string }> = {
  suv: { name: 'SUVs', emoji: '🚙' },
  sedan: { name: 'Sedans', emoji: '🚗' },
  hatch: { name: 'Hatches', emoji: '🚘' },
  pickup: { name: 'Pickups', emoji: '🛻' },
  minivan: { name: 'Minivans', emoji: '🚐' },
  moto: { name: 'Motos', emoji: '🏍️' },
};

/**
 * List available vehicle categories when no vehicles were previously shown.
 * Queries the database for category counts and presents them to the user.
 */
async function handleListCategories(ctx: WantOthersContext): Promise<HandlerResult> {
  const { extracted, startTime } = ctx;

  try {
    const categoryCounts = await prisma.vehicle.groupBy({
      by: ['carroceria'],
      _count: { id: true },
      where: { disponivel: true },
    });

    if (categoryCounts.length === 0) {
      return { handled: false };
    }

    // Sort by count descending
    const sorted = categoryCounts
      .filter(c => c._count.id > 0)
      .sort((a, b) => b._count.id - a._count.id);

    const lines = sorted.map(c => {
      const key = c.carroceria.toLowerCase().trim();
      const label = CATEGORY_LABELS[key] || { name: c.carroceria, emoji: '🚗' };
      return `${label.emoji} *${label.name}* — ${c._count.id} disponíve${c._count.id > 1 ? 'is' : 'l'}`;
    });

    const message =
      `Temos estas categorias disponíveis no estoque:\n\n` +
      lines.join('\n') +
      `\n\nQual categoria te interessa? Me diz que eu mostro as opções! 😊`;

    return {
      handled: true,
      response: buildResponse(
        message,
        {
          ...extracted.extracted,
          _showedRecommendation: false,
          _waitingForSuggestionResponse: true,
        },
        {
          needsMoreInfo: ['bodyType'],
          nextMode: 'discovery',
          startTime,
          confidence: 0.9,
        }
      ),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to list available categories');
    return { handled: false };
  }
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

  // When no vehicles were previously shown (e.g. after "não encontrei" message),
  // list available categories so user can pick one
  if (!lastShownVehicles || lastShownVehicles.length === 0) {
    return handleListCategories(ctx);
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

  // 3. Get body type (prefer stored bodyType, otherwise infer)
  let bodyType = firstVehicle.bodyType || '';

  // If bodyType not stored, try to infer from model/type
  if (!bodyType) {
    const bodyTypeInfo = inferBodyType(firstVehicle.model, undefined);
    bodyType = bodyTypeInfo ? bodyTypeInfo.type : '';
  }

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
    if (bodyType && r.vehicle.bodyType) {
      const resultBodyType = r.vehicle.bodyType.toLowerCase();
      if (!resultBodyType.includes(bodyType)) return false;
    }
    return true;
  });

  // 7. Sort by price (most expensive first - benefits dealership)
  newResults.sort((a, b) => b.vehicle.price - a.vehicle.price);

  // 8. Handle results
  if (newResults.length > 0) {
    // GUARDRAIL: Must have budget before recommending
    const userBudget = updatedProfile.budget || updatedProfile.budgetMax;
    if (!userBudget) {
      const firstPrice = newResults[0].vehicle.price.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
      });
      return {
        handled: true,
        response: buildResponse(
          `Encontrei ${newResults.length} outras opções! ${newResults.length > 1 ? 'Os preços' : 'O preço'} começa em R$ ${firstPrice}.\n\nQual é o seu orçamento? Assim mostro só as opções que cabem no seu bolso. 😊`,
          {
            ...extracted.extracted,
            _pendingOtherRecommendations: newResults.slice(0, 5),
          },
          {
            canRecommend: false,
            needsMoreInfo: ['budget'],
            nextMode: 'discovery',
            startTime,
          }
        ),
      };
    }

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
            brand: r.vehicle.brand,
            model: r.vehicle.model,
            year: r.vehicle.year,
            price: r.vehicle.price,
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

  // No similar vehicles found — explain why and offer to broaden search
  const hasBudget = !!(updatedProfile.budget || updatedProfile.budgetMax);
  const budgetValue = updatedProfile.budget || updatedProfile.budgetMax || priceRange.max;
  const budgetFormatted = budgetValue.toLocaleString('pt-BR', { minimumFractionDigits: 0 });

  let noResultsMessage: string;
  let missingInfo: string[];

  if (bodyType && hasBudget) {
    // Specific: mention body type + price range, ask to broaden
    const bodyTypeLabel = CATEGORY_LABELS[bodyType.toLowerCase()]?.name || bodyType;
    noResultsMessage =
      `No momento, o ${firstVehicle.brand} ${firstVehicle.model} é o único ${bodyTypeLabel.toLowerCase().replace(/s$/, '')} disponível até R$ ${budgetFormatted}. 🤔\n\n` +
      `Quer que eu busque *outros tipos de veículo* nessa faixa de valor? Posso mostrar SUVs, hatches, pickups e mais! 😊`;
    missingInfo = ['bodyType'];
  } else if (!hasBudget) {
    noResultsMessage = `Não encontrei mais opções similares ao ${firstVehicle.brand} ${firstVehicle.model}. 🤔\n\nQual seu orçamento máximo? Assim consigo ampliar a busca.`;
    missingInfo = ['budget', 'bodyType'];
  } else {
    noResultsMessage =
      `Não encontrei mais opções similares ao ${firstVehicle.brand} ${firstVehicle.model} até R$ ${budgetFormatted}. 🤔\n\n` +
      `Prefere algum tipo específico (SUV, sedan, hatch) ou tem outra marca em mente?`;
    missingInfo = ['bodyType', 'brand'];
  }

  return {
    handled: true,
    response: buildResponse(
      noResultsMessage,
      {
        ...extracted.extracted,
        _showedRecommendation: false,
        _lastShownVehicles: lastShownVehicles,
        _lastSearchType: undefined,
        _waitingForSuggestionResponse: true,
        _waitingForBroaderSearch: true,
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
