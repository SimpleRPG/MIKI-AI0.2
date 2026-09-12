import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { claimDatabaseService } from './claimDatabaseService';
import { verifiedKnowledgePromotionService, VerifiedKnowledgePromotion } from './verifiedKnowledgePromotionService';
import { unifiedMikiExperienceService } from './unifiedMikiExperienceService';

export type VerifiedCapabilityMaturity = 'KNOWLEDGE_BACKED' | 'TRANSFERABLE' | 'MATURE';

export interface VerifiedCapabilityRecord {
  id: string;
  claimId: string;
  promotionId: string;
  capabilityIds: string[];
  statement: string;
  scopeKey: string;
  maturity: VerifiedCapabilityMaturity;
  evidenceUses: number;
  successfulTransfers: number;
  createdAt: number;
  updatedAt: number;
}

const KEY = 'miki_verified_capabilities_v1';

/**
 * 検証済み知識を「再利用可能な能力知識」へ安全に昇格する層。
 * ここでComponentを生成/VERIFIED化することは禁止。既存の検証済みComponentの
 * 計画ランキングに利用できる知識能力としてのみ扱う。
 */
export class VerifiedCapabilityPromotionService {
  private records: VerifiedCapabilityRecord[] = [];
  constructor() { this.load(); }

  public promote(promotion: VerifiedKnowledgePromotion): VerifiedCapabilityRecord | undefined {
    const claim = claimDatabaseService.getClaim(promotion.claimId);
    if (!claim || !['SUPPORTED', 'DEVICE_VERIFIED'].includes(String(claim.status))) return undefined;

    const existing = this.records.find(r => r.claimId === claim.claim_id && r.scopeKey === promotion.scopeKey);
    if (existing) return existing;

    const record: VerifiedCapabilityRecord = {
      id: `VCAP-${this.hash(`${claim.claim_id}|${promotion.scopeKey}|${promotion.capabilityCandidates.join('|')}`)}`,
      claimId: claim.claim_id,
      promotionId: promotion.promotionId,
      capabilityIds: [...promotion.capabilityCandidates],
      statement: claim.statement,
      scopeKey: promotion.scopeKey,
      maturity: claim.maturity === 'MATURE' || claim.maturity === 'TRANSFERRED' ? 'TRANSFERABLE' : 'KNOWLEDGE_BACKED',
      evidenceUses: 1,
      successfulTransfers: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 500);
    this.save();
    this.observe(record, 'promotion');
    return record;
  }

  /** 同一検証済み知識が別分野で安全に使われた結果を記録する。 */
  public recordTransfer(capabilityId: string, query: string, success: boolean, scopeKey?: string): void {
    const related = this.records.filter(r => r.capabilityIds.includes(capabilityId) && (!scopeKey || r.scopeKey === scopeKey));
    for (const r of related) {
      r.evidenceUses += 1;
      if (success) {
        r.successfulTransfers += 1;
        if (r.successfulTransfers >= 2) r.maturity = 'MATURE';
        else r.maturity = 'TRANSFERABLE';
        const claim = claimDatabaseService.getClaim(r.claimId);
        if (claim && claim.status !== 'UNVERIFIED') {
          claimDatabaseService.promoteMaturity(r.claimId, 'TRANSFERRED', '検証済み知識が別要求で安全に再利用され、成功結果を得た');
        }
      }
      r.updatedAt = Date.now();
      this.observe(r, success ? 'transfer_success' : 'transfer_failure', query);
    }
    this.save();
  }

  public list(limit = 100): VerifiedCapabilityRecord[] {
    return this.records.slice(0, Math.max(1, limit)).map(r => ({ ...r, capabilityIds: [...r.capabilityIds] }));
  }

  public findRelevant(query: string, limit = 8): VerifiedCapabilityRecord[] {
    const tokens = this.tokens(query);
    return this.records.map(r => ({ r, score: this.overlap(tokens, this.tokens(`${r.statement} ${r.capabilityIds.join(' ')}`)) + this.maturityScore(r.maturity) / 100 })).filter(x => x.score > 0).sort((a,b) => b.score-a.score || b.r.updatedAt-a.r.updatedAt).slice(0, limit).map(x => ({ ...x.r, capabilityIds: [...x.r.capabilityIds] }));
  }

  public rank(capabilityIds: string[], query: string): Map<string, number> {
    const result = new Map<string, number>();
    for (const record of this.findRelevant(query, 12)) {
      const base = this.maturityScore(record.maturity) * 0.5;
      for (const id of capabilityIds) if (record.capabilityIds.includes(id)) result.set(id, (result.get(id) || 0) + base);
    }
    return result;
  }

  private observe(record: VerifiedCapabilityRecord, action: string, input = record.statement): void {
    unifiedMikiExperienceService.observe({
      domain: 'research', action, input,
      outcome: 'SUCCESS', verified: true,
      capabilityIds: record.capabilityIds,
      lesson: `verified-capability:${record.id}:${record.maturity}`,
    });
  }

  private maturityScore(m: VerifiedCapabilityMaturity): number { return m === 'MATURE' ? 300 : m === 'TRANSFERABLE' ? 200 : 100; }
  private tokens(text: string): string[] { return text.toLowerCase().split(/[^a-z0-9_\u3040-\u30ff\u3400-\u9fff]+/).filter(x => x.length >= 2).slice(0, 60); }
  private overlap(a: string[], b: string[]): number { const set = new Set(b); return a.reduce((n,x)=>n+(set.has(x)?1:0),0); }
  private hash(raw: string): string { let h=2166136261; for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
  private load(): void { try { const raw=storageService.getItem(KEY); if(raw){const parsed=JSON.parse(raw); if(Array.isArray(parsed)) this.records=parsed;} } catch { this.records=[]; } }
  private save(): void { try { storageService.setItem(KEY, JSON.stringify(this.records)); } catch (e) { systemLogger.warn('SELF_IMPROVEMENT', `[VerifiedCapability] save failed: ${String(e)}`); } }
}

export const verifiedCapabilityPromotionService = new VerifiedCapabilityPromotionService();
