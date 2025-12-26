/**
 * Intent Detection Module
 *
 * Centralized module for detecting user intents from messages.
 * Separates the pattern matching logic from the main agent for better testability.
 */

import { CustomerProfile } from '../../types/state.types';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Types of search intent the user might have
 */
export type SearchIntent = 'specific' | 'recommendation' | 'category';

/**
 * Types of intent after seeing a vehicle recommendation
 */
export type PostRecommendationIntent =
  | 'want_others'
  | 'want_details'
  | 'want_schedule'
  | 'want_financing'
  | 'want_tradein'
  | 'want_interest'
  | 'new_search'
  | 'acknowledgment'
  | 'none';

/**
 * Vehicle info for context in intent detection
 */
export interface ShownVehicle {
  brand: string;
  model: string;
  year: number;
  price: number;
}

// ============================================
// REGEX PATTERN COLLECTIONS
// ============================================

/**
 * Patterns for detecting if user is asking a question
 */
export const QUESTION_PATTERNS: RegExp[] = [
  /\?$/, // Ends with ?
  /^(qual|quais|como|quando|onde|por que|quanto)/i, // Question words
  /diferença entre/i,
  /o que [ée]/i,
  /tem (algum|alguma)/i,
  /pode (me )?(explicar|dizer|falar)/i,
  /gostaria de saber/i,
  /queria saber/i,
  /voc[êe]s?\s*tem/i, // "você tem", "vocês tem"
  /tem\s*(disponível|disponivel)/i, // "tem disponível"
  /o que\s*(voc[êe]s?)?\s*tem/i, // "o que você tem"
  /quais?\s*(carro|veículo|modelo|opç)/i, // "qual carro", "quais opções"
];

/**
 * Short affirmative words that indicate acceptance
 */
export const SHORT_AFFIRMATIVES: readonly string[] = [
  'sim',
  's',
  'ss',
  'sss',
  'siiim',
  'siim',
  'ok',
  'okay',
  'blz',
  'bora',
  'show',
  'ta',
  'tá',
  'claro',
  'pode',
  'quero',
  'manda',
  'mostra',
  'beleza',
  'tranquilo',
  'vamos',
  'certeza',
  'pf',
  'pfv',
];

/**
 * Patterns for affirmative responses
 */
export const AFFIRMATIVE_PATTERNS: RegExp[] = [
  /\bsim\b/i,
  /\bpode\b/i,
  /\bquero\b/i,
  /\bbeleza\b/i,
  /\bclaro\b/i,
  /\bmanda\b/i,
  /\bmostra\b/i,
  /\bvamos\b/i,
  /\bbora\b/i,
  /\bok\b/i,
  /\bshow\b/i,
  /\btranquilo\b/i,
  /com certeza/i,
  /tudo bem/i,
  /pode ser/i,
  /por favor/i,
  /tenho interesse/i,
  /interessado/i,
];

/**
 * Patterns that negate affirmative responses
 */
export const NEGATIVE_OVERRIDE_PATTERNS: RegExp[] = [
  /\bn[aã]o\b/i,
  /\bnunca\b/i,
  /deixa\s*(pra)?\s*l[aá]/i,
  /sem\s*(interesse|necessidade)/i,
  /agora\s*n[aã]o/i,
];

/**
 * Patterns for explicit negative responses
 */
export const NEGATIVE_PATTERNS: RegExp[] = [
  /^(não|nao|n|nn|nope|nunca)$/i,
  /não\s*(quero|preciso|obrigado)/i,
  /deixa\s*(pra lá|quieto)/i,
  /sem\s*(interesse|necessidade)/i,
  /^(nada|deixa|esquece)$/i,
  /não,?\s*obrigado/i,
  /agora\s*não/i,
  /depois/i,
  /talvez\s*depois/i,
];

/**
 * Patterns for category availability questions
 */
export const CATEGORY_ASK_PATTERNS: RegExp[] = [
  /que\s+(pickup|picape|suv|sedan|hatch|caminhonete)s?\s+(tem|vocês|voces|você)/i,
  /quais?\s+(pickup|picape|suv|sedan|hatch)s?\s+(tem|temos|disponíve)/i,
  /(tem|temos|vocês tem)\s+(pickup|picape|suv|sedan|hatch)/i,
];

/**
 * Patterns for wanting OTHER options
 */
