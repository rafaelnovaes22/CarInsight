
import { chromium } from 'playwright';
import * as fs from 'fs';

async function main() {
    console.log('--- ADVANCED DIAGNOSTIC SCRAPER (File Output) ---');
    const url = 'https://www.uber.com/br/pt-br/eligible-vehicles/?city=sao-paulo';

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Log Network Requests
    page.on('request', request => {
        if (request.url().includes('getEligibleVehiclesForCity')) {
            console.log('>> API REQ:', request.url());
            console.log('>> PAYLOAD:', request.postData());
        }
    });

    page.on('response', async response => {
        if (response.url().includes('getEligibleVehiclesForCity')) {
            console.log('<< API RESP:', response.status(), response.url());
            try {
                const json = await response.json();
                console.log('API JSON PREVIEW:', JSON.stringify(json).slice(0, 500));
                fs.writeFileSync('uber_api_response.json', JSON.stringify(json, null, 2));
                console.log('Saved API response to uber_api_response.json');
            } catch (e) {
                console.log('Could not parse JSON:', e);
            }
        }
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        const bodyText = await page.innerText('body');
        console.log(`Body Length: ${bodyText.length}`);

        fs.writeFileSync('scraped_content.txt', bodyText);
        console.log('Saved to scraped_content.txt');

        // key check
        const lower = bodyText.toLowerCase();
        console.log('Contains "Renegade"?', lower.includes('renegade'));
        console.log('Contains "Duster"?', lower.includes('duster'));
        console.log('--- INTERACTIVE ELEMENTS ---');
        const inputs = await page.getByRole('textbox').all();
        console.log(`Found ${inputs.length} textboxes:`);
        for (const input of inputs) {
            console.log(` - Placeholder: "${await input.getAttribute('placeholder')}" | Value: "${await input.inputValue()}"`);
        }

        const buttons = await page.getByRole('button').all();
        console.log(`Found ${buttons.length} buttons (first 10):`);
        for (const btn of buttons.slice(0, 10)) {
            console.log(` - Text: "${(await btn.innerText()).replace(/\n/g, ' ')}"`);
        }
        console.log('----------------------------');

        // Check specific city selector
        const cityInput = page.getByPlaceholder('Insira sua cidade');
        if (await cityInput.count() > 0) {
            console.log('City Input detected!');
        }

        await page.waitForLoadState('networkidle');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

main();
