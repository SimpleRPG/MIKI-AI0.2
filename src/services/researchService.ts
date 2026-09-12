import { WebSearchResultItem } from '../types';
import { autonomousSearchService } from './autonomousSearchService';
import { claimDatabaseService } from './claimDatabaseService';
import { knowledgeGapService, KnowledgeGap } from './knowledgeGapService';
import { systemLogger } from './systemLogger';

export type ResearchRoute = 'LOCAL_CLAIM' | 'WEB_SEARCH' | 'EXECUTION_TEST' | 'CLOUD_AI';

export interface ResearchEvidence {
  title: string;
  snippet: string;
  url?: string;
  source: string;
  publishedDate?: string;
}

export interface ResearchResult {
  gap: KnowledgeGap;
  route: ResearchRoute;
  resolved: boolean;
  summary?: string;
  evidence: ResearchEvidence[];
  contradictions: ResearchEvidence[];
  registeredClaimIds: string[];
  reason: string;
}

/**
 * Knowledge Gapを実際の調査経路へ接続するサービス。
 * 重要な不変条件:
 * - 検索結果を「真実」として扱わない
 * - WebスニペットだけではSUPPORTED/DEVICE_VERIFIEDへ昇格させない
 * - Cloud AIはこのサービスから直接呼ばない（未知問題の最終的な開発ワーカー接続点を分離）
 */
export class ResearchService {
  private static instance: ResearchService;

  private constructor() {}

  public static getInstance(): ResearchService {
    if (!ResearchService.instance) ResearchService.instance = new ResearchService();
    return ResearchService.instance;
  }

  public chooseRoute(gap: KnowledgeGap): ResearchRoute {
    if (gap.type === 'UNKNOWN_CAPABILITY' || gap.type === 'WEAK_COMPONENT') {
      return 'WEB_SEARCH';
    }
    if (gap.type === 'CONTRADICTION' || gap.type === 'STALE_INFORMATION') {
      return 'WEB_SEARCH';
    }
    return 'WEB_SEARCH';
  }

  /**
   * 未解決Gapを1件調査する。現在の実装では既存のAutonomousSearchServiceを利用する。
   */
  public async researchGap(gapOrId: KnowledgeGap | string): Promise<ResearchResult> {
    const gap = typeof gapOrId === 'string' ? knowledgeGapService.getById(gapOrId) : gapOrId;
    if (!gap) {
      throw new Error('Knowledge Gapが見つかりません');
    }

    const route = this.chooseRoute(gap);
    knowledgeGapService.markResearching(gap.id);

    if (route !== 'WEB_SEARCH') {
      knowledgeGapService.markBlocked(gap.id, `現在の実装では調査経路 ${route} は未接続です`);
      return {
        gap,
        route,
        resolved: false,
        evidence: [],
        contradictions: [],
        registeredClaimIds: [],
        reason: `調査経路 ${route} はまだ実装されていません`,
      };
    }

    try {
      const search = await autonomousSearchService.executeSearch(gap.query, { maxResults: 4 });
      const evidence = this.toEvidence(search.results);

      if (evidence.length === 0) {
        knowledgeGapService.markBlocked(gap.id, '調査結果が取得できませんでした');
        return {
          gap: knowledgeGapService.getById(gap.id) || gap,
          route,
          resolved: false,
          summary: search.summary,
          evidence: [],
          contradictions: [],
          registeredClaimIds: [],
          reason: '検索結果がないため、結論を確定していません',
        };
      }

      // 検索結果は「発見された主張」としてUNVERIFIEDで保存するだけ。
      // 自己証明にならないようSUPPORTEDにはしない。
      const registeredClaimIds: string[] = [];
      for (const item of evidence.slice(0, 3)) {
        const statement = item.snippet.trim();
        if (statement.length < 15) continue;

        const claim = claimDatabaseService.registerClaim({
          statement,
          world: 'REAL',
          kind: 'FACT_CLAIM',
          status: 'UNVERIFIED',
          source: 'web_search',
          origin_source_id: item.url || item.title,
          maturity: 'DISCOVERED',
          self_provenance: 'INDEPENDENTLY_SUPPORTED',
        });
        registeredClaimIds.push(claim.claim_id);
      }

      // 「検索結果が得られた」ことと「問題が解決した」ことを分離する。
      // 複数の独立証拠や実験による確認がない限りGapはRESOLVEDにしない。
      const resolved = this.hasSufficientIndependentEvidence(evidence);
      if (resolved) {
        knowledgeGapService.markResolved(gap.id);
      } else {
        knowledgeGapService.markResearching(gap.id);
      }

      const updatedGap = knowledgeGapService.getById(gap.id) || gap;
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🔬 [Research] ${gap.id} route=${route} evidence=${evidence.length} resolved=${resolved}`
      );

      return {
        gap: updatedGap,
        route,
        resolved,
        summary: search.summary,
        evidence,
        contradictions: [],
        registeredClaimIds,
        reason: resolved
          ? '複数の独立した検索結果を取得しました。ただしClaim自体は検証状態を維持します。'
          : '情報は取得できましたが、検索結果だけでは十分な検証とはみなしていません',
      };
    } catch (error) {
      knowledgeGapService.markBlocked(gap.id, `調査中にエラー: ${String(error)}`);
      systemLogger.warn('SELF_IMPROVEMENT', `Research失敗 ${gap.id}: ${String(error)}`);
      return {
        gap: knowledgeGapService.getById(gap.id) || gap,
        route,
        resolved: false,
        evidence: [],
        contradictions: [],
        registeredClaimIds: [],
        reason: `調査中にエラーが発生しました: ${String(error)}`,
      };
    }
  }

  /**
   * 会話入力からGapを作り、必要なら即時調査する入口。
   */
  public async researchQuery(query: string, reason?: string): Promise<ResearchResult> {
    const detected = autonomousSearchService.detectNeedForSearch(query);
    const gap = knowledgeGapService.detect({
      query: detected.query || query,
      reason: reason || detected.reason || '自律調査が必要と判断',
      type: detected.category === 'spec_docs' || detected.category === 'factual'
        ? 'INSUFFICIENT_EVIDENCE'
        : undefined,
      priority: detected.category === 'explicit_request' ? 80 : 50,
    });
    return this.researchGap(gap);
  }

  private toEvidence(results: WebSearchResultItem[]): ResearchEvidence[] {
    return results
      .filter((result) => result && result.snippet && result.snippet.trim().length >= 10)
      .map((result) => ({
        title: result.title || '検索結果',
        snippet: result.snippet.trim(),
        url: result.url || undefined,
        source: result.source || 'unknown',
        publishedDate: result.publishedDate,
      }));
  }

  private hasSufficientIndependentEvidence(evidence: ResearchEvidence[]): boolean {
    const sources = new Set(
      evidence
        .map((item) => item.source.trim().toLowerCase())
        .filter(Boolean)
    );
    return evidence.length >= 2 && sources.size >= 2;
  }
}

export const researchService = ResearchService.getInstance();
