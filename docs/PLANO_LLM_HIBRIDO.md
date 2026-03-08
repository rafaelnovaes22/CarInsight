# Plano: Arquitetura LLM Híbrida (Gemini + GPT)

## Objetivo

Implementar roteamento inteligente entre **Gemini 2.5 Flash** (rápido e barato) e **GPT-4.1 Mini** (preciso em instruction following), escolhendo o modelo ideal conforme o tipo de tarefa. Groq permanece como fallback de emergência.

---

## Racional estratégico

| Tarefa | Modelo ideal | Motivo |
|---|---|---|
| Saudação, FAQ, info de estoque | Gemini 2.5 Flash | Resposta rápida, custo baixo, tarefa simples |
| Busca semântica / recomendação | Gemini 2.5 Flash | Benchmarks superiores, velocidade |
| Cálculo de financiamento | Gemini 2.5 Flash (thinking) | Benchmark AIME 88% vs 49.6%, modo reasoning |
| Negociação / handoff | GPT-4.1 Mini | Melhor instruction following, controle da persona |
| Extração de preferências | GPT-4.1 Mini | Precisa seguir schema JSON com fidelidade |
| Follow-up / reengajamento | Gemini 2.5 Flash | Custo baixo, alto volume, tarefa simples |
| Classificação de intenção | Gemini 2.5 Flash | Rápido, barato, não precisa de persona |

**Economia projetada:** ~50% de redução no custo de LLM (maioria das chamadas migra para Gemini)
**Velocidade:** Respostas ~3x mais rápidas nas tarefas delegadas ao Gemini

---

## Arquitetura de prioridades

```
Tarefa simples (FAQ, saudação, busca, follow-up):
  Gemini 2.5 Flash → GPT-4.1 Mini → Groq → Mock

Tarefa complexa (negociação, extração, handoff):
  GPT-4.1 Mini → Gemini 2.5 Flash → Groq → Mock

Cálculo (financiamento, precificação):
  Gemini 2.5 Flash (thinking) → GPT-4.1 Mini → Mock
```

O circuit breaker existente já garante fallback automático se qualquer provider falhar.

---

## Fases de implementação

### Fase 1 — Adicionar Gemini como provider (sem mudar roteamento)

**Objetivo:** Gemini funciona como fallback alternativo ao Groq. Zero impacto na experiência atual.

**Arquivos a alterar:**
- `src/config/env.ts` — adicionar `GEMINI_API_KEY`
- `src/lib/llm-router.ts` — adicionar provider Gemini
- `tests/unit/llm-router.test.ts` — testes do novo provider

**Passos:**

1. Instalar SDK do Google
```bash
npm install @google/generative-ai
```

2. Adicionar variável de ambiente em `src/config/env.ts`
```typescript
GEMINI_API_KEY: z.string().optional().default('gemini-mock-key'),
```

3. Inicializar cliente Gemini em `src/lib/llm-router.ts`
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY || 'gemini-mock-key');
```

4. Adicionar ao registry `LLM_PROVIDERS` com prioridade 2 (entre OpenAI e Groq)
```typescript
{
  name: 'gemini',
  model: 'gemini-2.5-flash',
  enabled: !!env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'gemini-mock-key',
  priority: 2,
  costPer1MTokens: { input: 0.15, output: 0.6 },
}
```

5. Criar função `callGemini()` seguindo o padrão de `callOpenAI`/`callGroq`
   - Converter `ChatMessage[]` para formato Gemini (system prompt como `systemInstruction`)
   - Mapear response para `{ content, usage, model }`
   - Wrapping com `traceable` para observabilidade LangSmith

6. Adicionar branch no dispatch de providers em `chatCompletion()`

7. Atualizar testes unitários

8. Adicionar `GEMINI_API_KEY` no Railway

**Validação:** `npm run verify:strict` passa. Deploy no Railway. Logs mostram Gemini disponível mas OpenAI ainda é primário.

---

### Fase 2 — Roteamento por tipo de tarefa

**Objetivo:** Cada chamada ao LLM indica o tipo de tarefa. O router escolhe o provider ideal.

**Arquivos a alterar:**
- `src/lib/llm-router.ts` — adicionar `taskType` às options
- Todos os callers que usam `chatCompletion()` — passar `taskType`

**Passos:**

1. Estender `LLMRouterOptions` com campo `taskType`
```typescript
export type TaskType = 'simple' | 'complex' | 'calculation';

