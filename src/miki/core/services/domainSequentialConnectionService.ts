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
    let order: number | null = null;
    let index = -1;
    const checkpoint = (phase: string, status: string, errorType?: string) => {
      systemLogger.recordRuntimeBreadcrumb('DOMAIN_CONNECTION_CHECKPOINT', {
        domain, order, correlationId, phase, status,
        elapsedMs: Date.now() - startedAt, errorType,
      });
    };
    try {
      checkpoint('ORDER_LOOKUP_BEGIN', 'STARTED');
      const resolvedOrder = getMikiDomainOrder(domain);
      order = resolvedOrder;
      index = resolvedOrder - 1;
      checkpoint('ORDER_LOOKUP_COMPLETE', 'COMPLETED');
      if (index < 0) throw new Error('DOMAIN_NOT_IN_CANONICAL_ORDER');

      checkpoint('INBOUND_RECORD_BEGIN', 'STARTED');
      crossDomainCirculationService.record('core', domain, `SEQUENTIAL_CONNECTION_IN_${index + 1}`, evidenceId);
      checkpoint('INBOUND_RECORD_COMPLETE', 'COMPLETED');

      checkpoint('RETURN_RECORD_BEGIN', 'STARTED');
      crossDomainCirculationService.record(domain, 'core', `SEQUENTIAL_CONNECTION_RETURN_${index + 1}`, evidenceId);
      checkpoint('RETURN_RECORD_COMPLETE', 'COMPLETED');

      checkpoint('VERIFY_COMPLETE', 'COMPLETED');
      return { order: index + 1, domain, inboundConnected: true, outboundConnected: true, returnedToCore: true, correlationId, verifiedAt: Date.now() };
    } catch (error) {
      const errorType = error instanceof Error
        ? (error.message === 'DOMAIN_NOT_IN_CANONICAL_ORDER' ? 'DOMAIN_NOT_IN_CANONICAL_ORDER' : error.name)
        : typeof error;
      checkpoint('FAILED', 'FAILED', errorType);
      throw error;
    }
  }

  getOrder(): readonly MikiDomain[] {
    return [...MIKI_DOMAINS];
  }
}

export const domainSequentialConnectionService = new DomainSequentialConnectionService();
