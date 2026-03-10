# ✅ Checklist de Deploy - Railway

**Projeto:** FaciliAuto MVP  
**Destino:** Railway (PostgreSQL)  
**Status:** Schema corrigido para PostgreSQL

---

## 📋 PRÉ-REQUISITOS

### **1. Arquivos Configurados**
- [x] `prisma/schema.prisma` → provider = "postgresql" ✅
- [x] `.env.production` → Template pronto
- [x] `.env.example` → Documentado
- [ ] Variáveis de ambiente preparadas

### **2. Banco de Dados Local**
- [x] SQLite dev.db existe (148 KB)
- [ ] Exportar dados para PostgreSQL
- [ ] Script de seed pronto

---

## 🚀 PASSOS PARA DEPLOY

### **Fase 1: Preparação Local (10 min)**

#### 1.1 Verificar dependências
```bash
cd ~/project/faciliauto-mvp
cat package.json | grep -A 20 '"dependencies"'
```

#### 1.2 Testar build
```bash
export PATH="/home/rafaelnovaes22/nodejs/bin:$PATH"
npm run build
```

#### 1.3 Commit final
```bash
git add .
git commit -m "feat: Preparar para deploy Railway com PostgreSQL"
git push origin main
```

---

### **Fase 2: Setup Railway (15 min)**

#### 2.1 Criar projeto
1. Acesse: https://railway.app/
2. New Project → Deploy from GitHub
3. Selecione: `faciliauto-mvp`

#### 2.2 Adicionar PostgreSQL
1. No projeto Railway: New → Database → PostgreSQL
2. Aguardar provisioning (~1 min)
3. Railway preencherá `DATABASE_URL` automaticamente

#### 2.3 Configurar variáveis de ambiente
```env
# Railway preenche automaticamente:
DATABASE_URL=postgresql://...  # ✅ Automático

# Você precisa adicionar:
NODE_ENV=production
PORT=3000
GROQ_API_KEY=gsk-...           # Obter em console.groq.com
META_WHATSAPP_TOKEN=...        # Meta Business
META_WHATSAPP_PHONE_NUMBER_ID=...
META_WEBHOOK_VERIFY_TOKEN=faciliauto_webhook_2025
REDIS_URL=                     # Opcional
```

#### 2.4 Configurar Build Command
```bash
# Settings → Build Command:
npm install && npx prisma generate && npm run build
```

#### 2.5 Configurar Start Command
```bash
# Settings → Start Command:
npx prisma migrate deploy && node dist/index.js
```

---

### **Fase 3: Migração do Banco (20 min)**

#### 3.1 Criar migration inicial
```bash
# Local (ainda com SQLite):
export PATH="/home/rafaelnovaes22/nodejs/bin:$PATH"
cd ~/project/faciliauto-mvp

# Criar migration
npx prisma migrate dev --name init
```

#### 3.2 Exportar dados do SQLite
```bash
# Script para exportar veículos
cat > export-vehicles.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/dev.db' } }
});

async function main() {
  const vehicles = await prisma.vehicle.findMany();
  fs.writeFileSync('vehicles-export.json', JSON.stringify(vehicles, null, 2));
  console.log(`✅ Exported ${vehicles.length} vehicles`);
}

main().finally(() => prisma.$disconnect());
EOF

node export-vehicles.js
```

#### 3.3 Popular PostgreSQL (Railway)
Após deploy, executar no Railway CLI:
```bash
# Instalar Railway CLI (se necessário)
npm i -g @railway/cli

# Login
railway login

# Link ao projeto
railway link

# Executar seed
railway run npm run db:seed:complete
```

---

### **Fase 4: Configurar WhatsApp (30 min)**

#### 4.1 Meta Business (Recomendado)
1. Acesse: https://business.facebook.com/
2. Configure WhatsApp Business API
3. Obtenha credenciais (token, phone_number_id)
4. Configure webhook: `https://seu-app.railway.app/webhook/whatsapp`
5. Verify token: `faciliauto_webhook_2025`

**Guia completo:** `META_CLOUD_API_SETUP.md`

#### 4.2 Ou Baileys (Alternativa)
- Menos estável
- Requer QR code scan
- Funciona no Railway

---

### **Fase 5: Testes em Produção (15 min)**

