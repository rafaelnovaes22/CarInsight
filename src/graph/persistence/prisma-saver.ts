import {
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointTuple,
    SerializerProtocol,
    CheckpointListOptions,
    PendingWrite
} from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";

export class PrismaCheckpointer extends BaseCheckpointSaver {
    constructor() {
        super();
    }

    async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
        const thread_id = config.configurable?.thread_id;
        const checkpoint_ns = config.configurable?.checkpoint_ns || ""; // Default namespace

        if (!thread_id) return undefined;

        try {
            // Find the latest checkpoint for this thread
            const record = await prisma.langGraphCheckpoint.findFirst({
                where: {
                    thread_id,
                    checkpoint_ns
                },
                orderBy: { updatedAt: 'desc' } // Get latest
            });

            if (!record) return undefined;

            // Extract checkpoint data
            const checkpoint: Checkpoint = record.checkpoint as any;
            const metadata = record.metadata as any;
            const parentConfig = record.parent_checkpoint_id ? {
                configurable: {
                    thread_id,
                    checkpoint_ns,
                    checkpoint_id: record.parent_checkpoint_id
                }
            } : undefined;

            return {
                config: {
                    configurable: {
                        thread_id,
                        checkpoint_ns,
                        checkpoint_id: record.checkpoint_id,
                    }
                },
                checkpoint,
                metadata,
                parentConfig
            };
        } catch (err) {
            logger.error({ err }, "Error getting checkpoint tuple");
            return undefined;
        }
    }

    async put(
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: Record<string, any>,
        newVersions: Record<string, any>
    ): Promise<RunnableConfig> {
        const thread_id = config.configurable?.thread_id;
        const checkpoint_ns = config.configurable?.checkpoint_ns || "";

        if (!thread_id) return config;

        try {
            await prisma.langGraphCheckpoint.create({
                data: {
                    thread_id,
                    checkpoint_ns,
                    checkpoint_id: checkpoint.id,
                    parent_checkpoint_id: config.configurable?.checkpoint_id,
                    type: 'checkpoint',
                    checkpoint: checkpoint as any,
                    metadata: metadata || {}
                }
            });
        } catch (err) {
            logger.error({ err }, "Error saving checkpoint");
        }

        return {
            configurable: {
                thread_id,
                checkpoint_ns,
                checkpoint_id: checkpoint.id,
            },
        };
    }

    async putWrites(
        config: RunnableConfig,
        writes: PendingWrite[],
        taskId: string
    ): Promise<void> {
        // TODO: Implement writes persistence (blobs) if needed for advanced features.
        // For basic conversational persistence, main checkpoint is usually enough.
    }

    async *list(
        config: RunnableConfig,
        options?: CheckpointListOptions
    ): AsyncGenerator<CheckpointTuple> {
        // Basic implementation - returning empty for now as listing history isn't critical for MVP flow
        // A full implementation would query prisma.langGraphCheckpoint.findMany
        yield* [];
    }
}
