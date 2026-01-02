
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';
import { prisma } from '../../src/lib/prisma';
import { inMemoryVectorStore } from '../../src/services/in-memory-vector.service';

// Mock other dependencies
vi.mock('../../src/services/exact-search-parser.service', () => ({
    exactSearchParser: {
        parse: vi.fn().mockReturnValue({}),
    },
}));

vi.mock('../../src/lib/prisma', () => ({
    prisma: {
        vehicle: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));
vi.mock('../../src/lib/logger');

// DO NOT mock in-memory-vector.service module entirely, as we want to spy on the singleton instance
// vi.mock('../../src/services/in-memory-vector.service', ...);

describe('Vehicle Ranking Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Ensure initialized
        vi.spyOn(inMemoryVectorStore, 'isInitialized').mockReturnValue(true);
    });

    it('should sort results by Semantic Score (DESC), not Price', async () => {
        // Scenario: User wants "Family Car".
        // Car A: "Meriva" (Great match, Score 0.95, Price 35k)
        // Car B: "Idea" (Good match, Score 0.85, Price 41k)

        // Setup Spy
        const searchSpy = vi.spyOn(inMemoryVectorStore, 'searchWithScores').mockResolvedValue([
            { vehicleId: 'm-1', score: 0.95 },
            { vehicleId: 'i-1', score: 0.85 },
        ]);

        const mockMeriva = { id: 'm-1', modelo: 'Meriva', preco: 35000 };
        const mockIdea = { id: 'i-1', modelo: 'Idea', preco: 41000 };

        // prisma returns list (order is typically DB order or whatever fallback)
        (prisma.vehicle.findMany as any).mockResolvedValue([mockIdea, mockMeriva]);

        // Perform search
        const results = await vehicleSearchAdapter.search('carro familia');

        // Verify spy was called
        expect(searchSpy).toHaveBeenCalled();

        // Verify Ranking
        expect(results).toHaveLength(2);
        expect(results[0].vehicle.id).toBe('m-1'); // Meriva must be first
        expect(results[1].vehicle.id).toBe('i-1');
    });
});
