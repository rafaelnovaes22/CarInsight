/**
 * Healthcare Plugin — Contract Tests
 *
 * Verifies that the healthcare plugin implements the DomainPlugin interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { healthcareDomainPlugin } from '../../../../src/domains/healthcare';

describe('Healthcare Domain Plugin', () => {
  it('has correct identity', () => {
    expect(healthcareDomainPlugin.id).toBe('healthcare');
    expect(healthcareDomainPlugin.name).toBe('ClinicInsight — Assistente de Agendamento');
    expect(healthcareDomainPlugin.version).toBe('0.1.0');
  });

  it('has 4 nodes', () => {
    expect(healthcareDomainPlugin.nodes).toHaveLength(4);
    const names = healthcareDomainPlugin.nodes.map(n => n.name);
    expect(names).toEqual(['greeting', 'triage', 'scheduling', 'confirmation']);
  });

  it('has greeting as entry point', () => {
    expect(healthcareDomainPlugin.entryPoint).toBe('greeting');
  });

  it('has a route resolver', () => {
    expect(typeof healthcareDomainPlugin.routeResolver).toBe('function');
  });

  it('route resolver maps known nodes', () => {
    const resolve = healthcareDomainPlugin.routeResolver;
    const state = healthcareDomainPlugin.createInitialState();

    expect(resolve({ ...state, next: 'greeting' } as any)).toBe('greeting');
    expect(resolve({ ...state, next: 'triage' } as any)).toBe('triage');
    expect(resolve({ ...state, next: 'scheduling' } as any)).toBe('scheduling');
    expect(resolve({ ...state, next: 'confirmation' } as any)).toBe('confirmation');
    expect(resolve({ ...state, next: '__END__' } as any)).toBe('__END__');
    expect(resolve({ ...state, next: 'handoff' } as any)).toBe('__END__');
  });

  it('route resolver defaults to greeting for unknown nodes', () => {
    const resolve = healthcareDomainPlugin.routeResolver;
    const state = healthcareDomainPlugin.createInitialState();
    expect(resolve({ ...state, next: 'unknown_node' } as any)).toBe('greeting');
  });

  it('has fiber definition with 4 phases', () => {
    expect(healthcareDomainPlugin.fiberDefinition.phases).toHaveLength(4);
    expect(healthcareDomainPlugin.fiberDefinition.phases.map(p => p.id)).toEqual([0, 1, 2, 3]);
  });

  it('createInitialProfile returns empty object', () => {
    expect(healthcareDomainPlugin.createInitialProfile()).toEqual({});
  });

  it('createInitialState returns valid state', () => {
    const state = healthcareDomainPlugin.createInitialState();
    expect(state.messages).toEqual([]);
    expect(state.next).toBe('greeting');
    expect(state.metadata).toBeDefined();
    expect(state.domainData).toEqual({});
  });

  it('has system prompts', () => {
    expect(healthcareDomainPlugin.systemPrompts.main).toBeDefined();
    expect(typeof healthcareDomainPlugin.systemPrompts.main).toBe('string');
  });

  it('has disclosure messages', () => {
    expect(healthcareDomainPlugin.disclosureMessages.greeting).toBeDefined();
    expect(healthcareDomainPlugin.disclosureMessages.handoff).toBeDefined();
    expect(healthcareDomainPlugin.disclosureMessages.aiDisclaimer).toBeDefined();
  });

  it('has exit and welcome responses', () => {
    expect(typeof healthcareDomainPlugin.exitResponse).toBe('string');
    expect(typeof healthcareDomainPlugin.welcomeResponse).toBe('string');
  });

  it('has a search adapter', () => {
    expect(healthcareDomainPlugin.searchAdapter).toBeDefined();
    expect(typeof healthcareDomainPlugin.searchAdapter.search).toBe('function');
    expect(typeof healthcareDomainPlugin.searchAdapter.getById).toBe('function');
  });
});
