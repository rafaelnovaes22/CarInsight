/**
 * Handoff Detection Utility
 * Centralizes the logic for detecting when a user wants to talk to a human.
 */

import { addFlag } from './state-flags';

export interface HandoffDetectionResult {
  isHandoffRequest: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
}

const HANDOFF_KEYWORDS = {
  high: ['vendedor', 'humano', 'atendente', 'pessoa real', 'consultor'],
  medium: ['falar com alguém', 'atendimento humano', 'quero falar', 'transferir'],
};

export function detectHandoffRequest(message: string): HandoffDetectionResult {
  const lower = message.toLowerCase();
  const matchedKeywords: string[] = [];
  let confidence: HandoffDetectionResult['confidence'] = 'low';

  for (const keyword of HANDOFF_KEYWORDS.high) {
    if (lower.includes(keyword)) {
      matchedKeywords.push(keyword);
      confidence = 'high';
    }
  }

  if (confidence !== 'high') {
    for (const keyword of HANDOFF_KEYWORDS.medium) {
      if (lower.includes(keyword)) {
        matchedKeywords.push(keyword);
        confidence = 'medium';
      }
    }
  }

  return {
    isHandoffRequest: matchedKeywords.length > 0,
    confidence,
    matchedKeywords,
  };
}

/**
 * Adds the 'handoff_requested' flag if a handoff was detected.
 */
export function addHandoffFlag(flags: string[] | undefined): string[] {
  return addFlag(flags, 'handoff_requested');
}
