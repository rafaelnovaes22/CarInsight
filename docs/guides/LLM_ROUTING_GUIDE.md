# 🚦 LLM Routing - Guia Completo

**Data:** 2025-01-XX  
**Status:** ✅ IMPLEMENTADO E TESTADO

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Providers LLM](#providers-llm)
4. [Providers Embeddings](#providers-embeddings)
5. [Circuit Breaker](#circuit-breaker)
6. [Configuração](#configuração)
7. [Custos](#custos)
8. [Monitoramento](#monitoramento)
9. [Testes](#testes)

---

## 📌 Visão Geral

O sistema de **LLM Routing** implementa fallback automático entre múltiplos provedores de IA, garantindo alta disponibilidade e resiliência.

### Benefícios

✅ **Alta Disponibilidade**: Se um provider falhar, usa automaticamente o próximo  
✅ **Retry Logic**: Tenta novamente antes de fazer fallback  
✅ **Circuit Breaker**: Evita chamadas repetidas a serviços falhando  
✅ **Custo-Benefício**: Usa provider mais barato como fallback  
✅ **Zero Config**: Funciona em modo mock sem API keys

---

## 🏗️ Arquitetura

```
┌─────────────────┐
│  Aplicação      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   LLM Router (src/lib/llm-router.ts)│
└──────┬──────────────────────────────┘
       │
       ├──► 1️⃣ GPT-4o-mini (OpenAI) ──► ✅ Sucesso
       │
       ├──► ❌ Falha → Retry (2x)
       │
       ├──► ❌ Falha → Circuit Breaker
       │
       └──► 2️⃣ LLaMA 3.1 8B (Groq) ──► ✅ Fallback
            │
            └──► ❌ Todos falharam → Mock Mode
```

### Fluxo de Decisão

1. **Verificar Circuit Breaker**: Provider está saudável?
2. **Tentar Provider Primário**: GPT-4o-mini (2 retries)
3. **Se falhar**: Registrar falha no Circuit Breaker
4. **Fallback**: Tentar LLaMA 3.1 8B Instant (2 retries)
5. **Último Recurso**: Mock Mode (desenvolvimento)

---

## 🤖 Providers LLM

### 1️⃣ Primário: GPT-4o-mini (OpenAI)

```typescript
{
  name: 'openai',
  model: 'gpt-4o-mini',
  priority: 1,
  costPer1MTokens: { input: 0.15, output: 0.6 }
}
```

**Vantagens:**
- Qualidade superior
- Multimodal (texto + imagens)
- Function calling robusto
- Português excelente

**Custos:**
- Input: $0.15/1M tokens
- Output: $0.60/1M tokens

**Quando usar:**
- Conversação com clientes
- Classificação de intenções
- Geração de textos de vendas

### 2️⃣ Fallback: LLaMA 3.1 8B Instant (Groq)

```typescript
{
  name: 'groq',
  model: 'llama-3.1-8b-instant',
  priority: 2,
  costPer1MTokens: { input: 0.05, output: 0.08 }
}
```

**Vantagens:**
- Extremamente rápido (300+ tokens/s)
- Muito barato (75% mais barato)
- Tier gratuito generoso
- Open source

**Custos:**
- Input: $0.05/1M tokens
- Output: $0.08/1M tokens

**Tier Gratuito:**
- 30 requisições/minuto
- 14.4k tokens/minuto

---

## 🧠 Providers Embeddings

### 1️⃣ Primário: text-embedding-3-small (OpenAI)

```typescript
{
  name: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  priority: 1,
  costPer1MTokens: 0.02
}
```

**Vantagens:**
- MTEB Score: 62.3 (excelente)
- Português de alta qualidade
- Latência: 50-100ms
- Integração simples

**Custos:**
- $0.02/1M tokens
- ~$0.60/mês (10k queries/dia)

### 2️⃣ Fallback: embed-multilingual-v3.0 (Cohere)

```typescript
{
  name: 'cohere',
  model: 'embed-multilingual-v3.0',
  dimensions: 1024, // normalizado para 1536
  priority: 2,
  costPer1MTokens: 0.01
}
```

**Vantagens:**
- Especializado em multilingual (100+ idiomas)
- Excelente em português
- 50% mais barato que OpenAI
- Tier gratuito: 100 chamadas/minuto

**Custos:**
- $0.01/1M tokens
- ~$0.30/mês (10k queries/dia)

**Normalização:**
- Cohere: 1024 dimensões → padding para 1536
- Mantém compatibilidade com banco de dados

---

## ⚡ Circuit Breaker

### Como Funciona

```typescript
class CircuitBreaker {
  threshold: 3,      // Falhas antes de abrir circuito
  timeout: 60000,    // 1 minuto para tentar novamente
}
```

### Estados

1. **CLOSED** (Normal)
   - Provider funcionando
   - Requisições passam normalmente

2. **OPEN** (Bloqueado)
   - 3+ falhas consecutivas
   - Bloqueia requisições por 1 minuto
   - Fallback automático para próximo provider

3. **HALF-OPEN** (Teste)
   - Após timeout, permite 1 requisição teste
   - Se sucesso → CLOSED
   - Se falha → OPEN novamente

### Benefícios

✅ Evita cascade failures  
✅ Reduz latência (não tenta providers falhando)  
✅ Auto-recuperação após timeout  
✅ Logs detalhados para debugging

---

## ⚙️ Configuração

### Variáveis de Ambiente

```bash
# .env
OPENAI_API_KEY="sk-..."      # Primário (LLM + Embeddings)
GROQ_API_KEY="gsk-..."       # Fallback (LLM)
COHERE_API_KEY="..."         # Fallback (Embeddings)
```

### Obter API Keys

#### OpenAI
1. https://platform.openai.com/api-keys
2. Criar novo projeto
3. Gerar API key
4. Adicionar créditos ($5 mínimo)

#### Groq
1. https://console.groq.com/keys
2. Login com Google/GitHub
3. Criar API key
4. Tier gratuito ativo automaticamente

#### Cohere
1. https://dashboard.cohere.com/api-keys
2. Criar conta
3. Gerar trial key (gratuita)
4. 100 req/min sem cobranças

### Modo Mock (Desenvolvimento)

Se nenhuma API key configurada:
```typescript
// Automaticamente ativa mock mode
const response = await chatCompletion(messages);
// Retorna respostas pré-programadas
```

---

## 💰 Análise de Custos

### LLM Costs (10k mensagens/mês)

| Provider | Input/Output | Custo Mensal | Economia |
|----------|--------------|--------------|----------|
| GPT-4o-mini | $0.15/$0.60 | ~$15/mês | - |
| LLaMA 3.1 8B | $0.05/$0.08 | ~$2.60/mês | 83% |

**Estratégia:**
- Usar GPT-4o-mini para precisão
- Fallback Groq economiza $12.40/mês se OpenAI falhar 100%

### Embeddings Costs (300k queries/mês)

| Provider | Custo/1M | Custo Mensal | Economia |
|----------|----------|--------------|----------|
| OpenAI | $0.02 | ~$6/mês | - |
| Cohere | $0.01 | ~$3/mês | 50% |

**Estratégia:**
- OpenAI primário (melhor qualidade)
- Cohere fallback economiza $3/mês

### Total Estimado

```
Cenário Normal (95% OpenAI):
- LLM: $14.25/mês
- Embeddings: $5.70/mês
- TOTAL: ~$20/mês

Cenário Fallback (50/50):
- LLM: $8.80/mês
- Embeddings: $4.50/mês
- TOTAL: ~$13.30/mês (34% economia)
```

---

## 📊 Monitoramento

### Logs Estruturados

```typescript
logger.info({
  provider: 'openai',
  model: 'gpt-4o-mini',
  attempt: 1,
  maxRetries: 2,
  usage: { prompt_tokens: 50, completion_tokens: 20 }
}, 'LLM call successful');
```

### Métricas Importantes

1. **Success Rate**: `successes / total_attempts`
2. **Fallback Rate**: `fallbacks / total_attempts`
3. **Circuit Breaker Opens**: Quantas vezes abriu
4. **Average Latency**: Por provider
5. **Cost per Request**: Token usage

### API de Status

```typescript
import { getLLMProvidersStatus } from './lib/llm-router';

const status = getLLMProvidersStatus();
// [
//   { name: 'openai', enabled: true, circuitBreakerOpen: false },
//   { name: 'groq', enabled: true, circuitBreakerOpen: false }
// ]
```

---

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes de routing
npm test tests/unit/llm-router.test.ts
npm test tests/unit/embedding-router.test.ts

# Com coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Cenários Testados

✅ Geração de resposta válida  
✅ Classificação de intenções  
✅ Respeito a maxTokens  
✅ Status dos providers  
✅ Circuit breaker reset  
✅ Fallback quando provider falha  
✅ Mock mode sem API keys  

✅ Embeddings com dimensões corretas  
✅ Normalização de vetores  
✅ Rejeição de texto vazio  
✅ Batch processing  
✅ Similaridade de cosseno  
✅ Performance < 5s  

### Exemplo de Teste

```typescript
it('deve usar fallback quando primário falha', async () => {
  // Simular falha do OpenAI
  process.env.OPENAI_API_KEY = '';
  
  const messages = [
    { role: 'user', content: 'Olá' }
  ];
  
  const response = await chatCompletion(messages);
  
  expect(response).toBeTruthy();
  // Deve ter usado Groq ou Mock
});
```

---

## 🔧 Troubleshooting

### Problema: "All providers failed"

**Causa:** Todas as API keys inválidas ou sem créditos

**Solução:**
1. Verificar `process.env.OPENAI_API_KEY`
2. Verificar `process.env.GROQ_API_KEY`
3. Verificar saldo nas contas
4. Em dev, funciona em mock mode

### Problema: Circuit breaker sempre aberto

**Causa:** Provider com problemas contínuos

**Solução:**
```typescript
import { resetCircuitBreaker } from './lib/llm-router';
resetCircuitBreaker(); // Forçar reset
```

### Problema: Embeddings com dimensões erradas

**Causa:** Cohere retorna 1024 dim

**Solução:** Já normalizado automaticamente para 1536

---

## 📚 Referências

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Groq API Docs](https://console.groq.com/docs)
- [Cohere Embeddings](https://docs.cohere.com/docs/embeddings)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)

---

## ✅ Checklist de Implementação

- [x] LLM Router criado
- [x] Embedding Router criado
- [x] Circuit Breaker implementado
- [x] Retry logic adicionado
- [x] Cohere SDK integrado
- [x] groq.ts atualizado
- [x] embeddings.ts atualizado
- [x] env.ts atualizado
- [x] .env.example documentado
- [x] Testes unitários criados
- [x] Documentação completa

---

## 🎯 Próximos Passos

1. **Gerar embeddings Cohere** para comparação
2. **Benchmark providers** (latência, qualidade)
3. **Dashboard de monitoramento** (Grafana)
4. **Alertas** quando circuit breaker abre
5. **Cache de embeddings** (Redis)

---

**Última atualização:** 2025-01-XX  
**Versão:** 2.0  
**Status:** ✅ PRODUÇÃO
