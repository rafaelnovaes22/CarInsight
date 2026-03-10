# 🚀 Instruções Rápidas de Deploy - Railway

## ⚡ Deploy em 5 Minutos

### 1. **Criar Repositório no GitHub**

```bash
# Opção 1: Via GitHub CLI
gh repo create faciliauto-mvp --public --source=. --remote=origin --push

# Opção 2: Via Web
# 1. Acesse https://github.com/new
# 2. Nome: faciliauto-mvp
# 3. Público ou Privado
# 4. Criar repositório
# 5. Seguir instruções para push
```

### 2. **Conectar Railway ao GitHub**

1. Acesse https://railway.app
2. Clique em **"Start a New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Autorize Railway a acessar seu GitHub
5. Selecione o repositório `faciliauto-mvp`

### 3. **Adicionar PostgreSQL**

No projeto Railway:
1. Clique em **"+ New"**
2. Selecione **"Database"**
3. Escolha **"PostgreSQL"**
4. Aguarde provisionar (30 segundos)

### 4. **Configurar Variáveis**

Na aba **"Variables"** do serviço principal:

```env
NODE_ENV=production
PORT=3000
```

**Opcional (mas recomendado):**
```env
OPENAI_API_KEY=sk-proj-your-key-here
LOG_LEVEL=info
```

### 5. **Deploy Automático**

Railway vai:
- ✅ Instalar dependências
- ✅ Criar banco PostgreSQL
- ✅ Popular com 30 veículos
- ✅ Inicializar vector store
- ✅ Conectar WhatsApp

**Tempo:** 2-3 minutos

### 6. **Conectar WhatsApp**

Nos **Logs** do Railway:
1. Procure pelo QR Code (texto ASCII)
2. Abra WhatsApp no celular
3. Vá em **Aparelhos Conectados**
4. Escaneie o QR Code
5. ✅ Pronto!

---

## 🔗 URLs Após Deploy

- **App**: `https://seu-app.railway.app`
- **Dashboard**: `https://seu-app.railway.app/`
- **Health**: `https://seu-app.railway.app/health`
- **Stats**: `https://seu-app.railway.app/stats`

---

## 💰 Custo

- **$0-5/mês** com Railway Hobby Plan (500h grátis)
- **PostgreSQL incluído**
- **OpenAI (opcional)**: ~$0.02/mês

---

## 🐛 Problemas Comuns

### QR Code não aparece?
- Verifique os logs completos
- Aguarde 60 segundos e tente novamente

### Deploy falhou?
- Verifique se PostgreSQL está conectado
- Confira logs para erros específicos

### Banco vazio?
```bash
railway run npm run db:seed:complete
```

---

## 📞 Testar

Envie mensagem para o número conectado:
```
"Olá"
```

Deve responder com boas-vindas e iniciar o quiz!

---

## ✅ Checklist

- [ ] Repositório no GitHub criado
- [ ] Railway conectado ao GitHub
- [ ] PostgreSQL provisionado
- [ ] Deploy concluído (verde)
- [ ] WhatsApp conectado (QR escaneado)
- [ ] Teste enviado e respondido

---

**🎉 Pronto! Seu bot está no ar 24/7!**

Qualquer dúvida, consulte: `DEPLOY_RAILWAY.md`
