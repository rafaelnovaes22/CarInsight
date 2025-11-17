# 🚀 Deploy FaciliAuto MVP no Railway

> **Tempo estimado**: 10-15 minutos
> **Custo**: Grátis até 500h/mês (suficiente para MVP)

---

## 📋 Pré-requisitos

✅ **Verificado:**
- [x] Código no GitHub (branch main)
- [x] Meta Cloud API configurada (tokens salvos)
- [x] Credenciais da Groq (token salvo)
- [x] Banco de dados Prisma configurado

---

## 🎯 Passo 1: Criar Conta no Railway

1. Acesse: https://railway.app
2. Clique em **"Start Building"**
3. Faça login com GitHub
4. Confirme autorização

---

## 🎯 Passo 2: Criar Novo Projeto

1. Clique em **"New Project"** ➕
2. Selecione  **"Deploy from GitHub repo"**  
3. Selecione seu repositório: `rafaelnovaes22/faciliauto-mvp`
4. Clique em  **"Deploy Now"**  

**Railway vai:**
- Detectar que é um projeto Node.js
- Instalar dependências automaticamente
- Detectar o script de build

---

## 🎯 Passo 3: Configurar Variáveis de Ambiente

Quando o deploy falhar (por falta de credenciais), clique:

1. Acesse: **Project Settings** ⚙️ > **Variables**
2. Clique em  **"New Variable"**  

### Variáveis Obrigatórias:

Copie estas do seu arquivo `.env`:

```bash
# Database (Railway fornece PostgreSQL automaticamente)
# DATABASE_URL (Railway cria automaticamente)

# Groq AI (OBRIGATÓRIO)
GROQ_API_KEY=########################################

# Meta Cloud API (OBRIGATÓRIOS)
META_WHATSAPP_TOKEN=EAAWqINRXnbcBP0UgH7kD4SzMZBK8m5miaimQmn5BiHf9cMiSuRQ...
META_WHATSAPP_PHONE_NUMBER_ID=897098916813396
META_WHATSAPP_BUSINESS_ACCOUNT_ID=2253418711831684
META_WEBHOOK_VERIFY_TOKEN=faciliauto_webhook_2025

# Environment
NODE_ENV=production
PORT=3000
```

**Passo-a-passo:**
1. Cole o nome da variável (ex: `GROQ_API_KEY`)
2. Cole o valor
3. Clique **"Add"**
4. Repita para cada variável

---

## 🎯 Passo 4: Configurar Build e Deploy

### **Configuração de Build:**

No Railway, clique em **"Settings"** do serviço:

**Build Command:**
```bash
npm install && npx prisma generate && npx prisma db push
```

**Start Command:**
```bash
npm start
```

### **Variáveis de Build (se necessário):**

Adicione no **"Build Variables"**:

```bash
NIXPACKS_NODE_VERSION=20
NIXPACKS_PNPM_VERSION=8
```

---

## 🎯 Passo 5: Re-deploy

1. Depois de configurar as variáveis, clique **"Redeploy"**
2. Aguarde 2-3 minutos
3. Railway mostrará: **✅ Deployed Successfully**

---

## 🎯 Passo 6: Configurar Domínio

1. Acesse: **Service Settings** > **Networking**
2. Clique em **"Generate Domain"**
3. Copie o URL gerado:
   - Ex: `https://faciliauto-mvp.up.railway.app`

---

## 🎯 Passo 7: Configurar Webhook no Meta

**Importante: Só faça isso após o deploy funcionar!**

1. Acesse: https://developers.facebook.com/apps
2. Selecione seu app
3. Vá para **WhatsApp > Configuration**
4. Em "Webhooks", clique **"Edit"**
5. **Callback URL**: `https://SEU_DOMINIO_RAILWAY/webhooks/whatsapp`
6. **Verify Token**: `faciliauto_webhook_2025`
7. Clique **"Verify and Save"**

**Deve aparecer: ✅ Webhook verified!**

---

## 🎯 Passo 8: Testar em Produção

### **Teste 1: Envio de Mensagem**
```bash
curl -X POST https://SEU_DOMINIO_RAILWAY/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### **Teste 2: Mensagem Real**
Envie "Olá" para o número de WhatsApp do Meta

---

## 📊 Monitore o Deploy

### **Logs no Railway:**
1. Acesse o serviço
2. Clique em **"Deploys"**
3. Veja logs em tempo real

### **Métricas:**
Railway mostra automaticamente:
- Uptime
- Requests
- Memory usage
- Latency

---

## 🛡️ Troubleshooting

### **Erro: Build failed**
```bash
# Solução: Verifique as variáveis de ambiente
# Especialmente DATABASE_URL se não foi criado automaticamente
```

### **Erro: Webhook não verifica**
- Verifique se o domínio está correto
- Verifique META_WEBHOOK_VERIFY_TOKEN
- Veja logs no Railway: `Error processing webhook`

### **Erro: Cannot find module**
```bash
# Adicione build variable:
NIXPACKS_PRUNE_DEV_DEPENDENCIES=false
```

---

## 🎉 Deploy Completo!

Quando tudo estiver funcionando:

✅ **URL do Webhook**: `https://SEU_DOMINIO_RAILWAY/webhooks/whatsapp`
✅ **API Base**: `https://SEU_DOMINIO_RAILWAY`
✅ **Health Check**: `https://SEU_DOMINIO_RAILWAY/health`
✅ **Dashboard**: `https://SEU_DOMINIO_RAILWAY`

---

## 📞 Testes de Produção

### **Teste 1: Mensagem Simulada**
```bash
curl -X POST https://SEU_DOMINIO_RAILWAY/test-webhook \
  -H "Content-Type: application/json" \
  -d '{"phone": "5511999999999", "message": "Olá, quero comprar um carro"}'
```

### **Teste 2: Health Check**
```bash
curl https://SEU_DOMINIO_RAILWAY/health
```

---

## 📦 Backup e Restore

### **Backup Database:**
```bash
# Export SQLite
railway run npx prisma db execute --file backup.sql

# Ou via Railway Dashboard (Pro plan)
```

### **Restore:**
```bash
railway run npx prisma db execute --file backup.sql
```

---

## 🚀 Escalar (Futuro)

Quando precisar mais performance:

1. **Ajuste o plano**: Hobby ($5/mês) ou Pro ($20/mês)
2. **Adicione Redis**: Para cache distribuído
3. **Múltiplos serviços**: API + Worker separados

---

## 📚 Documentação Adicional

- **Guia Meta API**: `META_CLOUD_API_SETUP.md`
- **Guia Railway**: `DEPLOY_RAILWAY.md`
- **Troubleshooting**: `FIX_RAILWAY.md`

---

**Tempo Total Estimado: 10-15 minutos**

**Comece agora: https://railway.app** 🚀