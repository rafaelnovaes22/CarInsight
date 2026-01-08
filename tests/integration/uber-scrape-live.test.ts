import { describe, it, expect } from 'vitest';
import { uberRulesScraperService } from '../../src/services/uber-rules-scraper.service';

const shouldRun = process.env.RUN_UBER_SCRAPE_LIVE === '1';

describe('Uber rules scraping (live)', () => {
  it.runIf(shouldRun)(
    'scrapes Sao Paulo rules without crashing',
    async () => {
      const res = await uberRulesScraperService.scrape('sao-paulo');

      expect(res.sourceUrl).toContain('eligible-vehicles');
      expect(res.sourceUrl).toContain('city=sao-paulo');

      expect(res.rules.uberX?.eligible).toBeDefined();
      expect(res.rules.uberComfort?.eligible).toBeDefined();
      expect(res.rules.uberBlack?.eligible).toBeDefined();
    },
    120_000
  );
});
