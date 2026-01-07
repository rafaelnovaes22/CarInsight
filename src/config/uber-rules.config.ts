/**
 * Uber Eligibility Rules Configuration
 *
 * Centralizes all rules for Uber/99 eligibility.
 * Allows easy updates without modifying the AI logic.
 */

export const UberRulesConfig = {
  // Models explicitly blocked from Uber Black regardless of year/price
  // These are "popular" sedans/hatchs that don't meet the premium criteria
  blackExclusions: [
    'HB20',
    'HB20S',
    'Hb20',
    'Hb20s',
    'Onix',
    'Onix Plus',
    'Prisma',
    'Fiat Cronos',
    'Grand Siena',
    'Siena',
    'VW Voyage',
    'Virtus', // Except GTS/Exclusive, but safe to block for general rule
    'Ford Ka',
    'Ka Sedan',
    'Toyota Yaris',
    'Etios',
    'Nissan Versa',
    'V-Drive',
    'Honda City',
    'Renault Logan',
    'Sandero',
  ],

  // Age limits relative to current year
  ageLimits: {
    uberX: 10, // 10 years rule (Main capitals)
    uberComfort: 6, // ~6 years rule (Varies by city, 6 is safe average)
    uberBlack: 6, // ~6 years rule
  },

  /**
   * Generates the LLM prompt with strict rules for the current year.
   * @param currentYear The reference year (e.g. 2026)
   */
  getSafetyPrompt: (currentYear: number) => {
    const rules = UberRulesConfig;
    const uberXCutoff = currentYear - rules.ageLimits.uberX;
    const uberComfortCutoff = currentYear - rules.ageLimits.uberComfort;
    const uberBlackCutoff = currentYear - rules.ageLimits.uberBlack;

    return `ATENÇÃO MÁXIMA: Você é um validador RIGOROSO de veículos para Uber Black/Comfort no Brasil (Data Atual: ${currentYear}).

🚨 REGRA DE OURO (EXCLUSÕES IMEDIATAS):
Se o veículo estiver nesta lista, ele **NUNCA** pode ser Uber Black, não importa o ano ou preço:
${rules.blackExclusions.map(model => `- **${model}**`).join('\n')}

Se o carro for um desses, **uberBlack DEVE SER FALSE**. Não hesite.

---

CRITÉRIOS POR CATEGORIA (FOCO SÃO PAULO - SP - REGRA 10 ANOS):

1. **UBER X** (Entrada):
   - **Ano: ${uberXCutoff} ou mais recente** (Regra de 10 anos nas capitais, base ano ${currentYear}).
   - Aceita quase tudo ${uberXCutoff}+ com 4 portas e Ar.
   - Hatchs compactos (Mobi, Kwid, HB20) são aceitos.
   - Sedans compactos (HB20S, Cronos) são aceitos.
   - **PROIBIDO**: Carros 2 Portas (Jamais aceito). 
   - **PROIBIDO**: Ano < ${uberXCutoff} (Regra estrita de 10 anos).

2. **UBER COMFORT** (Intermediário):
   - Max ${rules.ageLimits.uberComfort} anos (Aprox ${uberComfortCutoff}+).
   - Espaço interno decente.
   - **NÃO ACEITA HATCHS PEQUENOS** (Mobi, Kwid, Gol, HB20 Hatch, Onix Hatch).
   - **ACEITA** Sedans compactos modernos (HB20S, Onix Plus, Cronos, Virtus) e SUVs.

3. **UBER BLACK** (Premium - Apenas Sedans Médios/Grandes e SUVs):
   - Max ${rules.ageLimits.uberBlack} anos (Aprox ${uberBlackCutoff}+).
   - Cores sóbrias (Preto, Prata, Cinza, Branco, Azul-marinho).
   - **SOMENTE SEDANS MÉDIOS+**: Corolla, Civic, Sentra, Cerato, Cruze, Jetta.
   - **SUVs SELECIONADOS**: Compass, Kicks, Creta, HR-V, T-Cross, Renegade.
   - **JAMAIS**: Carros populares, compactos ou "sedans de entrada" (ver lista de exclusão acima).

---

TAREFA:
Analise o veículo abaixo. Primeiro verifique se ele está na LISTA DE EXCLUSÃO do Black.
Retorne JSON estrito.

Exemplo de Raciocínio Esperado para HB20S:
"HB20S é um sedan compacto popular. Está na lista de exclusão do Black. Aceito no X e Comfort (se novo)." -> uberBlack: false.

Formato de resposta:
{
  "uberX": true/false,
  "uberComfort": true/false,
  "uberBlack": true/false,
  "reasoning": "Seja direto. Mencione a exclusão se houver.",
  "confidence": 1.0
}`;
  },
};
