/**
 * Benchmark Runner for Recommendation System Evaluation
 *
 * Executes golden dataset test cases against the recommendation system
 * and reports accuracy metrics.
 */

import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  vehicleRanker,
  RankingContext,
  VehicleForRanking,
} from '../services/vehicle-ranker.service';
import {
  GOLDEN_DATASET,
  GoldenTestCase,
  getTestCaseById,
  getDatasetSummary,
} from './golden-dataset';

// ============================================================================
// Types
// ============================================================================

export interface BenchmarkResult {
  testCaseId: string;
  description: string;
  category: string;
  passed: boolean;

  // Execution details
  executionTimeMs: number;
  vehiclesEvaluated: number;

  // Results
  topRecommendations: Array<{
    vehicleId: string;
    brand: string;
    model: string;
    year: number;
    bodyType: string;
    score: number;
  }>;

  // Validation results
  criteriaValidation: {
    bodyTypeCorrect: boolean;
    yearCorrect: boolean;
    priceCorrect: boolean;
    transmissionCorrect: boolean;
    mustHavePresent: boolean;
  };

  // Pattern matching
  idealPatternMatches: number;
  antiPatternViolations: string[];

  // Score validation
  topScoreInRange: boolean;
  actualTopScore: number;
  expectedMinTopScore: number;

  // Issues found
  issues: string[];
}

export interface BenchmarkSummary {
  runAt: string;
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  avgExecutionTimeMs: number;
  byCategory: Record<
    string,
    {
      total: number;
      passed: number;
      passRate: number;
    }
  >;
  worstCases: string[];
}

// ============================================================================
// Benchmark Runner Class
// ============================================================================

export class BenchmarkRunner {
  private vehicles: VehicleForRanking[] = [];

  /**
   * Load available vehicles from database
   */
  private async loadVehicles(): Promise<void> {
    const dbVehicles = await prisma.vehicle.findMany({
      where: { disponivel: true },
      select: {
        id: true,
        marca: true,
        modelo: true,
        ano: true,
        preco: true,
        km: true,
        carroceria: true,
        cambio: true,
        combustivel: true,
        cor: true,
        aptoFamilia: true,
        aptoUber: true,
        aptoUberBlack: true,
        aptoTrabalho: true,
      },
    });

    this.vehicles = dbVehicles.map(v => ({
      id: v.id,
      brand: v.marca,
      model: v.modelo,
      year: v.ano,
      price: v.preco || 0,
      mileage: v.km,
      bodyType: v.carroceria,
      transmission: v.cambio,
      fuelType: v.combustivel,
      color: v.cor || undefined,
      aptoFamilia: v.aptoFamilia,
      aptoUber: v.aptoUber,
      aptoUberBlack: v.aptoUberBlack,
      aptoTrabalho: v.aptoTrabalho,
    }));

    logger.info({ vehicleCount: this.vehicles.length }, 'Benchmark: Loaded vehicles');
  }

  /**
   * Run all benchmark tests
   */
  async runAll(): Promise<{
    summary: BenchmarkSummary;
    results: BenchmarkResult[];
  }> {
    await this.loadVehicles();

    if (this.vehicles.length === 0) {
      throw new Error('No vehicles available for benchmark');
    }

    const results: BenchmarkResult[] = [];

    for (const testCase of GOLDEN_DATASET) {
      const result = await this.runSingle(testCase);
      results.push(result);
    }

    const summary = this.generateSummary(results);

    logger.info(
      {
        totalCases: summary.totalCases,
        passed: summary.passed,
        passRate: `${summary.passRate}%`,
      },
      'Benchmark completed'
    );

    return { summary, results };
  }

