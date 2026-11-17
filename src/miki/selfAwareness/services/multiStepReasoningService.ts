import { storageService } from '../../../services/storageService';
import { worldModelGraphService } from './worldModelGraphService';

/**
 * P922: 多段推論の深さ・第1段（能力リスト第2項）。
 *
 * 世界モデルの予測（worldModelGraphService.predict）は実装されて
 * いたが、会話からも計画からも呼ばれておらず棚に眠っていた。
 * 本サービスが「最大3段の先読み」を担う：到達先ごとに最も
 * 確信度の高い道を残し（BFS の先着で良い道が埋もれる問題の
 * 吸収）、最も深くまで読めた連鎖を代表として返す。
 * 返るのはモデルの予測であり、事実ではない。呼び出し側は
 * 予測として提示すること（仮の関係を含む場合はその明示も）。
 */

const STORAGE_KEY = 'miki_multi_step_reasoning_v1';

export interface LookAheadStep {
  entity: string;
  path: string[];
  confidence: number;
  provisional: boolean;
  depth: number;
}

export interface LookAheadResult {
  entity: string;
  steps: LookAheadStep[];
  bestChain: LookAheadStep | null;
}

interface ReasoningStats {
  lookAheads: number;
  deepestChain: number;
}

class MultiStepReasoningService {
  private static instance: MultiStepReasoningService;
  private constructor() {}
  public static getInstance(): MultiStepReasoningService {
    if (!this.instance) this.instance = new MultiStepReasoningService();
    return this.instance;
  }

  private loadStats(): ReasoningStats {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        lookAheads: Number(parsed?.lookAheads || 0),
        deepestChain: Number(parsed?.deepestChain || 0),
      };
    } catch { return { lookAheads: 0, deepestChain: 0 }; }
  }

  private saveStats(stats: ReasoningStats): void {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch { /* 統計は補助 */ }
  }

  /**
   * 起点から CAUSES / ENABLES を最大 maxDepth 段たどる。
   * 到達先ごとに最良の道だけを残し、確信度の高い順に返す。
   */
  public lookAhead(entityName: string, maxDepth = 3): LookAheadResult {
    const predictions = worldModelGraphService.predict(entityName, maxDepth);
    const bestByEntity = new Map<string, LookAheadStep>();
    for (const p of predictions) {
      const step: LookAheadStep = {
        entity: p.entity,
        path: p.path,
        confidence: p.confidence,
        provisional: p.provisional,
        depth: Math.max(0, p.path.length - 1),
      };
      const existing = bestByEntity.get(p.entity);
      if (!existing || step.confidence > existing.confidence) bestByEntity.set(p.entity, step);
    }
    const steps = [...bestByEntity.values()]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8);
    let bestChain: LookAheadStep | null = null;
    for (const step of steps) {
      if (!bestChain || step.depth > bestChain.depth
        || (step.depth === bestChain.depth && step.confidence > bestChain.confidence)) {
        bestChain = step;
      }
    }
    const stats = this.loadStats();
    stats.lookAheads += 1;
    if (bestChain && bestChain.depth > stats.deepestChain) stats.deepestChain = bestChain.depth;
    this.saveStats(stats);
    return { entity: entityName, steps, bestChain };
  }

  public summary(): ReasoningStats {
    return this.loadStats();
  }
}

export const multiStepReasoningService = MultiStepReasoningService.getInstance();