export const WANT_OTHERS_PATTERNS: RegExp[] = [
  // Explicit requests for others
  /tem\s*(outr[oa]s?|mais)/i,
  /quer[oi]?\s*(ver\s*)?(outr[oa]s?|mais)/i,
  /mostra\s*(outr[oa]s?|mais)/i,
  /mais\s*(opç|carros?|veículos?|alternativ)/i,
  /outras?\s*(opç|alternativ|sugest)/i,
  /^(outro|outra|outros|outras)$/i,
  /alguma?\s*(outr[oa]|alternativ|opç)/i,

  // Price/budget related
  /muito\s*(caro|cara)/i,
  /acima\s*do\s*(meu\s*)?(orçamento|budget)/i,
  /fora\s*do\s*(meu\s*)?(orçamento|budget)/i,
  /algo\s*(mais\s*)?(barato|em conta|acessível|econômico)/i,
  /tem\s*algo\s*(mais\s*)?(barato|em conta|caro)/i,
  /mais\s*(barato|caro|em conta)/i,
  /menos\s*(caro|cara)/i,

  // Negative about current option
  /não\s*(gost|curt)[eiao]/i,
  /não\s*(é|era)\s*(bem\s*)?(isso|esse|o\s*que)/i,
  /prefer[io]\s*outro/i,
  /não\s*me\s*interess/i,
  /não\s*(era|é)\s*(o\s*que)/i,
  /achei\s*(caro|ruim|feio)/i,

  // Asking for alternatives/options
  /ver\s*mais\s*opç/i,
  /ver\s*alternativ/i,
  /alternativ/i,
  /o\s*que\s*mais\s*tem/i,
  /que\s*mais\s*vocês?\s*tem/i,

  // Same type/profile/style requests
  /mesmo\s*(perfil|tipo|estilo|porte|tamanho|padrão|padrao|valor|preço|preco)/i,
  /opç.*(mesmo|parecid|similar|semelhant)/i,
  /parecid[oa]s?/i,
  /similar(es)?/i,
  /semelhant(es)?/i,
  /nesse\s*(estilo|perfil|valor|preço|padrão|porte)/i,
  /desse\s*(tipo|jeito|estilo|porte)/i,
  /nessa\s*(linha|faixa|categoria)/i,
  /dessa\s*(categoria|faixa)/i,
  /mesma\s*(linha|faixa|categoria)/i,
  /mesmo\s*(segmento|porte)/i,
  /na\s*mesma\s*(faixa|linha)/i,
  /do\s*mesmo\s*(tipo|jeito|estilo|porte|valor)/i,
  /assim/i,
  /esse\s*(estilo|tipo)\s*de\s*(carro|veículo)/i,
  /coisa\s*parecida/i,
  /algo\s*(parecido|similar|semelhante|assim|nessa linha)/i,

  // Competitor/equivalent requests
  /concorrent/i,
  /equivalent/i,
  /compara/i,

  // Budget with numbers
  /tem\s*(opç|algo|carro).*(até|ate)\s*\d/i,
  /(até|ate)\s*\d+\s*(mil|k|reais|r\$)?/i,
  /opç.*(até|ate)\s*\d/i,
  /na\s*faixa\s*de\s*\d/i,
  /entre\s*\d+\s*e\s*\d+/i,
  /por\s*(volta|cerca)\s*de\s*\d/i,
  /\d+\s*(mil|k)?\s*(reais|r\$)?/i,
];

/**
 * Patterns for wanting more DETAILS about shown vehicle
 */
export const WANT_DETAILS_PATTERNS: RegExp[] = [
  /mais\s*detalhes?/i,
  /conta\s*mais/i,
  /fal[ae]\s*mais/i,
  /quero\s*saber\s*mais/i,
  /como\s*(é|está)\s*(esse|o)\s*(carro|veículo)/i,
  /quilometragem/i,
  /km\??$/i,
  /procedência/i,
  /histórico/i,
  /dono|proprietário/i,
  /ipva|documentação|documento/i,
  /opcional|opcionais/i,
  /cor\??$/i,
  /foto|imagem|vídeo/i,
  /interessei?\s*(nesse|nele|no\s*primeiro)/i,
  /gost[eiao]\s*(desse|dele|do\s*primeiro)/i,
];

/**
 * Patterns for wanting to SCHEDULE/TALK
 */
