import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vehicleExpert } from '../src/agents/vehicle-expert.agent';
import { vehicleSearchAdapter } from '../src/services/vehicle-search-adapter.service';

// Mock the dependencies
vi.mock('../src/services/vehicle-search-adapter.service', () => ({
  vehicleSearchAdapter: {
    search: vi.fn().mockResolvedValue([]),
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

    // Verify vehicleSearchAdapter.search was called
    // We expect the filters object (2nd arg) to have aptoFamilia: undefined
    const calls = vi.mocked(vehicleSearchAdapter.search).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    // Check the filters passed (2nd argument)
    const filters = calls[0][1];
    console.log('Filters passed:', filters);

    expect(filters).toEqual(
      expect.objectContaining({
        // We specifically want to ensure it is NOT true
        // In JS, if we passed undefined, it should be undefined.
      })
    );

    // Explicitly check the value
    expect(filters?.aptoFamilia).toBeUndefined();
  });
});
