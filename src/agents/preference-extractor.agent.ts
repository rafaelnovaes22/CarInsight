/**
 * PreferenceExtractorAgent
 * 
 * Extracts structured customer preferences from natural language messages
 * using LLM-based semantic understanding.
 */

import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';
import { CustomerProfile } from '../types/state.types';
import { ExtractionResult, ExtractionConfig } from '../types/conversation.types';

export class PreferenceExtractorAgent {
  private readonly EXTRACTION_PROMPT = `Você é um especialista em extrair preferências estruturadas de mensagens sobre compra de veículos.

TAREFA:
Analise a mensagem do cliente e extraia TODAS as preferências mencionadas em formato JSON estruturado.

REGRAS:
1. Extraia apenas informações EXPLICITAMENTE mencionadas
2. Use null para campos não mencionados
3. Seja preciso e literal (não invente ou assuma)
4. Considere sinônimos e variações de escrita
5. Retorne APENAS JSON válido, sem texto adicional
6. IMPORTANTE: Se usuário mencionar NOME DE MODELO (ex: Spin, Civic, Corolla), 
   SEMPRE extraia brand e model. Conheça marcas dos modelos populares:
   - Spin, Onix, Prisma, Celta, Corsa, Classic, Cobalt, Tracker, S10 = Chevrolet
   - Civic, City, Fit, HR-V, CR-V = Honda
   - Corolla, Yaris, Etios, Hilux = Toyota
   - Gol, Polo, Fox, Voyage, Saveiro, T-Cross = Volkswagen
   - HB20, Creta, Tucson, i30 = Hyundai
   - Argo, Cronos, Mobi, Uno, Palio, Siena, Strada, Toro = Fiat
   - Ka, Fiesta, Focus, EcoSport, Ranger = Ford
   - Kwid, Sandero, Logan, Duster = Renault
   etc.

CAMPOS POSSÍVEIS:
- budget: number (valor em reais)
- budgetMin: number (se mencionar "a partir de X")
- budgetMax: number (se mencionar "até X")
- people: number (passageiros + motorista)
- minSeats: number (número MÍNIMO de lugares, ex: "7 lugares" → minSeats: 7)
- usage: "cidade" | "viagem" | "trabalho" | "misto"
- usoPrincipal: "uber" | "familia" | "trabalho" | "viagem" | "outro"
- tipoUber: "uberx" | "comfort" | "black" (se mencionar Uber/99)
- bodyType: "sedan" | "suv" | "hatch" | "pickup" | "minivan"
- minYear: number (ano mínimo aceito)
- maxKm: number (quilometragem máxima)
- transmission: "manual" | "automatico"
- fuelType: "gasolina" | "flex" | "diesel" | "hibrido" | "eletrico"
- color: string
- brand: string (marca preferida)
- model: string (modelo específico)
- priorities: string[] (ex: ["economico", "conforto", "espaco", "apto_uber", "familia", "cadeirinha", "crianca", "espaco_traseiro"])
- dealBreakers: string[] (ex: ["leilao", "alta_quilometragem", "hatch_pequeno"])
- wantsFinancing: boolean (true se mencionar "financiar", "parcelar", "financiamento", "parcela")
- financingDownPayment: number (valor da entrada se mencionado)
- hasTradeIn: boolean (true se mencionar "troca", "tenho um carro", "meu carro", "carro na troca")
- tradeInBrand: string (marca do carro de troca)
- tradeInModel: string (modelo do carro de troca)
- tradeInYear: number (ano do carro de troca)

REGRAS ESPECIAIS:
- Se mencionar "cadeirinha", "bebê conforto", "criança", "filho", "filhos" → usoPrincipal: "familia", priorities: ["cadeirinha", "espaco_traseiro"]
- Para família com crianças, NUNCA recomendar hatch pequeno (Mobi, Kwid, Up, Uno)
- Se mencionar "picape", "pickup", "caminhonete", "caçamba", "carga pesada", "obra", "material" → bodyType: "pickup", priorities incluir "pickup"
- Modelos de pickup conhecidos: Strada, S10, Hilux, Ranger, Saveiro, Toro, L200, Amarok → bodyType: "pickup"
- IMPORTANTE: Se mencionar "X lugares" (ex: "7 lugares", "5 lugares") → minSeats: X (número inteiro)
- Modelos conhecidos de 7 lugares: Spin, SW4, Pajero, Outlander, Commander, Taos, Tiggo 8, Captiva → minSeats: 7
- Modelos conhecidos de 5 lugares são a maioria dos carros, não precisa especificar minSeats

EXEMPLOS:

Entrada: "Quero um carro até 50 mil para 5 pessoas"
Saída: {
  "extracted": {
    "budget": 50000,
    "budgetMax": 50000,
    "people": 5
  },
  "confidence": 0.95,
  "reasoning": "Orçamento e quantidade de pessoas claramente especificados",
  "fieldsExtracted": ["budget", "budgetMax", "people"]
}

Entrada: "Preciso de um automático econômico para cidade"
Saída: {
  "extracted": {
    "transmission": "automatico",
    "usage": "cidade",
    "priorities": ["economico"]
  },
  "confidence": 0.9,
  "reasoning": "Transmissão, uso e prioridade de economia mencionados",
  "fieldsExtracted": ["transmission", "usage", "priorities"]
}

Entrada: "Nada de leilão ou muito rodado, prefiro a partir de 2018"
Saída: {
  "extracted": {
    "dealBreakers": ["leilao", "alta_quilometragem"],
    "minYear": 2018
  },
  "confidence": 0.85,
  "reasoning": "Deal breakers e ano mínimo identificados",
  "fieldsExtracted": ["dealBreakers", "minYear"]
}

Entrada: "Preciso de um carro para Uber, até 60 mil"
Saída: {
  "extracted": {
    "usoPrincipal": "uber",
    "budget": 60000,
    "budgetMax": 60000,
    "priorities": ["apto_uber"],
    "minYear": 2012
  },
  "confidence": 0.95,
  "reasoning": "Contexto Uber identificado, orçamento definido, ano mínimo implícito",
  "fieldsExtracted": ["usoPrincipal", "budget", "budgetMax", "priorities", "minYear"]
}

Entrada: "Quero trabalhar com Uber Black, precisa ser sedan"
Saída: {
  "extracted": {
    "usoPrincipal": "uber",
    "tipoUber": "black",
    "bodyType": "sedan",
    "priorities": ["apto_uber"],
    "minYear": 2018
  },
  "confidence": 0.9,
  "reasoning": "Uber Black requer sedan, ano mínimo 2018",
  "fieldsExtracted": ["usoPrincipal", "tipoUber", "bodyType", "priorities", "minYear"]
}

Entrada: "Spin" ou "Quero uma Spin" ou "Tem Chevrolet Spin?"
Saída: {
  "extracted": {
    "brand": "chevrolet",
    "model": "spin"
  },
  "confidence": 0.95,
  "reasoning": "Modelo específico mencionado (Spin é da Chevrolet)",
  "fieldsExtracted": ["brand", "model"]
}

Entrada: "Civic prata"
Saída: {
  "extracted": {
    "brand": "honda",
    "model": "civic",
    "color": "prata"
  },
  "confidence": 0.9,
  "reasoning": "Modelo específico (Civic é da Honda) e cor identificados",
  "fieldsExtracted": ["brand", "model", "color"]
}

Entrada: "Onix 2019" ou "Quero um Onix 2019" ou "Tem Onix 2019?"
Saída: {
  "extracted": {
    "brand": "chevrolet",
    "model": "onix",
    "minYear": 2019
  },
  "confidence": 0.95,
  "reasoning": "Modelo específico (Onix é da Chevrolet) com ano EXATO solicitado",
  "fieldsExtracted": ["brand", "model", "minYear"]
}

Entrada: "Corolla 2020" ou "Civic 2018" ou "HB20 2021"
Saída: {
  "extracted": {
    "brand": "toyota",
    "model": "corolla",
    "minYear": 2020
  },
  "confidence": 0.95,
  "reasoning": "Modelo específico com ano EXATO solicitado - minYear representa o ano desejado",
  "fieldsExtracted": ["brand", "model", "minYear"]
}

Entrada: "Preciso de uma picape para trabalho" ou "Quero uma pickup" ou "Tem caminhonete?"
Saída: {
  "extracted": {
    "bodyType": "pickup",
    "usage": "trabalho",
    "priorities": ["pickup", "carga"]
  },
  "confidence": 0.95,
  "reasoning": "Solicitação explícita de pickup/picape/caminhonete",
  "fieldsExtracted": ["bodyType", "usage", "priorities"]
}

Entrada: "Tem Strada?" ou "Quero uma S10" ou "Hilux até 80 mil"
Saída: {
  "extracted": {
    "bodyType": "pickup",
    "model": "strada",
    "brand": "fiat",
    "priorities": ["pickup"]
  },
  "confidence": 0.95,
  "reasoning": "Modelo de pickup identificado (Strada é Fiat, S10 é Chevrolet, Hilux é Toyota)",
  "fieldsExtracted": ["bodyType", "model", "brand", "priorities"]
}

Entrada: "Oi, tudo bem?"
Saída: {
  "extracted": {},
  "confidence": 0.0,
  "reasoning": "Apenas saudação, sem preferências sobre veículos",
  "fieldsExtracted": []
}

Entrada: "Quero uma SUV de 7 lugares"
Saída: {
  "extracted": {
    "bodyType": "suv",
    "minSeats": 7,
    "priorities": ["espaco", "familia"]
  },
  "confidence": 0.95,
  "reasoning": "SUV com requisito explícito de 7 lugares - OBRIGATÓRIO",
  "fieldsExtracted": ["bodyType", "minSeats", "priorities"]
}

Entrada: "Preciso de um carro de 7 lugares pra família"
Saída: {
  "extracted": {
    "minSeats": 7,
    "usoPrincipal": "familia",
    "priorities": ["familia", "espaco"]
  },
  "confidence": 0.95,
  "reasoning": "Requisito explícito de 7 lugares para família",
  "fieldsExtracted": ["minSeats", "usoPrincipal", "priorities"]
}

Entrada: "Spin ou algum carro de 7 lugares"
Saída: {
  "extracted": {
    "brand": "chevrolet",
    "model": "spin",
    "minSeats": 7
  },
  "confidence": 0.95,
  "reasoning": "Modelo específico (Spin é Chevrolet e tem 7 lugares) ou alternativas de 7 lugares",
  "fieldsExtracted": ["brand", "model", "minSeats"]
}`;

