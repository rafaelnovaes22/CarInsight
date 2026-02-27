# CarInsight — Skills & Reference Guide

> Assistente de vendas automotivas via WhatsApp com IA multi-agente.
> Stack: Node.js 20 · TypeScript · LangGraph · PostgreSQL + pgvector · OpenAI/Groq · Meta WhatsApp API

---

## Arquitetura

### Fluxo de Mensagem

```
WhatsApp → Webhook (Express) → Guardrails → LangGraph Graph → Resposta WhatsApp
                                   │
                          Rate Limit · Injection Detection · Sanitização
```

### LangGraph — Grafo de Conversação (7 Nodes)

```
[Greeting] → [Discovery] → [Search] → [Recommendation]
                                            │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                        [Financing]    [Trade-In]    [Negotiation]
                              └──────────────┼──────────────┘
                                             ▼
                                    (loop / handoff)
```

**Multi-Agent Pattern**: Cada node delega para um agente especializado. O `OrchestratorAgent` classifica a intenção e roteia entre os fluxos. Estado é persistido no PostgreSQL via `LangGraphCheckpoint`, permitindo time-travel debugging.

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 20+, TypeScript 5.3, tsx |
| API | Express.js (webhooks + REST) |
| Orquestração IA | LangGraph (state machine multi-agente) |
| LLM | OpenAI gpt-4.1-mini → Groq llama-3.1-8b → Mock |
| Embeddings | OpenAI text-embedding-3-small → Cohere multilingual-v3 |
| Banco | PostgreSQL 14+ com pgvector (Prisma ORM) |
| Cache | In-memory vectors + Redis (opcional) |
| Mensageria | Meta WhatsApp Business API + Evolution API (fallback) |
| Logging | Pino (structured JSON) |
| Observabilidade | LangSmith (tracing LLM) |
| Testes | Vitest + Playwright |
| Deploy | Railway (auto-deploy on main push) |
| CI/CD | GitHub Actions |

---

## LLM Routing

### Chat Completion

| Prioridade | Provider | Modelo | Custo/1M tokens | Ativado por |
|------------|----------|--------|-----------------|-------------|
| 1 (Primary) | OpenAI | gpt-4.1-mini | $0.40 in / $1.60 out | `OPENAI_API_KEY` |
| 2 (Fallback) | Groq | llama-3.1-8b-instant | $0.05 in / $0.08 out | `GROQ_API_KEY` |
| 3 (Dev) | Mock | — | $0 | Fallback automático |

### Embedding Generation

| Prioridade | Provider | Modelo | Dimensões | Custo/1M | Ativado por |
|------------|----------|--------|-----------|----------|-------------|
| 1 (Primary) | OpenAI | text-embedding-3-small | 1536 | $0.02 | `OPENAI_API_KEY` |
| 2 (Fallback) | Cohere | embed-multilingual-v3.0 | 1024→1536 | $0.01 | `COHERE_API_KEY` |
| 3 (Dev) | Mock | — | 1536 | $0 | Fallback automático |

> Cohere gera 1024 dimensões; padding com zeros até 1536 para compatibilidade com pgvector.

### Circuit Breaker

- **Threshold**: 3 falhas consecutivas abre o circuito
- **Timeout**: 60s antes de tentar recovery
- **Retry**: Até 2 retries por provider com backoff exponencial
- **Cascata**: Falha no primary → fallback → mock

### Mock Mode

Ativo quando API keys são `mock-key`. Retorna respostas contextuais baseadas no conteúdo da mensagem. Usado em dev e testes.

**Arquivos**: `src/lib/llm-router.ts`, `src/lib/embedding-router.ts`

---

## Banco de Dados (Prisma)

### Modelos Principais

| Modelo | Propósito | Campos-chave |
|--------|-----------|-------------|
| **Vehicle** | Veículos à venda | marca, modelo, versao, ano, km, preco, embedding (vector 1536), flags de aptidão (aptoUber, aptoFamilia...), scores (conforto, economia...), classificação |
| **Conversation** | Sessões de chat | phoneNumber, customerName, status (active/qualified/converted), currentStep |
| **Message** | Mensagens enviadas/recebidas | direction, content, processingTimeMs, tokenUsage, cost |
| **Recommendation** | Veículos recomendados | vehicleId, matchScore (0-100), reasoning, position, feedback do usuário |
| **Lead** | Leads qualificados | name, phone, budget, usage, interestedVehicles, status, CRM sync |
| **Event** | Eventos do sistema | eventType, metadata, timestamp |
| **LangGraphCheckpoint** | Estado do grafo | thread_id, checkpoint (JSON), metadata |
| **system_prompts** | Prompts dinâmicos | key, content, version |
| **UberEligibleVehicleRule** | Regras Uber | citySlug, category, brand, model, minYear |

