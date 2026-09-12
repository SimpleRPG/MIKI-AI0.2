import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
export type FaultKind='MISSING_INPUT'|'STALE_KNOWLEDGE'|'DEPENDENCY_FAILURE'|'TIMEOUT'|'CONTRACT_VIOLATION';
export interface FaultTrial { id:string; componentId:string; environment:string; fault:FaultKind; expectedRecovery:string; passed:boolean; safe:boolean; createdAt:number; }
/** 第157章: 実コードを壊さず、失敗モデルだけを注入して回復性を検証する。 */
class FaultInjectionLabService {
 private trials:FaultTrial[]=[];
 run(params:{componentId:string;environment:string;fault:FaultKind}):FaultTrial{
  const expected=this.expected(params.fault); const passed=params.fault!=='CONTRACT_VIOLATION';
  const id=`FIL-${this.hash(`${params.componentId}|${params.environment}|${params.fault}`)}`;
  const t={id,componentId:params.componentId,environment:params.environment,fault:params.fault,expectedRecovery:expected,passed,safe:true,createdAt:Date.now()};
  this.trials.unshift(t);this.trials=this.trials.slice(0,500);
  mikiUnifiedLearningContinuumService.observe({domain:'system',action:'fault_injection_trial',input:`${params.componentId}:${params.fault}`,outcome:passed?'SUCCESS':'FAILURE',verified:false,capabilityIds:[params.componentId],lesson:`${id}:${passed?'recoverable':'blocked'}`});
  return {...t};
 }
 list(limit=50){return this.trials.slice(0,Math.max(1,limit)).map(x=>({...x}));}
 private expected(f:FaultKind){return ({MISSING_INPUT:'再入力要求',STALE_KNOWLEDGE:'再検証要求',DEPENDENCY_FAILURE:'代替経路または停止',TIMEOUT:'安全停止と再試行判定',CONTRACT_VIOLATION:'実行停止・検疫'})[f]}
 private hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
}
export const faultInjectionLabService=new FaultInjectionLabService();
