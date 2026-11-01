# 📋 Plano de Implementação: Rate Limiting Distribuído

> **Status:** Draft  
> **Prioridade:** Alta  
> **Estimativa:** 2-3 dias  

---

## 🎯 Objetivo

Migrar o sistema de rate limiting de **in-memory (Map)** para **distribuído (Redis)**, permitindo que múltiplas instâncias da aplicação compartilhem o mesmo estado de rate limiting.

---

## 🔍 Análise do Estado Atual

### Problema
```typescript
// src/services/guardrails.service.ts
private rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

| Aspecto | Problema | Impacto |
|---------|----------|---------|
| **Escalabilidade** | Cada instância tem seu próprio Map | Rate limit não funciona com múltiplas instâncias |
| **Persistência** | Dados perdidos em restart | Usuários podem burlar limites após deploy |
| **Memória** | Sem expiração automática | Memory leak potencial em longo prazo |
| **Observabilidade** | Sem métricas centralizadas | Dificuldade de monitorar abusos |

### Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| **Redis + sliding window** | Preciso, escalável, persistente | Requer infraestrutura Redis | ✅ **Escolhida** |
| PostgreSQL + TTL | Reutiliza infra existente | Alto overhead para writes frequentes | ❌ |
| Memcached | Simples, rápido | Menos features que Redis, outro serviço | ❌ |
| In-memory + sticky sessions | Simples | Não resolve problema de verdade | ❌ |

---

## 🏗️ Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Rate Limiting Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │  Instance 1  │    │  Instance 2  │    │  Instance N  │                 │
│   │              │    │              │    │              │                 │
│   │ ┌──────────┐ │    │ ┌──────────┐ │    │ ┌──────────┐ │                 │
│   │ │Guardrails│ │    │ │Guardrails│ │    │ │Guardrails│ │                 │
│   │ │ Service  │ │    │ │ Service  │ │    │ │ Service  │ │                 │
│   │ └────┬─────┘ │    │ └────┬─────┘ │    │ └────┬─────┘ │                 │
│   │      │       │    │      │       │    │      │       │                 │
│   │ ┌────▼─────┐ │    │ ┌────▼─────┐ │    │ ┌────▼─────┐ │                 │
│   │ │  Redis   │◄┼────┼►│  Redis   │◄┼────┼►│  Redis   │ │                 │
│   │ │  Client  │ │    │ │  Client  │ │    │ │  Client  │ │                 │
│   │ └────┬─────┘ │    │ └────┬─────┘ │    │ └────┬─────┘ │                 │
│   └──────┼───────┘    └──────┼───────┘    └──────┼───────┘                 │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              ▼                                              │
│   ┌──────────────────────────────────────────────────────────────┐         │
│   │                    Redis Cluster / Single                    │         │
│   │  ┌────────────────────────────────────────────────────────┐  │         │
│   │  │  Keys:                                                 │  │         │
│   │  │  • ratelimit:{phone}:count   → Integer (INCR)          │  │         │
│   │  │  • ratelimit:{phone}:reset   → Timestamp (TTL)         │  │         │
│   │  │  • ratelimit:global:stats    → Hash (HINCRBY)          │  │         │
│   │  └────────────────────────────────────────────────────────┘  │         │
│   └──────────────────────────────────────────────────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Algoritmo: Sliding Window Counter

```
┌────────────────────────────────────────────────────────────┐
│                    Sliding Window                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Timeline:                                                 │
│  ───────────────────────────────────────────────────────►  │
│                                                            │
│  Window 1 (1 min)     Window 2 (1 min)                     │
│  ┌─────────────┐      ┌─────────────┐                      │
│  │ ▓▓▓▓░░░░░░░ │      │ ▓▓░░░░░░░░░ │                      │
│  │  4 reqs     │      │  2 reqs     │                      │
│  │  (limit: 10)│      │  (limit: 10)│                      │
│  └─────────────┘      └─────────────┘                      │
│                                                            │
│  Current Window Weight = 70% of current + 30% of previous  │
│  Smooth rate limiting prevents burst at window edges       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Arquivos

