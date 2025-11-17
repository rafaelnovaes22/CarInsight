import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().default('sk-mock-key-for-development'), // Mantido para compatibilidade
  GROQ_API_KEY: z.string().optional().default('gsk-mock-key-for-development'),
  WHATSAPP_NAME: z.string().default('FaciliAuto'),
  CRM_WEBHOOK_URL: z.string().optional(),
  
  // Meta Cloud API (WhatsApp Business API Oficial)
  META_WHATSAPP_TOKEN: z.string().optional(),
  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default('faciliauto_webhook_2025'),
});

export const env = envSchema.parse(process.env);

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
