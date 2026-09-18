# CarInsight — Instruções para Claude Code

> Assistente de vendas automotivas via WhatsApp com IA multi-agente.

## Stack

Node.js 20 · TypeScript 5.3 · LangGraph · PostgreSQL + pgvector · Prisma ORM · OpenAI/Groq · Meta WhatsApp API · Vitest · Railway

## Comandos

```bash
npm ci                   # setup reproduzível; postinstall gera Prisma Client
npm run dev              # tsx watch src/index.ts
npm run build            # tsc
npm run test:run         # suíte completa (exclui testes que exigem PostgreSQL/LLM)
npm run test:unit        # só unitários
npm run lint             # eslint --max-warnings 0
npm run verify:strict    # format:check + lint + tsc --noEmit + test:run — gate de commit
npm run push:safe        # verify:strict + branch própria para origin pessoal
npm run eval:offline     # offline explícito, sem qualificação de produção
npm run eval:contracts   # funções de produção com catálogo sintético
npm run db:migrate       # prisma migrate deploy
npm run db:studio        # prisma studio
```

Testes que precisam de banco: `npm run test:integration:db` (sobe
`docker-compose.db.yml`). Testes de LLM real: `npm run test:integration:llm`.

## Referência Detalhada

- **Arquitetura completa, agentes, serviços, comandos**: ver `docs/architecture.md`
- **Regras de código**: ver `.claude/rules/coding.md`
- **Regras de teste**: ver `.claude/rules/testing.md`
- **Decisões arquiteturais**: ver `docs/decisions/`
- **Runbooks operacionais**: ver `docs/runbooks/`

## Convenções Obrigatórias

- **Commits**: conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`)
- **Antes de qualquer commit**: SEMPRE rodar `npm run verify:strict` (format:check + lint + build + test:run)
- **Push**: `npm run push:safe` verifica e envia somente a branch própria ao `origin` pessoal. Bloqueia branch default, main, master e develop. Abrir PR sem merge.
- **Encoding**: UTF-8 sem BOM
- **Formatação**: Prettier + ESLint strict + Husky pre-commit hooks
- **Nomenclatura**: kebab-case para arquivos, camelCase para variáveis/funções, PascalCase para classes

## Remotes Git

| Nome | Repo | Branch |
|------|------|--------|
| `origin` | rafaelnovaes22/CarInsight | branch própria |

Não enviar a outros remotes. A referência local `origin/HEAD` precisa identificar a default;
o comando falha se essa referência estiver ausente. Merge e push na default exigem autorização específica.

## Deploy (Railway)

- Confirmar no Railway o serviço, ambiente e branch conectados antes de qualquer deploy. A configuração externa não é comprovada pelo CI deste repositório.
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

- Redis é opcional para rate limiting distribuído (`REDIS_URL`); o fallback em memória não compartilha limites entre instâncias. Ver `src/services/rate-limit.service.ts`.
- `tsconfig.json`: `strict: false`, `noImplicitAny: true`, `strictNullChecks: true`. O projeto ainda não usa todas as verificações de strict.
- Testes DB-dependent excluídos do `test:run` (precisam de PostgreSQL local)
- LLM routing: OpenAI → Groq → Mock com circuit breaker
- Logging: Pino structured JSON com phone masking (LGPD)
- Guardrails: rate limiting, injection detection, sanitização, output validation
- CI offline não mede qualidade geral de respostas LLM nem autoriza produção. Ver `evals/break-before-prod/README.md`.
