# ✅ Post-Deploy Checklist - Sistema Conversacional

**Data do Deploy:** 2025-01-XX  
**Commit:** 017b70b  
**Status:** ✅ CÓDIGO NO REPOSITÓRIO

---

## 🎯 Situação Atual

✅ **Código implementado** (100%)  
✅ **Testes criados** (65+ testes)  
✅ **Documentação completa** (7 documentos)  
✅ **Build passando** (TypeScript compila)  
✅ **Commit feito** (020+ commits)  
✅ **Push para GitHub** (origin/main atualizado)

⏳ **Próximo:** Configurar variáveis e fazer deploy

---

## 📋 Próximos Passos

### FASE 1: Configurar Variáveis de Ambiente ⏳

#### No arquivo `.env` local

```bash
# Feature Flags - Iniciar DESABILITADO
ENABLE_CONVERSATIONAL_MODE="false"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="0"
```

#### No Railway (ou seu provedor)

**Ir para:** Railway Dashboard → Seu Projeto → Variables

**Adicionar:**
```bash
# Sistema Conversacional (DESABILITADO inicialmente)
ENABLE_CONVERSATIONAL_MODE=false
CONVERSATIONAL_ROLLOUT_PERCENTAGE=0
```

⚠️ **IMPORTANTE:** Começar com feature DESABILITADA em produção

---

### FASE 2: Deploy para Produção ⏳

```bash
# O código já está no main, Railway deve fazer deploy automático
# OU fazer deploy manual:
railway up
```

**Verificar logs:**
```bash
railway logs --tail

# Deve ver:
# ✅ Build successful
# ✅ Deployment started
# ✅ Service ready
```

---

### FASE 3: Verificação Pós-Deploy ⏳

#### 1. Verificar que Sistema Continua Funcionando

```bash
# Enviar mensagem de teste via WhatsApp
# Sistema deve usar QUIZ (modo legado)
```

**Logs esperados:**
```
"Routing decision" useConversational: false
"Processing with LangGraph (quiz mode)"
```

#### 2. Testar Feature Flag (Staging ou Teste)

```bash
# Em staging ou localmente:
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"

# Reiniciar servidor
npm run dev
```

**Enviar mensagem teste:**
```
Você: "Quero um SUV até 60 mil para 5 pessoas"
```

**Logs esperados:**
```
"Routing decision" useConversational: true
"Conversational: processing message"
"Conversational: message processed" canRecommend: false
```

#### 3. Verificar Métricas Baseline

Antes de ativar conversacional, capturar métricas atuais do quiz:

- ✅ Taxa de conclusão (% que chegam até recomendação)
- ✅ Tempo médio até recomendação
- ✅ Taxa de conversão (lead → test-drive)
- ✅ Custo médio por conversa

---

### FASE 4: Rollout Gradual 10% ⏳

**Quando:** Após 24-48h do deploy com feature desabilitada

#### 4.1 Ativar 10%

```bash
# Railway Dashboard → Variables
ENABLE_CONVERSATIONAL_MODE=true
CONVERSATIONAL_ROLLOUT_PERCENTAGE=10
```

#### 4.2 Monitorar 48h

**Logs para acompanhar:**
```bash
# Ver decisões de roteamento
railway logs | grep "Routing decision"

# Contar conversacional vs quiz
railway logs --since 1h | grep "useConversational: true" | wc -l
railway logs --since 1h | grep "useConversational: false" | wc -l

# Ver erros
railway logs | grep "Conversational: error"

# Ver tempo de processamento
railway logs | grep "processingTime"
```

**Métricas críticas:**
- Latência P95 < 4s ✅
- Taxa de erro < 2% ✅
- Taxa de conclusão > 75% ✅
- Nenhum erro crítico ✅

#### 4.3 Critérios para Continuar

- [ ] 48h de operação sem erros críticos
- [ ] Latência aceitável
- [ ] Taxa de conclusão ≥ quiz
- [ ] Feedback dos usuários (se disponível)

---

### FASE 5: Rollout 50% (A/B Testing) ⏳

**Quando:** Após 48h de 10% estável

```bash
CONVERSATIONAL_ROLLOUT_PERCENTAGE=50
```

**Comparar métricas:**
```
Quiz (50%):
- Tempo até recomendação: X min
- Taxa conversão: Y%
- Satisfação: Z

Conversacional (50%):
- Tempo até recomendação: X min
- Taxa conversão: Y%
- Satisfação: Z
```

**Objetivo:** Conversacional ≥ Quiz

---

### FASE 6: Rollout 100% ⏳

**Quando:** Após 48h de 50% com métricas positivas

```bash
CONVERSATIONAL_ROLLOUT_PERCENTAGE=100
```

**Monitorar por 1 semana:**
- Estabilidade geral
- Custos (não deve exceder +10%)
- Feedback de usuários
- Conversão para vendas

