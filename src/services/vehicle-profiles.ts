/**
 * Vehicle Profiles and Category Mapping
 *
 * Provides vehicle profile information and category normalization
 * for the fallback recommendations feature. Contains mappings for
 * common Brazilian vehicles and their characteristics.
 *
 * **Feature: vehicle-fallback-recommendations**
 * Requirements: 2.2, 2.3
 */

/**
 * Vehicle category types
 */
export type VehicleCategory = 'sedan' | 'suv' | 'hatch' | 'pickup' | 'minivan';

/**
 * Vehicle segment types (price/size positioning)
 */
export type VehicleSegment = 'entry' | 'compact' | 'midsize' | 'fullsize' | 'premium';

/**
 * Price range definition
 */
export interface PriceRange {
  min: number;
  max: number;
}

/**
 * Vehicle profile with characteristics for similarity matching
 */
export interface VehicleProfile {
  /** Model name (lowercase) */
  model: string;
  /** Vehicle category */
  category: VehicleCategory;
  /** Market segment */
  segment: VehicleSegment;
  /** Typical price range in BRL */
  typicalPriceRange: PriceRange;
}

/**
 * Vehicle profiles for common Brazilian vehicles
 * Used for similarity matching when the exact model is unavailable
 */
export const VEHICLE_PROFILES: Record<string, VehicleProfile> = {
  // Sedans - Midsize
  civic: {
    model: 'civic',
    category: 'sedan',
    segment: 'midsize',
    typicalPriceRange: { min: 100000, max: 180000 },
  },
  corolla: {
    model: 'corolla',
    category: 'sedan',
    segment: 'midsize',
    typicalPriceRange: { min: 110000, max: 190000 },
  },
  cruze: {
    model: 'cruze',
    category: 'sedan',
    segment: 'midsize',
    typicalPriceRange: { min: 90000, max: 150000 },
  },
  sentra: {
    model: 'sentra',
    category: 'sedan',
    segment: 'midsize',
    typicalPriceRange: { min: 100000, max: 160000 },
  },
  jetta: {
    model: 'jetta',
    category: 'sedan',
    segment: 'midsize',
    typicalPriceRange: { min: 130000, max: 200000 },
  },

  // Sedans - Compact
  virtus: {
    model: 'virtus',
    category: 'sedan',
    segment: 'compact',
    typicalPriceRange: { min: 80000, max: 130000 },
  },
  cronos: {
    model: 'cronos',
    category: 'sedan',
    segment: 'compact',
    typicalPriceRange: { min: 75000, max: 120000 },
  },
  hb20s: {
    model: 'hb20s',
    category: 'sedan',
    segment: 'compact',
    typicalPriceRange: { min: 75000, max: 115000 },
  },
  prisma: {
    model: 'prisma',
    category: 'sedan',
    segment: 'compact',
    typicalPriceRange: { min: 70000, max: 100000 },
  },
  voyage: {
    model: 'voyage',
    category: 'sedan',
    segment: 'compact',
    typicalPriceRange: { min: 65000, max: 95000 },
  },
  city: {
    model: 'city',
    category: 'sedan',
    segment: 'compact',
    typicalPriceRange: { min: 90000, max: 140000 },
  },
  versa: {
    model: 'versa',
    category: 'sedan',
    segment: 'compact',
    typicalPriceRange: { min: 85000, max: 130000 },
  },

  // SUVs - Midsize
  compass: {
    model: 'compass',
    category: 'suv',
    segment: 'midsize',
    typicalPriceRange: { min: 140000, max: 220000 },
  },
  tiguan: {
    model: 'tiguan',
    category: 'suv',
    segment: 'midsize',
    typicalPriceRange: { min: 160000, max: 250000 },
  },
  crv: {
    model: 'crv',
    category: 'suv',
    segment: 'midsize',
    typicalPriceRange: { min: 180000, max: 280000 },
  },
  rav4: {
    model: 'rav4',
    category: 'suv',
    segment: 'midsize',
    typicalPriceRange: { min: 200000, max: 300000 },
  },
  taos: {
    model: 'taos',
    category: 'suv',
    segment: 'midsize',
    typicalPriceRange: { min: 150000, max: 200000 },
  },

  // SUVs - Compact
  creta: {
    model: 'creta',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 100000, max: 160000 },
  },
  tracker: {
    model: 'tracker',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 100000, max: 150000 },
  },
  tcross: {
    model: 'tcross',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 110000, max: 160000 },
  },
  kicks: {
    model: 'kicks',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 100000, max: 150000 },
  },
  hrv: {
    model: 'hrv',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 120000, max: 180000 },
  },
  renegade: {
    model: 'renegade',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 110000, max: 170000 },
  },
  duster: {
    model: 'duster',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 90000, max: 140000 },
  },
  captur: {
    model: 'captur',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 100000, max: 150000 },
  },
  ecosport: {
    model: 'ecosport',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 90000, max: 130000 },
  },
  pulse: {
    model: 'pulse',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 90000, max: 140000 },
  },
  fastback: {
    model: 'fastback',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 100000, max: 150000 },
  },
  nivus: {
    model: 'nivus',
    category: 'suv',
    segment: 'compact',
    typicalPriceRange: { min: 100000, max: 150000 },
  },

  // Hatches - Compact
  onix: {
    model: 'onix',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 70000, max: 100000 },
  },
  hb20: {
    model: 'hb20',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 70000, max: 100000 },
  },
  polo: {
    model: 'polo',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 75000, max: 110000 },
  },
  argo: {
    model: 'argo',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 70000, max: 100000 },
  },
  gol: {
    model: 'gol',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 60000, max: 85000 },
  },
  sandero: {
    model: 'sandero',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 70000, max: 100000 },
  },
  ka: {
    model: 'ka',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 60000, max: 85000 },
  },
  fit: {
    model: 'fit',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 80000, max: 120000 },
  },
  yaris: {
    model: 'yaris',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 85000, max: 120000 },
  },
  fox: {
    model: 'fox',
    category: 'hatch',
    segment: 'compact',
    typicalPriceRange: { min: 55000, max: 80000 },
  },

  // Hatches - Entry
  mobi: {
    model: 'mobi',
    category: 'hatch',
    segment: 'entry',
    typicalPriceRange: { min: 50000, max: 70000 },
  },
  kwid: {
    model: 'kwid',
    category: 'hatch',
    segment: 'entry',
    typicalPriceRange: { min: 55000, max: 75000 },
  },
  up: {
    model: 'up',
    category: 'hatch',
    segment: 'entry',
    typicalPriceRange: { min: 55000, max: 75000 },
  },

  // Pickups - Fullsize
  hilux: {
    model: 'hilux',
    category: 'pickup',
    segment: 'fullsize',
    typicalPriceRange: { min: 180000, max: 300000 },
  },
  s10: {
    model: 's10',
    category: 'pickup',
    segment: 'fullsize',
    typicalPriceRange: { min: 160000, max: 280000 },
  },
  ranger: {
    model: 'ranger',
    category: 'pickup',
    segment: 'fullsize',
    typicalPriceRange: { min: 170000, max: 290000 },
  },
  amarok: {
    model: 'amarok',
    category: 'pickup',
    segment: 'fullsize',
    typicalPriceRange: { min: 180000, max: 320000 },
  },
  frontier: {
    model: 'frontier',
    category: 'pickup',
    segment: 'fullsize',
    typicalPriceRange: { min: 170000, max: 280000 },
  },

  // Pickups - Midsize
  toro: {
    model: 'toro',
    category: 'pickup',
    segment: 'midsize',
    typicalPriceRange: { min: 120000, max: 180000 },
  },

  // Pickups - Compact
  strada: {
    model: 'strada',
    category: 'pickup',
    segment: 'compact',
    typicalPriceRange: { min: 80000, max: 130000 },
  },
  saveiro: {
    model: 'saveiro',
    category: 'pickup',
    segment: 'compact',
    typicalPriceRange: { min: 75000, max: 110000 },
  },
  montana: {
    model: 'montana',
    category: 'pickup',
    segment: 'compact',
    typicalPriceRange: { min: 85000, max: 130000 },
  },
  oroch: {
    model: 'oroch',
    category: 'pickup',
    segment: 'compact',
    typicalPriceRange: { min: 90000, max: 130000 },
  },

  // Minivans
  spin: {
    model: 'spin',
    category: 'minivan',
    segment: 'compact',
    typicalPriceRange: { min: 90000, max: 130000 },
  },
  livina: {
    model: 'livina',
    category: 'minivan',
    segment: 'compact',
    typicalPriceRange: { min: 70000, max: 100000 },
  },
};

