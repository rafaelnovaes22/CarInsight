/**
 * Testes de masking de PII em log (LGPD / ISO 42001 Anexo A.7)
 *
 * Cobre RSK-003 e o fechamento do GAP-001: antes o masking cobria apenas
 * telefone, preservando 6 digitos (DDI + DDD + 2), o que ainda identificava
 * regiao e parte do numero.
 */

import { describe, it, expect } from 'vitest';
import { maskPhoneNumber, maskEmail, maskName, maskSensitiveFields } from '../../src/lib/privacy';

describe('maskPhoneNumber', () => {
  it('preserva apenas DDI e DDD', () => {
    expect(maskPhoneNumber('5511949105033')).toBe('5511****');
  });

  it('nao vaza os digitos finais do numero', () => {
    expect(maskPhoneNumber('5511949105033')).not.toContain('9105033');
  });

  it('trata nulo, vazio e indefinido como unknown', () => {
    expect(maskPhoneNumber(null)).toBe('unknown');
    expect(maskPhoneNumber(undefined)).toBe('unknown');
    expect(maskPhoneNumber('   ')).toBe('unknown');
  });

  it('mascara por completo numero curto demais para preservar prefixo', () => {
    expect(maskPhoneNumber('1234')).toBe('****');
  });
});

describe('maskEmail', () => {
  it('preserva a primeira letra e o dominio', () => {
    expect(maskEmail('rafael@exemplo.com')).toBe('r***@exemplo.com');
  });

  it('nao vaza o usuario completo', () => {
    expect(maskEmail('rafaeldenovaes@gmail.com')).not.toContain('rafaeldenovaes');
  });

  it('mascara valor sem arroba', () => {
    expect(maskEmail('nao-e-email')).toBe('****');
  });

  it('trata nulo como unknown', () => {
    expect(maskEmail(null)).toBe('unknown');
  });
});

describe('maskName', () => {
  it('preserva o primeiro nome e mascara os sobrenomes', () => {
    expect(maskName('Rafael de Novaes')).toBe('Rafael *** ***');
  });

  it('mantem nome unico, que sozinho identifica pouco', () => {
    expect(maskName('Rafael')).toBe('Rafael');
  });

  it('trata nulo e vazio', () => {
    expect(maskName(null)).toBe('unknown');
    expect(maskName('  ')).toBe('unknown');
  });
});

describe('maskSensitiveFields', () => {
  it('mascara telefone, email e nome de um objeto de log', () => {
    const result = maskSensitiveFields({
      phoneNumber: '5511949105033',
      email: 'rafael@exemplo.com',
      name: 'Rafael de Novaes',
      vehicleId: 'abc-123',
    });

    expect(result).toEqual({
      phoneNumber: '5511****',
      email: 'r***@exemplo.com',
      name: 'Rafael *** ***',
      vehicleId: 'abc-123',
    });
  });

  it('mascara em objeto aninhado', () => {
    const result = maskSensitiveFields({
      lead: { phone: '5511949105033', name: 'Rafael de Novaes' },
    }) as { lead: { phone: string; name: string } };

    expect(result.lead.phone).toBe('5511****');
    expect(result.lead.name).toBe('Rafael *** ***');
  });

  it('mascara dentro de array', () => {
    const result = maskSensitiveFields([{ phone: '5511949105033' }]) as Array<{ phone: string }>;

    expect(result[0].phone).toBe('5511****');
  });

  it('preserva campos nao sensiveis e valores primitivos', () => {
    expect(maskSensitiveFields('texto')).toBe('texto');
    expect(maskSensitiveFields(42)).toBe(42);
    expect(maskSensitiveFields(null)).toBe(null);
    expect(maskSensitiveFields({ count: 3 })).toEqual({ count: 3 });
  });
});
