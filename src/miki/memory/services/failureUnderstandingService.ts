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

export type FailureUnderstandingPersistenceStatus='READY'|'RECOVERED_QUARANTINED'|'WRITE_BLOCKED';
export interface FailureUnderstandingPersistenceState { status:FailureUnderstandingPersistenceStatus; reason?:string; }

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
  private persistenceStatus:FailureUnderstandingPersistenceStatus='READY';
  private persistenceReason?:string;
  private writesBlocked=false;

  private constructor() { this.load(); }
  public static getInstance(): FailureUnderstandingService { return this.instance || (this.instance = new FailureUnderstandingService()); }

  public initialize(): void {
    if (this.initialized) return;
    if(this.writesBlocked){systemLogger.error('PERSISTENCE','[FailureUnderstanding] event subscription blocked because failure history could not be preserved',{reason:this.persistenceReason});return;}
    this.initialized = true;
    this.unsubscribe = executionEventBusService.subscribe('execution.failed', event => { void this.onFailure(event); });
    systemLogger.info('SELF_IMPROVEMENT', '🔎 [FailureUnderstanding] failure→persistent Knowledge Gap→CORE research bridge initialized');
  }

  public dispose(): void { this.unsubscribe?.(); this.unsubscribe = undefined; this.initialized = false; }

  public getPersistenceState():FailureUnderstandingPersistenceState{return {status:this.persistenceStatus,...(this.persistenceReason?{reason:this.persistenceReason}:{})};}

  public list(limit = 50): FailureUnderstandingRecord[] {
    const result=this.records.slice(0,Math.max(1,Math.min(200,limit))).map(record=>{
      const gap=knowledgeGapService.getById(record.gapId);
      return {...record,researched:record.researched||Boolean(gap&&(gap.attempts>0||gap.lastResearchAt)),resolved:gap?.status==='RESOLVED'};
    });
    return result;
  }

  private assertWritable():void{if(this.writesBlocked)throw new Error('FAILURE_UNDERSTANDING_STORE_WRITE_BLOCKED');}

  private blockStore(reason:string):void{this.writesBlocked=true;this.persistenceStatus='WRITE_BLOCKED';this.persistenceReason=reason.slice(0,700);}

  private quarantine(raw:string,reason:string):boolean{const base=`${this.storageKey}_quarantine_v1`;const envelope={version:1,sourceKey:this.storageKey,quarantinedAt:Date.now(),reason:reason.slice(0,500),raw};try{let destination=base;const existing=storageService.getItem(base);if(existing!==null){try{const parsed=JSON.parse(existing) as Record<string,unknown>;if(parsed.version===1&&parsed.sourceKey===this.storageKey&&parsed.raw===raw)return true;}catch{}let suffix=0;do{destination=`${base}_${Date.now()}_${suffix++}`;if(suffix>1000)return false;}while(storageService.getItem(destination)!==null);}storageService.setItem(destination,JSON.stringify(envelope));const saved=storageService.getItem(destination);if(saved===null)return false;const parsed=JSON.parse(saved) as Record<string,unknown>;return parsed.version===1&&parsed.sourceKey===this.storageKey&&parsed.raw===raw;}catch{return false;}}

  private parseRecords(raw:string):FailureUnderstandingRecord[]{const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>200)throw new Error('FAILURE_UNDERSTANDING_SNAPSHOT_INVALID_ROOT_OR_LIMIT');const ids=new Set<string>();for(const item of parsed){if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('FAILURE_UNDERSTANDING_RECORD_INVALID');const row=item as Record<string,unknown>;if(typeof row.id!=='string'||!row.id.trim()||ids.has(row.id)||typeof row.componentId!=='string'||typeof row.gapId!=='string'||typeof row.researched!=='boolean'||typeof row.resolved!=='boolean'||typeof row.createdAt!=='number'||!Number.isFinite(row.createdAt)||row.createdAt<0||typeof row.reason!=='string')throw new Error('FAILURE_UNDERSTANDING_RECORD_INVALID_FIELDS');ids.add(row.id);for(const key of ['eventId','signature','environment','sourceRequestId'])if(row[key]!==undefined&&typeof row[key]!=='string')throw new Error('FAILURE_UNDERSTANDING_RECORD_INVALID_OPTIONAL_STRING');}return parsed as FailureUnderstandingRecord[];}

  private load(): void {
    let raw:string|null;try{raw=storageService.getItem(this.storageKey);}catch(error){this.blockStore(`FAILURE_UNDERSTANDING_STORE_READ_FAILED:${String(error instanceof Error?error.message:error)}`);return;}
    if(raw===null)return;
    try{this.records=this.parseRecords(raw);for(const record of this.records){if(!record.signature||!Number.isFinite(record.createdAt))continue;const previous=this.recent.get(record.signature)||0;if(record.createdAt>previous)this.recent.set(record.signature,record.createdAt);}}catch(error){const reason=String(error instanceof Error?error.message:error).slice(0,500);this.records=[];this.recent.clear();if(this.quarantine(raw,reason)){this.persistenceStatus='RECOVERED_QUARANTINED';this.persistenceReason=`${this.storageKey}_QUARANTINED:${reason}`;}else this.blockStore(`${this.storageKey}_QUARANTINE_FAILED:${reason}`);}
  }

  private save(): void {this.assertWritable();const serialized=JSON.stringify(this.records.slice(0,200));try{storageService.setItem(this.storageKey,serialized);if(storageService.getItem(this.storageKey)!==serialized)throw new Error('STORE_READBACK_MISMATCH');}catch(error){this.blockStore(`FAILURE_UNDERSTANDING_STORE_WRITE_VERIFY_FAILED:${String(error instanceof Error?error.message:error)}`);throw new Error('FAILURE_UNDERSTANDING_STORE_WRITE_VERIFY_FAILED');}}

  private async onFailure(event: ExecutionEvent): Promise<void> {
    if(this.writesBlocked){systemLogger.error('PERSISTENCE','[FailureUnderstanding] failure event held because durable history is blocked',{eventId:event.event_id,reason:this.persistenceReason});return;}
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
    try{this.save();}catch(persistenceError){this.records=this.records.filter(item=>item.id!==record.id);if(previous>0)this.recent.set(signature,previous);else this.recent.delete(signature);systemLogger.error('PERSISTENCE','[FailureUnderstanding] failure event was not acknowledged because its durable record could not be verified',{eventId:event.event_id,error:String(persistenceError)});return;}
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
