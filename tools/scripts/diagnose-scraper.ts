import { chromium } from 'playwright';

async function main() {
  console.log('--- DIAGNOSTIC SCRAPER (Retry) ---');
  const url = 'https://www.uber.com/br/pt-br/eligible-vehicles/?city=sao-paulo';

  console.log(`Navigating to ${url}...`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Trying networkidle to Ensure dynamic content loads
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const title = await page.title();
    console.log(`Page Title: ${title}`);

    const h1 = await page.textContent('h1').catch(() => 'No H1 found');
    console.log(`H1: ${h1}`);

    const bodyText = await page.innerText('body');
    console.log(`Body Text Length: ${bodyText.length}`);

    const lines = bodyText.split('\n');
    console.log('--- SEARCHING FOR MODELS ---');
    ['Renegade', 'Duster', 'Kicks'].forEach(model => {
      const idx = lines.findIndex(l => l.includes(model));
      if (idx !== -1) {
        console.log(`\n[Found ${model}]`);
        // Print context: 2 lines before and 2 after
        for (let i = Math.max(0, idx - 2); i < Math.min(lines.length, idx + 3); i++) {
          console.log(`Line ${i}: ${lines[i]}`);
        }
      } else {
        console.log(`\n[Not Found ${model}]`);
      }
    });
    console.log('----------------------------');
  } catch (e) {
    console.error('Scraping Error:', e);
  } finally {
    await browser.close();
  }
}

main();
