/**
 * Brand Matcher Service
 *
 * Handles fuzzy matching for vehicle brands and models to gracefully handle typos.
 * Uses string-similarity library to find the closest match above a threshold.
 *
 * Examples:
 * - "Toiota" → "Toyota"
 * - "Volksvagen" → "Volkswagen"
 * - "Chevrolet" → "Chevrolet" (exact match)
 */

import { findBestMatch } from 'string-similarity';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const SIMILARITY_THRESHOLD = 0.6; // 60% similarity minimum
const CACHE_TTL = 3600000; // 1 hour in ms

interface FuzzyMatchResult {
  matched: boolean;
  original: string;
  suggestion?: string;
  confidence: number;
}

interface BrandModelCache {
  brands: string[];
  models: string[];
  lastUpdated: number;
}

class BrandMatcherService {
  private cache: BrandModelCache = {
    brands: [],
    models: [],
    lastUpdated: 0,
  };

  /**
   * Load distinct brands and models from database
   */
  private async loadBrandsAndModels(): Promise<void> {
    const now = Date.now();

    // Return cached data if still valid
    if (this.cache.lastUpdated && now - this.cache.lastUpdated < CACHE_TTL) {
      return;
    }

    try {
      // Get distinct brands
      const brandResults = await prisma.$queryRaw<{ marca: string }[]>`
        SELECT DISTINCT marca FROM "Vehicle" WHERE disponivel = true ORDER BY marca
      `;

      // Get distinct models
      const modelResults = await prisma.$queryRaw<{ modelo: string }[]>`
        SELECT DISTINCT modelo FROM "Vehicle" WHERE disponivel = true ORDER BY modelo
      `;

      this.cache.brands = brandResults.map(r => r.marca);
      this.cache.models = modelResults.map(r => r.modelo);
      this.cache.lastUpdated = now;

      logger.info(
        {
          brandsCount: this.cache.brands.length,
          modelsCount: this.cache.models.length,
        },
        'Brand/Model cache updated'
      );
    } catch (error) {
      logger.error({ error }, 'Error loading brands and models from database');
      // Keep using old cache if available
    }
  }

  /**
   * Match a brand name with fuzzy matching
   *
   * @param input - User input brand name (potentially with typos)
   * @returns Match result with suggestion if similarity is above threshold
   */
  async matchBrand(input: string): Promise<FuzzyMatchResult> {
    await this.loadBrandsAndModels();

    if (!input || this.cache.brands.length === 0) {
      return { matched: false, original: input, confidence: 0 };
    }

    // Normalize input (lowercase, trim)
    const normalized = input.trim().toLowerCase();

    // Check for exact match first (case-insensitive)
    const exactMatch = this.cache.brands.find(brand => brand.toLowerCase() === normalized);

    if (exactMatch) {
      return {
        matched: true,
        original: input,
        suggestion: exactMatch,
        confidence: 1.0,
      };
    }

    // Perform fuzzy matching
    const { bestMatch, bestMatchIndex } = findBestMatch(
      normalized,
      this.cache.brands.map(b => b.toLowerCase())
    );

    if (bestMatch.rating >= SIMILARITY_THRESHOLD) {
      return {
        matched: true,
        original: input,
        suggestion: this.cache.brands[bestMatchIndex],
        confidence: bestMatch.rating,
      };
    }

    return {
      matched: false,
      original: input,
      confidence: bestMatch.rating,
    };
  }

  /**
   * Match a model name with fuzzy matching
   *
   * @param input - User input model name (potentially with typos)
   * @returns Match result with suggestion if similarity is above threshold
   */
  async matchModel(input: string): Promise<FuzzyMatchResult> {
    await this.loadBrandsAndModels();

    if (!input || this.cache.models.length === 0) {
      return { matched: false, original: input, confidence: 0 };
    }

    // Normalize input
    const normalized = input.trim().toLowerCase();

    // Check for exact match first
    const exactMatch = this.cache.models.find(model => model.toLowerCase() === normalized);

    if (exactMatch) {
      return {
        matched: true,
        original: input,
        suggestion: exactMatch,
        confidence: 1.0,
      };
    }

    // Perform fuzzy matching
    const { bestMatch, bestMatchIndex } = findBestMatch(
      normalized,
      this.cache.models.map(m => m.toLowerCase())
    );

    if (bestMatch.rating >= SIMILARITY_THRESHOLD) {
      return {
        matched: true,
        original: input,
        suggestion: this.cache.models[bestMatchIndex],
        confidence: bestMatch.rating,
      };
    }

    return {
      matched: false,
      original: input,
      confidence: bestMatch.rating,
    };
  }

  /**
   * Match brand and model together from a query string
   * Useful for queries like "Toiota Corola 2020"
   *
   * @param query - Full user query
   * @returns Object with brand and model matches
   */
  async matchBrandAndModel(query: string): Promise<{
    brand?: FuzzyMatchResult;
    model?: FuzzyMatchResult;
  }> {
    const words = query.trim().split(/\s+/);

    if (words.length === 0) {
      return {};
    }

    // Try first word as brand
    const brandMatch = await this.matchBrand(words[0]);

    // Try second word as model (if exists)
    const modelMatch = words.length > 1 ? await this.matchModel(words[1]) : undefined;

    return {
      brand: brandMatch.matched ? brandMatch : undefined,
      model: modelMatch?.matched ? modelMatch : undefined,
    };
  }

  /**
   * Generate a confirmation message for the user
   *
   * @param brandMatch - Brand fuzzy match result
   * @param modelMatch - Model fuzzy match result (optional)
   * @returns User-friendly confirmation message
   */
  generateConfirmationMessage(
    brandMatch?: FuzzyMatchResult,
    modelMatch?: FuzzyMatchResult
  ): string | null {
    if (!brandMatch?.matched && !modelMatch?.matched) {
      return null;
    }

    const parts: string[] = [];

    if (brandMatch?.matched && brandMatch.suggestion && brandMatch.confidence < 1.0) {
      parts.push(`**${brandMatch.suggestion}**`);
    }

    if (modelMatch?.matched && modelMatch.suggestion && modelMatch.confidence < 1.0) {
      parts.push(`**${modelMatch.suggestion}**`);
    }

    if (parts.length === 0) {
      return null; // Exact matches, no confirmation needed
    }

    return `Você quis dizer ${parts.join(' ')}?`;
  }

  /**
   * Clear the cache (useful for testing or when data changes)
   */
  clearCache(): void {
    this.cache = {
      brands: [],
      models: [],
      lastUpdated: 0,
    };
  }
}

// Export singleton instance
export const brandMatcher = new BrandMatcherService();
export type { FuzzyMatchResult };
