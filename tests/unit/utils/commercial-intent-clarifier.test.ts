import { describe, expect, it } from 'vitest';
import {
  buildCommercialClarificationResponse,
  detectAmbiguousCommercialIntent,
  shouldClarifyCommercialReply,
} from '../../../src/utils/commercial-intent-clarifier';

describe('commercial-intent-clarifier', () => {
  it('detects a typo close to vendedor', () => {
    const result = detectAmbiguousCommercialIntent('Vendedoe');

    expect(result?.action).toBe('vendedor');
    expect(result?.confidence).toBeGreaterThan(0.8);
  });

  it('does not flag an exact commercial keyword as ambiguous', () => {
    expect(detectAmbiguousCommercialIntent('vendedor')).toBeNull();
  });

  it('suggests clarification for short unclear commercial replies', () => {
    expect(shouldClarifyCommercialReply('venddo')).toBe(true);
    expect(shouldClarifyCommercialReply('oi')).toBe(false);
  });

  it('builds a vendedor confirmation message', () => {
    const message = buildCommercialClarificationResponse('vendedor', 'RENAULT CAPTUR 2019');

    expect(message).toContain('quis dizer');
    expect(message).toContain('vendedor');
    expect(message).toContain('RENAULT CAPTUR 2019');
  });
});
