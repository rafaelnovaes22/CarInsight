
import { describe, it, expect } from 'vitest';
import { extractName } from '../src/graph/langgraph/extractors/name-extractor';

describe('Name Extractor - Greeting Loop Repro', () => {
    it('should return null for simple greetings', () => {
        expect(extractName('Oi')).toBeNull();
        expect(extractName('Olá')).toBeNull();
        expect(extractName('Bom dia')).toBeNull();
    });

    it('should extract name when combined with greeting', () => {
        expect(extractName('Oi Rafael')).toBe('Rafael');
        expect(extractName('Olá, Rafael')).toBe('Rafael');
        expect(extractName('Oi meu nome é Rafael')).toBe('Rafael');
        expect(extractName('Bom dia, aqui é o Rafael')).toBe('Rafael');
    });
});
