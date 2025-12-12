/**
 * Feature Flags System
 *
 * Controls gradual rollout of new features
 */

import { env } from '../config/env';
import { logger } from './logger';

export class FeatureFlagService {
  /**
   * Check if conversational mode should be used for this user
   * Uses phone number hash for consistent assignment
   */
  shouldUseConversationalMode(phoneNumber: string): boolean {
    // If feature is disabled globally, return false
    if (!env.ENABLE_CONVERSATIONAL_MODE) {
      return false;
    }

    // If rollout is 100%, everyone gets it
    if (env.CONVERSATIONAL_ROLLOUT_PERCENTAGE >= 100) {
      return true;
    }

    // If rollout is 0%, nobody gets it (except if explicitly enabled)
    if (env.CONVERSATIONAL_ROLLOUT_PERCENTAGE <= 0) {
      return false;
    }

    // Hash phone number to get consistent assignment
    // Same phone always gets same decision
    const hash = this.simpleHash(phoneNumber);
    const bucket = hash % 100; // 0-99

    const shouldUse = bucket < env.CONVERSATIONAL_ROLLOUT_PERCENTAGE;

    logger.debug(
      {
        phoneNumber: phoneNumber.substring(0, 8) + '****', // Privacy
        bucket,
        rollout: env.CONVERSATIONAL_ROLLOUT_PERCENTAGE,
        useConversational: shouldUse,
      },
      'Feature flag: conversational mode'
    );

    return shouldUse;
  }

  /**
   * Simple hash function for consistent bucketing
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get current feature flags status
   */
  getStatus(): {
    conversational: {
      enabled: boolean;
      rollout: number;
    };
  } {
    return {
      conversational: {
        enabled: env.ENABLE_CONVERSATIONAL_MODE,
        rollout: env.CONVERSATIONAL_ROLLOUT_PERCENTAGE,
      },
    };
  }

  /**
   * Override for specific phone numbers (for testing)
   * Can be extended to use database/Redis for dynamic overrides
   */
  private readonly TEST_NUMBERS: string[] = [
    // Add test phone numbers here to always use conversational
    // '5511999999999',
  ];

  isTestNumber(phoneNumber: string): boolean {
    return this.TEST_NUMBERS.includes(phoneNumber);
  }

  /**
   * Check if a specific feature flag is enabled
   */
  isEnabled(flagName: string, phoneNumber?: string): boolean {
    // Environment variable based flags
    const envFlags: Record<string, boolean> = {
      USE_LANGGRAPH: env.ENABLE_CONVERSATIONAL_MODE, // LangGraph is tied to conversational mode
      ENABLE_CONVERSATIONAL_MODE: env.ENABLE_CONVERSATIONAL_MODE,
    };

    const isGloballyEnabled = envFlags[flagName] ?? false;

    // If not globally enabled, check if it's a test number
    if (!isGloballyEnabled && phoneNumber) {
      return this.isTestNumber(phoneNumber);
    }

    return isGloballyEnabled;
  }
}

// Singleton export
export const featureFlags = new FeatureFlagService();
