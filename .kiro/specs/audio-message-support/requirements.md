# Requirements Document

## Introduction

Este documento especifica os requisitos para adicionar suporte a mensagens de áudio no bot de WhatsApp da FaciliAuto. A funcionalidade permitirá que usuários enviem mensagens de voz, que serão transcritas automaticamente e processadas como texto, mantendo a experiência conversacional fluida.

## Glossary

- **WhatsApp_Service**: Serviço responsável por receber e enviar mensagens via Meta Cloud API
- **Audio_Transcription_Service**: Serviço responsável por converter áudio em texto usando APIs de Speech-to-Text
- **Message_Handler**: Componente que processa mensagens e gera respostas usando o bot conversacional
- **Media_ID**: Identificador único de mídia retornado pela Meta API para arquivos de áudio
- **Transcription**: Texto resultante da conversão de áudio para texto

## Requirements

### Requirement 1

**User Story:** As a user, I want to send voice messages to the bot, so that I can communicate more naturally without typing.

#### Acceptance Criteria

1. WHEN the WhatsApp_Service receives a message with type "audio" THEN the WhatsApp_Service SHALL extract the media_id from the message payload
2. WHEN the WhatsApp_Service extracts a media_id THEN the WhatsApp_Service SHALL download the audio file from Meta Cloud API
3. WHEN the WhatsApp_Service downloads an audio file THEN the Audio_Transcription_Service SHALL convert the audio to text using a Speech-to-Text API
4. WHEN the Audio_Transcription_Service produces a Transcription THEN the Message_Handler SHALL process the transcribed text as a regular text message
5. WHEN the Message_Handler processes a transcribed message THEN the WhatsApp_Service SHALL send the response back to the user

### Requirement 2

**User Story:** As a user, I want to know when my audio is being processed, so that I understand the bot received my message.

#### Acceptance Criteria

1. WHEN the WhatsApp_Service receives an audio message THEN the WhatsApp_Service SHALL mark the message as read immediately
2. WHEN the Audio_Transcription_Service starts processing an audio file THEN the WhatsApp_Service SHALL send a typing indicator or acknowledgment to the user

### Requirement 3

**User Story:** As a user, I want clear feedback when audio processing fails, so that I can retry or use text instead.

#### Acceptance Criteria

1. IF the audio download from Meta Cloud API fails THEN the WhatsApp_Service SHALL send an error message asking the user to try again or type the message
2. IF the Audio_Transcription_Service fails to transcribe the audio THEN the WhatsApp_Service SHALL send an error message explaining the issue and suggesting alternatives
3. IF the audio file exceeds the maximum supported duration THEN the WhatsApp_Service SHALL inform the user of the duration limit and request a shorter message
4. IF the audio quality is too low for transcription THEN the WhatsApp_Service SHALL request the user to send a clearer audio or type the message

### Requirement 4

**User Story:** As a system administrator, I want audio processing to be configurable, so that I can control costs and enable/disable the feature.

#### Acceptance Criteria

1. WHERE the audio transcription feature is enabled THEN the WhatsApp_Service SHALL process audio messages using the configured Speech-to-Text provider
2. WHERE the audio transcription feature is disabled THEN the WhatsApp_Service SHALL respond with a message indicating that audio messages are not supported
3. WHEN configuring the system THEN the system SHALL use Groq Whisper as the Speech-to-Text provider
4. WHEN the system starts THEN the system SHALL validate that the GROQ_API_KEY environment variable is present for audio transcription

### Requirement 5

**User Story:** As a developer, I want audio transcription to be logged and monitored, so that I can track usage and debug issues.

#### Acceptance Criteria

1. WHEN the Audio_Transcription_Service processes an audio file THEN the system SHALL log the audio duration, file size, and processing time
2. WHEN the Audio_Transcription_Service completes a transcription THEN the system SHALL log the transcription confidence score if available
3. IF an error occurs during audio processing THEN the system SHALL log the error details including the stage where it failed
4. WHEN storing conversation history THEN the system SHALL indicate that the original message was an audio message along with the transcription

