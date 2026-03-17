/**
 * Healthcare Nodes — Unit Tests
 *
 * Tests each node handler in isolation.
 */

import { describe, it, expect } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import type { IGenericGraphState } from '../../../../src/core/types';
import { healthcareGreetingNode } from '../../../../src/domains/healthcare/nodes/greeting.node';
import { healthcareTriageNode } from '../../../../src/domains/healthcare/nodes/triage.node';
import { healthcareSchedulingNode } from '../../../../src/domains/healthcare/nodes/scheduling.node';
import { healthcareConfirmationNode } from '../../../../src/domains/healthcare/nodes/confirmation.node';

function makeState(overrides: Partial<IGenericGraphState> = {}): IGenericGraphState {
  return {
    messages: [],
    phoneNumber: '5511999999999',
    profile: {},
    recommendations: [],
    next: 'greeting',
    metadata: {
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
      loopCount: 0,
      errorCount: 0,
      flags: [],
    },
    domainData: {},
    ...overrides,
  };
}

describe('healthcareGreetingNode', () => {
  it('returns empty for no messages', async () => {
    const result = await healthcareGreetingNode(makeState());
    expect(result).toEqual({});
  });

  it('asks for name when not provided', async () => {
    const state = makeState({ messages: [new HumanMessage('ola')] });
    const result = await healthcareGreetingNode(state);
    expect(result.next).toBe('greeting');
    expect(result.messages?.[0].content).toContain('nome');
  });

  it('collects name and moves to triage', async () => {
    const state = makeState({ messages: [new HumanMessage('meu nome e Maria')] });
    const result = await healthcareGreetingNode(state);
    expect(result.next).toBe('triage');
    expect((result.profile as any)?.name).toBe('Maria');
  });

  it('detects emergency and ends conversation', async () => {
    const state = makeState({ messages: [new HumanMessage('emergencia preciso de ajuda')] });
    const result = await healthcareGreetingNode(state);
    expect(result.next).toBe('__END__');
    expect(result.messages?.[0].content).toContain('SAMU');
  });
});

describe('healthcareTriageNode', () => {
  it('returns empty for no messages', async () => {
    const result = await healthcareTriageNode(makeState());
    expect(result).toEqual({});
  });

  it('detects symptoms and suggests specialty', async () => {
    const state = makeState({
      messages: [new HumanMessage('estou com dor no peito e palpitacao')],
      profile: { name: 'Maria' },
    });
    const result = await healthcareTriageNode(state);
    expect(result.next).toBe('scheduling');
    expect((result.profile as any)?.preferredSpecialty).toBe('cardiologia');
  });

  it('handles direct specialty request', async () => {
    const state = makeState({
      messages: [new HumanMessage('quero agendar com dermatologia')],
      profile: { name: 'Maria' },
    });
    const result = await healthcareTriageNode(state);
    expect(result.next).toBe('scheduling');
    expect((result.profile as any)?.preferredSpecialty).toBe('dermatologia');
  });

  it('asks for more info when symptoms are unclear', async () => {
    const state = makeState({
      messages: [new HumanMessage('nao estou me sentindo bem')],
      profile: { name: 'Maria' },
    });
    const result = await healthcareTriageNode(state);
    expect(result.next).toBe('triage');
  });
});

describe('healthcareSchedulingNode', () => {
  it('returns empty for no messages', async () => {
    const result = await healthcareSchedulingNode(makeState());
    expect(result).toEqual({});
  });

  it('shows available slots for a specialty', async () => {
    const state = makeState({
      messages: [new HumanMessage('quero ver horarios')],
      profile: { name: 'Maria', preferredSpecialty: 'cardiologia' },
    });
    const result = await healthcareSchedulingNode(state);
    expect(result.next).toBe('scheduling');
    expect((result.domainData as any)?.availableSlots).toBeDefined();
    expect((result.domainData as any).availableSlots.length).toBeGreaterThan(0);
    expect(result.messages?.[0].content).toContain('Cardiologia');
  });

  it('selects a slot when user picks a number', async () => {
    const slots = [
      {
        id: 'doc-002-slot-0',
        doctorName: 'Dr. Carlos Mendes',
        specialty: 'cardiologia',
        date: '2026-03-20',
        time: '11:00',
        location: 'Clinica Central — Sala 205',
        duration: 45,
      },
    ];
    const state = makeState({
      messages: [new HumanMessage('1')],
      profile: { name: 'Maria', preferredSpecialty: 'cardiologia' },
      domainData: { availableSlots: slots },
    });
    const result = await healthcareSchedulingNode(state);
    expect(result.next).toBe('confirmation');
    expect((result.domainData as any)?.selectedSlot).toBeDefined();
    expect((result.domainData as any).selectedSlot.doctorName).toBe('Dr. Carlos Mendes');
  });
});

describe('healthcareConfirmationNode', () => {
  it('returns empty for no messages', async () => {
    const result = await healthcareConfirmationNode(makeState());
    expect(result).toEqual({});
  });

  it('redirects to scheduling when no slot selected', async () => {
    const state = makeState({ messages: [new HumanMessage('sim')] });
    const result = await healthcareConfirmationNode(state);
    expect(result.next).toBe('scheduling');
  });

  it('confirms appointment on "sim"', async () => {
    const slot = {
      id: 'slot-1',
      doctorName: 'Dr. Carlos Mendes',
      specialty: 'cardiologia',
      date: '2026-03-20',
      time: '11:00',
      location: 'Clinica Central — Sala 205',
      duration: 45,
    };
    const state = makeState({
      messages: [new HumanMessage('sim, confirmo')],
      profile: { name: 'Maria' },
      domainData: { selectedSlot: slot },
    });
    const result = await healthcareConfirmationNode(state);
    expect(result.next).toBe('__END__');
    expect((result.domainData as any)?.appointmentConfirmed).toBe(true);
    expect(result.messages?.[0].content).toContain('Consulta confirmada');
  });

  it('returns to scheduling on "nao"', async () => {
    const slot = {
      id: 'slot-1',
      doctorName: 'Dr. X',
      specialty: 'cardiologia',
      date: '2026-03-20',
      time: '11:00',
      location: 'Sala 1',
      duration: 30,
    };
    const state = makeState({
      messages: [new HumanMessage('nao, quero outro horario')],
      domainData: { selectedSlot: slot },
    });
    const result = await healthcareConfirmationNode(state);
    expect(result.next).toBe('scheduling');
  });

  it('asks for clarification on unclear response', async () => {
    const slot = {
      id: 'slot-1',
      doctorName: 'Dr. X',
      specialty: 'cardiologia',
      date: '2026-03-20',
      time: '11:00',
      location: 'Sala 1',
      duration: 30,
    };
    const state = makeState({
      messages: [new HumanMessage('hmm deixa eu pensar')],
      domainData: { selectedSlot: slot },
    });
    const result = await healthcareConfirmationNode(state);
    expect(result.next).toBe('confirmation');
    expect(result.messages?.[0].content).toContain('sim');
  });
});
