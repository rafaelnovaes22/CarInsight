import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as dotenv from 'dotenv';

process.env.NODE_ENV = 'test';

const protectedTestKeys = new Set([
  'DATABASE_URL',
  'REDIS_URL',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'COHERE_API_KEY',
  'META_WHATSAPP_TOKEN',
  'META_WHATSAPP_PHONE_NUMBER_ID',
  'META_WHATSAPP_BUSINESS_ACCOUNT_ID',
  'META_APP_SECRET',
]);

function loadEnvFile(fileName: string): Record<string, string> {
  const filePath = resolve(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(readFileSync(filePath));
}

const baseEnv = loadEnvFile('.env');
const testEnv = loadEnvFile('.env.test');
const mergedEnv: Record<string, string> = { ...baseEnv, ...testEnv };

for (const key of protectedTestKeys) {
  if (testEnv[key] === undefined) {
    delete mergedEnv[key];
  }
}

for (const [key, value] of Object.entries(mergedEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// Flag para indicar se o banco esta disponivel
let databaseAvailable = false;
let prismaInstance: any = null;

// Setup global antes de todos os testes
beforeAll(async () => {
  console.log('Iniciando setup de testes...');

  // Tentar conectar ao banco de teste (opcional)
  const databaseUrl = process.env.DATABASE_URL;

  if (
    databaseUrl &&
    (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://'))
  ) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      prismaInstance = new PrismaClient({
        datasources: {
          db: { url: databaseUrl },
        },
      });
      await prismaInstance.$connect();
      databaseAvailable = true;
      console.log('Conectado ao banco de teste');
    } catch {
      console.warn('Banco de dados nao disponivel - testes que precisam de DB serao pulados');
      databaseAvailable = false;
    }
  } else {
    console.log('DATABASE_URL nao configurada - executando testes sem banco de dados');
    databaseAvailable = false;
  }
});

// Cleanup apos todos os testes
afterAll(async () => {
  console.log('Limpando ambiente de teste...');

  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
      console.log('Desconectado do banco de teste');
    } catch {
      // Ignorar erro de desconexao
    }
  }
});

// Limpar dados antes de cada teste (opcional)
beforeEach(async () => {
  // Limpeza opcional se banco disponivel
});

afterEach(async () => {
  // Cleanup adicional se necessario
});

// Helper para verificar se banco esta disponivel
export function isDatabaseAvailable(): boolean {
  return databaseAvailable;
}

// Helper para obter instancia do Prisma (se disponivel)
export function getPrisma() {
  if (!prismaInstance) {
    throw new Error('Banco de dados nao esta disponivel para este teste');
  }
  return prismaInstance;
}

// Helper para resetar banco entre testes
export async function resetDatabase() {
  if (!databaseAvailable || !prismaInstance) {
    console.warn('Banco nao disponivel para reset');
    return;
  }

  const tables = ['Message', 'Recommendation', 'Event', 'Lead', 'Conversation', 'Vehicle'];

  for (const table of tables) {
    try {
      await prismaInstance.$executeRawUnsafe(`DELETE FROM "${table}";`);
    } catch {
      // Tabela pode nao existir
    }
  }
}

// Helper para criar dados de teste
export async function seedTestData() {
  if (!databaseAvailable) {
    console.warn('Banco nao disponivel para seed');
    return;
  }

  console.log('Seed de dados de teste');
}

// Export prisma para compatibilidade (pode ser null)
export { prismaInstance as prisma };
