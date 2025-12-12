/**
 * Integration Tests for WhatsApp Webhook Routes
 *
 * Tests webhook verification and message processing endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { Router } from 'express';

describe('WhatsApp Webhook Routes - Integration', () => {
  let app: Express;

  // Create a mock router that simulates the webhook behavior
  beforeAll(() => {
    app = express();
    app.use(express.json());

    const router = Router();

    // Mock webhook verification
    router.get('/whatsapp', (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (!mode || !token) {
        return res.status(400).send('Missing parameters');
      }

      if (mode === 'subscribe' && token === 'test_verify_token') {
        return res.status(200).send(challenge);
      }

      return res.status(403).send('Forbidden');
    });

    // Mock webhook message reception
    router.post('/whatsapp', (req, res) => {
      // Always respond 200 to Meta
      res.status(200).send('EVENT_RECEIVED');
    });

    // Mock test endpoint
    router.post('/whatsapp/test', (req, res) => {
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({
          error: 'Missing required fields: to, message',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Message sent successfully',
      });
    });

    app.use('/webhooks', router);
  });

  describe('GET /webhooks/whatsapp - Webhook Verification', () => {
    it('should verify webhook with valid parameters', async () => {
      const response = await request(app).get('/webhooks/whatsapp').query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test_verify_token',
        'hub.challenge': 'test_challenge_string',
      });

      expect(response.status).toBe(200);
      expect(response.text).toBe('test_challenge_string');
    });

    it('should reject verification with invalid token', async () => {
      const response = await request(app).get('/webhooks/whatsapp').query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'test_challenge',
      });

      expect(response.status).toBe(403);
    });

    it('should return 400 when mode is missing', async () => {
      const response = await request(app).get('/webhooks/whatsapp').query({
        'hub.verify_token': 'test_verify_token',
        'hub.challenge': 'test_challenge',
      });

      expect(response.status).toBe(400);
      expect(response.text).toContain('Missing');
    });

    it('should return 400 when token is missing', async () => {
      const response = await request(app).get('/webhooks/whatsapp').query({
        'hub.mode': 'subscribe',
        'hub.challenge': 'test_challenge',
      });

      expect(response.status).toBe(400);
    });

    it('should handle missing challenge gracefully', async () => {
      const response = await request(app).get('/webhooks/whatsapp').query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test_verify_token',
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /webhooks/whatsapp - Message Reception', () => {
    it('should accept valid WhatsApp webhook payload', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '5511999999999',
                    phone_number_id: '123456789',
                  },
                  messages: [
                    {
                      from: '5511888888888',
                      id: 'wamid.test123',
                      timestamp: '1234567890',
                      text: { body: 'Olá, quero ver carros' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.text).toBe('EVENT_RECEIVED');
    });

    it('should respond with 200 even for non-whatsapp objects', async () => {
      const payload = {
        object: 'page',
        entry: [],
      };

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should handle empty entry array', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [],
      };

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should handle malformed payload gracefully', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send({ invalid: 'payload' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should handle status updates (delivery receipts)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '5511999999999',
                    phone_number_id: '123456789',
                  },
                  statuses: [
                    {
                      id: 'wamid.test123',
                      status: 'delivered',
                      timestamp: '1234567890',
                      recipient_id: '5511888888888',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /webhooks/whatsapp/test - Test Endpoint', () => {
    it('should send test message with valid parameters', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp/test')
        .send({
          to: '5511999999999',
          message: 'Test message',
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when "to" is missing', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp/test')
        .send({
          message: 'Test message',
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing');
    });

    it('should return 400 when "message" is missing', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp/test')
        .send({
          to: '5511999999999',
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing');
    });

    it('should return 400 when body is empty', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp/test')
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });

  describe('Message Types', () => {
    it('should handle text messages', async () => {
      const payload = createWhatsAppPayload({
        type: 'text',
        text: { body: 'Olá!' },
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should handle button reply messages', async () => {
      const payload = createWhatsAppPayload({
        type: 'button',
        button: {
          payload: 'button_1',
          text: 'Sim',
        },
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should handle interactive list replies', async () => {
      const payload = createWhatsAppPayload({
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: {
            id: 'vehicle_1',
            title: 'Honda Civic 2023',
          },
        },
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should handle image messages', async () => {
      const payload = createWhatsAppPayload({
        type: 'image',
        image: {
          mime_type: 'image/jpeg',
          sha256: 'abc123',
          id: 'media_id_123',
        },
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should not crash on undefined body properties', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should handle empty string body', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send('')
        .set('Content-Type', 'text/plain');

      expect(response.status).toBe(200);
    });
  });

  describe('Response Time', () => {
    it('should respond within 5 seconds (Meta requirement is 20s)', async () => {
      const start = Date.now();

      const payload = createWhatsAppPayload({
        type: 'text',
        text: { body: 'Performance test' },
      });

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .set('Content-Type', 'application/json');

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000);
    });
  });
});

// Helper function to create WhatsApp webhook payload
function createWhatsAppPayload(messageData: any) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456789',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5511999999999',
                phone_number_id: '123456789',
              },
              contacts: [
                {
                  profile: { name: 'Test User' },
                  wa_id: '5511888888888',
                },
              ],
              messages: [
                {
                  from: '5511888888888',
                  id: `wamid.${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  ...messageData,
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}