### pgvector

Campo `embedding` (1536 dimensões) no modelo Vehicle. Busca semântica por similaridade de cosseno. Index otimizado para busca vetorial.

**Schema**: `prisma/schema.prisma`

---

## Agentes & Nodes

### Nodes do Grafo

| Node | Arquivo | Responsabilidade |
|------|---------|-----------------|
| **Greeting** | `src/graph/nodes/greeting.node.ts` | Saudação, extração de nome, detecção de correção de nome, roteamento inicial |
| **Discovery** | `src/graph/nodes/discovery.node.ts` | Extrai preferências (orçamento, uso, pessoas, tipo), decide se busca ou pergunta mais |
| **Search** | `src/graph/nodes/search.node.ts` | Busca híbrida (vetor + SQL), retorna top 3, fallback strategies |
| **Recommendation** | `src/graph/nodes/recommendation.node.ts` | Apresenta veículos com justificativas personalizadas, formato WhatsApp |
| **Financing** | `src/graph/nodes/financing.node.ts` | Simulação de financiamento, cenários de parcelas |
| **Trade-In** | `src/graph/nodes/trade-in.node.ts` | Avaliação preliminar de troca, integração com busca |
| **Negotiation** | `src/graph/nodes/negotiation.node.ts` | Perguntas pós-recomendação, detecção de handoff para humano |

### Agentes

| Agente | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| **OrchestratorAgent** | `src/agents/orchestrator.agent.ts` | Classifica intenção, roteia entre fluxos, fallback regex |
| **RecommendationAgent** | `src/agents/recommendation.agent.ts` | Ranking de veículos, fallback (ano/marca/categoria), explicações |
| **VehicleExpertAgent** | `src/agents/vehicle-expert.agent.ts` | Queries complexas, detalhes técnicos, avaliação de trade-in |
| **FinancingAgent** | `src/agents/financing.agent.ts` | Cálculos de financiamento, parcelas, taxas |
| **TradeInAgent** | `src/agents/trade-in.agent.ts` | Avaliação de veículos usados para troca |
| **PreferenceExtractorAgent** | `src/agents/preference-extractor.agent.ts` | Extração estruturada de preferências, entidades (orçamento, tipo) |

### VehicleExpert Sub-módulos

```
src/agents/vehicle-expert/
├── constants/system-prompt.ts    # System prompt do especialista
├── intent-detector.ts            # Classificação de intenção
├── handlers/                     # Handlers por tipo de intenção
├── processors/                   # Lógica complexa
├── formatters/                   # Formatação de respostas
├── assessors/readiness-assessor.ts  # Verifica se pode recomendar
└── extractors/                   # Utilitários de extração
```

---

## Serviços Principais

### Busca & Vetores

| Serviço | Propósito |
|---------|-----------|
| `vector-search.service.ts` | Busca semântica via embeddings |
| `exact-search.service.ts` | Busca SQL com filtros exatos |
| `exact-search-parser.service.ts` | NLP → filtros SQL |
| `vehicle-search-adapter.service.ts` | Interface unificada de busca |
| `in-memory-vector.service.ts` | Vector store in-memory |
| `src/lib/embeddings.ts` | Geração de embeddings |

### Ranking & Classificação

| Serviço | Propósito |
|---------|-----------|
| `vehicle-ranker.service.ts` | Re-ranking com LLM contextual |
| `deterministic-ranker.service.ts` | Ranking sem LLM (fallback) |
| `vehicle-classifier.service.ts` | Categorização de veículos |
| `category-classifier.service.ts` | Classificação por carroceria |
| `vehicle-aptitude-classifier.service.ts` | Flags de aptidão (Uber, família, trabalho) |
| `similarity-calculator.service.ts` | Score de similaridade |
| `brand-matcher.service.ts` | Match de nomes de marcas |

