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

const LEDGER_KEY = 'miki_code_drill_ledger_v1';

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