```
src/
├── services/
│   ├── guardrails.service.ts          # Atualizado para usar RateLimitService
│   └── rate-limit.service.ts          # Novo: Interface unificada
├── lib/
│   ├── redis.ts                       # Atualizar para conexão real
│   └── rate-limit/
│       ├── index.ts                   # Export principal
│       ├── types.ts                   # Interfaces
│       ├── redis-store.ts             # Implementação Redis
│       ├── memory-store.ts            # Implementação In-Memory (fallback)
│       └── sliding-window.ts          # Algoritmo sliding window
├── config/
│   └── env.ts                         # Adicionar REDIS_URL
└── tests/
    └── unit/
        └── rate-limit.service.test.ts # Testes
```

---

## 🔧 Implementação

### Fase 1: Configuração (30 min)

**1.1. Atualizar `.env.example`:**
```bash
# Redis Configuration
REDIS_URL="redis://localhost:6379"  # Opcional - fallback para memory se não definido
REDIS_RATE_LIMIT_TTL=60             # TTL em segundos (1 minuto)
RATE_LIMIT_MAX_REQUESTS=10          # Máximo de requisições por janela
RATE_LIMIT_WINDOW_MS=60000          # Janela em ms (1 minuto)
```

**1.2. Atualizar `src/config/env.ts`:**
```typescript
REDIS_URL: z.string().optional(),
REDIS_RATE_LIMIT_TTL: z.coerce.number().default(60),
RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),
RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
```

### Fase 2: Serviço de Rate Limiting (2-3 horas)

**2.1. Criar `src/lib/rate-limit/types.ts`:**

```typescript
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

export interface RateLimitStore {
  checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitStatus>;
  reset(key: string): Promise<void>;
  getStats(key: string): Promise<{ current: number; windowStart: number }>;
}
```

**2.2. Implementar `src/lib/rate-limit/redis-store.ts`:**

Usar estratégia de **Sliding Window** com Redis:

```lua
-- Sliding Window Lua Script para atomicidade
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Remover entradas fora da janela
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Contar requests na janela atual
local current = redis.call('ZCARD', key)

-- Verificar se pode prosseguir
if current < limit then
  -- Adicionar timestamp atual
  redis.call('ZADD', key, now, now .. ':' .. redis.call('INCR', key .. ':seq'))
  -- Setar TTL
  redis.call('EXPIRE', key, math.ceil(window / 1000))
  return {1, limit - current - 1, current + 1}
else
  -- Calcular retry after
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = (oldest[2] + window) - now
  return {0, 0, current, retryAfter}
end
```

**2.3. Implementar `src/lib/rate-limit/memory-store.ts`:**

Fallback quando Redis não disponível.

**2.4. Criar `src/services/rate-limit.service.ts`:**

Service unificado que escolhe entre Redis/Memory baseado na configuração.

### Fase 3: Integração (1 hora)

**3.1. Atualizar `GuardrailsService`:**

```typescript
export class GuardrailsService {
  constructor(
    private rateLimitService: RateLimitService,
    private config: RateLimitConfig
  ) {}

  private async checkRateLimit(phoneNumber: string): Promise<GuardrailResult> {
    const status = await this.rateLimitService.checkLimit(
      `whatsapp:${phoneNumber}`,
      this.config
    );

    if (!status.allowed) {
      return {
        allowed: false,
        reason: `Limite de mensagens atingido. Aguarde ${Math.ceil(
          (status.retryAfterMs || 0) / 1000
        )} segundos.`,
      };
    }

    return { allowed: true };
  }
}
```

### Fase 4: Testes (2-3 horas)

**4.1. Testes Unitários:**
- Mock do Redis
- Testar sliding window logic
- Testar fallback para memory

**4.2. Testes de Integração:**
- Testar com Redis real (testcontainer)
- Testar concorrência (múltiplas requisições simultâneas)

**4.3. Testes E2E:**
- Enviar 10+ mensagens rapidamente
- Verificar bloqueio
- Verificar liberação após janela

---

## 📊 Métricas e Observabilidade

### Métricas a serem coletadas:

