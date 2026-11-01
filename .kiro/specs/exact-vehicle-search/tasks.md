# Implementation Plan

- [x] 1. Create ExactSearchParser component






  - [x] 1.1 Create parser interface and types in `src/services/exact-search-parser.service.ts`

    - Define `ExtractedFilters` interface
    - Implement model name extraction using regex patterns for common Brazilian car models
    - Implement year extraction supporting formats: "2019", "19", "2018 a 2020", "2019/2020"
    - Handle year-first and model-first query formats
    - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4_
  - [x] 1.2 Write property test for parser extraction


    - **Property 1: Parser extracts model and year correctly from all valid formats**
    - **Validates: Requirements 1.1, 5.1, 5.2, 5.3, 5.4**

- [x] 2. Create ExactSearchService component





  - [x] 2.1 Create service interface and types in `src/services/exact-search.service.ts`


    - Define `ExactSearchResult` interface with type discriminator
    - Implement `findExactMatches()` method to find vehicles matching model AND year
    - Implement ordering: price desc, mileage asc, version asc
    - Set matchScore to 100 for exact matches
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 2.2 Write property test for exact match prioritization


    - **Property 2: Exact matches are prioritized with score 100**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.3 Write property test for exact match ordering
    - **Property 3: Multiple exact matches are ordered by price desc, mileage asc, version**
    - **Validates: Requirements 1.4**

- [x] 3. Implement unavailability response handling






  - [x] 3.1 Add unavailability message generation in ExactSearchService

    - Generate message format: "Não encontramos {modelo} {ano} disponível no momento"
    - Include requested model and year in response metadata
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Write property test for unavailability response

    - **Property 4: Unavailability response contains requested model and year**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Implement year alternatives feature





  - [x] 4.1 Add `findYearAlternatives()` method to ExactSearchService


    - Find vehicles of same model with different years
    - Order by year proximity to requested year (closest first)
    - Include list of all available years for the model
    - Generate message asking if user wants to consider other years
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Write property test for year alternatives ordering

    - **Property 5: Year alternatives are ordered by proximity to requested year**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 4.3 Write property test for available years list

    - **Property 6: Year alternatives response includes available years list**
    - **Validates: Requirements 3.3, 3.4**

- [x] 5. Implement personalized suggestions feature




  - [x] 5.1 Add `findSimilarSuggestions()` method to ExactSearchService

    - Find vehicles with similar body type to typical vehicles of requested model
    - Filter by similar price range (±30%) and year (±3 years)
    - Include reasoning explaining why each suggestion is relevant
    - Generate message asking if user wants to see similar vehicles
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 5.2 Write property test for suggestion similarity criteria


    - **Property 7: Personalized suggestions match similarity criteria**
    - **Validates: Requirements 4.1, 4.2**
  - [x] 5.3 Write property test for suggestion reasoning



    - **Property 8: All suggestions include non-empty reasoning**
    - **Validates: Requirements 4.3, 4.4**

- [x] 6. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.


- [x] 7. Create SearchResultSerializer component




  - [x] 7.1 Create serializer in `src/services/search-result-serializer.service.ts`
    - Implement `serialize()` method to convert ExactSearchResult to JSON string
    - Implement `deserialize()` method to parse JSON back to ExactSearchResult
    - Include search type indicator and all metadata in serialization
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 7.2 Write property test for serialization round-trip



    - **Property 9: Serialization round-trip preserves data integrity**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 8. Integrate with existing search flow






  - [x] 8.1 Update `vehicle-search-adapter.service.ts` to use ExactSearchService

    - Add ExactSearchParser call at beginning of search method
    - Route to ExactSearchService when model+year filters are detected
    - Fall back to existing semantic search for other queries
    - _Requirements: 1.1, 1.2_

  - [x] 8.2 Update `recommendation.agent.ts` to handle exact search results

    - Modify `handleSpecificModelRequest()` to use new ExactSearchService
    - Update response formatting for year alternatives and suggestions
    - _Requirements: 2.1, 3.1, 4.1_

- [x] 9. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
