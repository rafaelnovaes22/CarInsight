import { PipelineStep, PipelineContext } from '../chat-pipeline';
import { logger } from '../../../../lib/logger';

/**
 * Detects context switches between vehicle types (e.g., user switches from moto to SUV).
 * When a switch is detected, clears previous state (bodyType, usoPrincipal, priorities, _lastShownVehicles).
 * Always returns null — never terminates the pipeline, only mutates ctx.updatedProfile.
 */
export const contextSwitchStep: PipelineStep = {
  name: 'context-switch',
  execute: async (ctx: PipelineContext) => {
    const { messageLower, extracted, context, updatedProfile } = ctx;
    const previousBodyType = context.profile?.bodyType;
    const previousUsoPrincipal = context.profile?.usoPrincipal;

    // Detect what the user is NOW asking for
    const detectNewContext = () => {
      // Moto keywords
      const motoKeywords = ['moto', 'motocicleta', 'scooter', 'biz', 'titan', 'fan', 'bros', 'pcx'];
      const isMotoRequest = motoKeywords.some(kw => messageLower.includes(kw));

      // Pickup keywords
      const pickupKeywords = [
        'pickup',
        'picape',
        'caminhonete',
        'caçamba',
        'cacamba',
        'carga',
        'obra',
        'material',
      ];
      const isPickupRequest = pickupKeywords.some(kw => messageLower.includes(kw));

      // SUV keywords
      const suvKeywords = ['suv', 'utilitário', 'utilitario', 'crossover', 'jipe', 'jeep'];
      const isSuvRequest = suvKeywords.some(kw => messageLower.includes(kw));

      // Sedan keywords
      const sedanKeywords = ['sedan', 'sedã'];
      const isSedanRequest = sedanKeywords.some(kw => messageLower.includes(kw));

      // Hatch keywords
      const hatchKeywords = ['hatch', 'hatchback', 'compacto'];
      const isHatchRequest = hatchKeywords.some(kw => messageLower.includes(kw));

      // Uber/99 keywords (implies car, not moto)
      const isUberRequest =
        extracted.extracted.usoPrincipal === 'uber' ||
        messageLower.includes('uber') ||
        messageLower.includes('99') ||
        messageLower.includes('aplicativo');

      // Family keywords (implies car with space)
      const isFamilyRequest =
        extracted.extracted.usoPrincipal === 'familia' ||
        messageLower.includes('família') ||
        messageLower.includes('familia') ||
        messageLower.includes('cadeirinha') ||
        messageLower.includes('criança') ||
        messageLower.includes('crianca');

      // Generic car keywords
      const isGenericCarRequest =
        messageLower.includes('carro') ||
        messageLower.includes('veículo') ||
        messageLower.includes('veiculo') ||
        messageLower.includes('automóvel') ||
        messageLower.includes('automovel');

      return {
        isMotoRequest,
        isPickupRequest,
        isSuvRequest,
        isSedanRequest,
        isHatchRequest,
        isUberRequest,
        isFamilyRequest,
        isGenericCarRequest,
        hasNewRequest:
          isMotoRequest ||
          isPickupRequest ||
          isSuvRequest ||
          isSedanRequest ||
          isHatchRequest ||
          isUberRequest ||
          isFamilyRequest ||
          isGenericCarRequest,
      };
    };

    const newContext = detectNewContext();

    // Check if there's a context switch that requires clearing previous state
    const shouldClearContext = () => {
      if (!previousBodyType && !previousUsoPrincipal) return false;
      if (!newContext.hasNewRequest) return false;

      // If had moto and now asking for any car-related request
      if (previousBodyType === 'moto') {
        return (
          newContext.isPickupRequest ||
          newContext.isSuvRequest ||
          newContext.isSedanRequest ||
          newContext.isHatchRequest ||
          newContext.isUberRequest ||
          newContext.isFamilyRequest ||
          newContext.isGenericCarRequest
        );
      }

      // If had pickup and now asking for something else
      if (previousBodyType === 'pickup') {
        return (
          newContext.isMotoRequest ||
          newContext.isSuvRequest ||
          newContext.isSedanRequest ||
          newContext.isHatchRequest ||
          newContext.isUberRequest ||
          newContext.isFamilyRequest
        );
      }

      // If had SUV and now asking for something different
      if (previousBodyType === 'suv') {
        return (
          newContext.isMotoRequest ||
          newContext.isPickupRequest ||
          newContext.isSedanRequest ||
          newContext.isHatchRequest
        );
      }

      // If had sedan and now asking for something different
      if (previousBodyType === 'sedan') {
        return (
          newContext.isMotoRequest ||
          newContext.isPickupRequest ||
          newContext.isSuvRequest ||
          newContext.isHatchRequest
        );
      }

      // If had hatch and now asking for something different
      if (previousBodyType === 'hatch') {
        return (
          newContext.isMotoRequest ||
          newContext.isPickupRequest ||
          newContext.isSuvRequest ||
          newContext.isSedanRequest
        );
      }

      // If had uber context and now asking for moto or pickup
      if (previousUsoPrincipal === 'uber') {
        return newContext.isMotoRequest || newContext.isPickupRequest;
      }

      // If had family context and now asking for moto
      if (previousUsoPrincipal === 'familia') {
        return newContext.isMotoRequest;
      }

      return false;
    };

    if (shouldClearContext()) {
      logger.info(
        {
          previousBodyType,
          previousUsoPrincipal,
          newContext,
        },
        'Context switch detected - clearing previous vehicle context'
      );

      // Clear previous bodyType
      updatedProfile.bodyType = undefined;

      // Clear previous usoPrincipal if switching to something incompatible
      if (
        (previousUsoPrincipal === 'uber' &&
          (newContext.isMotoRequest || newContext.isPickupRequest)) ||
        (previousUsoPrincipal === 'familia' && newContext.isMotoRequest)
      ) {
        updatedProfile.usoPrincipal = undefined;
      }

      // Clear vehicle-type-specific priorities
      if (updatedProfile.priorities) {
        const typeSpecificPriorities = ['moto', 'pickup', 'suv', 'sedan', 'hatch', 'apto_uber'];
        updatedProfile.priorities = updatedProfile.priorities.filter(
          p => !typeSpecificPriorities.includes(p)
        );
      }

      // Clear _lastShownVehicles since context changed
      updatedProfile._showedRecommendation = false;
      updatedProfile._lastShownVehicles = undefined;
      updatedProfile._lastSearchType = undefined;
    }

    return null;
  },
};
