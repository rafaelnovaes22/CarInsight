# 🚀 Próximos Passos - Guia Interativo

## ✅ Passo 1: Push GitHub - CONCLUÍDO! 

**Status:** ✅ **9 commits enviados com sucesso!**

Repositório: https://github.com/rafaelnovaes22/faciliauto-mvp

---

## 📱 Passo 2: Configurar Meta Cloud API (~30 min)

### O que você precisa fazer AGORA:

### 1️⃣ Criar App no Meta for Developers

**Abra no navegador:** https://developers.facebook.com/

**Passos:**
1. Fazer login com Facebook
2. Clicar em **"Meus Apps"** (canto superior direito)
3. Clicar em **"Criar App"**
4. Selecionar: **"Empresa"**
5. Preencher:
   - Nome: `FaciliAuto WhatsApp`
   - Email: seu email
6. Clicar **"Criar App"**

✅ **Checkpoint:** Você deve estar no dashboard do novo app

---

### 2️⃣ Adicionar WhatsApp

No dashboard do app:
1. Procurar card **"WhatsApp"**
2. Clicar em **"Configurar"**
3. Se pedir, criar/selecionar **"Conta Comercial"**

✅ **Checkpoint:** Você está na tela "WhatsApp → Primeiros Passos"

---

### 3️⃣ Copiar Credenciais (IMPORTANTE!)

Na tela "Primeiros Passos", você verá:

#### 📋 Token de Acesso (24h):
- Está em: **"Etapa 1: Selecionar números de telefone"**
- Copiar o texto que começa com `EAAxxxxxxxxx...`
- ⚠️ **Copie agora e guarde!**

#### 📋 Phone Number ID:
- Está logo abaixo do token
- Número grande (exemplo: `123456789012345`)
- ⚠️ **Copie e guarde!**

---

### 4️⃣ Adicionar Seu Número para Testes

Na mesma tela, seção **"Para:"**
1. Clicar em **"Gerenciar lista de números de telefone"**
2. Clicar em **"Adicionar número de telefone"**
3. Digite seu WhatsApp com código do país: `+5511999999999`
4. Confirmar

✅ **Checkpoint:** Seu número aparece na lista "Para"

---

### 5️⃣ Atualizar .env Local

**No terminal:**

```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
nano .env
```

**Adicionar estas linhas** (substituir pelos valores que você copiou):

```bash
META_WHATSAPP_TOKEN="cole_o_token_que_comeca_com_EAA"
META_WHATSAPP_PHONE_NUMBER_ID="cole_o_numero_grande"
META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"
```

Salvar: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## 🔗 Passo 3: Testar Localmente com ngrok (~10 min)

### 1️⃣ Iniciar Servidor

**Terminal 1:**
```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
export PATH="/home/rafaelnovaes22/nodejs/bin:$PATH"
npm run dev
```

Aguardar ver:
```
✅ Meta Cloud API configured
📱 Phone Number ID: 123...
```

✅ **Checkpoint:** Servidor rodando sem erros

---

### 2️⃣ Instalar e Executar ngrok

**Terminal 2:**
```bash
# Instalar (se necessário)
npm install -g ngrok

# Executar
ngrok http 3000
```

Você verá algo como:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
```

**📋 COPIE a URL:** `https://abc123.ngrok.io`

---

### 3️⃣ Configurar Webhook no Meta

Volte para: https://developers.facebook.com/

1. Seu App → **WhatsApp** → **Configuração** (menu lateral)
2. Rolar até **"Webhook"**
3. Clicar em **"Editar"**

**Preencher:**
- **URL de callback:** `https://SUA-URL.ngrok.io/webhooks/whatsapp`
  (substituir `SUA-URL.ngrok.io` pela URL que você copiou)
- **Token de verificação:** `faciliauto_webhook_2025`

4. Clicar **"Verificar e salvar"**

Se aparecer ✅ **"Verificado"** = Sucesso!

---

### 4️⃣ Assinar Eventos

Logo abaixo, em **"Campos do webhook"**:
1. Clicar em **"Gerenciar"**
2. Ativar:
   - ✅ `messages`
   - ✅ `message_status`
3. Salvar

---

## 💬 Passo 4: Testar Conversa! (~5 min)

### 1️⃣ Enviar Mensagem de Teste

Abra outro terminal:

```bash
# Substituir:
# - SEU_PHONE_ID: o número grande que você copiou
# - SEU_TOKEN: o token EAA... que você copiou
# - SEU_NUMERO: seu WhatsApp (5511999999999)

curl -X POST "https://graph.facebook.com/v18.0/SEU_PHONE_ID/messages" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "SEU_NUMERO",
    "type": "text",
    "text": {
      "body": "🎉 FaciliAuto está online! Me responda para testar."
    }
  }'
```

✅ **Checkpoint:** Você recebeu a mensagem no WhatsApp!

---

### 2️⃣ Conversar com o Bot

No seu WhatsApp, responder:
```
Olá, quero comprar um carro
```

O bot deve responder iniciando o quiz!

