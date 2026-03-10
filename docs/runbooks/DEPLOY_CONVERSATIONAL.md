# 🚀 Deploy do Sistema Conversacional - Guia Completo

**Status:** ✅ PRONTO PARA DEPLOY  
**Data:** 2025-01-XX

---

## ✅ Pré-requisitos

Antes de fazer o deploy, certifique-se que:

- [x] Código implementado e testado
- [x] Testes unitários passando (50+)
- [x] Testes E2E criados
- [x] Variáveis de ambiente configuradas
- [x] Feature flags implementadas
- [x] Documentação completa

---

## 🔧 Configuração Inicial

### 1. Variáveis de Ambiente

Adicione ao Railway (ou seu provedor):

```bash
# Feature Flags - Sistema Conversacional
ENABLE_CONVERSATIONAL_MODE="false"  # Iniciar desabilitado
CONVERSATIONAL_ROLLOUT_PERCENTAGE="0"  # 0% inicialmente

# LLMs (já configuradas, mas verifique)
OPENAI_API_KEY="sk-..."  # Obrigatória
GROQ_API_KEY="gsk-..."   # Fallback (opcional)
```

### 2. Verificar Dependências

```bash
# Verificar que todos os imports estão corretos
npm run build

# Rodar testes
npm test

# Rodar testes E2E
npm test tests/e2e/conversational-flow.e2e.test.ts
```

---

## 📦 Deploy para Staging

### Passo 1: Deploy do Código

```bash
# Fazer commit das mudanças
git add .
git commit -m "feat: implement conversational mode with gradual rollout"
git push origin main

# Deploy para staging
git push staging main
```

### Passo 2: Configurar Variáveis (Staging)

No Railway Dashboard (Staging):

```bash
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"  # 100% em staging para testar
NODE_ENV="staging"
```

### Passo 3: Testar em Staging

```bash
# 1. Verificar logs
railway logs --tail

# 2. Enviar mensagens de teste via WhatsApp
# Usar número de teste configurado

# 3. Verificar que conversacional está funcionando
# Procurar nos logs:
# "Routing decision" com "useConversational: true"
# "Conversational: processing message"
# "Conversational: message processed"
```

#### Checklist de Testes em Staging

- [ ] Conversa completa (discovery → recommendation) funciona
- [ ] Extração de preferências funciona
- [ ] Perguntas do usuário são respondidas
- [ ] Recomendações são geradas
- [ ] Latência < 3s
- [ ] Sem erros nos logs
- [ ] Feature flag funciona (testar 0%, 100%)

---

## 🚀 Deploy para Produção - Rollout Gradual

### Estratégia de Rollout

```
Dia 1-2:  10% (monitorar 48h)
  ↓ (se métricas OK)
Dia 3-4:  50% (monitorar 48h)
  ↓ (se métricas OK)
Dia 5+:   100% (remover quiz legado depois de 1 semana)
```

---

### FASE 1: Deploy 0% (Code Deploy)

**Objetivo:** Código em produção, mas feature desabilitada

#### 1.1 Deploy

```bash
git push production main
```

#### 1.2 Configurar Variáveis (Produção)

```bash
ENABLE_CONVERSATIONAL_MODE="false"  # Desabilitado inicialmente
CONVERSATIONAL_ROLLOUT_PERCENTAGE="0"
NODE_ENV="production"
```

#### 1.3 Verificar

```bash
# Logs devem mostrar:
# "useConversational: false" para todos usuários

railway logs --tail
```

**Duração:** 24-48h (verificar que sistema continua estável)

---

### FASE 2: Rollout 10%

**Objetivo:** 10% dos usuários usam conversacional

#### 2.1 Atualizar Feature Flag

No Railway Dashboard:

```bash
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="10"
```

#### 2.2 Monitorar Métricas (48h)

##### Logs para Buscar

