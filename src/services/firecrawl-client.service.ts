import { logger } from '../lib/logger';

export class FirecrawlClient {
  constructor(private readonly apiKey: string) {}

  async scrape(url: string): Promise<string> {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn({ status: res.status, text }, 'Firecrawl scrape failed');
      throw new Error(`Firecrawl scrape failed: ${res.status}`);
    }

    const json = (await res.json()) as any;
    const md = json?.data?.markdown;
    if (!md || typeof md !== 'string') {
      throw new Error('Firecrawl scrape: missing markdown in response');
    }

    return md;
  }
}
