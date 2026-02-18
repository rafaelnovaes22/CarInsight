import { prisma } from '../lib/prisma';
import { chatCompletion, ChatMessage } from '../lib/groq';
import { logger, logEvent } from '../lib/logger';
import { exactSearchParser } from '../services/exact-search-parser.service';
import { exactSearchService, ExactSearchResult, Vehicle } from '../services/exact-search.service';
import { FallbackService } from '../services/fallback.service';
import { FallbackResponseFormatter } from '../services/fallback-response-formatter.service';
import { FallbackResult } from '../services/fallback.types';
import {
  performanceMetrics,
  measureTime,
  measureLLMCall,
  RecommendationStage,
} from '../services/performance-metrics.service';

interface VehicleMatch {
  vehicle: any;
  matchScore: number;
  reasoning: string;
}

interface LLMVehicleEvaluation {
  vehicleId: string;
  score: number;
  reasoning: string;
  isAdequate: boolean;
}

interface SpecificModelResult {
  found: boolean;
  requestedModel: string | null;
  requestedYear: number | null;
  exactMatches: any[];
  yearAlternatives: VehicleMatch[];
  similarSuggestions: VehicleMatch[];
  availableYears?: number[];
  message: string;
  resultType: 'exact' | 'year_alternatives' | 'suggestions' | 'unavailable' | 'none';
}

// Helper para capitalizar primeira letra do modelo
const capitalize = (str: string) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);

export class RecommendationAgent {
  private fallbackService: FallbackService;
  private fallbackFormatter: FallbackResponseFormatter;

  constructor() {
    this.fallbackService = new FallbackService();
    this.fallbackFormatter = new FallbackResponseFormatter();
  }

