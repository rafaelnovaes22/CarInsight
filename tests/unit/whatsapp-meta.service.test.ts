/**
 * Property-Based Tests and Unit Tests for WhatsAppMetaService Audio Handling
 * 
 * Tests for audio message support functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock dependencies before importing the service
vi.mock('../../src/config/env', () => ({
    env: {
        ENABLE_AUDIO_TRANSCRIPTION: true,
        AUDIO_MAX_DURATION_SECONDS: 120,
        META_WHATSAPP_TOKEN: 'mock-token',
        META_WHATSAPP_PHONE_NUMBER_ID: 'mock-phone-id',
        META_WEBHOOK_VERIFY_TOKEN: 'mock-verify-token',
        GROQ_API_KEY: 'mock-groq-key',
        NODE_ENV: 'test',
    },
    isDev: false,
    isProd: false,
}));

// Mock axios
vi.mock('axios');

// Mock logger
const { mockLoggerInfo, mockLoggerError, mockLoggerWarn, mockLoggerDebug } = vi.hoisted(() => ({
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerDebug: vi.fn(),
}));

vi.mock('../../src/lib/logger', () => ({
    logger: {
        info: mockLoggerInfo,
        error: mockLoggerError,
        warn: mockLoggerWarn,
        debug: mockLoggerDebug,
    },
}));

// Hoist mock functions
const { mockHandleMessage, mockTranscribeFromMediaId, mockIsEnabled } = vi.hoisted(() => ({
    mockHandleMessage: vi.fn(),
    mockTranscribeFromMediaId: vi.fn(),
    mockIsEnabled: vi.fn().mockReturnValue(true),
}));

// Mock MessageHandlerV2
vi.mock('../../src/services/message-handler-v2.service', () => {
    return {
        MessageHandlerV2: class {
            handleMessage = mockHandleMessage;
        },
    };
});

// Mock AudioTranscriptionService
vi.mock('../../src/services/audio-transcription.service', () => {
    return {
        AudioTranscriptionService: class {
            transcribeFromMediaId = mockTranscribeFromMediaId;
            isEnabled = mockIsEnabled;
        },
        TranscriptionResult: {},
    };
});

import { WhatsAppMetaService } from '../../src/services/whatsapp-meta.service';
import axios from 'axios';

/**
 * Generator for valid media IDs (alphanumeric strings)
 */
const mediaIdGenerator = fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/);

/**
 * Generator for valid phone numbers
 */
const phoneNumberGenerator = fc.stringMatching(/^[0-9]{10,15}$/);

/**
 * Generator for message IDs
 */
const messageIdGenerator = fc.stringMatching(/^wamid\.[a-zA-Z0-9]{20,40}$/);

/**
 * Generator for transcription text
 */
const transcriptionTextGenerator = fc.string({ minLength: 1, maxLength: 500 })
    .filter(s => s.trim().length > 0);

/**
 * Generator for timestamps (numeric strings)
 */
const timestampGenerator = fc.integer({ min: 1000000000, max: 9999999999 }).map(n => n.toString());

/**
 * Generator for valid audio webhook messages
 */
const audioMessageGenerator = fc.record({
    from: phoneNumberGenerator,
    id: messageIdGenerator,
    timestamp: timestampGenerator,
    audio: fc.record({
        id: mediaIdGenerator,
        mime_type: fc.constantFrom('audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/opus'),
    }),
    type: fc.constant('audio' as const),
});

/**
 * Generator for error codes
 */
const errorCodeGenerator = fc.constantFrom(
    'DOWNLOAD_FAILED',
    'TRANSCRIPTION_FAILED',
    'DURATION_EXCEEDED',
    'LOW_QUALITY',
    'DISABLED'
);


