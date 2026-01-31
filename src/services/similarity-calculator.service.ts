/**
 * SimilarityCalculator Service
 *
 * Calculates similarity scores between vehicles based on multiple criteria
 * including category, brand, price proximity, and features (transmission/fuel).
 *
 * **Feature: vehicle-fallback-recommendations**
 * Requirements: 2.2, 2.3, 2.5, 2.6
 */

import { Vehicle } from './exact-search.service';
import {
  SimilarityCriteria,
  SimilarityWeights,
  MatchingCriterion,
  DEFAULT_SIMILARITY_WEIGHTS,
} from './fallback.types';
import { normalizeCategory } from './vehicle-profiles';

/**
 * Result of a similarity calculation
 */
export interface SimilarityResult {
  /** Overall similarity score (0-100) */
  score: number;
  /** List of criteria that were evaluated */
  matchingCriteria: MatchingCriterion[];
}

/**
 * Default price tolerance percentage for similarity calculations
 */
const DEFAULT_PRICE_TOLERANCE_PERCENT = 20;

/**
 * SimilarityCalculator class
 *
 * Calculates similarity scores between a vehicle and target criteria.
 * The score is based on weighted matching of category, brand, price proximity,
 * and features (transmission, fuel type).
 */
export class SimilarityCalculator {
  private weights: SimilarityWeights;

  /**
   * Creates a new SimilarityCalculator with configurable weights
   *
   * @param weights - Optional partial weights to override defaults
   */
  constructor(weights?: Partial<SimilarityWeights>) {
    this.weights = {
      ...DEFAULT_SIMILARITY_WEIGHTS,
      ...weights,
    };
  }

  /**
   * Calculates the similarity score between a vehicle and target criteria
   *
   * The score is calculated as a weighted sum of:
   * - Category match (default weight: 40)
   * - Brand match (default weight: 25)
   * - Price proximity (default weight: 20)
   * - Feature matches - transmission/fuel (default weight: 15)
   *
   * @param vehicle - The vehicle to evaluate
   * @param criteria - The target criteria to compare against
   * @returns The similarity score (0-100) and list of matching criteria
   */
  calculate(vehicle: Vehicle, criteria: SimilarityCriteria): SimilarityResult {
    const matchingCriteria: MatchingCriterion[] = [];
    let totalScore = 0;

    // Calculate category score
    const categoryScore = this.calculateCategoryScore(vehicle.carroceria, criteria.targetCategory);
    const categoryMatched = categoryScore > 0;
    matchingCriteria.push({
      criterion: 'category',
      matched: categoryMatched,
      details: categoryMatched
        ? `Mesma categoria: ${normalizeCategory(vehicle.carroceria)}`
        : `Categoria diferente: ${normalizeCategory(vehicle.carroceria)} vs ${criteria.targetCategory}`,
    });
    totalScore += (categoryScore / 100) * this.weights.category;

    // Calculate brand score (if target brand is specified)
    if (criteria.targetBrand) {
      const brandMatched =
        this.normalizeBrand(vehicle.marca) === this.normalizeBrand(criteria.targetBrand);
      matchingCriteria.push({
        criterion: 'brand',
        matched: brandMatched,
        details: brandMatched
          ? `Mesma marca: ${vehicle.marca}`
          : `Marca diferente: ${vehicle.marca} vs ${criteria.targetBrand}`,
      });
      if (brandMatched) {
        totalScore += this.weights.brand;
      }
    }

    // Calculate price proximity score
    const priceScore = this.calculatePriceProximityScore(
      vehicle.preco,
      criteria.targetPrice,
      DEFAULT_PRICE_TOLERANCE_PERCENT
    );
    const priceMatched = priceScore > 0;
    matchingCriteria.push({
      criterion: 'price',
      matched: priceMatched,
      details: priceMatched
        ? `Preço similar: R$ ${vehicle.preco.toLocaleString('pt-BR')}`
        : `Preço fora da faixa: R$ ${vehicle.preco.toLocaleString('pt-BR')}`,
    });
    totalScore += (priceScore / 100) * this.weights.price;

    // Calculate feature score (transmission and fuel)
    const featureResult = this.calculateFeatureScore(vehicle, criteria);
    totalScore += (featureResult.score / 100) * this.weights.features;

    // Add transmission criterion if specified
    if (criteria.targetTransmission) {
      const transmissionMatched =
        this.normalizeTransmission(vehicle.cambio) ===
        this.normalizeTransmission(criteria.targetTransmission);
      matchingCriteria.push({
        criterion: 'transmission',
        matched: transmissionMatched,
        details: transmissionMatched
          ? `Mesmo câmbio: ${vehicle.cambio}`
          : `Câmbio diferente: ${vehicle.cambio} vs ${criteria.targetTransmission}`,
      });
    }

    // Add fuel criterion if specified
    if (criteria.targetFuel) {
      const fuelMatched =
        this.normalizeFuel(vehicle.combustivel) === this.normalizeFuel(criteria.targetFuel);
      matchingCriteria.push({
        criterion: 'fuel',
        matched: fuelMatched,
        details: fuelMatched
          ? `Mesmo combustível: ${vehicle.combustivel}`
          : `Combustível diferente: ${vehicle.combustivel} vs ${criteria.targetFuel}`,
      });
    }

    // Ensure score is within bounds [0, 100]
    const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    return {
      score: finalScore,
      matchingCriteria,
    };
  }

