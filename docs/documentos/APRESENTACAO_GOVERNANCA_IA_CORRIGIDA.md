# GOVERNANCA DE IA NA PRATICA: Do Conceito ao Codigo

**Estudo de Caso: Projeto CarInsight** (Atendimento Automotivo via WhatsApp)

> **Escopo desta avaliacao.** Este documento cobre os **7 pilares tecnicos** implementados em codigo (Anexo A da norma). O **sistema de gestao (AIMS)** que envolve esses controles foi implantado em 2026-07-29 e vive em **`governance/`**: politica de IA, RACI, inventario, registro de riscos, AIIA, objetivos, model cards, fornecedores, procedimento de incidente, auditoria interna e analise critica. Parte dele e **verificada em CI** (`npm run governance`).
>
> **Status honesto: AIMS implantado e auditado internamente, sem certificacao externa.** Certificar exige organismo acreditado e auditoria de estagio 1 e 2. Ver `governance/README.md` para a rastreabilidade clausula -> artefato -> evidencia, e `governance/NONCONFORMITY.md` para o que foi encontrado de errado no caminho.

---

## OS 7 PILARES DE GOVERNANCA IMPLEMENTADOS

---

### 1. TRANSPARENCIA E DISCLOSURE

**Alinhamento:** Transparency (ISO 42001 / EU AI Act)

**Controles Implementados:**

- Disclosure de IA em todos os pontos de contato (5 cenarios de greeting, follow-ups, LGPD, exit)
- Mensagens de limitacao do sistema e possibilidade de transferencia para humano
- Disclaimers automaticos de preco e recomendacao
- AI disclosure em mensagens de follow-up (abandoned cart, pos-recomendacao, pos-venda, referral)
- AI disclosure em respostas LGPD (exclusao, exportacao, cancelamento)
- Politica de privacidade publica com secao especifica sobre uso de IA

**Evidencias Verificadas:**

- `src/config/disclosure.messages.ts` — Central de mensagens de disclosure (ISO 42001)
- `src/graph/nodes/greeting.node.ts` — 5 cenarios com disclosure obrigatorio
- `src/services/follow-up.service.ts` — 10 templates com aviso de IA
- `src/services/message-handler-v2.service.ts` — Welcome, restart e exit com disclosure
- `src/services/message-handler-v2/data-rights-commands.service.ts` — Respostas LGPD com aviso
- `src/services/guardrails.service.ts` — Auto-disclaimers de preco e recomendacao
- `src/public/privacy-policy.html` — Politica publica

**Nota:** O system prompt foi atualizado de "NUNCA mencione que e IA" para "SIGA a politica de transparencia do sistema", eliminando a inconsistencia entre disclosure e prompt base.

---

### 2. SUPERVISAO HUMANA E HANDOFF

**Alinhamento:** Human Oversight (ISO 42001 / EU AI Act)

**Controles Implementados:**

- Deteccao de intencao de falar com humano (keywords com confianca alta/media)
- Flag `handoff_requested` propagada no estado conversacional
- Criacao automatica de Lead para vendedor no momento do handoff
- **Handoff automatico** via node `auto_handoff` quando circuit breakers disparam:
  - Loop tecnico >= 8 iteracoes
  - Erros acumulados >= 5
  - Estagnacao de fibra conversacional >= 6
- Mensagem de escalacao com AI disclosure + link WhatsApp do consultor
- A IA nunca encerra silenciosamente — sempre oferece saida para humano

**Evidencias Verificadas:**

- `src/utils/handoff-detector.ts` — Deteccao por keyword (alta/media confianca)
- `src/graph/nodes/recommendation/handlers/handoff-handler.ts` — Handoff por solicitacao
- `src/graph/workflow.ts` — Node `auto_handoff` + 3 circuit breakers redirecionando
- `src/services/message-handler-v2.service.ts` — Criacao de lead no handoff

---

### 3. SEGURANCA E GUARDRAILS

**Alinhamento:** Technical Robustness / Safety (ISO 42001 / EU AI Act)

**Controles Implementados:**

- Deteccao de prompt injection em PT-BR e EN (25+ padroes)
- Bloqueio de extracao de system prompt
- Sanitizacao de input (controle de caracteres, HTML, scripts)
- Bloqueio de PII e erros tecnicos na saida
- Validacao de output (limite 4096 chars para WhatsApp)
- Rate limiting por telefone (10 msgs/60s) com Redis + fallback in-memory
- Deteccao de ofuscacao (base64, hex, caracteres repetidos)

**Evidencias Verificadas:**

- `src/services/guardrails.service.ts` — 485 linhas, 25+ padroes de injection
- `src/services/rate-limit.service.ts` — Rate limiting distribuido
- `tests/e2e/security/guardrails.test.ts` — Testes dedicados de seguranca

---

### 4. PRIVACIDADE E DIREITOS DE DADOS

**Alinhamento:** Data Governance / Privacy (LGPD / EU AI Act)

**Controles Implementados:**

