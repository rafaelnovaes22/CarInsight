# Implementation Plan: Vehicle Fallback Recommendations

## Overview

This implementation plan breaks down the vehicle fallback recommendations feature into discrete coding tasks. The feature enhances the WhatsApp vehicle sales bot to provide intelligent alternative recommendations when a user's exact vehicle request cannot be fulfilled.

## Tasks

- [x] 1. Create core data models and type definitions
  - [x] 1.1 Create fallback types and interfaces in `src/services/fallback.types.ts`
    - Define `FallbackConfig`, `FallbackResult`, `FallbackType`, `FallbackVehicleMatch`, `MatchingCriterion`, `FallbackMetadata` interfaces
    - Define `SimilarityCriteria`, `SimilarityWeights` interfaces
    - _Requirements: 2.6, 5.2, 5.3_
  
  - [x] 1.2 Create vehicle profile mapping in `src/services/vehicle-profiles.ts`
    - Define `VehicleProfile` interface with model, category, segment, typicalPriceRange
    - Create `VEHICLE_PROFILES` constant with mappings for common Brazilian vehicles
    - Create `CATEGORY_MAPPING` for normalizing body type variations
    - Implement `normalizeCategory()` and `getVehicleProfile()` helper functions
    - _Requirements: 2.2, 2.3_

- [x] 2. Implement SimilarityCalculator service
  - [x] 2.1 Create `src/services/similarity-calculator.service.ts`
    - Implement constructor with configurable weights
    - Implement `calculate()` method that returns score and matching criteria
    - Implement `calculateCategoryScore()` for category matching
    - Implement `calculatePriceProximityScore()` for price range matching
    - Implement `calculateFeatureScore()` for transmission/fuel matching
    - _Requirements: 2.2, 2.3, 2.5, 2.6_
  
  - [x] 2.2 Write property test for similarity score monotonicity
    - **Property 6: Similarity Score Monotonicity**
    - **Validates: Requirements 2.5, 2.6**

- [x] 3. Implement FallbackService core functionality
  - [x] 3.1 Create `src/services/fallback.service.ts` with constructor and main `findAlternatives()` method
    - Implement fallback priority chain logic
    - Implement result limiting to maxResults
    - _Requirements: 4.1, 1.5_
  
  - [x] 3.2 Implement `findYearAlternatives()` method
    - Find same model vehicles with different years
    - Calculate year proximity scores
    - Sort by year proximity, then price desc, then mileage asc
    - Include available years in result
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.3_
  
  - [x] 3.3 Write property test for year proximity scoring
    - **Property 1: Year Proximity Scoring**
    - **Validates: Requirements 1.3**
  
  - [x] 3.4 Write property test for year alternatives sorting
    - **Property 2: Year Alternatives Sorting**
    - **Validates: Requirements 1.2, 1.4**
  
  - [x] 3.5 Implement `findSameBrandAlternatives()` method
    - Find vehicles of same brand and same category
    - Filter by price range (±20%)
    - Calculate similarity scores
    - Sort by similarity score descending
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 3.6 Implement `findSameCategoryAlternatives()` method
    - Find vehicles of same category (any brand)
    - Filter by price range (±20%)
    - Calculate similarity scores
    - Sort by similarity score descending
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 3.7 Implement `findPriceRangeAlternatives()` method
    - Find vehicles within price range only
    - Calculate similarity scores
    - Sort by similarity score descending
    - _Requirements: 4.5_
  
  - [x] 3.8 Write property test for similar profile filtering
    - **Property 4: Similar Profile Filtering**
    - **Validates: Requirements 2.2, 2.3**
  
  - [x] 3.9 Write property test for brand priority in similar profiles
    - **Property 5: Brand Priority in Similar Profiles**
    - **Validates: Requirements 2.4**
  
  - [x] 3.10 Write property test for similarity score sorting
    - **Property 7: Similarity Score Sorting**
    - **Validates: Requirements 2.7**
  
  - [x] 3.11 Write property test for fallback priority chain
    - **Property 8: Fallback Priority Chain**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
  
  - [x] 3.12 Write property test for maximum results invariant
    - **Property 3: Maximum Results Invariant**
    - **Validates: Requirements 1.5**

- [x] 4. Checkpoint - Ensure all FallbackService tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement FallbackResponseFormatter
  - [x] 5.1 Create `src/services/fallback-response-formatter.service.ts`
    - Implement `format()` method that returns `FormattedFallbackResponse`
    - Implement `formatAcknowledgment()` for unavailability message in Portuguese
    - Implement `formatAlternative()` for each vehicle
    - Implement `generateRelevanceExplanation()` from matching criteria
    - Limit reasons to maximum 3 per vehicle
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_
  
  - [x] 5.2 Write property test for response structure completeness
    - **Property 9: Response Structure Completeness**
    - **Validates: Requirements 3.1, 3.2, 5.3**
  
  - [x] 5.3 Write property test for year alternatives include available years
    - **Property 10: Year Alternatives Include Available Years**
    - **Validates: Requirements 3.3**
  
  - [x] 5.4 Write property test for maximum reasons per vehicle
    - **Property 11: Maximum Reasons Per Vehicle**
    - **Validates: Requirements 3.6**

- [x] 6. Integrate FallbackService with existing services
  - [x] 6.1 Update `src/services/vehicle-search-adapter.service.ts`
    - Import and instantiate FallbackService
    - Modify `performExactSearch()` to invoke FallbackService when no exact results
    - Pass fallback results through existing conversion logic
    - Add logging for fallback operations
    - _Requirements: 5.1, 5.5_
  
  - [x] 6.2 Update `src/services/exact-search.service.ts`
    - Refactor `findSimilarSuggestions()` to use FallbackService
    - Ensure backward compatibility with existing callers
    - _Requirements: 5.2_
  
  - [x] 6.3 Write property test for automatic fallback invocation
    - **Property 12: Automatic Fallback Invocation**
    - **Validates: Requirements 5.1**

- [x] 7. Update RecommendationAgent for fallback formatting
  - [x] 7.1 Update `src/agents/recommendation.agent.ts`
    - Import FallbackResponseFormatter
    - Update `handleSpecificModelRequest()` to use formatter for fallback results
    - Ensure WhatsApp-friendly message formatting
    - _Requirements: 5.4_
  
  - [x] 7.2 Write unit tests for recommendation agent fallback integration
    - Test year alternative formatting
    - Test similar profile formatting
    - Test edge cases (empty results, unknown models)
    - _Requirements: 5.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive coverage
- Each task references specific requirements for traceability
- Property tests use fast-check library with minimum 100 iterations
- The implementation builds on existing ExactSearchService patterns
- All messages are formatted in Brazilian Portuguese