/**
 * Category mapping for normalizing body type variations
 * Maps various Portuguese and English terms to normalized categories
 */
export const CATEGORY_MAPPING: Record<string, VehicleCategory> = {
  // Sedan variations
  sedan: 'sedan',
  sedã: 'sedan',
  seda: 'sedan',
  fastback: 'sedan',

  // SUV variations
  suv: 'suv',
  utilitario: 'suv',
  utilitário: 'suv',
  crossover: 'suv',
  jipe: 'suv',
  jeep: 'suv',

  // Hatch variations
  hatch: 'hatch',
  hatchback: 'hatch',
  compacto: 'hatch',

  // Pickup variations
  pickup: 'pickup',
  picape: 'pickup',
  'pick-up': 'pickup',
  caminhonete: 'pickup',
  cabine: 'pickup',

  // Minivan variations
  minivan: 'minivan',
  van: 'minivan',
  monovolume: 'minivan',
  mpv: 'minivan',
};

/**
 * Normalizes a body type string to a standard category
 *
 * @param bodyType - The body type string to normalize
 * @returns The normalized category, or the original string if no mapping exists
 */
export function normalizeCategory(bodyType: string): string {
  if (!bodyType) {
    return 'hatch'; // Default category
  }

  const normalized = bodyType.toLowerCase().trim();

  // Direct mapping lookup
  if (CATEGORY_MAPPING[normalized]) {
    return CATEGORY_MAPPING[normalized];
  }

  // Check for partial matches (e.g., "cabine dupla" contains "cabine")
  for (const [key, category] of Object.entries(CATEGORY_MAPPING)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return category;
    }
  }

  // Return original if no mapping found
  return normalized;
}