describe('WhatsAppMetaService Audio Handling', () => {
    let service: WhatsAppMetaService;
    const mockedAxios = vi.mocked(axios);

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock axios.post for sendMessage and markMessageAsRead
        mockedAxios.post = vi.fn().mockResolvedValue({ data: { messages: [{ id: 'msg-id' }] } });
        service = new WhatsAppMetaService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * **Feature: audio-message-support, Property 1: Audio message parsing extracts media_id**
     * **Validates: Requirements 1.1**
     */
    describe('Property 1: Audio message parsing extracts media_id', () => {
        it('for any valid audio webhook payload, the service correctly extracts the media_id', async () => {
            await fc.assert(
                fc.asyncProperty(audioMessageGenerator, async (audioMessage) => {
                    // Reset mocks
                    vi.clearAllMocks();
                    mockedAxios.post = vi.fn().mockResolvedValue({ data: { messages: [{ id: 'msg-id' }] } });

                    // Mock successful transcription
                    mockTranscribeFromMediaId.mockResolvedValue({
                        success: true,
                        text: 'Transcribed text',
                        duration: 10,
                        language: 'pt',
                    });

                    // Mock message handler response
                    mockHandleMessage.mockResolvedValue('Bot response');

                    const newService = new WhatsAppMetaService();
                    await newService.handleAudioMessage(audioMessage as any);

                    // Verify transcribeFromMediaId was called with the correct media_id
                    expect(mockTranscribeFromMediaId).toHaveBeenCalledWith(audioMessage.audio.id);
                }),
                { numRuns: 100 }
            );
        });

        it('audio messages without media_id are handled gracefully', async () => {
            const messageWithoutMediaId = {
                from: '5511999999999',
                id: 'wamid.test123456789012345678901234567890',
                timestamp: '1234567890',
                audio: undefined,
                type: 'audio' as const,
            };

            await service.handleAudioMessage(messageWithoutMediaId as any);

            // Should not attempt transcription
            expect(mockTranscribeFromMediaId).not.toHaveBeenCalled();
            // Should log error
            expect(mockLoggerError).toHaveBeenCalled();
        });
    });

    /**
     * **Feature: audio-message-support, Property 2: Audio transcription round-trip produces response**
     * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
     */
    describe('Property 2: Audio transcription round-trip produces response', () => {
        it('for any audio message with successful transcription, the system produces a response', async () => {
            await fc.assert(
                fc.asyncProperty(
                    audioMessageGenerator,
                    transcriptionTextGenerator,
                    fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
                    async (audioMessage, transcribedText, botResponse) => {
                        // Reset mocks
                        vi.clearAllMocks();
                        mockedAxios.post = vi.fn().mockResolvedValue({ data: { messages: [{ id: 'msg-id' }] } });

                        // Mock successful transcription
                        mockTranscribeFromMediaId.mockResolvedValue({
                            success: true,
                            text: transcribedText,
                            duration: 10,
                            language: 'pt',
                        });

                        // Mock message handler response
                        mockHandleMessage.mockResolvedValue(botResponse);

                        const newService = new WhatsAppMetaService();
                        await newService.handleAudioMessage(audioMessage as any);

                        // Verify the full round-trip:
                        // 1. Transcription was called
                        expect(mockTranscribeFromMediaId).toHaveBeenCalledWith(audioMessage.audio.id);

                        // 2. Message handler received transcribed text with audio options
                        expect(mockHandleMessage).toHaveBeenCalledWith(
                            audioMessage.from,
                            transcribedText,
                            { mediaId: audioMessage.audio.id }
                        );

                        // 3. Response was sent back to user
                        expect(mockedAxios.post).toHaveBeenCalledWith(
                            expect.any(String),
                            expect.objectContaining({
                                messaging_product: 'whatsapp',
                                to: audioMessage.from,
                                type: 'text',
                                text: expect.objectContaining({
                                    body: botResponse,
                                }),
                            }),
                            expect.any(Object)
                        );
                    }
                ),
                { numRuns: 100 }
            );
        });
    });


    /**
     * **Feature: audio-message-support, Property 3: Audio message acknowledgment before processing**
     * **Validates: Requirements 2.1, 2.2**
     */
    describe('Property 3: Audio message acknowledgment before processing', () => {
        it('for any audio message, the system marks as read before transcription starts', async () => {
            await fc.assert(
                fc.asyncProperty(audioMessageGenerator, async (audioMessage) => {
                    // Reset mocks
                    vi.clearAllMocks();

                    const callOrder: string[] = [];

                    // Track call order
                    mockedAxios.post = vi.fn().mockImplementation((url, data) => {
                        if (data.status === 'read') {
                            callOrder.push('markAsRead');
                        } else if (data.type === 'text') {
                            callOrder.push('sendMessage');
                        }
                        return Promise.resolve({ data: { messages: [{ id: 'msg-id' }] } });
                    });

                    mockTranscribeFromMediaId.mockImplementation(async () => {
                        callOrder.push('transcribe');
                        return {
                            success: true,
                            text: 'Transcribed text',
                            duration: 10,
                            language: 'pt',
                        };
                    });

                    mockHandleMessage.mockImplementation(async () => {
                        callOrder.push('handleMessage');
                        return 'Bot response';
                    });

                    const newService = new WhatsAppMetaService();
                    await newService.handleAudioMessage(audioMessage as any);

                    // Verify markAsRead happens before transcription
                    const markAsReadIndex = callOrder.indexOf('markAsRead');
                    const transcribeIndex = callOrder.indexOf('transcribe');

                    expect(markAsReadIndex).toBeGreaterThanOrEqual(0);
                    expect(transcribeIndex).toBeGreaterThanOrEqual(0);
                    expect(markAsReadIndex).toBeLessThan(transcribeIndex);
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: audio-message-support, Property 4: Error handling produces appropriate user messages**
     * **Validates: Requirements 3.1, 3.2**
     */
    describe('Property 4: Error handling produces appropriate user messages', () => {
        it('for any transcription failure, the system sends a user-friendly error message', async () => {
            await fc.assert(
                fc.asyncProperty(
                    audioMessageGenerator,
                    errorCodeGenerator,
                    async (audioMessage, errorCode) => {
                        // Reset mocks
                        vi.clearAllMocks();
                        mockedAxios.post = vi.fn().mockResolvedValue({ data: { messages: [{ id: 'msg-id' }] } });

                        // Mock failed transcription
                        mockTranscribeFromMediaId.mockResolvedValue({
                            success: false,
                            errorCode,
                            error: 'Some error message',
                        });

                        const newService = new WhatsAppMetaService();
                        await newService.handleAudioMessage(audioMessage as any);

                        // Verify error message was sent
                        const sendMessageCalls = mockedAxios.post.mock.calls.filter(
                            (call: any[]) => call[1]?.type === 'text'
                        );

                        expect(sendMessageCalls.length).toBeGreaterThan(0);

                        const sentMessage = sendMessageCalls[0][1].text.body;

                        // Error message should suggest alternatives (retry or type)
                        const suggestsAlternative =
                            sentMessage.includes('digitar') ||
                            sentMessage.includes('enviar novamente') ||
                            sentMessage.includes('tentar');

                        expect(suggestsAlternative).toBe(true);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('getAudioErrorMessage returns appropriate message for each error code', () => {
            fc.assert(
                fc.property(errorCodeGenerator, (errorCode) => {
                    const message = service.getAudioErrorMessage(errorCode);

                    // Message should not be empty
                    expect(message.length).toBeGreaterThan(0);

                    // Message should be in Portuguese (contains common Portuguese words)
                    const isPortuguese =
                        message.includes('áudio') ||
                        message.includes('mensagem') ||
                        message.includes('pode') ||
                        message.includes('não');

                    expect(isPortuguese).toBe(true);
                }),
                { numRuns: 100 }
            );
        });

        it('getAudioErrorMessage returns default message for unknown error codes', () => {
            const message = service.getAudioErrorMessage('UNKNOWN_ERROR');
            expect(message).toBe('Não consegui entender seu áudio. Pode tentar enviar novamente com mais clareza ou digitar sua mensagem?');
        });

        it('getAudioErrorMessage returns default message for undefined error code', () => {
            const message = service.getAudioErrorMessage(undefined);
            expect(message).toBe('Não consegui entender seu áudio. Pode tentar enviar novamente com mais clareza ou digitar sua mensagem?');
        });
    });
});


/**
 * Unit Tests for WhatsAppMetaService Audio Handling
 * **Validates: Requirements 1.1, 4.2**
 */
describe('WhatsAppMetaService Audio Unit Tests', () => {
    let service: WhatsAppMetaService;
    const mockedAxios = vi.mocked(axios);

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.post = vi.fn().mockResolvedValue({ data: { messages: [{ id: 'msg-id' }] } });
        service = new WhatsAppMetaService();
    });

    describe('Audio message routing', () => {
        it('routes audio messages to handleAudioMessage', async () => {
            const audioMessage = {
                from: '5511999999999',
                id: 'wamid.test123456789012345678901234567890',
                timestamp: '1234567890',
                audio: {
                    id: 'media123456789012345',
                    mime_type: 'audio/ogg',
                },
                type: 'audio' as const,
            };

            mockTranscribeFromMediaId.mockResolvedValue({
                success: true,
                text: 'Test transcription',
                duration: 5,
                language: 'pt',
            });

            mockHandleMessage.mockResolvedValue('Bot response');

            // Process webhook with audio message
            await service.processWebhook({
                entry: [{
                    id: 'entry-id',
                    changes: [{
                        value: {
                            messaging_product: 'whatsapp',
                            metadata: {
                                display_phone_number: '5511888888888',
                                phone_number_id: 'phone-id',
                            },
                            messages: [audioMessage],
                        },
                        field: 'messages',
                    }],
                }],
            });

            // Verify transcription was called
            expect(mockTranscribeFromMediaId).toHaveBeenCalledWith('media123456789012345');
        });

        it('ignores non-text non-audio messages', async () => {
            const imageMessage = {
                from: '5511999999999',
                id: 'wamid.test123456789012345678901234567890',
                timestamp: '1234567890',
                type: 'image' as const,
            };

            await service.processWebhook({
                entry: [{
                    id: 'entry-id',
                    changes: [{
                        value: {
                            messaging_product: 'whatsapp',
                            metadata: {
                                display_phone_number: '5511888888888',
                                phone_number_id: 'phone-id',
                            },
                            messages: [imageMessage as any],
                        },
                        field: 'messages',
                    }],
                }],
            });

            // Should not call transcription or message handler
            expect(mockTranscribeFromMediaId).not.toHaveBeenCalled();
            expect(mockHandleMessage).not.toHaveBeenCalled();
        });
    });

    describe('Error message formatting', () => {
        it('sends DOWNLOAD_FAILED error message correctly', async () => {
            const audioMessage = {
                from: '5511999999999',
                id: 'wamid.test123456789012345678901234567890',
                timestamp: '1234567890',
                audio: {
                    id: 'media123456789012345',
                    mime_type: 'audio/ogg',
                },
                type: 'audio' as const,
            };

            mockTranscribeFromMediaId.mockResolvedValue({
                success: false,
                errorCode: 'DOWNLOAD_FAILED',
                error: 'Failed to download',
            });

            await service.handleAudioMessage(audioMessage as any);

            // Verify error message was sent
            const sendCalls = mockedAxios.post.mock.calls.filter(
                (call: any[]) => call[1]?.type === 'text'
            );

            expect(sendCalls.length).toBe(1);
            expect(sendCalls[0][1].text.body).toContain('baixar seu áudio');
        });

        it('sends DURATION_EXCEEDED error message correctly', async () => {
            const audioMessage = {
                from: '5511999999999',
                id: 'wamid.test123456789012345678901234567890',
                timestamp: '1234567890',
                audio: {
                    id: 'media123456789012345',
                    mime_type: 'audio/ogg',
                },
                type: 'audio' as const,
            };

            mockTranscribeFromMediaId.mockResolvedValue({
                success: false,
                errorCode: 'DURATION_EXCEEDED',
                error: 'Audio too long',
            });

            await service.handleAudioMessage(audioMessage as any);

            const sendCalls = mockedAxios.post.mock.calls.filter(
                (call: any[]) => call[1]?.type === 'text'
            );

            expect(sendCalls.length).toBe(1);
            expect(sendCalls[0][1].text.body).toContain('muito longo');
        });
    });

    describe('Feature disabled behavior', () => {
        it('sends DISABLED error message when feature is disabled', async () => {
            const audioMessage = {
                from: '5511999999999',
                id: 'wamid.test123456789012345678901234567890',
                timestamp: '1234567890',
                audio: {
                    id: 'media123456789012345',
                    mime_type: 'audio/ogg',
                },
                type: 'audio' as const,
            };

            mockTranscribeFromMediaId.mockResolvedValue({
                success: false,
                errorCode: 'DISABLED',
                error: 'Feature disabled',
            });

            await service.handleAudioMessage(audioMessage as any);

            const sendCalls = mockedAxios.post.mock.calls.filter(
                (call: any[]) => call[1]?.type === 'text'
            );

            expect(sendCalls.length).toBe(1);
            expect(sendCalls[0][1].text.body).toContain('não estou conseguindo ouvir áudios');
        });
    });
});
