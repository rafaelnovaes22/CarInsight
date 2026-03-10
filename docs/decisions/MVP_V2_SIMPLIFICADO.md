# 🚀 MVP v2.0 - Simplificado para Testes na Concessionária

**Objetivo:** Sistema funcionando com LangGraph + Busca Vetorial em 1-2 dias

---

## ✅ O QUE VAMOS INCLUIR (Essencial)

### 1. **LangGraph Básico** ⏱️ 3-4h
- ✅ 4 nodes essenciais (não 8)
- ✅ State unificado
- ✅ Checkpoints SQLite
- ✅ Fluxo linear simplificado

**Nodes:**
```
START → Greeting → Quiz → VectorSearch → Recommendation → END
```

**Não vamos incluir (por enquanto):**
- ❌ IntentClassification (sempre vai pro Quiz)
- ❌ HandoffNode (manual por enquanto)
- ❌ SchedulingNode (cliente agenda por telefone)
- ❌ ErrorNode complexo

### 2. **Busca Vetorial Básica** ⏱️ 2-3h
- ✅ ChromaDB local
- ✅ Embeddings dos 30 veículos
- ✅ Busca semântica simples
- ✅ Filtros básicos (preço, ano)

**Não vamos incluir:**
- ❌ Memória de conversas passadas
- ❌ Hybrid scoring complexo
- ❌ Qdrant em produção
- ❌ Re-ranking com LLM

### 3. **Guardrails** ✅ JÁ PRONTO
- ✅ Input validation
- ✅ Prompt injection detection
- ✅ Rate limiting

### 4. **Deploy Simples** ⏱️ 2-3h
- ✅ Railway ou Heroku
- ✅ PostgreSQL (ao invés de SQLite)
- ✅ ChromaDB rodando
- ✅ WhatsApp conectado

---

## ❌ O QUE NÃO VAMOS INCLUIR (v3.0 depois)

- ❌ Intent classification inteligente
- ❌ Conditional edges complexos
- ❌ Memória de longo prazo
- ❌ Agendamento automático
- ❌ Fotos dos veículos
- ❌ Mensagens interativas (botões)
- ❌ Integração CRM
- ❌ Dashboard avançado
- ❌ A/B testing

---

## 🏗️ Arquitetura Simplificada

```
┌──────────────────────────────────────┐
│         WHATSAPP                     │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│      GUARDRAILS (já pronto)          │
└─────────────┬────────────────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│         LANGGRAPH                    │
│                                      │
│  Greeting → Quiz → Search → Recommend│
│                                      │
│  State = { messages, quiz, profile } │
└─────────┬──────────────┬─────────────┘
          │              │
          ▼              ▼
    ┌─────────┐    ┌──────────┐
    │ChromaDB │    │PostgreSQL│
    │Embeddings│    │Conversa │
    └─────────┘    └──────────┘
```

---

## 📋 Implementação Passo-a-Passo

### **DIA 1: LangGraph + ChromaDB (6-7h)**

#### Manhã (3-4h): LangGraph

**Passo 1.1:** Instalar dependências (15 min)
```bash
npm install @langchain/core @langchain/openai langgraph
npm install @langchain/community
```

**Passo 1.2:** Criar State Schema (30 min)
```typescript
// src/types/state.types.ts
interface ConversationState {
  conversationId: string;
  phoneNumber: string;
  messages: BaseMessage[];
  quiz: {
    progress: number;
    answers: Record<string, any>;
  };
  profile: CustomerProfile | null;
  recommendations: VehicleRecommendation[];
}
```

**Passo 1.3:** Implementar 4 Nodes (2h)
```typescript
// src/graph/nodes/greeting.node.ts
export async function greetingNode(state: ConversationState) {
  return {
    ...state,
    messages: [
      ...state.messages,
      new AIMessage("Olá! Vou te ajudar a encontrar o carro perfeito...")
    ]
  };
}

// src/graph/nodes/quiz.node.ts
export async function quizNode(state: ConversationState) {
  // Lógica do quiz (já temos)
}

// src/graph/nodes/search.node.ts
export async function searchNode(state: ConversationState) {
  // Busca vetorial (vamos implementar)
}

// src/graph/nodes/recommendation.node.ts
export async function recommendationNode(state: ConversationState) {
  // Formatar recomendações (já temos)
}
```

