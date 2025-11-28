# ✅ Status: Teste Local Pronto

**Data:** 2025-01-XX  
**Número de teste:** 5511910165356

---

## ✅ O que foi feito

### 1. Scripts de Reset ✅
- Script TypeScript criado: `scripts/reset-conversations.ts`
- Comandos funcionando:
  - `./run-local.sh reset 5511910165356` - Reset conversa específica
  - `./run-local.sh reset-all` - Reset todas as conversas

### 2. Conversas Antigas Resetadas ✅
- **3 conversas deletadas:**
  - 5511999999999 (quiz)
  - 5511777777777 (quiz)
  - 16315551181 (greeting)
- Banco limpo e pronto para novos testes

### 3. Modo Conversacional Ativado ✅
Arquivo `.env` atualizado com:
```bash
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"
```

### 4. Schema Prisma Ajustado ✅
- Alterado de PostgreSQL → SQLite (desenvolvimento local)
- Prisma Client regenerado
- Banco: `/home/rafaelnovaes22/faciliauto-mvp-v2/prisma/prisma/dev.db`

### 5. Script de Atalho Criado ✅
Arquivo: `run-local.sh`
- Usa Node.js correto: `/home/rafaelnovaes22/nodejs/bin/node`
- Comandos disponíveis: dev, reset, reset-all, prisma-studio, test

---

## 🚀 Próximos Passos

### 1. Iniciar o servidor

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
./run-local.sh dev
```

**O servidor irá:**
- Carregar variáveis do .env
- Conectar ao banco SQLite
- Carregar embeddings (28 veículos)
- Iniciar webhook na porta 3000
- **Modo conversacional ATIVO (100%)**

### 2. Enviar mensagem de teste no WhatsApp

Abrir WhatsApp e enviar para o número configurado:
```
oi
```

### 3. Comportamento esperado

**❌ NÃO deve aparecer (quiz antigo):**
```
🚗 Bem-vindo ao FaciliAuto!
Vou fazer 8 perguntas rápidas...

1️⃣ Qual o seu orçamento?
```

**✅ DEVE aparecer (conversacional novo):**
```
🚗 Olá! Sou o assistente da FaciliAuto, especialista em veículos usados.

Como posso ajudá-lo hoje? Posso:
• Recomendar veículos baseado no seu perfil
• Responder dúvidas sobre modelos
• Mostrar comparações
• Simular financiamentos

Me conte: o que você procura em um carro?
```

### 4. Testar fluxo completo

```
Você: Preciso de um carro SUV automático até 100 mil
Bot: [Resposta natural com recomendações]

Você: Me mostre fotos do primeiro
Bot: [Envia fotos e detalhes]

Você: Qual a diferença entre o primeiro e o segundo?
Bot: [Comparação detalhada]
```

---

## 📊 Monitoramento

### Logs em tempo real

Em outro terminal:
```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
tail -f server.log | grep -E "(Routing|Conversational|Error)"
```

### O que procurar nos logs

**✅ Sucesso (modo conversacional ativo):**
```
[INFO] Feature flag check: ENABLE_CONVERSATIONAL_MODE=true
[INFO] Rollout percentage: 100
[INFO] Routing decision: useConversational=true
[INFO] Conversational: processing message from 5511910165356
[INFO] PreferenceExtractor: extracting preferences
[INFO] VehicleExpert: generating response
[INFO] Conversational: message processed in 1234ms
```

**❌ Problema (modo quiz):**
```
[INFO] Routing decision: useConversational=false
[INFO] Quiz: processing message
```

Se isso aparecer, verificar:
```bash
cat .env | grep CONVERSATIONAL
# Deve mostrar:
# ENABLE_CONVERSATIONAL_MODE="true"
# CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"
```

---

## 🔧 Comandos Úteis

### Gerenciamento de conversas
```bash
# Ver todas as conversas no banco
./run-local.sh prisma-studio

# Resetar conversa específica
./run-local.sh reset 5511910165356

# Resetar todas as conversas
./run-local.sh reset-all
```

### Servidor
```bash
# Iniciar servidor
./run-local.sh dev

# Parar servidor
Ctrl+C

