/**
 * Trade-In Vehicle Extractor
 * 
 * Extracts trade-in vehicle information from user messages.
 * Identifies brand, model, year, and mileage.
 */

/**
 * Trade-in vehicle information extracted from message
 */
export interface TradeInInfo {
    brand?: string;
    model?: string;
    year?: number;
    km?: number;
}

/**
 * Common car brands for extraction
 */
const BRANDS = [
    'fiat', 'volkswagen', 'vw', 'chevrolet', 'gm', 'ford', 'honda', 'toyota',
    'hyundai', 'renault', 'nissan', 'jeep', 'peugeot', 'citroen', 'mitsubishi', 'kia'
];

/**
 * Common car models for extraction
 */
const MODELS = [
    'uno', 'palio', 'siena', 'strada', 'toro', 'argo', 'mobi', 'cronos', 'pulse',
    'gol', 'voyage', 'polo', 'virtus', 'saveiro', 'tcross', 'nivus', 'jetta', 'fox', 'up',
    'onix', 'prisma', 'cruze', 'tracker', 'spin', 's10', 'montana', 'equinox', 'celta', 'corsa',
    'ka', 'fiesta', 'focus', 'ecosport', 'ranger', 'fusion', 'territory',
    'civic', 'city', 'fit', 'hrv', 'wrv', 'accord', 'crv',
    'corolla', 'yaris', 'etios', 'hilux', 'sw4', 'rav4',
    'hb20', 'creta', 'tucson', 'i30', 'azera',
    'kwid', 'sandero', 'logan', 'duster', 'captur', 'oroch',
    'march', 'versa', 'sentra', 'kicks', 'frontier',
    'renegade', 'compass', 'commander'
];

/**
 * Brand mapping for model inference
 */
const BRAND_MAP: Record<string, string> = {
    // Volkswagen
    'gol': 'volkswagen', 'voyage': 'volkswagen', 'polo': 'volkswagen', 'virtus': 'volkswagen',
    'saveiro': 'volkswagen', 'fox': 'volkswagen', 'up': 'volkswagen', 't-cross': 'volkswagen',
    'tcross': 'volkswagen', 'nivus': 'volkswagen', 'jetta': 'volkswagen', 'amarok': 'volkswagen',
    'tiguan': 'volkswagen', 'taos': 'volkswagen',
    // Chevrolet
    'onix': 'chevrolet', 'prisma': 'chevrolet', 'cruze': 'chevrolet', 'tracker': 'chevrolet',
    'spin': 'chevrolet', 's10': 'chevrolet', 'montana': 'chevrolet', 'equinox': 'chevrolet',
    'celta': 'chevrolet', 'corsa': 'chevrolet', 'trailblazer': 'chevrolet', 'cobalt': 'chevrolet',
    // Fiat
    'uno': 'fiat', 'palio': 'fiat', 'siena': 'fiat', 'strada': 'fiat', 'toro': 'fiat',
    'argo': 'fiat', 'mobi': 'fiat', 'cronos': 'fiat', 'pulse': 'fiat', 'fastback': 'fiat',
    'fiorino': 'fiat', 'ducato': 'fiat', 'doblo': 'fiat', 'punto': 'fiat',
    // Ford
    'ka': 'ford', 'fiesta': 'ford', 'focus': 'ford', 'ecosport': 'ford', 'ranger': 'ford',
    'territory': 'ford', 'bronco': 'ford', 'maverick': 'ford', 'fusion': 'ford',
    // Honda
    'civic': 'honda', 'city': 'honda', 'fit': 'honda', 'hr-v': 'honda', 'hrv': 'honda',
    'cr-v': 'honda', 'crv': 'honda', 'wr-v': 'honda', 'wrv': 'honda', 'accord': 'honda',
    // Toyota
    'corolla': 'toyota', 'yaris': 'toyota', 'etios': 'toyota', 'hilux': 'toyota',
    'sw4': 'toyota', 'rav4': 'toyota', 'camry': 'toyota', 'prius': 'toyota',
    // Hyundai
    'hb20': 'hyundai', 'hb20s': 'hyundai', 'creta': 'hyundai', 'tucson': 'hyundai',
    'santa fe': 'hyundai', 'santafe': 'hyundai', 'i30': 'hyundai', 'azera': 'hyundai',
    'elantra': 'hyundai', 'ix35': 'hyundai',
    // Renault
    'kwid': 'renault', 'sandero': 'renault', 'logan': 'renault', 'duster': 'renault',
    'captur': 'renault', 'oroch': 'renault', 'stepway': 'renault', 'master': 'renault',
    // Nissan
    'march': 'nissan', 'versa': 'nissan', 'sentra': 'nissan', 'kicks': 'nissan', 'frontier': 'nissan',
    // Jeep
    'renegade': 'jeep', 'compass': 'jeep', 'commander': 'jeep', 'wrangler': 'jeep', 'gladiator': 'jeep',
    // Mitsubishi
    'lancer': 'mitsubishi', 'asx': 'mitsubishi', 'outlander': 'mitsubishi',
    'pajero': 'mitsubishi', 'l200': 'mitsubishi', 'eclipse': 'mitsubishi',
};

