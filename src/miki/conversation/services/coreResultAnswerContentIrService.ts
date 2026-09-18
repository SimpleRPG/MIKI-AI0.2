import type { AnswerContentIR, AnswerSkeletonType } from '../../../types';
import type { CoreResult, CoreResultStatus } from '../../core/services/coreResultService';

export type EpistemicSectionKind = 'FACT' | 'ASSUMPTION' | 'UNVERIFIED' | 'PROPOSAL' | 'FAILURE_REASON';

export interface CoreResultExplanationPayload {
  summary?: string;
  facts?: string[];
  assumptions?: string[];
  unverified?: string[];
  proposals?: string[];
  failureReasons?: string[];
  nextActions?: string[];
  target?: string;
}

export interface CoreResultAnswerContent {
  ir: AnswerContentIR;
  skeleton: AnswerSkeletonType;
  sections: Array<{ kind: EpistemicSectionKind; items: string[] }>;
  sourceRequestId: string;
  sourceStatus: CoreResultStatus;
  completionClaimAllowed: boolean;
}

function cleanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
}

function asPayload(value: unknown): CoreResultExplanationPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    summary: typeof record.summary === 'string' ? record.summary.trim() : undefined,
    facts: cleanItems(record.facts),
    assumptions: cleanItems(record.assumptions),
    unverified: cleanItems(record.unverified),
    proposals: cleanItems(record.proposals),
    failureReasons: cleanItems(record.failureReasons),
    nextActions: cleanItems(record.nextActions),
    target: typeof record.target === 'string' ? record.target.trim() : undefined,
  };
}

function statusSummary(status: CoreResultStatus): string {
  const summaries: Record<CoreResultStatus, string> = {
    accepted: '要求を受け付けました。',
    processing: '処理を進めています。',
    waiting: '必要な入力または外部結果を待っています。',
    completed: 'coreが処理完了を確定しました。',
    failed: '処理は失敗しました。',
    blocked: '処理は停止条件によりブロックされています。',
    rejected: '要求は実行条件を満たさないため拒否されました。',
    inconclusive: '現時点の情報では結論を確定できません。',
  };
  return summaries[status];
}

function certaintyFor(status: CoreResultStatus, payload: CoreResultExplanationPayload): AnswerContentIR['certainty'] {
  if (status === 'inconclusive' || payload.unverified?.length) return 'UNKNOWN';
  if (payload.assumptions?.length) return 'HYPOTHETICAL';
  if (status === 'completed' || status === 'failed' || status === 'blocked' || status === 'rejected') return 'CERTAIN';
  return 'CONDITIONAL';
}

function skeletonFor(status: CoreResultStatus): AnswerSkeletonType {
  if (status === 'completed') return 'TASK_COMPLETION';
  if (status === 'inconclusive') return 'UNKNOWN_INVESTIGATION';
  return 'GENERAL_ANSWER';
}

export class CoreResultAnswerContentIrService {
  public convert(coreResult: CoreResult): CoreResultAnswerContent {
    const payload = asPayload(coreResult.result);
    const facts = cleanItems(payload.facts);
    const assumptions = cleanItems(payload.assumptions);
    const unverified = cleanItems(payload.unverified);
    const proposals = cleanItems(payload.proposals);
    const failureReasons = cleanItems(payload.failureReasons);
    if (coreResult.error?.trim()) failureReasons.push(coreResult.error.trim());

    const completionClaimAllowed = coreResult.status === 'completed';
    const conclusion = payload.summary || statusSummary(coreResult.status);
    const reasons = [
      ...facts.map(item => `確認済み: ${item}`),
      ...assumptions.map(item => `推測: ${item}`),
      ...unverified.map(item => `未確認: ${item}`),
      ...failureReasons.map(item => `失敗理由: ${item}`),
    ];
    const nextActions = cleanItems(payload.nextActions);
    if (nextActions.length === 0 && proposals.length > 0) nextActions.push(...proposals.map(item => `提案: ${item}`));

    const sections = [
      { kind: 'FACT' as const, items: facts },
      { kind: 'ASSUMPTION' as const, items: assumptions },
      { kind: 'UNVERIFIED' as const, items: unverified },
      { kind: 'PROPOSAL' as const, items: proposals },
      { kind: 'FAILURE_REASON' as const, items: failureReasons },
    ].filter(section => section.items.length > 0);

    return {
      ir: {
        ir_id: `core-result-${coreResult.requestId}-${coreResult.updatedAt}`,
        conclusion,
        reasons,
        conditions: completionClaimAllowed ? [] : ['完了という表現はcoreのstatusがcompletedの場合にだけ使用する'],
        exceptions: unverified,
        certainty: certaintyFor(coreResult.status, payload),
        target: payload.target || coreResult.requestId,
        next_actions: nextActions,
        detail_level: reasons.length + nextActions.length > 6 ? 'DETAILED' : 'STANDARD',
        interaction_mode: coreResult.status === 'failed' || coreResult.status === 'blocked' || coreResult.status === 'rejected' ? 'TROUBLESHOOTING' : 'NORMAL',
        world_scope: assumptions.length > 0 ? 'HYPOTHETICAL' : unverified.length > 0 ? 'UNKNOWN_CONTEXT' : 'REAL',
        strategy: nextActions.length > 0 ? 'EXPLAIN' : 'SHORT_ACK',
      },
      skeleton: skeletonFor(coreResult.status),
      sections,
      sourceRequestId: coreResult.requestId,
      sourceStatus: coreResult.status,
      completionClaimAllowed,
    };
  }
}

export const coreResultAnswerContentIrService = new CoreResultAnswerContentIrService();