  async generateRecommendations(
    conversationId: string,
    answers: Record<string, any>
  ): Promise<VehicleMatch[]> {
    // Start performance tracking
    // **Feature: latency-optimization** - Requirements: 6.3, 6.4
    const requestId = performanceMetrics.startRequest(conversationId);
    let llmCallCount = 0;

    try {
      // Track vehicle search stage
      performanceMetrics.startStage(requestId, 'vehicle_search');

      // Get all available vehicles
      const vehicles = await prisma.vehicle.findMany({
        where: { disponivel: true },
      });

      performanceMetrics.endStage(requestId, 'vehicle_search', true, {
        vehiclesFound: vehicles.length,
      });

      if (vehicles.length === 0) {
        logger.warn('No vehicles available for recommendation');
        performanceMetrics.endRequest(requestId);
        return [];
      }

      // 1. Verificar se o usuário pediu um modelo específico
      // Track preference extraction stage
      performanceMetrics.startStage(requestId, 'preference_extraction');
      const specificModelResult = await this.handleSpecificModelRequest(vehicles, answers);
      performanceMetrics.endStage(requestId, 'preference_extraction', true, {
        requestedModel: specificModelResult.requestedModel,
        resultType: specificModelResult.resultType,
      });

      if (specificModelResult.requestedModel) {
        logger.info(
          {
            requestedModel: specificModelResult.requestedModel,
            requestedYear: specificModelResult.requestedYear,
            found: specificModelResult.found,
            exactMatches: specificModelResult.exactMatches.length,
            yearAlternatives: specificModelResult.yearAlternatives.length,
            resultType: specificModelResult.resultType,
          },
          'Specific model requested'
        );

        // Se encontrou o modelo exato, retornar com prioridade
        if (specificModelResult.found && specificModelResult.exactMatches.length > 0) {
          const matches = specificModelResult.exactMatches.slice(0, 3).map((vehicle, index) => ({
            vehicle,
            matchScore: 100 - index * 5, // 100, 95, 90 para os primeiros
            reasoning: `✅ ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano} - Exatamente o que você procura!`,
          }));

          await this.saveRecommendations(conversationId, matches);
          performanceMetrics.updateVehicleCounts(requestId, vehicles.length, matches.length);
          performanceMetrics.endRequest(requestId);
          return matches;
        }

        // Se tem alternativas de ano (mesmo modelo, anos diferentes)
        // **Feature: exact-vehicle-search** - Requirements: 3.1, 3.4
        if (specificModelResult.yearAlternatives.length > 0) {
          const yearMessage = specificModelResult.availableYears
            ? `Anos disponíveis: ${specificModelResult.availableYears.join(', ')}`
            : '';

          const matches = specificModelResult.yearAlternatives.slice(0, 3).map((match, index) => ({
            vehicle: match.vehicle,
            matchScore: match.matchScore,
            reasoning: `📅 ${match.reasoning}${yearMessage ? ` | ${yearMessage}` : ''}`,
          }));

          await this.saveRecommendations(conversationId, matches);
          performanceMetrics.updateVehicleCounts(requestId, vehicles.length, matches.length);
          performanceMetrics.endRequest(requestId);
          return matches;
        }

        // Se não encontrou, retornar sugestões similares
        if (specificModelResult.similarSuggestions.length > 0) {
          await this.saveRecommendations(conversationId, specificModelResult.similarSuggestions);
          performanceMetrics.updateVehicleCounts(
            requestId,
            vehicles.length,
            specificModelResult.similarSuggestions.length
          );
          performanceMetrics.endRequest(requestId);
          return specificModelResult.similarSuggestions;
        }
      }

      // 2. Fluxo normal: pré-filtrar e avaliar com LLM
      performanceMetrics.startStage(requestId, 'deterministic_ranking');
      const filteredVehicles = this.preFilterVehicles(vehicles, answers);
      performanceMetrics.endStage(requestId, 'deterministic_ranking', true, {
        filteredCount: filteredVehicles.length,
      });

      if (filteredVehicles.length === 0) {
        logger.warn('No vehicles passed pre-filter');
        performanceMetrics.endRequest(requestId);
        return [];
      }

      // Usar LLM para avaliar adequação ao contexto do usuário
      // Track LLM evaluation stage
      performanceMetrics.startStage(requestId, 'response_generation');
      const llmStartTime = Date.now();
      const evaluatedVehicles = await this.evaluateVehiclesWithLLM(filteredVehicles, answers);
      const llmDuration = Date.now() - llmStartTime;
      performanceMetrics.recordLLMCall(requestId, llmDuration, { purpose: 'vehicle_evaluation' });
      llmCallCount++;
      performanceMetrics.endStage(requestId, 'response_generation', true, {
        evaluatedCount: evaluatedVehicles.length,
      });

      // Filtrar apenas veículos adequados e ordenar por score
      const matches: VehicleMatch[] = evaluatedVehicles
        .filter(ev => ev.isAdequate && ev.score >= 50)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(ev => {
          const vehicle = filteredVehicles.find(v => v.id === ev.vehicleId);
          return {
            vehicle,
            matchScore: ev.score,
            reasoning: ev.reasoning,
          };
        })
        .filter(m => m.vehicle);

      await this.saveRecommendations(conversationId, matches);

      // End performance tracking and log summary
      // **Feature: latency-optimization** - Requirements: 6.3, 6.4
      performanceMetrics.updateVehicleCounts(requestId, vehicles.length, matches.length);
      const summary = performanceMetrics.endRequest(requestId);

      // Log recommendation completion event
      if (summary) {
        logEvent.recommendationCompleted({
          conversationId,
          requestId,
          totalDurationMs: summary.totalDurationMs,
          llmCallCount: summary.llmCallCount,
          llmTotalTimeMs: summary.llmTotalTimeMs,
          vehiclesProcessed: summary.vehiclesProcessed,
          vehiclesReturned: summary.vehiclesReturned,
          stages: summary.stages,
        });
      }

      return matches;
    } catch (error) {
      // End performance tracking on error
      performanceMetrics.endRequest(requestId);
      logger.error({ error, conversationId }, 'Error generating recommendations');
      return [];
    }
  }

  /**
   * Salva recomendações no banco e registra evento
   */
  private async saveRecommendations(
    conversationId: string,
    matches: VehicleMatch[]
  ): Promise<void> {
    for (let i = 0; i < matches.length; i++) {
      const baseData = {
        conversationId,
        vehicleId: matches[i].vehicle.id,
        matchScore: matches[i].matchScore,
        reasoning: matches[i].reasoning,
        position: i + 1,
      };

      try {
        await prisma.recommendation.create({
          data: {
            ...baseData,
            explanation: (matches[i] as any).explanation || undefined,
          } as any,
        });
      } catch (error: any) {
        const message = String(error?.message || '');
        const isExplanationCompatibilityIssue =
          message.includes('Unknown argument `explanation`') ||
          (message.includes('column') && message.includes('explanation')) ||
          (message.includes('does not exist') && message.includes('explanation'));

        if (isExplanationCompatibilityIssue) {
          await prisma.recommendation.create({ data: baseData });
        } else {
          throw error;
        }
      }
    }

    await prisma.event.create({
      data: {
        conversationId,
        eventType: 'recommendation_sent',
        metadata: JSON.stringify({
          count: matches.length,
          scores: matches.map(m => m.matchScore),
        }),
      },
    });

    logger.info(
      {
        conversationId,
        recommendationsCount: matches.length,
        topScore: matches[0]?.matchScore,
      },
      'Recommendations saved'
    );
  }

