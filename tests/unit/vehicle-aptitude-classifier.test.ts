import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  VehicleAptitudeClassifier,
  getDeterministicClassification,
  VehicleForClassification,
  VehicleAptitudeResult,
} from '../../src/services/vehicle-aptitude-classifier.service';

// Mock do LLM router
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(),
}));

import { chatCompletion } from '../../src/lib/llm-router';

const mockedChatCompletion = vi.mocked(chatCompletion);

// Gerador de veículos para testes de propriedade
const vehicleArbitrary = fc.record({
  marca: fc.constantFrom('Toyota', 'Honda', 'Volkswagen', 'Chevrolet', 'Fiat', 'Renault'),
  modelo: fc.constantFrom('Corolla', 'Civic', 'Gol', 'Onix', 'Mobi', 'Kwid', 'HRV', 'Creta'),
  versao: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  ano: fc.integer({ min: 2010, max: 2026 }),
  km: fc.integer({ min: 0, max: 300000 }),
  preco: fc.option(fc.integer({ min: 20000, max: 500000 })),
  carroceria: fc.constantFrom('Hatchback', 'Sedan', 'SUV', 'Pickup', 'Van', 'Minivan'),
  combustivel: fc.constantFrom('Flex', 'Gasolina', 'Diesel', 'Elétrico', 'Híbrido'),
  cambio: fc.constantFrom('Manual', 'Automático', 'CVT'),
  portas: fc.constantFrom(2, 4, 5),
  arCondicionado: fc.boolean(),
  airbag: fc.option(fc.boolean()),
  abs: fc.option(fc.boolean()),
});

