import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env', () => ({
  env: {
    ENABLE_AUDIO_TRANSCRIPTION: true,
    AUDIO_MAX_DURATION_SECONDS: 120,
    META_WHATSAPP_TOKEN: 'mock-token',
    META_WHATSAPP_PHONE_NUMBER_ID: 'mock-phone-id',
    META_WEBHOOK_VERIFY_TOKEN: 'mock-verify-token',
    GROQ_API_KEY: 'mock-groq-key',
    NODE_ENV: 'test',
  },
  isDev: false,
  isProd: false,
}));

vi.mock('axios');

const { mockLoggerInfo, mockLoggerError, mockLoggerWarn, mockLoggerDebug } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock('../../src/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
  },
}));

const { mockHandleMessage, mockTranscribeFromMediaId, mockIsEnabled } = vi.hoisted(() => ({
  mockHandleMessage: vi.fn(),
  mockTranscribeFromMediaId: vi.fn(),
  mockIsEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('../../src/services/message-handler-v2.service', () => ({
  MessageHandlerV2: class {
    handleMessage = mockHandleMessage;
  },
}));

vi.mock('../../src/services/audio-transcription.service', () => ({
  AudioTranscriptionService: class {
    transcribeFromMediaId = mockTranscribeFromMediaId;
    isEnabled = mockIsEnabled;
  },
  TranscriptionResult: {},
}));

import axios from 'axios';
import { cache } from '../../src/lib/redis';
import { WhatsAppMetaService } from '../../src/services/whatsapp-meta.service';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function clearInMemoryCache(): Promise<void> {
  const keys = await cache.keys('*');
  await Promise.all(keys.map(key => cache.del(key)));
}

function buildTextWebhook(messageId: string, phoneNumber: string, text: string) {
  return {
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5511999999999',
                phone_number_id: 'mock-phone-id',
              },
              contacts: [
                {
                  profile: { name: 'Rafael' },
                  wa_id: phoneNumber,
                },
              ],
              messages: [
                {
                  from: phoneNumber,
                  id: messageId,
                  timestamp: '1710000000',
                  text: { body: text },
                  type: 'text',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('WhatsApp Concurrency E2E', () => {
  const mockedAxios = vi.mocked(axios);
  let service: WhatsAppMetaService;

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearInMemoryCache();
    mockedAxios.post = vi.fn().mockResolvedValue({ data: { messages: [{ id: 'meta-msg-id' }] } });
    service = new WhatsAppMetaService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes messages from the same phone number to avoid race conditions', async () => {
    const firstStarted = createDeferred<void>();
    const releaseFirst = createDeferred<void>();
    const secondStarted = createDeferred<void>();
    const events: string[] = [];

    mockHandleMessage.mockImplementation(async (_phoneNumber: string, message: string) => {
      if (message === 'primeira') {
        events.push('start:first');
        firstStarted.resolve();
        await releaseFirst.promise;
        events.push('finish:first');
        return 'resposta-1';
      }

      if (message === 'segunda') {
        events.push('start:second');
        secondStarted.resolve();
        events.push('finish:second');
        return 'resposta-2';
      }

      return 'fallback';
    });

    const firstPayload = buildTextWebhook('wamid.first', '5511912345678', 'primeira');
    const secondPayload = buildTextWebhook('wamid.second', '5511912345678', 'segunda');

    const firstRun = service.processWebhook(firstPayload as any);
    await firstStarted.promise;

    const secondRun = service.processWebhook(secondPayload as any);

    const secondStatus = await Promise.race([
      secondStarted.promise.then(() => 'started'),
      new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 50)),
    ]);

    expect(secondStatus).toBe('pending');
    expect(events).toEqual(['start:first']);

    releaseFirst.resolve();

    await Promise.all([firstRun, secondRun]);

    expect(events).toEqual(['start:first', 'finish:first', 'start:second', 'finish:second']);

    const sentBodies = mockedAxios.post.mock.calls
      .map(call => call[1])
      .filter((payload: any) => payload?.text?.body)
      .map((payload: any) => payload.text.body);

    expect(sentBodies).toEqual(['resposta-1', 'resposta-2']);
  });
});
