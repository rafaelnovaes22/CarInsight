/**
 * Golden Dataset for Recommendation System Evaluation
 *
 * Curated test cases to benchmark recommendation accuracy.
 * Each test case defines:
 * - User profile and context
 * - Expected criteria for good recommendations
 * - Ideal vehicle patterns (should appear in top results)
 * - Anti-patterns (should NOT appear in top results)
 */

// ============================================================================
// Types
// ============================================================================

export interface GoldenTestCase {
  id: string;
  description: string;
  category: 'familia' | 'uber' | 'viagem' | 'trabalho' | 'geral';

  // User input simulation
  userProfile: {
    useCase: string;
    budget?: number;
    people?: number;
    priorities?: string[];
    restrictions?: string[];
  };
  userMessages: string[];

  // Expected output criteria
  expectedCriteria: {
    bodyTypes?: string[]; // SUV, Sedan, Hatch, Pickup, etc
    minYear?: number;
    maxYear?: number;
    maxPrice?: number;
    minPrice?: number;
    transmission?: 'automatico' | 'manual' | 'any';
    mustHave?: string[]; // ar condicionado, 4 portas, etc
    mustNotHave?: string[]; // hatch compacto, pickup, etc
  };

  // Vehicles that SHOULD appear in top-3 (high score expected)
  idealVehiclePatterns: Array<{
    brand?: string;
    model?: string;
    bodyType?: string;
    minScore: number; // Minimum expected score (0-100)
  }>;

  // Vehicles that should NOT appear in top-3
  antiPatterns: Array<{
    brand?: string;
    model?: string;
    bodyType?: string;
    reason: string;
  }>;

  // Expected minimum scores
  expectedScores: {
    minPrecisionAt3: number; // e.g., 0.7 = at least 1 of top-3 matches ideal
    minTopScore: number; // Minimum score for best recommendation
  };
}

// ============================================================================
// Golden Dataset - Curated Test Cases
// ============================================================================

