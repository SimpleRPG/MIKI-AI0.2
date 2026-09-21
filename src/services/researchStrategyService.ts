import { storageService } from './storageService';
import { KnowledgeGapType } from './knowledgeGapService';

export type ResearchRoute = 'LOCAL_CLAIM' | 'WEB_SEARCH' | 'EXECUTION_TEST' | 'CLOUD_AI';

interface RouteStats {
  attempts: number;
  successes: number;
  totalDurationMs: number;
  lastUsedAt: number;
}

export interface ResearchStrategyDecision {
  route: ResearchRoute;
  reason: string;
  alternatives: ResearchRoute[];
}

/**
 * Research経路の選択と結果学習だけを担当する層。
 * 真偽判定・Claim昇格・実行権限は持たない。
 */
export class ResearchStrategyService {
  private static instance: ResearchStrategyService;
  private readonly storageKey = 'miki_research_strategy_v1';
  private stats: Record<string, RouteStats> = {};

  private constructor() { this.load(); }

  public static getInstance(): ResearchStrategyService {
    return this.instance || (this.instance = new ResearchStrategyService());
  }

  public chooseRoute(type: KnowledgeGapType, query: string, availableRoutes?: ResearchRoute[]): ResearchStrategyDecision {
    const routes = availableRoutes?.length ? [...availableRoutes] : this.defaultRoutes(type, query);
    if (!routes.length) {
      return { route: 'LOCAL_CLAIM', reason: '利用可能なResearch経路がありません。', alternatives: [] };
    }

    const ranked = routes
      .map(route => ({ route, score: this.score(type, route) }))
      .sort((a, b) => b.score - a.score);
    const selected = ranked[0].route;
    const stat = this.getRouteStats(type, selected);
    const reason = stat.attempts > 0
      ? `過去実績 ${stat.successes}/${stat.attempts} 成功、平均 ${Math.round(stat.totalDurationMs / stat.attempts)}ms を基に選択しました。`
      : `このKnowledge Gap種別の初期Research経路として ${selected} を選択しました。`;

    return {
      route: selected,
      reason,
      alternatives: ranked.slice(1).map(item => item.route),
    };
  }

  public recordOutcome(type: KnowledgeGapType, route: ResearchRoute, success: boolean, durationMs: number): void {
    const key = this.key(type, route);
    const current = this.stats[key] || { attempts: 0, successes: 0, totalDurationMs: 0, lastUsedAt: 0 };
    current.attempts += 1;
    if (success) current.successes += 1;
    current.totalDurationMs += Math.max(0, durationMs);
    current.lastUsedAt = Date.now();
    this.stats[key] = current;
    this.save();
  }

  public getStats(type?: KnowledgeGapType): Array<{ type: string; route: ResearchRoute; attempts: number; successes: number; averageDurationMs: number }> {
    return Object.entries(this.stats)
      .filter(([key]) => !type || key.startsWith(`${type}|`))
      .map(([key, value]) => {
        const [gapType, route] = key.split('|') as [string, ResearchRoute];
        return { type: gapType, route, attempts: value.attempts, successes: value.successes, averageDurationMs: value.attempts ? Math.round(value.totalDurationMs / value.attempts) : 0 };
      });
  }

  private defaultRoutes(type: KnowledgeGapType, query: string): ResearchRoute[] {
    // 現時点で実際に実行可能なResearch経路だけを優先候補にする。
    // EXECUTION_TEST/CLOUD_AIは権限境界を越えないため、対応入口が接続されるまで自動選択しない。
    if (/端末|実機|component|部品|実装|コード/i.test(query) || type === 'WEAK_COMPONENT' || type === 'UNKNOWN_CAPABILITY') {
      return ['WEB_SEARCH', 'LOCAL_CLAIM'];
    }
    if (type === 'CONTRADICTION' || type === 'STALE_INFORMATION' || type === 'INSUFFICIENT_EVIDENCE' || type === 'UNKNOWN_TERM') {
      return ['WEB_SEARCH', 'LOCAL_CLAIM'];
    }
    return ['WEB_SEARCH'];
  }

  private score(type: KnowledgeGapType, route: ResearchRoute): number {
    const stat = this.getRouteStats(type, route);
    const successRate = stat.attempts ? stat.successes / stat.attempts : 0;
    const explorationBonus = stat.attempts === 0 ? 0.15 : 0;
    const speedBonus = stat.attempts ? 1 / (1 + stat.totalDurationMs / stat.attempts / 5000) : 0;
    const defaultBonus = route === 'WEB_SEARCH' ? 0.2 : route === 'LOCAL_CLAIM' ? 0.05 : -0.5;
    return successRate * 2 + speedBonus + explorationBonus + defaultBonus;
  }

  private getRouteStats(type: KnowledgeGapType, route: ResearchRoute): RouteStats {
    return this.stats[this.key(type, route)] || { attempts: 0, successes: 0, totalDurationMs: 0, lastUsedAt: 0 };
  }

  private key(type: KnowledgeGapType, route: ResearchRoute): string { return `${type}|${route}`; }

  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (raw) this.stats = JSON.parse(raw) || {};
    } catch { this.stats = {}; }
  }

  private save(): void {
    try { storageService.setItem(this.storageKey, JSON.stringify(this.stats)); } catch { /* learning is non-authoritative */ }
  }
}

export const researchStrategyService = ResearchStrategyService.getInstance();
