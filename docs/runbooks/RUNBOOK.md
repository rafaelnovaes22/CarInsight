# CarInsight - Runbook de Troubleshooting

Este documento contém procedimentos para diagnosticar e resolver problemas comuns no CarInsight.

## Índice

1. [Bot Não Responde](#1-bot-não-responde)
2. [Leads Não Sendo Criados](#2-leads-não-sendo-criados)
3. [Recomendações Incorretas](#3-recomendações-incorretas)
4. [Erros de LLM/API](#4-erros-de-llmapi)
5. [Problemas de Performance](#5-problemas-de-performance)
6. [Verificação de Saúde](#6-verificação-de-saúde)

---

## 1. Bot Não Responde

### Sintomas
- Usuário envia mensagem no WhatsApp mas não recebe resposta
- Webhook recebe eventos mas não processa

### Diagnóstico

```bash
# 1. Verificar logs do servidor
npm run logs | grep -i error

# 2. Verificar status do webhook
curl -X GET "https://sua-url.railway.app/health"

# 3. Verificar conectividade com Meta API
curl -X GET "https://graph.facebook.com/v18.0/me?access_token=$WHATSAPP_TOKEN"
```

### Causas Comuns

| Causa | Verificação | Solução |
|-------|-------------|---------|
| Token WhatsApp expirado | Meta API retorna 401 | Renovar token no Meta Business |
| DATABASE_URL inválida | Prisma error nos logs | Verificar variável de ambiente |
| Webhook não configurado | Sem logs de entrada | Reconfigurar webhook no Meta |
| Servidor crashado | Railway mostra restart | Verificar logs de erro |

### Comandos de Verificação

```bash
# Testar banco de dados
npx prisma db pull

# Verificar variáveis de ambiente críticas
echo $DATABASE_URL | head -c 30
echo $OPENAI_API_KEY | head -c 10
echo $WHATSAPP_TOKEN | head -c 10
```

---

## 2. Leads Não Sendo Criados

### Sintomas
- Usuário pede "vendedor" mas lead não aparece no banco
- Flag `handoff_requested` não é setado

### Diagnóstico

```bash
# 1. Verificar últimos leads
npx prisma studio
# OU via SQL
SELECT * FROM "Lead" ORDER BY "createdAt" DESC LIMIT 10;

# 2. Verificar logs de criação
npm run logs | grep -i lead

# 3. Verificar flag nas conversas
SELECT id, "phoneNumber", "profileData" 
FROM "Conversation" 
WHERE "profileData" LIKE '%handoff%'
ORDER BY "startedAt" DESC LIMIT 5;
```

### Causas Comuns

| Causa | Verificação | Solução |
|-------|-------------|---------|
| Palavra-chave errada | Usuário usou termo não reconhecido | Verificar "vendedor", "humano", "atendente" |
| Duplicata bloqueada | Lead já existe para conversa | Verificar flag `lead_sent` |
| Erro no LangGraph | Logs mostram erro no node | Verificar discovery/negotiation nodes |
| Profile vazio | Dados incompletos | Verificar extração de preferências |

### Teste Manual

```bash
# Simular requisição de lead (via curl ou API test)
npm run test:e2e -- --grep "handoff"
```

---

## 3. Recomendações Incorretas

### Sintomas
- Bot recomenda veículos que não correspondem às preferências
- Match score baixo ou inconsistente

### Diagnóstico

```bash
# 1. Verificar embeddings
npm run db:embeddings status

# 2. Verificar veículos disponíveis
SELECT COUNT(*) FROM "Vehicle" WHERE disponivel = true;

# 3. Verificar critérios de busca nos logs
npm run logs | grep -i "SearchNode"
```

### Causas Comuns

| Causa | Verificação | Solução |
|-------|-------------|---------|
| Embeddings desatualizados | Última geração antiga | `npm run db:embeddings generate` |
| Veículos indisponíveis | Poucos resultados | Rodar scraping atualizado |
| Perfil extraído errado | Logs de discovery | Verificar prompts do VehicleExpert |
| Critérios Uber incorretos | Filtro aptoUber | `POST /admin/update-uber?llm=true` |

### Regenerar Embeddings

```bash
# Regenerar todos os embeddings
npm run db:embeddings generate

# Verificar status
npm run db:embeddings status
```

---

## 4. Erros de LLM/API

### Sintomas
- Respostas genéricas ou erros de timeout
- Logs mostram erros de OpenAI/Groq

### Diagnóstico

```bash
# 1. Verificar rate limits
npm run logs | grep -i "rate limit"

# 2. Verificar configuração de fallback
grep "LLM_PROVIDER" .env

# 3. Testar API diretamente
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Comportamento do Router

O sistema usa fallback automático:
1. **Primário**: OpenAI GPT-4
2. **Fallback 1**: Groq Mixtral
3. **Fallback 2**: Resposta genérica

### Verificar Circuit Breaker

```bash
# Verificar status do circuit breaker nos logs
npm run logs | grep -i "circuit"
```

---

## 5. Problemas de Performance

### Sintomas
- Respostas lentas (> 10s)
- Timeout de webhook

### Diagnóstico

```bash
# 1. Verificar latência dos nodes (novos logs de métricas)
npm run logs | grep "node_latency"

# 2. Verificar métricas admin
curl "https://sua-url.railway.app/admin/metrics?secret=$SEED_SECRET&period=24h"
```

### Métricas de Nodes

Os nodes LangGraph agora logam latência:

```json
{
  "node": "discovery",
  "latency_ms": 1234,
  "flags": ["recommendation_ready"],
  "success": true
}
```

### Otimizações

| Problema | Solução |
|----------|---------|
| Discovery lento | Verificar prompt size |
| Search lento | Verificar índices Prisma |
| Recommendation lento | Reduzir número de veículos |

---

## 6. Verificação de Saúde

### Health Check Rápido

```bash
# 1. API Health
curl https://sua-url.railway.app/health

# 2. Database
npx prisma db pull

# 3. Testes
npm run test:unit -- --run

# 4. Build
npm run build
```

### Métricas de Negócio

```bash
# Dashboard de métricas (últimas 24h)
curl "https://sua-url.railway.app/admin/metrics?secret=$SEED_SECRET"

# Métricas de 7 dias
curl "https://sua-url.railway.app/admin/metrics?secret=$SEED_SECRET&period=7d"
```

### Resposta Esperada

```json
{
  "success": true,
  "period": "24h",
  "conversations": { "total": 10, "active": 3 },
  "leads": { "total": 5, "conversionRate": 20.0 },
  "recommendations": { "total": 25, "avgScore": 75.5 },
  "messages": { "total": 50, "avgPerConversation": 5.0 }
}
```

---

## Contatos de Escalação

| Nível | Responsável | Quando |
|-------|-------------|--------|
| L1 | On-call dev | Erros básicos, reinícios |
| L2 | Tech Lead | Bugs críticos, dados |
| L3 | Arquiteto | Mudanças de infra, integrações |

---

## Variáveis de Ambiente Críticas

```bash
DATABASE_URL       # PostgreSQL connection string
OPENAI_API_KEY     # OpenAI API key
GROQ_API_KEY       # Groq fallback key
META_WHATSAPP_TOKEN # Meta WhatsApp token
EVOLUTION_API_URL  # Evolution API base URL
EVOLUTION_API_KEY  # Evolution API key
EVOLUTION_INSTANCE_NAME # Evolution instance name
SEED_SECRET        # Admin endpoint authentication
SALES_PHONE_NUMBER # Número para handoff de vendas
```

---

*Última atualização: 2026-01-16*
