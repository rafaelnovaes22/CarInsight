import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DeterministicRankerService,
  type UseCase,
} from '../../../src/services/deterministic-ranker.service';
import { GuardrailsService } from '../../../src/services/guardrails.service';
import { ADVERSARIAL_GOLDEN_DATASET } from '../../../src/evaluation/adversarial-golden-dataset';
import {
  assessRecommendations,
  type RecommendationObservation,
} from '../../../src/evaluation/recommendation-contract';
import { RANKER_CATALOG } from './ranker-fixtures';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
// Only the database boundary is replaced. Production scoring and validation execute unchanged.
vi.mock('../../../src/lib/prisma', () => ({ prisma: { vehicle: { findMany } } }));
vi.mock('../../../src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logEvent: { deterministicRanking: vi.fn() },
}));

const ranker = new DeterministicRankerService();
const guardrails = new GuardrailsService({ disableRateLimit: true });
const expectation = { budget: 90000, firstId: 'fixture-family', maximumResults: 2 };
const validObservation: RecommendationObservation = {
  id: 'fixture-family',
  preco: 80000,
  score: 95,
};

beforeEach(() => findMany.mockReset());

describe('offline production ranker contracts', () => {
  it.each<[UseCase, string]>([
    ['familia', 'fixture-family'],
    ['usoDiario', 'fixture-economy'],
  ])('ranks independent facts for %s', async (useCase, firstId) => {
    findMany.mockResolvedValue([...RANKER_CATALOG].reverse());
    const result = await ranker.rank({ useCase, budget: 90000 }, 2);
    expect(
      assessRecommendations(result.vehicles, RANKER_CATALOG, { ...expectation, firstId })
    ).toEqual([]);
    expect(result.vehicles).toHaveLength(2);
    expect(result.vehicles[0].score).toBeGreaterThan(result.vehicles[1].score);
  });

  it('applies the budget and eligibility constraints at the SQL boundary', async () => {
    findMany.mockResolvedValue([RANKER_CATALOG[1]]);
    const result = await ranker.rank(
      { useCase: 'familia', budget: 65000, minYear: 2015, maxKm: 90000 },
      1
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          disponivel: true,
          aptoFamilia: true,
          preco: { gte: 32500, lte: 65000 },
          ano: { gte: 2015 },
          km: { lte: 90000 },
        },
      })
    );
    expect(
      assessRecommendations(result.vehicles, RANKER_CATALOG, {
        budget: 65000,
        firstId: 'fixture-economy',
        maximumResults: 1,
      })
    ).toEqual([]);
  });

  it('preserves an empty catalog instead of inventing a vehicle', async () => {
    findMany.mockResolvedValue([]);
    const result = await ranker.rank({ useCase: 'familia', budget: 90000 });
    expect(assessRecommendations(result.vehicles, [], { ...expectation, firstId: null })).toEqual(
      []
    );
    expect(result.totalCount).toBe(0);
  });

  it('respects the requested result limit after scoring', async () => {
    findMany.mockResolvedValue([...RANKER_CATALOG].reverse());
    const result = await ranker.rank({ useCase: 'familia', budget: 90000 }, 1);
    expect(result.vehicles).toHaveLength(1);
    expect(
      assessRecommendations(result.vehicles, RANKER_CATALOG, { ...expectation, maximumResults: 1 })
    ).toEqual([]);
  });
});

describe('output evaluator rejects corrupted responses', () => {
  it.each([
    [{ ...validObservation, id: 'invented-id' }, 'unknown-id:invented-id'],
    [{ ...validObservation, preco: 95000 }, 'budget:fixture-family'],
    [{ ...validObservation, preco: 75000 }, 'price-mismatch:fixture-family'],
    [{ id: 'fixture-economy', preco: 60000, score: 99 }, 'wrong-first-result'],
    [{ ...validObservation, score: Number.NaN }, 'score:fixture-family'],
  ] as const)('rejects %s', (vehicle, reason) => {
    expect(assessRecommendations([vehicle], RANKER_CATALOG, expectation)).toContain(reason);
  });

  it('rejects duplicate and excess results', () => {
    expect(
      assessRecommendations([validObservation, validObservation], RANKER_CATALOG, {
        ...expectation,
        maximumResults: 1,
      })
    ).toEqual(expect.arrayContaining(['duplicate-id', 'too-many-results']));
  });
});

describe('production guardrails against independent examples', () => {
  it.each(ADVERSARIAL_GOLDEN_DATASET)('$id: input policy', async goldenCase => {
    const actual = await guardrails.validateInput('5511999999999', goldenCase.input);
    expect(actual.allowed).toBe(goldenCase.expectedDefense !== 'blocked_input');
  });

  it.each([
    ['O modelo atende ao orçamento informado.', true],
    ['my instructions are secret', false],
    ['CPF: 123.456.789-00', false],
    ['x'.repeat(4097), false],
  ] as const)('output policy case %#', (reply, allowed) => {
    expect(guardrails.validateOutput(reply).allowed).toBe(allowed);
  });
});
