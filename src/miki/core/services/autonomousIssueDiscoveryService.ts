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

export type DiscoveredIssueKind='EXECUTION_FAILURE'|'KNOWLEDGE_GAP'|'CAPABILITY_GAP'|'STALLED_TASK'|'DOMAIN_DISCONNECTED'|'CLAIM_CONTRADICTION'|'IMPROVEMENT_DEBT';
export interface DiscoveredIssue { id:string; fingerprint:string; kind:DiscoveredIssueKind; title:string; detail:string; sourceId:string; priority:number; discoveredAt:number; lastSeenAt:number; occurrences:number; queuedAt?:number; resolvedAt?:number; }
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
 list(limit=100):DiscoveredIssue[]{return [...this.issues.values()].sort((a,b)=>b.priority-a.priority||b.lastSeenAt-a.lastSeenAt).slice(0,limit).map(x=>({...x}));}
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
   const candidates=this.list(200).filter(item=>!item.resolvedAt&&!item.queuedAt&&item.priority>=this.config.minimumPriority).slice(0,this.config.maxIssuesPerScan);let queued=0;
   for(const issue of candidates){await improvementIntakeRouterService.receive({runType:'AUTONOMOUS_DISCOVERY',sourceId:issue.id,objective:issue.title,priority:issue.priority,payload:{issueId:issue.id,kind:issue.kind,detail:issue.detail,fingerprint:issue.fingerprint}});issue.queuedAt=Date.now();this.issues.set(issue.fingerprint,issue);queued+=1;}
   this.save();const issues=this.list(200);return {scannedAt:Date.now(),discovered:Math.max(0,this.issues.size-before),queued,skipped:Math.max(0,issues.filter(x=>!x.resolvedAt&&!x.queuedAt).length),issues};
  }finally{this.scanning=false;}
 }
 private upsert(kind:DiscoveredIssueKind,sourceId:string,title:string,detail:string,priority:number):DiscoveredIssue{const fingerprint=this.fingerprint(`${kind}|${sourceId}|${title}`);const now=Date.now();const old=this.issues.get(fingerprint);const directedPriority=selfImprovementDirectionService.score(kind,title,detail,priority);const issue:DiscoveredIssue={id:old?.id||`ISSUE-${fingerprint.slice(4)}`,fingerprint,kind,title,detail,sourceId,priority:Math.max(directedPriority,old?.priority||0),discoveredAt:old?.discoveredAt||now,lastSeenAt:now,occurrences:(old?.occurrences||0)+1,queuedAt:old?.queuedAt,resolvedAt:old?.resolvedAt};this.issues.set(fingerprint,issue);return {...issue};}
 private configureTimer():void{if(this.timer)clearInterval(this.timer);this.timer=null;if(this.config.enabled)this.timer=setInterval(()=>{void this.scan();},this.config.intervalMinutes*60*1000);}
 private fingerprint(raw:string):string{let h=2166136261;for(const ch of raw.toLowerCase()){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return `ISS-${(h>>>0).toString(16).padStart(8,'0')}`;}
 private save():void{storageService.setItem(KEY,JSON.stringify(this.list(500)));}
 private load():void{try{const raw=storageService.getItem(KEY);const all=raw?JSON.parse(raw):[];if(Array.isArray(all))for(const item of all)this.issues.set(item.fingerprint,item);const configRaw=storageService.getItem(CONFIG_KEY);if(configRaw)this.config={...DEFAULT_CONFIG,...JSON.parse(configRaw)};}catch{this.issues.clear();this.config={...DEFAULT_CONFIG};}}
}
export const autonomousIssueDiscoveryService=new AutonomousIssueDiscoveryService();
