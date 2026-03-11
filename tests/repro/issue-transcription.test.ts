import { describe, it, expect } from 'vitest';
import { extractName } from '../src/graph/langgraph/extractors/name-extractor';

describe('Name Extractor Reproduction', () => {
  it('should extract simple compound names', () => {
    const input = 'Nicolas Leonardo';
    const result = extractName(input);
    expect(result).toBe('Nicolas Leonardo');
  });

  it('should extract compound names with prepositions', () => {
    const input = 'Nicolas Leonardo Nepomuceno de Souza Santos';
    // Ideally we want the full name or at least the first two names
    const result = extractName(input);
    expect(result).toBeTruthy();
    expect(result?.includes('Nicolas')).toBe(true);
  });

  it('should extract name from sentence with compound name', () => {
    const input = 'Meu nome é Nicolas Leonardo';
    const result = extractName(input);
    expect(result).toBe('Nicolas Leonardo');
  });

  it('should extract name from "Sou o [Name]" pattern', () => {
    const input = 'Sou o Nicolas Leonardo';
    const result = extractName(input);
    expect(result).toBe('Nicolas Leonardo');
  });

  it('should extract name "Valteriz"', () => {
    const result = extractName('Valteriz');
    expect(result).toBe('Valteriz');
  });
});
