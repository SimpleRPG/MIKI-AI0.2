import type { MikiDomain } from './crossDomainCirculationService';
import { taskBlackboardService, type BlackboardTask } from './taskBlackboardService';
import type { DomainCommand } from './domainRouterService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
export interface PlannedRoute { target:MikiDomain; command:DomainCommand; reason:string; payload:Record<string,unknown>; }
class AdaptiveRoutePlannerService{
 plan(task:BlackboardTask):PlannedRoute[]{
  const text=`${task.goal} ${task.entries.map(e=>`${e.key} ${String(e.value)}`).join(' ')}`;
  const routes:PlannedRoute[]=[];
  const used=new Set(task.visitedDomains);
  if(!used.has('conversation'))routes.push({target:'conversation',command:'ANALYZE_TEXT',reason:'入力を構造化する',payload:{text:task.goal}});
  if(/不明|未知|調べ|検索|最新|わから|機能/i.test(text)&&!used.has('unknown'))routes.push({target:'unknown',command:'RESOLVE_UNKNOWN',reason:'未知・不足情報を分類する',payload:{question:task.goal,useSearch:/調べ|検索|最新/i.test(text),hasAttachments:false}});
  if(/改善|修正|実装|成長|自己改善/i.test(text)&&!used.has('improvement'))routes.push({target:'improvement',command:'RUN_SELF_IMPROVEMENT',reason:'正本自己改善入口へ送る',payload:{trigger:`blackboard-${task.taskId}`}});
  const lastError=[...task.entries].reverse().find(e=>e.kind==='ERROR');
  if(lastError&&/EVIDENCE|UNKNOWN|NOT_FOUND|MISSING/.test(String(lastError.value))&&!used.has('research'))routes.push({target:'research',command:'GET_STATUS',reason:'不足Evidenceの代替経路を評価する',payload:{previousError:lastError.value}});
  const quality=evidenceQualityGateService.evaluate(task);
  if(task.entries.some(e=>e.kind==='RESULT')&&!quality.passed&&!used.has('verification'))routes.push({target:'verification',command:'GET_STATUS',reason:`Evidence品質不足を検証する: ${quality.reasons.join(',')}`,payload:{quality}});
  if(routes.length===0&&!used.has('strategy'))routes.push({target:'strategy',command:'GET_STATUS',reason:'追加経路を決めるため戦略状態を取得する',payload:{}});
  if(routes.length===0&&!used.has('memory'))routes.push({target:'memory',command:'FLUSH',reason:'処理結果を永続化する',payload:{}});
  return routes.slice(0,3);
 }
 shouldComplete(task:BlackboardTask):boolean{const quality=evidenceQualityGateService.evaluate(task);return task.entries.some(e=>e.kind==='RESULT')&&task.pendingDomains.length===0&&task.visitedDomains.includes('memory')&&quality.passed;}
 refresh(taskId:string):PlannedRoute[]{const task=taskBlackboardService.get(taskId);return task?this.plan(task):[];}
}
export const adaptiveRoutePlannerService=new AdaptiveRoutePlannerService();
