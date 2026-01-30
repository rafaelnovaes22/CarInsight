
import { uberRulesScraperService } from '../src/services/uber-rules-scraper.service';
import * as fs from 'fs';

async function main() {
    console.log('--- DEBUG SCRAPER PARSER ---');

    // We'll call a modified scrape that logs the body, or just use the scrape and inspect logs.
    // Actually, let's create a quick extraction test.

    const { rules, sourceUrl } = await uberRulesScraperService.scrape('sao-paulo');

    console.log(`Found ${rules.uberBlack?.eligible.length} rules for Black`);

    // Since we can't easily modify the service to return raw text without changing signature,
    // I rely on the console.log I added in the service: "[DEBUG] Final Body Length: ..." -> captured in logs?
    // But to fix parser I need raw text.

    // Let's use the ADVANCED DIAGNOSTIC to dump text again, ensuring it uses the SAME logic as service?
    // No, let's just use the advanced diagnostic script I already wrote: scripts/diagnose-scraper-advanced.ts
    // It dumps to 'scraped_content.txt'.
}

// main(); 
console.log("Please run: npx tsx scripts/diagnose-scraper-advanced.ts");
