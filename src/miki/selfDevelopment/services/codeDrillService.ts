import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import {
  pureCodeExecutionService,
  type PureExecutionCase,
  type PureExecutionEvidence,
} from './pureCodeExecutionService';

/*
 * P1095: コードドリルの運転手。
 * 課題（契約＋受け入れケース）を受け取り、候補の実装を実行器（P1094）で
 * 判定し、結果を台帳に残す。台帳は描画ドリルの補正ファイルにあたる
 * 「彼女のコード側の癖・到達点の記録」で、課題ごとの試行回数・最良結果・
 * 解決済みかどうかと、解決に使った実装のハッシュを持つ。
 *
 * 候補の出し方（合成・供給・教師）はこの運転手の関知しないところ。
 * ここは「出された候補を正直に測って記録する」だけを担当する。
 */

export interface CodeDrillTask {
  taskId: string;
  title: string;
  entryPoint: string;
  cases: PureExecutionCase[];
}

export interface CodeDrillTaskRecord {
  taskId: string;
  title: string;
  attempts: number;
  solved: boolean;
  bestPassedCount: number;
  totalCases: number;
  solvedImplementationHash?: string;
  lastFailureReasons: string[];
  updatedAt: number;
}

export interface CodeDrillAttemptResult {
  record: CodeDrillTaskRecord;
  evidence: PureExecutionEvidence;
}

/*
 * P2014: セッション文脈の記録。式の課題生成はセッション開始時点の
 * 登録部品スナップショット（extraParts）に依存するため、後から課題を
 * 再生成して候補を検証する側（梯子ドライバー）が、生成時と寸分違わぬ
 * 文脈を引けるよう、セッションの実スナップショットを台帳と同じ保存層へ
 * 残す。記録は名前＋arity だけ（評価器は成果物正本から解決する）。
 * 記録できなくてもセッション自体は落とさない。
 */
export interface CodeDrillSessionContext {
  seed: number;
  /** セッション終了時刻（候補の saved_at と対応づけて引くための印） */
  at: number;
  extraParts: Array<{ name: string; arity: number }>;
}

const LEDGER_KEY = 'miki_code_drill_ledger_v1';
const SESSION_CONTEXTS_KEY = 'miki_drill_session_contexts_v1';
const SESSION_CONTEXTS_MAX = 300;

class CodeDrillService {
  private loadLedger(): Record<string, CodeDrillTaskRecord> {
    return storageService.getJson<Record<string, CodeDrillTaskRecord>>(LEDGER_KEY, {});
  }

  private saveLedger(ledger: Record<string, CodeDrillTaskRecord>): void {
    storageService.setItem(LEDGER_KEY, JSON.stringify(ledger));
  }

  public runAttempt(task: CodeDrillTask, implementation: string): CodeDrillAttemptResult {
    const evidence = pureCodeExecutionService.execute(implementation, task.entryPoint, task.cases);
    const ledger = this.loadLedger();
    const prev = ledger[task.taskId];
    const record: CodeDrillTaskRecord = {
      taskId: task.taskId,
      title: task.title,
      attempts: (prev?.attempts ?? 0) + 1,
      solved: (prev?.solved ?? false) || evidence.passed,
      bestPassedCount: Math.max(prev?.bestPassedCount ?? 0, evidence.passedCount),
      totalCases: task.cases.length,
      solvedImplementationHash:
        prev?.solvedImplementationHash ?? (evidence.passed ? canonicalSha256(implementation) : undefined),
      lastFailureReasons: evidence.passed ? [] : evidence.failureReasons,
      updatedAt: Date.now(),
    };
    ledger[task.taskId] = record;
    this.saveLedger(ledger);
    return { record, evidence };
  }

  /** P2014: セッションの実スナップショット（解決後の名前＋arity）を文脈として残す。 */
  public recordSessionContext(seed: number, extraParts: Array<{ name: string; arity: number }>): void {
    try {
      const list = this.getSessionContexts();
      list.push({
        seed,
        at: Date.now(),
        extraParts: (extraParts ?? []).map((p) => ({ name: p.name, arity: p.arity })),
      });
      storageService.setItem(SESSION_CONTEXTS_KEY, JSON.stringify(list.slice(-SESSION_CONTEXTS_MAX)));
    } catch {
      // 文脈の記録失敗でセッション結果は落とさない
    }
  }

  public getSessionContexts(): CodeDrillSessionContext[] {
    try {
      const raw = storageService.getJson<CodeDrillSessionContext[]>(SESSION_CONTEXTS_KEY, []);
      if (!Array.isArray(raw)) return [];
      return raw.filter((c) => c && typeof c.seed === 'number' && typeof c.at === 'number' && Array.isArray(c.extraParts));
    } catch {
      return [];
    }
  }

  public getRecord(taskId: string): CodeDrillTaskRecord | undefined {
    return this.loadLedger()[taskId];
  }

  public getLedger(): CodeDrillTaskRecord[] {
    return Object.values(this.loadLedger()).sort((a, b) => a.taskId.localeCompare(b.taskId));
  }

  public resetLedger(): void {
    storageService.setItem(LEDGER_KEY, JSON.stringify({}));
  }
}

export const codeDrillService = new CodeDrillService();
