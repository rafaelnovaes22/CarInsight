/**
 * ExactSearchParser Service
 *
 * Responsible for extracting model and year filters from user queries.
 * Supports various formats: "Onix 2019", "2019 Onix", "Onix 19", "Onix 2018 a 2020", "Onix 2019/2020"
 *
 * **Feature: exact-vehicle-search**
 * Requirements: 1.1, 5.1, 5.2, 5.3, 5.4 - Dynamic Model Loading
 */

import { prisma } from '../lib/prisma';
// Lazy logger import to avoid env validation issues during testing
import { logger } from '../lib/logger';

/**
 * Extracted filters from user query
 */
export interface ExtractedFilters {
  model: string | null;
  year: number | null;
  yearRange: { min: number; max: number } | null;
  rawQuery: string;
}

/**
 * ExactSearchParser class
 * Extracts model and year from user queries using dynamic database data
 */
export class ExactSearchParser {
  private modelPattern: RegExp | null = null;
  private isInitialized = false;
  private knownModels: string[] = [];

  // Fallback models in case DB is unreachable at startup
  private static readonly FALLBACK_MODELS = [
    'onix', 'prisma', 'gol', 'polo', 'hb20', 'corolla', 'civic', 'mobi', 'argo', 'renegade',
    'compass', 'kicks', 'creta', 'tracker', 'hr-v', 'kwid', 'ka', 'fiesta', 'ecosport',
    'strada', 'toro', 'saveiro', 'hilux', 's10', 'ranger', 'cg', 'titan', 'fan', 'biz',
    'bros', 'pcx', 'fazer', 'factor', 'crosser', 'lander', 'nmax'
  ];

  /**
   * Initialize the parser by loading models from the database
   */
  async initialize(): Promise<void> {
    try {
      logger.info('ExactSearchParser: Loading vehicle models from database...');

      // Fetch distinct models from DB
      const dbModels = await prisma.vehicle.findMany({
        select: { modelo: true },
        distinct: ['modelo'],
        where: { disponivel: true }
      });

      const uniqueModels = new Set<string>();

      // Add DB models
      dbModels.forEach(m => {
        if (m.modelo) uniqueModels.add(m.modelo);
      });

      // If DB is empty, use fallback
      if (uniqueModels.size === 0) {
        logger.warn('ExactSearchParser: No models found in DB, using fallback list');
        ExactSearchParser.FALLBACK_MODELS.forEach(m => uniqueModels.add(m));
      }

      this.knownModels = Array.from(uniqueModels);
      this.buildModelPattern();
      this.isInitialized = true;

      logger.info({ count: this.knownModels.length }, 'ExactSearchParser: Initialized with models');
    } catch (error) {
      logger.error({ error }, 'ExactSearchParser: Failed to initialize from DB, using fallback');
      this.knownModels = [...ExactSearchParser.FALLBACK_MODELS];
      this.buildModelPattern();
      this.isInitialized = true;
    }
  }

  /**
   * Build regex pattern for model matching
   */
  private buildModelPattern(): void {
    // Sort by length descending to match longer names first
    const sortedModels = this.knownModels.sort((a, b) => b.length - a.length);
    const escapedModels = sortedModels.map(m => m.replace(/[-/]/g, '[-/]?'));
    // Create regex: word boundary + (model1|model2|...) + word boundary, case insensitive
    this.modelPattern = new RegExp(`\\b(${escapedModels.join('|')})\\b`, 'i');
  }

