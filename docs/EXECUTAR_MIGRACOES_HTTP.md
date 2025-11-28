# 🚀 Executar Migrações via HTTP

**Método:** Via endpoints admin (sem Railway CLI)  
**Tempo:** 2-3 minutos

---

## 📋 Pré-requisitos

- ✅ Deploy Railway completado
- ✅ Variável `SEED_SECRET` configurada no Railway

---

## 🔧 Passo a Passo

### 1. Aguardar Deploy (1-2 min)

Verificar em: https://railway.app/

Aguarde até ver: `✅ Deployment successful`

### 2. Aplicar Schema no Banco

```bash
curl -X POST "https://faciliauto-mvp-v2-production.up.railway.app/admin/schema-push?secret=change-me-in-production-use-strong-secret"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Schema applied successfully",
  "output": "..."
}
```

**Se der erro 403:** Secret incorreto - verificar variável `SEED_SECRET` no Railway

### 3. Marcar Veículos Uber

```bash
curl -X POST "https://faciliauto-mvp-v2-production.up.railway.app/admin/update-uber?secret=change-me-in-production-use-strong-secret"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Uber eligibility updated successfully",
  "summary": {
    "totalVehicles": 57,
    "uberX": 23,
    "uberBlack": 8,
    "familia": 45,
    "trabalho": 52
  },
  "uberVehicles": [
    {
      "marca": "Honda",
      "modelo": "Civic",
      "ano": 2018,
      "preco": 65000,
      "uberX": true,
      "uberBlack": true
    },
    ...
  ]
}
```

### 4. Verificar Veículos Uber

```bash
# Listar Uber X
curl "https://faciliauto-mvp-v2-production.up.railway.app/admin/vehicles-uber?secret=change-me-in-production-use-strong-secret&type=x"

# Listar Uber Black
curl "https://faciliauto-mvp-v2-production.up.railway.app/admin/vehicles-uber?secret=change-me-in-production-use-strong-secret&type=black"
```

### 5. Resetar Conversas

```bash
curl "https://faciliauto-mvp-v2-production.up.railway.app/debug/reset-full?phoneNumber=5511910165356"
```

### 6. Testar no WhatsApp

```
1. "oi"
2. "João"
3. "preciso para uber"
4. "uber x até 50 mil"
```

---

## 📊 Endpoints Disponíveis

### Admin Endpoints (requerem secret)

```bash
# Ver todos endpoints
GET /admin/health

# Aplicar schema
POST /admin/schema-push?secret=YOUR_SECRET

# Atualizar Uber
POST /admin/update-uber?secret=YOUR_SECRET

# Listar veículos Uber
GET /admin/vehicles-uber?secret=YOUR_SECRET&type=x
GET /admin/vehicles-uber?secret=YOUR_SECRET&type=black

# Debug
GET /admin/debug-env?secret=YOUR_SECRET
```

### Debug Endpoints (sem autenticação)

```bash
# Config e feature flags
GET /debug/config?phone=5511910165356

# Reset conversa
GET /debug/reset-full?phoneNumber=5511910165356
POST /debug/reset-full
  Body: { "phoneNumber": "5511910165356" }

# Limpar cache
GET /debug/clear-all-cache
```

---

## ✅ Checklist

- [ ] Deploy Railway completou
- [ ] Schema aplicado (POST /admin/schema-push)
- [ ] Uber atualizado (POST /admin/update-uber)
- [ ] Veículos listados (GET /admin/vehicles-uber)
- [ ] Conversas resetadas (GET /debug/reset-full)
- [ ] Teste WhatsApp feito
- [ ] Onboarding funciona (oi → nome → contexto)

---

## 🆘 Troubleshooting

### Erro 403 Forbidden

**Causa:** Secret incorreto

**Solução:**
1. Verificar `SEED_SECRET` no Railway:
   ```bash
   railway variables
   ```
2. Se não existir, adicionar:
   ```bash
   railway variables set SEED_SECRET="seu-secret-aqui"
   ```

### Erro 500 Internal Server Error

**Ver logs:**
```bash
railway logs | tail -50
```

**Causas comuns:**
- Schema já aplicado (pode ignorar se já foi executado)
- Erro de conexão com banco (verificar DATABASE_URL)

### Schema Push falha

**Erro:** "Already applied"

**Solução:** Pode ignorar, schema já está atualizado. Prossiga para step 3.

### Update Uber sem resultados

**Verificar dados:**
```bash
# Ver se vehicles existem
curl "https://sua-url.railway.app/stats"
```

Se `vehicles: 0`, executar seed primeiro:
```bash
curl "https://sua-url.railway.app/admin/seed-robustcar?secret=YOUR_SECRET"
```

---

## 📝 Scripts Prontos

### Script Bash Completo:

```bash
#!/bin/bash

URL="https://faciliauto-mvp-v2-production.up.railway.app"
SECRET="change-me-in-production-use-strong-secret"

echo "🚀 Executando migrações..."

echo "1️⃣ Aplicando schema..."
curl -X POST "$URL/admin/schema-push?secret=$SECRET"
echo ""

sleep 2

echo "2️⃣ Atualizando Uber..."
curl -X POST "$URL/admin/update-uber?secret=$SECRET"
echo ""

sleep 2

echo "3️⃣ Listando veículos Uber X..."
curl "$URL/admin/vehicles-uber?secret=$SECRET&type=x" | head -20
echo ""

echo "4️⃣ Resetando conversas..."
curl "$URL/debug/reset-full?phoneNumber=5511910165356"
echo ""

echo "✅ Concluído! Teste no WhatsApp: oi → nome → contexto"
```

Salve como `migrate.sh` e execute:
```bash
chmod +x migrate.sh
./migrate.sh
```

---

**Criado:** 2025-11-28  
**Método:** HTTP Endpoints  
**Vantagem:** Sem necessidade de Railway CLI  
**Segurança:** Protegido por SEED_SECRET
