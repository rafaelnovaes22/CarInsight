/**
 * CategoryClassifierService
 *
 * Serviço para classificação de veículos em múltiplas categorias usando LLM.
 * Utiliza prompts especializados (Single-Responsibility Prompts) para cada categoria,
 * executando chamadas em paralelo para otimizar tempo.
 *
 * Categorias:
 * - Família (aptoFamilia)
 * - Uber X/Comfort (aptoUber)
 * - Uber Black (aptoUberBlack)
 * - Carga (aptoCarga)
 * - Uso Diário (aptoUsoDiario)
 * - Entrega (aptoEntrega)
 * - Viagem (aptoViagem)
 */

import { Vehicle } from '@prisma/client';
import { chatCompletion } from '../lib/llm-router';
import { logger } from '../lib/logger';
import {
  CATEGORY_PROMPTS,
  CategoryName,
  VehicleData,
  interpolatePrompt,
} from '../lib/category-prompts';
import { VehicleClassifierService } from './vehicle-classifier.service';

export interface FullClassificationResult {
  aptoFamilia: boolean;
  aptoUber: boolean;
  aptoUberBlack: boolean;
  aptoCarga: boolean;
  aptoUsoDiario: boolean;
  aptoEntrega: boolean;
  aptoViagem: boolean;
  confidence: Record<CategoryName, 'alta' | 'media' | 'baixa'>;
  reasoning: Record<CategoryName, string>;
  llmUsed: boolean;
}

interface SingleCategoryResult {
  category: CategoryName;
  approved: boolean;
  confidence: 'alta' | 'media' | 'baixa';
  reasoning: string;
  llmSuccess: boolean;
}

export class CategoryClassifierService {
  private static readonly LLM_OPTIONS = {
    temperature: 0.1, // Low temperature for consistent classification
    maxTokens: 200, // Short responses expected
  };

  // Non-Uber categories that use specialized LLM prompts
  private static readonly LLM_CATEGORIES: CategoryName[] = [
    'familia',
    'carga',
    'usoDiario',
    'entrega',
    'viagem',
  ];

  /**
   * Classifica um veículo em TODAS as categorias.
   *
   * Para Uber (X e Black): usa o sistema RAG existente (UberEligibilityAgent)
   * que combina regras do site da Uber + LLM.
   *
   * Para outras categorias: usa prompts LLM especializados.
   */
  static async classifyAll(
    vehicle: VehicleData,
    citySlug = 'sao-paulo'
  ): Promise<FullClassificationResult> {
    const vehicleData = this.normalizeVehicleData(vehicle);

    logger.info(
      { marca: vehicleData.marca, modelo: vehicleData.modelo, ano: vehicleData.ano },
      'Starting parallel category classification'
    );

    // Run Uber classification (RAG + LLM) and other categories (LLM only) in parallel
    const [uberResult, ...llmResults] = await Promise.all([
      this.classifyUberWithRAG(vehicleData, citySlug),
      ...this.LLM_CATEGORIES.map(category => this.classifySingleCategory(category, vehicleData)),
    ]);

    // Aggregate results
    const aggregated = this.aggregateResultsWithUber(uberResult, llmResults, vehicleData);

    logger.info(
      {
        marca: vehicleData.marca,
        modelo: vehicleData.modelo,
        results: {
          familia: aggregated.aptoFamilia,
          uber: aggregated.aptoUber,
          uberBlack: aggregated.aptoUberBlack,
          carga: aggregated.aptoCarga,
          usoDiario: aggregated.aptoUsoDiario,
          entrega: aggregated.aptoEntrega,
          viagem: aggregated.aptoViagem,
        },
        uberSource: uberResult.source,
      },
      'Classification complete'
    );

    return aggregated;
  }

