import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { workingAgendaService } from './workingAgendaService';

export type DecompositionStatus = 'PROPOSED' | 'VALIDATED' | 'BLOCKED';
export interface TaskDecompositionStep {
  id: string;
  order: number;
  goal: string;
  requiredCapabilityIds: string[];
  evidenceNeeded: string[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}
export interface UnknownTaskDecomposition {
  decompositionId: string;
  task: string;
  steps: TaskDecompositionStep[];
  unknowns: string[];
  status: DecompositionStatus;
  confidence: number;
  reason: string;
  createdAt: number;
  updatedAt: number;
}

/** 第162章: 未知タスクを既存能力へ安全に分解する。能力を勝手に発明・実装せず、未知部分を明示して検証へ送る。 */
class UnknownTaskDecompositionService {
  private readonly key = 'miki_unknown_task_decomposition_v1';
  private records: UnknownTaskDecomposition[] = [];
  private cycleCount = 0;
  private readonly MAX_DECOMPOSITIONS_PER_CYCLE = 2;

  constructor() { this.load(); }

  /** 暴走防止カウンタのリセット */
  public resetCycleBudget(): void {
    this.cycleCount = 0;
  }

  /**
   * 未知タスクを分解し、未知部分(unknowns)を既存の調査・宿題経路(Working Agenda)へ引き渡す。
   */
  public decomposeAndDispatch(task: string, maxDispatchUnknowns = 2): UnknownTaskDecomposition {
    const decomposition = this.decompose(task);
    if (decomposition.unknowns.length > 0) {
      const targets = decomposition.unknowns.slice(0, Math.max(1, maxDispatchUnknowns));
      try {
        workingAgendaService.addOrUpdateAgenda(
          `未知タスク調査: ${decomposition.task.slice(0, 40)}`,
          targets,
          [`分解ID: ${decomposition.decompositionId}`, `既存能力候補: ${decomposition.steps.flatMap(s => s.requiredCapabilityIds).join(', ') || 'なし'}`],
          0,
          'normal'
        );
        systemLogger.info('SELF_IMPROVEMENT', `📋 [UnknownTaskDecomposition] 調査経路(Working Agenda)へ引き渡し完了: ${targets.length}件 (${targets.join(', ')})`);
      } catch (e) {
        systemLogger.warn('SELF_IMPROVEMENT', `Working Agendaへの引き渡し失敗: ${String(e)}`);
      }
    }
    return decomposition;
  }

