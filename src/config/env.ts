import dotenv from 'dotenv';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  // DATABASE_URL is required in dev/prod, but tests can run without a database.
  DATABASE_URL: z.string().optional(),

  // LLM Providers (com fallback automatico)
  OPENAI_API_KEY: z.string().default('sk-mock-key-for-development'),
  GROQ_API_KEY: z.string().optional().default('gsk-mock-key-for-development'),
  GEMINI_API_KEY: z.string().optional().default('gemini-mock-key'),
  COHERE_API_KEY: z.string().optional(),

  WHATSAPP_NAME: z.string().default('CarInsight'),
  CRM_WEBHOOK_URL: z.string().optional(),

  // Meta Cloud API (WhatsApp Business API oficial)
  META_WHATSAPP_TOKEN: z.string().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default('faciliauto_webhook_2025'),
  SEED_SECRET: z.string().optional(),
  ENABLE_WEBHOOK_TEST_ENDPOINT: z
    .string()
    .default('false')
    .transform(val => val === 'true'),

  // Evolution API
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE_NAME: z.string().default('carinsight'),

  // Redis configuration
  REDIS_URL: z.string().optional(),
  REDIS_RATE_LIMIT_TTL: z.coerce.number().default(60),

  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // Feature flags
  ENABLE_CONVERSATIONAL_MODE: z
    .string()
    .default('true')
    .transform(val => val === 'true'),
  CONVERSATIONAL_ROLLOUT_PERCENTAGE: z.coerce.number().default(100),
  USE_SLM_EXPLANATIONS: z
    .string()
    .default('false')
    .transform(val => val === 'true'),
  SLM_EXPLANATIONS_ROLLOUT_PERCENTAGE: z.coerce.number().default(0),

  // Emotional selling & conversion
  ENABLE_EMOTIONAL_SELLING: z
    .string()
    .default('false')
    .transform(val => val === 'true'),
  ENABLE_FOLLOW_UP: z
    .string()
    .default('false')
    .transform(val => val === 'true'),
  ENABLE_RETENTION: z
    .string()
    .default('false')
    .transform(val => val === 'true'),

  // Audio transcription
  ENABLE_AUDIO_TRANSCRIPTION: z
    .string()
    .default('true')
    .transform(val => val === 'true'),
  AUDIO_MAX_DURATION_SECONDS: z.coerce.number().default(120),

  // Observability (LangSmith)
  LANGCHAIN_TRACING_V2: z.string().optional().default('false'),
  LANGCHAIN_ENDPOINT: z.string().optional().default('https://api.smith.langchain.com'),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional().default('carinsight-prod'),
});

const parsed = envSchema.parse(process.env);

if (parsed.DATABASE_URL) {
  parsed.DATABASE_URL = parsed.DATABASE_URL.trim();
}

if (!parsed.DATABASE_URL && parsed.NODE_ENV !== 'test') {
  throw new Error('DATABASE_URL is required');
}

if (parsed.DATABASE_URL) {
  process.env.DATABASE_URL = parsed.DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}

export const env = parsed;

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