  /**
   * Detecta e processa pedido de modelo específico
   * Usa FallbackService para alternativas inteligentes quando modelo não encontrado
   *
   * **Feature: exact-vehicle-search**
   * Requirements: 2.1, 3.1, 4.1 - Handle exact search results with year alternatives and suggestions
   *
   * **Feature: vehicle-fallback-recommendations**
   * Requirements: 5.4 - Uses FallbackResponseFormatter for WhatsApp-friendly messages
   */
  private async handleSpecificModelRequest(
    vehicles: any[],
    answers: Record<string, any>
  ): Promise<SpecificModelResult> {
    // Build query from user answers to extract model and year
    const userText = [
      answers.usage || '',
      answers.bodyType || '',
      answers.preferredModel || '',
      answers.freeText || '',
    ].join(' ');

    // Use ExactSearchParser to extract model and year
    const extractedFilters = await exactSearchParser.parse(userText);

    // If no model detected by parser, try LLM detection as fallback
    let requestedModel = extractedFilters.model;
    if (!requestedModel) {
      requestedModel = await this.detectSpecificModel(answers);
    }

    if (!requestedModel) {
      return {
        found: false,
        requestedModel: null,
        requestedYear: null,
        exactMatches: [],
        yearAlternatives: [],
        similarSuggestions: [],
        message: '',
        resultType: 'none',
      };
    }

    // Convert database vehicles to Vehicle interface for ExactSearchService
    const inventory: Vehicle[] = vehicles.map(v => ({
      id: v.id,
      marca: v.marca,
      modelo: v.modelo,
      versao: v.versao,
      ano: v.ano,
      km: v.km,
      preco: typeof v.preco === 'string' ? parseFloat(v.preco) : v.preco,
      cor: v.cor,
      carroceria: v.carroceria,
      combustivel: v.combustivel,
      cambio: v.cambio,
      disponivel: v.disponivel,
      fotoUrl: v.fotoUrl,
      url: v.url,
    }));

    // If we have both model and year, use ExactSearchService
    if (extractedFilters.model && (extractedFilters.year || extractedFilters.yearRange)) {
      // Use ExactSearchService for model+year searches
      const exactResult = exactSearchService.search(extractedFilters, inventory);

      logger.info(
        {
          requestedModel: exactResult.requestedModel,
          requestedYear: exactResult.requestedYear,
          resultType: exactResult.type,
          vehiclesFound: exactResult.vehicles.length,
          availableYears: exactResult.availableYears,
        },
        'ExactSearchService result in recommendation agent'
      );

      // If no exact results, use FallbackService for intelligent alternatives
      if (exactResult.vehicles.length === 0 && exactResult.type === 'unavailable') {
        const requestedYear =
          extractedFilters.year ??
          (extractedFilters.yearRange ? extractedFilters.yearRange.min : null);
        const referencePrice = answers.budget;

        logger.info(
          {
            model: extractedFilters.model,
            year: requestedYear,
            referencePrice,
          },
          'Using FallbackService for alternatives in recommendation agent'
        );

        const fallbackResult = this.fallbackService.findAlternatives(
          extractedFilters.model,
          requestedYear,
          inventory,
          referencePrice
        );

        return this.convertFallbackResultToSpecificModelResult(fallbackResult, vehicles);
      }

      return this.convertExactSearchResult(exactResult, vehicles);
    }

    // Fallback: model only (no year specified) - use original logic
    const exactMatches = this.findExactModelMatches(vehicles, requestedModel, answers);

    if (exactMatches.length > 0) {
      return {
        found: true,
        requestedModel,
        requestedYear: null,
        exactMatches,
        yearAlternatives: [],
        similarSuggestions: [],
        message: `Encontramos ${exactMatches.length} ${requestedModel} disponível(is)!`,
        resultType: 'exact',
      };
    }

    // Não encontrou - usar FallbackService para alternativas inteligentes
    // **Feature: vehicle-fallback-recommendations** - Requirements: 5.4
    const referencePrice = answers.budget;
    const fallbackResult = this.fallbackService.findAlternatives(
      requestedModel,
      null,
      inventory,
      referencePrice
    );

    logger.info(
      {
        fallbackType: fallbackResult.type,
        vehiclesFound: fallbackResult.vehicles.length,
        message: fallbackResult.message,
      },
      'FallbackService result for model-only search'
    );

    return this.convertFallbackResultToSpecificModelResult(fallbackResult, vehicles);
  }

