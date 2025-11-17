# 🐘 Guia de Migração: SQLite → PostgreSQL

## 📋 Contexto

O projeto atualmente usa **SQLite para desenvolvimento** mas o schema está preparado para **PostgreSQL em produção**.

---

## 🎯 Quando Migrar

Migre para PostgreSQL quando:
- ✅ For fazer deploy em produção
- ✅ Precisar de mais de 1.000 veículos
- ✅ Tiver múltiplos usuários simultâneos
- ✅ Precisar de replicação/backup avançado

---

## 🚀 Passo a Passo da Migração

### 1. Instalar PostgreSQL

**Opção A: Docker (Recomendado)**
```bash
docker run --name faciliauto-postgres \
  -e POSTGRES_PASSWORD=faciliauto2025 \
  -e POSTGRES_DB=faciliauto \
  -p 5432:5432 \
  -d postgres:15
```

**Opção B: Instalação Local**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

### 2. Criar Database

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql

# Criar database e usuário
CREATE DATABASE faciliauto;
CREATE USER faciliauto_user WITH ENCRYPTED PASSWORD 'faciliauto2025';
GRANT ALL PRIVILEGES ON DATABASE faciliauto TO faciliauto_user;
\q
```

---

### 3. Atualizar Schema Prisma

Editar `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"  // Mudar de "sqlite" para "postgresql"
  url      = env("DATABASE_URL")
}
```

---

### 4. Atualizar .env

```bash
# ANTES (SQLite)
DATABASE_URL="file:./dev.db"

# DEPOIS (PostgreSQL)
DATABASE_URL="postgresql://faciliauto_user:faciliauto2025@localhost:5432/faciliauto?schema=public"
```

**Formato da URL:**
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

---

### 5. Executar Migrations

```bash
# Gerar client Prisma
npx prisma generate

# Aplicar schema no PostgreSQL
npx prisma db push

# OU criar migration
npx prisma migrate dev --name init_postgresql
```

---

### 6. Migrar Dados (Se Necessário)

**Opção A: Exportar/Importar JSON**

```bash
# Exportar dados do SQLite
npx tsx src/scripts/export-data.ts > data.json

# Importar no PostgreSQL
npx tsx src/scripts/import-data.ts data.json
```

**Opção B: Script customizado**

```typescript
// scripts/migrate-to-postgres.ts
import { PrismaClient as SQLitePrisma } from '@prisma/client';
import { PrismaClient as PostgresPrisma } from '@prisma/client';

async function migrate() {
  // 1. Conectar em ambos
  const sqlite = new SQLitePrisma({
    datasources: { db: { url: 'file:./dev.db' } }
  });
  
  const postgres = new PostgresPrisma({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });

  // 2. Copiar veículos
  const vehicles = await sqlite.vehicle.findMany();
  
  for (const v of vehicles) {
    await postgres.vehicle.create({ data: v });
  }

  console.log(`✅ ${vehicles.length} veículos migrados`);
}

migrate();
```

---

### 7. Popular Database (Se Começar do Zero)

```bash
# Executar seed
npx prisma db seed

# OU usar script customizado
npx tsx prisma/seed-vehicles.ts
```

---

### 8. Testar Conexão

```typescript
// test-postgres.ts
import { prisma } from './src/lib/prisma';

async function test() {
  const count = await prisma.vehicle.count();
  console.log(`✅ PostgreSQL conectado! ${count} veículos no banco.`);
}

test();
```

```bash
npx tsx test-postgres.ts
```

---

### 9. Atualizar Vector Store

O vector store funcionará automaticamente com PostgreSQL:

```bash
# Regenerar embeddings (se usar ChromaDB)
npx tsx src/scripts/generate-embeddings.ts

# OU apenas iniciar servidor (in-memory funciona igual)
npx tsx src/api-test-server.ts
```

---

## 🔧 Configuração para Produção

### .env de Produção

```bash
# Database (PostgreSQL em produção)
DATABASE_URL="postgresql://user:password@db.example.com:5432/faciliauto?sslmode=require"

# Redis (cache em produção)
REDIS_URL="redis://redis.example.com:6379"

# OpenAI real (não mock)
OPENAI_API_KEY="sk-proj-xxxxx"

# ChromaDB (opcional)
CHROMA_URL="http://chroma.example.com:8000"

NODE_ENV="production"
PORT=3000
```

---

## 📊 Diferenças SQLite vs PostgreSQL

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Tipo | Arquivo local | Server |
| Concorrência | Limitada | Alta |
| Escalabilidade | < 1k registros | Milhões |
| Backup | Copiar arquivo | pg_dump / replicação |
| JSON | Básico | Avançado (JSONB) |
| Full-text search | FTS5 | pg_trgm, tsquery |
| Embeddings | ❌ | pgvector (opcional) |

---

## 🎁 Bonus: pgvector (Embeddings Nativos)

Para embeddings nativos no PostgreSQL:

```bash
# 1. Instalar pgvector
docker exec -it faciliauto-postgres bash
apt-get update && apt-get install -y postgresql-15-pgvector
```

```sql
-- 2. Habilitar extensão
CREATE EXTENSION vector;

-- 3. Adicionar coluna de embedding
ALTER TABLE "Vehicle" ADD COLUMN embedding vector(1536);

-- 4. Criar índice
CREATE INDEX ON "Vehicle" USING ivfflat (embedding vector_cosine_ops);
```

```prisma
// 5. Atualizar schema
model Vehicle {
  // ... campos existentes
  embedding String? // vector(1536) em PostgreSQL
}
```

**Benefícios:**
- Busca vetorial nativa no banco
- Não precisa ChromaDB
- Performance excelente
- Integração simples

---

## ✅ Checklist de Migração

- [ ] PostgreSQL instalado e rodando
- [ ] Database criada
- [ ] Schema Prisma atualizado
- [ ] .env configurado
- [ ] Migrations aplicadas
- [ ] Dados migrados (se necessário)
- [ ] Testes passando
- [ ] Vector store funcionando
- [ ] Servidor em produção

---

## 🆘 Troubleshooting

### Erro: "Connection refused"
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# OU (Docker)
docker ps | grep postgres
```

### Erro: "Authentication failed"
```bash
# Verificar credenciais
psql -U faciliauto_user -d faciliauto -h localhost
```

### Erro: "Schema not found"
```bash
# Aplicar schema
npx prisma db push --force-reset
```

---

## 📚 Recursos

- Prisma + PostgreSQL: https://www.prisma.io/docs/concepts/database-connectors/postgresql
- pgvector: https://github.com/pgvector/pgvector
- Docker PostgreSQL: https://hub.docker.com/_/postgres

---

**Nota:** O sistema atual funciona perfeitamente com SQLite em desenvolvimento. Migre para PostgreSQL apenas quando necessário para produção.
