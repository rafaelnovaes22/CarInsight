import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasConfiguredDatabaseUrl, pingDatabase } from '../../../src/lib/prisma';
import { isRedisConnected } from '../../../src/lib/redis';
import { inMemoryVectorStore } from '../../../src/services/in-memory-vector.service';
import { getPublicHealthSnapshot } from '../../../src/services/public-health.service';

vi.mock('../../../src/lib/prisma', () => ({
  hasConfiguredDatabaseUrl: vi.fn(),
  pingDatabase: vi.fn(),
}));

vi.mock('../../../src/lib/redis', () => ({
  isRedisConnected: vi.fn(),
}));

vi.mock('../../../src/services/in-memory-vector.service', () => ({
  inMemoryVectorStore: {
    getHealth: vi.fn(),
  },
}));

describe('PublicHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;

    (hasConfiguredDatabaseUrl as any).mockReturnValue(true);
    (pingDatabase as any).mockResolvedValue(true);
    (isRedisConnected as any).mockReturnValue(false);
    (inMemoryVectorStore.getHealth as any).mockReturnValue({
      status: 'ok',
      initialized: true,
      initializing: false,
      embeddings: 42,
    });
  });

  it('returns unhealthy when the database is not configured', async () => {
    (hasConfiguredDatabaseUrl as any).mockReturnValue(false);

    const health = await getPublicHealthSnapshot();

    expect(health.status).toBe('unhealthy');
    expect(health.httpStatus).toBe(503);
    expect(health.checks.database).toEqual({
      configured: false,
      status: 'unconfigured',
    });
  });

  it('returns degraded while the vector store is warming up', async () => {
    (inMemoryVectorStore.getHealth as any).mockReturnValue({
      status: 'warming_up',
      initialized: false,
      initializing: true,
      embeddings: 0,
    });

    const health = await getPublicHealthSnapshot();

    expect(health.status).toBe('degraded');
    expect(health.httpStatus).toBe(200);
    expect(health.checks.redis.status).toBe('unconfigured');
    expect(health.checks.vectorStore.status).toBe('warming_up');
  });

  it('returns degraded when redis is configured but disconnected', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    const health = await getPublicHealthSnapshot();

    expect(health.status).toBe('degraded');
    expect(health.httpStatus).toBe(200);
    expect(health.checks.redis).toEqual({
      configured: true,
      mode: 'redis',
      status: 'degraded',
    });
  });

  it('returns ok when all dependencies are healthy', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    (isRedisConnected as any).mockReturnValue(true);

    const health = await getPublicHealthSnapshot();

    expect(health.status).toBe('ok');
    expect(health.httpStatus).toBe(200);
    expect(health.checks.database.status).toBe('ok');
    expect(health.checks.redis.status).toBe('ok');
    expect(health.checks.vectorStore.status).toBe('ok');
  });
});