  /**
   * Convert FallbackResult to SpecificModelResult
   *
   * **Feature: vehicle-fallback-recommendations**
   * Requirements: 5.4 - Formats fallback results for WhatsApp display
   */
  private convertFallbackResultToSpecificModelResult(
    result: FallbackResult,
    originalVehicles: any[]
  ): SpecificModelResult {
    // Map vehicle IDs back to original vehicle objects
    const getOriginalVehicle = (id: string) => originalVehicles.find(v => v.id === id);

    // Format the response for WhatsApp
    const formattedResponse = this.fallbackFormatter.format(result);

    switch (result.type) {
      case 'year_alternative':
        return {
          found: false,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          exactMatches: [],
          yearAlternatives: result.vehicles
            .map(m => ({
              vehicle: getOriginalVehicle(m.vehicle.id),
              matchScore: m.similarityScore,
              reasoning: `📅 ${m.reasoning}`,
            }))
            .filter(m => m.vehicle),
          similarSuggestions: [],
          availableYears: result.availableYears,
          message: formattedResponse.acknowledgment,
          resultType: 'year_alternatives',
        };

      case 'same_brand':
      case 'same_category':
      case 'price_range':
        return {
          found: false,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          exactMatches: [],
          yearAlternatives: [],
          similarSuggestions: result.vehicles
            .map(m => ({
              vehicle: getOriginalVehicle(m.vehicle.id),
              matchScore: m.similarityScore,
              reasoning: `⚠️ ${formattedResponse.acknowledgment} ${m.reasoning}`,
            }))
            .filter(m => m.vehicle),
          message: formattedResponse.acknowledgment,
          resultType: 'suggestions',
        };

      case 'no_results':
      default:
        return {
          found: false,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          exactMatches: [],
          yearAlternatives: [],
          similarSuggestions: [],
          message: formattedResponse.acknowledgment,
          resultType: 'unavailable',
        };
    }
  }

  /**
   * Convert ExactSearchResult to SpecificModelResult
   *
   * **Feature: exact-vehicle-search**
   * Requirements: 2.1, 3.1, 4.1
   */
  private convertExactSearchResult(
    result: ExactSearchResult,
    originalVehicles: any[]
  ): SpecificModelResult {
    // Map vehicle IDs back to original vehicle objects
    const getOriginalVehicle = (id: string) => originalVehicles.find(v => v.id === id);

    switch (result.type) {
      case 'exact':
        return {
          found: true,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          exactMatches: result.vehicles.map(m => getOriginalVehicle(m.vehicle.id)).filter(Boolean),
          yearAlternatives: [],
          similarSuggestions: [],
          message: result.message,
          resultType: 'exact',
        };

      case 'year_alternatives':
        return {
          found: false,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          exactMatches: [],
          yearAlternatives: result.vehicles
            .map(m => ({
              vehicle: getOriginalVehicle(m.vehicle.id),
              matchScore: m.matchScore,
              reasoning: m.reasoning,
            }))
            .filter(m => m.vehicle),
          similarSuggestions: [],
          availableYears: result.availableYears,
          message: result.message,
          resultType: 'year_alternatives',
        };

      case 'suggestions':
        return {
          found: false,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          exactMatches: [],
          yearAlternatives: [],
          similarSuggestions: result.vehicles
            .map(m => ({
              vehicle: getOriginalVehicle(m.vehicle.id),
              matchScore: m.matchScore,
              reasoning: m.reasoning,
            }))
            .filter(m => m.vehicle),
          message: result.message,
          resultType: 'suggestions',
        };

      case 'unavailable':
      default:
        return {
          found: false,
          requestedModel: result.requestedModel,
          requestedYear: result.requestedYear,
          exactMatches: [],
          yearAlternatives: [],
          similarSuggestions: [],
          message: result.message,
          resultType: 'unavailable',
        };
    }
  }

