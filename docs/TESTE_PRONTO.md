# ✅ Sistema Pronto para Teste - Modo Conversacional

**Data:** 2025-11-28 15:25  
**Status:** 🟢 OPERACIONAL

---

## ✅ Verificações Concluídas

### 1. Servidor ✅
- Porta: 3000
- Status: Rodando (PID 1697)
- Vector store: 57 embeddings carregados
- Database: 57 veículos

### 2. Feature Flags ✅
```json
{
  "enabled": true,
  "rolloutPercentage": 100,
  "shouldUseConversational": true
}
```

**Verificado via:** `http://localhost:3000/debug/config?phone=5511910165356`

### 3. Conversas ✅
- Conversas antigas: 0 (todas resetadas)
- Cache: Limpo
- Banco: Limpo para o número 5511910165356

---

## 📱 Como Testar AGORA

### 1. Enviar mensagem no WhatsApp

Abra seu WhatsApp e envie para o número configurado:
```
oi
```

### 2. Comportamento ESPERADO (Modo Conversacional)

```
🚗 Olá! Sou o assistente da FaciliAuto, especialista em veículos usados.

Como posso ajudá-lo hoje? Posso:
• Recomendar veículos baseado no seu perfil
• Responder dúvidas sobre modelos
• Mostrar comparações
• Simular financiamentos

Me conte: o que você procura em um carro?
```

### 3. Comportamento INCORRETO (Modo Quiz - não deve aparecer)

```
🚗 Bem-vindo ao FaciliAuto!
Vou fazer 8 perguntas rápidas...

1️⃣ Qual o seu orçamento?
```

---

## 📊 Monitorar Logs em Tempo Real

### Terminal 2 (abrir nova aba):

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
tail -f server.log | grep -E "(Routing decision|Conversational|useConversational)"
```

### O que DEVE aparecer:

```json
{
  "conversationId": "xxx-xxx-xxx",
  "phoneNumber": "55119101****",
  "useConversational": true,    ← DEVE SER TRUE
  "hasCache": false,
  "msg": "Routing decision"
}
```

### O que NÃO deve aparecer:

```
"useConversational": false
```

---

## 🔧 Endpoints Úteis

### Ver configuração atual:
```bash
curl "http://localhost:3000/debug/config?phone=5511910165356"
```

### Resetar conversa (se precisar):
```bash
curl "http://localhost:3000/debug/reset-full?phoneNumber=5511910165356"
```

### Health check:
```bash
curl http://localhost:3000/health
```

### Stats:
```bash
curl http://localhost:3000/stats
```

---

## 🧪 Fluxo de Teste Completo

### Teste 1: Discovery Natural
```
Você: oi
Bot: [Saudação conversacional]

Você: Preciso de um SUV automático até 100 mil
Bot: [Recomendações naturais baseadas em preferências]
```

### Teste 2: Perguntas Diretas
```
Você: Quais SUVs vocês tem?
Bot: [Lista de SUVs disponíveis]

Você: Me fale mais sobre o primeiro
Bot: [Detalhes do veículo]
```

### Teste 3: Comparação
```
Você: Qual a diferença entre o Compass e o Tiguan?
Bot: [Comparação detalhada]
```

---

## 🆘 Se ainda aparecer modo Quiz

### 1. Verificar feature flags
```bash
curl http://localhost:3000/debug/config?phone=5511910165356

# Deve mostrar:
# "enabled": true
# "rolloutPercentage": 100
# "shouldUseConversational": true
```

### 2. Verificar .env
```bash
cat /home/rafaelnovaes22/faciliauto-mvp-v2/.env | grep CONVERSATIONAL

# Deve mostrar:
# ENABLE_CONVERSATIONAL_MODE="true"
# CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"
```

### 3. Reiniciar servidor
```bash
# Matar processos
pkill -f "tsx.*index"

