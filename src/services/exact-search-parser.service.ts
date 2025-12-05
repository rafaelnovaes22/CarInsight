/**
 * ExactSearchParser Service
 * 
 * Responsible for extracting model and year filters from user queries.
 * Supports various formats: "Onix 2019", "2019 Onix", "Onix 19", "Onix 2018 a 2020", "Onix 2019/2020"
 * 
 * **Feature: exact-vehicle-search**
 * Requirements: 1.1, 5.1, 5.2, 5.3, 5.4
 */

// Lazy logger import to avoid env validation issues during testing
let logger: { debug: (...args: any[]) => void } | null = null;

async function getLogger() {
    if (!logger) {
        try {
            const loggerModule = await import('../lib/logger');
            logger = loggerModule.logger;
        } catch {
            // Fallback for testing environment
            logger = { debug: () => { } };
        }
    }
    return logger;
}

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
 * Common Brazilian car models for pattern matching
 */
const BRAZILIAN_CAR_MODELS = [
    // Chevrolet (incluindo clássicos)
    'onix', 'prisma', 'cruze', 'tracker', 'spin', 'cobalt', 'montana', 's10', 'trailblazer', 'equinox',
    'celta', 'corsa', 'classic', 'agile', 'astra', 'vectra', 'meriva', 'zafira', 'captiva', 'blazer',
    // Volkswagen
    'gol', 'polo', 'virtus', 'voyage', 'saveiro', 'fox', 'up', 't-cross', 'tcross', 'tiguan', 'taos', 'nivus', 'jetta', 'amarok',
    // Fiat
    'uno', 'mobi', 'argo', 'cronos', 'strada', 'toro', 'pulse', 'fastback', 'fiorino', 'ducato', 'doblo', 'siena', 'palio', 'punto',
    // Ford
    'ka', 'fiesta', 'focus', 'ecosport', 'ranger', 'territory', 'bronco', 'maverick', 'fusion',
    // Honda
    'civic', 'city', 'fit', 'hr-v', 'hrv', 'cr-v', 'crv', 'wr-v', 'wrv', 'accord',
    // Toyota
    'corolla', 'yaris', 'etios', 'hilux', 'sw4', 'rav4', 'camry', 'prius',
    // Hyundai
    'hb20', 'hb20s', 'creta', 'tucson', 'santa fe', 'santafe', 'i30', 'azera', 'elantra', 'ix35',
    // Renault
    'kwid', 'sandero', 'logan', 'duster', 'captur', 'oroch', 'stepway', 'master',
    // Nissan
    'march', 'versa', 'sentra', 'kicks', 'frontier',
    // Jeep
    'renegade', 'compass', 'commander', 'wrangler', 'gladiator',
    // Mitsubishi
    'lancer', 'asx', 'outlander', 'pajero', 'l200', 'eclipse',
    // Peugeot
    '208', '2008', '308', '3008', '408', '5008', 'partner', 'expert',
    // Citroën
    'c3', 'c4', 'aircross', 'cactus', 'jumpy',
    // Kia
    'picanto', 'rio', 'cerato', 'sportage', 'sorento', 'carnival', 'stonic', 'seltos',
    // BMW
    'x1', 'x3', 'x5', 'x6', '320i', '328i', '330i', '520i', '530i',
    // Mercedes
    'classe a', 'classe c', 'classe e', 'gla', 'glb', 'glc', 'gle',
    // Audi
    'a3', 'a4', 'a5', 'q3', 'q5', 'q7', 'q8',
    // Volvo
    'xc40', 'xc60', 'xc90', 's60', 'v60',
    // Land Rover
    'evoque', 'discovery', 'defender', 'velar',
    // Suzuki
    'jimny', 'vitara', 'swift', 's-cross', 'scross',
    // Caoa Chery
    'tiggo', 'arrizo',
    // BYD
    'dolphin', 'seal', 'song', 'tang', 'yuan',
    // GWM
    'haval', 'ora',
    // JAC
    'j3', 'j5', 't40', 't50', 't60', 't80',
];

/**
 * Build regex pattern for model matching
 */
function buildModelPattern(): RegExp {
    // Sort by length descending to match longer names first (e.g., "hb20s" before "hb20")
    const sortedModels = [...BRAZILIAN_CAR_MODELS].sort((a, b) => b.length - a.length);
    const escapedModels = sortedModels.map(m => m.replace(/[-\/]/g, '[-/]?'));
    return new RegExp(`\\b(${escapedModels.join('|')})\\b`, 'i');
}

const MODEL_PATTERN = buildModelPattern();

/**
 * ExactSearchParser class
 * Extracts model and year from user queries
 */
export class ExactSearchParser {
    /**
     * Parse a user query and extract model and year filters
     */
    parse(query: string): ExtractedFilters {
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

        // Log asynchronously without blocking (logger may not be available in tests)
        if (logger) {
            logger.debug({ query, result }, 'ExactSearchParser: parsed query');
        }

        return result;
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
     * Extract model name from query
     */
    private extractModel(query: string): string | null {
        const match = query.match(MODEL_PATTERN);
        if (match) {
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

// Export model list for testing
export const KNOWN_MODELS = BRAZILIAN_CAR_MODELS;
