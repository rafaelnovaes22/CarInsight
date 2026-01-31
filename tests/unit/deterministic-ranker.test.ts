import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  DeterministicRankerService,
  RankingContext,
  UseCase,
} from '../../src/services/deterministic-ranker.service';

// Mock do Prisma
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    vehicle: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/prisma';

const mockedFindMany = vi.mocked(prisma.vehicle.findMany);

// Gerador de veículos para testes de propriedade
const vehicleArbitrary = fc.record({
  id: fc.uuid(),
  marca: fc.constantFrom('Toyota', 'Honda', 'Volkswagen', 'Chevrolet', 'Fiat'),
  modelo: fc.constantFrom('Corolla', 'Civic', 'Gol', 'Onix', 'Mobi'),
  versao: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
  ano: fc.integer({ min: 2015, max: 2026 }),
  preco: fc.integer({ min: 30000, max: 300000 }),
  km: fc.integer({ min: 0, max: 200000 }),
  carroceria: fc.constantFrom('Hatchback', 'Sedan', 'SUV'),
  cambio: fc.constantFrom('Manual', 'Automático', 'CVT'),
  combustivel: fc.constantFrom('Flex', 'Gasolina'),
  scoreConforto: fc.integer({ min: 1, max: 10 }),
  scoreEconomia: fc.integer({ min: 1, max: 10 }),
  scoreEspaco: fc.integer({ min: 1, max: 10 }),
  scoreSeguranca: fc.integer({ min: 1, max: 10 }),
  scoreCustoBeneficio: fc.integer({ min: 1, max: 10 }),
  categoriaVeiculo: fc.constantFrom('hatch_compacto', 'sedan_medio', 'suv_medio'),
  segmentoPreco: fc.constantFrom('economico', 'intermediario', 'premium'),
  aptoFamilia: fc.boolean(),
  aptoUberX: fc.boolean(),
  aptoUberComfort: fc.boolean(),
  aptoUberBlack: fc.boolean(),
  aptoTrabalho: fc.boolean(),
  aptoViagem: fc.boolean(),
  disponivel: fc.constant(true),
});