- Comandos conversacionais LGPD: exclusao e exportacao de dados
- Confirmacao explicita antes da exclusao (com timeout de 5 min)
- Mascaramento de **telefone, e-mail e nome** nos logs (`maskPhoneNumber`, `maskEmail`, `maskName`, `maskSensitiveFields`). E masking de log, nao anonimizacao. Estendido em 2026-07-29: antes cobria so telefone e preservava 6 digitos, hoje preserva 4
- Logs de auditoria de solicitacoes de dados
- Exclusao transacional (FollowUp, Message, Event, Recommendation, Lead, Conversation)
- Limpeza automatica de dados inativos (90 dias), **agendada de fato** em `src/jobs/data-retention.job.ts` desde 2026-07-29. Antes o metodo existia sem nada chama-lo: ver NC-002 em `governance/NONCONFORMITY.md`
- Opt-out de follow-up ("Digite PARAR")
- AI disclosure em todas as respostas LGPD

**Evidencias Verificadas:**

- `src/services/data-rights.service.ts` — 329 linhas, delete + export + audit
- `src/services/message-handler-v2/data-rights-commands.service.ts` — Comandos conversacionais
- `src/lib/privacy.ts` — `maskPhoneNumber` para logs e traces
- `src/public/privacy-policy.html` — Politica publica com direitos do titular

---

### 5. RASTREABILIDADE E AUDITORIA

**Alinhamento:** Accountability / Traceability (ISO 42001 / EU AI Act)

**Controles Implementados:**

- Mensagens de entrada e saida persistidas com timestamp
- Tempo de processamento por mensagem (ms)
- Token usage e custo estimado (USD) persistidos em banco por mensagem
- Eventos de conversa (inicio, quiz completo, handoff, etc.)
- Recomendacoes salvas com score, posicao, explicacao e feedback
- Checkpoints do LangGraph para reconstrucao de estado
- Logs estruturados (Pino JSON) com eventos de negocio e masking LGPD

**Evidencias Verificadas:**

- `prisma/schema.prisma` — Model Message com campos `tokenUsage` (Json) e `cost` (Float)
- `src/services/message-handler-v2/persistence.service.ts` — Persistencia de tokens e custo
- `src/graph/persistence/prisma-saver.ts` — Checkpoints LangGraph
- `src/lib/logger.ts` — Pino structured JSON com phone masking

---

### 6. ROBUSTEZ E RESILIENCIA

**Alinhamento:** Resilience / Technical Robustness (ISO 42001 / EU AI Act)

**Controles Implementados:**

- Roteamento multi-LLM: OpenAI (gpt-4.1-mini) -> Gemini (2.5 Flash) -> Groq (Llama 3.1) -> Mock
- Circuit breaker por provedor (3 falhas -> abre por 60s)
- Fallback para modo mock quando todos os provedores falham
- Embedding routing: OpenAI -> Cohere -> Mock
- Rate limiting com Redis e fallback in-memory
- Health checks publicos com monitoramento de dependencias
- Circuit breakers de workflow: loop, erro e estagnacao -> handoff automatico

**Evidencias Verificadas:**

- `src/lib/llm-router.ts` — 429 linhas, classe CircuitBreaker + cadeia de fallback
- `src/lib/embedding-router.ts` — Routing de embeddings com fallback
- `src/services/public-health.service.ts` — Health checks
- `monitoring/prometheus/prometheus.yml` — 41 metricas Prometheus
- `monitoring/grafana/dashboards/carinsight-dashboard.json` — Dashboard Grafana

---

### 7. MONITORAMENTO DE QUALIDADE

**Alinhamento:** Monitoring / Quality (ISO 42001 / EU AI Act)

**Controles Implementados:**

- Metricas de recomendacao: Precision@1, Precision@3, Precision@5
- CTR (Click-Through Rate) e taxa de conversao
- MRR (Mean Reciprocal Rank)
- Taxa de rejeicao e correlacao de match score
- Deteccao de drift e degradacao de qualidade
- Golden dataset com 11 cenarios de teste curados
- Benchmark runner para validacao pos-atualizacao de modelo
- Alertas quando qualidade cai abaixo de thresholds

**Evidencias Verificadas:**

- `src/services/recommendation-metrics.service.ts` — 598 linhas, suite completa
- `src/services/recommendation-health-monitor.service.ts` — Monitoramento de drift
- `src/evaluation/golden-dataset.ts` — 11 cenarios curados com scores esperados
- `src/evaluation/benchmark-runner.ts` — Runner de benchmark

---

## CONTROLES ADICIONAIS

### Explicabilidade Operacional

- Gera pacotes de evidencia para explicar "por que" um veiculo foi recomendado
- Campos: `selectedBecause`, `notIdealBecause`, `matchedCharacteristics`, `confidence`
- Explicacao deterministica com fallback para LLM

**Evidencias:** `src/services/recommendation-explainer.service.ts`, `src/services/recommendation-evidence.service.ts`

### Controle de Rollout e Mudanca

- Feature flags com rollout percentual por usuario
- Prompts carregados de banco com cache e versionamento
- Seed idempotente para prompts

**Evidencias:** `src/lib/feature-flags.ts`, `src/services/system-prompt.service.ts`

---

## RESULTADOS VERIFICADOS

