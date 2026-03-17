/**
 * Healthcare Fiber — Unit Tests
 *
 * Tests fiber computation and guard checks.
 */

import { describe, it, expect } from 'vitest';
import {
  computeHealthcareFiber,
  checkHealthcareGuard,
} from '../../../../src/domains/healthcare/fiber';
import type { IGenericGraphState } from '../../../../src/core/types';

function makeState(overrides: Partial<IGenericGraphState> = {}): IGenericGraphState {
  return {
    messages: [],
    phoneNumber: '',
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

describe('computeHealthcareFiber', () => {
  it('returns fiber 0 for empty state', () => {
    const result = computeHealthcareFiber(makeState());
    expect(result.fiber).toBe(0);
    expect(result.label).toBe('Contato Inicial');
    expect(result.missingForNext).toContain('name');
  });

  it('returns fiber 1 when name is collected', () => {
    const result = computeHealthcareFiber(makeState({ profile: { name: 'Maria' } }));
    expect(result.fiber).toBe(1);
    expect(result.label).toBe('Triagem');
    expect(result.missingForNext).toContain('preferredSpecialty');
  });

  it('returns fiber 1 with partial completeness when symptoms exist', () => {
    const result = computeHealthcareFiber(
      makeState({ profile: { name: 'Maria', symptoms: ['febre'] } })
    );
    expect(result.fiber).toBe(1);
    expect(result.completeness).toBe(0.5);
  });

  it('returns fiber 2 when specialty is defined', () => {
    const result = computeHealthcareFiber(
      makeState({ profile: { name: 'Maria', preferredSpecialty: 'cardiologia' } })
    );
    expect(result.fiber).toBe(2);
    expect(result.label).toBe('Agendamento');
    expect(result.missingForNext).toContain('selectedSlot');
  });

  it('returns fiber 3 when slot is selected and confirmed', () => {
    const result = computeHealthcareFiber(
      makeState({
        profile: { name: 'Maria', preferredSpecialty: 'cardiologia' },
        domainData: {
          selectedSlot: {
            id: 'slot-1',
            doctorName: 'Dr. X',
            specialty: 'cardiologia',
            date: '2026-03-20',
            time: '09:00',
            location: 'Sala 1',
            duration: 30,
          },
          appointmentConfirmed: true,
        },
      })
    );
    expect(result.fiber).toBe(3);
    expect(result.label).toBe('Confirmacao');
    expect(result.completeness).toBe(1.0);
  });

  it('stays at fiber 2 if slot selected but not confirmed', () => {
    const result = computeHealthcareFiber(
      makeState({
        profile: { name: 'Maria', preferredSpecialty: 'cardiologia' },
        domainData: {
          selectedSlot: {
            id: 'slot-1',
            doctorName: 'Dr. X',
            specialty: 'cardiologia',
            date: '2026-03-20',
            time: '09:00',
            location: 'Sala 1',
            duration: 30,
          },
        },
      })
    );
    expect(result.fiber).toBe(2);
  });
});

describe('checkHealthcareGuard', () => {
  it('allows greeting at fiber 0', () => {
    const state = makeState();
    expect(checkHealthcareGuard(state, 'greeting')).toBeNull();
  });

  it('blocks triage at fiber 0', () => {
    const state = makeState();
    expect(checkHealthcareGuard(state, 'triage')).not.toBeNull();
  });

  it('allows triage at fiber 1', () => {
    const state = makeState({ profile: { name: 'Maria' } });
    expect(checkHealthcareGuard(state, 'triage')).toBeNull();
  });

  it('blocks scheduling at fiber 1', () => {
    const state = makeState({ profile: { name: 'Maria' } });
    expect(checkHealthcareGuard(state, 'scheduling')).not.toBeNull();
  });

  it('allows scheduling at fiber 2', () => {
    const state = makeState({ profile: { name: 'Maria', preferredSpecialty: 'cardiologia' } });
    expect(checkHealthcareGuard(state, 'scheduling')).toBeNull();
  });

  it('allows regression from confirmation to scheduling', () => {
    const state = makeState({ profile: { name: 'Maria', preferredSpecialty: 'cardiologia' } });
    expect(checkHealthcareGuard(state, 'scheduling', 'confirmation')).toBeNull();
  });

  it('allows unknown nodes', () => {
    const state = makeState();
    expect(checkHealthcareGuard(state, 'unknown_node')).toBeNull();
  });
});