**Passo 1.4:** Montar Grafo (30 min)
```typescript
// src/graph/conversation-graph.ts
import { StateGraph } from "langgraph";

const workflow = new StateGraph<ConversationState>({
  channels: {
    messages: { reducer: (x, y) => x.concat(y) },
    quiz: { default: () => ({ progress: 0, answers: {} }) }
  }
});

workflow.addNode("greeting", greetingNode);
workflow.addNode("quiz", quizNode);
workflow.addNode("search", searchNode);
workflow.addNode("recommendation", recommendationNode);

workflow.addEdge(START, "greeting");
workflow.addEdge("greeting", "quiz");
workflow.addEdge("quiz", "search");
workflow.addEdge("search", "recommendation");
workflow.addEdge("recommendation", END);

export const graph = workflow.compile();
```

**Passo 1.5:** Integrar com MessageHandler (30 min)
```typescript
// src/services/message-handler-v2.service.ts
export class MessageHandlerV2 {
  async handleMessage(phone: string, message: string) {
    // Guardrails
    const validation = guardrails.validateInput(phone, message);
    if (!validation.allowed) return validation.reason;
    
    // Executar grafo
    const result = await graph.invoke({
      conversationId: getOrCreateConversation(phone),
      phoneNumber: phone,
      messages: [new HumanMessage(message)]
    });
    
    // Retornar última mensagem
    return result.messages[result.messages.length - 1].content;
  }
}
```

#### Tarde (3h): ChromaDB

**Passo 2.1:** Instalar ChromaDB (15 min)
```bash
npm install chromadb
```

**Passo 2.2:** Setup ChromaDB (30 min)
```typescript
// src/lib/chromadb.ts
import { ChromaClient } from "chromadb";

export const chromaClient = new ChromaClient();

export async function initVectorDB() {
  const collection = await chromaClient.getOrCreateCollection({
    name: "vehicles",
    metadata: { "hnsw:space": "cosine" }
  });
  
  return collection;
}
```

**Passo 2.3:** Gerar Embeddings (1h)
```typescript
// src/scripts/generate-embeddings-simple.ts
import { OpenAI } from "openai";
import { prisma } from "../lib/prisma";
import { initVectorDB } from "../lib/chromadb";

async function generateEmbeddings() {
  const openai = new OpenAI();
  const collection = await initVectorDB();
  
  const vehicles = await prisma.vehicle.findMany();
  
  for (const vehicle of vehicles) {
    // Criar descrição textual
    const text = `
      ${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''}
      Ano ${vehicle.ano}, ${vehicle.km} km, ${vehicle.cor}
      R$ ${vehicle.preco}
      ${vehicle.combustivel}, ${vehicle.cambio}
      Tipo: ${vehicle.tipo}
      ${vehicle.descricao || ''}
    `.trim();
    
    // Gerar embedding
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    // Adicionar ao ChromaDB
    await collection.add({
      ids: [`vehicle-${vehicle.id}`],
      embeddings: [response.data[0].embedding],
      documents: [text],
      metadatas: [{
        vehicleId: vehicle.id,
        price: parseFloat(vehicle.preco),
        year: vehicle.ano,
        km: vehicle.km,
        brand: vehicle.marca,
        model: vehicle.modelo,
        type: vehicle.tipo
      }]
    });
    
    console.log(`✅ ${vehicle.marca} ${vehicle.modelo}`);
  }
  
  console.log(`\n🎉 ${vehicles.length} veículos indexados!`);
}

generateEmbeddings();
```

**Passo 2.4:** Implementar Busca (1h)
```typescript
// src/services/vector-search-simple.service.ts
import { OpenAI } from "openai";
import { initVectorDB } from "../lib/chromadb";

export class VectorSearchService {
  private openai = new OpenAI();
  
  async search(profile: CustomerProfile) {
    // 1. Criar query text
    const queryText = `
      Procuro um carro até R$ ${profile.budget},
      para ${profile.usage},
      que caiba ${profile.people} pessoas
    `;
    
    // 2. Gerar embedding da query
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: queryText,
    });
    
    // 3. Buscar similares
    const collection = await initVectorDB();
    const results = await collection.query({
      queryEmbeddings: [response.data[0].embedding],
      nResults: 10,
      where: {
        price: { $lte: profile.budget * 1.1 },
        year: { $gte: profile.minYear || 2015 }
      }
    });
    
    // 4. Retornar top 3
    return results.ids[0].slice(0, 3).map((id, idx) => ({
      vehicleId: parseInt(id.replace('vehicle-', '')),
      matchScore: Math.round((1 - results.distances[0][idx]) * 100),
      reasoning: results.documents[0][idx]
    }));
  }
}
```

