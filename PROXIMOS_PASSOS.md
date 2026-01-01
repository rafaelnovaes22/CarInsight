# 🎯 Próximos Passos - Setup FaciliAuto

## ✅ O que já está pronto:

```
✅ Node.js v24.12.0 instalado
✅ npm v11.6.2 instalado  
✅ PostgreSQL 16.11 instalado e rodando
✅ Ambos adicionados ao PATH do usuário
✅ .env configurado com DATABASE_URL correto
✅ Dependências do projeto instaladas
```

---

## 🔄 PASSO 1: Reiniciar Terminal (OBRIGATÓRIO)

**Feche e abra novamente o terminal/Kiro** para carregar o PATH atualizado.

Depois, teste:
```powershell
node --version  # Deve mostrar: v24.12.0
npm --version   # Deve mostrar: 11.6.2
psql --version  # Deve mostrar: psql (PostgreSQL) 16.11
```

Se algum comando não funcionar, o PATH não foi carregado. Reinicie novamente.

---

## 🗄️ PASSO 2: Criar Database

Execute o script SQL que criei:

```powershell
psql -U postgres -f setup-database.sql
```

**Vai pedir a senha do usuário `postgres`** (definida quando instalou o PostgreSQL).

**O que o script faz:**
- Cria database `faciliauto_mvp`
- Cria usuário `faciliauto` com senha `faciliauto2025`
- Concede todas as permissões necessárias

**Verificar se funcionou:**
```powershell
psql -U faciliauto -d faciliauto_mvp
# Senha: faciliauto2025
# Se conectar, digite: \q
```

---

## 🔧 PASSO 3: Configurar Prisma

```powershell
# Gerar cliente Prisma
npx prisma generate

# Aplicar schema no banco (cria todas as tabelas)
npx prisma db push
```

**Deve aparecer:** `✔ Database synchronized`

---

## 📊 PASSO 4: Popular Banco com Dados

**IMPORTANTE: Primeiro corrigir as URLs!**

```powershell
# 1. Corrigir URLs do arquivo JSON (cria backup automático)
npm run vehicles:fix-urls

# 2. Popular com 30 veículos da RobustCar (URLs corretas)
npm run db:seed:robustcar
```

**Deve aparecer:** `🎉 Seed completed successfully!`

**O que foi corrigido:**
- URLs com caracteres mal codificados (`S�o` → `Sao`)
- Links agora funcionam corretamente
- Backup criado em `scripts/robustcar-vehicles.backup.json`

---

## 🧪 PASSO 5: Testar Aplicação

```powershell
# Iniciar servidor
npm run dev
```

**Deve aparecer:**
```
✅ Database connected
🚀 Server running on port 3000
📱 WhatsApp Meta Cloud API initialized
```

**Em outro terminal, testar API:**
```powershell
curl http://localhost:3000/health
```

**Deve retornar:** `{"status":"ok","timestamp":"..."}`

---

## 🎨 PASSO 6 (Opcional): Visualizar Dados

```powershell
npx prisma studio
```

Abre interface web em `http://localhost:5555` para ver:
- 30 veículos cadastrados
- Tabelas: Vehicle, Conversation, Event, etc.

---

## ⚡ Resumo dos Comandos

```powershell
# 1. Reiniciar terminal primeiro!

# 2. Criar database
psql -U postgres -f setup-database.sql

# 3. Setup Prisma
npx prisma generate
npx prisma db push

# 4. Corrigir URLs e popular dados
npm run vehicles:fix-urls
npm run db:seed:robustcar

# 5. Iniciar app
npm run dev

# 6. (Opcional) Ver dados
npx prisma studio
```

---

## 🚨 Troubleshooting

### "node não é reconhecido"
→ Você não reiniciou o terminal. Feche e abra novamente.

### "psql não é reconhecido"  
→ Você não reiniciou o terminal. Feche e abra novamente.

### "password authentication failed"
→ Senha incorreta. Tente resetar a senha do postgres.

### "Database connection failed"
→ Verifique se o serviço está rodando:
```powershell
Get-Service postgresql-x64-16
# Se Status = Stopped, execute:
Start-Service postgresql-x64-16
```

### "Prisma schema not found"
→ Você está no diretório correto? Execute:
```powershell
cd C:\Users\Rafael\Projetos\faciliauto-mvp-v2
```

---

## 📋 Checklist

- [ ] Terminal reiniciado
- [ ] `node --version` funciona
- [ ] `npm --version` funciona  
- [ ] `psql --version` funciona
- [ ] Database `faciliauto_mvp` criada
- [ ] `npx prisma generate` executado
- [ ] `npx prisma db push` executado
- [ ] `npm run db:seed:robustcar` executado
- [ ] `npm run dev` inicia sem erros
- [ ] API responde em `/health`

---

**Quando completar todos os passos, seu ambiente estará 100% pronto! 🎉**
