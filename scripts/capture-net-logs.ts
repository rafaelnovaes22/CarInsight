
import { chromium } from 'playwright';
import * as fs from 'fs';

async function main() {
    console.log('--- CAPTURE NETWORK LOGS ---');
    const url = 'https://www.uber.com/br/pt-br/eligible-vehicles/?city=sao-paulo';

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const urls: string[] = [];

    page.on('request', req => {
        urls.push(`${req.method()} ${req.url()}`);
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

        // Try to click a brand to trigger an API call?
        try {
            const audi = page.getByText('Audi').first();
            if (await audi.isVisible()) {
                console.log('Clicking Audi...');
                await audi.click();
                await page.waitForTimeout(2000);
            }
        } catch (e) { console.log('Could not click Audi'); }

        fs.writeFileSync('net_logs.txt', urls.join('\n'));
        console.log(`Captured ${urls.length} requests to net_logs.txt`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

main();
