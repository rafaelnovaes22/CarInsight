import crypto from 'crypto';
import express, { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type EnvOverrides = {
  META_APP_SECRET?: string;
  META_WEBHOOK_VERIFY_TOKEN?: string;
  ENABLE_WEBHOOK_TEST_ENDPOINT?: boolean;
  SEED_SECRET?: string;
};

async function createTestApp(envOverrides: EnvOverrides = {}) {
  vi.resetModules();

  const verifyWebhookMock = vi.fn((mode: string, token: string, challenge: string) => {
    if (
      mode === 'subscribe' &&
      token === (envOverrides.META_WEBHOOK_VERIFY_TOKEN || 'test-verify-token')
    ) {
      return challenge;
    }
    return null;
  });
  const processWebhookMock = vi.fn().mockResolvedValue(undefined);
  const sendMessageMock = vi.fn().mockResolvedValue(undefined);

  vi.doMock('../../src/config/env', () => {
    const mockedEnv = {
      NODE_ENV: 'test',
      PORT: 3001,
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      META_APP_SECRET: envOverrides.META_APP_SECRET || 'meta-app-secret',
      META_WEBHOOK_VERIFY_TOKEN: envOverrides.META_WEBHOOK_VERIFY_TOKEN || 'test-verify-token',
      ENABLE_WEBHOOK_TEST_ENDPOINT: envOverrides.ENABLE_WEBHOOK_TEST_ENDPOINT || false,
      SEED_SECRET: envOverrides.SEED_SECRET || 'test-admin-secret',
    };

    return {
      env: mockedEnv,
      isDev: false,
      isProd: false,
    };
  });

  vi.doMock('../../src/services/whatsapp-meta.service', () => {
    class MockWhatsAppMetaService {
      verifyWebhook = verifyWebhookMock;
      processWebhook = processWebhookMock;
      sendMessage = sendMessageMock;
    }

    return {
      default: MockWhatsAppMetaService,
    };
  });

  const { default: webhookRoutes } = await import('../../src/routes/webhook.routes');

  const app: Express = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use('/webhooks', webhookRoutes);

  return {
    app,
    verifyWebhookMock,
    processWebhookMock,
    sendMessageMock,
    appSecret: envOverrides.META_APP_SECRET || 'meta-app-secret',
  };
}

function signPayload(payload: unknown, secret: string): string {
  const rawBody = JSON.stringify(payload);
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

describe('Webhook Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies webhook on GET with valid token', async () => {
    const { app } = await createTestApp();
    const response = await request(app).get('/webhooks/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': 'abc123',
    });

    expect(response.status).toBe(200);
    expect(response.text).toBe('abc123');
  });

  it('rejects GET verification with invalid token', async () => {
    const { app } = await createTestApp();
    const response = await request(app).get('/webhooks/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'invalid-token',
      'hub.challenge': 'abc123',
    });

    expect(response.status).toBe(403);
  });

  it('rejects POST webhook with invalid signature', async () => {
    const { app, processWebhookMock } = await createTestApp();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '1', changes: [] }],
    };

    const response = await request(app)
      .post('/webhooks/whatsapp')
      .set('x-hub-signature-256', 'sha256=invalid')
      .send(payload);

    expect(response.status).toBe(403);
    expect(processWebhookMock).not.toHaveBeenCalled();
  });

  it('accepts POST webhook with valid signature and processes payload', async () => {
    const { app, processWebhookMock, appSecret } = await createTestApp();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{ id: '1', changes: [{ field: 'messages', value: {} }] }],
    };

    const signature = signPayload(payload, appSecret);

    const response = await request(app)
      .post('/webhooks/whatsapp')
      .set('x-hub-signature-256', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.text).toBe('EVENT_RECEIVED');
    expect(processWebhookMock).toHaveBeenCalledTimes(1);
    expect(processWebhookMock).toHaveBeenCalledWith(payload);
  });

  it('keeps /whatsapp/test disabled by default', async () => {
    const { app, sendMessageMock } = await createTestApp({
      ENABLE_WEBHOOK_TEST_ENDPOINT: false,
    });

    const response = await request(app).post('/webhooks/whatsapp/test').send({
      to: '5511999999999',
      message: 'test',
    });

    expect(response.status).toBe(404);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('requires admin secret on /whatsapp/test when enabled', async () => {
    const { app, sendMessageMock } = await createTestApp({
      ENABLE_WEBHOOK_TEST_ENDPOINT: true,
      SEED_SECRET: 'secret-123',
    });

    const response = await request(app).post('/webhooks/whatsapp/test').send({
      to: '5511999999999',
      message: 'test',
    });

    expect(response.status).toBe(403);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('sends test message with valid admin secret when enabled', async () => {
    const { app, sendMessageMock } = await createTestApp({
      ENABLE_WEBHOOK_TEST_ENDPOINT: true,
      SEED_SECRET: 'secret-123',
    });

    const response = await request(app)
      .post('/webhooks/whatsapp/test')
      .set('x-admin-secret', 'secret-123')
      .send({
        to: '5511999999999',
        message: 'test',
      });

    expect(response.status).toBe(200);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith('5511999999999', 'test');
  });
});