export const GOLDEN_DATASET: GoldenTestCase[] = [
  // =========================================================================
  // FAMÍLIA
  // =========================================================================
  {
    id: 'familia-2-cadeirinhas',
    description: 'Família com 2 crianças pequenas (cadeirinhas)',
    category: 'familia',
    userProfile: {
      useCase: 'família com 2 filhos pequenos',
      budget: 100000,
      people: 4,
      priorities: ['espaço', 'segurança', 'conforto'],
    },
    userMessages: [
      'Preciso de um carro para minha família, tenho 2 filhos pequenos com cadeirinha',
      'Preciso de espaço para carrinho de bebê no porta-malas',
    ],
    expectedCriteria: {
      bodyTypes: ['SUV', 'Sedan', 'Minivan'],
      mustHave: ['ar condicionado', '4 portas'],
      mustNotHave: ['Mobi', 'Kwid', 'Up', 'Uno'],
    },
    idealVehiclePatterns: [
      { bodyType: 'SUV', minScore: 85 },
      { model: 'Spin', minScore: 80 },
      { bodyType: 'Sedan', minScore: 75 },
    ],
    antiPatterns: [
      { model: 'Mobi', reason: 'Muito pequeno para 2 cadeirinhas' },
      { model: 'Kwid', reason: 'Espaço interno insuficiente' },
      { model: 'Up', reason: 'Porta-malas muito pequeno' },
      { bodyType: 'Hatch', model: 'Uno', reason: 'Sem espaço para família' },
    ],
    expectedScores: {
      minPrecisionAt3: 0.7,
      minTopScore: 80,
    },
  },

  {
    id: 'familia-viagem-longa',
    description: 'Família que faz viagens longas frequentes',
    category: 'familia',
    userProfile: {
      useCase: 'viagens longas em família',
      budget: 120000,
      people: 4,
      priorities: ['conforto', 'economia', 'segurança'],
    },
    userMessages: [
      'Quero um carro confortável para viagens longas com a família',
      'Fazemos muitas viagens de estrada, precisa ser econômico',
    ],
    expectedCriteria: {
      bodyTypes: ['SUV', 'Sedan'],
      transmission: 'automatico',
      mustHave: ['ar condicionado', 'direção hidráulica'],
    },
    idealVehiclePatterns: [
      { bodyType: 'SUV', minScore: 85 },
      { bodyType: 'Sedan', minScore: 80 },
    ],
    antiPatterns: [
      { bodyType: 'Hatch', reason: 'Desconfortável para viagens longas' },
      { model: 'Mobi', reason: 'Muito pequeno e desconfortável' },
    ],
    expectedScores: {
      minPrecisionAt3: 0.7,
      minTopScore: 80,
    },
  },

  // =========================================================================
  // UBER / 99
  // =========================================================================
  {
    id: 'uber-iniciante-2026',
    description: 'Motorista iniciando no Uber (regras 2026)',
    category: 'uber',
    userProfile: {
      useCase: 'trabalhar no Uber',
      budget: 80000,
      priorities: ['economia', 'conforto', 'manutenção barata'],
    },
    userMessages: [
      'Quero um carro para trabalhar no Uber',
      'Precisa ser confortável para os passageiros',
    ],
    expectedCriteria: {
      minYear: 2016, // Regra 10 anos
      bodyTypes: ['SUV', 'Sedan'],
      transmission: 'automatico',
      mustHave: ['ar condicionado', '4 portas'],
      mustNotHave: ['Kwid', 'Uno', 'Mobi', 'Gol'],
    },
    idealVehiclePatterns: [
      { bodyType: 'SUV', minScore: 90 },
      { bodyType: 'Sedan', minScore: 85 },
    ],
    antiPatterns: [
      { model: 'Kwid', reason: 'Não aceito no Uber - muito básico' },
      { model: 'Uno', reason: 'Não aceito no Uber' },
      { model: 'Mobi', reason: 'Muito pequeno para passageiros' },
    ],
    expectedScores: {
      minPrecisionAt3: 0.8,
      minTopScore: 85,
    },
  },

  {
    id: 'uber-comfort-2026',
    description: 'Motorista para Uber Comfort (regras 2026)',
    category: 'uber',
    userProfile: {
      useCase: 'Uber Comfort',
      budget: 120000,
      priorities: ['conforto', 'aparência', 'espaço'],
    },
    userMessages: ['Quero um carro para fazer Uber Comfort', 'Precisa ser um carro mais premium'],
    expectedCriteria: {
      minYear: 2017,
      bodyTypes: ['SUV', 'Sedan'],
      transmission: 'automatico',
      mustNotHave: ['Kardian', 'Basalt', 'Logan'],
    },
    idealVehiclePatterns: [
      { bodyType: 'SUV', minScore: 90 },
      { model: 'Corolla', minScore: 90 },
      { model: 'Civic', minScore: 90 },
    ],
    antiPatterns: [
      { model: 'Kardian', reason: 'Excluído do Comfort' },
      { model: 'Basalt', reason: 'Excluído do Comfort' },
      { model: 'Logan', reason: 'Excluído do Comfort' },
      { bodyType: 'Hatch', reason: 'Não aceito no Comfort' },
    ],
    expectedScores: {
      minPrecisionAt3: 0.7,
      minTopScore: 85,
    },
  },

  // =========================================================================
  // VIAGEM
  // =========================================================================
  {
    id: 'viagem-estrada-economia',
    description: 'Carro econômico para viagens de estrada',
    category: 'viagem',
    userProfile: {
      useCase: 'viagens de estrada',
      budget: 70000,
      priorities: ['economia de combustível', 'conforto'],
    },
    userMessages: [
      'Preciso de um carro econômico para viajar',
      'Faço muita estrada, quero gastar pouco com gasolina',
    ],
    expectedCriteria: {
      bodyTypes: ['Sedan', 'SUV', 'Hatch'],
      mustHave: ['ar condicionado'],
    },
    idealVehiclePatterns: [
      { bodyType: 'Sedan', minScore: 80 },
      { bodyType: 'SUV', minScore: 75 },
    ],
    antiPatterns: [{ bodyType: 'Pickup', reason: 'Alto consumo de combustível' }],
    expectedScores: {
      minPrecisionAt3: 0.6,
      minTopScore: 75,
    },
  },

  // =========================================================================
  // TRABALHO
  // =========================================================================
  {
    id: 'trabalho-carga',
    description: 'Veículo para trabalho com carga',
    category: 'trabalho',
    userProfile: {
      useCase: 'trabalho com transporte de carga',
      budget: 100000,
      priorities: ['capacidade de carga', 'durabilidade'],
    },
    userMessages: [
      'Preciso de um veículo para carregar materiais de construção',
      'Trabalho com entregas pesadas',
    ],
    expectedCriteria: {
      bodyTypes: ['Pickup', 'Van'],
    },
    idealVehiclePatterns: [{ bodyType: 'Pickup', minScore: 90 }],
    antiPatterns: [
      { bodyType: 'Sedan', reason: 'Sem capacidade de carga' },
      { bodyType: 'Hatch', reason: 'Sem capacidade de carga' },
    ],
    expectedScores: {
      minPrecisionAt3: 0.7,
      minTopScore: 85,
    },
  },

  {
    id: 'trabalho-representante',
    description: 'Carro para representante comercial',
    category: 'trabalho',
    userProfile: {
      useCase: 'representante comercial',
      budget: 90000,
      priorities: ['aparência', 'conforto', 'economia'],
    },
    userMessages: [
      'Sou representante comercial, preciso de um carro com boa aparência',
      'Visito clientes, precisa passar confiança',
    ],
    expectedCriteria: {
      bodyTypes: ['Sedan', 'SUV'],
      transmission: 'automatico',
      mustHave: ['ar condicionado'],
    },
    idealVehiclePatterns: [
      { bodyType: 'Sedan', minScore: 85 },
      { bodyType: 'SUV', minScore: 80 },
    ],
    antiPatterns: [
      { model: 'Mobi', reason: 'Aparência muito básica' },
      { model: 'Kwid', reason: 'Não passa confiança' },
    ],
    expectedScores: {
      minPrecisionAt3: 0.7,
      minTopScore: 80,
    },
  },

  // =========================================================================
  // GERAL / PRIMEIRO CARRO
  // =========================================================================
  {
    id: 'primeiro-carro-economico',
    description: 'Primeiro carro, orçamento limitado',
    category: 'geral',
    userProfile: {
      useCase: 'primeiro carro',
      budget: 40000,
      priorities: ['preço baixo', 'economia', 'manutenção barata'],
    },
    userMessages: [
      'Quero comprar meu primeiro carro',
      'Meu orçamento é apertado, quero gastar pouco',
    ],
    expectedCriteria: {
      maxPrice: 45000,
      mustHave: ['ar condicionado'],
    },
    idealVehiclePatterns: [{ bodyType: 'Hatch', minScore: 80 }],
    antiPatterns: [],
    expectedScores: {
      minPrecisionAt3: 0.5,
      minTopScore: 70,
    },
  },

  {
    id: 'carro-esportivo',
    description: 'Busca por carro esportivo',
    category: 'geral',
    userProfile: {
      useCase: 'diversão e esporte',
      budget: 150000,
      priorities: ['potência', 'design', 'performance'],
    },
    userMessages: ['Quero um carro esportivo', 'Gosto de carros com design agressivo e potentes'],
    expectedCriteria: {
      bodyTypes: ['Coupe', 'Hatch', 'Sedan'],
    },
    idealVehiclePatterns: [
      { model: 'Mustang', minScore: 95 },
      { model: 'Camaro', minScore: 95 },
      { model: 'Golf GTI', minScore: 85 },
    ],
    antiPatterns: [
      { bodyType: 'Minivan', reason: 'Não é esportivo' },
      { model: 'Spin', reason: 'Carro familiar, não esportivo' },
    ],
    expectedScores: {
      minPrecisionAt3: 0.5,
      minTopScore: 80,
    },
  },

  {
    id: 'modelo-especifico-civic',
    description: 'Busca por modelo específico (Civic)',
    category: 'geral',
    userProfile: {
      useCase: 'modelo específico',
      budget: 120000,
    },
    userMessages: ['Quero um Honda Civic', 'Tem Civic disponível?'],
    expectedCriteria: {
      bodyTypes: ['Sedan'],
    },
    idealVehiclePatterns: [{ model: 'Civic', minScore: 100 }],
    antiPatterns: [],
    expectedScores: {
      minPrecisionAt3: 0.9,
      minTopScore: 95,
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get test cases by category
 */
export function getTestCasesByCategory(category: GoldenTestCase['category']): GoldenTestCase[] {
  return GOLDEN_DATASET.filter(tc => tc.category === category);
}

/**
 * Get all test case IDs
 */
export function getTestCaseIds(): string[] {
  return GOLDEN_DATASET.map(tc => tc.id);
}

/**
 * Get a specific test case by ID
 */
export function getTestCaseById(id: string): GoldenTestCase | undefined {
  return GOLDEN_DATASET.find(tc => tc.id === id);
}

/**
 * Summary of dataset
 */
export function getDatasetSummary(): {
  total: number;
  byCategory: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  for (const tc of GOLDEN_DATASET) {
    byCategory[tc.category] = (byCategory[tc.category] || 0) + 1;
  }
  return {
    total: GOLDEN_DATASET.length,
    byCategory,
  };
}
