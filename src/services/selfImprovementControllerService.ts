import { executionEventBusService, ExecutionEvent } from './executionEventBusService';
import { knowledgeGapService, KnowledgeGap } from './knowledgeGapService';
import { researchService, ResearchResult } from './researchService';
import { taskCaseMemoryService } from './taskCaseMemoryService';
import { memoryPromotionService } from './memoryPromotionService';
import { storageService } from './storageService';
import { MemoryItem } from '../types';
import { systemLogger } from './systemLogger';
import { selfImprovementMetricsService } from './selfImprovementMetricsService';
import { selfImprovementExperimentService } from './selfImprovementExperimentService';
import { safeImprovementPipelineService } from './safeImprovementPipelineService';
import { componentRegistryService } from './componentRegistryService';
import { ExecutionEnvironment } from './executionRunnerService';
import { improvementProposalService } from './improvementProposalService';

type ImprovementAction = 'PROMOTE_CASE' | 'RESEARCH_GAP' | 'OBSERVE_FAILURE' | 'RUN_REGRESSION' | 'REQUEST_CLOUD_PROPOSAL' | 'IDLE';
export interface ImprovementDecision { action: ImprovementAction; reason: string; caseId?: string; gapId?: string; }
export interface ImprovementRun { run_id:string; trigger:string; decision:ImprovementDecision; result?:string; experiment_id?:string; verdict?:'ADOPT'|'HOLD'|'REJECT'; score_delta?:number; created_at:number; }

/**
 * 自己改善の「司令塔」。自分で任意コードを生成/実行するのではなく、
 * 既存の安全な研究・ケース昇格だけを選択する。実行・真偽判定・Component VERIFIED昇格は各専門層に委譲する。
 */
export class SelfImprovementControllerService {
  private static instance: SelfImprovementControllerService;
  private initialized=false;
  private unsubscribe: (()=>void)[]=[];
  private running=false;
  private lastRunAt=0;
  private readonly cooldownMs=15_000;
  private readonly storageKey='miki_self_improvement_runs_v1';
  private constructor(){}
  public static getInstance(){ return this.instance||(this.instance=new SelfImprovementControllerService()); }

  public initialize(){
    if(this.initialized)return;
    this.initialized=true;
    this.unsubscribe.push(executionEventBusService.subscribe('execution.completed', e=>this.schedule('execution.completed',e)));
    this.unsubscribe.push(executionEventBusService.subscribe('execution.failed', e=>this.schedule('execution.failed',e)));
    selfImprovementMetricsService.initialize();
    systemLogger.info('SELF_IMPROVEMENT','🧭 [SelfImprovement] initialized');
  }
  public dispose(){ this.unsubscribe.forEach(u=>u()); this.unsubscribe=[]; selfImprovementMetricsService.dispose(); this.initialized=false; }

  public async runOnce(trigger='manual'):Promise<ImprovementRun>{
    const now=Date.now();
    if(this.running) return this.record(trigger,{action:'IDLE',reason:'別の自己改善サイクルが実行中です。'},'busy');
    if(now-this.lastRunAt<this.cooldownMs) return this.record(trigger,{action:'IDLE',reason:'自己改善サイクルのクールダウン中です。'},'cooldown');
    this.running=true; this.lastRunAt=now;
    const before = selfImprovementExperimentService.snapshot();
    try{
      const signals=selfImprovementMetricsService.rankWeaknesses();
      const stable=this.taskCaseMemoryServiceStable();
      const gap=knowledgeGapService.listOpen(1)[0];
      const deviceCandidate = componentRegistryService.getAllComponents().find(c => c.status === 'DEVICE_TESTED' && !!c.implementation_hash);
      // 改善シグナルを優先する。ただしStableケースは安全なローカル改善なので同点以上なら先に昇格。
      if(stable && (signals[0]?.kind!=='FAILURE_RATE' || signals[0].score<70)){
        const decision:ImprovementDecision={action:'PROMOTE_CASE',reason:`${signals[0]?.reason||'安定成功ケース'} 安定ケースを長期記憶へ昇格します。`,caseId:stable.case_id};
        const memories=storageService.getMemories();
        const candidate=memoryPromotionService.createCandidate(stable,memories);
        if(candidate){ storageService.saveMemoryItem(candidate); return this.recordMeasured(trigger,decision,'promoted',before); }
        return this.recordMeasured(trigger,decision,'already-promoted-or-not-created',before);
      }
      if(deviceCandidate){
        const environment = this.pickEnvironment(deviceCandidate.supported_environments);
        const topSignal = signals[0];
        if (topSignal?.kind === 'FAILURE_RATE' && topSignal.score >= 70) {
          const proposal = improvementProposalService.requestCloudProposal(
            deviceCandidate.component_id,
            `失敗率が高いため改善案を要求します。${topSignal.reason}`,
            topSignal.reason,
          );
          const decision:ImprovementDecision={action:'REQUEST_CLOUD_PROPOSAL',reason:proposal
            ? `高失敗率を受け、${deviceCandidate.component_id} の改善案をCloud AIへ限定要求しました。採用前にCandidate/Regression Gateで隔離検証します。`
            : `高失敗率ですが改善案要求を作成できませんでした。`,caseId:proposal?.proposal_id};
          return this.recordMeasured(trigger,decision,proposal ? 'cloud-proposal-requested' : 'proposal-blocked',before);
        }
        const proposal = safeImprovementPipelineService.propose(deviceCandidate.component_id, environment);
        const planned = safeImprovementPipelineService.planRegression(proposal.run_id);
        const decision:ImprovementDecision={action:'RUN_REGRESSION',reason:`DEVICE_TESTED部品 ${deviceCandidate.component_id} の安全なRegressionを開始します。`,caseId:planned.suite?.suite_id};
        return this.recordMeasured(trigger,decision,planned.suite ? 'regression-planned' : 'regression-blocked',before);
      }
      if(gap){
        const decision:ImprovementDecision={action:'RESEARCH_GAP',reason:`未解決Knowledge Gapを優先調査します: ${gap.query}`,gapId:gap.id};
        const result=await researchService.researchGap(gap);
        return this.recordMeasured(trigger,decision,result.resolved?'research-resolved':'research-not-resolved',before);
      }
      return this.recordMeasured(trigger,{action:'IDLE',reason:'現在、自動改善を開始すべき安定ケースも未解決Gapもありません。'},'no-op',before);
    }catch(error){
      return this.recordMeasured(trigger,{action:'IDLE',reason:`自己改善サイクル中のエラー: ${String(error)}`},'error',before);
    }finally{ this.running=false; }
  }

