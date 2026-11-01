# 🧠 Ontologia + LangGraph para FaciliAuto

**Pergunta:** Usar ontologia no LangGraph melhoraria os resultados?  
**Resposta:** **SIM!** Especialmente para domínio de vendas de veículos.

---

## 🎯 O que é Ontologia?

Ontologia é uma representação formal de conhecimento que define:
- **Conceitos** (classes, entidades)
- **Relacionamentos** entre conceitos
- **Propriedades** de cada conceito
- **Regras** e restrições

### Exemplo Prático (Veículos):

```
Conceito: Veículo
├─ Sedan
│  ├─ Civic (marca: Honda, categoria: médio)
│  ├─ Corolla (marca: Toyota, categoria: médio)
│  └─ Onix (marca: Chevrolet, categoria: compacto)
├─ SUV
│  ├─ Compass (marca: Jeep)
│  └─ Tucson (marca: Hyundai)
└─ Minivan
   └─ Spin (marca: Chevrolet, lugares: 7)

Relacionamentos:
- Spin É_DO_TIPO Minivan
- Minivan ADEQUADO_PARA Família
- Civic COMPATÍVEL_COM Uber_Black
- Spin NÃO_COMPATÍVEL_COM Uber (minivan não permitida)
```

---

## ✅ Benefícios para FaciliAuto

### 1. **Inferência Automática**

**Sem Ontologia (atual):**
```python
User: "Spin"
Bot: Extrai "spin" → Busca no banco → Encontra
```

**Com Ontologia:**
```python
User: "Spin"
Ontologia infere:
├─ Spin É Minivan
├─ Minivan TEM 7_lugares
├─ Minivan ADEQUADO_PARA Família
├─ Minivan NÃO_COMPATÍVEL Uber (regra)
└─ Minivan SIMILAR_A Grand Siena, Zafira

Bot: "Spin é uma minivan de 7 lugares, perfeita para família!
      Porém NÃO é apta para Uber/99 (minivans não são permitidas).
      Para família, temos disponível em estoque. Para Uber, 
      posso sugerir sedan de 5 lugares?"
```

### 2. **Validação de Requisitos**

**Sem Ontologia:**
```python
# Spin pode ser marcada erroneamente como Uber
if ano >= 2012 && ar_cond && portas >= 4:
    apto_uber = True  # ❌ Spin passaria!
```

**Com Ontologia:**
```python
# Regras semânticas
REGRA: Minivan NÃO_PODE_SER Uber
REGRA: Uber REQUER (Sedan OU Hatch) E NOT(SUV, Minivan, Pickup)

if ontology.check(vehicle, "apto_uber"):
    # Spin → NÃO passa (minivan)
    # Civic → Passa (sedan)
```

### 3. **Recomendações Contextuais**

**Atual:**
```python
# Busca por similares é genérica
similar = search(categoria=vehicle.categoria, preco=vehicle.preco)
```

**Com Ontologia:**
```python
# Recomendações semânticas
if user.contexto == "uber":
    # Spin NÃO é recomendada (minivan)
    alternatives = ontology.query(
        compatível_com="uber",
        similar_a="spin",  # Mesmo porte/família
        características=["espaçoso", "econômico"]
    )
    # Retorna: Prisma, Grand Siena (sedans médios)

elif user.contexto == "familia":
    # Spin É recomendada
    alternatives = ontology.query(
        adequado_para="familia",
        lugares >= 7
    )
    # Retorna: Spin, Zafira, Grand Siena
```

### 4. **Explicabilidade**

**Atual:**
```
Bot: "Essa Spin não é apta para Uber"
User: "Por quê?"
Bot: [Sem explicação clara]
```

**Com Ontologia:**
```
Bot: "Essa Spin não é apta para Uber porque:
     1. Spin é uma Minivan
     2. Uber permite apenas Sedan ou Hatch compacto
     3. Minivans são classificadas como Uber XL (categoria especial)
     
     Para Uber X, recomendo: Civic, Corolla ou Onix"
```

---

## 🏗️ Arquitetura Proposta

### Componentes:

```
┌─────────────────────────────────────────┐
│         LangGraph Workflow              │
│  (Gerencia fluxo de conversa)          │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      Ontologia Layer (OWL/RDF)          │
│  - Conceitos de domínio                 │
│  - Relacionamentos semânticos           │
│  - Regras de negócio                    │
│  - Inferência automática                │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      Knowledge Graph                     │
│  - Veículos + Propriedades              │
│  - Marcas + Modelos                     │
│  - Categorias + Uso                     │
│  - Regras Uber/99                       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      PostgreSQL + Vector DB             │
│  (Dados estruturados + Embeddings)      │
└─────────────────────────────────────────┘
```

### Exemplo de Grafo:

