/**
 * FallbackResponseFormatter
 *
 * Formats fallback results into user-friendly Portuguese messages for WhatsApp.
 * Provides clear acknowledgment of unavailability and explains why each alternative is relevant.
 *
 * **Feature: vehicle-fallback-recommendations**
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
 */

import {
  FallbackResult,
  FallbackType,
  FallbackVehicleMatch,
  MatchingCriterion,
  FormattedFallbackResponse,
  FormattedAlternative,
} from './fallback.types';

/**
 * Maximum number of reasons to include per vehicle
 */
const MAX_REASONS_PER_VEHICLE = 3;

/**
 * FallbackResponseFormatter class
 *
 * Formats fallback results into WhatsApp-friendly messages in Brazilian Portuguese.
 */
export class FallbackResponseFormatter {
  /**
   * Formats a FallbackResult into a user-friendly response
   *
   * @param result - The fallback result to format
   * @returns FormattedFallbackResponse with acknowledgment, alternatives, and summary
   */
  format(result: FallbackResult): FormattedFallbackResponse {
    const acknowledgment = this.formatAcknowledgment(
      result.requestedModel,
      result.requestedYear,
      result.type,
      result.availableYears
    );

    const alternatives = result.vehicles.map(match => this.formatAlternative(match, result.type));

    const summary = this.generateSummary(result);

    return {
      acknowledgment,
      alternatives,
      summary,
    };
  }

  /**
   * Formats the acknowledgment message indicating the exact vehicle is unavailable
   *
   * @param model - The requested model name
   * @param year - The requested year (null if not specified)
   * @param fallbackType - The type of fallback being applied
   * @param availableYears - Available years for year_alternative type
   * @returns Acknowledgment message in Portuguese
   */
  formatAcknowledgment(
    model: string,
    year: number | null,
    fallbackType: FallbackType,
    availableYears?: number[]
  ): string {
    if (!model || model.trim() === '') {
      return 'Não foi possível identificar o modelo desejado.';
    }

    const modelDisplay = this.capitalizeModel(model);
    const yearDisplay = year ? ` ${year}` : '';

    switch (fallbackType) {
      case 'year_alternative': {
        const yearsStr = availableYears?.join(', ') || '';
        return `Não temos o ${modelDisplay}${yearDisplay} disponível, mas temos o mesmo modelo nos anos: ${yearsStr}`;
      }

      case 'same_brand':
        return `Não temos o ${modelDisplay}${yearDisplay} disponível, mas temos outras opções da mesma marca na mesma categoria.`;

      case 'same_category':
        return `Não temos o ${modelDisplay}${yearDisplay} disponível, mas temos outras opções similares na mesma categoria.`;

      case 'price_range':
        return `Não temos o ${modelDisplay}${yearDisplay} disponível, mas temos outras opções em faixa de preço similar.`;

      case 'no_results':
        return `Não encontramos o ${modelDisplay}${yearDisplay} nem alternativas disponíveis no momento. Entre em contato com nossa equipe de vendas.`;

      default:
        return `Não temos o ${modelDisplay}${yearDisplay} disponível no momento.`;
    }
  }

  /**
   * Formats a single vehicle alternative for display
   *
   * @param match - The vehicle match to format
   * @param fallbackType - The type of fallback being applied
   * @returns FormattedAlternative with description, explanation, and highlights
   */
  formatAlternative(match: FallbackVehicleMatch, fallbackType: FallbackType): FormattedAlternative {
    const vehicle = match.vehicle;

    // Build vehicle description
    const vehicleDescription = this.buildVehicleDescription(vehicle);

    // Generate relevance explanation from matching criteria
    const relevanceExplanation = this.generateRelevanceExplanation(
      match.matchingCriteria,
      fallbackType
    );

    // Extract highlights (max 3)
    const highlights = this.extractHighlights(vehicle, match.matchingCriteria);

    return {
      vehicleDescription,
      relevanceExplanation,
      highlights,
    };
  }

