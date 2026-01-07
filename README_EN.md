# 🚗 CarInsight - AI Automotive Sales Assistant

> Intelligent automotive sales assistant via WhatsApp powered by Agentic AI, RAG, and Smart Ranking technology.

[![CI/CD](https://github.com/Start-CarInsight/CarInsight/actions/workflows/ci.yml/badge.svg)](https://github.com/Start-CarInsight/CarInsight/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 About the Project

**CarInsight** is an Enterprise-Grade sales automation platform for car dealerships via WhatsApp. Unlike traditional chatbots, it employs a multi-agent architecture where intelligent agents collaborate to deeply understand customer profiles and drive consultative sales.

The system features **Smart Ranking**, a proprietary technology that evaluates every vehicle in stock against the customer's specific needs using LLMs, ensuring high-precision recommendations (e.g., prioritizing robust motorcycles for delivery drivers or economic sedans for Uber drivers).

### ✨ Key Differentiators

- 🧠 **Smart Ranking Engine** - Evaluates 50+ vehicles and selects the Top 5 with a *Suitability Score* (0-100).
- 🎯 **Strict Filtering** - Zero tolerance for hallucinations (e.g., never recommending a Car when a Moto was requested).
- 🕵️ **Hybrid Vector Search** - Combines OpenAI Embeddings with deterministic SQL filters.
- 💬 **Specialized Agents** - Orchestrator, Preference Extractor, Vehicle Expert, and Negotiator.
- 📱 **Meta WhatsApp Business API** - Official, fast, and stable integration.
- 🛡️ **Enterprise Security** - Anti-injection guardrails, ISO42001 compliance, and data sanitization.

## 🤖 Intelligence Architecture

### 1. Smart Ranking (The Recommendation Brain)

Instead of just filtering by price, CarInsight understands **usage context**:
- **Delivery/Gig Economy:** Prioritizes low-maintenance, robust motorcycles (Honda/Yamaha).
- **Rideshare (Uber/Lyft):** Prioritizes sedans with high MPG, newer models (>2016), and trunk space.
- **Family Use:** Prioritizes safety, space, and comfort.

### 2. Search Pipeline (Retrieve & Re-rank)
1.  **Retrieval:** Vector + SQL search retrieves the top 50 relevant candidates.
2.  **Hard Filtering:** Removes obvious mismatches (e.g., Car vs. Moto).
3.  **LLM Scoring:** Agent evaluates each remaining candidate and assigns a 0-100 score with reasoning.
4.  **Presentation:** Presents only the Top 5 with personalized explanations.

### 3. LLM Router & Resilience
High-availability system that switches providers instantly upon failure:

| Priority | Provider | Model | Role |
|----------|----------|-------|------|
| 1️⃣ Primary | OpenAI | `gpt-4o-mini` | Reasoning, Ranking, Chat |
| 2️⃣ Fallback | Groq | `llama-3.1-8b` | High-speed backup |

## 🛠️ Tech Stack

- **Core:** Node.js 20+, TypeScript 5.3, Express.js
- **AI:** OpenAI SDK, LangChain, Vercel AI SDK
- **Data:** PostgreSQL 14, Prisma ORM, In-Memory Vector Store
- **Infra:** Docker, GitHub Actions (CI/CD), Railway
- **Quality:** Vitest (Unit/Integration/E2E), ESLint, Prettier

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL
- OpenAI API Key

### Installation

```bash
# Clone repository
git clone https://github.com/Start-CarInsight/CarInsight.git
cd CarInsight

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Database setup
npm run db:push
npm run db:seed:real

# Start server
npm run dev
```

## 🧪 Code Quality (Lint Zero Policy)

We maintain rigorous quality standards. The CI/CD pipeline ensures:
1.  **Lint Zero:** No ESLint warnings or errors allowed.
2.  **Type Safety:** `tsc` must compile with no errors (`noImplicitAny`).
3.  **Testing:** Mandatory unit and integration test coverage for new features.

```bash
npm test                 # Run test suite
npm run lint             # Check code style
npm run build            # Verify compilation
```

## 📄 License

This project is proprietary to **CarInsight Solutions**.
Developed by **Rafael Novaes** and **AI Team**.

---
**Status:** 🟢 Production Ready | Smart Ranking V2 Active