```turtle
# Ontologia em Turtle (RDF)

:Spin a :Minivan ;
    :marca :Chevrolet ;
    :lugares 7 ;
    :carroceria "minivan" ;
    :adequadoPara :Familia, :Viagem ;
    :naoAdequadoPara :Uber, :UberX ;
    :razao "Minivans não são aceitas no Uber X/Comfort" .

:Civic a :Sedan ;
    :marca :Honda ;
    :lugares 5 ;
    :adequadoPara :Uber, :UberX, :UberBlack, :Familia ;
    :compativel_uber_desde 2012 .

:UberX a :CategoriaUber ;
    :requer :Sedan, :Hatch ;
    :naoPermite :SUV, :Minivan, :Pickup ;
    :ano_minimo 2012 ;
    :ar_condicionado true .

# Regra de inferência
:Minivan rdfs:subClassOf [
    a owl:Restriction ;
    owl:onProperty :adequadoPara ;
    owl:allValuesFrom [
        a owl:Class ;
        owl:complementOf :Uber
    ]
] .
```

---

## 🚀 Implementação Sugerida

### Fase 1: Ontologia Básica (1-2 semanas)

**1. Definir Ontologia de Domínio**
```python
# domain_ontology.py
from rdflib import Graph, Namespace, Literal
from rdflib.namespace import RDF, RDFS, OWL

AUTO = Namespace("http://faciliauto.com/onto#")

# Criar grafo
g = Graph()

# Definir classes
g.add((AUTO.Veiculo, RDF.type, OWL.Class))
g.add((AUTO.Sedan, RDFS.subClassOf, AUTO.Veiculo))
g.add((AUTO.SUV, RDFS.subClassOf, AUTO.Veiculo))
g.add((AUTO.Minivan, RDFS.subClassOf, AUTO.Veiculo))

# Definir propriedades
g.add((AUTO.adequadoPara, RDF.type, OWL.ObjectProperty))
g.add((AUTO.naoAdequadoPara, RDF.type, OWL.ObjectProperty))

# Definir indivíduos
g.add((AUTO.Spin, RDF.type, AUTO.Minivan))
g.add((AUTO.Spin, AUTO.marca, Literal("Chevrolet")))
g.add((AUTO.Spin, AUTO.lugares, Literal(7)))
g.add((AUTO.Spin, AUTO.adequadoPara, AUTO.Familia))
g.add((AUTO.Spin, AUTO.naoAdequadoPara, AUTO.Uber))
```

**2. Integrar com LangGraph**
```python
# langgraph_with_ontology.py
from langgraph.graph import StateGraph
from .domain_ontology import VehicleOntology

class VehicleConversationGraph(StateGraph):
    def __init__(self):
        super().__init__()
        self.ontology = VehicleOntology()
        
    def recommendation_node(self, state):
        # Usar ontologia para validar e enriquecer
        vehicle = state['selected_vehicle']
        context = state['user_context']
        
        # Validação semântica
        is_compatible = self.ontology.check_compatibility(
            vehicle=vehicle,
            context=context
        )
        
        if not is_compatible:
            reasons = self.ontology.get_incompatibility_reasons(
                vehicle, context
            )
            state['response'] = self.generate_explanation(reasons)
            state['suggestions'] = self.ontology.find_alternatives(
                vehicle, context
            )
        
        return state
```

**3. Queries Semânticas**
```python
# semantic_search.py
class SemanticVehicleSearch:
    def search_with_context(self, user_query, context):
        # Parse query
        entities = self.extract_entities(user_query)
        
        # Consultar ontologia
        results = self.ontology.query(f"""
            SELECT ?vehicle ?reason
            WHERE {{
                ?vehicle rdf:type :Veiculo .
                ?vehicle :modelo "{entities['model']}" .
                ?vehicle :adequadoPara :{context} .
            }}
        """)
        
        # Enriquecer com explicações
        for vehicle in results:
            vehicle['why_suitable'] = self.ontology.explain(
                vehicle, context
            )
        
        return results
```

---

### Fase 2: Reasoner (2-3 semanas)

**Inferência Automática:**
```python
# ontology_reasoner.py
from owlrl import DeductiveClosure, RDFS_Semantics

class VehicleReasoner:
    def infer_properties(self, vehicle):
        # Aplicar regras de inferência
        DeductiveClosure(RDFS_Semantics).expand(self.graph)
        
        # Inferências automáticas:
        # Se Spin é Minivan
        # E Minivan não é compatível com Uber
        # Então Spin não é compatível com Uber
        
        inferred = self.graph.query("""
            SELECT ?property ?value
            WHERE {
                :Spin ?property ?value .
                FILTER(?property NOT IN (rdf:type))
            }
        """)
        
        return inferred
```

---

### Fase 3: Integração Completa (3-4 semanas)

**Sistema Híbrido:**
```
LLM (GPT/Claude) 
    ↓ extração de entidades
Ontologia 
    ↓ validação + inferência
Knowledge Graph 
    ↓ busca semântica
Vector Search 
    ↓ similaridade
PostgreSQL 
    ↓ dados estruturados
```

