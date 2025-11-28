# 🔧 Guia de Integração - Sistema Conversacional

**Para:** Próximo desenvolvedor que vai completar a integração  
**Tempo estimado:** 2-3 dias

---

## 📋 Checklist de Integração

### Fase 1: Preparação (30 min)
- [ ] Ler `CONVERSATIONAL_SUMMARY.md` (este resumo)
- [ ] Revisar `CONVERSATIONAL_EVOLUTION_PLAN.md` (plano completo)
- [ ] Entender arquitetura atual do orchestrator
- [ ] Configurar variáveis de ambiente de teste

### Fase 2: Integração Core (4-6 horas)
- [ ] Atualizar `ConversationOrchestrator` ou `message-handler-v2.service.ts`
- [ ] Adicionar lógica de roteamento (conversacional vs quiz)
- [ ] Criar/atualizar `ConversationContext` para novos usuários
- [ ] Sincronizar estado conversacional com graph state
- [ ] Testar manualmente com WhatsApp

### Fase 3: Testes (2-3 horas)
- [ ] Criar testes E2E do fluxo completo
- [ ] Testar rollout 0%, 50%, 100%
- [ ] Testar consistência (mesmo usuário = mesma versão)
- [ ] Validar que quiz legado ainda funciona

### Fase 4: Deploy Staging (1 hora)
- [ ] Deploy para staging
- [ ] Testar com números reais
- [ ] Validar logs e métricas
- [ ] Ajustar prompts se necessário

### Fase 5: Rollout Gradual (1 semana)
- [ ] Dia 1-2: 10% em produção
- [ ] Monitorar: latência, erros, conversão
- [ ] Dia 3-4: 50% se métricas OK
- [ ] Dia 5+: 100% se tudo estável

---

## 🔨 Passo a Passo: Integração

### 1. Entender o Fluxo Atual

Primeiro, identifique onde está o ponto de decisão do fluxo atual:

```bash
# Provavelmente em um destes arquivos:
src/services/message-handler-v2.service.ts
src/agents/orchestrator.agent.ts
src/graph/conversation-graph.ts
```

**Procure por:**
- Onde `QuizAgent` é chamado
- Onde o estado da conversa é gerenciado
- Como mensagens do usuário são processadas

### 2. Adicionar Roteamento

Adicione a lógica de decisão no ponto de entrada:

```typescript
// src/services/message-handler-v2.service.ts (ou equivalente)

import { featureFlags } from '../lib/feature-flags';
import { vehicleExpert } from '../agents/vehicle-expert.agent';
import { quizAgent } from '../agents/quiz.agent';
import { ConversationContext, ConversationMode } from '../types/conversation.types';

async function handleMessage(phoneNumber: string, message: string, state: any) {
  // Decisão: conversacional ou quiz?
  const useConversational = featureFlags.shouldUseConversationalMode(phoneNumber);
  
  logger.info({ 
    phoneNumber: phoneNumber.substring(0, 8) + '****', 
    useConversational 
  }, 'Routing decision');
  
  if (useConversational) {
    return await handleConversationalMode(phoneNumber, message, state);
  } else {
    return await handleQuizMode(phoneNumber, message, state);
  }
}
```

### 3. Implementar Handler Conversacional

Crie a função que usa o `VehicleExpertAgent`:

```typescript
async function handleConversationalMode(
  phoneNumber: string,
  message: string,
  state: any
): Promise<string> {
  // 1. Criar ou recuperar contexto conversacional
  const context: ConversationContext = buildConversationContext(state, phoneNumber);
  
  // 2. Chamar VehicleExpert
  const response = await vehicleExpert.chat(message, context);
  
  // 3. Atualizar estado com novas preferências
  state.profile = {
    ...state.profile,
    ...response.extractedPreferences
  };
  
  // 4. Atualizar modo conversacional
  if (response.nextMode) {
    state.mode = response.nextMode;
  }
  
  // 5. Adicionar mensagem ao histórico
  state.messages = state.messages || [];
  state.messages.push(
    { role: 'user', content: message, timestamp: new Date() },
    { role: 'assistant', content: response.response, timestamp: new Date() }
  );
  
  // 6. Atualizar metadata
  state.metadata = state.metadata || {};
  state.metadata.messageCount = (state.metadata.messageCount || 0) + 1;
  state.metadata.lastMessageAt = new Date();
  
  // 7. Se recomendações foram geradas, salvar
  if (response.recommendations) {
    state.recommendations = response.recommendations;
  }
  
  // 8. Retornar resposta para enviar ao usuário
  return response.response;
}
```

