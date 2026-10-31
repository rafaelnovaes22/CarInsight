import { afterEach, describe, expect, it, vi } from 'vitest';

// POLICY_LINK depende de PUBLIC_BASE_URL, lido uma vez no import de env.ts.
// Por isso cada teste recarrega os módulos com o ambiente desejado.
async function loadPolicyLink(publicBaseUrl: string | undefined): Promise<string> {
  vi.resetModules();
  if (publicBaseUrl === undefined) {
    delete process.env.PUBLIC_BASE_URL;
  } else {
    process.env.PUBLIC_BASE_URL = publicBaseUrl;
  }
  const { DISCLOSURE_MESSAGES } = await import('../../../src/config/disclosure.messages');
  return DISCLOSURE_MESSAGES.PRIVACY.POLICY_LINK;
}

describe('POLICY_LINK', () => {
  afterEach(() => {
    delete process.env.PUBLIC_BASE_URL;
    vi.resetModules();
  });

  it('aponta para /privacy-policy do próprio bot quando PUBLIC_BASE_URL está definida', async () => {
    const link = await loadPolicyLink('https://bot.inovais.tech');

    expect(link).toBe('Nossa política de privacidade: https://bot.inovais.tech/privacy-policy');
  });

  it('remove a barra final da base antes de montar o caminho', async () => {
    const link = await loadPolicyLink('https://bot.inovais.tech/');

    expect(link).toContain('https://bot.inovais.tech/privacy-policy');
    expect(link).not.toContain('//privacy-policy');
  });

  it('não envia URL quebrada quando a base pública não está configurada', async () => {
    const link = await loadPolicyLink(undefined);

    expect(link).not.toContain('http');
    expect(link).toContain('disponível mediante solicitação');
  });
});
