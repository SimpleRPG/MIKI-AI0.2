import { crossDomainCirculationService, type MikiDomain } from './crossDomainCirculationService';
import { MIKI_DOMAINS, getMikiDomainOrder } from './domainCatalogService';
import { systemLogger } from '../../../services/systemLogger';

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
    const startedAt = Date.now();
    const order = getMikiDomainOrder(domain);
    const index = order - 1;
    const checkpoint = (phase: string, status: string, errorType?: string) => {
      systemLogger.recordRuntimeBreadcrumb('DOMAIN_CONNECTION_CHECKPOINT', {
        domain, order: index + 1, correlationId, phase, status,
        elapsedMs: Date.now() - startedAt, errorType,
      });
    };
    if (index < 0) {
      checkpoint('INVALID_ORDER', 'FAILED', 'DOMAIN_NOT_IN_CANONICAL_ORDER');
      throw new Error('DOMAIN_NOT_IN_CANONICAL_ORDER');
    }
    checkpoint('BEGIN', 'STARTED');
    try {
      crossDomainCirculationService.record('core', domain, `SEQUENTIAL_CONNECTION_IN_${index + 1}`, evidenceId);
      checkpoint('INBOUND_COMPLETE', 'COMPLETED');
      checkpoint('RETURN_BEGIN', 'STARTED');
      crossDomainCirculationService.record(domain, 'core', `SEQUENTIAL_CONNECTION_RETURN_${index + 1}`, evidenceId);
      checkpoint('COMPLETE', 'COMPLETED');
      return { order: index + 1, domain, inboundConnected: true, outboundConnected: true, returnedToCore: true, correlationId, verifiedAt: Date.now() };
    } catch (error) {
      checkpoint('FAILED', 'FAILED', error instanceof Error ? error.name : typeof error);
      throw error;
    }
  }

  getOrder(): readonly MikiDomain[] {
    return [...MIKI_DOMAINS];
  }
}

export const domainSequentialConnectionService = new DomainSequentialConnectionService();
