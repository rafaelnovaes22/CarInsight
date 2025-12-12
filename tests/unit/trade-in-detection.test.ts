/**
 * Trade-In Detection Tests
 *
 * Tests for the trade-in context detection feature.
 * Ensures that when a user mentions a vehicle they OWN (for trade-in),
 * it's correctly identified and NOT treated as the desired vehicle.
 *
 * Feature: trade-in-detection
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ExactSearchParser } from '../../src/services/exact-search-parser.service';

describe('Trade-In Detection', () => {
  let parser: ExactSearchParser;

  beforeAll(() => {
    parser = new ExactSearchParser();
  });

  describe('isTradeInContext', () => {
    describe('should detect trade-in context', () => {
      const tradeInMessages = [
        // "quero trocar meu/minha"
        'quero trocar meu Polo 2020 por um carro mais novo',
        'quero trocar minha Strada 2018 em um SUV',
        'Quero trocar meu Onix 2019 por um sedan',

        // "tenho um/uma"
        'tenho um Civic 2018 e quero trocar',
        'Tenho uma HB20 2017 e preciso de um carro maior',

        // "possuo um/uma"
        'possuo um Gol 2015 e quero dar na troca',
        'Possuo uma Fiat Toro 2020, quero trocar',

        // "meu carro é"
        'meu carro é um Corolla 2019, quero trocar',

        // "dar na troca"
        'quero dar na troca meu Fox 2016',
        'vou dar na troca o meu Voyage 2018',

        // "trocar meu X por um Y"
        'trocar meu Ka 2020 por um T-Cross',
        'trocar minha Ecosport em um Compass',
      ];

      it.each(tradeInMessages)('"%s" should be detected as trade-in context', message => {
        const result = parser.isTradeInContext(message);
        expect(result).toBe(true);
      });
    });

    describe('should NOT detect trade-in context for desired vehicles', () => {
      const desiredVehicleMessages = [
        // Busca direta
        'quero um Civic 2020',
        'procuro um Onix 2019',
        'preciso de um SUV 2021',

        // Com modelo específico
        'estou procurando um T-Cross 2022',
        'quero ver um Polo 2023',
        'me mostra um Tracker 2021',

        // Perguntas sobre veículos
        'vocês tem Corolla 2020?',
        'tem algum HB20 2019?',
        'quanto custa um Creta 2021?',

        // Busca genérica
        'quero um carro usado até 80 mil',
        'procuro um SUV para família',
        'preciso de um sedan econômico',
      ];

      it.each(desiredVehicleMessages)(
        '"%s" should NOT be detected as trade-in context',
        message => {
          const result = parser.isTradeInContext(message);
          expect(result).toBe(false);
        }
      );
    });
  });

  describe('parse with trade-in context', () => {
    it('should extract vehicle from trade-in message', () => {
      const message = 'quero trocar meu Polo 2020 por um carro mais novo';
      const result = parser.parse(message);

      expect(result.model).toBe('Polo');
      expect(result.year).toBe(2020);
    });

    it('should distinguish trade-in vehicle when checking context', () => {
      const message = 'Me chamo Écio, quero trocar meu Polo 2020 por um carro mais novo';

      // Parser extracts the vehicle (doesn't know context)
      const parseResult = parser.parse(message);
      expect(parseResult.model).toBe('Polo');
      expect(parseResult.year).toBe(2020);

      // Context check identifies it's trade-in
      const isTradeIn = parser.isTradeInContext(message);
      expect(isTradeIn).toBe(true);
    });
  });

  describe('complex trade-in scenarios', () => {
    it('should handle message with both trade-in and desired vehicle', () => {
      const message = 'quero trocar meu Polo 2020 por um Civic';

      const isTradeIn = parser.isTradeInContext(message);
      expect(isTradeIn).toBe(true);

      // Note: The parser extracts the first model found
      // The application logic should handle the context
      const parseResult = parser.parse(message);
      expect(parseResult.model).not.toBeNull();
    });

    it('should handle trade-in with entry value', () => {
      const message = 'tenho um Gol 2016 e 10 mil de entrada para trocar';

      const isTradeIn = parser.isTradeInContext(message);
      expect(isTradeIn).toBe(true);
    });

    it('should handle trade-in with km information', () => {
      const message = 'possuo um Civic 2019 com 50 mil km, quero trocar';

      const isTradeIn = parser.isTradeInContext(message);
      expect(isTradeIn).toBe(true);

      const parseResult = parser.parse(message);
      expect(parseResult.model?.toLowerCase()).toBe('civic');
      expect(parseResult.year).toBe(2019);
    });
  });

  describe('edge cases', () => {
    it('should handle case-insensitive matching', () => {
      expect(parser.isTradeInContext('QUERO TROCAR MEU POLO 2020')).toBe(true);
      expect(parser.isTradeInContext('Tenho um civic 2018')).toBe(true);
    });

    it('should handle messages with punctuation', () => {
      expect(parser.isTradeInContext('Olá! Quero trocar meu Polo 2020...')).toBe(true);
    });

    it('should handle messages with accented names', () => {
      const message = 'Me chamo Écio, quero trocar meu Polo 2020';
      expect(parser.isTradeInContext(message)).toBe(true);
    });

    it('should not match partial words', () => {
      // "entroca" shouldn't match "troca"
      expect(parser.isTradeInContext('entroca um carro')).toBe(false);
    });
  });
});
