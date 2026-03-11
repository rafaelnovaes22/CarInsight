# CarInsight — Multi-Agent Automotive Sales Assistant

> Production-grade WhatsApp sales assistant powered by LangGraph, RAG with pgvector, and multi-provider LLM routing with circuit breaker.

> [!IMPORTANT]
> **Portfolio Sample** — This repository is public for technical evaluation purposes. See [NOTICE.md](NOTICE.md) for terms.

[![CI/CD](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/Tests-1028%20passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Leia em Portugues](https://img.shields.io/badge/Lang-Portugues-green)](README_PT.md)

## Architecture Overview

```
WhatsApp (Meta API)
       |
   Webhooks + Guardrails (injection detection, rate limiting, PII masking)
       |
   LangGraph Workflow (7 nodes, fiber-based routing)
       |
   ┌─────────┬──────────┬───────────────┬───────────┬──────────┬────────────┐
   greeting  discovery  search          recommendation financing  trade_in
                        (pgvector+SQL)  (5 agents)     |          |
                                                       └──────────┘
                                                       negotiation → END
```

### Conversation Fibers (Forward-Progress Guarantee)

The router enforces monotonic progression through 7 conversation phases (F0–F6). A **fiber guard** prevents regressions — the conversation can only move forward unless explicitly allowed (e.g., "show me different cars" → back to search).

A **fiber stagnation detector** triggers handoff to a human agent if the conversation doesn't advance after 6 routing decisions.

### LLM Routing with Circuit Breaker

| Priority | Provider | Model | Purpose |
|----------|----------|-------|---------|
| Primary | OpenAI | gpt-4o-mini | High-quality reasoning |
| Fallback | Groq | llama-3.1-8b | Cost-efficient fallback |
| Last resort | Mock | — | Development/testing |

Each provider is wrapped in a circuit breaker (3 failures → 1 min cooldown). Embedding routing follows the same pattern: OpenAI → Cohere → Mock.

### RAG Pipeline (Hybrid Search)

- **Semantic**: pgvector with OpenAI embeddings (1536 dim) for fuzzy matching
- **Structured**: SQL filters for budget, year, body type, seat count
- **Fallback chain**: year → brand → category → price range (4 layers)

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| LangGraph over LangChain agents | Deterministic state graph with checkpointing; no hallucinated tool calls |
| Fiber-based routing | Formal forward-progress guarantee; prevents conversation loops |
| Multi-LLM router | FinOps: route by complexity, not by default. 10x cost reduction on simple tasks |
| In-memory vector store | Sub-50ms search for inventory < 500 vehicles; pgvector for persistence |
| Pino structured logging | LGPD/GDPR: phone masking built into serializer, JSON for audit trails |

## Project Structure

```
src/
├── agents/                    # 5 specialized agents
│   ├── vehicle-expert.agent.ts    # Core sales agent (discovery + recommendations)
│   ├── recommendation.agent.ts    # Vehicle ranking and presentation
│   ├── preference-extractor.agent.ts  # NLP preference extraction
│   ├── financing.agent.ts         # Payment simulation
│   └── trade-in.agent.ts          # Trade-in evaluation
├── graph/
│   ├── workflow.ts                # LangGraph state graph (7 nodes + routing)
│   └── nodes/                     # greeting, discovery, search, recommendation,
│                                  # financing, trade_in, negotiation
├── services/                  # Business logic (48 services)
│   ├── guardrails.service.ts      # Input/output validation, injection detection
│   ├── vehicle-search-adapter.service.ts  # Hybrid search orchestration
│   ├── vehicle-ranker.service.ts  # AI-powered result ranking
│   └── ...
├── lib/
│   ├── llm-router.ts             # Multi-provider LLM with circuit breaker
│   ├── embedding-router.ts       # Multi-provider embeddings with circuit breaker
│   ├── node-metrics.ts           # Per-node latency tracking + fiber monitoring
│   └── logger.ts                 # Pino with PII masking
├── utils/
│   ├── conversation-fiber.ts     # Fiber computation (F0–F6) + regression guard
│   ├── circuit-breaker.ts        # Loop, error, and fiber stagnation detection
│   └── state-flags.ts            # Centralized state flag management
├── config/                    # Zod-validated env vars
├── types/                     # TypeScript interfaces
└── routes/                    # Express endpoints (webhooks, admin, debug)

tests/                         # 1028+ tests (Vitest)
├── unit/                      # Isolated service/util tests
├── integration/               # Component interaction tests
├── e2e/                       # Full conversation flow tests
├── agents/                    # Agent behavior tests
└── repro/                     # Bug reproduction tests

docs/
├── architecture.md            # System architecture details
├── decisions/                 # Architectural Decision Records
├── guides/                    # Technical guides (ISO42001, LLM routing, testing)
└── runbooks/                  # Operational procedures
```

## Security & Compliance

- **Prompt injection detection** — 30+ patterns (PT-BR + EN), pre-LLM filtering
- **Rate limiting** — Per-phone-number throttling (10 msg/min)
- **Output validation** — 4096 char limit, hallucination checks against inventory
- **PII masking** — Phone numbers masked in all logs (LGPD/GDPR)
- **ISO 42001 alignment** — AI transparency disclaimers, audit logging

## Testing

```bash
npm run test:run          # All tests (1028+ passing)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e          # End-to-end conversation flows
npm run test:coverage     # With coverage report
npm run verify:strict     # format + lint + build + tests (CI gate)
```

## Quick Start

```bash
git clone https://github.com/rafaelnovaes22/CarInsight.git
cd CarInsight
npm install
cp .env.example .env      # Configure API keys
npm run db:push            # Apply schema
npm run db:seed:real       # Seed inventory
npm run embeddings:generate
npm run dev
```

## Tech Stack

**Runtime**: Node.js 20, TypeScript 5.3, Express
**AI/ML**: LangGraph, OpenAI (GPT-4o-mini + embeddings), Groq (Llama 3), Cohere (embeddings)
**Data**: PostgreSQL 14 + pgvector, Prisma ORM
**Quality**: Vitest (1028+ tests), ESLint strict, Prettier, Husky pre-commit
**Deploy**: Railway (auto-deploy), GitHub Actions CI
**Integrations**: Meta WhatsApp Business API

## Author

**Rafael de Novaes** — AI Engineer & Full Stack Developer
- [LinkedIn](https://linkedin.com/in/rafaeldenovaes)
- [GitHub](https://github.com/rafaelnovaes22)

---

**Status**: Production — deployed on Railway with 1028+ tests passing