  /**
   * Run a single test case
   */
  async runSingle(testCase: GoldenTestCase | string): Promise<BenchmarkResult> {
    const tc = typeof testCase === 'string' ? getTestCaseById(testCase) : testCase;

    if (!tc) {
      throw new Error(`Test case not found: ${testCase}`);
    }

    if (this.vehicles.length === 0) {
      await this.loadVehicles();
    }

    const startTime = Date.now();
    const issues: string[] = [];

    // Build ranking context from test case
    const context: RankingContext = {
      useCase: tc.userProfile.useCase,
      budget: tc.userProfile.budget,
      priorities: tc.userProfile.priorities,
      restrictions: tc.userProfile.restrictions,
      numberOfPeople: tc.userProfile.people,
      additionalInfo: tc.userMessages.join('. '),
    };

    // Run the ranker
    const rankingResult = await vehicleRanker.rank(this.vehicles, context);

    const executionTimeMs = Date.now() - startTime;

    // Get top 5 recommendations
    const topRecs = rankingResult.rankedVehicles.slice(0, 5).map(rv => {
      const vehicle = this.vehicles.find(v => v.id === rv.vehicleId);
      return {
        vehicleId: rv.vehicleId,
        brand: vehicle?.brand || 'Unknown',
        model: vehicle?.model || 'Unknown',
        year: vehicle?.year || 0,
        bodyType: vehicle?.bodyType || 'Unknown',
        score: rv.score,
      };
    });

    // Validate criteria
    const criteriaValidation = this.validateCriteria(topRecs, tc.expectedCriteria);

    // Check ideal patterns
    const idealPatternMatches = this.countIdealPatternMatches(topRecs, tc.idealVehiclePatterns);

    // Check anti-patterns
    const antiPatternViolations = this.findAntiPatternViolations(topRecs, tc.antiPatterns);

    // Validate top score
    const actualTopScore = topRecs[0]?.score || 0;
    const topScoreInRange = actualTopScore >= tc.expectedScores.minTopScore;

    // Collect issues
    if (!criteriaValidation.bodyTypeCorrect && tc.expectedCriteria.bodyTypes) {
      issues.push(`Body type mismatch: expected ${tc.expectedCriteria.bodyTypes.join('/')}`);
    }
    if (!criteriaValidation.yearCorrect && tc.expectedCriteria.minYear) {
      issues.push(`Year criteria not met: min ${tc.expectedCriteria.minYear}`);
    }
    if (antiPatternViolations.length > 0) {
      issues.push(`Anti-pattern violations: ${antiPatternViolations.join(', ')}`);
    }
    if (!topScoreInRange) {
      issues.push(`Top score ${actualTopScore} below expected ${tc.expectedScores.minTopScore}`);
    }
    if (idealPatternMatches === 0) {
      issues.push('No ideal pattern matches in top-3');
    }

    // Determine if passed
    const passed =
      antiPatternViolations.length === 0 &&
      topScoreInRange &&
      idealPatternMatches > 0 &&
      !issues.some(i => i.includes('Anti-pattern'));

    return {
      testCaseId: tc.id,
      description: tc.description,
      category: tc.category,
      passed,
      executionTimeMs,
      vehiclesEvaluated: this.vehicles.length,
      topRecommendations: topRecs,
      criteriaValidation,
      idealPatternMatches,
      antiPatternViolations,
      topScoreInRange,
      actualTopScore,
      expectedMinTopScore: tc.expectedScores.minTopScore,
      issues,
    };
  }

  /**
   * Validate that recommendations meet expected criteria
   */
  private validateCriteria(
    topRecs: BenchmarkResult['topRecommendations'],
    criteria: GoldenTestCase['expectedCriteria']
  ): BenchmarkResult['criteriaValidation'] {
    const top3 = topRecs.slice(0, 3);

    // Body type check
    let bodyTypeCorrect = true;
    if (criteria.bodyTypes && criteria.bodyTypes.length > 0) {
      const normalizedExpected = criteria.bodyTypes.map(b => b.toLowerCase());
      bodyTypeCorrect = top3.some(r =>
        normalizedExpected.some(
          expected =>
            r.bodyType.toLowerCase().includes(expected) ||
            expected.includes(r.bodyType.toLowerCase())
        )
      );
    }

    // Year check
    let yearCorrect = true;
    if (criteria.minYear) {
      yearCorrect = top3.some(r => r.year >= criteria.minYear!);
    }

    // Price check (would need to include price in topRecs)
    const priceCorrect = true; // Simplified for now

    // Transmission check (would need to include in topRecs)
    const transmissionCorrect = true; // Simplified for now

    // Must have check (simplified)
    const mustHavePresent = true;

    return {
      bodyTypeCorrect,
      yearCorrect,
      priceCorrect,
      transmissionCorrect,
      mustHavePresent,
    };
  }

  /**
   * Count how many ideal patterns are matched in top-3
   */
  private countIdealPatternMatches(
    topRecs: BenchmarkResult['topRecommendations'],
    patterns: GoldenTestCase['idealVehiclePatterns']
  ): number {
    const top3 = topRecs.slice(0, 3);
    let matches = 0;

    for (const rec of top3) {
      for (const pattern of patterns) {
        let isMatch = true;

        if (pattern.brand && !rec.brand.toLowerCase().includes(pattern.brand.toLowerCase())) {
          isMatch = false;
        }
        if (pattern.model && !rec.model.toLowerCase().includes(pattern.model.toLowerCase())) {
          isMatch = false;
        }
        if (
          pattern.bodyType &&
          !rec.bodyType.toLowerCase().includes(pattern.bodyType.toLowerCase())
        ) {
          isMatch = false;
        }
        if (rec.score < pattern.minScore) {
          isMatch = false;
        }

        if (isMatch) {
          matches++;
          break; // Count each rec only once
        }
      }
    }

    return matches;
  }

