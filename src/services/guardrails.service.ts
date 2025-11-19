import { logger } from '../lib/logger';
import { autoAddDisclaimers } from '../config/disclosure.messages';

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  sanitizedInput?: string;
}

export class GuardrailsService {
  // Maximum message length
  private readonly MAX_MESSAGE_LENGTH = 1000;
  
  // Maximum messages per minute per user
  private readonly MAX_MESSAGES_PER_MINUTE = 10;
  
  // Rate limiting storage (in production, use Redis)
  private rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  /**
   * Validate incoming user message
   */
  validateInput(phoneNumber: string, message: string): GuardrailResult {
    // 1. Check rate limiting
    const rateLimitCheck = this.checkRateLimit(phoneNumber);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck;
    }

    // 2. Check message length
    if (message.length > this.MAX_MESSAGE_LENGTH) {
      logger.warn({ phoneNumber, length: message.length }, 'Message too long');
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
      logger.warn({ phoneNumber, message }, 'Prompt injection detected');
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
   * Rate limiting check
   */
  private checkRateLimit(phoneNumber: string): GuardrailResult {
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
      logger.warn({ phoneNumber, count: record.count }, 'Rate limit exceeded');
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
    const lowerMessage = message.toLowerCase();

    // Common prompt injection patterns
    const injectionPatterns = [
      // System prompt manipulation
      /ignore\s+(previous|above|all)\s+(instructions|prompts|rules)/i,
      /forget\s+(previous|above|all)\s+(instructions|prompts|rules)/i,
      /disregard\s+(previous|above|all)\s+(instructions|prompts|rules)/i,
      
      // Role manipulation
      /you\s+are\s+now/i,
      /from\s+now\s+on/i,
      /new\s+(instructions|role|prompt)/i,
      /act\s+as\s+(a\s+)?(developer|admin|system)/i,
      
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
      
      // Prompt extraction
      /show\s+(me\s+)?(your|the)\s+(prompt|instructions|system|rules)/i,
      /what\s+(are|is)\s+(your|the)\s+(prompt|instructions|system|rules)/i,
      /reveal\s+(your|the)\s+(prompt|instructions)/i,
      
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
    if (/(.)\1{10,}/.test(message)) {
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
    // Remove control characters
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
    const lowerOutput = output.toLowerCase();

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
   * Clean up old rate limit records (call periodically)
   */
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [phone, record] of this.rateLimitMap.entries()) {
      if (now > record.resetAt) {
        this.rateLimitMap.delete(phone);
      }
    }
  }
}

// Singleton instance
export const guardrails = new GuardrailsService();

// Cleanup rate limits every minute
setInterval(() => guardrails.cleanupRateLimits(), 60000);
