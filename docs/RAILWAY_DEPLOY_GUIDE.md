# 🚂 Railway Deploy - Guia Completo

**Última atualização:** 2025-01-XX  
**Status:** ✅ PRONTO PARA DEPLOY

---

## 📋 Pré-requisitos

- ✅ Código commitado e pushed para GitHub
- ✅ Conta Railway ativa
- ✅ API Keys obtidas (OpenAI, Groq, Cohere)
- ✅ Meta WhatsApp configurado

---

## 🔑 Variáveis de Ambiente - Railway

### Obrigatórias (Sistema Funcional)

```bash
# Database
DATABASE_URL=<gerado_automaticamente_pelo_railway>

# LLM Primário
OPENAI_API_KEY=sk-...

# LLM Fallback (recomendado)
GROQ_API_KEY=gsk-...

# WhatsApp
META_WHATSAPP_TOKEN=EAA...
META_WHATSAPP_PHONE_NUMBER_ID=123...
META_WEBHOOK_VERIFY_TOKEN=faciliauto_webhook_2025

# Ambiente
NODE_ENV=production
PORT=3000
```

### Obrigatórias (Alta Disponibilidade)

```bash
# Embeddings Fallback (recomendado)
COHERE_API_KEY=...

# Redis (Obrigatório em Produção para Rate Limit e Cache do WhatsApp)
REDIS_URL=redis://...

# CRM (futuro)
CRM_WEBHOOK_URL=
```

---

## 🚀 Passo a Passo - Deploy Railway

### 1. Acessar Railway Dashboard

1. Login em https://railway.app/
2. Selecionar projeto existente ou criar novo

### 2. Conectar GitHub (se novo projeto)

1. "New Project" → "Deploy from GitHub repo"
2. Selecionar: `rafaelnovaes22/faciliauto-mvp-v2`
3. Branch: `main`

### 3. Adicionar Serviços de Apoio (PostgreSQL e Redis)

1. No projeto, clicar "+ New"
2. Selecionar "Database" → "PostgreSQL"
3. Novamente, clicar "+ New"
4. Selecionar "Database" → "Redis"
5. Em cada banco recém-criado, o Railway gerará `DATABASE_URL` e `REDIS_URL`
6. Copiar essas duas URLs e adicioná-las nas variáveis do serviço principal da API (faciliauto-mvp-v2)

### 4. Configurar Variáveis de Ambiente

**Método 1: Via UI**

1. Clicar no serviço (faciliauto-mvp-v2)
2. Aba "Variables"
3. Adicionar uma por uma:

OPENAI_API_KEY = sk-...
GROQ_API_KEY = gsk-...
COHERE_API_KEY = ... (opcional)
META_WHATSAPP_TOKEN = EAA...
META_WHATSAPP_PHONE_NUMBER_ID = 123...
META_WEBHOOK_VERIFY_TOKEN = faciliauto_webhook_2025
NODE_ENV = production
PORT = 3000
DATABASE_URL = postgresql://...
REDIS_URL = redis://...

**Método 2: Via Railway CLI** (mais rápido)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Linkar projeto
railway link

# Adicionar variáveis
railway variables set OPENAI_API_KEY="sk-..."
railway variables set GROQ_API_KEY="gsk-..."
railway variables set COHERE_API_KEY="..."
railway variables set META_WHATSAPP_TOKEN="EAA..."
railway variables set META_WHATSAPP_PHONE_NUMBER_ID="123..."
railway variables set META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"
railway variables set NODE_ENV="production"
```

### 5. Verificar Build Settings

Railway deve detectar automaticamente:

```yaml
Build Command: npm install
Start Command: npm run start:prod (ou npm start)
```

Se não detectar, configurar manualmente em "Settings" → "Deploy":
- Build Command: `npm install && npx prisma generate`
- Start Command: `npx tsx src/index.ts`

### 6. Trigger Deploy

1. "Deployments" → "Deploy"
2. Ou fazer push no GitHub (auto-deploy)

### 7. Monitorar Deploy

Acompanhar logs em tempo real:
- Railway UI: Aba "Deployments" → Clicar no deploy ativo
- Verificar:
  - ✅ Dependencies instaladas
  - ✅ Prisma schema gerado
  - ✅ Servidor iniciado na porta 3000

---

## 🔍 Validação Pós-Deploy

### 1. Verificar Health Check

```bash
# Obter URL do Railway
RAILWAY_URL=https://seu-projeto.up.railway.app

# Testar endpoint
curl $RAILWAY_URL/health

# Resposta esperada:
# {"status":"ok","timestamp":"2025-01-XX..."}
```

### 2. Verificar Logs

```bash
# Via CLI
railway logs

# Procurar por:
# ✅ "Server started on port 3000"
# ✅ "Database connected"
# ✅ "LLM Router initialized"
```

### 3. Testar LLM Routing

Verificar logs para confirmar qual provider está ativo:

```
✅ OpenAI enabled: true
✅ Groq enabled: true
✅ Cohere enabled: true (se configurado)
```

### 4. Testar WhatsApp Webhook

```bash
# Configurar webhook no Meta Developers
# URL: https://seu-projeto.up.railway.app/webhook/whatsapp
# Verify Token: faciliauto_webhook_2025

