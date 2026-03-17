/**
 * Healthcare Confirmation Node
 *
 * Shows appointment summary and handles confirmation/rescheduling.
 */

import { AIMessage } from '@langchain/core/messages';
import type { IGenericGraphState } from '../../../core/types';
import type { HealthcareProfile, HealthcareDomainData } from '../types';
import { SPECIALTY_LABELS, type Specialty } from '../config';

// ── Confirmation Detection ──

function detectConfirmation(text: string): 'yes' | 'no' | 'unclear' {
  const lower = text.toLowerCase();
  if (/\b(sim|confirmo|pode|ok|certo|isso|confirma|beleza|perfeito|bora)\b/.test(lower))
    return 'yes';
  if (/\b(n[aã]o|cancela|trocar|outro|reagendar|mudar)\b/.test(lower)) return 'no';
  return 'unclear';
}

// ── Node Handler ──

export async function healthcareConfirmationNode(
  state: IGenericGraphState
): Promise<Partial<IGenericGraphState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage || typeof lastMessage.content !== 'string') {
    return {};
  }

  const userText = lastMessage.content;
  const profile = state.profile as HealthcareProfile;
  const domainData = state.domainData as HealthcareDomainData;
  const slot = domainData.selectedSlot;

  if (!slot) {
    return {
      messages: [new AIMessage('Parece que nenhum horario foi selecionado. Vamos voltar.')],
      next: 'scheduling',
      metadata: { ...state.metadata, lastMessageAt: Date.now() },
    };
  }

  const confirmation = detectConfirmation(userText);

  if (confirmation === 'yes') {
    const specialtyLabel = SPECIALTY_LABELS[slot.specialty as Specialty] || slot.specialty;

    return {
      messages: [
        new AIMessage(
          `Consulta confirmada!\n\n` +
            `*Resumo do agendamento:*\n` +
            `Paciente: ${profile.name || 'Nao informado'}\n` +
            `Medico(a): ${slot.doctorName}\n` +
            `Especialidade: ${specialtyLabel}\n` +
            `Data: ${slot.date}\n` +
            `Horario: ${slot.time}\n` +
            `Local: ${slot.location}\n` +
            `Duracao: ${slot.duration} minutos\n\n` +
            `Obrigado por agendar conosco, ${profile.name || ''}! ` +
            `Caso precise reagendar ou cancelar, e so entrar em contato. Ate la!`
        ),
      ],
      next: '__END__',
      domainData: { ...domainData, appointmentConfirmed: true },
      metadata: { ...state.metadata, lastMessageAt: Date.now() },
    };
  }

  if (confirmation === 'no') {
    return {
      messages: [
        new AIMessage(
          'Sem problema! Vamos escolher outro horario. Qual especialidade ou data voce prefere?'
        ),
      ],
      next: 'scheduling',
      domainData: {
        ...domainData,
        selectedSlot: undefined,
        availableSlots: undefined,
        appointmentConfirmed: false,
      },
      metadata: { ...state.metadata, lastMessageAt: Date.now() },
    };
  }

  // Unclear
  return {
    messages: [
      new AIMessage(
        `Voce confirma o agendamento com *${slot.doctorName}* em ${slot.date} as ${slot.time}? Responda *sim* ou *nao*.`
      ),
    ],
    next: 'confirmation',
    metadata: { ...state.metadata, lastMessageAt: Date.now() },
  };
}
