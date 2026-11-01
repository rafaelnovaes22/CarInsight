# Requirements Document

## Introduction

This document specifies the requirements for fixing two conversational flow issues in the WhatsApp vehicle sales bot:
1. Name correction detection and handling when users correct their name after the bot misidentifies it
2. Preventing premature vehicle recommendations when the user hasn't explicitly requested them

These fixes ensure the bot maintains natural conversation flow and respects user intent before transitioning between conversation states.

## Glossary

- **Conversation_State_Manager**: The system component responsible for managing conversation state transitions in the LangGraph workflow
- **Name_Correction_Detector**: The component that identifies when a user is correcting their previously stored name
- **Intent_Detector**: The existing module that detects user intents from messages (src/agents/vehicle-expert/intent-detector.ts)
- **Greeting_Node**: The LangGraph node handling initial interactions and name extraction (src/graph/nodes/greeting.node.ts)
- **Discovery_Node**: The LangGraph node handling preference discovery and conversation flow (src/graph/nodes/discovery.node.ts)
- **Recommendation_Node**: The LangGraph node handling vehicle recommendation presentation (src/graph/nodes/recommendation.node.ts)
- **Customer_Profile**: The data structure storing user information including customerName, budget, usage, and preferences
- **Explicit_Recommendation_Request**: A user message that clearly indicates desire to see vehicle options (e.g., "mostra carros", "quero ver opções", "me indica")

## Requirements

### Requirement 1: Name Correction Detection

**User Story:** As a user, I want the bot to recognize when I'm correcting my name, so that it addresses me correctly throughout the conversation.

#### Acceptance Criteria

1. WHEN a user sends a message containing name correction patterns (e.g., "é [Name] na verdade", "meu nome é [Name]", "me chama de [Name]", "não, é [Name]") AND a name is already stored in the Customer_Profile, THEN THE Name_Correction_Detector SHALL identify this as a name correction intent
2. WHEN a name correction is detected, THEN THE Conversation_State_Manager SHALL update the customerName field in the Customer_Profile with the corrected name
3. WHEN a name correction is detected, THEN THE Greeting_Node SHALL respond with a natural acknowledgment of the correction (e.g., "Desculpa, [Name]! Como posso te ajudar?")
4. WHEN a name correction is detected, THEN THE Conversation_State_Manager SHALL NOT transition to a different conversation state (discovery, recommendation) in the same turn
5. WHEN a name correction is detected, THEN THE Conversation_State_Manager SHALL remain in the current state waiting for the user's next input

### Requirement 2: Explicit Recommendation Request Detection

**User Story:** As a user, I want the bot to only show vehicle recommendations when I explicitly ask for them, so that I can control the pace of the conversation.

#### Acceptance Criteria

1. WHEN a user provides budget information (e.g., "100000", "até 100 mil"), THEN THE Discovery_Node SHALL acknowledge the information and continue gathering preferences without triggering recommendations
2. WHEN a user provides usage information (e.g., "dia a dia", "trabalho", "família"), THEN THE Discovery_Node SHALL acknowledge the information and ask follow-up questions without triggering recommendations
3. WHEN a user sends an Explicit_Recommendation_Request (e.g., "mostra carros", "quero ver opções", "me indica um carro", "o que vocês tem?"), THEN THE Intent_Detector SHALL identify this as a recommendation request intent
4. THE Discovery_Node SHALL only transition to the Recommendation_Node WHEN an Explicit_Recommendation_Request is detected OR WHEN the user responds affirmatively to a bot question asking if they want to see options
5. WHEN sufficient profile information is collected (budget AND usage/bodyType), THEN THE Discovery_Node SHALL ask the user if they want to see recommendations rather than automatically showing them

### Requirement 3: Name Correction Pattern Recognition

**User Story:** As a developer, I want the system to recognize various Portuguese name correction patterns, so that the bot handles natural language corrections properly.

#### Acceptance Criteria

1. THE Name_Correction_Detector SHALL recognize correction patterns including: "é [Name] na verdade", "na verdade é [Name]", "não, é [Name]", "meu nome é [Name]", "me chama de [Name]", "pode me chamar de [Name]", "o nome é [Name]"
2. THE Name_Correction_Detector SHALL extract the corrected name from the message using the existing extractName function
3. WHEN the extracted name is the same as the stored name, THEN THE Name_Correction_Detector SHALL NOT treat the message as a correction
4. THE Name_Correction_Detector SHALL handle common transcription errors in corrected names using the existing TRANSCRIPTION_FIXES mapping

### Requirement 4: Recommendation Request Pattern Recognition

**User Story:** As a developer, I want the system to recognize explicit recommendation request patterns, so that the bot only shows vehicles when the user wants them.

#### Acceptance Criteria

1. THE Intent_Detector SHALL recognize explicit recommendation request patterns including: "mostra", "quero ver", "me indica", "me sugere", "o que tem", "o que vocês tem", "tem algum", "pode mostrar", "quais opções"
2. THE Intent_Detector SHALL NOT treat budget/usage responses as recommendation requests
3. THE Intent_Detector SHALL distinguish between information-providing messages and action-requesting messages
4. WHEN a message contains only numeric values (budget) or single-word usage descriptions, THEN THE Intent_Detector SHALL classify it as information provision, not a recommendation request
