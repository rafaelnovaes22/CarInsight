/**
 * Testes de Integração com LLM Real
 *
 * IMPORTANTE: Estes testes chamam APIs reais e:
 * - Custam dinheiro (tokens)
 * - São mais lentos
 * - Podem falhar por rate limiting
 * - Resultados podem variar ligeiramente
 *
 * Para rodar apenas estes testes:
 * npm run test:integration:llm
 *
 * Requer variáveis de ambiente:
 * - OPENAI_API_KEY ou GROQ_API_KEY
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { chatCompletion, resetCircuitBreaker } from '../../src/lib/llm-router';
import { PreferenceExtractorAgent } from '../../src/agents/preference-extractor.agent';
import { env } from '../../src/config/env';

// Skip se não houver API keys VÁLIDAS (não placeholders/mocks)
const isValidOpenAIKey =
  env.OPENAI_API_KEY &&
  !env.OPENAI_API_KEY.includes('mock') &&
  !env.OPENAI_API_KEY.includes('test') &&
  env.OPENAI_API_KEY.length > 20;
const isValidGroqKey =
  env.GROQ_API_KEY &&
  !env.GROQ_API_KEY.includes('mock') &&
  !env.GROQ_API_KEY.includes('test') &&
  env.GROQ_API_KEY.length > 20;
const runRealLlmTests = process.env.RUN_LLM_INTEGRATION_TESTS === 'true';
const hasValidApiKeys = isValidOpenAIKey || isValidGroqKey;
const describeIfApiKeys = runRealLlmTests && hasValidApiKeys ? describe : describe.skip;

if (!runRealLlmTests) {
  console.warn(
    'Skipping real LLM integration tests: set RUN_LLM_INTEGRATION_TESTS=true to enable them'
  );
} else if (!hasValidApiKeys) {
  console.warn('Skipping real LLM integration tests: valid provider API keys were not found');
}

describeIfApiKeys('LLM Integration Tests (Real API)', () => {
  beforeAll(() => {
    console.log('🔑 Testando com LLM real...');
    console.log(`   OpenAI: ${env.OPENAI_API_KEY ? '✓' : '✗'}`);
    console.log(`   Groq: ${env.GROQ_API_KEY ? '✓' : '✗'}`);
  });

  beforeEach(() => {
    resetCircuitBreaker();
  });

  describe('chatCompletion - Real API', () => {
    it('deve retornar resposta válida do LLM', async () => {
      const messages = [
        { role: 'system' as const, content: 'Responda em português de forma breve.' },
        { role: 'user' as const, content: 'Olá, tudo bem?' },
      ];

      const response = await chatCompletion(messages, { maxTokens: 50 });

      expect(response).toBeTruthy();
      expect(response.content).toBeTruthy();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(5);

      console.log(`   Resposta LLM: "${response.content.substring(0, 100)}..."`);
    }, 30000);

    it('deve classificar intenção de compra corretamente', async () => {
      const messages = [
        {
          role: 'system' as const,
          content: `Classifique a intenção do usuário. Responda APENAS com uma dessas opções:
- QUALIFICAR (quer comprar carro)
- HUMANO (quer falar com vendedor)
- INFORMACAO (pergunta geral)
- OUTRO`,
        },
        { role: 'user' as const, content: 'Quero comprar um carro SUV' },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.1,
        maxTokens: 20,
      });

      expect(response.content.toUpperCase()).toContain('QUALIFICAR');
    }, 30000);

    it('deve classificar intenção de contato humano', async () => {
      const messages = [
        {
          role: 'system' as const,
          content: `Classifique a intenção do usuário. Responda APENAS com uma dessas opções:
- QUALIFICAR (quer comprar carro)
- HUMANO (quer falar com vendedor/atendente/pessoa)
- INFORMACAO (pergunta geral)
- OUTRO`,
        },
        { role: 'user' as const, content: 'Quero falar com um vendedor humano' },
      ];

      const response = await chatCompletion(messages, {
        temperature: 0.1,
        maxTokens: 20,
      });

      expect(response.content.toUpperCase()).toContain('HUMANO');
    }, 30000);
  });

  describe('PreferenceExtractor - Real API', () => {
    let extractor: PreferenceExtractorAgent;

    beforeEach(() => {
      extractor = new PreferenceExtractorAgent();
    });

    it('deve extrair orçamento de mensagem natural', async () => {
      const message = 'Tenho até 50 mil de orçamento para comprar um carro';
      const result = await extractor.extract(message);

      console.log(`   Extraído: ${JSON.stringify(result.extracted)}`);
      console.log(`   Confiança: ${result.confidence}`);

      // O LLM deve extrair budget
      const hasBudget =
        result.extracted.budget !== undefined || result.extracted.budgetMax !== undefined;
      expect(hasBudget).toBe(true);

      const budgetValue = result.extracted.budget || result.extracted.budgetMax;
      expect(budgetValue).toBeGreaterThanOrEqual(45000);
      expect(budgetValue).toBeLessThanOrEqual(55000);
    }, 30000);

    it('deve extrair múltiplas preferências', async () => {
      const message = 'Quero um SUV automático até 70 mil para viagens com 5 pessoas';
      const result = await extractor.extract(message);

      console.log(`   Extraído: ${JSON.stringify(result.extracted)}`);

      // Deve extrair pelo menos 3 campos
      expect(result.fieldsExtracted.length).toBeGreaterThanOrEqual(3);
      expect(result.confidence).toBeGreaterThan(0.5);
    }, 30000);

    it('deve lidar com mensagem sem preferências', async () => {
      const message = 'Oi, tudo bem? Bom dia!';
      const result = await extractor.extract(message);

      console.log(`   Extraído: ${JSON.stringify(result.extracted)}`);
      console.log(`   Confiança: ${result.confidence}`);

      // Deve ter baixa confiança ou extração vazia
      expect(result.confidence).toBeLessThan(0.5);
    }, 30000);

    it('deve extrair deal breakers', async () => {
      const message = 'Não quero carro de leilão nem muito rodado, prefiro a partir de 2018';
      const result = await extractor.extract(message);

      console.log(`   Extraído: ${JSON.stringify(result.extracted)}`);

      // Deve extrair dealBreakers e/ou minYear
      const hasDealBreakers =
        (result.extracted.dealBreakers && result.extracted.dealBreakers.length > 0) ||
        result.extracted.minYear !== undefined;
      expect(hasDealBreakers).toBe(true);
    }, 30000);

    it('deve extrair modelo e marca específicos', async () => {
      const message = 'Vocês têm Honda Civic?';
      const result = await extractor.extract(message);

      console.log(`   Extraído: ${JSON.stringify(result.extracted)}`);

      // Deve extrair brand ou model
      const hasModelInfo =
        result.extracted.brand !== undefined || result.extracted.model !== undefined;
      expect(hasModelInfo).toBe(true);
    }, 30000);

    it('deve extrair uso diário com prioridades de conforto/economia', async () => {
      const message = 'Preciso de um carro para trabalhar diariamente, uso intenso';
      const result = await extractor.extract(message);

      console.log(`   Extraído (Uso Diário): ${JSON.stringify(result.extracted)}`);

      // Verifica se mapeou para trabalho/diario
      const validUsage = ['trabalho', 'diario', 'misto'];
      const extractedUsage = result.extracted.usage || result.extracted.usoPrincipal;
      expect(validUsage).toContain(extractedUsage);

      // Verifica se adicionou prioridades de economia/conforto/durabilidade
      const priorities = result.extracted.priorities || [];
      const hasPriorities = priorities.some(p => ['economico', 'conforto', 'duravel'].includes(p));
      expect(hasPriorities).toBe(true);
    }, 30000);

    it('deve extrair uso para obra como picape', async () => {
      const message = 'Carro pra obra e carregar material';
      const result = await extractor.extract(message);

      console.log(`   Extraído (Obra): ${JSON.stringify(result.extracted)}`);

      // Deve reconhecer como pickup
      expect(result.extracted.bodyType).toBe('pickup');

      // Deve ter prioridade de pickup ou carga
      const priorities = result.extracted.priorities || [];
      const hasWorkPriority = priorities.some(p => ['pickup', 'carga'].includes(p));
      expect(hasWorkPriority).toBe(true);
    }, 30000);
  });

  describe('Smoke Tests - Fluxo Crítico', () => {
    it('deve completar extração de perfil completo', async () => {
      const extractor = new PreferenceExtractorAgent();

      // Simula sequência de mensagens
      const messages = ['Quero um carro até 60 mil', 'Para uso na cidade', 'Para 4 pessoas'];

      let profile: any = {};

      for (const msg of messages) {
        const result = await extractor.extract(msg, { currentProfile: profile });
        profile = extractor.mergeWithProfile(profile, result.extracted);
      }

      console.log(`   Perfil final: ${JSON.stringify(profile)}`);

      // Deve ter construído perfil com informações essenciais
      expect(profile.budget || profile.budgetMax).toBeTruthy();
    }, 60000);
  });
});

// Testes que SEMPRE rodam (smoke test básico)
describe('LLM Availability Check', () => {
  it('deve ter pelo menos um provider configurado ou mock disponível', async () => {
    const messages = [
      { role: 'system' as const, content: 'Teste' },
      { role: 'user' as const, content: 'Olá' },
    ];

    // Não deve lançar erro - usa mock se não houver API keys
    const response = await chatCompletion(messages);

    expect(response).toBeTruthy();
    expect(response.content).toBeTruthy();
    expect(typeof response.content).toBe('string');
  }, 10000);
});
