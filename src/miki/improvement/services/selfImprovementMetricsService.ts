import { executionEventBusService, ExecutionEvent } from '../../execution/services/executionEventBusService';
import { failureMemoryService } from '../../memory/services/failureMemoryService';
import { taskCaseMemoryService } from '../../memory/services/taskCaseMemoryService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { capabilityReuseService } from '../../capability/services/capabilityReuseService';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { taskBlackboardService } from '../../core/services/taskBlackboardService';
import { domainReplyLedgerService } from '../../core/services/domainReplyLedgerService';
import { autonomousSearchService } from '../../research/services/autonomousSearchService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';
import { resourceGovernanceService, ResourceSnapshot } from '../../safety/services/resourceGovernanceService';

export type WeaknessKind = 'FAILURE_RATE'|'LOW_REUSE'|'KNOWLEDGE_GAP'|'REJECTION_RATE'|'NO_SIGNAL';
export interface SelfImprovementMetrics {
  windowMs:number; completed:number; failed:number; rejected:number; total:number;
  successRate:number; failureRate:number; rejectionRate:number; reuseRate:number;
  openGaps:number; stableCases:number; reusableCases:number; observedCases:number;
  cloudLikeFailures:number; updatedAt:number;
}
export interface WeaknessSignal { kind:WeaknessKind; score:number; reason:string; targetId?:string; }

export interface CognitiveObservabilitySnapshot {
  periodMs:number;
  goals:{completed:number;failed:number;waiting:number;paused:number;cancelled:number;successRate:number};
  research:{runs:number;resolved:number;resolutionRate:number;evidenceBearingRuns:number;evidenceAcquisitionRate:number;gapRetries:number};
  unknowns:{open:number;researching:number;blocked:number;recurrenceCount:number};
  guards:{noProgress:number;oscillation:number;repeatedFailure:number;noNewEvidence:number;environmentDrift:number;idempotencyReused:number};
  search:{totalSearches:number;inChatSearches:number;idleAutonomousSearches:number;knowledgeItemsLearned:number;noResultRecords:number;noResultRate:number};
  learning:{profiles:number;verifiedProfiles:number;averageConfidence:number;crossDomainLinks:number;recommendedCapabilities:number};
  resource:ResourceSnapshot;
  reuseRate:number;
  updatedAt:number;
}


