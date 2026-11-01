# 🏗️ Arquitetura v2.0 - FaciliAuto com LangGraph

## 📐 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                         WHATSAPP                                 │
│                    (Cliente Final)                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GUARDRAILS LAYER 🛡️                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Input Valid  │  │ Rate Limit   │  │ Injection    │          │
│  │              │  │              │  │ Detection    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH STATE MACHINE                       │
│                                                                  │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │ Greeting │─────▶│  Intent  │─────▶│   Quiz   │              │
│  │   Node   │      │  Classify│      │   Node   │              │
│  └──────────┘      └──────────┘      └────┬─────┘              │
│                                            │                     │
│                                            ▼                     │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐              │
│  │ Schedule │◀─────│Recommend │◀─────│  Vector  │              │
│  │   Node   │      │   Node   │      │  Search  │              │
│  └──────────┘      └──────────┘      └──────────┘              │
│                                                                  │
│  State: { messages, profile, recommendations, context }         │
│  Checkpointer: SQLite (persistent state)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐
│   VECTOR DATABASE    │  │   RELATIONAL DB      │
│     (ChromaDB)       │  │    (PostgreSQL)      │
│                      │  │                      │
│ • Vehicle Embeddings │  │ • Conversations      │
│ • Conversation       │  │ • Messages           │
│   History            │  │ • Leads              │
│ • Semantic Search    │  │ • Vehicles           │
└──────────────────────┘  └──────────────────────┘
```

---

## 🧠 LangGraph State Machine (Detalhado)

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Greeting   │
                    │    Node     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Intent    │
                    │ Classifier  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Handoff    │   │     Quiz     │   │  Direct      │
│   to Human   │   │     Node     │   │  Search      │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       │                  │ (8 questions)    │
       │                  │    ┌─────┐       │
       │                  └────┤Loop │◀──────┘
       │                       └──┬──┘       │
       │                          │          │
       │                          ▼          │
       │                  ┌──────────────┐   │
       │                  │   Profile    │   │
       │                  │  Complete    │   │
       │                  └──────┬───────┘   │
       │                         │           │
       └─────────────────────────┼───────────┘
                                 │
                                 ▼
                         ┌──────────────┐
                         │   Vector     │
                         │   Search     │◀─── ChromaDB
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ Hybrid Score │
                         │   Ranking    │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │Recommendation│
                         │     Node     │
                         └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
       ┌────────────┐    ┌────────────┐   ┌────────────┐
       │  More      │    │ Schedule   │   │  Vehicle   │
       │  Details   │    │   Visit    │   │  Details   │
       └────┬───────┘    └────┬───────┘   └────┬───────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                              ▼
                       ┌────────────┐
                       │    END     │
                       │ (Lead Gen) │
                       └────────────┘
```

---

## 🗃️ State Schema

```typescript
interface ConversationState {
  // === Identificação ===
  conversationId: string;
  phoneNumber: string;
  sessionId: string;
  
  // === Mensagens (Array de objetos) ===
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }[];
  
  // === Quiz State ===
  quiz: {
    progress: number;        // 0-8
    currentQuestion: number; // 1-8
    answers: {
      budget?: number;
      usage?: 'cidade' | 'viagem' | 'trabalho' | 'misto';
      people?: number;
      hasTradeIn?: boolean;
      minYear?: number;
      maxKm?: number;
      vehicleType?: 'sedan' | 'hatch' | 'suv' | 'pickup';
      urgency?: 'imediato' | '1mes' | '3meses' | 'flexivel';
    };
    isComplete: boolean;
  };
  
  // === Perfil do Cliente (gerado após quiz) ===
  profile: {
    budget: number;
    budgetFlexibility: number; // +/- %
    usagePattern: string;
    familySize: number;
    priorities: string[];      // ['economico', 'conforto', 'espaco']
    dealBreakers: string[];    // ['alto_km', 'muito_antigo']
  } | null;
  
  // === Recomendações ===
  recommendations: {
    vehicleId: string;
    matchScore: number;        // 0-100
    reasoning: string;
    highlights: string[];
    concerns: string[];
  }[];
  
  // === Contexto do Grafo ===
  graph: {
    currentNode: string;       // 'greeting', 'quiz', 'recommendation', etc.
    previousNode: string;
    nodeHistory: string[];
    loopCount: number;         // Prevenir loops infinitos
    errorCount: number;        // Retry logic
  };
  
  // === Metadata ===
  metadata: {
    startedAt: Date;
    lastMessageAt: Date;
    userAgent?: string;
    utmSource?: string;
    leadQuality?: 'hot' | 'warm' | 'cold';
    flags: string[];           // ['suspicious', 'vip', 'returning']
  };
}
```

