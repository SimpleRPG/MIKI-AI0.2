import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

export type MikiDomain =
  | 'core' | 'autonomy' | 'capability' | 'conversation' | 'data' | 'execution'
  | 'experience' | 'improvement' | 'learning' | 'memory' | 'promotion' | 'research'
  | 'safety' | 'selfAwareness' | 'selfDevelopment' | 'strategy' | 'unknown' | 'verification';

export interface DomainTransition {
  id: string;
  from: MikiDomain;
  to: MikiDomain;
  event: string;
  evidenceId?: string;
  occurredAt: number;
}

export interface DomainCoverage {
  domain: MikiDomain;
  inbound: number;
  outbound: number;
  lastActivityAt?: number;
  connected: boolean;
}

const KEY = 'miki_cross_domain_circulation_v1';
const MAX_HISTORY = 2000;
const DOMAINS: MikiDomain[] = [
  'core','autonomy','capability','conversation','data','execution','experience','improvement','learning',
  'memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification',
];

class CrossDomainCirculationService {
  private transitions: DomainTransition[] = [];
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.load();
    this.record('core', 'selfAwareness', 'APPLICATION_INITIALIZED');
  }

  dispose(): void {
    this.initialized = false;
  }

  record(from: MikiDomain, to: MikiDomain, event: string, evidenceId?: string): DomainTransition {
    const occurredAt = Date.now();
    const sequence = this.transitions.length + 1;
    const transition: DomainTransition = {
      id: `FLOW-${occurredAt}-${String(sequence).padStart(6, '0')}`,
      from,
      to,
      event,
      evidenceId,
      occurredAt,
    };
    this.transitions.push(transition);
    if (this.transitions.length > MAX_HISTORY) this.transitions.splice(0, this.transitions.length - MAX_HISTORY);
    this.save();
    systemLogger.info('SYSTEM', `[18分類循環] ${from} -> ${to}: ${event}`, { evidenceId });
    return { ...transition };
  }

  getCoverage(): DomainCoverage[] {
    return DOMAINS.map((domain) => {
      const inboundItems = this.transitions.filter((item) => item.to === domain);
      const outboundItems = this.transitions.filter((item) => item.from === domain);
      const last = [...inboundItems, ...outboundItems].sort((a, b) => b.occurredAt - a.occurredAt)[0];
      return {
        domain,
        inbound: inboundItems.length,
        outbound: outboundItems.length,
        lastActivityAt: last?.occurredAt,
        connected: inboundItems.length > 0 && outboundItems.length > 0,
      };
    });
  }

  getDisconnectedDomains(): MikiDomain[] {
    return this.getCoverage().filter((item) => !item.connected).map((item) => item.domain);
  }

  list(limit = 200): DomainTransition[] {
    return this.transitions.slice(-Math.max(1, limit)).reverse().map((item) => ({ ...item }));
  }

  private load(): void {
    try {
      const raw = storageService.getItem(KEY);
      this.transitions = raw ? JSON.parse(raw) : [];
    } catch (error) {
      this.transitions = [];
      systemLogger.warn('SYSTEM', '[18分類循環] 保存履歴の読込に失敗しました', String(error));
    }
  }

  private save(): void {
    storageService.setItem(KEY, JSON.stringify(this.transitions));
  }
}

export const crossDomainCirculationService = new CrossDomainCirculationService();