export const WANT_SCHEDULE_PATTERNS: RegExp[] = [
  /vendedor/i,
  /atendente/i,
  /humano/i,
  /pessoa\s*real/i,
  /agendar/i,
  /visita/i,
  /ver\s*pessoalmente/i,
  /ir\s*até\s*(a\s*)?(loja|vocês)/i,
  /quero\s*(comprar|fechar|levar)/i,
  /vou\s*(levar|ficar\s*com)/i,
  /como\s*(faço|faz)\s*(pra|para)\s*(comprar|visitar)/i,
  /endereço/i,
  /onde\s*(fica|vocês\s*ficam)/i,
  /whatsapp|telefone|ligar/i,
];

/**
 * Patterns for expressing INTEREST in a shown vehicle
 */
export const WANT_INTEREST_PATTERNS: RegExp[] = [
  /gostei/i,
  /curti/i,
  /interessei/i,
  /quero\s*(esse|este|ele)/i,
  /esse\s*(mesmo|aí|ai)/i,
  /gostei\s*(do|desse|dele|da)\s*(primeiro|segundo|terceiro|1|2|3)/i,
  /quero\s*(o|a)\s*(primeiro|segundo|terceiro|1|2|3)/i,
  /me\s*interesse[io]/i,
  /t[óo]\s*gostando/i,
  /bom\s*demais/i,
  /perfeito/i,
  /excelente\s*op[çc][ãa]o/i,
];

/**
 * Patterns for wanting to FINANCE or discussing payment method
 */
export const WANT_FINANCING_PATTERNS: RegExp[] = [
  /financ/i,
  /parcel/i,
  /entrada/i,
  /presta[çc]/i,
  /vou financ/i,
  /quero financ/i,
  /como financ/i,
  /posso financ/i,
  /dá pra financ/i,
  /gostei.*financ/i,
  /interessei.*financ/i,
  /simul/i,
  // Formas de pagamento
  /[àa]\s*vista/i,
  /a\s*vista/i,
  /sem\s*entrada/i,
  /com\s*entrada/i,
  /pagar\s*[àa]\s*vista/i,
  /pagamento/i,
  // Valores monetários (entrada)
  /\d+\s*(mil|k)\s*(de\s*)?entrada/i,
  /entrada\s*(de\s*)?\d+/i,
  /tenho\s*\d+/i,
  /dar\s*\d+\s*(mil|k|reais)?/i,
];

/**
 * Patterns for wanting to TRADE-IN
 */
export const WANT_TRADEIN_PATTERNS: RegExp[] = [
  /tenho\s*(um|uma)?\s*(carro|veículo|moto)/i,
  /meu\s*(carro|veículo)/i,
  /carro\s*(na|pra|para)\s*troca/i,
  /dar\s*(na|de)?\s*troca/i,
  /trocar?\s*o\s*meu/i,
  /colocar.*troca/i,
  /usar.*troca/i,
  /aceita.*troca/i,
  /vou\s*dar\s*(na|de)\s*troca/i,
  // Menciona veículo específico como troca
  /tenho\s*(um|uma)?\s*(fiat|vw|volkswagen|gm|chevrolet|ford|honda|toyota|hyundai|renault|nissan|jeep|peugeot|citroen)/i,
  /meu\s*(fiat|vw|volkswagen|gm|chevrolet|ford|honda|toyota|hyundai|renault|nissan|jeep|peugeot|citroen)/i,
  // Responde "sim, tenho"
  /sim,?\s*(tenho|tem)/i,
  /tenho\s*sim/i,
  // Descrição do carro de troca (modelo + ano ou ano + modelo)
  /\b(onix|hb20|gol|polo|argo|mobi|ka|kwid|corolla|civic|cruze|kicks|creta|compass|tracker|hr-?v|tcross|renegade)\b.*\d{4}/i,
  /\d{4}.*\b(onix|hb20|gol|polo|argo|mobi|ka|kwid|corolla|civic|cruze|kicks|creta|compass|tracker|hr-?v|tcross|renegade)\b/i,
];

/**
 * Patterns for simple acknowledgment
 */
export const ACKNOWLEDGMENT_PATTERNS: RegExp[] = [
  /^ok$/i,
  /^entendi$/i,
  /^beleza$/i,
  /^legal$/i,
  /^certo$/i,
  /^tá bom$/i,
  /^ta bom$/i,
  /^show$/i,
  /^joia$/i,
  /^bacana$/i,
  /^obrigado$/i,
  /^valeu$/i,
];