  /**
   * Classifica Uber usando o sistema RAG existente que combina:
   * 1. Regras baixadas do site da Uber (banco de dados)
   * 2. LLM para casos não cobertos
   */
  private static async classifyUberWithRAG(
    vehicle: VehicleData,
    citySlug: string
  ): Promise<{
    aptoUber: boolean;
    aptoUberBlack: boolean;
    source: any;
    reasoning: string;
    confidence: number;
  }> {
    try {
      const { uberEligibilityAgent } = await import('./uber-eligibility-agent.service');

      const result = await uberEligibilityAgent.evaluate(
        {
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          carroceria: vehicle.carroceria,
          arCondicionado: vehicle.arCondicionado,
          portas: vehicle.portas,
          cambio: vehicle.cambio ?? undefined,
          cor: vehicle.cor ?? undefined,
        },
        citySlug
      );

      return {
        aptoUber: result.uberX || result.uberComfort,
        aptoUberBlack: result.uberBlack,
        source: result.source,
        reasoning: result.reasoning,
        confidence: result.confidence,
      };
    } catch (error) {
      logger.error(
        { error: (error as Error).message },
        'Uber RAG classification failed, using fallback'
      );

      // Fallback to deterministic rules
      const vehicleForClassifier = {
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        ano: vehicle.ano,
        carroceria: vehicle.carroceria,
        portas: vehicle.portas,
        arCondicionado: vehicle.arCondicionado,
        km: vehicle.km || 0,
      } as any;

      const classification = VehicleClassifierService.classify(vehicleForClassifier);

      return {
        aptoUber: classification.aptoUber,
        aptoUberBlack: classification.aptoUberBlack,
        source: { citySlug, sourceUrl: 'fallback', fetchedAt: new Date().toISOString() },
        reasoning: 'Fallback: regras determinísticas',
        confidence: 0.5,
      };
    }
  }

  /**
   * Classifica uma única categoria usando o prompt especializado.
   */
  private static async classifySingleCategory(
    category: CategoryName,
    vehicle: VehicleData
  ): Promise<SingleCategoryResult> {
    const promptConfig = CATEGORY_PROMPTS[category];
    const prompt = interpolatePrompt(promptConfig.template, vehicle);

    try {
      const llmResponse = await chatCompletion([{ role: 'user', content: prompt }], this.LLM_OPTIONS);
      const content = typeof llmResponse === 'string' ? llmResponse : llmResponse.content;

      // Parse JSON response
      const parsed = this.parseResponse(content, category);

      return {
        category,
        approved: parsed.approved,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        llmSuccess: true,
      };
    } catch (error) {
      logger.warn(
        { category, error: (error as Error).message },
        'LLM classification failed, falling back to deterministic rules'
      );

      // Fallback to deterministic classification
      const fallback = this.getDeterministicFallback(category, vehicle);

      return {
        category,
        approved: fallback.approved,
        confidence: 'baixa',
        reasoning: 'Classificação via regras determinísticas (fallback)',
        llmSuccess: false,
      };
    }
  }

  /**
   * Parse LLM JSON response with error handling
   */
  private static parseResponse(
    response: string,
    category: CategoryName
  ): { approved: boolean; confidence: 'alta' | 'media' | 'baixa'; reasoning: string } {
    try {
      // Clean response (remove markdown code blocks if present)
      const cleaned = response
        .trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      // Extract the approval field based on category
      const fieldName = CATEGORY_PROMPTS[category].fieldName;
      const approved = parsed[fieldName] === true;
      const confidence = parsed.confidence || 'media';
      const reasoning = parsed.reasoning || 'Sem justificativa';

      return { approved, confidence, reasoning };
    } catch (parseError) {
      logger.warn(
        { category, response: response.substring(0, 200), error: (parseError as Error).message },
        'Failed to parse LLM response'
      );

      // Conservative fallback: reject
      return {
        approved: false,
        confidence: 'baixa',
        reasoning: 'Erro ao processar resposta do LLM',
      };
    }
  }

  /**
   * Fallback to VehicleClassifierService deterministic rules
   */
  private static getDeterministicFallback(
    category: CategoryName,
    vehicle: VehicleData
  ): { approved: boolean } {
    // Build a minimal Vehicle-like object for the classifier
    const vehicleForClassifier = {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      ano: vehicle.ano,
      carroceria: vehicle.carroceria,
      portas: vehicle.portas,
      arCondicionado: vehicle.arCondicionado,
      km: vehicle.km || 0,
    } as any;

    const classification = VehicleClassifierService.classify(vehicleForClassifier);

    switch (category) {
      case 'familia':
        return { approved: classification.aptoFamilia };
      case 'uberX':
        return { approved: classification.aptoUber };
      case 'uberBlack':
        return { approved: classification.aptoUberBlack };
      case 'carga':
        return { approved: classification.aptoCarga };
      case 'usoDiario':
        return { approved: classification.aptoUsoDiario };
      case 'entrega':
        return { approved: classification.aptoEntrega };
      case 'viagem':
        // Viagem fallback: same logic as familia with ar-condicionado check
        return { approved: classification.aptoFamilia && vehicle.arCondicionado };
      default:
        return { approved: false };
    }
  }

