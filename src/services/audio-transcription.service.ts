import { env } from '../config/env';
import { logger } from '../lib/logger';
import groq from '../lib/groq';
import axios from 'axios';

/**
 * Result of an audio transcription attempt
 */
export interface TranscriptionResult {
    success: boolean;
    text?: string;
    duration?: number;
    language?: string;
    error?: string;
    errorCode?: 'DOWNLOAD_FAILED' | 'TRANSCRIPTION_FAILED' | 'DURATION_EXCEEDED' | 'LOW_QUALITY' | 'DISABLED';
}

/**
 * Internal log data for transcription attempts
 */
interface TranscriptionLogData {
    mediaId: string;
    audioDurationSeconds?: number;
    audioSizeBytes?: number;
    processingTimeMs: number;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
}

/**
 * Service responsible for transcribing audio messages using Groq Whisper API
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export class AudioTranscriptionService {
    private accessToken: string;
    private maxRetries = 2;
    private retryDelays = [1000, 2000]; // Exponential backoff: 1s, 2s

    constructor() {
        this.accessToken = env.META_WHATSAPP_TOKEN || '';
    }

    /**
     * Check if audio transcription feature is enabled
     * Requirements: 4.1, 4.2
     */
    isEnabled(): boolean {
        return env.ENABLE_AUDIO_TRANSCRIPTION;
    }

    /**
     * Get maximum supported audio duration in seconds
     * Requirements: 4.3
     */
    getMaxDuration(): number {
        return env.AUDIO_MAX_DURATION_SECONDS;
    }


    /**
     * Download audio file from Meta Cloud API
     * Requirements: 1.2
     */
    async downloadMediaFromMeta(mediaId: string): Promise<Buffer> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                // First, get the media URL
                const mediaUrlResponse = await axios.get(
                    `https://graph.facebook.com/v18.0/${mediaId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                        },
                    }
                );

                const mediaUrl = mediaUrlResponse.data.url;

                // Then download the actual file
                const audioResponse = await axios.get(mediaUrl, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                    responseType: 'arraybuffer',
                });

                return Buffer.from(audioResponse.data);
            } catch (error: any) {
                lastError = error;
                logger.warn({
                    mediaId,
                    attempt: attempt + 1,
                    maxRetries: this.maxRetries + 1,
                    error: error.message,
                }, 'Failed to download media, retrying...');

                if (attempt < this.maxRetries) {
                    await this.sleep(this.retryDelays[attempt]);
                }
            }
        }

        throw lastError || new Error('Failed to download media');
    }

    /**
     * Transcribe audio buffer using Groq Whisper API
     * Requirements: 1.3, 4.3
     */
    async transcribeAudio(audioBuffer: Buffer): Promise<{ text: string; duration?: number; language?: string }> {
        const file = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });

        // Prompt para dar contexto ao Whisper e melhorar precisão com nomes de carros e nomes próprios
        // Inclui modelos clássicos brasileiros (1960+) e modernos (até 2026)
        // Inclui nomes próprios brasileiros comuns para evitar erros de transcrição
        const automotivePrompt = `Contexto: Conversa em português brasileiro sobre compra de veículos usados. O cliente pode se apresentar com seu nome.
Nomes próprios comuns: Rafael, João, José, Pedro, Paulo, Lucas, Mateus, Gabriel, Miguel, Felipe, Bruno, Marcos, Carlos, Daniel, Fernando, Rodrigo, André, Eduardo, Diego, Ricardo, Gustavo, Leonardo, Thiago, Vinícius, Henrique, Caio, Leandro, Marcelo, Fábio, Renato, Maria, Ana, Juliana, Fernanda, Camila, Amanda, Bruna, Carolina, Patricia, Isabela, Letícia, Mariana, Beatriz, Larissa, Aline, Priscila, Gabriela, Vanessa, Renata, Natalia, Adriana, Cláudia, Sandra, Lúcia, Débora, Simone, Cristina, Jéssica, Michele, Carla.
Marcas: Honda, Toyota, Chevrolet, Volkswagen, Hyundai, Nissan, Fiat, Jeep, Mitsubishi, Ford, Renault, Peugeot, Citroën, Kia, BMW, Mercedes-Benz, Audi, Volvo, Land Rover, Porsche, Chery, JAC, Caoa Chery, BYD, GWM, Suzuki, Subaru, Mazda, Alfa Romeo, Chrysler, Dodge.
Modelos populares: Civic, Corolla, Onix, HB20, Creta, Kicks, T-Cross, Tracker, Compass, HR-V, Fit, City, Sentra, Versa, Yaris, Polo, Virtus, Voyage, Gol, Fox, Kwid, Mobi, Argo, Cronos, Toro, Strada, Hilux, S10, Ranger, SW4, Pajero, Outlander, Tiggo, Tiguan, Jetta, Passat, Golf, Cruze, Spin, Cobalt, Prisma, Uno, Palio, Siena, Grand Siena, Punto, Linea, Bravo, Renegade, Wrangler, Cherokee, Commander, Tucson, Santa Fe, i30, Veloster, Elantra, Azera, March, Livina, Tiida, Frontier, Leaf, Duster, Captur, Sandero, Logan, Fluence, Megane, Scenic, Clio, 208, 2008, 3008, 308, 408, C3, C4, Aircross, DS3, DS4, Cerato, Sportage, Sorento, Soul, Picanto, Carnival, Stinger, X1, X3, X5, Série 3, Série 5, Classe A, Classe C, GLA, GLC, A3, A4, Q3, Q5, TT, XC40, XC60, XC90, Evoque, Discovery, Defender, Cayenne, Macan, Tiggo 3, Tiggo 5, Tiggo 7, Tiggo 8, Arrizo 5, Arrizo 6, T40, T50, T60, T80, Dolphin, Song, Han, Haval H6.
Modelos clássicos: Fusca, Brasília, Variant, TL, Kombi, Karmann Ghia, SP2, Opala, Chevette, Monza, Kadett, Ipanema, Omega, Vectra, Astra, Corsa, Celta, Meriva, Zafira, Maverick, Corcel, Del Rey, Belina, Pampa, Escort, Verona, Versailles, Royale, Santana, Quantum, Parati, Saveiro, Passat antigo, Gol quadrado, Gol bola, Fiat 147, Oggi, Prêmio, Elba, Tempra, Marea, Stilo, Tipo, Puma, Gordini, Dauphine, Willys, Rural, Jeep Willys, Ford F-100, Chevrolet C10, Dodge Dart, Dodge Charger, Dodge Polara.
Anos: 1960, 1965, 1970, 1975, 1980, 1985, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026.`;

        const transcription = await groq.audio.transcriptions.create({
            file,
            model: 'whisper-large-v3-turbo',
            response_format: 'verbose_json',
            language: 'pt', // Forçar português
            prompt: automotivePrompt,
        });

        // Cast to any to access verbose_json properties (duration, language)
        const verboseResult = transcription as any;

        return {
            text: transcription.text,
            duration: verboseResult.duration,
            language: verboseResult.language,
        };
    }


    /**
     * Main method: Transcribe audio from a Meta media ID
     * Orchestrates: download → validate → transcribe flow
     * Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 3.4
     */
    async transcribeFromMediaId(mediaId: string): Promise<TranscriptionResult> {
        const startTime = Date.now();
        let audioSizeBytes: number | undefined;
        let audioDurationSeconds: number | undefined;

        // Check if feature is enabled
        if (!this.isEnabled()) {
            this.logTranscription({
                mediaId,
                processingTimeMs: Date.now() - startTime,
                success: false,
                errorCode: 'DISABLED',
                errorMessage: 'Audio transcription feature is disabled',
            });

            return {
                success: false,
                error: 'No momento não estou conseguindo ouvir áudios. Pode digitar sua mensagem, por favor?',
                errorCode: 'DISABLED',
            };
        }

        // Step 1: Download audio from Meta
        let audioBuffer: Buffer;
        try {
            audioBuffer = await this.downloadMediaFromMeta(mediaId);
            audioSizeBytes = audioBuffer.length;
        } catch (error: any) {
            this.logTranscription({
                mediaId,
                processingTimeMs: Date.now() - startTime,
                success: false,
                errorCode: 'DOWNLOAD_FAILED',
                errorMessage: error.message,
            });

            return {
                success: false,
                error: 'Não consegui baixar seu áudio. Pode tentar enviar novamente ou digitar sua mensagem?',
                errorCode: 'DOWNLOAD_FAILED',
            };
        }

        // Step 2: Transcribe audio
        try {
            const result = await this.transcribeAudio(audioBuffer);
            audioDurationSeconds = result.duration;

            // Step 3: Validate duration (after transcription since we get duration from Whisper)
            if (audioDurationSeconds && audioDurationSeconds > this.getMaxDuration()) {
                this.logTranscription({
                    mediaId,
                    audioDurationSeconds,
                    audioSizeBytes,
                    processingTimeMs: Date.now() - startTime,
                    success: false,
                    errorCode: 'DURATION_EXCEEDED',
                    errorMessage: `Audio duration ${audioDurationSeconds}s exceeds max ${this.getMaxDuration()}s`,
                });

                return {
                    success: false,
                    error: `Seu áudio é muito longo (máximo ${Math.floor(this.getMaxDuration() / 60)} minutos). Pode enviar um áudio mais curto ou digitar sua mensagem?`,
                    errorCode: 'DURATION_EXCEEDED',
                    duration: audioDurationSeconds,
                };
            }

            // Success
            this.logTranscription({
                mediaId,
                audioDurationSeconds,
                audioSizeBytes,
                processingTimeMs: Date.now() - startTime,
                success: true,
            });

            return {
                success: true,
                text: result.text,
                duration: result.duration,
                language: result.language,
            };
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown transcription error';
            const isLowQuality = errorMessage.toLowerCase().includes('quality') ||
                errorMessage.toLowerCase().includes('audio') ||
                errorMessage.toLowerCase().includes('decode');

            const errorCode = isLowQuality ? 'LOW_QUALITY' : 'TRANSCRIPTION_FAILED';
            const userMessage = isLowQuality
                ? 'O áudio está com qualidade baixa. Pode enviar novamente em um ambiente mais silencioso ou digitar sua mensagem?'
                : 'Não consegui entender seu áudio. Pode tentar enviar novamente com mais clareza ou digitar sua mensagem?';

            this.logTranscription({
                mediaId,
                audioDurationSeconds,
                audioSizeBytes,
                processingTimeMs: Date.now() - startTime,
                success: false,
                errorCode,
                errorMessage,
            });

            return {
                success: false,
                error: userMessage,
                errorCode,
            };
        }
    }

    /**
     * Log transcription attempt for monitoring
     * Requirements: 5.1, 5.2, 5.3
     */
    private logTranscription(data: TranscriptionLogData): void {
        const logData = {
            mediaId: data.mediaId,
            audioDurationSeconds: data.audioDurationSeconds,
            audioSizeBytes: data.audioSizeBytes,
            processingTimeMs: data.processingTimeMs,
            success: data.success,
            ...(data.errorCode && { errorCode: data.errorCode }),
            ...(data.errorMessage && { errorMessage: data.errorMessage }),
        };

        if (data.success) {
            logger.info(logData, '🎤 Audio transcription completed');
        } else {
            logger.error(logData, '❌ Audio transcription failed');
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default AudioTranscriptionService;