---

## 🎯 Nodes Detalhados

### 1. **GreetingNode**

**Responsabilidade:** Primeira mensagem, apresentação do bot

**Input State:**
```typescript
{ messages: [], currentNode: 'greeting' }
```

**Lógica:**
1. Verificar se é primeira vez ou retorno
2. Buscar histórico no ChromaDB (se retorno)
3. Personalizar saudação
4. Explicar o que o bot faz

**Output State:**
```typescript
{
  messages: [{ role: 'assistant', content: 'Olá! 👋...' }],
  currentNode: 'intent_classification'
}
```

---

### 2. **IntentClassificationNode**

**Responsabilidade:** Classificar intenção do usuário

**Possíveis Intenções:**
- `QUALIFICAR` → Quer fazer quiz
- `BUSCAR` → Já sabe o que quer
- `DUVIDA` → Perguntas gerais
- `HUMANO` → Quer falar com vendedor
- `OUTRO` → Fora do escopo

**Usa LLM para classificar:**
```typescript
const intent = await llm.invoke([
  { role: 'system', content: INTENT_CLASSIFIER_PROMPT },
  { role: 'user', content: state.messages.last() }
]);
```

**Next Node:**
- `QUALIFICAR` → QuizNode
- `BUSCAR` → VectorSearchNode
- `HUMANO` → HandoffNode
- `OUTRO` → ErrorNode/GreetingNode

---

### 3. **QuizNode**

**Responsabilidade:** Fazer 8 perguntas de qualificação

**Questões:**
1. Orçamento?
2. Uso principal?
3. Quantas pessoas?
4. Trade-in?
5. Ano mínimo?
6. KM máxima?
7. Tipo de veículo?
8. Urgência?

**Lógica:**
```typescript
async function quizNode(state: ConversationState) {
  const { quiz, messages } = state;
  const lastMessage = messages[messages.length - 1];
  
  // Validar resposta
  const validation = validateAnswer(
    quiz.currentQuestion,
    lastMessage.content
  );
  
  if (!validation.valid) {
    return {
      ...state,
      messages: [...messages, {
        role: 'assistant',
        content: validation.errorMessage
      }]
    };
  }
  
  // Salvar resposta
  const updatedQuiz = {
    ...quiz,
    answers: {
      ...quiz.answers,
      [validation.field]: validation.value
    },
    progress: quiz.progress + 1,
    currentQuestion: quiz.currentQuestion + 1
  };
  
  // Verificar se completou
  if (updatedQuiz.progress >= 8) {
    return {
      ...state,
      quiz: { ...updatedQuiz, isComplete: true },
      profile: generateProfile(updatedQuiz.answers),
      graph: { ...state.graph, currentNode: 'vector_search' }
    };
  }
  
  // Próxima pergunta
  const nextQuestion = getQuestion(updatedQuiz.currentQuestion);
  
  return {
    ...state,
    quiz: updatedQuiz,
    messages: [...messages, {
      role: 'assistant',
      content: nextQuestion
    }]
  };
}
```

---

### 4. **VectorSearchNode**

**Responsabilidade:** Busca semântica de veículos

**Fluxo:**
1. Converter perfil em query text
2. Gerar embedding da query
3. Buscar no ChromaDB (similarity search)
4. Aplicar filtros de metadata
5. Rankear com hybrid score

