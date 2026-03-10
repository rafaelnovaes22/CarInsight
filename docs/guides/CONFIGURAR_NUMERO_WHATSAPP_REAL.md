# 📱 Configurar Número WhatsApp Real Aprovado

## 🎯 Objetivo
Configurar o novo número WhatsApp aprovado pela Meta no projeto FaciliAuto.

---

## 📋 Pré-requisitos

- ✅ Número WhatsApp aprovado pela Meta
- ✅ Nome de exibição aprovado
- ✅ Acesso ao Meta Business Manager
- ✅ Acesso ao Meta for Developers

---

## 🔐 Passo 1: Obter Credenciais do Novo Número (10 min)

### 1.1 Acessar Meta for Developers
👉 https://developers.facebook.com/apps/

### 1.2 Selecionar seu App
1. Clique no app **"FaciliAuto WhatsApp Bot"** (ou o nome do seu app)
2. No menu lateral, clique em **"WhatsApp → API Setup"**

### 1.3 Copiar Phone Number ID
1. Na seção **"From"**, você verá uma lista de números
2. Selecione o **novo número aprovado**
3. Copie o **Phone Number ID** (formato: números longos, ex: `123456789012345`)
4. Guarde essa informação

### 1.4 Gerar/Copiar Token de Acesso

**Opção A: Token Temporário (24h) - Para Teste Rápido**
1. Na mesma página, procure **"Temporary access token"**
2. Clique em **"Copy"**
3. Guarde (válido por 24h)

**Opção B: Token Permanente (Recomendado para Produção)**
1. Vá em **"Tools → Graph API Explorer"**
2. No dropdown **"User or Page"**, selecione seu app
3. Em **"Permissions"**, adicione:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. Clique em **"Generate Access Token"**
5. Siga o fluxo de autorização
6. Copie o token gerado
7. **IMPORTANTE:** Salve em local seguro (esse token não expira)

### 1.5 Confirmar Business Account ID
1. No menu lateral, vá em **"WhatsApp → Getting Started"**
2. Procure **"WhatsApp Business Account ID"**
3. Copie o ID (se mudou, atualize também)

---

## 🔐 Passo 2: Baixar Certificado de Assinatura (Webhook)

### 2.1 Acessar Configurações de Webhook
1. No menu lateral: **"WhatsApp → Configuration"**
2. Seção **"Webhook"**

### 2.2 Configurar/Atualizar Webhook
1. Clique em **"Edit"** na seção Webhook
2. Insira a URL do seu servidor:
   ```
   https://seu-dominio.railway.app/webhooks/whatsapp
   ```
   Ou para teste local com ngrok:
   ```
   https://xxxx.ngrok.io/webhooks/whatsapp
   ```
3. **Verify Token:** Use `faciliauto_webhook_2025` (ou crie um novo)
4. Clique em **"Verify and Save"**

### 2.3 Assinar Eventos do Webhook
1. Na seção **"Webhook fields"**, certifique-se que estão marcados:
   - ✅ `messages` (mensagens recebidas)
   - ✅ `message_status` (status de entrega/leitura)
2. Clique em **"Subscribe"** se necessário

### 2.4 Nota sobre Certificado
⚠️ **Importante:** A Meta Cloud API **não usa certificados SSL tradicionais** para autenticação.
A autenticação é feita via:
- **Bearer Token** (Access Token)
- **Webhook Verify Token** (para verificação inicial)

Não é necessário baixar nenhum arquivo `.pem` ou `.crt`.

---

## ⚙️ Passo 3: Atualizar Variáveis de Ambiente

### 3.1 Editar arquivo `.env`

Abra o arquivo `.env` no projeto e atualize:

```bash
# Meta Cloud API (WhatsApp Business API Oficial)
META_WHATSAPP_TOKEN="SEU_NOVO_TOKEN_AQUI"
META_WHATSAPP_PHONE_NUMBER_ID="SEU_NOVO_PHONE_NUMBER_ID"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="SEU_BUSINESS_ACCOUNT_ID"
META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"

# Outras variáveis (manter como estão)
GROQ_API_KEY="sua_groq_key"
OPENAI_API_KEY="sua_openai_key"
COHERE_API_KEY="sua_cohere_key"
DATABASE_URL="file:./prisma/dev.db"
NODE_ENV="development"
PORT=3000
```

### 3.2 Se estiver no Railway (Produção)

1. Acesse o dashboard do Railway
2. Vá em **"Variables"**
3. Atualize as variáveis:
   - `META_WHATSAPP_TOKEN`
   - `META_WHATSAPP_PHONE_NUMBER_ID`
   - `META_WHATSAPP_BUSINESS_ACCOUNT_ID`
4. Clique em **"Deploy"** para reiniciar

---

## 🧪 Passo 4: Testar a Integração

### 4.1 Iniciar Servidor Local
```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
npm run dev
```

Você verá:
```
✅ Meta Cloud API WhatsApp ready
📱 Phone Number ID: SEU_NOVO_ID
🔗 Webhook configured
🚀 Server running on port 3000
```

