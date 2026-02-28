/**
 * Tests for want-others handler
 *
 * Validates handleListCategories behavior when lastShownVehicles is empty,
 * ensuring categories are listed from DB or errors are handled gracefully.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock prisma
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    vehicle: {
      groupBy: vi.fn(),
    },
  },
}));

// Mock vehicle search adapter
vi.mock('../../../src/services/vehicle-search-adapter.service', () => ({
  vehicleSearchAdapter: {
    search: vi.fn(async () => []),
  },
}));

// Mock logger
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock formatters
vi.mock('../../../src/agents/vehicle-expert/formatters', () => ({
  formatRecommendations: vi.fn(async () => 'formatted'),
}));

// Mock response builder
vi.mock('../../../src/agents/vehicle-expert/utils/response-builder', () => ({
  buildResponse: vi.fn((message, prefs, opts) => ({
    response: message,
    extractedPreferences: prefs,
    needsMoreInfo: opts.needsMoreInfo || [],
    canRecommend: opts.canRecommend ?? false,
    nextMode: opts.nextMode || 'discovery',
    metadata: { processingTime: 0, confidence: opts.confidence ?? 0.9 },
  })),
}));

// Mock vehicle inference utils
vi.mock('../../../src/agents/vehicle-expert/utils/vehicle-inference', () => ({
  inferBodyType: vi.fn(() => null),
  determineCategory: vi.fn(() => ''),
}));

import {
  handleWantOthers,
  WantOthersContext,
} from '../../../src/agents/vehicle-expert/handlers/want-others.handler';
import { prisma } from '../../../src/lib/prisma';

describe('handleWantOthers — handleListCategories (empty lastShownVehicles)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildCtx(overrides?: Partial<WantOthersContext>): WantOthersContext {
    return {
      userMessage: 'outras categorias',
      lastShownVehicles: [],
      extracted: { extracted: {} },
      updatedProfile: {},
      startTime: Date.now(),
      ...overrides,
    };
  }

  it('should return handled: true with category list when DB has vehicles', async () => {
    (prisma.vehicle.groupBy as any).mockResolvedValueOnce([
      { carroceria: 'SUV', _count: { id: 15 } },
      { carroceria: 'Sedan', _count: { id: 10 } },
      { carroceria: 'Hatch', _count: { id: 8 } },
    ]);

    const result = await handleWantOthers(buildCtx());

    expect(result.handled).toBe(true);
    expect(result.response).toBeDefined();
  });

  it('should include category names and counts in response', async () => {
    (prisma.vehicle.groupBy as any).mockResolvedValueOnce([
      { carroceria: 'suv', _count: { id: 15 } },
      { carroceria: 'sedan', _count: { id: 10 } },
    ]);

    const result = await handleWantOthers(buildCtx());

    expect(result.response!.response).toContain('SUVs');
    expect(result.response!.response).toContain('Sedans');
    expect(result.response!.response).toContain('15');
    expect(result.response!.response).toContain('10');
  });

  it('should ask which category interests the user', async () => {
    (prisma.vehicle.groupBy as any).mockResolvedValueOnce([
      { carroceria: 'suv', _count: { id: 5 } },
    ]);

    const result = await handleWantOthers(buildCtx());

    expect(result.response!.response).toContain('Qual categoria te interessa');
  });

  it('should set _waitingForSuggestionResponse and _showedRecommendation flags', async () => {
    (prisma.vehicle.groupBy as any).mockResolvedValueOnce([
      { carroceria: 'suv', _count: { id: 5 } },
    ]);

    const result = await handleWantOthers(buildCtx());

    expect(result.response!.extractedPreferences._waitingForSuggestionResponse).toBe(true);
    expect(result.response!.extractedPreferences._showedRecommendation).toBe(false);
  });

  it('should return handled: false when DB returns empty array', async () => {
    (prisma.vehicle.groupBy as any).mockResolvedValueOnce([]);

    const result = await handleWantOthers(buildCtx());

    expect(result.handled).toBe(false);
  });

  it('should return handled: false when DB query fails', async () => {
    (prisma.vehicle.groupBy as any).mockRejectedValueOnce(new Error('DB connection error'));

    const result = await handleWantOthers(buildCtx());

    expect(result.handled).toBe(false);
  });

  it('should display correct emoji for each category type', async () => {
    (prisma.vehicle.groupBy as any).mockResolvedValueOnce([
      { carroceria: 'suv', _count: { id: 5 } },
      { carroceria: 'pickup', _count: { id: 3 } },
      { carroceria: 'moto', _count: { id: 2 } },
    ]);

    const result = await handleWantOthers(buildCtx());

    expect(result.response!.response).toContain('🚙');
    expect(result.response!.response).toContain('🛻');
    expect(result.response!.response).toContain('🏍️');
  });
});
