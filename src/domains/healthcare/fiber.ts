/**
 * Healthcare Fiber Definition
 *
 * 4-phase conversational flow:
 * 0 — Contato Inicial (no name)
 * 1 — Triagem (name collected, no specialty)
 * 2 — Agendamento (specialty defined, no slot)
 * 3 — Confirmacao (slot chosen, appointment confirmed)
 */

import type {
  FiberDefinition,
  FiberResult,
  FiberPhase,
  IGenericGraphState,
} from '../../core/types';
import type { HealthcareProfile, HealthcareDomainData } from './types';

// ── Phases ──

export const healthcarePhases: FiberPhase[] = [
  { id: 0, label: 'Contato Inicial', description: 'Primeiro contato, sem identificacao' },
  { id: 1, label: 'Triagem', description: 'Nome coletado, coletando sintomas' },
  { id: 2, label: 'Agendamento', description: 'Especialidade definida, escolhendo horario' },
  { id: 3, label: 'Confirmacao', description: 'Slot escolhido, confirmando agendamento' },
];

// ── Minimum fiber for each node ──

const NODE_MIN_FIBER: Record<string, number> = {
  greeting: 0,
  triage: 1,
  scheduling: 2,
  confirmation: 3,
};

// ── Allowed regressions ──

const ALLOWED_REGRESSIONS: [string, string][] = [
  ['confirmation', 'scheduling'], // "quero outro horario"
];

// ── Compute Fiber ──

export function computeHealthcareFiber(state: IGenericGraphState): FiberResult {
  const profile = state.profile as HealthcareProfile;
  const domainData = state.domainData as HealthcareDomainData;

  // Phase 3: slot chosen and confirmed
  if (domainData.selectedSlot && domainData.appointmentConfirmed) {
    return {
      fiber: 3,
      label: 'Confirmacao',
      completeness: 1.0,
      missingForNext: [],
    };
  }

  // Phase 2: specialty defined
  if (profile.preferredSpecialty) {
    const missing: string[] = [];
    if (!domainData.selectedSlot) missing.push('selectedSlot');
    return {
      fiber: 2,
      label: 'Agendamento',
      completeness: domainData.selectedSlot ? 0.9 : 0.6,
      missingForNext: missing,
    };
  }

  // Phase 1: name collected
  if (profile.name) {
    const missing: string[] = [];
    if (!profile.symptoms?.length) missing.push('symptoms');
    if (!profile.preferredSpecialty) missing.push('preferredSpecialty');
    return {
      fiber: 1,
      label: 'Triagem',
      completeness: profile.symptoms?.length ? 0.5 : 0.2,
      missingForNext: missing,
    };
  }

  // Phase 0: initial contact
  return {
    fiber: 0,
    label: 'Contato Inicial',
    completeness: 0,
    missingForNext: ['name'],
  };
}

// ── Check Guard ──

export function checkHealthcareGuard(
  state: IGenericGraphState,
  nextNode: string,
  sourceNode?: string
): string | null {
  const currentFiber = computeHealthcareFiber(state).fiber;
  const requiredFiber = NODE_MIN_FIBER[nextNode];

  if (requiredFiber === undefined) return null; // unknown node, allow

  // Allow if fiber is sufficient
  if (currentFiber >= requiredFiber) return null;

  // Check allowed regressions
  if (sourceNode) {
    const isAllowed = ALLOWED_REGRESSIONS.some(
      ([from, to]) => from === sourceNode && to === nextNode
    );
    if (isAllowed) return null;
  }

  // Suggest the right node for current fiber
  const suggestedPhase = healthcarePhases[currentFiber];
  const suggestedNode = Object.entries(NODE_MIN_FIBER).find(([, f]) => f === currentFiber)?.[0];
  return suggestedNode || suggestedPhase?.label || 'greeting';
}

// ── Fiber Definition (exported for plugin) ──

export const healthcareFiberDefinition: FiberDefinition = {
  phases: healthcarePhases,
  computeFiber: computeHealthcareFiber,
  checkGuard: checkHealthcareGuard,
};
