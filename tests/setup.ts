import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente para testes
// .env.test tem prioridade para garantir configurações de teste
dotenv.config({ path: '.env.test', override: true });
// Fallback para .env se .env.test não existir
dotenv.config({ path: '.env' });

// Flag para indicar se o banco está disponível
let databaseAvailable = false;
let prismaInstance: any = null;

// Setup global antes de todos os testes
beforeAll(async () => {
  console.log('🚀 Iniciando setup de testes...');
  
  // Garantir que estamos em ambiente de teste
  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }

  // Tentar conectar ao banco de teste (opcional)
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl && (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://'))) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      prismaInstance = new PrismaClient({
        datasources: {
          db: { url: databaseUrl },
        },
      });
      await prismaInstance.$connect();
      databaseAvailable = true;
      console.log('✅ Conectado ao banco de teste');
    } catch (error) {
      console.warn('⚠️  Banco de dados não disponível - testes que precisam de DB serão pulados');
      databaseAvailable = false;
    }
  } else {
    console.log('ℹ️  DATABASE_URL não configurada - executando testes sem banco de dados');
    databaseAvailable = false;
  }
});

// Cleanup após todos os testes
afterAll(async () => {
  console.log('🧹 Limpando ambiente de teste...');
  
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
      console.log('✅ Desconectado do banco de teste');
    } catch (error) {
      // Ignorar erro de desconexão
    }
  }
});

// Limpar dados antes de cada teste (opcional)
beforeEach(async () => {
  // Limpeza opcional se banco disponível
});

afterEach(async () => {
  // Cleanup adicional se necessário
});

// Helper para verificar se banco está disponível
export function isDatabaseAvailable(): boolean {
  return databaseAvailable;
}

// Helper para obter instância do Prisma (se disponível)
export function getPrisma() {
  if (!prismaInstance) {
    throw new Error('Banco de dados não está disponível para este teste');
  }
  return prismaInstance;
}

// Helper para resetar banco entre testes
export async function resetDatabase() {
  if (!databaseAvailable || !prismaInstance) {
    console.warn('⚠️  Banco não disponível para reset');
    return;
  }
  
  const tables = ['Message', 'Recommendation', 'Event', 'Lead', 'Conversation', 'Vehicle'];
  
  for (const table of tables) {
    try {
      await prismaInstance.$executeRawUnsafe(`DELETE FROM "${table}";`);
    } catch (error) {
      // Tabela pode não existir
    }
  }
}

// Helper para criar dados de teste
export async function seedTestData() {
  if (!databaseAvailable) {
    console.warn('⚠️  Banco não disponível para seed');
    return;
  }
  console.log('🌱 Seed de dados de teste');
}

// Export prisma para compatibilidade (pode ser null)
export { prismaInstance as prisma };
