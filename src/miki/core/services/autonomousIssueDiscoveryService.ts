import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { executionEventBusService } from '../../execution/services/executionEventBusService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { taskCaseMemoryService } from '../../memory/services/taskCaseMemoryService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { taskBlackboardService } from './taskBlackboardService';
import { crossDomainCirculationService } from './crossDomainCirculationService';
import { autonomousSelfImprovementLoopService } from './autonomousSelfImprovementLoopService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { selfImprovementDirectionService } from './selfImprovementDirectionService';
import { improvementDebtService } from './improvementDebtService';
import type { ChangeSetID } from '../../../types/evidenceSelfImprovementTypes';

export type DiscoveredIssueKind='EXECUTION_FAILURE'|'KNOWLEDGE_GAP'|'CAPABILITY_GAP'|'STALLED_TASK'|'DOMAIN_DISCONNECTED'|'CLAIM_CONTRADICTION'|'IMPROVEMENT_DEBT';
export interface DiscoveredIssue {
 id:string;
 fingerprint:string;
 changeSetId?:ChangeSetID;
 requirementContractId?:string;
 improvementRunId?:string;
 taskId?:string;
 kind:DiscoveredIssueKind;
 title:string;
 detail:string;
 sourceId:string;
 priority:number;
 discoveredAt:number;
 lastSeenAt:number;
 occurrences:number;
 queuedAt?:number;
 resolvedAt?:number;
 retryCount?:number;
 nextRetryAt?:number;
 exhausted?:boolean;
 lastOutcome?:string;
}
export interface DiscoveryConfig { enabled:boolean; intervalMinutes:number; maxIssuesPerScan:number; minimumPriority:number; }
export type DiscoveryScanMode='AUTONOMOUS'|'DIAGNOSTIC';
export interface DiscoveryScanResult { scannedAt:number; mode:DiscoveryScanMode; discovered:number; queued:number; skipped:number; issues:DiscoveredIssue[]; }
export type DiscoveryPersistenceStatus='READY'|'RECOVERED_QUARANTINED'|'WRITE_BLOCKED';
export interface DiscoveryPersistenceState { status:DiscoveryPersistenceStatus; reason?:string; }
const ISSUE_KINDS:DiscoveredIssueKind[]=['EXECUTION_FAILURE','KNOWLEDGE_GAP','CAPABILITY_GAP','STALLED_TASK','DOMAIN_DISCONNECTED','CLAIM_CONTRADICTION','IMPROVEMENT_DEBT'];
const KEY='miki_autonomous_issue_discovery_v1';
const CONFIG_KEY='miki_autonomous_issue_discovery_config_v1';
const DEFAULT_CONFIG:DiscoveryConfig={enabled:true,intervalMinutes:180,maxIssuesPerScan:5,minimumPriority:40};
class AutonomousIssueDiscoveryService{
 private issues=new Map<string,DiscoveredIssue>();private config:DiscoveryConfig={...DEFAULT_CONFIG};private timer:ReturnType<typeof setInterval>|null=null;private retryTimer:ReturnType<typeof setTimeout>|null=null;private scanning=false;private activeScanGeneration:number|null=null;private lifecycleGeneration=0;
  private disposed=false;
 private persistenceStatus:DiscoveryPersistenceStatus='READY';private persistenceReason?:string;private writesBlocked=false;
 constructor(){this.load();}
 private isCurrentGeneration(generation:number):boolean{return !this.disposed&&generation===this.lifecycleGeneration;}
 private emptyScanResult(mode:DiscoveryScanMode):DiscoveryScanResult{return {scannedAt:Date.now(),mode,discovered:0,queued:0,skipped:0,issues:[]};}
 initialize():void{if(this.writesBlocked){systemLogger.error('PERSISTENCE','[IssueDiscovery] initialization blocked because state could not be preserved',{reason:this.persistenceReason});return;}this.disposed=false;this.configureTimer();if(this.config.enabled)this.runScheduledScan();}
 dispose():void{this.disposed=true;this.lifecycleGeneration+=1;this.scanning=false;this.activeScanGeneration=null;if(this.timer)clearInterval(this.timer);this.timer=null;if(this.retryTimer)clearTimeout(this.retryTimer);this.retryTimer=null;}
 setConfig(input:Partial<DiscoveryConfig>):DiscoveryConfig{this.assertWritable();const interval=input.intervalMinutes??this.config.intervalMinutes;const batch=input.maxIssuesPerScan??this.config.maxIssuesPerScan;const priority=input.minimumPriority??this.config.minimumPriority;const next:DiscoveryConfig={enabled:input.enabled??this.config.enabled,intervalMinutes:Math.max(15,Math.min(10080,Math.floor(Number.isFinite(interval)?interval:this.config.intervalMinutes))),maxIssuesPerScan:Math.max(1,Math.min(20,Number.isFinite(batch)?Math.floor(batch):this.config.maxIssuesPerScan)),minimumPriority:Math.max(0,Math.min(100,Math.floor(Number.isFinite(priority)?priority:this.config.minimumPriority)))};this.writeRaw(CONFIG_KEY,JSON.stringify(next),'CONFIG');this.config=next;this.configureTimer();return {...this.config};}
 getConfig():DiscoveryConfig{return {...this.config};}
 getPersistenceState():DiscoveryPersistenceState{return {status:this.persistenceStatus,...(this.persistenceReason?{reason:this.persistenceReason}:{})};}
 list(limit=100):DiscoveredIssue[]{return [...this.issues.values()].sort((a,b)=>b.priority-a.priority||b.lastSeenAt-a.lastSeenAt||a.kind.localeCompare(b.kind)||a.sourceId.localeCompare(b.sourceId)||a.id.localeCompare(b.id)).slice(0,limit).map(x=>({...x}));}
 recordContradiction(claimId:string,detail:string):DiscoveredIssue{this.assertWritable();const previous=new Map(this.issues);const issue=this.upsert('CLAIM_CONTRADICTION',claimId,`Claim矛盾: ${claimId}`,detail,95);try{this.save();return issue;}catch(error){this.issues=previous;throw error;}}
 async scan(mode:DiscoveryScanMode='AUTONOMOUS'):Promise<DiscoveryScanResult>{
  if(this.disposed)throw new Error('AUTONOMOUS_DISCOVERY_SERVICE_DISPOSED');
  this.assertWritable();
  const generation=this.lifecycleGeneration;
  if(this.scanning)return {scannedAt:Date.now(),mode,discovered:0,queued:0,skipped:0,issues:[]};this.scanning=true;this.activeScanGeneration=generation;
  try{
   await this.reconcileQueuedIssues(generation);
   if(!this.isCurrentGeneration(generation))return this.emptyScanResult(mode);
   const before=this.issues.size;
   for(const event of executionEventBusService.list('execution.failed').slice(0,50))this.upsert('EXECUTION_FAILURE',event.event_id,`実行失敗: ${event.component_id}`,`${event.test_case_id} / ${event.error_message||event.output_summary||event.type}`,90);
   for(const gap of knowledgeGapService.listOpen(50))this.upsert('KNOWLEDGE_GAP',gap.id,`知識不足: ${gap.query}`,gap.reason||gap.query,70);
   for(const gap of capabilityGapService.getAllGaps().filter(item=>item.status==='OPEN').slice(0,50))this.upsert('CAPABILITY_GAP',gap.gap_id,`能力不足: ${gap.capabilityId}`,gap.description||gap.current_workaround||gap.capabilityId,80);
   for(const task of taskBlackboardService.list(100).filter(item=>this.isStallCandidate(item.status,item.pausedReason))){
    const goal=this.normalizeDiagnosticPrefixes(task.goal);
    this.upsert('STALLED_TASK',task.taskId,`停滞タスク: ${goal}`,task.pausedReason||task.status,65);
   }
   for(const domain of crossDomainCirculationService.getDisconnectedDomains())this.upsert('DOMAIN_DISCONNECTED',domain,`18分類未循環: ${domain}`,`${domain}分類のIN/OUT実績が不足`,45);
   for(const debt of improvementDebtService.listOpen().slice(0,50))this.upsert('IMPROVEMENT_DEBT',debt.debtId,`改善負債: ${debt.kind}`,debt.detail,75);

   let queued=0;
   if(mode==='AUTONOMOUS'){
    const candidates=this.list(200).filter(item=>this.isActionableIssue(item)&&!item.resolvedAt&&!item.queuedAt&&!item.exhausted&&(!item.nextRetryAt||item.nextRetryAt<=Date.now())&&item.priority>=this.config.minimumPriority).sort((a,b)=>b.priority-a.priority||a.kind.localeCompare(b.kind)||a.sourceId.localeCompare(b.sourceId)||a.id.localeCompare(b.id)).slice(0,this.config.maxIssuesPerScan);
    for(const issue of candidates){
     if(autonomousSelfImprovementLoopService.getPersistenceState().status==='WRITE_BLOCKED')break;
     const issueEnvironment=issue.kind==='EXECUTION_FAILURE'
      ? executionEventBusService.list('execution.failed').find(event=>event.event_id===issue.sourceId)?.environment
      : undefined;
     const priorCases=taskCaseMemoryService.findRelevantCases(
      `${issue.title} ${issue.detail}`,issueEnvironment,5
     ).map(record=>({
      caseId:record.case_id,
      outcome:record.outcome,
      maturity:record.maturity,
      goal:record.goal.slice(0,160),
      environment:record.environment,
      componentIds:record.component_ids.slice(0,3),
      implementationHashes:Object.entries(record.implementation_hashes).slice(0,3),
      evidenceEventIds:record.evidence_event_ids.slice(0,3),
      outputSummary:String(record.output_summary||'').slice(0,180),
      errorMessage:String(record.error_message||'').slice(0,240),
      updatedAt:record.updated_at
     }));
     issue.queuedAt=Date.now();
     issue.nextRetryAt=undefined;
     issue.lastOutcome='DISPATCH_PENDING';
     this.issues.set(issue.fingerprint,issue);
     this.save();
     const dispatched=await this.dispatchDiscoveredIssue(issue,priorCases,generation);
     if(!this.isCurrentGeneration(generation))return this.emptyScanResult(mode);
     if(dispatched)queued+=1;
    }
   }

   if(!this.isCurrentGeneration(generation))return this.emptyScanResult(mode);
   this.save();
   const issues=this.list(200);
   return {
    scannedAt:Date.now(),
    mode,
    discovered:Math.max(0,this.issues.size-before),
    queued,
    skipped:Math.max(0,issues.filter(x=>!x.resolvedAt&&!x.queuedAt).length),
    issues
   };
  }finally{if(this.activeScanGeneration===generation){this.scanning=false;this.activeScanGeneration=null;}if(this.isCurrentGeneration(generation))this.scheduleRetryWakeup();}
 }

