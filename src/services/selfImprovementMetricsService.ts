import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { failureMemoryService } from './failureMemoryService';
import { taskCaseMemoryService } from './taskCaseMemoryService';
import { knowledgeGapService } from './knowledgeGapService';
import { capabilityReuseService } from './capabilityReuseService';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type WeaknessKind = 'FAILURE_RATE'|'LOW_REUSE'|'KNOWLEDGE_GAP'|'REJECTION_RATE'|'NO_SIGNAL';
export interface SelfImprovementMetrics {
  windowMs:number; completed:number; failed:number; rejected:number; total:number;
  successRate:number; failureRate:number; rejectionRate:number; reuseRate:number;
  openGaps:number; stableCases:number; reusableCases:number; observedCases:number;
  cloudLikeFailures:number; updatedAt:number;
}
export interface WeaknessSignal { kind:WeaknessKind; score:number; reason:string; targetId?:string; }

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
  public rankWeaknesses():WeaknessSignal[]{
    const m=this.snapshot(); const out:WeaknessSignal[]=[];
    if(m.failureRate>=0.30&&m.failed>0) out.push({kind:'FAILURE_RATE',score:Math.round(m.failureRate*100),reason:`直近24時間の実行失敗率が ${(m.failureRate*100).toFixed(1)}% です。失敗パターンを優先して改善します。`});
    if(m.openGaps>0) out.push({kind:'KNOWLEDGE_GAP',score:Math.min(100,30+m.openGaps*10),reason:`未解決Knowledge Gapが ${m.openGaps} 件あります。`});
    if(m.completed>=5&&m.reuseRate<0.25) out.push({kind:'LOW_REUSE',score:Math.round((1-m.reuseRate)*80),reason:`成功実行 ${m.completed} 件に対する再利用率が ${(m.reuseRate*100).toFixed(1)}% と低い状態です。`});
    if(m.total>=5&&m.rejectionRate>=0.20) out.push({kind:'REJECTION_RATE',score:Math.round(m.rejectionRate*100),reason:`実行要求の拒否率が ${(m.rejectionRate*100).toFixed(1)}% です。環境・能力適合性を確認します。`});
    if(!out.length) out.push({kind:'NO_SIGNAL',score:0,reason:'現時点で優先度の高い改善シグナルはありません。'});
    return out.sort((a,b)=>b.score-a.score);
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
