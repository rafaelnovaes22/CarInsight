/**
 * Platform Eligibility Rules Configuration
 *
 * Centralizes rules for all supported platforms:
 * - Ride Hailing: Uber, 99, InDrive
 * - Delivery: iFood, Rappi, Loggi, Mercado Livre
 *
 * Supports dynamic rules based on vehicle type (Car vs Moto vs Utility).
 */

export interface PlatformRule {
  name: string;
  category: string; // 'X', 'Black', 'Comfort', 'Moto', 'Entregas'
  minYearRelative: number; // Current Year - X
  allowedTypes: string[]; // 'hatch', 'sedan', 'suv', 'moto', 'van'
  features?: string[]; // 'ar_condicionado', '4_portas'
  exclusions: string[]; // Models strictly forbidden
  requiredCc?: number; // For motos (e.g. 150cc)
}

export const PlatformRulesConfig = {
  // 🚗 PASSENGER TRANSPORT (APP DE TRANSPORTE)
  transport: {
    uber: {
      x: {
        name: 'Uber X',
        minYearRelative: 10,
        allowedTypes: ['hatch', 'sedan', 'suv', 'minivan'],
        features: ['ar_condicionado', '4_portas'],
        exclusions: ['pick-up', 'furgão'],
      },
      comfort: {
        name: 'Uber Comfort',
        minYearRelative: 6,
        allowedTypes: ['sedan', 'suv', 'minivan'],
        features: ['ar_condicionado', '4_portas'],
        exclusions: [
          'HB20',
          'HB20S',
          'Onix',
          'Onix Plus',
          'Gol',
          'Ka',
          'Ka Sedan',
          'Sandero',
          'Logan',
          'Etios',
          'Yaris',
          'Cronos',
          'Mobi',
          'Kwid',
        ],
      },
      black: {
        name: 'Uber Black',
        minYearRelative: 6,
        allowedTypes: ['sedan', 'suv'],
        features: ['ar_condicionado', '4_portas', 'bancos_couro'],
        exclusions: [
          'HB20',
          'HB20S',
          'Onix',
          'Onix Plus',
          'Prisma',
          'Cronos',
          'Grand Siena',
          'Voyage',
          'Virtus',
          'Ka',
          'Ka Sedan',
          'Yaris',
          'Etios',
          'Versa',
          'City',
          'Logan',
          'Sandero',
          'Fit',
          'Duster',
          'Ecosport',
        ],
      },
    },

    ninetyNine: {
      // 99Pop, 99Comfort
      pop: {
        name: '99 Pop',
        minYearRelative: 11, // 99 often accepts slightly older cars
        allowedTypes: ['hatch', 'sedan', 'suv', 'minivan'],
        features: ['ar_condicionado', '4_portas'],
        exclusions: ['pick-up'],
      },
      comfort: {
        name: '99 Comfort',
        minYearRelative: 7,
        allowedTypes: ['sedan', 'suv', 'minivan'],
        exclusions: ['Mobi', 'Kwid', 'Up', 'Picanto', 'Celer'],
      },
    },

    indrive: {
      name: 'InDrive',
      minYearRelative: 12, // Often more flexible
      allowedTypes: ['hatch', 'sedan', 'suv'],
      features: ['4_portas'],
      exclusions: [],
    },
  },

  // 🛵 DELIVERY & LOGISTICS (ENTREGAS)
  delivery: {
    ifood: {
      moto: {
        name: 'iFood (Moto)',
        minYearRelative: 15, // Motos up to 15 years usually accepted
        allowedTypes: ['moto'],
        requiredCc: 100,
        exclusions: ['scooter_50cc'],
      },
      bike: {
        name: 'iFood (Bike)',
        minYearRelative: 99,
        allowedTypes: ['bike', 'e-bike'],
        exclusions: [],
      },
    },

    loggi: {
      moto: {
        name: 'Loggi (Moto)',
        minYearRelative: 10,
        allowedTypes: ['moto'],
        requiredCc: 125, // Often prefers 125+
        exclusions: [],
      },
      van: {
        name: 'Loggi (Van/Fiorino)',
        minYearRelative: 15,
        allowedTypes: ['van', 'furgão', 'pickup'],
        exclusions: [],
      },
    },

    lalamove: {
      moto: {
        name: 'Lalamove (Moto)',
        minYearRelative: 10,
        allowedTypes: ['moto'],
        exclusions: [],
      },
      carro: {
        name: 'Lalamove (Carro)',
        minYearRelative: 15,
        allowedTypes: ['sedan', 'suv', 'hatch'], // Documentos citam "veículos de passeio" e "sedan/suv"
        features: ['4_portas'],
        exclusions: [],
      },
      utilitario: {
        name: 'Lalamove (Utilitário)',
        minYearRelative: 15,
        allowedTypes: ['van', 'furgão', 'pickup', 'caminhonete'],
        exclusions: [],
      },
    },

    mercadoEnvios: {
      flex: {
        name: 'Mercado Envios (Carro)',
        minYearRelative: 15, // Aceita carros de passeio até 15 anos
        allowedTypes: ['hatch', 'sedan', 'suv', 'minivan'],
        features: ['4_portas', 'porta_malas_fechado'], // Exige porta malas
        exclusions: [],
      },
      utilitarios: {
        name: 'Mercado Envios (Utilitário)',
        minYearRelative: 15,
        allowedTypes: ['van', 'furgão', 'caminhonete'],
        exclusions: [],
      },
    },

    shopee: {
      entregador: {
        name: 'Shopee Xpress',
        minYearRelative: 15, // Aceita até 15 anos (algumas fontes dizem 20, mas 15 é seguro)
        allowedTypes: ['hatch', 'sedan', 'suv', 'caminhonete', 'van'],
        features: ['4_portas'],
        exclusions: [],
      },
    },
  },

  /**
   * Helper: Get cutoff year for a specific rule
   */
  getCutoffYear(rule: Partial<PlatformRule>): number {
    if (!rule.minYearRelative) return 0;
    return new Date().getFullYear() - rule.minYearRelative;
  },

  /**
   * Helper: Generate a Master Prompt for the Validator
   */
  generateMasterPrompt(currentYear: number): string {
    return `ATENÇÃO: Você é um Validador Universal de Veículos (Apps de Transporte e Entregas).
DATA REF: ${currentYear}.

REGRAS DE PAULO - SP:

--- 🚗 TRANSPORTE (Carros) ---
1. UBER X / 99 POP:
   - Idade Max: 10-11 anos (Aprox ${currentYear - 10}+).
   - Requisito: 4 Portas, Ar Condicionado.
   - Proibido: Pickups abertas, Vans de carga.

2. UBER BLACK / COMFORT:
   - Idade Max: 6 anos (Aprox ${currentYear - 6}+).
   - Black Exclusões: JAMAIS Compactos de entrada (HB20, Onix, Ka, Gol, Sandero, etc). Apenas Sedans Médios e SUVs de porte.

--- 🛵 MOTO & ENTREGAS ---
3. IFOOD / LOGGI (Moto):
   - Motos até 12-15 anos são aceitas.
   - Preferência por > 125cc.
   - Scooters elétricas pequenas (50cc) podem ser rejeitadas para rotas longas.

4. UTILITÁRIOS (Mercado Livre/Loggi):
   - Aceita Fiorino, Doblo Cargo, Vans e Caminhonetes.
   - Idade até 15 anos.

---
TAREFA:
Analise o veículo fornecido e retorne a elegibilidade para TODAS as categorias aplicáveis.
Responda em JSON estrito.
`;
  },
};
