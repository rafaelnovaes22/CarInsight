export type UberCitySlug = 'sao-paulo' | 'rio-de-janeiro' | string;

export interface UberRuleSetMeta {
  citySlug: UberCitySlug;
  sourceUrl: string;
  fetchedAt: string; // ISO
  ttlDays: number;
}

export interface UberEligibleModelRule {
  brand: string;
  model: string;
  minYear: number;
  raw: string;
}

export type UberModalityKey = string;

export interface UberRulesByModality {
  // Keys are modality/category names as exposed on the Uber eligible vehicles page.
  // Examples: "uberX", "uberComfort", "uberBlack", "moto", "envios_moto", "envios+", "uberxl".
  [key: UberModalityKey]: { eligible: UberEligibleModelRule[] } | undefined;

  // Legacy normalized keys (kept for compatibility)
  uberX?: { eligible: UberEligibleModelRule[] };
  uberComfort?: { eligible: UberEligibleModelRule[] };
  uberBlack?: { eligible: UberEligibleModelRule[] };
}

export interface UberRuleSet {
  meta: UberRuleSetMeta;
  rules: UberRulesByModality;
}

const DEFAULT_TTL_DAYS = 30;

export class UberRulesProvider {
  private cache = new Map<UberCitySlug, UberRuleSet>();

  async get(citySlug: UberCitySlug): Promise<UberRuleSet> {
    const cached = this.cache.get(citySlug);
    if (cached && !this.isExpired(cached)) return cached;

    // Prefer DB-backed batch rules (stable, no runtime scraping).
    try {
      const { uberRulesRepository } = await import('./uber-rules-repository.service');
      const latest = await uberRulesRepository.getLatestForCity(citySlug);

      if (latest) {
        const ttlMs = DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000;
        const isFresh = Date.now() - latest.fetchedAt.getTime() <= ttlMs;

        if (isFresh) {
          const rows = await uberRulesRepository.listByCity(citySlug);

          const rules: UberRulesByModality = {};

          for (const r of rows) {
            if (!rules[r.category]) rules[r.category] = { eligible: [] };
            rules[r.category]!.eligible.push({ brand: r.brand, model: r.model, minYear: r.minYear, raw: r.raw });
          }

          // Keep legacy normalized keys (compat)
          rules.uberX = rules.uberX || { eligible: [] };
          rules.uberComfort = rules.uberComfort || { eligible: [] };
          rules.uberBlack = rules.uberBlack || { eligible: [] };

          const ruleSet: UberRuleSet = {
            meta: {
              citySlug,
              sourceUrl: latest.sourceUrl,
              fetchedAt: latest.fetchedAt.toISOString(),
              ttlDays: DEFAULT_TTL_DAYS,
            },
            rules,
          };

          this.cache.set(citySlug, ruleSet);
          return ruleSet;
        }
      }
    } catch {
      // ignore and fallback
    }

    // Fallback to runtime scraping (last resort)
    try {
      const { uberRulesScraperService } = await import('./uber-rules-scraper.service');
      const scraped = await uberRulesScraperService.scrape(citySlug);

      const ruleSet: UberRuleSet = {
        meta: {
          citySlug,
          sourceUrl: scraped.sourceUrl,
          fetchedAt: new Date().toISOString(),
          ttlDays: DEFAULT_TTL_DAYS,
        },
        rules: scraped.rules,
      };

      this.cache.set(citySlug, ruleSet);
      return ruleSet;
    } catch {
      const rules = this.getHardcoded(citySlug);
      this.cache.set(citySlug, rules);
      return rules;
    }
  }

  private isExpired(ruleSet: UberRuleSet): boolean {
    const fetchedAt = new Date(ruleSet.meta.fetchedAt).getTime();
    const ttlMs = ruleSet.meta.ttlDays * 24 * 60 * 60 * 1000;
    return Date.now() - fetchedAt > ttlMs;
  }

  private getHardcoded(citySlug: UberCitySlug): UberRuleSet {
    const url = `https://www.uber.com/br/pt-br/eligible-vehicles/?city=${citySlug}`;

    // Start with SP and RJ only (others fallback to SP baseline until we add crawled rules)
    const isSP = citySlug === 'sao-paulo';
    const isRJ = citySlug === 'rio-de-janeiro';

    const rules: UberRulesByModality = {
      uberX: { eligible: [] },
      uberComfort: { eligible: [] },
      uberBlack: { eligible: [] },
    };

    return {
      meta: {
        citySlug,
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        ttlDays: DEFAULT_TTL_DAYS,
      },
      rules,
    };
  }
}

export const uberRulesProvider = new UberRulesProvider();