```bash
# Ver decisões de roteamento
railway logs | grep "Routing decision"

# Ver erros conversacionais
railway logs | grep "Conversational: error"

# Ver tempo de processamento
railway logs | grep "message processed"
```

##### Métricas Críticas

- **Latência:** P50 < 2s, P95 < 4s
- **Taxa de erro:** < 2%
- **Taxa de conclusão:** > 75% (chegam até recomendação)
- **Custos LLM:** < $0.002 por conversa

##### Dashboard (Railway/CloudWatch)

```
# Criar queries customizadas
- Count: "useConversational: true" vs "false"
- Avg: processingTime (conversational vs quiz)
- Count: "Conversational: error"
```

#### 2.3 Critérios para Continuar

- [ ] Zero erros críticos
- [ ] Latência aceitável (< 4s P95)
- [ ] Feedback de usuários positivo (se disponível)
- [ ] Custos dentro do esperado
- [ ] 48h de operação estável

**Se algo der errado:** Rollback para 0% (ver seção Rollback)

---

### FASE 3: Rollout 50%

**Objetivo:** Metade dos usuários em conversacional

#### 3.1 Atualizar Feature Flag

```bash
CONVERSATIONAL_ROLLOUT_PERCENTAGE="50"
```

#### 3.2 Monitorar Métricas (48h)

Mesmas métricas da Fase 2, mas agora comparar:

##### A/B Testing Metrics

```
Quiz (50% usuários):
- Tempo médio até recomendação: X min
- Taxa de conversão: Y%
- Satisfação (NPS): Z

Conversacional (50% usuários):
- Tempo médio até recomendação: X min
- Taxa de conversão: Y%
- Satisfação (NPS): Z
```

##### Comparação Esperada

- Conversacional: -30% tempo até recomendação
- Conversacional: +15-20% conversão
- Conversacional: +10-15% satisfação

#### 3.3 Critérios para 100%

- [ ] 48h de 50% sem incidentes
- [ ] Conversional ≥ Quiz em conversão
- [ ] Custos validados
- [ ] Feedback positivo

---

### FASE 4: Rollout 100%

**Objetivo:** Todos usam conversacional

#### 4.1 Atualizar Feature Flag

```bash
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"
```

#### 4.2 Monitorar (1 semana)

- Continuar monitorando mesmas métricas
- Validar que não há regressões
- Coletar feedback de usuários

#### 4.3 Após 1 Semana Estável

Opcional: Remover código do quiz (legado)

```bash
# Desabilitar quiz completamente
ENABLE_QUIZ_LEGACY="false"  # Se implementar essa flag

# OU manter como fallback em caso de erros
# (recomendado por mais 1-2 meses)
```

---

## 🚨 Rollback Plan

### Rollback Imediato (< 5 minutos)

Se algo crítico acontecer:

```bash
# Railway Dashboard → Variables
CONVERSATIONAL_ROLLOUT_PERCENTAGE="0"

# OU desabilitar completamente
ENABLE_CONVERSATIONAL_MODE="false"
```

**Efeito:** Todos voltam para quiz imediatamente (próxima mensagem)

### Rollback Parcial

Se problema afetar apenas alguns usuários:

```bash
# Reduzir rollout
CONVERSATIONAL_ROLLOUT_PERCENTAGE="10"  # De 50% para 10%
```

### Quando Fazer Rollback

- ❌ Taxa de erro > 5%
- ❌ Latência P95 > 10s
- ❌ Usuários reclamando de bugs
- ❌ Custos 3x acima do esperado
- ❌ Sistema instável

---

## 📊 Dashboard de Monitoramento

### Queries Úteis (Railway Logs)

```bash
# 1. Contagem de decisões de roteamento
railway logs --since 1h | grep "Routing decision" | grep -c "useConversational: true"
railway logs --since 1h | grep "Routing decision" | grep -c "useConversational: false"

# 2. Erros conversacionais
railway logs --since 1h | grep "Conversational: error"

# 3. Tempo de processamento médio
railway logs --since 1h | grep "processingTime" | awk '{print $NF}'

# 4. Taxa de recomendação
railway logs --since 1h | grep "canRecommend: true" | wc -l

# 5. Preferências extraídas
railway logs --since 1h | grep "extractedFields"
```

