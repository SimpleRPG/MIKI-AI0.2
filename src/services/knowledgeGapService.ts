import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const STORAGE_KEY = 'miki_knowledge_gaps_v1';

export type KnowledgeGapType =
  | 'UNKNOWN_TERM'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONTRADICTION'
  | 'STALE_INFORMATION'
  | 'UNKNOWN_CAPABILITY'
  | 'WEAK_COMPONENT';

export type KnowledgeGapStatus = 'OPEN' | 'RESEARCHING' | 'RESOLVED' | 'BLOCKED';

export interface KnowledgeGap {
  id: string;
  query: string;
  type: KnowledgeGapType;
  priority: number;
  requiredEvidence: string[];
  status: KnowledgeGapStatus;
  reason: string;
  sourceRequestId?: string;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  lastResearchAt?: number;
}

/**
 * 未知を「答え」で埋めず、調査対象として永続化するための軽量なキュー。
 * Claim DBとは責務を分離し、ここでは真偽判定やClaimへの昇格を行わない。
 */
export class KnowledgeGapService {
  private gaps: KnowledgeGap[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.gaps = parsed;
      }
    } catch (error) {
      systemLogger.warn('SELF_IMPROVEMENT', `KnowledgeGapの読み込みに失敗しました: ${String(error)}`);
      this.gaps = [];
    }
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.gaps.slice(0, 500)));
    } catch (error) {
      systemLogger.warn('SELF_IMPROVEMENT', `KnowledgeGapの保存に失敗しました: ${String(error)}`);
    }
  }

  public detect(params: {
    query: string;
    reason?: string;
    type?: KnowledgeGapType;
    priority?: number;
    requiredEvidence?: string[];
    sourceRequestId?: string;
  }): KnowledgeGap {
    const query = params.query.trim();
    const existing = this.findOpen(query);
    if (existing) return existing;

    const now = Date.now();
    const gap: KnowledgeGap = {
      id: this.makeId(query),
      query,
      type: params.type || this.inferType(query, params.reason || ''),
      priority: Math.max(1, Math.min(100, params.priority ?? 50)),
      requiredEvidence: params.requiredEvidence?.filter(Boolean) || ['信頼できる一次資料または再現可能な検証結果'],
      status: 'OPEN',
      reason: params.reason || '端末内の既知知識だけでは結論を確定できない',
      sourceRequestId: params.sourceRequestId,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    };

    this.gaps.unshift(gap);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `🔎 [Knowledge Gap] ${gap.id}: ${gap.type} / ${gap.query}`);
    return gap;
  }

  public findOpen(query: string): KnowledgeGap | undefined {
    const normalized = this.normalize(query);
    return this.gaps.find((gap) => gap.status !== 'RESOLVED' && gap.status !== 'BLOCKED' && this.normalize(gap.query) === normalized);
  }

  public getById(id: string): KnowledgeGap | undefined {
    return this.gaps.find((gap) => gap.id === id);
  }

  public listOpen(limit = 20): KnowledgeGap[] {
    return this.gaps
      .filter((gap) => gap.status === 'OPEN' || gap.status === 'RESEARCHING')
      .sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((gap) => ({ ...gap, requiredEvidence: [...gap.requiredEvidence] }));
  }

  public markResearching(id: string): KnowledgeGap | undefined {
    return this.update(id, { status: 'RESEARCHING', lastResearchAt: Date.now(), attempts: (this.getById(id)?.attempts || 0) + 1 });
  }

  public markResolved(id: string): KnowledgeGap | undefined {
    return this.update(id, { status: 'RESOLVED' });
  }

  public markBlocked(id: string, reason?: string): KnowledgeGap | undefined {
    return this.update(id, { status: 'BLOCKED', reason: reason || this.getById(id)?.reason || '調査不能' });
  }

  private update(id: string, patch: Partial<KnowledgeGap>): KnowledgeGap | undefined {
    const index = this.gaps.findIndex((gap) => gap.id === id);
    if (index < 0) return undefined;
    this.gaps[index] = { ...this.gaps[index], ...patch, updatedAt: Date.now() };
    this.save();
    return this.gaps[index];
  }

  private inferType(query: string, reason: string): KnowledgeGapType {
    const text = `${query} ${reason}`;
    if (/矛盾|contradict|食い違|一致しない/i.test(text)) return 'CONTRADICTION';
    if (/古い|更新|最新|obsolete|stale/i.test(text)) return 'STALE_INFORMATION';
    if (/部品|component|実装|コード|能力/i.test(text)) return 'UNKNOWN_CAPABILITY';
    if (/用語|意味|定義|とは/i.test(text)) return 'UNKNOWN_TERM';
    return 'INSUFFICIENT_EVIDENCE';
  }

  private normalize(text: string): string {
    return text.toLowerCase().replace(/[\s\u3000]+/g, ' ').trim();
  }

  private makeId(query: string): string {
    let hash = 2166136261;
    const input = this.normalize(query);
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `GAP-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
}

export const knowledgeGapService = new KnowledgeGapService();