**Complete o quiz** (8 perguntas):
1. `50000` (orçamento)
2. `1` (uso cidade)
3. `5` (pessoas)
4. `não` (trade-in)
5. `2018` (ano mínimo)
6. `80000` (km máxima)
7. `1` (hatch)
8. `2` (até 1 mês)

✅ **Checkpoint:** Bot enviou 3 recomendações com Match Scores!

---

### 3️⃣ Verificar Logs

**Terminal do servidor:**
Você deve ver:
```
📱 Message received from: 55...
🤖 Processing with Groq AI
Groq API call
✅ Response sent
```

✅ **Checkpoint:** Sistema funcionando end-to-end!

---

## 🚀 Passo 5: Deploy no Railway (~15 min)

### 1️⃣ Acessar Railway

**URL:** https://railway.app/

1. Criar conta (pode usar GitHub)
2. Clicar em **"New Project"**
3. Selecionar **"Deploy from GitHub repo"**
4. Autorizar Railway no GitHub
5. Selecionar repositório: **faciliauto-mvp**

✅ **Checkpoint:** Projeto criado, build iniciando

---

### 2️⃣ Adicionar PostgreSQL

1. No projeto, clicar **"+ New"**
2. Selecionar **"Database"**
3. Escolher **"Add PostgreSQL"**
4. Aguardar provisionamento (~30 segundos)

✅ **Checkpoint:** PostgreSQL adicionado

---

### 3️⃣ Configurar Environment Variables

1. Clicar no serviço **"faciliauto-mvp"**
2. Aba **"Variables"**
3. Clicar **"+ New Variable"**

**Adicionar uma por uma:**

```
GROQ_API_KEY = (sua chave Groq)
META_WHATSAPP_TOKEN = (seu token Meta)
META_WHATSAPP_PHONE_NUMBER_ID = (seu phone ID)
META_WEBHOOK_VERIFY_TOKEN = faciliauto_webhook_2025
NODE_ENV = production
```

⚠️ **Não adicionar DATABASE_URL** (Railway gera automaticamente)

4. Clicar **"Save"**

Railway vai fazer redeploy automaticamente

✅ **Checkpoint:** Variáveis configuradas, redeploy em progresso

---

### 4️⃣ Copiar URL do Deploy

1. Na tela do serviço, aba **"Settings"**
2. Seção **"Networking"**
3. Clicar **"Generate Domain"**
4. Copiar a URL: `https://xxxxxx.up.railway.app`

✅ **Checkpoint:** URL do deploy copiada

---

### 5️⃣ Atualizar Webhook no Meta

Voltar para Meta Dashboard:

1. Seu App → WhatsApp → Configuração → Webhook
2. Clicar **"Editar"**
3. **URL de callback:** `https://seu-app.railway.app/webhooks/whatsapp`
4. Token: `faciliauto_webhook_2025`
5. **"Verificar e salvar"**

✅ **Checkpoint:** ✅ Verificado com sucesso!

---

### 6️⃣ Testar em Produção

No WhatsApp, enviar:
```
Teste produção Railway
```

O bot deve responder (agora rodando no Railway!)

✅ **Checkpoint:** 🎉 SISTEMA EM PRODUÇÃO!

---

## 🏆 PARABÉNS!

Você agora tem:

✅ Bot WhatsApp em produção  
✅ Groq AI respondendo em <100ms  
✅ Meta Cloud API oficial  
✅ Railway hospedando  
✅ PostgreSQL configurado  
✅ Pronto para clientes reais  

---

## 📊 O que acompanhar agora:

### Meta Dashboard:
- https://developers.facebook.com/apps/
- Ver: Mensagens enviadas/recebidas

### Railway Dashboard:
- https://railway.app/
- Ver: Logs, CPU, Memory

### GitHub:
- https://github.com/rafaelnovaes22/faciliauto-mvp
- Código versionado

---

## 🎯 Próximas Melhorias (Opcional):

1. **Token Permanente** (atual expira em 24h)
   - Meta Dashboard → Configurações → Token do sistema
   - Gerar token permanente

2. **Número Real da Concessionária**
   - WhatsApp → Números → Adicionar número
   - Processo de verificação (1-2 dias)

3. **Selo Verde**
   - Configurações → Verificação de negócio
   - Enviar documentos (CNPJ, etc)

4. **Monitoring**
   - Adicionar Sentry para erros
   - Configurar alerts no Railway

---

## 🆘 Problemas?

### Webhook não verifica:
```bash
# Testar URL
curl https://seu-app.railway.app/health
```

### Bot não responde:
```bash
# Ver logs Railway
railway logs --tail 100
```

### Groq erro:
```bash
# Verificar variáveis
railway variables
```

---

**Boa sorte! Qualquer dúvida, consulte os arquivos:**
- `META_CLOUD_API_SETUP.md` - Detalhes completos
- `META_QUICK_TEST.md` - Testes rápidos
- `IMPLEMENTATION_SUMMARY.md` - Visão geral

**Tempo total estimado: ~1 hora**

🚀 Vamos lá!
