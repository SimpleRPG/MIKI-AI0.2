import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { capabilityGapService } from './capabilityGapService';
import { simpleRpgCapabilityLearningService } from './simpleRpgCapabilityLearningService';
import { selfCodeArchitectService } from './selfCodeArchitectService';

const STATE_KEY = 'miki_autonomous_growth_governor_v1';

export interface AutonomousGrowthCycleResult {
  ok: boolean;
  cycleId: string;
  startedAt: number;
  finishedAt: number;
  sourceChanged: boolean;
  audits: { simpleRpg: ReturnType<typeof simpleRpgCapabilityLearningService.audit>; selfCode: { passed: boolean; complianceScore: number } };
  gapsObserved: number;
  actions: string[];
  blockedActions: string[];
}

interface GovernorState { lastCycleAt: number; lastCycleId: string; cycleCount: number; }

function stableId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${prefix}_${(h >>> 0).toString(16)}`;
}

/**
 * 決定論的な自律成長司令塔。
 * 「観測→監査→候補化→検証→採用/停止」を自動反復する。
 * 生成モデルや動的コード実行を成長経路に置かない。
 */
export class AutonomousGrowthGovernorService {
  private state: GovernorState = { lastCycleAt: 0, lastCycleId: '', cycleCount: 0 };
  private running = false;

  constructor() { this.load(); }

  private load() {
    try { const raw = storageService.getItem(STATE_KEY); if (raw) this.state = { ...this.state, ...JSON.parse(raw) }; } catch {}
  }
  private save() { try { storageService.setItem(STATE_KEY, JSON.stringify(this.state)); } catch {} }

  public getState() { return { ...this.state }; }

  public async runCycle(options?: { allowSelfCodeImprovement?: boolean; signal?: AbortSignal }): Promise<AutonomousGrowthCycleResult> {
    if (this.running) throw new Error('自律成長サイクルは既に実行中です');
    this.running = true;
    const startedAt = Date.now();
    const cycleId = stableId('growth', `${this.state.cycleCount + 1}|${startedAt}`);
    const actions: string[] = [];
    const blockedActions: string[] = [];
    try {
      if (options?.signal?.aborted) throw new Error('中断要求');

      // 1) 現行ゲームを観測・再監査。更新検知時は旧能力をそのまま信用しない。
      const simpleRpg = simpleRpgCapabilityLearningService.audit();
      if (simpleRpg.sourceChanged) actions.push('SimpleRPG source fingerprint changed: capability re-audit completed');
      actions.push(`SimpleRPG audit pass=${simpleRpg.passed.length} fail=${simpleRpg.failed.length}`);

      if (options?.signal?.aborted) throw new Error('中断要求');

      // 2) 既存の能力不足を観測。未解決を次サイクルの学習対象として保持する。
      const gaps = capabilityGapService.getAllGaps().filter(g => g.status !== 'RESOLVED');
      if (gaps.length) actions.push(`observed ${gaps.length} unresolved capability gaps`);

      // 3) 仕様適合監査。安全条件を満たさない場合はコード改善を自動適用しない。
      const audit = selfCodeArchitectService.runSelfCodeAudit();
      const selfCode = { passed: audit.complianceScore >= 80, complianceScore: audit.complianceScore };
      actions.push(`self-code audit score=${audit.complianceScore}`);

      if (options?.signal?.aborted) throw new Error('中断要求');

      // 4) 自己コード改善は既存の不変条件・シミュレーション・適用ゲートを再利用する。
      //    ただし明示的に許可されたバックグラウンド経路だけで実行する。
      if (options?.allowSelfCodeImprovement && selfCode.passed) {
        try {
          const result = await selfCodeArchitectService.runAutonomousImprovementCycle();
          if (result.success) actions.push(`self-code improvement applied: chapter ${result.targetChapter.chapterNumber}`);
          else blockedActions.push(`self-code improvement not applied: ${result.summary}`);
        } catch (e: any) {
          blockedActions.push(`self-code improvement error: ${e?.message || 'unknown'}`);
        }
      } else {
        blockedActions.push('self-code improvement held: explicit background permission or audit threshold missing');
      }

      this.state = { lastCycleAt: Date.now(), lastCycleId: cycleId, cycleCount: this.state.cycleCount + 1 };
      this.save();
      systemLogger.info('SELF_IMPROVEMENT', `🧠 [AutonomousGrowthGovernor] cycle=${cycleId} completed`);
      return { ok: blockedActions.length === 0, cycleId, startedAt, finishedAt: Date.now(), sourceChanged: simpleRpg.sourceChanged, audits: { simpleRpg, selfCode }, gapsObserved: gaps.length, actions, blockedActions };
    } finally { this.running = false; }
  }
}

export const autonomousGrowthGovernorService = new AutonomousGrowthGovernorService();
