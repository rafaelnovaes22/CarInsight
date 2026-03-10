# 🚀 Deploy Bem-Sucedido! Próximos Passos

## ✅ Status Atual

- ✅ Build concluído com sucesso
- ✅ PostgreSQL conectado
- ✅ Servidor rodando no Railway
- ⏳ Aguardando configuração das APIs

---

## 📝 Passo 1: Obter API Keys

### **A) Groq API (OBRIGATÓRIO - Grátis)**

**Para que serve:** IA conversacional (chat/recomendações)

1. Acesse: https://console.groq.com/keys
2. Faça login (Google/GitHub)
3. Clique em "Create API Key"
4. Copie a chave (começa com `gsk_...`)

**Limite gratuito:**
- 30 requests/minuto
- 14.400 tokens/minuto
- Suficiente para ~500 conversas/dia

---

### **B) Jina AI (OPCIONAL - Grátis)**

**Para que serve:** Embeddings para busca semântica inteligente

1. Acesse: https://jina.ai/
2. Faça login
3. Vá em "API Keys" no dashboard
4. Clique em "Create API Key"
5. Copie a chave (começa com `jina_...`)

**Limite gratuito:**
- 1M tokens/mês permanente
- Suficiente para ~20.000 conversas/mês

**Sem Jina AI:**
- Sistema funciona normalmente
- Usa busca SQL (menos precisa)

---

### **C) Meta WhatsApp Cloud API (OBRIGATÓRIO para produção)**

**Para que serve:** Enviar/receber mensagens WhatsApp

#### Passo a passo completo:

1. **Criar conta Meta Developers**
   - Acesse: https://developers.facebook.com/
   - Login com Facebook
   - Aceite os termos

2. **Criar App**
   - Clique em "Meus Apps" → "Criar App"
   - Escolha "Empresa" (Business)
   - Nome: "FaciliAuto Bot"
   - Email de contato: seu_email@gmail.com

3. **Adicionar WhatsApp**
   - No dashboard do app
   - Procure "WhatsApp" → Clique em "Configurar"
   - Siga o wizard de configuração

4. **Obter credenciais**
   - Na página do WhatsApp
   - Copie:
     - **Token temporário** (válido 24h)
     - **Phone Number ID**
     - **Business Account ID**

5. **Gerar Token Permanente**
   - Vá em "Configurações" → "Tokens de Acesso"
   - Gere um token permanente
   - **IMPORTANTE:** Guarde em local seguro!

6. **Adicionar número de teste**
   - Na página WhatsApp → "Números para teste"
   - Adicione seu número pessoal
   - Você receberá um código por WhatsApp
   - Confirme o código

**Documentação oficial:** Veja `docs/META_CLOUD_API_SETUP.md` para detalhes

---

## 📝 Passo 2: Configurar no Railway

### **Adicionar variáveis de ambiente:**

1. Acesse seu projeto no Railway
2. Vá em "Variables"
3. Adicione uma por uma:

```bash
GROQ_API_KEY=gsk_sua_chave_aqui
JINA_API_KEY=jina_sua_chave_aqui
META_WHATSAPP_TOKEN=seu_token_meta
META_WHATSAPP_PHONE_NUMBER_ID=123456789
META_WHATSAPP_BUSINESS_ACCOUNT_ID=987654321
META_WEBHOOK_VERIFY_TOKEN=faciliauto_webhook_2025
NODE_ENV=production
```

4. Após adicionar todas, o Railway vai **redeploy automaticamente**

---

## 📝 Passo 3: Configurar Webhook do WhatsApp

Após o redeploy com as variáveis:

1. **Obter URL do Railway**
   ```
   https://seu-projeto.up.railway.app
   ```

2. **Configurar no Meta Developers**
   - Vá em WhatsApp → "Configuração"
   - Encontre "Webhooks"
   - Clique em "Editar"

3. **Preencher:**
   - **URL do Callback:** `https://seu-projeto.up.railway.app/webhooks/whatsapp`
   - **Token de Verificação:** `faciliauto_webhook_2025`
   - Clique em "Verificar e Salvar"