/**
 * Patterns for post-recommendation intents (financing, trade-in, etc.)
 * Used in the main chat flow to skip exact search when user is responding about shown vehicle
 */
export const POST_RECOMMENDATION_INTENT_PATTERNS = {
  financing: /financ|parcel|entrada|presta[çc]/i,
  tradein: /troca|meu carro|tenho um|minha/i,
  schedule: /agendar|visita|vendedor|ver pessoal|ir a[íi]/i,
  interest: /gostei|interessei|curti|quero esse|esse (mesmo|a[íi])/i,
  details: /mais (info|detalhe)|quilometr|km|opcional|documento/i,
};

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Normalize message for pattern matching
 */
const normalize = (message: string): string => {
  return message
    .toLowerCase()
    .trim()
    .replace(/[.,!?]+$/, '')
    .trim();
};

/**
 * Detect if user is asking a question (vs just answering our questions)
 */
export const detectUserQuestion = (message: string): boolean => {
  return QUESTION_PATTERNS.some(pattern => pattern.test(message.trim()));
};

/**
 * Detect if user response is affirmative (accepting a suggestion)
 */
export const detectAffirmativeResponse = (message: string): boolean => {
  const normalized = normalize(message);

  // Check exact match with short affirmatives
  if (SHORT_AFFIRMATIVES.includes(normalized)) {
    return true;
  }

  // Check for negative overrides first
  if (NEGATIVE_OVERRIDE_PATTERNS.some(pattern => pattern.test(normalized))) {
    return false;
  }

  // Check affirmative patterns
  return AFFIRMATIVE_PATTERNS.some(pattern => pattern.test(normalized));
};

/**
 * Detect if user response is negative (declining a suggestion)
 */
export const detectNegativeResponse = (message: string): boolean => {
  const normalized = message.toLowerCase().trim();
  return NEGATIVE_PATTERNS.some(pattern => pattern.test(normalized));
};

/**
 * Detect user's search intent to determine flow
 *
 * @param message - The user's message
 * @param extracted - Extracted preferences from the message
 * @returns The detected search intent
 */
export const detectSearchIntent = (
  message: string,
  extracted: Partial<CustomerProfile>
): SearchIntent => {
  const msgLower = message.toLowerCase();

  // Has specific model = direct search
  if (extracted.model) {
    return 'specific';
  }

  // Asking about category availability
  if (CATEGORY_ASK_PATTERNS.some(p => p.test(message))) {
    return 'category';
  }

  // Has body type + usage/characteristics = wants recommendation
  const hasBodyType = !!extracted.bodyType;
  const hasUsage = !!(extracted.usage || extracted.usoPrincipal);
  const hasCharacteristic =
    msgLower.includes('econômico') ||
    msgLower.includes('economico') ||
    msgLower.includes('espaçoso') ||
    msgLower.includes('confortável') ||
    msgLower.includes('familia') ||
    msgLower.includes('família');

  if ((hasBodyType && !extracted.model) || hasUsage || hasCharacteristic) {
    return 'recommendation';
  }

  // Default to recommendation if unsure
  return 'recommendation';
};

/**
 * Detect user intent after showing a recommendation
 *
 * @param message - The user's message
 * @param _lastShownVehicles - Optional array of shown vehicles (for future use)
 * @returns The detected post-recommendation intent
 */
