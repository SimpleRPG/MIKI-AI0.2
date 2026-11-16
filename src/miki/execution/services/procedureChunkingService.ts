import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { automationStudioService } from './automationStudioService';

export interface ProcedureObservation {
  goal: string;
  actions: string[];
  at: number;
}

const OBS_KEY = 'miki_procedure_observations_v1';
const CHUNK_KEY = 'miki_procedure_chunks_v1';
const MAX_OBSERVATIONS = 200;
const MAX_STEPS = 20;

/**
 * P903（ブレイクスルー④ 手続きの塊化 v1）: 繰り返される手順の
 * 並びを検出して、1 個のワークフロー候補に圧縮する。
 *
 * 観測は action 名の並びだけ（入力データは持たない）。3 回以上
 * 現れる長さ 3 以上の連続部分列を見つけたら、automationStudio
 * へワークフロー候補（OBSERVED）として登録する。昇格と再利用は
 * 既存のライフサイクル（仮想再生→確認→STABLE）に任せ、ここでは
 * 勝手に実行しない。
 */
class ProcedureChunkingService {
  private loadObservations(): ProcedureObservation[] {
    try {
      const parsed = JSON.parse(storageService.getItem(OBS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private saveObservations(items: ProcedureObservation[]): void {
    try { storageService.setItem(OBS_KEY, JSON.stringify(items.slice(-MAX_OBSERVATIONS))); } catch { /* 台帳は補助経路 */ }
  }

  private loadChunked(): string[] {
    try {
      const parsed = JSON.parse(storageService.getItem(CHUNK_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private saveChunked(items: string[]): void {
    try { storageService.setItem(CHUNK_KEY, JSON.stringify(items.slice(-200))); } catch { /* 台帳は補助経路 */ }
  }

  /** 手順の実行を観測として記録する（action 名の並びだけ）。 */
  public observeProcedure(goal: string, actions: string[]): void {
    try {
      const clean = (actions || []).map((a) => String(a || '').trim()).filter(Boolean).slice(0, MAX_STEPS);
      if (clean.length < 2) return;
      const items = this.loadObservations();
      items.push({ goal: String(goal || '手順'), actions: clean, at: Date.now() });
      this.saveObservations(items);
    } catch { /* 観測は補助経路 */ }
  }

  public listObservations(): ProcedureObservation[] {
    return this.loadObservations();
  }

  /**
   * 繰り返される部分列を探す。1 回の観測の中では同じ部分列を
   * 1 回と数える。候補は「回数 desc → 長さ desc」で並べる。
   */
  public findRepeatedSubsequences(minOccurrences = 3, minLength = 3): Array<{ actions: string[]; count: number; goal: string }> {
    const counts = new Map<string, { actions: string[]; count: number; goals: Map<string, number> }>();
    for (const obs of this.loadObservations()) {
      const seenInObs = new Set<string>();
      const steps = obs.actions;
      for (let start = 0; start < steps.length; start++) {
        for (let len = minLength; start + len <= steps.length; len++) {
          const sub = steps.slice(start, start + len);
          const sig = sub.join('>');
          if (seenInObs.has(sig)) continue;
          seenInObs.add(sig);
          const entry = counts.get(sig) || { actions: sub, count: 0, goals: new Map<string, number>() };
          entry.count++;
          entry.goals.set(obs.goal, (entry.goals.get(obs.goal) || 0) + 1);
          counts.set(sig, entry);
        }
      }
    }
    return [...counts.values()]
      .filter((e) => e.count >= minOccurrences)
      .map((e) => ({
        actions: e.actions,
        count: e.count,
        goal: [...e.goals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '定型手順',
      }))
      .sort((a, b) => b.count - a.count || b.actions.length - a.actions.length);
  }

  /**
   * 繰り返し部分列を最大 limit 件まで塊として登録する。
   * 既に塊化した署名と、同じ手順の既存ワークフローは避ける。
   * 塊化済みの手順の「内側の部分列」も避ける（同じ手順から
   * 短い塊が際限なく切り出されるのを防ぐ）。
   */
  public detectAndChunk(limit = 1): Array<{ actions: string[]; count: number }> {
    const chunked = this.loadChunked();
    const chunkedSet = new Set(chunked);
    const existingWorkflows = automationStudioService.list();
    const existingSigs = new Set(existingWorkflows.map((w) => (w.steps || []).map((s) => s.action).join('>')));
    const bigSequences: string[][] = [
      ...chunked.map((s) => s.split('>')),
      ...existingWorkflows.map((w) => (w.steps || []).map((s) => s.action)),
    ];
    const isContained = (small: string[]): boolean => bigSequences.some((big) => {
      if (big.length < small.length) return false;
      for (let i = 0; i + small.length <= big.length; i++) {
        if (small.every((a, j) => big[i + j] === a)) return true;
      }
      return false;
    });
    const created: Array<{ actions: string[]; count: number }> = [];
    for (const cand of this.findRepeatedSubsequences(3, 3)) {
      if (created.length >= limit) break;
      const sig = cand.actions.join('>');
      if (chunkedSet.has(sig) || existingSigs.has(sig)) continue;
      if (isContained(cand.actions)) continue;
      try {
        automationStudioService.observe(
          cand.goal,
          cand.actions.map((action, i) => ({ order: i + 1, action, failureConditions: [] as string[], reversible: false })),
          [],
        );
        chunked.push(sig);
        chunkedSet.add(sig);
        bigSequences.push(cand.actions);
        created.push({ actions: cand.actions, count: cand.count });
        systemLogger.info('SELF_IMPROVEMENT', `🧩 [手続きの塊化] 繰り返し手順を塊として登録しました: ${sig}（${cand.count}回観測）`);
      } catch { /* 1件の失敗で全体は止めない */ }
    }
    if (created.length > 0) this.saveChunked(chunked);
    return created;
  }
}

export const procedureChunkingService = new ProcedureChunkingService();
