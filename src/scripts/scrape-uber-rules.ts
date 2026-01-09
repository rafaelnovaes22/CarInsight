process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

async function main() {
  const citySlug = process.argv[2] || 'sao-paulo';

  const { uberRulesScraperService } = await import('../services/uber-rules-scraper.service');

  const result = await uberRulesScraperService.scrape(citySlug);

  const x = result.rules.uberX?.eligible ?? [];
  const comfort = result.rules.uberComfort?.eligible ?? [];
  const black = result.rules.uberBlack?.eligible ?? [];

  console.log('sourceUrl:', result.sourceUrl);
  console.log('citySlug:', citySlug);
  console.log('counts:', {
    uberX: x.length,
    uberComfort: comfort.length,
    uberBlack: black.length,
  });

  const sample = (arr: any[]) =>
    arr.slice(0, 10).map(r => `${r.brand} ${r.model} (minYear=${r.minYear})`);

  console.log('\nSample UberX:', sample(x));
  console.log('\nSample Comfort:', sample(comfort));
  console.log('\nSample Black:', sample(black));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