```typescript
// Métricas por endpoint de rate limit
interface RateLimitMetrics {
  key: string;
  totalRequests: number;
  blockedRequests: number;
  averageRequestsPerWindow: number;
  peakRequestsInWindow: number;
}
```

### Logs estruturados:

```typescript
logger.info({
  event: 'rate_limit_checked',
  key: maskedPhoneNumber,
  allowed: status.allowed,
  remaining: status.remaining,
  limit: status.limit,
  resetAt: status.resetAt,
});

logger.warn({
  event: 'rate_limit_exceeded',
  key: maskedPhoneNumber,
  retryAfterMs: status.retryAfterMs,
  currentWindow: currentCount,
});
```

---

## 🚀 Plano de Rollout

### Etapa 1: Feature Flag (Opcional)

```typescript
// Permitir rollback rápido
if (env.USE_REDIS_RATE_LIMIT) {
  rateLimitStore = new RedisRateLimitStore();
} else {
  rateLimitStore = new MemoryRateLimitStore();
}
```

### Etapa 2: Deploy Progressivo

| Ambiente | Ação | Verificação |
|----------|------|-------------|
| Dev | Deploy com Redis | Testes automatizados passam |
| Staging | Deploy + carga | Rate limit funciona com múltiplas instâncias |
| Produção | Deploy gradual | Métricas de erro < 0.1% |

### Etapa 3: Monitoramento

```yaml
# Alertas (exemplo Prometheus/Grafana)
- name: RateLimitErrors
  condition: rate(rate_limit_errors_total[5m]) > 0.01
  
- name: RedisConnectionLost
  condition: redis_connected == 0
  action: Fallback para memory (alertar)
```

---

## 🧪 Testes de Carga

```bash
# Script de teste com k6
k6 run --vus 50 --duration 1m rate-limit-test.js
```

```javascript
// rate-limit-test.js
import http from 'k6/http';

export default function () {
  // Simular 50 usuários enviando 15 mensagens cada
  const phoneNumber = `551199999${__VU.toString().padStart(4, '0')}`;
  
  for (let i = 0; i < 15; i++) {
    http.post('http://localhost:3000/webhooks/whatsapp', {
      from: phoneNumber,
      message: 'Test message ' + i,
    });
  }
}
```

**Expectativa:**
- 10 primeiras mensagens: HTTP 200
- 5 últimas mensagens: HTTP 429 (Too Many Requests)

---

## 📋 Checklist de Implementação

- [ ] Fase 1: Configuração
  - [ ] Atualizar `.env.example`
  - [ ] Atualizar `src/config/env.ts`
  - [ ] Documentar variáveis

- [ ] Fase 2: Serviço
  - [ ] Criar interfaces/types
  - [ ] Implementar Redis store
  - [ ] Implementar Memory store (fallback)
  - [ ] Criar RateLimitService
  - [ ] Implementar sliding window

- [ ] Fase 3: Integração
  - [ ] Atualizar GuardrailsService
  - [ ] Adicionar injeção de dependência
  - [ ] Remover Map antigo

- [ ] Fase 4: Testes
  - [ ] Testes unitários
  - [ ] Testes de integração
  - [ ] Testes E2E
  - [ ] Teste de carga

- [ ] Fase 5: Deploy
  - [ ] Deploy staging
  - [ ] Validar com múltiplas instâncias
  - [ ] Deploy produção
  - [ ] Monitorar métricas

---

## 🔮 Melhorias Futuras

1. **Rate Limit por IP**: Adicionar proteção adicional
2. **Rate Limit Global**: Limitar total de requisições do sistema
3. **Rate Limit por Endpoint**: Diferentes limites para webhooks vs admin
4. **Circuit Breaker para Redis**: Fallback automático se Redis falhar
5. **Distributed Rate Limiting**: Consistent hashing para Redis cluster

---

## 📚 Referências

- [Redis Rate Limiting Patterns](https://redis.io/glossary/rate-limiting/)
- [Sliding Window Algorithm](https://medium.com/@sahilgulati007/sliding-window-rate-limiter-in-redis-7034972979de)
- [Token Bucket vs Sliding Window](https://blog.logrocket.com/rate-limiting-node-js/)