 private async reconcileQueuedIssues(generation:number):Promise<void>{
  const now=Date.now();
  const runs=improvementIntakeRouterService.list(500);
  const tasks=taskBlackboardService.list(200);
  for(const issue of this.issues.values()){
   if(!this.isCurrentGeneration(generation))return;
   const queuedAt=issue.queuedAt;
   if(!queuedAt)continue;
   if(issue.lastOutcome==='AUTONOMOUS_QUEUE_WRITE_BLOCKED'&&autonomousSelfImprovementLoopService.getPersistenceState().status==='WRITE_BLOCKED')continue;
   if(issue.lastOutcome==='ORPHAN_TASK_RECOVERY_UNVERIFIED'&&issue.exhausted)continue;
   if(issue.lastOutcome==='ORPHAN_TASK_RECOVERY_PENDING'){
    if(issue.nextRetryAt&&issue.nextRetryAt>now)continue;
    issue.nextRetryAt=undefined;
   }

   let run=issue.improvementRunId
    ? improvementIntakeRouterService.get(issue.improvementRunId)
    : undefined;
   if(!run){
    run=runs.find(item=>
     item.runType==='AUTONOMOUS_DISCOVERY'&&
     (item.sourceId===issue.id||String(item.payload.issueId||'')===issue.id)
    );
   }
   let task=run?.taskId?taskBlackboardService.get(run.taskId)
    :issue.taskId?taskBlackboardService.get(issue.taskId):undefined;

   if(!run||!run.taskId||!task||run.status==='VALIDATED'){
    const orphanTask=this.findAutonomousDiscoveryTask(issue,tasks);
    if(orphanTask){
     let recovered:Awaited<ReturnType<typeof improvementIntakeRouterService.recoverAutonomousDiscoveryFromTask>>|undefined;
     try{
      recovered=await improvementIntakeRouterService.recoverAutonomousDiscoveryFromTask({
       taskId:orphanTask.taskId,
       issueId:issue.id,
       issueKind:issue.kind,
       fingerprint:issue.fingerprint,
       objective:issue.title,
       priority:issue.priority
      });
      if(!this.isCurrentGeneration(generation))return;
      if(!recovered){
       issue.taskId=orphanTask.taskId;
       issue.improvementRunId=this.autonomousDiscoveryRunId(orphanTask);
       issue.nextRetryAt=undefined;
       issue.exhausted=true;
       issue.lastOutcome='ORPHAN_TASK_RECOVERY_UNVERIFIED';
       this.issues.set(issue.fingerprint,issue);
       systemLogger.error('SELF_IMPROVEMENT','[IssueDiscovery] found an orphan Task but its intake identity could not be proven',{issueId:issue.id,taskId:orphanTask.taskId});
       continue;
      }
      run=recovered;
      task=run.taskId?taskBlackboardService.get(run.taskId):undefined;
      if(!task||task.taskId!==orphanTask.taskId)throw new Error('AUTONOMOUS_DISCOVERY_ORPHAN_TASK_ID_MISMATCH');
     }catch(error){
      if(!this.isCurrentGeneration(generation))return;
      issue.taskId=orphanTask.taskId;
      issue.improvementRunId=this.autonomousDiscoveryRunId(orphanTask);
      issue.nextRetryAt=Date.now()+15*60*1000;
      issue.lastOutcome='ORPHAN_TASK_RECOVERY_PENDING';
      this.issues.set(issue.fingerprint,issue);
      systemLogger.warn('SELF_IMPROVEMENT','[IssueDiscovery] orphan Task recovery deferred for a bounded retry',{issueId:issue.id,taskId:orphanTask.taskId,error:String(error instanceof Error?error.message:error)});
      continue;
     }
    }else if(!run){
     if(now-queuedAt>=30*60*1000)this.releaseForRetry(issue,'INTAKE_RUN_MISSING');
     continue;
    }
   }

   if(!run){
    if(now-queuedAt>=30*60*1000)this.releaseForRetry(issue,'INTAKE_RUN_MISSING');
    continue;
   }
   issue.improvementRunId=run.runId;
   issue.taskId=run.taskId||issue.taskId;
   task=issue.taskId?taskBlackboardService.get(issue.taskId):undefined;
   if(!task&&run.status==='VALIDATED'){
    improvementIntakeRouterService.reject(run.runId);
    this.releaseForRetry(issue,'INTAKE_VALIDATED_WITHOUT_TASK');
    continue;
   }
   const terminalTask=Boolean(task&&
    ['COMPLETED','FAILED','CANCELLED'].includes(task.status)
   );

   if(this.isSourceResolved(issue)&&terminalTask){
    if(task?.status==='COMPLETED'&&run.status!=='REJECTED'){
     improvementIntakeRouterService.update(run.runId,{status:'COMPLETED'});
    }else if(task?.status!=='COMPLETED'){
     improvementIntakeRouterService.reject(run.runId);
    }
    issue.resolvedAt=now;
    issue.queuedAt=undefined;
    issue.improvementRunId=undefined;
    issue.taskId=undefined;
    issue.nextRetryAt=undefined;
    issue.exhausted=false;
    issue.lastOutcome='SOURCE_RESOLVED_AFTER_TERMINAL_TASK';
    this.issues.set(issue.fingerprint,issue);
    continue;
   }

   if(task?.status==='CANCELLED'){
    improvementIntakeRouterService.reject(run.runId);
    issue.queuedAt=undefined;
    issue.improvementRunId=undefined;
    issue.taskId=undefined;
    issue.nextRetryAt=undefined;
    issue.exhausted=true;
    issue.lastOutcome='TASK_CANCELLED_NOT_AUTO_RETRIED';
    this.issues.set(issue.fingerprint,issue);
    continue;
   }

   if(run.status==='REJECTED'||task?.status==='FAILED'){
    improvementIntakeRouterService.reject(run.runId);
    this.releaseForRetry(
     issue,
     task?.status==='FAILED'?'TASK_FAILED':'INTAKE_REJECTED'
    );
    continue;
   }

   if(task?.status==='COMPLETED'||run.status==='COMPLETED'){
    if(task?.status==='COMPLETED'){
     improvementIntakeRouterService.update(run.runId,{status:'COMPLETED'});
    }
    this.releaseForRetry(issue,'TASK_COMPLETED_SOURCE_STILL_OPEN');
    continue;
   }

   if(!task&&now-queuedAt>=6*60*60*1000){
    improvementIntakeRouterService.reject(run.runId);
    this.releaseForRetry(issue,'TASK_RECORD_MISSING');
    continue;
   }

   if(issue.lastOutcome==='ORPHAN_TASK_RECOVERY_PENDING')issue.nextRetryAt=undefined;
   issue.exhausted=false;
   issue.lastOutcome='QUEUED';
   this.issues.set(issue.fingerprint,issue);
  }
 }

