# Requirements Document

## Introduction

Este documento especifica os requisitos para a funcionalidade de busca exata de veículos. Quando um usuário busca por um veículo específico (modelo + ano), o sistema deve priorizar correspondências exatas. Se o veículo exato não estiver disponível, o sistema deve informar claramente ao usuário e oferecer alternativas relevantes (outros anos do mesmo modelo ou sugestões personalizadas).

## Glossary

- **Sistema de Busca**: Componente responsável por processar consultas de veículos e retornar resultados relevantes
- **Busca Exata**: Consulta que especifica modelo E ano do veículo (ex: "Onix 2019")
- **Correspondência Exata**: Veículo que corresponde tanto ao modelo quanto ao ano especificado
- **Alternativas de Ano**: Veículos do mesmo modelo mas de anos diferentes
- **Sugestões Personalizadas**: Veículos similares baseados nas preferências do usuário
- **Filtros Extraídos**: Parâmetros de busca (marca, modelo, ano) identificados na mensagem do usuário

## Requirements

### Requirement 1

**User Story:** Como usuário, quero buscar um veículo específico por modelo e ano, para encontrar exatamente o carro que procuro.

#### Acceptance Criteria

1. WHEN a user searches for a vehicle with model and year (e.g., "Onix 2019") THEN the Sistema de Busca SHALL extract both model name and year as separate Filtros Extraídos
2. WHEN Filtros Extraídos contain both model and year THEN the Sistema de Busca SHALL prioritize vehicles matching both criteria in search results
3. WHEN a Correspondência Exata exists in inventory THEN the Sistema de Busca SHALL return that vehicle as the first result with matchScore of 100
4. WHEN multiple Correspondências Exatas exist THEN the Sistema de Busca SHALL order results by price descending, mileage ascending, then by version

### Requirement 2

**User Story:** Como usuário, quero ser informado quando o veículo exato que busco não está disponível, para saber que preciso considerar alternativas.

#### Acceptance Criteria

1. WHEN a user searches for a specific model and year AND no Correspondência Exata exists THEN the Sistema de Busca SHALL return a response indicating the exact vehicle is not available
2. WHEN no Correspondência Exata exists THEN the Sistema de Busca SHALL include the requested model and year in the unavailability message
3. WHEN generating unavailability message THEN the Sistema de Busca SHALL format the message as "Não encontramos {modelo} {ano} disponível no momento"

### Requirement 3

**User Story:** Como usuário, quero ver outros anos do mesmo modelo quando o ano específico não está disponível, para avaliar se outro ano me atende.

#### Acceptance Criteria

1. WHEN no Correspondência Exata exists AND other years of the same model exist THEN the Sistema de Busca SHALL return Alternativas de Ano as suggestions
2. WHEN returning Alternativas de Ano THEN the Sistema de Busca SHALL order results by year proximity to the requested year
3. WHEN returning Alternativas de Ano THEN the Sistema de Busca SHALL include a message asking if the user wants to consider other years
4. WHEN Alternativas de Ano are presented THEN the Sistema de Busca SHALL display available years for that model

### Requirement 4

**User Story:** Como usuário, quero receber sugestões personalizadas quando nem o modelo exato nem outros anos estão disponíveis, para encontrar alternativas relevantes.

#### Acceptance Criteria

1. WHEN no vehicles of the requested model exist in inventory THEN the Sistema de Busca SHALL return Sugestões Personalizadas based on similar vehicle characteristics
2. WHEN generating Sugestões Personalizadas THEN the Sistema de Busca SHALL consider same body type, similar price range, and similar year
3. WHEN returning Sugestões Personalizadas THEN the Sistema de Busca SHALL include reasoning explaining why each suggestion is relevant
4. WHEN no Correspondência Exata and no Alternativas de Ano exist THEN the Sistema de Busca SHALL ask if the user wants to see similar vehicles

### Requirement 5

**User Story:** Como usuário, quero que o sistema entenda variações na forma como especifico modelo e ano, para que minha busca funcione independente do formato.

#### Acceptance Criteria

1. WHEN a user specifies year before model (e.g., "2019 Onix") THEN the Sistema de Busca SHALL correctly extract both Filtros Extraídos
2. WHEN a user uses abbreviated year format (e.g., "Onix 19") THEN the Sistema de Busca SHALL interpret as full year (2019)
3. WHEN a user specifies year range (e.g., "Onix 2018 a 2020") THEN the Sistema de Busca SHALL search for vehicles within that year range
4. WHEN a user uses slash format (e.g., "Onix 2019/2020") THEN the Sistema de Busca SHALL search for both model years

### Requirement 6

**User Story:** Como desenvolvedor, quero que o sistema serialize e deserialize os resultados de busca corretamente, para garantir integridade dos dados entre componentes.

#### Acceptance Criteria

1. WHEN search results are generated THEN the Sistema de Busca SHALL serialize results to a structured format containing all vehicle data and metadata
2. WHEN serialized results are consumed THEN the Sistema de Busca SHALL deserialize back to the original data structure without data loss
3. WHEN serializing search results THEN the Sistema de Busca SHALL include search type indicator (exact, year_alternatives, or suggestions)