  decompose(task: string): UnknownTaskDecomposition {
    if (this.cycleCount >= this.MAX_DECOMPOSITIONS_PER_CYCLE) {
      systemLogger.warn('SELF_IMPROVEMENT', `[UnknownTaskDecomposition] サイクル上限(${this.MAX_DECOMPOSITIONS_PER_CYCLE}件)に達したため分解を抑制`);
      const fallbackId = `UTD-THROTTLED-${this.hash(task)}`;
      return {
        decompositionId: fallbackId,
        task,
        steps: [],
        unknowns: [task],
        status: 'BLOCKED',
        confidence: 0.2,
        reason: '1サイクルの分解上限に達したため安全に保留しました。',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
    this.cycleCount++;

    const normalized = task.replace(/\s+/g, ' ').trim();
    const id = `UTD-${this.hash(normalized)}`;
    const existing = this.records.find(r => r.decompositionId === id);
    if (existing) return this.clone(existing);

    const parts = normalized.split(/(?:、|。|,|，|;|；|\s+(?:そして|また|次に|その後)\s+)/).map(s => s.trim()).filter(Boolean);
    const seeds = parts.length > 1 ? parts : [normalized];
    const steps = seeds.slice(0, 8).map((goal, index) => {
      const capabilities = this.inferCapabilities(goal);
      return {
        id: `UTDSTEP-${this.hash(`${id}|${index}|${goal}`)}`,
        order: index + 1,
        goal,
        requiredCapabilityIds: capabilities,
        evidenceNeeded: capabilities.length ? ['既存能力のVERIFIED状態', '実行環境との一致', 'Regressionまたは再現可能なテスト'] : ['原資料/公式資料', '小さな検証ケース'],
        risk: capabilities.length ? 'LOW' : 'MEDIUM',
      } as TaskDecompositionStep;
    });
    const unknowns = steps.filter(s => s.requiredCapabilityIds.length === 0).map(s => s.goal);
    const confidence = Math.max(0.2, Math.min(0.95, 0.9 - unknowns.length * 0.12));
    const record: UnknownTaskDecomposition = {
      decompositionId: id, task: normalized, steps, unknowns,
      status: unknowns.length === 0 ? 'PROPOSED' : 'PROPOSED', confidence,
      reason: unknowns.length ? '既存能力へ安全に対応付けられない部分を未知として分離しました。未知部分は研究・検証を通るまで実行能力として扱いません。' : '既存能力へ分解できる候補を作成しました。実行前に各能力の現在状態を再確認します。',
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    this.records.unshift(record); this.records = this.records.slice(0, 500); this.save();
    mikiUnifiedLearningContinuumService.observe({ domain: 'system', action: 'unknown_task_decomposed', input: normalized, outcome: unknowns.length ? 'FAILURE' : 'SUCCESS', verified: false, capabilityIds: steps.flatMap(s => s.requiredCapabilityIds), lesson: `${id}:unknown=${unknowns.length}` });
    systemLogger.info('SELF_IMPROVEMENT', `🧩 [UnknownTaskDecomposition] ${id}: steps=${steps.length}, unknown=${unknowns.length}`);
    return this.clone(record);
  }

  validate(id: string, stepResults: Array<{ stepId: string; passed: boolean }>): UnknownTaskDecomposition | undefined {
    const record = this.records.find(r => r.decompositionId === id); if (!record) return undefined;
    const map = new Map(stepResults.map(x => [x.stepId, x.passed]));
    const all = record.steps.length > 0 && record.steps.every(s => map.get(s.id) === true);
    record.status = all ? 'VALIDATED' : 'BLOCKED'; record.updatedAt = Date.now();
    record.reason = all ? '分解した全ステップの検証結果がPASSしました。' : '一つ以上のステップが未検証またはFAILのため、未知タスク全体の成功とは扱いません。';
    this.save(); return this.clone(record);
  }

  list(limit = 50) { return this.records.slice(0, Math.max(1, limit)).map(r => this.clone(r)); }
  get(id: string) { const r = this.records.find(x => x.decompositionId === id); return r ? this.clone(r) : undefined; }

  private inferCapabilities(text: string): string[] {
    const out: string[] = [];
    const add = (id: string) => { if (!out.includes(id)) out.push(id); };
    if (/ゲーム|RPG|戦闘|クエスト|採取|料理|装備/.test(text)) add('simple_rpg.planning');
    if (/VBA|Excel|マクロ|表計算/.test(text)) add('excel.vba.performance');
    if (/Android|Termux|端末|スマホ/.test(text)) add('android.environment');
    if (/実行|自動化|処理|スクリプト/.test(text)) add('general.deterministic.execution');
    if (/比較|判断|選定|分析/.test(text)) add('general.decision.analysis');
    return out;
  }
  private clone(r: UnknownTaskDecomposition): UnknownTaskDecomposition { return JSON.parse(JSON.stringify(r)); }
  private hash(raw: string) { let h=2166136261; for (let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);} return (h>>>0).toString(16).padStart(8,'0'); }
  private load(){ try { const raw=storageService.getItem(this.key); if(raw)this.records=JSON.parse(raw); } catch {} }
  private save(){ try { storageService.setItem(this.key, JSON.stringify(this.records)); } catch {} }
}
export const unknownTaskDecompositionService = new UnknownTaskDecompositionService();