 private findAutonomousDiscoveryTask(issue:DiscoveredIssue,tasks:ReturnType<typeof taskBlackboardService.list> = taskBlackboardService.list(200)){
  const matches=tasks.filter(task=>{
   const entry=task.entries.find(item=>item.kind==='INPUT'&&item.key==='payload');
   const value=entry?.value;
   if(!value||typeof value!=='object'||Array.isArray(value))return false;
   const payload=value as Record<string,unknown>;
   return payload.issueId===issue.id&&
    payload.issueKind===issue.kind&&
    payload.fingerprint===issue.fingerprint&&
    payload.runType==='AUTONOMOUS_DISCOVERY'&&
    payload.sourceId===issue.id;
  });
  if(issue.improvementRunId){
   const linked=matches.find(task=>this.autonomousDiscoveryRunId(task)===issue.improvementRunId);
   if(linked)return linked;
  }
  return matches[0];
 }
 private autonomousDiscoveryRunId(task:NonNullable<ReturnType<typeof taskBlackboardService.get>>):string|undefined{
  const entry=task.entries.find(item=>item.kind==='INPUT'&&item.key==='payload');
  const value=entry?.value;
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const runId=(value as Record<string,unknown>).runId;
  return typeof runId==='string'&&runId.trim()?runId:undefined;
 }
 private async dispatchDiscoveredIssue(issue:DiscoveredIssue,priorCases:unknown[],generation:number):Promise<boolean>{
  let run:Awaited<ReturnType<typeof improvementIntakeRouterService.receive>>|undefined;
  try{
   run=await improvementIntakeRouterService.receive({
    runType:'AUTONOMOUS_DISCOVERY',
    sourceId:issue.id,
    objective:issue.title,
    priority:issue.priority,
    payload:{
     issueId:issue.id,
     issueKind:issue.kind,
     detail:issue.detail,
     fingerprint:issue.fingerprint,
     priorCases
    }
   });
   if(!this.isCurrentGeneration(generation))return false;
   if(!run.taskId||run.status==='VALIDATED'||!taskBlackboardService.get(run.taskId))throw new Error('INTAKE_ACCEPTED_WITHOUT_TASK');
  }catch(error){
   if(!this.isCurrentGeneration(generation))return false;
   if(autonomousSelfImprovementLoopService.getPersistenceState().status==='WRITE_BLOCKED'){
    issue.nextRetryAt=undefined;
    issue.lastOutcome='AUTONOMOUS_QUEUE_WRITE_BLOCKED';
    this.issues.set(issue.fingerprint,issue);
    this.save();
    systemLogger.error('PERSISTENCE','[IssueDiscovery] CORE queue persistence is blocked; dispatch retry is stopped',{issueId:issue.id,error:String(error instanceof Error?error.message:error)});
    return false;
   }
   const orphanTask=this.findAutonomousDiscoveryTask(issue);
   if(!orphanTask){
    this.releaseForRetry(issue,'INTAKE_DISPATCH_FAILED');
    this.issues.set(issue.fingerprint,issue);
    this.save();
    systemLogger.error('SELF_IMPROVEMENT','[IssueDiscovery] intake dispatch failed; bounded retry scheduled',{issueId:issue.id,error:String(error instanceof Error?error.message:error)});
    return false;
   }
   try{
    run=await improvementIntakeRouterService.recoverAutonomousDiscoveryFromTask({
     taskId:orphanTask.taskId,
     issueId:issue.id,
     issueKind:issue.kind,
     fingerprint:issue.fingerprint,
     objective:issue.title,
     priority:issue.priority
    });
    if(!this.isCurrentGeneration(generation))return false;
    if(!run){
     issue.taskId=orphanTask.taskId;
     issue.improvementRunId=this.autonomousDiscoveryRunId(orphanTask);
     issue.nextRetryAt=undefined;
     issue.exhausted=true;
     issue.lastOutcome='ORPHAN_TASK_RECOVERY_UNVERIFIED';
     this.issues.set(issue.fingerprint,issue);
     this.save();
     systemLogger.error('SELF_IMPROVEMENT','[IssueDiscovery] orphan Task identity is incomplete; duplicate dispatch blocked',{issueId:issue.id,taskId:orphanTask.taskId});
     return false;
    }
    if(run.taskId!==orphanTask.taskId||!taskBlackboardService.get(run.taskId))throw new Error('AUTONOMOUS_DISCOVERY_ORPHAN_TASK_ID_MISMATCH');
   }catch(recoveryError){
    if(!this.isCurrentGeneration(generation))return false;
    issue.taskId=orphanTask.taskId;
    issue.improvementRunId=this.autonomousDiscoveryRunId(orphanTask);
    issue.nextRetryAt=Date.now()+15*60*1000;
    issue.lastOutcome='ORPHAN_TASK_RECOVERY_PENDING';
    this.issues.set(issue.fingerprint,issue);
    this.save();
    systemLogger.warn('SELF_IMPROVEMENT','[IssueDiscovery] orphan Task recovery deferred for a bounded retry',{issueId:issue.id,taskId:orphanTask.taskId,error:String(recoveryError instanceof Error?recoveryError.message:recoveryError)});
    return false;
   }
  }
  if(run?.taskId){
   const recoveredTask=taskBlackboardService.get(run.taskId);
   if(recoveredTask&&(['COMPLETED','FAILED','CANCELLED'].includes(recoveredTask.status)||run.status==='REJECTED'||run.status==='COMPLETED')){
    issue.changeSetId=run.changeSetId;
    issue.improvementRunId=run.runId;
    issue.taskId=run.taskId;
    issue.queuedAt=issue.queuedAt||Date.now();
    issue.nextRetryAt=undefined;
    issue.lastOutcome='RECOVERED_ORPHAN_TASK_TERMINAL';
    this.issues.set(issue.fingerprint,issue);
    this.save();
    return false;
   }
  }
  if(!run||!run.taskId||!taskBlackboardService.get(run.taskId)){
   this.releaseForRetry(issue,'INTAKE_DISPATCH_FAILED');
   this.issues.set(issue.fingerprint,issue);
   this.save();
   return false;
  }
  issue.changeSetId=run.changeSetId;
  issue.improvementRunId=run.runId;
  issue.taskId=run.taskId;
  issue.queuedAt=issue.queuedAt||Date.now();
  issue.nextRetryAt=undefined;
  issue.exhausted=false;
  issue.lastOutcome='QUEUED';
  this.issues.set(issue.fingerprint,issue);
  this.save();
  return true;
 }
 private scheduleRetryWakeup():void{
  if(this.retryTimer)clearTimeout(this.retryTimer);
  this.retryTimer=null;
  if(this.disposed||!this.config.enabled||this.writesBlocked||autonomousSelfImprovementLoopService.getPersistenceState().status==='WRITE_BLOCKED')return;
  const now=Date.now();
  let earliest:number|undefined;
  const consider=(deadline:number)=>{
   if(Number.isFinite(deadline))earliest=earliest===undefined?deadline:Math.min(earliest,deadline);
  };
  const runs=improvementIntakeRouterService.list(500);
  for(const issue of this.issues.values()){
   if(issue.resolvedAt)continue;
   if(typeof issue.nextRetryAt==='number'&&Number.isFinite(issue.nextRetryAt))consider(issue.nextRetryAt);
   if(!issue.queuedAt||(issue.exhausted&&issue.lastOutcome==='ORPHAN_TASK_RECOVERY_UNVERIFIED'))continue;
   if(issue.lastOutcome==='ORPHAN_TASK_RECOVERY_PENDING')continue;
   let run=issue.improvementRunId?improvementIntakeRouterService.get(issue.improvementRunId):undefined;
   if(!run)run=runs.find(item=>item.runType==='AUTONOMOUS_DISCOVERY'&&(item.sourceId===issue.id||String(item.payload.issueId||'')===issue.id));
   if(!run){
    consider(issue.queuedAt+30*60*1000);
    continue;
   }
   const taskId=run.taskId||issue.taskId;
   const task=taskId?taskBlackboardService.get(taskId):undefined;
   if((run.status==='VALIDATED'||run.status==='REJECTED'||run.status==='COMPLETED')&&!task){
    consider(now+1000);
   }else if(!task){
    consider(issue.queuedAt+6*60*60*1000);
   }else if(['COMPLETED','FAILED','CANCELLED'].includes(task.status)||run.status==='REJECTED'||run.status==='COMPLETED'){
    consider(now+1000);
   }
  }
  if(earliest===undefined)return;
  const delay=Math.max(25,Math.min(2147000000,earliest-Date.now()));
  const generation=this.lifecycleGeneration;
  this.retryTimer=setTimeout(()=>{if(!this.isCurrentGeneration(generation))return;this.retryTimer=null;this.runScheduledScan();},delay);
 }