  /**
   * Usa LLM para detectar se o usuário mencionou um modelo específico
   */
  private async detectSpecificModel(answers: Record<string, any>): Promise<string | null> {
    const userText = [
      answers.usage || '',
      answers.bodyType || '',
      answers.preferredModel || '',
      answers.freeText || '',
    ]
      .join(' ')
      .toLowerCase();

    // Se não tem texto suficiente, não tentar detectar
    if (userText.trim().length < 3) {
      return null;
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Você é um detector de modelos de veículos. Analise o texto e identifique se o usuário mencionou um MODELO ESPECÍFICO de carro.

Exemplos de modelos específicos:
- Marcas + Modelos: "Hilux", "Corolla", "Civic", "HB20", "Onix", "Gol", "Polo", "T-Cross", "Creta", "Compass", "Ranger", "S10", "Strada", "Toro", "Kicks", "HR-V", "Tracker", "Renegade", "Argo", "Cronos", "Virtus", "Nivus", "Mobi", "Kwid", "Duster", "Captur"

NÃO são modelos específicos:
- Tipos genéricos: "picape", "SUV", "sedan", "hatch", "carro popular"
- Usos: "trabalho", "família", "uber", "viagem"
- Características: "econômico", "espaçoso", "automático"

Retorne APENAS o nome do modelo se encontrar um específico, ou "NENHUM" se não encontrar.
Exemplos:
- "quero uma hilux" → "Hilux"
- "procuro um corolla ou civic" → "Corolla"
- "quero uma picape pra trabalhar" → "NENHUM"
- "carro pra uber" → "NENHUM"`,
      },
      {
        role: 'user',
        content: userText,
      },
    ];

    try {
      const response = await chatCompletion(messages, {
        temperature: 0.1,
        maxTokens: 50,
      });

      const detected = response.trim();

      if (detected === 'NENHUM' || detected.length < 2) {
        return null;
      }

      logger.info({ detected, userText }, 'Specific model detected');
      return detected;
    } catch (error) {
      logger.error({ error }, 'Error detecting specific model');
      return null;
    }
  }

  /**
   * Busca modelo exato no estoque
   */
  private findExactModelMatches(
    vehicles: any[],
    requestedModel: string,
    answers: Record<string, any>
  ): any[] {
    const modelLower = requestedModel.toLowerCase();
    const budget = answers.budget || Infinity;
    const minYear = answers.minYear || 1990;
    const maxKm = answers.maxKm || 500000;

    return vehicles
      .filter(v => {
        // Verificar se modelo ou marca contém o termo buscado
        const matchesModel =
          v.modelo.toLowerCase().includes(modelLower) ||
          v.marca.toLowerCase().includes(modelLower) ||
          `${v.marca} ${v.modelo}`.toLowerCase().includes(modelLower);

        if (!matchesModel) return false;

        // Aplicar filtros de orçamento/ano/km (com tolerância de 20% no orçamento)
        const preco = parseFloat(v.preco);
        if (preco > budget * 1.2) return false;
        if (v.ano < minYear) return false;
        if (v.km > maxKm) return false;

        return true;
      })
      .sort((a, b) => {
        // Preço mais alto primeiro
        const precoA = parseFloat(a.preco);
        const precoB = parseFloat(b.preco);
        if (precoB !== precoA) return precoB - precoA;
        // Ano mais novo segundo
        if (b.ano !== a.ano) return b.ano - a.ano;
        // Menos km terceiro
        return a.km - b.km;
      });
  }

  /**
   * Usa LLM para sugerir modelos similares quando não encontra o pedido
   */
  private async findSimilarModels(
    vehicles: any[],
    requestedModel: string,
    answers: Record<string, any>
  ): Promise<VehicleMatch[]> {
    // Pré-filtrar veículos por critérios básicos
    const filteredVehicles = this.preFilterVehicles(vehicles, answers);

    if (filteredVehicles.length === 0) {
      return [];
    }

    const vehiclesList = filteredVehicles.map(v => ({
      id: v.id,
      descricao: `${v.marca} ${v.modelo} ${v.versao || ''} ${v.ano}, ${v.km.toLocaleString('pt-BR')}km, R$${parseFloat(v.preco).toLocaleString('pt-BR')}, ${v.carroceria}`,
    }));

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `O cliente pediu um "${requestedModel}" mas NÃO TEMOS esse modelo disponível.

Sua tarefa é sugerir veículos SIMILARES do nosso estoque que possam atender o cliente.

Considere:
- Mesmo segmento/categoria (se pediu Hilux, sugira outras picapes como S10, Ranger, Strada)
- Mesma faixa de preço aproximada
- Características similares (se pediu SUV premium, sugira outros SUVs)
- Mesma marca pode ser um diferencial

Retorne APENAS um JSON no formato:
{
  "suggestions": [
    {"vehicleId": "id", "score": 0-100, "reasoning": "Por que é similar ao ${requestedModel}"}
  ]
}

IMPORTANTE: No reasoning, SEMPRE mencione que não temos o modelo pedido e explique por que essa é uma boa alternativa.`,
      },
      {
        role: 'user',
        content: `Modelo pedido: ${requestedModel}

VEÍCULOS DISPONÍVEIS:
${vehiclesList.map((v, i) => `${i + 1}. [${v.id}] ${v.descricao}`).join('\n')}

Sugira as 3 melhores alternativas similares.`,
      },
    ];

    try {
      const response = await chatCompletion(messages, {
        temperature: 0.3,
        maxTokens: 800,
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackSimilarSuggestions(filteredVehicles, requestedModel);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        return this.fallbackSimilarSuggestions(filteredVehicles, requestedModel);
      }

      return parsed.suggestions
        .slice(0, 3)
        .map((s: any) => {
          const vehicle = filteredVehicles.find(v => v.id === s.vehicleId);
          return {
            vehicle,
            matchScore: s.score || 75,
            reasoning: `⚠️ Não temos ${capitalize(requestedModel)} disponível. ${s.reasoning}`,
          };
        })
        .filter((m: VehicleMatch) => m.vehicle);
    } catch (error) {
      logger.error({ error }, 'Error finding similar models');
      return this.fallbackSimilarSuggestions(filteredVehicles, requestedModel);
    }
  }

  /**
   * Fallback para sugestões similares
   */
  private fallbackSimilarSuggestions(vehicles: any[], requestedModel: string): VehicleMatch[] {
    // Ordenar por preço (desc), km (asc), ano (desc)
    const sortedVehicles = [...vehicles].sort((a, b) => {
      const precoA = parseFloat(a.preco);
      const precoB = parseFloat(b.preco);
      if (precoB !== precoA) return precoB - precoA;
      if (b.ano !== a.ano) return b.ano - a.ano;
      return a.km - b.km;
    });

    return sortedVehicles.slice(0, 3).map((vehicle, index) => ({
      vehicle,
      matchScore: 70 - index * 5,
      reasoning: `⚠️ Não temos ${capitalize(requestedModel)} disponível. ${vehicle.marca} ${vehicle.modelo} pode ser uma alternativa.`,
    }));
  }

  /**
   * Pré-filtra veículos por critérios objetivos (orçamento, ano, km)
   */
  private preFilterVehicles(vehicles: any[], answers: Record<string, any>): any[] {
    const budget = answers.budget || Infinity;
    const minYear = answers.minYear || 1990;
    const maxKm = answers.maxKm || 500000;

    return vehicles
      .filter(vehicle => {
        const preco = parseFloat(vehicle.preco);
        // Permitir 10% acima do orçamento para dar opções
        if (preco > budget * 1.1) return false;
        if (vehicle.ano < minYear) return false;
        if (vehicle.km > maxKm) return false;
        return true;
      })
      .sort((a, b) => {
        // Ordenar por preço (desc), km (asc), ano (desc)
        const precoA = parseFloat(a.preco);
        const precoB = parseFloat(b.preco);
        if (precoB !== precoA) return precoB - precoA;
        if (b.ano !== a.ano) return b.ano - a.ano;
        return a.km - b.km;
      });
  }

  /**
   * Usa LLM para avaliar adequação dos veículos ao contexto do usuário
   */
  private async evaluateVehiclesWithLLM(
    vehicles: any[],
    answers: Record<string, any>
  ): Promise<LLMVehicleEvaluation[]> {
    // Construir descrição do perfil do usuário
    const userContext = this.buildUserContext(answers);

    // Construir lista de veículos para avaliação
    const vehiclesList = vehicles.map(v => ({
      id: v.id,
      descricao: `${v.marca} ${v.modelo} ${v.versao || ''} ${v.ano}, ${v.km.toLocaleString('pt-BR')}km, R$${parseFloat(v.preco).toLocaleString('pt-BR')}, ${v.carroceria}, ${v.combustivel}, ${v.cambio}`,
      carroceria: v.carroceria,
    }));

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Você é um especialista em vendas de veículos. Sua tarefa é avaliar quais veículos são mais adequados para o perfil e necessidade do cliente.

IMPORTANTE: Analise o CONTEXTO DE USO do cliente para determinar adequação:
- Se o cliente menciona "obra", "construção", "carga", "material", "campo", "fazenda", "rural" → PRIORIZE picapes e utilitários
- Se o cliente menciona "família", "crianças", "viagem" → PRIORIZE sedans, SUVs espaçosos
- Se o cliente menciona "cidade", "urbano", "economia" → PRIORIZE hatches compactos
- Se o cliente menciona "trabalho" (carga/obra) → PRIORIZE picapes/utilitários
- Se o cliente menciona "uso diário", "dia a dia", "trabalhar todo dia" (deslocamento) → PRIORIZE conforto, economia e durabilidade (sedans médios, hatches premium)
- Se o cliente menciona "Uber", "app", "99" → PRIORIZE sedans 4 portas com ar-condicionado

Retorne APENAS um JSON válido no formato:
{
  "evaluations": [
    {"vehicleId": "id", "score": 0-100, "reasoning": "motivo curto", "isAdequate": true/false}
  ]
}

O score deve refletir:
- 90-100: Perfeito para o contexto do cliente
- 70-89: Muito bom, atende bem
- 50-69: Aceitável, pode funcionar
- 0-49: Não adequado para o contexto

Seja RIGOROSO: se o cliente precisa de picape para obra, NÃO recomende sedans/hatches.`,
      },
      {
        role: 'user',
        content: `PERFIL DO CLIENTE:
${userContext}

VEÍCULOS DISPONÍVEIS:
${vehiclesList.map((v, i) => `${i + 1}. [${v.id}] ${v.descricao}`).join('\n')}

Avalie cada veículo e retorne o JSON com as avaliações.`,
      },
    ];

