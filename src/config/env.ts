import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  // DATABASE_URL is required in dev/prod, but unit tests run without a database.
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // LLM Providers (com fallback automático)
  OPENAI_API_KEY: z.string().default('sk-mock-key-for-development'), // Primário para LLM e Embeddings
  GROQ_API_KEY: z.string().optional().default('gsk-mock-key-for-development'), // Fallback para LLM
  COHERE_API_KEY: z.string().optional(), // Fallback para Embeddings

  WHATSAPP_NAME: z.string().default('CarInsight'),
  CRM_WEBHOOK_URL: z.string().optional(),

  // Meta Cloud API (WhatsApp Business API Oficial)
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

  // Evolution API (Alternative WhatsApp Gateway)
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE_NAME: z.string().default('carinsight'),

  // Feature Flags
  ENABLE_CONVERSATIONAL_MODE: z
    .string()
    .default('true') // Enabled by default after migration
    .transform(val => val === 'true'),
  CONVERSATIONAL_ROLLOUT_PERCENTAGE: z.coerce.number().default(100), // 100% rollout
  USE_SLM_EXPLANATIONS: z
    .string()
    .default('false')
    .transform(val => val === 'true'),
  SLM_EXPLANATIONS_ROLLOUT_PERCENTAGE: z.coerce.number().default(0),

  // Audio Transcription
  ENABLE_AUDIO_TRANSCRIPTION: z
    .string()
    .default('true')
    .transform(val => val === 'true'),
  AUDIO_MAX_DURATION_SECONDS: z.coerce.number().default(120), // 2 minutes max

  // Observability (LangSmith)
  LANGCHAIN_TRACING_V2: z.string().optional().default('false'),
  LANGCHAIN_ENDPOINT: z.string().optional().default('https://api.smith.langchain.com'),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional().default('carinsight-prod'),
});

const parsed = envSchema.parse(process.env);

// Ensure DATABASE_URL exists outside of tests
if (!parsed.DATABASE_URL) {
  if (parsed.NODE_ENV === 'test') {
    parsed.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  } else {
    throw new Error('DATABASE_URL is required');
  }
}

// Keep process.env consistent for libraries (e.g., Prisma) that read from it
process.env.DATABASE_URL = parsed.DATABASE_URL;

export const env = parsed as z.infer<typeof envSchema> & { DATABASE_URL: string };

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
