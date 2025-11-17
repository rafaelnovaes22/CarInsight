/**
 * LangGraph State Types for FaciliAuto Bot
 */

export interface QuizAnswers {
  budget?: number;
  usage?: 'cidade' | 'viagem' | 'trabalho' | 'misto';
  people?: number;
  hasTradeIn?: boolean;
  minYear?: number;
  maxKm?: number;
  vehicleType?: 'sedan' | 'hatch' | 'suv' | 'pickup' | 'qualquer';
  urgency?: 'imediato' | '1mes' | '3meses' | 'flexivel';
}

export interface CustomerProfile {
  budget: number;
  budgetFlexibility: number; // percentage (e.g., 10 = +/- 10%)
  usagePattern: string;
  familySize: number;
  priorities: string[]; // ['economico', 'conforto', 'espaco']
  dealBreakers: string[]; // ['alto_km', 'muito_antigo']
  hasTradeIn: boolean;
  minYear: number;
  maxKm: number;
  vehicleType: string;
  urgency: string;
}

export interface VehicleRecommendation {
  vehicleId: string;
  matchScore: number; // 0-100
  reasoning: string;
  highlights: string[];
  concerns: string[];
  vehicle?: any; // Full vehicle object from DB
}

export interface BotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface QuizState {
  currentQuestion: number; // 1-8
  progress: number; // 0-8
  answers: QuizAnswers;
  isComplete: boolean;
}

export interface GraphContext {
  currentNode: string;
  previousNode?: string;
  nodeHistory: string[];
  errorCount: number;
  loopCount: number;
}

/**
 * Main Conversation State for LangGraph
 */
export interface ConversationState {
  // === Identification ===
  conversationId: string;
  phoneNumber: string;
  
  // === Messages (compatible with LangChain) ===
  messages: BotMessage[];
  
  // === Quiz State ===
  quiz: QuizState;
  
  // === Customer Profile (generated after quiz) ===
  profile: CustomerProfile | null;
  
  // === Recommendations ===
  recommendations: VehicleRecommendation[];
  
  // === Graph Context ===
  graph: GraphContext;
  
  // === Metadata ===
  metadata: {
    startedAt: Date;
    lastMessageAt: Date;
    leadQuality?: 'hot' | 'warm' | 'cold';
    flags: string[];
  };
}

/**
 * State update type (for reducers)
 */
export type StateUpdate = Partial<ConversationState>;

/**
 * Node function signature
 */
export type NodeFunction = (
  state: ConversationState
) => Promise<StateUpdate> | StateUpdate;
