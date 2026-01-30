# Documento de Requisitos

## Introdução

Este documento especifica os requisitos para a otimização de latência do sistema de recomendação de veículos. Atualmente, o sistema leva aproximadamente 60 segundos para gerar recomendações devido ao uso de LLM em tempo de execução para ranquear veículos. A solução proposta é pré-calcular campos de aptidão dos veículos no momento da inserção/atualização no banco de dados, permitindo filtragem SQL rápida em tempo de execução.

## Glossário

- **Sistema_Classificador**: Serviço responsável por calcular e persistir os campos de aptidão dos veículos usando LLM no momento da inserção/atualização.
- **Sistema_Recomendador**: Serviço responsável por filtrar e ordenar veículos usando campos pré-calculados via SQL.
- **Campos_Aptidao**: Conjunto de campos booleanos e scores numéricos que indicam a adequação de um veículo para diferentes casos de uso.
- **LLM**: Large Language Model usado para análise semântica de preferências do usuário e geração de respostas conversacionais.
- **Veículo**: Entidade do banco de dados representando um carro disponível para venda.

## Requisitos

### Requisito 1: Pré-cálculo de Campos de Aptidão

**User Story:** Como sistema, quero calcular campos de aptidão no momento da inserção/atualização de veículos, para que as recomendações possam ser geradas rapidamente via SQL.

#### Critérios de Aceitação

1. WHEN um veículo é inserido no banco de dados THEN o Sistema_Classificador SHALL calcular e persistir todos os campos de aptidão usando LLM
2. WHEN um veículo é atualizado no banco de dados THEN o Sistema_Classificador SHALL recalcular e persistir todos os campos de aptidão usando LLM
3. THE Sistema_Classificador SHALL calcular o campo `aptoFamilia` (boolean) baseado em espaço interno, segurança e suporte a Isofix
4. THE Sistema_Classificador SHALL calcular o campo `aptoUberX` (boolean) baseado em ano >= 2016, 4 portas e ar-condicionado
5. THE Sistema_Classificador SHALL calcular o campo `aptoUberComfort` (boolean) baseado em ano >= 2017, sedan/SUV e modelos não excluídos
6. THE Sistema_Classificador SHALL calcular o campo `aptoUberBlack` (boolean) baseado em ano >= 2018 e categoria executivo/premium
7. THE Sistema_Classificador SHALL calcular o campo `aptoTrabalho` (boolean) baseado em durabilidade e economia
8. THE Sistema_Classificador SHALL calcular o campo `aptoViagem` (boolean) baseado em conforto, economia e espaço de porta-malas
9. THE Sistema_Classificador SHALL calcular o campo `scoreConforto` (inteiro 1-10) representando nível de conforto do veículo
10. THE Sistema_Classificador SHALL calcular o campo `scoreEconomia` (inteiro 1-10) representando economia de combustível
11. THE Sistema_Classificador SHALL calcular o campo `scoreEspaco` (inteiro 1-10) representando espaço interno e porta-malas

### Requisito 2: Prompt de Classificação LLM

**User Story:** Como desenvolvedor, quero que o prompt de classificação LLM encode os critérios do RANKING_SYSTEM_PROMPT atual, para que a pré-classificação seja consistente com a lógica de negócio existente.

#### Critérios de Aceitação

1. THE Sistema_Classificador SHALL usar um prompt que encode as regras de família do RANKING_SYSTEM_PROMPT (espaço, segurança, Isofix, penalização de hatches compactos)
2. THE Sistema_Classificador SHALL usar um prompt que encode as regras oficiais Uber 2026 (anos mínimos, modelos excluídos, categorias)
3. THE Sistema_Classificador SHALL usar um prompt que encode as regras de viagem (conforto, economia, bagagem)
4. THE Sistema_Classificador SHALL usar um prompt que encode as regras de trabalho (durabilidade, economia, custo de manutenção)
5. THE Sistema_Classificador SHALL retornar resposta em formato JSON estruturado e validável

### Requisito 3: Filtragem SQL em Tempo de Execução

**User Story:** Como usuário, quero receber recomendações de veículos em menos de 5 segundos, para que minha experiência seja fluida e responsiva.

#### Critérios de Aceitação

1. WHEN o Sistema_Recomendador recebe uma solicitação de recomendação THEN ele SHALL filtrar veículos usando campos pré-calculados via SQL
2. WHEN o caso de uso é "família" THEN o Sistema_Recomendador SHALL filtrar por `aptoFamilia = true` e ordenar por `scoreEspaco` e `scoreConforto`
3. WHEN o caso de uso é "Uber" THEN o Sistema_Recomendador SHALL filtrar pelo campo de aptidão correspondente à categoria (X, Comfort, Black)
4. WHEN o caso de uso é "viagem" THEN o Sistema_Recomendador SHALL filtrar por `aptoViagem = true` e ordenar por `scoreConforto` e `scoreEconomia`
5. WHEN o caso de uso é "trabalho" THEN o Sistema_Recomendador SHALL filtrar por `aptoTrabalho = true` e ordenar por `scoreEconomia`
6. THE Sistema_Recomendador SHALL completar a filtragem e ordenação em menos de 5 segundos

### Requisito 4: Uso de LLM em Tempo de Execução

**User Story:** Como sistema, quero manter o LLM apenas para tarefas que requerem compreensão semântica, para que a latência seja minimizada sem perder qualidade conversacional.

#### Critérios de Aceitação

1. THE Sistema_Recomendador SHALL usar LLM para extrair preferências do usuário a partir de mensagens em linguagem natural
2. THE Sistema_Recomendador SHALL usar LLM para gerar respostas conversacionais naturais ao apresentar recomendações
3. THE Sistema_Recomendador SHALL usar LLM para casos complexos que não podem ser resolvidos por filtragem simples
4. THE Sistema_Recomendador SHALL NOT usar LLM para ranquear ou pontuar veículos em tempo de execução

### Requisito 5: Migração de Veículos Existentes

**User Story:** Como administrador, quero que os veículos existentes sejam migrados para ter os novos campos de aptidão, para que o sistema funcione corretamente após a atualização.

#### Critérios de Aceitação

1. WHEN o script de migração é executado THEN o Sistema_Classificador SHALL processar todos os veículos existentes e calcular seus campos de aptidão
2. THE script de migração SHALL processar veículos em lotes para evitar sobrecarga do LLM
3. THE script de migração SHALL registrar progresso e permitir retomada em caso de falha
4. THE script de migração SHALL validar que todos os veículos foram processados ao final

### Requisito 6: Extensão do Schema do Banco de Dados

**User Story:** Como desenvolvedor, quero que o schema do banco de dados seja estendido com os novos campos, para que os dados de aptidão possam ser persistidos.

#### Critérios de Aceitação

1. THE schema do Vehicle SHALL incluir o campo `aptoUberComfort` (Boolean, default false)
2. THE schema do Vehicle SHALL incluir o campo `scoreConforto` (Int, nullable, range 1-10)
3. THE schema do Vehicle SHALL incluir o campo `scoreEconomia` (Int, nullable, range 1-10)
4. THE schema do Vehicle SHALL incluir o campo `scoreEspaco` (Int, nullable, range 1-10)
5. THE schema do Vehicle SHALL incluir índices nos campos de aptidão para otimizar queries de filtragem
