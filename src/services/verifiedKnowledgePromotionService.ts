import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { claimDatabaseService } from './claimDatabaseService';
import { KnowledgeGap } from './knowledgeGapService';
import { MikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';

export interface VerifiedKnowledgePromotion {
  promotionId: string;
  gapId: string;
  claimId: string;
  statement: string;
  capabilityCandidates: string[];
  sourceRequestId?: string;
  scopeKey: string;
  confidence: number;
  promotedAt: number;
}

const KEY = 'miki_verified_knowledge_promotions_v1';

/**
 * 検証済みClaimを「再利用可能な知識」として能力選択へ橋渡しする層。
 * 重要: ここではComponentをVERIFIEDにしたり、任意コードを生成したりしない。
 * Claimのverification status / scopeを保持したまま、次回計画の候補ランキングだけを改善する。
 */
export class VerifiedKnowledgePromotionService {
  private promotions: VerifiedKnowledgePromotion[] = [];
  private initialized = false;

  constructor() { this.load(); }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    systemLogger.info('SELF_IMPROVEMENT', '📚 [VerifiedKnowledgePromotion] initialized');
  }

  public promote(params: { gap: KnowledgeGap; claimId: string; sourceRequestId?: string }): VerifiedKnowledgePromotion | undefined {
    const claim = claimDatabaseService.getClaim(params.claimId);
    if (!claim || !['SUPPORTED', 'DEVICE_VERIFIED'].includes(String(claim.status))) return undefined;

    const scopeKey = this.scopeKey(claim.scope);
    const capabilityCandidates = this.deriveCapabilityCandidates(params.gap.query, params.gap.type);
    const existing = this.promotions.find(p => p.claimId === claim.claim_id && p.scopeKey === scopeKey);
    if (existing) return existing;

    const promotion: VerifiedKnowledgePromotion = {
      promotionId: `VK-${this.hash(`${params.gap.id}|${claim.claim_id}|${scopeKey}`)}`,
      gapId: params.gap.id,
      claimId: claim.claim_id,
      statement: claim.statement,
      capabilityCandidates,
      sourceRequestId: params.sourceRequestId || params.gap.sourceRequestId,
      scopeKey,
      confidence: claim.status === 'DEVICE_VERIFIED' ? 100 : 90,
      promotedAt: Date.now(),
    };
    this.promotions.unshift(promotion);
    this.promotions = this.promotions.slice(0, 500);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `📚 [VerifiedKnowledgePromotion] ${promotion.promotionId}: ${claim.claim_id}`);
    return promotion;
  }

  public list(limit = 100): VerifiedKnowledgePromotion[] {
    return this.promotions.slice(0, Math.max(1, limit)).map(p => ({ ...p, capabilityCandidates: [...p.capabilityCandidates] }));
  }

  public findRelevant(query: string, limit = 8): VerifiedKnowledgePromotion[] {
    const tokens = this.tokens(query);
    return this.promotions
      .map(p => ({ p, score: this.overlap(tokens, this.tokens(`${p.statement} ${p.capabilityCandidates.join(' ')}`)) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || b.p.promotedAt - a.p.promotedAt)
      .slice(0, limit)
      .map(x => ({ ...x.p, capabilityCandidates: [...x.p.capabilityCandidates] }));
  }

  public rankCapabilityKnowledge(capabilityIds: string[], query: string): Map<string, number> {
    const relevant = this.findRelevant(query, 12);
    const result = new Map<string, number>();
    for (const id of capabilityIds) {
      let score = 0;
      for (const p of relevant) {
        if (p.capabilityCandidates.includes(id)) score += p.confidence * 0.35;
        else if (p.capabilityCandidates.some(c => c.split('.').slice(0, 2).join('.') === id.split('.').slice(0, 2).join('.'))) score += p.confidence * 0.10;
      }
      if (score > 0) result.set(id, Math.round(score * 100) / 100);
    }
    return result;
  }

  /** LearningContinuumへ「検証済み知識が存在する」というメタ経験だけを記録する。 */
  public recordIntoContinuum(promotion: VerifiedKnowledgePromotion, continuum: MikiUnifiedLearningContinuumService): void {
    continuum.observe({
      domain: 'research',
      key: promotion.claimId,
      outcome: 'SUCCESS',
      verified: true,
      capabilityIds: promotion.capabilityCandidates,
      concepts: this.tokens(promotion.statement).slice(0, 12),
    });
  }

  private deriveCapabilityCandidates(query: string, type: KnowledgeGap['type']): string[] {
    const text = query.toLowerCase();
    const ids: string[] = [];
    if (/excel|vba|マクロ|セル/.test(text)) ids.push('excel.vba.performance');
    if (/android|termux|スマホ|端末/.test(text)) ids.push('android.environment');
    if (/ゲーム|rpg|戦闘|装備|クエスト|採取|料理/.test(text)) ids.push('simple_rpg.planning');
    if (/コード|実装|api|プログラム/.test(text) || type === 'UNKNOWN_CAPABILITY') ids.push('general.deterministic.execution');
    if (/比較|おすすめ|選択|判断/.test(text)) ids.push('general.decision.analysis');
    if (!ids.length) ids.push('general.verified-knowledge-reuse');
    return Array.from(new Set(ids));
  }

  private scopeKey(scope: unknown): string {
    return JSON.stringify(scope || {});
  }

  private tokens(text: string): string[] {
    return text.toLowerCase().split(/[^a-z0-9_\u3040-\u30ff\u3400-\u9fff]+/).filter(x => x.length >= 2).slice(0, 60);
  }

  private overlap(a: string[], b: string[]): number {
    const set = new Set(b);
    return a.reduce((n, x) => n + (set.has(x) ? 1 : 0), 0);
  }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  private load(): void {
    try { const raw = storageService.getItem(KEY); if (raw) this.promotions = JSON.parse(raw); } catch { this.promotions = []; }
  }
  private save(): void {
    try { storageService.setItem(KEY, JSON.stringify(this.promotions)); } catch { /* optional */ }
  }
}

export const verifiedKnowledgePromotionService = new VerifiedKnowledgePromotionService();
