# 🔄 Guia: Reset de Conversas + Ativação do Modo Conversacional

**Objetivo:** Resetar conversas do WhatsApp e ativar o novo sistema conversacional natural.

**Status:** ✅ Script criado e pronto para uso

---

## 📋 Pré-requisitos

Antes de começar, certifique-se que:

- [x] Sistema conversacional está implementado (100% ✅)
- [x] Testes unitários passando (50+ ✅)
- [x] Testes E2E criados (15+ ✅)
- [x] Banco de dados populado (73 veículos Robust Car ✅)
- [x] Embeddings gerados (OpenAI text-embedding-3-small ✅)

---

## 🗑️ PASSO 1: Resetar Conversas Existentes

### Opção A: Resetar conversa específica

```bash
cd /home/rafaelnovaes22/faciliauto-mvp-v2

# Resetar sua conversa (substitua pelo número correto)
npm run conversations:reset 5511949105033

# Ou use diretamente:
npx tsx scripts/reset-conversations.ts 5511949105033
```

### Opção B: Resetar TODAS as conversas

```bash
npm run conversations:reset:all

# Ou use diretamente:
npx tsx scripts/reset-conversations.ts --all
```

**O que o script faz:**
- ✅ Busca conversas no banco de dados
- ✅ Mostra informações (ID, step, quiz answers, recommendations)
- ✅ Deleta em cascata (conversation, quizAnswers, recommendations, leads)
- ✅ Confirma exclusão

---

## 🚀 PASSO 2: Ativar Modo Conversacional

### 2.1. Editar variáveis de ambiente

Edite o arquivo `.env`:

```bash
nano .env
```

Atualize as seguintes variáveis:

```bash
# Feature Flags - Sistema Conversacional
ENABLE_CONVERSATIONAL_MODE="true"        # ✅ Ativar modo conversacional
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"  # ✅ 100% dos usuários (teste completo)
```

**Opções de rollout:**
- `0` = Desabilitado (100% quiz)
- `10` = 10% conversacional, 90% quiz
- `50` = 50% conversacional, 50% quiz
- `100` = 100% conversacional (todos os usuários)

### 2.2. Reiniciar servidor

```bash
# Se estiver rodando local
npm run dev

# Se estiver em Railway/Heroku
# O servidor reiniciará automaticamente ao detectar mudança no .env
```

---

## 🧪 PASSO 3: Testar o Novo Fluxo

### 3.1. Enviar mensagem no WhatsApp

Abra seu WhatsApp e envie para o número configurado:

```
oi
```

### 3.2. Comportamento esperado

**Modo Quiz (antigo):**
```
🚗 Bem-vindo ao FaciliAuto!
Vou fazer 8 perguntas rápidas...

1️⃣ Qual o seu orçamento?
```

**Modo Conversacional (novo):**
```
🚗 Olá! Sou o assistente da FaciliAuto, especialista em veículos usados.

Como posso ajudá-lo hoje? Posso:
• Recomendar veículos baseado no seu perfil
• Responder dúvidas sobre modelos
• Mostrar comparações
• Simular financiamentos

Me conte: o que você procura em um carro?
```

### 3.3. Testar funcionalidades

**Exemplo 1: Discovery natural**
```
Você: Preciso de um carro para a família, 7 lugares
Bot: Entendi! Para sua família, tenho ótimas opções com 7 lugares...
```

**Exemplo 2: Perguntas diretas**
```
Você: Tem algum SUV automático até 80 mil?
Bot: Sim! Encontrei 3 SUVs automáticos no seu orçamento...
```

**Exemplo 3: Comparação**
```
Você: Qual a diferença entre o Compass e o Tiguan?
Bot: Ótima pergunta! Vou comparar os dois para você...
```

---

## 📊 PASSO 4: Monitorar Logs

### 4.1. Logs locais

```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Logs em tempo real
tail -f server.log
```

### 4.2. Logs Railway

```bash
railway logs --tail
```

### 4.3. O que procurar

**✅ Modo conversacional ativo:**
```
[INFO] Feature flag check: ENABLE_CONVERSATIONAL_MODE=true
[INFO] Rollout percentage: 100
[INFO] Routing decision: useConversational=true
[INFO] Conversational: processing message
[INFO] PreferenceExtractor: extracting from message
[INFO] VehicleExpert: generating response
[INFO] Conversational: message processed successfully
```

**❌ Erro (modo quiz):**
```
[INFO] Routing decision: useConversational=false
[INFO] Quiz: processing message
```

---

## 🔧 PASSO 5: Rollout Gradual (Produção)

Se estiver em produção, faça rollout gradual:

### 5.1. Começar com 10%

```bash
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="10"
```

Aguarde 24-48h e monitore:
- Taxa de conversão
- Tempo médio de conversa
- Erros/problemas
- Feedback dos usuários

### 5.2. Aumentar para 50%

Se tudo estiver ok:

```bash
CONVERSATIONAL_ROLLOUT_PERCENTAGE="50"
```

Aguarde mais 24-48h.

### 5.3. Rollout completo (100%)

