import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\//i;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export function hasConfiguredDatabaseUrl(databaseUrl = process.env.DATABASE_URL): boolean {
  return typeof databaseUrl === 'string' && POSTGRES_URL_PATTERN.test(databaseUrl.trim());
}

export async function pingDatabase(): Promise<boolean> {
  if (!hasConfiguredDatabaseUrl()) {
    return false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Test connection (skip in unit tests)
if (process.env.NODE_ENV !== 'test' && hasConfiguredDatabaseUrl()) {
  prisma
    .$connect()
    .then(() => logger.info('Database connected'))
    .catch(err => logger.error('Database connection failed:', err));
}

export default prisma;
