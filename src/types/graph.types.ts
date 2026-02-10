import { BaseMessage } from '@langchain/core/messages';
import { CustomerProfile, VehicleRecommendation, QuizState } from './state.types';

/**
 * Definition of the Conversation Graph State
 * This matches the interface required by LangGraph
 */
export interface IGraphState {
  // Messages history (standard LangChain messages)
  messages: BaseMessage[];

  // Identification
  phoneNumber: string;

  // Custom domains
  profile: Partial<CustomerProfile>;
  recommendations: VehicleRecommendation[];

  // Control flow
  next: string;

  // Metadata & Metrics
  metadata: {
    startedAt: number;
    lastMessageAt: number;
    loopCount: number;
    errorCount: number;
    errorCount: number;
    flags: string[];
    tokenUsage?: any;
    llmUsed?: string;
  };

  // Legacy Quiz State (for backward compatibility during migration)
  quiz: QuizState;
}

/**
 * Default initial state factory
 */
export function createInitialState(): IGraphState {
  return {
    messages: [],
    phoneNumber: '',
    profile: {},
    recommendations: [],
    next: 'greeting',
    metadata: {
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
      loopCount: 0,
      errorCount: 0,
      flags: [],
    },
    quiz: {
      currentQuestion: 1,
      progress: 0,
      answers: {},
      isComplete: false,
    },
  };
}