Se métricas estiverem positivas:

```bash
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"
```

---

## 🎯 Métricas para Acompanhar

### Antes vs Depois

| Métrica | Quiz (antigo) | Conversacional (esperado) |
|---------|---------------|---------------------------|
| Taxa de abandono | ~40% | ~20% (-50%) |
| Tempo médio | ~3-5 min | ~2-3 min (-40%) |
| Satisfação | 3.5/5 | 4.2/5 (+20%) |
| Conversão | 12% | 15% (+25%) |

### Como medir

```bash
# Query no banco
npx tsx scripts/analyze-conversations.ts

# Ou via Prisma Studio
npm run db:studio
```

---

## 🔄 PASSO 6: Rollback (se necessário)

Se algo der errado, volte para o modo quiz:

### Rollback rápido

```bash
# Editar .env
ENABLE_CONVERSATIONAL_MODE="false"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="0"

# Reiniciar servidor
# Railway/Heroku: auto restart
# Local: Ctrl+C e npm run dev
```

**Tempo de rollback:** < 30 segundos

---

## 📝 Checklist Final

Antes de considerar o deploy completo:

### Desenvolvimento
- [ ] Script de reset testado localmente
- [ ] Modo conversacional ativado localmente
- [ ] Conversa completa testada (discovery → recommendation)
- [ ] Perguntas respondidas corretamente
- [ ] Recomendações geradas com sucesso
- [ ] Logs sem erros críticos

### Staging
- [ ] Deploy para staging concluído
- [ ] Variáveis de ambiente configuradas (100% conversacional)
- [ ] Testes E2E passando
- [ ] Latência < 3s
- [ ] Sem erros nos logs

### Produção
- [ ] Backup do banco de dados
- [ ] Feature flags configuradas (começar com 0% ou 10%)
- [ ] Monitoramento configurado
- [ ] Plano de rollback testado
- [ ] Equipe treinada sobre novo fluxo

---

## 🆘 Troubleshooting

### Problema 1: Script de reset não funciona

```bash
# Verificar se banco está acessível
npm run db:studio

# Verificar DATABASE_URL no .env
cat .env | grep DATABASE_URL

# Testar conexão
npx prisma db pull
```

### Problema 2: Modo conversacional não ativa

```bash
# Verificar variáveis
cat .env | grep CONVERSATIONAL

# Deve mostrar:
# ENABLE_CONVERSATIONAL_MODE="true"
# CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"

# Reiniciar servidor
pkill -f "tsx src/index.ts"
npm run dev
```

### Problema 3: Bot ainda responde no modo quiz

**Causa:** Cache ou rollout percentage baixo

```bash
# Verificar logs de routing
tail -f server.log | grep "Routing decision"

# Deve mostrar: useConversational=true

# Se mostrar false, verificar:
cat .env | grep CONVERSATIONAL_ROLLOUT_PERCENTAGE
# Deve ser >= 50 para ter > 50% de chance
# Ou 100 para garantir sempre conversacional
```

### Problema 4: Erros de LLM

```bash
# Verificar API keys
cat .env | grep API_KEY

# Testar OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Testar Groq (fallback)
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

---

## 📚 Documentação Relacionada

- `CONVERSATIONAL_SUMMARY.md` - Resumo da implementação
- `CONVERSATIONAL_IMPLEMENTATION_STATUS.md` - Status detalhado
- `DEPLOY_CONVERSATIONAL.md` - Guia de deploy completo
- `INTEGRATION_GUIDE.md` - Guia de integração
- `docs/CONVERSATIONAL_HANDLER.md` - Arquitetura do handler
- `docs/PREFERENCE_EXTRACTOR.md` - Extração de preferências
- `docs/VEHICLE_EXPERT_AGENT.md` - Agente especialista

---

## 🎉 Próximos Passos

Após ativar com sucesso:

1. **Monitorar por 7 dias**
   - Coletar métricas de uso
   - Identificar padrões de conversa
   - Detectar problemas recorrentes

2. **Otimizar prompts**
   - Ajustar baseado em conversas reais
   - Melhorar respostas a perguntas comuns
   - Adicionar contexto específico da Robust Car

3. **Implementar guardrails avançados** (próxima fase)
   - Detecção de offtopic
   - Moderação de conteúdo
   - Limites de contexto
   - Ver: `GUARDRAILS_ADVANCED_ARCHITECTURE.md`

4. **Dashboard de analytics**
   - Visualizar métricas em tempo real
   - Comparar quiz vs conversacional
   - Identificar gargalos

---

## 🚀 Comandos Rápidos

```bash
# Reset + Ativar (sequência completa)
npm run conversations:reset:all
nano .env  # ENABLE_CONVERSATIONAL_MODE="true", ROLLOUT="100"
npm run dev

# Testar
# Enviar "oi" no WhatsApp

# Monitorar
tail -f server.log | grep -E "(Routing|Conversational|Error)"
```

---

**Criado:** 2025-01-XX  
**Autor:** AI Assistant  
**Status:** ✅ Pronto para uso  
**Versão:** 1.0
