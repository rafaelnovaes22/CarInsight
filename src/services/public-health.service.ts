import { hasConfiguredDatabaseUrl, pingDatabase } from '../lib/prisma';
import { isRedisConnected } from '../lib/redis';
import { inMemoryVectorStore, type VectorStoreHealth } from './in-memory-vector.service';

export type PublicHealthStatus = 'ok' | 'degraded' | 'unhealthy';

interface PublicHealthDependencies {
  databaseConfigured: boolean;
  databaseHealthy: boolean;
  redisConfigured: boolean;
  redisConnected: boolean;
  vectorHealth: VectorStoreHealth;
}

export interface PublicHealthSnapshot {
  status: PublicHealthStatus;
  httpStatus: number;
  checks: {
    database: {
      configured: boolean;
      status: 'ok' | 'error' | 'unconfigured';
    };
    redis: {
      configured: boolean;
      mode: 'redis' | 'memory';
      status: 'ok' | 'degraded' | 'unconfigured';
    };
    vectorStore: VectorStoreHealth;
  };
}

export async function getPublicHealthSnapshot(
  overrides: Partial<PublicHealthDependencies> = {}
): Promise<PublicHealthSnapshot> {
  const databaseConfigured = overrides.databaseConfigured ?? hasConfiguredDatabaseUrl();
  const databaseHealthy =
    overrides.databaseHealthy ?? (databaseConfigured ? await pingDatabase() : false);
  const redisConfigured = overrides.redisConfigured ?? Boolean(process.env.REDIS_URL);
  const redisConnected = overrides.redisConnected ?? isRedisConnected();
  const vectorHealth = overrides.vectorHealth ?? inMemoryVectorStore.getHealth();

  const databaseStatus = !databaseConfigured ? 'unconfigured' : databaseHealthy ? 'ok' : 'error';
  const redisStatus = !redisConfigured ? 'unconfigured' : redisConnected ? 'ok' : 'degraded';

  let status: PublicHealthStatus = 'ok';

  if (!databaseHealthy) {
    status = 'unhealthy';
  } else if (redisStatus === 'degraded' || vectorHealth.status !== 'ok') {
    status = 'degraded';
  }

  return {
    status,
    httpStatus: status === 'unhealthy' ? 503 : 200,
    checks: {
      database: {
        configured: databaseConfigured,
        status: databaseStatus,
      },
      redis: {
        configured: redisConfigured,
        mode: redisConfigured ? 'redis' : 'memory',
        status: redisStatus,
      },
      vectorStore: vectorHealth,
    },
  };
}
