# ⚡ Quick Start: Modo Conversacional

**Tempo estimado:** 2 minutos

---

## 🚀 Método Automático (Recomendado)

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Ativar com rollout 100% (teste completo)
bash scripts/activate-conversational.sh 100

# Ou com rollout gradual (10%, 50%, etc)
bash scripts/activate-conversational.sh 10
```

**O script faz automaticamente:**
1. ✅ Backup do .env atual
2. ✅ Atualiza variáveis (ENABLE=true, ROLLOUT=%)
3. ✅ Pergunta se deseja resetar conversas
4. ✅ Reinicia servidor (opcional)

---

## 🔧 Método Manual

### 1. Resetar conversas

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Opção A: Todas as conversas
npm run conversations:reset:all

# Opção B: Conversa específica
npm run conversations:reset 5511949105033
```

### 2. Editar .env

```bash
nano .env
```

Alterar para:
```bash
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"
```

### 3. Reiniciar servidor

```bash
# Local
npm run dev

# Railway (reinicia automaticamente)
git push origin main
```

---

## 🧪 Testar

1. Abrir WhatsApp
2. Enviar: `oi`
3. Aguardar resposta conversacional (não quiz estruturado)

**Resposta esperada:**
```
🚗 Olá! Sou o assistente da FaciliAuto...

Me conte: o que você procura em um carro?
```

---

## 📊 Monitorar

```bash
# Logs em tempo real
tail -f server.log | grep -E "(Routing|Conversational)"

# Deve aparecer:
# [INFO] Routing decision: useConversational=true
# [INFO] Conversational: processing message
```

---

## 🔄 Rollback Rápido

```bash
# Editar .env
ENABLE_CONVERSATIONAL_MODE="false"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="0"

# Reiniciar
# (servidor reinicia automaticamente)
```

---

## 📚 Documentação Completa

- `RESET_PARA_CONVERSACIONAL.md` - Guia detalhado com troubleshooting
- `DEPLOY_CONVERSATIONAL.md` - Deploy para produção
- `CONVERSATIONAL_SUMMARY.md` - Resumo da implementação

---

**Criado:** 2025-01-XX  
**Status:** ✅ Pronto para uso