### 4. Implementar Função de Contexto

Crie função helper para montar o contexto:

```typescript
function buildConversationContext(
  state: any,
  phoneNumber: string
): ConversationContext {
  // Se já existe contexto, use
  if (state.conversationContext) {
    return state.conversationContext;
  }
  
  // Senão, crie novo
  return {
    conversationId: state.conversationId || generateId(),
    phoneNumber,
    mode: (state.mode as ConversationMode) || 'discovery',
    profile: state.profile || {},
    messages: state.messages || [],
    metadata: {
      startedAt: state.metadata?.startedAt || new Date(),
      lastMessageAt: new Date(),
      messageCount: state.metadata?.messageCount || 0,
      extractionCount: 0,
      questionsAsked: 0,
      userQuestions: 0
    }
  };
}
```

### 5. Manter Handler Legado (Quiz)

Garanta que o quiz ainda funciona:

```typescript
async function handleQuizMode(
  phoneNumber: string,
  message: string,
  state: any
): Promise<string> {
  // Implementação atual do quiz
  // NÃO MUDAR - apenas garantir que ainda funciona
  const response = await quizAgent.processAnswer(
    message,
    state.quiz?.currentQuestion || 0,
    state.quiz?.answers || {}
  );
  
  // Atualizar estado do quiz
  state.quiz = {
    currentQuestion: state.quiz?.currentQuestion + 1 || 1,
    answers: response.answers,
    isComplete: response.isComplete
  };
  
  return response.response;
}
```

### 6. Adicionar Logs Detalhados

Para debugging e monitoramento:

```typescript
logger.info({
  phoneNumber: phoneNumber.substring(0, 8) + '****',
  mode: useConversational ? 'conversational' : 'quiz',
  messageCount: state.metadata?.messageCount,
  profileKeys: Object.keys(state.profile || {}),
  canRecommend: response.canRecommend,
  processingTime: response.metadata?.processingTime
}, 'Message processed');
```

---

## 🧪 Testes E2E

Crie arquivo `tests/e2e/conversational-flow.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { vehicleExpert } from '../../src/agents/vehicle-expert.agent';
import { ConversationContext } from '../../src/types/conversation.types';

describe('Conversational Flow E2E', () => {
  it('should complete full conversation from discovery to recommendation', async () => {
    // Mensagem 1: Início
    let context = createInitialContext();
    let response = await vehicleExpert.chat('Oi, quero comprar um carro', context);
    
    expect(response.response).toBeTruthy();
    expect(response.canRecommend).toBe(false);
    
    // Atualizar contexto
    context = updateContext(context, response);
    
    // Mensagem 2: Fornecer informações
    response = await vehicleExpert.chat('Quero um SUV até 60 mil para viagens', context);
    
    expect(response.extractedPreferences.bodyType).toBe('suv');
    expect(response.extractedPreferences.budget).toBe(60000);
    expect(response.extractedPreferences.usage).toBe('viagem');
    
    // Atualizar contexto
    context = updateContext(context, response);
    
    // Mensagem 3: Mais informações
    response = await vehicleExpert.chat('Para 5 pessoas', context);
    
    expect(response.extractedPreferences.people).toBe(5);
    
    // Atualizar contexto
    context = updateContext(context, response);
    
    // Mensagem 4: Pedir recomendações
    response = await vehicleExpert.chat('Me mostra os carros', context);
    
    expect(response.canRecommend).toBe(true);
    expect(response.recommendations).toBeDefined();
    expect(response.recommendations.length).toBeGreaterThan(0);
  });
  
  it('should handle user questions during conversation', async () => {
    const context = createInitialContext();
    
    const response = await vehicleExpert.chat(
      'Qual a diferença entre SUV e sedan?',
      context
    );
    
    expect(response.canRecommend).toBe(false);
    expect(response.response).toMatch(/SUV/i);
    expect(response.response).toMatch(/sedan/i);
    expect(response.response.length).toBeGreaterThan(100);
  });
});
```

