# ⚡ EXECUTAR AGORA - Ativar Conversacional no Railway

**Tempo:** 2 minutos

---

## 🎯 PASSO A PASSO RÁPIDO

### 1️⃣ Acessar Railway (30 segundos)

Abra: https://railway.app/

Ou via CLI:
```bash
railway login
railway link
```

---

### 2️⃣ Configurar Variáveis (30 segundos)

#### Via Dashboard (mais fácil):

1. Clique no projeto **faciliauto-mvp-v2**
2. Clique em **Variables** (ícone de ⚙️)
3. Adicione estas duas variáveis:

```
ENABLE_CONVERSATIONAL_MODE=true
CONVERSATIONAL_ROLLOUT_PERCENTAGE=100
```

**⚠️ IMPORTANTE:** 
- Use `=` (sem aspas)
- Não coloque espaços

#### Via CLI (alternativa):

```bash
railway variables set ENABLE_CONVERSATIONAL_MODE=true
railway variables set CONVERSATIONAL_ROLLOUT_PERCENTAGE=100
```

---

### 3️⃣ Aguardar Deploy (30 segundos)

Railway vai detectar mudança e redeployar automaticamente.

Aguarde até ver:
```
✅ Deployment successful
```

---

### 4️⃣ Verificar (15 segundos)

Copie a URL do seu Railway (ex: `https://faciliauto-mvp-v2-production.up.railway.app`)

Teste:
```bash
curl "https://SUA-URL.railway.app/debug/config?phone=5511910165356"
```

**Deve mostrar:**
```json
{
  "featureFlags": {
    "conversationalMode": {
      "enabled": true,
      "rolloutPercentage": 100
    },
    "testResult": {
      "shouldUseConversational": true
    }
  }
}
```

---

### 5️⃣ Resetar Conversas (15 segundos)

```bash
curl "https://SUA-URL.railway.app/debug/reset-full?phoneNumber=5511910165356"
```

**Deve mostrar:**
```json
{
  "success": true,
  "message": "Full reset completed"
}
```

---

### 6️⃣ TESTAR! 📱

Envie no WhatsApp:
```
oi
```

**Deve responder:**
```
🚗 Olá! Sou o assistente da FaciliAuto...
Me conte: o que você procura em um carro?
```

---

## ✅ PRONTO!

Se recebeu a resposta conversacional → **SUCESSO!** 🎉

Se ainda receber quiz → Ver troubleshooting abaixo ⬇️

---

## 🆘 Troubleshooting Rápido

### Bot ainda em modo quiz?

**1. Verificar variáveis no Railway:**
```bash
railway variables
```

Deve ter:
- `ENABLE_CONVERSATIONAL_MODE=true`
- `CONVERSATIONAL_ROLLOUT_PERCENTAGE=100`

**2. Disparar novo deploy:**
```bash
git push origin main
```

**3. Ver logs:**
```bash
railway logs
```

Procurar por:
```
"useConversational": true
```

**4. Se persistir, resetar cache:**
```bash
curl "https://SUA-URL.railway.app/debug/clear-all-cache"
```

---

## 📋 Checklist

- [ ] Railway aberto
- [ ] Variáveis configuradas (2)
- [ ] Deploy completou (30s)
- [ ] Endpoint /debug/config OK
- [ ] Conversa resetada
- [ ] Teste no WhatsApp enviado
- [ ] ✅ **Resposta conversacional recebida**

---

## 🎯 Comandos Úteis (Railway CLI)

```bash
# Ver logs em tempo real
railway logs

# Ver variáveis
railway variables

# Ver deploy no dashboard
# Railway Dashboard -> Deployments

# Abrir no navegador
railway open
```

---

**Última atualização:** 2025-11-28  
**Código:** Commitado e pushed ✅  
**Pronto para produção:** ✅
