# ✅ Railway - Checklist de Variáveis de Ambiente

**Deploy:** faciliauto-mvp-v2  
**Status:** 🔴 AGUARDANDO CONFIGURAÇÃO

---

## 🔑 Variáveis OBRIGATÓRIAS

### 1. Database (Gerado Automaticamente)
```bash
DATABASE_URL = <copiado_do_postgresql_service>
```
📝 **Como obter:** Railway → PostgreSQL Service → Variables → DATABASE_URL (copiar)

---

### 2. OpenAI (LLM Primário + Embeddings)
```bash
OPENAI_API_KEY = sk-proj-...
```
📝 **Como obter:**
1. https://platform.openai.com/api-keys
2. Create new secret key
3. Copiar (aparece apenas 1 vez!)
4. Adicionar $5 de crédito mínimo

💰 **Custo:** ~$9/mês (10k msgs + 300k embeddings)

---

### 3. Groq (LLM Fallback)
```bash
GROQ_API_KEY = gsk-...
```
📝 **Como obter:**
1. https://console.groq.com/keys
2. Login com Google/GitHub
3. Create API Key
4. Copiar

💰 **Custo:** GRATUITO (tier: 30 req/min, 14.4k tokens/min)

---

### 4. Meta WhatsApp (Oficial)
```bash
META_WHATSAPP_TOKEN = EAA...
META_WHATSAPP_PHONE_NUMBER_ID = 123...
META_WEBHOOK_VERIFY_TOKEN = faciliauto_webhook_2025
```
📝 **Como obter:**
1. https://developers.facebook.com/apps/
2. Seu app → WhatsApp → API Setup
3. Copiar Token e Phone Number ID
4. Verify Token: usar `faciliauto_webhook_2025`

💰 **Custo:** 1.000 conversas grátis/mês

---

### 5. Ambiente
```bash
NODE_ENV = production
PORT = 3000
```
📝 **Fixo - usar valores acima**

---

## 🔄 Variáveis OPCIONAIS (Recomendadas)

### 6. Cohere (Embeddings Fallback)
```bash
COHERE_API_KEY = ...
```
📝 **Como obter:**
1. https://dashboard.cohere.com/api-keys
2. Create trial key
3. Copiar

💰 **Custo:** GRATUITO (trial: 100 req/min)

🎯 **Benefício:** Alta disponibilidade (99.9%+) se OpenAI falhar

---

### 7. Redis (Cache - Futuro)
```bash
REDIS_URL = redis://...
```
📝 **Como adicionar:**
1. Railway → Add Service → Redis
2. Copiar REDIS_URL gerado

💰 **Custo:** Incluído no Railway

⏳ **Status:** NÃO IMPLEMENTADO AINDA

---

### 8. CRM (Futuro)
```bash
CRM_WEBHOOK_URL = 
```
⏳ **Status:** DEIXAR VAZIO POR ENQUANTO

---

## 📋 Resumo - Copiar e Colar no Railway

```bash
# === OBRIGATÓRIAS ===

# 1. Database (copiar do PostgreSQL service)
DATABASE_URL=postgresql://...

# 2. OpenAI (https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-...

# 3. Groq (https://console.groq.com/keys)
GROQ_API_KEY=gsk-...

# 4. Meta WhatsApp (https://developers.facebook.com/apps/)
META_WHATSAPP_TOKEN=EAA...
META_WHATSAPP_PHONE_NUMBER_ID=123...
META_WEBHOOK_VERIFY_TOKEN=faciliauto_webhook_2025

# 5. Ambiente
NODE_ENV=production
PORT=3000

# === OPCIONAIS (Recomendadas) ===

# 6. Cohere - Fallback Embeddings (https://dashboard.cohere.com/api-keys)
COHERE_API_KEY=...
```

---

## 🚀 Passo a Passo Rápido

### Via Railway UI (Recomendado)

1. **Acessar Railway:**
   - https://railway.app/
   - Login
   - Selecionar projeto: faciliauto-mvp-v2