**Numero oficial a citar (2026-07-29): 1.106 testes em 105 arquivos.** Contagem estatica de blocos `it`/`test` no repositorio. O snapshot anterior (2026-03-13) registrava 1.037 em 92 arquivos: a diferenca e crescimento do projeto, nao correcao. **Nao usar outros numeros** (o pitch citava 1.091, ja corrigido).

| Metrica | Valor |
|---------|-------|
| Testes | **1.106** (unit + integration + e2e), jul/2026 |
| Arquivos de teste | 105 |
| Pilares de governanca | **7/7 implementados (100%)** |
| Padroes de injection | 25+ (PT-BR + EN) |
| Templates com AI disclosure | Todos os pontos de contato |
| Golden dataset | 11 cenarios curados |
| Metricas Prometheus | 41 definicoes |
| Provedores LLM com fallback | 3 + mock |

**Validacao:** `npm run verify:strict` executado com sucesso (format + lint + build + test).

---

## GAPS HONESTOS (para transparencia)

### Fechados em 2026-07-29, na implantacao do AIMS

1. ~~**Sem artefatos formais de governanca**~~ — **fechado.** AIIA, model cards, RACI, politica de IA, registro de riscos, procedimento de incidente, auditoria interna e analise critica existem em `governance/`.
2. ~~**Drift de documentacao**~~ — **fechado, e era pior do que se supunha.** A politica publica declarava "Jina AI" (inexistente no codigo) e omitia OpenAI, Google e Cohere, que sao os provedores reais. Corrigido e agora **verificado em CI** por `scripts/governance/validate-suppliers.ts`. Ver NC-001.
3. ~~**Retencao automatica sem scheduler**~~ — **fechado.** `src/jobs/data-retention.job.ts` roda diariamente, com log estruturado e 9 testes. Ver NC-002.
4. ~~**Masking apenas de telefone**~~ — **fechado.** Estendido para e-mail e nome, com prefixo de telefone reduzido de 6 para 4 digitos.

### Abertos, com prazo

5. **Certificacao externa nao existe** — e nao esta planejada. O AIMS esta implantado e auditado **internamente**. Certificar exige organismo acreditado e auditoria de estagio 1 e 2.
6. **Autoauditoria sem independencia** — auditor e auditado sao a mesma pessoa, porque o time e de uma pessoa. Mitigado por evidencia verificavel em arquivo e por validadores em CI, mas nao resolvido.
7. **AIMS sem historico operacional** — implantado em 2026-07-29. Um auditor externo pediria evidencia de funcionamento ao longo do tempo, e isso so o tempo entrega.
8. **NC-004: sem registro de treinamento** dos operadores do cliente (clausula 7.2). Prazo 2026-09-30.
9. **GAP-002: sem analise de vies por subgrupo** na recomendacao. Hoje o vies seria detectado por queda de metrica agregada, nao por analise de faixa de preco ou segmento. Prazo 2026-10-31.
10. **GAP-003: sem verificacao automatizada de mudanca de termos** de fornecedor. Prazo 2026-12-31.
11. **Sem de-identificacao para uso analitico** — analise agregada roda sobre dado identificavel, o que restringe uso legitimo.
12. **Acessibilidade** — canal so texto, em portugues. Exclui parte dos usuarios; mitigado apenas pela existencia permanente do caminho humano.

---

## ALINHAMENTO NORMATIVO

| Requisito ISO 42001 / EU AI Act | Status | Pilar ou artefato |
|---------------------------------|--------|-------|
| Transparency | Implementado | 1. Transparencia |
| Human Oversight | Implementado | 2. Supervisao Humana |
| Technical Robustness / Safety | Implementado | 3. Seguranca + 6. Robustez |
| Data Governance / Privacy | Implementado | 4. Privacidade + `governance/data/` |
| Accountability / Traceability | Implementado | 5. Rastreabilidade + `governance/roles/RACI.md` |
| Resilience | Implementado | 6. Robustez |
| Monitoring | Implementado | 7. Qualidade + `governance/metrics/objectives.yaml` |
| **Clausula 5.2 Politica de IA** | Implementado | `governance/policy/AI-POLICY.md` |
| **Clausula 6.1 Gestao de risco** | Implementado | `governance/risk/` (10 riscos, verificados em CI) |
| **Clausula 6.1.4 / A.5 Avaliacao de impacto** | Implementado | `governance/impact/AIIA-carinsight.md` |
| **Clausula 8.1 / 10.2 Incidentes** | Implementado | `governance/incidents/` (2 incidentes registrados) |
| **Clausula 9.2 Auditoria interna** | Implementado | `governance/audit/internal-audit-2026-07.md` |
| **Clausula 9.3 Analise critica** | Implementado | `governance/audit/management-review-2026-Q3.md` |
| **Clausula A.10 Fornecedores** | Implementado | `governance/suppliers/` (verificado em CI) |
| **Clausula 7.2 Competencia** | **Nao conforme** | NC-004: falta registro de treinamento, prazo 2026-09-30 |
| Certificacao externa | **Nao existe** | Nao planejada |
| Risk Management | Parcial | Controles existem, falta pacote formal |
