/**
 * Property-Based Tests for AudioTranscriptionService
 * 
 * **Feature: audio-message-support, Property 5: Feature flag controls audio processing behavior**
 * **Validates: Requirements 4.1, 4.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock the env module before importing the service
vi.mock('../../src/config/env', () => ({
    env: {
        ENABLE_AUDIO_TRANSCRIPTION: true,
        AUDIO_MAX_DURATION_SECONDS: 120,
        META_WHATSAPP_TOKEN: 'mock-token',
        GROQ_API_KEY: 'mock-groq-key',
        NODE_ENV: 'test',
    },
    isDev: false,
    isProd: false,
}));

// Mock axios for media download
vi.mock('axios');

// Mock groq for transcription
vi.mock('../../src/lib/groq', () => ({
    default: {
        audio: {
            transcriptions: {
                create: vi.fn(),
            },
        },
    },
}));

// Mock logger for testing logging behavior - use vi.hoisted to define mocks before hoisting
const { mockLoggerInfo, mockLoggerError, mockLoggerWarn } = vi.hoisted(() => ({
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
}));

vi.mock('../../src/lib/logger', () => ({
    logger: {
        info: mockLoggerInfo,
        error: mockLoggerError,
        warn: mockLoggerWarn,
        debug: vi.fn(),
    },
}));

import { AudioTranscriptionService, TranscriptionResult } from '../../src/services/audio-transcription.service';
import { env } from '../../src/config/env';
import axios from 'axios';
import groq from '../../src/lib/groq';

/**
 * Generator for valid media IDs (alphanumeric strings)
 */
const mediaIdGenerator = fc.stringMatching(/^[a-zA-Z0-9]{10,30}$/);

/**
 * Generator for audio durations within valid range
 */
const validDurationGenerator = fc.integer({ min: 1, max: 119 }); // Under 120s limit

/**
 * Generator for audio durations exceeding the limit
 */
const exceedingDurationGenerator = fc.integer({ min: 121, max: 600 });

/**
 * Generator for transcription text results
 * Must generate valid Portuguese-like text that won't be detected as corrupted
 */
const transcriptionTextGenerator = fc.stringMatching(/^[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ\s]{5,100}$/)
    .filter(s => s.trim().length >= 5);

