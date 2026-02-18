import { VehicleRecommendation } from '../types/state.types';

export interface RecommendationEvidenceContext {
  useCase: string;
  budget?: number;
  priorities?: string[];
  people?: number;
}

export interface RecommendationEvidencePack {
  useCase: string;
  profileSignals: string[];
  selectedBecause: string[];
  notIdealBecause: string[];
  matchedCharacteristics: string[];
}

function normalizeUseCase(useCase: string): string {
  const normalized = (useCase || '').toLowerCase();
  if (normalized.includes('uber') && normalized.includes('black')) return 'uber black';
  if (normalized.includes('uber') && normalized.includes('comfort')) return 'uber comfort';
  if (normalized.includes('uber')) return 'uber x';
  if (normalized.includes('famil')) return 'familia';
  if (normalized.includes('viag')) return 'viagem';
  if (normalized.includes('trabalh')) return 'trabalho';
  return 'uso diario';
}

export class RecommendationEvidenceService {
  build(
    recommendation: VehicleRecommendation,
    context: RecommendationEvidenceContext
  ): RecommendationEvidencePack {
    const vehicle = recommendation.vehicle || {};
    const useCase = normalizeUseCase(context.useCase);
    const selectedBecause = [...(recommendation.highlights || [])];
    const notIdealBecause = [...(recommendation.concerns || [])];
    const matchedCharacteristics: string[] = [];
    const profileSignals: string[] = [];

    if (context.budget) {
      profileSignals.push(`orcamento ate R$ ${context.budget.toLocaleString('pt-BR')}`);
      if (typeof vehicle.price === 'number') {
        if (vehicle.price <= context.budget) {
          selectedBecause.push('Dentro do orcamento informado');
          matchedCharacteristics.push('orcamento');
        } else if (vehicle.price <= context.budget * 1.1) {
          selectedBecause.push('Leve ajuste de orcamento para melhor opcao');
          matchedCharacteristics.push('orcamento');
        } else {
          notIdealBecause.push('Acima do orcamento esperado');
        }
      }
    }

    if (context.people && context.people >= 4) {
      profileSignals.push(`${context.people} pessoas`);
      const bodyType = String(vehicle.bodyType || '').toLowerCase();
      if (bodyType.includes('suv') || bodyType.includes('sedan') || bodyType.includes('minivan')) {
        selectedBecause.push('Carroceria com melhor espaco para passageiros');
        matchedCharacteristics.push('espaco');
      }
    }

    if (context.priorities && context.priorities.length > 0) {
      profileSignals.push(`prioridades: ${context.priorities.join(', ')}`);
      for (const priority of context.priorities) {
        const p = priority.toLowerCase();
        if (p.includes('econom') && selectedBecause.some(r => r.toLowerCase().includes('econ'))) {
          matchedCharacteristics.push('economia');
        }
        if (p.includes('confort') && selectedBecause.some(r => r.toLowerCase().includes('confort'))) {
          matchedCharacteristics.push('conforto');
        }
        if (
          (p.includes('espac') || p.includes('cadeir')) &&
          selectedBecause.some(
            r => r.toLowerCase().includes('espac') || r.toLowerCase().includes('famil')
          )
        ) {
          matchedCharacteristics.push('espaco');
        }
      }
    }

    if (useCase.includes('uber')) {
      profileSignals.push(`perfil ${useCase}`);
      if (
        String(vehicle.transmission || '').toLowerCase().includes('autom') ||
        String(vehicle.transmission || '').toLowerCase().includes('cvt')
      ) {
        selectedBecause.push('Cambio automatico favorece conforto no uso intenso');
        matchedCharacteristics.push('conforto');
      }
      if (typeof vehicle.year === 'number' && vehicle.year >= 2016) {
        matchedCharacteristics.push('ano');
      }
    }

    if (useCase === 'familia') {
      profileSignals.push('uso familiar');
      if (
        String(vehicle.bodyType || '').toLowerCase().includes('suv') ||
        String(vehicle.bodyType || '').toLowerCase().includes('sedan')
      ) {
        matchedCharacteristics.push('carroceria');
      }
    }

    return {
      useCase,
      profileSignals: Array.from(new Set(profileSignals)).slice(0, 4),
      selectedBecause: Array.from(new Set(selectedBecause)).slice(0, 4),
      notIdealBecause: Array.from(new Set(notIdealBecause)).slice(0, 3),
      matchedCharacteristics: Array.from(new Set(matchedCharacteristics)).slice(0, 4),
    };
  }
}

export const recommendationEvidence = new RecommendationEvidenceService();
