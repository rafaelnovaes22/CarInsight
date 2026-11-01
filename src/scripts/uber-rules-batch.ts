process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

async function main() {
  const citySlug = process.argv[2] || 'sao-paulo';

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    throw new Error('FIRECRAWL_API_KEY is required to run uber rules batch');
  }

  const sourceUrl = `https://www.uber.com/br/pt-br/eligible-vehicles/?city=${citySlug}`;

  const [{ FirecrawlClient }, { uberRulesScraperService }, { uberRulesRepository }] =
    await Promise.all([
      import('../services/firecrawl-client.service'),
      import('../services/uber-rules-scraper.service'),
      import('../services/uber-rules-repository.service'),
    ]);

  const fc = new FirecrawlClient(firecrawlKey);
  const markdown = await fc.scrape(sourceUrl);

  const rules = (uberRulesScraperService as any).extractEligibleModelRules(markdown);

  const fetchedAt = new Date();

  const rows = Object.entries(rules).flatMap(([category, data]: any) => {
    const eligible = data?.eligible ?? [];
    return eligible.map((r: any) => ({
      citySlug,
      category,
      brand: r.brand,
      model: r.model,
      minYear: r.minYear,
      raw: r.raw,
      fetchedAt,
      sourceUrl,
    }));
  });

  await uberRulesRepository.replaceAllForCity(citySlug, rows);

  console.log('Saved Uber rules:', {
    citySlug,
    fetchedAt: fetchedAt.toISOString(),
    sourceUrl,
    total: rows.length,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
