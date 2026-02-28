/**
 * Tests for question-handler fallback logic
 *
 * Validates that generateNextQuestion falls back correctly when LLM fails,
 * especially preventing re-asking about usage when already answered.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock LLM router - force errors to trigger fallback
vi.mock('../../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async () => {
    throw new Error('LLM unavailable');
  }),
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

import { generateNextQuestion } from '../../../src/agents/vehicle-expert/processors/question-handler';
import { CustomerProfile } from '../../../src/types/state.types';
import { QuestionGenerationOptions } from '../../../src/types/conversation.types';

describe('generateNextQuestion fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildOptions(
    profile: Partial<CustomerProfile>,
    missingFields: string[]
  ): QuestionGenerationOptions {
    return {
      profile,
      missingFields,
      context: 'Conversa de teste',
    };
  }

  it('should ask about budget when budget is missing', async () => {
    const options = buildOptions({}, ['budget', 'usage']);

    const result = await generateNextQuestion(options);

    expect(result.question).toContain('investir');
    expect(result.question).toContain('💰');
  });

  it('should ask about usage when budget exists but usage and usoPrincipal are undefined', async () => {
    const options = buildOptions({ budget: 50000 }, ['usage', 'bodyType']);

    const result = await generateNextQuestion(options);

    expect(result.question).toContain('uso principal');
  });

  it('should NOT ask about usage when profile.usage already exists', async () => {
    const options = buildOptions({ budget: 50000, usage: 'viagem' }, ['bodyType']);

    const result = await generateNextQuestion(options);

    expect(result.question).not.toContain('uso principal');
  });

  it('should NOT ask about usage when profile.usoPrincipal already exists', async () => {
    const options = buildOptions({ budget: 50000, usoPrincipal: 'trabalho' } as any, [
      'usage',
      'bodyType',
    ]);

    const result = await generateNextQuestion(options);

    expect(result.question).not.toContain('uso principal');
  });

  it('should ask about bodyType when budget and usage are already filled', async () => {
    const options = buildOptions({ budget: 50000, usage: 'cidade' }, ['bodyType']);

    const result = await generateNextQuestion(options);

    expect(result.question).toMatch(/SUV|sedan|hatch|pickup/i);
  });

  it('should use "na moto" term for motorcycle profiles', async () => {
    const options = buildOptions({ bodyType: 'moto' }, ['budget', 'usage']);

    const result = await generateNextQuestion(options);

    // Budget fallback uses vehicleTerm "na moto" but keeps 💰 emoji for budget question
    expect(result.question).toContain('na moto');
  });

  it('should use "na moto" when priorities include moto', async () => {
    const options = buildOptions({ priorities: ['moto'] }, ['budget', 'usage']);

    const result = await generateNextQuestion(options);

    expect(result.question).toContain('na moto');
  });
});