---

## 🚀 Deploy e Rollout

### Staging
```bash
# 1. Deploy para staging
git push staging main

# 2. Configurar env vars no Railway
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"  # 100% em staging

# 3. Testar com números reais
# Enviar mensagens via WhatsApp para staging
```

### Produção - Rollout Gradual

**Dia 1-2: 10%**
```bash
# Railway Dashboard → Variables
ENABLE_CONVERSATIONAL_MODE="true"
CONVERSATIONAL_ROLLOUT_PERCENTAGE="10"

# Monitorar:
- Logs de erro
- Latência média
- Taxa de conclusão
- Feedback de usuários (se disponível)
```

**Dia 3-4: 50%**
```bash
# Se métricas OK após 48h:
CONVERSATIONAL_ROLLOUT_PERCENTAGE="50"

# Monitorar:
- Conversão (lead → test-drive)
- Tempo médio de conversa
- Taxa de erro LLM
```

**Dia 5+: 100%**
```bash
# Se métricas OK após 48h:
CONVERSATIONAL_ROLLOUT_PERCENTAGE="100"

# Desativar quiz (opcional, após 1 semana):
# ENABLE_QUIZ_LEGACY="false"
```

---

## 📊 Métricas para Monitorar

### Logs Importantes
```typescript
// Adicionar nos pontos chave:
logger.info({ 
  event: 'conversation_started',
  phoneNumber: '****',
  mode: 'conversational' 
});

logger.info({ 
  event: 'preferences_extracted',
  fieldsExtracted: ['budget', 'usage'],
  confidence: 0.95 
});

logger.info({ 
  event: 'recommendations_generated',
  count: 3,
  matchScores: [95, 92, 88] 
});

logger.error({ 
  event: 'llm_error',
  error: err.message 
});
```

### Dashboard (Railway / CloudWatch)
- **Latência:** P50, P95, P99
- **Erros:** Taxa de erro por tipo
- **Conversões:** % que chegam até recomendação
- **Custos:** Tokens usados por conversa

---

## 🐛 Troubleshooting

### Problema 1: LLM não extrai preferências
**Sintomas:** `extracted = {}`  
**Debug:** 
```typescript
console.log('Message:', message);
console.log('LLM Response:', llmResponse);
console.log('Parsed:', parsed);
```
**Solução:** Ajustar prompt de extração

### Problema 2: Conversas muito longas
**Sintomas:** > 10 mensagens sem recomendação  
**Debug:**
```typescript
console.log('Profile:', context.profile);
console.log('Missing:', readiness.missingRequired);
console.log('Message count:', context.metadata.messageCount);
```
**Solução:** Reduzir campos obrigatórios ou forçar após 8 msgs

### Problema 3: Rollout inconsistente
**Sintomas:** Mesmo usuário alterna entre modos  
**Debug:**
```typescript
const hash = featureFlags.simpleHash(phoneNumber);
console.log('Hash:', hash, 'Bucket:', hash % 100);
```
**Solução:** Verificar se phoneNumber está normalizado

### Problema 4: Erro ao buscar veículos
**Sintomas:** `recommendations = []`  
**Debug:**
```typescript
console.log('Search query:', query);
console.log('Filters:', filters);
console.log('Vector search results:', results);
```
**Solução:** Verificar se embeddings estão carregados

---

## ✅ Checklist Final

Antes de marcar como completo:

- [ ] Conversacional funciona end-to-end
- [ ] Quiz legado ainda funciona (fallback)
- [ ] Feature flag controla rollout
- [ ] Testes E2E passando
- [ ] Logs detalhados implementados
- [ ] Testado em staging
- [ ] Documentação atualizada
- [ ] Time treinado

---

## 📚 Referências

- `CONVERSATIONAL_SUMMARY.md` - Resumo executivo
- `CONVERSATIONAL_EVOLUTION_PLAN.md` - Plano completo
- `CONVERSATIONAL_IMPLEMENTATION_STATUS.md` - Status detalhado
- `src/agents/vehicle-expert.agent.ts` - Código do agente
- `src/agents/preference-extractor.agent.ts` - Código do extrator
- `tests/agents/` - Testes de referência

---

**Boa sorte! 🚀**  
Em caso de dúvidas, consulte a documentação ou código existente.
