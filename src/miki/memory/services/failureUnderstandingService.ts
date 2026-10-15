import { executionEventBusService, ExecutionEvent } from '../../execution/services/executionEventBusService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { systemLogger } from '../../../services/systemLogger';

export interface FailureUnderstandingRecord {
  id: string;
  componentId: string;
  gapId: string;
  researched: boolean;
  resolved: boolean;
  createdAt: number;
  reason: string;
}

/**
 * 実行失敗を永続Knowledge Gapとして記録する入口。
 * Research／Verification／Promotionはここで直接実行せず、既存AutonomousRevalidationLoopから
 * CORE TaskIngress／TaskBlackboardへ委譲し、Evidence/Claim/Verifier境界を一元化する。
 */
export class FailureUnderstandingService {
  private static instance: FailureUnderstandingService;
  private initialized = false;
  private unsubscribe?: () => void;
  private recent = new Map<string, number>();
  private records: FailureUnderstandingRecord[] = [];
  private readonly cooldownMs = 60_000;

  private constructor() {}
  public static getInstance(): FailureUnderstandingService { return this.instance || (this.instance = new FailureUnderstandingService()); }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe = executionEventBusService.subscribe('execution.failed', event => { void this.onFailure(event); });
    systemLogger.info('SELF_IMPROVEMENT', '🔎 [FailureUnderstanding] failure→persistent Knowledge Gap→CORE research bridge initialized');
  }

  public dispose(): void { this.unsubscribe?.(); this.unsubscribe = undefined; this.initialized = false; }

  public list(limit = 50): FailureUnderstandingRecord[] { return this.records.slice(0, Math.max(1, limit)).map(r => ({ ...r })); }

  private async onFailure(event: ExecutionEvent): Promise<void> {
    const signature = `${event.component_id}|${event.environment}|${event.error_message || event.output_summary || 'execution_failed'}`;
    const now = Date.now();
    const previous = this.recent.get(signature) || 0;
    if (now - previous < this.cooldownMs) return;
    this.recent.set(signature, now);

    const goal = String(event.metadata?.goal || event.component_id);
    const error = String(event.error_message || event.output_summary || 'execution_failed');
    const query = `Miki実行失敗の原因調査: ${goal} / component=${event.component_id} / environment=${event.environment} / error=${error}`;
    const gap = knowledgeGapService.detect({
      query,
      type: 'WEAK_COMPONENT',
      priority: 90,
      requiredEvidence: [
        '失敗原因を説明できる信頼できるWeb資料',
        '可能なら公式一次資料または再現可能な検証結果',
        '現在の実行環境・実装条件との整合性',
      ],
      sourceRequestId: event.request_id,
      reason: '実行失敗。原因を既知知識だけで推測せず、外部証拠を収集して検証する。',
    });

    const record: FailureUnderstandingRecord = {
      id: `FAIL-UNDERSTAND-${this.hash(`${event.event_id}|${gap.id}`)}`,
      componentId: event.component_id,
      gapId: gap.id,
      researched: false,
      resolved: gap.status === 'RESOLVED',
      createdAt: Date.now(),
      reason: 'Knowledge Gapを永続化。検索・昇格は直接実行せず、AutonomousRevalidationLoopから既存CORE TaskIngressへ委譲する。',
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 200);
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔎 [FailureUnderstanding] ${event.component_id}: Knowledge GapをCORE調査キューへ委譲`
    );
  }

  private hash(raw: string): string { let h = 2166136261; for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
}

export const failureUnderstandingService = FailureUnderstandingService.getInstance();
