import { describe, it, expect } from 'vitest';
import {
  assessReadiness,
  identifyMissingInfo,
} from '../../../src/agents/vehicle-expert/assessors/readiness-assessor';
import { CustomerProfile } from '../../../src/types/state.types';
import { ConversationContext } from '../../../src/types/conversation.types';

const baseContext: ConversationContext = {
  conversationId: 'test',
  phoneNumber: '5511999999999',
  mode: 'discovery',
  profile: {},
  messages: [],
  metadata: {
    startedAt: new Date(),
    lastMessageAt: new Date(),
    messageCount: 3,
    extractionCount: 0,
    questionsAsked: 0,
    userQuestions: 0,
  },
};

describe('assessReadiness', () => {
  it('should NOT recommend without budget', () => {
    const profile: Partial<CustomerProfile> = { usage: 'misto' };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(false);
    expect(result.missingRequired).toContain('budget');
  });

  it('should recommend with budget + usage', () => {
    const profile: Partial<CustomerProfile> = { budget: 70000, usage: 'misto' };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(true);
  });

  it('should recommend with budget + usoPrincipal (no usage field)', () => {
    const profile: Partial<CustomerProfile> = { budget: 70000, usoPrincipal: 'diario' };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(true);
    expect(result.missingRequired).toHaveLength(0);
  });

  it('should recommend with budget + usoPrincipal=trabalho', () => {
    const profile: Partial<CustomerProfile> = { budget: 50000, usoPrincipal: 'trabalho' };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(true);
  });

  it('should NOT recommend with only budget (no usage or usoPrincipal)', () => {
    const profile: Partial<CustomerProfile> = { budget: 70000 };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(false);
    expect(result.missingRequired).toContain('usage');
  });

  it('should recommend with budget + bodyType (special case)', () => {
    const profile: Partial<CustomerProfile> = { budget: 60000, bodyType: 'suv' };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(true);
  });

  it('should recommend with budget + uber (special case)', () => {
    const profile: Partial<CustomerProfile> = { budget: 60000, usoPrincipal: 'uber' };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(true);
  });

  it('should recommend when user accepts suggestions', () => {
    const profile: Partial<CustomerProfile> = { budget: 50000, _acceptsSuggestions: true };
    const result = assessReadiness(profile, baseContext);
    expect(result.canRecommend).toBe(true);
  });
});

describe('identifyMissingInfo', () => {
  it('should not list usage as missing when usoPrincipal is set', () => {
    const profile: Partial<CustomerProfile> = { budget: 70000, usoPrincipal: 'diario' };
    const missing = identifyMissingInfo(profile);
    expect(missing).not.toContain('usage');
  });

  it('should list usage as missing when neither usage nor usoPrincipal is set', () => {
    const profile: Partial<CustomerProfile> = { budget: 70000 };
    const missing = identifyMissingInfo(profile);
    expect(missing).toContain('usage');
  });

  it('should not list usage when usage field is set', () => {
    const profile: Partial<CustomerProfile> = { budget: 70000, usage: 'misto' };
    const missing = identifyMissingInfo(profile);
    expect(missing).not.toContain('usage');
  });
});