  /**
   * Find anti-pattern violations in top-3
   */
  private findAntiPatternViolations(
    topRecs: BenchmarkResult['topRecommendations'],
    antiPatterns: GoldenTestCase['antiPatterns']
  ): string[] {
    const top3 = topRecs.slice(0, 3);
    const violations: string[] = [];

    for (const rec of top3) {
      for (const pattern of antiPatterns) {
        let isViolation = false;

        if (pattern.model && rec.model.toLowerCase().includes(pattern.model.toLowerCase())) {
          isViolation = true;
        } else if (pattern.brand && rec.brand.toLowerCase().includes(pattern.brand.toLowerCase())) {
          isViolation = true;
        } else if (
          pattern.bodyType &&
          rec.bodyType.toLowerCase().includes(pattern.bodyType.toLowerCase()) &&
          !pattern.model // Only bodyType match without model specified
        ) {
          isViolation = true;
        }

        if (isViolation) {
          violations.push(`${rec.brand} ${rec.model}: ${pattern.reason}`);
        }
      }
    }

    return violations;
  }

  /**
   * Generate summary from results
   */
  private generateSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    // By category
    const byCategory: BenchmarkSummary['byCategory'] = {};
    for (const result of results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = { total: 0, passed: 0, passRate: 0 };
      }
      byCategory[result.category].total++;
      if (result.passed) {
        byCategory[result.category].passed++;
      }
    }
    for (const cat of Object.keys(byCategory)) {
      byCategory[cat].passRate = Math.round((byCategory[cat].passed / byCategory[cat].total) * 100);
    }

    // Worst cases (failed with most issues)
    const worstCases = results
      .filter(r => !r.passed)
      .sort((a, b) => b.issues.length - a.issues.length)
      .slice(0, 3)
      .map(r => r.testCaseId);

    // Average execution time
    const avgExecutionTimeMs =
      results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length;

    return {
      runAt: new Date().toISOString(),
      totalCases: results.length,
      passed,
      failed,
      passRate: Math.round((passed / results.length) * 100),
      avgExecutionTimeMs: Math.round(avgExecutionTimeMs),
      byCategory,
      worstCases,
    };
  }
}

// Singleton export
export const benchmarkRunner = new BenchmarkRunner();

// ============================================================================
// CLI Runner (for npm script)
// ============================================================================

export async function runBenchmarkCLI(): Promise<void> {
  console.log('\n🔬 Running Recommendation Benchmark...\n');
  console.log(`📊 Dataset: ${getDatasetSummary().total} test cases\n`);

  try {
    const { summary, results } = await benchmarkRunner.runAll();

    // Print summary
    console.log('═'.repeat(60));
    console.log('                    BENCHMARK SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n📅 Run at: ${summary.runAt}`);
    console.log(`\n📈 Results:`);
    console.log(`   ✅ Passed: ${summary.passed}/${summary.totalCases}`);
    console.log(`   ❌ Failed: ${summary.failed}/${summary.totalCases}`);
    console.log(`   📊 Pass Rate: ${summary.passRate}%`);
    console.log(`   ⏱️  Avg Time: ${summary.avgExecutionTimeMs}ms`);

    console.log(`\n📂 By Category:`);
    for (const [cat, stats] of Object.entries(summary.byCategory)) {
      const emoji = stats.passRate >= 70 ? '✅' : stats.passRate >= 50 ? '⚠️' : '❌';
      console.log(`   ${emoji} ${cat}: ${stats.passed}/${stats.total} (${stats.passRate}%)`);
    }

    // Print failed cases
    if (summary.failed > 0) {
      console.log(`\n❌ Failed Cases:`);
      for (const result of results.filter(r => !r.passed)) {
        console.log(`\n   • ${result.testCaseId}: ${result.description}`);
        for (const issue of result.issues) {
          console.log(`     ⚠️  ${issue}`);
        }
      }
    }

    console.log('\n' + '═'.repeat(60) + '\n');

    // Exit with appropriate code
    process.exit(summary.passRate >= 70 ? 0 : 1);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}