  /**
   * Extract preferences from user message
   */
  async extract(
    message: string,
    config: ExtractionConfig = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Build context string if available
      let contextString = '';
      if (config.currentProfile && Object.keys(config.currentProfile).length > 0) {
        contextString = `\n\nPERFIL ATUAL DO CLIENTE:\n${JSON.stringify(config.currentProfile, null, 2)}`;
      }

      if (config.conversationHistory && config.conversationHistory.length > 0) {
        const recentHistory = config.conversationHistory.slice(-3).join('\n');
        contextString += `\n\nMENSAGENS RECENTES:\n${recentHistory}`;
      }

      // Call LLM
      const result = await chatCompletion([
        {
          role: 'system',
          content: this.EXTRACTION_PROMPT + contextString
        },
        {
          role: 'user',
          content: `MENSAGEM DO CLIENTE: "${message}"\n\nRetorne APENAS o JSON de extração:`
        }
      ], {
        temperature: 0.1, // Low temperature for deterministic extraction
        maxTokens: 400
      });

      // Parse result
      const parsed = this.parseExtractionResult(result);

      // Validate confidence
      const minConfidence = config.minConfidence ?? 0.5;
      if (parsed.confidence < minConfidence) {
        logger.warn({
          message,
          confidence: parsed.confidence,
          minConfidence
        }, 'Extraction confidence below threshold');
      }

      // Log extraction
      logger.info({
        message: message.substring(0, 100),
        extracted: parsed.extracted,
        confidence: parsed.confidence,
        processingTime: Date.now() - startTime
      }, 'Preferences extracted');

      return parsed;

    } catch (error) {
      logger.error({ error, message }, 'Failed to extract preferences');

      // Return empty extraction on error
      return {
        extracted: {},
        confidence: 0,
        reasoning: `Erro na extração: ${error.message}`,
        fieldsExtracted: []
      };
    }
  }

  /**
   * Parse and validate LLM response
   */
  private parseExtractionResult(llmResponse: string): ExtractionResult {
    try {
      // Clean response (remove markdown code blocks if present)
      let cleaned = llmResponse.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }

      // Parse JSON
      const parsed = JSON.parse(cleaned);

      // Validate structure
      if (!parsed.extracted || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid extraction result structure');
      }

      // Ensure fieldsExtracted is present
      if (!parsed.fieldsExtracted) {
        parsed.fieldsExtracted = Object.keys(parsed.extracted || {});
      }

      // Normalize confidence to 0-1 range
      if (parsed.confidence > 1) {
        parsed.confidence = parsed.confidence / 100;
      }

      // Sanitize extracted data
      parsed.extracted = this.sanitizeExtracted(parsed.extracted);

      return parsed as ExtractionResult;

    } catch (error) {
      logger.error({ error, llmResponse }, 'Failed to parse extraction result');
      throw new Error(`Parse error: ${error.message}`);
    }
  }

  /**
   * Sanitize and validate extracted data
   */
  private sanitizeExtracted(extracted: Partial<CustomerProfile>): Partial<CustomerProfile> {
    const sanitized: Partial<CustomerProfile> = {};

    // Budget validation
    if (extracted.budget !== undefined && extracted.budget !== null) {
      sanitized.budget = Math.max(0, Math.floor(extracted.budget));
    }
    if (extracted.budgetMin !== undefined && extracted.budgetMin !== null) {
      sanitized.budgetMin = Math.max(0, Math.floor(extracted.budgetMin));
    }
    if (extracted.budgetMax !== undefined && extracted.budgetMax !== null) {
      sanitized.budgetMax = Math.max(0, Math.floor(extracted.budgetMax));
    }

    // People validation (1-10)
    if (extracted.people !== undefined && extracted.people !== null) {
      sanitized.people = Math.max(1, Math.min(10, Math.floor(extracted.people)));
    }

    // Usage validation
    const validUsage = ['cidade', 'viagem', 'trabalho', 'misto'];
    if (extracted.usage && validUsage.includes(extracted.usage)) {
      sanitized.usage = extracted.usage;
    }

    // Body type validation
    const validBodyTypes = ['sedan', 'suv', 'hatch', 'pickup', 'minivan'];
    if (extracted.bodyType && validBodyTypes.includes(extracted.bodyType)) {
      sanitized.bodyType = extracted.bodyType;
    }

    // Year validation (1950-2025) - permite carros clássicos e antigos
    if (extracted.minYear !== undefined && extracted.minYear !== null) {
      sanitized.minYear = Math.max(1950, Math.min(2025, Math.floor(extracted.minYear)));
    }

    // Km validation (0-500000)
    if (extracted.maxKm !== undefined && extracted.maxKm !== null) {
      sanitized.maxKm = Math.max(0, Math.min(500000, Math.floor(extracted.maxKm)));
    }

    // Seats validation (2-9)
    if (extracted.minSeats !== undefined && extracted.minSeats !== null) {
      sanitized.minSeats = Math.max(2, Math.min(9, Math.floor(extracted.minSeats)));
    }

    // Transmission validation
    const validTransmission = ['manual', 'automatico'];
    if (extracted.transmission && validTransmission.includes(extracted.transmission)) {
      sanitized.transmission = extracted.transmission;
    }

    // Fuel type validation
    const validFuelTypes = ['gasolina', 'flex', 'diesel', 'hibrido', 'eletrico'];
    if (extracted.fuelType && validFuelTypes.includes(extracted.fuelType)) {
      sanitized.fuelType = extracted.fuelType;
    }

    // String fields (sanitize)
    if (extracted.color) {
      sanitized.color = extracted.color.toLowerCase().trim();
    }
    if (extracted.brand) {
      sanitized.brand = this.normalizeBrand(extracted.brand);
    }
    if (extracted.model) {
      sanitized.model = extracted.model.trim().toLowerCase();

      // Check if model is a known pickup - infer brand and bodyType
      const pickupBrand = this.getPickupBrand(sanitized.model);
      if (pickupBrand) {
        // Auto-set brand if not already set
        if (!sanitized.brand) {
          sanitized.brand = pickupBrand;
        }
        // Auto-set bodyType to pickup
        sanitized.bodyType = 'pickup';
        // Add to priorities
        if (!sanitized.priorities) {
          sanitized.priorities = ['pickup'];
        } else if (!sanitized.priorities.includes('pickup')) {
          sanitized.priorities.push('pickup');
        }
      }
    }

    // Array fields
    if (Array.isArray(extracted.priorities)) {
      sanitized.priorities = extracted.priorities.filter(p => typeof p === 'string' && p.length > 0);
    }
    if (Array.isArray(extracted.dealBreakers)) {
      sanitized.dealBreakers = extracted.dealBreakers.filter(d => typeof d === 'string' && d.length > 0);
    }

    // Also copy usoPrincipal and tipoUber if present
    if (extracted.usoPrincipal) {
      sanitized.usoPrincipal = extracted.usoPrincipal;
    }
    if (extracted.tipoUber) {
      sanitized.tipoUber = extracted.tipoUber;
    }

    // Financing fields
    if (extracted.wantsFinancing !== undefined) {
      sanitized.wantsFinancing = Boolean(extracted.wantsFinancing);
    }
    if (extracted.financingDownPayment !== undefined && extracted.financingDownPayment !== null) {
      sanitized.financingDownPayment = Math.max(0, Math.floor(extracted.financingDownPayment));
    }

    // Trade-in fields
    if (extracted.hasTradeIn !== undefined) {
      sanitized.hasTradeIn = Boolean(extracted.hasTradeIn);
    }
    if (extracted.tradeInBrand) {
      sanitized.tradeInBrand = this.normalizeBrand(extracted.tradeInBrand);
    }
    if (extracted.tradeInModel) {
      sanitized.tradeInModel = extracted.tradeInModel.trim().toLowerCase();
    }
    if (extracted.tradeInYear !== undefined && extracted.tradeInYear !== null) {
      sanitized.tradeInYear = Math.max(1990, Math.min(2025, Math.floor(extracted.tradeInYear)));
    }

    return sanitized;
  }

  /**
   * Normalize brand names
   */
  private normalizeBrand(brand: string): string {
    const normalized = brand.toLowerCase().trim();

    const brandMap: Record<string, string> = {
      'volkswagen': 'volkswagen',
      'vw': 'volkswagen',
      'gm': 'chevrolet',
      'chevy': 'chevrolet',
      'fiat': 'fiat',
      'honda': 'honda',
      'toyota': 'toyota',
      'hyundai': 'hyundai',
      'ford': 'ford',
      'renault': 'renault',
      'nissan': 'nissan',
      'jeep': 'jeep',
      'citroen': 'citroen',
      'peugeot': 'peugeot',
      'mitsubishi': 'mitsubishi',
    };

    return brandMap[normalized] || normalized;
  }

  /**
   * Map pickup model names to their brands
   */
  private getPickupBrand(model: string): string | null {
    const modelLower = model.toLowerCase().trim();

    const pickupBrandMap: Record<string, string> = {
      'strada': 'fiat',
      'toro': 'fiat',
      's10': 'chevrolet',
      'montana': 'chevrolet',
      'hilux': 'toyota',
      'ranger': 'ford',
      'maverick': 'ford',
      'saveiro': 'volkswagen',
      'amarok': 'volkswagen',
      'l200': 'mitsubishi',
      'triton': 'mitsubishi',
      'frontier': 'nissan',
      'oroch': 'renault',
      'duster oroch': 'renault',
    };

    return pickupBrandMap[modelLower] || null;
  }

  /**
   * Merge extracted preferences with existing profile
   */
  mergeWithProfile(
    currentProfile: Partial<CustomerProfile>,
    extracted: Partial<CustomerProfile>
  ): Partial<CustomerProfile> {
    return {
      ...currentProfile,
      ...extracted,

      // Merge arrays intelligently
      priorities: [
        ...(currentProfile.priorities || []),
        ...(extracted.priorities || [])
      ].filter((v, i, a) => a.indexOf(v) === i), // unique

      dealBreakers: [
        ...(currentProfile.dealBreakers || []),
        ...(extracted.dealBreakers || [])
      ].filter((v, i, a) => a.indexOf(v) === i), // unique
    };
  }
}

// Singleton export
export const preferenceExtractor = new PreferenceExtractorAgent();
