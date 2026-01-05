
import { chatCompletion } from '../../../lib/llm-router';
import { logger } from '../../../lib/logger';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';

export interface VehicleEvaluation {
    vehicleId: string;
    score: number;
    reasoning: string;
    isAdequate: boolean;
}

export class VehicleEvaluator {
    /**
     * Evaluate and rank vehicles based on user profile using LLM
     */
    async evaluateVehicles(
        recommendations: VehicleRecommendation[],
        profile: Partial<CustomerProfile>
    ): Promise<VehicleRecommendation[]> {
        if (recommendations.length === 0) return [];

        // Skip LLM if few results (optional, but good for performance)
        // if (recommendations.length <= 5) return recommendations;

        try {
            const evaluations = await this.evaluateWithLLM(recommendations, profile);

            // Update scores and re-sort
            const ranked = recommendations.map(rec => {
                const evaluation = evaluations.find(e => e.vehicleId === rec.vehicleId);
                if (evaluation) {
                    return {
                        ...rec,
                        matchScore: evaluation.score,
                        reasoning: evaluation.reasoning
                    };
                }
                return rec;
            });

            // Sort by score (descending) and filter out inadequate options
            return ranked
                .filter(r => r.matchScore >= 40) // Remove "Ruim" results entirely
                .sort((a, b) => b.matchScore - a.matchScore);
        } catch (error) {
            logger.error({ error }, 'Failed to evaluate vehicles with LLM, returning original order');
            return recommendations;
        }
    }

    private async evaluateWithLLM(
        recommendations: VehicleRecommendation[],
        profile: Partial<CustomerProfile>
    ): Promise<VehicleEvaluation[]> {
        const userContext = this.buildUserContext(profile);

        const vehiclesList = recommendations.map(r => {
            const v = r.vehicle;
            return {
                id: v.id,
                // Concise description for token efficiency
                desc: `[${v.bodyType}] ${v.brand} ${v.model} ${v.year} - R$${v.price} - ${v.mileage}km - ${v.transmission}`,
            };
        }).slice(0, 50); // Hard limit for LLM context

        const messages = [
            {
                role: 'system' as const,
                content: `Você é um especialista em vendas de veículos. Avalie a adequação dos veículos para o cliente.

CONTEXTO DE AVALIAÇÃO:
1. USO:
- "Obra", "Carga", "Rural" -> Priorize PICAPES (S10, Hilux, Strada, Toro).
- "Família", "Viagem" -> Priorize SUVs/Sedans espaçosos.
- "Uber", "Apps" -> Priorize Sedans/Hatchs econômicos (Onix, Prisma, Logan).
- "Cidade", "Dia a dia" -> Priorize Compactos (Mobi, Kwid, HB20).

2. MOTOS (CRÍTICO):
- "Delivery", "Entrega", "iFood", "Motoboy" -> PRIORIDADE MÁXIMA para motos robustas/econômicas (Honda CG, Yamaha Factor/Fazer 150/250). Scooters (PCX/NMax) são secundárias.
- "Agilidade", "Trânsito", "Faculdade" -> Priorize Scooters (PCX, NMax, Biz) ou Street.
- "Economia" -> Priorize baixa cilindrada.

3. ORÇAMENTO:
- Se veículo muito acima do budget -> Score baixo (mas não zero se for muito bom).
- Se muito abaixo -> Score bom (economia).

Retorne APENAS JSON:
{
  "evaluations": [
    {"vehicleId": "id", "score": 0-100, "reasoning": "curta justificativa", "isAdequate": true/false}
  ]
}

Score:
90-100: Perfeito (Tipo ideal, preço ok)
70-89: Bom (Atende bem)
40-69: Aceitável
0-39: Ruim (Discard)

4. RESTRIÇÕES RÍGIDAS (IMPORTANTE):
- Se o cliente pediu especificamente MOTO e o veículo é CARRO -> Score 0, isAdequate: false.
- Se o cliente pediu especificamente CARRO e o veículo é MOTO -> Score 0, isAdequate: false.
- Se o cliente pediu "iFood/Entrega" e o veículo bebe muito (ex: SUV v6) -> Score baixo.
`
            },
            {
                role: 'user' as const,
                content: `PERFIL:
${userContext}

VEÍCULOS:
${vehiclesList.map(v => `${v.id}: ${v.desc}`).join('\n')}`
            }
        ];

        const response = await chatCompletion(messages, { temperature: 0.2 });

        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : response);
            return parsed.evaluations || [];
        } catch (e) {
            logger.error({ response }, 'Invalid JSON from VehicleEvaluator');
            return [];
        }
    }

    private buildUserContext(profile: Partial<CustomerProfile>): string {
        const parts: string[] = [];
        if (profile.usage) parts.push(`Uso: ${profile.usage}`);
        if (profile.budget) parts.push(`Orçamento: R$ ${profile.budget}`);
        if (profile.bodyType) parts.push(`Tipo preferido: ${profile.bodyType}`);
        if (profile.priorities) parts.push(`Prioridades: ${profile.priorities.join(', ')}`);
        return parts.join('\n');
    }
}

export const vehicleEvaluator = new VehicleEvaluator();

