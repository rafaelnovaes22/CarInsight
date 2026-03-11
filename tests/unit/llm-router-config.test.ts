import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, originalEnv);
}

async function importRouter() {
  vi.resetModules();
  vi.doMock('../../src/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));

  return import('../../src/lib/llm-router');
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
  vi.clearAllMocks();
});

describe('LLM Router provider detection', () => {
  it('disables providers when placeholder keys are configured', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OPENAI_API_KEY = 'sk-mock-key-for-development';
    process.env.GROQ_API_KEY = 'gsk-mock-key-for-development';
    process.env.GEMINI_API_KEY = 'gemini-mock-key';

    const { chatCompletion, getLLMProvidersStatus } = await importRouter();
    const providers = getLLMProvidersStatus();

    expect(providers.find(provider => provider.name === 'openai')?.enabled).toBe(false);
    expect(providers.find(provider => provider.name === 'groq')?.enabled).toBe(false);
    expect(providers.find(provider => provider.name === 'gemini')?.enabled).toBe(false);

    const result = await chatCompletion([
      { role: 'system', content: 'Teste' },
      { role: 'user', content: 'Ola' },
    ]);

    expect(result.model).toBe('mock');
  });

  it('enables providers when realistic provider keys are configured', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OPENAI_API_KEY = 'sk-proj-valid-openai-key-1234567890';
    process.env.GROQ_API_KEY = 'gsk_valid_groq_key_1234567890abcdefghijkl';
    process.env.GEMINI_API_KEY = 'AIzaSyValidGeminiKey1234567890';

    const { getLLMProvidersStatus } = await importRouter();
    const providers = getLLMProvidersStatus();

    expect(providers.find(provider => provider.name === 'openai')?.enabled).toBe(true);
    expect(providers.find(provider => provider.name === 'groq')?.enabled).toBe(true);
    expect(providers.find(provider => provider.name === 'gemini')?.enabled).toBe(true);
  });
});