/** 実行・ケース・Gapから「どこを改善すると効果が大きいか」を数値化する観測層。改善そのものは行わない。 */
export class SelfImprovementMetricsService {
  private static instance:SelfImprovementMetricsService;
  private initialized=false; private unsub:(()=>void)[]=[];
  private events:ExecutionEvent[]=[]; private readonly windowMs=24*60*60*1000;
  private readonly storageKey='miki_self_improvement_metrics_v1';
  private readonly eventsStorageKey='miki_self_improvement_metric_events_v1';
  private constructor(){this.load();}
  public static getInstance(){return this.instance||(this.instance=new SelfImprovementMetricsService());}
  public initialize(){if(this.initialized)return; this.initialized=true;
    this.unsub.push(executionEventBusService.subscribe('execution.completed',e=>this.add(e)));
    this.unsub.push(executionEventBusService.subscribe('execution.failed',e=>this.add(e)));
    this.unsub.push(executionEventBusService.subscribe('execution.rejected',e=>this.add(e)));
    systemLogger.info('SELF_IMPROVEMENT','📊 [Metrics] initialized');
  }
  public dispose(){this.unsub.forEach(u=>u());this.unsub=[];this.initialized=false;this.save();}
  public snapshot():SelfImprovementMetrics{
    this.prune(); const total=this.events.length, completed=this.events.filter(e=>e.type==='execution.completed').length;
    const failed=this.events.filter(e=>e.type==='execution.failed').length, rejected=this.events.filter(e=>e.type==='execution.rejected').length;
    const reusable=capabilityReuseService.list().filter(r=>r.created_at>=Date.now()-this.windowMs).length;
    const stable=taskCaseMemoryService.list().filter(c=>c.outcome==='SUCCESS'&&c.maturity==='STABLE').length;
    const reusableCases=taskCaseMemoryService.list().filter(c=>c.outcome==='SUCCESS'&&c.maturity==='REUSABLE').length;
    const observedCases=taskCaseMemoryService.list().filter(c=>c.maturity==='OBSERVED').length;
    const openGaps=knowledgeGapService.listOpen(500).length;
    const metrics={windowMs:this.windowMs,completed,failed,rejected,total,successRate:total?completed/total:0,failureRate:total?failed/total:0,rejectionRate:total?rejected/total:0,reuseRate:completed?Math.min(1,reusable/completed):0,openGaps,stableCases:stable,reusableCases,observedCases,cloudLikeFailures:this.events.filter(e=>e.type==='execution.failed'&&/cloud|remote|api/i.test(`${e.error_message||''} ${e.runner_id||''}`)).length,updatedAt:Date.now()};
    try{storageService.setItem(this.storageKey,JSON.stringify(metrics));}catch{}
    return metrics;
  }
  public cognitiveObservabilitySnapshot():CognitiveObservabilitySnapshot {
    const periodMs = this.windowMs;
    const cutoff = Date.now() - periodMs;
    const tasks = taskBlackboardService.list(200).filter(task => task.updatedAt >= cutoff || task.createdAt >= cutoff);
    const completed = tasks.filter(task=>task.status==='COMPLETED').length;
    const failed = tasks.filter(task=>task.status==='FAILED').length;
    const waiting = tasks.filter(task=>task.status==='WAITING').length;
    const paused = tasks.filter(task=>task.status==='PAUSED').length;
    const cancelled = tasks.filter(task=>task.status==='CANCELLED').length;
    const terminal = completed + failed + cancelled;

    const replies = tasks.flatMap(task=>domainReplyLedgerService.listByTask(task.taskId));
    const researchReplies = replies.filter(reply=>reply.classificationId==='research' && reply.command==='RUN_RESEARCH' && reply.completedAt>=cutoff);
    const resolved = researchReplies.filter(reply=>{
      const text=reply.summary || '';
      return reply.status==='SUCCEEDED' && /resolved|昇格|verified|SUPPORTED|DEVICE_VERIFIED/i.test(text);
    }).length;
    const evidenceBearingRuns = researchReplies.filter(reply=>reply.evidenceIds.length>0).length;
    const gapRetries = tasks.reduce((sum,task)=>{
      const research=task.entries.filter(entry=>entry.kind==='RESULT'&&entry.domain==='research'&&entry.key.includes('RUN_RESEARCH'));
      return sum + Math.max(0,research.length-1);
    },0);

    const gaps=knowledgeGapService.listOpen(500);
    const allSearchRecords=autonomousSearchService.getRecentRecords(500).filter(record=>record.timestamp>=cutoff);
    const noResultRecords=allSearchRecords.filter(record=>record.results.length===0).length;
    const searchStats=autonomousSearchService.getStats();

    const guardEntries=tasks.flatMap(task=>task.entries).filter(entry=>entry.createdAt>=cutoff&&entry.kind==='DECISION');
    const guardCount=(name:string)=>guardEntries.filter(entry=>entry.key===name || (entry.key.startsWith('coreCycleGuard:') && JSON.stringify(entry.value).includes(name))).length;
    const idempotencyReused=guardEntries.filter(entry=>entry.key==='actionIdempotencyReused').length;
    const environmentDrift=guardEntries.filter(entry=>entry.key==='environmentDriftDetected').length;

    const learning=mikiUnifiedLearningContinuumService.getSnapshot();
    const learningProfiles=learning.profiles;
    const averageConfidence=learningProfiles.length
      ? Math.round(learningProfiles.reduce((sum,p)=>sum+p.confidence,0)/learningProfiles.length*100)/100
      : 0;
    const verifiedProfiles=learningProfiles.filter(p=>p.verified>0).length;

    let resource=resourceGovernanceService.getSnapshot();
    const snapshot:CognitiveObservabilitySnapshot={
      periodMs,
      goals:{completed,failed,waiting,paused,cancelled,successRate:terminal?completed/terminal:0},
      research:{runs:researchReplies.length,resolved,resolutionRate:researchReplies.length?resolved/researchReplies.length:0,evidenceBearingRuns,evidenceAcquisitionRate:researchReplies.length?evidenceBearingRuns/researchReplies.length:0,gapRetries},
      unknowns:{open:gaps.filter(g=>g.status==='OPEN').length,researching:gaps.filter(g=>g.status==='RESEARCHING').length,blocked:gaps.filter(g=>g.status==='BLOCKED').length,recurrenceCount:gaps.reduce((sum,g)=>sum+Math.max(0,g.attempts-1),0)},
      guards:{noProgress:guardCount('NO_PROGRESS'),oscillation:guardCount('OSCILLATION_DETECTED'),repeatedFailure:guardCount('REPEATED_FAILURE'),noNewEvidence:guardCount('NO_NEW_EVIDENCE'),environmentDrift,idempotencyReused},
      search:{totalSearches:searchStats.totalSearches,inChatSearches:searchStats.inChatSearches,idleAutonomousSearches:searchStats.idleAutonomousSearches,knowledgeItemsLearned:searchStats.knowledgeItemsLearned,noResultRecords,noResultRate:allSearchRecords.length?noResultRecords/allSearchRecords.length:0},
      learning:{profiles:learningProfiles.length,verifiedProfiles,averageConfidence,crossDomainLinks:learning.crossDomainLinks.length,recommendedCapabilities:learning.recommendedCapabilities.length},
      resource,
      reuseRate:this.snapshot().reuseRate,
      updatedAt:Date.now()
    };
    try{storageService.setItem('miki_cognitive_observability_v1',JSON.stringify(snapshot));}catch{}
    return snapshot;
  }

