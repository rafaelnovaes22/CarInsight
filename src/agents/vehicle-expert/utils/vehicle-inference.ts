/**
 * Vehicle Inference Utility
 *
 * Provides functions to infer vehicle characteristics (body type, category)
 * from model names and prices.
 */

import {
  SEDAN_MODELS,
  HATCH_MODELS,
  SUV_MODELS,
  PICKUP_MODELS,
  SEDAN_COMPACT_MODELS,
  SEDAN_MEDIUM_MODELS,
} from '../constants/vehicle-data';

/**
 * Result of body type inference
 */
export interface BodyTypeInference {
  type: string; // 'sedan', 'suv', etc.
  name: string; // 'sedans', 'SUVs', etc.
}

/**
 * Infer body type from vehicle model name or explicit string
 */
export function inferBodyType(model: string, explicitBodyType?: string): BodyTypeInference | null {
  // Use explicit body type if available
  if (explicitBodyType) {
    const bodyLower = explicitBodyType.toLowerCase();
    if (bodyLower.includes('sedan')) return { type: 'sedan', name: 'sedans' };
    if (bodyLower.includes('hatch')) return { type: 'hatch', name: 'hatches' };
    if (bodyLower.includes('suv')) return { type: 'suv', name: 'SUVs' };
    if (bodyLower.includes('pickup') || bodyLower.includes('picape'))
      return { type: 'pickup', name: 'pickups' };
    if (bodyLower.includes('esportivo') || bodyLower.includes('sport'))
      return { type: 'esportivo', name: 'esportivos' };
    if (bodyLower.includes('van') || bodyLower.includes('minivan'))
      return { type: 'van', name: 'vans' };
    if (
      bodyLower.includes('conversivel') ||
      bodyLower.includes('convers\u00edvel') ||
      bodyLower.includes('cabriolet')
    )
      return { type: 'conversivel', name: 'convers\u00edveis' };
  }

  // Infer from model name
  const modelLower = model.toLowerCase();

  if (SEDAN_MODELS.some(m => modelLower.includes(m))) {
    return { type: 'sedan', name: 'sedans' };
  }

  if (HATCH_MODELS.some(m => modelLower.includes(m))) {
    return { type: 'hatch', name: 'hatches' };
  }

  if (SUV_MODELS.some(m => modelLower.includes(m))) {
    return { type: 'suv', name: 'SUVs' };
  }

  if (PICKUP_MODELS.some(m => modelLower.includes(m))) {
    return { type: 'pickup', name: 'pickups' };
  }

  return null;
}

/**
 * Determine vehicle category (compact, medium, etc.) based on type and price
 */
export function determineCategory(model: string, bodyType: string, price: number): string {
  const modelLower = model.toLowerCase();

  if (bodyType === 'sedan') {
    if (SEDAN_COMPACT_MODELS.some(m => modelLower.includes(m)) || price <= 60000) {
      return 'compacto';
    }
    if (SEDAN_MEDIUM_MODELS.some(m => modelLower.includes(m)) || price > 60000) {
      return 'medio';
    }
  }

  if (bodyType === 'hatch') {
    return price <= 40000 ? 'popular' : 'compacto';
  }

  return '';
}
