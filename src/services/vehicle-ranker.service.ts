/**
 * Vehicle Ranker Service
 *
 * Uses a Small Language Model (SLM) to intelligently rank vehicles
 * based on customer context, preferences, and use case.
 *
 * This approach avoids hardcoded business rules and allows the LLM
 * to evaluate vehicles considering nuanced criteria like:
 * - Family needs (space, safety, car seats)
 * - Uber/99 requirements (year, category eligibility)
 * - Travel comfort (fuel efficiency, trunk space)
 * - Work/business use (durability, economy)
 */

import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';

export interface VehicleForRanking {
  id: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  bodyType: string;
  transmission?: string;
  fuelType?: string;
  color?: string;
  // Eligibility flags
  aptoFamilia?: boolean;
  aptoUber?: boolean;
  aptoUberBlack?: boolean;
  aptoTrabalho?: boolean;
}

export interface RankingContext {
  useCase: string; // e.g., "família com 2 cadeirinhas para viagens longas"
  budget?: number;
  priorities?: string[]; // e.g., ["espaço", "segurança", "economia"]
  restrictions?: string[]; // e.g., ["não quero hatch pequeno"]
  numberOfPeople?: number;
  additionalInfo?: string;
}

export interface RankedVehicle {
  vehicleId: string;
  score: number; // 0-100
  reasoning: string;
  highlights: string[];
  concerns: string[];
}

export interface RankingResult {
  rankedVehicles: RankedVehicle[];
  summary: string;
  processingTime: number;
}

const RANKING_SYSTEM_PROMPT = `Você é um especialista em veículos que ajuda clientes a encontrar o carro ideal.

Sua tarefa é RANQUEAR uma lista de veículos com base no contexto e necessidades do cliente.

REGRAS DE AVALIAÇÃO:

1. **Para FAMÍLIA com crianças/cadeirinhas (CRÍTICO):**
   - **ESPECIFICAÇÕES OBRIGATÓRIAS**: Espaço interno traseiro amplo e porta-malas generoso.
   - **PRIORIDADE MÁXIMA (Score 90-100)**: SUVs Médios/Grandes, Minivans (Spin), Sedans Médios (Corolla, Civic).
   - **ACEITÁVEL (Score 70-85)**: Sedans Compactos espaçosos (Versa, Cobalt, Cronos), SUVs Compactos.
   - **PENALIDADE SEVERA (Max Score 60)**: Hatches Compactos/Subcompactos (Mobi, Kwid, Up, HB20 hatch, Gol, Argo).
     * MOTIVO: Não cabem duas cadeirinhas confortavelmente + carrinho no porta-malas.
   - Considerar: Segurança (Isofix, Airbags) e Facilidade de acesso.
   - Ano mais recente = mais seguro (airbags, controle de estabilidade)

2. **Para VIAGEM:**
   - PRIORIZAR: Conforto, economia de combustível, espaço para bagagem
   - Sedans e SUVs são ideais
   - Baixa quilometragem = mais confiável para viagens longas

3. **Para UBER/99 (REGRAS OFICIAIS 2026):**
   - PRIORIZAR: SUVs > Sedans > Hatches médios/grandes
   - EVITAR COMPLETAMENTE: Hatches básicos/compactos (Kwid, Uno, Mobi, Gol, Fox, Celta, Palio)
   - TRANSMISSÃO AUTOMÁTICA = GRANDE VANTAGEM (muito mais conforto no trânsito urbano)

   **UberX (regra geral 2026):**
   - Ano MÍNIMO: 2016 ou mais novo (máximo 10 anos de fabricação)
   - 4 portas, ar condicionado, ESPAÇO para passageiros
   - Hatches básicos servem MAS são inferiores (baixo score)

   **Comfort (regra 2026):**
   - Ano MÍNIMO geral: 2017 ou mais novo
   - EXCLUÍDOS: Renault Kardian, Citroën Basalt, Chery Tiggo 3/3X, Renault Logan
   - OBRIGATÓRIO: Sedan médio ou SUV espaçoso
   - Modelos específicos em CAPITAIS têm requisitos MAIS RIGOROSOS:
     * VW Virtus: somente 2026+
     * Honda City: somente 2023+
     * Nivus: somente 2023+

   **Black (regra 2026):**
   - Ano MÍNIMO: 2018 ou mais novo
   - EXCLUÍDOS: mesmos do Comfort (Kardian, Basalt, Tiggo 3/3X, Logan)
   - OBRIGATÓRIO: Sedan executivo ou SUV premium
   - Modelos específicos seguem mesmas regras do Comfort para ano

   - Quilometragem baixa é CRÍTICA (carro vai rodar MUITO mais)
   - Aparência profissional importa (cliente quer conforto e status)
   - Hatches básicos: score < 50 para qualquer categoria Uber

4. **Para TRABALHO:**
   - Considerar durabilidade, economia, custo de manutenção
   - Pickups para carga, Sedans para representação

5. **CRITÉRIOS GERAIS:**
   - Ano mais recente = melhor (tecnologia, segurança, garantia)
   - Menor quilometragem = melhor (menos desgaste)
   - Preço deve ser avaliado como custo-benefício, NÃO priorizar mais caro
   - Transmissão automática = GRANDE DIFERENCIAL para Uber, família, conforto
   - SUVs e Sedans sempre superiores a hatches básicos para uso profissional/família

IMPORTANTE:
- Score de 90-100: Excelente match, atende todos os critérios
- Score de 75-89: Bom match, atende maioria dos critérios
- Score de 60-74: Razoável, tem compromissos
- Score < 60: Não recomendado para este perfil

EXEMPLOS DE SCORES PARA UBER (2026):
**UberX:**
- SUV 2018+ automático, baixa KM = 95-100 (EXCELENTE para UberX)
- Sedan 2016-2017 automático = 80-90 (ÓTIMO para UberX)
- Hatch médio 2017+ (HB20, Onix) = 65-75 (BOM para UberX)
- Hatch básico 2016+ (Kwid, Uno) = 40-55 (ACEITÁVEL MAS INFERIOR)
- Qualquer veículo 2015 ou anterior = 30-40 (NÃO ACEITO - regra 10 anos)

**Comfort:**
- SUV 2023+ automático = 95-100 (EXCELENTE)
- Sedan médio 2023+ automático (City, Virtus, Nivus) = 90-95 (ÓTIMO)
- Sedan 2017-2022 automático = 75-85 (BOM, mas não ideal)
- Kardian, Basalt, Tiggo 3/3X, Logan qualquer ano = 20-30 (EXCLUÍDOS)
- Hatch médio ou veículo < 2017 = 35-50 (NÃO ACEITO)

**Black:**
- Sedan executivo/SUV premium 2023+ = 95-100 (EXCELENTE)
- Sedan executivo/SUV 2018-2022 = 80-90 (BOM)
- Veículo < 2018 ou modelos excluídos = 20-35 (NÃO ACEITO)

Retorne APENAS JSON válido no formato especificado.`;