2. **Adicionar PostgreSQL:**
   - "+ New" → Database → PostgreSQL
   - Aguardar provisioning
   - Copiar `DATABASE_URL`

3. **Configurar Variáveis:**
   - Clicar no service principal
   - Aba "Variables"
   - "+ New Variable"
   - Colar cada variável (nome = valor)

4. **Deploy:**
   - Automático após adicionar variáveis
   - Ou: Deployments → "Deploy"

5. **Verificar Logs:**
   - Deployments → Clicar no deploy ativo
   - Procurar: ✅ "Server started on port 3000"

### Via Railway CLI (Mais Rápido)

```bash
# 1. Instalar CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Linkar projeto
railway link

# 4. Adicionar variáveis (substituir valores)
railway variables set DATABASE_URL="postgresql://..."
railway variables set OPENAI_API_KEY="sk-proj-..."
railway variables set GROQ_API_KEY="gsk-..."
railway variables set COHERE_API_KEY="..."
railway variables set META_WHATSAPP_TOKEN="EAA..."
railway variables set META_WHATSAPP_PHONE_NUMBER_ID="123..."
railway variables set META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"
railway variables set NODE_ENV="production"
railway variables set PORT="3000"

# 5. Verificar
railway variables

# 6. Ver logs
railway logs
```

---

## ✅ Validação Pós-Deploy

### 1. Health Check
```bash
curl https://seu-projeto.up.railway.app/health
# Esperado: {"status":"ok"}
```

### 2. Verificar Logs
```bash
railway logs | grep "LLM"

# Deve mostrar:
# ✅ OpenAI enabled: true
# ✅ Groq enabled: true
# ✅ Cohere enabled: true (se configurado)
```

### 3. Testar Webhook
```bash
curl "https://seu-projeto.up.railway.app/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=faciliauto_webhook_2025&hub.challenge=teste123"

# Esperado: teste123
```

---

## 🐛 Troubleshooting Comum

### ❌ "Module not found: cohere-ai"
**Solução:** Deploy já inclui, aguardar build terminar

### ❌ "OPENAI_API_KEY not configured"
**Solução:** Adicionar variável e fazer restart do service

### ❌ "Database connection failed"
**Solução:** 
1. Verificar se PostgreSQL está running
2. Copiar DATABASE_URL correta
3. Restart service

### ⚠️ "Circuit breaker open for openai"
**Solução:**
- API Key inválida ou sem créditos
- Sistema usa Groq automaticamente (fallback)
- Adicionar créditos em https://platform.openai.com/usage

---

## 💰 Estimativa de Custos

| Item | Custo/Mês |
|------|-----------|
| Railway (Hobby) | $5 |
| PostgreSQL | Incluído |
| OpenAI (LLM) | ~$3 |
| OpenAI (Embeddings) | ~$6 |
| Groq (Fallback) | $0 (gratuito) |
| Cohere (Fallback) | $0 (gratuito) |
| **TOTAL** | **~$14/mês** |

---

## 📞 Links Úteis

- **Railway Dashboard:** https://railway.app/dashboard
- **OpenAI Keys:** https://platform.openai.com/api-keys
- **Groq Console:** https://console.groq.com/keys
- **Cohere Dashboard:** https://dashboard.cohere.com/api-keys
- **Meta Developers:** https://developers.facebook.com/apps/
- **GitHub Repo:** https://github.com/rafaelnovaes22/faciliauto-mvp-v2

---

## 🎯 Status Atual

- [x] Código pushed para GitHub
- [ ] PostgreSQL adicionado no Railway
- [ ] DATABASE_URL configurada
- [ ] OPENAI_API_KEY configurada
- [ ] GROQ_API_KEY configurada
- [ ] COHERE_API_KEY configurada (opcional)
- [ ] META_WHATSAPP_TOKEN configurada
- [ ] META_WHATSAPP_PHONE_NUMBER_ID configurada
- [ ] Deploy bem-sucedido
- [ ] Health check OK
- [ ] WhatsApp webhook configurado

---

**Próximo Passo:** Configurar variáveis no Railway e fazer deploy! 🚀
