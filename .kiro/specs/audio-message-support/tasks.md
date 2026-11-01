# Implementation Plan

- [x] 1. Set up environment configuration for audio transcription





  - [x] 1.1 Add audio transcription environment variables to env.ts


    - Add `ENABLE_AUDIO_TRANSCRIPTION` boolean flag (default: true)
    - Add `AUDIO_MAX_DURATION_SECONDS` number (default: 120)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.2 Update .env.example with new variables

    - Document the new environment variables
    - _Requirements: 4.3, 4.4_

- [x] 2. Create AudioTranscriptionService






  - [x] 2.1 Create audio-transcription.service.ts with core interfaces

    - Define `TranscriptionResult` interface
    - Implement `AudioTranscriptionService` class skeleton
    - Add `isEnabled()` and `getMaxDuration()` methods
    - _Requirements: 4.1, 4.2_

  - [x] 2.2 Write property test for feature flag behavior

    - **Property 5: Feature flag controls audio processing behavior**
    - **Validates: Requirements 4.1, 4.2**
  - [x] 2.3 Implement Groq Whisper transcription logic


    - Add `transcribeAudio(audioBuffer: Buffer)` method
    - Handle Groq API response and errors
    - _Requirements: 1.3, 4.3_

  - [x] 2.4 Write property test for transcription logging

    - **Property 7: Transcription logging completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [x] 2.5 Implement media download from Meta API

    - Add `downloadMediaFromMeta(mediaId: string)` method
    - Handle download errors and retries
    - _Requirements: 1.2_
  - [x] 2.6 Implement `transcribeFromMediaId` main method

    - Orchestrate download → validate → transcribe flow
    - Handle duration validation
    - Return appropriate error codes
    - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3, 3.4_
  - [x] 2.7 Write unit tests for AudioTranscriptionService


    - Test `transcribeFromMediaId` with valid media ID
    - Test error handling for download failures
    - Test error handling for transcription failures
    - Test duration validation
    - _Requirements: 1.2, 1.3, 3.1, 3.2, 3.3_

- [x] 3. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update WhatsAppMetaService for audio support



  - [x] 4.1 Update MetaWebhookMessage interface to include audio type


    - Add `audio?: { id: string; mime_type: string }` field
    - Update type union to include 'audio'
    - _Requirements: 1.1_

  - [x] 4.2 Write property test for audio message parsing

    - **Property 1: Audio message parsing extracts media_id**
    - **Validates: Requirements 1.1**
  - [x] 4.3 Implement handleAudioMessage method


    - Extract media_id from audio message
    - Call AudioTranscriptionService
    - Pass transcribed text to MessageHandler
    - Send response back to user
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 4.4 Write property test for audio transcription round-trip

    - **Property 2: Audio transcription round-trip produces response**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5**


  - [x] 4.5 Implement user acknowledgment for audio processing
    - Mark message as read immediately
    - Send typing indicator or processing message
    - _Requirements: 2.1, 2.2_
  - [x] 4.6 Write property test for acknowledgment timing
    - **Property 3: Audio message acknowledgment before processing**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 4.7 Implement error message handling for audio failures
    - Map error codes to user-friendly messages
    - Suggest alternatives (retry or type)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.8 Write property test for error handling
    - **Property 4: Error handling produces appropriate user messages**
    - **Validates: Requirements 3.1, 3.2**
  - [x] 4.9 Update handleIncomingMessage to route audio messages
    - Detect message type 'audio'
    - Route to handleAudioMessage instead of ignoring
    - _Requirements: 1.1_
  - [x] 4.10 Write unit tests for WhatsAppMetaService audio handling

    - Test audio message routing
    - Test error message formatting
    - Test feature disabled behavior
    - _Requirements: 1.1, 4.2_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update message persistence for audio messages





  - [x] 6.1 Update Message creation to include audio metadata


    - Set messageType to 'audio_transcription' for audio messages
    - Store original mediaId in message record
    - _Requirements: 5.4_


  - [x] 6.2 Write property test for audio message persistence





    - **Property 6: Audio message persistence includes metadata**
    - **Validates: Requirements 5.4**
  - [x] 6.3 Write unit tests for message persistence







    - Test audio message stored with correct type
    - Test mediaId is preserved
    - _Requirements: 5.4_

- [x] 7. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

