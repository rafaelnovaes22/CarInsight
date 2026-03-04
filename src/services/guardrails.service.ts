/**
 * Guardrails Service
 * 
 * Serviço de segurança e validação de input/output com:
 * - Rate limiting distribuído (Redis/Memory)
 * - Detecção de prompt injection
 * - Validação de conteúdo
 * - Sanitização de input
 * 
 * ISO 42001 Compliance: Validações para IA segura
 */

import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import { autoAddDisclaimers } from '../config/disclosure.messages';
import { getRateLimitService, type RateLimitService } from './rate-limit.service';
import type { RateLimitConfig } from '../lib/rate-limit/types';

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  sanitizedInput?: string;
}

export interface GuardrailsOptions {
  /** Rate limit service customizado (para testes) */
  rateLimitService?: RateLimitService;
  /** Configuração de rate limiting */
  rateLimitConfig?: RateLimitConfig;
  /** Desabilitar rate limiting */
  disableRateLimit?: boolean;
}

/**
 * Serviço de Guardrails para validação de segurança
 * 
 * NOTA: Para rate limiting distribuído em produção, configure REDIS_URL.
 * Sem Redis, usa fallback em memória (não compartilha entre instâncias).
 */
export class GuardrailsService {
  // Maximum message length
  private readonly MAX_MESSAGE_LENGTH = 1000;

  // Rate limiting
  private rateLimitService: RateLimitService | null = null;
  private rateLimitConfig: RateLimitConfig;
  private disableRateLimit: boolean;
  private initialized = false;

  // LEGACY: Rate limiting in-memory (para compatibilidade durante transição)
  private readonly MAX_MESSAGES_PER_MINUTE = 10;
  private rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  private useLegacyRateLimit = false;

  constructor(options: GuardrailsOptions = {}) {
    this.rateLimitService = options.rateLimitService ?? null;
    this.rateLimitConfig = options.rateLimitConfig ?? {
      maxRequests: 10,
      windowMs: 60000,
    };
    this.disableRateLimit = options.disableRateLimit ?? false;
  }

  /**
   * Inicializa o serviço (deve ser chamado antes do primeiro uso)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Se já tem rate limit service injetado, usar ele
    if (this.rateLimitService) {
      logger.info('Guardrails using provided rate limit service');
      this.initialized = true;
      return;
    }

    // Se rate limit desabilitado, não inicializar
    if (this.disableRateLimit) {
      logger.info('Rate limiting disabled');
      this.initialized = true;
      return;
    }

    try {
      // Tentar obter serviço singleton
      this.rateLimitService = await getRateLimitService();
      logger.info('Guardrails initialized with distributed rate limiting');
    } catch (error) {
      logger.warn(
        { error: (error as Error).message },
        'Failed to initialize distributed rate limiting, using legacy mode'
      );
      this.useLegacyRateLimit = true;
    }

    this.initialized = true;
  }

  /**
   * Validate incoming user message
   */
  async validateInput(phoneNumber: string, message: string): Promise<GuardrailResult> {
    // Garantir inicialização
    if (!this.initialized) {
      await this.initialize();
    }

    // 1. Check rate limiting
    const rateLimitCheck = await this.checkRateLimit(phoneNumber);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck;
    }

    // 2. Check message length
    if (message.length > this.MAX_MESSAGE_LENGTH) {
      logger.warn(
        { phoneNumber: maskPhoneNumber(phoneNumber), length: message.length },
        'Message too long'
      );
      return {
        allowed: false,
        reason: 'Mensagem muito longa. Por favor, envie mensagens menores.',
      };
    }

    // 3. Check for empty/whitespace only
    if (!message.trim()) {
      return {
        allowed: false,
        reason: 'Mensagem vazia. Por favor, envie uma mensagem válida.',
      };
    }

    // 4. Detect prompt injection attempts
    const injectionCheck = this.detectPromptInjection(message);
    if (!injectionCheck.allowed) {
      logger.warn(
        { phoneNumber: maskPhoneNumber(phoneNumber), message },
        'Prompt injection detected'
      );
      return injectionCheck;
    }

    // 5. Sanitize input
    const sanitized = this.sanitizeInput(message);

