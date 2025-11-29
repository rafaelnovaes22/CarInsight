import { prisma } from '../lib/prisma';
import { generateRecommendationReasoning } from '../lib/groq';
import { logger } from '../lib/logger';

interface VehicleMatch {
  vehicle: any;
  matchScore: number;
  reasoning: string;
}

export class RecommendationAgent {
  async generateRecommendations(
    conversationId: string,
    answers: Record<string, any>
  ): Promise<VehicleMatch[]> {
    try {
      // Get all available vehicles
      const vehicles = await prisma.vehicle.findMany({
        where: { disponivel: true },
      });

      if (vehicles.length === 0) {
        logger.warn('No vehicles available for recommendation');
        return [];
      }

      // Calculate match score for each vehicle
      const matches: VehicleMatch[] = [];

      for (const vehicle of vehicles) {
        const matchScore = this.calculateMatchScore(vehicle, answers);
        
        if (matchScore >= 50) { // Only recommend vehicles with score >= 50
          const reasoning = await this.generateReasoning(vehicle, answers, matchScore);
          
          matches.push({
            vehicle,
            matchScore,
            reasoning,
          });
        }
      }

      // Sort by match score (descending) and take top 3
      matches.sort((a, b) => b.matchScore - a.matchScore);
      const topMatches = matches.slice(0, 3);

      // Save recommendations to database
      for (let i = 0; i < topMatches.length; i++) {
        await prisma.recommendation.create({
          data: {
            conversationId,
            vehicleId: topMatches[i].vehicle.id,
            matchScore: topMatches[i].matchScore,
            reasoning: topMatches[i].reasoning,
            position: i + 1,
          },
        });
      }

      await prisma.event.create({
        data: {
          conversationId,
          eventType: 'recommendation_sent',
          metadata: JSON.stringify({
            count: topMatches.length,
            scores: topMatches.map(m => m.matchScore),
          }),
        },
      });

      logger.info({
        conversationId,
        recommendationsCount: topMatches.length,
        topScore: topMatches[0]?.matchScore,
      }, 'Recommendations generated');

      return topMatches;
    } catch (error) {
      logger.error({ error, conversationId }, 'Error generating recommendations');
      return [];
    }
  }

  private calculateMatchScore(vehicle: any, answers: Record<string, any>): number {
    let score = 100;

    // Budget (30% weight) - HARD FILTER
    const preco = parseFloat(vehicle.preco);
    const budget = answers.budget;
    
    // Exclude vehicles over budget (deal breaker)
    if (preco > budget) {
      score = 0;
      return score;
    }
    
    // Bonus for vehicles well within budget
    const budgetUsage = preco / budget;
    if (budgetUsage < 0.7) {
      score += 10; // Great value
    } else if (budgetUsage >= 0.9) {
      score += 5; // Close to budget - maximize value
    }

    // Year (15% weight)
    const minYear = answers.minYear || 2010;
    if (vehicle.ano < minYear) {
      score = 0; // Deal breaker
      return score;
    }
    if (vehicle.ano >= minYear + 3) {
      score += 10; // Bonus for newer cars
    }

    // Km (15% weight) - HARD FILTER
    const maxKm = answers.maxKm || 200000;
    if (vehicle.km > maxKm) {
      score = 0; // Deal breaker - exclude vehicles over max km
      return score;
    } else if (vehicle.km < maxKm * 0.5) {
      score += 10; // Bonus for low mileage
    }

    // Body type (10% weight)
    const bodyType = answers.bodyType;
    if (bodyType && bodyType !== 'tanto faz') {
      if (vehicle.carroceria.toLowerCase().includes(bodyType.toLowerCase())) {
        score += 10;
      } else {
        score -= 15;
      }
    }

    // People capacity (8% weight)
    const people = answers.people || 5;
    // Assume most cars are 5-seaters, SUVs 7, pickups 5
    let vehicleCapacity = 5;
    if (vehicle.carroceria.toLowerCase().includes('suv')) vehicleCapacity = 7;
    
    if (vehicleCapacity < people) {
      score -= 30; // Can't fit everyone
    } else if (vehicleCapacity === people) {
      score += 5; // Perfect fit
    }

    // Usage (10-30% weight depending on type)
    const usage = answers.usage;
    const carroceria = vehicle.carroceria.toLowerCase();
    
    if (usage === 'cidade' && carroceria.includes('hatch')) {
      score += 10;
    }
    if (usage === 'viagem' && (carroceria.includes('sedan') || carroceria.includes('suv'))) {
      score += 10;
    }
    
    // Trabalho leve: sedans e hatches são bons, picapes ok
    if (usage === 'trabalho_leve' || usage === 'trabalho') {
      if (carroceria.includes('sedan') || carroceria.includes('hatch')) {
        score += 10;
      } else if (carroceria.includes('picape')) {
        score += 5;
      }
    }
    
    // Trabalho pesado (obra, carga, campo): PRIORIZA FORTEMENTE picapes
    if (usage === 'trabalho_pesado') {
      if (carroceria.includes('picape') || carroceria.includes('pickup') || carroceria.includes('utilitário') || carroceria.includes('utilitario')) {
        score += 30; // Grande bônus para picapes
      } else if (carroceria.includes('suv') || carroceria.includes('van')) {
        score += 5; // SUVs e vans podem servir em alguns casos
      } else {
        score -= 40; // Penaliza fortemente carros não adequados para obra
      }
    }

    // Has trade-in (5% bonus)
    if (answers.hasTradeIn) {
      score += 5;
    }

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, Math.round(score)));

    return score;
  }

  private async generateReasoning(
    vehicle: any,
    answers: Record<string, any>,
    matchScore: number
  ): Promise<string> {
    try {
      const vehicleInfo = `${vehicle.marca} ${vehicle.modelo} ${vehicle.versao || ''} ${vehicle.ano}, ${vehicle.km.toLocaleString('pt-BR')} km, R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR')}`;
      
      const userProfile = `Orçamento R$ ${answers.budget?.toLocaleString('pt-BR')}, uso ${answers.usage}, ${answers.people} pessoas, ano mínimo ${answers.minYear}, km máxima ${answers.maxKm?.toLocaleString('pt-BR')}`;
      
      const response = await generateRecommendationReasoning(vehicleInfo, userProfile, matchScore);
      return response.trim();
    } catch (error) {
      logger.error({ error }, 'Error generating reasoning');
      
      // Fallback reasoning
      return `Excelente opção com ${vehicle.km.toLocaleString('pt-BR')} km rodados, ${vehicle.ano} modelo, por R$ ${parseFloat(vehicle.preco).toLocaleString('pt-BR')}. Ótimo custo-benefício!`;
    }
  }
}
