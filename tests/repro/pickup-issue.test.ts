import { describe, it, expect } from 'vitest';
import { preferenceExtractor } from '../src/agents/preference-extractor.agent';

describe('Preference Extractor - Pickup Issue Repro', () => {
  it('should NOT identify pickup for versatile/economical request', async () => {
    const input =
      'Bom, eu gostaria de um carro versátil, que seja econômico, porque eu não tenho uma renda muito grande, mas que eu posso usar tanto para o uso do dia a dia, como para viagens também.';

    // Config mock to avoid actual LLM call if possible?
    // Wait, preferenceExtractor calls chatCompletion. We need to actually run it or mock it.
    // If I cannot run live LLM tests easily without mocking, I should assume this is an integration test.
    // I will assume the user has the environment set up for real calls or I should check how other tests do it.
    // Looking at existing tests might be wise first. But let's try to run it.

    const result = await preferenceExtractor.extract(input);
    console.log('Extracted:', JSON.stringify(result, null, 2));

    expect(result.extracted.bodyType).not.toBe('pickup');
    expect(result.extracted.priorities || []).not.toContain('pickup');
  });
});
