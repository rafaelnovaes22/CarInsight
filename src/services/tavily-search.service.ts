
import axios from 'axios';
import { logger } from '../lib/logger';

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
}

export interface TavilyResponse {
    query: string;
    results: TavilySearchResult[];
}

export class TavilySearchService {
    private readonly apiKey: string;
    private readonly baseUrl = 'https://api.tavily.com/search';

    constructor() {
        this.apiKey = process.env.TAVILY_API_KEY || '';
        if (!this.apiKey) {
            logger.warn('TAVILY_API_KEY not found in environment variables');
        }
    }

    async search(query: string, maxResults = 5): Promise<TavilySearchResult[]> {
        if (!this.apiKey) {
            logger.error('Cannot search: TAVILY_API_KEY is missing');
            return [];
        }

        try {
            logger.info({ query }, 'Executing Tavily search');

            const response = await axios.post<TavilyResponse>(this.baseUrl, {
                api_key: this.apiKey,
                query,
                search_depth: 'advanced', // Use advanced for better results
                include_answer: false,
                include_raw_content: false,
                max_results: maxResults,
            });

            logger.info({ count: response.data.results.length }, 'Tavily search completed');

            return response.data.results;
        } catch (error: any) {
            logger.error(
                {
                    error: error.message,
                    data: error.response?.data
                },
                'Error during Tavily search'
            );
            return [];
        }
    }
}

export const tavilySearchService = new TavilySearchService();
