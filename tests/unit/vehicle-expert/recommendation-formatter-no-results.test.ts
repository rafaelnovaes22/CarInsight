/**
 * Tests for recommendation-formatter no-results message
 *
 * Validates that the empty results message mentions specific categories
 * and does NOT contain vague "Ver outras categorias?" text.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger (used by formatter internally)
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { formatRecommendations } from '../../../src/agents/vehicle-expert/formatters/recommendation-formatter';

describe('formatRecommendations — no results message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mention specific categories (SUV, sedan, hatch, pickup)', async () => {
    const message = await formatRecommendations([], {});

    expect(message).toMatch(/SUV/i);
    expect(message).toMatch(/sedan/i);
    expect(message).toMatch(/hatch/i);
    expect(message).toMatch(/pickup/i);
  });

  it('should NOT contain vague "Ver outras categorias de veículos?" text', async () => {
    const message = await formatRecommendations([], {});

    expect(message).not.toContain('Ver outras categorias de veículos?');
  });

  it('should suggest adjusting criteria', async () => {
    const message = await formatRecommendations([], {});

    expect(message).toMatch(/ajustar|critérios|orçamento/i);
  });

  it('should have app-specific message for uber usage', async () => {
    const message = await formatRecommendations([], {
      usoPrincipal: 'uber',
      appMencionado: '99',
    });

    expect(message).toContain('99');
    expect(message).toContain('aptos para');
  });

  it('should have app-specific message for uber without specific app', async () => {
    const message = await formatRecommendations([], {
      usoPrincipal: 'uber',
    });

    expect(message).toContain('Uber/99');
  });
});
