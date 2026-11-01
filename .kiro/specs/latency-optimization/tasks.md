# Plano de Implementação: Otimização de Latência

## Visão Geral

Este plano implementa a estratégia de pré-cálculo de campos de aptidão para reduzir a latência de recomendações de ~60s para < 5s. A implementação usa TypeScript com Prisma e fast-check para testes de propriedade.

## Tasks

- [x] 1. Atualizar Schema do Banco de Dados
  - [x] 1.1 Adicionar novos campos ao schema Prisma
    - Adicionar campo `aptoUberComfort` (Boolean)
    - Adicionar campos de score: `scoreConforto`, `scoreEconomia`, `scoreEspaco`, `scoreSeguranca`, `scoreCustoBeneficio` (Int?)
    - Adicionar campos de categoria: `categoriaVeiculo`, `segmentoPreco` (String?)
    - Adicionar campos de metadados: `classifiedAt`, `classificationVersion` (DateTime?, Int?)
    - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.2_
  
  - [x] 1.2 Criar e executar migration do Prisma
    - Gerar migration com `prisma migrate dev`
    - Verificar que migration foi aplicada corretamente
    - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.2_

- [x] 2. Implementar VehicleAptitudeClassifier
  - [x] 2.1 Criar serviço de classificação de veículos
    - Criar arquivo `src/services/vehicle-aptitude-classifier.service.ts`
    - Implementar interface `IVehicleAptitudeClassifier`
    - Implementar método `classify(vehicle)` que chama LLM com prompt especializado
    - Implementar validação de resultado (scores no intervalo [1,10], enums válidos)
    - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.4_
  
  - [ ]* 2.2 Escrever teste de propriedade para invariante de scores
    - **Property 2: Invariante de Scores no Intervalo [1, 10]**
    - **Validates: Requirements 2.1-2.6**
  
  - [ ]* 2.3 Escrever teste de propriedade para validação de enums
    - **Property 3: Validação de Enums de Categoria**
    - **Property 4: Validação de Enum de Segmento de Preço**
    - **Validates: Requirements 3.1, 3.2**
  
  - [x] 2.4 Implementar fallback determinístico
    - Criar função `getDeterministicClassification(vehicle)` para quando LLM falhar
    - Implementar regras básicas para cada campo de aptidão
    - _Requirements: 1.1-1.7_
  
  - [x]* 2.5 Escrever testes unitários para classificador
    - Teste de classificação de SUV como aptoFamilia
    - Teste de classificação de sedan 2017+ como aptoUberComfort
    - Teste de fallback quando LLM falha
    - _Requirements: 1.1-1.7_

- [x] 3. Checkpoint - Verificar classificador funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implementar DeterministicRanker
  - [x] 4.1 Criar serviço de ranqueamento determinístico
    - Criar arquivo `src/services/deterministic-ranker.service.ts`
    - Implementar mapeamento de uso principal para filtros SQL
    - Implementar método `rank(context)` que usa campos pré-calculados
    - Implementar cálculo de score total baseado em pesos por caso de uso
    - _Requirements: 4.1-4.7_
  
  - [ ]* 4.2 Escrever teste de propriedade para filtro de aptidão
    - **Property 6: Filtro de Aptidão Retorna Apenas Veículos Correspondentes**
    - **Validates: Requirements 4.2**
  
  - [ ]* 4.3 Escrever teste de propriedade para ordenação por score
    - **Property 7: Ordenação por Score Mantém Ordem Decrescente**
    - **Validates: Requirements 4.3**
  
  - [ ]* 4.4 Escrever teste de propriedade para performance
    - **Property 8: Performance de Ranqueamento**
    - **Validates: Requirements 4.8**
  
  - [x]* 4.5 Escrever testes unitários para ranqueador
    - Teste de filtro por aptoFamilia
    - Teste de ordenação por scoreConforto DESC
    - Teste de mapeamento uso "uber" → filtro aptoUber
    - _Requirements: 4.1-4.7_

- [x] 5. Checkpoint - Verificar ranqueador funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrar Classificador no Fluxo de Criação de Veículos
  - [x] 6.1 Atualizar VehicleEligibilityOnCreateService
    - Modificar `src/services/vehicle-eligibility-on-create.service.ts`
    - Chamar `VehicleAptitudeClassifier.classify()` após criação do veículo
    - Persistir todos os campos de aptidão, scores e categorias
    - _Requirements: 1.1-1.7, 2.1-2.6, 3.1-3.4_
  
  - [ ]* 6.2 Escrever teste de propriedade para persistência
    - **Property 1: Persistência de Campos de Aptidão**
    - **Validates: Requirements 1.1-1.7**

- [x] 7. Integrar Ranqueador no Fluxo de Recomendação
  - [x] 7.1 Atualizar VehicleSearchAdapter
    - Modificar `src/services/vehicle-search-adapter.service.ts`
    - Adicionar suporte a novos filtros (aptoUberComfort, categoriaVeiculo, etc.)
    - Usar DeterministicRanker ao invés de VehicleRankerService
    - _Requirements: 4.1-4.7, 5.1-5.5_
  
  - [x] 7.2 Atualizar VehicleExpertAgent
    - Modificar `src/agents/vehicle-expert.agent.ts`
    - Remover chamadas ao VehicleRankerService
    - Usar campos pré-calculados para filtrar e ordenar
    - _Requirements: 5.1-5.5_
  
  - [ ]* 7.3 Escrever teste de integração para fluxo completo
    - Verificar que apenas 2 chamadas LLM são feitas
    - Verificar que tempo total < 5s
    - _Requirements: 5.5, 6.1_

- [x] 8. Checkpoint - Verificar integração funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implementar Script de Migração de Dados
  - [x] 9.1 Criar script de migração para veículos existentes
    - Criar arquivo `scripts/migrate-vehicle-aptitudes.ts`
    - Implementar processamento em lotes (batch de 10 veículos)
    - Implementar logging de progresso
    - Implementar retomada em caso de falha (salvar último ID processado)
    - _Requirements: 7.1-7.4_
  
  - [ ]* 9.2 Escrever testes para script de migração
    - Teste de processamento em lotes
    - Teste de retomada após falha
    - _Requirements: 7.3_

- [x] 10. Adicionar Métricas e Logging de Performance
  - [x] 10.1 Implementar logging de métricas
    - Adicionar logging de tempo para cada etapa do fluxo
    - Adicionar alerta quando tempo > 5s
    - Adicionar contagem de chamadas LLM
    - _Requirements: 6.3, 6.4_

- [x] 11. Checkpoint Final - Verificar todos os testes passando
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia os requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e casos de borda
