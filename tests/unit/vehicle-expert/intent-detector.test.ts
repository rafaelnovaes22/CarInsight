/**
 * Intent Detector Unit Tests
 *
 * Tests for the intent detection functions used by the VehicleExpertAgent.
 *
 * **Feature: conversation-state-fixes**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  detectUserQuestion,
  detectAffirmativeResponse,
  detectNegativeResponse,
  detectPostRecommendationIntent,
  isPostRecommendationResponse,
  detectExplicitRecommendationRequest,
  isInformationProvision,
  EXPLICIT_RECOMMENDATION_PATTERNS,
  INFORMATION_PROVISION_PATTERNS,
} from '../../../src/agents/vehicle-expert/intent-detector';

describe('Intent Detector', () => {
  // ============================================
  // detectUserQuestion tests
  // ============================================
  describe('detectUserQuestion', () => {
    it('should detect questions ending with ?', () => {
      expect(detectUserQuestion('Vocês tem SUV?')).toBe(true);
      expect(detectUserQuestion('Quanto custa?')).toBe(true);
    });

    it('should detect questions starting with question words', () => {
      expect(detectUserQuestion('Qual a diferença entre SUV e sedan?')).toBe(true);
      expect(detectUserQuestion('Como funciona o financiamento?')).toBe(true);
      expect(detectUserQuestion('Quanto vocês tem de SUV?')).toBe(true);
      expect(detectUserQuestion('Onde fica a loja?')).toBe(true);
    });

    it('should detect "vocês tem" pattern', () => {
      expect(detectUserQuestion('Vocês tem Civic')).toBe(true);
      expect(detectUserQuestion('Você tem pickup')).toBe(true);
    });

    it('should detect "tem disponível" pattern', () => {
      expect(detectUserQuestion('Tem disponível algum SUV?')).toBe(true);
    });

    it('should NOT detect simple statements as questions', () => {
      expect(detectUserQuestion('Quero um SUV')).toBe(false);
      expect(detectUserQuestion('Meu orçamento é 50 mil')).toBe(false);
      expect(detectUserQuestion('Sim')).toBe(false);
    });
  });

  // ============================================
  // detectAffirmativeResponse tests
  // ============================================
  describe('detectAffirmativeResponse', () => {
    it('should detect short affirmative words', () => {
      expect(detectAffirmativeResponse('sim')).toBe(true);
      expect(detectAffirmativeResponse('Sim')).toBe(true);
      expect(detectAffirmativeResponse('SIM')).toBe(true);
      expect(detectAffirmativeResponse('ok')).toBe(true);
      expect(detectAffirmativeResponse('blz')).toBe(true);
      expect(detectAffirmativeResponse('bora')).toBe(true);
      expect(detectAffirmativeResponse('pode')).toBe(true);
      expect(detectAffirmativeResponse('quero')).toBe(true);
    });

    it('should detect phrases with affirmative words', () => {
      expect(detectAffirmativeResponse('Sim, pode mostrar')).toBe(true);
      expect(detectAffirmativeResponse('Com certeza')).toBe(true);
      expect(detectAffirmativeResponse('Pode ser')).toBe(true);
      expect(detectAffirmativeResponse('Tenho interesse')).toBe(true);
    });

    it('should detect common voice transcription variations', () => {
      expect(detectAffirmativeResponse('siiim')).toBe(true);
      expect(detectAffirmativeResponse('siim')).toBe(true);
      expect(detectAffirmativeResponse('sss')).toBe(true);
    });

    it('should NOT detect negative phrases as affirmative', () => {
      expect(detectAffirmativeResponse('não quero')).toBe(false);
      expect(detectAffirmativeResponse('agora não')).toBe(false);
      expect(detectAffirmativeResponse('não tenho interesse')).toBe(false);
    });

    it('should handle punctuation correctly', () => {
      expect(detectAffirmativeResponse('sim!')).toBe(true);
      expect(detectAffirmativeResponse('ok.')).toBe(true);
      expect(detectAffirmativeResponse('pode?')).toBe(true);
    });
  });

  // ============================================
  // detectNegativeResponse tests
  // ============================================
  describe('detectNegativeResponse', () => {
    it('should detect negative words', () => {
      expect(detectNegativeResponse('não')).toBe(true);
      expect(detectNegativeResponse('nao')).toBe(true);
      expect(detectNegativeResponse('n')).toBe(true);
      expect(detectNegativeResponse('nunca')).toBe(true);
    });

    it('should detect negative phrases', () => {
      expect(detectNegativeResponse('não quero')).toBe(true);
      expect(detectNegativeResponse('não, obrigado')).toBe(true);
      expect(detectNegativeResponse('agora não')).toBe(true);
      expect(detectNegativeResponse('talvez depois')).toBe(true);
    });

    it('should NOT detect affirmative as negative', () => {
      expect(detectNegativeResponse('sim')).toBe(false);
      expect(detectNegativeResponse('pode')).toBe(false);
      expect(detectNegativeResponse('quero')).toBe(false);
    });
  });

  // ============================================
  // detectPostRecommendationIntent tests
  // ============================================
  describe('detectPostRecommendationIntent', () => {
    describe('want_financing', () => {
      it('should detect financing intent', () => {
        expect(detectPostRecommendationIntent('Quero financiar')).toBe('want_financing');
        expect(detectPostRecommendationIntent('Gostei, vou financiar')).toBe('want_financing');
        expect(detectPostRecommendationIntent('Posso parcelar?')).toBe('want_financing');
        expect(detectPostRecommendationIntent('Qual a entrada?')).toBe('want_financing');
        expect(detectPostRecommendationIntent('Quero simular')).toBe('want_financing');
      });
    });

    describe('want_tradein', () => {
      it('should detect trade-in intent', () => {
        expect(detectPostRecommendationIntent('Tenho um carro para dar na troca')).toBe(
          'want_tradein'
        );
        expect(detectPostRecommendationIntent('Meu carro entra na troca')).toBe('want_tradein');
        expect(detectPostRecommendationIntent('Aceita troca?')).toBe('want_tradein');
        expect(detectPostRecommendationIntent('Quero dar na troca')).toBe('want_tradein');
      });
    });

    describe('want_schedule', () => {
      it('should detect schedule intent', () => {
        expect(detectPostRecommendationIntent('Quero agendar visita')).toBe('want_schedule');
        expect(detectPostRecommendationIntent('Falar com vendedor')).toBe('want_schedule');
        expect(detectPostRecommendationIntent('Onde fica a loja?')).toBe('want_schedule');
        expect(detectPostRecommendationIntent('Qual o endereço?')).toBe('want_schedule');
      });
    });

    describe('want_details', () => {
      it('should detect details intent', () => {
        expect(detectPostRecommendationIntent('Mais detalhes')).toBe('want_details');
        expect(detectPostRecommendationIntent('Qual a quilometragem?')).toBe('want_details');
        expect(detectPostRecommendationIntent('Interessei nesse')).toBe('want_details');
        expect(detectPostRecommendationIntent('Conta mais')).toBe('want_details');
      });
    });

    describe('want_others', () => {
      it('should detect want others intent', () => {
        expect(detectPostRecommendationIntent('Tem outras opções?')).toBe('want_others');
        expect(detectPostRecommendationIntent('Muito caro')).toBe('want_others');
        expect(detectPostRecommendationIntent('Algo mais barato')).toBe('want_others');
        expect(detectPostRecommendationIntent('Não gostei')).toBe('want_others');
        expect(detectPostRecommendationIntent('Algo parecido')).toBe('want_others');
        expect(detectPostRecommendationIntent('Similar')).toBe('want_others');
      });

      it('should detect budget-related requests as want_others', () => {
        expect(detectPostRecommendationIntent('Tem algo até 50 mil?')).toBe('want_others');
        expect(detectPostRecommendationIntent('30000')).toBe('want_others');
      });
    });

    describe('want_interest with model names containing numbers', () => {
      const shownVehicles = [
        { brand: 'HYUNDAI', model: 'HB20', year: 2024, price: 85990 },
        { brand: 'PEUGEOT', model: '208', year: 2023, price: 79990 },
        { brand: 'TOYOTA', model: 'YARIS', year: 2024, price: 81990 },
      ];

      it('should detect "Gostei do HB20" as want_interest when HB20 is in shown vehicles', () => {
        expect(detectPostRecommendationIntent('Gostei do HB20', shownVehicles)).toBe(
          'want_interest'
        );
      });

      it('should detect "Curti o 208" as want_interest when 208 is in shown vehicles', () => {
        expect(detectPostRecommendationIntent('Curti o 208', shownVehicles)).toBe('want_interest');
      });

      it('should detect "Quero o HB20" as want_interest when HB20 is in shown vehicles', () => {
        expect(detectPostRecommendationIntent('Quero o HB20', shownVehicles)).toBe('want_interest');
      });

      it('should detect "Esse HB20 me interessou" as want_interest', () => {
        expect(detectPostRecommendationIntent('Esse HB20 me interessou', shownVehicles)).toBe(
          'want_interest'
        );
      });

      it('should detect "Gostei do Yaris" as want_interest', () => {
        expect(detectPostRecommendationIntent('Gostei do Yaris', shownVehicles)).toBe(
          'want_interest'
        );
      });

      it('should NOT detect "Não gostei do HB20" as want_interest (negation)', () => {
        expect(detectPostRecommendationIntent('Não gostei do HB20', shownVehicles)).toBe(
          'want_others'
        );
      });

      it('should still detect pure budget as want_others', () => {
        expect(detectPostRecommendationIntent('100000', shownVehicles)).toBe('want_others');
      });
    });

    describe('uber/99 eligibility questions', () => {
      const shownVehicles = [{ brand: 'FORD', model: 'FOCUS', year: 2015, price: 56990 }];

      it('should NOT treat "serve pra Uber?" as want_interest even if model is shown', () => {
        expect(detectPostRecommendationIntent('O Focus serve pra Uber?', shownVehicles)).toBe(
          'none'
        );
        expect(detectPostRecommendationIntent('Esse Focus é apto pra Uber X?', shownVehicles)).toBe(
          'none'
        );
      });
    });

    describe('acknowledgment', () => {
      it('should detect acknowledgments', () => {
        expect(detectPostRecommendationIntent('ok')).toBe('acknowledgment');
        expect(detectPostRecommendationIntent('entendi')).toBe('acknowledgment');
        expect(detectPostRecommendationIntent('legal')).toBe('acknowledgment');
        expect(detectPostRecommendationIntent('valeu')).toBe('acknowledgment');
      });
    });

    describe('none', () => {
      it('should return none for unclear intent', () => {
        expect(detectPostRecommendationIntent('Bom dia')).toBe('none');
        expect(detectPostRecommendationIntent('Oi')).toBe('none');
      });
    });
  });

  // ============================================
  // isPostRecommendationResponse tests
  // ============================================
  describe('isPostRecommendationResponse', () => {
    it('should detect financing-related response', () => {
      expect(isPostRecommendationResponse('Quero financiar', {})).toBe(true);
      expect(isPostRecommendationResponse('Entrada de 10 mil', { wantsFinancing: true })).toBe(
        true
      );
    });

    it('should detect trade-in related response', () => {
      expect(isPostRecommendationResponse('Tenho um carro', {})).toBe(true);
      expect(isPostRecommendationResponse('É um Gol 2015', { hasTradeIn: true })).toBe(true);
    });

    it('should detect scheduling related response', () => {
      expect(isPostRecommendationResponse('Quero agendar', {})).toBe(true);
      expect(isPostRecommendationResponse('Quero visitar', {})).toBe(true);
    });

    it('should NOT detect unrelated messages', () => {
      expect(isPostRecommendationResponse('Bom dia', {})).toBe(false);
      expect(isPostRecommendationResponse('Oi', {})).toBe(false);
    });
  });
});

// ============================================================================
// Property-Based Tests for Explicit Recommendation Request Detection
// Feature: conversation-state-fixes
// ============================================================================

describe('Explicit Recommendation Request Detection Property Tests', () => {
  // ============================================================================
  // Generators for property-based testing
  // ============================================================================

  /**
   * Generator for vehicle-related nouns in Portuguese
   */
  const vehicleNounGenerator = fc.constantFrom(
    'carro',
    'carros',
    'veículo',
    'veículos',
    'opções',
    'opção',
    'sugestões',
    'sugestão'
  );

  /**
   * Generator for action verbs used in recommendation requests
   */
  const actionVerbGenerator = fc.constantFrom(
    'mostra',
    'mostrar',
    'ver',
    'veja'
  );

  /**
   * Generator for recommendation request verbs
   */
  const recommendationVerbGenerator = fc.constantFrom(
    'indica',
    'sugere',
    'mostra',
    'recomenda'
  );

  /**
   * Generator for affirmative words that trigger recommendations
   */
  const affirmativeWordGenerator = fc.constantFrom(
    'sim',
    'pode',
    'quero',
    'mostra',
    'manda',
    'beleza',
    'ok',
    'claro'
  );

  /**
   * Generator for budget values (pure numbers)
   */
  const budgetValueGenerator = fc.integer({ min: 10000, max: 500000 });

  /**
   * Generator for budget suffixes
   */
  const budgetSuffixGenerator = fc.constantFrom('', ' mil', ' k', ' reais', ' r$');

  /**
   * Generator for usage descriptions
   */
  const usageDescriptionGenerator = fc.constantFrom(
    'trabalho',
    'família',
    'familia',
    'lazer',
    'viagem',
    'uber',
    '99',
    'app',
    'dia a dia'
  );

  /**
   * Generator for body type descriptions
   */
  const bodyTypeGenerator = fc.constantFrom(
    'suv',
    'sedan',
    'hatch',
    'pickup',
    'picape'
  );

  // ============================================================================
  // Property 6: Explicit Recommendation Request Detection
  // ============================================================================

  /**
   * **Property 6: Explicit Recommendation Request Detection**
   * **Validates: Requirements 2.3, 4.1**
   *
   * For any message containing explicit recommendation request patterns
   * (e.g., "mostra carros", "quero ver opções"), the Intent_Detector
   * SHALL return true for detectExplicitRecommendationRequest.
   */
  describe('Property 6: Explicit Recommendation Request Detection', () => {
    it('detects "[verb] [vehicle noun]" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          actionVerbGenerator,
          vehicleNounGenerator,
          async (verb, noun) => {
            const message = `${verb} ${noun}`;
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects "quero ver" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('quero ver', 'Quero ver', 'QUERO VER', 'quero ver opções', 'quero ver carros'),
          async (message) => {
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects "me [recommendation verb]" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          recommendationVerbGenerator,
          async (verb) => {
            const message = `me ${verb}`;
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects "[recommendation verb] um/uma/algum" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('indica', 'sugere', 'recomenda'),
          fc.constantFrom('um', 'uma', 'algum'),
          async (verb, article) => {
            const message = `${verb} ${article} carro`;
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects "o que tem/vocês tem" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('o que tem', 'o que vocês tem', 'o que voces tem', 'o que você tem'),
          async (message) => {
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects "tem algum" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('tem algum', 'tem algum carro', 'tem algum suv', 'Tem algum disponível'),
          async (message) => {
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects "quais opções/carros/veículos" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('quais opções', 'quais carros', 'quais veículos', 'qual opção', 'qual carro'),
          async (message) => {
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects "pode mostrar" pattern as recommendation request (Requirement 4.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('pode mostrar', 'Pode mostrar', 'pode mostrar opções', 'pode mostrar carros'),
          async (message) => {
            const result = detectExplicitRecommendationRequest(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects affirmative responses as recommendation request (Requirement 2.3)', async () => {
      await fc.assert(
        fc.asyncProperty(
          affirmativeWordGenerator,
          async (word) => {
            const result = detectExplicitRecommendationRequest(word);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Property-Based Tests for Information Provision Classification
// Feature: conversation-state-fixes
// ============================================================================

describe('Information Provision Classification Property Tests', () => {
  // ============================================================================
  // Generators for property-based testing
  // ============================================================================

  /**
   * Generator for budget values (pure numbers)
   */
  const budgetValueGenerator = fc.integer({ min: 10000, max: 500000 });

  /**
   * Generator for budget suffixes
   */
  const budgetSuffixGenerator = fc.constantFrom('', ' mil', ' k', ' reais', ' r$');

  /**
   * Generator for usage descriptions
   */
  const usageDescriptionGenerator = fc.constantFrom(
    'trabalho',
    'família',
    'familia',
    'lazer',
    'viagem',
    'uber',
    '99',
    'app',
    'dia a dia'
  );

  /**
   * Generator for body type descriptions
   */
  const bodyTypeGenerator = fc.constantFrom(
    'suv',
    'sedan',
    'hatch',
    'pickup',
    'picape'
  );

  // ============================================================================
  // Property 5: Information Provision Does Not Trigger Recommendations
  // ============================================================================

  /**
   * **Property 5: Information Provision Does Not Trigger Recommendations**
   * **Validates: Requirements 2.1, 2.2, 4.2**
   *
   * For any message classified as information provision (budget values, usage descriptions),
   * the Discovery_Node SHALL NOT set next to 'recommendation'.
   * This test validates that isInformationProvision correctly identifies these messages.
   */
  describe('Property 5: Information Provision Does Not Trigger Recommendations', () => {
    it('classifies pure budget numbers as information provision (Requirement 2.1, 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          budgetValueGenerator,
          async (budget) => {
            const message = budget.toString();
            const result = isInformationProvision(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classifies budget with suffix as information provision (Requirement 2.1, 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          budgetValueGenerator,
          budgetSuffixGenerator,
          async (budget, suffix) => {
            // Only test non-empty suffixes to avoid duplicate with pure numbers
            if (suffix === '') return;
            const message = `${budget}${suffix}`;
            const result = isInformationProvision(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classifies "até [number]" as information provision (Requirement 2.1, 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          budgetValueGenerator,
          async (budget) => {
            const message = `até ${budget}`;
            const result = isInformationProvision(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classifies "ate [number]" (without accent) as information provision (Requirement 2.1, 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          budgetValueGenerator,
          async (budget) => {
            const message = `ate ${budget}`;
            const result = isInformationProvision(message);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classifies usage descriptions as information provision (Requirement 2.2, 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          usageDescriptionGenerator,
          async (usage) => {
            const result = isInformationProvision(usage);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classifies body type descriptions as information provision (Requirement 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          bodyTypeGenerator,
          async (bodyType) => {
            const result = isInformationProvision(bodyType);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('information provision messages are NOT explicit recommendation requests (Requirement 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          budgetValueGenerator,
          async (budget) => {
            const message = budget.toString();
            // Pure budget should be info provision
            const isInfo = isInformationProvision(message);
            // Pure budget should NOT be a recommendation request
            const isRequest = detectExplicitRecommendationRequest(message);
            
            expect(isInfo).toBe(true);
            expect(isRequest).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('usage descriptions are NOT explicit recommendation requests (Requirement 4.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          usageDescriptionGenerator,
          async (usage) => {
            const isInfo = isInformationProvision(usage);
            const isRequest = detectExplicitRecommendationRequest(usage);
            
            expect(isInfo).toBe(true);
            expect(isRequest).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Property-Based Tests for Message Intent Classification
// Feature: conversation-state-fixes
// ============================================================================

describe('Message Intent Classification Property Tests', () => {
  // ============================================================================
  // Generators for property-based testing
  // ============================================================================

  /**
   * Generator for budget values (pure numbers)
   */
  const budgetValueGenerator = fc.integer({ min: 10000, max: 500000 });

  /**
   * Generator for usage descriptions
   */
  const usageDescriptionGenerator = fc.constantFrom(
    'trabalho',
    'família',
    'familia',
    'lazer',
    'viagem',
    'uber',
    '99',
    'app',
    'dia a dia'
  );

  /**
   * Generator for body type descriptions
   */
  const bodyTypeGenerator = fc.constantFrom(
    'suv',
    'sedan',
    'hatch',
    'pickup',
    'picape'
  );

  /**
   * Generator for explicit recommendation request messages
   */
  const explicitRequestGenerator = fc.constantFrom(
    'mostra carros',
    'quero ver opções',
    'me indica um carro',
    'o que vocês tem',
    'tem algum suv',
    'quais opções',
    'pode mostrar',
    'sim',
    'pode',
    'quero'
  );

  // ============================================================================
  // Property 11: Message Intent Classification Accuracy
  // ============================================================================

  /**
   * **Property 11: Message Intent Classification Accuracy**
   * **Validates: Requirements 4.3, 4.4**
   *
   * For any message, the intent classification SHALL correctly distinguish between:
   * - Information provision (budget/usage values)
   * - Explicit recommendation requests (action-requesting patterns)
   */
  describe('Property 11: Message Intent Classification Accuracy', () => {
    it('correctly classifies budget values as information provision, not recommendation request (Requirement 4.3, 4.4)', async () => {
      await fc.assert(
        fc.asyncProperty(
          budgetValueGenerator,
          async (budget) => {
            const message = budget.toString();
            
            const isInfo = isInformationProvision(message);
            const isRequest = detectExplicitRecommendationRequest(message);
            
            // Budget values should be info provision
            expect(isInfo).toBe(true);
            // Budget values should NOT be recommendation requests
            expect(isRequest).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('correctly classifies usage descriptions as information provision, not recommendation request (Requirement 4.3, 4.4)', async () => {
      await fc.assert(
        fc.asyncProperty(
          usageDescriptionGenerator,
          async (usage) => {
            const isInfo = isInformationProvision(usage);
            const isRequest = detectExplicitRecommendationRequest(usage);
            
            // Usage descriptions should be info provision
            expect(isInfo).toBe(true);
            // Usage descriptions should NOT be recommendation requests
            expect(isRequest).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('correctly classifies body types as information provision, not recommendation request (Requirement 4.3, 4.4)', async () => {
      await fc.assert(
        fc.asyncProperty(
          bodyTypeGenerator,
          async (bodyType) => {
            const isInfo = isInformationProvision(bodyType);
            const isRequest = detectExplicitRecommendationRequest(bodyType);
            
            // Body types should be info provision
            expect(isInfo).toBe(true);
            // Body types should NOT be recommendation requests
            expect(isRequest).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('correctly classifies explicit requests as recommendation requests, not information provision (Requirement 4.3, 4.4)', async () => {
      await fc.assert(
        fc.asyncProperty(
          explicitRequestGenerator,
          async (request) => {
            const isRequest = detectExplicitRecommendationRequest(request);
            const isInfo = isInformationProvision(request);
            
            // Explicit requests should be recommendation requests
            expect(isRequest).toBe(true);
            // Explicit requests should NOT be info provision
            expect(isInfo).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('information provision and recommendation request are mutually exclusive for budget values (Requirement 4.4)', async () => {
      await fc.assert(
        fc.asyncProperty(
          budgetValueGenerator,
          fc.constantFrom('', ' mil', ' k'),
          async (budget, suffix) => {
            const message = `${budget}${suffix}`;
            
            const isInfo = isInformationProvision(message);
            const isRequest = detectExplicitRecommendationRequest(message);
            
            // Should not be both at the same time
            expect(isInfo && isRequest).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('distinguishes between action-requesting and information-providing messages (Requirement 4.3)', async () => {
      // Test that the classification is consistent
      const infoMessages = ['100000', '50 mil', 'trabalho', 'família', 'suv', 'sedan'];
      const requestMessages = ['mostra carros', 'quero ver', 'me indica', 'o que tem'];
      
      for (const msg of infoMessages) {
        expect(isInformationProvision(msg)).toBe(true);
        expect(detectExplicitRecommendationRequest(msg)).toBe(false);
      }
      
      for (const msg of requestMessages) {
        expect(detectExplicitRecommendationRequest(msg)).toBe(true);
        expect(isInformationProvision(msg)).toBe(false);
      }
    });
  });
});
