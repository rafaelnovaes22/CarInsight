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
    /(?:me chamo|meu nome é|meu nome e)\s+([A-ZÀ-Úa-zà-ú]+)/i,
    // "sou o/a [Name]"
    /(?:sou o|sou a|sou)\s+([A-ZÀ-Úa-zà-ú]+)/i,
    // "pode me chamar de [Name]"
    /(?:pode me chamar de)\s+([A-ZÀ-Úa-zà-ú]+)/i,
    // "é o/a [Name]"
    /(?:é o|é a)\s+([A-ZÀ-Úa-zà-ú]+)/i,
    // "[Name] aqui" - ex: "Rafael aqui", "oi, João aqui"
    /\b([A-ZÀ-Ú][a-zà-ú]+)\s+aqui\b/i,
    // "aqui é [Name]" - ex: "aqui é o Rafael"
    /aqui\s+(?:é|é o|é a)?\s*([A-ZÀ-Úa-zà-ú]+)/i,
];

/**
 * Prefixes to remove when extracting name
 */
const NAME_PREFIXES = ['meu nome é', 'me chamo', 'sou o', 'sou a', 'pode me chamar de', 'é', 'sou'];

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
    return COMMON_BRAZILIAN_NAMES.has(name.toLowerCase());
}

/**
 * Capitalize name properly
 */
function capitalizeName(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Extract name from a message
 * 
 * @param message - User message
 * @returns Extracted name or null
 */
export function extractName(message: string): string | null {
    // Clean message: remove trailing punctuation
    let cleaned = message.trim().replace(/[.,!?…]+$/, '').trim();

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

    // THIRD: If message contains comma or spaces, try checking first word
    if (cleaned.includes(',') || cleaned.includes(' ')) {
        const firstPart = cleaned.split(/[,\s]+/)[0].toLowerCase();
        const firstFix = getTranscriptionFix(firstPart);
        if (firstFix) {
            logger.info({ original: cleaned, firstPart, fixed: firstFix }, 'extractName: fixed via first word match');
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
                logger.debug({ extractedName, reason: 'reserved word from pattern match' }, 'extractName: skipping pattern');
                continue;
            }

            // Check for transcription fix
            const patternFix = getTranscriptionFix(lowerName);
            if (patternFix) {
                logger.info({ original: extractedName, fixed: patternFix, pattern: pattern.source }, 'extractName: fixed via pattern match');
                return patternFix;
            }

            // Check if it looks like a valid name
            if (isCommonName(lowerName) || /^[A-ZÀ-Ú][a-zà-ú]+$/.test(extractedName)) {
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
        logger.info({ original: name, fixed: prefixFix }, 'extractName: fixed transcription error after prefix removal');
        return prefixFix;
    }

    // DETECT ENGLISH: Reject if contains obvious English words
    const words = name.toLowerCase().split(/\s+/);
    const hasEnglishWords = words.some(w => isEnglishWord(w));
    if (hasEnglishWords) {
        logger.debug({ name, words, reason: 'contains English words - likely transcription error' }, 'extractName: rejected');
        return null;
    }

    // DETECT ENGLISH CONTRACTIONS (I'll, I'm, etc.)
    if (/\b(i'|i"|you'|we'|they'|he'|she'|it')/i.test(name)) {
        logger.debug({ name, reason: 'contains English contractions - STT error' }, 'extractName: rejected');
        return null;
    }

    // Final validation: is it a valid name format?
    if (name.length >= 2 && name.length <= 30) {
        // Check if it's a common name or has valid format
        if (isCommonName(name.toLowerCase()) || /^[A-ZÀ-Ú][a-zà-ú]+$/.test(name)) {
            const result = capitalizeName(name);
            logger.info({ result }, 'extractName: found via fallback');
            return result;
        }
    }

    logger.debug({ message, reason: 'no valid name found' }, 'extractName: no match');
    return null;
}