---

## 📊 Comparação: Atual vs Com Ontologia

| Aspecto | Atual | Com Ontologia |
|---------|-------|---------------|
| **Validação Uber** | Regex/if-else | Regras semânticas |
| **Recomendações** | Match score numérico | Contexto + Inferência |
| **Explicabilidade** | Limitada | Completa (caminho no grafo) |
| **Manutenção** | Código espalhado | Centralizada (ontologia) |
| **Escalabilidade** | Linear (mais if-else) | Exponencial (inferência) |
| **Erros (Pajero)** | Possíveis | Impossíveis (regras) |
| **Adaptação** | Código novo | Adicionar regra |

---

## 🎯 Casos de Uso Melhorados

### 1. **Contexto Uber**
```
User: "Spin para Uber"

Sem Ontologia:
→ Busca Spin → Retorna → Usuário descobre depois que não pode

Com Ontologia:
→ Spin É Minivan
→ Minivan NÃO_COMPATÍVEL Uber
→ "Spin não é permitida no Uber (é minivan). 
    Para Uber, sugiro: Prisma, Onix, Voyage (sedans compactos)"
```

### 2. **Recomendações Contextuais**
```
User: "Carro 7 lugares para família"

Sem Ontologia:
→ Busca lugares >= 7 → Retorna qualquer (pode incluir não-disponíveis)

Com Ontologia:
→ Query: adequadoPara(Familia) AND lugares >= 7
→ Infere: Minivan, SUV_grande
→ Retorna apenas: Spin, Zafira, Grand Siena (com explicação)
```

### 3. **Validação Multi-critério**
```
User: "SUV para Uber Black"

Sem Ontologia:
→ Pode recomendar SUV premium

Com Ontologia:
→ UberBlack REQUER Sedan
→ SUV NÃO É Sedan
→ "Uber Black aceita apenas sedans premium. 
    Para SUV, considere uso pessoal ou Uber SUV (categoria especial)"
```

---

## 💰 Esforço vs Benefício

### Esforço:
- **Inicial:** Alto (2-4 semanas)
- **Manutenção:** Baixo (adicionar regras é fácil)
- **Complexidade:** Média (curva de aprendizado)

### Benefícios:
- ✅ Elimina erros de classificação (Pajero, Spin, etc)
- ✅ Explicações automáticas e precisas
- ✅ Recomendações contextuais melhores
- ✅ Fácil adicionar novas regras/marcas
- ✅ Escalável para novos contextos (Taxi, Entregador, etc)

---

## 🔮 Recomendação

### Para FaciliAuto, sugiro:

**Curto Prazo (atual):**
- ✅ Manter sistema atual com whitelists
- ✅ Corrigir casos específicos (Pajero, Spin)
- ✅ Focar em UX e conversão

**Médio Prazo (3-6 meses):**
- 🔄 Implementar ontologia básica
- 🔄 Integrar com LangGraph gradualmente
- 🔄 Começar com regras Uber (domínio bem definido)

**Longo Prazo (6+ meses):**
- 🚀 Sistema completo com reasoner
- 🚀 Knowledge graph rico
- 🚀 Inferência automática
- 🚀 Expandir para outros contextos

---

## 🛠️ Ferramentas Sugeridas

**Ontologia:**
- **RDFLib** (Python) - Manipular grafos RDF
- **OWL-RL** - Reasoner leve
- **Apache Jena** - Framework completo (se precisar escalar)

**Knowledge Graph:**
- **Neo4j** - Banco de grafos
- **GraphDB** - Especializado em RDF
- **PostgreSQL + ltree** - Híbrido (atual + grafo)

**Integração:**
- **LangChain** - Já tem suporte para grafos
- **LangGraph** - Workflow + Ontologia
- **SPARQL** - Query language para RDF

---

## 📚 Próximos Passos (se decidir implementar)

1. **POC (1 semana):**
   - Criar ontologia mínima (Sedan, SUV, Minivan, Uber)
   - 10 veículos + regras básicas
   - Testar inferência

2. **MVP Ontologia (2-3 semanas):**
   - Ontologia completa (todos os tipos)
   - Integração com LangGraph
   - Queries semânticas

3. **Produção (4+ semanas):**
   - Reasoner completo
   - Explicações automáticas
   - Dashboard de regras

---

**Conclusão:** Ontologia traria benefícios reais, especialmente para:
- ✅ Eliminar erros de classificação
- ✅ Explicações melhores
- ✅ Escalabilidade

Mas requer investimento inicial. Para o momento atual, o sistema de whitelists já resolve bem. Ontologia seria o "próximo nível" quando escalar. 🚀

---

**Criado:** 2025-11-28  
**Autor:** AI Assistant  
**Status:** Proposta para discussão
