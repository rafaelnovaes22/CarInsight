/**
 * Domain Registry
 *
 * Central registry that resolves the active domain plugin based on DOMAIN_ID.
 * Automotive plugin is registered by default. Additional domains can be
 * registered at startup via registerDomain().
 */

import type { DomainPlugin } from './core/types';
import { env } from './config/env';
import { logger } from './lib/logger';

const registry = new Map<string, () => Promise<DomainPlugin>>();

/**
 * Register a domain plugin loader.
 * Plugins are lazy-loaded to avoid importing all domains at startup.
 */
export function registerDomain(domainId: string, loader: () => Promise<DomainPlugin>): void {
  if (registry.has(domainId)) {
    logger.warn({ domainId }, 'Domain already registered, overwriting');
  }
  registry.set(domainId, loader);
}

// ── Built-in domains ──

registerDomain('automotive', async () => {
  const { automotiveDomainPlugin } = await import('./domains/automotive');
  return automotiveDomainPlugin;
});

/**
 * Get the active domain plugin based on DOMAIN_ID env var.
 * Throws if the domain is not registered.
 */
export async function getDomain(): Promise<DomainPlugin> {
  const domainId = env.DOMAIN_ID;
  const loader = registry.get(domainId);

  if (!loader) {
    const available = Array.from(registry.keys());
    throw new Error(`Domain "${domainId}" is not registered. Available: [${available.join(', ')}]`);
  }

  return loader();
}

/**
 * Get the current domain ID from environment.
 */
export function getCurrentDomainId(): string {
  return env.DOMAIN_ID;
}

/**
 * List all registered domain IDs.
 */
export function listDomains(): string[] {
  return Array.from(registry.keys());
}
