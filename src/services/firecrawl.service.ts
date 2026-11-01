import axios from 'axios';
import { logger } from '../lib/logger';
import * as dotenv from 'dotenv';
dotenv.config();

export class FirecrawlService {
  private apiKey: string;
  private apiUrl = 'https://api.firecrawl.dev/v1';

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('FIRECRAWL_API_KEY is not set. Scraper will fail if used.');
    }
  }

  async scrape(url: string): Promise<{ success: boolean; markdown?: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: 'Missing API Key' };
    }

    try {
      logger.info({ url }, 'FirecrawlService: Scraping URL...');

      const response = await axios.post(
        `${this.apiUrl}/scrape`,
        {
          url: url,
          formats: ['markdown'],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.success && response.data.data) {
        return {
          success: true,
          markdown: response.data.data.markdown,
        };
      } else {
        return {
          success: false,
          error: 'Invalid response from Firecrawl',
        };
      }
    } catch (error: any) {
      logger.error(
        { error: error.message, response: error.response?.data },
        'FirecrawlService: Scrape failed'
      );
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }
}

export const firecrawlService = new FirecrawlService();
