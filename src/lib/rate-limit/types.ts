/**
 * Rate Limiting Types
 *
 * Define as interfaces e tipos para o sistema de rate limiting distribuído.
 */

/**
 * Configuração de rate limiting
 */
export interface RateLimitConfig {
  /** Número máximo de requisições permitidas na janela */
  maxRequests: number;
  /** Duração da janela em milissegundos */
  windowMs: number;
  /** Nome identificador para métricas/logs */
  name?: string;
}

/**
 * Status atual do rate limiting para uma chave
 */
export interface RateLimitStatus {
  /** Se a requisição está permitida */
  allowed: boolean;
  /** Limite total da janela */
  limit: number;
  /** Requisições restantes na janela atual */
  remaining: number;
  /** Data/hora de reset da janela */
  resetAt: Date;
  /** Tempo em ms para tentar novamente (quando bloqueado) */
  retryAfterMs?: number;
  /** Número de requisições na janela atual */
  currentWindowCount: number;
}

/**
 * Store de rate limiting - interface para diferentes implementações
 */
export interface RateLimitStore {
  /**
   * Verifica se uma requisição está dentro do limite
   * @param key - Identificador único (ex: phone number)
   * @param config - Configuração de rate limiting
   * @returns Status do rate limiting
   */
  checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitStatus>;

  /**
   * Incrementa o contador sem verificar o limite (para tracking)
   * @param key - Identificador único
   * @param config - Configuração de rate limiting
   */
  increment(key: string, config: RateLimitConfig): Promise<void>;

  /**
   * Reseta o contador para uma chave específica
   * @param key - Identificador único
   */
  reset(key: string): Promise<void>;

  /**
   * Obtém estatísticas atuais sem incrementar
   * @param key - Identificador único
   * @param config - Configuração de rate limiting
   */
  getStats(
    key: string,
    config: RateLimitConfig
  ): Promise<{
    current: number;
    windowStart: number;
    resetAt: number;
  }>;

  /**
   * Verifica se a store está conectada/disponível
   */
  isHealthy(): Promise<boolean>;

  /**
   * Fecha a conexão (para cleanup)
   */
  close?(): Promise<void>;
}

/**
 * Métricas de rate limiting para observabilidade
 */
export interface RateLimitMetrics {
  /** Chave identificadora */
  key: string;
  /** Total de requisições verificadas */
  totalRequests: number;
  /** Total de requisições bloqueadas */
  blockedRequests: number;
  /** Média de requisições por janela */
  averageRequestsPerWindow: number;
  /** Pico de requisições em uma janela */
  peakRequestsInWindow: number;
  /** Timestamp da última requisição */
  lastRequestAt?: Date;
}

/**
 * Evento de rate limit para logging
 */
export interface RateLimitEvent {
  event: 'rate_limit_checked' | 'rate_limit_exceeded' | 'rate_limit_reset';
  key: string;
  allowed: boolean;
  limit: number;
  remaining: number;
  currentWindowCount: number;
  resetAt: Date;
  retryAfterMs?: number;
  timestamp: Date;
  storeType: 'redis' | 'memory';
}

/**
 * Opções para criação do RateLimitService
 */
export interface RateLimitServiceOptions {
  /** Store primária (Redis) */
  primaryStore?: RateLimitStore;
  /** Store de fallback (Memory) */
  fallbackStore?: RateLimitStore;
  /** Usar fallback automaticamente se primária falhar */
  autoFallback?: boolean;
  /** Logar eventos de rate limiting */
  enableLogging?: boolean;
  /** Exportar métricas Prometheus */
  enableMetrics?: boolean;
  /** Callback para eventos */
  onEvent?: (event: RateLimitEvent) => void;
}

/**
 * Estratégias de rate limiting suportadas
 */
export enum RateLimitStrategy {
  /** Fixed window - simples mas permite bursts nas bordas */
  FIXED_WINDOW = 'fixed_window',
  /** Sliding window - mais justo, distribui melhor as requisições */
  SLIDING_WINDOW = 'sliding_window',
  /** Token bucket - permite bursts controlados */
  TOKEN_BUCKET = 'token_bucket',
}

/**
 * Configuração por tipo de endpoint/recurso
 */
export interface RateLimitRules {
  /** Regra padrão */
  default: RateLimitConfig;
  /** Regras específicas por recurso */
  byResource: Map<string, RateLimitConfig>;
}