export interface LLMRouterOptions {
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  timeout?: number;
  taskType?: TaskType;  // novo
}
```

2. Criar mapeamento de prioridades por tipo de tarefa
```typescript
const TASK_PRIORITY: Record<TaskType, string[]> = {
  simple:      ['gemini', 'openai', 'groq'],
  complex:     ['openai', 'gemini', 'groq'],
  calculation: ['gemini', 'openai', 'groq'],  // gemini com thinking
};
```

3. Alterar `chatCompletion()` para ordenar providers pela `taskType`

4. Anotar cada caller com o tipo de tarefa adequado:

| Caller | Arquivo | taskType |
|---|---|---|
| GreetingNode | `src/graph/nodes/greeting.ts` | `simple` |
| DiscoveryNode (vehicle expert) | `src/graph/nodes/discovery.ts` | `simple` |
| RecommendationNode | `src/graph/nodes/recommendation/` | `simple` |
| NegotiationNode | `src/graph/nodes/negotiation.ts` | `complex` |
| FinancingAgent | `src/agents/financing.agent.ts` | `calculation` |
| PreferenceExtractor | `src/agents/preference-extractor.agent.ts` | `complex` |
| CategoryClassifier | `src/services/category-classifier.service.ts` | `simple` |
| FollowUpService | `src/services/follow-up.service.ts` | `simple` |

5. Atualizar testes para validar roteamento por taskType

**Validação:** Logs mostram distribuição de chamadas entre providers. Verificar que negociação usa GPT e FAQ usa Gemini.

---

### Fase 3 — Thinking mode para cálculos

**Objetivo:** Ativar modo reasoning do Gemini para simulação de financiamento e precificação.

**Passos:**

1. Na função `callGemini()`, detectar `taskType === 'calculation'` e ativar thinking:
```typescript
generationConfig: {
  temperature: options.temperature ?? 0.3,
  maxOutputTokens: options.maxTokens ?? 500,
  thinkingConfig: taskType === 'calculation'
    ? { thinkingBudget: 1024 }
    : undefined,
}
```

2. Ajustar custos no cálculo quando thinking está ativo ($0.30 input / $2.50 output)

3. Testar com prompts de simulação de financiamento (juros, parcelas, entrada)

**Validação:** Comparar precisão de cálculos financeiros entre Gemini (thinking) vs GPT-4.1 Mini.

---

### Fase 4 — Métricas e otimização

**Objetivo:** Dashboard de custo, velocidade e qualidade por provider/tarefa.

**Passos:**

1. Adicionar métricas Prometheus por provider:
   - `llm_request_duration_seconds{provider, task_type}`
   - `llm_request_cost_dollars{provider, task_type}`
   - `llm_tokens_total{provider, direction}` (input/output)
   - `llm_fallback_total{from_provider, to_provider}`

2. Criar endpoint `/api/llm-stats` no dashboard com:
   - Custo total por provider/mês
   - Distribuição de chamadas por provider
   - Latência p50/p95 por provider
   - Taxa de fallback

3. Após 2 semanas de dados, ajustar prioridades com base em dados reais

**Validação:** Dashboard mostra economia real vs. baseline (tudo no GPT-4.1 Mini).

---

## Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Gemini não segue persona do vendedor | Resposta fora do tom | Só usar em tarefas simples (Fase 2); GPT para persona |
| API do Google instável/descontinuada | Queda do serviço | Circuit breaker + fallback automático para GPT |
| Formato de mensagem incompatível | Erro em runtime | Adapter layer com testes e2e na Fase 1 |
| Custo do thinking mode sobe | Estouro de budget | Limitar thinkingBudget e monitorar na Fase 4 |
| Português BR inferior no Gemini | Respostas estranhas | Testes A/B com mensagens reais antes de produção |

---

## Cronograma estimado

| Fase | Escopo | Esforço |
|---|---|---|
| **Fase 1** | Gemini como provider + fallback | ~4h dev + testes |
| **Fase 2** | Roteamento por taskType | ~6h dev + testes |
| **Fase 3** | Thinking mode para cálculos | ~2h dev + testes |
| **Fase 4** | Métricas e dashboard | ~4h dev |
| **Total** | | **~16h de desenvolvimento** |

---

## Resultado esperado

| Métrica | Antes (só GPT) | Depois (híbrido) |
|---|---|---|
| Custo LLM/mês (1000 conversas) | ~$6.80 | ~$3.40 (-50%) |
| Latência média de resposta | ~1.5s | ~0.8s (-47%) |
| Precisão em cálculos | Baseline | +30% (thinking mode) |
| Resiliência (providers disponíveis) | 2 (OpenAI + Groq) | 3 (+ Gemini) |
| Instruction following (negociação) | Bom | Mantido (GPT para tarefas complexas) |
