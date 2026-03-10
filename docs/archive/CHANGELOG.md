# Changelog - FaciliAuto MVP

## [Unreleased]

### ✨ Adicionado
- **Integração Groq (LLaMA 3.3 70B)** - Substituindo OpenAI
  - 18x mais rápido que GPT-4 (~800 tokens/s)
  - 50x mais barato ($0.59/1M tokens vs $30/1M)
  - Biblioteca `src/lib/groq.ts` com funções especializadas:
    - `chatCompletion()` - Chat genérico
    - `salesChatCompletion()` - Chat otimizado para vendas
    - `extractIntent()` - Classificação de intenção
    - `generateRecommendationReasoning()` - Explicações personalizadas
  - Modo MOCK funcional para desenvolvimento sem API key
  - Documentação completa em `GROQ_INTEGRATION.md`

### 🔄 Modificado
- `OrchestratorAgent` agora usa Groq para classificação de intenção
- `RecommendationAgent` usa Groq para gerar explicações das recomendações
- `env.ts` expandido com `GROQ_API_KEY`
- `.env.example` atualizado com instruções Groq
- Schema Prisma: PostgreSQL para produção, SQLite para desenvolvimento local

### 🧪 Testado
- ✅ Bot conversation flow completo (greeting → quiz → recommendations)
- ✅ Guardrails 100% success rate (35/35 testes)
- ✅ Modo MOCK funcionando sem API keys
- ✅ Recomendações com Match Score (100/89/81)

---

## [2.0.0] - 2025-01-15

### ✨ MVP v2.0 - Pronto para Deploy

#### Implementado
- LangGraph completo com 4 nodes (Greeting, Quiz, Search, Recommendation)
- ChromaDB/Busca Vetorial com in-memory store
- 30 veículos indexados com embeddings
- Match Score híbrido (40% semântico + 60% critérios)
- Guardrails completos (validação input/output, rate limiting)
- PostgreSQL configurado
- Railway pronto para deploy
- Git repository inicializado

#### Stack
- Node.js 20+ / TypeScript
- Baileys (WhatsApp)
- Prisma ORM
- PostgreSQL / SQLite
- ChromaDB
- Groq (LLaMA 3.3 70B)

---

## Como usar este arquivo

Este CHANGELOG segue o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

### Categorias
- **✨ Adicionado** - Novas funcionalidades
- **🔄 Modificado** - Mudanças em funcionalidades existentes
- **❌ Removido** - Funcionalidades removidas
- **🐛 Corrigido** - Correções de bugs
- **🔒 Segurança** - Correções de vulnerabilidades
- **🧪 Testado** - Testes adicionados/modificados
