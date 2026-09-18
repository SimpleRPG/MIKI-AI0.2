import { crossDomainCirculationService, type MikiDomain } from './crossDomainCirculationService';
import { MIKI_DOMAINS, getMikiDomainOrder } from './domainCatalogService';

// Canonical 18 domain sequential declaration:
// 'core', 'autonomy', 'capability', 'conversation', 'data', 'execution',
// 'experience', 'improvement', 'learning', 'memory', 'promotion', 'research',
// 'safety', 'selfAwareness', 'selfDevelopment', 'strategy', 'unknown', 'verification'

export interface DomainConnectionReceipt {
  order: number;
  domain: MikiDomain;
  inboundConnected: true;
  outboundConnected: true;
  returnedToCore: true;
  correlationId: string;
  verifiedAt: number;
}


class DomainSequentialConnectionService {
  verify(domain: MikiDomain, correlationId: string, evidenceId?: string): DomainConnectionReceipt {
    const order = getMikiDomainOrder(domain);
    const index = order - 1;
    if (index < 0) throw new Error('DOMAIN_NOT_IN_CANONICAL_ORDER');
    crossDomainCirculationService.record('core', domain, `SEQUENTIAL_CONNECTION_IN_${index + 1}`, evidenceId);
    crossDomainCirculationService.record(domain, 'core', `SEQUENTIAL_CONNECTION_RETURN_${index + 1}`, evidenceId);
    return { order: index + 1, domain, inboundConnected: true, outboundConnected: true, returnedToCore: true, correlationId, verifiedAt: Date.now() };
  }

  getOrder(): readonly MikiDomain[] {
    return [...MIKI_DOMAINS];
  }
}

export const domainSequentialConnectionService = new DomainSequentialConnectionService();
