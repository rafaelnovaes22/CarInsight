import { describe, expect, it } from 'vitest';
import { qualifyEvaluation, type LayerReport } from '../../../src/evaluation/eval-qualification';

const measured = (layer: string): LayerReport => ({
  layer,
  status: 'passed',
  gate: 'fixture',
  total: 2,
  passed: 2,
  failures: [],
});
const complete = (): LayerReport[] =>
  ['adversarial-input', 'recommendation', 'role-adherence'].map(measured);

describe('evaluation qualification', () => {
  it('requires every measured layer for production qualification', () => {
    expect(qualifyEvaluation(complete(), 'production')).toBe('PRODUCTION_QUALIFIED');
  });

  it('keeps the documented 70% recommendation threshold without accepting inconsistent evidence', () => {
    const layers = complete().map(report =>
      report.layer === 'recommendation'
        ? { ...report, total: 10, passed: 7, failures: ['a', 'b', 'c'] }
        : report
    );
    expect(qualifyEvaluation(layers, 'production')).toBe('PRODUCTION_QUALIFIED');
    layers[1].passed = 6;
    expect(qualifyEvaluation(layers, 'production')).toBe('HOLD');
  });

  it.each(['recommendation', 'role-adherence'])('holds when %s was skipped', layer => {
    const layers = complete().map(report =>
      report.layer === layer
        ? { ...report, status: 'skipped' as const, total: 0, passed: 0 }
        : report
    );
    expect(qualifyEvaluation(layers, 'production')).toBe('HOLD');
    expect(qualifyEvaluation(layers, 'offline')).toBe('OFFLINE_PASS');
  });

  it('holds for absent, duplicated, empty or failed evidence', () => {
    expect(qualifyEvaluation([], 'production')).toBe('HOLD');
    expect(qualifyEvaluation([...complete(), measured('recommendation')], 'production')).toBe(
      'HOLD'
    );
    expect(qualifyEvaluation([{ ...measured('adversarial-input'), total: 0 }], 'offline')).toBe(
      'HOLD'
    );
    expect(
      qualifyEvaluation([{ ...measured('adversarial-input'), status: 'failed' }], 'offline')
    ).toBe('HOLD');
  });
});