**Código:**
```typescript
async function vectorSearchNode(state: ConversationState) {
  const { profile } = state;
  
  // 1. Gerar query
  const queryText = generateQueryFromProfile(profile);
  // "Carro até R$ 50k, econômico, 5 lugares, cidade, urgente"
  
  // 2. Buscar vetorialmente
  const vectorResults = await chromaDB.query({
    collectionName: 'vehicles',
    queryTexts: [queryText],
    nResults: 20,  // Top 20 candidatos
    where: {
      price: { $lte: profile.budget * 1.1 },  // +10% flex
      year: { $gte: profile.minYear },
      km: { $lte: profile.maxKm }
    }
  });
  
  // 3. Hybrid scoring
  const rankedResults = vectorResults.map(vehicle => ({
    ...vehicle,
    matchScore: calculateMatchScore(vehicle, profile)
  })).sort((a, b) => b.matchScore - a.matchScore);
  
  // 4. Top 3
  const topRecommendations = rankedResults.slice(0, 3);
  
  return {
    ...state,
    recommendations: topRecommendations,
    graph: { ...state.graph, currentNode: 'recommendation' }
  };
}
```

---

### 5. **RecommendationNode**

**Responsabilidade:** Apresentar veículos com explicação

**Usa LLM para gerar explicação:**
```typescript
async function recommendationNode(state: ConversationState) {
  const { recommendations, profile } = state;
  
  // Gerar explicação com LLM
  const explanations = await Promise.all(
    recommendations.map(async (rec) => {
      const prompt = `
        Explique por que este veículo é perfeito para o cliente:
        
        Cliente:
        - Orçamento: R$ ${profile.budget}
        - Uso: ${profile.usage}
        - Pessoas: ${profile.people}
        
        Veículo:
        - ${rec.brand} ${rec.model} ${rec.year}
        - R$ ${rec.price}
        - ${rec.km} km
        
        Seja conciso, persuasivo e destaque os benefícios.
      `;
      
      const explanation = await llm.invoke(prompt);
      return { ...rec, reasoning: explanation };
    })
  );
  
  // Formatar mensagem
  const message = formatRecommendations(explanations);
  
  return {
    ...state,
    recommendations: explanations,
    messages: [...state.messages, {
      role: 'assistant',
      content: message
    }],
    graph: { ...state.graph, currentNode: 'awaiting_action' }
  };
}
```

---

## 🔄 Conditional Edges (Roteamento)

```typescript
function routeAfterIntent(state: ConversationState): string {
  const lastMessage = state.messages[state.messages.length - 1];
  const intent = classifyIntent(lastMessage.content);
  
  const routes = {
    'QUALIFICAR': 'quiz',
    'BUSCAR': 'vector_search',
    'HUMANO': 'handoff',
    'DUVIDA': 'faq',
    'OUTRO': 'greeting'
  };
  
  return routes[intent] || 'greeting';
}

function routeAfterRecommendation(state: ConversationState): string {
  const lastMessage = state.messages[state.messages.length - 1].content;
  
  if (/agendar|visita|test drive/i.test(lastMessage)) {
    return 'schedule';
  }
  
  if (/\b[1-3]\b/.test(lastMessage)) {
    return 'vehicle_details';
  }
  
  if (/mais|outro|diferente/i.test(lastMessage)) {
    return 'vector_search';  // Nova busca
  }
  
  if (/vendedor|humano/i.test(lastMessage)) {
    return 'handoff';
  }
  
  return 'awaiting_action';  // Loop
}
```

---

## 💾 ChromaDB Collections

### Collection: `vehicles`

