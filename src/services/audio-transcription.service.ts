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
  errorCode?:
    | 'DOWNLOAD_FAILED'
    | 'TRANSCRIPTION_FAILED'
    | 'DURATION_EXCEEDED'
    | 'LOW_QUALITY'
    | 'DISABLED';
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
        const mediaUrlResponse = await axios.get(`https://graph.facebook.com/v18.0/${mediaId}`, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        });

        const mediaUrl = mediaUrlResponse.data.url;

        // Then download the actual file
        const audioResponse = await axios.get(mediaUrl, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          responseType: 'arraybuffer',
        });

        return Buffer.from(audioResponse.data);
      } catch (error: any) {
        lastError = error;
        logger.warn(
          {
            mediaId,
            attempt: attempt + 1,
            maxRetries: this.maxRetries + 1,
            error: error.message,
          },
          'Failed to download media, retrying...'
        );

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
  async transcribeAudio(
    audioBuffer: Buffer
  ): Promise<{ text: string; duration?: number; language?: string }> {
    const file = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });

    // Prompt reduzido - limite do Groq Whisper é 896 caracteres (~850 usado)
    // Mantém contexto essencial, modelos populares e clássicos brasileiros
    const automotivePrompt = `Conversa sobre compra de carros usados em português brasileiro. Nomes: Rafael, João, Maria, Ana, Pedro, Paulo, Lucas, Fernanda, Camila, Gabriel, Carlos, Bruno, Marcos, Eduardo. Marcas: Honda, Toyota, Chevrolet, Volkswagen, Hyundai, Fiat, Jeep, Ford, Renault, Nissan, Mitsubishi. Modelos modernos: Civic, Corolla, Onix, HB20, Creta, Kicks, T-Cross, Tracker, Compass, HR-V, Fit, City, Polo, Virtus, Gol, Kwid, Argo, Cronos, Toro, Strada, Hilux, Duster, SW4, Pajero, Tucson, Sentra, Yaris, Jetta, Golf, Tiguan. Clássicos: Fusca, Variant, Brasília, Opala, Chevette, Kombi, Monza, Corcel, Escort, Santana, Parati, Saveiro, Uno, Palio, Tempra. Anos: 1970-2025.`;

    try {
      logger.info({ bufferSize: audioBuffer.length }, '🎤 Calling Groq Whisper API...');

      const transcription = await groq.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3-turbo',
        response_format: 'verbose_json',
        language: 'pt', // Forçar português
        prompt: automotivePrompt,
      });

      logger.info(
        { textLength: transcription.text?.length },
        '✅ Groq Whisper transcription successful'
      );

      // Cast to any to access verbose_json properties (duration, language)
      const verboseResult = transcription as any;

      return {
        text: transcription.text,
        duration: verboseResult.duration,
        language: verboseResult.language,
      };
    } catch (error: any) {
      // Log detailed error for debugging
      logger.error(
        {
          error: error.message,
          status: error.status,
          statusCode: error.statusCode,
          code: error.code,
          type: error.type,
          errorDetails: error.error,
          stack: error.stack?.substring(0, 500),
        },
        '❌ Groq Whisper API call failed'
      );

      throw error;
    }
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
        error:
          'No momento não estou conseguindo ouvir áudios. Pode digitar sua mensagem, por favor?',
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
        error:
          'Não consegui baixar seu áudio. Pode tentar enviar novamente ou digitar sua mensagem?',
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

      // Step 4: Validate transcription quality (detect corrupted/garbage output)
      let transcribedText = result.text.trim();
      if (this.isCorruptedTranscription(transcribedText)) {
        this.logTranscription({
          mediaId,
          audioDurationSeconds,
          audioSizeBytes,
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorCode: 'LOW_QUALITY',
          errorMessage: `Corrupted transcription detected: ${transcribedText.substring(0, 100)}`,
        });

        return {
          success: false,
          error:
            'O áudio ficou difícil de entender. Pode falar mais perto do microfone ou digitar sua mensagem?',
          errorCode: 'LOW_QUALITY',
        };
      }

      // Step 5: Clean up short response hallucinations (e.g., "Não. Nelson?" -> "Não")
      transcribedText = this.cleanShortResponseHallucinations(transcribedText);

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
        text: transcribedText,
        duration: result.duration,
        language: result.language,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown transcription error';
      const isLowQuality =
        errorMessage.toLowerCase().includes('quality') ||
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

  /**
   * Clean hallucinated content from short responses
   * Whisper sometimes adds random names/words to very short audio clips
   * e.g., "Não. Nelson?" should be just "Não"
   */
  cleanShortResponseHallucinations(text: string): string {
    const cleaned = text.trim();

    // Pattern: short response + punctuation + random word/name
    // e.g., "Não. Nelson?" "Sim. João." "Ok. Pedro?"
    const shortResponsePattern =
      /^(não|nao|sim|ok|okay|oi|olá|ola|certo|beleza|pode|pois|bom|boa|tá|ta|hum|é|e)\s*[.,!?]+\s*([A-Za-záàâãéèêíìóòôõúùûç]+)[.,!?]*$/i;
    const match = cleaned.match(shortResponsePattern);

    if (match) {
      const mainResponse = match[1];
      const hallucinatedWord = match[2].toLowerCase();

      // List of common names that are likely hallucinations after short responses
      const commonHallucinatedNames = [
        'nelson',
        'wilson',
        'edison',
        'nilson',
        'elson',
        'kelson',
        'jason',
        'mason',
        'jackson',
        'johnson',
        'henderson',
        'rafael',
        'gabriel',
        'miguel',
        'daniel',
        'samuel',
        'joao',
        'jose',
        'maria',
        'ana',
        'pedro',
        'paulo',
        'jordan',
        'morgan',
        'logan',
        'ryan',
        'brian',
      ];

      // Check if the second word looks like a hallucinated name
      if (
        commonHallucinatedNames.includes(hallucinatedWord) ||
        (hallucinatedWord.length >= 4 && hallucinatedWord.match(/^[A-Za-záàâãéèêíìóòôõúùûç]+$/))
      ) {
        // Log the cleanup
        logger.info(
          {
            original: text,
            cleaned: mainResponse,
            hallucinatedWord,
          },
          '🧹 Cleaned hallucination from short response'
        );

        return mainResponse;
      }
    }

    // Also handle: "Não, não" -> "Não" (stuttering/repetition)
    const repetitionPattern = /^(não|nao|sim|ok|okay)\s*[.,!?]*\s*\1[.,!?]*$/i;
    if (repetitionPattern.test(cleaned)) {
      const singleResponse = cleaned.match(repetitionPattern)?.[1] || cleaned;
      logger.info(
        {
          original: text,
          cleaned: singleResponse,
        },
        '🧹 Cleaned repetition from transcription'
      );
      return singleResponse;
    }

    return text;
  }

  /**
   * Detect corrupted/garbage transcriptions
   * Returns true if the transcription appears to be nonsense
   */
  private isCorruptedTranscription(text: string): boolean {
    if (!text || text.length === 0) return true;

    // Detect non-Latin characters (Chinese, Arabic, Korean, Japanese, etc)
    // These indicate Whisper got confused and hallucinated in other languages
    const nonLatinPattern =
      /[\u4e00-\u9fff\u0600-\u06ff\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff\u0400-\u04ff]/;
    if (nonLatinPattern.test(text)) {
      logger.warn(
        { text: text.substring(0, 100) },
        'Corrupted transcription: non-Latin characters detected'
      );
      return true;
    }

    // Detect high proportion of English words when expecting Portuguese
    // Count English-only common words that don't exist in Portuguese
    const englishOnlyWords = [
      'the',
      'for',
      'and',
      'that',
      'with',
      'this',
      'from',
      'have',
      'are',
      'was',
      'were',
      'been',
      'being',
      'which',
      'their',
      'would',
      'could',
      'should',
      'example',
      'playing',
      'type',
    ];
    const words = text.toLowerCase().split(/\s+/);
    const englishWordCount = words.filter(w => englishOnlyWords.includes(w)).length;

    // If more than 30% are English-only words, likely garbage
    if (words.length > 3 && englishWordCount / words.length > 0.3) {
      logger.warn(
        { text: text.substring(0, 100), englishWordCount, totalWords: words.length },
        'Corrupted transcription: too many English words'
      );
      return true;
    }

    // Detect too many special unicode characters (garbage output)
    const specialChars = text.match(/[^\w\s\u00C0-\u017F.,!?;:'"()-áàâãéèêíìóòôõúùûç]/g) || [];
    if (specialChars.length > text.length * 0.1) {
      logger.warn(
        { text: text.substring(0, 100), specialCharCount: specialChars.length },
        'Corrupted transcription: too many special characters'
      );
      return true;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AudioTranscriptionService;
