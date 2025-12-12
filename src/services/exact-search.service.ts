/**
 * ExactSearchService
 *
 * Service for handling exact vehicle searches (model + year).
 * Prioritizes exact matches, then year alternatives, then personalized suggestions.
 *
 * **Feature: exact-vehicle-search**
 * Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4
 */

import { ExtractedFilters } from './exact-search-parser.service';

/**
 * Simplified Vehicle interface for search operations
 */
export interface Vehicle {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  ano: number;
  km: number;
  preco: number;
  cor: string | null;
  carroceria: string;
  combustivel: string;
  cambio: string;
  disponivel: boolean;
  fotoUrl?: string | null;
  url?: string | null;
}

/**
 * Vehicle match with score and reasoning
 */
export interface VehicleMatch {
  vehicle: Vehicle;
  matchScore: number;
  reasoning: string;
  matchType: 'exact' | 'year_alternative' | 'suggestion';
}

/**
 * Result type discriminator for exact search results
 */
export type ExactSearchResultType = 'exact' | 'year_alternatives' | 'suggestions' | 'unavailable';

/**
 * Exact search result with type discriminator
 */
export interface ExactSearchResult {
  type: ExactSearchResultType;
  vehicles: VehicleMatch[];
  message: string;
  availableYears?: number[];
  requestedModel: string;
  requestedYear: number;
}

/**
 * ExactSearchService class
 * Handles exact vehicle searches with prioritization logic
 */
export class ExactSearchService {
  /**
   * Main search method - coordinates the search flow
   */
  search(filters: ExtractedFilters, inventory: Vehicle[]): ExactSearchResult {
    const model = filters.model;
    const year = filters.year ?? (filters.yearRange ? filters.yearRange.min : 0);

    if (!model || !year) {
      return {
        type: 'unavailable',
        vehicles: [],
        message: 'Não foi possível identificar o modelo e ano desejados.',
        requestedModel: model || '',
        requestedYear: year || 0,
      };
    }

    // Filter available vehicles only
    const availableInventory = inventory.filter(v => v.disponivel);

    // Step 1: Try to find exact matches
    const exactMatches = this.findExactMatches(model, year, availableInventory, filters.yearRange);
    if (exactMatches.length > 0) {
      return {
        type: 'exact',
        vehicles: exactMatches.map(v => ({
          vehicle: v,
          matchScore: 100,
          reasoning: `Correspondência exata: ${v.marca} ${v.modelo} ${v.ano}`,
          matchType: 'exact' as const,
        })),
        message: `Encontramos ${exactMatches.length} ${model} ${year} disponível(is)!`,
        requestedModel: model,
        requestedYear: year,
      };
    }

    // Step 2: Try to find year alternatives (same model, different years)
    const yearAlternatives = this.findYearAlternatives(model, year, availableInventory);
    if (yearAlternatives.vehicles.length > 0) {
      return yearAlternatives;
    }

    // Step 3: Try to find similar suggestions (different model, similar characteristics)
    const suggestions = this.findSimilarSuggestions(model, year, availableInventory);
    if (suggestions.vehicles.length > 0) {
      return suggestions;
    }

    // Step 4: Return unavailable result
    return {
      type: 'unavailable',
      vehicles: [],
      message: `Não encontramos ${model} ${year} disponível no momento`,
      requestedModel: model,
      requestedYear: year,
    };
  }

  /**
   * Find vehicles matching both model AND year exactly
   * Orders by: price desc, mileage asc, version asc
   *
   * Requirements: 1.2, 1.3, 1.4
   */
  findExactMatches(
    model: string,
    year: number,
    inventory: Vehicle[],
    yearRange?: { min: number; max: number } | null
  ): Vehicle[] {
    const normalizedModel = this.normalizeModelName(model);

    // Filter by model and year (or year range)
    const matches = inventory.filter(vehicle => {
      const vehicleModel = this.normalizeModelName(vehicle.modelo);
      const modelMatches =
        vehicleModel.includes(normalizedModel) || normalizedModel.includes(vehicleModel);

      if (!modelMatches) return false;

      // Check year match
      if (yearRange) {
        return vehicle.ano >= yearRange.min && vehicle.ano <= yearRange.max;
      }
      return vehicle.ano === year;
    });

    // Sort by: price desc, mileage asc, version asc
    return this.sortVehicles(matches);
  }

