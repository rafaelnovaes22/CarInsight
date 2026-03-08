import { describe, it, expect } from 'vitest';
import { detectHandoffRequest, addHandoffFlag } from '../../../src/utils/handoff-detector';

describe('handoff-detector', () => {
  describe('detectHandoffRequest', () => {
    it.each([
      ['quero falar com um vendedor', 'vendedor'],
      ['chama um humano', 'humano'],
      ['quero uma atendente', 'atendente'],
      ['me passa pra um consultor', 'consultor'],
      ['quero uma pessoa real', 'pessoa real'],
    ])('should detect high confidence: "%s"', (message, keyword) => {
      const result = detectHandoffRequest(message);
      expect(result.isHandoffRequest).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.matchedKeywords).toContain(keyword);
    });

    it.each([
      ['quero falar com alguém', 'falar com alguém'],
      ['atendimento humano por favor', 'humano'], // 'humano' is high confidence
      ['pode transferir?', 'transferir'],
    ])('should detect medium confidence: "%s"', (message, keyword) => {
      const result = detectHandoffRequest(message);
      expect(result.isHandoffRequest).toBe(true);
      expect(result.matchedKeywords).toContain(keyword);
    });

    it.each([
      'quero um corolla 2020',
      'quanto custa esse carro?',
      'tem SUV disponível?',
      'meu orçamento é 80 mil',
    ])('should not detect handoff in normal messages: "%s"', (message) => {
      const result = detectHandoffRequest(message);
      expect(result.isHandoffRequest).toBe(false);
      expect(result.matchedKeywords).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const result = detectHandoffRequest('Quero VENDEDOR agora');
      expect(result.isHandoffRequest).toBe(true);
    });
  });

  describe('addHandoffFlag', () => {
    it('should add handoff_requested flag', () => {
      const result = addHandoffFlag([]);
      expect(result).toContain('handoff_requested');
    });

    it('should not duplicate the flag', () => {
      const result = addHandoffFlag(['handoff_requested']);
      expect(result).toEqual(['handoff_requested']);
    });

    it('should handle undefined', () => {
      const result = addHandoffFlag(undefined);
      expect(result).toEqual(['handoff_requested']);
    });
  });
});