  public rankWeaknesses():WeaknessSignal[]{
    const m=this.snapshot(); const out:WeaknessSignal[]=[];
    if(m.failureRate>=0.30&&m.failed>0) out.push({kind:'FAILURE_RATE',score:Math.round(m.failureRate*100),reason:`直近24時間の実行失敗率が ${(m.failureRate*100).toFixed(1)}% です。失敗パターンを優先して改善します。`});
    if(m.openGaps>0) out.push({kind:'KNOWLEDGE_GAP',score:Math.min(100,30+m.openGaps*10),reason:`未解決Knowledge Gapが ${m.openGaps} 件あります。`});
    if(m.completed>=5&&m.reuseRate<0.25) out.push({kind:'LOW_REUSE',score:Math.round((1-m.reuseRate)*80),reason:`成功実行 ${m.completed} 件に対する再利用率が ${(m.reuseRate*100).toFixed(1)}% と低い状態です。`});
    if(m.total>=5&&m.rejectionRate>=0.20) out.push({kind:'REJECTION_RATE',score:Math.round(m.rejectionRate*100),reason:`実行要求の拒否率が ${(m.rejectionRate*100).toFixed(1)}% です。環境・能力適合性を確認します。`});
    if(!out.length) out.push({kind:'NO_SIGNAL',score:0,reason:'現時点で優先度の高い改善シグナルはありません。'});
    return out.sort((a, b) =>
      b.score - a.score ||
      a.kind.localeCompare(b.kind) ||
      (a.targetId || '').localeCompare(b.targetId || '') ||
      a.reason.localeCompare(b.reason)
    );
  }
  public getLastStored():Partial<SelfImprovementMetrics>|undefined{try{const raw=storageService.getItem(this.storageKey);return raw?JSON.parse(raw):undefined;}catch{return undefined;}}
  private add(e:ExecutionEvent){this.events.push(e);this.prune();this.save();}
  private prune(){const cutoff=Date.now()-this.windowMs;this.events=this.events.filter(e=>e.created_at>=cutoff).slice(-2000);}
  private load(){
    try {
      const rawEvents=storageService.getItem(this.eventsStorageKey);
      if(rawEvents){
        const parsed=JSON.parse(rawEvents);
        if(Array.isArray(parsed)) this.events=parsed as ExecutionEvent[];
      }
      this.prune();
    } catch {}
  }
  private save(){
    try{
      this.prune();
      storageService.setItem(this.eventsStorageKey,JSON.stringify(this.events.slice(-2000)));
      storageService.setItem(this.storageKey,JSON.stringify(this.snapshotWithoutSave()));
    }catch{}
  }
  private snapshotWithoutSave(){const total=this.events.length;const completed=this.events.filter(e=>e.type==='execution.completed').length;const failed=this.events.filter(e=>e.type==='execution.failed').length;const rejected=this.events.filter(e=>e.type==='execution.rejected').length;return {windowMs:this.windowMs,completed,failed,rejected,total,successRate:total?completed/total:0,failureRate:total?failed/total:0,rejectionRate:total?rejected/total:0,updatedAt:Date.now()};}
}
export const selfImprovementMetricsService=SelfImprovementMetricsService.getInstance();