  /**
   * Find vehicles of the same model with different years
   * Orders by year proximity to requested year
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  findYearAlternatives(
    model: string,
    requestedYear: number,
    inventory: Vehicle[]
  ): ExactSearchResult {
    const normalizedModel = this.normalizeModelName(model);

    // Find all vehicles of the same model
    const sameModelVehicles = inventory.filter(vehicle => {
      const vehicleModel = this.normalizeModelName(vehicle.modelo);
      return vehicleModel.includes(normalizedModel) || normalizedModel.includes(vehicleModel);
    });

    if (sameModelVehicles.length === 0) {
      return {
        type: 'unavailable',
        vehicles: [],
        message: `Não encontramos ${model} ${requestedYear} disponível no momento`,
        requestedModel: model,
        requestedYear: requestedYear,
      };
    }

    // Get unique available years
    const availableYears = [...new Set(sameModelVehicles.map(v => v.ano))].sort((a, b) => a - b);

    // Sort by year proximity to requested year
    const sortedByProximity = [...sameModelVehicles].sort((a, b) => {
      const distA = Math.abs(a.ano - requestedYear);
      const distB = Math.abs(b.ano - requestedYear);
      if (distA !== distB) return distA - distB;
      // Secondary sort: price desc, mileage asc, version asc
      if (b.preco !== a.preco) return b.preco - a.preco;
      if (a.km !== b.km) return a.km - b.km;
      return (a.versao || '').localeCompare(b.versao || '');
    });

    const vehicleMatches: VehicleMatch[] = sortedByProximity.map(vehicle => ({
      vehicle,
      matchScore: this.calculateYearProximityScore(vehicle.ano, requestedYear),
      reasoning: `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - ano próximo ao solicitado`,
      matchType: 'year_alternative' as const,
    }));

    return {
      type: 'year_alternatives',
      vehicles: vehicleMatches,
      message: `Não encontramos ${model} ${requestedYear}, mas temos outras opções de ano. Gostaria de considerar?`,
      availableYears,
      requestedModel: model,
      requestedYear: requestedYear,
    };
  }

  /**
   * Sort vehicles by: price desc, mileage asc, version asc
   *
   * Requirement: 1.4
   */
  private sortVehicles(vehicles: Vehicle[]): Vehicle[] {
    return [...vehicles].sort((a, b) => {
      // Price descending
      if (b.preco !== a.preco) return b.preco - a.preco;
      // Mileage ascending
      if (a.km !== b.km) return a.km - b.km;
      // Version alphabetically ascending
      return (a.versao || '').localeCompare(b.versao || '');
    });
  }

  /**
   * Normalize model name for comparison
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
   * Calculate match score based on year proximity
   */
  private calculateYearProximityScore(vehicleYear: number, requestedYear: number): number {
    const distance = Math.abs(vehicleYear - requestedYear);
    // Score decreases by 10 for each year of distance, minimum 50
    return Math.max(100 - distance * 10, 50);
  }

