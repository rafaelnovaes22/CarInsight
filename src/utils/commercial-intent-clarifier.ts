import { findBestMatch } from 'string-similarity';

export type CommercialActionSuggestion = 'vendedor' | 'financiamento' | 'troca' | 'agendar visita';

interface CommercialAlias {
  action: CommercialActionSuggestion;
  value: string;
}

export interface AmbiguousCommercialIntent {
  action: CommercialActionSuggestion;
  confidence: number;
  matchedAlias: string;
}

const COMMERCIAL_ALIASES: CommercialAlias[] = [
  { action: 'vendedor', value: 'vendedor' },
  { action: 'vendedor', value: 'consultor' },
  { action: 'vendedor', value: 'atendente' },
  { action: 'vendedor', value: 'humano' },
  { action: 'financiamento', value: 'financiamento' },
  { action: 'financiamento', value: 'financiar' },
  { action: 'financiamento', value: 'simulacao' },
  { action: 'troca', value: 'troca' },
  { action: 'troca', value: 'trocar' },
  { action: 'agendar visita', value: 'agendar visita' },
  { action: 'agendar visita', value: 'agendar' },
  { action: 'agendar visita', value: 'visita' },
];

const CLARIFICATION_BLACKLIST = new Set(['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite']);

function normalizeCommercialText(message: string): string {
  return message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExactCommercialAlias(normalized: string): boolean {
  return COMMERCIAL_ALIASES.some(alias => alias.value === normalized);
}

export function detectAmbiguousCommercialIntent(message: string): AmbiguousCommercialIntent | null {
  const normalized = normalizeCommercialText(message);

  if (!normalized || normalized.length < 4 || normalized.length > 24) {
    return null;
  }

  if (normalized.split(' ').length > 3 || isExactCommercialAlias(normalized)) {
    return null;
  }

  const aliases = COMMERCIAL_ALIASES.map(alias => alias.value);
  const { bestMatch, bestMatchIndex } = findBestMatch(normalized, aliases);

  if (bestMatch.rating < 0.78 || bestMatch.rating >= 0.999) {
    return null;
  }

  return {
    action: COMMERCIAL_ALIASES[bestMatchIndex].action,
    confidence: bestMatch.rating,
    matchedAlias: COMMERCIAL_ALIASES[bestMatchIndex].value,
  };
}

export function shouldClarifyCommercialReply(message: string): boolean {
  const normalized = normalizeCommercialText(message);

  if (!normalized || normalized.length < 4 || normalized.length > 18) {
    return false;
  }

  if (CLARIFICATION_BLACKLIST.has(normalized) || /\d/.test(message) || /\?/.test(message)) {
    return false;
  }

  if (!/^[a-z\s]+$/.test(normalized) || normalized.split(' ').length > 3) {
    return false;
  }

  return !isExactCommercialAlias(normalized);
}

export function buildCommercialClarificationResponse(
  suggestion?: CommercialActionSuggestion,
  vehicleLabel?: string
): string {
  const suffix = vehicleLabel ? ` para o ${vehicleLabel}` : '';

  if (suggestion === 'vendedor') {
    return `So pra confirmar: voce quis dizer *"vendedor"*${suffix}?\n\nSe sim, me responde *vendedor* que eu encaminho agora.`;
  }

  if (suggestion === 'financiamento') {
    return `So pra confirmar: voce quis dizer *"financiamento"*${suffix}?\n\nSe sim, me responde *financiamento* que eu sigo daqui.`;
  }

  if (suggestion === 'troca') {
    return `So pra confirmar: voce quis dizer *"troca"*${suffix}?\n\nSe sim, me responde *troca* que eu continuo a negociacao.`;
  }

  if (suggestion === 'agendar visita') {
    return `So pra confirmar: voce quis dizer *"agendar visita"*${suffix}?\n\nSe sim, me responde *agendar visita* que eu sigo com voce.`;
  }

  return `Nao tenho certeza se entendi o que voce quis dizer${suffix}.\n\nPode me responder com uma destas opcoes?\n- *financiamento*\n- *troca*\n- *agendar visita*\n- *vendedor*`;
}