---

### **DIA 2: Deploy + Testes (6-7h)**

#### Manhã (3-4h): Deploy

**Passo 3.1:** Preparar Railway (1h)
```bash
# Criar railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE"
  }
}

# Criar Dockerfile (alternativa)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

**Passo 3.2:** Migrar SQLite → PostgreSQL (1h)
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"  // era sqlite
  url      = env("DATABASE_URL")
}
```
```bash
# Railway provê PostgreSQL automaticamente
railway add postgres
railway run npx prisma db push
railway run npm run db:seed:complete
```

**Passo 3.3:** Deploy ChromaDB (30 min)

**Opção A - Persistente (recomendado):**
```typescript
// ChromaDB com volume persistente
const client = new ChromaClient({
  path: process.env.CHROMA_PATH || "./chroma_data"
});
```

**Opção B - Cloud (mais fácil):**
```bash
# Usar Chroma Cloud (grátis para começar)
CHROMA_URL=https://api.trychroma.com
CHROMA_API_KEY=sk-xxx
```

**Passo 3.4:** Fazer Deploy (30 min)
```bash
# Push para Railway
git add .
git commit -m "MVP v2.0 - LangGraph + Vector Search"
git push railway main

# Ou Heroku
heroku create faciliauto-mvp
git push heroku main
```

#### Tarde (3h): Testes + Ajustes

**Passo 4.1:** Conectar WhatsApp (1h)
```typescript
// Tentar Baileys no servidor (não no WSL)
// Se não funcionar, usar API REST para testes
```

**Passo 4.2:** Testes End-to-End (1h)
- Testar fluxo completo com 5 perfis diferentes
- Validar recomendações fazem sentido
- Ajustar Match Score se necessário

**Passo 4.3:** Documentar para Cliente (1h)
- Como testar
- Exemplos de conversas
- Limitações conhecidas
- Próximos passos

---

## 📊 Checklist de Entrega

### **Funcionalidades:**
- [ ] Cliente envia "Olá" → Bot responde
- [ ] Quiz completo (8 perguntas)
- [ ] Busca vetorial retorna 3 carros
- [ ] Match Score coerente (70-95)
- [ ] Explicação do por quê de cada carro
- [ ] "agendar" → Transfere para vendedor

### **Técnico:**
- [ ] LangGraph rodando
- [ ] ChromaDB indexado (30 veículos)
- [ ] Guardrails ativos
- [ ] Deploy funcionando 24/7
- [ ] Logs acessíveis
- [ ] Backup automático

### **Cliente pode:**
- [ ] Escanear QR Code e conectar
- [ ] Conversar com bot
- [ ] Receber 3 recomendações
- [ ] Ver Match Score
- [ ] Agendar visita

---

## 🎯 Exemplo de Conversa (Target)

```
Cliente: Olá, quero comprar um carro

Bot: Olá! 👋 Sou o assistente da FaciliAuto.
     Vou te ajudar a encontrar o carro perfeito!
     
     São 8 perguntas rápidas. Vamos começar?
     
     💰 Qual seu orçamento?

Cliente: 50000

Bot: ✅ Perfeito!
     
     🚗 Qual o uso principal?
     1 - Cidade
     2 - Viagem
     3 - Trabalho
     4 - Misto

Cliente: 1

Bot: ✅ Anotado!
     
     👥 Para quantas pessoas?

Cliente: 5

[... 5 perguntas restantes ...]

Bot: 🎯 Encontrei 3 veículos perfeitos para você!
     
     ━━━━━━━━━━━━━━━━━━━━━━━
     1️⃣ Match: 92/100 ⭐
     
     🚗 Honda Civic 2020 EXL
     📅 2020 | 🛣️ 30.000 km
     💰 R$ 75.000,00
     🎨 Prata
     
     💡 Este Civic é perfeito para você porque:
     - Dentro do orçamento com ótimo custo-benefício
     - Baixíssima quilometragem (praticamente novo)
     - Sedan espaçoso para 5 pessoas confortavelmente
     - Ideal para uso urbano (econômico e ágil)
     - Completo e muito bem conservado
     
     ━━━━━━━━━━━━━━━━━━━━━━━
     2️⃣ Match: 88/100 ⭐
     
     [...]
     
     ━━━━━━━━━━━━━━━━━━━━━━━
     
     Quer saber mais? Digite:
     • Número do carro para detalhes
     • "agendar" para visitar
     • "vendedor" para falar com humano

Cliente: agendar

Bot: Ótimo! 🎉
     
     Vou transferir você para nossa equipe.
     Um vendedor entrará em contato em breve!
     
     Obrigado por escolher a FaciliAuto! 🚗
```

