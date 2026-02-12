/**
 * Name Correction Detector
 *
 * Detects when a user is correcting their previously stored name.
 * Handles Portuguese correction patterns and integrates with existing name extraction.
 *
 * Transcription Error Handling:
 * This module integrates with the existing TRANSCRIPTION_FIXES mapping through
 * the extractName function. When a user corrects their name, common STT
 * (Speech-to-Text) transcription errors are automatically fixed before
 * returning the corrected name.
 */

import { logger } from '../../../lib/logger';
import { extractName } from './name-extractor';
import { TRANSCRIPTION_FIXES } from '../constants';

/**
 * Result of name correction detection
 */
export interface NameCorrectionResult {
  /** Whether the message is a name correction */
  isCorrection: boolean;

  /** The corrected name extracted from the message */
  correctedName: string | null;

  /** Confidence score (0-1) of the detection */
  confidence: number;
}

/**
 * Configuration for name correction detection
 */
export interface NameCorrectionDetectorConfig {
  /** The existing name stored in the profile */
  existingName: string | null;
}

function normalizeCommonMojibake(input: string): string {
  return input
    .replace(/Ã£/g, 'ã')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã©/g, 'é')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã§/g, 'ç');
}

/**
 * Portuguese name correction patterns
 *
 * These patterns detect when a user is correcting their name.
 * Each pattern captures the corrected name in group 1.
 */
export const NAME_CORRECTION_PATTERNS: RegExp[] = [
  // "Ã© [Name] na verdade" / "na verdade Ã© [Name]"
  /(?:^|\s)(?:\u00E9|e)\s+([\p{L}]+(?:\s+[\p{L}]+)*)\s+na\s+verdade/iu,
  /na\s+verdade\s+(?:\u00E9|e)\s+([\p{L}]+(?:\s+[\p{L}]+)*)/iu,

  // "nÃ£o, Ã© [Name]" / "nÃ£o, [Name]"
  /^n(?:\u00E3|a)o[,.]?\s*(?:\u00E9|e)?\s*([\p{L}]+(?:\s+[\p{L}]+)?)\s*$/iu,

  // "meu nome Ã© [Name]" (when name already exists - implies correction)
  /meu\s+nome\s+(?:\u00E9|e)\s+([\p{L}]+(?:\s+[\p{L}]+)*)/iu,

  // "me chama de [Name]" / "pode me chamar de [Name]"
  /(?:me\s+chama|pode\s+me\s+chamar)\s+de\s+([\p{L}]+(?:\s+[\p{L}]+)*)/iu,

  // "o nome Ã© [Name]"
  /o\s+nome\s+(?:\u00E9|e)\s+([\p{L}]+(?:\s+[\p{L}]+)*)/iu,

  // "na verdade me chamo [Name]"
  /na\s+verdade\s+me\s+chamo\s+([\p{L}]+(?:\s+[\p{L}]+)*)/iu,

  // "errou, Ã© [Name]" / "errado, Ã© [Name]"
  /err(?:ou|ado)[,.]?\s*(?:\u00E9|e)?\s*([\p{L}]+(?:\s+[\p{L}]+)*)/iu,
];

/**
 * Detects if a user message is correcting their previously stored name
 *
 * @param message - The user's message
 * @param config - Configuration containing the existing name
 * @returns Detection result with isCorrection, correctedName, and confidence
 */
export function detectNameCorrection(
  message: string,
  config: NameCorrectionDetectorConfig
): NameCorrectionResult {
  const { existingName } = config;

  // If no existing name, this can't be a correction
  if (!existingName) {
    logger.debug({ message }, 'detectNameCorrection: no existing name, skipping');
    return { isCorrection: false, correctedName: null, confidence: 0 };
  }

  const trimmedMessage = normalizeCommonMojibake(message).trim();

  // Try each correction pattern
  for (const pattern of NAME_CORRECTION_PATTERNS) {
    const match = trimmedMessage.match(pattern);
    if (match && match[1]) {
      const rawExtractedName = match[1].trim();

      // Use extractName to properly process the name
      // This handles:
      // - Transcription error fixes via TRANSCRIPTION_FIXES mapping
      // - Proper capitalization
      // - Name validation
      const processedName = extractName(rawExtractedName);

      if (!processedName) {
        logger.debug(
          { rawExtractedName, pattern: pattern.source },
          'detectNameCorrection: pattern matched but name extraction failed'
        );
        continue;
      }

      // Check if the corrected name is the same as the existing name (case-insensitive)
      if (processedName.toLowerCase() === existingName.toLowerCase()) {
        logger.debug(
          { processedName, existingName },
          'detectNameCorrection: corrected name same as existing, not a correction'
        );
        return { isCorrection: false, correctedName: null, confidence: 0 };
      }

      logger.info(
        { message, existingName, correctedName: processedName, pattern: pattern.source },
        'detectNameCorrection: name correction detected'
      );

      return {
        isCorrection: true,
        correctedName: processedName,
        confidence: 0.9,
      };
    }
  }

  // No correction pattern matched
  logger.debug({ message, existingName }, 'detectNameCorrection: no correction pattern matched');
  return { isCorrection: false, correctedName: null, confidence: 0 };
}