4. **Inscrever-se em eventos:**
   - Marque: `messages`
   - Salvar

---

## 📝 Passo 4: Testar o Sistema

### **A) Verificar Health Check**

```bash
curl https://seu-projeto.up.railway.app/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T13:50:00.000Z"
}
```

### **B) Verificar Stats**

```bash
curl https://seu-projeto.up.railway.app/stats
```

Resposta esperada:
```json
{
  "conversations": 0,
  "leads": 0,
  "recommendations": 0,
  "timestamp": "2025-11-17T13:50:00.000Z"
}
```

### **C) Testar WhatsApp**

1. Abra o WhatsApp no seu celular
2. Envie mensagem para o número de teste da Meta
3. Digite: "Olá"

**Resposta esperada:**
```
Olá! 👋 Bem-vindo à FaciliAuto!

Sou seu assistente virtual e estou aqui para te ajudar a encontrar o carro perfeito para você!

Como posso ajudar hoje?

1️⃣ Ver carros disponíveis
2️⃣ Fazer diagnóstico personalizado
3️⃣ Falar com um vendedor
```

---

## 🐛 Troubleshooting

### **Erro: "GROQ_API_KEY not configured"**
- Adicione a chave no Railway Variables
- Aguarde redeploy automático

### **Erro: "Meta WhatsApp not configured"**
- Verifique se todas as 3 variáveis Meta estão configuradas
- Token, Phone ID e Business Account ID

### **Webhook não verifica**
- Confirme que a URL está acessível
- Teste: `curl https://seu-projeto.up.railway.app/health`
- Token deve ser exatamente: `faciliauto_webhook_2025`

### **Bot não responde no WhatsApp**
1. Verifique logs no Railway: "View Logs"
2. Confirme que webhook foi configurado
3. Teste se o número está na lista de teste

### **Banco de dados vazio**
- No primeiro deploy, o banco é criado vazio
- Rode o seed: veja próxima seção

---

## 📊 Passo 5: Popular Banco de Dados (Opcional)

O sistema vai criar o schema automaticamente, mas sem veículos.

**Opção A: Via Railway CLI**
```bash
railway run npm run db:seed:complete
```

**Opção B: Via API (criar endpoint temporário)**
Adicionar em `src/index.ts`:
```typescript
app.post('/admin/seed', async (req, res) => {
  const { execSync } = require('child_process');
  execSync('npm run db:seed:complete', { stdio: 'inherit' });
  res.json({ success: true });
});
```

Depois chamar:
```bash
curl -X POST https://seu-projeto.up.railway.app/admin/seed
```

---

## 🎯 Checklist Final

- [ ] Groq API Key configurada
- [ ] Jina API Key configurada (opcional)
- [ ] Meta WhatsApp Token configurado
- [ ] Meta Phone Number ID configurado
- [ ] Meta Business Account ID configurado
- [ ] Webhook configurado e verificado no Meta
- [ ] Health check retorna `ok`
- [ ] Stats endpoint funciona
- [ ] Banco de dados populado com veículos
- [ ] Teste enviado pelo WhatsApp
- [ ] Bot respondeu corretamente

---

## 🚀 Próximas Melhorias

Após tudo funcionando:

1. **Dashboard Admin** - Ver conversas e leads em tempo real
2. **Analytics** - Métricas de conversão
3. **CRM Integration** - Enviar leads automaticamente
4. **Backup Automático** - PostgreSQL backups
5. **Monitoring** - Alertas de erros
6. **Mais Veículos** - Importar catálogo completo

---

## 📱 Links Úteis

- **Railway Dashboard:** https://railway.app/dashboard
- **Meta Developers:** https://developers.facebook.com/apps
- **Groq Console:** https://console.groq.com/
- **Jina Dashboard:** https://jina.ai/
- **Docs Meta WhatsApp:** https://developers.facebook.com/docs/whatsapp

---

**Dúvidas?** Verifique os logs no Railway ou consulte os arquivos:
- `docs/META_CLOUD_API_SETUP.md`
- `docs/JINA_EMBEDDINGS_SETUP.md`
- `docs/QUICK_START.md`
