import { taskBlackboardService } from './taskBlackboardService';
import { canonicalSha256 } from './canonicalSha256Service';

export type CoreTraceStage =
  | 'RUN_START'
  | 'CYCLE_START'
  | 'PLAN'
  | 'DISPATCH_START'
  | 'DISPATCH_RESULT'
  | 'REPLY_NORMALIZED'
  | 'REPLY_LEDGER'
  | 'ACTION_COMPLETED'
  | 'BLACKBOARD_WRITE'
  | 'REEVALUATION_INPUT'
  | 'COMPLETION_ASSESSMENT'
  | 'CYCLE_GUARD'
  | 'CORE_SYNTHESIS'
  | 'NO_PROGRESS'
  | 'ACCEPTANCE_EVIDENCE_MATRIX'
  | 'AUTONOMOUS_E2E_PROOF_SUITE'
  | 'CANARY_POST_REVIEW_VERIFICATION'
  | 'CANDIDATE_CONSTRAINT_VALIDATION'
  | 'CANDIDATE_GOVERNANCE_PREFLIGHT'
  | 'CANDIDATE_DEVELOPMENT_COMPLETION'
  | 'COMPLEX_CAPABILITY_CONTRACT_CHECK'
  | 'CUMULATIVE_REVALIDATION'
  | 'FINAL_RESIDUAL_SERVICE_INTEGRATION'
  | 'RESIDUAL_CAPABILITY_INFORMATION_FLOW'
  | 'REVIEW_MANIFEST_INCLUSION_GATE'
  | 'SELF_IMPROVEMENT_HANDOFF_AUDIT'
  | 'SERVICE_CONNECTIVITY_AUDIT_25'
  | 'WORKSPACE_TSC_ISOLATION_E2E'
  | 'CANDIDATE_AUTO_REBASE';

// P3039: トレース記録の発生源スリム化。読み手の棚卸し結果：
// coreTrace エントリのペイロードを読むプログラムは存在せず、
// UI ゲートウェイが読むのは value.cycle / value.stage だけ。
// それでも毎サイクルの DISPATCH_RESULT 等が domain 応答の全文を
// 複写し、台帳の増殖源になっていた（P3036 follow-up 2）。
// 方針：通常サイクルは集約だけを残す（スカラーはそのまま、
// 構造はダイジェスト＋大きさに置換）。全文を残すのは
// (1) そのタスクでその stage の初回、(2) 異常 stage
// （NO_PROGRESS / CYCLE_GUARD）、(3) ペイロードに失敗の兆候
// （error キー、passed/ok/accepted/verified/success=false、
// 失敗状態の status）がある場合だけ。
// cognitiveState DECISION は対象外：再開時検証が値全体の
// ハッシュで照合するため、1フィールドも削れない（自己ハッシュ
// 済み記録）。そちらは P3036 の圧縮が尾を bound する。
const ALWAYS_FULL_STAGES: ReadonlySet<CoreTraceStage> = new Set([
  'NO_PROGRESS',
  'CYCLE_GUARD',
]);
const FALSE_FLAG_KEYS: ReadonlySet<string> = new Set([
  'passed',
  'ok',
  'accepted',
  'verified',
  'success',
  'writesucceeded',
  'allpassed',
  'checkspassed',
]);
const STATUS_KEYS: ReadonlySet<string> = new Set([
  'status',
  'normalizedstatus',
  'resultkind',
  'outcome',
]);
const FAILURE_STATUS_PATTERN = /FAIL|ERROR|REJECT|DENIED|CONFLICT|TIMEOUT|INVALID/i;
const SUMMARY_BYTE_BUDGET = 1024;

function hasFailureSignal(
  value: unknown,
  depth: number,
  budget: { remaining: number }
): boolean {
  if (depth > 4 || budget.remaining <= 0) return false;
  if (Array.isArray(value)) {
    for (const item of value) {
      budget.remaining -= 1;
      if (hasFailureSignal(item, depth + 1, budget)) return true;
    }
    return false;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      budget.remaining -= 1;
      const lower = key.toLowerCase();
      if (
        lower.includes('error') &&
        item !== null &&
        item !== undefined &&
        item !== '' &&
        item !== false &&
        !(Array.isArray(item) && item.length === 0)
      ) {
        return true;
      }
      if (FALSE_FLAG_KEYS.has(lower) && item === false) return true;
      if (
        STATUS_KEYS.has(lower) &&
        typeof item === 'string' &&
        FAILURE_STATUS_PATTERN.test(item)
      ) {
        return true;
      }
      if (hasFailureSignal(item, depth + 1, budget)) return true;
    }
  }
  return false;
}

function summarizeValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.length <= 128
      ? value
      : {
          __digest: canonicalSha256(value),
          __chars: value.length,
          __head: value.slice(0, 64),
        };
  }
  if (Array.isArray(value)) {
    const allScalar = value.every(
      item =>
        item === null ||
        typeof item === 'number' ||
        typeof item === 'boolean' ||
        (typeof item === 'string' && item.length <= 64)
    );
    if (allScalar && value.length <= 8) return [...value];
    return { __digest: canonicalSha256(value), __arrayLength: value.length };
  }
  if (typeof value === 'object') {
    if (depth >= 3) {
      return {
        __digest: canonicalSha256(value),
        __keys: Object.keys(value as Record<string, unknown>).slice(0, 24),
      };
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = summarizeValue(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

function summarizePayload(sanitized: Record<string, unknown>): Record<string, unknown> {
  const summarized = summarizeValue(sanitized, 0) as Record<string, unknown>;
  if (JSON.stringify(summarized).length <= SUMMARY_BYTE_BUDGET) return summarized;
  // 深さ制限だけではスカラー葉の多い構造が残るため、上限を超えたら
  // トップレベルのキーごとにダイジェストへ落とす（スカラーは保持）。
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(sanitized)) {
    out[key] =
      item === null ||
      typeof item === 'number' ||
      typeof item === 'boolean' ||
      (typeof item === 'string' && item.length <= 128)
        ? item
        : {
            __digest: canonicalSha256(item),
            __bytes: JSON.stringify(item)?.length ?? 0,
          };
  }
  return out;
}

class CoreExecutionTraceService {
  // タスクごとに「全文を記録済みの stage」を覚える（初回は全文）。
  // 上限を超えたら古いタスクから落とす。落ちた先で初回扱いに
  // 戻っても害は全文が1件増えるだけ。
  private fullDetailStagesByTask = new Map<string, Set<string>>();

  record(
    taskId: string,
    cycle: number,
    stage: CoreTraceStage,
    data: Record<string, unknown> = {}
  ): void {
    const sanitized = thissanitize(data);
    let seen = this.fullDetailStagesByTask.get(taskId);
    if (!seen) {
      if (this.fullDetailStagesByTask.size >= 512) {
        const oldest = this.fullDetailStagesByTask.keys().next().value;
        if (oldest !== undefined) this.fullDetailStagesByTask.delete(oldest);
      }
      seen = new Set<string>();
      this.fullDetailStagesByTask.set(taskId, seen);
    }
    const firstOccurrence = !seen.has(stage);
    seen.add(stage);
    const keepFull =
      firstOccurrence ||
      ALWAYS_FULL_STAGES.has(stage) ||
      hasFailureSignal(sanitized, 0, { remaining: 400 });
    if (keepFull) {
      taskBlackboardService.append(
        taskId,
        'CHECKPOINT',
        'core',
        `coreTrace:${cycle}:${stage}`,
        {
          schemaVersion: 1,
          traceVersion: 1,
          taskId,
          cycle,
          stage,
          recordedAt: Date.now(),
          ...sanitized,
        }
      );
      return;
    }
    taskBlackboardService.append(
      taskId,
      'CHECKPOINT',
      'core',
      `coreTrace:${cycle}:${stage}`,
      {
        schemaVersion: 1,
        traceVersion: 1,
        taskId,
        cycle,
        stage,
        recordedAt: Date.now(),
        detailLevel: 'SUMMARY',
        payloadDigest: canonicalSha256(sanitized),
        payloadBytes: JSON.stringify(sanitized).length,
        ...summarizePayload(sanitized),
      }
    );
  }
}

function thissanitize(
  value: Record<string, unknown>
): Record<string, unknown> {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, item) => {
        if (typeof item === 'bigint') return String(item);
        if (item instanceof Error) {
          return {
            name: item.name,
            message: item.message,
            stack: item.stack,
          };
        }
        return item;
      })
    ) as Record<string, unknown>;
  } catch {
    return {
      serializationFailed: true,
      keys: Object.keys(value),
    };
  }
}

export const coreExecutionTraceService =
  new CoreExecutionTraceService();
