export interface CatalogFact {
  id: string;
  preco: number;
}

export interface RecommendationObservation extends CatalogFact {
  score: number;
}

export interface RecommendationExpectation {
  budget: number;
  firstId: string | null;
  maximumResults: number;
}

function inspectVehicle(
  vehicle: RecommendationObservation,
  catalog: readonly CatalogFact[],
  budget: number
): string[] {
  const failures: string[] = [];
  const fact = catalog.find(candidate => candidate.id === vehicle.id);
  if (!fact) failures.push(`unknown-id:${vehicle.id}`);
  if (fact && fact.preco !== vehicle.preco) failures.push(`price-mismatch:${vehicle.id}`);
  if (!Number.isFinite(vehicle.preco) || vehicle.preco > budget)
    failures.push(`budget:${vehicle.id}`);
  if (!Number.isFinite(vehicle.score) || vehicle.score < 0 || vehicle.score > 100)
    failures.push(`score:${vehicle.id}`);
  return failures;
}

// Expectations are independent fixture facts, never text appended to a model response.
export function assessRecommendations(
  vehicles: readonly RecommendationObservation[],
  catalog: readonly CatalogFact[],
  expectation: RecommendationExpectation
): string[] {
  const failures = vehicles.flatMap(vehicle =>
    inspectVehicle(vehicle, catalog, expectation.budget)
  );
  if ((vehicles[0]?.id ?? null) !== expectation.firstId) failures.push('wrong-first-result');
  if (vehicles.length > expectation.maximumResults) failures.push('too-many-results');
  if (new Set(vehicles.map(vehicle => vehicle.id)).size !== vehicles.length)
    failures.push('duplicate-id');
  return failures;
}
