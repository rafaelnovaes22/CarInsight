/**
 * RecommendationAgent Fallback Integration Tests
 *
 * Unit tests for the RecommendationAgent's integration with FallbackService.
 * Tests year alternative formatting, similar profile formatting, and edge cases.
 *
 * **Feature: vehicle-fallback-recommendations**
 * Requirements: 5.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FallbackService } from '../../src/services/fallback.service';
import { FallbackResponseFormatter } from '../../src/services/fallback-response-formatter.service';
import { Vehicle } from '../../src/services/exact-search.service';

// ============================================================================
// Test Data
// ============================================================================

const createTestVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: `test-${Math.random().toString(36).substr(2, 9)}`,
  marca: 'Honda',
  modelo: 'Civic',
  versao: '2.0 EXL',
  ano: 2023,
  km: 15000,
  preco: 130000,
  cor: 'Branco',
  carroceria: 'Sedan',
  combustivel: 'Flex',
  cambio: 'Automático',
  disponivel: true,
  fotoUrl: 'https://example.com/photo.jpg',
  url: 'https://example.com/vehicle',
  ...overrides,
});

const createTestInventory = (): Vehicle[] => [
  // Civics de diferentes anos
  createTestVehicle({ id: 'civic-2023', modelo: 'Civic', ano: 2023, preco: 130000 }),
  createTestVehicle({ id: 'civic-2022', modelo: 'Civic', ano: 2022, preco: 120000 }),
  createTestVehicle({ id: 'civic-2021', modelo: 'Civic', ano: 2021, preco: 110000 }),
  
  // Outros Hondas
  createTestVehicle({ id: 'hrv-2023', modelo: 'HR-V', ano: 2023, preco: 140000, carroceria: 'SUV' }),
  createTestVehicle({ id: 'city-2023', modelo: 'City', ano: 2023, preco: 100000 }),
  
  // Outros sedans
  createTestVehicle({ id: 'corolla-2023', marca: 'Toyota', modelo: 'Corolla', ano: 2023, preco: 140000 }),
  createTestVehicle({ id: 'cruze-2023', marca: 'Chevrolet', modelo: 'Cruze', ano: 2023, preco: 120000 }),
  
  // SUVs
  createTestVehicle({ id: 'creta-2023', marca: 'Hyundai', modelo: 'Creta', ano: 2023, preco: 115000, carroceria: 'SUV' }),
  createTestVehicle({ id: 'tracker-2023', marca: 'Chevrolet', modelo: 'Tracker', ano: 2023, preco: 110000, carroceria: 'SUV' }),
  
  // Hatches
  createTestVehicle({ id: 'onix-2023', marca: 'Chevrolet', modelo: 'Onix', ano: 2023, preco: 80000, carroceria: 'Hatch' }),
  createTestVehicle({ id: 'polo-2023', marca: 'Volkswagen', modelo: 'Polo', ano: 2023, preco: 85000, carroceria: 'Hatch' }),
];

// ============================================================================
// Tests
// ============================================================================

describe('RecommendationAgent Fallback Integration', () => {
  let fallbackService: FallbackService;
  let fallbackFormatter: FallbackResponseFormatter;

  beforeEach(() => {
    fallbackService = new FallbackService();
    fallbackFormatter = new FallbackResponseFormatter();
  });

  describe('Year Alternative Formatting', () => {
    it('returns year alternatives when exact year not found', () => {
      const inventory = createTestInventory();
      
      // Request Civic 2020 (doesn't exist, but 2021-2023 do)
      const result = fallbackService.findAlternatives('Civic', 2020, inventory);

      expect(result.type).toBe('year_alternative');
      expect(result.vehicles.length).toBeGreaterThan(0);
      expect(result.availableYears).toBeDefined();
      expect(result.availableYears).toContain(2021);
      expect(result.availableYears).toContain(2022);
      expect(result.availableYears).toContain(2023);
    });

    it('formats year alternatives with proper message', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Civic', 2020, inventory);
      const formatted = fallbackFormatter.format(result);

      expect(formatted.acknowledgment).toContain('Civic');
      expect(formatted.acknowledgment).toContain('2020');
      expect(formatted.acknowledgment).toContain('mesmo modelo');
      expect(formatted.alternatives.length).toBeGreaterThan(0);
    });

    it('sorts year alternatives by proximity to requested year', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Civic', 2020, inventory);

      // 2021 should be first (closest to 2020)
      expect(result.vehicles[0].vehicle.ano).toBe(2021);
    });
  });

  describe('Similar Profile Formatting', () => {
    it('returns same brand alternatives when model not found', () => {
      const inventory = createTestInventory();
      
      // Request Honda Accord (doesn't exist)
      const result = fallbackService.findAlternatives('Accord', null, inventory, 130000);

      // Should find other Hondas
      expect(['same_brand', 'same_category', 'price_range']).toContain(result.type);
      expect(result.vehicles.length).toBeGreaterThan(0);
    });

    it('returns same category alternatives when brand not found', () => {
      const inventory = createTestInventory();
      
      // Request BMW 320i (doesn't exist)
      const result = fallbackService.findAlternatives('320i', null, inventory, 130000);

      // Should find other sedans in similar price range
      expect(['same_category', 'price_range', 'no_results']).toContain(result.type);
    });

    it('formats similar profile with relevance explanation', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Accord', null, inventory, 130000);
      
      if (result.vehicles.length > 0) {
        const formatted = fallbackFormatter.format(result);

        expect(formatted.acknowledgment).toContain('Accord');
        expect(formatted.acknowledgment).toContain('disponível');
        
        for (const alt of formatted.alternatives) {
          expect(alt.vehicleDescription.length).toBeGreaterThan(0);
          expect(alt.relevanceExplanation.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles empty inventory', () => {
      const result = fallbackService.findAlternatives('Civic', 2023, []);

      expect(result.type).toBe('no_results');
      expect(result.vehicles).toEqual([]);
      expect(result.message).toContain('disponível');
    });

    it('handles unknown model', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('ModeloDesconhecido', 2023, inventory);

      // Should still try to find alternatives by category/price
      expect(result).toBeDefined();
      expect(result.requestedModel).toBe('ModeloDesconhecido');
    });

    it('handles empty model name', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('', 2023, inventory);

      expect(result.type).toBe('no_results');
      expect(result.message).toContain('especificado');
    });

    it('handles null year', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Civic', null, inventory);

      // Should not crash and should return valid result
      expect(result).toBeDefined();
      // With null year, should skip year_alternative and go to other strategies
      expect(['same_brand', 'same_category', 'price_range', 'no_results']).toContain(result.type);
    });

    it('handles very high reference price', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Ferrari', null, inventory, 1000000);

      // Should return no_results or price_range with few matches
      expect(result).toBeDefined();
    });

    it('handles very low reference price', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Mobi', null, inventory, 30000);

      // Should return alternatives or no_results
      expect(result).toBeDefined();
    });
  });

  describe('Response Formatting', () => {
    it('limits highlights to 3 per vehicle', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Civic', 2020, inventory);
      const formatted = fallbackFormatter.format(result);

      for (const alt of formatted.alternatives) {
        expect(alt.highlights.length).toBeLessThanOrEqual(3);
      }
    });

    it('includes vehicle description with brand, model, year, price', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Civic', 2020, inventory);
      const formatted = fallbackFormatter.format(result);

      for (let i = 0; i < formatted.alternatives.length; i++) {
        const alt = formatted.alternatives[i];
        const vehicle = result.vehicles[i].vehicle;

        expect(alt.vehicleDescription).toContain(vehicle.marca);
        expect(alt.vehicleDescription).toContain(vehicle.modelo);
        expect(alt.vehicleDescription).toContain(String(vehicle.ano));
      }
    });

    it('generates appropriate summary message', () => {
      const inventory = createTestInventory();
      const result = fallbackService.findAlternatives('Civic', 2020, inventory);
      const formatted = fallbackFormatter.format(result);

      expect(formatted.summary.length).toBeGreaterThan(0);
      expect(formatted.summary).toContain(String(result.vehicles.length));
    });

    it('handles no_results type gracefully', () => {
      const result = fallbackService.findAlternatives('Civic', 2023, []);
      const formatted = fallbackFormatter.format(result);

      expect(formatted.acknowledgment).toBeDefined();
      expect(formatted.alternatives).toEqual([]);
      expect(formatted.summary).toContain('alternativas');
    });
  });

  describe('Fallback Priority Chain', () => {
    it('prioritizes year alternatives over brand alternatives', () => {
      const inventory = createTestInventory();
      
      // Request Civic 2020 - should get year alternatives first
      const result = fallbackService.findAlternatives('Civic', 2020, inventory);

      expect(result.type).toBe('year_alternative');
    });

    it('falls back to brand when no year alternatives', () => {
      // Create inventory without Civic
      const inventory = createTestInventory().filter(v => v.modelo !== 'Civic');
      
      // Request Civic - should get same brand (Honda) alternatives
      const result = fallbackService.findAlternatives('Civic', 2023, inventory, 130000);

      // Should be same_brand (HR-V, City) or same_category
      expect(['same_brand', 'same_category', 'price_range']).toContain(result.type);
    });

    it('falls back to category when no brand alternatives', () => {
      // Create inventory without any Honda
      const inventory = createTestInventory().filter(v => v.marca !== 'Honda');
      
      // Request Civic - should get same category (Sedan) alternatives
      const result = fallbackService.findAlternatives('Civic', 2023, inventory, 130000);

      expect(['same_category', 'price_range']).toContain(result.type);
    });
  });
});
