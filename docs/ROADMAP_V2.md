# 🗺️ Roadmap FaciliAuto v2.0 - Arquitetura Avançada

**Objetivo:** Transformar o MVP em um sistema robusto com LangGraph, Banco Vetorial e Guardrails completos

---

## 📊 STATUS ATUAL

### ✅ Implementado (MVP v1.0)
- [x] Backend Express + TypeScript
- [x] SQLite + Prisma ORM
- [x] 3 Agentes IA (Orchestrator, Quiz, Recommendation)
- [x] 30 veículos no catálogo
- [x] API REST para testes
- [x] **Guardrails básicos** 🛡️ (97.1% cobertura)
  - Input validation
  - Output filtering
  - Rate limiting
  - Prompt injection detection
  - Content moderation

### ⚠️ Problemas Identificados
- [ ] Quiz perde contexto (cache vs banco)
- [ ] WhatsApp não conecta (ambiente WSL)
- [ ] Fluxo de conversa rígido (switch/case)
- [ ] Sem memória de longo prazo
- [ ] Busca de veículos não é semântica

---

## 🎯 FASE 1: Correções Críticas (Prioridade ALTA)

**Tempo estimado:** 2-3 horas  
**Status:** 🔴 Pendente

### 1.1 Corrigir Bug do Quiz ✅
**Tempo:** 1h  
**Complexidade:** Média

**Tarefa:**
- [x] Analisar message-handler.service.ts
- [x] Sincronizar cache com banco de dados
- [x] Garantir currentStep sempre atualizado
- [ ] Testar fluxo completo end-to-end
- [ ] Validar com múltiplos usuários simultâneos

**Arquivo:** `src/services/message-handler.service.ts`

### 1.2 Melhorar Guardrails 🛡️
**Tempo:** 30 min  
**Complexidade:** Baixa

**Tarefa:**
- [x] Implementar GuardrailsService
- [x] Input validation (comprimento, injection)
- [x] Output filtering (leaks, conteúdo)
- [x] Rate limiting (10 msg/min)
- [x] Testes automatizados (97.1%)
- [ ] Adicionar detecção de idioma
- [ ] Melhorar sanitização de HTML
- [ ] Logging de tentativas de ataque

**Arquivos:** 
- `src/services/guardrails.service.ts` ✅
- `src/test-guardrails.ts` ✅

### 1.3 WhatsApp Connection
**Tempo:** 1h  
**Complexidade:** Alta

**Opções:**
- **A)** Configurar Xvfb no WSL
- **B)** Deploy em servidor Linux (Railway/Heroku)
- **C)** Usar WhatsApp Business API oficial

**Decisão:** Postergar para deploy (Fase 4)

---

## 🚀 FASE 2: LangGraph Implementation (Prioridade ALTA)

**Tempo estimado:** 4-6 horas  
**Status:** 🔴 Planejado

### 2.1 Setup LangGraph
**Tempo:** 1h  
**Complexidade:** Média

**Instalar dependências:**
```bash
npm install @langchain/core @langchain/openai langgraph
npm install @langchain/community  # Para integrações extras
```

**Tarefa:**
- [ ] Instalar LangGraph + LangChain
- [ ] Configurar StateGraph
- [ ] Definir TypeScript types para State
- [ ] Criar checkpointer (SQLite)

**Arquivo novo:** `src/lib/langgraph.ts`

### 2.2 Definir State Schema
**Tempo:** 30 min  
**Complexidade:** Baixa

**State do bot:**
```typescript
interface ConversationState {
  // Identificação
  conversationId: string;
  phoneNumber: string;
  
  // Mensagens
  messages: Message[];
  
  // Quiz
  quizProgress: number;
  quizAnswers: Record<string, any>;
  
  // Perfil do cliente
  profile: {
    budget: number;
    usage: string;
    people: number;
    hasTradeIn: boolean;
    minYear: number;
    maxKm: number;
    vehicleType: string;
    urgency: string;
  };
  
  // Recomendações
  recommendations: Recommendation[];
  
  // Contexto
  currentNode: string;
  metadata: Record<string, any>;
}
```

**Arquivo novo:** `src/types/langgraph.types.ts`

### 2.3 Criar Nodes do Grafo
**Tempo:** 2h  
**Complexidade:** Alta

**Nodes:**

1. **GreetingNode** - Saudação inicial
2. **IntentClassificationNode** - Classifica intenção
3. **QuizNode** - 8 perguntas de qualificação
4. **VectorSearchNode** - Busca semântica de veículos
5. **RecommendationNode** - Gera top 3 com match score
6. **SchedulingNode** - Agendamento de visita
7. **HandoffNode** - Transfere para humano
8. **ErrorNode** - Tratamento de erros