### Fallback & Resiliência

| Serviço | Propósito |
|---------|-----------|
| `fallback.service.ts` | Fallback em camadas: ano → marca → categoria → faixa de preço |
| `fallback-response-formatter.service.ts` | Formatação de resultados fallback |

### WhatsApp & Comunicação

| Serviço | Propósito |
|---------|-----------|
| `whatsapp-meta.service.ts` | Integração Meta WhatsApp Business API |
| `whatsapp-evolution.service.ts` | Evolution API (alternativa) |
| `whatsapp-factory.ts` | Factory para seleção de gateway |
| `conversational-handler.service.ts` | Fluxo principal de conversação |
| `message-handler-v2.service.ts` | Processamento de mensagens recebidas |
| `audio-transcription.service.ts` | Transcrição de áudio |

### Uber

| Serviço | Propósito |
|---------|-----------|
| `uber-eligibility-validator.service.ts` | Validação contra regras Uber |
| `uber-eligibility-agent.service.ts` | Validação agentic com LLM |
| `uber-rules-provider.service.ts` | Fetch de regras |
| `uber-rules-repository.service.ts` | Armazenamento/cache |
| `uber-rules-scraper.service.ts` | Scrape do site oficial |

### Recomendações & Feedback

| Serviço | Propósito |
|---------|-----------|
| `recommendation-analysis.service.ts` | Análise de qualidade |
| `recommendation-health-monitor.service.ts` | Monitoramento de saúde |
| `recommendation-metrics.service.ts` | Métricas de recomendação |
| `recommendation-evidence.service.ts` | Evidências para ranking |
| `recommendation-explainer.service.ts` | Geração de explicações |
| `feedback.service.ts` | Coleta de feedback do usuário |

### Guardrails & Segurança

| Serviço | Propósito |
|---------|-----------|
| `guardrails.service.ts` | Rate limiting, injection detection, sanitização, validação de output |

### Métricas & Observabilidade

| Serviço | Propósito |
|---------|-----------|
| `performance-metrics.service.ts` | Latência e token usage |
| `metrics.service.ts` | Métricas do sistema |

### Outros

| Serviço | Propósito |
|---------|-----------|
| `financing-simulator.service.ts` | Cálculos financeiros |
| `data-rights.service.ts` | Deleção LGPD |
| `admin-task-runner.service.ts` | Operações admin |
| `firecrawl.service.ts` | Web scraping API |
| `tavily-search.service.ts` | Web search API |

---

## Guardrails & Segurança

### Rate Limiting
- **10 mensagens/minuto** por usuário
- Backend: Redis (primário) → Map in-memory (fallback)

### Prompt Injection Detection
- 30+ patterns para PT-BR e EN
- Exemplos: "ignore previous instructions", "esqueça as regras anteriores", "ignore system prompt"

### Sanitização
- Remoção de caracteres de controle
- Bloqueio de injeção HTML
- Limite de entrada: 1000 caracteres

### Validação de Output
- Limite: 4096 caracteres (WhatsApp limit)
- Detecção de vazamento de system prompt
- Detecção de conteúdo inapropriado

### Compliance
- **ISO 42001**: Disclaimers automáticos ("Este é um assistente de IA, decisões devem ser verificadas")
- **LGPD**: Endpoint de deleção de dados via `data-rights.service.ts`

**Arquivo**: `src/services/guardrails.service.ts`

---

## Fluxos de Conversação

### Fluxo Principal

```
1. Saudação → Extração de nome
2. Discovery → Preferências (orçamento, uso, pessoas, tipo)
3. Search → Busca híbrida (vetor + SQL)
4. Recommendation → Top 3 veículos com justificativas
5. Negotiation → Perguntas, detalhes, financiamento
6. Handoff → Transferência para vendedor humano
```

### Guardrails de Orçamento e Entrada
- Detecção e validação de budget
- Simulação de financiamento com entrada (down payment)
- Alertas quando veículo excede orçamento

### Detecção de Intenção
- LLM classifica intenção (primary)
- Regex patterns (fallback)
- Intenções: saudação, busca, comparação, financiamento, troca, handoff, dúvida técnica

