/**
 * Name Extractor
 *
 * Extracts user names from messages with STT error correction.
 */

import { logger } from '../../../lib/logger';
import {
  COMMON_BRAZILIAN_NAMES,
  TRANSCRIPTION_FIXES,
  ENGLISH_WORDS_NOT_NAMES,
  RESERVED_WORDS_NOT_NAMES,
} from '../constants';

/**
 * Patterns to extract name from messages
 */
const NAME_PATTERNS: RegExp[] = [
  // Direct patterns: "me chamo [Name]", "meu nome é [Name]"
  /(?:me chamo|meu nome é|meu nome e)\s+([A-ZÀ-Úa-zà-ú]+(?:[\s]+(?:de|da|do|dos|das|e)\s+[A-ZÀ-Úa-zà-ú]+|[\s]+[A-ZÀ-Úa-zà-ú]+)*)/i,
  // "sou o/a [Name]"
  /(?:sou o|sou a|sou)\s+([A-ZÀ-Úa-zà-ú]+(?:[\s]+(?:de|da|do|dos|das|e)\s+[A-ZÀ-Úa-zà-ú]+|[\s]+[A-ZÀ-Úa-zà-ú]+)*)/i,
  // "so o/a [Name]" (common typo)
  /(?:so o|so a|so)\s+([A-ZÀ-Úa-zà-ú]+(?:[\s]+(?:de|da|do|dos|das|e)\s+[A-ZÀ-Úa-zà-ú]+|[\s]+[A-ZÀ-Úa-zà-ú]+)*)/i,
  // "pode me chamar de [Name]"
  /(?:pode me chamar de)\s+([A-ZÀ-Úa-zà-ú]+(?:[\s]+(?:de|da|do|dos|das|e)\s+[A-ZÀ-Úa-zà-ú]+|[\s]+[A-ZÀ-Úa-zà-ú]+)*)/i,
  // "é o/a [Name]"
  /(?:é o|é a)\s+([A-ZÀ-Úa-zà-ú]+(?:[\s]+(?:de|da|do|dos|das|e)\s+[A-ZÀ-Úa-zà-ú]+|[\s]+[A-ZÀ-Úa-zà-ú]+)*)/i,
  // "[Name] aqui" - ex: "Rafael aqui", "oi, João aqui"
  /\b([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s+aqui\b/i,
  // "aqui é [Name]" - ex: "aqui é o Rafael"
  /aqui\s+(?:é|é o|é a)?\s*([A-ZÀ-Úa-zà-ú]+(?:[\s]+(?:de|da|do|dos|das|e)\s+[A-ZÀ-Úa-zà-ú]+|[\s]+[A-ZÀ-Úa-zà-ú]+)*)/i,
];

/**
 * Prefixes to remove when extracting name
 */
const NAME_PREFIXES = ['meu nome é', 'me chamo', 'sou o', 'sou a', 'pode me chamar de', 'é', 'sou', 'so'];

/**
 * Check if name is a transcription fix
 */
function getTranscriptionFix(text: string): string | null {
  const lower = text.toLowerCase();
  return TRANSCRIPTION_FIXES[lower] || null;
}

/**
 * Check if word is a reserved system word
 */
function isReservedWord(word: string): boolean {
  return RESERVED_WORDS_NOT_NAMES.has(word.toLowerCase());
}

/**
 * Check if word is an English word (indicates STT error)
 */
function isEnglishWord(word: string): boolean {
  return ENGLISH_WORDS_NOT_NAMES.has(word.toLowerCase());
}

/**
 * Check if name is a common Brazilian name
 */
function isCommonName(name: string): boolean {
  // Check the whole name first
  if (COMMON_BRAZILIAN_NAMES.has(name.toLowerCase())) return true;

  // If compound name, check the first part
  const parts = name.split(/\s+/);
  if (parts.length > 1) {
    return COMMON_BRAZILIAN_NAMES.has(parts[0].toLowerCase());
  }

  return false;
}

/**
 * Capitalize name properly
 */
function capitalizeName(name: string): string {
  // Handle compound names
  return name
    .toLowerCase()
    .split(' ')
    .map(part => {
      // Lowercase prepositions
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

/**
 * Extract name from a message
 *
 * @param message - User message
 * @returns Extracted name or null
 */
export function extractName(message: string): string | null {
  // Clean message: remove trailing punctuation
  let cleaned = message
    .trim()
    .replace(/[.,!?…]+$/, '')
    .trim();

  // Detect and remove duplicate names (e.g., "Rafael. Rafael" → "Rafael")
  const duplicateMatch = cleaned.match(/^([A-ZÀ-Úa-zà-ú]+)[.,!?\s]+\1$/i);
  if (duplicateMatch) {
    cleaned = duplicateMatch[1];
    logger.debug({ original: message, cleaned }, 'extractName: removed duplicate name');
  }

  logger.debug({ originalMessage: message, cleaned }, 'extractName: processing');

  const lowerCleaned = cleaned.toLowerCase();

  // FIRST: Check if it's a known transcription error (full message)
  const fullFix = getTranscriptionFix(lowerCleaned);
  if (fullFix) {
    logger.info({ original: cleaned, fixed: fullFix }, 'extractName: fixed transcription error');
    return fullFix;
  }

  // SECOND: Check if it's a reserved system word
  if (isReservedWord(lowerCleaned)) {
    logger.debug({ word: cleaned, reason: 'reserved word - not a name' }, 'extractName: rejected');
    return null;
  }

  // PRE-PROCESSING: Remove leading greetings/reserved words
  // Ex: "Oi Rafael" -> "Rafael", "Bom dia, sou o João" -> "sou o João"
  const firstWord = cleaned.split(/[\s,]+/)[0].toLowerCase();

  // Debug log
  logger.info({ cleaned, firstWord, reserved: isReservedWord(firstWord) }, 'extractName: check leading greeting');

  if (isReservedWord(firstWord) || ['oi', 'ola', 'olá', 'bom', 'boa'].includes(firstWord)) {
    // If starts with reserved word, try to remove it and process the rest
    // Be careful not to infinite loop or remove too much
    const match = cleaned.match(/^([\wÀ-ÿ]+)(.*)$/s); // Simplified regex to just capture first word and rest

    if (match && match[1]) {
      // match[1] is the first word, match[2] is the rest
      const remaining = (match[2] || '').replace(/^[\s,.]+/, '').trim();

      logger.info({ firstWord, remaining }, 'extractName: split greeting');

      if (remaining.length > 0) {
        logger.debug({ original: cleaned, remaining }, 'extractName: stripped leading greeting');
        const resultFromRemaining = extractName(remaining);
        if (resultFromRemaining) return resultFromRemaining;

        // If remainder is not a name, and start was reserved, the whole thing is likely not a name
        return null;
      } else {
        // If nothing remaining, and it was a reserved word/greeting, it's NOT a name
        logger.debug({ original: cleaned }, 'extractName: rejected purely reserved word/greeting');
        return null;
      }
    }
  }

  // THIRD: If message contains comma or spaces, try checking first word
  // Only if the message length > 60 chars (likely a sentence, not just a name)
  if ((cleaned.includes(',') || cleaned.length > 60) && !cleaned.toLowerCase().startsWith('meu nome')) {
    const firstPart = cleaned.split(/[,\s]+/)[0].toLowerCase();
    const firstFix = getTranscriptionFix(firstPart);
    if (firstFix) {
      logger.info(
        { original: cleaned, firstPart, fixed: firstFix },
        'extractName: fixed via first word match'
      );
      return firstFix;
    }
  }

  // Use regex patterns to find name anywhere in message
  for (const pattern of NAME_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      const extractedName = match[1].trim();
      const lowerName = extractedName.toLowerCase();

      // Check if it's a reserved word
      if (isReservedWord(lowerName)) {
        logger.debug(
          { extractedName, reason: 'reserved word from pattern match' },
          'extractName: skipping pattern'
        );
        continue;
      }

      // Check for transcription fix
      const patternFix = getTranscriptionFix(lowerName);
      if (patternFix) {
        logger.info(
          { original: extractedName, fixed: patternFix, pattern: pattern.source },
          'extractName: fixed via pattern match'
        );
        return patternFix;
      }

      // Check if it looks like a valid name
      // Normalize for comparison (remove accents for matching)
      const normalizedForCheck = lowerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Validation logic for extraction via regex
      const isValidFormat = /^[A-ZÀ-ÿa-zà-ÿ]+(?:[\s][A-ZÀ-ÿa-zà-ÿ]+)*$/u.test(extractedName);
      const isKnownName = isCommonName(lowerName) || isCommonName(normalizedForCheck);

      if (isKnownName || isValidFormat) {
        const result = capitalizeName(extractedName);
        logger.info({ result, pattern: pattern.source }, 'extractName: found via pattern match');
        return result;
      }
    }
  }

  // FALLBACK: Try old method (message is just the name)
  let name = cleaned;

  for (const prefix of NAME_PREFIXES) {
    if (cleaned.toLowerCase().startsWith(prefix)) {
      name = cleaned.substring(prefix.length).trim();
      break;
    }
  }

  // Check for transcription fix after prefix removal
  const prefixFix = getTranscriptionFix(name.toLowerCase());
  if (prefixFix) {
    logger.info(
      { original: name, fixed: prefixFix },
      'extractName: fixed transcription error after prefix removal'
    );
    return prefixFix;
  }

  // DETECT ENGLISH: Reject if contains obvious English words
  const words = name.toLowerCase().split(/\s+/);
  const hasEnglishWords = words.some(w => isEnglishWord(w));
  if (hasEnglishWords) {
    logger.debug(
      { name, words, reason: 'contains English words - likely transcription error' },
      'extractName: rejected'
    );
    return null;
  }

  // DETECT ENGLISH CONTRACTIONS (I'll, I'm, etc.)
  if (/\b(i'|i"|you'|we'|they'|he'|she'|it')/i.test(name)) {
    logger.debug(
      { name, reason: 'contains English contractions - STT error' },
      'extractName: rejected'
    );
    return null;
  }

  // Final validation: is it a valid name format?
  // Increase max length to support full names like "Nicolas Leonardo Nepomuceno de Souza Santos"
  if (name.length >= 2 && name.length <= 100) {
    // Check if it's a common name or has valid format
    // Normalize for comparison (remove accents for matching)
    const normalizedName = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics for comparison

    // Check both with and without accents
    // Update format regex to allow spaces
    if (
      isCommonName(name.toLowerCase()) ||
      isCommonName(normalizedName) ||
      /^[A-ZÀ-ÿa-zà-ÿ]+(?:[\s][A-ZÀ-ÿa-zà-ÿ]+)*$/u.test(name)
    ) {
      const result = capitalizeName(name);
      logger.info({ result }, 'extractName: found via fallback');
      return result;
    }
  }

  logger.debug({ message, reason: 'no valid name found' }, 'extractName: no match');
  return null;
}
