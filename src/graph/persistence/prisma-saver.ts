import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointTuple,
  CheckpointListOptions,
  PendingWrite,
} from '@langchain/langgraph-checkpoint';
import { RunnableConfig } from '@langchain/core/runnables';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export class PrismaCheckpointer extends BaseCheckpointSaver {
  constructor() {
    super();
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns || ''; // Default namespace

    if (!thread_id) {
      return undefined;
    }

    const dbCheckpoint = await prisma.langGraphCheckpoint.findFirst({
      where: {
        thread_id: thread_id,
        checkpoint_ns: checkpoint_ns,
      },
      orderBy: {
        checkpoint_id: 'desc', // Uses string sort, might need better versioning logic if strictly required by langgraph
      },
    });

    if (!dbCheckpoint) {
      return undefined;
    }

    try {
      return {
        config,
        checkpoint: dbCheckpoint.checkpoint as any,
        metadata: dbCheckpoint.metadata ? (dbCheckpoint.metadata as any) : undefined,
        parentConfig: dbCheckpoint.parent_checkpoint_id
          ? {
              configurable: {
                thread_id,
                checkpoint_ns,
                checkpoint_id: dbCheckpoint.parent_checkpoint_id,
              },
            }
          : undefined,
      };
    } catch (error) {
      logger.error({ error, thread_id }, 'Error parsing checkpoint from DB');
      return undefined;
    }
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns || '';

    if (!thread_id) {
      return;
    }

    const checkpoints = await prisma.langGraphCheckpoint.findMany({
      where: {
        thread_id: thread_id,
        checkpoint_ns: checkpoint_ns,
      },
      orderBy: {
        checkpoint_id: 'desc',
      },
      take: options?.limit,
    });

    for (const cp of checkpoints) {
      try {
        yield {
          config: { configurable: { thread_id, checkpoint_ns, checkpoint_id: cp.checkpoint_id } },
          checkpoint: cp.checkpoint as any,
          metadata: cp.metadata ? (cp.metadata as any) : undefined,
          parentConfig: cp.parent_checkpoint_id
            ? {
                configurable: {
                  thread_id,
                  checkpoint_ns,
                  checkpoint_id: cp.parent_checkpoint_id,
                },
              }
            : undefined,
        };
      } catch (error) {
        logger.error({ error, thread_id }, 'Error iterating checkpoints');
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: Record<string, any>,
    newVersions: Record<string, string | number>
  ): Promise<RunnableConfig> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_ns = config.configurable?.checkpoint_ns || '';
    const checkpoint_id = checkpoint.id;
    const parent_checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id) {
      throw new Error('Missing thread_id in config');
    }

    try {
      // Save to Prisma
      await prisma.langGraphCheckpoint.create({
        data: {
          thread_id: thread_id,
          checkpoint_ns: checkpoint_ns,
          checkpoint_id: checkpoint_id,
          parent_checkpoint_id: parent_checkpoint_id,
          checkpoint: checkpoint as any,
          metadata: metadata as any,
          type: 'checkpoint',
        },
      });

      return {
        configurable: {
          thread_id,
          checkpoint_ns,
          checkpoint_id,
        },
      };
    } catch (error) {
      logger.error({ error, thread_id }, 'Error saving checkpoint');
      throw error;
    }
  }

  // Use 'any' to bypass strict signature mismatch if necessary, or match the exact signature expected by BaseCheckpointSaver
  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    // Not strictly implemented for MVP
  }

  // Required by BaseCheckpointSaver in newer @langchain/langgraph versions
  // Signature might vary slightly by version, using 'any' for config to be safe
  async deleteThread(threadId: string): Promise<void> {
    if (threadId) {
      await prisma.langGraphCheckpoint.deleteMany({
        where: { thread_id: threadId },
      });
    }
  }
}
