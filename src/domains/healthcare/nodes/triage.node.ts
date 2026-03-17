/**
 * Healthcare Triage Node
 *
 * Collects symptoms/needs and suggests a medical specialty.
 */

import { AIMessage } from '@langchain/core/messages';
import type { IGenericGraphState } from '../../../core/types';
import type { HealthcareProfile, HealthcareDomainData } from '../types';
import { SYMPTOM_SPECIALTY_MAP, SPECIALTY_LABELS, type Specialty } from '../config';

// ── Symptom Detection ──

function detectSymptoms(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const keyword of Object.keys(SYMPTOM_SPECIALTY_MAP)) {
    if (lower.includes(keyword)) {
      found.push(keyword);
    }
  }

  return found;
}

// ── Specialty Suggestion ──

function suggestSpecialty(symptoms: string[]): { specialty: Specialty; confidence: number } | null {
  if (symptoms.length === 0) return null;

  // Count votes per specialty
  const votes = new Map<Specialty, number>();
  for (const symptom of symptoms) {
    const spec = SYMPTOM_SPECIALTY_MAP[symptom];
    if (spec) {
      votes.set(spec, (votes.get(spec) || 0) + 1);
    }
  }

  if (votes.size === 0) return null;

  // Pick the specialty with the most votes
  let best: Specialty = 'clinico_geral';
  let bestCount = 0;
  for (const [spec, count] of votes) {
    if (count > bestCount) {
      best = spec;
      bestCount = count;
    }
  }

  const confidence = Math.min(bestCount / symptoms.length, 1.0);
  return { specialty: best, confidence };
}

// ── Direct specialty request detection ──

function detectDirectSpecialty(text: string): Specialty | null {
  const lower = text.toLowerCase();
  for (const [key, label] of Object.entries(SPECIALTY_LABELS)) {
    if (lower.includes(label.toLowerCase()) || lower.includes(key.replace('_', ' '))) {
      return key as Specialty;
    }
  }
  return null;
}

// ── Node Handler ──

export async function healthcareTriageNode(
  state: IGenericGraphState
): Promise<Partial<IGenericGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || typeof lastMessage.content !== 'string') {
    return {};
  }

  const userText = lastMessage.content;
  const profile = state.profile as HealthcareProfile;
  const domainData = state.domainData as HealthcareDomainData;

  // Check if user directly requested a specialty
  const directSpecialty = detectDirectSpecialty(userText);

  if (directSpecialty) {
    const label = SPECIALTY_LABELS[directSpecialty];
    return {
      messages: [
        new AIMessage(`Entendido! Vou buscar horarios disponiveis em *${label}* para voce.`),
      ],
      next: 'scheduling',
      profile: { ...profile, preferredSpecialty: directSpecialty },
      domainData: {
        ...domainData,
        triageResult: {
          suggestedSpecialty: directSpecialty,
          confidence: 1.0,
          reasoning: 'Paciente solicitou diretamente a especialidade.',
        },
      },
      metadata: { ...state.metadata, lastMessageAt: Date.now() },
    };
  }

  // Detect symptoms from text
  const newSymptoms = detectSymptoms(userText);
  const allSymptoms = [...new Set([...(profile.symptoms || []), ...newSymptoms])];

  // Try to suggest a specialty
  const suggestion = suggestSpecialty(allSymptoms);

  if (suggestion && suggestion.confidence >= 0.5) {
    const label = SPECIALTY_LABELS[suggestion.specialty];
    return {
      messages: [
        new AIMessage(
          `Com base no que voce descreveu, recomendo uma consulta em *${label}*. ` +
            `Quer que eu busque horarios disponiveis nessa especialidade? ` +
            `Ou prefere outra especialidade?`
        ),
      ],
      next: 'scheduling',
      profile: { ...profile, symptoms: allSymptoms, preferredSpecialty: suggestion.specialty },
      domainData: {
        ...domainData,
        triageResult: {
          suggestedSpecialty: suggestion.specialty,
          confidence: suggestion.confidence,
          reasoning: `Sintomas detectados: ${allSymptoms.join(', ')}`,
        },
      },
      metadata: { ...state.metadata, lastMessageAt: Date.now() },
    };
  }

  // Not enough info — ask more
  const response =
    allSymptoms.length > 0
      ? `Entendi que voce mencionou: ${allSymptoms.join(', ')}. Pode me dar mais detalhes sobre o que esta sentindo? Isso vai me ajudar a indicar a melhor especialidade.`
      : `Para te direcionar melhor, pode me contar o que esta sentindo ou qual tipo de consulta precisa? Por exemplo: check-up, dor de cabeca, problemas de pele, ansiedade...`;

  return {
    messages: [new AIMessage(response)],
    next: 'triage',
    profile: { ...profile, symptoms: allSymptoms },
    metadata: { ...state.metadata, lastMessageAt: Date.now() },
  };
}
