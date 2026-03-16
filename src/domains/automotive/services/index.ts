/**
 * Automotive domain services re-exports
 *
 * These are services specific to the automotive vertical.
 * Actual implementations in src/services/
 */

// Vehicle search & inventory
export * from '../../../services/vehicle-search-adapter.service';
export * from '../../../services/exact-search.service';
export * from '../../../services/exact-search-parser.service';
export * from '../../../services/vector-search.service';
export * from '../../../services/in-memory-vector.service';
export * from '../../../services/similarity-calculator.service';

// Vehicle classification
export * from '../../../services/vehicle-classifier.service';
export * from '../../../services/category-classifier.service';
export * from '../../../services/vehicle-aptitude-classifier.service';
export * from '../../../services/vehicle-eligibility-on-create.service';
export * from '../../../services/brand-matcher.service';

// Ranking (explicit re-exports to avoid name conflicts between rankers)
export {
  VehicleRankerService,
  vehicleRanker,
  type VehicleForRanking,
  type RankingResult,
  type RankingContext as LLMRankingContext,
  type RankedVehicle as LLMRankedVehicle,
} from '../../../services/vehicle-ranker.service';
export {
  DeterministicRankerService,
  deterministicRanker,
  type UseCase,
  type VehicleScoreBreakdown,
  type DeterministicRankingResult,
  type RankingContext as DeterministicRankingContext,
  type RankedVehicle as DeterministicRankedVehicle,
} from '../../../services/deterministic-ranker.service';
export * from '../../../services/vehicle-profiles';

// Financing
export * from '../../../services/financing-simulator.service';

// Uber eligibility
export * from '../../../services/uber-eligibility-agent.service';
export * from '../../../services/uber-eligibility-validator.service';
export * from '../../../services/uber-rules-provider.service';
export * from '../../../services/uber-rules-repository.service';

// Recommendation
export * from '../../../services/recommendation-analysis.service';
export * from '../../../services/recommendation-metrics.service';
export * from '../../../services/recommendation-health-monitor.service';
export * from '../../../services/recommendation-evidence.service';
export * from '../../../services/recommendation-explainer.service';

// Fallback & serialization
export * from '../../../services/fallback.service';
export * from '../../../services/fallback-response-formatter.service';
export * from '../../../services/search-result-serializer.service';