  /**
   * Find similar vehicles when the requested model doesn't exist in inventory.
   * Matches by: similar body type, price range (±30%), year (±3 years)
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  findSimilarSuggestions(
    model: string,
    year: number,
    inventory: Vehicle[],
    referencePrice?: number
  ): ExactSearchResult {
    // Get typical body type for the requested model
    const typicalBodyType = this.getTypicalBodyType(model);

    // Calculate reference price (use provided or estimate based on model)
    const basePrice = referencePrice ?? this.estimateModelPrice(model, year);
    const minPrice = basePrice * 0.7; // -30%
    const maxPrice = basePrice * 1.3; // +30%

    // Year range: ±3 years
    const minYear = year - 3;
    const maxYear = year + 3;

    // Find vehicles matching similarity criteria
    const suggestions = inventory.filter(vehicle => {
      // Must be different model (we're looking for alternatives)
      const vehicleModel = this.normalizeModelName(vehicle.modelo);
      const searchModel = this.normalizeModelName(model);
      if (vehicleModel.includes(searchModel) || searchModel.includes(vehicleModel)) {
        return false;
      }

      // Check body type match
      const bodyTypeMatches = vehicle.carroceria.toLowerCase() === typicalBodyType.toLowerCase();

      // Check price range
      const priceInRange = vehicle.preco >= minPrice && vehicle.preco <= maxPrice;

      // Check year range
      const yearInRange = vehicle.ano >= minYear && vehicle.ano <= maxYear;

      // Must match at least body type AND (price OR year)
      return bodyTypeMatches && (priceInRange || yearInRange);
    });

    if (suggestions.length === 0) {
      return {
        type: 'suggestions',
        vehicles: [],
        message: `Não encontramos ${model} ${year} nem veículos similares disponíveis no momento. Gostaria de ver outras opções?`,
        requestedModel: model,
        requestedYear: year,
      };
    }

    // Sort suggestions by relevance (more criteria matched = higher score)
    const scoredSuggestions = suggestions.map(vehicle => {
      const bodyTypeMatches = vehicle.carroceria.toLowerCase() === typicalBodyType.toLowerCase();
      const priceInRange = vehicle.preco >= minPrice && vehicle.preco <= maxPrice;
      const yearInRange = vehicle.ano >= minYear && vehicle.ano <= maxYear;

      // Calculate score based on criteria matched
      let score = 0;
      if (bodyTypeMatches) score += 40;
      if (priceInRange) score += 30;
      if (yearInRange) score += 30;

      // Generate reasoning
      const reasons: string[] = [];
      if (bodyTypeMatches) {
        reasons.push(`mesmo tipo de carroceria (${vehicle.carroceria})`);
      }
      if (priceInRange) {
        reasons.push(`faixa de preço similar`);
      }
      if (yearInRange) {
        reasons.push(`ano próximo (${vehicle.ano})`);
      }

      const reasoning = `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - ${reasons.join(', ')}`;

      return {
        vehicle,
        matchScore: score,
        reasoning,
        matchType: 'suggestion' as const,
      };
    });

    // Sort by score descending, then by price descending
    scoredSuggestions.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return b.vehicle.preco - a.vehicle.preco;
    });

    return {
      type: 'suggestions',
      vehicles: scoredSuggestions,
      message: `Não encontramos ${model} disponível, mas temos veículos similares. Gostaria de ver?`,
      requestedModel: model,
      requestedYear: year,
    };
  }

  /**
   * Get typical body type for a model based on known model characteristics
   */
  private getTypicalBodyType(model: string): string {
    const normalizedModel = this.normalizeModelName(model);

    // Map of known models to their typical body types
    const modelBodyTypes: Record<string, string> = {
      // Hatchbacks
      onix: 'Hatch',
      hb20: 'Hatch',
      polo: 'Hatch',
      gol: 'Hatch',
      argo: 'Hatch',
      mobi: 'Hatch',
      kwid: 'Hatch',
      sandero: 'Hatch',
      fit: 'Hatch',
      yaris: 'Hatch',
      up: 'Hatch',
      fox: 'Hatch',
      ka: 'Hatch',
      fiesta: 'Hatch',

      // Sedans
      civic: 'Sedan',
      corolla: 'Sedan',
      cruze: 'Sedan',
      jetta: 'Sedan',
      virtus: 'Sedan',
      cronos: 'Sedan',
      prisma: 'Sedan',
      voyage: 'Sedan',
      sentra: 'Sedan',
      city: 'Sedan',
      versa: 'Sedan',
      etios: 'Sedan',

      // SUVs
      tracker: 'SUV',
      creta: 'SUV',
      tcross: 'SUV',
      compass: 'SUV',
      renegade: 'SUV',
      kicks: 'SUV',
      hrv: 'SUV',
      crv: 'SUV',
      rav4: 'SUV',
      tiguan: 'SUV',
      duster: 'SUV',
      captur: 'SUV',
      ecosport: 'SUV',
      pulse: 'SUV',
      fastback: 'SUV',
      nivus: 'SUV',
      taos: 'SUV',

      // Pickups
      s10: 'Pickup',
      hilux: 'Pickup',
      ranger: 'Pickup',
      amarok: 'Pickup',
      frontier: 'Pickup',
      toro: 'Pickup',
      strada: 'Pickup',
      saveiro: 'Pickup',
      montana: 'Pickup',
      oroch: 'Pickup',
    };

    // Find matching body type
    for (const [modelKey, bodyType] of Object.entries(modelBodyTypes)) {
      if (normalizedModel.includes(modelKey) || modelKey.includes(normalizedModel)) {
        return bodyType;
      }
    }

    // Default to Hatch if unknown
    return 'Hatch';
  }

  /**
   * Estimate typical price for a model and year
   */
  private estimateModelPrice(model: string, year: number): number {
    const normalizedModel = this.normalizeModelName(model);

    // Base prices for different segments (2023 reference)
    const segmentPrices: Record<string, number> = {
      // Entry-level hatchbacks
      mobi: 55000,
      kwid: 60000,
      up: 65000,

      // Compact hatchbacks
      onix: 80000,
      hb20: 80000,
      polo: 85000,
      argo: 75000,
      gol: 70000,
      sandero: 75000,
      ka: 70000,

      // Compact sedans
      prisma: 85000,
      hb20s: 85000,
      virtus: 95000,
      cronos: 85000,
      voyage: 80000,

      // Mid-size sedans
      civic: 130000,
      corolla: 140000,
      cruze: 120000,
      jetta: 150000,
      sentra: 120000,

      // Compact SUVs
      tracker: 110000,
      creta: 115000,
      tcross: 120000,
      kicks: 110000,
      hrv: 130000,
      renegade: 120000,
      duster: 100000,
      ecosport: 100000,
      pulse: 100000,
      nivus: 110000,

      // Mid-size SUVs
      compass: 160000,
      tiguan: 180000,
      crv: 200000,
      rav4: 220000,
      taos: 170000,

      // Pickups
      strada: 90000,
      saveiro: 85000,
      montana: 95000,
      toro: 130000,
      s10: 180000,
      hilux: 200000,
      ranger: 190000,
      amarok: 200000,
    };

    // Find base price for model
    let basePrice = 80000; // Default
    for (const [modelKey, price] of Object.entries(segmentPrices)) {
      if (normalizedModel.includes(modelKey) || modelKey.includes(normalizedModel)) {
        basePrice = price;
        break;
      }
    }

    // Adjust for year (depreciation ~10% per year from 2023)
    const currentYear = 2023;
    const yearDiff = currentYear - year;
    const depreciationFactor = Math.pow(0.9, Math.max(0, yearDiff));

    return Math.round(basePrice * depreciationFactor);
  }
}

// Singleton export
export const exactSearchService = new ExactSearchService();
