# 🚗 FaciliAuto - Assistente de Vendas com IA via WhatsApp

> Sistema de vendas automotivas de nível empresarial utilizando IA Generativa, RAG e roteamento Multi-LLM para recomendações inteligentes de veículos via WhatsApp.

[![CI/CD](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelnovaes22/CarInsight/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 🇺🇸 **[English Version](README.md)**

---

## 🎯 Visão Geral

FaciliAuto é um sistema de IA conversacional pronto para produção, projetado para concessionárias automotivas. Combina tecnologia LLM de ponta com busca vetorial para fornecer recomendações personalizadas de veículos através do WhatsApp, com mecanismos inteligentes de fallback e conformidade ISO42001.

### Destaques Principais

- 🤖 **Arquitetura Multi-LLM** - OpenAI GPT-4o-mini com fallback Groq
- 🔍 **Busca com RAG** - Embeddings vetoriais para matching semântico de veículos
- 📱 **Integração WhatsApp** - API oficial Meta Business
- 🔒 **Segurança Empresarial** - Conformidade ISO42001 com guardrails anti-injection
- 🔄 **Alta Disponibilidade** - Padrão circuit breaker com failover automático
- ✅ **Pronto para Produção** - Suite completa de testes e pipeline CI/CD

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp Business API                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Máquina de Estados LangGraph                    │
│  • Orquestração baseada em Grafos                           │
│  • Roteamento multi-agente                                  │
└──────────┬──────────┬──────────┬───────────────────────────┘
           │          │          │
    ┌──────▼──┐ ┌─────▼────┐ ┌──▼─────────────┐
    │  Quiz   │ │ Especialista│ │ Recomendação │
    │  Agent  │ │  Veículos  │ │     Agent    │
    └────┬────┘ └────┬─────┘ └───────┬────────┘
         │          │               │
┌────────▼──────────▼───────────────▼─────────────────────────┐
│                    Roteador LLM                              │
│  • GPT-4o-mini → Groq LLaMA → Mock                          │
│  • Circuit breaker + Lógica de retry                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               Vector Store (In-Memory)                       │
│  • OpenAI Embeddings → Cohere fallback                      │
│  • Similaridade cosseno < 50ms                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   PostgreSQL + Prisma                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 20+
- PostgreSQL 14+
- Chave API OpenAI
- Conta Meta WhatsApp Business

### Instalação

```bash
# Clonar repositório
git clone https://github.com/rafaelnovaes22/CarInsight.git
cd CarInsight

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Configurar banco de dados
npx prisma generate
npx prisma db push

# Popular com dados de exemplo
npm run db:seed:robustcar

# Iniciar servidor de desenvolvimento
npm run dev
```

📖 **Guia detalhado de instalação:** [docs/setup/PROXIMOS_PASSOS.md](docs/setup/PROXIMOS_PASSOS.md)

---

## 🛠️ Stack Tecnológico

| Categoria | Tecnologias |
|----------|-------------|
| **Backend** | Node.js 20, TypeScript 5.3, Express.js, LangGraph |
| **IA/LLM** | OpenAI GPT-4o-mini, Groq LLaMA 3.1, Cohere |
| **Banco de Dados** | PostgreSQL 14+, Prisma ORM |
| **Mensageria** | Meta WhatsApp Business API |
| **Testes** | Vitest, Supertest |
| **DevOps** | Docker, Railway, GitHub Actions |
| **Segurança** | Validação Zod, Hooks Husky, Guardrails ISO42001 |

---

## 📊 Funcionalidades

### Motor de Recomendação Inteligente
- Busca semântica baseada em vetores com embeddings de 1536 dimensões
- Avaliação de adequação de veículos com LLM
- Filtragem contextual (orçamento, uso, tamanho da família)
- Top-3 recomendações com justificativas detalhadas

### Roteamento Multi-LLM
- Primário: OpenAI GPT-4o-mini ($0.15/$0.60 por 1M tokens)
- Fallback: Groq LLaMA 3.1 8B ($0.05/$0.08 por 1M tokens)
- Circuit breaker com failover automático
- Modo mock para desenvolvimento

### Máquina de Estados Conversacional
- Implementação em TypeScript puro
- Estados: Saudação → Descoberta → Clarificação → Recomendação
- Agentes especializados por fase da conversa
- Histórico de conversas persistente

### Segurança & Conformidade
- Sistema de Gestão de IA ISO42001
- Detecção anti-prompt injection (30+ padrões)
- Rate limiting (10 msgs/min por usuário)
- Sanitização de entrada e validação de saída
- Estrutura pronta para GDPR/LGPD

---

## 📁 Estrutura do Projeto

```
CarInsight/
├── src/
│   ├── agents/           # Agentes de IA especializados
│   ├── lib/              # Bibliotecas core (roteador LLM, embeddings)
│   ├── services/         # Lógica de negócio
│   ├── routes/           # Rotas Express
│   └── graph/            # Máquina de estados
├── prisma/               # Schema e migrações do banco
├── tests/                # Suite de testes (unit, integration, e2e)
├── docs/                 # Documentação
│   ├── setup/            # Guias de instalação
│   └── development/      # Documentação técnica
└── scripts/              # Scripts utilitários
```

---

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar com cobertura
npm run test:coverage

# Executar suites específicas
npm run test:unit
npm run test:integration
npm run test:e2e

# Interface visual de testes
npm run test:ui
```

**Cobertura de Testes:** Meta de 80%+ em testes unitários, integração e E2E.

---

## 📚 Documentação

| Documento | Descrição |
|----------|-------------|
| [Guia de Setup](docs/setup/PROXIMOS_PASSOS.md) | Instalação passo a passo |
| [Workflow Git](docs/GIT_WORKFLOW.md) | Workflow multi-repositório |
| [Arquitetura](docs/development/RESUMO_IMPLEMENTACAO.md) | Detalhes do design do sistema |
| [Roteamento LLM](docs/LLM_ROUTING_GUIDE.md) | Configuração Multi-LLM |
| [ISO42001](docs/development/ISO42001_IMPLEMENTACAO_COMPLETA.md) | Documentação de conformidade |
| [Testes](docs/development/TESTING_SUMMARY.md) | Estratégia de testes |

---

## 🔧 Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev              # Iniciar servidor dev
npm run build            # Build de produção
npm run start:prod       # Iniciar servidor produção

# Banco de Dados
npm run db:push          # Aplicar schema
npm run db:seed:robustcar # Popular com veículos
npx prisma studio        # Editor visual do banco

# Testes
npm test                 # Executar todos os testes
npm run test:coverage    # Com relatório de cobertura

# Utilitários
npm run embeddings:generate  # Gerar embeddings vetoriais
npm run vehicles:fix-urls    # Corrigir URLs de veículos
```

---

## 🚀 Deploy

### Railway (Recomendado)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login e deploy
railway login
railway up
```

📖 **Guia de deployment:** [docs/RAILWAY_DEPLOY_GUIDE.md](docs/RAILWAY_DEPLOY_GUIDE.md)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, siga estes passos:

1. Faça fork do repositório
2. Crie uma branch de feature (`git checkout -b feature/funcionalidade-incrivel`)
3. Commit suas mudanças (`git commit -m 'feat: adiciona funcionalidade incrível'`)
4. Push para a branch (`git push origin feature/funcionalidade-incrivel`)
5. Abra um Pull Request

**Convenção de Commits:** Use prefixos semânticos (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 👨‍💻 Autor

**Rafael Novaes**

- GitHub: [@rafaelnovaes22](https://github.com/rafaelnovaes22)
- LinkedIn: [Rafael Novaes](https://linkedin.com/in/rafaelnovaes22)

---

## 🙏 Agradecimentos

- [OpenAI](https://openai.com/) - GPT-4o-mini e embeddings
- [Groq](https://groq.com/) - Inferência LLM ultra-rápida
- [Cohere](https://cohere.com/) - Embeddings multilíngues
- [Meta](https://developers.facebook.com/) - WhatsApp Business API
- [Prisma](https://www.prisma.io/) - ORM type-safe
- [Vitest](https://vitest.dev/) - Framework de testes moderno

---

<div align="center">

**Status:** ✅ Pronto para Produção | Roteador Multi-LLM | Conformidade ISO42001

⭐ Se este projeto te ajudou, considere dar uma estrela!

</div>
