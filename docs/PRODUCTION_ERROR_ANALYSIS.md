# 🔍 Análise de Erro em Produção

> Data: 2026-03-04  
> Erro: Falha no envio de mensagem WhatsApp após processamento de trade-in

---

## 📋 Resumo do Incidente

```
Horário: 19:15:58 UTC
Usuário: Enviou "Strada 2010 100 mil km rodados" (trade-in)
Resultado: ❌ Mensagem não entregue
Erro: "Failed to send message via Meta API"
```

---

## 🔍 Root Cause Analysis

### 1. Fluxo Duplicado Identificado ⚠️

O log mostra execução de **dois nós** para a mesma mensagem:

```
19:15:58.711686Z [inf] tradeInNode: Execution complete
19:15:58.711695Z [inf] negotiationNode: Execution complete  ← ❌ Não deveria executar
```

**Problema:** O `tradeInNode` estava retornando `next: 'negotiation'`, fazendo o grafo processar a mensagem novamente.

**Fix aplicado:** `trade-in.node.ts` agora retorna `next: 'end'`

---

### 2. Erro Meta API ❌

Possíveis causas:

| Causa | Probabilidade | Evidência |
|-------|---------------|-----------|
| **Rate limiting** | Alta | Mensagem enviada 3s antes (19:15:56) |
| **Timeout** | Média | Erro após 2-3s de processamento |
| **Token expirado** | Baixa | Outras mensagens funcionaram |
| **Mensagem muito longa** | Baixa | Sistema já trunca em 4096 chars |

---

## 🛠️ Correções Aplicadas

### Fix 1: Trade-in Node (COMMITADO)

**Arquivo:** `src/graph/nodes/trade-in.node.ts`

```typescript
// ANTES (problemático):
next: response.nextMode || 'negotiation',

// DEPOIS (corrigido):
next: 'end',  // Finaliza após processar trade-in
```

**Impacto:** Previne execução duplicada do negotiationNode.

---

### Fix 2: Melhor Logging (RECOMENDADO)

Adicionar no `whatsapp-meta.service.ts`:

```typescript
// Linha 376+: Melhor diagnóstico
catch (error: any) {
  const errorDetails = {
    status: error.response?.status,
    code: error.code,
    message: error.message,
    data: error.response?.data,
    // Novo: identificar tipo de erro
    isRateLimit: error.response?.status === 429,
    isAuthError: error.response?.status === 401,
    isTimeout: error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT',
  };
  
  logger.error(errorDetails, 'Meta API error details');
}
```

---

### Fix 3: Rate Limiting no WhatsApp (RECOMENDADO)

O WhatsApp Business API tem limites:
- **Tier 1:** 80 msgs/segundo
- **Tier 2:** 200 msgs/segundo  
- **Tier 3:** 1000 msgs/segundo

**Implementar backoff exponencial:**

```typescript
// Novo arquivo: src/lib/whatsapp-rate-limit.ts
export class WhatsAppRateLimiter {
  private sentTimestamps: number[] = [];
  private readonly windowMs = 1000; // 1 segundo
  private readonly maxPerSecond = 10; // Conservador

  async acquireSlot(): Promise<void> {
    const now = Date.now();
    this.sentTimestamps = this.sentTimestamps.filter(t => now - t < this.windowMs);
    
    if (this.sentTimestamps.length >= this.maxPerSecond) {
      const oldest = this.sentTimestamps[0];
      const wait = this.windowMs - (now - oldest);
      await new Promise(r => setTimeout(r, wait));
    }
    
    this.sentTimestamps.push(now);
  }
}
```

---

## 📊 Monitoramento

### Métricas para adicionar:

```prometheus
# Taxa de erro Meta API
rate(whatsapp_meta_send_errors_total[5m])

# Latência de envio
histogram_quantile(0.95, whatsapp_meta_send_latency_seconds_bucket)

# Retries
whatsapp_meta_send_retries_total
```

---

## ✅ Checklist de Deploy

- [x] Fix do trade-in node
- [ ] Adicionar logging detalhado
- [ ] Implementar rate limiting WhatsApp
- [ ] Configurar alerta para taxa de erro > 5%
- [ ] Testar em staging
- [ ] Deploy em produção

---

## 🔄 Testes Recomendados

```bash
# 1. Testar trade-in
curl -X POST https://seu-app.com/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5511999999999",
            "id": "test_001",
            "text": {"body": "Tenho Strada 2010 para troca"},
            "type": "text"
          }]
        }
      }]
    }]
  }'

# 2. Verificar logs
docker logs carinsight-app | grep -E "(tradeIn|negotiation|Failed)"
```

---

## 📞 Próximos Passos

1. **Deploy o fix do trade-in** (já commitado)
2. **Monitore os logs** por 24h
3. **Se erro persistir:** Implementar rate limiting e retry backoff

**Contato:** Se precisar de ajuda, verifique os logs em tempo real:
```bash
railway logs --tail
```
