import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),

  // LLM Providers (com fallback automático)
  OPENAI_API_KEY: z.string().default('sk-mock-key-for-development'), // Primário para LLM e Embeddings
  GROQ_API_KEY: z.string().optional().default('gsk-mock-key-for-development'), // Fallback para LLM
  COHERE_API_KEY: z.string().optional(), // Fallback para Embeddings

  WHATSAPP_NAME: z.string().default('FaciliAuto'),
  CRM_WEBHOOK_URL: z.string().optional(),

  // Meta Cloud API (WhatsApp Business API Oficial)
  META_WHATSAPP_TOKEN: z.string().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default('faciliauto_webhook_2025'),

  // Feature Flags
  ENABLE_CONVERSATIONAL_MODE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  CONVERSATIONAL_ROLLOUT_PERCENTAGE: z.coerce.number().default(0), // 0-100

  // Audio Transcription
  ENABLE_AUDIO_TRANSCRIPTION: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  AUDIO_MAX_DURATION_SECONDS: z.coerce.number().default(120), // 2 minutes max
});

export const env = envSchema.parse(process.env);

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
