import { chromium } from 'playwright';
import { firecrawlService } from './firecrawl.service';
import {
  UberCitySlug,
  UberRulesByModality,
  UberEligibleModelRule,
} from './uber-rules-provider.service';
import { logger } from '../lib/logger';

export class UberRulesScraperService {
  async scrape(citySlug: UberCitySlug): Promise<{ rules: UberRulesByModality; sourceUrl: string }> {
    const sourceUrl = `https://www.uber.com/br/pt-br/eligible-vehicles/?city=${citySlug}`;
    let bodyText = '';

    // 1. Try Firecrawl first
    const firecrawlResult = await firecrawlService.scrape(sourceUrl);
    if (firecrawlResult.success && firecrawlResult.markdown) {
      logger.info('Using Firecrawl result');
      bodyText = firecrawlResult.markdown;

      // Firecrawl markdown might differ slightly from innerText.
      // innerText: "Audi\nA3 Sedan - 2016 (...)"
      // Markdown: "## Audi\n\n* A3 Sedan - 2016 (...)"
      // We might need to clean markdown symbols like '*', '#'.
      bodyText = bodyText.replace(/[*#]/g, '').replace(/\n\n/g, '\n');
    } else {
      // 2. Fallback to Playwright (with cookie bypass) if Firecrawl fails
      logger.warn('Firecrawl failed or inactive, falling back to Playwright');
      const browser = await chromium.launch({ headless: true });
      // Use a real User-Agent to avoid immediate bot detection
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      try {
        const page = await context.newPage();
        await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // --- Cookie Wall Bypass Strategy ---
        try {
          await page.waitForTimeout(2000);
          const title = await page.title();
          const bodyPreview = await page.textContent('body');
          const isCookiePage =
            (title && title.toLowerCase().includes('cookie')) ||
            (bodyPreview && bodyPreview.toLowerCase().includes('usamos cookies'));

          if (isCookiePage) {
            logger.info({ citySlug }, 'Cookie wall detected. Hunting for Accept button...');
            const buttons = await page.getByRole('button').all();
            for (const btn of buttons) {
              const text = (await btn.textContent())?.toLowerCase() || '';
              if (text.includes('aceitar') || text.includes('ok') || text.includes('yes')) {
                await btn.click();
                await page.waitForTimeout(3000);
                break;
              }
            }
          }
        } catch (err) {
          /* ignore */
        }

        // Wait for content
        try {
          // @ts-expect-error - Document is available in browser context
          await page.waitForFunction(() => document.body.innerText.length > 5000, null, {
            timeout: 15000,
          });
        } catch (e) {
          /* ignore */
        }

        bodyText = await page.locator('body').innerText();
      } finally {
        await browser.close();
      }
    }

    console.log(`[DEBUG] Final Body Length: ${bodyText.length}`);
    require('fs').writeFileSync('last_scrape.txt', bodyText);
    const rules = this.extractEligibleModelRules(bodyText);

    if (
      (rules.uberX?.eligible.length ?? 0) === 0 &&
      (rules.uberComfort?.eligible.length ?? 0) === 0 &&
      (rules.uberBlack?.eligible.length ?? 0) === 0
    ) {
      logger.warn(
        {
          citySlug,
          bodyTextSample: bodyText.slice(0, 1000),
        },
        'UberRulesScraper: empty parse result'
      );
    }

    return { rules, sourceUrl };
  }

  private extractEligibleModelRules(text: string): UberRulesByModality {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const out: UberRulesByModality = {
      uberX: { eligible: [] },
      uberComfort: { eligible: [] },
      uberBlack: { eligible: [] },
    };

    let currentBrand: string | null = null;

    for (const line of lines) {
      const normalized = line
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Brand line: appears alone (e.g., "Audi") and is followed by model lines.
      if (this.looksLikeBrandLine(normalized)) {
        currentBrand = normalized;
        continue;
      }

      // Model line: "A4 - 1996 (...) / 2011 (...) / 2018 (...)"
      if (!currentBrand) continue;
      if (!normalized.includes(' - ')) continue;

      const { model, entries } = this.parseModelEntries(normalized);
      if (!model || entries.length === 0) continue;

      for (const entry of entries) {
        const minYear = entry.year;
        const cats = this.mapEntryToModalities(entry.categoriesText);

        for (const cat of cats) {
          if (!out[cat]) out[cat] = { eligible: [] };
          out[cat]!.eligible.push({
            brand: currentBrand,
            model,
            minYear,
            raw: normalized,
          });
        }
      }
    }

    logger.info(
      {
        uberX: out.uberX?.eligible.length,
        uberComfort: out.uberComfort?.eligible.length,
        uberBlack: out.uberBlack?.eligible.length,
      },
      'UberRulesScraper: parsed eligible rules by modality (brand/model rows)'
    );

    return out;
  }

  private looksLikeBrandLine(line: string): boolean {
    if (line.length < 2) return false;

    // Exclude known non-brands
    const l = line.toLowerCase();
    if (
      l.includes('veículos elegíveis') ||
      l.includes('cadastre-se') ||
      l.includes('insira a marca') ||
      l.includes('mostrar apenas')
    ) {
      return false;
    }

    // Brand lines are usually single token(s) and do not contain dash/slash/parentheses.
    if (line.includes(' - ') || line.includes('/') || line.includes('(') || line.includes(')'))
      return false;

    // Avoid huge phrases.
    if (line.length > 24) return false;

    // Must start with a letter.
    if (!/^[A-Za-zÀ-ÿ]/.test(line)) return false;

    return true;
  }

  private parseModelEntries(line: string): {
    model: string;
    entries: Array<{ year: number; categoriesText: string }>;
  } {
    const [modelPart, rest] = line.split(' - ', 2);
    const model = modelPart.trim();
    if (!rest) return { model, entries: [] };

    const chunks = rest
      .split('/')
      .map(c => c.trim())
      .filter(Boolean);
    const entries: Array<{ year: number; categoriesText: string }> = [];

    for (const chunk of chunks) {
      const m = chunk.match(/(19\d{2}|20\d{2})\s*\(([^)]*)\)/);
      if (!m) continue;
      const year = Number(m[1]);
      if (!Number.isFinite(year)) continue;
      entries.push({ year, categoriesText: m[2] || '' });
    }

    return { model, entries };
  }

  private mapEntryToModalities(categoriesText: string): string[] {
    const raw = categoriesText
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!raw) return [];

    const parts = raw
      .split(/[,/]/)
      .map(p => p.trim())
      .filter(Boolean);

    const out = new Set<string>();

    for (const p of parts) {
      const norm = p.toLowerCase();

      // Normalize known ride-hailing categories
      if (norm === 'uberx' || norm === 'uber x') out.add('uberX');
      else if (norm.startsWith('uberx ')) out.add('uberX');
      else if (norm === 'comfort' || norm.startsWith('comfort ')) out.add('uberComfort');
      else if (norm === 'black' || norm.startsWith('black ')) out.add('uberBlack');
      else if (norm.startsWith('black bag')) out.add('uberBlack');
      else if (norm.includes('uberxl') || norm.includes('uber xl') || norm === 'xl')
        out.add('uberXL');
      else if (norm.includes('envios') && norm.includes('moto')) out.add('envios_moto');
      else if (norm.includes('envios') && norm.includes('carro')) out.add('envios_carro');
      else if (norm.includes('moto')) out.add('moto');
      else {
        // Generic slug for any other modality/tag shown by Uber page
        const slug = norm
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 40);

        if (slug) out.add(slug);
      }
    }

    return Array.from(out);
  }
}

export const uberRulesScraperService = new UberRulesScraperService();
