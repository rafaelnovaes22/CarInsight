# 🧠 Configuração de Embeddings com Jina AI

## Por que Jina AI?

- ✅ **100% GRÁTIS** até 1M tokens/mês (permanente)
- ✅ Qualidade excelente para buscas semânticas
- ✅ Suporta português nativamente
- ✅ 1024 dimensões (leve e rápido)
- ✅ Sem cartão de crédito necessário

**Alternativas avaliadas:**
- OpenAI: $0.20/1M tokens (5x mais caro)
- Cohere: $0.10/1M tokens (2x mais caro)
- Voyage AI: $0.06/1M tokens (barato, mas pago)

## 📝 Como obter a API Key

### 1. Criar conta
Acesse: https://jina.ai/

### 2. Fazer login
Clique em "Sign In" ou "Get Started"

### 3. Obter API Key
1. Vá para o Dashboard
2. Clique em "API Keys" no menu lateral
3. Clique em "Create API Key"
4. Copie a chave (começa com `jina_...`)

### 4. Configurar no projeto

**Desenvolvimento local:**
```bash
# Editar .env
nano .env

# Adicionar:
JINA_API_KEY="jina_sua_chave_aqui"
```

**Produção (Railway/Heroku):**
```bash
# Railway
railway variables set JINA_API_KEY=jina_sua_chave_aqui

# Heroku
heroku config:set JINA_API_KEY=jina_sua_chave_aqui
```

## 🧪 Testar embeddings

```bash
# Com Jina AI configurada
npm run dev

# Logs devem mostrar:
# ℹ️  Usando Jina AI para embeddings (grátis)
# 🧠 Inicializando vector store...
# ✅ Vector store ready with 30 embeddings
```

## 📊 Limites do Free Tier

- **Requests:** Ilimitados
- **Tokens:** 1M/mês (gratuito permanente)
- **Rate limit:** 500 req/min

**Uso esperado (30 veículos):**
- Inicialização: ~4.5k tokens (única vez)
- Por conversa: ~50 tokens
- **Capacidade:** ~20.000 conversas/mês GRÁTIS

## 🚀 Quando pagar?

Só precisa pagar se ultrapassar 1M tokens/mês.

**Para 30 veículos, isso significa:**
- 20.000+ conversas/mês
- ~666 conversas/dia
- Provavelmente nunca vai precisar pagar! 🎉

## 🔄 Migração futura (se necessário)

Se crescer muito e precisar de mais performance:

1. **Voyage AI** ($0.06/1M) - Melhor custo-benefício pago
2. **Cohere** ($0.10/1M) - Excelente para multilíngue
3. **OpenAI** ($0.20/1M) - Padrão da indústria

Todas usam a mesma arquitetura - migração é fácil (só trocar API).

## ❓ Troubleshooting

### Erro: "JINA_API_KEY não configurada"
- Verifique se adicionou a chave no `.env`
- Reinicie o servidor após adicionar

### Erro: "401 Unauthorized"
- API key incorreta
- Regenere a chave no dashboard Jina

### Embeddings muito lentos
- Normal na primeira vez (gera para 30 veículos)
- Após isso, só 1 embedding por busca (rápido)

### Sistema funciona sem embeddings?
- ✅ SIM! Usa busca SQL como fallback
- Mas embeddings melhoram muito a qualidade das recomendações

## 🎯 Diferencial Competitivo

**Sem embeddings (SQL puro):**
```
Cliente: "carro econômico pra cidade"
Sistema: Busca por tipo="hatch" (limitado)
```

**Com embeddings (Jina AI):**
```
Cliente: "carro econômico pra cidade"
Sistema: Entende semanticamente e busca:
  - Hatch/Sedan compacto
  - Baixo consumo
  - Fácil estacionar
  - Até 1.6 motor
  → Recomendações muito mais precisas! 🎯
```

---

**Custo total do MVP:**
- Groq (LLM): **$0** ✅
- Jina (Embeddings): **$0** ✅
- Meta WhatsApp: **$0** até 1000 conversas ✅

**Total: R$ 0,00/mês** 🎉
