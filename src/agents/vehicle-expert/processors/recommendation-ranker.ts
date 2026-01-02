import { chatCompletion } from '../../../lib/llm-router';
import { logger } from '../../../lib/logger';
import { CustomerProfile, VehicleRecommendation } from '../../../types/state.types';

// Omit reasoning from VehicleRecommendation to avoid conflict if it exists there, then add it back as string
export interface RankedRecommendation extends Omit<VehicleRecommendation, 'reasoning'> {
    reasoning: string;
    aiScore?: number;
}

/**
 * Re-ranks vehicle recommendations using LLM reasoning
 * 
 * @param recommendations - Initial list of vehicles from vector search (Top 10-20)
 * @param profile - Customer profile with preferences and needs
 * @param limit - Number of final recommendations to return (default 3)
 * @returns Re-ordered and curated list of vehicles
 */
export async function rankRecommendations(
    recommendations: VehicleRecommendation[],
    profile: Partial<CustomerProfile>,
    limit: number = 3
): Promise<RankedRecommendation[]> {
    // 1. Fail fast if too few results to rank
    if (recommendations.length <= 1) {
        return recommendations;
    }

    try {
        const startTime = Date.now();
        logger.info({ count: recommendations.length }, 'Starting AI Reranking');

        // 2. Prepare context for LLM
        // Serialize profile to a concise string
        const userContext = [
            `Uso: ${profile.usoPrincipal || 'Geral'}`,
            `Pessoas: ${profile.people || 'Não informado'}`,
            `Orçamento: ${profile.budget ? `Até R$ ${profile.budget.toLocaleString('pt-BR')}` : 'Não informado'}`,
            profile.priorities?.length ? `Prioridades: ${profile.priorities.join(', ')}` : '',
            profile.dealBreakers?.length ? `Evitar: ${profile.dealBreakers.join(', ')}` : '',
            profile.bodyType ? `Categoria preferida: ${profile.bodyType}` : '',
            profile.brand ? `Marca preferida: ${profile.brand}` : '',
            profile.transmission ? `Câmbio: ${profile.transmission}` : '',
        ].filter(Boolean).join('\n');

        // Serialize vehicles to a concise list for the prompt
        // Include the original index to map back
        const vehicleList = recommendations.map((rec, index) => {
            const v = rec.vehicle;
            return `[ID:${index}] ${v.brand} ${v.model} ${v.year} | ${v.bodyType} | R$ ${v.price.toLocaleString('pt-BR')} | ${v.mileage.toLocaleString('pt-BR')}km | Detalhes: ${v.transmission}, ${v.fuel}`;
        }).join('\n');

        // 3. Construct Prompt
        const prompt = `
Você é um especialista em vendas de carros. Sua missão é selecionar os ${limit} MELHORES veículos para o cliente dentre as opções abaixo.

PERFIL DO CLIENTE:
${userContext}

VEÍCULOS DISPONÍVEIS (Candidatos recuperados do banco):
${vehicleList}

TAREFA:
1. Analise quais veículos atendem melhor às necessidades reais do cliente (ex: se pediu "família", priorize espaço/porta-malas sobre esportividade).
2. Se o cliente pediu algo específico (ex: "Corolla"), priorize esse modelo mesmo se for mais caro.
3. Ignore veículos que violem restrições graves (ex: Câmbio Manual se pediu Automático), a menos que não haja outra opção.
4. Selecione os Top ${limit}.
5. Para cada um, dê uma razão curta e persuasiva (1 frase) conectando ao perfil.

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "selected": [
    { "index": number, "reasoning": "string" }
  ]
}
`.trim();

        // 4. Call LLM
        const response = await chatCompletion([
            { role: 'system', content: 'You are a JSON-only response bot.' }, // Force JSON mode behavior helper
            { role: 'user', content: prompt }
        ], {
            temperature: 0.2, // Low temperature for deterministic/logical ranking
            // model: 'gpt-4o-mini' // REMOVED: Managed by router config, not options
        });

        // 5. Parse Response
        let parsed: { selected: { index: number; reasoning: string }[] };
        try {
            // Remove potential markdown code blocks if the model adds them
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            logger.error({ error: e, response }, 'Failed to parse AI Reranking response');
            return recommendations.slice(0, limit); // Fallback to original order
        }

        // 6. Map back to objects
        const reranked: RankedRecommendation[] = [];

        for (const item of parsed.selected) {
            const original = recommendations[item.index];
            if (original) {
                reranked.push({
                    ...original,
                    reasoning: item.reasoning,
                    // Boost score artificially to reflect AI preference if needed, or just keep order
                });
            }
        }

        // If AI returned fewer than limit, fill with original top results (excluding already selected)
        if (reranked.length < limit) {
            const selectedIds = new Set(reranked.map(r => r.vehicleId));
            for (const rec of recommendations) {
                if (!selectedIds.has(rec.vehicleId) && reranked.length < limit) {
                    reranked.push(rec);
                }
            }
        }

        logger.info({
            originalTop: recommendations[0].vehicle.model,
            newTop: reranked[0].vehicle.model,
            processingTime: Date.now() - startTime
        }, 'AI Reranking complete');

        return reranked;

    } catch (error) {
        logger.error({ error }, 'Error during AI Reranking');
        return recommendations.slice(0, limit); // Fallback
    }
}
