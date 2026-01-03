# Debug: Busca Retornando Vazio

## Problema
Sistema não retorna veículos mesmo com 57 disponíveis no banco de dados.

**Cenário:**
- Usuário: Orçamento R$ 30.000, uso "trabalho todos os dias"
- Banco: 57 veículos disponíveis
- Resultado: "não encontrei veículos"

## Diagnóstico

### Sintomas Observados
1. ✅ Log "Generated recommendations" aparece
2. ❌ Log `🔍 Vector search:` NÃO aparece nos logs de produção
3. ❌ Array de recomendações retorna vazio
4. ❌ Fallback SQL não está sendo acionado corretamente

### Possíveis Causas

#### 1. Vector Store Não Inicializado
- Vector store inicializa em background (não-bloqueante)
- Primeira busca pode acontecer ANTES da inicialização terminar
- Quando não inicializado, retorna array vazio → deveria acionar fallback SQL

#### 2. Embeddings Não Gerados
- Veículos podem não ter embeddings salvos no banco
- Geração de embeddings pode estar falhando silenciosamente
- Campo `embedding` pode estar NULL para todos os veículos

#### 3. Filtros Muito Restritivos
- Filtro `aptoTrabalho` pode estar excluindo muitos veículos
- Combinação de filtros (preço + ano + uso) pode não ter matches
- Threshold de similaridade (0.3) ainda pode ser alto

#### 4. Fallback SQL Não Funciona
- Condições para acionar fallback podem estar incorretas
- Filtros no fallback SQL podem ser muito restritivos
- Query SQL pode ter erro de sintaxe ou lógica

## Correções Implementadas

### 1. Logs Detalhados no Vector Store
```typescript
// src/services/in-memory-vector.service.ts
console.log(`🔍 Vector search START: query="${queryText}", embeddings=${this.embeddings.length}, limit=${limit}`);
console.log(`🔍 Vector search RESULTS: ${topResults.length}/${results.length} above threshold ${MIN_SIMILARITY}`);
console.log('Top 3 matches:', topResults.slice(0, 3).map(...));
```

**O que vai revelar:**
- Se vector store está inicializado
- Quantos embeddings estão carregados
- Quais veículos têm maior similaridade
- Se threshold está bloqueando resultados

### 2. Logs no VehicleSearchAdapter
```typescript
// src/services/vehicle-search-adapter.service.ts
logger.info({ 
  query, 
  filters,
  vectorStoreReady: inMemoryVectorStore.isInitialized(),
  vectorStoreCount: inMemoryVectorStore.getCount()
}, '🔍 VehicleSearchAdapter.search START');

logger.info({ query, limit }, '🔍 Calling inMemoryVectorStore.search');
logger.info({ vehicleIds: vehicleIds.length }, '🔍 Vector search returned IDs');
```

**O que vai revelar:**
- Se vector store está pronto quando busca é chamada
- Quantos IDs são retornados pela busca vetorial
- Se fallback SQL está sendo acionado

### 3. Logs no SQL Fallback
```typescript
// src/services/vehicle-search-adapter.service.ts
logger.info({ 
  filters,
  maxPrice: filters.maxPrice,
  minYear: filters.minYear,
  bodyType: filters.bodyType,
  aptoTrabalho: filters.aptoTrabalho
}, '🔍 SQL FALLBACK: Building query');

logger.info({ 
  filters, 
  found: vehicles.length,
  sample: vehicles.slice(0, 2).map(...)
}, '🔍 SQL FALLBACK: Results');
```

**O que vai revelar:**
- Quais filtros estão sendo aplicados
- Quantos veículos são encontrados
- Exemplos de veículos retornados

### 4. Logs no getRecommendations
```typescript
// src/agents/vehicle-expert.agent.ts
logger.info({
  profile: { budget, minYear, usage, ... },
  query: { searchText, filters }
}, '🔍 getRecommendations START - Profile and Query');

logger.info({
  isUberBlack, isUberX, isFamily, isWork, wantsPickup, wantsMoto,
  searchText, filters: { ... }
}, '🔍 BEFORE vehicleSearchAdapter.search - Full context');

logger.info({
  resultsCount: results.length,
  sample: results.slice(0, 2).map(...)
}, '🔍 AFTER vehicleSearchAdapter.search - Results');
```

**O que vai revelar:**
- Como o perfil do usuário está sendo interpretado
- Quais filtros estão sendo aplicados
- Se a busca está retornando resultados

## Próximos Passos

### 1. Deploy e Análise de Logs ⏳
```bash
git add .
git commit -m "feat: adicionar logs detalhados para debug de busca vazia"
git push origin main
git push novais main
```

Após deploy no Railway, analisar logs para:
- ✅ Confirmar se vector store está inicializado
- ✅ Ver quantos embeddings estão carregados
- ✅ Identificar onde a busca está falhando
- ✅ Verificar se fallback SQL está funcionando

### 2. Verificar Embeddings no Banco 🔍
```sql
-- Contar veículos com embeddings
SELECT COUNT(*) FROM "Vehicle" WHERE embedding IS NOT NULL;

-- Contar veículos disponíveis
SELECT COUNT(*) FROM "Vehicle" WHERE disponivel = true;

-- Contar veículos aptos para trabalho
SELECT COUNT(*) FROM "Vehicle" 
WHERE disponivel = true 
AND "aptoTrabalho" = true 
AND preco <= 30000;
```

### 3. Testar Localmente 🧪
```bash
# Resetar conversa
curl -X POST http://localhost:3000/api/reset-conversation \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "5511999999999"}'

# Simular mensagem
# "Olá, tenho 30 mil e preciso de um carro para trabalho todos os dias"
```

### 4. Correções Adicionais (Se Necessário)

#### Se Vector Store Não Está Inicializado:
- Aumentar timeout de inicialização
- Fazer inicialização síncrona (bloquear servidor até terminar)
- Adicionar retry automático

#### Se Embeddings Não Existem:
- Rodar seed novamente para gerar embeddings
- Adicionar job para gerar embeddings em background
- Verificar se API da OpenAI está funcionando

#### Se Filtros Muito Restritivos:
- Remover filtro `aptoTrabalho` (deixar apenas preço e ano)
- Aumentar orçamento em 10% automaticamente
- Relaxar ano mínimo em 1-2 anos

#### Se Fallback SQL Não Funciona:
- Simplificar query SQL (remover filtros opcionais)
- Fazer fallback SEMPRE retornar pelo menos 1 veículo
- Adicionar fallback de "veículos similares" quando não encontra exato

## Checklist de Validação

Após deploy, verificar:

- [ ] Log `🔍 Vector search START` aparece
- [ ] Log mostra `embeddings=57` (ou número correto)
- [ ] Log `🔍 Vector search RESULTS` mostra matches
- [ ] Se não houver matches, log `🔍 SQL FALLBACK` aparece
- [ ] SQL fallback retorna pelo menos 1 veículo
- [ ] Usuário recebe recomendações (não "não encontrei")

## Métricas de Sucesso

- ✅ 100% das buscas com orçamento válido retornam pelo menos 1 veículo
- ✅ Tempo de resposta < 3 segundos
- ✅ Logs claros para debug em produção
- ✅ Fallback SQL funciona quando vector search falha

## Referências

- `src/services/in-memory-vector.service.ts` - Busca vetorial
- `src/services/vehicle-search-adapter.service.ts` - Adapter e fallbacks
- `src/agents/vehicle-expert.agent.ts` - Geração de recomendações
- `prisma/schema.prisma` - Schema do banco (campo `aptoTrabalho`)
