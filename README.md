# 🚗 CarInsight - AI Automotive Sales Assistant

> Assistente inteligente de vendas automotivas via WhatsApp com Tecnologia Agentic AI, RAG e Smart Ranking

[![CI/CD](https://github.com/Start-CarInsight/CarInsight/actions/workflows/ci.yml/badge.svg)](https://github.com/Start-CarInsight/CarInsight/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Sobre o Projeto

**CarInsight** é uma plataforma Enterprise-Grade de automação de vendas para concessionárias via WhatsApp. Diferente de chatbots tradicionais, utiliza uma arquitetura de múltiplos agentes inteligentes que colaboram para entender profundamente o perfil do cliente e realizar vendas consultivas.

O sistema opera com **Smart Ranking**, uma tecnologia proprietária que avalia cada veículo do estoque contra o perfil do cliente usando LLMs, garantindo recomendações de alta precisão (ex: priorizando motos robustas para entregadores ou SUVs econômicos para Uber).

### ✨ Principais Diferenciais

- 🧠 **Smart Ranking Engine** - Avalia 50+ veículos e seleciona os Top 5 com *Score de Adequação* (0-100).
- 🎯 **Strict Filtering** - Garante tolerância zero a alucinações (ex: nunca recomendar Carro se o pedido foi Moto).
- 🕵️ **Busca Vetorial Híbrida** - Combina OpenAI Embeddings com filtros determinísticos SQL.
- 💬 **Agentes Especializados** - Orquestrador, Extrator de Preferências, Especialista em Veículos e Negociador.
- 📱 **Meta WhatsApp Business API** - Integração oficial, rápida e estável.
- 🛡️ **Segurança Enterprise** - Guardrails anti-injection, ISO42001 compliance e higienização de dados.

## 🤖 Arquitetura de Inteligência

### 1. Smart Ranking (O Cérebro da Recomendação)

Em vez de apenas filtrar por preço, o CarInsight entende o **contexto** de uso:
- **Delivery/iFood:** Prioriza motos de manutenção barata (Honda/Yamaha) e robustez.
- **Motorista de App (Uber/99):** Prioriza sedans com GNV/Flex, ano > 2016 e porta-malas.
- **Uso Familiar:** Prioriza segurança, espaço e conforto.

### 2. Pipeline de Busca (Retrieve & Re-rank)
1.  **Retrieval:** Busca vetorial e SQL recupera os 50 candidatos mais relevantes.
2.  **Hard Filtering:** Remove incompatibilidades óbvias (ex: Carro vs Moto).
3.  **LLM Scoring:** Agente avalia cada candidato restante e atribui nota de 0 a 100 com justificativa.
4.  **Presentation:** Apresenta apenas os Top 5 com explicações personalizadas.

### 3. LLM Router e Resiliência
Sistema de alta disponibilidade que alterna entre provedores em caso de falha:

| Prioridade | Provider | Modelo | Função |
|------------|----------|--------|--------|
| 1️⃣ Primário | OpenAI | `gpt-4o-mini` | Raciocínio, Ranking e Chat |
| 2️⃣ Fallback | Groq | `llama-3.1-8b` | Backup de alta velocidade |

## 🛠️ Stack Tecnológico

- **Core:** Node.js 20+, TypeScript 5.3, Express.js
- **IA:** OpenAI SDK, LangChain, Vercel AI SDK
- **Dados:** PostgreSQL 14, Prisma ORM, In-Memory Vector Store
- **Infra:** Docker, GitHub Actions (CI/CD), Railway
- **Qualidade:** Vitest (Unit/Integration/E2E), ESLint, Prettier

## 🚀 Como Executar

### Pré-requisitos
- Node.js 20+
- PostgreSQL
- OpenAI API Key

### Instalação

```bash
# Clone o repositório
git clone https://github.com/Start-CarInsight/CarInsight.git
cd CarInsight

# Instale dependências
npm install

# Configure o ambiente
cp .env.example .env

# Banco de dados
npm run db:push
npm run db:seed:real

# Iniciar
npm run dev
```

## 🧪 Qualidade de Código (Lint Zero Policy)

Mantemos um padrão rigoroso de qualidade. O pipeline de CI/CD garante:
1.  **Lint Zero:** Nenhum warning ou erro de ESLint permitido.
2.  **Type Safety:** `tsc` deve compilar sem erros (noImplicitAny).
3.  **Testes:** Cobertura de testes unitários e de integração obrigatória para novas features.

```bash
npm test                 # Executa suite de testes
npm run lint             # Verifica estilo de código
npm run build            # Verifica compilação
```

## 📄 Licença

Este projeto é proprietário da **CarInsight Solutions**.
Desenvolvido por **Rafael Novaes** e **Equipe de IA**.

---
**Status:** 🟢 Production Ready | Smart Ranking V2 Ativo
