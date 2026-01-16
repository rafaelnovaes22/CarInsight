/**
 * Integration Tests for MessageHandlerV2 Lead Creation Flow
 *
 * Tests the complete flow when a user requests handoff (vendedor)
 * and validates that leads are created correctly in the database.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { cache } from '../../src/lib/redis';
import { MessageHandlerV2 } from '../../src/services/message-handler-v2.service';
import { ConversationState } from '../../src/types/state.types';

// Mock LLM router to avoid real API calls
vi.mock('../../src/lib/llm-router', () => ({
    chatCompletion: vi.fn(async () => {
        return JSON.stringify({
            extracted: {},
            confidence: 0.9,
            reasoning: 'Mock response',
            fieldsExtracted: [],
        });
    }),
    resetCircuitBreaker: vi.fn(),
    getLLMProvidersStatus: vi.fn(() => []),
}));

// Mock WhatsApp service to avoid sending real messages
vi.mock('../../src/services/whatsapp-meta.service', () => ({
    WhatsAppMetaService: class {
        sendMessage = vi.fn().mockResolvedValue({ success: true });
    },
}));

// Track mock state for LangGraph
let mockLangGraphState: Partial<ConversationState> | null = null;

// Mock LangGraphConversation to control the flow
vi.mock('../../src/graph/langgraph-conversation', () => ({
    LangGraphConversation: class {
        async processMessage(
            _message: string,
            currentState: ConversationState
        ): Promise<{ newState: ConversationState; response: string }> {
            // Use the preset mock state if available, otherwise return current with handoff
            if (mockLangGraphState) {
                return {
                    newState: { ...currentState, ...mockLangGraphState } as ConversationState,
                    response: 'Vou conectar você com um vendedor.',
                };
            }

            // Default behavior: add handoff_requested flag
            return {
                newState: {
                    ...currentState,
                    metadata: {
                        ...currentState.metadata,
                        flags: [...(currentState.metadata?.flags || []), 'handoff_requested'],
                    },
                },
                response: 'Vou conectar você com um vendedor.',
            };
        }
    },
}));

// Mock feature flags
vi.mock('../../src/lib/feature-flags', () => ({
    featureFlags: {
        shouldUseConversationalMode: vi.fn(() => true),
        isEnabled: vi.fn(() => true),
    },
}));

describe('MessageHandlerV2 Lead Creation Flow', () => {
    let messageHandler: MessageHandlerV2;
    const TEST_PHONE = '5511999990001';

    beforeEach(async () => {
        messageHandler = new MessageHandlerV2();
        mockLangGraphState = null;

        // Clean up test data before each test
        await cleanupTestData(TEST_PHONE);
    });

    afterEach(async () => {
        // Clean up after each test
        await cleanupTestData(TEST_PHONE);
        vi.clearAllMocks();
        mockLangGraphState = null;
    });

    describe('Lead Creation on Handoff Request', () => {
        it('should create a lead when LangGraph sets handoff_requested flag', async () => {
            // Arrange: Set mock to return handoff_requested
            mockLangGraphState = {
                profile: {
                    budget: 80000,
                    bodyType: 'SUV',
                    usage: 'family',
                    customerName: 'João Test',
                },
                quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
                recommendations: [],
                graph: { currentNode: 'discovery', nodeHistory: [], errorCount: 0, loopCount: 0 },
                metadata: {
                    startedAt: new Date(),
                    lastMessageAt: new Date(),
                    flags: ['handoff_requested'],
                },
            };

            // Act: Send a message
            await messageHandler.handleMessage(TEST_PHONE, 'vendedor');

            // Assert: Check that lead was created
            const conversations = await prisma.conversation.findMany({
                where: { phoneNumber: TEST_PHONE },
            });

            expect(conversations.length).toBeGreaterThan(0);

            const lead = await prisma.lead.findFirst({
                where: { conversationId: conversations[0].id },
            });

            expect(lead).toBeTruthy();
            expect(lead?.phone).toBe(TEST_PHONE);
            expect(lead?.status).toBe('new');
            expect(lead?.source).toBe('whatsapp_bot');
        });

        it('should NOT create duplicate leads when lead_sent flag exists', async () => {
            // Arrange: Create conversation first
            const conversation = await prisma.conversation.create({
                data: {
                    phoneNumber: TEST_PHONE,
                    status: 'active',
                    currentStep: 'negotiation',
                },
            });

            // Create existing lead
            await prisma.lead.create({
                data: {
                    conversationId: conversation.id,
                    name: 'Existing Lead',
                    phone: TEST_PHONE,
                    status: 'new',
                    source: 'whatsapp_bot',
                },
            });

            // Setup state with lead_sent flag (prevents duplicate)
            const stateKey = `conversation:${conversation.id}:state`;
            const mockState: ConversationState = {
                conversationId: conversation.id,
                phoneNumber: TEST_PHONE,
                messages: [],
                quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
                profile: {},
                recommendations: [],
                graph: { currentNode: 'negotiation', nodeHistory: [], errorCount: 0, loopCount: 0 },
                metadata: {
                    startedAt: new Date(),
                    lastMessageAt: new Date(),
                    flags: ['handoff_requested', 'lead_sent'], // Already sent
                },
            };
            await cache.set(stateKey, JSON.stringify(mockState), 3600);

            // Mock LangGraph to return same state (lead_sent already there)
            mockLangGraphState = mockState;

            // Act
            await messageHandler.handleMessage(TEST_PHONE, 'vendedor');

            // Assert: Should still have only 1 lead
            const leads = await prisma.lead.findMany({
                where: { conversationId: conversation.id },
            });

            expect(leads).toHaveLength(1);
        });

        it('should include profile data in created lead', async () => {
            // Arrange: Set mock with rich profile data
            mockLangGraphState = {
                profile: {
                    budget: 100000,
                    usage: 'uber',
                    people: 4,
                    hasTradeIn: true,
                    urgency: '1 semana',
                    customerName: 'Maria Silva',
                },
                quiz: {
                    currentQuestion: 8,
                    progress: 100,
                    answers: {
                        budget: 100000,
                        usage: 'uber',
                        people: 4,
                    },
                    isComplete: true,
                },
                recommendations: [],
                graph: { currentNode: 'negotiation', nodeHistory: [], errorCount: 0, loopCount: 0 },
                metadata: {
                    startedAt: new Date(),
                    lastMessageAt: new Date(),
                    flags: ['handoff_requested'],
                },
            };

            // Act
            await messageHandler.handleMessage(TEST_PHONE, 'quero falar com vendedor');

            // Assert
            const conversation = await prisma.conversation.findFirst({
                where: { phoneNumber: TEST_PHONE },
            });

            const lead = await prisma.lead.findFirst({
                where: { conversationId: conversation?.id },
            });

            expect(lead).toBeTruthy();
            expect(lead?.budget).toBe(100000);
            expect(lead?.usage).toBe('uber');
            expect(lead?.people).toBe(4);
            expect(lead?.hasTradeIn).toBe(true);
            expect(lead?.urgency).toBe('1 semana');
        });
    });

    describe('Edge Cases', () => {
        it('should handle lead creation when profile is empty', async () => {
            // Arrange: Set mock with empty profile
            mockLangGraphState = {
                profile: {},
                quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
                recommendations: [],
                graph: { currentNode: 'discovery', nodeHistory: [], errorCount: 0, loopCount: 0 },
                metadata: {
                    startedAt: new Date(),
                    lastMessageAt: new Date(),
                    flags: ['handoff_requested'],
                },
            };

            // Act
            await messageHandler.handleMessage(TEST_PHONE, 'atendente');

            // Assert: Lead should still be created with default name
            const conversation = await prisma.conversation.findFirst({
                where: { phoneNumber: TEST_PHONE },
            });

            const lead = await prisma.lead.findFirst({
                where: { conversationId: conversation?.id },
            });

            expect(lead).toBeTruthy();
            expect(lead?.name).toBe('Cliente WhatsApp');
            expect(lead?.phone).toBe(TEST_PHONE);
        });
    });
});

/**
 * Helper function to clean up test data
 */
async function cleanupTestData(phoneNumber: string) {
    try {
        // Find all conversations for test phone
        const conversations = await prisma.conversation.findMany({
            where: { phoneNumber },
            select: { id: true },
        });

        const conversationIds = conversations.map(c => c.id);

        if (conversationIds.length > 0) {
            // Delete related data first (foreign key constraints)
            await prisma.lead.deleteMany({
                where: { conversationId: { in: conversationIds } },
            });

            await prisma.recommendation.deleteMany({
                where: { conversationId: { in: conversationIds } },
            });

            await prisma.message.deleteMany({
                where: { conversationId: { in: conversationIds } },
            });

            await prisma.event.deleteMany({
                where: { conversationId: { in: conversationIds } },
            });

            // Delete conversations
            await prisma.conversation.deleteMany({
                where: { phoneNumber },
            });
        }

        // Clear cache keys
        for (const conv of conversations) {
            await cache.del(`conversation:${conv.id}:state`);
        }
    } catch (error) {
        // Ignore cleanup errors
        console.log('Cleanup error (ignored):', error);
    }
}
