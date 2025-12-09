/**
 * Vehicle Expert Constants
 * 
 * Central export file for all constants used by the VehicleExpertAgent.
 * This provides a clean import interface for the main agent file.
 */

// Seating configuration
export {
    SEVEN_SEAT_MODELS,
    isSevenSeater,
    isFiveSeater,
} from './seating.constants';

// Vehicle models classification
export {
    SEDAN_COMPACT_MODELS,
    SEDAN_MEDIUM_MODELS,
    SEDAN_MODELS,
    HATCH_POPULAR_MODELS,
    HATCH_COMPACT_MODELS,
    HATCH_MODELS,
    SUV_COMPACT_MODELS,
    SUV_MEDIUM_MODELS,
    SUV_MODELS,
    detectBodyTypeFromModel,
    detectVehicleCategory,
} from './vehicle-models';

// System prompt
export { SYSTEM_PROMPT } from './system-prompt';

// Utilities
export {
    capitalize,
    capitalizeWords,
    formatPrice,
    formatMileage,
} from './utils';
