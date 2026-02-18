import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';
import { RecommendationExplanation, VehicleRecommendation } from '../types/state.types';
import { RecommendationEvidencePack } from './recommendation-evidence.service';

interface ExplainerInput {
  recommendation: VehicleRecommendation;
  evidence: RecommendationEvidencePack;
}

export class RecommendationExplainerService {
  private buildFallback(input: ExplainerInput, strategy: 'deterministic' | 'fallback') {
    const topReasons = input.evidence.selectedBecause.slice(0, 2);
    const summary =
      topReasons.length > 0
        ? topReasons.join('. ')
        : input.recommendation.reasoning || 'Opcao selecionada por aderencia ao perfil informado.';

    const explanation: RecommendationExplanation = {
      version: 1,
      strategy,
      summary,
      matchedCharacteristics: input.evidence.matchedCharacteristics,
      selectedBecause: input.evidence.selectedBecause,
      notIdealBecause: input.evidence.notIdealBecause,
      profileSignals: input.evidence.profileSignals,
      confidence: strategy === 'deterministic' ? 0.85 : 0.6,
      generatedAt: new Date().toISOString(),
    };

    return explanation;
  }

  async explain(input: ExplainerInput, useSlm: boolean): Promise<RecommendationExplanation> {
    if (!useSlm) {
      return this.buildFallback(input, 'deterministic');
    }

    const vehicle = input.recommendation.vehicle || {};

    const prompt = `Você gera explicações curtas para recomendação de veículos.
Retorne APENAS JSON válido:
{
  "summary": "frase curta",
  "matchedCharacteristics": ["..."],
  "selectedBecause": ["..."],
  "notIdealBecause": ["..."],
  "confidence": 0.0
}

Contexto:
- Caso de uso: ${input.evidence.useCase}
- Sinais do perfil: ${input.evidence.profileSignals.join('; ') || 'N/A'}
- Veículo: ${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.year || ''}
- Match score: ${input.recommendation.matchScore}
- Pontos fortes: ${input.evidence.selectedBecause.join('; ') || 'N/A'}
- Pontos de atenção: ${input.evidence.notIdealBecause.join('; ') || 'N/A'}

Regras:
- Cite explicitamente por que combina com o perfil.
- Seja concreto e sem invenções.
- Máximo 2 itens em selectedBecause e 1 item em notIdealBecause.`;

    try {
      const response = await chatCompletion([{ role: 'user', content: prompt }], {
        temperature: 0.1,
        maxTokens: 300,
        retries: 1,
      });
      const raw = response.content || '';
      const cleaned = raw
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      const explanation: RecommendationExplanation = {
        version: 1,
        strategy: 'slm',
        summary:
          String(parsed.summary || '').trim() || this.buildFallback(input, 'fallback').summary,
        matchedCharacteristics: Array.isArray(parsed.matchedCharacteristics)
          ? parsed.matchedCharacteristics.slice(0, 4)
          : input.evidence.matchedCharacteristics,
        selectedBecause: Array.isArray(parsed.selectedBecause)
          ? parsed.selectedBecause.slice(0, 2)
          : input.evidence.selectedBecause.slice(0, 2),
        notIdealBecause: Array.isArray(parsed.notIdealBecause)
          ? parsed.notIdealBecause.slice(0, 1)
          : input.evidence.notIdealBecause.slice(0, 1),
        profileSignals: input.evidence.profileSignals.slice(0, 4),
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.75,
        generatedAt: new Date().toISOString(),
      };

      return explanation;
    } catch (error) {
      logger.warn({ error }, 'SLM explanation failed, using fallback explanation');
      return this.buildFallback(input, 'fallback');
    }
  }
}

export const recommendationExplainer = new RecommendationExplainerService();