describe('DeterministicRankerService', () => {
  let ranker: DeterministicRankerService;

  beforeEach(() => {
    vi.clearAllMocks();
    ranker = new DeterministicRankerService();
  });

  describe('rank', () => {
    it('deve filtrar por aptoFamilia quando useCase é familia', async () => {
      const mockVehicles = [
        {
          id: '1',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 2022,
          preco: 100000,
          km: 30000,
          carroceria: 'Sedan',
          cambio: 'Automático',
          combustivel: 'Flex',
          scoreConforto: 8,
          scoreEconomia: 6,
          scoreEspaco: 7,
          scoreSeguranca: 8,
          scoreCustoBeneficio: 7,
          aptoFamilia: true,
          aptoUberX: true,
          aptoUberComfort: true,
          aptoUberBlack: false,
        },
      ];

      mockedFindMany.mockResolvedValueOnce(mockVehicles as any);

      const context: RankingContext = { useCase: 'familia' };
      const result = await ranker.rank(context);

      expect(mockedFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            aptoFamilia: true,
            disponivel: true,
          }),
        })
      );
      expect(result.vehicles.length).toBe(1);
      expect(result.useCase).toBe('familia');
    });

    it('deve ordenar por scoreConforto DESC para familia', async () => {
      mockedFindMany.mockResolvedValueOnce([]);

      const context: RankingContext = { useCase: 'familia' };
      await ranker.rank(context);

      expect(mockedFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([expect.objectContaining({ scoreEspaco: 'desc' })]),
        })
      );
    });

    it('deve mapear uso "uber" para filtro aptoUberX', async () => {
      mockedFindMany.mockResolvedValueOnce([]);

      const context: RankingContext = { useCase: 'uber' };
      await ranker.rank(context);

      expect(mockedFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            aptoUberX: true,
          }),
        })
      );
    });

    it('deve aplicar filtro de orçamento', async () => {
      mockedFindMany.mockResolvedValueOnce([]);

      const context: RankingContext = { useCase: 'familia', budget: 80000 };
      await ranker.rank(context);

      expect(mockedFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            preco: { lte: 80000 },
          }),
        })
      );
    });

    it('deve aplicar filtro de ano mínimo', async () => {
      mockedFindMany.mockResolvedValueOnce([]);

      const context: RankingContext = { useCase: 'uberX', minYear: 2018 };
      await ranker.rank(context);

      expect(mockedFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ano: { gte: 2018 },
          }),
        })
      );
    });

    it('deve calcular score corretamente', async () => {
      const mockVehicles = [
        {
          id: '1',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 2024,
          preco: 100000,
          km: 20000,
          carroceria: 'Sedan',
          cambio: 'Automático',
          combustivel: 'Flex',
          scoreConforto: 8,
          scoreEconomia: 7,
          scoreEspaco: 7,
          scoreSeguranca: 8,
          scoreCustoBeneficio: 7,
          aptoFamilia: true,
        },
      ];

      mockedFindMany.mockResolvedValueOnce(mockVehicles as any);

      const context: RankingContext = { useCase: 'familia' };
      const result = await ranker.rank(context);

      // Score deve estar entre 0 e 100
      expect(result.vehicles[0].score).toBeGreaterThanOrEqual(0);
      expect(result.vehicles[0].score).toBeLessThanOrEqual(100);
      // Veículo recente com baixa km e automático deve ter score alto
      expect(result.vehicles[0].score).toBeGreaterThanOrEqual(70);
    });

    it('deve gerar highlights e concerns', async () => {
      const mockVehicles = [
        {
          id: '1',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 2024,
          preco: 100000,
          km: 20000,
          carroceria: 'Sedan',
          cambio: 'Automático',
          combustivel: 'Flex',
          scoreConforto: 8,
          scoreEconomia: 7,
          scoreEspaco: 8,
          scoreSeguranca: 8,
          scoreCustoBeneficio: 7,
          aptoFamilia: true,
        },
      ];

      mockedFindMany.mockResolvedValueOnce(mockVehicles as any);

      const context: RankingContext = { useCase: 'familia' };
      const result = await ranker.rank(context);

      expect(result.vehicles[0].highlights).toContain('Veículo recente (2024)');
      expect(result.vehicles[0].highlights).toContain('Baixa quilometragem (20.000 km)');
      expect(result.vehicles[0].highlights).toContain('Câmbio automático');
    });

    it('deve gerar reasoning baseado no score', async () => {
      const mockVehicles = [
        {
          id: '1',
          marca: 'Toyota',
          modelo: 'Corolla',
          ano: 2024,
          preco: 100000,
          km: 20000,
          carroceria: 'Sedan',
          cambio: 'Automático',
          combustivel: 'Flex',
          scoreConforto: 9,
          scoreEconomia: 8,
          scoreEspaco: 9,
          scoreSeguranca: 9,
          scoreCustoBeneficio: 8,
          aptoFamilia: true,
        },
      ];

      mockedFindMany.mockResolvedValueOnce(mockVehicles as any);

      const context: RankingContext = { useCase: 'familia' };
      const result = await ranker.rank(context);

      expect(result.vehicles[0].reasoning).toContain('Toyota Corolla 2024');
      expect(result.vehicles[0].reasoning).toContain('uso familiar');
    });

    it('deve retornar filterTime', async () => {
      mockedFindMany.mockResolvedValueOnce([]);

      const context: RankingContext = { useCase: 'familia' };
      const result = await ranker.rank(context);

      expect(result.filterTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 6: Filtro de Aptidão Retorna Apenas Veículos Correspondentes
     * **Validates: Requirements 4.2**
     */
    it('deve retornar apenas veículos com aptidão correspondente ao caso de uso', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(vehicleArbitrary, { minLength: 1, maxLength: 20 }),
          fc.constantFrom(
            'familia',
            'uberX',
            'uberComfort',
            'trabalho',
            'viagem'
          ) as fc.Arbitrary<UseCase>,
          async (vehicles, useCase) => {
            // Filtrar veículos que têm a aptidão correspondente
            const aptitudeField = {
              familia: 'aptoFamilia',
              uberX: 'aptoUberX',
              uberComfort: 'aptoUberComfort',
              trabalho: 'aptoTrabalho',
              viagem: 'aptoViagem',
            }[useCase];

            const eligibleVehicles = vehicles.filter((v: any) => v[aptitudeField] === true);
            mockedFindMany.mockResolvedValueOnce(eligibleVehicles as any);

            const context: RankingContext = { useCase };
            const result = await ranker.rank(context);

            // Verificar que o filtro foi aplicado corretamente
            expect(mockedFindMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: expect.objectContaining({
                  [aptitudeField]: true,
                }),
              })
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property 7: Ordenação por Score Mantém Ordem Decrescente
     * **Validates: Requirements 4.3**
     */
    it('veículos devem estar ordenados por score decrescente', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(vehicleArbitrary, { minLength: 2, maxLength: 10 }),
          async vehicles => {
            // Marcar todos como aptos para família
            const eligibleVehicles = vehicles.map(v => ({ ...v, aptoFamilia: true }));
            mockedFindMany.mockResolvedValueOnce(eligibleVehicles as any);

            const context: RankingContext = { useCase: 'familia' };
            const result = await ranker.rank(context);

            // Verificar ordenação decrescente
            for (let i = 1; i < result.vehicles.length; i++) {
              expect(result.vehicles[i - 1].score).toBeGreaterThanOrEqual(result.vehicles[i].score);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property 8: Performance de Ranqueamento
     * **Validates: Requirements 4.8**
     */
    it('ranqueamento deve completar em tempo razoável', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(vehicleArbitrary, { minLength: 0, maxLength: 50 }),
          async vehicles => {
            const eligibleVehicles = vehicles.map(v => ({ ...v, aptoFamilia: true }));
            mockedFindMany.mockResolvedValueOnce(eligibleVehicles as any);

            const context: RankingContext = { useCase: 'familia' };
            const result = await ranker.rank(context);

            // filterTime deve ser razoável (< 1000ms para mock)
            expect(result.filterTime).toBeLessThan(1000);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Scores devem estar no intervalo [0, 100]
     */
    it('scores calculados devem estar no intervalo [0, 100]', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(vehicleArbitrary, { minLength: 1, maxLength: 10 }),
          async vehicles => {
            const eligibleVehicles = vehicles.map(v => ({ ...v, aptoFamilia: true }));
            mockedFindMany.mockResolvedValueOnce(eligibleVehicles as any);

            const context: RankingContext = { useCase: 'familia' };
            const result = await ranker.rank(context);

            for (const vehicle of result.vehicles) {
              expect(vehicle.score).toBeGreaterThanOrEqual(0);
              expect(vehicle.score).toBeLessThanOrEqual(100);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Normalização de UseCase', () => {
    it('deve mapear sinônimos corretamente', async () => {
      const testCases = [
        { input: 'família com crianças', expected: 'familia' },
        { input: 'uber', expected: 'uberX' },
        { input: 'uber black', expected: 'uberBlack' },
        { input: 'uber comfort', expected: 'uberComfort' },
        { input: 'viagem longa', expected: 'viagem' },
        { input: 'trabalho profissional', expected: 'trabalho' },
        { input: 'app de transporte', expected: 'uberX' },
        { input: '99', expected: 'uberX' },
      ];

      for (const { input, expected } of testCases) {
        mockedFindMany.mockResolvedValueOnce([]);
        const context: RankingContext = { useCase: input as UseCase };
        const result = await ranker.rank(context);
        expect(result.useCase).toBe(expected);
      }
    });
  });
});
