/**
 * Healthcare Flow — Integration Test
 *
 * Tests the full flow: greeting → triage → scheduling → confirmation
 */

import { describe, it, expect } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import type { IGenericGraphState } from '../../../../src/core/types';
import { healthcareDomainPlugin } from '../../../../src/domains/healthcare';
import { computeHealthcareFiber } from '../../../../src/domains/healthcare/fiber';

function makeInitialState(): IGenericGraphState {
  return healthcareDomainPlugin.createInitialState() as IGenericGraphState;
}

function findNode(name: string) {
  const node = healthcareDomainPlugin.nodes.find(n => n.name === name);
  if (!node) throw new Error(`Node "${name}" not found`);
  return node.handler;
}

function applyResult(
  state: IGenericGraphState,
  result: Partial<IGenericGraphState>
): IGenericGraphState {
  return {
    ...state,
    ...result,
    profile: { ...state.profile, ...(result.profile || {}) },
    domainData: { ...state.domainData, ...(result.domainData || {}) },
    metadata: { ...state.metadata, ...(result.metadata || {}) },
    messages: [...state.messages, ...(result.messages || [])],
  };
}

describe('Healthcare Full Flow', () => {
  it('completes greeting → triage → scheduling → confirmation', async () => {
    let state = makeInitialState();

    // Step 1: Greeting — provide name
    state = { ...state, messages: [new HumanMessage('meu nome e Joao')] };
    const greetingResult = await findNode('greeting')(state);
    state = applyResult(state, greetingResult);

    expect(greetingResult.next).toBe('triage');
    expect((state.profile as any).name).toBe('Joao');
    expect(computeHealthcareFiber(state).fiber).toBe(1);

    // Step 2: Triage — describe symptoms
    state = {
      ...state,
      messages: [...state.messages, new HumanMessage('estou com dor de cabeca e tontura')],
    };
    const triageResult = await findNode('triage')(state);
    state = applyResult(state, triageResult);

    expect(triageResult.next).toBe('scheduling');
    expect((state.profile as any).preferredSpecialty).toBe('neurologia');
    expect(computeHealthcareFiber(state).fiber).toBe(2);

    // Step 3: Scheduling — view and select slot
    state = {
      ...state,
      messages: [...state.messages, new HumanMessage('quero ver horarios')],
    };
    const schedulingResult1 = await findNode('scheduling')(state);
    state = applyResult(state, schedulingResult1);

    expect(schedulingResult1.next).toBe('scheduling');
    expect((state.domainData as any).availableSlots.length).toBeGreaterThan(0);

    // Select first slot
    state = {
      ...state,
      messages: [...state.messages, new HumanMessage('1')],
    };
    const schedulingResult2 = await findNode('scheduling')(state);
    state = applyResult(state, schedulingResult2);

    expect(schedulingResult2.next).toBe('confirmation');
    expect((state.domainData as any).selectedSlot).toBeDefined();

    // Step 4: Confirmation
    state = {
      ...state,
      messages: [...state.messages, new HumanMessage('sim, confirmo')],
    };
    const confirmResult = await findNode('confirmation')(state);
    state = applyResult(state, confirmResult);

    expect(confirmResult.next).toBe('__END__');
    expect((state.domainData as any).appointmentConfirmed).toBe(true);
    expect(computeHealthcareFiber(state).fiber).toBe(3);
  });

  it('handles rescheduling from confirmation', async () => {
    let state = makeInitialState();

    // Fast forward: name + specialty + slot selected
    state = {
      ...state,
      profile: { name: 'Ana', preferredSpecialty: 'dermatologia' },
      domainData: {
        selectedSlot: {
          id: 'slot-1',
          doctorName: 'Dra. Beatriz Costa',
          specialty: 'dermatologia',
          date: '2026-03-21',
          time: '08:00',
          location: 'Clinica Central — Sala 302',
          duration: 30,
        },
      },
    };

    // Reject and reschedule
    state = { ...state, messages: [new HumanMessage('nao, quero outro horario')] };
    const result = await findNode('confirmation')(state);

    expect(result.next).toBe('scheduling');
    expect((result.domainData as any).selectedSlot).toBeUndefined();
  });

  it('plugin is resolvable from domain registry', async () => {
    const { getDomain, listDomains } = await import('../../../../src/domain-registry');

    expect(listDomains()).toContain('healthcare');

    // Note: getDomain() uses env.DOMAIN_ID, so we just verify registration
    const domains = listDomains();
    expect(domains).toContain('automotive');
    expect(domains).toContain('healthcare');
  });

  it('fiber progresses monotonically in happy path', async () => {
    let state = makeInitialState();
    const fibers: number[] = [computeHealthcareFiber(state).fiber];

    // Greeting
    state = { ...state, messages: [new HumanMessage('me chamo Pedro')] };
    state = applyResult(state, await findNode('greeting')(state));
    fibers.push(computeHealthcareFiber(state).fiber);

    // Triage
    state = { ...state, messages: [...state.messages, new HumanMessage('preciso de cardiologia')] };
    state = applyResult(state, await findNode('triage')(state));
    fibers.push(computeHealthcareFiber(state).fiber);

    // Scheduling — view
    state = { ...state, messages: [...state.messages, new HumanMessage('ver horarios')] };
    state = applyResult(state, await findNode('scheduling')(state));

    // Scheduling — pick
    state = { ...state, messages: [...state.messages, new HumanMessage('1')] };
    state = applyResult(state, await findNode('scheduling')(state));

    // Confirmation
    state = { ...state, messages: [...state.messages, new HumanMessage('sim')] };
    state = applyResult(state, await findNode('confirmation')(state));
    fibers.push(computeHealthcareFiber(state).fiber);

    // Check monotonic progression
    for (let i = 1; i < fibers.length; i++) {
      expect(fibers[i]).toBeGreaterThanOrEqual(fibers[i - 1]);
    }
    expect(fibers[fibers.length - 1]).toBe(3);
  });
});
