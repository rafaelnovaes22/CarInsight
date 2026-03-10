import { uberRulesScraperService } from '../src/services/uber-rules-scraper.service';
import { uberRulesRepository, UberRuleRow } from '../src/services/uber-rules-repository.service';

const CITY_SLUGS = ['sao-paulo']; // Add other cities if needed

async function main() {
  console.log('🚀 Starting Uber RAG Base Update...');

  for (const citySlug of CITY_SLUGS) {
    console.log(`\nProcessing city: ${citySlug}...`);

    // 1. Scrape
    console.log('   - Scraping Uber website...');
    const { rules, sourceUrl } = await uberRulesScraperService.scrape(citySlug);

    // 2. Flatten structure for DB
    const rows: UberRuleRow[] = [];
    const fetchedAt = new Date();

    Object.entries(rules).forEach(([category, data]) => {
      if (!data || !data.eligible) return;

      data.eligible.forEach(rule => {
        rows.push({
          citySlug,
          category,
          brand: rule.brand,
          model: rule.model,
          minYear: rule.minYear,
          raw: rule.raw,
          fetchedAt,
          sourceUrl,
        });
      });
    });

    console.log(`   - Found ${rows.length} rules.`);

    // 3. Save to DB
    if (rows.length > 0) {
      console.log(`   - Saving to database...`);
      await uberRulesRepository.replaceAllForCity(citySlug, rows);
      console.log(`   - ✅ Saved successfully.`);
    } else {
      console.warn(`   - ⚠️ No rules found for ${citySlug}, skipping DB update.`);
    }
  }

  console.log('\n🏁 Update Complete.');
}

main()
  .catch(e => console.error(e))
  .finally(() => process.exit(0));