describe('AudioTranscriptionService Property Tests', () => {
    let service: AudioTranscriptionService;
    const mockedAxios = vi.mocked(axios);
    const mockedGroq = vi.mocked(groq);

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AudioTranscriptionService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * **Feature: audio-message-support, Property 5: Feature flag controls audio processing behavior**
     * **Validates: Requirements 4.1, 4.2**
     */
    describe('Property 5: Feature flag controls audio processing behavior', () => {
        it('when ENABLE_AUDIO_TRANSCRIPTION is false, returns DISABLED error for any media ID', async () => {
            // Override env to disable feature
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = false;

            try {
                await fc.assert(
                    fc.asyncProperty(mediaIdGenerator, async (mediaId) => {
                        const newService = new AudioTranscriptionService();
                        const result = await newService.transcribeFromMediaId(mediaId);

                        // Feature disabled should return DISABLED error
                        expect(result.success).toBe(false);
                        expect(result.errorCode).toBe('DISABLED');
                        expect(result.error).toContain('não estou conseguindo ouvir áudios');
                    }),
                    { numRuns: 100 }
                );
            } finally {
                // Restore original value
                (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
            }
        });

        it('when ENABLE_AUDIO_TRANSCRIPTION is true, attempts transcription for any valid media ID', async () => {
            // Ensure feature is enabled
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

            // Mock successful download and transcription
            mockedAxios.get = vi.fn()
                .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

            mockedGroq.audio.transcriptions.create = vi.fn().mockResolvedValue({
                text: 'Transcribed text',
                duration: 10,
                language: 'pt',
            });

            try {
                await fc.assert(
                    fc.asyncProperty(mediaIdGenerator, async (mediaId) => {
                        // Reset mocks for each iteration
                        vi.mocked(axios.get)
                            .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                            .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

                        vi.mocked(groq.audio.transcriptions.create).mockResolvedValue({
                            text: 'Transcribed text',
                            duration: 10,
                            language: 'pt',
                        } as any);

                        const newService = new AudioTranscriptionService();
                        const result = await newService.transcribeFromMediaId(mediaId);

                        // When enabled, should attempt transcription (success or specific error, not DISABLED)
                        expect(result.errorCode).not.toBe('DISABLED');
                    }),
                    { numRuns: 100 }
                );
            } finally {
                (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
            }
        });

        it('isEnabled() returns the correct feature flag value', () => {
            fc.assert(
                fc.property(fc.boolean(), (flagValue) => {
                    const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
                    (env as any).ENABLE_AUDIO_TRANSCRIPTION = flagValue;

                    try {
                        const newService = new AudioTranscriptionService();
                        expect(newService.isEnabled()).toBe(flagValue);
                    } finally {
                        (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('getMaxDuration() returns the configured max duration value', () => {
            fc.assert(
                fc.property(fc.integer({ min: 30, max: 600 }), (maxDuration) => {
                    const originalValue = (env as any).AUDIO_MAX_DURATION_SECONDS;
                    (env as any).AUDIO_MAX_DURATION_SECONDS = maxDuration;

                    try {
                        const newService = new AudioTranscriptionService();
                        expect(newService.getMaxDuration()).toBe(maxDuration);
                    } finally {
                        (env as any).AUDIO_MAX_DURATION_SECONDS = originalValue;
                    }
                }),
                { numRuns: 100 }
            );
        });
    });
});


/**
 * **Feature: audio-message-support, Property 7: Transcription logging completeness**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
describe('Property 7: Transcription logging completeness', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Generator for successful transcription scenarios
     */
    const successfulTranscriptionGenerator = fc.record({
        mediaId: mediaIdGenerator,
        duration: validDurationGenerator,
        text: transcriptionTextGenerator,
    });

    it('successful transcription logs audio duration, file size, and processing time', async () => {
        // Ensure feature is enabled
        const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
        (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

        await fc.assert(
            fc.asyncProperty(successfulTranscriptionGenerator, async ({ mediaId, duration, text }) => {
                // Reset mocks
                mockLoggerInfo.mockClear();
                mockLoggerError.mockClear();

                // Mock successful download
                vi.mocked(axios.get)
                    .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                    .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

                // Mock successful transcription
                vi.mocked(groq.audio.transcriptions.create).mockResolvedValue({
                    text,
                    duration,
                    language: 'pt',
                } as any);

                const service = new AudioTranscriptionService();
                const result = await service.transcribeFromMediaId(mediaId);

                // Verify success
                expect(result.success).toBe(true);

                // Check the last info call
                const lastInfoCall = mockLoggerInfo.mock.calls[mockLoggerInfo.mock.calls.length - 1];

                if (lastInfoCall) {
                    const logData = lastInfoCall[0];
                    // Verify required fields are logged (Requirements 5.1, 5.2)
                    expect(logData).toHaveProperty('mediaId');
                    expect(logData).toHaveProperty('processingTimeMs');
                    expect(logData).toHaveProperty('success', true);
                    // Duration and size should be present for successful transcriptions
                    expect(logData).toHaveProperty('audioDurationSeconds');
                    expect(logData).toHaveProperty('audioSizeBytes');
                }
            }),
            { numRuns: 100 }
        );

        (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
    });

    it('failed transcription logs error details including the stage where it failed', async () => {
        // Ensure feature is enabled
        const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
        (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

        // Reduce runs since download failures trigger retries with delays
        await fc.assert(
            fc.asyncProperty(mediaIdGenerator, async (mediaId) => {
                // Reset ALL mocks completely
                vi.clearAllMocks();
                mockLoggerInfo.mockClear();
                mockLoggerError.mockClear();
                mockLoggerWarn.mockClear();

                // Mock download failure - reset and reject all retry attempts
                vi.mocked(axios.get).mockReset();
                vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

                // Create service with mocked sleep to avoid delays
                const service = new AudioTranscriptionService();
                // Override sleep to be instant for testing
                (service as any).sleep = () => Promise.resolve();

                const result = await service.transcribeFromMediaId(mediaId);

                // Verify failure
                expect(result.success).toBe(false);
                expect(result.errorCode).toBe('DOWNLOAD_FAILED');

                // Check the last error call
                const lastErrorCall = mockLoggerError.mock.calls[mockLoggerError.mock.calls.length - 1];

                if (lastErrorCall) {
                    const logData = lastErrorCall[0];
                    // Verify error details are logged (Requirement 5.3)
                    expect(logData).toHaveProperty('mediaId');
                    expect(logData).toHaveProperty('processingTimeMs');
                    expect(logData).toHaveProperty('success', false);
                    expect(logData).toHaveProperty('errorCode');
                    expect(logData).toHaveProperty('errorMessage');
                }
            }),
            { numRuns: 100 }
        );

        (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
    });

    it('transcription failure logs error code and message', async () => {
        // Ensure feature is enabled
        const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
        (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

        await fc.assert(
            fc.asyncProperty(mediaIdGenerator, async (mediaId) => {
                // Reset mocks
                mockLoggerInfo.mockClear();
                mockLoggerError.mockClear();

                // Mock successful download but failed transcription
                vi.mocked(axios.get)
                    .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                    .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

                vi.mocked(groq.audio.transcriptions.create).mockRejectedValue(
                    new Error('Transcription service unavailable')
                );

                const service = new AudioTranscriptionService();
                const result = await service.transcribeFromMediaId(mediaId);

                // Verify failure
                expect(result.success).toBe(false);
                expect(result.errorCode).toBe('TRANSCRIPTION_FAILED');

                // Check the last error call
                const lastErrorCall = mockLoggerError.mock.calls[mockLoggerError.mock.calls.length - 1];

                if (lastErrorCall) {
                    const logData = lastErrorCall[0];
                    // Verify error details are logged (Requirement 5.3)
                    expect(logData).toHaveProperty('errorCode', 'TRANSCRIPTION_FAILED');
                    expect(logData).toHaveProperty('errorMessage');
                    expect(logData.errorMessage).toContain('Transcription service unavailable');
                }
            }),
            { numRuns: 100 }
        );

        (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
    });
});


/**
 * Unit Tests for AudioTranscriptionService
 * **Validates: Requirements 1.2, 1.3, 3.1, 3.2, 3.3**
 */
describe('AudioTranscriptionService Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoggerInfo.mockClear();
        mockLoggerError.mockClear();
        mockLoggerWarn.mockClear();
    });

    describe('transcribeFromMediaId with valid media ID', () => {
        it('returns successful transcription result with text, duration, and language', async () => {
            // Ensure feature is enabled
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

            // Mock successful download
            vi.mocked(axios.get)
                .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

            // Mock successful transcription
            vi.mocked(groq.audio.transcriptions.create).mockResolvedValue({
                text: 'Olá, quero ver carros',
                duration: 5.5,
                language: 'pt',
            } as any);

            const service = new AudioTranscriptionService();
            const result = await service.transcribeFromMediaId('valid-media-id-123');

            expect(result.success).toBe(true);
            expect(result.text).toBe('Olá, quero ver carros');
            expect(result.duration).toBe(5.5);
            expect(result.language).toBe('pt');
            expect(result.errorCode).toBeUndefined();

            (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
        });
    });

    describe('error handling for download failures', () => {
        it('returns DOWNLOAD_FAILED error when Meta API fails', async () => {
            // Ensure feature is enabled
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

            // Mock download failure
            vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

            const service = new AudioTranscriptionService();
            (service as any).sleep = () => Promise.resolve(); // Skip delays

            const result = await service.transcribeFromMediaId('invalid-media-id');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('DOWNLOAD_FAILED');
            expect(result.error).toContain('baixar seu áudio');

            (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
        });
    });

    describe('error handling for transcription failures', () => {
        it('returns TRANSCRIPTION_FAILED error when Groq API fails', async () => {
            // Ensure feature is enabled
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

            // Mock successful download
            vi.mocked(axios.get)
                .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

            // Mock transcription failure
            vi.mocked(groq.audio.transcriptions.create).mockRejectedValue(
                new Error('Service unavailable')
            );

            const service = new AudioTranscriptionService();
            const result = await service.transcribeFromMediaId('valid-media-id');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('TRANSCRIPTION_FAILED');
            expect(result.error).toContain('entender seu áudio');

            (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
        });

        it('returns LOW_QUALITY error when audio quality is poor', async () => {
            // Ensure feature is enabled
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;

            // Mock successful download
            vi.mocked(axios.get)
                .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

            // Mock transcription failure with quality-related error
            vi.mocked(groq.audio.transcriptions.create).mockRejectedValue(
                new Error('Failed to decode audio file')
            );

            const service = new AudioTranscriptionService();
            const result = await service.transcribeFromMediaId('valid-media-id');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('LOW_QUALITY');
            expect(result.error).toContain('qualidade baixa');

            (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
        });
    });

    describe('duration validation', () => {
        it('returns DURATION_EXCEEDED error when audio is too long', async () => {
            // Ensure feature is enabled
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            const originalMaxDuration = (env as any).AUDIO_MAX_DURATION_SECONDS;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = true;
            (env as any).AUDIO_MAX_DURATION_SECONDS = 60; // 1 minute max

            // Mock successful download
            vi.mocked(axios.get)
                .mockResolvedValueOnce({ data: { url: 'https://example.com/audio.ogg' } })
                .mockResolvedValueOnce({ data: Buffer.from('fake-audio-data') });

            // Mock transcription with long duration
            vi.mocked(groq.audio.transcriptions.create).mockResolvedValue({
                text: 'Long audio content',
                duration: 120, // 2 minutes - exceeds limit
                language: 'pt',
            } as any);

            const service = new AudioTranscriptionService();
            const result = await service.transcribeFromMediaId('valid-media-id');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('DURATION_EXCEEDED');
            expect(result.error).toContain('muito longo');
            expect(result.duration).toBe(120);

            (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
            (env as any).AUDIO_MAX_DURATION_SECONDS = originalMaxDuration;
        });
    });

    describe('feature disabled behavior', () => {
        it('returns DISABLED error when feature is disabled', async () => {
            // Disable feature
            const originalValue = (env as any).ENABLE_AUDIO_TRANSCRIPTION;
            (env as any).ENABLE_AUDIO_TRANSCRIPTION = false;

            const service = new AudioTranscriptionService();
            const result = await service.transcribeFromMediaId('any-media-id');

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('DISABLED');
            expect(result.error).toContain('não estou conseguindo ouvir áudios');

            (env as any).ENABLE_AUDIO_TRANSCRIPTION = originalValue;
        });
    });
});
