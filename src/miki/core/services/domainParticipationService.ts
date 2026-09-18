import { storageService } from '../../../services/storageService';
import { domainRouterService } from './domainRouterService';
import { type MikiDomain } from './crossDomainCirculationService';
import { MIKI_DOMAINS } from './domainCatalogService';

export const PARTICIPATING_DOMAINS:readonly MikiDomain[]=MIKI_DOMAINS;

export interface DomainParticipationAssessment {
  domain: MikiDomain;
  taskId: string;
  acknowledged: true;
  diagnosticResponsibility: string;
  evidenceContract: string[];
  observedAt: number;
}

export interface DomainConnectivityAuditEntry {
  domain: MikiDomain;
  healthAccepted: boolean;
  participationAccepted: boolean;
  connectionAccepted: boolean;
  order: number;
  error?: string;
}

export interface DomainConnectivityAudit {
  auditId: string;
  startedAt: number;
  completedAt: number;
  passed: boolean;
  entries: DomainConnectivityAuditEntry[];
}

const STORAGE_KEY = 'miki_domain_connectivity_audit_v1';

const DOMAIN_CONTRIBUTIONS: Record<MikiDomain, { diagnosticResponsibility: string; evidenceContract: string[] }> = {
  core: { diagnosticResponsibility: '共通追跡、配送、整合性、停止条件の診断契約', evidenceContract: ['correlationId', 'taskId'] },
  autonomy: { diagnosticResponsibility: '自律実行条件、予算、再試行方針の診断契約', evidenceContract: ['autonomyPolicy'] },
  capability: { diagnosticResponsibility: '必要能力、既存部品、能力不足の診断契約', evidenceContract: ['capabilityEvidence'] },
  conversation: { diagnosticResponsibility: '依頼意図、対象、否定条件、数値条件の診断契約', evidenceContract: ['intentEvidence'] },
  data: { diagnosticResponsibility: '入力データ、スキーマ、品質、再現可能性の診断契約', evidenceContract: ['dataSchemaEvidence'] },
  execution: { diagnosticResponsibility: '隔離実行と実測結果の診断契約', evidenceContract: ['executionEvidence'] },
  experience: { diagnosticResponsibility: '類似事例比較と経験記録の診断契約', evidenceContract: ['experienceEvidence'] },
  improvement: { diagnosticResponsibility: '課題、候補、変更範囲、改善効果の診断契約', evidenceContract: ['candidateEvidence'] },
  learning: { diagnosticResponsibility: '検証済み結果からの学習候補作成契約', evidenceContract: ['learningEvidence'] },
  memory: { diagnosticResponsibility: '適格記憶の取得と永続化の診断契約', evidenceContract: ['persistenceEvidence'] },
  promotion: { diagnosticResponsibility: '検証、Shadow比較、承認境界の診断契約', evidenceContract: ['promotionEvidence'] },
  research: { diagnosticResponsibility: '不足知識調査とEvidence返却の診断契約', evidenceContract: ['researchEvidence'] },
  safety: { diagnosticResponsibility: '秘密情報、禁止操作、資源、復元可能性の診断契約', evidenceContract: ['safetyEvidence'] },
  selfAwareness: { diagnosticResponsibility: '未確認範囲、能力限界、自己評価偏りの診断契約', evidenceContract: ['limitationEvidence'] },
  selfDevelopment: { diagnosticResponsibility: '既存部品優先と隔離実装候補の診断契約', evidenceContract: ['implementationEvidence'] },
  strategy: { diagnosticResponsibility: 'coreが決定した経路を受け取る戦略契約', evidenceContract: ['routeDecisionEvidence'] },
  unknown: { diagnosticResponsibility: '未知分類と必要証拠の診断契約', evidenceContract: ['unknownResolutionEvidence'] },
  verification: { diagnosticResponsibility: '独立Evidence、反証、回帰、完全性の診断契約', evidenceContract: ['validationEvidence'] },
};

class DomainParticipationService {
  private sequence = 0;
  private lastAudit?: DomainConnectivityAudit;

  assess(domain: MikiDomain, payload: unknown): DomainParticipationAssessment {
    const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const taskId = typeof value.taskId === 'string' && value.taskId.trim() ? value.taskId : 'unassigned';
    const rule = DOMAIN_CONTRIBUTIONS[domain];
    return { domain, taskId, acknowledged: true, diagnosticResponsibility: rule.diagnosticResponsibility, evidenceContract: [...rule.evidenceContract], observedAt: Date.now() };
  }

  async auditAll(): Promise<DomainConnectivityAudit> {
    const startedAt = Date.now();
    const auditId = `domain_audit_${startedAt}_${++this.sequence}`;
    const entries: DomainConnectivityAuditEntry[] = [];
    for (const domain of PARTICIPATING_DOMAINS) {
      try {
        const base = { correlationId: auditId, causationId: auditId, source: 'core' as MikiDomain, target: domain, evidenceIds: [] as string[], createdAt: startedAt, depth: 0 };
        const health = await domainRouterService.dispatch({ ...base, envelopeId: `${auditId}_${domain}_health`, command: 'HEALTH_CHECK', payload: { auditId } });
        const participation = await domainRouterService.dispatch({ ...base, envelopeId: `${auditId}_${domain}_participate`, command: 'PARTICIPATE', payload: { auditId, taskId: auditId } });
        const connection = await domainRouterService.dispatch({ ...base, envelopeId: `${auditId}_${domain}_connection`, command: 'VERIFY_CONNECTION', payload: { auditId } });
        entries.push({ domain, healthAccepted: health.accepted, participationAccepted: participation.accepted, connectionAccepted: connection.accepted, order: entries.length + 1, error: health.error || participation.error || connection.error });
      } catch (error) {
        entries.push({ domain, healthAccepted: false, participationAccepted: false, connectionAccepted: false, order: entries.length + 1, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const audit: DomainConnectivityAudit = { auditId, startedAt, completedAt: Date.now(), passed: entries.length === PARTICIPATING_DOMAINS.length && entries.every((entry, index) => entry.order === index + 1 && entry.healthAccepted && entry.participationAccepted && entry.connectionAccepted), entries };
    this.lastAudit = audit;
    storageService.setItem(STORAGE_KEY, JSON.stringify(audit));
    return audit;
  }

  getLastAudit(): DomainConnectivityAudit | undefined {
    if (this.lastAudit) return this.lastAudit;
    const raw = storageService.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    try {
      const saved = JSON.parse(raw) as DomainConnectivityAudit;
      if (saved && Array.isArray(saved.entries)) this.lastAudit = saved;
    } catch {
      return undefined;
    }
    return this.lastAudit;
  }
}

export const domainParticipationService = new DomainParticipationService();
