import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Test connection (skip in unit tests)
if (process.env.NODE_ENV !== 'test') {
  prisma
    .$connect()
    .then(() => logger.info('✅ Database connected'))
    .catch(err => logger.error('❌ Database connection failed:', err));
}

export default prisma;