  /**
   * Generates a relevance explanation from matching criteria
   * Limits to maximum 3 reasons per vehicle
   *
   * @param criteria - The matching criteria to explain
   * @param fallbackType - The type of fallback for context
   * @returns Human-readable explanation in Portuguese
   */
  generateRelevanceExplanation(criteria: MatchingCriterion[], fallbackType: FallbackType): string {
    // Filter to matched criteria only
    const matchedCriteria = criteria.filter(c => c.matched);

    if (matchedCriteria.length === 0) {
      return this.getDefaultExplanation(fallbackType);
    }

    // Limit to MAX_REASONS_PER_VEHICLE
    const limitedCriteria = matchedCriteria.slice(0, MAX_REASONS_PER_VEHICLE);

    // Build explanation from criteria details
    const reasons = limitedCriteria.map(c => c.details);

    return reasons.join(' • ');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Capitalizes the first letter of a model name
   */
  private capitalizeModel(model: string): string {
    if (!model) return '';
    return model.charAt(0).toUpperCase() + model.slice(1);
  }

  /**
   * Builds a formatted vehicle description
   */
  private buildVehicleDescription(vehicle: FallbackVehicleMatch['vehicle']): string {
    const parts: string[] = [];

    // Brand and model
    parts.push(`${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`);

    // Price
    const formattedPrice = vehicle.preco.toLocaleString('pt-BR');
    parts.push(`R$ ${formattedPrice}`);

    // Mileage
    const formattedKm = vehicle.km.toLocaleString('pt-BR');
    parts.push(`${formattedKm} km`);

    // Body type and transmission
    parts.push(`${vehicle.carroceria} | ${vehicle.cambio}`);

    return parts.join(' • ');
  }

  /**
   * Extracts highlights from vehicle and criteria (max 3)
   */
  private extractHighlights(
    vehicle: FallbackVehicleMatch['vehicle'],
    criteria: MatchingCriterion[]
  ): string[] {
    const highlights: string[] = [];

    // Add matched criteria as highlights
    const matchedCriteria = criteria.filter(c => c.matched);
    for (const criterion of matchedCriteria) {
      if (highlights.length >= MAX_REASONS_PER_VEHICLE) break;
      highlights.push(criterion.details);
    }

    // Add vehicle-specific highlights if we have room
    if (highlights.length < MAX_REASONS_PER_VEHICLE) {
      // Low mileage
      if (vehicle.km < 50000) {
        highlights.push(`Baixa quilometragem: ${vehicle.km.toLocaleString('pt-BR')} km`);
      }
    }

    if (highlights.length < MAX_REASONS_PER_VEHICLE) {
      // Recent year
      const currentYear = new Date().getFullYear();
      if (vehicle.ano >= currentYear - 2) {
        highlights.push(`Veículo recente: ${vehicle.ano}`);
      }
    }

    return highlights.slice(0, MAX_REASONS_PER_VEHICLE);
  }

  /**
   * Gets a default explanation based on fallback type
   */
  private getDefaultExplanation(fallbackType: FallbackType): string {
    switch (fallbackType) {
      case 'year_alternative':
        return 'Mesmo modelo, ano diferente';
      case 'same_brand':
        return 'Mesma marca, categoria similar';
      case 'same_category':
        return 'Mesma categoria, preço similar';
      case 'price_range':
        return 'Faixa de preço similar';
      default:
        return 'Alternativa disponível';
    }
  }

  /**
   * Generates a summary message for the response
   */
  private generateSummary(result: FallbackResult): string {
    const count = result.vehicles.length;

    if (count === 0) {
      return 'Não encontramos alternativas disponíveis. Gostaria de ver outras opções ou falar com um vendedor?';
    }

    const modelDisplay = this.capitalizeModel(result.requestedModel);

    switch (result.type) {
      case 'year_alternative':
        return `Encontramos ${count} ${modelDisplay} em outros anos. Qual te interessa?`;

      case 'same_brand':
        return `Encontramos ${count} opção(ões) da mesma marca. Quer saber mais sobre algum?`;

      case 'same_category':
        return `Encontramos ${count} opção(ões) similares. Qual te chamou atenção?`;

      case 'price_range':
        return `Encontramos ${count} opção(ões) na mesma faixa de preço. Posso dar mais detalhes?`;

      default:
        return `Encontramos ${count} alternativa(s). Gostaria de mais informações?`;
    }
  }
}

// Singleton export for convenience
export const fallbackResponseFormatter = new FallbackResponseFormatter();
