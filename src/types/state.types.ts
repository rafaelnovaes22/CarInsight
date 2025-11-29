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
  // Customer info
  customerName?: string;

  // Budget
  budget?: number;
  budgetMin?: number;
  budgetMax?: number;
  budgetFlexibility?: number; // percentage (e.g., 10 = +/- 10%)
  orcamento?: number; // alias for budget (Portuguese)

  // Usage
  usage?: 'cidade' | 'viagem' | 'trabalho' | 'misto';
  usagePattern?: string; // legacy support
  usoPrincipal?: string; // alias for usage (Portuguese)
  tipoUber?: 'uberx' | 'comfort' | 'black'; // Uber category

  // People
  people?: number;
  familySize?: number; // legacy support

  // Vehicle preferences
  bodyType?: 'sedan' | 'hatch' | 'suv' | 'pickup' | 'minivan';
  vehicleType?: string; // legacy support
  transmission?: 'manual' | 'automatico';
  fuelType?: 'gasolina' | 'flex' | 'diesel' | 'hibrido' | 'eletrico';

  // Constraints
  minYear?: number;
  maxKm?: number;

  // Specific preferences
  color?: string;
  brand?: string;
  model?: string;

  // Priorities and deal breakers
  priorities?: string[]; // ['economico', 'conforto', 'espaco']
  dealBreakers?: string[]; // ['leilao', 'alta_quilometragem', 'muito_antigo']

  // Trade-in
  hasTradeIn?: boolean;

  // Urgency
  urgency?: 'imediato' | '1mes' | '3meses' | 'flexivel';
  
  // Internal state flags (used for conversation flow)
  _waitingForSuggestionResponse?: boolean; // Indicates we offered suggestions and waiting for user response
  _searchedItem?: string; // The item (model/brand/category) that was not found
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