**Edges condicionais:**
- Greeting → IntentClassification
- IntentClassification → Quiz | Handoff | VectorSearch
- Quiz → (loop até completar) → VectorSearch
- VectorSearch → Recommendation
- Recommendation → Scheduling | VectorSearch | Handoff

**Arquivo novo:** `src/graph/nodes/`

### 2.4 Implementar Graph Executor
**Tempo:** 1h  
**Complexidade:** Média

**Tarefa:**
- [ ] Criar StateGraph
- [ ] Adicionar todos os nodes
- [ ] Configurar edges condicionais
- [ ] Implementar checkpointer SQLite
- [ ] Integrar com MessageHandler

**Arquivo novo:** `src/graph/conversation-graph.ts`

**Exemplo:**
```typescript
import { StateGraph } from "langgraph";

const graph = new StateGraph<ConversationState>({
  channels: {
    messages: { reducer: messagesReducer },
    quizProgress: { default: () => 0 },
    // ...
  }
});

// Add nodes
graph.addNode("greeting", greetingNode);
graph.addNode("quiz", quizNode);
graph.addNode("vectorSearch", vectorSearchNode);
// ...

// Add edges
graph.addEdge("greeting", "intentClassification");
graph.addConditionalEdges("intentClassification", routeIntent);
// ...

// Compile
export const conversationGraph = graph.compile({
  checkpointer: new SqliteSaver("checkpoints.db")
});
```

### 2.5 Migrar Agentes para Nodes
**Tempo:** 1h  
**Complexidade:** Média

**Tarefa:**
- [ ] Refatorar OrchestratorAgent → IntentClassificationNode
- [ ] Refatorar QuizAgent → QuizNode
- [ ] Refatorar RecommendationAgent → RecommendationNode
- [ ] Manter compatibilidade backwards

**Arquivos modificados:**
- `src/agents/*.agent.ts` → `src/graph/nodes/*.node.ts`

---

## 💾 FASE 3: Banco Vetorial (Prioridade ALTA)

**Tempo estimado:** 3-4 horas  
**Status:** 🔴 Planejado

### 3.1 Escolher Banco Vetorial
**Tempo:** 30 min  
**Decisão:** ChromaDB (local, fácil) ou Qdrant (produção)

**Comparação:**

| Feature | ChromaDB | Qdrant | Pinecone |
|---------|----------|--------|----------|
| **Local** | ✅ Sim | ✅ Sim | ❌ Cloud only |
| **Custo** | 🟢 Grátis | 🟢 Grátis | 🟡 $70/mês |
| **Setup** | 🟢 Fácil | 🟡 Médio | 🟢 Fácil |
| **Performance** | 🟡 Bom | 🟢 Ótimo | 🟢 Ótimo |
| **Produção** | 🟡 Limitado | 🟢 Sim | 🟢 Sim |

**Recomendação:** 
- **MVP:** ChromaDB (desenvolvimento local)
- **Produção:** Qdrant (self-hosted ou cloud)

### 3.2 Setup ChromaDB
**Tempo:** 30 min  
**Complexidade:** Baixa

**Instalar:**
```bash
npm install chromadb
npm install @langchain/community  # Para ChromaDB integration
```

**Tarefa:**
- [ ] Instalar ChromaDB
- [ ] Criar coleção "vehicles"
- [ ] Criar coleção "conversations"
- [ ] Configurar client

**Arquivo novo:** `src/lib/vector-db.ts`

### 3.3 Criar Embeddings dos Veículos
**Tempo:** 1h  
**Complexidade:** Média

**Tarefa:**
- [ ] Gerar descrições textuais dos veículos
- [ ] Criar embeddings com OpenAI (text-embedding-3-small)
- [ ] Indexar no ChromaDB
- [ ] Adicionar metadata (preço, ano, marca, etc)

**Estrutura do documento:**
```typescript
{
  id: "vehicle-123",
  embedding: [0.123, 0.456, ...],  // 1536 dimensions
  text: "Honda Civic 2020, Sedan, 30.000 km, R$ 75.000, 
         Cor Prata, Automático, Completo, Econômico, 
         Ideal para cidade e viagens, 5 passageiros",
  metadata: {
    vehicleId: 123,
    brand: "Honda",
    model: "Civic",
    year: 2020,
    price: 75000,
    km: 30000,
    type: "sedan",
    fuel: "flex",
    transmission: "automatic"
  }
}
```

**Arquivo novo:** `src/scripts/generate-embeddings.ts`

### 3.4 Implementar Busca Semântica
**Tempo:** 1h  
**Complexidade:** Média

**Tarefa:**
- [ ] Criar VectorSearchService
- [ ] Converter perfil do cliente em query embedding
- [ ] Buscar top K veículos similares (K=10)
- [ ] Filtrar por metadados (preço, ano, km)
- [ ] Rankear com hybrid score (semântica + filtros)

