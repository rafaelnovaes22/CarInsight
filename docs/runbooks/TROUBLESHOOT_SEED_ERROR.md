# 🔍 Troubleshooting: Erro no Seed Railway

## ❌ Erro Recebido

```json
{
  "success": false,
  "error": "Command failed: npx tsx prisma/seed-robustcar.ts",
  "details": "Verifique os logs do Railway para mais informações"
}
```

---

## 🔧 Solução: Debug e Correção

### **Passo 1: Verificar Ambiente**

Adicionei um endpoint de debug. Execute:

```
https://seu-app.railway.app/admin/debug-env?secret=SEU_SECRET
```

Isso mostrará:
- ✅ Se o arquivo `robustcar-vehicles.json` existe
- ✅ Se o arquivo `seed-robustcar.ts` existe
- ✅ Se `DATABASE_URL` está configurado
- ✅ Se `OPENAI_API_KEY` está configurado
- ✅ Estrutura de diretórios

---

### **Passo 2: Commit e Push**

Certifique-se de que TODOS os arquivos foram commitados:

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Verificar o que está no Git
git ls-files scripts/robustcar-vehicles.json
git ls-files prisma/seed-robustcar.ts
git ls-files src/routes/admin.routes.ts

# Se algum estiver faltando, adicione:
git add scripts/robustcar-vehicles.json
git add prisma/seed-robustcar.ts
git add src/routes/admin.routes.ts

# Commit e push
git commit -m "fix: adicionar todos arquivos necessários para seed"
git push origin main
```

---

### **Passo 3: Verificar Variáveis no Railway**

No Railway Dashboard → Variables, verifique:

✅ **Obrigatórias:**
```
DATABASE_URL=postgresql://...     (Railway gera automaticamente)
OPENAI_API_KEY=sk-...
SEED_SECRET=seu-token-seguro
```

⚠️ **Se DATABASE_URL não existir:**
1. Railway → Add New → Database → PostgreSQL
2. Aguarde provisionamento
3. DATABASE_URL será criado automaticamente

---

### **Passo 4: Executar Debug**

Após o deploy, acesse:

```
https://seu-app.railway.app/admin/debug-env?secret=seu-token-seguro
```

Resposta esperada:

```json
{
  "cwd": "/app",
  "paths": {
    "json": "/app/scripts/robustcar-vehicles.json",
    "jsonExists": true,
    "seed": "/app/prisma/seed-robustcar.ts",
    "seedExists": true
  },
  "env": {
    "DATABASE_URL": "✅ Configurado",
    "OPENAI_API_KEY": "✅ Configurado",
    "NODE_ENV": "production"
  },
  "files": {
    "scripts": ["robustcar-vehicles.json"],
    "prisma": ["seed-robustcar.ts"]
  }
}
```

---

### **Passo 5: Ver Logs Detalhados**

No Railway:
1. Vá em **Deployments** → Último deploy
2. Clique em **View Logs**
3. Execute novamente o seed
4. Veja o erro completo

---

## 🎯 Possíveis Causas e Soluções

### **Causa 1: Arquivo JSON não encontrado**

**Erro típico:**
```
Error: ENOENT: no such file or directory, open '.../robustcar-vehicles.json'
```

**Solução:**
```bash
# Verificar se está no Git
git ls-files scripts/robustcar-vehicles.json

# Se não estiver:
git add scripts/robustcar-vehicles.json
git commit -m "feat: adicionar dados dos veículos"
git push
```

---

### **Causa 2: DATABASE_URL não configurado**

**Erro típico:**
```
Error: DATABASE_URL environment variable not found
```

**Solução:**

Railway Dashboard → Variables → Verificar `DATABASE_URL`

Se não existir:
1. Add New → Database → PostgreSQL
2. Link to project
3. Aguarde provisionamento

---

### **Causa 3: OPENAI_API_KEY não configurado**

**Erro típico:**
```
Error: OPENAI_API_KEY is required for embeddings
```

**Solução:**

Railway Dashboard → Variables → Adicionar:
```
OPENAI_API_KEY=sk-proj-...
```

---

### **Causa 4: Permissões no Railway**

**Erro típico:**
```
EACCES: permission denied
```

**Solução:**

Isso é raro, mas pode acontecer. Tente:
1. Redeploy do projeto
2. Verificar se o diretório `/app` tem permissões corretas

---

### **Causa 5: Timeout (demora muito)**

**Sintoma:**
O endpoint demora mais de 30 segundos e dá timeout.

**Solução:**

Separe em dois endpoints:

1. `/admin/seed-only` - Apenas popular banco
2. `/admin/embeddings-only` - Apenas gerar embeddings

Execute um de cada vez.

---

## 🛠️ Solução Alternativa: Seed Manual via SQL

Se nada funcionar, você pode popular o banco manualmente:

### **1. Gerar SQL a partir do JSON**

```bash
# No seu computador local
npm run db:seed:robustcar

# Exportar dados para SQL
npx prisma db pull
npx prisma db push --force-reset
```

### **2. Conectar ao Railway DB**

Railway → PostgreSQL → Connect → Connection String

```bash
psql "postgresql://user:pass@host:port/database"
```

### **3. Executar INSERT manual**

(Trabalhoso, mas funciona)

---

## 🔄 Próximos Passos

### **Opção A: Debug primeiro**

1. ✅ Commit e push tudo
2. ✅ Aguardar deploy
3. ✅ Acessar `/admin/debug-env?secret=...`
4. ✅ Copiar resultado e enviar aqui

### **Opção B: Executar local e copiar banco**

1. ✅ Executar seed localmente
2. ✅ Exportar dados
3. ✅ Importar no Railway

---

## 📋 Checklist de Verificação

- [ ] Arquivo `scripts/robustcar-vehicles.json` existe localmente
- [ ] Arquivo `prisma/seed-robustcar.ts` existe localmente
- [ ] Arquivos estão no Git (`git ls-files`)
- [ ] Push feito para o GitHub
- [ ] Deploy Railway concluído
- [ ] `DATABASE_URL` configurado no Railway
- [ ] `OPENAI_API_KEY` configurado no Railway
- [ ] `SEED_SECRET` configurado no Railway
- [ ] Endpoint `/admin/debug-env` testado

---

## 📞 Comandos Úteis

```bash
# Ver status do Git
git status

# Ver o que está commitado
git ls-files | grep -E "robustcar|seed"

# Ver últimos commits
git log --oneline -5

# Forçar add de tudo
git add -A
git commit -m "fix: garantir todos arquivos estão no repo"
git push --force origin main
```

---

**Próximo passo:** Execute `/admin/debug-env` e me mostre o resultado! 🔍
