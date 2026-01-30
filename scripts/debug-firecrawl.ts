
import { firecrawlService } from '../src/services/firecrawl.service';
import * as fs from 'fs';

async function main() {
    console.log('--- DEBUG FIRECRAWL ---');
    const url = 'https://www.uber.com/br/pt-br/eligible-vehicles/?city=sao-paulo';

    const result = await firecrawlService.scrape(url);

    if (result.success && result.markdown) {
        console.log(`Success! Markdown Length: ${result.markdown.length}`);
        fs.writeFileSync('firecrawl_output.md', result.markdown);
        console.log('Saved to firecrawl_output.md');

        // Preview
        console.log('--- PREVIEW ---');
        console.log(result.markdown.slice(0, 500));
    } else {
        console.error('Failed:', result.error);
    }
}

main();
