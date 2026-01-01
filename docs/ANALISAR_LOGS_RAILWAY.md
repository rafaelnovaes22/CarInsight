# Como Analisar Logs no Railway

## Acesso aos Logs

1. Acesse o Railway: https://railway.app
2. Selecione o projeto `faciliauto-mvp-v2`
3. Clique no serviço (deployment)
4. Vá na aba **"Logs"**

## Logs Críticos para Debug

### 1. Inicialização do Vector Store

Procure por:
```
🧠 Inicializando vector store in-memory (background)...
📊 Carregando embeddings para X veículos...
✅ Vector store pronto: X carregados do DB, Y gerados novos
```

**O que verificar:**
- ✅ Quantos veículos foram carregados? (deve ser ~57)
- ✅ Quantos embeddings vieram do DB vs. gerados novos?
- ❌ Se aparecer erro, qual é?

### 2. Busca de Veículos (Início)

Procure por:
```
🔍 getRecommendations START - Profile and Query
```

**O que verificar:**
- Budget do usuário (ex: 30000)
- Uso principal (ex: "trabalho")
- Filtros aplicados (minYear, bodyType, etc.)

### 3. Busca Vetorial

Procure por:
```
🔍 VehicleSearchAdapter.search START
🔍 Calling inMemoryVectorStore.search
🔍 Vector search START: query="...", embeddings=X, limit=Y
🔍 Vector search RESULTS: X/Y above threshold 0.3
```

**O que verificar:**
- ✅ `vectorStoreReady: true` (se false, vector store não está pronto)
- ✅ `vectorStoreCount: 57` (ou número correto de veículos)
- ✅ `embeddings=57` (confirma que embeddings estão carregados)
- ✅ Quantos resultados acima do threshold? (ex: "5/57")
- ✅ Top 3 matches mostram veículos relevantes?

### 4. Fallback SQL (Se Busca Vetorial Falhar)

Procure por:
```
Semantic search returned empty, falling back to SQL
🔍 SQL FALLBACK: Building query
🔍 SQL FALLBACK: Results
```

**O que verificar:**
- Quais filtros estão sendo aplicados?
- Quantos veículos foram encontrados?
- Exemplos de veículos retornados (marca, modelo, ano, preço)

### 5. Resultado Final

Procure por:
```
🔍 AFTER vehicleSearchAdapter.search - Results
Generated recommendations
```

**O que verificar:**
- ✅ `resultsCount > 0` (deve ter pelo menos 1 veículo)
- ✅ Sample mostra veículos corretos?
- ❌ Se `resultsCount: 0`, algo está errado

## Cenários de Erro

### Cenário 1: Vector Store Não Inicializado
```
⚠️  Vector store ainda não pronto, usando fallback SQL
```

**Causa:** Primeira busca aconteceu antes da inicialização terminar

**Solução:**
- Verificar se fallback SQL está funcionando
- Se não funcionar, aumentar timeout de inicialização

### Cenário 2: Nenhum Embedding Carregado
```
✅ Vector store pronto: 0 carregados do DB, 0 gerados novos
```

**Causa:** Veículos no banco não têm embeddings

**Solução:**
```bash
# Rodar seed novamente para gerar embeddings
npm run db:seed:complete
```

### Cenário 3: Busca Vetorial Retorna Vazio
```
🔍 Vector search RESULTS: 0/57 above threshold 0.3
⚠️  No results above threshold, returning top matches without filter
```

**Causa:** Query do usuário muito diferente dos veículos

**Solução:**
- Verificar se fallback sem threshold está funcionando
- Reduzir threshold ainda mais (0.3 → 0.2)
- Melhorar descrições dos veículos para embeddings

### Cenário 4: SQL Fallback Retorna Vazio
```
🔍 SQL FALLBACK: Results
found: 0
```

**Causa:** Filtros muito restritivos (preço, ano, aptoTrabalho)

**Solução:**
- Verificar quais filtros estão sendo aplicados
- Remover filtro `aptoTrabalho` se estiver bloqueando
- Aumentar orçamento em 10% automaticamente
- Relaxar ano mínimo

## Comandos Úteis

### Filtrar Logs por Palavra-Chave

No Railway, use a barra de busca:
- `🔍` - Todos os logs de busca
- `Vector search` - Logs de busca vetorial
- `SQL FALLBACK` - Logs de fallback SQL
- `Generated recommendations` - Resultado final
- `ERROR` - Erros

### Verificar Banco de Dados

Se precisar verificar o banco diretamente:

```sql
-- Contar veículos disponíveis
SELECT COUNT(*) FROM "Vehicle" WHERE disponivel = true;

-- Contar veículos com embeddings
SELECT COUNT(*) FROM "Vehicle" WHERE embedding IS NOT NULL;

-- Contar veículos aptos para trabalho até R$ 30k
SELECT COUNT(*) FROM "Vehicle" 
WHERE disponivel = true 
AND "aptoTrabalho" = true 
AND preco <= 30000;

-- Ver exemplos de veículos
SELECT marca, modelo, ano, preco, "aptoTrabalho", carroceria
FROM "Vehicle"
WHERE disponivel = true
AND preco <= 30000
ORDER BY preco DESC
LIMIT 10;
```

## Checklist de Validação

Após analisar os logs, confirme:

- [ ] Vector store inicializou com sucesso
- [ ] Embeddings foram carregados (57 veículos)
- [ ] Busca vetorial está sendo chamada
- [ ] Busca vetorial retorna IDs de veículos
- [ ] Se busca vetorial falhar, fallback SQL é acionado
- [ ] SQL fallback retorna pelo menos 1 veículo
- [ ] Usuário recebe recomendações (não "não encontrei")

## Próximos Passos

1. **Analisar logs no Railway** seguindo este guia
2. **Identificar onde está falhando** (vector store, busca, fallback)
3. **Aplicar correção específica** baseado no cenário
4. **Testar novamente** com mesmo cenário (R$ 30k, trabalho)
5. **Documentar solução** para referência futura

## Contato

Se encontrar algo inesperado nos logs, documente:
- Timestamp do log
- Mensagem completa do erro
- Contexto (o que o usuário disse)
- Screenshot se possível

Isso ajuda a diagnosticar e corrigir mais rápido.