**Query example:**
```typescript
const profile = {
  budget: 50000,
  usage: "cidade",
  people: 5,
  urgency: "1 mês"
};

// Gerar query text
const queryText = `
  Procuro um carro até R$ 50.000, 
  para uso na cidade, 
  que caiba 5 pessoas confortavelmente, 
  econômico e confiável
`;

// Buscar
const results = await vectorSearch.search(queryText, {
  filters: {
    price: { $lte: 55000 },  // +10% tolerância
    year: { $gte: 2018 },
    km: { $lte: 80000 }
  },
  topK: 10
});
```

**Arquivo novo:** `src/services/vector-search.service.ts`

### 3.5 Memória de Conversação
**Tempo:** 1h  
**Complexidade:** Média

**Tarefa:**
- [ ] Armazenar histórico de conversas no ChromaDB
- [ ] Buscar conversas similares do mesmo usuário
- [ ] RAG sobre conversas passadas
- [ ] Personalização baseada em histórico

**Use case:**
- Cliente volta depois de 1 mês
- Bot lembra preferências anteriores
- Sugere veículos similares aos que demonstrou interesse

**Arquivo novo:** `src/services/conversation-memory.service.ts`

---

## 🔐 FASE 4: Guardrails Avançados (Prioridade MÉDIA)

**Tempo estimado:** 2-3 horas  
**Status:** 🟡 Parcialmente implementado

### 4.1 Guardrails para LLM Outputs
**Tempo:** 1h  
**Complexidade:** Média

**Biblioteca:** NeMo Guardrails ou LangChain Guardrails

**Instalar:**
```bash
npm install @langchain/community
```

**Implementar:**
- [ ] Topic rails - Manter conversa sobre carros
- [ ] Fact checking - Verificar informações de veículos
- [ ] Tone moderation - Tom profissional
- [ ] Hallucination detection - Não inventar dados

**Arquivo novo:** `src/services/llm-guardrails.service.ts`

### 4.2 Monitoring & Alertas
**Tempo:** 1h  
**Complexidade:** Baixa

**Tarefa:**
- [ ] Log todas tentativas de injection
- [ ] Alertas para atividades suspeitas
- [ ] Dashboard de segurança
- [ ] Métricas de guardrails

**Arquivo novo:** `src/services/security-monitor.service.ts`

### 4.3 PII Detection
**Tempo:** 30 min  
**Complexidade:** Baixa

**Tarefa:**
- [ ] Detectar CPF, RG, CNH
- [ ] Detectar números de cartão de crédito
- [ ] Detectar endereços completos
- [ ] Redact informações sensíveis dos logs

**Arquivo:** Expandir `src/services/guardrails.service.ts`

---

## 🎨 FASE 5: Melhorias de UX (Prioridade BAIXA)

**Tempo estimado:** 3-4 horas  
**Status:** 🔴 Planejado

### 5.1 Enviar Fotos dos Veículos
**Tempo:** 1h  
**Complexidade:** Baixa

**Tarefa:**
- [ ] Modificar formatRecommendations()
- [ ] Usar sendImage() do WhatsApp
- [ ] Enviar carrossel de fotos
- [ ] Fallback se foto não disponível

### 5.2 Mensagens Interativas
**Tempo:** 1h  
**Complexidade:** Média

**Tarefa:**
- [ ] Botões de ação rápida
- [ ] Listas de seleção para quiz
- [ ] Localização da concessionária
- [ ] Compartilhar veículos

### 5.3 Agendamento Real
**Tempo:** 2h  
**Complexidade:** Alta

**Tarefa:**
- [ ] Integrar com Google Calendar
- [ ] Escolher data/hora disponível
- [ ] Confirmar por WhatsApp
- [ ] Enviar lembretes automáticos

---

## 🚀 FASE 6: Deploy & Produção (Prioridade ALTA)

**Tempo estimado:** 3-4 horas  
**Status:** 🔴 Planejado

### 6.1 Preparar para Deploy
**Tempo:** 1h  
**Complexidade:** Baixa

**Tarefa:**
- [ ] Variáveis de ambiente
- [ ] Build de produção
- [ ] Docker setup
- [ ] Health checks

### 6.2 Deploy
**Tempo:** 2h  
**Complexidade:** Média

**Opções:**
1. **Railway** (mais fácil) - $5/mês
2. **Heroku** - $7/mês
3. **DigitalOcean VPS** - $6/mês
4. **AWS EC2** - ~$10/mês

**Tarefa:**
- [ ] Escolher plataforma
- [ ] Deploy do código
- [ ] Setup banco de dados (PostgreSQL)
- [ ] Setup ChromaDB/Qdrant
- [ ] Conectar WhatsApp

### 6.3 Monitoramento
**Tempo:** 1h  
**Complexidade:** Baixa

