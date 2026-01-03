
import { prisma } from '../lib/prisma';
import { cache } from '../lib/redis';
import { logger } from '../lib/logger';
import { ConversationState } from '../types/state.types';

export class SessionManagerService {
    /**
     * Get or create a conversation for a phone number
     */
    async getOrCreateConversation(phoneNumber: string) {
        // Check for existing active conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                phoneNumber,
                status: 'active',
            },
            orderBy: { startedAt: 'desc' },
        });

        if (!conversation) {
            // Create new conversation
            conversation = await prisma.conversation.create({
                data: {
                    phoneNumber,
                    status: 'active',
                    currentStep: 'greeting',
                },
            });

            // Log event
            await prisma.event.create({
                data: {
                    conversationId: conversation.id,
                    eventType: 'started',
                },
            });

            logger.info({ conversationId: conversation.id, phoneNumber }, 'New conversation created');
        }

        return conversation;
    }

    /**
     * Reset/clear conversation for a phone number
     */
    async resetConversation(phoneNumber: string): Promise<void> {
        try {
            // Find all conversations for this phone
            const conversations = await prisma.conversation.findMany({
                where: { phoneNumber },
            });

            // Clear cache for each conversation
            for (const conv of conversations) {
                const stateKey = `conversation:${conv.id}:state`;
                await cache.del(stateKey);
            }

            // Delete or mark conversations as closed
            await prisma.conversation.updateMany({
                where: {
                    phoneNumber,
                    status: 'active',
                },
                data: {
                    status: 'closed',
                    closedAt: new Date(),
                },
            });

            logger.info({ phoneNumber, count: conversations.length }, 'Conversation reset');
        } catch (error) {
            logger.error({ error, phoneNumber }, 'Error resetting conversation');
        }
    }

    /**
     * Initialize conversation state for new conversations
     */
    initializeState(conversationId: string, phoneNumber: string): ConversationState {
        return {
            conversationId,
            phoneNumber,
            messages: [],
            quiz: {
                currentQuestion: 1,
                progress: 0,
                answers: {},
                isComplete: false,
            },
            profile: {},
            recommendations: [],
            graph: {
                currentNode: 'greeting',
                nodeHistory: [],
                errorCount: 0,
                loopCount: 0,
            },
            metadata: {
                startedAt: new Date(),
                lastMessageAt: new Date(),
                flags: [],
            },
        };
    }

    /**
     * Load state from cache with hydration of Date objects
     */
    async loadState(conversationId: string): Promise<ConversationState | undefined> {
        const stateKey = `conversation:${conversationId}:state`;
        const cachedStateJson = await cache.get(stateKey);

        if (cachedStateJson) {
            try {
                const currentState = JSON.parse(cachedStateJson);
                // Restore Date objects
                if (currentState) {
                    currentState.metadata.startedAt = new Date(currentState.metadata.startedAt);
                    currentState.metadata.lastMessageAt = new Date(currentState.metadata.lastMessageAt);
                    currentState.messages = currentState.messages.map((msg: { timestamp: string | number | Date }) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp),
                    }));
                }
                return currentState;
            } catch (error) {
                logger.error({ error, conversationId }, 'Error parsing cached state');
            }
        }
        return undefined;
    }

    /**
     * Save state to cache
     */
    async saveState(conversationId: string, state: ConversationState): Promise<void> {
        const stateKey = `conversation:${conversationId}:state`;
        await cache.set(stateKey, JSON.stringify(state), 86400); // 24h TTL
    }
}

export const sessionManager = new SessionManagerService();
