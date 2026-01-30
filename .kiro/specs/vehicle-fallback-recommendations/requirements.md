# Requirements Document

## Introduction

This feature enhances the WhatsApp vehicle sales bot to provide intelligent fallback recommendations when a user requests a specific vehicle that is not available in stock. Instead of simply responding "não temos", the bot will suggest relevant alternatives based on year variations, similar vehicle profiles, and a prioritized fallback strategy.

## Glossary

- **Fallback_Service**: The service responsible for finding and ranking alternative vehicles when the exact requested vehicle is unavailable
- **Vehicle_Profile**: A set of characteristics that define a vehicle including category, price range, brand, and features
- **Year_Proximity_Score**: A numerical score indicating how close an alternative vehicle's year is to the requested year
- **Similarity_Score**: A numerical score indicating how similar an alternative vehicle is to the requested vehicle based on multiple criteria
- **Price_Range_Tolerance**: The acceptable price deviation from the reference price (±20%)
- **Fallback_Response**: The structured response containing acknowledgment, alternatives, and relevance explanations

## Requirements

### Requirement 1: Year Variations Fallback

**User Story:** As a customer, I want to see the same model from different years when my requested year is unavailable, so that I can consider similar options without changing my model preference.

#### Acceptance Criteria

1. WHEN a user requests a specific model and year that is unavailable, THE Fallback_Service SHALL search for the same model in other available years
2. WHEN year alternatives are found, THE Fallback_Service SHALL sort them by year proximity to the requested year (closest years first)
3. WHEN calculating year proximity, THE Fallback_Service SHALL assign higher scores to years closer to the requested year
4. WHEN multiple vehicles of the same year exist, THE Fallback_Service SHALL sort them by price descending, then mileage ascending
5. THE Fallback_Service SHALL return a maximum of 5 year alternative vehicles

### Requirement 2: Similar Profile Fallback

**User Story:** As a customer, I want to see vehicles with similar characteristics when my requested model is completely unavailable, so that I can find alternatives that match my needs.

#### Acceptance Criteria

1. WHEN the requested model is not available in any year, THE Fallback_Service SHALL search for vehicles with similar profiles
2. WHEN searching for similar profiles, THE Fallback_Service SHALL match vehicles by the same category (sedan, SUV, hatch, pickup)
3. WHEN searching for similar profiles, THE Fallback_Service SHALL match vehicles within ±20% of the estimated price range
4. WHEN searching for similar profiles, THE Fallback_Service SHALL prioritize vehicles from the same brand if available
5. WHEN searching for similar profiles, THE Fallback_Service SHALL consider matching features (automatic transmission, flex fuel)
6. THE Fallback_Service SHALL calculate a Similarity_Score based on the number of matching criteria
7. THE Fallback_Service SHALL return similar vehicles sorted by Similarity_Score descending

### Requirement 3: Fallback Response Format

**User Story:** As a customer, I want to understand why alternatives are being suggested, so that I can make an informed decision about considering them.

#### Acceptance Criteria

1. WHEN returning fallback results, THE Fallback_Response SHALL include an acknowledgment that the exact vehicle is unavailable
2. WHEN returning fallback results, THE Fallback_Response SHALL explain why each alternative is relevant
3. WHEN returning year alternatives, THE Fallback_Response SHALL mention the available years for the requested model
4. WHEN returning similar profile alternatives, THE Fallback_Response SHALL explain the matching criteria (category, price range, brand, features)
5. THE Fallback_Response SHALL format the message in Portuguese (Brazilian)
6. THE Fallback_Response SHALL limit explanations to a maximum of 3 key reasons per vehicle

### Requirement 4: Fallback Priority Order

**User Story:** As a customer, I want to receive the most relevant alternatives first, so that I can quickly find a suitable option.

#### Acceptance Criteria

1. THE Fallback_Service SHALL apply fallback strategies in the following priority order: same model different year, same brand same category, same category similar price, similar price range only
2. WHEN same model different year alternatives exist, THE Fallback_Service SHALL return them before trying other fallback strategies
3. WHEN no same model alternatives exist, THE Fallback_Service SHALL search for same brand and same category vehicles
4. WHEN no same brand alternatives exist, THE Fallback_Service SHALL search for same category vehicles within similar price range
5. WHEN no category matches exist, THE Fallback_Service SHALL search for vehicles within similar price range only
6. IF no alternatives are found at any level, THEN THE Fallback_Service SHALL return an empty result with an appropriate message

### Requirement 5: Fallback Integration

**User Story:** As a system, I want the fallback logic to integrate seamlessly with existing search services, so that the user experience is consistent.

#### Acceptance Criteria

1. WHEN the exact search returns no results, THE Vehicle_Search_Adapter SHALL automatically invoke the Fallback_Service
2. THE Fallback_Service SHALL use the same Vehicle interface as the existing ExactSearchService
3. THE Fallback_Service SHALL include metadata indicating the fallback type used (year_alternative, same_brand, same_category, price_range)
4. WHEN fallback results are returned, THE Recommendation_Agent SHALL format them appropriately for WhatsApp display
5. THE Fallback_Service SHALL log all fallback operations for analytics and debugging purposes
