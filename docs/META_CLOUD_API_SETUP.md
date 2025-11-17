# 🚀 Meta Cloud API - Setup Completo (30 minutos)

## 📋 Pré-requisitos

- ✅ Conta Facebook
- ✅ Número de telefone para WhatsApp Business
- ✅ Projeto FaciliAuto rodando

---

## 🎯 Passo 1: Criar App no Meta for Developers (5 min)

### 1.1 Acessar Meta for Developers
👉 https://developers.facebook.com/

### 1.2 Criar App
1. Clique em **"Meus Apps"** → **"Criar App"**
2. Selecione tipo: **"Empresa"**
3. Nome do app: **"FaciliAuto WhatsApp Bot"**
4. Email de contato: seu email
5. Clique em **"Criar App"**

### 1.3 Adicionar WhatsApp
1. No dashboard do app, procure **"WhatsApp"**
2. Clique em **"Configurar"** no card do WhatsApp
3. Selecione **"Conta comercial"** (ou crie uma)

---

## 🎯 Passo 2: Configurar WhatsApp Business (10 min)

### 2.1 Número de Teste (Imediato)
Meta fornece um número de teste automaticamente!

1. Vá em: **WhatsApp → Primeiros Passos**
2. Você verá: **"Número de telefone de teste"**
3. Anote o número (formato: +1 XXX XXX XXXX)
4. Adicione seu número pessoal em **"Para"** para receber mensagens

### 2.2 Obter Credenciais

**Token de Acesso Temporário (24h):**
1. Em **"Primeiros Passos"**
2. Copie o **"Token de acesso temporário"**
3. Guarde (vamos usar agora)

**Phone Number ID:**
1. Ainda em **"Primeiros Passos"**
2. Copie o **"ID do número de telefone"**
3. Guarde

**WhatsApp Business Account ID:**
1. Menu lateral → **"WhatsApp → Primeiros Passos"**
2. Procure **"WhatsApp Business Account ID"**
3. Copie e guarde

### 2.3 Token Permanente (Opcional - depois)
Por enquanto use o temporário. Depois você gera um permanente.

---

## 🎯 Passo 3: Configurar Webhook (5 min)

### 3.1 URL do Webhook
Seu webhook será:
```
https://seu-app.railway.app/webhooks/whatsapp
```

**Para teste local (com ngrok):**
```bash
# Instalar ngrok
npm install -g ngrok

# Expor porta 3000
ngrok http 3000

# Use a URL gerada: https://xxxx.ngrok.io/webhooks/whatsapp
```

### 3.2 Configurar no Meta

1. **WhatsApp → Configuração**
2. Seção **"Webhook"**
3. Clique em **"Editar"**

**Configuração:**
- **URL de callback:** `https://seu-app.railway.app/webhooks/whatsapp`
- **Token de verificação:** `faciliauto_webhook_2025` (você escolhe)
- Clique em **"Verificar e salvar"**

### 3.3 Assinar Eventos

Em **"Campos do webhook"**, ative:
- ✅ `messages` (mensagens recebidas)
- ✅ `message_status` (status de entrega)

---

## 🎯 Passo 4: Configurar Variáveis de Ambiente (2 min)

Edite o arquivo `.env`:

```bash
# Meta Cloud API (WhatsApp Business API Oficial)
META_WHATSAPP_TOKEN="seu_token_temporario_aqui"
META_WHATSAPP_PHONE_NUMBER_ID="seu_phone_number_id_aqui"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="seu_business_account_id_aqui"
META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"

# Groq (já configurado)
GROQ_API_KEY="sua_groq_key"

# Database
DATABASE_URL="file:./dev.db"

# Environment
NODE_ENV="development"
PORT=3000
```

---

## 🎯 Passo 5: Testar (5 min)

### 5.1 Iniciar Servidor
```bash
npm run dev
```

Você verá:
```
✅ Meta Cloud API WhatsApp ready
📱 Phone Number ID: 123456789
🔗 Webhook configured
```

### 5.2 Enviar Mensagem de Teste

**Pelo WhatsApp:**
1. Abra WhatsApp no celular
2. Mande mensagem para o **número de teste** fornecido pela Meta
3. Digite: **"Olá, quero comprar um carro"**

