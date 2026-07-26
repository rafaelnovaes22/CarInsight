# 🚗 CarInsight WhatsApp AI Assistant

> Assistente inteligente de vendas automotivas via WhatsApp com IA Generativa, RAG e Multi-LLM Routing

> [!IMPORTANT]
> **📋 PORTFOLIO SAMPLE** - This repository is made public for technical recruiting purposes only. See [NOTICE.md](NOTICE.md) for usage terms.

[![CI/CD](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

## 📋 Sobre o Projeto

Sistema MVP de assistente de vendas para concessionárias via WhatsApp, utilizando **IA Generativa** com sistema de **Multi-LLM Routing**, **RAG** (Retrieval-Augmented Generation), **Embeddings Vetoriais** e **NLP** para recomendações personalizadas de veículos.

### ✨ Features Principais

- 🤖 **IA Conversacional** - Atendimento via WhatsApp com LangGraph (Multi-Agent)
- 🎯 **Sistema de Recomendação Inteligente** - LLM avalia adequação ao contexto do usuário
- 🔍 **Busca Vetorial** - OpenAI Embeddings com fallback Cohere (1536 dim)
- 📱 **Meta WhatsApp Business API** - Integração oficial
- 🔒 **ISO42001 Compliant** - AI Management System + Guardrails Anti-Injection
- 🔄 **Circuit Breaker** - Alta disponibilidade com fallback automático
- ✅ **Testes E2E** - Suite completa com Vitest

## 🤖 Arquitetura de LLMs

### LLM Router (Chat Completion)

O sistema utiliza um **router inteligente** com fallback automático e circuit breaker:

| Prioridade | Provider | Modelo | Custo/1M tokens |
|------------|----------|--------|-----------------|
| 1️⃣ Primário | OpenAI | `gpt-4o-mini` | $0.15 input / $0.60 output |
| 2️⃣ Fallback | Groq | `llama-3.1-8b-instant` | $0.05 input / $0.08 output |
| 3️⃣ Último recurso | Mock | - | Desenvolvimento |

### Embedding Router (Busca Vetorial)

| Prioridade | Provider | Modelo | Dimensões | Custo/1M tokens |
|------------|----------|--------|-----------|-----------------|
| 1️⃣ Primário | OpenAI | `text-embedding-3-small` | 1536 | $0.02 |
| 2️⃣ Fallback | Cohere | `embed-multilingual-v3.0` | 1024→1536 | $0.01 |

**Features do Router:**
- ✅ **Circuit Breaker** - Previne chamadas repetidas a serviços falhando (3 falhas = 1 min timeout)
- ✅ **Retry automático** - 2 tentativas por provider com backoff exponencial
- ✅ **Fallback em cascata** - Se primário falhar, tenta próximo da lista
- ✅ **Mock mode** - Para desenvolvimento sem API keys

## 🛠️ Stack Tecnológico

### Backend & IA
- **Node.js 20+** com TypeScript 5.3
- **Express.js** - API REST
- **LangGraph** - Orquestração de agentes e conversas (novo engine)
- **State Machine** - Fallback determinístico em TypeScript puro
- **OpenAI SDK** - GPT-4o-mini (LLM primário) + Embeddings
- **Groq SDK** - LLaMA 3.1 8B Instant (LLM fallback)
- **Cohere SDK** - Embeddings multilingual (fallback)
- **Prisma ORM** - Type-safe database client
- **Modules** - Zod (Validation), Axios (HTTP), Pino (Logging)

### 🧠 Core Services & AI
- **VehicleRanker** - Reranking inteligente de resultados com IA
- **UberEligibility** - Validação automática de regras complexas (UberX, Black, Comfort)
- **ExactSearchParser** - Conversão de linguagem natural em filtros SQL precisos
- **Guardrails** - Camada de segurança e validação de input/output

### Database & Storage
- **PostgreSQL 14+** - Banco relacional principal
- **In-Memory Vector Store** - Busca vetorial < 50ms
- **Embeddings persistidos** - Cache no banco para não regenerar

### Integrações
- **Meta WhatsApp Business API** - Messaging oficial
- **Baileys** - WhatsApp Web API (fallback)
- **CRM Webhooks** - Integração com Pipedrive/RD Station

### DevOps & Quality
- **Docker** - Containerização
- **Railway** - Deployment
- **Vitest** - Testing framework
- **GitHub Actions** - CI/CD
- **Pino** - Structured logging
- **Husky** - Git hooks (pre-commit)

## 🔄 State Machine & LangGraph


O sistema adota uma abordagem híbrida: **LangGraph** para o modo conversacional avançado e uma **State Machine em TypeScript puro** como fallback/legado para garantir robustez.


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

### Nodes do Grafo (Agents)

| Node | Responsabilidade |
|------|------------------|
| **Greeting** | Boas-vindas, compliance ISO42001 e verificação inicial |
| **Discovery** | Análise de perfil conversacional (substitui Quiz rígido). Identifica budget, uso e preferências |
| **Search** | Executa buscas híbridas (Vetorial + Filtros Rígidos) no inventário |
| **Recommendation** | Formata e apresenta veículos com justificativa (selling points) |
| **Financing** | Agente especialista em simulações e condições de pagamento |
| **TradeIn** | Avaliação preliminar de veículo na troca |
| **Negotiation** | Tira-dúvidas finais e fechamento (handoff para vendedor) |

### Persistence & Memory

O LangGraph utiliza um **Checkpointer PostgreSQL (Prisma)** para persistir o estado de cada conversa. Isso permite:
- **Long-term Memory:** O bot "lembra" do contexto mesmo dias depois.
- **Time Travel:** Capacidade de debugar voltando a estados anteriores.
- **Human-in-the-loop:** Possibilidade de um humano intervir e aprovar ações (futuro).

## 🏗️ Arquitetura de Agentes

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
│  • GPT-4o-mini (primário) → Groq LLaMA (fallback) → Mock    │
│  • Circuit breaker + Retry automático                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               In-Memory Vector Store                         │
│  • OpenAI Embeddings (primário) → Cohere (fallback)         │
│  • Cosine similarity search < 50ms                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   PostgreSQL + Prisma                        │
│  • Vehicles, Conversations, Recommendations, Leads          │
│  • Embeddings persistidos                                   │
└─────────────────────────────────────────────────────────────┘
```

### Agentes Especializados

| Agente | Responsabilidade |
|--------|------------------|
| **OrchestratorAgent** | Classificação de intenção e roteamento |
| **QuizAgent** | Coleta de preferências (8 perguntas) |
| **RecommendationAgent** | Avaliação de veículos com LLM + busca de modelo específico |
| **VehicleExpertAgent** | Especialista em detalhes técnicos e comparativos |
| **FinancingAgent** | Simulação de financiamento e parcelas (Agentic) |
| **TradeInAgent** | Avaliação preliminar de usados na troca |
| **PreferenceExtractorAgent** | Extração de preferências de texto livre |

## 🔒 Segurança & Compliance

### Guardrails Service

- **Rate Limiting** - 10 msgs/min por usuário
- **Prompt Injection Detection** - 30+ patterns (PT-BR e EN)
- **Input Sanitization** - Remove caracteres de controle, HTML
- **Output Validation** - Detecta vazamento de system prompts
- **Message Length Limits** - 1000 chars input, 4096 output

### ISO42001 Compliance

- **Disclaimers automáticos** - Transparência sobre IA
- **Audit Logs** - Rastreamento completo de eventos
- **Anti-hallucination** - Guardrails para respostas seguras
- **LGPD Ready** - Estrutura para direitos de dados

## 📊 Modelo de Dados

```prisma
model Vehicle {
  id              String   @id
  marca           String
  modelo          String
  versao          String?
  ano             Int
  km              Int
  preco           Float
  carroceria      String   // hatch, sedan, SUV, picape
  combustivel     String
  cambio          String
  // Embeddings
  embedding       String?  // JSON array (1536 dim)
  embeddingModel  String?
  // Contextos de uso
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
  reasoning       String   // Justificativa LLM
  position        Int      // 1, 2, 3 (top 3)
}
```

## 🚀 Quick Start

### Pré-requisitos

- Node.js 20+ e npm
- PostgreSQL 14+
- OpenAI API Key
- Groq API Key (opcional, fallback)
- Cohere API Key (opcional, fallback embeddings)
- Meta WhatsApp Business Account

### Instalação

```bash
# Clone o repositório
git clone https://github.com/rafaelnovaes22/CarInsight-mvp-v2.git
cd CarInsight-mvp-v2

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Execute as migrations
npm run db:push

# Popule o banco com dados reais
npm run db:seed:real

# Gere os embeddings OpenAI
npm run embeddings:generate

# Inicie o servidor
npm run dev
```

### Variáveis de Ambiente

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/CarInsight"

# LLM Providers (com fallback automático)
OPENAI_API_KEY="sk-proj-..."    # Primário (LLM + Embeddings)
GROQ_API_KEY="gsk-..."          # Fallback LLM (opcional)
COHERE_API_KEY="..."            # Fallback Embeddings (opcional)

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

## 📊 Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento
npm run dev:api          # Servidor API sem WhatsApp
npm run build            # Build para produção
npm run start:prod       # Inicia servidor em produção

# Database
npm run db:push          # Aplica schema Prisma
npm run db:studio        # Abre Prisma Studio
npm run db:seed:real     # Popula com veículos reais

# Embeddings
npm run embeddings:generate    # Gera embeddings OpenAI
npm run embeddings:stats       # Mostra estatísticas
npm run embeddings:force       # Força regeneração

# Testes
npm test                 # Executa todos os testes
npm run test:coverage    # Com coverage report
npm run test:watch       # Watch mode
npm run test:ui          # Interface visual
npm run test:e2e         # Apenas testes E2E
npm run test:integration # Apenas testes de integração

# Utilitários
npm run conversations:reset     # Reset conversas de teste
npm run vehicles:update-uber    # Atualiza elegibilidade Uber
npm run benchmark:llms          # Compara performance LLMs
```

## 📁 Estrutura do Projeto

```
CarInsight-mvp-v2/
├── src/
│   ├── index.ts                    # Entry point & Express App
│   ├── agents/                     # Agentes especializados
│   │   ├── orchestrator.agent.ts   # Roteamento e intenção
│   │   ├── quiz.agent.ts           # Coleta de preferências
│   │   ├── recommendation.agent.ts # Recomendações com LLM
│   │   ├── vehicle-expert.agent.ts # Especialista em veículos
│   │   ├── financing.agent.ts      # Simulação de financiamento
│   │   ├── trade-in.agent.ts       # Avaliação de troca
│   │   └── preference-extractor.agent.ts
│   ├── services/                   # Serviços de negócio
│   │   ├── guardrails.service.ts   # Segurança e validação
│   │   ├── uber-eligibility-*.ts   # Regras de Uber (Validator, Scraper)
│   │   ├── vehicle-ranker.service.ts # IA Reranking
│   │   ├── exact-search*.ts        # Busca exata e parser
│   │   └── whatsapp-meta.service.ts
│   ├── routes/                     # Rotas Express
│   │   ├── webhook.routes.ts       # WhatsApp webhooks
│   │   ├── admin.routes.ts         # Admin endpoints
│   │   └── debug.routes.ts         # Debug endpoints
│   ├── config/                     # Configurações
│   └── graph/                      # State Machine & LangGraph
│       ├── conversation-graph.ts
│       └── nodes/                  # Nós do grafo (Discovery, Negotiation, etc)
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── seed-*.ts                   # Scripts de seed
├── tests/                          # Suite de testes
│   ├── e2e/                        # Testes end-to-end
│   ├── integration/                # Testes de integração
│   ├── unit/                       # Testes unitários
│   └── agents/                     # Testes de agentes
└── docs/                           # Documentação técnica
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Com coverage (target 80%+)
npm run test:coverage

# Interface visual do Vitest
npm run test:ui

# Watch mode (desenvolvimento)
npm run test:watch

# Testes específicos
npm run test:e2e           # End-to-end
npm run test:integration   # Integração
npm run test:unit          # Unitários
```

### Categorias de Testes

| Categoria | Descrição |
|-----------|-----------|
| **E2E** | Fluxo conversacional completo, guardrails |
| **Integration** | LLM integration, webhooks, API |
| **Unit** | LLM router, embedding router, services |
| **Agents** | Quiz agent, recommendation agent |

## 🔄 Fluxo de Recomendação (Agentic)

```
1. Usuário envia mensagem ("Quero um SUV para família")
         │
2. LangGraph inicia/carrega estado (thread_id)
         │
3. DISCOVERY Node:
   • Analisa intenção com LLM
   • Extrai entidades (Budget, Tipo, Uso)
   • Decide se precisa de mais info ou pode buscar
         │
4. SEARCH Node (se perfil suficiente):
   • Converte query natural -> Filtros (ano, km, preço)
   • Gera embedding da intenção
   • Busca Híbrida (Vector + SQL)
         │
5. RECOMMENDATION Node:
   • Reranking dos resultados (LLM avalia fit)
   • Seleciona Top 3
   • Gera justificativa personalizada ("Bom para família pois tem porta-malas X")
         │
6. Resposta enviada ao usuário
```

## 🔌 API & Endpoints

O servidor Express expõe endpoints para administração e webhooks:

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/webhooks/whatsapp` | Webhook oficial da Meta Cloud API |
| `GET` | `/webhooks/whatsapp` | Verificação de token (Meta challenge) |
| `GET` | `/admin/health` | Healthcheck detalhado do sistema |
| `GET` | `/stats` | Estatísticas (Conversas, Leads, Veículos) |
| `POST` | `/api/reset-conversation` | Utilitário de teste (limpa estado de um nº) |
| `GET` | `/` | Dashboard básico de status |

## 📚 Documentação

- [Arquitetura do Sistema](docs/development/RESUMO_IMPLEMENTACAO.md)
- [LLM Routing Guide](docs/LLM_ROUTING_GUIDE.md)
- [ISO42001 Compliance](docs/development/ISO42001_IMPLEMENTACAO_COMPLETA.md)
- [Guardrails Architecture](docs/GUARDRAILS_ADVANCED_ARCHITECTURE.md)
- [Testing Summary](docs/development/TESTING_SUMMARY.md)
- [Deploy Railway](docs/RAILWAY_DEPLOY_GUIDE.md)

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/amazing-feature`)
3. Commit suas mudanças (`git commit -m 'feat: add amazing feature'`)
4. Push para a branch (`git push origin feature/amazing-feature`)
5. Abra um Pull Request

## 📄 Licença

Este é um **software proprietário** disponibilizado para fins de avaliação técnica por recrutadores.  
Veja [LICENSE](LICENSE) e [NOTICE.md](NOTICE.md) para termos de uso.

## 👨‍💻 Autor

**Rafael Novaes**

- GitHub: [@rafaelnovaes22](https://github.com/rafaelnovaes22)
- LinkedIn: [Rafael Novaes](https://linkedin.com/in/rafaeldenovaes)

## 🙏 Agradecimentos

- [OpenAI](https://openai.com/) - GPT-4o-mini e Embeddings
- [Groq](https://groq.com/) - LLM ultra-rápido (fallback)
- [Cohere](https://cohere.com/) - Embeddings multilingual
- [Meta](https://developers.facebook.com/) - WhatsApp Business API
- [Prisma](https://www.prisma.io/) - Type-safe ORM
- [Vitest](https://vitest.dev/) - Testing framework moderno

---

⭐ Se este projeto foi útil, considere dar uma estrela!

**Status:** ✅ MVP 100% Funcional | Multi-LLM Router | ISO42001 Compliant
