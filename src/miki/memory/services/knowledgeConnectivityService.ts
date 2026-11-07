import { claimDatabaseService } from './claimDatabaseService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { wordAssociationGraphService } from './wordAssociationGraphService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P474: 知識の「使われ見込み」（接続性）の集計（読み取り専用）。
 *
 * 背景（2026-11-07 の知識在庫監査）: 在庫は増える一方で、会話・
 * タスク・彼女のやることに繋がらない知識が、自律ループの作業時間
 * （矛盾の後始末・再検証）まで消費していた。ここでは Claim ごとに
 * 「何かと繋がっているか」を既存の記録から数え、CONNECTED / WEAK /
 * ORPHANED（孤立）に分類する。削除や降格は一切しない。判断材料を
 * 人と優先度付けに渡すのが役目。
 *
 * 信号:
 * - S1 出所（強）: source が web_search 以外（会話・教師・ユーザー
 *   由来）、または derived_from に非 web の Claim を含む。
 * - S2 gap接続（強）: OPEN な KnowledgeGap の研究対象に含まれる。
 * - S3 関係（中）: contradicted_by を持つ／derived_from を持つ／
 *   他の Claim の derived_from に現れる。
 * - S4 連想（弱）: 内容語が連想グラフの辺に現れる。
 * - S5 新しさ（弱）: updated_at が 14 日以内。
 *
 * 強が1つでもあれば CONNECTED、中・弱のみは WEAK、全て無しは
 * ORPHANED。新しい Claim は S5 で当面 WEAK になり、様子見の期間を
 * 持つ（登録直後に「孤立」と断じない）。
 */

export type ClaimConnectivityClass = 'CONNECTED' | 'WEAK' | 'ORPHANED';

export interface ClaimConnectivity {
  claimId: string;
  cls: ClaimConnectivityClass;
  signals: {
    provenance: boolean;
    gapLinked: boolean;
    relation: boolean;
    association: boolean;
    fresh: boolean;
  };
}

export interface OrphanedClaimView extends ClaimConnectivity {
  statement: string;
  source: string;
  status: string;
  maturity: string;
  ageDays: number;
}

export interface ConnectivitySummary {
  total: number;
  connected: number;
  weak: number;
  orphaned: number;
  orphanedBySource: Record<string, number>;
  evaluatedAt: number;
}

const FRESH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60_000;

class KnowledgeConnectivityService {
  private cache: { at: number; rows: ClaimConnectivity[] } | null = null;

