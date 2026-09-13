import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { componentRegistryService } from './componentRegistryService';
import { componentRegressionService, RegressionSuite } from './componentRegressionService';
import { verifiedCapabilityPromotionService } from './verifiedCapabilityPromotionService';
import { verifiedKnowledgePromotionService, VerifiedKnowledgePromotion } from './verifiedKnowledgePromotionService';
import { ResearchResult } from './researchService';
import { KnowledgeGap } from './knowledgeGapService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { capabilityConfidenceService } from './capabilityConfidenceService';
import { ExecutionEnvironment } from './executionRunnerService';

export type RemediationStatus = 'KNOWLEDGE_CONFIRMED' | 'VALIDATION_QUEUED' | 'VALIDATION_PASSED' | 'VALIDATION_FAILED' | 'QUARANTINED';

export interface RemediationRecord {
  remediationId: string;
  gapId: string;
  claimIds: string[];
  statement: string;
  candidateComponentIds: string[];
  regressionSuiteIds: string[];
  status: RemediationStatus;
  reason: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = 'miki_research_to_remediation_v1';

/**
 * Web研究を「知識」だけで終わらせず、既存の安全な実行能力の再検証候補へ戻す境界。
 * 任意コード生成・直接Component変更・VERIFIED化は行わない。
 * Evidence -> Claim -> Verifier を通過したClaimだけを入力にする。
 */
export class ResearchToRemediationService {
  private records: RemediationRecord[] = [];
  constructor() { this.load(); }

  public process(gap: KnowledgeGap, result: ResearchResult, environment: ExecutionEnvironment | string = 'ANDROID'): RemediationRecord | undefined {
    const promoted = (result.verification || []).filter(v => v.promoted);
    if (!result.resolved || promoted.length === 0) return undefined;

    const promotions: VerifiedKnowledgePromotion[] = [];
    for (const verification of promoted) {
      const promotion = verifiedKnowledgePromotionService.promote({
        gap,
        claimId: verification.claimId,
        sourceRequestId: gap.sourceRequestId,
      });
      if (promotion) promotions.push(promotion);
    }
    if (!promotions.length) return undefined;

    const statements = promotions.map(p => this.normalize(p.statement));
    const distinct = Array.from(new Set(statements));
    const claimIds = promotions.map(p => p.claimId);
    const statement = promotions[0].statement;

    // 異なる検証済みClaimが同じGapで競合する場合、実行能力へは戻さない。
    if (distinct.length > 1) {
      const quarantined = this.upsert({
        gapId: gap.id, claimIds, statement,
        candidateComponentIds: [], regressionSuiteIds: [],
        status: 'QUARANTINED',
        reason: '同一Gap内で異なる検証済みClaimが存在するため、実行能力への転用を停止しました。',
      });
      systemLogger.warn('SELF_IMPROVEMENT', `🧠 [Research→Remediation] ${gap.id}: contradiction quarantine`);
      return quarantined;
    }

    const capabilityIds = Array.from(new Set(promotions.flatMap(p => p.capabilityCandidates)));
    for (const promotion of promotions) verifiedCapabilityPromotionService.promote(promotion);

    const candidates = componentRegistryService.getAllComponents().filter(c => c.status === 'VERIFIED').filter(c => {
      const hay = this.tokens(`${c.component_id} ${c.purpose} ${c.entry_point}`);
      const needles = this.tokens(`${statement} ${capabilityIds.join(' ')} ${gap.query}`);
      return this.overlap(hay, needles) >= 1;
    }).sort((a, b) => this.overlap(this.tokens(`${b.component_id} ${b.purpose}`), this.tokens(`${statement} ${gap.query}`)) - this.overlap(this.tokens(`${a.component_id} ${a.purpose}`), this.tokens(`${statement} ${gap.query}`))).slice(0, 3);

    const env: ExecutionEnvironment = (['ANDROID', 'TERMUX', 'EXCEL_WINDOWS', 'EXCEL_MAC', 'EXTERNAL_RUNNER'].includes(environment as any))
      ? (environment as ExecutionEnvironment)
      : 'ANDROID';
    const suites: RegressionSuite[] = [];
    for (const component of candidates) {
      const confidence = capabilityConfidenceService.evaluate(component.component_id, env);
      // 再検証要求中のComponentは「修正候補」へ直接投入しない。
      if (confidence.revalidationRequired) continue;
      const suite = componentRegressionService.plan(component.component_id, env);
      if (suite) suites.push(suite);
    }

    const record = this.upsert({
      gapId: gap.id,
      claimIds,
      statement,
      candidateComponentIds: candidates.map(c => c.component_id),
      regressionSuiteIds: suites.map(s => s.suite_id),
      status: suites.length ? 'VALIDATION_QUEUED' : 'KNOWLEDGE_CONFIRMED',
      reason: suites.length
        ? `検証済み知識を既存VERIFIED能力へ接続し、${suites.length}件のRegression Suiteを待機状態にしました。`
        : '検証済み知識は保存しましたが、安全に対応付けられる現行VERIFIED Componentがないため実行へ転用しません。',
    });
    mikiUnifiedLearningContinuumService.observe({
      domain: 'research',
      action: suites.length ? 'research_to_validation_queue' : 'research_to_knowledge_only',
      input: `${gap.query} ${statement}`,
      outcome: 'SUCCESS',
      verified: true,
      capabilityIds,
      lesson: `research-remediation:${record.remediationId}:${record.status}`,
    });
    return record;
  }