/**
 * Extract trade-in vehicle info from message (model, year, km)
 * Differentiates "150 mil km" from "150 mil de entrada"
 * 
 * @param message - User message to extract info from
 * @returns Extracted trade-in vehicle information
 */
export function extractTradeInInfo(message: string): TradeInInfo {
    const normalized = message.toLowerCase();

    let brand: string | undefined;
    let model: string | undefined;
    let year: number | undefined;
    let km: number | undefined;

    // Extract brand
    for (const b of BRANDS) {
        if (normalized.includes(b)) {
            brand = b.toUpperCase();
            if (brand === 'VW') brand = 'VOLKSWAGEN';
            if (brand === 'GM') brand = 'CHEVROLET';
            break;
        }
    }

    // Extract model
    for (const m of MODELS) {
        if (normalized.includes(m)) {
            model = m.toUpperCase();
            break;
        }
    }

    // Extract year (4 digits between 2000-2025)
    const yearMatch = message.match(/\b(20[0-2][0-9])\b/);
    if (yearMatch) {
        const y = parseInt(yearMatch[1]);
        if (y >= 2000 && y <= 2025) {
            year = y;
        }
    }

    // Extract km - look for patterns like "150 mil km", "150.000 km", "150000km"
    // IMPORTANT: Only if "km" is present, to avoid confusing with entry value
    const kmPatterns = [
        /(\d+)\s*mil\s*km/i,           // "150 mil km"
        /(\d{1,3})[.,](\d{3})\s*km/i,  // "150.000 km" or "150,000 km"
        /(\d{4,6})\s*km/i,             // "150000 km"
    ];

    for (let i = 0; i < kmPatterns.length; i++) {
        const pattern = kmPatterns[i];
        const kmMatch = message.match(pattern);
        if (kmMatch) {
            if (i === 0) {
                // "150 mil km" format
                km = parseInt(kmMatch[1]) * 1000;
            } else if (i === 1) {
                // "150.000 km" format
                km = parseInt(kmMatch[1]) * 1000 + parseInt(kmMatch[2]);
            } else {
                // "150000 km" format
                km = parseInt(kmMatch[1]);
            }
            break;
        }
    }

    return { brand, model, year, km };
}

/**
 * Infer brand from model name
 * Maps common models to their brands
 * 
 * @param model - Model name to infer brand from
 * @returns Inferred brand name or undefined
 */
export function inferBrandFromModel(model: string): string | undefined {
    const modelLower = model.toLowerCase();
    return BRAND_MAP[modelLower] || undefined;
}

// Export constants for potential reuse
export { BRANDS, MODELS, BRAND_MAP };
