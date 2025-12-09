/**
 * Tests for EligibleModelsResolverService
 * 
 * Verifica que o serviço consulta o LLM corretamente para obter
 * modelos permitidos para critérios especiais como Uber Black.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn()
}));

vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { EligibleModelsResolverService } from '../../src/services/eligible-models-resolver.service';
import { chatCompletion } from '../../src/lib/llm-router';

describe('EligibleModelsResolverService', () => {
  let service: EligibleModelsResolverService;

  beforeEach(() => {
    service = new EligibleModelsResolverService();
    service.clearCache();
    vi.clearAllMocks();
  });

  describe('resolveEligibleModels', () => {
    it('deve retornar modelos permitidos para Uber Black', async () => {
      const mockResponse = JSON.stringify({
        allowedModels: ['corolla', 'civic', 'cruze', 'sentra', 'jetta'],
        allowedBrands: ['toyota', 'honda', 'chevrolet', 'nissan', 'volkswagen'],
        minYear: 2018,
        bodyTypes: ['sedan'],
        additionalRequirements: ['4 portas', 'ar condicionado'],
        reasoning: 'Uber Black requer sedans executivos de 2018+',
        confidence: 0.95
      });

      (chatCompletion as any).mockResolvedValue(mockResponse);

      const result = await service.resolveEligibleModels('uber_black');

      expect(result.criteria).toBe('uber_black');
      expect(result.allowedModels).toContain('corolla');
      expect(result.allowedModels).toContain('civic');
      expect(result.minYear).toBe(2018);
      expect(result.bodyTypes).toContain('sedan');
    });

    it('deve usar fallback quando LLM falha', async () => {
      (chatCompletion as any).mockRejectedValue(new Error('LLM error'));

      const result = await service.resolveEligibleModels('uber_black');

      expect(result.criteria).toBe('uber_black');
      expect(result.allowedModels.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('fallback');
    });

    it('deve usar cache para chamadas repetidas', async () => {
      const mockResponse = JSON.stringify({
        allowedModels: ['corolla'],
        allowedBrands: ['toyota'],
        minYear: 2018,
        bodyTypes: ['sedan'],
        additionalRequirements: [],
        reasoning: 'Test',
        confidence: 0.9
      });

      (chatCompletion as any).mockResolvedValue(mockResponse);

      // Primeira chamada
      await service.resolveEligibleModels('uber_black');
      // Segunda chamada (deve usar cache)
      await service.resolveEligibleModels('uber_black');

      expect(chatCompletion).toHaveBeenCalledTimes(1);
    });
  });

  describe('isVehicleEligible', () => {
    beforeEach(() => {
      // Setup mock para retornar modelos Uber Black
      const mockResponse = JSON.stringify({
        allowedModels: ['corolla', 'civic', 'cruze', 'sentra', 'jetta'],
        allowedBrands: ['toyota', 'honda', 'chevrolet', 'nissan', 'volkswagen'],
        minYear: 2018,
        bodyTypes: ['sedan'],
        additionalRequirements: [],
        reasoning: 'Test',
        confidence: 0.9
      });
      (chatCompletion as any).mockResolvedValue(mockResponse);
    });

    it('deve aceitar Corolla 2020 para Uber Black', async () => {
      const result = await service.isVehicleEligible(
        { brand: 'Toyota', model: 'Corolla', year: 2020, bodyType: 'Sedan' },
        'uber_black'
      );

      expect(result.eligible).toBe(true);
    });

    it('deve rejeitar HB20S para Uber Black', async () => {
      const result = await service.isVehicleEligible(
        { brand: 'Hyundai', model: 'HB20S', year: 2020, bodyType: 'Sedan' },
        'uber_black'
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('não está na lista');
    });

    it('deve rejeitar Voyage para Uber Black', async () => {
      const result = await service.isVehicleEligible(
        { brand: 'Volkswagen', model: 'Voyage', year: 2020, bodyType: 'Sedan' },
        'uber_black'
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('não está na lista');
    });

    it('deve rejeitar Prius para Uber Black (não é sedan executivo)', async () => {
      const result = await service.isVehicleEligible(
        { brand: 'Toyota', model: 'Prius', year: 2020, bodyType: 'Hatch' },
        'uber_black'
      );

      expect(result.eligible).toBe(false);
    });

    it('deve rejeitar veículo com ano abaixo do mínimo', async () => {
      const result = await service.isVehicleEligible(
        { brand: 'Toyota', model: 'Corolla', year: 2016, bodyType: 'Sedan' },
        'uber_black'
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('abaixo do mínimo');
    });
  });

  describe('filterEligibleVehicles', () => {
    beforeEach(() => {
      const mockResponse = JSON.stringify({
        allowedModels: ['corolla', 'civic', 'cruze', 'sentra', 'jetta'],
        allowedBrands: ['toyota', 'honda', 'chevrolet', 'nissan', 'volkswagen'],
        minYear: 2018,
        bodyTypes: ['sedan'],
        additionalRequirements: [],
        reasoning: 'Test',
        confidence: 0.9
      });
      (chatCompletion as any).mockResolvedValue(mockResponse);
    });

    it('deve filtrar lista de veículos mantendo apenas elegíveis para Uber Black', async () => {
      const vehicles = [
        { brand: 'Toyota', model: 'Corolla', year: 2020, bodyType: 'Sedan' },
        { brand: 'Toyota', model: 'Prius', year: 2020, bodyType: 'Hatch' },
        { brand: 'Hyundai', model: 'HB20S', year: 2020, bodyType: 'Sedan' },
        { brand: 'Honda', model: 'Civic', year: 2019, bodyType: 'Sedan' },
        { brand: 'Volkswagen', model: 'Voyage', year: 2020, bodyType: 'Sedan' },
      ];

      const result = await service.filterEligibleVehicles(vehicles, 'uber_black');

      // Apenas Corolla e Civic devem passar
      expect(result.length).toBe(2);
      expect(result.map(v => v.model)).toContain('Corolla');
      expect(result.map(v => v.model)).toContain('Civic');
      expect(result.map(v => v.model)).not.toContain('HB20S');
      expect(result.map(v => v.model)).not.toContain('Voyage');
      expect(result.map(v => v.model)).not.toContain('Prius');
    });

    it('deve remover veículos com ano inferior ao mínimo', async () => {
      const vehicles = [
        { brand: 'Toyota', model: 'Corolla', year: 2020, bodyType: 'Sedan' },
        { brand: 'Toyota', model: 'Corolla', year: 2016, bodyType: 'Sedan' },
      ];

      const result = await service.filterEligibleVehicles(vehicles, 'uber_black');

      expect(result.length).toBe(1);
      expect(result[0].year).toBe(2020);
    });
  });
});