  private compute(): ClaimConnectivity[] {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.rows;

    const claims = claimDatabaseService.getAllClaims();
    const byId = new Map<string, any>(claims.map((c: any) => [c.claim_id, c]));

    // S2: OPEN gap の研究対象
    const gapLinked = new Set<string>();
    try {
      for (const gap of knowledgeGapService.listOpen(100000)) {
        for (const id of gap.researchClaimIds || []) gapLinked.add(id);
        for (const id of gap.researchRequiredClaimIds || []) gapLinked.add(id);
      }
    } catch { /* gap が読めなくても他の信号で分類する */ }

    // S3 の一部: 誰かの derived_from に現れる Claim は「使われた」側
    const derivedTargets = new Set<string>();
    for (const claim of claims as any[]) {
      for (const id of claim.derived_from || []) derivedTargets.add(id);
    }

    // S4: 連想グラフの辺に現れる語の集合
    const associatedTerms = new Set<string>();
    try {
      for (const edge of wordAssociationGraphService.getAllEdges()) {
        if (edge.from) associatedTerms.add(edge.from);
        if (edge.to) associatedTerms.add(edge.to);
      }
    } catch { /* 連想が無ければ S4 は全て false */ }

    const now = Date.now();
    const rows: ClaimConnectivity[] = [];
    for (const claim of claims as any[]) {
      // 信念改訂で置換済みの Claim は在庫の棚卸し対象から外す
      try {
        if (claimDatabaseService.getBeliefStatus(claim.claim_id) === 'SUPERSEDED') continue;
      } catch { /* 状態が取れなければ含める */ }

      const derivedFrom: string[] = Array.isArray(claim.derived_from) ? claim.derived_from : [];
      const provenance =
        (typeof claim.source === 'string' && claim.source !== 'web_search') ||
        derivedFrom.some((id) => {
          const parent = byId.get(id);
          return parent && typeof parent.source === 'string' && parent.source !== 'web_search';
        });
      const relation =
        (Array.isArray(claim.contradicted_by) && claim.contradicted_by.length > 0) ||
        derivedFrom.length > 0 ||
        derivedTargets.has(claim.claim_id);
      let association = false;
      if (associatedTerms.size > 0) {
        try {
          const keywords = wordAssociationGraphService.extractKeywords(claim.statement || '');
          association = keywords.some((k) => associatedTerms.has(k));
        } catch { association = false; }
      }
      const fresh = typeof claim.updated_at === 'number' && now - claim.updated_at < FRESH_WINDOW_MS;

      const signals = {
        provenance,
        gapLinked: gapLinked.has(claim.claim_id),
        relation,
        association,
        fresh,
      };
      const cls: ClaimConnectivityClass =
        signals.provenance || signals.gapLinked
          ? 'CONNECTED'
          : signals.relation || signals.association || signals.fresh
            ? 'WEAK'
            : 'ORPHANED';
      rows.push({ claimId: claim.claim_id, cls, signals });
    }

    this.cache = { at: now, rows };
    return rows;
  }

  public classify(claimId: string): ClaimConnectivity | undefined {
    return this.compute().find((row) => row.claimId === claimId);
  }

  /** ペア・枝の並び替え用ランク（小さいほど優先）。 */
  public rankOf(claimId: string): number {
    const row = this.classify(claimId);
    return row ? (row.cls === 'CONNECTED' ? 0 : row.cls === 'WEAK' ? 1 : 2) : 1;
  }

  public summarize(): ConnectivitySummary {
    const rows = this.compute();
    const orphanedBySource: Record<string, number> = {};
    let connected = 0;
    let weak = 0;
    let orphaned = 0;
    for (const row of rows) {
      if (row.cls === 'CONNECTED') connected += 1;
      else if (row.cls === 'WEAK') weak += 1;
      else {
        orphaned += 1;
        const claim: any = claimDatabaseService.getClaim(row.claimId);
        const source = typeof claim?.source === 'string' ? claim.source : 'unknown';
        orphanedBySource[source] = (orphanedBySource[source] || 0) + 1;
      }
    }
    return { total: rows.length, connected, weak, orphaned, orphanedBySource, evaluatedAt: Date.now() };
  }

  public listOrphaned(limit = 50): OrphanedClaimView[] {
    const rows = this.compute().filter((row) => row.cls === 'ORPHANED');
    const now = Date.now();
    const views: OrphanedClaimView[] = [];
    for (const row of rows) {
      const claim: any = claimDatabaseService.getClaim(row.claimId);
      if (!claim) continue;
      views.push({
        ...row,
        statement: String(claim.statement || ''),
        source: String(claim.source || 'unknown'),
        status: String(claim.status || ''),
        maturity: String(claim.maturity || ''),
        ageDays: typeof claim.created_at === 'number' ? Math.floor((now - claim.created_at) / (24 * 60 * 60 * 1000)) : 0,
      });
    }
    // 古いもの・長く放置されたものから見せる
    return views.sort((a, b) => b.ageDays - a.ageDays).slice(0, Math.max(0, limit));
  }

  public logSummary(): ConnectivitySummary {
    const summary = this.summarize();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[P474] 知識の接続性: 全 ${summary.total} 件 / 接続あり ${summary.connected} / 弱い ${summary.weak} / 孤立 ${summary.orphaned}`,
      { orphanedBySource: summary.orphanedBySource },
    );
    return summary;
  }
}

export const knowledgeConnectivityService = new KnowledgeConnectivityService();