# Testar verificação
curl "https://seu-projeto.up.railway.app/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=faciliauto_webhook_2025&hub.challenge=teste123"

# Resposta esperada: teste123
```

---

## 🐛 Troubleshooting

### Deploy Falhou

**Erro: "Module not found: cohere-ai"**

**Solução:**
```bash
# Verificar package.json no GitHub
# Deve conter: "cohere-ai": "^7.10.0"

# Se não tiver, commitar novamente
git add package.json package-lock.json
git commit -m "add cohere-ai dependency"
git push

# Railway irá re-deploy automaticamente
```

**Erro: "OPENAI_API_KEY not configured"**

**Solução:**
- Adicionar variável no Railway
- Restart do serviço: Settings → Restart

**Erro: "Database connection failed"**

**Solução:**
1. Verificar se PostgreSQL está rodando no Railway
2. Copiar `DATABASE_URL` do PostgreSQL
3. Adicionar nas variáveis do serviço principal
4. Restart

### Runtime Errors

**Logs mostram: "Circuit breaker open for openai"**

**Causa:** OpenAI API Key inválida ou sem créditos

**Solução:**
1. Verificar saldo em https://platform.openai.com/usage
2. Adicionar créditos ($5 mínimo)
3. Sistema usará Groq automaticamente (fallback)

**Logs mostram: "All providers failed"**

**Causa:** Todas as API keys inválidas

**Solução:**
1. Verificar OPENAI_API_KEY
2. Verificar GROQ_API_KEY
3. Sistema funcionará em mock mode (limitado)

---

## 📊 Monitoramento

### Métricas Importantes

Via Railway Dashboard:

1. **CPU Usage**: < 50% normal
2. **Memory**: < 512MB normal
3. **Response Time**: < 500ms
4. **Error Rate**: < 1%

### Logs Estruturados

```bash
railway logs --filter "LLM call"
railway logs --filter "Circuit breaker"
railway logs --filter "Fallback"
```

### Alertas

Configurar em Railway:
1. Settings → Notifications
2. Alertar se:
   - CPU > 80%
   - Memory > 80%
   - Deploy falhou

---

## 💰 Custos Railway

### Estimativa Mensal

**Railway:**
- Hobby Plan: $5/mês (500h compute)
- PostgreSQL: Incluído
- 100GB tráfego: Incluído

**APIs:**
- OpenAI (LLM + Embeddings): ~$9/mês
- Groq (fallback): Tier gratuito
- Cohere (fallback): Tier gratuito

**Total: ~$14/mês**

---

## 🔄 CI/CD (Auto Deploy)

Railway já configurado para auto-deploy:

```
Push no GitHub (main) → Railway detecta → Deploy automático
```

Desabilitar se necessário:
1. Settings → Deploy
2. Desmarcar "Auto Deploy"

---

## 📱 Configurar WhatsApp Webhook

Após deploy bem-sucedido:

1. **Obter URL Railway:**
   ```
   https://seu-projeto.up.railway.app
   ```

2. **Meta Developers Console:**
   - https://developers.facebook.com/
   - App → Webhooks
   - Callback URL: `https://seu-projeto.up.railway.app/webhook/whatsapp`
   - Verify Token: `faciliauto_webhook_2025`
   - Subscribe to: `messages`

3. **Testar:**
   - Enviar mensagem no WhatsApp
   - Verificar logs Railway para confirmação

---

## ✅ Checklist Final

- [ ] Código pushed para GitHub
- [ ] Railway projeto criado
- [ ] PostgreSQL adicionado
- [ ] Todas variáveis configuradas
- [ ] Deploy bem-sucedido
- [ ] Health check OK
- [ ] Logs sem erros
- [ ] LLM providers ativos
- [ ] WhatsApp webhook configurado
- [ ] Teste end-to-end realizado

---

## 🎯 Próximos Passos Após Deploy

1. **Obter Cohere API Key** (se não tiver)
   - https://dashboard.cohere.com/api-keys
   - Adicionar: `railway variables set COHERE_API_KEY="..."`

2. **Popular Banco com Dados Reais**
   ```bash
   railway run npm run db:seed:real
   ```

3. **Gerar Embeddings**
   ```bash
   railway run npm run embeddings:generate
   ```

4. **Testar WhatsApp Real**
   - Adicionar número na lista de testes (Meta)
   - Enviar mensagem: "Olá"
   - Verificar resposta

5. **Monitoramento Contínuo**
   - Verificar logs diários
   - Analisar custos
   - Ajustar se necessário

---

## 📞 Suporte

**Documentação:**
- Railway: https://docs.railway.app/
- LLM Routing: `docs/LLM_ROUTING_GUIDE.md`

**Comandos Úteis:**
```bash
railway logs                    # Ver logs
railway status                  # Status do projeto
railway variables               # Listar variáveis
railway restart                 # Restart serviço
railway run npm run db:studio  # Abrir Prisma Studio
```

---

**Status:** ✅ PRONTO PARA DEPLOY  
**Última atualização:** 2025-01-XX
