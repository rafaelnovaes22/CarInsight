# 🔧 Setup do Ambiente - FaciliAuto MVP

## ✅ Status Atual

### Instalado e Configurado
- ✅ **Node.js v24.12.0** - Instalado e adicionado ao PATH
- ✅ **npm v11.6.2** - Funcionando
- ✅ **PostgreSQL 16.11** - Instalado, rodando e adicionado ao PATH
- ✅ **Dependências do projeto** - node_modules presente
- ✅ **Estrutura do projeto** - Completa
- ✅ **Proteções de segurança** - .gitignore, Husky configurados
- ✅ **.env atualizado** - DATABASE_URL configurado

### Pendente
- ⚠️ **PATH do sistema** - Precisa reiniciar terminal/IDE para carregar
- ❌ **Database faciliauto_mvp** - Precisa criar
- ❌ **Prisma setup** - Precisa executar migrations
- ❌ **Seed do banco** - Precisa popular dados

---

## 🚀 Próximos Passos

### 1. Reiniciar Terminal/IDE (IMPORTANTE!)

O Node.js foi adicionado ao PATH, mas você precisa **reiniciar** para que as mudanças tenham efeito:

**Opção A - Reiniciar Kiro (Recomendado)**
- Feche e abra o Kiro novamente

**Opção B - Recarregar Terminal**
- Feche todos os terminais abertos
- Abra um novo terminal

**Verificar se funcionou:**
```powershell
node --version  # Deve mostrar: v24.12.0
npm --version   # Deve mostrar: 11.6.2
```

---

### 2. Criar Database (IMPORTANTE!)

**Opção A - Usando script SQL (Recomendado):**

Já criei o arquivo `setup-database.sql` para você. Execute:

```powershell
# Vai pedir a senha do usuário postgres (definida na instalação)
psql -U postgres -f setup-database.sql
```

**Opção B - Manualmente:**

```powershell
# Conectar ao PostgreSQL
psql -U postgres

# Dentro do psql, executar:
CREATE DATABASE faciliauto_mvp;
CREATE USER faciliauto WITH PASSWORD 'faciliauto2025';
GRANT ALL PRIVILEGES ON DATABASE faciliauto_mvp TO faciliauto;
\c faciliauto_mvp
GRANT ALL ON SCHEMA public TO faciliauto;
\q
```

**Verificar se foi criado:**
```powershell
psql -U postgres -l | Select-String "faciliauto"
```

---

### 3. Verificar Conexão

Teste se consegue conectar com o novo usuário:

```powershell
psql -U faciliauto -d faciliauto_mvp
# Senha: faciliauto2025
# Se conectar, digite: \q para sair
```

---

### 4. Configurar Prisma e Popular Banco

```powershell
# Gerar cliente Prisma
npx prisma generate

# Aplicar schema no banco
npx prisma db push

# Popular com dados de exemplo
npm run db:seed:robustcar

# (Opcional) Abrir Prisma Studio para visualizar dados
npx prisma studio
```

---

### 5. Testar Aplicação

```powershell
# Iniciar servidor de desenvolvimento
npm run dev
```

Deve aparecer:
```
✅ Database connected
🚀 Server running on port 3000
```

---

## 🧪 Testes de Validação

### Teste 1: Node.js e npm
```powershell
node --version  # v24.12.0
npm --version   # 11.6.2
```

### Teste 2: PostgreSQL
```powershell
psql --version  # PostgreSQL 16.x
Get-Service postgresql-x64-16  # Status: Running
```

### Teste 3: Prisma
```powershell
npx prisma --version
npx prisma studio  # Abre interface web
```

### Teste 4: API
```powershell
# Em outro terminal:
curl http://localhost:3000/health
# Deve retornar: {"status":"ok"}
```

---

## 🔍 Troubleshooting

### Erro: "node não é reconhecido"
**Solução:** Reinicie o terminal/IDE após adicionar ao PATH

### Erro: "psql não é reconhecido"
**Solução:** 
1. Verifique se PostgreSQL foi instalado
2. Reinicie o terminal
3. Adicione manualmente ao PATH: `C:\Program Files\PostgreSQL\16\bin`

### Erro: "Database connection failed"
**Solução:**
1. Verifique se o serviço está rodando: `Get-Service postgresql-x64-16`
2. Confirme a senha no `.env`
3. Teste conexão: `psql -U faciliauto -d faciliauto_mvp`

### Erro: "OpenAI API error"
**Solução:**
1. Verifique se `OPENAI_API_KEY` está no `.env`
2. Confirme créditos em: https://platform.openai.com/billing

---

## 📝 Checklist Final

Antes de considerar o ambiente pronto:

- [ ] Node.js funcionando (`node --version`)
- [ ] npm funcionando (`npm --version`)
- [ ] PostgreSQL instalado e rodando
- [ ] Database `faciliauto_mvp` criada
- [ ] `.env` configurado com credenciais corretas
- [ ] `npx prisma generate` executado com sucesso
- [ ] `npx prisma db push` executado com sucesso
- [ ] `npm run db:seed:robustcar` executado com sucesso
- [ ] `npm run dev` inicia sem erros
- [ ] API responde em `http://localhost:3000/health`

---

## 🎯 Comandos Rápidos de Referência

```powershell
# Desenvolvimento
npm run dev              # Iniciar servidor
npm run dev:api          # API sem WhatsApp
npx prisma studio        # Visualizar banco

# Database
npm run db:push          # Aplicar schema
npm run db:seed:robustcar # Popular dados
npx prisma generate      # Gerar cliente

# Testes
npm test                 # Rodar testes
npm run test:coverage    # Com cobertura

# Embeddings
npm run embeddings:generate  # Gerar embeddings OpenAI
npm run embeddings:stats     # Ver estatísticas
```

---

**Status:** ⏳ Aguardando instalação do PostgreSQL

**Próximo passo:** Instalar PostgreSQL 16 e criar database