    try {
      const response = await chatCompletion(messages, {
        temperature: 0.3,
        maxTokens: 1500,
      });

      // Parsear resposta JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('LLM did not return valid JSON');
        return this.fallbackEvaluation(vehicles, answers);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.evaluations || !Array.isArray(parsed.evaluations)) {
        logger.error('LLM response missing evaluations array');
        return this.fallbackEvaluation(vehicles, answers);
      }

      logger.info({ evaluationsCount: parsed.evaluations.length }, 'LLM evaluations received');

      return parsed.evaluations;
    } catch (error) {
      logger.error({ error }, 'Error in LLM vehicle evaluation');
      return this.fallbackEvaluation(vehicles, answers);
    }
  }

  /**
   * Constrói descrição do contexto do usuário para o LLM
   */
  private buildUserContext(answers: Record<string, any>): string {
    const parts: string[] = [];

    if (answers.budget) {
      parts.push(`- Orçamento: R$ ${answers.budget.toLocaleString('pt-BR')}`);
    }
    if (answers.usage) {
      parts.push(`- Uso principal: ${answers.usage}`);
    }
    if (answers.usageContext) {
      parts.push(`- Contexto detalhado: ${answers.usageContext}`);
    }
    if (answers.people) {
      parts.push(`- Número de pessoas: ${answers.people}`);
    }
    if (answers.minYear) {
      parts.push(`- Ano mínimo: ${answers.minYear}`);
    }
    if (answers.maxKm) {
      parts.push(`- Km máxima: ${answers.maxKm.toLocaleString('pt-BR')}`);
    }
    if (answers.bodyType && answers.bodyType !== 'tanto faz') {
      parts.push(`- Preferência de carroceria: ${answers.bodyType}`);
    }
    if (answers.hasTradeIn) {
      parts.push(`- Tem carro para troca: ${answers.hasTradeIn}`);
    }

    return parts.join('\n');
  }

  /**
   * Avaliação de fallback caso o LLM falhe
   */
  private fallbackEvaluation(
    vehicles: any[],
    answers: Record<string, any>
  ): LLMVehicleEvaluation[] {
    return vehicles.map(vehicle => ({
      vehicleId: vehicle.id,
      score: 70, // Score neutro
      reasoning: `${vehicle.marca} ${vehicle.modelo} - Veículo disponível dentro dos critérios.`,
      isAdequate: true,
    }));
  }
}
