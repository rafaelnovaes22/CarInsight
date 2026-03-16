/**
 * Domains barrel export
 *
 * Each domain plugin registers itself via the domain registry.
 * This file re-exports domain constants and plugins for convenience.
 */

export {
  AUTOMOTIVE_DOMAIN_ID,
  AUTOMOTIVE_DOMAIN_NAME,
  AUTOMOTIVE_DOMAIN_VERSION,
  automotiveDomainPlugin,
} from './automotive';