describe('VehicleAptitudeClassifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDeterministicClassification', () => {
    it('deve classificar SUV como aptoFamilia', () => {
      const suv: VehicleForClassification = {
        marca: 'Honda',
        modelo: 'HR-V',
        ano: 2022,
        km: 30000,
        preco: 120000,
        carroceria: 'SUV',
        combustivel: 'Flex',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
        airbag: true,
        abs: true,
      };

      const result = getDeterministicClassification(suv);

      expect(result.aptoFamilia).toBe(true);
      expect(result.categoriaVeiculo).toBe('suv_medio');
    });

    it('deve classificar sedan médio 2017+ como aptoUberComfort', () => {
      const sedan: VehicleForClassification = {
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2020,
        km: 50000,
        preco: 100000,
        carroceria: 'Sedan',
        combustivel: 'Flex',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
        airbag: true,
        abs: true,
      };

      const result = getDeterministicClassification(sedan);

      expect(result.aptoUberComfort).toBe(true);
      expect(result.aptoUberX).toBe(true);
      expect(result.categoriaVeiculo).toBe('sedan_medio');
    });

    it('deve rejeitar hatch compacto para família', () => {
      const hatch: VehicleForClassification = {
        marca: 'Fiat',
        modelo: 'Mobi',
        ano: 2022,
        km: 20000,
        preco: 45000,
        carroceria: 'Hatchback',
        combustivel: 'Flex',
        cambio: 'Manual',
        portas: 4,
        arCondicionado: true,
      };

      const result = getDeterministicClassification(hatch);

      expect(result.aptoFamilia).toBe(false);
      expect(result.categoriaVeiculo).toBe('hatch_compacto');
    });

    it('deve rejeitar veículo sem ar-condicionado para UberX', () => {
      const vehicle: VehicleForClassification = {
        marca: 'Volkswagen',
        modelo: 'Gol',
        ano: 2020,
        km: 30000,
        preco: 50000,
        carroceria: 'Hatchback',
        combustivel: 'Flex',
        cambio: 'Manual',
        portas: 4,
        arCondicionado: false,
      };

      const result = getDeterministicClassification(vehicle);

      expect(result.aptoUberX).toBe(false);
    });

    it('deve rejeitar veículo anterior a 2016 para UberX', () => {
      const vehicle: VehicleForClassification = {
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2015,
        km: 100000,
        preco: 60000,
        carroceria: 'Sedan',
        combustivel: 'Flex',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
      };

      const result = getDeterministicClassification(vehicle);

      expect(result.aptoUberX).toBe(false);
    });

    it('deve excluir modelos específicos do UberComfort', () => {
      const kardian: VehicleForClassification = {
        marca: 'Renault',
        modelo: 'Kardian',
        ano: 2024,
        km: 5000,
        preco: 100000,
        carroceria: 'SUV',
        combustivel: 'Flex',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
      };

      const result = getDeterministicClassification(kardian);

      expect(result.aptoUberComfort).toBe(false);
      expect(result.aptoUberBlack).toBe(false);
    });

    it('deve classificar pickup como aptoCarga', () => {
      const pickup: VehicleForClassification = {
        marca: 'Toyota',
        modelo: 'Hilux',
        ano: 2022,
        km: 40000,
        preco: 200000,
        carroceria: 'Pickup',
        combustivel: 'Diesel',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
      };

      const result = getDeterministicClassification(pickup);

      expect(result.aptoCarga).toBe(true);
      expect(result.aptoUberX).toBe(false);
      expect(result.categoriaVeiculo).toBe('pickup');
    });

    it('deve classificar segmento de preço corretamente', () => {
      const economico: VehicleForClassification = {
        marca: 'Fiat',
        modelo: 'Mobi',
        ano: 2022,
        km: 20000,
        preco: 45000,
        carroceria: 'Hatchback',
        combustivel: 'Flex',
        cambio: 'Manual',
        portas: 4,
        arCondicionado: true,
      };

      const premium: VehicleForClassification = {
        marca: 'BMW',
        modelo: 'X5',
        ano: 2023,
        km: 10000,
        preco: 450000,
        carroceria: 'SUV',
        combustivel: 'Gasolina',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
      };

      expect(getDeterministicClassification(economico).segmentoPreco).toBe('economico');
      expect(getDeterministicClassification(premium).segmentoPreco).toBe('premium');
    });
  });

  describe('VehicleAptitudeClassifier.classify', () => {
    it('deve usar fallback quando LLM falha', async () => {
      mockedChatCompletion.mockRejectedValueOnce(new Error('LLM timeout'));

      const classifier = new VehicleAptitudeClassifier();
      const vehicle: VehicleForClassification = {
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2022,
        km: 30000,
        preco: 100000,
        carroceria: 'Sedan',
        combustivel: 'Flex',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
      };

      const result = await classifier.classify(vehicle);

      // Deve retornar resultado do fallback determinístico
      expect(result).toBeDefined();
      expect(result.aptoUberX).toBe(true);
      expect(result.categoriaVeiculo).toBe('sedan_medio');
    });

    it('deve parsear resposta JSON válida do LLM', async () => {
      const llmResponse = JSON.stringify({
        aptoFamilia: true,
        aptoUberX: true,
        aptoUberComfort: true,
        aptoUberBlack: false,
        aptoTrabalho: true,
        aptoViagem: true,
        aptoCarga: false,
        aptoUsoDiario: true,
        aptoEntrega: false,
        scoreConforto: 8,
        scoreEconomia: 6,
        scoreEspaco: 7,
        scoreSeguranca: 8,
        scoreCustoBeneficio: 7,
        categoriaVeiculo: 'sedan_medio',
        segmentoPreco: 'intermediario',
      });

      mockedChatCompletion.mockResolvedValueOnce(llmResponse);

      const classifier = new VehicleAptitudeClassifier();
      const vehicle: VehicleForClassification = {
        marca: 'Toyota',
        modelo: 'Corolla',
        ano: 2022,
        km: 30000,
        preco: 100000,
        carroceria: 'Sedan',
        combustivel: 'Flex',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
      };

      const result = await classifier.classify(vehicle);

      expect(result.aptoFamilia).toBe(true);
      expect(result.scoreConforto).toBe(8);
      expect(result.categoriaVeiculo).toBe('sedan_medio');
    });

    it('deve usar fallback quando resposta JSON é inválida', async () => {
      mockedChatCompletion.mockResolvedValueOnce('resposta inválida não é JSON');

      const classifier = new VehicleAptitudeClassifier();
      const vehicle: VehicleForClassification = {
        marca: 'Honda',
        modelo: 'HR-V',
        ano: 2022,
        km: 30000,
        preco: 120000,
        carroceria: 'SUV',
        combustivel: 'Flex',
        cambio: 'Automático',
        portas: 4,
        arCondicionado: true,
      };

      const result = await classifier.classify(vehicle);

      // Deve retornar resultado do fallback
      expect(result).toBeDefined();
      expect(result.categoriaVeiculo).toBe('suv_medio');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 2: Invariante de Scores no Intervalo [1, 10]
     * **Validates: Requirements 2.1-2.6**
     */
    it('scores devem estar no intervalo [1, 10] para qualquer veículo', () => {
      fc.assert(
        fc.property(vehicleArbitrary, vehicle => {
          const result = getDeterministicClassification(vehicle as VehicleForClassification);

          expect(result.scoreConforto).toBeGreaterThanOrEqual(1);
          expect(result.scoreConforto).toBeLessThanOrEqual(10);
          expect(result.scoreEconomia).toBeGreaterThanOrEqual(1);
          expect(result.scoreEconomia).toBeLessThanOrEqual(10);
          expect(result.scoreEspaco).toBeGreaterThanOrEqual(1);
          expect(result.scoreEspaco).toBeLessThanOrEqual(10);
          expect(result.scoreSeguranca).toBeGreaterThanOrEqual(1);
          expect(result.scoreSeguranca).toBeLessThanOrEqual(10);
          expect(result.scoreCustoBeneficio).toBeGreaterThanOrEqual(1);
          expect(result.scoreCustoBeneficio).toBeLessThanOrEqual(10);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3: Validação de Enums de Categoria
     * **Validates: Requirements 3.1**
     */
    it('categoriaVeiculo deve ser um valor válido para qualquer veículo', () => {
      const validCategories = [
        'hatch_compacto',
        'hatch_medio',
        'sedan_compacto',
        'sedan_medio',
        'sedan_executivo',
        'suv_compacto',
        'suv_medio',
        'suv_grande',
        'pickup',
        'minivan',
        'van',
        'esportivo',
      ];

      fc.assert(
        fc.property(vehicleArbitrary, vehicle => {
          const result = getDeterministicClassification(vehicle as VehicleForClassification);
          expect(validCategories).toContain(result.categoriaVeiculo);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 4: Validação de Enum de Segmento de Preço
     * **Validates: Requirements 3.2**
     */
    it('segmentoPreco deve ser um valor válido para qualquer veículo', () => {
      const validSegments = ['economico', 'intermediario', 'premium'];

      fc.assert(
        fc.property(vehicleArbitrary, vehicle => {
          const result = getDeterministicClassification(vehicle as VehicleForClassification);
          expect(validSegments).toContain(result.segmentoPreco);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 7: Regras UberX
     * **Validates: Requirements 1.4**
     */
    it('veículos com ano < 2016 ou sem ar-condicionado devem ter aptoUberX = false', () => {
      fc.assert(
        fc.property(vehicleArbitrary, vehicle => {
          const v = vehicle as VehicleForClassification;
          const result = getDeterministicClassification(v);

          if (v.ano < 2016 || !v.arCondicionado || v.portas < 4) {
            expect(result.aptoUberX).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8: Regras UberComfort - Modelos Excluídos
     * **Validates: Requirements 1.5**
     */
    it('modelos excluídos devem ter aptoUberComfort = false', () => {
      const excludedModels = ['Kardian', 'Basalt', 'Tiggo 3', 'Tiggo 3X', 'Logan'];

      fc.assert(
        fc.property(
          fc.record({
            marca: fc.constantFrom('Renault', 'Citroën', 'Chery'),
            modelo: fc.constantFrom(...excludedModels),
            ano: fc.integer({ min: 2020, max: 2026 }),
            km: fc.integer({ min: 0, max: 100000 }),
            preco: fc.integer({ min: 50000, max: 150000 }),
            carroceria: fc.constantFrom('SUV', 'Sedan'),
            combustivel: fc.constant('Flex'),
            cambio: fc.constant('Automático'),
            portas: fc.constant(4),
            arCondicionado: fc.constant(true),
          }),
          vehicle => {
            const result = getDeterministicClassification(vehicle as VehicleForClassification);
            expect(result.aptoUberComfort).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Todos os campos de aptidão devem ser booleanos
     */
    it('todos os campos de aptidão devem ser booleanos', () => {
      fc.assert(
        fc.property(vehicleArbitrary, vehicle => {
          const result = getDeterministicClassification(vehicle as VehicleForClassification);

          expect(typeof result.aptoFamilia).toBe('boolean');
          expect(typeof result.aptoUberX).toBe('boolean');
          expect(typeof result.aptoUberComfort).toBe('boolean');
          expect(typeof result.aptoUberBlack).toBe('boolean');
          expect(typeof result.aptoTrabalho).toBe('boolean');
          expect(typeof result.aptoViagem).toBe('boolean');
          expect(typeof result.aptoCarga).toBe('boolean');
          expect(typeof result.aptoUsoDiario).toBe('boolean');
          expect(typeof result.aptoEntrega).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });
  });
});
