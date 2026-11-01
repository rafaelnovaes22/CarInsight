# Implementation Plan: Conversation State Fixes

## Overview

This implementation plan addresses two conversational flow issues: name correction handling and premature recommendation prevention. The approach is incremental, starting with the detection modules, then integrating them into the existing LangGraph nodes.

## Tasks

- [x] 1. Create Name Correction Detector module
  - [x] 1.1 Create `src/graph/langgraph/extractors/name-correction-detector.ts` with NameCorrectionResult interface and detectNameCorrection function
    - Implement NAME_CORRECTION_PATTERNS regex array for Portuguese correction phrases
    - Use existing extractName function for name extraction
    - Return isCorrection, correctedName, and confidence
    - _Requirements: 1.1, 3.1, 3.2_
  
  - [x] 1.2 Write property test for name correction pattern detection
    - **Property 1: Name Correction Pattern Detection**
    - **Validates: Requirements 1.1, 3.1**
  
  - [x] 1.3 Write property test for name extraction from corrections
    - **Property 9: Name Extraction From Correction Messages**
    - **Validates: Requirements 3.2**
  
  - [x] 1.4 Add transcription error handling to name correction detector
    - Integrate with existing TRANSCRIPTION_FIXES mapping
    - Apply fixes to extracted names before returning
    - _Requirements: 3.4_
  
  - [x] 1.5 Write property test for transcription error handling
    - **Property 10: Transcription Error Handling**
    - **Validates: Requirements 3.4**

- [x] 2. Extend Intent Detector with recommendation request detection
  - [x] 2.1 Add `detectExplicitRecommendationRequest` function to `src/agents/vehicle-expert/intent-detector.ts`
    - Implement EXPLICIT_RECOMMENDATION_PATTERNS regex array
    - Return boolean indicating if message is an explicit request
    - _Requirements: 2.3, 4.1_
  
  - [x] 2.2 Add `isInformationProvision` function to intent detector
    - Implement INFORMATION_PROVISION_PATTERNS for budget/usage detection
    - Return boolean indicating if message is pure info provision
    - _Requirements: 4.3, 4.4_
  
  - [x] 2.3 Write property test for explicit recommendation request detection
    - **Property 6: Explicit Recommendation Request Detection**
    - **Validates: Requirements 2.3, 4.1**
  
  - [x] 2.4 Write property test for information provision classification
    - **Property 5: Information Provision Does Not Trigger Recommendations**
    - **Validates: Requirements 2.1, 2.2, 4.2**
  
  - [x] 2.5 Write property test for message intent classification
    - **Property 11: Message Intent Classification Accuracy**
    - **Validates: Requirements 4.3, 4.4**

- [x] 3. Checkpoint - Ensure detection modules work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate name correction into Greeting Node
  - [x] 4.1 Modify `src/graph/nodes/greeting.node.ts` to check for name corrections
    - Add name correction detection at start of greetingNode function
    - Update profile.customerName when correction detected
    - Return acknowledgment message with corrected name
    - Set next state to 'greeting' (stay in current state)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  
  - [x] 4.2 Write property test for profile update after correction
    - **Property 2: Profile Update After Name Correction**
    - **Validates: Requirements 1.2**
  
  - [x] 4.3 Write property test for acknowledgment response
    - **Property 3: Acknowledgment Response Contains Corrected Name**
    - **Validates: Requirements 1.3**
  
  - [x] 4.4 Write property test for state preservation
    - **Property 4: State Preservation After Name Correction**
    - **Validates: Requirements 1.4, 1.5**

- [x] 5. Integrate name correction and recommendation control into Discovery Node
  - [x] 5.1 Modify `src/graph/nodes/discovery.node.ts` to handle name corrections
    - Add name correction detection similar to greeting node
    - Update profile and acknowledge without state transition
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  
  - [x] 5.2 Modify Discovery Node to prevent premature recommendations
    - Check isInformationProvision before processing
    - Only allow recommendation transition on detectExplicitRecommendationRequest
    - Add logic to ask user if they want to see options when profile is complete
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  
  - [x] 5.3 Write property test for recommendation transition control
    - **Property 7: Recommendation Transition Only On Explicit Request**
    - **Validates: Requirements 2.4**
  
  - [x] 5.4 Write property test for asking before showing recommendations
    - **Property 8: Ask Before Showing When Profile Complete**
    - **Validates: Requirements 2.5**

- [x] 6. Checkpoint - Ensure node integrations work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Export and wire up new modules
  - [x] 7.1 Update `src/graph/langgraph/extractors/index.ts` to export name correction detector
    - Add export for detectNameCorrection function
    - Add export for NameCorrectionResult interface
    - _Requirements: 1.1_
  
  - [x] 7.2 Ensure intent detector exports are available
    - Verify detectExplicitRecommendationRequest is exported
    - Verify isInformationProvision is exported
    - _Requirements: 2.3, 4.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required
- Each task references specific requirements for traceability
- Property tests use fast-check library for TypeScript
- The implementation builds incrementally: detection modules first, then node integration
