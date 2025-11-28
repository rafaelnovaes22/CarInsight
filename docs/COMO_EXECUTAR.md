# ⚡ Como Executar a Migração

## ❌ Problema

O ambiente atual não tem Node.js/npm disponível no PATH, então não consigo executar os comandos diretamente.

---

## ✅ Solução: Você precisa executar manualmente

### Opção 1: Script Automatizado (Recomendado)

Abra um terminal **com Node.js instalado** e execute:

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
bash executar-migracao.sh
```

Este script irá:
1. ✅ Popular o banco com 70 veículos
2. ✅ Gerar embeddings OpenAI
3. ✅ Mostrar estatísticas

---

### Opção 2: Comandos Manuais

Se preferir executar passo a passo:

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# 1. Popular banco
npm run db:seed:robustcar

# 2. Gerar embeddings
npm run embeddings:generate

# 3. Ver estatísticas
npm run embeddings:stats

# 4. (Opcional) Ver no Prisma Studio
npm run db:studio
```

---

## 🔍 Onde Executar?

Execute em qualquer terminal que tenha:
- ✅ Node.js 18+
- ✅ npm
- ✅ Acesso ao diretório `/home/rafaelnovaes22/faciliauto-mvp-v2`

**Exemplos:**
- Terminal do VS Code
- Terminal do sistema operacional
- SSH para o servidor local
- Railway CLI (para produção)

---

## 📋 Arquivos Criados (Prontos para Usar)

Todos os arquivos necessários estão prontos:

1. ✅ `scripts/robustcar-vehicles.json` - 73 veículos
2. ✅ `prisma/seed-robustcar.ts` - Script de seed
3. ✅ `executar-migracao.sh` - Script bash automatizado
4. ✅ `package.json` - Comando `db:seed:robustcar` adicionado

---

## 🚀 Após Executar com Sucesso

Você verá algo assim:

```
✅ Seed concluído com sucesso!
📊 Resumo:
   ✅ Inseridos: 70
   ⏭️  Pulados: 3
   📦 Total: 73

🚗 Veículos por categoria:
   Hatchback: 24
   SUV: 20
   Sedan: 16
   Picape: 2
   Minivan: 2

✅ Embeddings gerados: 70/70
```

---

## 🎯 Deploy no Railway (Produção)

Após testar localmente:

```bash
# 1. Commit e push
git add .
git commit -m "feat: migrar para 70 veículos Robust Car"
git push origin main

# 2. Aguardar deploy automático

# 3. Executar seed na produção
railway run npm run db:seed:robustcar

# 4. Gerar embeddings na produção
railway run npm run embeddings:generate
```

---

## ❓ Troubleshooting

### "bash: npm: command not found"

**Causa:** Node.js não está instalado ou não está no PATH.

**Solução:**
```bash
# Verificar instalação
node --version
npm --version

# Se não estiver instalado, instale Node.js 18+
```

### "Cannot find module '@prisma/client'"

**Solução:**
```bash
npm install
npx prisma generate
```

### "DATABASE_URL environment variable not found"

**Solução:**
```bash
# Verificar .env
cat .env | grep DATABASE_URL

# Se não existir, criar
echo 'DATABASE_URL="file:./prisma/dev.db"' >> .env
```

---

## 📚 Documentação Completa

- `EXECUTAR_AGORA.md` - Guia rápido
- `INSTRUCOES_SEED_ROBUSTCAR.md` - Instruções detalhadas
- `RESUMO_MIGRACAO_ROBUSTCAR.md` - Resumo executivo
- `MELHORIAS_MATCH_SCORE_CATEGORIAS.md` - Otimizações

---

## ✅ Checklist

Antes de executar:
- [ ] Node.js 18+ instalado
- [ ] npm instalado
- [ ] Arquivo `.env` configurado com `DATABASE_URL`
- [ ] No diretório correto

Após executar:
- [ ] ~70 veículos no banco
- [ ] Embeddings gerados (70/70)
- [ ] Testado localmente
- [ ] Deploy no Railway

---

**Executar:** `bash executar-migracao.sh` ou comandos manuais acima.