  public refresh(remediationId: string): RemediationRecord | undefined {
    const record = this.records.find(r => r.remediationId === remediationId);
    if (!record || !record.regressionSuiteIds.length || record.status === 'QUARANTINED') return record;
    const suites = record.regressionSuiteIds.map(id => componentRegressionService.refresh(id)).filter(Boolean) as RegressionSuite[];
    if (!suites.length) return record;
    if (suites.some(s => s.status === 'FAILED' || s.status === 'BLOCKED')) {
      record.status = 'VALIDATION_FAILED';
      record.reason = '研究後のRegressionで失敗/ブロックを検出。原因を新しいFailure/Knowledge Gapとして扱い、既存能力を自動昇格しません。';
    } else if (suites.every(s => s.status === 'PASSED')) {
      record.status = 'VALIDATION_PASSED';
      record.reason = '研究後のRegressionが全件PASS。既存VERIFIED Componentの現行hashと証拠整合を確認しました。';
    }
    record.updatedAt = Date.now();
    this.save();
    return { ...record, candidateComponentIds: [...record.candidateComponentIds], regressionSuiteIds: [...record.regressionSuiteIds], claimIds: [...record.claimIds] };
  }

  public list(limit = 100): RemediationRecord[] { return this.records.slice(0, Math.max(1, limit)).map(r => ({ ...r, claimIds: [...r.claimIds], candidateComponentIds: [...r.candidateComponentIds], regressionSuiteIds: [...r.regressionSuiteIds] })); }
  public get(id: string): RemediationRecord | undefined { return this.records.find(r => r.remediationId === id); }

  private upsert(input: Omit<RemediationRecord, 'remediationId' | 'createdAt' | 'updatedAt'>): RemediationRecord {
    const existing = this.records.find(r => r.gapId === input.gapId && r.status !== 'QUARANTINED');
    if (existing) {
      existing.claimIds = Array.from(new Set([...existing.claimIds, ...input.claimIds]));
      existing.candidateComponentIds = Array.from(new Set([...existing.candidateComponentIds, ...input.candidateComponentIds]));
      existing.regressionSuiteIds = Array.from(new Set([...existing.regressionSuiteIds, ...input.regressionSuiteIds]));
      existing.status = input.status;
      existing.reason = input.reason;
      existing.statement = input.statement;
      existing.updatedAt = Date.now();
      this.save();
      return existing;
    }
    const now = Date.now();
    const record: RemediationRecord = { ...input, remediationId: `REMED-${this.hash(`${input.gapId}|${input.claimIds.join('|')}|${input.statement}`)}`, createdAt: now, updatedAt: now };
    this.records.unshift(record); this.records = this.records.slice(0, 500); this.save();
    return record;
  }
  private normalize(text: string): string { return text.toLowerCase().replace(/[\s\u3000]+/g, ' ').replace(/[「」『』“”"'、。！？!?]/g, '').trim(); }
  private tokens(text: string): string[] { return text.toLowerCase().split(/[^a-z0-9_\u3040-\u30ff\u3400-\u9fff]+/).filter(x => x.length >= 2).slice(0, 80); }
  private overlap(a: string[], b: string[]): number { const set = new Set(b); return a.reduce((n, x) => n + (set.has(x) ? 1 : 0), 0); }
  private hash(raw: string): string { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
  private load(): void { try { const raw=storageService.getItem(KEY); if(raw){const p=JSON.parse(raw); if(Array.isArray(p)) this.records=p;} } catch { this.records=[]; } }
  private save(): void { try { storageService.setItem(KEY, JSON.stringify(this.records)); } catch {} }
}
export const researchToRemediationService = new ResearchToRemediationService();
