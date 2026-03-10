# 🚀 Deploy no Railway - FaciliAuto MVP

## 📋 Pré-requisitos

1. **Conta no Railway**: https://railway.app
2. **GitHub/GitLab**: Para conectar o repositório
3. **OpenAI API Key** (opcional): https://platform.openai.com/api-keys

---

## 🛠️ Passo a Passo

### 1️⃣ Preparar o Código

Certifique-se de que todos os arquivos estão no repositório:

```bash
cd /home/rafaelnovaes22/project/faciliauto-mvp

# Verificar status
git status

# Adicionar todos os arquivos
git add .

# Commit
git commit -m "feat: Preparado para deploy no Railway com PostgreSQL e vector search"

# Push para GitHub
git push origin main
```

---

### 2️⃣ Criar Projeto no Railway

1. Acesse https://railway.app
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório `faciliauto-mvp`
5. Railway vai detectar automaticamente Node.js

---

### 3️⃣ Adicionar PostgreSQL

1. No projeto Railway, clique em **"+ New"**
2. Selecione **"Database" → "PostgreSQL"**
3. Railway vai provisionar automaticamente
4. A variável `DATABASE_URL` será criada automaticamente

---

### 4️⃣ Configurar Variáveis de Ambiente

No painel do Railway, vá em **"Variables"** e adicione:

#### Obrigatórias:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://... (auto-preenchido)
```

#### Opcionais (mas recomendadas):
```env
# OpenAI (para embeddings reais)
OPENAI_API_KEY=sk-proj-your-key-here

# Logs
LOG_LEVEL=info

# WhatsApp
WHATSAPP_PROVIDER=baileys
```

**Nota:** Se não configurar `OPENAI_API_KEY`, o sistema usará embeddings MOCK (grátis).

---

### 5️⃣ Deploy Automático

Railway vai:
1. ✅ Instalar dependências (`npm install`)
2. ✅ Gerar Prisma Client (`prisma generate`)
3. ✅ Criar tabelas no PostgreSQL (`prisma db push`)
4. ✅ Popular banco com 30 veículos (seed automático)
5. ✅ Inicializar vector store
6. ✅ Conectar WhatsApp (Baileys)
7. ✅ Iniciar servidor

**Tempo estimado:** 2-3 minutos

---

### 6️⃣ Verificar Deploy

Após o deploy, você verá:

```
🔍 Checking database...
🌱 Database empty, running seed...
✅ Seed completed - 30 vehicles
🧠 Initializing vector store...
✅ Vector store ready with 30 embeddings
🚀 Server running on port 3000
📊 Dashboard: https://seu-app.railway.app
🔄 Initializing WhatsApp with Baileys...
📱 Scan QR Code to connect WhatsApp
```

---

### 7️⃣ Conectar WhatsApp

1. Acesse os logs do Railway
2. Você verá um **QR Code no terminal**
3. Abra o WhatsApp no celular
4. Vá em **"Aparelhos Conectados" → "Conectar um aparelho"**
5. Escaneie o QR Code
6. ✅ WhatsApp conectado!

**Nota:** O QR Code expira em 60 segundos. Se expirar, o Railway vai gerar outro automaticamente.

---

### 8️⃣ Testar em Produção

Envie uma mensagem para o número conectado:

```
"Olá"
```

O bot deve responder:

```
Olá! 👋 Bem-vindo à Renatinhu's Cars!

Sou seu assistente virtual e vou te ajudar a encontrar o carro ideal para você!

Vamos começar com algumas perguntas rápidas para entender melhor o que você procura. São apenas 8 perguntas e leva menos de 2 minutos! 😊

Qual é o seu orçamento máximo para a compra? 💰
```

---

## 🔗 URLs Importantes

Após o deploy, você terá:

- **Dashboard**: `https://seu-app.railway.app/`
- **Health Check**: `https://seu-app.railway.app/health`
- **Stats**: `https://seu-app.railway.app/stats`

---

## 💰 Custos Estimados

### Railway (Hobby Plan):
- **Grátis**: 500 horas/mês ($5 crédito)
- **Após crédito**: ~$5/mês

### PostgreSQL (Railway):
- **Incluído** no plano

### OpenAI (opcional):
- **Embeddings**: $0.02 por 1M tokens
- **30 veículos**: ~$0.001 (quase grátis)
- **1000 consultas/mês**: ~$0.02

**Total estimado: $5-10/mês**

---

## 🐛 Troubleshooting

### Problema: Deploy falhou
**Solução:**
1. Verifique os logs no Railway
2. Certifique-se que `package.json` está correto
3. Verifique se PostgreSQL está provisionado

### Problema: Banco vazio
**Solução:**
```bash
# No Railway CLI
railway run npm run db:seed:complete
```

### Problema: WhatsApp não conecta
**Solução:**
1. Verifique se o QR Code aparece nos logs
2. Tente novamente em 60 segundos (QR expira)
3. Verifique se a porta está aberta

### Problema: Vector store não inicializa
**Solução:**
- Normal! Sistema vai usar SQL fallback
- Funciona perfeitamente sem vector store
- Para habilitar: adicione `OPENAI_API_KEY`

---

## 📊 Monitoramento

Railway oferece:
- **Logs em tempo real**
- **Métricas de CPU/RAM**
- **Reinicialização automática** em caso de crash
- **Rollback fácil** para versões anteriores

---

## 🔄 Atualizações Futuras

Para atualizar o código:

```bash
# Fazer alterações localmente
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

Railway vai fazer **deploy automático** a cada push!

---

## 🎯 Próximos Passos Após Deploy

1. ✅ Testar fluxo completo de conversa
2. ✅ Validar recomendações de veículos
3. ✅ Configurar domínio custom (opcional)
4. ✅ Adicionar Redis para cache (opcional)
5. ✅ Configurar alertas de monitoring

---

## 📞 Suporte

Se tiver problemas:
1. Verifique logs no Railway Dashboard
2. Consulte documentação: https://docs.railway.app
3. Discord Railway: https://discord.gg/railway

---

**🚀 Pronto para deploy! Boa sorte!**