### 4.2 Testar Envio de Mensagem (via API)

Use o script de teste:
```bash
npm run test:whatsapp
```

Ou manualmente via curl:
```bash
curl -X POST \
  "https://graph.facebook.com/v18.0/SEU_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "55SEU_NUMERO_PESSOAL",
    "type": "text",
    "text": {
      "body": "🎉 FaciliAuto está funcionando com o novo número!"
    }
  }'
```

### 4.3 Testar Recebimento (via WhatsApp)

1. Abra o WhatsApp no seu celular
2. Adicione o novo número nos contatos
3. Envie uma mensagem: **"Olá, quero comprar um carro"**
4. Aguarde a resposta automática do bot

### 4.4 Verificar Logs

```bash
# Logs do servidor
tail -f /tmp/faciliauto-console.log

# Logs do Railway (se em produção)
railway logs
```

Você deve ver:
```
✅ Webhook received
📱 Message from: +55...
🤖 Processing with AI
✅ Response sent
```

---

## 🔍 Passo 5: Verificar Nome de Exibição

### 5.1 Confirmar Nome Aprovado
1. No Meta for Developers: **"WhatsApp → Settings"**
2. Procure **"Display Name"**
3. Deve mostrar: **"✅ Approved"**
4. O nome aparecerá no WhatsApp do cliente

### 5.2 Testar Nome de Exibição
1. Envie uma mensagem do novo número para seu celular
2. Verifique se o nome correto aparece no chat
3. Deve aparecer com **selo verde** (se verificado)

---

## 🚨 Troubleshooting

### Erro: "Invalid phone number"
- Verifique se o Phone Number ID está correto
- Confirme que o número foi aprovado pela Meta
- Espere alguns minutos após aprovação (pode levar até 30 min para propagar)

### Erro: "Invalid access token"
- Token expirou (se temporário, gere um novo)
- Gere um token permanente (ver Passo 1.4 - Opção B)
- Verifique se copiou o token completo

### Webhook não recebe mensagens
1. Verifique se a URL está acessível publicamente (https obrigatório)
2. Teste com `curl GET https://seu-dominio/webhooks/whatsapp?hub.verify_token=faciliauto_webhook_2025&hub.challenge=test`
3. Deve retornar o valor de `hub.challenge`
4. Verifique logs no Meta: **"WhatsApp → Configuration → Webhook → View Requests"**

### Mensagens não são entregues
1. Verifique limites de taxa (tier inicial: 250 msgs/dia)
2. Confirme que o destinatário aceitou receber mensagens
3. Veja status no Meta Dashboard: **"WhatsApp → Messaging Insights"**

### Erro 403: "This message is sent outside the allowed window"
- Fora da janela de 24h de conversa
- Use **template messages** para contato proativo
- Ou aguarde o cliente enviar mensagem primeiro

---

## 📊 Limites e Boas Práticas

### Limites Iniciais
- **1.000 conversas grátis/mês**
- **250 mensagens/dia** (Tier 1)
- **Tier 2 (após verificação):** 1.000 msgs/dia
- **Tier 3 (após uso consistente):** 10.000 msgs/dia

### Boas Práticas
1. ✅ Responda rápido (< 2 min idealmente)
2. ✅ Use templates para mensagens proativas
3. ✅ Respeite janela de 24h
4. ✅ Não envie spam
5. ✅ Tenha opt-out claro (compliance LGPD)

### Monitoramento
- Acesse **Meta Business Manager → WhatsApp Manager**
- Veja métricas em tempo real
- Configure alertas para limites

---

## ✅ Checklist Final

Antes de considerar concluído:

- [ ] Phone Number ID copiado e atualizado no `.env`
- [ ] Token de acesso (permanente) gerado e configurado
- [ ] Business Account ID confirmado
- [ ] Webhook configurado e verificado
- [ ] Eventos webhook (messages, message_status) assinados
- [ ] Variáveis atualizadas no Railway (se produção)
- [ ] Teste de envio realizado com sucesso
- [ ] Teste de recebimento realizado com sucesso
- [ ] Nome de exibição aparecendo corretamente
- [ ] Logs mostrando mensagens sendo processadas
- [ ] Monitoramento configurado (Sentry/Dashboard)

---

## 🎉 Pronto!

Seu novo número WhatsApp aprovado está configurado e funcionando!

**Próximos passos:**
1. Testar fluxo completo de vendas
2. Adicionar mais números autorizados (se necessário)
3. Solicitar aumento de tier (se precisar de mais mensagens)
4. Configurar templates para mensagens proativas
5. Monitorar métricas e ajustar conforme necessário

---

## 📚 Recursos Úteis

- **Meta for Developers:** https://developers.facebook.com/apps/
- **WhatsApp Cloud API Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api
- **Status da API:** https://developers.facebook.com/status/
- **Suporte Meta:** https://business.facebook.com/business/help

---

**Data:** 2025-01-18  
**Autor:** FaciliAuto Team  
**Versão:** 1.0