---

## 🚨 Plano de Rollback

### Se algo der errado

**Rollback Imediato (< 5 min):**
```bash
# Railway Dashboard → Variables
CONVERSATIONAL_ROLLOUT_PERCENTAGE=0

# OU desabilitar completamente
ENABLE_CONVERSATIONAL_MODE=false
```

**Quando fazer rollback:**
- ❌ Taxa de erro > 5%
- ❌ Latência P95 > 10s
- ❌ Sistema instável
- ❌ Usuários reclamando

**Rollback Parcial:**
```bash
# Reduzir de 50% para 10%
CONVERSATIONAL_ROLLOUT_PERCENTAGE=10
```

---

## 📊 Dashboard de Monitoramento

### Queries Úteis

```bash
# 1. Status da feature
railway logs | grep "Feature flag: conversational mode"

# 2. Distribuição de uso
railway logs --since 1h | grep "Routing decision" | \
  awk '{print $NF}' | sort | uniq -c

# 3. Latência média
railway logs --since 1h | grep "processingTime" | \
  awk '{print $NF}' | awk '{sum+=$1; count++} END {print sum/count}'

# 4. Taxa de erro
railway logs --since 1h | grep -c "Conversational: error"

# 5. Taxa de recomendação
railway logs --since 1h | grep "canRecommend: true" | wc -l
```

---

## 📝 Documentação de Referência

### Leitura Obrigatória

1. **FINAL_IMPLEMENTATION_REPORT.md** ⭐ (Relatório completo)
2. **README_CONVERSATIONAL.md** (Quick start)
3. **DEPLOY_CONVERSATIONAL.md** (Guia de deploy detalhado)

### Referência

4. **CONVERSATIONAL_SUMMARY.md** (Resumo executivo)
5. **INTEGRATION_GUIDE.md** (Detalhes técnicos)
6. **CONVERSATIONAL_IMPLEMENTATION_STATUS.md** (Status técnico)

---

## ✅ Checklist Final

### Antes de Ativar 10%

- [x] Código no repositório
- [x] Build passando
- [ ] Variáveis configuradas (DESABILITADO)
- [ ] Deploy em produção
- [ ] Sistema funcionando normalmente (quiz)
- [ ] Métricas baseline capturadas
- [ ] 24-48h de operação estável

### Para Ativar 10%

- [ ] Ler DEPLOY_CONVERSATIONAL.md
- [ ] Configurar ENABLE_CONVERSATIONAL_MODE=true
- [ ] Configurar CONVERSATIONAL_ROLLOUT_PERCENTAGE=10
- [ ] Iniciar monitoramento

### Para Ativar 50%

- [ ] 48h de 10% sem incidentes
- [ ] Métricas validadas
- [ ] Time alinhado

### Para Ativar 100%

- [ ] 48h de 50% com métricas positivas
- [ ] Conversão ≥ Quiz
- [ ] Feedback positivo

---

## 🎯 Métricas de Sucesso

### Performance
- Latência P50 < 2s ✅
- Latência P95 < 4s ✅
- Taxa de erro < 2% ✅

### UX
- Taxa de conclusão > 75% ✅
- Tempo até recomendação < quiz ✅
- Usuários fazem perguntas (> 30% conversas) ✅

### Business
- Conversão ≥ Quiz ✅
- NPS > 7/10 ✅
- Custo < $0.002/conversa ✅

---

## 📞 Suporte

**Problema durante deploy?**

1. Ver logs: `railway logs --tail`
2. Consultar: `DEPLOY_CONVERSATIONAL.md` (Troubleshooting)
3. Rollback: `CONVERSATIONAL_ROLLOUT_PERCENTAGE=0`

**Dúvidas sobre implementação?**

1. Ver: `FINAL_IMPLEMENTATION_REPORT.md`
2. Ver: `INTEGRATION_GUIDE.md`
3. Verificar testes: `tests/e2e/conversational-flow.e2e.test.ts`

---

## 🎉 Próximas Melhorias (Backlog)

Após 100% estável por 1 semana:

1. [ ] Implementar guardrails avançados (7 camadas)
2. [ ] Adicionar cache de recomendações (Redis)
3. [ ] Implementar analytics dashboard
4. [ ] Coletar feedback inline (thumbs up/down)
5. [ ] Ajustar prompts baseado em uso real
6. [ ] Remover código quiz (opcional)

---

**Status Atual:** ✅ **CÓDIGO PRONTO, AGUARDANDO DEPLOY**  
**Próximo Passo:** Configurar variáveis e fazer deploy com feature DESABILITADA  
**ETA para 10% rollout:** 24-48h após deploy inicial

---

_Atualizado em: 2025-01-XX_  
_Commit: 017b70b_