# Reiniciar
cd /home/rafaelnovaes22/faciliauto-mvp-v2
./run-local.sh dev
```

### 4. Verificar logs de routing
```bash
tail -f server.log | grep "Routing decision"

# Deve aparecer: "useConversational": true
```

---

## 📊 Verificações Automáticas

### Script para verificar se tudo está OK:

```bash
#!/bin/bash

echo "🔍 Verificando sistema..."

# 1. Servidor rodando?
if pgrep -f "tsx.*index" > /dev/null; then
  echo "✅ Servidor rodando"
else
  echo "❌ Servidor não está rodando"
  exit 1
fi

# 2. Feature flags OK?
RESPONSE=$(curl -s "http://localhost:3000/debug/config?phone=5511910165356")
ENABLED=$(echo "$RESPONSE" | grep -o '"enabled":[^,]*' | grep -o 'true\|false')
ROLLOUT=$(echo "$RESPONSE" | grep -o '"rolloutPercentage":[0-9]*' | grep -o '[0-9]*')
SHOULD_USE=$(echo "$RESPONSE" | grep -o '"shouldUseConversational":[^,}]*' | grep -o 'true\|false')

if [ "$ENABLED" = "true" ] && [ "$ROLLOUT" = "100" ] && [ "$SHOULD_USE" = "true" ]; then
  echo "✅ Feature flags configuradas corretamente"
else
  echo "❌ Feature flags incorretas:"
  echo "   enabled: $ENABLED (esperado: true)"
  echo "   rollout: $ROLLOUT (esperado: 100)"
  echo "   shouldUse: $SHOULD_USE (esperado: true)"
  exit 1
fi

# 3. Vector store carregado?
VECTOR_COUNT=$(grep -a "Vector store ready" server.log 2>/dev/null | tail -1 | grep -o '[0-9]* embeddings' | grep -o '[0-9]*')
if [ ! -z "$VECTOR_COUNT" ]; then
  echo "✅ Vector store: $VECTOR_COUNT embeddings"
else
  echo "⚠️  Vector store ainda carregando..."
fi

echo ""
echo "🎉 Sistema pronto para teste!"
echo ""
echo "📱 Próximo passo:"
echo "   Envie 'oi' no WhatsApp para 5511910165356"
```

Salve como `check-system.sh` e execute:
```bash
chmod +x check-system.sh
./check-system.sh
```

---

## 📈 Métricas Esperadas

| Métrica | Valor Esperado |
|---------|----------------|
| Latência primeira resposta | < 3s |
| useConversational | true (100%) |
| Resposta natural (não quiz) | ✅ |
| Extração de preferências | Funcional |
| Recomendações | Baseadas em conversa |

---

## ✅ Checklist Final

Antes de considerar o teste bem-sucedido:

- [ ] Servidor rodando (porta 3000)
- [ ] Feature flags: enabled=true, rollout=100
- [ ] Vector store: 57 embeddings carregados
- [ ] Conversa resetada (cache + DB)
- [ ] Mensagem "oi" enviada no WhatsApp
- [ ] **Bot respondeu em modo conversacional (NÃO quiz)**
- [ ] Logs mostram "useConversational": true
- [ ] Conversa fluída e natural
- [ ] Perguntas respondidas corretamente
- [ ] Recomendações geradas baseadas na conversa

---

## 🎯 Status Atual

**Última verificação:** 2025-11-28 15:25  
**Status:** ✅ PRONTO PARA TESTE

**Ação necessária:**
1. ✅ Servidor rodando
2. ✅ Feature flags ativas (100%)
3. ✅ Conversas resetadas
4. ⏳ **AGUARDANDO:** Envio de "oi" no WhatsApp

**Logs para monitorar:**
```bash
tail -f /home/rafaelnovaes22/faciliauto-mvp-v2/server.log | grep -E "(Routing|Conversational)"
```

---

**Criado:** 2025-11-28 15:25  
**Servidor:** Operacional  
**Modo:** Conversacional (100%)  
**Pronto:** ✅ SIM