---

## ⏱️ Cronograma Realista

### **Opção 1: Full-time (2 dias)**
- **Dia 1:** 8h → LangGraph (4h) + ChromaDB (4h)
- **Dia 2:** 8h → Deploy (4h) + Testes (4h)
- **Total:** 16 horas

### **Opção 2: Part-time (1 semana)**
- **Seg:** 3h → LangGraph setup + nodes
- **Ter:** 3h → LangGraph integration
- **Qua:** 3h → ChromaDB + embeddings
- **Qui:** 3h → Busca vetorial
- **Sex:** 4h → Deploy + testes
- **Total:** 16 horas

### **Opção 3: Sprint (1 dia intenso)**
- **Manhã:** 5h → LangGraph + ChromaDB
- **Tarde:** 5h → Deploy + testes críticos
- **Total:** 10 horas (MVP mínimo)

---

## 💰 Custos do MVP

### **Infraestrutura:**
- Railway/Heroku: **$5-7/mês**
- PostgreSQL: **Incluso**
- ChromaDB: **Grátis** (self-hosted)

### **APIs (durante testes):**
- OpenAI GPT-4o-mini: **~$5** (100 conversas)
- OpenAI Embeddings: **~$0.60** (30 veículos)

### **Total primeiro mês:** **~$10-15**

---

## ✅ Vantagens desta Abordagem

### **vs. MVP v1.0 (atual):**
✅ Busca semântica (não só SQL)
✅ Estado unificado (sem bugs de contexto)
✅ Fácil de estender depois
✅ Checkpoints (pode voltar)
✅ Mais profissional

### **vs. ROADMAP completo:**
✅ Entrega em 1-2 dias (não 3 semanas)
✅ Apenas essencial
✅ Cliente pode testar logo
✅ Aprendemos antes de investir mais

---

## ⚠️ Limitações Conhecidas (OK para MVP)

1. **Fluxo Linear**
   - Sempre faz quiz completo
   - Não detecta intenção alternativa
   - **OK:** Cliente pode "voltar" depois

2. **Sem Memória de Longo Prazo**
   - Não lembra conversas antigas
   - **OK:** Primeiro acesso mesmo

3. **Busca Vetorial Simples**
   - Não re-ranka com LLM
   - **OK:** ChromaDB já é muito bom

4. **Sem Agendamento Real**
   - Vendedor agenda manualmente
   - **OK:** É assim que já funciona hoje

5. **Sem Fotos**
   - Só texto
   - **OK:** Cliente vê fotos no site depois

---

## 📈 Após os Testes na Concessionária

### **Se funcionar bem:**
→ Investir em v3.0 com features completas
→ Adicionar intent classification
→ Memória de conversas
→ Agendamento automático
→ Fotos dos veículos
→ Integração CRM

### **Se precisar ajustes:**
→ Iterar rápido (LangGraph facilita)
→ Ajustar Match Score
→ Refinar prompts
→ Adicionar filtros

---

## 🎯 Decisão AGORA

**Você quer implementar este MVP v2.0 simplificado?**

Se sim, começamos por:

**Opção A:** LangGraph primeiro (4h)
- Setup
- 4 nodes
- Integração

**Opção B:** ChromaDB primeiro (3h)
- Setup
- Embeddings
- Busca

**Opção C:** Deploy primeiro (testa arquitetura atual)
- Sobe sistema v1.0
- Vê se WhatsApp funciona
- Depois implementa v2.0

**Minha recomendação:** 
**Opção A** → LangGraph primeiro, porque corrige o bug do quiz automaticamente!

O que você decide?