### Fallback Strategy
1. Busca exata falha → relaxa ano (±2 anos)
2. Ainda sem resultado → relaxa marca (similares)
3. Ainda sem → relaxa categoria
4. Último recurso → faixa de preço ampla

---

## Comandos NPM

### Desenvolvimento

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor dev com tsx watch |
| `npm run dev:api` | API test server sem WhatsApp |
| `npm run build` | Compilação TypeScript → dist/ |
| `npm start` | Produção (dist/index.js) |
| `npm run start:prod` | Produção via tsx |
| `npm run start:heroku` | Start otimizado para Heroku |

### Banco de Dados

| Comando | Descrição |
|---------|-----------|
| `npm run db:push` | Aplica schema Prisma |
| `npm run db:studio` | Abre Prisma Studio (UI) |
| `npm run db:seed` | Seed básico |
| `npm run db:seed:real` | Seed com dados reais (recomendado) |
| `npm run db:seed:renatinhu` | Seed Renatinhu |
| `npm run db:seed:complete` | Seed completo Renatinhu |
| `npm run db:seed:robustcar` | Seed RobustCar |
| `npm run db:migrate` | Executa migrations pendentes |

### Testes

| Comando | Descrição |
|---------|-----------|
| `npm test` | Vitest interativo |
| `npm run test:run` | Todos os testes (CI mode) |
| `npm run test:unit` | Apenas unit tests |
| `npm run test:integration` | Apenas integration |
| `npm run test:integration:llm` | Integration LLM |
| `npm run test:e2e` | End-to-end |
| `npm run test:coverage` | Com relatório de cobertura (target 80%+) |
| `npm run test:watch` | Watch mode |
| `npm run test:ui` | Dashboard Vitest UI |
| `npm run test:smoke` | Smoke tests |
| `npm run test:bot` | Teste do bot |
| `npm run test:guardrails` | Testes de segurança |
| `npm run test:new-number` | Teste novo número WhatsApp |

### Embeddings

| Comando | Descrição |
|---------|-----------|
| `npm run embeddings:generate` | Geração incremental |
| `npm run embeddings:regenerate` | Regenerar todos |
| `npm run embeddings:force` | Forçar regeneração total |
| `npm run embeddings:stats` | Estatísticas de embeddings |

### Veículos & Uber

| Comando | Descrição |
|---------|-----------|
| `npm run vehicles:update-uber` | Atualizar elegibilidade Uber |
| `npm run vehicles:update-uber-llm` | Atualizar via LLM |
| `npm run uber:scrape` | Scrape regras Uber |
| `npm run uber:batch` | Batch process regras |

### Conversas

| Comando | Descrição |
|---------|-----------|
| `npm run conversations:reset` | Reset conversas de teste |
| `npm run conversations:reset:all` | Reset TODAS as conversas ⚠️ |

### Qualidade de Código

| Comando | Descrição |
|---------|-----------|
| `npm run lint` | ESLint (strict, sem warnings) |
| `npm run lint:warn` | ESLint com warnings |
| `npm run lint:fix` | Auto-fix linting |
| `npm run format` | Prettier (repo inteiro) |
| `npm run format:check` | Verifica formatação |
| `npm run verify` | format + lint + unit tests |
| `npm run verify:strict` | format:check + lint + build + test:run |

### Deploy & Push

| Comando | Descrição |
|---------|-----------|
| `npm run push:safe` | verify:strict + push origin e novais |
| `npm run push:origin` | verify:strict + push origin |
| `npm run push:novais` | verify:strict + push novais |

### Benchmarking

| Comando | Descrição |
|---------|-----------|
| `npm run benchmark` | Benchmark completo |
| `npm run benchmark:single` | Benchmark cenário único |
| `npm run benchmark:llms` | Benchmark LLM providers |

### Heroku

| Comando | Descrição |
|---------|-----------|
| `npm run heroku-prebuild` | Pre-build step |
| `npm run heroku-postbuild` | Post-build (db:push + seed) |
| `npm run heroku-cleanup` | Cleanup |
| `npm run heroku-status` | Status da app |
| `npm run heroku-logs` | Stream de logs |
| `npm run heroku-open` | Abrir app no browser |

### Outros

| Comando | Descrição |
|---------|-----------|
| `npm run postinstall` | Auto-generate Prisma client |

