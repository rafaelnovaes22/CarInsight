/**
 * Property-Based Tests and Unit Tests for Audio Message Persistence
 * 
 * **Feature: audio-message-support, Property 6: Audio message persistence includes metadata**
 * **Validates: Requirements 5.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Hoist mock functions to avoid initialization issues
const {
    mockMessageCreate,
    mockConversationFindFirst,
    mockConversationCreate,
    mockConversationUpdate,
    mockEventCreate,
    mockRecommendationCreate,
} = vi.hoisted(() => ({
    mockMessageCreate: vi.fn(),
    mockConversationFindFirst: vi.fn(),
    mockConversationCreate: vi.fn(),
    mockConversationUpdate: vi.fn(),
    mockEventCreate: vi.fn(),
    mockRecommendationCreate: vi.fn(),
}));

// Mock Prisma before importing the service
vi.mock('../../src/lib/prisma', () => ({
    prisma: {
        message: {
            create: mockMessageCreate,
        },
        conversation: {
            findFirst: mockConversationFindFirst,
            create: mockConversationCreate,
            update: mockConversationUpdate,
            updateMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
        },
        event: {
            create: mockEventCreate,
        },
        recommendation: {
            create: mockRecommendationCreate,
        },
    },
}));

// Mock Redis cache
vi.mock('../../src/lib/redis', () => ({
    cache: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
    },
}));

// Mock logger
vi.mock('../../src/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock guardrails
vi.mock('../../src/services/guardrails.service', () => ({
    guardrails: {
        validateInput: vi.fn().mockReturnValue({ allowed: true, sanitizedInput: null }),
        validateOutput: vi.fn().mockReturnValue({ allowed: true }),
    },
}));

// Mock conversation graph
vi.mock('../../src/graph/conversation-graph', () => ({
    conversationGraph: {
        invoke: vi.fn(),
        getLastResponse: vi.fn().mockReturnValue('Bot response'),
    },
}));

// Mock langgraph conversation
vi.mock('../../src/graph/langgraph-conversation', () => ({
    langGraphConversation: {
        processMessage: vi.fn().mockResolvedValue({
            newState: {
                conversationId: 'test-conv-id',
                phoneNumber: '5511999999999',
                messages: [],
                quiz: { currentQuestion: 1, progress: 0, answers: {}, isComplete: false },
                profile: {},
                recommendations: [],
                graph: { currentNode: 'greeting', nodeHistory: [], errorCount: 0, loopCount: 0 },
                metadata: { startedAt: new Date(), lastMessageAt: new Date(), flags: [] },
            },
            response: 'Bot response',
        }),
    },
}));

// Mock data rights service
vi.mock('../../src/services/data-rights.service', () => ({
    dataRightsService: {
        hasUserData: vi.fn().mockResolvedValue(false),
        deleteUserData: vi.fn().mockResolvedValue(true),
        exportUserData: vi.fn().mockResolvedValue({ totalRegistros: 0, mensagens: [], recomendacoes: [] }),
    },
}));

// Mock feature flags
vi.mock('../../src/lib/feature-flags', () => ({
    featureFlags: {
        shouldUseConversationalMode: vi.fn().mockReturnValue(true),
        isEnabled: vi.fn().mockReturnValue(true),
    },
}));

// Mock conversational handler
vi.mock('../../src/services/conversational-handler.service', () => ({
    conversationalHandler: {},
}));

import { MessageHandlerV2 } from '../../src/services/message-handler-v2.service';

/**
 * Generator for valid media IDs (alphanumeric strings)
 */
const mediaIdGenerator = fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/);

/**
 * Generator for valid phone numbers
 */
const phoneNumberGenerator = fc.stringMatching(/^[0-9]{10,15}$/);

/**
 * Generator for message content (non-command text)
 */