  /**
   * Calculates the category match score
   *
   * Returns 100 if categories match (after normalization), 0 otherwise.
   *
   * @param vehicleCategory - The vehicle's body type/category
   * @param targetCategory - The target category to match
   * @returns Score from 0-100
   */
  private calculateCategoryScore(vehicleCategory: string, targetCategory: string): number {
    const normalizedVehicle = normalizeCategory(vehicleCategory);
    const normalizedTarget = normalizeCategory(targetCategory);

    return normalizedVehicle === normalizedTarget ? 100 : 0;
  }

  /**
   * Calculates the price proximity score
   *
   * Returns a score based on how close the vehicle price is to the target price.
   * - 100 if within tolerance
   * - Decreases linearly as price moves outside tolerance
   * - 0 if price is more than 2x the tolerance away
   *
   * @param vehiclePrice - The vehicle's price
   * @param targetPrice - The target price to compare against
   * @param tolerancePercent - The acceptable deviation percentage (default: 20%)
   * @returns Score from 0-100
   */
  private calculatePriceProximityScore(
    vehiclePrice: number,
    targetPrice: number,
    tolerancePercent: number
  ): number {
    if (targetPrice <= 0) {
      return 0;
    }

    const tolerance = targetPrice * (tolerancePercent / 100);
    const minPrice = targetPrice - tolerance;
    const maxPrice = targetPrice + tolerance;

    // If within tolerance, return 100
    if (vehiclePrice >= minPrice && vehiclePrice <= maxPrice) {
      return 100;
    }

    // Calculate how far outside the tolerance the price is
    const deviation = vehiclePrice < minPrice ? minPrice - vehiclePrice : vehiclePrice - maxPrice;

    // Score decreases linearly, reaching 0 at 2x tolerance
    const maxDeviation = tolerance; // Beyond this, score is 0
    const score = Math.max(0, 100 - (deviation / maxDeviation) * 100);

    return Math.round(score);
  }

  /**
   * Calculates the feature match score for transmission and fuel type
   *
   * Each matching feature contributes 50% to the score:
   * - Transmission match: 50 points
   * - Fuel match: 50 points
   *
   * If no target features are specified, returns 0 (neutral).
   *
   * @param vehicle - The vehicle to evaluate
   * @param criteria - The target criteria with optional transmission/fuel
   * @returns Score from 0-100 and count of matching features
   */
  private calculateFeatureScore(
    vehicle: Vehicle,
    criteria: SimilarityCriteria
  ): { score: number; matchCount: number } {
    let matchCount = 0;
    let totalFeatures = 0;

    // Check transmission match
    if (criteria.targetTransmission) {
      totalFeatures++;
      if (
        this.normalizeTransmission(vehicle.cambio) ===
        this.normalizeTransmission(criteria.targetTransmission)
      ) {
        matchCount++;
      }
    }

    // Check fuel match
    if (criteria.targetFuel) {
      totalFeatures++;
      if (this.normalizeFuel(vehicle.combustivel) === this.normalizeFuel(criteria.targetFuel)) {
        matchCount++;
      }
    }

    // If no features specified, return neutral score
    if (totalFeatures === 0) {
      return { score: 0, matchCount: 0 };
    }

    // Calculate score based on proportion of matching features
    const score = (matchCount / totalFeatures) * 100;

    return { score, matchCount };
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
   * Normalizes a transmission type for comparison
   */
  private normalizeTransmission(transmission: string): string {
    const normalized = transmission
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .trim();

    // Map common variations
    if (normalized.includes('auto') || normalized.includes('automatico')) {
      return 'automatico';
    }
    if (normalized.includes('manual')) {
      return 'manual';
    }
    if (normalized.includes('cvt')) {
      return 'automatico';
    }

    return normalized;
  }

  /**
   * Normalizes a fuel type for comparison
   */
  private normalizeFuel(fuel: string): string {
    const normalized = fuel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .trim();

    // Map common variations
    if (
      normalized.includes('flex') ||
      normalized.includes('alcool') ||
      normalized.includes('etanol')
    ) {
      return 'flex';
    }
    if (normalized.includes('gasolina') || normalized.includes('gasoline')) {
      return 'gasolina';
    }
    if (normalized.includes('diesel')) {
      return 'diesel';
    }
    if (normalized.includes('eletrico') || normalized.includes('electric')) {
      return 'eletrico';
    }
    if (normalized.includes('hibrido') || normalized.includes('hybrid')) {
      return 'hibrido';
    }

    return normalized;
  }
}

// Singleton export for convenience
export const similarityCalculator = new SimilarityCalculator();
