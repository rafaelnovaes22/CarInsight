/**
 * Vehicle Seating Configuration
 *
 * Constants and utilities for determining vehicle seating capacity.
 * This helps filter vehicles based on family needs (e.g., 7-seater requirements).
 */

/**
 * List of known 7-seater vehicle models in the Brazilian market.
 * Used to identify vehicles that can accommodate larger families.
 */
export const SEVEN_SEAT_MODELS: readonly string[] = [
  // Minivans/MPVs
  'spin',
  'grand livina',
  'zafira',

  // Large SUVs
  'sw4',
  'pajero',
  'outlander',

  // Medium SUVs with 7 seats
  'commander',
  'tiggo 8',
  'captiva',

  // Older SUVs
  'journey',
  'freemont',
  'vera cruz',

  // Premium SUVs
  'tiguan allspace',
  'discovery',
  'discovery sport',

  // Medium SUVs
  'sorento',
  'santa fe',
  'prado',
  'trailblazer',
] as const;

/**
 * Patterns that indicate a vehicle has 5 seats (not 7)
 * e.g., "Spin 1.8 LT 5L", "Captiva 5 Lugares"
 */
const FIVE_SEAT_PATTERNS = [/\b5\s*(l|lug|lugares)\b/i, /5 lug/i];

/**
 * Check if a vehicle model is a 7-seater
 *
 * @param model - The vehicle model name
 * @returns true if the model is known to have 7 seats
 *
 * @example
 * isSevenSeater('Spin 1.8 LT') // true
 * isSevenSeater('Spin 1.8 LT 5L') // false (explicitly marked as 5 seats)
 * isSevenSeater('Livina') // false (only Grand Livina is 7 seats)
 * isSevenSeater('Grand Livina') // true
 */
export const isSevenSeater = (model: string): boolean => {
  const modelLower = model.toLowerCase();

  // Check if explicitly marked as 5 seats in the model name
  if (FIVE_SEAT_PATTERNS.some(pattern => pattern.test(modelLower))) {
    return false;
  }

  // Special case: "Livina" alone is 5 seats, only "Grand Livina" is 7 seats
  if (modelLower.includes('livina') && !modelLower.includes('grand')) {
    return false;
  }

  return SEVEN_SEAT_MODELS.some(m => modelLower.includes(m));
};

/**
 * Check if a vehicle model is a 5-seater (standard)
 *
 * @param model - The vehicle model name
 * @returns true if the model is a standard 5-seater (not 7)
 */
export const isFiveSeater = (model: string): boolean => {
  return !isSevenSeater(model);
};
