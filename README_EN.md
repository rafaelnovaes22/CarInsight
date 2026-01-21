# 🚗 CarInsight WhatsApp AI Assistant

> Intelligent automotive sales assistant via WhatsApp using Generative AI, RAG, and Multi-LLM Routing

> [!IMPORTANT]
> **📋 PORTFOLIO SAMPLE** - This repository is made public for technical recruiting purposes only. See [NOTICE.md](NOTICE.md) for usage terms.

[![CI/CD](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Read in Portuguese](https://img.shields.io/badge/Lang-Portuguese-green)](README.md)

## 📋 About the Project

MVP sales assistant system for car dealerships via WhatsApp, leveraging **Generative AI** with a **Multi-LLM Routing** system, **RAG** (Retrieval-Augmented Generation), **Vector Embeddings**, and **NLP** for personalized vehicle recommendations.

### ✨ Key Features

- 🤖 **Conversational AI** - Customer service via WhatsApp using LangGraph (Multi-Agent).
- 🎯 **Intelligent Recommendation System** - LLM evaluates suitability based on user context.
- 🔍 **Vector Search** - OpenAI Embeddings with Cohere fallback (1536 dim).
- 📱 **Meta WhatsApp Business API** - Official integration.
- 🔒 **ISO42001 Compliant** - AI Management System + Anti-Injection Guardrails.
- 🔄 **Circuit Breaker** - High availability with automatic fallback.
- ✅ **E2E Tests** - Complete suite with Vitest.

## 🤖 LLM Architecture

### LLM Router (Chat Completion)

The system uses an **intelligent router** with automatic fallback and circuit breaker:

| Priority | Provider | Model | Cost/1M tokens |
|------------|----------|--------|-----------------|
| 1️⃣ Primary | OpenAI | `gpt-4o-mini` | $0.15 input / $0.60 output |
| 2️⃣ Fallback | Groq | `llama-3.1-8b-instant` | $0.05 input / $0.08 output |
| 3️⃣ Last Resort | Mock | - | Development |

### Embedding Router (Vector Search)

| Priority | Provider | Model | Dimensions | Cost/1M tokens |
|------------|----------|--------|-----------|-----------------|
| 1️⃣ Primary | OpenAI | `text-embedding-3-small` | 1536 | $0.02 |
| 2️⃣ Fallback | Cohere | `embed-multilingual-v3.0` | 1024→1536 | $0.01 |

**Router Features:**
- ✅ **Circuit Breaker** - Prevents repeated calls to failing services (3 failures = 1 min timeout).
- ✅ **Automatic Retry** - 2 attempts per provider with exponential backoff.
- ✅ **Cascading Fallback** - If primary fails, tries the next in the list.
- ✅ **Mock mode** - For development without API keys.

## 🛠️ Tech Stack

### Backend & AI
- **Node.js 20+** with TypeScript 5.3
- **Express.js** - REST API
- **LangGraph** - Agent and conversation orchestration (new engine)
- **State Machine** - Deterministic fallback in pure TypeScript
- **OpenAI SDK** - GPT-4o-mini (Primary LLM) + Embeddings
- **Groq SDK** - LLaMA 3.1 8B Instant (Fallback LLM)
- **Cohere SDK** - Multilingual Embeddings (Fallback)
- **Prisma ORM** - Type-safe database client
- **Modules** - Zod (Validation), Axios (HTTP), Pino (Logging)

### 🧠 Core Services & AI
- **VehicleRanker** - Intelligent result reranking with AI.
- **UberEligibility** - Automatic validation of complex rules (UberX, Black, Comfort).
- **ExactSearchParser** - Conversion of natural language into precise SQL filters.
- **Guardrails** - Security layer and input/output validation.

### Database & Storage
- **PostgreSQL 14+** - Main relational database.
- **In-Memory Vector Store** - Vector search < 50ms.
- **Persisted Embeddings** - Cached in DB to avoid regeneration.

### Integrations
- **Meta WhatsApp Business API** - Official Messaging.
- **Baileys** - WhatsApp Web API (fallback).
- **CRM Webhooks** - Pipedrive/RD Station integration.

### DevOps & Quality
- **Docker** - Containerization.
- **Railway** - Deployment.
- **Vitest** - Testing framework.
- **GitHub Actions** - CI/CD.
- **Pino** - Structured logging.
- **Husky** - Git hooks (pre-commit).

## 🔄 State Machine & LangGraph

The system adopts a hybrid approach: **LangGraph** for advanced conversational mode and a **pure TypeScript State Machine** as a fallback/legacy for robustness.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LangGraph Flow (StateGraph)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  START ──► GREETING ──► DISCOVERY <───► SEARCH ──► RECOMMENDATION           │
│                            │                               │                │
│                            │                               ▼                │
│                            └─────► NEGOTIATION ◄─── FINANCING / TRADE_IN    │
│                                       │                                     │
│                                       ▼                                     │
│                                     END                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Graph Nodes (Agents)

| Node | Responsibility |
|------|------------------|
| **Greeting** | Welcome, ISO42001 compliance, and initial verification. |
| **Discovery** | Conversational profile analysis (replaces rigid Quiz). Identifies budget, usage, and preferences. |
| **Search** | Executes hybrid searches (Vector + Strict Filters) on inventory. |
| **Recommendation** | Formats and presents vehicles with justification (selling points). |
| **Financing** | Specialist agent for simulations and payment conditions. |
| **TradeIn** | Preliminary evaluation of trade-in vehicles. |
| **Negotiation** | Final Q&A and closing (handoff to salesperson). |

### Persistence & Memory

LangGraph uses a **PostgreSQL Checkpointer (Prisma)** to persist the state of each conversation. This allows:
- **Long-term Memory:** The bot "remembers" context even days later.
- **Time Travel:** Ability to debug by reverting to previous states.
- **Human-in-the-loop:** Possibility for human intervention and approval (future).

## 🏗️ Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Business API                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Message Handler                            │
│  • Guardrails (anti-injection, rate limiting)               │
│  • Input validation & sanitization                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              TypeScript State Machine Manager                │
│  • Primary: LangGraph (Structured Multi-Agent Graph)        │
│  • Fallback: Legacy Pure TS State Machine                   │
│  • Node routing (greeting → quiz → recommendation)          │
└──────────┬──────────┬──────────┬───────────────────────────┘
           │          │          │
    ┌──────▼──┐ ┌─────▼────┐ ┌──▼─────────────┐
    │  Quiz   │ │ Vehicle  │ │ Recommendation │
    │  Agent  │ │  Expert  │ │     Agent      │
    └────┬────┘ └────┬─────┘ └───────┬────────┘
         │          │               │
┌────────▼──────────▼───────────────▼─────────────────────────┐
│                    LLM Router                                │
│  • GPT-4o-mini (primary) → Groq LLaMA (fallback) → Mock     │
│  • Circuit breaker + Automatic Retry                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               In-Memory Vector Store                         │
│  • OpenAI Embeddings (primary) → Cohere (fallback)          │
│  • Cosine similarity search < 50ms                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   PostgreSQL + Prisma                        │
│  • Vehicles, Conversations, Recommendations, Leads          │
│  • Persisted Embeddings                                     │
└─────────────────────────────────────────────────────────────┘
```

### Specialized Agents

| Agent | Responsibility |
|--------|------------------|
| **OrchestratorAgent** | Intent classification and routing. |
| **QuizAgent** | Preference collection (8 questions). |
| **RecommendationAgent** | Vehicle evaluation with LLM + specific model search. |
| **VehicleExpertAgent** | Specialist in technical details and comparisons. |
| **FinancingAgent** | Financing simulation and installments (Agentic). |
| **TradeInAgent** | Preliminary trade-in evaluation. |
| **PreferenceExtractorAgent** | Free-text preference extraction. |

## 🔒 Security & Compliance

### Guardrails Service

- **Rate Limiting** - 10 msgs/min per user.
- **Prompt Injection Detection** - 30+ patterns (PT-BR and EN).
- **Input Sanitization** - Removes control characters, HTML.
- **Output Validation** - Detects system prompt leakage.
- **Message Length Limits** - 1000 chars input, 4096 output.

### ISO42001 Compliance

- **Automatic Disclaimers** - Transparency about AI.
- **Audit Logs** - Complete event tracking.
- **Anti-hallucination** - Guardrails for safe responses.
- **GDPR/LGPD Ready** - Structure for data rights.

## 📊 Data Model

```prisma
model Vehicle {
  id              String   @id
  marca           String
  modelo          String
  versao          String?
  ano             Int
  km              Int
  preco           Float
  carroceria      String   // hatch, sedan, SUV, pickup
  combustivel     String
  cambio          String
  // Embeddings
  embedding       String?  // JSON array (1536 dim)
  embeddingModel  String?
  // Usage Contexts
  aptoUber        Boolean
  aptoFamilia     Boolean
  // ...
}

model Conversation {
  id              String   @id
  phoneNumber     String
  status          String   // active, qualified, converted
  currentStep     String   // greeting, quiz, recommendation
  quizAnswers     String?  // JSON
  // Relations
  recommendations Recommendation[]
  lead            Lead?
}

model Recommendation {
  id              String   @id
  vehicleId       String
  matchScore      Int      // 0-100
  reasoning       String   // LLM Justification
  position        Int      // 1, 2, 3 (top 3)
}
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+
- OpenAI API Key
- Groq API Key (optional, fallback)
- Cohere API Key (optional, embeddings fallback)
- Meta WhatsApp Business Account

### Installation

```bash
# Clone the repository
git clone https://github.com/rafaelnovaes22/CarInsight-mvp-v2.git
cd CarInsight-mvp-v2

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npm run db:push

# Seed database with real data
npm run db:seed:real

# Generate OpenAI embeddings
npm run embeddings:generate

# Start the server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/CarInsight"

# LLM Providers (with automatic fallback)
OPENAI_API_KEY="sk-proj-..."    # Primary (LLM + Embeddings)
GROQ_API_KEY="gsk-..."          # LLM Fallback (optional)
COHERE_API_KEY="..."            # Embeddings Fallback (optional)

# WhatsApp
META_WHATSAPP_TOKEN="EAA..."
META_WHATSAPP_PHONE_NUMBER_ID="123..."
META_WEBHOOK_VERIFY_TOKEN="CarInsight_webhook_2025"

# Feature Flags
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"

# Environment
NODE_ENV="production"
PORT=3000
```

## 📊 Available Commands

```bash
# Development
npm run dev              # Start development server
npm run dev:api          # API server without WhatsApp
npm run build            # Production build
npm run start:prod       # Start production server

# Database
npm run db:push          # Apply Prisma schema
npm run db:studio        # Open Prisma Studio
npm run db:seed:real     # Populate with real vehicles

# Embeddings
npm run embeddings:generate    # Generate OpenAI embeddings
npm run embeddings:stats       # Show statistics
npm run embeddings:force       # Force regeneration

# Testing
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run test:watch       # Watch mode
npm run test:ui          # Visual interface
npm run test:e2e         # E2E tests only
npm run test:integration # Integration tests only

# Utilities
npm run conversations:reset     # Reset test conversations
npm run vehicles:update-uber    # Update Uber eligibility
npm run benchmark:llms          # Compare LLM performance
```

## 📁 Project Structure

```
CarInsight-mvp-v2/
├── src/
│   ├── index.ts                    # Entry point & Express App
│   ├── agents/                     # Specialized Agents
│   │   ├── orchestrator.agent.ts   # Routing and intent
│   │   ├── quiz.agent.ts           # Preference collection
│   │   ├── recommendation.agent.ts # Recommendation with LLM
│   │   ├── vehicle-expert.agent.ts # Vehicle expert
│   │   ├── financing.agent.ts      # Financing simulation
│   │   ├── trade-in.agent.ts       # Trade-in evaluation
│   │   └── preference-extractor.agent.ts
│   ├── services/                   # Business Services
│   │   ├── guardrails.service.ts   # Security and validation
│   │   ├── uber-eligibility-*.ts   # Uber rules (Validator, Scraper)
│   │   ├── vehicle-ranker.service.ts # AI Reranking
│   │   ├── exact-search*.ts        # Exact search and parser
│   │   └── whatsapp-meta.service.ts
│   ├── routes/                     # Express Routes
│   │   ├── webhook.routes.ts       # WhatsApp webhooks
│   │   ├── admin.routes.ts         # Admin endpoints
│   │   └── debug.routes.ts         # Debug endpoints
│   ├── config/                     # Configuration
│   └── graph/                      # State Machine & LangGraph
│       ├── conversation-graph.ts
│       └── nodes/                  # Graph Nodes (Discovery, Negotiation, etc)
│   ├── prisma/
│   │   ├── schema.prisma               # Database schema
│   │   └── seed-*.ts                   # Seed scripts
│   ├── tests/                          # Test Suite
│   │   ├── e2e/                        # End-to-end tests
│   │   ├── integration/                # Integration tests
│   │   ├── unit/                       # Unit tests
│   │   └── agents/                     # Agent tests
│   └── docs/                           # Technical Documentation
```

## 🧪 Testing

```bash
# Run all tests
npm test

# With coverage (target 80%+)
npm run test:coverage

# Vitest Visual Interface
npm run test:ui
```

### Test Categories

| Category | Description |
|-----------|-----------|
| **E2E** | Complete conversational flow, guardrails |
| **Integration** | LLM integration, webhooks, API |
| **Unit** | LLM router, embedding router, services |
| **Agents** | Quiz agent, recommendation agent |

## 🔄 Recommendation Flow (Agentic)

```
1. User sends message ("I want an SUV for my family")
         │
2. LangGraph initiates/loads state (thread_id)
         │
3. DISCOVERY Node:
   • Analyzes intent with LLM
   • Extracts entities (Budget, Type, Usage)
   • Decides if more info is needed or can search
         │
4. SEARCH Node (if profile is sufficient):
   • Converts natural query -> Filters (year, km, price)
   • Generates intent embedding
   • Hybrid Search (Vector + SQL)
         │
5. RECOMMENDATION Node:
   • Reranking of results (LLM evaluates fit)
   • Selects Top 3
   • Generates personalized justification ("Good for family because it has trunk X")
         │
6. Response sent to user
```

## 🔌 API & Endpoints

The Express server exposes endpoints for administration and webhooks:

| Method | Endpoint | Description |
|--------|----------|-----------|
| `POST` | `/webhooks/whatsapp` | Official Meta Cloud API Webhook |
| `GET` | `/webhooks/whatsapp` | Token verification (Meta challenge) |
| `GET` | `/admin/health` | Detailed system healthcheck |
| `GET` | `/stats` | Statistics (Conversations, Leads, Vehicles) |
| `POST` | `/api/reset-conversation` | Test utility (clears number state) |
| `GET` | `/` | Basic status dashboard |

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the project
2. Create a branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This is **proprietary software** made available for technical evaluation purposes by recruiters.
See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for usage terms.

## 👨‍💻 Author

**Rafael Novaes**

- GitHub: [@rafaelnovaes22](https://github.com/rafaelnovaes22)
- LinkedIn: [Rafael Novaes](https://linkedin.com/in/rafaelnovaes22)

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) - GPT-4o-mini and Embeddings
- [Groq](https://groq.com/) - Ultra-fast LLM (fallback)
- [Cohere](https://cohere.com/) - Multilingual Embeddings
- [Meta](https://developers.facebook.com/) - WhatsApp Business API
- [Prisma](https://www.prisma.io/) - Type-safe ORM
- [Vitest](https://vitest.dev/) - Modern testing framework

---

⭐ If this project was useful, consider giving it a star!

**Status:** ✅ 100% Functional MVP | Multi-LLM Router | ISO42001 Compliant
