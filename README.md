# 🚗 CarInsight - AI-Powered WhatsApp Sales Assistant

> Enterprise-grade automotive sales assistant leveraging Generative AI, RAG, and Multi-LLM routing for intelligent vehicle recommendations via WhatsApp.

[![CI/CD](https://github.com/rafaelnovaes22/faciliauto-mvp-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelnovaes22/faciliauto-mvp-v2/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 🇧🇷 **[Versão em Português](README-pt.md)**

---

## 🎯 Overview

FaciliAuto is a production-ready conversational AI system designed for automotive dealerships. It combines state-of-the-art LLM technology with vector search to provide personalized vehicle recommendations through WhatsApp, featuring intelligent fallback mechanisms and ISO42001 compliance.

### Key Highlights

- 🤖 **Multi-LLM Architecture** - OpenAI GPT-4o-mini with Groq fallback
- 🔍 **RAG-Powered Search** - Vector embeddings for semantic vehicle matching
- 📱 **WhatsApp Integration** - Official Meta Business API
- 🔒 **Enterprise Security** - ISO42001 compliant with anti-injection guardrails
- 🔄 **High Availability** - Circuit breaker pattern with automatic failover
- ✅ **Production Ready** - Comprehensive test suite and CI/CD pipeline

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Business API                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              LangGraph State Machine                         │
│  • Graph-based orchestration                                │
│  • Multi-agent routing                                      │
└──────────┬──────────┬──────────┬───────────────────────────┘
           │          │          │
    ┌──────▼──┐ ┌─────▼────┐ ┌──▼─────────────┐
    │  Quiz   │ │ Vehicle  │ │ Recommendation │
    │  Agent  │ │  Expert  │ │     Agent      │
    └────┬────┘ └────┬─────┘ └───────┬────────┘
         │          │               │
┌────────▼──────────▼───────────────▼─────────────────────────┐
│                    LLM Router                                │
│  • GPT-4o-mini → Groq LLaMA → Mock                          │
│  • Circuit breaker + Retry logic                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               Vector Store (In-Memory)                       │
│  • OpenAI Embeddings → Cohere fallback                      │
│  • Cosine similarity < 50ms                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   PostgreSQL + Prisma                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- OpenAI API Key
- Meta WhatsApp Business Account

### Installation

```bash
# Clone repository
git clone https://github.com/rafaelnovaes22/faciliauto-mvp-v2.git
cd faciliauto-mvp-v2

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
npx prisma generate
npx prisma db push

# Seed with sample data
npm run db:seed:robustcar

# Start development server
npm run dev
```

📖 **Detailed setup guide:** [docs/setup/PROXIMOS_PASSOS.md](docs/setup/PROXIMOS_PASSOS.md)

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Backend** | Node.js 20, TypeScript 5.3, Express.js, LangGraph |
| **AI/LLM** | OpenAI GPT-4o-mini, Groq LLaMA 3.1, Cohere |
| **Database** | PostgreSQL 14+, Prisma ORM |
| **Messaging** | Meta WhatsApp Business API |
| **Testing** | Vitest, Supertest |
| **DevOps** | Docker, Railway, GitHub Actions |
| **Security** | Zod validation, Husky hooks, ISO42001 guardrails |

---

## 📊 Features

### Intelligent Recommendation Engine
- Vector-based semantic search with 1536-dimensional embeddings
- LLM-powered vehicle suitability evaluation
- Context-aware filtering (budget, usage, family size)
- Top-3 recommendations with detailed reasoning

### Multi-LLM Routing
- Primary: OpenAI GPT-4o-mini ($0.15/$0.60 per 1M tokens)
- Fallback: Groq LLaMA 3.1 8B ($0.05/$0.08 per 1M tokens)
- Circuit breaker with automatic failover
- Mock mode for development

### Conversational State Machine
- Pure TypeScript implementation
- States: Greeting → Discovery → Clarification → Recommendation
- Specialized agents per conversation phase
- Persistent conversation history

### Security & Compliance
- ISO42001 AI Management System
- Anti-prompt injection detection (30+ patterns)
- Rate limiting (10 msgs/min per user)
- Input sanitization and output validation
- GDPR/LGPD ready structure

---

## 📁 Project Structure

```
faciliauto-mvp-v2/
├── src/
│   ├── agents/           # Specialized AI agents
│   ├── lib/              # Core libraries (LLM router, embeddings)
│   ├── services/         # Business logic
│   ├── routes/           # Express routes
│   └── graph/            # State machine
├── prisma/               # Database schema & migrations
├── tests/                # Test suite (unit, integration, e2e)
├── docs/                 # Documentation
│   ├── setup/            # Setup guides
│   └── development/      # Technical docs
└── scripts/              # Utility scripts
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Visual test UI
npm run test:ui
```

**Test Coverage:** 80%+ target across unit, integration, and E2E tests.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/setup/PROXIMOS_PASSOS.md) | Step-by-step installation |
| [Git Workflow](docs/GIT_WORKFLOW.md) | Multi-repository workflow |
| [Architecture](docs/development/RESUMO_IMPLEMENTACAO.md) | System design details |
| [LLM Routing](docs/LLM_ROUTING_GUIDE.md) | Multi-LLM configuration |
| [ISO42001](docs/development/ISO42001_IMPLEMENTACAO_COMPLETA.md) | Compliance documentation |
| [Testing](docs/development/TESTING_SUMMARY.md) | Test strategy |

---

## 🔧 Available Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start:prod       # Start production server

# Database
npm run db:push          # Apply schema
npm run db:seed:robustcar # Seed with vehicles
npx prisma studio        # Visual database editor

# Testing
npm test                 # Run all tests
npm run test:coverage    # With coverage report

# Utilities
npm run embeddings:generate  # Generate vector embeddings
npm run vehicles:fix-urls    # Fix vehicle URLs
```

---

## 🚀 Deployment

### Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

📖 **Deployment guide:** [docs/RAILWAY_DEPLOY_GUIDE.md](docs/RAILWAY_DEPLOY_GUIDE.md)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Commit Convention:** Use semantic prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Rafael Novaes**

- GitHub: [@rafaelnovaes22](https://github.com/rafaelnovaes22)
- LinkedIn: [Rafael Novaes](https://linkedin.com/in/rafaelnovaes22)

---

## 🙏 Acknowledgements

- [OpenAI](https://openai.com/) - GPT-4o-mini and embeddings
- [Groq](https://groq.com/) - Ultra-fast LLM inference
- [Cohere](https://cohere.com/) - Multilingual embeddings
- [Meta](https://developers.facebook.com/) - WhatsApp Business API
- [Prisma](https://www.prisma.io/) - Type-safe ORM
- [Vitest](https://vitest.dev/) - Modern testing framework

---

<div align="center">

**Status:** ✅ Production Ready | Multi-LLM Router | ISO42001 Compliant

⭐ If this project helped you, consider giving it a star!

</div>