# Verificar se está rodando
ps aux | grep tsx | grep index
```

### Logs
```bash
# Logs completos
tail -f server.log

# Apenas decisões de roteamento
tail -f server.log | grep Routing

# Apenas modo conversacional
tail -f server.log | grep Conversational

# Apenas erros
tail -f server.log | grep Error
```

---

## 🆘 Troubleshooting

### Problema 1: Servidor não inicia

```bash
# Verificar porta 3000
lsof -i :3000

# Se ocupada, matar processo
kill -9 $(lsof -t -i:3000)

# Tentar novamente
./run-local.sh dev
```

### Problema 2: Bot responde no modo quiz

**Causa:** Feature flag não carregada

```bash
# Verificar .env
cat .env | grep CONVERSATIONAL

# Deve mostrar true e 100
# Se não, editar:
nano .env

# Reiniciar servidor
Ctrl+C
./run-local.sh dev
```

### Problema 3: Erro de banco de dados

```bash
# Regenerar Prisma Client
cd /home/rafaelnovaes22/faciliauto-mvp-v2
/home/rafaelnovaes22/nodejs/bin/node node_modules/.bin/prisma generate

# Verificar banco
/home/rafaelnovaes22/nodejs/bin/node node_modules/.bin/prisma db pull
```

### Problema 4: Embeddings não carregados

```bash
# Verificar se existem embeddings
cat .env | grep OPENAI_API_KEY

# Gerar embeddings (se necessário)
/home/rafaelnovaes22/nodejs/bin/node node_modules/.bin/tsx src/scripts/generate-embeddings.ts generate
```

---

## 📚 Arquivos Criados/Modificados

### Criados ✅
- `scripts/reset-conversations.ts` - Script de reset
- `run-local.sh` - Atalhos para comandos locais
- `RESET_PARA_CONVERSACIONAL.md` - Guia detalhado
- `QUICK_START_CONVERSACIONAL.md` - Quick start
- `STATUS_TESTE_LOCAL.md` - Este arquivo

### Modificados ✅
- `package.json` - Novos comandos npm
- `.env` - Feature flags ativadas
- `prisma/schema.prisma` - Provider: sqlite
- `/memories/faciliauto-whatsapp-project.md` - Status atualizado

---

## 🎯 Checklist de Validação

Antes de considerar o teste completo:

### Pré-teste
- [x] Conversas antigas resetadas (3 conversas)
- [x] Modo conversacional ativado (.env)
- [x] Schema Prisma ajustado (sqlite)
- [x] Scripts de reset testados
- [x] Documentação criada

### Teste
- [ ] Servidor iniciado sem erros
- [ ] Webhook respondendo (porta 3000)
- [ ] Mensagem "oi" enviada no WhatsApp
- [ ] Bot responde em modo conversacional (não quiz)
- [ ] Logs mostram `useConversational=true`
- [ ] Conversa fluída e natural

### Pós-teste
- [ ] Fluxo completo testado (discovery → recommendation)
- [ ] Perguntas respondidas corretamente
- [ ] Recomendações geradas
- [ ] Latência < 3s
- [ ] Sem erros críticos nos logs

---

## 🚀 Quando estiver tudo OK

1. **Commit das mudanças**
```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2
git add .
git commit -m "feat: activate conversational mode + reset scripts"
git push origin main
```

2. **Deploy para Railway (opcional)**
```bash
# Atualizar schema.prisma para PostgreSQL
# provider = "postgresql"

# Push para Railway
git push railway main

# Configurar variáveis no Railway:
railway variables set ENABLE_CONVERSATIONAL_MODE=true
railway variables set CONVERSATIONAL_ROLLOUT_PERCENTAGE=10  # Começar com 10%
```

3. **Monitorar rollout gradual**
- Dia 1-2: 10% (monitorar bugs)
- Dia 3-4: 50% (validar métricas)
- Dia 5+: 100% (rollout completo)

---

**Status:** ✅ PRONTO PARA TESTE LOCAL  
**Última atualização:** 2025-01-XX  
**Próxima ação:** Iniciar servidor com `./run-local.sh dev`
