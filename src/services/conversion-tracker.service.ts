/**
 * Conversion Tracker Service
 *
 * Calculates a conversion score (0-100) based on behavioral signals
 * collected during the conversation. Higher scores indicate higher
 * purchase intent and should trigger follow-up sequences.
 */

import { logger } from '../lib/logger';
import { maskPhoneNumber } from '../lib/privacy';
import { isLateNight } from '../config/time-context';
import { CustomerProfile } from '../types/state.types';

interface ConversionSignals {
  hasName: boolean;
  hasBudget: boolean;
  hasSpecificModel: boolean;
  viewedDetails: boolean;
  askedFinancing: boolean;
  mentionedTradeIn: boolean;
  isLateNightSession: boolean;
  isReturningCustomer: boolean;
  sessionDurationMinutes: number;
  messageCount: number;
}

const SIGNAL_WEIGHTS: Record<keyof ConversionSignals, number> = {
  hasName: 10,
  hasBudget: 15,
  hasSpecificModel: 20,
  viewedDetails: 15,
  askedFinancing: 20,
  mentionedTradeIn: 15,
  isLateNightSession: 10,
  isReturningCustomer: 15,
  sessionDurationMinutes: 0, // Calculated dynamically
  messageCount: 0, // Calculated dynamically
};

export class ConversionTrackerService {
  /**
   * Calculate conversion score from profile and conversation metadata.
   */
  calculateScore(
    profile: Partial<CustomerProfile>,
    metadata: {
      startedAt: Date;
      lastMessageAt: Date;
      flags: string[];
      messageCount: number;
    },
    phoneNumber?: string
  ): number {
    const signals = this.extractSignals(profile, metadata);
    let score = 0;

    // Boolean signals
    if (signals.hasName) score += SIGNAL_WEIGHTS.hasName;
    if (signals.hasBudget) score += SIGNAL_WEIGHTS.hasBudget;
    if (signals.hasSpecificModel) score += SIGNAL_WEIGHTS.hasSpecificModel;
    if (signals.viewedDetails) score += SIGNAL_WEIGHTS.viewedDetails;
    if (signals.askedFinancing) score += SIGNAL_WEIGHTS.askedFinancing;
    if (signals.mentionedTradeIn) score += SIGNAL_WEIGHTS.mentionedTradeIn;
    if (signals.isLateNightSession) score += SIGNAL_WEIGHTS.isLateNightSession;
    if (signals.isReturningCustomer) score += SIGNAL_WEIGHTS.isReturningCustomer;

    // Duration bonus: +10 if session > 5 minutes
    if (signals.sessionDurationMinutes > 5) score += 10;

    // Cap at 100
    const finalScore = Math.min(score, 100);

    logger.debug(
      {
        phoneNumber: phoneNumber ? maskPhoneNumber(phoneNumber) : undefined,
        score: finalScore,
        signals,
      },
      'Conversion score calculated'
    );

    return finalScore;
  }

  /**
   * Extract behavioral signals from profile and metadata.
   */
  private extractSignals(
    profile: Partial<CustomerProfile>,
    metadata: {
      startedAt: Date;
      lastMessageAt: Date;
      flags: string[];
      messageCount: number;
    }
  ): ConversionSignals {
    const sessionDuration =
      (new Date(metadata.lastMessageAt).getTime() - new Date(metadata.startedAt).getTime()) /
      (1000 * 60);

    return {
      hasName: !!profile.customerName,
      hasBudget: !!(profile.budget || profile.orcamento || profile.budgetMax),
      hasSpecificModel: !!(profile.model || profile.brand),
      viewedDetails: metadata.flags.some(f => f.startsWith('viewed_vehicle_')),
      askedFinancing: !!(profile.wantsFinancing || profile.financingDownPayment),
      mentionedTradeIn: !!profile.hasTradeIn,
      isLateNightSession: isLateNight(new Date(metadata.startedAt)),
      isReturningCustomer: metadata.flags.includes('returning_customer'),
      sessionDurationMinutes: Math.max(sessionDuration, 0),
      messageCount: metadata.messageCount,
    };
  }

  /**
   * Determine if a follow-up should be scheduled based on score and context.
   */
  shouldScheduleFollowUp(score: number, hasRecommendations: boolean): boolean {
    return score >= 30 && hasRecommendations;
  }
}

export const conversionTracker = new ConversionTrackerService();