  /**
   * Ensure parser is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Patterns that indicate the user is talking about a vehicle they OWN (trade-in)
   * vs a vehicle they want to BUY
   */
  private static readonly TRADE_IN_PATTERNS: RegExp[] = [
    // PRIORITY: Simple patterns first (most common cases)
    // "tenho um X, quero trocar" - MOST COMMON PATTERN
    /\btenho\s+um[a]?\s+\w+.*quero\s+trocar/i,
    // "tenho um X" followed by comma (indicates listing owned car)
    /\btenho\s+um[a]?\s+\w+\s*,/i,
    // "possuo um/uma ..."
    /\b(possuo|tenho)\s+(um|uma|o|a|meu|minha)\b/i,
    // "quero trocar meu/minha ..."
    /\bquero\s+trocar\s+(meu|minha|o\s+meu|a\s+minha|de\s+carro)\b/i,
    // "quero trocar" at beginning or after comma (implies has car to trade)
    /(?:^|,\s*)quero\s+trocar\b/i,
    // "meu carro é ..." or "minha ... é" (with optional "um/uma" after)
    /\b(meu\s+carro|minha\s+carro|meu\s+ve[ií]culo)\s+[eé](\s+um|\s+uma|\s+o|\s+a)?\b/i,
    // "dar na troca o meu/minha ..."
    /\bdar\s+(na\s+)?troca\s+(o\s+meu|a\s+minha|meu|minha)\b/i,
    // "trocar meu/minha X em/por um Y"
    /\btrocar\s+(meu|minha)\s+\w+.*\s+(em|por)\s+(um|uma)\b/i,
    // "possuo um X e quero" or "tenho um X e quero"
    /\b(possuo|tenho)\s+(um|uma)\s+\w+.*\s+e\s+(quero|gostaria|preciso)\b/i,
    // "X YEAR, quero trocar" - model and year followed by "quero trocar"
    /\b\w+\s+\d{4}\s*,\s*quero\s+trocar/i,
  ];

