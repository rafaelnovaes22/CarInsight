# 🚀 Teste Rápido - Meta Cloud API

## ✅ Pré-requisitos

Você já deve ter:
- [ ] Conta no Meta for Developers
- [ ] App criado com WhatsApp configurado
- [ ] Token temporário copiado
- [ ] Phone Number ID copiado
- [ ] Seu número pessoal adicionado em "Para"

---

## 🎯 Teste 1: Verificar Webhook (2 min)

### 1.1 Configurar .env

```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp
nano .env
```

Adicione:
```bash
META_WHATSAPP_TOKEN="seu_token_aqui"
META_WHATSAPP_PHONE_NUMBER_ID="seu_phone_number_id_aqui"
META_WEBHOOK_VERIFY_TOKEN="faciliauto_webhook_2025"
```

### 1.2 Iniciar Servidor

```bash
npm run dev
```

Você verá:
```
✅ Meta Cloud API configured
📱 Phone Number ID: 12345...
🔗 Webhook: http://localhost:3000/webhooks/whatsapp
```

### 1.3 Expor com ngrok

```bash
# Em outro terminal
ngrok http 3000
```

Copie a URL: `https://xxxx.ngrok.io`

### 1.4 Configurar no Meta

1. Vá em: https://developers.facebook.com/apps/
2. Seu App → WhatsApp → Configuração
3. Webhook:
   - URL: `https://xxxx.ngrok.io/webhooks/whatsapp`
   - Token: `faciliauto_webhook_2025`
4. Clique **"Verificar e salvar"**

Se aparecer ✅ **"Verificado"** = Sucesso!

---

## 🎯 Teste 2: Enviar Mensagem de Teste (1 min)

### Via curl:

```bash
curl -X POST https://graph.facebook.com/v18.0/SEU_PHONE_NUMBER_ID/messages \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "55SEU_NUMERO",
    "type": "text",
    "text": {
      "body": "🎉 FaciliAuto Bot está online! Responda esta mensagem para testar."
    }
  }'
```

Você receberá a mensagem no WhatsApp!

---

## 🎯 Teste 3: Conversa Completa (5 min)

### 3.1 No WhatsApp do seu celular

Responda a mensagem que recebeu com:

```
Olá, quero comprar um carro
```

### 3.2 Verificar Logs

```bash
# No terminal do servidor
tail -f /tmp/faciliauto-console.log
```

Você verá:
```
📱 Message received from: 55...
🤖 Processing with Groq AI
✅ Response sent
```

### 3.3 O Bot vai responder:

```
Perfeito! Vou fazer algumas perguntas rápidas...
💰 Qual seu orçamento disponível para o carro?
```

### 3.4 Complete o Quiz:

1. **Orçamento:** `50000`
2. **Uso:** `1` (Cidade)
3. **Pessoas:** `5`
4. **Trade-in:** `não`
5. **Ano mínimo:** `2018`
6. **Km máxima:** `80000`
7. **Carroceria:** `1` (Hatch)
8. **Quando:** `2` (Até 1 mês)

### 3.5 Ver Recomendações

O bot enviará:

```
🎯 Encontrei 3 veículos perfeitos para você!

━━━━━━━━━━━━━━━━━━━━━
1️⃣ Match Score: 100/100 ⭐

🚗 Chevrolet Onix LT 1.0
📅 Ano: 2020 | 🛣️ 42.000 km
💰 R$ 48.000,00
🎨 Cor: Branco

💡 Atende todas as necessidades...
```

---

## 🎯 Teste 4: Enviar via API Local (2 min)

### Endpoint de teste:

```bash
curl -X POST http://localhost:3000/webhooks/whatsapp/test \
  -H "Content-Type: application/json" \
  -d '{
    "to": "55SEU_NUMERO",
    "message": "Teste via API local funcionando! 🚀"
  }'
```

---

## 📊 Monitorar no Meta Dashboard

1. Acesse: https://developers.facebook.com/apps/
2. Seu App → WhatsApp → Insights
3. Veja:
   - Mensagens enviadas
   - Mensagens recebidas
   - Taxa de entrega
   - Webhooks recebidos

---

## 🔧 Troubleshooting

### Webhook não verifica
```bash
# Verificar se servidor está rodando
curl http://localhost:3000/health

# Verificar se ngrok está ativo
curl https://xxxx.ngrok.io/health

# Ver logs do webhook
tail -f /tmp/faciliauto-console.log | grep webhook
```

### Mensagens não chegam
```bash
# Verificar token
echo $META_WHATSAPP_TOKEN

# Testar envio manual
curl -X POST https://graph.facebook.com/v18.0/SEU_PHONE_ID/messages \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"55SEU_NUM","type":"text","text":{"body":"teste"}}'
```

### Erro 401
- Token expirado ou inválido
- Regenere no Meta Dashboard

### Erro 403
- Número não autorizado em "Para"
- Adicione no Meta Dashboard

---

## ✅ Checklist de Sucesso

- [ ] Servidor iniciou sem erros
- [ ] Webhook verificado no Meta
- [ ] Mensagem de teste recebida no WhatsApp
- [ ] Bot respondeu "Olá"
- [ ] Quiz funcionou (8 perguntas)
- [ ] Recomendações geradas com Groq
- [ ] Match Scores exibidos
- [ ] Logs mostrando atividade

---

## 🎉 Sucesso!

Se todos os checkboxes acima estão ✅, você tem:

- ✅ WhatsApp Business API Oficial funcionando
- ✅ Bot integrado com Groq AI
- ✅ Sistema completo operacional
- ✅ Pronto para adicionar número real
- ✅ Pronto para produção no Railway

---

## 📈 Próximos Passos

1. **Deploy no Railway** (10 min)
   - Configurar env vars
   - Deploy automático via GitHub
   - Webhook apontando para Railway

2. **Adicionar Número Real** (1 dia)
   - Número da concessionária
   - Verificação de negócio
   - Selo verde

3. **Features Avançadas** (opcional)
   - Botões interativos
   - Catálogo de veículos
   - Templates pré-aprovados

---

**Tempo total do teste: ~10 minutos**
**Status esperado: ✅ Tudo funcionando!**