 private releaseForRetry(issue:DiscoveredIssue,outcome:string):void{
  const attempts=(issue.retryCount||0)+1;
  issue.retryCount=attempts;
  issue.queuedAt=undefined;
  issue.improvementRunId=undefined;
  issue.taskId=undefined;
  issue.lastOutcome=outcome;

  if(attempts>=4){
   issue.exhausted=true;
   issue.nextRetryAt=undefined;
  }else{
   issue.exhausted=false;
   issue.nextRetryAt=Date.now()+
    Math.min(24*60*60*1000,15*60*1000*(2**(attempts-1)));
  }

  this.issues.set(issue.fingerprint,issue);
 }

 private isSourceResolved(issue:DiscoveredIssue):boolean{
  switch(issue.kind){
   case 'KNOWLEDGE_GAP':
    return knowledgeGapService.getById(issue.sourceId)?.status==='RESOLVED';
   case 'CAPABILITY_GAP':
    return capabilityGapService.getAllGaps().some(
     gap=>gap.gap_id===issue.sourceId&&gap.status==='RESOLVED'
    );
   case 'STALLED_TASK':{
    const task=taskBlackboardService.get(issue.sourceId);
    return !task||!this.isStallCandidate(task.status,task.pausedReason);
   }
   case 'DOMAIN_DISCONNECTED':
    return !crossDomainCirculationService.getDisconnectedDomains().some(domain=>String(domain)===issue.sourceId);
   case 'IMPROVEMENT_DEBT':
    return !improvementDebtService.listOpen().some(debt=>debt.debtId===issue.sourceId);
   case 'EXECUTION_FAILURE':{
    const failure=executionEventBusService.list('execution.failed')
     .find(event=>event.event_id===issue.sourceId);
    if(!failure)return false;
    const latestOutcome=[
     ...executionEventBusService.list('execution.completed'),
     ...executionEventBusService.list('execution.failed'),
     ...executionEventBusService.list('execution.rejected'),
     ...executionEventBusService.list('execution.inconclusive')
    ].filter(event=>
     event.created_at>failure.created_at&&
     event.component_id===failure.component_id&&
     event.implementation_hash===failure.implementation_hash&&
     event.environment===failure.environment&&
     event.test_category===failure.test_category&&
     event.test_case_id===failure.test_case_id
    ).sort((a,b)=>b.created_at-a.created_at)[0];
    return latestOutcome?.type==='execution.completed'&&latestOutcome.passed===true;
   }
   default:
    return false;
  }
 }

