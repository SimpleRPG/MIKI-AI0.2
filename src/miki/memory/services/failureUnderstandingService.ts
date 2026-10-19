import { executionEventBusService, ExecutionEvent } from '../../execution/services/executionEventBusService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { systemLogger } from '../../../services/systemLogger';
import { storageService } from '../../../services/storageService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';

export interface FailureUnderstandingRecord {
  id: string;
  componentId: string;
  gapId: string;
  researched: boolean;
  resolved: boolean;
  createdAt: number;
  reason: string;
  eventId?: string;
  signature?: string;
  environment?: string;
  sourceRequestId?: string;
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
  private readonly storageKey = 'miki_failure_understanding_records_v1';

  private constructor() { this.load(); }
  public static getInstance(): FailureUnderstandingService { return this.instance || (this.instance = new FailureUnderstandingService()); }

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.unsubscribe = executionEventBusService.subscribe('execution.failed', event => { void this.onFailure(event); });
    systemLogger.info('SELF_IMPROVEMENT', '🔎 [FailureUnderstanding] failure→persistent Knowledge Gap→CORE research bridge initialized');
  }

  public dispose(): void { this.unsubscribe?.(); this.unsubscribe = undefined; this.initialized = false; }

  public list(limit = 50): FailureUnderstandingRecord[] {
    const result=this.records.slice(0,Math.max(1,Math.min(200,limit))).map(record=>{
      const gap=knowledgeGapService.getById(record.gapId);
      return {...record,researched:record.researched||Boolean(gap&&(gap.attempts>0||gap.lastResearchAt)),resolved:gap?.status==='RESOLVED'};
    });
    return result;
  }

  private load(): void {
    try {
      const raw=storageService.getItem(this.storageKey);
      const parsed=raw?JSON.parse(raw):[];
      if(!Array.isArray(parsed))return;
      this.records=parsed.filter((row):row is FailureUnderstandingRecord=>Boolean(row&&typeof row.id==='string'&&typeof row.gapId==='string'&&typeof row.componentId==='string')).slice(0,200);
      for(const record of this.records){
        if(!record.signature||!Number.isFinite(record.createdAt))continue;
        const previous=this.recent.get(record.signature)||0;
        if(record.createdAt>previous)this.recent.set(record.signature,record.createdAt);
      }
    } catch(error) {
      this.records=[];
      this.recent.clear();
      systemLogger.warn('PERSISTENCE',`[FailureUnderstanding] load failed: ${String(error)}`);
    }
  }

  private save(): void {
    try { storageService.setItem(this.storageKey,JSON.stringify(this.records.slice(0,200))); }
    catch(error) { systemLogger.warn('PERSISTENCE',`[FailureUnderstanding] save failed: ${String(error)}`); }
  }

  private async onFailure(event: ExecutionEvent): Promise<void> {
    if(this.records.some(record=>record.eventId===event.event_id))return;
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
      createdAt: now,
      reason: '失敗観測を永続化し、未検証の学習観測として記録。原因の確定・検索・昇格・修正は直接実行せず、既存AutonomousRevalidationLoopからCORE TaskIngressへ委譲する。',
      eventId:event.event_id,
      signature,
      environment:event.environment,
      sourceRequestId:event.request_id,
    };
    this.records.unshift(record);
    this.records = this.records.slice(0, 200);
    this.save();
    mikiUnifiedLearningContinuumService.observe({
      domain:'system',
      key:`execution-failure:${event.component_id}:${this.hash(signature)}`,
      input:goal,
      outcome:'FAILURE',
      verified:false,
      capabilityIds:[event.component_id],
      concepts:[event.component_id,event.environment].filter(Boolean),
      lesson:`UNVERIFIED_FAILURE_OBSERVATION:${event.event_id}; gap=${gap.id}; cause not established; CORE research and verification required`,
    });
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔎 [FailureUnderstanding] ${event.component_id}: Knowledge GapをCORE調査キューへ委譲`
    );
  }

  private hash(raw: string): string { let h = 2166136261; for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
}

export const failureUnderstandingService = FailureUnderstandingService.getInstance();