  /**
   * Aggregate results combining Uber RAG with LLM-based categories
   */
  private static aggregateResultsWithUber(
    uberResult: {
      aptoUber: boolean;
      aptoUberBlack: boolean;
      reasoning: string;
      confidence: number;
    },
    llmResults: SingleCategoryResult[],
    vehicle: VehicleData
  ): FullClassificationResult {
    const confidence: Record<CategoryName, 'alta' | 'media' | 'baixa'> = {
      uberX:
        uberResult.confidence >= 0.8 ? 'alta' : uberResult.confidence >= 0.5 ? 'media' : 'baixa',
      uberBlack:
        uberResult.confidence >= 0.8 ? 'alta' : uberResult.confidence >= 0.5 ? 'media' : 'baixa',
    } as Record<CategoryName, 'alta' | 'media' | 'baixa'>;

    const reasoning: Record<CategoryName, string> = {
      uberX: uberResult.reasoning,
      uberBlack: uberResult.reasoning,
    } as Record<CategoryName, string>;

    let aptoFamilia = false;
    let aptoCarga = false;
    let aptoUsoDiario = false;
    let aptoEntrega = false;
    let aptoViagem = false;
    let llmUsed = true;

    for (const result of llmResults) {
      confidence[result.category] = result.confidence;
      reasoning[result.category] = result.reasoning;

      if (!result.llmSuccess) {
        llmUsed = false;
      }

      switch (result.category) {
        case 'familia':
          aptoFamilia = result.approved;
          break;
        case 'carga':
          aptoCarga = result.approved;
          break;
        case 'usoDiario':
          aptoUsoDiario = result.approved;
          break;
        case 'entrega':
          aptoEntrega = result.approved;
          break;
        case 'viagem':
          aptoViagem = result.approved;
          break;
      }
    }

    return {
      aptoFamilia,
      aptoUber: uberResult.aptoUber,
      aptoUberBlack: uberResult.aptoUberBlack,
      aptoCarga,
      aptoUsoDiario,
      aptoEntrega,
      aptoViagem,
      confidence,
      reasoning,
      llmUsed,
    };
  }

  /**
   * Aggregate individual results into final classification
   */
  private static aggregateResults(
    results: SingleCategoryResult[],
    vehicle: VehicleData
  ): FullClassificationResult {
    const confidence: Record<CategoryName, 'alta' | 'media' | 'baixa'> = {} as any;
    const reasoning: Record<CategoryName, string> = {} as any;

    let aptoFamilia = false;
    let aptoUber = false;
    let aptoUberBlack = false;
    let aptoCarga = false;
    let aptoUsoDiario = false;
    let aptoEntrega = false;
    let aptoViagem = false;
    let llmUsed = true;

    for (const result of results) {
      confidence[result.category] = result.confidence;
      reasoning[result.category] = result.reasoning;

      if (!result.llmSuccess) {
        llmUsed = false;
      }

      switch (result.category) {
        case 'familia':
          aptoFamilia = result.approved;
          break;
        case 'uberX':
          aptoUber = result.approved;
          break;
        case 'uberBlack':
          aptoUberBlack = result.approved;
          break;
        case 'carga':
          aptoCarga = result.approved;
          break;
        case 'usoDiario':
          aptoUsoDiario = result.approved;
          break;
        case 'entrega':
          aptoEntrega = result.approved;
          break;
        case 'viagem':
          aptoViagem = result.approved;
          break;
      }
    }

    return {
      aptoFamilia,
      aptoUber,
      aptoUberBlack,
      aptoCarga,
      aptoUsoDiario,
      aptoEntrega,
      aptoViagem,
      confidence,
      reasoning,
      llmUsed,
    };
  }

  /**
   * Normalize Vehicle (Prisma) or VehicleData into consistent format
   */
  private static normalizeVehicleData(vehicle: Vehicle | VehicleData): VehicleData {
    return {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      ano: vehicle.ano,
      carroceria: vehicle.carroceria,
      portas: vehicle.portas,
      arCondicionado: vehicle.arCondicionado,
      cor: (vehicle as any).cor || undefined,
      combustivel: (vehicle as any).combustivel || undefined,
      km: (vehicle as any).km || undefined,
      cambio: (vehicle as any).cambio || undefined,
    };
  }

  /**
   * Classify a single category only (useful for testing individual prompts)
   */
  static async classifyCategory(
    category: CategoryName,
    vehicle: Vehicle | VehicleData
  ): Promise<SingleCategoryResult> {
    const vehicleData = this.normalizeVehicleData(vehicle);
    return this.classifySingleCategory(category, vehicleData);
  }
}

export const categoryClassifierService = new CategoryClassifierService();