export class VehicleRankerService {
  /**
   * Rank vehicles using SLM based on customer context
   */
  async rank(vehicles: VehicleForRanking[], context: RankingContext): Promise<RankingResult> {
    const startTime = Date.now();

    if (vehicles.length === 0) {
      return {
        rankedVehicles: [],
        summary: 'Nenhum veículo disponível para avaliação.',
        processingTime: Date.now() - startTime,
      };
    }

    try {
      // Format vehicles for the prompt
      const vehiclesList = vehicles
        .map(
          (v, i) =>
            `${i + 1}. ${v.brand} ${v.model} ${v.year}
   - Preço: R$ ${v.price.toLocaleString('pt-BR')}
   - KM: ${v.mileage.toLocaleString('pt-BR')}
   - Tipo: ${v.bodyType}
   - Câmbio: ${v.transmission || 'N/A'}
   - Combustível: ${v.fuelType || 'N/A'}
   - ID: ${v.id}`
        )
        .join('\n\n');

      // Build context description
      const contextDescription = this.buildContextDescription(context);

      const userPrompt = `CONTEXTO DO CLIENTE:
${contextDescription}

VEÍCULOS DISPONÍVEIS:
${vehiclesList}

Analise cada veículo considerando o contexto do cliente e retorne um JSON com o ranking.

FORMATO DE RESPOSTA (JSON):
{
  "rankedVehicles": [
    {
      "vehicleId": "id_do_veiculo",
      "score": 95,
      "reasoning": "Explicação curta de por que este veículo é ideal",
      "highlights": ["ponto positivo 1", "ponto positivo 2"],
      "concerns": ["ponto de atenção se houver"]
    }
  ],
  "summary": "Resumo geral da análise"
}

IMPORTANTE:
- Ordene do MELHOR para o PIOR (maior score primeiro)
- Inclua TODOS os veículos no ranking
- Seja específico no reasoning (mencione o contexto do cliente)
- Retorne APENAS o JSON, sem texto adicional`;

      const response = await chatCompletion(
        [
          { role: 'system', content: RANKING_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.3, // Baixa temperatura para consistência
          maxTokens: 2000,
        }
      );

      // Parse response
      const result = this.parseRankingResponse(response, vehicles);

      logger.info(
        {
          vehicleCount: vehicles.length,
          context: context.useCase,
          topScore: result.rankedVehicles[0]?.score,
          processingTime: Date.now() - startTime,
        },
        'Vehicle ranking completed'
      );

      return {
        ...result,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ error, vehicleCount: vehicles.length }, 'Vehicle ranking failed');

      // Fallback: return vehicles in original order with basic scoring
      return {
        rankedVehicles: vehicles.map((v, i) => ({
          vehicleId: v.id,
          score: Math.max(90 - i * 5, 60),
          reasoning: 'Avaliação automática baseada em critérios gerais',
          highlights: this.generateBasicHighlights(v),
          concerns: [],
        })),
        summary: 'Ranking baseado em critérios gerais (fallback)',
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build a natural language description of the customer context
   */
  private buildContextDescription(context: RankingContext): string {
    const parts: string[] = [];

    parts.push(`Uso principal: ${context.useCase}`);

    if (context.budget) {
      parts.push(`Orçamento: até R$ ${context.budget.toLocaleString('pt-BR')}`);
    }

    if (context.numberOfPeople) {
      parts.push(`Número de pessoas: ${context.numberOfPeople}`);
    }

    if (context.priorities && context.priorities.length > 0) {
      parts.push(`Prioridades: ${context.priorities.join(', ')}`);
    }

    if (context.restrictions && context.restrictions.length > 0) {
      parts.push(`Restrições: ${context.restrictions.join(', ')}`);
    }

    if (context.additionalInfo) {
      parts.push(`Informações adicionais: ${context.additionalInfo}`);
    }

    return parts.join('\n');
  }

  /**
   * Parse and validate LLM response
   */
  private parseRankingResponse(
    response: string,
    originalVehicles: VehicleForRanking[]
  ): Omit<RankingResult, 'processingTime'> {
    try {
      // Clean response (remove markdown code blocks if present)
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.rankedVehicles || !Array.isArray(parsed.rankedVehicles)) {
        throw new Error('Invalid response structure: missing rankedVehicles array');
      }

      // Validate and normalize each ranked vehicle
      const validIds = new Set(originalVehicles.map(v => v.id));
      const rankedVehicles: RankedVehicle[] = parsed.rankedVehicles
        .filter((rv: any) => validIds.has(rv.vehicleId))
        .map((rv: any) => ({
          vehicleId: rv.vehicleId,
          score: Math.min(100, Math.max(0, Number(rv.score) || 70)),
          reasoning: rv.reasoning || 'Veículo avaliado',
          highlights: Array.isArray(rv.highlights) ? rv.highlights.slice(0, 3) : [],
          concerns: Array.isArray(rv.concerns) ? rv.concerns.slice(0, 2) : [],
        }));

      // Sort by score descending
      rankedVehicles.sort((a, b) => b.score - a.score);

      // Add any missing vehicles with low scores
      const rankedIds = new Set(rankedVehicles.map(rv => rv.vehicleId));
      for (const vehicle of originalVehicles) {
        if (!rankedIds.has(vehicle.id)) {
          rankedVehicles.push({
            vehicleId: vehicle.id,
            score: 50,
            reasoning: 'Veículo não avaliado pelo modelo',
            highlights: [],
            concerns: [],
          });
        }
      }

      return {
        rankedVehicles,
        summary: parsed.summary || 'Veículos ranqueados com base no perfil do cliente.',
      };
    } catch (error) {
      logger.error(
        { error, response: response.substring(0, 500) },
        'Failed to parse ranking response'
      );
      throw error;
    }
  }

  /**
   * Generate basic highlights for fallback
   */
  private generateBasicHighlights(vehicle: VehicleForRanking): string[] {
    const highlights: string[] = [];
    const currentYear = new Date().getFullYear();

    if (vehicle.year >= currentYear - 2) {
      highlights.push(`Veículo recente (${vehicle.year})`);
    }

    if (vehicle.mileage < 50000) {
      highlights.push(`Baixa quilometragem (${vehicle.mileage.toLocaleString('pt-BR')}km)`);
    }

    if (vehicle.bodyType?.toLowerCase().includes('suv')) {
      highlights.push('SUV - espaçoso e versátil');
    }

    return highlights.slice(0, 3);
  }
}

// Singleton export
export const vehicleRanker = new VehicleRankerService();