### Métricas para Grafana/CloudWatch

```json
{
  "metrics": [
    "conversational.routing.decisions",
    "conversational.processing.time.p50",
    "conversational.processing.time.p95",
    "conversational.errors.count",
    "conversational.recommendations.count",
    "conversational.llm.tokens.used",
    "conversational.llm.cost"
  ]
}
```

---

## 🧪 Testes Finais Antes de 100%

### Checklist de Validação

#### Funcionalidade
- [ ] Conversa discovery → recommendation completa
- [ ] Extração de múltiplas preferências simultâneas
- [ ] Resposta a perguntas do usuário
- [ ] Geração de recomendações
- [ ] Formatação de recomendações legível

#### Performance
- [ ] Latência P50 < 2s
- [ ] Latência P95 < 4s
- [ ] Taxa de timeout < 1%

#### Qualidade
- [ ] Extração accuracy > 85%
- [ ] False positives < 5%
- [ ] Recomendações relevantes > 80%

#### Negócio
- [ ] Taxa de conclusão ≥ quiz
- [ ] Conversão ≥ quiz
- [ ] Custo < $0.002/conversa

---

## 📝 Comunicação

### Para o Time

**Antes do Deploy:**
```
📢 Deploy: Sistema Conversacional
Data: [DATA]
Horário: [HORÁRIO]
Impacto: Nenhum (feature flag desabilitada)
Rollback: Imediato via env var
```

**Durante Rollout (10%):**
```
📊 Rollout Fase 1: 10% usuários em modo conversacional
Monitorar: [LINK DASHBOARD]
Alertas: [SLACK CHANNEL]
Rollback: CONVERSATIONAL_ROLLOUT_PERCENTAGE="0"
```

**100% Completo:**
```
✅ Rollout Completo: 100% modo conversacional
Resultado: [MÉTRICAS]
Próximo: Remover quiz legado em 1 semana
```

---

## ❓ Troubleshooting

### Problema 1: Alta Latência

**Sintoma:** Respostas > 5s

**Debug:**
```bash
railway logs | grep "processingTime"
```

**Possíveis Causas:**
- LLM lento (OpenAI congestionado)
- Muitas chamadas LLM por mensagem
- Vector search lento

**Solução:**
- Verificar status OpenAI: https://status.openai.com
- Reduzir max_tokens nas chamadas
- Cache de respostas comuns

### Problema 2: Muitos Erros

**Sintoma:** Taxa de erro > 5%

**Debug:**
```bash
railway logs | grep "Conversational: error" -A 5
```

**Possíveis Causas:**
- LLM retornando formato inválido
- Timeout nas chamadas
- Embedding não carregado

**Solução:**
- Verificar exemplos de erros
- Adicionar retry logic
- Validar embeddings carregados

### Problema 3: Recomendações Ruins

**Sintoma:** Usuários reclamam de carros irrelevantes

**Debug:**
```bash
railway logs | grep "extractedFields" -A 3
railway logs | grep "recommendations_generated" -A 10
```

**Possíveis Causas:**
- Extração incorreta de preferências
- Match score mal calibrado
- Prompt do extractor mal configurado

**Solução:**
- Revisar prompt de extração
- Ajustar thresholds de confidence
- Calibrar pesos do match score

---

## 📚 Referências

- [CONVERSATIONAL_SUMMARY.md](./CONVERSATIONAL_SUMMARY.md)
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- [CONVERSATIONAL_IMPLEMENTATION_STATUS.md](./CONVERSATIONAL_IMPLEMENTATION_STATUS.md)

---

**Boa sorte com o deploy! 🚀**

Em caso de dúvidas ou problemas, consulte a documentação ou faça rollback imediato.
