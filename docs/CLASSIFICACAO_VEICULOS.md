# Classificação Automática de Veículos

## Problema

Os veículos no banco de dados não têm os campos de aptidão preenchidos:
- `aptoUber` - Apto para Uber X / 99Pop
- `aptoUberBlack` - Apto para Uber Black / 99Black  
- `aptoFamilia` - Adequado para famílias
- `aptoTrabalho` - Adequado para trabalho diário
- `economiaCombustivel` - Economia de combustível (baixa, media, alta)

Isso faz com que as buscas com filtros específicos (ex: "carro para trabalho") retornem vazio, mesmo havendo veículos adequados no estoque.

## Solução

Usar o **VehicleClassifier** com LLM para classificar automaticamente TODOS os veículos do banco, garantindo que os critérios sejam aplicados de forma consistente e atualizada.

### Por que usar LLM?

1. **Critérios Complexos**: Uber/99 têm requisitos específicos que variam por cidade e categoria
2. **Contexto Atualizado**: LLM tem conhecimento dos critérios mais recentes
3. **Consistência**: Mesma lógica aplicada a todos os veículos
4. **Flexibilidade**: Fácil ajustar critérios sem reescrever código

## Como Usar

### 1. Classificar Todos os Veículos

```bash
npm run vehicles:classify
```

Este comando:
- Busca todos os veículos disponíveis no banco
- Classifica cada um usando o `VehicleClassifier` (que usa LLM)
- Atualiza os campos de aptidão no banco
- Mostra estatísticas ao final

### 2. Classificar no Railway (Produção)

Você pode executar o script diretamente no Railway:

```bash
# Via Railway CLI
railway run npm run vehicles:classify

# Ou via endpoint admin (se disponível)
curl -X POST https://seu-app.railway.app/admin/classify-vehicles
```

### 3. Classificar Automaticamente no Seed

Adicione a classificação ao final do seed:

```typescript
// src/scripts/seed-renatinhu-complete.ts

// Após criar os veículos
console.log('🔍 Classificando veículos...');
await import('./classify-all-vehicles');
```

## Critérios de Classificação

### Uber X / 99Pop (`aptoUber`)
- Ano: 2012 ou mais novo
- Ar condicionado: Obrigatório
- Portas: 4 portas
- Carroceria: Sedan, Hatch ou SUV compacto
- Quilometragem: Razoável para o ano

### Uber Black / 99Black (`aptoUberBlack`)
- Ano: 2018 ou mais novo
- Ar condicionado: Obrigatório
- Portas: 4 portas
- Carroceria: Sedan médio/grande ou SUV premium
- Cor: Preferencialmente preto
- Acabamento: Premium (couro, multimídia, etc.)

### Família (`aptoFamilia`)
- Portas: 4 ou mais
- Carroceria: SUV, Sedan médio/grande, Minivan
- Espaço: Porta-malas amplo
- Segurança: Airbag, ABS
- Conforto: Ar condicionado

### Trabalho (`aptoTrabalho`)
- Economia: Combustível flex ou gasolina
- Confiabilidade: Marcas conhecidas
- Manutenção: Peças acessíveis
- Ar condicionado: Obrigatório
- Quilometragem: Não muito alta

## Exemplo de Saída

```
🚗 Classificando TODOS os veículos do banco...

📊 Total de veículos a classificar: 57

🔍 Classificando: Honda Civic 2016
  ✅ Classificado:
     - Uber X/99Pop: ✓
     - Uber Black/99Black: ✗
     - Família: ✓
     - Trabalho: ✓

🔍 Classificando: BMW X5 2010
  ✅ Classificado:
     - Uber X/99Pop: ✗ (ano < 2012)
     - Uber Black/99Black: ✗ (ano < 2018)
     - Família: ✓
     - Trabalho: ✗ (consumo alto)

...

📊 Resumo da Classificação:
  ✅ Classificados: 57
  ❌ Erros: 0
  📈 Total: 57

📈 Estatísticas Finais:
  🚕 Aptos para Uber X/99Pop: 23
  🚙 Aptos para Uber Black/99Black: 8
  👨‍👩‍👧‍👦 Aptos para Família: 35
  💼 Aptos para Trabalho: 42

✅ Classificação concluída!
```

## Integração com Busca

Após classificar os veículos, as buscas funcionarão corretamente:

```typescript
// Busca por veículos para trabalho
const results = await vehicleSearchAdapter.search('carro para trabalho', {
  maxPrice: 30000,
  aptoTrabalho: true, // ← Agora funciona!
});
```

## Manutenção

### Quando Reclassificar?

- **Novos veículos**: Sempre que adicionar veículos ao estoque
- **Mudança de critérios**: Se Uber/99 mudarem requisitos
- **Atualização de dados**: Se corrigir informações de veículos existentes

### Classificação Incremental

Para classificar apenas veículos não classificados:

```typescript
// Buscar apenas veículos sem classificação
const vehicles = await prisma.vehicle.findMany({
  where: {
    disponivel: true,
    aptoTrabalho: null, // ou false
  },
});
```

## Custos

- **OpenAI GPT-4o-mini**: ~$0.15 por 1M tokens de entrada
- **Estimativa**: ~100 tokens por veículo = $0.000015 por veículo
- **57 veículos**: ~$0.001 (menos de 1 centavo)

## Próximos Passos

1. ✅ Executar `npm run vehicles:classify` localmente
2. ✅ Validar resultados no banco
3. ✅ Testar buscas com filtros
4. ✅ Executar no Railway (produção)
5. ✅ Adicionar ao processo de seed

## Referências

- `src/services/vehicle-classifier.service.ts` - Serviço de classificação
- `src/scripts/classify-all-vehicles.ts` - Script de classificação em lote
- `src/routes/admin.routes.ts` - Endpoint `/admin/classify-vehicles`