  /**
   * Check if the query indicates the user is mentioning their own vehicle (trade-in context)
   *
   * @param query - User query
   * @returns true if the query mentions a vehicle the user owns (for trade-in)
   */
  isTradeInContext(query: string): boolean {
    const normalizedQuery = query.toLowerCase().trim();

    for (const pattern of ExactSearchParser.TRADE_IN_PATTERNS) {
      if (pattern.test(normalizedQuery)) {
        logger.debug(
          { query, pattern: pattern.source },
          'ExactSearchParser: detected trade-in context'
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Parse a user query and extract model and year filters
   */
  async parse(query: string): Promise<ExtractedFilters> {
    await this.ensureInitialized();

    const normalizedQuery = this.normalizeQuery(query);

    const model = this.extractModel(normalizedQuery);
    const yearRange = this.extractYearRange(normalizedQuery);
    const year = yearRange ? null : this.extractYear(normalizedQuery);

    const result: ExtractedFilters = {
      model,
      year,
      yearRange,
      rawQuery: query,
    };

    logger.debug({ query, result }, 'ExactSearchParser: parsed query');

    return result;
  }

  /**
   * Allow manual injection of models (mostly for testing)
   */
  addModels(models: string[]) {
    models.forEach(m => {
      if (!this.knownModels.includes(m)) this.knownModels.push(m);
    });
    this.buildModelPattern();
  }

  /**
   * Normalize query for easier parsing
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .trim();
  }

  /**
   * Mapping of common transcription errors to correct model names
   */
  private static readonly MODEL_CORRECTIONS: Record<string, string> = {
    // Civic variations
    circ: 'Civic',
    civico: 'Civic',
    sivic: 'Civic',
    civick: 'Civic',
    cívic: 'Civic',
    cívico: 'Civic',
    sívic: 'Civic',
    // Corolla variations
    corola: 'Corolla',
    carola: 'Corolla',
    corolla: 'Corolla',
    // SUV models
    crv: 'Cr-V',
    hrv: 'Hr-V',
    wrv: 'Wr-V',
    tcross: 'T-Cross',
    scross: 'S-Cross',
    santafe: 'Santa Fe',
    // Other common corrections
    onyx: 'Onix',
    polo: 'Polo',
    goal: 'Gol',
  };

  /**
   * Extract model name from query
   */
  private extractModel(query: string): string | null {
    if (!this.modelPattern) return null;

    const match = query.match(this.modelPattern);
    if (match) {
      const rawModel = match[1].toLowerCase();

      // Check if we have a correction for this transcription error
      if (ExactSearchParser.MODEL_CORRECTIONS[rawModel]) {
        return ExactSearchParser.MODEL_CORRECTIONS[rawModel];
      }

      // Capitalize first letter of each word
      return match[1]
        .split(/[-\s]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('-')
        .replace(/-$/, ''); // Remove trailing dash
    }
    return null;
  }

  /**
   * Extract year range from query (e.g., "2018 a 2020", "2019/2020")
   */
  private extractYearRange(query: string): { min: number; max: number } | null {
    // Pattern for "2018 a 2020" or "2018 até 2020"
    const rangePattern = /(\d{4})\s*(?:a|ate|até|-)\s*(\d{4})/i;
    const rangeMatch = query.match(rangePattern);
    if (rangeMatch) {
      const year1 = parseInt(rangeMatch[1], 10);
      const year2 = parseInt(rangeMatch[2], 10);
      if (this.isValidYear(year1) && this.isValidYear(year2)) {
        return {
          min: Math.min(year1, year2),
          max: Math.max(year1, year2),
        };
      }
    }

    // Pattern for "2019/2020" (model year format)
    const slashPattern = /(\d{4})\/(\d{4})/;
    const slashMatch = query.match(slashPattern);
    if (slashMatch) {
      const year1 = parseInt(slashMatch[1], 10);
      const year2 = parseInt(slashMatch[2], 10);
      if (this.isValidYear(year1) && this.isValidYear(year2)) {
        return {
          min: Math.min(year1, year2),
          max: Math.max(year1, year2),
        };
      }
    }

    // Pattern for abbreviated slash format "19/20"
    const abbrevSlashPattern = /\b(\d{2})\/(\d{2})\b/;
    const abbrevSlashMatch = query.match(abbrevSlashPattern);
    if (abbrevSlashMatch) {
      const year1 = this.expandAbbreviatedYear(parseInt(abbrevSlashMatch[1], 10));
      const year2 = this.expandAbbreviatedYear(parseInt(abbrevSlashMatch[2], 10));
      if (year1 && year2) {
        return {
          min: Math.min(year1, year2),
          max: Math.max(year1, year2),
        };
      }
    }

    return null;
  }

  /**
   * Extract single year from query
   */
  private extractYear(query: string): number | null {
    // First try full year format (4 digits)
    const fullYearPattern = /\b(19\d{2}|20\d{2})\b/;
    const fullYearMatch = query.match(fullYearPattern);
    if (fullYearMatch) {
      const year = parseInt(fullYearMatch[1], 10);
      if (this.isValidYear(year)) {
        return year;
      }
    }

    // Try abbreviated year format (2 digits) - must be standalone
    // Avoid matching things like "hb20" or "208"
    const abbrevYearPattern = /(?:^|\s)(\d{2})(?:\s|$)/;
    const abbrevYearMatch = query.match(abbrevYearPattern);
    if (abbrevYearMatch) {
      const abbrevYear = parseInt(abbrevYearMatch[1], 10);
      const expandedYear = this.expandAbbreviatedYear(abbrevYear);
      if (expandedYear) {
        return expandedYear;
      }
    }

    return null;
  }

  /**
   * Expand abbreviated year (e.g., "19" -> 2019, "95" -> 1995)
   */
  private expandAbbreviatedYear(abbrevYear: number): number | null {
    if (abbrevYear < 0 || abbrevYear > 99) {
      return null;
    }

    // Years 00-30 are assumed to be 2000-2030
    // Years 31-99 are assumed to be 1931-1999
    const fullYear = abbrevYear <= 30 ? 2000 + abbrevYear : 1900 + abbrevYear;

    if (this.isValidYear(fullYear)) {
      return fullYear;
    }
    return null;
  }

  /**
   * Check if year is valid (reasonable range for vehicles)
   */
  private isValidYear(year: number): boolean {
    const currentYear = new Date().getFullYear();
    // Valid years: 1950 to next year (for new models)
    return year >= 1950 && year <= currentYear + 1;
  }
}

// Singleton export
export const exactSearchParser = new ExactSearchParser();
