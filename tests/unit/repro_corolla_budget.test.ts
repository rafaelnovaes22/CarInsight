
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vehicleSearchAdapter } from '../../src/services/vehicle-search-adapter.service';
import { prisma } from '../../src/lib/prisma';

// Mock dependencies
vi.mock('../../src/lib/prisma', () => ({
    prisma: {
        vehicle: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));
vi.mock('../../src/lib/logger');
// Mock vector store to be "empty" for specific model search (forcing fallback/direct logic)
vi.mock('../../src/services/in-memory-vector.service', () => ({
    inMemoryVectorStore: {
        isInitialized: vi.fn().mockReturnValue(true),
        searchWithScores: vi.fn().mockResolvedValue([]),
        search: vi.fn().mockResolvedValue([]),
    }
}));

describe('Smart Budget Relaxation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find Corolla even if maxPrice is 90000 (Corolla is 108990)', async () => {
        // Setup: Database has a Corolla costing 108k
        const mockCorolla = {
            id: 'corolla-id',
            modelo: 'Corolla',
            marca: 'Toyota',
            ano: 2018,
            preco: 108990,
            km: 70000,
            disponivel: true,
            carroceria: 'Sedan'
        };

        // User asks "tem corolla?" with active filter maxPrice: 90000
        const query = 'tem corolla?';
        const filters = {
            model: 'corolla', // Parsed from query
            maxPrice: 90000,  // Active from context
            limit: 5
        };

        // Prisma mock logic
        (prisma.vehicle.findMany as any).mockImplementation((args: any) => {
            // 1. First call: With Price Filter -> Returns Empty
            if (args.where.preco?.lte === 90000) {
                return [];
            }
            // 2. Second call (Retry): Without Price Filter -> Returns Corolla
            if (!args.where.preco) {
                return [mockCorolla];
            }
            return [];
        });

        const results = await vehicleSearchAdapter.search(query, filters);

        // Expectation: Should find logic now!
        expect(results).toHaveLength(1);
        expect(results[0].vehicle.modelo).toBe('Corolla');
    });
});
