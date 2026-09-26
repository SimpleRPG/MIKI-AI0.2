import { MIKI_DOMAINS, isMikiDomain } from './domainCatalogService';
import type { MikiDomain } from './crossDomainCirculationService';

export type SourceOwnershipKind = 'DOMAIN' | 'CORE_COMPATIBILITY_GATEWAY' | 'APPLICATION_SHELL';
export interface SourceOwnership { path: string; kind: SourceOwnershipKind; domain?: MikiDomain; replacementPath?: string; }

const CORE_COMPATIBILITY_GATEWAYS: Readonly<Record<string, string>> = Object.freeze({
  'src/services/api.ts': 'src/miki/core',
  'src/services/chapter69_90PlatformServices.ts': 'src/miki/core',
  'src/services/mikiApi.ts': 'src/miki/core',
  'src/services/simpleRpgApi.ts': 'src/miki/core',
  'src/services/storageService.ts': 'src/miki/memory',
  'src/services/systemLogger.ts': 'src/miki/core',
});

export function resolveSourceOwnership(path: string): SourceOwnership {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  const domainMatch = /^src\/miki\/([^/]+)(?:\/|$)/.exec(normalized);
  if (domainMatch && isMikiDomain(domainMatch[1])) {
    return { path: normalized, kind: 'DOMAIN', domain: domainMatch[1] };
  }
  const replacementPath = CORE_COMPATIBILITY_GATEWAYS[normalized];
  if (replacementPath) {
    return { path: normalized, kind: 'CORE_COMPATIBILITY_GATEWAY', domain: normalized.includes('storageService') ? 'memory' : 'core', replacementPath };
  }
  return { path: normalized, kind: 'APPLICATION_SHELL' };
}

export function getDomainOwnershipCatalog(): readonly MikiDomain[] { return MIKI_DOMAINS; }
export function getCoreCompatibilityGateways(): Readonly<Record<string, string>> { return CORE_COMPATIBILITY_GATEWAYS; }