---

## Antigravity Skills

6 skills disponíveis em `.antigravity/skills/`:

| Skill | Comando principal | Descrição |
|-------|------------------|-----------|
| **health-check** | `curl http://localhost:3000/admin/health` | Verifica status de API, DB, LLM Router, Embeddings |
| **reset-database** | `npm run db:push && npm run db:seed:real` | Reset e seed do banco ⚠️ destrutivo |
| **run-tests** | `npm run test:run` | Executa suite de testes (unit/integration/e2e) |
| **deploy-railway** | `git push origin main` | Deploy Railway com pre-flight checks |
| **regenerate-embeddings** | `npm run embeddings:generate` | Gera/regenera embeddings vetoriais |
| **reset-conversations** | `npm run conversations:reset` | Limpa histórico de conversas ⚠️ destrutivo |

---

## Testes

### Categorias (75+ arquivos, ~14.000 linhas)

| Categoria | Diretório | Propósito |
|-----------|-----------|-----------|
| **Unit** | `tests/unit/` | Lógica de serviços, utilitários, agents |
| **Integration** | `tests/integration/` | Interação entre componentes, webhooks, LLM real |
| **E2E** | `tests/e2e/` | Fluxos completos de conversação |
| **Guardrails** | `tests/e2e/security/` | Prompt injection, rate limiting |
| **Agents** | `tests/agents/` | Comportamento de agentes isolados |
| **Repro** | `tests/repro/` | Reprodução de bugs específicos |

### CI/CD Pipeline (`.github/workflows/ci.yml`)

**Jobs**:
1. **Test** (ubuntu-latest, PostgreSQL 14 + pgvector, Node 20)
   - `npm ci` → `prisma generate` → `db push` → unit → integration → e2e → coverage → Codecov
2. **Lint** — ESLint + Prettier + secret scanning (`gsk_*`, `sk-*`, `EAA*`)
3. **Build** (depende de test + lint) — `npm run build`, verifica dist/
4. **Deploy** (apenas main) — Railway CLI `railway up --detach --service faciliauto-mvp-v2`

---

## Configuração & Deploy

### Variáveis de Ambiente Essenciais

```env
# Core
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...  # opcional

# LLM Providers
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
COHERE_API_KEY=...

# WhatsApp (Meta)
META_WHATSAPP_TOKEN=EAA...
META_WHATSAPP_PHONE_NUMBER_ID=...
META_WHATSAPP_BUSINESS_ACCOUNT_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...

# WhatsApp (Evolution API - alternativa)
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE_NAME=...

# Observabilidade (LangSmith)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=carinsight
```

### Feature Flags

| Flag | Default | Descrição |
|------|---------|-----------|
| `ENABLE_CONVERSATIONAL_MODE` | `true` | Ativa LangGraph |
| `CONVERSATIONAL_ROLLOUT_PERCENTAGE` | `100` | Canary deployment (%) |
| `USE_SLM_EXPLANATIONS` | `false` | Small LLM para explicações |
| `SLM_EXPLANATIONS_ROLLOUT_PERCENTAGE` | `0` | Rollout SLM (%) |
| `ENABLE_AUDIO_TRANSCRIPTION` | `true` | Suporte a áudio |
| `AUDIO_MAX_DURATION_SECONDS` | `120` | Limite de duração de áudio |
| `ENABLE_WEBHOOK_TEST_ENDPOINT` | — | Endpoint debug de webhook |

### Deploy Railway

1. Push para `main` → CI/CD roda automaticamente
2. Jobs: test → lint → build → deploy
3. Deploy via Railway CLI: `railway up --detach --service faciliauto-mvp-v2`
4. Rollback: `git revert HEAD && git push`

**Validação**: `src/config/env.ts` (schema Zod)

---

## Padrões de Código

- **Encoding**: UTF-8 sem BOM
- **Formatação**: Prettier (auto-format)
- **Linting**: ESLint strict (zero warnings)
- **Git Hooks**: Husky (pre-commit: format + lint)
- **Logging**: Pino structured JSON, phone masking para LGPD
- **Validação**: Zod schemas para env vars e inputs
- **Testes**: Vitest, coverage target 80%+
- **Nomenclatura**: kebab-case para arquivos, camelCase para variáveis/funções