const messageContentGenerator = fc.string({ minLength: 5, maxLength: 200 })
    .filter(s => {
        const lower = s.toLowerCase().trim();
        // Exclude commands that would trigger special handling
        const commands = ['sair', 'encerrar', 'tchau', 'bye', 'adeus', 'reiniciar',
            'recomeçar', 'voltar', 'cancelar', 'reset', 'nova busca',
            'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'hello', 'hi',
            'deletar meus dados', 'excluir meus dados', 'remover meus dados', 'apagar meus dados',
            'exportar meus dados', 'baixar meus dados', 'meus dados'];
        return !commands.some(cmd => lower.includes(cmd) || lower === cmd || lower.startsWith(cmd + ' '));
    });

describe('Audio Message Persistence Property Tests', () => {
    let handler: MessageHandlerV2;
    const mockConversation = {
        id: 'test-conv-id',
        phoneNumber: '5511999999999',
        status: 'active',
        currentStep: 'greeting',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        mockConversationFindFirst.mockResolvedValue(mockConversation);
        mockConversationCreate.mockResolvedValue(mockConversation);
        mockConversationUpdate.mockResolvedValue(mockConversation);
        mockMessageCreate.mockResolvedValue({ id: 'msg-id' });
        mockEventCreate.mockResolvedValue({ id: 'event-id' });

        handler = new MessageHandlerV2();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * **Feature: audio-message-support, Property 6: Audio message persistence includes metadata**
     * **Validates: Requirements 5.4**
     * 
     * *For any* successfully transcribed audio message stored in the database, 
     * the message record SHALL have messageType='audio_transcription' and include the original mediaId.
     */
    describe('Property 6: Audio message persistence includes metadata', () => {
        it('for any audio message with mediaId, the stored message has messageType=audio_transcription and includes originalMediaId', async () => {
            await fc.assert(
                fc.asyncProperty(
                    phoneNumberGenerator,
                    messageContentGenerator,
                    mediaIdGenerator,
                    async (phoneNumber, messageContent, mediaId) => {
                        // Reset mocks for each iteration
                        mockMessageCreate.mockClear();
                        mockConversationFindFirst.mockResolvedValue({
                            ...mockConversation,
                            phoneNumber,
                        });

                        // Call handleMessage with audio options
                        await handler.handleMessage(phoneNumber, messageContent, { mediaId });

                        // Find the incoming message creation call
                        const incomingMessageCall = mockMessageCreate.mock.calls.find(
                            (call: any[]) => call[0]?.data?.direction === 'incoming'
                        );

                        expect(incomingMessageCall).toBeDefined();

                        const messageData = incomingMessageCall![0].data;

                        // Verify messageType is 'audio_transcription'
                        expect(messageData.messageType).toBe('audio_transcription');

                        // Verify originalMediaId is set to the provided mediaId
                        expect(messageData.originalMediaId).toBe(mediaId);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('for any text message without mediaId, the stored message has messageType=text and no originalMediaId', async () => {
            await fc.assert(
                fc.asyncProperty(
                    phoneNumberGenerator,
                    messageContentGenerator,
                    async (phoneNumber, messageContent) => {
                        // Reset mocks for each iteration
                        mockMessageCreate.mockClear();
                        mockConversationFindFirst.mockResolvedValue({
                            ...mockConversation,
                            phoneNumber,
                        });

                        // Call handleMessage without audio options
                        await handler.handleMessage(phoneNumber, messageContent);

                        // Find the incoming message creation call
                        const incomingMessageCall = mockMessageCreate.mock.calls.find(
                            (call: any[]) => call[0]?.data?.direction === 'incoming'
                        );

                        expect(incomingMessageCall).toBeDefined();

                        const messageData = incomingMessageCall![0].data;

                        // Verify messageType is 'text'
                        expect(messageData.messageType).toBe('text');

                        // Verify originalMediaId is undefined
                        expect(messageData.originalMediaId).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('audio message mediaId is preserved exactly as provided', async () => {
            await fc.assert(
                fc.asyncProperty(
                    mediaIdGenerator,
                    async (mediaId) => {
                        mockMessageCreate.mockClear();
                        mockConversationFindFirst.mockResolvedValue(mockConversation);

                        await handler.handleMessage('5511999999999', 'test message content here', { mediaId });

                        const incomingMessageCall = mockMessageCreate.mock.calls.find(
                            (call: any[]) => call[0]?.data?.direction === 'incoming'
                        );

                        expect(incomingMessageCall).toBeDefined();

                        // The mediaId should be exactly preserved (no transformation)
                        expect(incomingMessageCall![0].data.originalMediaId).toBe(mediaId);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});


/**
 * Unit Tests for Audio Message Persistence
 * **Validates: Requirements 5.4**
 */
describe('Audio Message Persistence Unit Tests', () => {
    let handler: MessageHandlerV2;
    const mockConversation = {
        id: 'test-conv-id',
        phoneNumber: '5511999999999',
        status: 'active',
        currentStep: 'greeting',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        mockConversationFindFirst.mockResolvedValue(mockConversation);
        mockConversationCreate.mockResolvedValue(mockConversation);
        mockConversationUpdate.mockResolvedValue(mockConversation);
        mockMessageCreate.mockResolvedValue({ id: 'msg-id' });
        mockEventCreate.mockResolvedValue({ id: 'event-id' });

        handler = new MessageHandlerV2();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Audio message stored with correct type', () => {
        it('stores audio message with messageType=audio_transcription', async () => {
            const mediaId = 'test-media-id-12345';

            await handler.handleMessage('5511999999999', 'transcribed audio content', { mediaId });

            // Find the incoming message creation call
            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.messageType).toBe('audio_transcription');
        });

        it('stores text message with messageType=text when no audio options', async () => {
            await handler.handleMessage('5511999999999', 'regular text message');

            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.messageType).toBe('text');
        });

        it('stores text message with messageType=text when audio options is empty object', async () => {
            await handler.handleMessage('5511999999999', 'regular text message', {});

            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.messageType).toBe('text');
            expect(incomingMessageCall![0].data.originalMediaId).toBeUndefined();
        });
    });

    describe('MediaId is preserved', () => {
        it('stores the exact mediaId provided in audio options', async () => {
            const mediaId = 'exact-media-id-abc123xyz';

            await handler.handleMessage('5511999999999', 'transcribed content', { mediaId });

            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.originalMediaId).toBe(mediaId);
        });

        it('does not set originalMediaId for text messages', async () => {
            await handler.handleMessage('5511999999999', 'regular text message');

            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.originalMediaId).toBeUndefined();
        });

        it('handles long mediaId values correctly', async () => {
            const longMediaId = 'a'.repeat(100);

            await handler.handleMessage('5511999999999', 'transcribed content', { mediaId: longMediaId });

            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.originalMediaId).toBe(longMediaId);
        });

        it('handles mediaId with special characters correctly', async () => {
            const specialMediaId = 'media_id-123.456';

            await handler.handleMessage('5511999999999', 'transcribed content', { mediaId: specialMediaId });

            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.originalMediaId).toBe(specialMediaId);
        });
    });

    describe('Message content is preserved', () => {
        it('stores the transcribed content correctly for audio messages', async () => {
            // Use content that doesn't trigger special handlers (greetings, commands, etc.)
            const transcribedContent = 'Quero ver carros disponíveis na loja';
            const mediaId = 'test-media-id';

            await handler.handleMessage('5511999999999', transcribedContent, { mediaId });

            const incomingMessageCall = mockMessageCreate.mock.calls.find(
                (call: any[]) => call[0]?.data?.direction === 'incoming'
            );

            expect(incomingMessageCall).toBeDefined();
            expect(incomingMessageCall![0].data.content).toBe(transcribedContent);
        });
    });
});
