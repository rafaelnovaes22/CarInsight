import { UberEligibilityResult, VehicleInfo, uberEligibilityValidator } from './uber-eligibility-validator.service';
import { uberRulesProvider, UberCitySlug } from './uber-rules-provider.service';

export interface UberEligibilityAgentResult extends UberEligibilityResult {
  source: {
    citySlug: UberCitySlug;
    sourceUrl: string;
    fetchedAt: string;
  };
}

export class UberEligibilityAgent {
  async evaluate(vehicle: VehicleInfo, citySlug: UberCitySlug): Promise<UberEligibilityAgentResult> {
    const ruleSet = await uberRulesProvider.get(citySlug);

    // Hard gates first (fast and deterministic)
    // Note: base requirement (4 doors + A/C) is assumed for ride categories.
    if (!vehicle.arCondicionado || vehicle.portas < 4) {
      return {
        uberX: false,
        uberComfort: false,
        uberBlack: false,
        reasoning: 'Reprovado: requisitos b\u00e1sicos (ar-condicionado e 4 portas) n\u00e3o atendidos.',
        confidence: 1.0,
        source: {
          citySlug,
          sourceUrl: ruleSet.meta.sourceUrl,
          fetchedAt: ruleSet.meta.fetchedAt,
        },
      };
    }

    const nowYear = new Date().getFullYear();
    const minYearDecree = nowYear - 10; // SP baseline (city-specific in the future)

    // Decree gate (baseline SP): max vehicle age = 10 years
    if (vehicle.ano < minYearDecree) {
      return {
        uberX: false,
        uberComfort: false,
        uberBlack: false,
        reasoning: `Reprovado: ano inferior ao m\u00ednimo (regra 10 anos). Min: ${minYearDecree}.`,
        confidence: 1.0,
        source: {
          citySlug,
          sourceUrl: ruleSet.meta.sourceUrl,
          fetchedAt: ruleSet.meta.fetchedAt,
        },
      };
    }

    // Model-based rules: Uber can be more restrictive per model/city/modality.
    const targetBrand = vehicle.marca.toLowerCase();
    const targetModel = vehicle.modelo.toLowerCase();

    const matchRule = (eligible: any[] | undefined) => {
      if (!eligible || eligible.length === 0) return null;
      return (
        eligible.find(r => r.brand.toLowerCase() === targetBrand && targetModel.includes(r.model.toLowerCase())) ||
        eligible.find(r => targetModel.includes(`${r.brand} ${r.model}`.toLowerCase())) ||
        eligible.find(r => targetModel.includes(r.model.toLowerCase())) ||
        null
      );
    };

    const ruleX = matchRule(ruleSet.rules.uberX?.eligible);
    const ruleComfort = matchRule(ruleSet.rules.uberComfort?.eligible);
    const ruleBlack = matchRule(ruleSet.rules.uberBlack?.eligible);

    const minYearX = ruleX ? Math.max(minYearDecree, ruleX.minYear) : minYearDecree;
    const minYearComfort = ruleComfort ? Math.max(minYearDecree, ruleComfort.minYear) : minYearDecree;
    const minYearBlack = ruleBlack ? Math.max(minYearDecree, ruleBlack.minYear) : minYearDecree;

    // If we have an explicit eligible list for a modality and the model is NOT present, block it.
    const hasListX = (ruleSet.rules.uberX?.eligible?.length ?? 0) > 0;
    const hasListComfort = (ruleSet.rules.uberComfort?.eligible?.length ?? 0) > 0;
    const hasListBlack = (ruleSet.rules.uberBlack?.eligible?.length ?? 0) > 0;

    if (hasListX && !ruleX) {
      return {
        uberX: false,
        uberComfort: false,
        uberBlack: false,
        reasoning: `Reprovado: ${vehicle.marca} ${vehicle.modelo} n\u00e3o consta na lista de eleg\u00edveis (${citySlug}).`,
        confidence: 1.0,
        source: {
          citySlug,
          sourceUrl: ruleSet.meta.sourceUrl,
          fetchedAt: ruleSet.meta.fetchedAt,
        },
      };
    }

    if (vehicle.ano < minYearX) {
      return {
        uberX: false,
        uberComfort: false,
        uberBlack: false,
        reasoning: `Reprovado: ano inferior ao m\u00ednimo para ${vehicle.marca} ${vehicle.modelo} em ${citySlug} (min: ${minYearX}).`,
        confidence: 1.0,
        source: {
          citySlug,
          sourceUrl: ruleSet.meta.sourceUrl,
          fetchedAt: ruleSet.meta.fetchedAt,
        },
      };
    }

    // Delegate nuanced model/category logic to the existing LLM validator when we don't have lists (or for premium categories).
    const llmResult = await uberEligibilityValidator.validateEligibility(vehicle);

    const enforced: UberEligibilityResult = {
      uberX: llmResult.uberX && vehicle.ano >= minYearX,
      uberComfort:
        llmResult.uberComfort &&
        (!hasListComfort || !!ruleComfort) &&
        vehicle.ano >= minYearComfort,
      uberBlack:
        llmResult.uberBlack &&
        (!hasListBlack || !!ruleBlack) &&
        vehicle.ano >= minYearBlack,
      reasoning: llmResult.reasoning,
      confidence: llmResult.confidence,
    };

    return {
      ...enforced,
      source: {
        citySlug,
        sourceUrl: ruleSet.meta.sourceUrl,
        fetchedAt: ruleSet.meta.fetchedAt,
      },
    };
  }
}

export const uberEligibilityAgent = new UberEligibilityAgent();
