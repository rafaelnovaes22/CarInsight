/**
 * FallbackService
 *
 * Core service for finding alternative vehicles when exact matches are unavailable.
 * Implements a tiered fallback strategy that prioritizes year variations of the same model,
 * then progressively expands to similar vehicles based on brand, category, and price range.
 *
 * **Feature: vehicle-fallback-recommendations**
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Vehicle } from './exact-search.service';
import {
  FallbackConfig,
  FallbackResult,
  FallbackType,
  FallbackVehicleMatch,
  MatchingCriterion,
  FallbackMetadata,
  SimilarityCriteria,
  DEFAULT_FALLBACK_CONFIG,
  FALLBACK_PRIORITIES,
} from './fallback.types';
import {
  getVehicleProfile,
  getTypicalPriceRange,
  getModelCategory,
  normalizeCategory,
  VehicleCategory,
} from './vehicle-profiles';
import { SimilarityCalculator } from './similarity-calculator.service';

/**
 * FallbackService class
 *
 * Provides intelligent fallback recommendations when exact vehicle matches
 * are unavailable. Implements a priority chain of fallback strategies.
 */
export class FallbackService {
  private config: FallbackConfig;
  private similarityCalculator: SimilarityCalculator;

  /**
   * Creates a new FallbackService with configurable options
   *
   * @param config - Optional partial configuration to override defaults
   */
  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      ...DEFAULT_FALLBACK_CONFIG,
      ...config,
    };
    this.similarityCalculator = new SimilarityCalculator();
  }

  /**
   * Finds alternative vehicles when the exact requested vehicle is unavailable.
   *
   * Applies fallback strategies in priority order:
   * 1. Same model, different year
   * 2. Same brand, same category
   * 3. Same category, similar price
   * 4. Similar price range only
   *
   * @param requestedModel - The model name that was requested
   * @param requestedYear - The year that was requested (null if not specified)
   * @param inventory - The available vehicle inventory to search
   * @param referencePrice - Optional reference price for similarity matching
   * @returns FallbackResult with alternatives and metadata
   */
  findAlternatives(
    requestedModel: string,
    requestedYear: number | null,
    inventory: Vehicle[],
    referencePrice?: number
  ): FallbackResult {
    const startTime = Date.now();

    // Handle empty model name
    if (!requestedModel || requestedModel.trim() === '') {
      return this.createNoResultsResponse('', requestedYear, 'Modelo não especificado', startTime);
    }

    // Handle empty inventory
    if (!inventory || inventory.length === 0) {
      return this.createNoResultsResponse(
        requestedModel,
        requestedYear,
        'Nenhum veículo disponível no momento',
        startTime
      );
    }

    // Filter to only available vehicles
    const availableInventory = inventory.filter(v => v.disponivel);

    if (availableInventory.length === 0) {
      return this.createNoResultsResponse(
        requestedModel,
        requestedYear,
        'Nenhum veículo disponível no momento',
        startTime
      );
    }

    // Determine reference price if not provided
    const effectiveReferencePrice = referencePrice ?? this.estimateReferencePrice(requestedModel);

    // Get vehicle profile for the requested model
    const profile = getVehicleProfile(requestedModel);
    const category = profile?.category ?? getModelCategory(requestedModel);
    const brand = this.extractBrandFromModel(requestedModel, availableInventory);

    // Try fallback strategies in priority order
    // Strategy 1: Year alternatives (only if year was specified)
    if (requestedYear !== null) {
      const yearAlternatives = this.findYearAlternatives(
        requestedModel,
        requestedYear,
        availableInventory
      );

      if (yearAlternatives.length > 0) {
        const limitedResults = yearAlternatives.slice(0, this.config.maxResults);
        const availableYears = this.getAvailableYears(requestedModel, availableInventory);

        return {
          type: 'year_alternative',
          vehicles: limitedResults,
          message: this.generateYearAlternativeMessage(
            requestedModel,
            requestedYear,
            availableYears
          ),
          requestedModel,
          requestedYear,
          availableYears,
          metadata: this.createMetadata('year_alternative', yearAlternatives.length, startTime),
        };
      }
    }

    // Strategy 2: Same brand, same category
    if (brand) {
      const sameBrandAlternatives = this.findSameBrandAlternatives(
        requestedModel,
        brand,
        category,
        availableInventory,
        effectiveReferencePrice
      );

      if (sameBrandAlternatives.length > 0) {
        const limitedResults = sameBrandAlternatives.slice(0, this.config.maxResults);

        return {
          type: 'same_brand',
          vehicles: limitedResults,
          message: this.generateSameBrandMessage(requestedModel, brand),
          requestedModel,
          requestedYear,
          metadata: this.createMetadata('same_brand', sameBrandAlternatives.length, startTime),
        };
      }
    }

    // Strategy 3: Same category, similar price
    const sameCategoryAlternatives = this.findSameCategoryAlternatives(
      category,
      availableInventory,
      effectiveReferencePrice
    );

    if (sameCategoryAlternatives.length > 0) {
      const limitedResults = sameCategoryAlternatives.slice(0, this.config.maxResults);

      return {
        type: 'same_category',
        vehicles: limitedResults,
        message: this.generateSameCategoryMessage(requestedModel, category),
        requestedModel,
        requestedYear,
        metadata: this.createMetadata('same_category', sameCategoryAlternatives.length, startTime),
      };
    }

    // Strategy 4: Price range only
    const priceRangeAlternatives = this.findPriceRangeAlternatives(
      availableInventory,
      effectiveReferencePrice
    );

    if (priceRangeAlternatives.length > 0) {
      const limitedResults = priceRangeAlternatives.slice(0, this.config.maxResults);

      return {
        type: 'price_range',
        vehicles: limitedResults,
        message: this.generatePriceRangeMessage(requestedModel, effectiveReferencePrice),
        requestedModel,
        requestedYear,
        metadata: this.createMetadata('price_range', priceRangeAlternatives.length, startTime),
      };
    }

    // No alternatives found at any level
    return this.createNoResultsResponse(
      requestedModel,
      requestedYear,
      'Não encontramos alternativas disponíveis no momento. Entre em contato com nossa equipe de vendas.',
      startTime
    );
  }

  /**
   * Finds vehicles of the same model with different years.
   * Sorts by year proximity to the requested year, then by price descending, then mileage ascending.
   *
   * @param model - The model name to search for
   * @param requestedYear - The year that was requested
   * @param inventory - The available vehicle inventory
   * @returns Array of FallbackVehicleMatch sorted by year proximity
   */
  findYearAlternatives(
    model: string,
    requestedYear: number,
    inventory: Vehicle[]
  ): FallbackVehicleMatch[] {
    const normalizedModel = this.normalizeModelName(model);

    // Find vehicles of the same model
    const sameModelVehicles = inventory.filter(v => {
      const vehicleModel = this.normalizeModelName(v.modelo);
      return (
        vehicleModel === normalizedModel ||
        vehicleModel.includes(normalizedModel) ||
        normalizedModel.includes(vehicleModel)
      );
    });

    // Filter out vehicles of the exact requested year (we want alternatives)
    const alternativeYearVehicles = sameModelVehicles.filter(v => v.ano !== requestedYear);

    // Filter by max year distance
    const withinYearDistance = alternativeYearVehicles.filter(
      v => Math.abs(v.ano - requestedYear) <= this.config.maxYearDistance
    );

    // Calculate year proximity scores and create matches
    const matches: FallbackVehicleMatch[] = withinYearDistance.map(vehicle => {
      const yearProximityScore = this.calculateYearProximityScore(vehicle.ano, requestedYear);
      const matchingCriteria = this.createYearAlternativeCriteria(vehicle, model, requestedYear);

      return {
        vehicle,
        similarityScore: yearProximityScore,
        matchingCriteria,
        reasoning: this.generateYearAlternativeReasoning(vehicle, requestedYear),
      };
    });

    // Sort by year proximity (closest first), then price desc, then mileage asc
    matches.sort((a, b) => {
      // Primary: Year proximity (higher score = closer year = first)
      const yearDiff = b.similarityScore - a.similarityScore;
      if (yearDiff !== 0) return yearDiff;

      // Secondary: Price descending
      const priceDiff = b.vehicle.preco - a.vehicle.preco;
      if (priceDiff !== 0) return priceDiff;

      // Tertiary: Mileage ascending
      return a.vehicle.km - b.vehicle.km;
    });

    return matches;
  }

  /**
   * Calculates a year proximity score (0-100) based on how close a year is to the requested year.
   * Closer years get higher scores.
   *
   * @param vehicleYear - The year of the vehicle
   * @param requestedYear - The year that was requested
   * @returns Score from 0-100 (100 = same year, decreases with distance)
   */
  calculateYearProximityScore(vehicleYear: number, requestedYear: number): number {
    const yearDifference = Math.abs(vehicleYear - requestedYear);

    // Same year = 100, decreases by 20 per year difference
    // At maxYearDistance (5), score would be 0
    const score = Math.max(0, 100 - yearDifference * (100 / this.config.maxYearDistance));

    return Math.round(score);
  }

  /**
   * Finds vehicles of the same brand and category within price tolerance.
   *
   * @param requestedModel - The model that was requested
   * @param brand - The brand to match
   * @param category - The category to match
   * @param inventory - The available vehicle inventory
   * @param referencePrice - The reference price for filtering
   * @returns Array of FallbackVehicleMatch sorted by similarity score
   */
  findSameBrandAlternatives(
    requestedModel: string,
    brand: string,
    category: string,
    inventory: Vehicle[],
    referencePrice: number
  ): FallbackVehicleMatch[] {
    const normalizedBrand = this.normalizeBrand(brand);
    const normalizedCategory = normalizeCategory(category);
    const normalizedRequestedModel = this.normalizeModelName(requestedModel);

    // Calculate price tolerance
    const tolerance = referencePrice * (this.config.priceTolerancePercent / 100);
    const minPrice = referencePrice - tolerance;
    const maxPrice = referencePrice + tolerance;

    // Filter vehicles: same brand, same category, within price range, different model
    const candidates = inventory.filter(v => {
      const vehicleBrand = this.normalizeBrand(v.marca);
      const vehicleCategory = normalizeCategory(v.carroceria);
      const vehicleModel = this.normalizeModelName(v.modelo);

      return (
        vehicleBrand === normalizedBrand &&
        vehicleCategory === normalizedCategory &&
        v.preco >= minPrice &&
        v.preco <= maxPrice &&
        vehicleModel !== normalizedRequestedModel
      );
    });

    // Calculate similarity scores
    const criteria: SimilarityCriteria = {
      targetCategory: normalizedCategory,
      targetBrand: brand,
      targetPrice: referencePrice,
    };

    const matches: FallbackVehicleMatch[] = candidates.map(vehicle => {
      const result = this.similarityCalculator.calculate(vehicle, criteria);

      return {
        vehicle,
        similarityScore: result.score,
        matchingCriteria: result.matchingCriteria,
        reasoning: this.generateSimilarProfileReasoning(vehicle, result.matchingCriteria),
      };
    });

    // Sort by similarity score descending
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return matches;
  }

  /**
   * Finds vehicles of the same category (any brand) within price tolerance.
   *
   * @param category - The category to match
   * @param inventory - The available vehicle inventory
   * @param referencePrice - The reference price for filtering
   * @returns Array of FallbackVehicleMatch sorted by similarity score
   */
  findSameCategoryAlternatives(
    category: string,
    inventory: Vehicle[],
    referencePrice: number
  ): FallbackVehicleMatch[] {
    const normalizedCategory = normalizeCategory(category);

    // Calculate price tolerance
    const tolerance = referencePrice * (this.config.priceTolerancePercent / 100);
    const minPrice = referencePrice - tolerance;
    const maxPrice = referencePrice + tolerance;

    // Filter vehicles: same category, within price range
    const candidates = inventory.filter(v => {
      const vehicleCategory = normalizeCategory(v.carroceria);

      return vehicleCategory === normalizedCategory && v.preco >= minPrice && v.preco <= maxPrice;
    });

    // Calculate similarity scores
    const criteria: SimilarityCriteria = {
      targetCategory: normalizedCategory,
      targetPrice: referencePrice,
    };

    const matches: FallbackVehicleMatch[] = candidates.map(vehicle => {
      const result = this.similarityCalculator.calculate(vehicle, criteria);

      return {
        vehicle,
        similarityScore: result.score,
        matchingCriteria: result.matchingCriteria,
        reasoning: this.generateSimilarProfileReasoning(vehicle, result.matchingCriteria),
      };
    });

    // Sort by similarity score descending
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return matches;
  }

  /**
   * Finds vehicles within price range only (last resort fallback).
   *
   * @param inventory - The available vehicle inventory
   * @param referencePrice - The reference price for filtering
   * @returns Array of FallbackVehicleMatch sorted by similarity score
   */
  findPriceRangeAlternatives(inventory: Vehicle[], referencePrice: number): FallbackVehicleMatch[] {
    // Calculate price tolerance
    const tolerance = referencePrice * (this.config.priceTolerancePercent / 100);
    const minPrice = referencePrice - tolerance;
    const maxPrice = referencePrice + tolerance;

    // Filter vehicles: within price range only
    const candidates = inventory.filter(v => v.preco >= minPrice && v.preco <= maxPrice);

    // Calculate similarity scores (price-based only)
    const criteria: SimilarityCriteria = {
      targetCategory: 'hatch', // Default category for price-only search
      targetPrice: referencePrice,
    };

    const matches: FallbackVehicleMatch[] = candidates.map(vehicle => {
      const result = this.similarityCalculator.calculate(vehicle, criteria);

      return {
        vehicle,
        similarityScore: result.score,
        matchingCriteria: result.matchingCriteria,
        reasoning: this.generatePriceRangeReasoning(vehicle, referencePrice),
      };
    });

    // Sort by similarity score descending
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return matches;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Creates a no-results response
   */
  private createNoResultsResponse(
    requestedModel: string,
    requestedYear: number | null,
    message: string,
    startTime: number
  ): FallbackResult {
    return {
      type: 'no_results',
      vehicles: [],
      message,
      requestedModel,
      requestedYear,
      metadata: this.createMetadata('no_results', 0, startTime),
    };
  }

  /**
   * Creates metadata for a fallback result
   */
  private createMetadata(
    strategyUsed: FallbackType,
    totalCandidates: number,
    startTime: number
  ): FallbackMetadata {
    return {
      strategyUsed,
      totalCandidates,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Estimates a reference price for a model
   */
  private estimateReferencePrice(model: string): number {
    const priceRange = getTypicalPriceRange(model);
    // Use the midpoint of the typical price range
    return Math.round((priceRange.min + priceRange.max) / 2);
  }

  /**
   * Extracts the brand from a model name or inventory
   */
  private extractBrandFromModel(model: string, inventory: Vehicle[]): string | undefined {
    const normalizedModel = this.normalizeModelName(model);

    // Try to find a vehicle with this model to get the brand
    const matchingVehicle = inventory.find(v => {
      const vehicleModel = this.normalizeModelName(v.modelo);
      return (
        vehicleModel === normalizedModel ||
        vehicleModel.includes(normalizedModel) ||
        normalizedModel.includes(vehicleModel)
      );
    });

    return matchingVehicle?.marca;
  }

  /**
   * Gets all available years for a model in the inventory
   */
  private getAvailableYears(model: string, inventory: Vehicle[]): number[] {
    const normalizedModel = this.normalizeModelName(model);

    const years = inventory
      .filter(v => {
        const vehicleModel = this.normalizeModelName(v.modelo);
        return (
          vehicleModel === normalizedModel ||
          vehicleModel.includes(normalizedModel) ||
          normalizedModel.includes(vehicleModel)
        );
      })
      .map(v => v.ano);

    // Return unique years sorted
    return [...new Set(years)].sort((a, b) => b - a);
  }

  /**
   * Normalizes a model name for comparison
   */
  private normalizeModelName(model: string): string {
    return model
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[-\s]/g, '') // Remove dashes and spaces
      .trim();
  }

  /**
   * Normalizes a brand name for comparison
   */
  private normalizeBrand(brand: string): string {
    return brand
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .trim();
  }

  /**
   * Creates matching criteria for year alternatives
   */
  private createYearAlternativeCriteria(
    vehicle: Vehicle,
    requestedModel: string,
    requestedYear: number
  ): MatchingCriterion[] {
    const yearDiff = Math.abs(vehicle.ano - requestedYear);

    return [
      {
        criterion: 'year',
        matched: true,
        details: `Ano ${vehicle.ano} (${yearDiff} ano${yearDiff !== 1 ? 's' : ''} de diferença)`,
      },
      {
        criterion: 'brand',
        matched: true,
        details: `Mesma marca: ${vehicle.marca}`,
      },
      {
        criterion: 'category',
        matched: true,
        details: `Mesmo modelo: ${vehicle.modelo}`,
      },
    ];
  }

  /**
   * Generates reasoning for year alternative matches
   */
  private generateYearAlternativeReasoning(vehicle: Vehicle, requestedYear: number): string {
    const yearDiff = vehicle.ano - requestedYear;
    const direction = yearDiff > 0 ? 'mais novo' : 'mais antigo';
    const absDiff = Math.abs(yearDiff);

    return `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - ${absDiff} ano${absDiff !== 1 ? 's' : ''} ${direction}`;
  }

  /**
   * Generates reasoning for similar profile matches
   */
  private generateSimilarProfileReasoning(
    vehicle: Vehicle,
    matchingCriteria: MatchingCriterion[]
  ): string {
    const matchedCriteria = matchingCriteria
      .filter(c => c.matched)
      .map(c => c.details)
      .slice(0, 3); // Max 3 reasons

    return `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - ${matchedCriteria.join(', ')}`;
  }

  /**
   * Generates reasoning for price range matches
   */
  private generatePriceRangeReasoning(vehicle: Vehicle, referencePrice: number): string {
    const priceDiff = vehicle.preco - referencePrice;
    const percentDiff = Math.round((priceDiff / referencePrice) * 100);
    const direction = priceDiff > 0 ? 'acima' : 'abaixo';

    return `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - R$ ${vehicle.preco.toLocaleString('pt-BR')} (${Math.abs(percentDiff)}% ${direction} do valor de referência)`;
  }

  /**
   * Generates message for year alternative results
   */
  private generateYearAlternativeMessage(
    model: string,
    requestedYear: number,
    availableYears: number[]
  ): string {
    const yearsStr = availableYears.join(', ');
    return `Não temos o ${model} ${requestedYear} disponível, mas temos o mesmo modelo nos anos: ${yearsStr}`;
  }

  /**
   * Generates message for same brand results
   */
  private generateSameBrandMessage(model: string, brand: string): string {
    return `Não temos o ${model} disponível, mas temos outras opções da ${brand} na mesma categoria`;
  }

  /**
   * Generates message for same category results
   */
  private generateSameCategoryMessage(model: string, category: string): string {
    const categoryName = this.getCategoryDisplayName(category);
    return `Não temos o ${model} disponível, mas temos outras opções de ${categoryName} em faixa de preço similar`;
  }

  /**
   * Generates message for price range results
   */
  private generatePriceRangeMessage(model: string, referencePrice: number): string {
    const formattedPrice = referencePrice.toLocaleString('pt-BR');
    return `Não temos o ${model} disponível, mas temos outras opções na faixa de R$ ${formattedPrice}`;
  }

  /**
   * Gets display name for a category
   */
  private getCategoryDisplayName(category: string): string {
    const displayNames: Record<string, string> = {
      sedan: 'sedans',
      suv: 'SUVs',
      hatch: 'hatches',
      pickup: 'pickups',
      minivan: 'minivans',
    };

    return displayNames[normalizeCategory(category)] || category;
  }
}

// Singleton export for convenience
export const fallbackService = new FallbackService();
