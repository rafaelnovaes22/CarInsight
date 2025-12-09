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
  bodyType?: 'sedan' | 'hatch' | 'suv' | 'pickup' | 'minivan' | 'furgao';
  vehicleType?: string; // legacy support
  transmission?: 'manual' | 'automatico';
  fuelType?: 'gasolina' | 'flex' | 'diesel' | 'hibrido' | 'eletrico';

  // Constraints
  minYear?: number;
  maxKm?: number;
  minSeats?: number; // Número mínimo de lugares (ex: 7 lugares)

  // Specific preferences
  color?: string;
  brand?: string;
  model?: string;

  // Priorities and deal breakers
  priorities?: string[]; // ['economico', 'conforto', 'espaco']
  dealBreakers?: string[]; // ['leilao', 'alta_quilometragem', 'muito_antigo']

  // Trade-in (basic)
  hasTradeIn?: boolean;

  // Trade-in (detailed)
  tradeInBrand?: string;           // Marca do veículo na troca
  tradeInModel?: string;           // Modelo do veículo na troca
  tradeInYear?: number;            // Ano do veículo na troca
  tradeInEstimatedValue?: number;  // Valor estimado

  // Financing
  wantsFinancing?: boolean;        // Se quer financiar
  financingDownPayment?: number;   // Entrada disponível
  financingMonths?: number;        // Prazo desejado (em meses)

  // Urgency
  urgency?: 'imediato' | '1mes' | '3meses' | 'flexivel';

  // Internal state flags (used for conversation flow)
  _waitingForSuggestionResponse?: boolean; // Indicates we offered suggestions and waiting for user response
  _searchedItem?: string; // The item (model/brand/category) that was not found
  _skipOnboarding?: boolean; // Skip remaining onboarding steps (user asked for specific brand/model)
  _availableYears?: number[]; // Anos disponíveis quando modelo não encontrado no ano pedido

  _lastShownVehicles?: Array<{
    vehicleId: string;
    brand: string;
    model: string;
    year: number;
    price: number;
    bodyType?: string; // hatch, sedan, suv, pickup
  }>; // Veículos mostrados na última recomendação
  _lastSearchType?: 'specific' | 'similar' | 'recommendation'; // Tipo da última busca realizada
  _showedRecommendation?: boolean; // Indica que acabou de mostrar uma recomendação
  _excludeVehicleIds?: string[]; // IDs de veículos a excluir das próximas buscas
  _waitingForSimilarApproval?: boolean; // Se estamos aguardando o usuário aceitar ver similares
  _pendingSimilarResults?: VehicleRecommendation[]; // Resultados similares aguardando aprovação

  // Financing/Trade-in flow control
  _awaitingFinancingDetails?: boolean; // Aguardando detalhes de financiamento (entrada, troca)
  _awaitingTradeInDetails?: boolean;   // Aguardando detalhes do veículo de troca
  tradeInKm?: number;                  // Km do veículo na troca
}

/**
 * Metadata from exact search results
 * **Feature: exact-vehicle-search**
 */
export interface ExactSearchMetadata {
  type: 'exact' | 'year_alternatives' | 'suggestions' | 'unavailable';
  message: string;
  availableYears?: number[];
  requestedModel: string;
  requestedYear: number;
  matchType: 'exact' | 'year_alternative' | 'suggestion';
}

export interface VehicleRecommendation {
  vehicleId: string;
  matchScore: number; // 0-100
  reasoning: string;
  highlights: string[];
  concerns: string[];
  vehicle?: any; // Full vehicle object from DB
  exactSearchMetadata?: ExactSearchMetadata; // Metadata from exact search (Feature: exact-vehicle-search)
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
