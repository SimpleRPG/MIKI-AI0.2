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

function collectStringIds(value: unknown, pattern: RegExp): string[] {
  const found = new Set<string>();
  const walk = (item: unknown, depth: number): void => {
    if (depth > 5 || item === null || item === undefined) return;
    if (Array.isArray(item)) { for (const child of item) walk(child, depth + 1); return; }
    if (typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      if (pattern.test(key)) {
        if (typeof child === 'string' && child.trim()) found.add(child.trim());
        if (Array.isArray(child)) for (const id of child) if (typeof id === 'string' && id.trim()) found.add(id.trim());
      }
      walk(child, depth + 1);
    }
  };
  walk(value, 0);
  return [...found].sort();
}

function extractLineage(payload: CoreResultExplanationPayload): { claimIds: string[]; evidenceIds: string[]; verificationOutcomes: string[] } {
  return {
    claimIds: collectStringIds(payload, /^claim(ids?|_refs?)$/i),
    evidenceIds: collectStringIds(payload, /^evidence(ids?|_refs?)$/i),
    verificationOutcomes: collectStringIds(payload, /verification(outcome|status|result)/i),
  };
}

function buildFactProvenance(payload: Record<string, unknown>, global: { claimIds: string[]; evidenceIds: string[]; verificationOutcomes: string[] }, facts: string[]): Array<{ text: string; claimIds: string[]; evidenceIds: string[]; verificationOutcomes: string[] }> {
  const raw = payload.factProvenance;
  if (Array.isArray(raw)) {
    const byText = new Map<string, { text: string; claimIds: string[]; evidenceIds: string[]; verificationOutcomes: string[] }>();
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const text = typeof row.text === 'string' ? row.text.trim() : '';
      if (!text) continue;
      const claimIds = Array.isArray(row.claimIds) ? row.claimIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()) : [];
      const evidenceIds = Array.isArray(row.evidenceIds) ? row.evidenceIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()) : [];
      const verificationOutcomes = Array.isArray(row.verificationOutcomes) ? row.verificationOutcomes.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map(x => x.trim()) : [];
      byText.set(text, { text, claimIds, evidenceIds, verificationOutcomes });
    }
    if (byText.size) return facts.map(text => byText.get(text) || { text, ...global });
  }
  return facts.map(text => ({ text, ...global }));
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
    const rawFacts = cleanItems(payload.facts);
    const assumptions = cleanItems(payload.assumptions);
    const lineage = extractLineage(payload);
    const factProvenance = buildFactProvenance(coreResult.result && typeof coreResult.result === 'object' && !Array.isArray(coreResult.result) ? coreResult.result as Record<string, unknown> : {}, lineage, rawFacts);
    const unsupportedFacts = factProvenance.filter(item => item.claimIds.length === 0 || item.evidenceIds.length === 0);
    const facts = rawFacts.filter(fact => !unsupportedFacts.some(item => item.text === fact));
    const tracedUnverified = unsupportedFacts.map(item => `根拠未追跡: ${item.text}`);
    const unverified = [...cleanItems(payload.unverified), ...tracedUnverified];
    const proposals = cleanItems(payload.proposals);
    const failureReasons = cleanItems(payload.failureReasons);
    if (coreResult.error?.trim()) failureReasons.push(coreResult.error.trim());

    const completionClaimAllowed = coreResult.status === 'completed' && unsupportedFacts.length === 0;
    const conclusion = payload.summary || statusSummary(coreResult.status);
    const reasons = [
      ...facts.map(item => `確認済み: ${item}`),
      ...assumptions.map(item => `推測: ${item}`),
      ...unverified.map(item => `未確認: ${item}`),
      ...failureReasons.map(item => `失敗理由: ${item}`),
    ];
    const nextActions = cleanItems(payload.nextActions);
    if (nextActions.length === 0 && proposals.length > 0) nextActions.push(...proposals.map(item => `提案: ${item}`));

    const provenance = [
      { sentenceId: `sent-${coreResult.requestId}-conclusion`, kind: 'CONCLUSION' as const, text: conclusion, claimIds: lineage.claimIds, evidenceIds: lineage.evidenceIds, verificationOutcomes: lineage.verificationOutcomes, verified: lineage.claimIds.length > 0 && lineage.evidenceIds.length > 0, reason: lineage.claimIds.length > 0 && lineage.evidenceIds.length > 0 ? 'claim/evidence lineage present' : 'operational conclusion or missing claim/evidence lineage' },
      ...factProvenance.map((item, index) => ({ sentenceId: `sent-${coreResult.requestId}-fact-${index + 1}`, kind: 'REASON' as const, text: item.text, claimIds: [...item.claimIds].sort(), evidenceIds: [...item.evidenceIds].sort(), verificationOutcomes: [...item.verificationOutcomes].sort(), verified: item.claimIds.length > 0 && item.evidenceIds.length > 0 && item.verificationOutcomes.some(x => /SUPPORTED|DEVICE_VERIFIED|PASS/i.test(x)), reason: item.claimIds.length > 0 && item.evidenceIds.length > 0 ? 'fact traced to claim/evidence references' : 'fact lacked claim/evidence references' })),
    ];

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
        provenance,
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