**Tarefa:**
- [ ] Logs (Datadog, Papertrail)
- [ ] Métricas (Prometheus)
- [ ] Alertas (PagerDuty)
- [ ] Uptime monitoring

---

## 📊 CRONOGRAMA SUGERIDO

### **Semana 1: Fundação**
**Dias 1-2:** Fase 1 - Correções críticas
- ✅ Corrigir bug do quiz
- ✅ Implementar guardrails básicos
- ⏳ Testar exaustivamente

**Dias 3-5:** Fase 2 - LangGraph
- Setup LangGraph
- Implementar nodes
- Migrar agentes

### **Semana 2: Inteligência**
**Dias 6-8:** Fase 3 - Banco Vetorial
- Setup ChromaDB
- Gerar embeddings
- Busca semântica

**Dias 9-10:** Fase 4 - Guardrails avançados
- LLM guardrails
- Monitoring
- PII detection

### **Semana 3: Produção**
**Dias 11-12:** Fase 5 - UX
- Fotos de veículos
- Mensagens interativas

**Dias 13-15:** Fase 6 - Deploy
- Deploy em produção
- Conectar WhatsApp
- Monitoramento

---

## 🎯 PRIORIZAÇÃO PARA MVP v2.0

### **Must Have (P0):**
1. ✅ Guardrails básicos (FEITO - 97.1%)
2. ⏳ Corrigir bug do quiz
3. ⏳ LangGraph implementation
4. ⏳ Banco vetorial (ChromaDB)
5. ⏳ Deploy em produção

### **Should Have (P1):**
6. Guardrails avançados (LLM)
7. Busca semântica de veículos
8. Memória de conversação
9. Fotos nos veículos

### **Nice to Have (P2):**
10. Mensagens interativas
11. Agendamento real
12. Dashboard avançado
13. Integração CRM

---

## 💰 ESTIMATIVA DE CUSTOS

### **Infraestrutura:**
- Servidor (Railway/Heroku): **$5-10/mês**
- Banco de dados (PostgreSQL): **Incluso**
- ChromaDB self-hosted: **Grátis**

### **APIs:**
- OpenAI GPT-4o-mini: **~$0.15/1K msgs** (estima $30/mês)
- OpenAI Embeddings: **~$0.02/1K docs** (one-time $0.60)
- WhatsApp Business API: **Grátis** (até 1K msgs/mês)

### **Total estimado:** **$35-40/mês** para MVP com 1000 conversas/mês

---

## 📈 MÉTRICAS DE SUCESSO

### **Técnicas:**
- [ ] 99% uptime
- [ ] < 2s tempo de resposta
- [ ] 0 prompt injections bem-sucedidas
- [ ] 100% testes passando

### **Negócio:**
- [ ] 80%+ taxa de conclusão do quiz
- [ ] 50%+ leads gerados
- [ ] 10%+ agendamentos de visita
- [ ] 5%+ conversões em vendas

---

## 🔄 PRÓXIMOS PASSOS IMEDIATOS

**HOJE:**
1. ✅ Finalizar correção bug do quiz
2. ✅ Validar guardrails (97.1% → 100%)
3. ⏳ Testar fluxo end-to-end
4. ⏳ Documentar arquitetura atual

**AMANHÃ:**
1. Começar Fase 2 (LangGraph setup)
2. Instalar dependências
3. Definir State Schema
4. Implementar primeiro node

**ESTA SEMANA:**
1. Completar LangGraph (Fase 2)
2. Começar banco vetorial (Fase 3)
3. Preparar para deploy (Fase 6)

---

## ❓ DECISÕES PENDENTES

1. **Banco Vetorial:** ChromaDB (dev) ou Qdrant (prod)?
   - **Recomendação:** Começar com ChromaDB, migrar para Qdrant se necessário

2. **Plataforma de Deploy:** Railway, Heroku ou VPS?
   - **Recomendação:** Railway (mais fácil, bom custo-benefício)

3. **OpenAI Model:** GPT-4o-mini ou GPT-4o?
   - **Recomendação:** GPT-4o-mini para MVP (10x mais barato)

4. **WhatsApp:** Baileys, Venom ou Business API oficial?
   - **Recomendação:** Testar Baileys no servidor de produção primeiro

---

## 📚 RECURSOS & REFERÊNCIAS

### **Documentação:**
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [ChromaDB Docs](https://docs.trychroma.com/)
- [Qdrant Docs](https://qdrant.tech/documentation/)
- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys)

### **Exemplos:**
- [LangGraph Examples](https://github.com/langchain-ai/langgraph/tree/main/examples)
- [RAG with ChromaDB](https://js.langchain.com/docs/integrations/vectorstores/chroma)

---

**Última atualização:** 2025-01-15 20:35  
**Próxima revisão:** Após completar Fase 1
