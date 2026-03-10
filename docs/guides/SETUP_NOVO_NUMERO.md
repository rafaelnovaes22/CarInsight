# 🚀 Quick Start - Configurar Novo Número WhatsApp

## 📋 Resumo Rápido

Você adquiriu um novo número WhatsApp e o nome de exibição foi aprovado. Agora precisa:
1. **Obter credenciais** do Meta for Developers
2. **Atualizar variáveis** de ambiente no projeto
3. **Testar** a integração

---

## ⚡ Passo a Passo (15 minutos)

### 1️⃣ Obter Credenciais (5 min)

Acesse: https://developers.facebook.com/apps/

1. **Phone Number ID:**
   - WhatsApp → API Setup
   - Selecione o novo número
   - Copie o ID (números longos)

2. **Token de Acesso:**
   - Opção A (teste): Copie "Temporary access token" (24h)
   - Opção B (produção): Gere token permanente via Graph API Explorer
     - Tools → Graph API Explorer
     - Permissões: `whatsapp_business_management`, `whatsapp_business_messaging`
     - Generate Access Token

3. **Business Account ID:**
   - WhatsApp → Getting Started
   - Copie "WhatsApp Business Account ID"

### 2️⃣ Atualizar .env (2 min)

Edite `/home/rafaelnovaes22/faciliauto-mvp-v2/.env`:

```bash
META_WHATSAPP_TOKEN="SEU_NOVO_TOKEN"
META_WHATSAPP_PHONE_NUMBER_ID="SEU_NOVO_PHONE_NUMBER_ID"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="SEU_BUSINESS_ACCOUNT_ID"
```

### 3️⃣ Configurar Webhook (3 min)

No Meta for Developers:
1. WhatsApp → Configuration → Webhook → Edit
2. URL: `https://seu-dominio.railway.app/webhooks/whatsapp`
3. Verify Token: `faciliauto_webhook_2025`
4. Verify and Save
5. Subscribe aos eventos: `messages`, `message_status`

### 4️⃣ Testar (5 min)

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Iniciar servidor
npm run dev

# Em outro terminal, testar envio
npm run test:new-number 5511999999999
# Substitua pelo seu número (formato: 5511999999999)
```

Depois envie uma mensagem do WhatsApp para o novo número: **"Olá"**

---

## 📚 Documentação Completa

Para detalhes completos, consulte:
- **Guia Completo:** `docs/CONFIGURAR_NUMERO_WHATSAPP_REAL.md`
- **Setup Meta API:** `docs/META_CLOUD_API_SETUP.md`

---

## 🆘 Problemas Comuns

**❌ "Invalid access token"**
- Token expirou → Gere um novo (permanente)

**❌ "Invalid phone number"**
- Phone Number ID incorreto → Verifique no Meta Dashboard

**❌ Webhook não funciona**
- URL deve ser HTTPS pública
- Verify Token deve ser exatamente: `faciliauto_webhook_2025`
- Para teste local, use ngrok: `ngrok http 3000`

**❌ Mensagens não chegam**
- Adicione seu número em "Para" no Meta Dashboard
- Ou peça para o cliente enviar mensagem primeiro

---

## ✅ Checklist Rápido

- [ ] Phone Number ID copiado
- [ ] Token de acesso gerado (permanente)
- [ ] Business Account ID confirmado
- [ ] Variáveis atualizadas no .env
- [ ] Webhook configurado e verificado
- [ ] Eventos webhook assinados
- [ ] Teste de envio bem-sucedido
- [ ] Teste de recebimento bem-sucedido

---

## 🎯 Próximos Passos

Após configurar:
1. Deploy no Railway (atualizar variáveis lá também)
2. Testar fluxo completo de vendas
3. Monitorar métricas no Meta Dashboard
4. Solicitar aumento de tier se necessário (inicial: 250 msgs/dia)

---

**Última atualização:** 2025-01-18  
**Versão:** 1.0