#### 5.1 Health check
```bash
curl https://seu-app.railway.app/health
```

#### 5.2 Testar API
```bash
curl -X POST https://seu-app.railway.app/message \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511999999999","message":"Olá"}'
```

#### 5.3 Testar WhatsApp
- Envie mensagem real para o número
- Verifique logs no Railway
- Teste fluxo completo (quiz)

#### 5.4 Verificar banco
```bash
railway run npx prisma studio
# Ou acesse Railway Dashboard → PostgreSQL → Data
```

---

## 🔐 VARIÁVEIS DE AMBIENTE ESSENCIAIS

### **Obrigatórias:**
```env
DATABASE_URL=postgresql://...  # ✅ Railway preenche
NODE_ENV=production
PORT=3000
```

### **Recomendadas:**
```env
GROQ_API_KEY=gsk-...                    # Para LLM (grátis)
META_WHATSAPP_TOKEN=...                 # Para WhatsApp oficial
META_WHATSAPP_PHONE_NUMBER_ID=...
META_WEBHOOK_VERIFY_TOKEN=faciliauto_webhook_2025
```

### **Opcionais:**
```env
REDIS_URL=redis://...           # Para cache (Railway adiciona se criar)
OPENAI_API_KEY=sk-...           # Legado (não usado se tiver GROQ)
CRM_WEBHOOK_URL=...             # Para integração CRM
LOG_LEVEL=info
```

---

## ⚠️ PROBLEMAS COMUNS

### **1. Build falha: "Cannot find module @prisma/client"**
**Solução:**
```bash
# Build command deve incluir:
npx prisma generate && npm run build
```

### **2. Runtime error: "No DATABASE_URL"**
**Solução:**
- Verificar se PostgreSQL foi adicionado ao projeto
- Railway preenche automaticamente
- Reiniciar deploy

### **3. Migrations não rodam**
**Solução:**
```bash
# Start command deve ter:
npx prisma migrate deploy && node dist/index.js
```

### **4. WhatsApp não conecta**
**Solução:**
- Usar Meta Cloud API (mais estável)
- Verificar webhook configurado
- Logs do Railway para debug

---

## 📊 MONITORAMENTO

### **Railway Dashboard:**
- Logs em tempo real
- Métricas de CPU/RAM
- Database queries
- Deployments history

### **Comandos úteis:**
```bash
# Ver logs
railway logs

# SSH no container
railway shell

# Executar comandos
railway run <comando>

# Ver variáveis
railway variables
```

---

## 💰 CUSTOS ESTIMADOS

### **Railway:**
- **Hobby Plan:** $5/mês
  - 500h execução
  - 1GB RAM
  - PostgreSQL incluído
  - SSL/HTTPS automático

### **APIs Externas:**
- **Groq:** Grátis (30 req/min)
- **Meta WhatsApp:** Grátis (1000 conversas/mês)

**Total:** ~$5-10/mês

---

## ✅ CHECKLIST FINAL

Antes de considerar deploy completo:

- [ ] Build local sem erros
- [ ] Código commitado e pushed
- [ ] Railway projeto criado
- [ ] PostgreSQL provisionado
- [ ] Variáveis de ambiente configuradas
- [ ] Build command configurado
- [ ] Start command configurado
- [ ] Deploy bem-sucedido
- [ ] Migrations aplicadas
- [ ] Banco populado com veículos
- [ ] Health check respondendo
- [ ] API testada
- [ ] WhatsApp conectado
- [ ] Fluxo completo testado
- [ ] Logs sem erros críticos
- [ ] Monitoring configurado

---

## 🚀 QUICK DEPLOY

Se tudo já está configurado:

```bash
# 1. Preparar
cd ~/project/faciliauto-mvp
git add . && git commit -m "deploy" && git push

# 2. Railway (pela UI)
# - Criar projeto
# - Adicionar PostgreSQL
# - Configurar env vars
# - Deploy automático

# 3. Popular banco
railway run npm run db:seed:complete

# 4. Testar
curl https://seu-app.railway.app/health
```

---

**Tempo estimado total:** 1-2 horas  
**Dificuldade:** Média  
**Requer:** Conta Railway, Meta Business (opcional)

**Próximo:** Após deploy → Testar com clientes reais → Coletar feedback