    return {
      allowed: true,
      sanitizedInput: sanitized,
    };
  }

  /**
   * Validate AI-generated output before sending
   * ISO 42001 Compliance: Adds automatic disclaimers for transparency
   */
  validateOutput(output: string): GuardrailResult {
    // 1. Check output length (max 4096 for WhatsApp)
    if (output.length > 4096) {
      logger.warn({ length: output.length }, 'Output too long for WhatsApp');
      return {
        allowed: false,
        reason: 'Resposta muito longa (erro interno)',
      };
    }

    // 2. Check for leaked system prompts
    if (this.containsSystemPromptLeak(output)) {
      logger.error({ output }, 'System prompt leak detected in output');
      return {
        allowed: false,
        reason: 'Erro ao gerar resposta. Tente novamente.',
      };
    }

    // 3. Check for inappropriate content
    if (this.containsInappropriateContent(output)) {
      logger.warn({ output }, 'Inappropriate content in output');
      return {
        allowed: false,
        reason: 'Erro ao gerar resposta. Tente novamente.',
      };
    }

    // 4. ISO 42001: Add automatic disclaimers for transparency
    const outputWithDisclaimers = autoAddDisclaimers(output);

    return {
      allowed: true,
      sanitizedInput: outputWithDisclaimers,
    };
  }

  /**
   * Check if user has exceeded rate limit
   * 
   * Usa RateLimitService distribuído se disponível, senão fallback para legacy.
   */
  private async checkRateLimit(phoneNumber: string): Promise<GuardrailResult> {
    // Se desabilitado, permitir
    if (this.disableRateLimit) {
      return { allowed: true };
    }

    // Usar serviço distribuído se disponível
    if (this.rateLimitService && !this.useLegacyRateLimit) {
      try {
        const status = await this.rateLimitService.checkWhatsAppLimit(phoneNumber);

        if (!status.allowed) {
          const retrySeconds = Math.ceil((status.retryAfterMs ?? 60000) / 1000);
          return {
            allowed: false,
            reason: `Você está enviando mensagens muito rapidamente. Por favor, aguarde ${retrySeconds} segundos.`,
          };
        }

        return { allowed: true };
      } catch (error) {
        logger.error({ error, phoneNumber }, 'Rate limit service failed, using legacy');
        // Fallback para legacy em caso de erro
      }
    }

    // LEGACY: Rate limiting in-memory (fallback)
    return this.checkLegacyRateLimit(phoneNumber);
  }

  /**
   * LEGACY: Rate limiting usando Map em memória
   * 
   * NOTA: Não compartilha estado entre instâncias!
   * Mantido para compatibilidade durante transição.
   */
  private checkLegacyRateLimit(phoneNumber: string): GuardrailResult {
    const now = Date.now();
    const record = this.rateLimitMap.get(phoneNumber);

    if (!record || now > record.resetAt) {
      // Reset or create new record
      this.rateLimitMap.set(phoneNumber, {
        count: 1,
        resetAt: now + 60000, // 1 minute
      });
      return { allowed: true };
    }

    if (record.count >= this.MAX_MESSAGES_PER_MINUTE) {
      logger.warn(
        { phoneNumber: maskPhoneNumber(phoneNumber), count: record.count },
        'Rate limit exceeded (legacy mode)'
      );
      return {
        allowed: false,
        reason: 'Você está enviando mensagens muito rapidamente. Por favor, aguarde um momento.',
      };
    }

    // Increment count
    record.count++;
    return { allowed: true };
  }

  /**
   * Detect prompt injection attempts
   */
  private detectPromptInjection(message: string): GuardrailResult {
    // Common prompt injection patterns
    const injectionPatterns = [
      // System prompt manipulation (English)
      /ignore\s+(previous|above|all|the)\s+(instructions|prompts|rules)/i,
      /forget\s+(previous|above|all|the)\s+(instructions|prompts|rules)/i,
      /disregard\s+(previous|above|all|the)\s+(instructions|prompts|rules)/i,

      // System prompt manipulation (Portuguese)
      /ignore\s+(as|todas)?\s*(instru[çc][õo]es|regras|prompts)/i,
      /esque[çc]a\s+(as\s+|todas\s+|todas\s+as\s+)?(instru[çc][õo]es|regras)/i,
      /desconsidere\s+(as|todas)?\s*(instru[çc][õo]es|regras)/i,

      // Role manipulation (English)
      /you\s+are\s+now/i,
      /you\s+are\s+(now\s+)?(a|an)\s+(admin|administrator|developer|system)/i,
      /from\s+now\s+on/i,
      /new\s+(instructions|role|prompt)/i,
      /act\s+as\s+(a\s+)?(developer|admin|system)/i,

      // Role manipulation (Portuguese)
      /voc[êe]\s+(agora\s+)?[ée]\s+(um|uma)\s+(admin|administrador|desenvolvedor|sistema)/i,
      /a\s+partir\s+de\s+agora/i,
      /nova\s+(instru[çc][ãa]o|regra|fun[çc][ãa]o)/i,

      // Jailbreak attempts
      /dan\s+mode/i,
      /developer\s+mode/i,
      /god\s+mode/i,
      /jailbreak/i,

      // System command attempts
      /system\s*:/i,
      /assistant\s*:/i,
      /\[system\]/i,
      /\[assistant\]/i,

      // Encoding/obfuscation attempts
      /base64/i,
      /decode/i,
      /\\x[0-9a-f]{2}/i,
      /%[0-9a-f]{2}/i,

      // Prompt extraction (English)
      /show\s+(me\s+)?(your|the)\s+(prompt|instructions|system|rules)/i,
      /what\s+(are|is)\s+(your|the)\s+(prompt|instructions|system|rules)/i,
      /reveal\s+(your|the)\s+(prompt|instructions)/i,
      /(tell|give)\s+me\s+(your|the)\s+(prompt|instructions)/i,

      // Prompt extraction (Portuguese)
      /me\s+(diga|mostre|revele)\s+(seu|sua|o|a)\s+(prompt|instru[çc][ãa]o|sistema)/i,
      /qual\s+([ée]|s[ãa]o)\s+(seu|sua|suas|tuas?)\s+(instru[çc][õo]es?|prompt|regras?)/i,
      /sua\s+instru[çc][ãa]o/i,

      // SQL injection patterns (extra safety)
      /;\s*(drop|delete|insert|update)\s+/i,
      /union\s+select/i,
      /'.*or.*'.*=/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(message)) {
        return {
          allowed: false,
          reason: 'Desculpe, não entendi sua mensagem. Pode reformular?',
        };
      }
    }

    // Check for excessive special characters (possible obfuscation)
    const specialCharCount = (message.match(/[^\w\s\u00C0-\u017F]/g) || []).length;
    if (specialCharCount > message.length * 0.3) {
      logger.warn({ message, specialCharCount }, 'Excessive special characters');
      return {
        allowed: false,
        reason: 'Desculpe, não entendi sua mensagem. Pode reformular sem caracteres especiais?',
      };
    }

    // Check for repeated characters (flooding)
    if (/(.)
{10,}/.test(message)) {
      return {
        allowed: false,
        reason: 'Desculpe, não entendi sua mensagem. Pode reformular?',
      };
    }

    return { allowed: true };
  }

  /**
   * Sanitize input
   */
  private sanitizeInput(message: string): string {
    // eslint-disable-next-line no-control-regex
    let sanitized = message.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Remove potential HTML/script tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    return sanitized;
  }

  /**
   * Check for system prompt leaks in output
   */
  private containsSystemPromptLeak(output: string): boolean {
    const lowerOutput = output.toLowerCase();

    const leakPatterns = [
      'you are a',
      'your role is',
      'your instructions',
      'system prompt',
      'as an ai',
      'my programming',
      'i am programmed',
      'my instructions are',
      'openai',
      'gpt-',
      'language model',
    ];

    return leakPatterns.some(pattern => lowerOutput.includes(pattern));
  }

  /**
   * Check for inappropriate content in output
   */
  private containsInappropriateContent(output: string): boolean {
    // Basic content filtering
    const inappropriatePatterns = [
      // Violence
      /\b(kill|murder|attack|hurt|violence)\b/i,

      // Illegal activities
      /\b(steal|fraud|scam|hack)\b/i,

      // Personal information leaks (CPF pattern: XXX.XXX.XXX-XX)
      /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,

      // Common error messages that shouldn't reach users
      /\b(error|exception|stack trace|undefined|null pointer)\b/i,
    ];

    return inappropriatePatterns.some(pattern => pattern.test(output));
  }

  /**
   * LEGACY: Clean up old rate limit records (call periodically)
   * 
   * NOTA: Apenas necessário para legacy mode. RateLimitService gerencia próprio cleanup.
   */
  cleanupRateLimits(): void {
    // Se usando serviço distribuído, não precisa de cleanup manual
    if (this.rateLimitService && !this.useLegacyRateLimit) {
      return;
    }

    const now = Date.now();
    for (const [phone, record] of this.rateLimitMap.entries()) {
      if (now > record.resetAt) {
        this.rateLimitMap.delete(phone);
      }
    }
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStats(): {
    initialized: boolean;
    useDistributed: boolean;
    useLegacy: boolean;
    legacyKeysCount: number;
  } {
    return {
      initialized: this.initialized,
      useDistributed: !!this.rateLimitService && !this.useLegacyRateLimit,
      useLegacy: this.useLegacyRateLimit || !this.rateLimitService,
      legacyKeysCount: this.rateLimitMap.size,
    };
  }
}

// Singleton instance (lazy initialization)
let guardrailsInstance: GuardrailsService | null = null;

/**
 * Obtém instância singleton do GuardrailsService
 */
export async function getGuardrails(): Promise<GuardrailsService> {
  if (!guardrailsInstance) {
    guardrailsInstance = new GuardrailsService();
    await guardrailsInstance.initialize();
  }
  return guardrailsInstance;
}

/**
 * Reseta instância singleton (para testes)
 */
export function resetGuardrails(): void {
  guardrailsInstance = null;
}

// Legacy singleton para compatibilidade (não recomendado para novo código)
export const guardrails = new GuardrailsService();

// Cleanup rate limits every minute (apenas para legacy)
setInterval(() => {
  if (!guardrailsInstance || guardrailsInstance.getStats().useLegacy) {
    guardrails.cleanupRateLimits();
  }
}, 60000);
