/**
 * Tests for PreferenceExtractorAgent
 *
 * Uses mocked LLM responses for consistent testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferenceExtractorAgent } from '../../src/agents/preference-extractor.agent';

// Mock the LLM router to avoid real API calls
vi.mock('../../src/lib/llm-router', () => ({
  chatCompletion: vi.fn(async (messages: any[]) => {
    const userMessage = messages[messages.length - 1].content.toLowerCase();

    // COMPLEX PATTERNS FIRST (more specific)

    // Complex multi-preference: SUV automático 70 mil viagens 5 pessoas Honda
    if (
      userMessage.includes('suv') &&
      userMessage.includes('70 mil') &&
      userMessage.includes('viagens') &&
      userMessage.includes('5 pessoas') &&
      userMessage.includes('honda')
    ) {
      return JSON.stringify({
        extracted: {
          bodyType: 'suv',
          transmission: 'automatico',
          budget: 70000,
          budgetMax: 70000,
          people: 5,
          usage: 'viagem',
          brand: 'honda',
        },
        confidence: 0.95,
        reasoning: 'Preferências complexas extraídas',
        fieldsExtracted: [
          'bodyType',
          'transmission',
          'budget',
          'budgetMax',
          'people',
          'usage',
          'brand',
        ],
      });
    }

    // Multiple fields: budget, people, usage
    if (userMessage.includes('até 60 mil para 4 pessoas') && userMessage.includes('cidade')) {
      return JSON.stringify({
        extracted: { budget: 60000, budgetMax: 60000, people: 4, usage: 'cidade' },
        confidence: 0.95,
        reasoning: 'Múltiplos campos extraídos',
        fieldsExtracted: ['budget', 'budgetMax', 'people', 'usage'],
      });
    }

    // SUV automático econômico
    if (userMessage.includes('suv automático') && userMessage.includes('econômico')) {
      return JSON.stringify({
        extracted: { bodyType: 'suv', transmission: 'automatico', priorities: ['economico'] },
        confidence: 0.9,
        reasoning: 'Tipo, transmissão e prioridade extraídos',
        fieldsExtracted: ['bodyType', 'transmission', 'priorities'],
      });
    }

    // SIMPLE PATTERNS (less specific - checked after complex patterns)

    // Budget extraction
    if (userMessage.includes('até 50 mil') || userMessage.includes('50 mil de orçamento')) {
      return JSON.stringify({
        extracted: { budget: 50000, budgetMax: 50000 },
        confidence: 0.95,
        reasoning: 'Orçamento claramente especificado',
        fieldsExtracted: ['budget', 'budgetMax'],
      });
    }

    // People extraction (only if not part of complex message)
    if (
      (userMessage.includes('para 5 pessoas') || userMessage.includes('5 pessoas')) &&
      !userMessage.includes('70 mil')
    ) {
      return JSON.stringify({
        extracted: { people: 5 },
        confidence: 0.95,
        reasoning: 'Quantidade de pessoas especificada',
        fieldsExtracted: ['people'],
      });
    }

    // Usage extraction (only if not part of complex message)
    if (
      (userMessage.includes('para viagens') || userMessage.includes('viagens longas')) &&
      !userMessage.includes('70 mil')
    ) {
      return JSON.stringify({
        extracted: { usage: 'viagem' },
        confidence: 0.9,
        reasoning: 'Uso para viagens identificado',
        fieldsExtracted: ['usage'],
      });
    }

    // Daily usage extraction
    if (userMessage.includes('uso diario') || userMessage.includes('dia a dia')) {
      return JSON.stringify({
        extracted: { usage: 'diario' },
        confidence: 0.9,
        reasoning: 'Uso diario identificado',
        fieldsExtracted: ['usage'],
      });
    }

    // Body type extraction
    if (
      userMessage.includes('prefiro suv') &&
      !userMessage.includes('automatico') &&
      !userMessage.includes('automático')
    ) {
      return JSON.stringify({
        extracted: { bodyType: 'suv' },
        confidence: 0.95,
        reasoning: 'Tipo de carroceria especificado',
        fieldsExtracted: ['bodyType'],
      });
    }

    // Deal breakers
    if (userMessage.includes('nada de leilão') || userMessage.includes('muito rodado')) {
      return JSON.stringify({
        extracted: { dealBreakers: ['leilao', 'alta_quilometragem'] },
        confidence: 0.85,
        reasoning: 'Deal breakers identificados',
        fieldsExtracted: ['dealBreakers'],
      });
    }

    // Year constraint
    const minYearMatch = userMessage.match(/\ba partir de\s+(\d{4})\b/);
    if (minYearMatch) {
      return JSON.stringify({
        extracted: { minYear: Number(minYearMatch[1]) },
        confidence: 0.9,
        reasoning: 'Ano mínimo especificado',
        fieldsExtracted: ['minYear'],
      });
    }

    // Trade-in year extraction
    const tradeInYearMatch = userMessage.match(/\btroca(?:r)?\b.*\b(19\d{2}|20\d{2})\b/);
    if (tradeInYearMatch) {
      return JSON.stringify({
        extracted: {
          hasTradeIn: true,
          tradeInBrand: 'honda',
          tradeInModel: 'civic',
          tradeInYear: Number(tradeInYearMatch[1]),
        },
        confidence: 0.9,
        reasoning: 'Ano do carro na troca identificado',
        fieldsExtracted: ['hasTradeIn', 'tradeInBrand', 'tradeInModel', 'tradeInYear'],
      });
    }

    // Km constraint
    if (userMessage.includes('80 mil km') || userMessage.includes('80000 km')) {
      return JSON.stringify({
        extracted: { maxKm: 80000 },
        confidence: 0.9,
        reasoning: 'Quilometragem máxima especificada',
        fieldsExtracted: ['maxKm'],
      });
    }

    // Greetings - no preferences
    if (userMessage.includes('oi, tudo bem') || userMessage.includes('oi tudo bem')) {
      return JSON.stringify({
        extracted: {},
        confidence: 0.0,
        reasoning: 'Apenas saudação, sem preferências',
        fieldsExtracted: [],
      });
    }

    // Vague message
    if (userMessage.includes('carro bom') && !userMessage.includes('mil')) {
      return JSON.stringify({
        extracted: {},
        confidence: 0.2,
        reasoning: 'Mensagem muito vaga',
        fieldsExtracted: [],
      });
    }

    // Typos
    if (
      userMessage.includes('kero') &&
      userMessage.includes('karro') &&
      userMessage.includes('40 mil') &&
      userMessage.includes('5 pessoas')
    ) {
      return JSON.stringify({
        extracted: { budget: 40000, budgetMax: 40000, people: 5 },
        confidence: 0.85,
        reasoning: 'Preferências extraídas apesar de erros ortográficos',
        fieldsExtracted: ['budget', 'budgetMax', 'people'],
      });
    }

    // Context awareness - 6 pessoas
    if (userMessage.includes('6 pessoas') || userMessage.includes('espaço para 6')) {
      return JSON.stringify({
        extracted: { people: 6 },
        confidence: 0.95,
        reasoning: 'Quantidade de pessoas extraída',
        fieldsExtracted: ['people'],
      });
    }

    // Budget até 55 mil
    if (userMessage.includes('até 55 mil')) {
      return JSON.stringify({
        extracted: { budget: 55000, budgetMax: 55000 },
        confidence: 0.95,
        reasoning: 'Orçamento especificado',
        fieldsExtracted: ['budget', 'budgetMax'],
      });
    }

    // Budget range entre X e Y
    if (userMessage.includes('entre 40 e 60 mil')) {
      return JSON.stringify({
        extracted: { budgetMin: 40000, budgetMax: 60000 },
        confidence: 0.95,
        reasoning: 'Faixa de orçamento especificada',
        fieldsExtracted: ['budgetMin', 'budgetMax'],
      });
    }

    // Budget a partir de X
    if (userMessage.includes('a partir de 50 mil')) {
      return JSON.stringify({
        extracted: { budgetMin: 50000 },
        confidence: 0.9,
        reasoning: 'Orçamento mínimo especificado',
        fieldsExtracted: ['budgetMin'],
      });
    }

    // Model: Civic
    if (userMessage.includes('civic')) {
      return JSON.stringify({
        extracted: { model: 'civic', brand: 'honda' },
        confidence: 0.95,
        reasoning: 'Modelo específico identificado',
        fieldsExtracted: ['model', 'brand'],
      });
    }

    // Brand: Toyota
    if (userMessage.includes('prefiro toyota') || userMessage.includes('toyota')) {
      return JSON.stringify({
        extracted: { brand: 'toyota' },
        confidence: 0.9,
        reasoning: 'Marca preferida identificada',
        fieldsExtracted: ['brand'],
      });
    }

    // Default fallback
    return JSON.stringify({
      extracted: {},
      confidence: 0.1,
      reasoning: 'Nenhuma preferência clara identificada',
      fieldsExtracted: [],
    });
  }),
}));

// Mock logger to prevent console output
vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('PreferenceExtractorAgent', () => {
  let extractor: PreferenceExtractorAgent;

  beforeEach(() => {
    extractor = new PreferenceExtractorAgent();
    vi.clearAllMocks();
  });

  describe('Single field extraction', () => {
    it('should extract budget from message', async () => {
      const message = 'Tenho até 50 mil de orçamento';
      const result = await extractor.extract(message);

      // LLM should extract budget (may be budget or budgetMax)
      const hasBudget =
        result.extracted.budget !== undefined || result.extracted.budgetMax !== undefined;
      expect(hasBudget).toBe(true);

      const budgetValue = result.extracted.budget || result.extracted.budgetMax;
      expect(budgetValue).toBeGreaterThanOrEqual(45000);
      expect(budgetValue).toBeLessThanOrEqual(55000);
    });

    it('should extract people count', async () => {
      const message = 'Preciso de um carro para 5 pessoas';
      const result = await extractor.extract(message);

      expect(result.extracted.people).toBe(5);
    });

    it('should extract usage type', async () => {
      const message = 'Vou usar principalmente para viagens';
      const result = await extractor.extract(message);

      // LLM may return 'viagem' or include it in priorities
      const hasViagem =
        result.extracted.usage === 'viagem' || result.extracted.priorities?.includes('viagem');
      expect(hasViagem).toBe(true);
    });

    it('should accept diario usage as valid', async () => {
      const message = 'O uso diario, no dia a dia da cidade';
      const result = await extractor.extract(message);

      expect(result.extracted.usage).toBe('diario');
    });

    it('should extract body type', async () => {
      const message = 'Prefiro SUV';
      const result = await extractor.extract(message);

      expect(result.extracted.bodyType).toBe('suv');
    });
  });

  describe('Multiple fields extraction', () => {
    it('should extract budget, people, and usage', async () => {
      const message = 'Quero um carro até 60 mil para 4 pessoas, uso na cidade';
      const result = await extractor.extract(message);

      // Check budget (may be in different fields)
      const budgetValue = result.extracted.budget || result.extracted.budgetMax;
      expect(budgetValue).toBeGreaterThanOrEqual(55000);
      expect(budgetValue).toBeLessThanOrEqual(65000);

      expect(result.extracted.people).toBe(4);
      expect(result.extracted.usage).toBe('cidade');
    });

    it('should extract body type, transmission, and priorities', async () => {
      const message = 'Preciso de um SUV automático e econômico';
      const result = await extractor.extract(message);

      expect(result.extracted.bodyType).toBe('suv');
      expect(result.extracted.transmission).toBe('automatico');

      // Priorities may be extracted differently
      const hasEconomico =
        result.extracted.priorities?.includes('economico') ||
        result.extracted.priorities?.some(p => p.includes('econom'));
      expect(hasEconomico).toBe(true);
    });

    it('should handle complex multi-preference message', async () => {
      const message =
        'Quero um SUV automático até 70 mil para viagens com 5 pessoas, preferência por Honda';
      const result = await extractor.extract(message);

      expect(result.extracted.bodyType).toBe('suv');
      expect(result.extracted.transmission).toBe('automatico');

      const budgetValue = result.extracted.budget || result.extracted.budgetMax;
      expect(budgetValue).toBeGreaterThanOrEqual(65000);
      expect(budgetValue).toBeLessThanOrEqual(75000);

      expect(result.extracted.people).toBe(5);
      expect(result.extracted.brand).toBe('honda');
    });
  });

  describe('Deal breakers and constraints', () => {
    it('should extract deal breakers', async () => {
      const message = 'Nada de leilão ou muito rodado';
      const result = await extractor.extract(message);

      const hasDealBreakers =
        result.extracted.dealBreakers && result.extracted.dealBreakers.length > 0;
      expect(hasDealBreakers).toBe(true);

      // Should include leilao in some form
      const hasLeilao = result.extracted.dealBreakers?.some(d => d.toLowerCase().includes('leil'));
      expect(hasLeilao).toBe(true);
    });

    it('should extract year constraint', async () => {
      const message = 'Prefiro a partir de 2018';
      const result = await extractor.extract(message);

      expect(result.extracted.minYear).toBe(2018);
    });

    it('should clamp minYear to current year + 1', async () => {
      const futureYear = new Date().getFullYear() + 10;
      const maxAcceptedYear = new Date().getFullYear() + 1;
      const message = `Prefiro a partir de ${futureYear}`;
      const result = await extractor.extract(message);

      expect(result.extracted.minYear).toBe(maxAcceptedYear);
    });

    it('should clamp tradeInYear to current year + 1', async () => {
      const futureYear = new Date().getFullYear() + 10;
      const maxAcceptedYear = new Date().getFullYear() + 1;
      const message = `Quero trocar meu Civic ${futureYear}`;
      const result = await extractor.extract(message);

      expect(result.extracted.tradeInYear).toBe(maxAcceptedYear);
    });

    it('should extract km constraint', async () => {
      const message = 'No máximo 80 mil km';
      const result = await extractor.extract(message);

      // May be 80000 or 80 (depending on interpretation)
      expect(result.extracted.maxKm).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Edge cases', () => {
    it('should handle greetings with no preferences', async () => {
      const message = 'Oi, tudo bem?';
      const result = await extractor.extract(message);

      // Should return empty or minimal extraction
      const extractedKeys = Object.keys(result.extracted).filter(
        k => result.extracted[k] !== undefined && result.extracted[k] !== null
      );
      expect(extractedKeys.length).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle vague messages', async () => {
      const message = 'Quero um carro bom';
      const result = await extractor.extract(message);

      // Should have low confidence or minimal extraction
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle typos and informal language', async () => {
      const message = 'kero um karro ate 40 mil pra 5 pessoas';
      const result = await extractor.extract(message);

      // Should still extract despite typos
      const budgetValue = result.extracted.budget || result.extracted.budgetMax;
      if (budgetValue) {
        expect(budgetValue).toBeGreaterThanOrEqual(35000);
        expect(budgetValue).toBeLessThanOrEqual(45000);
      }

      if (result.extracted.people) {
        expect(result.extracted.people).toBe(5);
      }
    });
  });

  describe('Context awareness', () => {
    it('should consider existing profile', async () => {
      const currentProfile = {
        budget: 50000,
        usage: 'cidade',
      };

      const message = 'Preciso de espaço para 6 pessoas';
      const result = await extractor.extract(message, { currentProfile });

      expect(result.extracted.people).toBe(6);
      // Budget should not be re-extracted (already set)
    });
  });

  describe('Merge with profile', () => {
    it('should merge new preferences with existing profile', () => {
      const currentProfile = {
        budget: 50000,
        usage: 'cidade',
        priorities: ['economico'],
      };

      const extracted = {
        people: 5,
        bodyType: 'suv',
        priorities: ['espaco', 'conforto'],
      };

      const merged = extractor.mergeWithProfile(currentProfile, extracted);

      expect(merged.budget).toBe(50000);
      expect(merged.usage).toBe('cidade');
      expect(merged.people).toBe(5);
      expect(merged.bodyType).toBe('suv');
      expect(merged.priorities).toContain('economico');
      expect(merged.priorities).toContain('espaco');
      expect(merged.priorities).toContain('conforto');
    });

    it('should deduplicate priorities', () => {
      const currentProfile = {
        priorities: ['economico', 'conforto'],
      };

      const extracted = {
        priorities: ['conforto', 'espaco'],
      };

      const merged = extractor.mergeWithProfile(currentProfile, extracted);

      // Should not have duplicate 'conforto'
      const confortoCount = merged.priorities?.filter(p => p === 'conforto').length || 0;
      expect(confortoCount).toBe(1);
      expect(merged.priorities).toContain('espaco');
    });
  });

  describe('Budget variations', () => {
    it('should handle "até X mil"', async () => {
      const message = 'Até 55 mil';
      const result = await extractor.extract(message);

      const budgetValue = result.extracted.budget || result.extracted.budgetMax;
      expect(budgetValue).toBeGreaterThanOrEqual(50000);
      expect(budgetValue).toBeLessThanOrEqual(60000);
    });

    it('should handle "entre X e Y"', async () => {
      const message = 'Entre 40 e 60 mil';
      const result = await extractor.extract(message);

      // Should extract budget range
      const hasRange =
        (result.extracted.budgetMin !== undefined && result.extracted.budgetMax !== undefined) ||
        result.extracted.budget !== undefined;
      expect(hasRange).toBe(true);

      if (result.extracted.budgetMin) {
        expect(result.extracted.budgetMin).toBeGreaterThanOrEqual(35000);
        expect(result.extracted.budgetMin).toBeLessThanOrEqual(45000);
      }
      if (result.extracted.budgetMax) {
        expect(result.extracted.budgetMax).toBeGreaterThanOrEqual(55000);
        expect(result.extracted.budgetMax).toBeLessThanOrEqual(65000);
      }
    });

    it('should handle "a partir de X"', async () => {
      const message = 'A partir de 50 mil';
      const result = await extractor.extract(message);

      // Should extract minimum budget
      const minBudget = result.extracted.budgetMin || result.extracted.budget;
      expect(minBudget).toBeGreaterThanOrEqual(45000);
      expect(minBudget).toBeLessThanOrEqual(55000);
    });
  });

  describe('Model and brand extraction', () => {
    it('should extract specific model names', async () => {
      const message = 'Tem Civic disponível?';
      const result = await extractor.extract(message);

      expect(result.extracted.model?.toLowerCase()).toContain('civic');
      expect(result.extracted.brand).toBe('honda');
    });

    it('should extract brand preference', async () => {
      const message = 'Prefiro Toyota';
      const result = await extractor.extract(message);

      expect(result.extracted.brand).toBe('toyota');
    });
  });
});