/**
 * Gets the vehicle profile for a given model name
 *
 * @param model - The model name to look up
 * @returns The vehicle profile if found, or undefined
 */
export function getVehicleProfile(model: string): VehicleProfile | undefined {
  if (!model) {
    return undefined;
  }

  const normalizedModel = model
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[-\s]/g, '') // Remove dashes and spaces
    .trim();

  // Direct lookup
  if (VEHICLE_PROFILES[normalizedModel]) {
    return VEHICLE_PROFILES[normalizedModel];
  }

  // Check for partial matches
  for (const [key, profile] of Object.entries(VEHICLE_PROFILES)) {
    if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
      return profile;
    }
  }

  return undefined;
}

/**
 * Gets the typical price range for a model
 * Falls back to a default range if the model is unknown
 *
 * @param model - The model name
 * @returns The price range for the model
 */
export function getTypicalPriceRange(model: string): PriceRange {
  const profile = getVehicleProfile(model);

  if (profile) {
    return profile.typicalPriceRange;
  }

  // Default mid-range price if model is unknown
  return { min: 80000, max: 120000 };
}

/**
 * Gets the category for a model based on its profile
 *
 * @param model - The model name
 * @returns The category for the model, or 'hatch' as default
 */
export function getModelCategory(model: string): VehicleCategory {
  const profile = getVehicleProfile(model);
  return profile?.category ?? 'hatch';
}
