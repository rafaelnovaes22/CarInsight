# 🚀 Ativar Modo Conversacional no Railway

**Tempo estimado:** 2 minutos

---

## 📋 Pré-requisitos

- [x] Código commitado e pushed para GitHub
- [x] Railway configurado e deploy funcionando
- [x] WhatsApp conectado e funcionando

---

## 🔧 PASSO 1: Configurar Variáveis no Railway

### Via Railway Dashboard:

1. Acesse: https://railway.app/
2. Selecione seu projeto: **faciliauto-mvp-v2**
3. Clique em **Variables**
4. Adicione/Edite as seguintes variáveis:

```bash
ENABLE_CONVERSATIONAL_MODE=true
CONVERSATIONAL_ROLLOUT_PERCENTAGE=100
```

**Importante:** Use `=` (sem aspas) no Railway Dashboard

### Via Railway CLI (alternativa):

```bash
railway variables set ENABLE_CONVERSATIONAL_MODE=true
railway variables set CONVERSATIONAL_ROLLOUT_PERCENTAGE=100
```

---

## 🔄 PASSO 2: Deploy Automático

Railway detecta mudanças de variáveis e reinicia automaticamente.

Aguarde ~30 segundos para o deploy completar.

---

## ✅ PASSO 3: Verificar Configuração

### Via curl (substitua pela URL do seu Railway):

```bash
curl "https://seu-app.railway.app/debug/config?phone=5511910165356"
```

**Resposta esperada:**
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

## 🗑️ PASSO 4: Resetar Conversas Existentes

### Via curl (substitua pela URL do Railway):

```bash
curl "https://seu-app.railway.app/debug/reset-full?phoneNumber=5511910165356"
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Full reset completed"
}
```

---

## 📱 PASSO 5: Testar no WhatsApp

Envie para o número configurado:
```
oi
```

**Deve responder (conversacional):**
```
🚗 Olá! Sou o assistente da FaciliAuto...
Me conte: o que você procura em um carro?
```

**NÃO deve responder (quiz antigo):**
```
1️⃣ Qual o seu orçamento?
```

---

## 📊 PASSO 6: Monitorar Logs

### Via Railway Dashboard:
1. Clique no seu projeto
2. Vá em **Deployments**
3. Clique no deployment ativo
4. Veja **Logs** em tempo real

### Via Railway CLI:
```bash
railway logs
```

**Procure por:**
```
"useConversational": true
"Conversational: processing message"
```

---

## 🎯 Rollout Gradual (Recomendado para Produção)

Se quiser testar primeiro com 10% dos usuários:

```bash
# Começar com 10%
railway variables set CONVERSATIONAL_ROLLOUT_PERCENTAGE=10

# Aguardar 24-48h e monitorar métricas

# Se OK, aumentar para 50%
railway variables set CONVERSATIONAL_ROLLOUT_PERCENTAGE=50

# Aguardar mais 24-48h

# Se tudo OK, 100%
railway variables set CONVERSATIONAL_ROLLOUT_PERCENTAGE=100
```

---

## 🔄 Rollback Rápido (se necessário)

Se algo der errado, volte para o modo quiz:

```bash
railway variables set ENABLE_CONVERSATIONAL_MODE=false
railway variables set CONVERSATIONAL_ROLLOUT_PERCENTAGE=0
```

**Tempo de rollback:** ~30 segundos

---

## 📋 Checklist de Validação

- [ ] Variáveis configuradas no Railway
- [ ] Deploy completou sem erros
- [ ] Endpoint `/debug/config` retorna `enabled: true`
- [ ] Conversas antigas resetadas
- [ ] Mensagem "oi" enviada no WhatsApp
- [ ] **Bot responde em modo conversacional (não quiz)**
- [ ] Logs mostram `useConversational: true`

---

## 🆘 Troubleshooting

### Problema: Bot ainda responde em modo quiz

**1. Verificar variáveis:**
```bash
railway variables
```

Deve mostrar:
```
ENABLE_CONVERSATIONAL_MODE=true
CONVERSATIONAL_ROLLOUT_PERCENTAGE=100
```

**2. Verificar endpoint de debug:**
```bash
curl "https://seu-app.railway.app/debug/config?phone=5511910165356"
```

**3. Disparar novo deploy:**
```bash
git push origin main
```

**4. Resetar cache + conversa:**
```bash
curl "https://seu-app.railway.app/debug/reset-full?phoneNumber=5511910165356"
```

### Problema: Deploy falhou

Verificar logs:
```bash
railway logs --deployment latest
```

Comum: Erro de build → Verificar que código foi pushed:
```bash
git push origin main
```

---

## 📚 Próximos Passos Após Ativação

1. **Monitorar por 24-48h**
   - Taxa de conversão
   - Tempo médio de conversa
   - Feedback dos usuários
   - Erros/problemas

2. **Ajustar prompts** (se necessário)
   - Baseado em conversas reais
   - Melhorar respostas a perguntas comuns

3. **Implementar guardrails avançados**
   - Ver: `GUARDRAILS_ADVANCED_ARCHITECTURE.md`

---

**Criado:** 2025-11-28  
**Status:** ✅ Pronto para uso  
**Tempo estimado:** 2 minutos