**Ou via API (para testar envio):**
```bash
curl -X POST \
  https://graph.facebook.com/v18.0/SEU_PHONE_NUMBER_ID/messages \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "SEU_NUMERO_PESSOAL",
    "type": "text",
    "text": {
      "body": "🎉 FaciliAuto Bot está funcionando! Mande uma mensagem para testar."
    }
  }'
```

### 5.3 Verificar Logs
```bash
# Logs do servidor
tail -f /tmp/faciliauto-console.log

# Você verá:
# ✅ Webhook received
# 📱 Message from: +55...
# 🤖 Processing with Groq AI
# ✅ Response sent
```

---

## 🎯 Passo 6: Número Real de Produção (Opcional - Futuro)

### 6.1 Adicionar Número Real
1. **WhatsApp → Números de telefone**
2. Clique em **"Adicionar número de telefone"**
3. Insira número da concessionária
4. Verificar via SMS/chamada

### 6.2 Verificação de Negócio
1. **Configurações → Negócio**
2. Preencher informações da concessionária
3. Enviar documentos (CNPJ, etc)
4. Aguardar aprovação (1-2 dias)

### 6.3 Selo Verde Verificado
Após aprovação, seu número terá:
- ✅ Selo verde no WhatsApp
- ✅ Nome da empresa exibido
- ✅ Credibilidade profissional

---

## 📊 Limites e Custos

### Tier Gratuito (Inicial)
- **1.000 conversas/mês GRÁTIS** 🎉
- **250 mensagens/dia** (suficiente para começar)

### O que conta como "conversa"?
- Janela de 24h com um cliente
- Múltiplas mensagens = 1 conversa
- **Exemplo:** 10 mensagens com 1 cliente em 1 dia = 1 conversa

### Após Tier Gratuito
- **Brasil:** ~$0.013 por conversa
- **1.000 conversas extras:** ~$13 (~R$ 65)

### Limites de Taxa
- **Nível 1 (inicial):** 1.000 conversas únicas/dia
- **Nível 2 (após verificação):** 10.000/dia
- **Nível 3 (após uso):** 100.000/dia

---

## 🔧 Troubleshooting

### Webhook não funciona
1. Verifique URL pública (https obrigatório)
2. Confirme token de verificação correto
3. Teste com ngrok localmente primeiro

### Token expirado
1. Gere novo token no Meta Dashboard
2. Atualize `.env`
3. Reinicie servidor

### Mensagens não chegam
1. Verifique se número está autorizado em "Para"
2. Confirme eventos webhook ativos
3. Veja logs no Meta Dashboard → Webhook

### Erro 401
- Token inválido ou expirado
- Regenere no Meta Dashboard

### Erro 403
- Número não autorizado
- Adicione em "Para" no Meta Dashboard

---

## 📚 Recursos Úteis

- **Documentação Oficial:** https://developers.facebook.com/docs/whatsapp/cloud-api
- **Dashboard Meta:** https://developers.facebook.com/apps/
- **Tester API:** https://developers.facebook.com/tools/explorer/
- **Webhook Logs:** https://developers.facebook.com/apps/SEU_APP_ID/webhooks/
- **Status WhatsApp:** https://developers.facebook.com/status/

---

## ✅ Checklist Final

Antes de ir para produção:

- [ ] Token permanente gerado
- [ ] Número real da concessionária adicionado
- [ ] Webhook configurado (HTTPS)
- [ ] Variáveis de ambiente no Railway
- [ ] Verificação de negócio solicitada
- [ ] Testes completos realizados
- [ ] Monitoring ativo (Sentry)
- [ ] Rate limits compreendidos
- [ ] Plano de backup (se API cair)

---

## 🎉 Pronto!

Agora você tem:
- ✅ WhatsApp Business API Oficial
- ✅ Sem risco de ban
- ✅ Profissional e escalável
- ✅ 1.000 conversas grátis/mês
- ✅ Conformidade legal
- ✅ Pronto para produção

**Próximo passo:** Testar enviando "Olá" para o número de teste!
