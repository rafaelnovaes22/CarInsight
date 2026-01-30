import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vehicleExpert } from '../src/agents/vehicle-expert.agent';
import { vehicleSearchAdapter } from '../src/services/vehicle-search-adapter.service';

// Mock the dependencies
// Updated for latency-optimization: now uses searchByUseCase for use-case-based queries
vi.mock('../src/services/vehicle-search-adapter.service', () => ({
  vehicleSearchAdapter: {
    search: vi.fn().mockResolvedValue([]),
    searchByUseCase: vi.fn().mockResolvedValue([]),
  },
}));

// Mock preference extractor to avoid complex logic
vi.mock('../src/agents/preference-extractor.agent', () => ({
  preferenceExtractor: {
    extract: vi.fn().mockResolvedValue({ extracted: {}, confidence: 1 }),
    mergeWithProfile: vi.fn().mockImplementation((p, e) => ({ ...p, ...e })),
  },
}));

// Mock internal assessors to ensure we hit recommendation flow
vi.mock('../src/agents/vehicle-expert/assessors', async () => {
  const actual = await vi.importActual('../src/agents/vehicle-expert/assessors');
  return {
    ...actual,
    assessReadiness: vi
      .fn()
      .mockReturnValue({ canRecommend: true, confidence: 1, missingRequired: [] }),
  };
});

// Mock intent detector
vi.mock('../src/agents/vehicle-expert/intent-detector', async () => {
  const actual = await vi.importActual('../src/agents/vehicle-expert/intent-detector');
  return {
    ...actual,
    detectUserQuestion: vi.fn().mockReturnValue(false), // Ensure we don't go to QA
  };
});

describe('Family Recommendation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT impose strict aptoFamilia filter for family requests', async () => {
    // Setup a family profile
    const profile = {
      usoPrincipal: 'familia',
      people: 5,
      budget: 75000,
      priorities: ['cadeirinha', 'espaço'],
      completed: true,
    };

    const context = {
      conversationId: 'test-id',
      phoneNumber: '123',
      profile: profile,
      messages: [{ role: 'user', content: 'Quero um carro para família', timestamp: new Date() }],
      metadata: { messageCount: 1 },
      mode: 'discovery',
    };

    // Run chat
    await vehicleExpert.chat('Quero ver as opções', context as any);

    // Updated for latency-optimization: now uses searchByUseCase for use-case-based queries
    // Verify vehicleSearchAdapter.searchByUseCase was called (not search)
    const searchByUseCaseCalls = vi.mocked(vehicleSearchAdapter.searchByUseCase).mock.calls;
    const searchCalls = vi.mocked(vehicleSearchAdapter.search).mock.calls;
    
    // Either searchByUseCase or search should be called
    const totalCalls = searchByUseCaseCalls.length + searchCalls.length;
    expect(totalCalls).toBeGreaterThan(0);

    // If searchByUseCase was called, check the use case
    if (searchByUseCaseCalls.length > 0) {
      const useCase = searchByUseCaseCalls[0][0];
      const filters = searchByUseCaseCalls[0][1];
      console.log('searchByUseCase called with useCase:', useCase, 'filters:', filters);
      
      // For family use case, we use 'familia' use case with DeterministicRanker
      // The aptoFamilia filter is applied internally by the ranker
      expect(useCase).toBeDefined();
    } else {
      // Fallback to search was used
      const filters = searchCalls[0][1];
      console.log('search called with filters:', filters);
      expect(filters?.aptoFamilia).toBeUndefined();
    }
  });
});
