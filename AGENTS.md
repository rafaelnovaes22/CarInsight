# 🤖 Agent Instructions - CarInsight

> Este arquivo contém instruções e preferências para agentes de código (AI) trabalhando neste projeto.

---

## 🚀 Fluxo de Trabalho - Push para Repositórios

### ⚠️ OBRIGATÓRIO: CI/CD Local Antes do Push

**Sempre que solicitado para fazer push em qualquer repositório, execute PRIMEIRO o CI/CD local para garantir que tudo está correto.**

#### Comando de Verificação Local (Pre-Push)

```bash
# 1. Verificar formatação
npm run format

# 2. Executar linter
npm run lint

# 3. Compilar TypeScript (verificar erros de tipo)
npm run build

# OU execute o comando completo de verificação:
npm run verify
```

#### Se houver erros:

1. **Corrija os erros antes de fazer push**
2. Nunca faça push com código quebrado
3. Se não conseguir corrigir, informe o usuário sobre os erros encontrados

#### Somente após sucesso:

```bash
# Commit
 git add -A
 git commit -m "feat: descrição clara das mudanças"

# Push para ambos os repositórios
 git push origin main
 git push novais main
```

---

## 📋 Checklist Pré-Push

- [ ] `npm run format` - Código formatado
- [ ] `npm run lint` - Sem erros de lint
- [ ] `npm run build` - TypeScript compila sem erros
- [ ] Testes passam (se aplicável)
- [ ] `.env.example` atualizado (se adicionou novas variáveis)
- [ ] Documentação atualizada (se necessário)

---

## 🔄 Repositórios Remotos

| Nome | URL | Branch Principal |
|------|-----|------------------|
| `origin` | https://github.com/rafaelnovaes22/CarInsight.git | `main` |
| `novais` | https://github.com/NovAIs-Digital/renatinhus-cars.git | `main` |

**Sempre fazer push para ambos os repositórios quando solicitado.**

---

## 🛠️ Stack Tecnológico

- **Runtime:** Node.js 20+
- **Linguagem:** TypeScript 5.3+
- **Framework:** Express.js
- **ORM:** Prisma
- **Banco:** PostgreSQL 14+ com pgvector
- **Cache/Rate Limit:** Redis (opcional)
- **IA:** LangGraph + OpenAI/Groq
- **Testes:** Vitest
- **Deploy:** Railway

---

## 📁 Estrutura de Pastas Importantes

```
src/
├── agents/          # Agentes LangGraph
├── graph/           # Fluxo de conversação (nodes, workflow)
├── services/        # Regras de negócio
├── lib/             # Utilitários (logger, rate-limit, etc)
├── config/          # Configurações (env, etc)
├── routes/          # Rotas Express
└── types/           # Tipos TypeScript

docs/                # Documentação
monitoring/          # Prometheus + Grafana
tests/               # Testes (unit, integration, e2e)
```

---

## ⚠️ Pontos de Atenção

1. **Nunca commitar secrets** - Use `.env` e `.env.example`
2. **Rate limiting** - Sempre usar em endpoints públicos
3. **Máscara de dados** - Usar `maskPhoneNumber` para logs
4. **Erros LLM** - Sempre ter fallback (Groq, mock)
5. **WhatsApp** - Respeitar rate limits da Meta

---

## 📝 Convenções de Código

- **Estilo:** Prettier + ESLint configurados
- **Commits:** Conventional commits (`feat:`, `fix:`, `docs:`, etc)
- **Branches:** `main` para produção, `develop` para staging
- **Nomenclatura:** camelCase para variáveis, PascalCase para classes

---

## 🔗 Links Úteis

- **Railway Dashboard:** https://railway.app/project/[id]
- **Logs:** `railway logs --tail`
- **Health Check:** `https://[app]/health`
- **Métricas:** `https://[app]/admin/prometheus`

---

> Última atualização: 2026-03-04