**Documento:**
```json
{
  "id": "vehicle-123",
  "embedding": [0.123, 0.456, ..., 0.789],
  "document": "Honda Civic 2020 Sedan Automático completo...",
  "metadata": {
    "vehicleId": 123,
    "brand": "Honda",
    "model": "Civic",
    "version": "EXL",
    "year": 2020,
    "price": 75000,
    "km": 30000,
    "color": "Prata",
    "fuel": "Flex",
    "transmission": "Automatic",
    "type": "Sedan",
    "doors": 4,
    "features": ["ar", "direcao", "airbag", "abs"],
    "images": ["url1", "url2"],
    "description": "Texto completo..."
  }
}
```

### Collection: `conversations`

**Documento:**
```json
{
  "id": "conv-456",
  "embedding": [0.321, 0.654, ..., 0.987],
  "document": "Cliente procurou sedan econômico até 50k...",
  "metadata": {
    "conversationId": "456",
    "phoneNumber": "5511999999999",
    "profile": {
      "budget": 50000,
      "usage": "cidade",
      "people": 5
    },
    "leadQuality": "hot",
    "outcome": "scheduled",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

---

## 🛡️ Guardrails Integration

```typescript
// No início de cada node
async function anyNode(state: ConversationState) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // Input guardrails
  const inputCheck = await guardrails.validateInput(
    state.phoneNumber,
    lastMessage.content
  );
  
  if (!inputCheck.allowed) {
    return {
      ...state,
      messages: [...state.messages, {
        role: 'assistant',
        content: inputCheck.reason
      }],
      metadata: {
        ...state.metadata,
        flags: [...state.metadata.flags, 'blocked_input']
      }
    };
  }
  
  // Process node...
  const response = await processNode(state);
  
  // Output guardrails
  const outputCheck = await guardrails.validateOutput(response.content);
  
  if (!outputCheck.allowed) {
    return {
      ...state,
      messages: [...state.messages, {
        role: 'assistant',
        content: 'Desculpe, erro ao processar. Tente novamente.'
      }],
      metadata: {
        ...state.metadata,
        flags: [...state.metadata.flags, 'blocked_output']
      }
    };
  }
  
  return response;
}
```

---

## 📊 Checkpointing (Persistência)

```typescript
import { SqliteSaver } from "@langchain/langgraph";

const checkpointer = SqliteSaver.fromConnString("checkpoints.db");

const app = graph.compile({
  checkpointer,
  interruptBefore: ['handoff', 'schedule']  // Pausar nesses nodes
});

// Executar com checkpoint
const result = await app.invoke(
  { messages: [userMessage] },
  {
    configurable: {
      thread_id: conversationId  // Restaura estado automaticamente
    }
  }
);

// Histórico de estados
const history = await app.getStateHistory({
  configurable: { thread_id: conversationId }
});
```

---

## 🚀 Vantagens da Nova Arquitetura

### **vs. Atual (Switch/Case):**

| Feature | Atual | Com LangGraph |
|---------|-------|---------------|
| **Estado** | Cache + DB separados | State unificado |
| **Fluxo** | Hard-coded | Declarativo |
| **Debugging** | Difícil | Visualizável |
| **Extensão** | Modificar código | Adicionar nodes |
| **Rollback** | Impossível | Checkpoints |
| **Paralelização** | Manual | Automática |
| **Testes** | Complexos | Isolados por node |

### **vs. Busca SQL:**

| Feature | SQL | Vector DB |
|---------|-----|-----------|
| **Busca** | Exata (=, <, >) | Semântica |
| **Exemplo** | "price < 50000" | "econômico acessível" |
| **Flexibilidade** | Rígida | Fuzzy matching |
| **Personalização** | Difícil | Natural |
| **Descoberta** | Limitada | Surpreendente |

---

## 📈 Próximos Passos

1. ✅ Validar arquitetura com stakeholders
2. ⏳ Implementar LangGraph base (Fase 2.1-2.2)
3. ⏳ Criar primeiro node funcional (Greeting)
4. ⏳ Setup ChromaDB (Fase 3.1-3.2)
5. ⏳ Migrar nodes progressivamente
6. ⏳ Testes end-to-end

---

**Esta é a arquitetura target.** 
**A migração será gradual e backward-compatible.**
