# CarInsight — Instruções para Claude Code

> Assistente de vendas automotivas via WhatsApp com IA multi-agente.

## Stack

Node.js 20 · TypeScript 5.3 · LangGraph · PostgreSQL + pgvector · Prisma ORM · OpenAI/Groq · Meta WhatsApp API · Vitest · Railway

## Referência Detalhada

- **Arquitetura completa, agentes, serviços, comandos**: ver `skills.md`
- **Regras de código**: ver `.claude/rules/coding.md`
- **Regras de teste**: ver `.claude/rules/testing.md`
- **Decisões arquiteturais**: ver `docs/decisions/`
- **Runbooks operacionais**: ver `docs/runbooks/`

## Convenções Obrigatórias

- **Commits**: conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`)
- **Antes de qualquer commit**: SEMPRE rodar `npm run verify:strict` (format:check + lint + build + test:run)
- **Push**: usar `npm run push:safe` — verifica + push para `origin` e `novais`
- **Encoding**: UTF-8 sem BOM
- **Formatação**: Prettier + ESLint strict + Husky pre-commit hooks
- **Nomenclatura**: kebab-case para arquivos, camelCase para variáveis/funções, PascalCase para classes

## Remotes Git

| Nome | Repo | Branch |
|------|------|--------|
| `origin` | rafaelnovaes22/CarInsight | `main` |
| `novais` | NovAIs-Digital/renatinhus-cars | `main` |

Push sempre para ambos os remotes.

## Deploy (Railway)

- Auto-deploy on push to `main`
- Start: `resolve init (baseline) → fix-migrations.cjs → migrate deploy → start:prod`
- **NUNCA** usar `prisma migrate resolve --applied` para migrations que precisam ser executadas — isso NÃO executa SQL
- Migrations SQL devem usar `IF NOT EXISTS` / `DO $$ ... $$` para idempotência

## Estrutura Principal

```
src/
├── agents/          # 6 agentes LangGraph (orchestrator, recommendation, vehicle-expert, financing, trade-in, preference-extractor)
├── graph/nodes/     # 7 nodes (greeting, discovery, search, recommendation, financing, trade-in, negotiation)
├── services/        # Regras de negócio
├── lib/             # llm-router, embedding-router, embeddings, logger
├── config/          # env.ts (Zod validation)
├── routes/          # Rotas Express
└── types/           # Tipos TypeScript

.claude/             # Configuração Claude Code (rules, skills, agents, hooks)
docs/                # Documentação organizada (architecture, decisions, runbooks)
tools/               # Scripts organizados (db, scraping, vehicle, deploy)
tests/               # Testes (unit, integration, e2e, agents, security)
prisma/              # Schema e migrations
```

## Pontos de Atenção

- Redis/BullMQ foram removidos — cache é 100% in-memory
- Testes DB-dependent excluídos do `test:run` (precisam de PostgreSQL local)
- LLM routing: OpenAI → Groq → Mock com circuit breaker
- Logging: Pino structured JSON com phone masking (LGPD)
- Guardrails: rate limiting, injection detection, sanitização, output validation
