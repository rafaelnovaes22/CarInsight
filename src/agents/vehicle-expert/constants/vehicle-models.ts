/**
 * Vehicle Models Classification
 *
 * Lists of vehicle models categorized by body type.
 * Used for identifying vehicle categories and finding similar vehicles.
 */

// ============================================
// SEDAN MODELS
// ============================================

/**
 * Compact sedan models (typically R$ 35k - R$ 60k)
 */
export const SEDAN_COMPACT_MODELS = [
  'voyage',
  'prisma',
  'logan',
  'versa',
  'hb20s',
  'cronos',
  'virtus',
  'onix plus',
] as const;

/**
 * Medium/Large sedan models (typically R$ 55k - R$ 90k+)
 */
export const SEDAN_MEDIUM_MODELS = [
  'cruze',
  'focus',
  'civic',
  'corolla',
  'sentra',
  'jetta',
  'city',
] as const;

/**
 * All known sedan models
 */
export const SEDAN_MODELS = [
  ...SEDAN_COMPACT_MODELS,
  ...SEDAN_MEDIUM_MODELS,
  'yaris sedan',
] as const;

// ============================================
// HATCH MODELS
// ============================================

/**
 * Popular/Entry-level hatch models (typically R$ 25k - R$ 40k)
 */
export const HATCH_POPULAR_MODELS = [
  'mobi',
  'kwid',
  'up',
  'uno',
  'ka',
  'march',
  'celta',
  'palio',
] as const;

/**
 * Compact hatch models (typically R$ 40k - R$ 70k)
 */
export const HATCH_COMPACT_MODELS = [
  'gol',
  'fox',
  'polo',
  'onix',
  'argo',
  'hb20',
  'sandero',
  'fit',
] as const;

/**
 * All known hatch models
 */
export const HATCH_MODELS = [...HATCH_POPULAR_MODELS, ...HATCH_COMPACT_MODELS] as const;

// ============================================
// SUV MODELS
// ============================================

/**
 * Compact SUV models
 */
export const SUV_COMPACT_MODELS = [
  'tcross',
  't-cross',
  'nivus',
  'tracker',
  'creta',
  'hrv',
  'hr-v',
  'kicks',
  'duster',
  'captur',
  'renegade',
] as const;

/**
 * Medium/Large SUV models
 */
export const SUV_MEDIUM_MODELS = [
  'compass',
  'tucson',
  'tiggo',
  'sportage',
  'rav4',
  'crv',
  'cr-v',
] as const;

/**
 * All known SUV models
 */
export const SUV_MODELS = [...SUV_COMPACT_MODELS, ...SUV_MEDIUM_MODELS] as const;

// ============================================
// MOTO MODELS
// ============================================

/**
 * Common motorcycle models
 */
export const MOTO_MODELS = [
  'titan',
  'fan',
  'bros',
  'start',
  'biz',
  'pcx',
  'elite',
  'cb',
  'xre',
  'fazer',
  'factor',
  'crosser',
  'lander',
  'nmax',
  'neo',
  'fluo',
  'mt',
  'r3',
  'r15',
  'ninja',
  'z400',
  'z900',
  'versys',
  'vulcan',
  'cg',
  'nc',
  'adv',
  'pop',
  'lead',
  'burgman',
  'intruder',
  'chopper',
  'gs',
  'tiger',
  'bonneville',
  'scrambler',
  'diavel',
  'monster',
  'multistrada',
  'panigale',
  'streetfighter',
  'hypermotard',
  'desertx',
  'scooter',
] as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Detect body type from model name
 *
 * @param model - The vehicle model name
 * @returns The detected body type or undefined if unknown
 */
export const detectBodyTypeFromModel = (
  model: string
): 'sedan' | 'hatch' | 'suv' | 'moto' | undefined => {
  const modelLower = model.toLowerCase();

  if (MOTO_MODELS.some(m => modelLower.includes(m))) {
    return 'moto';
  }

  if (SEDAN_MODELS.some(m => modelLower.includes(m))) {
    return 'sedan';
  }

  if (HATCH_MODELS.some(m => modelLower.includes(m))) {
    return 'hatch';
  }

  if (SUV_MODELS.some(m => modelLower.includes(m))) {
    return 'suv';
  }

  return undefined;
};

/**
 * Detect vehicle category (price tier) from model and price
 *
 * @param model - The vehicle model name
 * @param price - The vehicle price
 * @param bodyType - Optional pre-detected body type
 * @returns The category: 'popular', 'compacto', or 'medio'
 */
export const detectVehicleCategory = (
  model: string,
  price: number,
  bodyType?: 'sedan' | 'hatch' | 'suv' | 'moto'
): 'popular' | 'compacto' | 'medio' => {
  const modelLower = model.toLowerCase();
  const type = bodyType || detectBodyTypeFromModel(model);

  if (type === 'moto') {
    if (price <= 15000) {
      return 'popular';
    }
    if (price <= 30000) {
      return 'compacto';
    }
    return 'medio';
  }

  if (type === 'sedan') {
    if (SEDAN_COMPACT_MODELS.some(m => modelLower.includes(m)) || price <= 60000) {
      return 'compacto';
    }
    return 'medio';
  }

  if (type === 'hatch') {
    if (HATCH_POPULAR_MODELS.some(m => modelLower.includes(m)) || price <= 40000) {
      return 'popular';
    }
    return 'compacto';
  }

  // SUVs and others
  if (price <= 70000) {
    return 'compacto';
  }
  return 'medio';
};