 private isStallCandidate(status:string,pausedReason?:string):boolean{
  if(status==='FAILED'||status==='WAITING')return true;
  if(status!=='PAUSED')return false;
  return pausedReason!=='SELF_IMPROVEMENT_QUEUED'&&pausedReason!=='FOREGROUND_USER_REQUEST_ACTIVE';
 }
 private isActionableIssue(issue:DiscoveredIssue):boolean{
  if(issue.kind!=='STALLED_TASK')return true;
  const task=taskBlackboardService.get(issue.sourceId);
  if(!task||!this.isStallCandidate(task.status,task.pausedReason)){
   issue.resolvedAt=Date.now();
   this.issues.set(issue.fingerprint,issue);
   return false;
  }
  return true;
 }
 private normalizeDiagnosticPrefixes(value:string):string{
  let text=String(value||'').trim();
  const prefixes=['停滞タスク:','改善負債:','能力不足:','知識不足:','実行失敗:','18分類未循環:','Claim矛盾:'];
  let changed=true;
  while(changed){
   changed=false;
   for(const prefix of prefixes){
    const pattern=new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\]/g,'\\\\$&')}\\s*`,'u');
    const match=text.match(pattern);
    if(match){
     text=text.slice(match[0].length).trim();
     changed=true;
    }
   }
  }
  return text||'作業タスク';
 }
 private upsert(kind:DiscoveredIssueKind,sourceId:string,title:string,detail:string,priority:number):DiscoveredIssue{
  const fingerprint=this.fingerprint(`${kind}|${sourceId}|${title}`);
  const now=Date.now();
  const old=this.issues.get(fingerprint);
  const detailChanged=Boolean(old&&old.detail!==detail);
  const canReset=detailChanged&&!old?.queuedAt;
  const directedPriority=selfImprovementDirectionService.score(kind,title,detail,priority);
  const issue:DiscoveredIssue={
   id:old?.id||`ISSUE-${fingerprint.slice(4)}`,
   fingerprint,
   changeSetId:old?.changeSetId,
   requirementContractId:old?.requirementContractId,
   improvementRunId:old?.improvementRunId,
   taskId:old?.taskId,
   kind,title,detail,sourceId,
   priority:Math.max(directedPriority,old?.priority||0),
   discoveredAt:old?.discoveredAt||now,
   lastSeenAt:now,
   occurrences:(old?.occurrences||0)+1,
   queuedAt:old?.queuedAt,
   resolvedAt:detailChanged?undefined:old?.resolvedAt,
   retryCount:canReset?0:(old?.retryCount||0),
   nextRetryAt:canReset?undefined:old?.nextRetryAt,
   exhausted:canReset?false:old?.exhausted,
   lastOutcome:canReset?'ISSUE_DETAIL_CHANGED':old?.lastOutcome
  };
  this.issues.set(fingerprint,issue);
  return {...issue};
 }

 private runScheduledScan():void{if(this.disposed||this.writesBlocked)return;void this.scan().catch(error=>systemLogger.error('SELF_IMPROVEMENT','[IssueDiscovery] autonomous scan stopped before unsafe follow-up',{error:String(error instanceof Error?error.message:error),persistence:this.getPersistenceState()}));}
 private configureTimer():void{if(this.timer)clearInterval(this.timer);this.timer=null;const generation=this.lifecycleGeneration;if(!this.disposed&&this.config.enabled&&!this.writesBlocked)this.timer=setInterval(()=>{if(this.isCurrentGeneration(generation))this.runScheduledScan();},this.config.intervalMinutes*60*1000);this.scheduleRetryWakeup();}
 private fingerprint(raw:string):string{let h=2166136261;for(const ch of raw.toLowerCase()){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return `ISS-${(h>>>0).toString(16).padStart(8,'0')}`;}
 private assertWritable():void{if(this.writesBlocked)throw new Error('AUTONOMOUS_DISCOVERY_STORE_WRITE_BLOCKED');}
 private blockStore(reason:string):void{this.writesBlocked=true;this.persistenceStatus='WRITE_BLOCKED';this.persistenceReason=reason.slice(0,700);if(this.timer)clearInterval(this.timer);this.timer=null;if(this.retryTimer)clearTimeout(this.retryTimer);this.retryTimer=null;}
 private writeRaw(key:string,raw:string,context:string):void{this.assertWritable();try{storageService.setItem(key,raw);if(storageService.getItem(key)!==raw)throw new Error('STORE_READBACK_MISMATCH');}catch(error){this.blockStore(`${context}:${String(error instanceof Error?error.message:error)}`);throw new Error('AUTONOMOUS_DISCOVERY_STORE_WRITE_VERIFY_FAILED');}}
 private quarantine(sourceKey:string,raw:string,reason:string):boolean{const base=`${sourceKey}_quarantine_v1`;const envelope={version:1,sourceKey,quarantinedAt:Date.now(),reason:reason.slice(0,500),raw};try{let destination=base;const existing=storageService.getItem(base);if(existing!==null){try{const parsed=JSON.parse(existing) as Record<string,unknown>;if(parsed.version===1&&parsed.sourceKey===sourceKey&&parsed.raw===raw)return true;}catch{}let suffix=0;do{destination=`${base}_${Date.now()}_${suffix++}`;if(suffix>1000)return false;}while(storageService.getItem(destination)!==null);}storageService.setItem(destination,JSON.stringify(envelope));const saved=storageService.getItem(destination);if(saved===null)return false;const parsed=JSON.parse(saved) as Record<string,unknown>;return parsed.version===1&&parsed.sourceKey===sourceKey&&parsed.raw===raw;}catch{return false;}}
 private recoverCorruptSnapshot(sourceKey:string,raw:string,error:unknown):void{const reason=String(error instanceof Error?error.message:error).slice(0,500);if(this.quarantine(sourceKey,raw,reason)){if(this.writesBlocked)return;this.persistenceStatus='RECOVERED_QUARANTINED';this.persistenceReason=`${sourceKey}_QUARANTINED:${reason}`;if(sourceKey===KEY)this.issues.clear();}else this.blockStore(`${sourceKey}_QUARANTINE_FAILED:${reason}`);}
 private parseIssueSnapshot(raw:string):DiscoveredIssue[]{const parsed:unknown=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>500)throw new Error('DISCOVERY_SNAPSHOT_INVALID_ROOT_OR_LIMIT');const ids=new Set<string>();const fingerprints=new Set<string>();for(const item of parsed){if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('DISCOVERY_SNAPSHOT_INVALID_RECORD');const row=item as Record<string,unknown>;if(typeof row.id!=='string'||!row.id.trim()||typeof row.fingerprint!=='string'||!row.fingerprint.trim()||typeof row.kind!=='string'||!ISSUE_KINDS.includes(row.kind as DiscoveredIssueKind)||typeof row.title!=='string'||!row.title.trim()||typeof row.detail!=='string'||typeof row.sourceId!=='string'||!row.sourceId.trim()||typeof row.priority!=='number'||!Number.isFinite(row.priority)||row.priority<0||row.priority>100||typeof row.discoveredAt!=='number'||!Number.isFinite(row.discoveredAt)||row.discoveredAt<0||typeof row.lastSeenAt!=='number'||!Number.isFinite(row.lastSeenAt)||row.lastSeenAt<0||typeof row.occurrences!=='number'||!Number.isInteger(row.occurrences)||row.occurrences<1)throw new Error('DISCOVERY_SNAPSHOT_INVALID_FIELDS');if(ids.has(row.id)||fingerprints.has(row.fingerprint))throw new Error('DISCOVERY_SNAPSHOT_DUPLICATE_IDENTITY');ids.add(row.id);fingerprints.add(row.fingerprint);for(const key of ['changeSetId','requirementContractId','improvementRunId','taskId','lastOutcome'])if(row[key]!==undefined&&typeof row[key]!=='string')throw new Error('DISCOVERY_SNAPSHOT_INVALID_OPTIONAL_STRING');for(const key of ['queuedAt','resolvedAt','nextRetryAt'])if(row[key]!==undefined&&(typeof row[key]!=='number'||!Number.isFinite(row[key])||(row[key] as number)<0))throw new Error('DISCOVERY_SNAPSHOT_INVALID_OPTIONAL_TIME');if(row.retryCount!==undefined&&(typeof row.retryCount!=='number'||!Number.isInteger(row.retryCount)||row.retryCount<0))throw new Error('DISCOVERY_SNAPSHOT_INVALID_RETRY_COUNT');if(row.exhausted!==undefined&&typeof row.exhausted!=='boolean')throw new Error('DISCOVERY_SNAPSHOT_INVALID_EXHAUSTED_FLAG');}return parsed as DiscoveredIssue[];}
 private parseConfig(raw:string):DiscoveryConfig{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DISCOVERY_CONFIG_INVALID_ROOT');const merged={...DEFAULT_CONFIG,...value as Partial<DiscoveryConfig>};if(typeof merged.enabled!=='boolean'||typeof merged.intervalMinutes!=='number'||!Number.isInteger(merged.intervalMinutes)||merged.intervalMinutes<15||merged.intervalMinutes>10080||typeof merged.maxIssuesPerScan!=='number'||!Number.isInteger(merged.maxIssuesPerScan)||merged.maxIssuesPerScan<1||merged.maxIssuesPerScan>20||typeof merged.minimumPriority!=='number'||!Number.isInteger(merged.minimumPriority)||merged.minimumPriority<0||merged.minimumPriority>100)throw new Error('DISCOVERY_CONFIG_INVALID_FIELDS');return merged;}
 private save():void{this.writeRaw(KEY,JSON.stringify(this.list(500)),'DISCOVERY_SNAPSHOT');}
 private load():void{try{const raw=storageService.getItem(KEY);if(raw!==null){try{this.issues.clear();for(const item of this.parseIssueSnapshot(raw))this.issues.set(item.fingerprint,{...item});}catch(error){this.recoverCorruptSnapshot(KEY,raw,error);}}const configRaw=storageService.getItem(CONFIG_KEY);if(configRaw!==null){try{this.config=this.parseConfig(configRaw);}catch(error){this.recoverCorruptSnapshot(CONFIG_KEY,configRaw,error);this.config={...DEFAULT_CONFIG};}}}catch(error){this.blockStore(`DISCOVERY_STORE_READ_FAILED:${String(error instanceof Error?error.message:error)}`);}}
}
export const autonomousIssueDiscoveryService=new AutonomousIssueDiscoveryService();
