import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { executionEventBusService } from '../../execution/services/executionEventBusService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { taskBlackboardService } from './taskBlackboardService';
import { crossDomainCirculationService } from './crossDomainCirculationService';
import { autonomousSelfImprovementLoopService } from './autonomousSelfImprovementLoopService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { selfImprovementDirectionService } from './selfImprovementDirectionService';
import { improvementDebtService } from './improvementDebtService';
import { evidenceBasedSelfImprovementEngine } from '../../improvement/services/evidenceBasedSelfImprovementEngine';
import type { ChangeSetID, RequirementContract } from '../../../types/evidenceSelfImprovementTypes';

export type DiscoveredIssueKind='EXECUTION_FAILURE'|'KNOWLEDGE_GAP'|'CAPABILITY_GAP'|'STALLED_TASK'|'DOMAIN_DISCONNECTED'|'CLAIM_CONTRADICTION'|'IMPROVEMENT_DEBT';
export interface DiscoveredIssue { id:string; fingerprint:string; changeSetId?:ChangeSetID; requirementContractId?:string; kind:DiscoveredIssueKind; title:string; detail:string; sourceId:string; priority:number; discoveredAt:number; lastSeenAt:number; occurrences:number; queuedAt?:number; resolvedAt?:number; }
export interface DiscoveryConfig { enabled:boolean; intervalMinutes:number; maxIssuesPerScan:number; minimumPriority:number; }
export interface DiscoveryScanResult { scannedAt:number; discovered:number; queued:number; skipped:number; issues:DiscoveredIssue[]; }
const KEY='miki_autonomous_issue_discovery_v1';
const CONFIG_KEY='miki_autonomous_issue_discovery_config_v1';
const DEFAULT_CONFIG:DiscoveryConfig={enabled:true,intervalMinutes:180,maxIssuesPerScan:5,minimumPriority:40};
class AutonomousIssueDiscoveryService{
 private issues=new Map<string,DiscoveredIssue>();private config:DiscoveryConfig={...DEFAULT_CONFIG};private timer:ReturnType<typeof setInterval>|null=null;private scanning=false;
 constructor(){this.load();}
 initialize():void{this.configureTimer();if(this.config.enabled)void this.scan();}
 dispose():void{if(this.timer)clearInterval(this.timer);this.timer=null;}
 setConfig(input:Partial<DiscoveryConfig>):DiscoveryConfig{this.config={enabled:input.enabled??this.config.enabled,intervalMinutes:Math.max(15,Math.min(10080,input.intervalMinutes??this.config.intervalMinutes)),maxIssuesPerScan:Math.max(1,Math.min(20,input.maxIssuesPerScan??this.config.maxIssuesPerScan)),minimumPriority:Math.max(0,Math.min(100,input.minimumPriority??this.config.minimumPriority))};storageService.setItem(CONFIG_KEY,JSON.stringify(this.config));this.configureTimer();return {...this.config};}
 getConfig():DiscoveryConfig{return {...this.config};}
 list(limit=100):DiscoveredIssue[]{return [...this.issues.values()].sort((a,b)=>b.priority-a.priority||b.lastSeenAt-a.lastSeenAt||a.kind.localeCompare(b.kind)||a.sourceId.localeCompare(b.sourceId)||a.id.localeCompare(b.id)).slice(0,limit).map(x=>({...x}));}
 recordContradiction(claimId:string,detail:string):DiscoveredIssue{return this.upsert('CLAIM_CONTRADICTION',claimId,`Claim矛盾: ${claimId}`,detail,95);}
 async scan():Promise<DiscoveryScanResult>{
  if(this.scanning)return {scannedAt:Date.now(),discovered:0,queued:0,skipped:0,issues:[]};this.scanning=true;
  try{
   const before=this.issues.size;
   for(const event of executionEventBusService.list('execution.failed').slice(0,50))this.upsert('EXECUTION_FAILURE',event.event_id,`実行失敗: ${event.component_id}`,`${event.test_case_id} / ${event.error_message||event.output_summary||event.type}`,90);
   for(const gap of knowledgeGapService.listOpen(50))this.upsert('KNOWLEDGE_GAP',gap.id,`知識不足: ${gap.query}`,gap.reason||gap.query,70);
   for(const gap of capabilityGapService.getAllGaps().filter(item=>item.status==='OPEN').slice(0,50))this.upsert('CAPABILITY_GAP',gap.gap_id,`能力不足: ${gap.capabilityId}`,gap.description||gap.current_workaround||gap.capabilityId,80);
   for(const task of taskBlackboardService.list(100).filter(item=>item.status==='FAILED'||item.status==='WAITING'||item.status==='PAUSED'))this.upsert('STALLED_TASK',task.taskId,`停滞タスク: ${task.goal}`,task.pausedReason||task.status,65);
   for(const domain of crossDomainCirculationService.getDisconnectedDomains())this.upsert('DOMAIN_DISCONNECTED',domain,`18分類未循環: ${domain}`,`${domain}分類のIN/OUT実績が不足`,45);
   for(const debt of improvementDebtService.listOpen().slice(0,50))this.upsert('IMPROVEMENT_DEBT',debt.debtId,`改善負債: ${debt.kind}`,debt.detail,75);
   const candidates=this.list(200).filter(item=>!item.resolvedAt&&!item.queuedAt&&item.priority>=this.config.minimumPriority).sort((a,b)=>b.priority-a.priority||a.kind.localeCompare(b.kind)||a.sourceId.localeCompare(b.sourceId)||a.id.localeCompare(b.id)).slice(0,this.config.maxIssuesPerScan);let queued=0;
   for(const issue of candidates){
    const changeSetId=issue.changeSetId||evidenceBasedSelfImprovementEngine.generateChangeSetId(issue.id);
    const existingContract=issue.requirementContractId?evidenceBasedSelfImprovementEngine.getContract(issue.requirementContractId):undefined;
    const contract=existingContract||this.buildRequirementContract(issue,changeSetId);
    if(!existingContract)evidenceBasedSelfImprovementEngine.registerContract(contract);
    issue.changeSetId=changeSetId;issue.requirementContractId=contract.contractId;
    await improvementIntakeRouterService.receive({runType:'AUTONOMOUS_DISCOVERY',sourceId:issue.id,objective:issue.title,priority:issue.priority,changeSetId,payload:{issueId:issue.id,kind:issue.kind,detail:issue.detail,fingerprint:issue.fingerprint,changeSetId,contractId:contract.contractId,requirements:contract.requiredBehaviors,prohibitions:contract.forbiddenBehaviors,invariants:['INV_02_PRIVACY_BOUNDARY','INV_04_ROLLBACK_GUARANTEE','INV_05_AUDIT_LOG_IMMUTABILITY'],validationRequirements:contract.acceptanceCriteria}});
    issue.queuedAt=Date.now();this.issues.set(issue.fingerprint,issue);queued+=1;}
   this.save();const issues=this.list(200);return {scannedAt:Date.now(),discovered:Math.max(0,this.issues.size-before),queued,skipped:Math.max(0,issues.filter(x=>!x.resolvedAt&&!x.queuedAt).length),issues};
  }finally{this.scanning=false;}
 }
 private upsert(kind:DiscoveredIssueKind,sourceId:string,title:string,detail:string,priority:number):DiscoveredIssue{const fingerprint=this.fingerprint(`${kind}|${sourceId}|${title}`);const now=Date.now();const old=this.issues.get(fingerprint);const directedPriority=selfImprovementDirectionService.score(kind,title,detail,priority);const issue:DiscoveredIssue={id:old?.id||`ISSUE-${fingerprint.slice(4)}`,fingerprint,changeSetId:old?.changeSetId,requirementContractId:old?.requirementContractId,kind,title,detail,sourceId,priority:Math.max(directedPriority,old?.priority||0),discoveredAt:old?.discoveredAt||now,lastSeenAt:now,occurrences:(old?.occurrences||0)+1,queuedAt:old?.queuedAt,resolvedAt:old?.resolvedAt};this.issues.set(fingerprint,issue);return {...issue};}
 private buildRequirementContract(issue:DiscoveredIssue,changeSetId:ChangeSetID):RequirementContract{
  const specific:{required:string[];criteria:string[];metrics:string[]} = (()=>{
   switch(issue.kind){
    case 'EXECUTION_FAILURE': return {required:['同一失敗シグネチャの再発条件を特定し、安全な代替または修正候補を生成する'],criteria:['同一原因の再現テストが安全に処理される','既存Regression/Counterexample検証を通過する'],metrics:['再発失敗数','Regression通過率']};
    case 'KNOWLEDGE_GAP': return {required:['不足知識をResearch/Evidence/Verification境界へ送る','未検証推測を確定知識として昇格させない'],criteria:['検証可能なEvidenceが取得される','Unsupported claimが自動昇格しない'],metrics:['検証済みEvidence数','未解決Gap状態']};
    case 'CAPABILITY_GAP': return {required:['必要Capabilityの不足を明示し、既存Registry/Promotion Gateを通じた候補化を行う'],criteria:['Capability候補が既存Registry規則に適合する','Verification Gateを経由する'],metrics:['Capability状態','Verification通過率']};
    case 'STALLED_TASK': return {required:['停滞Taskを原因分析し、pause/resume/replanまたは安全終了のいずれかへ遷移させる'],criteria:['Task状態が未確定のまま放置されない','再計画または安全終了の証跡が残る'],metrics:['Task状態','再計画回数']};
    case 'DOMAIN_DISCONNECTED': return {required:['不足している18分類間循環を既存CORE/Cross-Domain経路へ接続する'],criteria:['IN/OUT循環の証跡が記録される','独立Orchestratorを追加しない'],metrics:['Domain循環イベント数']};
    case 'CLAIM_CONTRADICTION': return {required:['矛盾Claimを独立Evidence/Revision規則へ送り、未解決なら保留する'],criteria:['矛盾を事実として上書きしない','Revision結果が追跡可能である'],metrics:['矛盾Claim数','Revision状態']};
    case 'IMPROVEMENT_DEBT': return {required:['既存改善負債を再計画し、必要な検証を完了する'],criteria:['負債に対応する検証証跡が残る','同一負債の無限再試行を防ぐ'],metrics:['Open debt数','再試行回数']};
   }
  })();
  return {contractId:`CTR-${changeSetId}`,requirementId:`REQ-ISSUE-${issue.id}`,title:`自律発見Issue: ${issue.title}`,sourceDirectiveId:issue.id,acceptanceCriteria:specific.criteria,requiredBehaviors:specific.required,forbiddenBehaviors:['未検証外部コードを直接実行・採用しない','COREの許可を迂回して物理変更しない','第2のBlackboard/Truth DB/Orchestratorを作成しない'],observableMetrics:specific.metrics,verdict:'UNTESTED'};
 }

 private configureTimer():void{if(this.timer)clearInterval(this.timer);this.timer=null;if(this.config.enabled)this.timer=setInterval(()=>{void this.scan();},this.config.intervalMinutes*60*1000);}
 private fingerprint(raw:string):string{let h=2166136261;for(const ch of raw.toLowerCase()){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return `ISS-${(h>>>0).toString(16).padStart(8,'0')}`;}
 private save():void{storageService.setItem(KEY,JSON.stringify(this.list(500)));}
 private load():void{try{const raw=storageService.getItem(KEY);const all=raw?JSON.parse(raw):[];if(Array.isArray(all))for(const item of all)this.issues.set(item.fingerprint,item);const configRaw=storageService.getItem(CONFIG_KEY);if(configRaw)this.config={...DEFAULT_CONFIG,...JSON.parse(configRaw)};}catch{this.issues.clear();this.config={...DEFAULT_CONFIG};}}
}
export const autonomousIssueDiscoveryService=new AutonomousIssueDiscoveryService();
