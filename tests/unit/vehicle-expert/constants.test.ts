/**
 * Constants Unit Tests
 *
 * Tests for the constants and utility functions used by the VehicleExpertAgent.
 */

import { describe, it, expect } from 'vitest';
import {
  isSevenSeater,
  isFiveSeater,
  capitalize,
  formatPrice,
  formatMileage,
  SEVEN_SEAT_MODELS,
  SEDAN_MODELS,
  HATCH_MODELS,
  SUV_MODELS,
  detectBodyTypeFromModel,
  detectVehicleCategory,
} from '../../../src/agents/vehicle-expert/constants';

describe('Vehicle Expert Constants', () => {
  // ============================================
  // isSevenSeater tests
  // ============================================
  describe('isSevenSeater', () => {
    it('should detect known 7-seater models', () => {
      expect(isSevenSeater('Spin LT')).toBe(true);
      expect(isSevenSeater('Grand Livina')).toBe(true);
      expect(isSevenSeater('SW4')).toBe(true);
      expect(isSevenSeater('Pajero Full')).toBe(true);
      expect(isSevenSeater('Tiggo 8')).toBe(true);
      expect(isSevenSeater('Commander')).toBe(true);
    });

    it('should NOT detect 5-seater models as 7-seater', () => {
      expect(isSevenSeater('Civic')).toBe(false);
      expect(isSevenSeater('Corolla')).toBe(false);
      expect(isSevenSeater('Onix')).toBe(false);
      expect(isSevenSeater('Creta')).toBe(false);
    });

    it('should handle explicit 5-seat marking', () => {
      expect(isSevenSeater('Spin 1.8 LT 5L')).toBe(false);
      expect(isSevenSeater('Captiva 5 Lugares')).toBe(false);
    });

    it('should handle Livina vs Grand Livina', () => {
      expect(isSevenSeater('Livina')).toBe(false);
      expect(isSevenSeater('Grand Livina')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isSevenSeater('SPIN')).toBe(true);
      expect(isSevenSeater('spin')).toBe(true);
      expect(isSevenSeater('SpIn')).toBe(true);
    });
  });

  // ============================================
  // isFiveSeater tests
  // ============================================
  describe('isFiveSeater', () => {
    it('should return true for 5-seater models', () => {
      expect(isFiveSeater('Civic')).toBe(true);
      expect(isFiveSeater('Onix')).toBe(true);
      expect(isFiveSeater('Creta')).toBe(true);
    });

    it('should return false for 7-seater models', () => {
      expect(isFiveSeater('Spin')).toBe(false);
      expect(isFiveSeater('SW4')).toBe(false);
    });
  });

  // ============================================
  // capitalize tests
  // ============================================
  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('civic')).toBe('Civic');
      expect(capitalize('onix')).toBe('Onix');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle already capitalized', () => {
      expect(capitalize('Honda')).toBe('Honda');
    });

    it('should only capitalize first letter', () => {
      expect(capitalize('hONDA')).toBe('HONDA');
    });
  });

  // ============================================
  // formatPrice tests
  // ============================================
  describe('formatPrice', () => {
    it('should format price in BRL', () => {
      expect(formatPrice(89990)).toBe('R$ 89.990');
      expect(formatPrice(100000)).toBe('R$ 100.000');
      expect(formatPrice(35000)).toBe('R$ 35.000');
    });
  });

  // ============================================
  // formatMileage tests
  // ============================================
  describe('formatMileage', () => {
    it('should format mileage in km', () => {
      expect(formatMileage(50000)).toBe('50.000 km');
      expect(formatMileage(123456)).toBe('123.456 km');
    });
  });

  // ============================================
  // Constants arrays tests
  // ============================================
  describe('Model Arrays', () => {
    it('should have SEVEN_SEAT_MODELS defined', () => {
      expect(SEVEN_SEAT_MODELS).toBeDefined();
      expect(SEVEN_SEAT_MODELS.length).toBeGreaterThan(0);
      expect(SEVEN_SEAT_MODELS).toContain('spin');
      expect(SEVEN_SEAT_MODELS).toContain('sw4');
    });

    it('should have SEDAN_MODELS defined', () => {
      expect(SEDAN_MODELS).toBeDefined();
      expect(SEDAN_MODELS.length).toBeGreaterThan(0);
    });

    it('should have HATCH_MODELS defined', () => {
      expect(HATCH_MODELS).toBeDefined();
      expect(HATCH_MODELS.length).toBeGreaterThan(0);
    });

    it('should have SUV_MODELS defined', () => {
      expect(SUV_MODELS).toBeDefined();
      expect(SUV_MODELS.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // detectBodyTypeFromModel tests
  // ============================================
  describe('detectBodyTypeFromModel', () => {
    it('should detect sedan models', () => {
      expect(detectBodyTypeFromModel('Civic LXS')).toBe('sedan');
      expect(detectBodyTypeFromModel('Corolla XEi')).toBe('sedan');
      expect(detectBodyTypeFromModel('Voyage Comfortline')).toBe('sedan');
    });

    it('should detect hatch models', () => {
      expect(detectBodyTypeFromModel('Gol G6')).toBe('hatch');
      expect(detectBodyTypeFromModel('Onix LT')).toBe('hatch');
      expect(detectBodyTypeFromModel('Polo TSI')).toBe('hatch');
    });

    it('should detect SUV models', () => {
      expect(detectBodyTypeFromModel('Creta Attitude')).toBe('suv');
      expect(detectBodyTypeFromModel('HR-V EXL')).toBe('suv');
      expect(detectBodyTypeFromModel('Kicks SL')).toBe('suv');
    });

    it('should return undefined for unknown models', () => {
      expect(detectBodyTypeFromModel('Unknown Model XYZ')).toBeUndefined();
    });
  });

  // ============================================
  // detectVehicleCategory tests
  // ============================================
  describe('detectVehicleCategory', () => {
    it('should categorize compact sedans', () => {
      expect(detectVehicleCategory('Voyage', 45000, 'sedan')).toBe('compacto');
      expect(detectVehicleCategory('Prisma', 50000, 'sedan')).toBe('compacto');
    });

    it('should categorize medium sedans', () => {
      expect(detectVehicleCategory('Civic', 90000, 'sedan')).toBe('medio');
      expect(detectVehicleCategory('Corolla', 85000, 'sedan')).toBe('medio');
    });

    it('should categorize popular hatchs', () => {
      expect(detectVehicleCategory('Mobi', 30000, 'hatch')).toBe('popular');
      expect(detectVehicleCategory('Kwid', 35000, 'hatch')).toBe('popular');
    });

    it('should categorize compact hatchs', () => {
      expect(detectVehicleCategory('Polo', 60000, 'hatch')).toBe('compacto');
    });
  });
});
