# 🚨 Solução: Erro Railway "failed to exec pid1"

## ❌ Problema

```
ERROR (catatonit:2): failed to exec pid1: No such file or directory
```

Este erro ocorre quando o Railway tenta executar comandos interativos via `railway run`.

---

## ✅ Soluções Alternativas

### **Solução 1: Executar Localmente ANTES do Deploy** (Mais Seguro)

```bash
# No seu computador local
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# 1. Popular banco local
npm run db:seed:robustcar

# 2. Fazer backup do banco (SQLite)
cp prisma/dev.db prisma/dev.db.backup

# 3. Commit e push o banco populado
git add prisma/dev.db
git commit -m "feat: adicionar banco com 70 veículos Robust Car"
git push origin main
```

⚠️ **Problema:** SQLite não é ideal para produção. Railway usa PostgreSQL.

---

### **Solução 2: Configurar Seed Automático no Deploy**

Edite `package.json`:

```json
{
  "scripts": {
    "start:prod": "npm run db:migrate && npm run db:seed:robustcar && npm run embeddings:generate && tsx src/index.ts"
  }
}
```

⚠️ **Problema:** Seed rodará a cada deploy (não é ideal).

---

### **Solução 3: Endpoint HTTP para Seed** (Recomendado) ✅

**Passo 1:** Adicione ao `src/index.ts`:

```typescript
// ADICIONAR NO FINAL DO ARQUIVO, ANTES DE app.listen()

// ⚠️ Endpoint administrativo - PROTEGER EM PRODUÇÃO
app.get('/admin/seed-robustcar', async (req, res) => {
  const { secret } = req.query;
  
  // Validar secret
  if (secret !== process.env.SEED_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Importar e executar seed
    const { execSync } = await import('child_process');
    
    console.log('🚀 Executando seed Robust Car...');
    execSync('npx tsx prisma/seed-robustcar.ts', { stdio: 'inherit' });
    
    console.log('🔄 Gerando embeddings...');
    execSync('npx tsx src/scripts/generate-embeddings.ts generate', { stdio: 'inherit' });
    
    await prisma.$disconnect();
    
    res.json({ 
      success: true, 
      message: 'Seed e embeddings executados!' 
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

**Passo 2:** Adicione variável de ambiente no Railway:

```
SEED_SECRET=seu-secret-super-seguro-aqui-12345
```

**Passo 3:** Após deploy, acesse:

```
https://seu-app.railway.app/admin/seed-robustcar?secret=seu-secret-super-seguro-aqui-12345
```

---

### **Solução 4: Railway CLI via Docker** (Avançado)

Se você tem Docker instalado:

```bash
docker run --rm -it \
  -e RAILWAY_TOKEN="seu-token" \
  ghcr.io/railwayapp/cli:latest \
  run npm run db:seed:robustcar
```

---

### **Solução 5: Executar via SSH (Se Disponível)**

Alguns planos do Railway permitem SSH:

```bash
railway ssh
npm run db:seed:robustcar
npm run embeddings:generate
```

---

## 🎯 Recomendação: Solução 3 (Endpoint HTTP)

É a mais confiável e permite executar o seed remotamente sem problemas.

### Implementação Rápida

**1. Criar arquivo `src/routes/admin.routes.ts`:**

```typescript
import { Router } from 'express';
import { execSync } from 'child_process';

const router = Router();

router.get('/seed-robustcar', async (req, res) => {
  const { secret } = req.query;
  
  if (secret !== process.env.SEED_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🚀 Seed iniciado via HTTP...');
    
    execSync('npx tsx prisma/seed-robustcar.ts', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    execSync('npx tsx src/scripts/generate-embeddings.ts generate', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    res.json({ 
      success: true,
      message: '✅ Seed e embeddings concluídos!'
    });
  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
```

**2. Adicionar ao `src/index.ts`:**

```typescript
import adminRoutes from './routes/admin.routes';

// ... código existente ...

app.use('/admin', adminRoutes);
```

**3. Commit e deploy:**

```bash
git add .
git commit -m "feat: adicionar endpoint de seed via HTTP"
git push origin main
```

**4. Configurar no Railway:**

Dashboard → Variables → Add Variable:
```
SEED_SECRET=robust-car-2025-secure-token
```

**5. Executar após deploy:**

```bash
curl "https://seu-app.railway.app/admin/seed-robustcar?secret=robust-car-2025-secure-token"
```

---

## 🔒 Segurança

### Importante:

1. ✅ **Sempre use um secret forte**
2. ✅ **Não exponha o endpoint sem autenticação**
3. ✅ **Remova o endpoint após usar (opcional)**
4. ✅ **Monitore os logs**

### Melhor ainda: Adicionar middleware de autenticação

```typescript
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (token === process.env.ADMIN_TOKEN) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
};

router.get('/seed-robustcar', authenticateAdmin, async (req, res) => {
  // ... código do seed ...
});
```

---

## 🧪 Testar Localmente

```bash
# Terminal 1: Rodar servidor
npm run dev

# Terminal 2: Executar seed via HTTP
curl "http://localhost:3000/admin/seed-robustcar?secret=dev-secret"
```

---

## ✅ Checklist

- [ ] Criar endpoint `/admin/seed-robustcar`
- [ ] Adicionar autenticação (secret/token)
- [ ] Configurar `SEED_SECRET` no Railway
- [ ] Fazer deploy
- [ ] Testar endpoint
- [ ] Verificar logs
- [ ] Validar dados no Prisma Studio

---

## 📊 Resultado Esperado

Após acessar o endpoint, você verá nos logs do Railway:

```
🚀 Seed iniciado via HTTP...
✅ 1. RENAULT KWID ZEN 2 2025 - R$ 62.990
✅ 2. FIAT MOBI TREKKING 1.0 MT 2025 - R$ 75.990
...
✅ 70. (último veículo)

📊 Resumo:
   ✅ Inseridos: 70
   
🔄 Gerando embeddings...
✅ 70/70 embeddings gerados

✅ Seed e embeddings concluídos!
```

---

**Próximo passo:** Implementar a Solução 3 (Endpoint HTTP) 🚀
