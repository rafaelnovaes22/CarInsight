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

    // Budget (30% weight)
    const preco = parseFloat(vehicle.preco);
    const budget = answers.budget;
    const budgetDiff = Math.abs(preco - budget) / budget;
    
    if (preco > budget * 1.2) {
      score -= 40; // Way over budget
    } else if (budgetDiff > 0.1) {
      score -= Math.min(30, budgetDiff * 100); // Proportional penalty
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

    // Km (15% weight)
    const maxKm = answers.maxKm || 200000;
    if (vehicle.km > maxKm) {
      score -= 30;
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

    // Usage (10% weight)
    const usage = answers.usage;
    if (usage === 'cidade' && vehicle.carroceria.toLowerCase().includes('hatch')) {
      score += 10;
    }
    if (usage === 'viagem' && (vehicle.carroceria.toLowerCase().includes('sedan') || vehicle.carroceria.toLowerCase().includes('suv'))) {
      score += 10;
    }
    if (usage === 'trabalho' && vehicle.carroceria.toLowerCase().includes('picape')) {
      score += 15;
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