  public decide():ImprovementDecision{
    const signals=selfImprovementMetricsService.rankWeaknesses();
    const stable=this.taskCaseMemoryServiceStable();
    if(stable && (signals[0]?.kind!=='FAILURE_RATE' || signals[0].score<70)) return {action:'PROMOTE_CASE',reason:`${signals[0]?.reason||'安定成功ケース'} 安定成功ケースを長期記憶へ昇格可能。`,caseId:stable.case_id};
    const gap=knowledgeGapService.listOpen(1)[0];
    if(gap)return {action:'RESEARCH_GAP',reason:`${signals[0]?.reason||'未解決Gap'}: ${gap.query}`,gapId:gap.id};
    if(signals[0]?.kind==='FAILURE_RATE' && signals[0].score >= 70) return {action:'REQUEST_CLOUD_PROPOSAL',reason:`高失敗率を検出しました。Cloud AIには改善案の提案だけを限定要求し、Candidate/Regression Gateで隔離検証します。 ${signals[0].reason}`};
    if(signals[0]?.kind==='FAILURE_RATE') return {action:'OBSERVE_FAILURE',reason:signals[0].reason};
    return {action:'IDLE',reason:signals[0]?.reason||'改善対象なし'};
  }

  public listRuns():ImprovementRun[]{
    try{const raw=storageService.getItem(this.storageKey); return raw?JSON.parse(raw):[];}catch{return [];}
  }

  private pickEnvironment(envs:string[]): ExecutionEnvironment {
    if (envs.some(e => /termux/i.test(e))) return 'TERMUX';
    if (envs.some(e => /android/i.test(e))) return 'ANDROID';
    if (envs.some(e => /excel.*windows|windows/i.test(e))) return 'EXCEL_WINDOWS';
    if (envs.some(e => /excel.*mac|mac/i.test(e))) return 'EXCEL_MAC';
    return 'EXTERNAL_RUNNER';
  }
  private taskCaseMemoryServiceStable(){
    return taskCaseMemoryService.list().find(c=>c.outcome==='SUCCESS'&&c.maturity==='STABLE'&&c.component_ids.length>0);
  }
  private schedule(trigger:string,_event:ExecutionEvent){
    // イベント発生直後に重い処理を連鎖させず、1サイクルだけ遅延実行する。
    setTimeout(()=>{void this.runOnce(trigger);},0);
  }
  private recordMeasured(trigger:string,decision:ImprovementDecision,result:string,before:ReturnType<typeof selfImprovementExperimentService.snapshot>):ImprovementRun{
    const after=selfImprovementExperimentService.snapshot();
    const experiment=selfImprovementExperimentService.evaluate(decision.action,before,after,result);
    return this.record(trigger,decision,result,experiment);
  }
  private record(trigger:string,decision:ImprovementDecision,result:string,experiment?:ReturnType<typeof selfImprovementExperimentService.evaluate>):ImprovementRun{
    const run:ImprovementRun={run_id:`SIR-${this.hash(`${trigger}|${decision.action}|${Date.now()}`)}`,trigger,decision,result,experiment_id:experiment?.experiment_id,verdict:experiment?.verdict,score_delta:experiment?.scoreDelta,created_at:Date.now()};
    const history=this.listRuns(); history.unshift(run); history.splice(100);
    try{storageService.setItem(this.storageKey,JSON.stringify(history));}catch{}
    systemLogger.info('SELF_IMPROVEMENT',`🧭 [SelfImprovement] ${decision.action}: ${result}`);
    return run;
  }
  private hash(raw:string){let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
}
export const selfImprovementControllerService=SelfImprovementControllerService.getInstance();
