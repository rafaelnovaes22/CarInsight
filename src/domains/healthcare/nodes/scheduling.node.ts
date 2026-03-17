/**
 * Healthcare Scheduling Node
 *
 * Searches for available professionals and presents appointment slots.
 */

import { AIMessage } from '@langchain/core/messages';
import type { IGenericGraphState } from '../../../core/types';
import type { HealthcareProfile, HealthcareDomainData, AppointmentSlot } from '../types';
import { SPECIALTY_LABELS, type Specialty } from '../config';
import { healthcareSearchAdapter } from '../search-adapter';

// ── Slot Selection Detection ──

function detectSlotSelection(text: string, slots: AppointmentSlot[]): AppointmentSlot | null {
  const lower = text.toLowerCase();

  // Check for slot number: "1", "opcao 1", "primeiro", etc.
  const numberMatch = lower.match(/(?:op[cç][aã]o\s+)?(\d+)/);
  if (numberMatch) {
    const idx = parseInt(numberMatch[1], 10) - 1;
    if (idx >= 0 && idx < slots.length) return slots[idx];
  }

  // Check for ordinals
  const ordinals: Record<string, number> = {
    primeiro: 0,
    primeira: 0,
    segundo: 1,
    segunda: 1,
    terceiro: 2,
    terceira: 2,
  };
  for (const [word, idx] of Object.entries(ordinals)) {
    if (lower.includes(word) && idx < slots.length) return slots[idx];
  }

  // Check for date/time match
  for (const slot of slots) {
    if (lower.includes(slot.time) || lower.includes(slot.date)) return slot;
  }

  return null;
}

// ── Node Handler ──

export async function healthcareSchedulingNode(
  state: IGenericGraphState
): Promise<Partial<IGenericGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || typeof lastMessage.content !== 'string') {
    return {};
  }

  const userText = lastMessage.content;
  const profile = state.profile as HealthcareProfile;
  const domainData = state.domainData as HealthcareDomainData;
  const specialty = profile.preferredSpecialty as Specialty | undefined;

  // If there are available slots and user is selecting one
  if (domainData.availableSlots?.length) {
    const selected = detectSlotSelection(userText, domainData.availableSlots);
    if (selected) {
      return {
        messages: [
          new AIMessage(
            `Otimo! Voce escolheu:\n\n` +
              `*${selected.doctorName}*\n` +
              `Especialidade: ${SPECIALTY_LABELS[selected.specialty as Specialty] || selected.specialty}\n` +
              `Data: ${selected.date}\n` +
              `Horario: ${selected.time}\n` +
              `Local: ${selected.location}\n` +
              `Duracao: ${selected.duration} minutos\n\n` +
              `Confirma este agendamento?`
          ),
        ],
        next: 'confirmation',
        domainData: { ...domainData, selectedSlot: selected },
        metadata: { ...state.metadata, lastMessageAt: Date.now() },
      };
    }
  }

  // Search for professionals
  const results = await healthcareSearchAdapter.search(specialty || '', {
    specialty: specialty || '',
  });

  if (results.length === 0) {
    return {
      messages: [
        new AIMessage(
          `Nao encontrei profissionais disponiveis para essa especialidade no momento. ` +
            `Deseja tentar outra especialidade?`
        ),
      ],
      next: 'triage',
      metadata: { ...state.metadata, lastMessageAt: Date.now() },
    };
  }

  // Collect all slots from all matching professionals
  const allSlots: AppointmentSlot[] = [];
  for (const result of results) {
    const slots = (result.item.slots as AppointmentSlot[]) || [];
    allSlots.push(...slots);
  }

  // Build response with numbered list
  const specialtyLabel = specialty ? SPECIALTY_LABELS[specialty] || specialty : 'Clinico Geral';

  let response = `Encontrei os seguintes horarios para *${specialtyLabel}*:\n\n`;

  allSlots.forEach((slot, i) => {
    response += `*${i + 1}.* ${slot.doctorName} — ${slot.date} as ${slot.time} (${slot.duration}min) — ${slot.location}\n`;
  });

  response += `\nQual horario voce prefere? Responda com o numero.`;

  return {
    messages: [new AIMessage(response)],
    next: 'scheduling',
    domainData: { ...domainData, availableSlots: allSlots },
    recommendations: results,
    metadata: { ...state.metadata, lastMessageAt: Date.now() },
  };
}