export const detectPostRecommendationIntent = (
  message: string,
  _lastShownVehicles?: ShownVehicle[]
): PostRecommendationIntent => {
  const normalized = message.toLowerCase().trim();

  // Guard: questions about Uber/99 eligibility should NOT be treated as "interest/choice"
  // Example: "O Focus serve pra Uber?" (mentions a shown model but is a question)
  const mentionsApp =
    /\buber\b/.test(normalized) ||
    /\b99\b/.test(normalized) ||
    normalized.includes('99pop') ||
    normalized.includes('99 pop') ||
    normalized.includes('99top') ||
    normalized.includes('99 top');
  const looksLikeEligibility =
    mentionsApp &&
    (/\bserve\b/.test(normalized) ||
      /\bapto\b/.test(normalized) ||
      /\broda(r)?\b/.test(normalized) ||
      /\bentra\b/.test(normalized) ||
      /\baceita\b/.test(normalized) ||
      /\bcategoria\b/.test(normalized) ||
      /\b(uber\s*)?x\b/.test(normalized) ||
      normalized.includes('comfort') ||
      normalized.includes('black'));

  if (looksLikeEligibility) {
    return 'none';
  }

  // Check patterns in order of priority - financing and tradein BEFORE schedule
  if (WANT_FINANCING_PATTERNS.some(p => p.test(normalized))) {
    return 'want_financing';
  }

  if (WANT_TRADEIN_PATTERNS.some(p => p.test(normalized))) {
    return 'want_tradein';
  }

  if (WANT_SCHEDULE_PATTERNS.some(p => p.test(normalized))) {
    return 'want_schedule';
  }

  if (WANT_DETAILS_PATTERNS.some(p => p.test(normalized))) {
    return 'want_details';
  }

  // PRIORITY: Check if user expressed interest in a shown vehicle BEFORE checking WANT_OTHERS
  // This prevents "Gostei do HB20" from being detected as 'want_others' because "20" matches the budget pattern
  // Patterns like "gostei do [modelo]", "quero o [modelo]", "curti o [modelo]" should be 'want_interest'
  if (_lastShownVehicles && _lastShownVehicles.length > 0) {
    const hasPositiveExpression =
      /gost[eiao]|curt[io]|quero|interessei|esse|bom|legal|perfeito/i.test(normalized);
    const mentionedShownVehicle = _lastShownVehicles.some(
      v => normalized.includes(v.model.toLowerCase()) || normalized.includes(v.brand.toLowerCase())
    );
    // If user expressed interest AND mentioned a shown vehicle, it's 'want_interest'
    // unless they also said "não" (negation)
    if (hasPositiveExpression && mentionedShownVehicle && !/\bnão\b/i.test(normalized)) {
      return 'want_interest';
    }
  }

  // IMPORTANT: Check WANT_OTHERS before WANT_INTEREST
  // Patterns like "não gostei" should be OTHERS, not INTEREST even though "gostei" is present
  if (WANT_OTHERS_PATTERNS.some(p => p.test(normalized))) {
    return 'want_others';
  }

  if (WANT_INTEREST_PATTERNS.some(p => p.test(normalized))) {
    return 'want_interest';
  }

  // Check if user mentioned a model from the shown vehicles (e.g., "gostei do HB20", "quero o civic")
  // This is a fallback for cases without explicit positive expression
  if (_lastShownVehicles && _lastShownVehicles.length > 0) {
    const mentionedShownVehicle = _lastShownVehicles.some(
      v => normalized.includes(v.model.toLowerCase()) || normalized.includes(v.brand.toLowerCase())
    );
    if (mentionedShownVehicle) {
      return 'want_interest';
    }
  }

  if (ACKNOWLEDGMENT_PATTERNS.some(p => p.test(normalized))) {
    return 'acknowledgment';
  }

  return 'none';
};

/**
 * Check if message indicates a post-recommendation intent
 * Used to skip exact search when user is responding about a shown vehicle
 *
 * @param message - The user's message
 * @param extracted - Extracted preferences (for wantsFinancing, hasTradeIn)
 * @returns true if the message is a post-recommendation response
 */
export const isPostRecommendationResponse = (
  message: string,
  extracted: Partial<CustomerProfile>
): boolean => {
  const patterns = POST_RECOMMENDATION_INTENT_PATTERNS;

  return (
    extracted.wantsFinancing === true ||
    patterns.financing.test(message) ||
    extracted.hasTradeIn === true ||
    patterns.tradein.test(message) ||
    patterns.schedule.test(message) ||
    patterns.interest.test(message) ||
    patterns.details.test(message)
  );
};

/**
 * Detect if the message is an explicit request for a recommendation/suggestion
 * e.g. "Pode me indicar um carro?", "Tem alguma sugestão?", "Me ajuda a escolher"
 *
 * @param message - User message
 * @returns true if it's a recommendation request
 */
export const isRecommendationRequest = (message: string): boolean => {
  const normalized = normalize(message);
  const keywords = [
    /indic[ao]/i,
    /recomenda/i,
    /suger[ie]/i,
    /sugest[ãa]o/i,
    /ajuda.*escolher/i,
    /ajuda.*comprar/i,
    /qual.*escolher/i,
    /qual.*comprar/i,
    /qual.*melhor/i,
    /mostra.*opç/i,
    /ver.*opç/i,
    /tem.*algum/i, // "Tem algum..." usually implies search
  ];

  return keywords.some(p => p.test(normalized));
};
