import { workDirectiveIngestionService } from '../../execution/services/workDirectiveIngestionService';
import { externalDirectiveIntakeService } from '../services/externalDirectiveIntakeService';
import { improvementIntakeRouterService } from '../services/improvementIntakeRouterService';
import { isolatedCandidateWorkspaceService } from '../services/isolatedCandidateWorkspaceService';
import { reviewZipExportService } from '../services/reviewZipExportService';
import { candidateValidationEvidenceService } from '../services/candidateValidationEvidenceService';
import { coreResultService } from '../services/coreResultService';
import { coreTaskIngressService, type CoreTaskIngressRequest } from '../services/coreTaskIngressService';
import { coreCycleSettingsService } from '../services/coreCycleSettingsService';
import { taskBlackboardService } from '../services/taskBlackboardService';
import { priorityOneRuntimeReadModelService } from '../services/priorityOneRuntimeReadModelService';
export type { PriorityOneRuntimeItem, PriorityOneAllowedAction } from '../services/priorityOneRuntimeReadModelService';
import { selfImprovementControllerService } from '../../improvement/services/selfImprovementControllerService';
import { autonomousSelfImprovementLoopService } from '../services/autonomousSelfImprovementLoopService';
import { domainReplyLedgerService } from '../services/domainReplyLedgerService';
import { persistenceReceiptLedgerService } from '../services/persistenceReceiptLedgerService';
import type { AutopilotConfig } from '../../autonomy/services/autonomousContinuousEvolutionService';

export type { AutonomousLoopState, AutonomousImprovementRequest } from '../services/autonomousSelfImprovementLoopService';
export type { ImprovementRun } from '../../improvement/services/selfImprovementControllerService';
export type { ExternalDirective } from '../services/externalDirectiveIntakeService';
export type { ImprovementIntakeRun } from '../services/improvementIntakeRouterService';
export type { CandidateWorkspace } from '../services/isolatedCandidateWorkspaceService';
export type { CandidateValidationEvidence } from '../services/candidateValidationEvidenceService';
export type { CoreResult } from '../services/coreResultService';

type ImprovementDirectiveContext = {
  directiveId?:string;
  sourceHash?:string;
  targetFiles?:string[];
  requirements?:string[];
  prohibitions?:string[];
  invariants?:string[];
  validationRequirements?:string[];
  deliveryRequirements?:string[];
  relatedIssueIds?:string[];
};

export type ImprovementUiCommand =
  | { commandType:'START_SPECIFIED_IMPROVEMENT'; goal:string; target:string; context?:Record<string,unknown>; directiveId?:string; runId?:string; requirements?:string[]; prohibitions?:string[]; invariants?:string[]; validationRequirements?:string[]; deliveryRequirements?:string[]; requestedAt:number; commandId:string; operationInstanceId:string; }
  | { commandType:'DISCOVER_IMPROVEMENT_TARGET'; goal:string; directiveContext?:ImprovementDirectiveContext; requestedAt:number; commandId:string; operationInstanceId:string; }
  | { commandType:'RESUME_IMPROVEMENT_TASK'; taskId:string; requestedAt:number; commandId:string; operationInstanceId:string; }
  | { commandType:'IMPORT_EXTERNAL_FEEDBACK'; goal:string; packageId:string; rawResponse:string; sourceType:'PASTED_TEXT'|'IMPORTED_TXT'|'IMPORTED_JSON'; requestedAt:number; commandId:string; operationInstanceId:string; }
  | { commandType:'SUBMIT_REVIEW_DECISION'; goal:string; externalReviewId:string; decision:'ACCEPT'|'REJECT'|'REQUEST_CHANGES'|'HOLD'|'PARTIAL_ACCEPT'|'PARTIAL_REJECT'; reason:string; requestedAt:number; commandId:string; operationInstanceId:string; }
  | { commandType:'COMMIT_CANDIDATE_TRANSACTION'; goal:string; workspaceId:string; persistenceReceiptId:string; requestedAt:number; commandId:string; operationInstanceId:string; }
  | { commandType:'SAVE_AUTONOMY_CONFIG'; goal:string; config:Partial<AutopilotConfig>; requestedAt:number; commandId:string; operationInstanceId:string; };

export interface ImprovementUiCommandResult {
  commandId:string;
  operationInstanceId:string;
  taskId?:string;
  taskRevision?:number;
  corePlanRevision?:number;
  planRevision?:number;
  currentOperationInstanceId?:string;
  currentBusinessStage?:string;
  nextOperationInstanceId?:string;
  currentStage:string;
  nextStage?:string;
  stopReason?:string;
  unresolved:string[];
  domainReplyIds:string[];
  evidenceIds:string[];
  persistenceReceiptIds:string[];
  decisionId?:string;
  requiredDomains:string[];
  missingDomains:string[];
  failedDomains:string[];
  missingReceipts:string[];
  missingRequiredOperations:string[];
  completionReasons:string[];
  coreResult?:unknown;
}


/**
 * UI-facing facade for the autonomous improvement home.
 * Components import only this contract. Mutating work remains delegated to the
 * existing core ingress/result boundaries while read models are normalized here.
 */
class TypedImprovementUiGatewayService {
  getLoopState() { return autonomousSelfImprovementLoopService.getState(); }
  getRuns() { return selfImprovementControllerService.listRuns(); }
  getStructuredDirectives() { return workDirectiveIngestionService.getAllDirectives(); }
  getExternalDirectives() { return externalDirectiveIntakeService.list(); }
  getIntakeRuns(limit = 50) { return improvementIntakeRouterService.list(limit); }
  getWorkspaces() { return isolatedCandidateWorkspaceService.list(); }
  getValidationEvidence() { return candidateValidationEvidenceService.list(); }
  getCoreResults(limit = 50) { return coreResultService.list(limit); }

  getImprovementRunDetail(taskId:string){
    const task=taskBlackboardService.get(taskId);
    if(!task)return undefined;
    const result=coreResultService.list(200).find(x=>(x.result as any)?.taskId===taskId);
    const replies=domainReplyLedgerService.listByTask(taskId);
    const intake=this.getIntakeRuns(200).find(x=>x.taskId===taskId);
    const workspaces=isolatedCandidateWorkspaceService.list().filter(x=>x.runId===taskId);
    const validation=workspaces.flatMap(x=>candidateValidationEvidenceService.list(x.workspaceId));
    const packages=reviewZipExportService.list().filter(x=>x.runId===taskId);
    const replyReceiptIds=[...new Set(replies.flatMap(x=>x.receiptIds))];
    const resultPayload=result?.result&&typeof result.result==='object'?result.result as Record<string,unknown>:{};
    const receiptIds=[...new Set([
      ...replyReceiptIds,
      ...(Array.isArray(resultPayload.persistenceReceiptIds)?resultPayload.persistenceReceiptIds.filter((x):x is string=>typeof x==='string'):[])
    ])];
    const receipts=receiptIds.map(id=>persistenceReceiptLedgerService.get(id)).filter(Boolean);

    const diagnosticEntries=task.entries.filter(x =>
      x.domain==='core' &&
      (
        x.key.startsWith('backgroundBudgetDiagnostic:') ||
        x.key.startsWith('backgroundBudgetPause:') ||
        x.key==='evidenceRecoveryDiagnostic' ||
        x.key==='evidenceRecoveryWaitScheduled' ||
        x.key.startsWith('coreCycleGuard:')
      )
    );

    const diagnosticLogs=diagnosticEntries.map(x => {
      const value=x.value;
      if(!value || typeof value!=='object') {
        return `${x.key}|v=${String(value ?? '')}`;
      }
      const v=value as Record<string,unknown>;
      const compactKeys=[
        'cycle','budgetCycle','resourceMode','elapsedMs','maxCycles','maxDurationMs',
        'cycleExceeded','durationExceeded','allowed','reason','freeGb',
        'taskStatusBefore','taskStatusAfter','pauseReason',
        'originalReason','acquired','progressed','evidenceCount',
        'evidenceIds','reasons','evidenceWaitCountBefore','evidenceWaitCountAfter',
        'retryAt','waitDurationMs','requestId','runId','workspaceId'
      ];
      const parts=compactKeys
        .filter(key => key in v)
        .map(key => {
          const raw=v[key];
          const rendered=Array.isArray(raw) ? raw.join(',') : typeof raw==='object' ? JSON.stringify(raw) : String(raw);
          return `${key}=${rendered}`;
        });
      return `${x.key}|${parts.join('|')}`;
    });

    return {
      task,
      intake,
      coreResult:result,
      coreDecisions:task.entries.filter(x=>x.domain==='core'&&(x.kind==='DECISION'||x.kind==='RESULT')),
      diagnosticLogs,
      replies,
      evidenceIds:[...new Set([...replies.flatMap(x=>x.evidenceIds),...(Array.isArray(resultPayload.evidenceIds)?resultPayload.evidenceIds.filter((x):x is string=>typeof x==='string'):[])])],
      unknowns:[...new Set([...replies.flatMap(x=>x.unknowns),...(Array.isArray(resultPayload.unknowns)?resultPayload.unknowns.filter((x):x is string=>typeof x==='string'):[])])],
      receipts,
      workspaces,
      validation,
      packages,
      improvementExecuted:workspaces.some(x=>x.transactionId||x.committedRevision!==undefined),
      changedFiles:workspaces.flatMap(x=>x.files.filter(f=>f.baselineSha256!==f.candidateSha256).map(f=>f.path))
    };
  }
  subscribeCore(listener: () => void) { return coreResultService.subscribeAll(listener); }

  requestWithResult(command:ImprovementUiCommand){ return this.sendImprovementCommand(command); }
  async sendImprovementCommand(command:ImprovementUiCommand):Promise<ImprovementUiCommandResult>{
    if(command.commandType==='RESUME_IMPROVEMENT_TASK'){
      const resumed=await coreTaskIngressService.resume(command.taskId,coreCycleSettingsService.maxCyclesFor('SELF_IMPROVEMENT'));
      return this.toCommandResult(command,resumed);
    }
    const request:CoreTaskIngressRequest={kind:'SELF_IMPROVEMENT',goal:command.goal,source:'core',payload:{...('directiveContext' in command ? (command.directiveContext||{}) : {}),commandId:command.commandId,operationInstanceId:command.operationInstanceId,requestedAt:command.requestedAt,entry:'TYPED_IMPROVEMENT_UI_GATEWAY',mode:command.commandType,...(command.commandType==='START_SPECIFIED_IMPROVEMENT'?{target:command.target,targetFiles:[command.target]}:command.commandType==='COMMIT_CANDIDATE_TRANSACTION'?{workspaceId:command.workspaceId,persistenceReceiptId:command.persistenceReceiptId}:command.commandType==='IMPORT_EXTERNAL_FEEDBACK'?{packageId:command.packageId,rawResponse:command.rawResponse,sourceType:command.sourceType}:command.commandType==='SUBMIT_REVIEW_DECISION'?{externalReviewId:command.externalReviewId,decision:command.decision,reason:command.reason}:{autonomousDiscovery:true})}};
    const result=await coreTaskIngressService.submit(request);
    return this.toCommandResult(command,result);
  }

  async executeDirective(directiveId:string){
    const directive=externalDirectiveIntakeService.list().find(
      (item)=>item.directiveId===directiveId
    );
    const goal=directive?.objective?.trim()
      || `指示書 ${directiveId} を実行し、評価可能な候補まで進める`;

    const directiveContext:ImprovementDirectiveContext={
      directiveId,
      sourceHash:directive?.sourceHash,
      targetFiles:directive?.targetFiles || [],
      requirements:directive?.requirements || [],
      prohibitions:directive?.prohibitions || [],
      invariants:directive?.invariants || [],
      validationRequirements:directive?.validationRequirements || [],
      deliveryRequirements:directive?.deliveryRequirements || [],
      relatedIssueIds:directive?.relatedIssueIds || []
    };

    const existingRun=directive?.runId
      ? this.getIntakeRuns(100).find(item=>item.runId===directive.runId)
      : undefined;
    if(existingRun?.taskId){
      const task=taskBlackboardService.get(existingRun.taskId);
      if(task){
        if(task.status!=='COMPLETED'&&task.status!=='FAILED'&&task.status!=='REJECTED') return this.resumeImprovementTask(task.taskId);
        return this.taskSnapshotResult(task.taskId,task.revision,task.status);
      }
    }

    if(directive?.runId){
      const status=existingRun?.status || directive.status || "WAITING";
      return {
        commandId:coreResultService.generateRequestId("ui-existing-run"),
        operationInstanceId:coreResultService.generateRequestId("operation"),
        currentStage:status,
        currentBusinessStage:status,
        stopReason:"IMPROVEMENT_RUN_EXISTS_WITHOUT_ACTIVE_TASK",
        unresolved:["ACTIVE_TASK_NOT_AVAILABLE"],
        domainReplyIds:[],evidenceIds:[],persistenceReceiptIds:[],
        requiredDomains:[],missingDomains:[],failedDomains:[],missingReceipts:[],
        missingRequiredOperations:[],completionReasons:["RUN_STATE_AVAILABLE"]
      };
    }

    const target=directive?.targetFiles?.find(
      (item)=>typeof item==='string' && item.trim()
    );

    if(target){
      return this.startSpecifiedImprovement(goal,target,directiveContext);
    }

    return this.discoverImprovementTarget(goal,directiveContext);
  }
  private taskSnapshotResult(taskId:string,revision:number,status:string):ImprovementUiCommandResult{
    return {
      commandId:coreResultService.generateRequestId('ui-existing'),
      operationInstanceId:coreResultService.generateRequestId('operation'),
      taskId,taskRevision:revision,currentStage:status,currentBusinessStage:status,
      nextStage:status==='COMPLETED'?undefined:'CORE_REPLAN',
      unresolved:[],domainReplyIds:[],evidenceIds:[],persistenceReceiptIds:[],
      requiredDomains:[],missingDomains:[],failedDomains:[],missingReceipts:[],
      missingRequiredOperations:[],completionReasons:[]
    };
  }
  startSpecifiedImprovement(goal:string,target:string,directiveContext:ImprovementDirectiveContext={}){
    return this.sendImprovementCommand({
      commandType:'START_SPECIFIED_IMPROVEMENT',
      goal,target,directiveContext,
      requestedAt:Date.now(),
      commandId:coreResultService.generateRequestId('ui-improvement'),
      operationInstanceId:coreResultService.generateRequestId('operation')
    });
  }
  discoverImprovementTarget(goal='改善対象を自動で探し、評価可能な候補を作る',directiveContext:ImprovementDirectiveContext={}){
    return this.sendImprovementCommand({
      commandType:'DISCOVER_IMPROVEMENT_TARGET',
      goal,directiveContext,
      requestedAt:Date.now(),
      commandId:coreResultService.generateRequestId('ui-discovery'),
      operationInstanceId:coreResultService.generateRequestId('operation')
    });
  }
  resumeImprovementTask(taskId:string){return this.sendImprovementCommand({commandType:'RESUME_IMPROVEMENT_TASK',taskId,requestedAt:Date.now(),commandId:coreResultService.generateRequestId('ui-resume'),operationInstanceId:coreResultService.generateRequestId('operation')});}
  async executeDirectiveUntilReviewPackage(directiveId:string){
    let result=await this.executeDirective(directiveId);
    let cycles=0;
    for(;cycles<8;cycles++){
      const run=result.taskId
        ? this.getIntakeRuns(100).find(item=>item.taskId===result.taskId)
        : undefined;
      const packageRecord=run
        ? reviewZipExportService.list().find(item=>item.runId===run.runId)
        : undefined;
      if(packageRecord)return {...result,packageId:packageRecord.packageId,packageStatus:packageRecord.status,cycles:cycles+1};
      if(!result.taskId)break;
      const task=taskBlackboardService.get(result.taskId);
      if(!task||['COMPLETED','FAILED','REJECTED','PAUSED','CANCELLED'].includes(task.status))break;
      result=await this.resumeImprovementTask(result.taskId);
    }
    const run=result.taskId
      ? this.getIntakeRuns(100).find(item=>item.taskId===result.taskId)
      : undefined;
    const packageRecord=run
      ? reviewZipExportService.list().find(item=>item.runId===run.runId)
      : undefined;
    return {...result,packageId:packageRecord?.packageId,packageStatus:packageRecord?.status,cycles};
  }
  async saveAutonomyConfig(config:Partial<AutopilotConfig>){const command:ImprovementUiCommand={commandType:'SAVE_AUTONOMY_CONFIG',goal:'自律巡回設定を保存する',config,requestedAt:Date.now(),commandId:coreResultService.generateRequestId('ui-autonomy-config'),operationInstanceId:coreResultService.generateRequestId('operation')};const result=await coreTaskIngressService.submit({kind:'SYSTEM_TASK',goal:command.goal,source:'core',payload:{entry:'TYPED_IMPROVEMENT_UI_GATEWAY',operation:'SAVE_AUTONOMY_CONFIG',config:command.config,commandId:command.commandId,operationInstanceId:command.operationInstanceId,requestedAt:command.requestedAt}});return this.toCommandResult(command,result);}

  private toCommandResult(command:ImprovementUiCommand,result:Awaited<ReturnType<typeof coreTaskIngressService.submit>>|undefined):ImprovementUiCommandResult{
    if(!result)return {commandId:command.commandId,operationInstanceId:command.operationInstanceId,currentStage:'NOT_FOUND',stopReason:'TASK_NOT_FOUND',unresolved:['TASK_NOT_FOUND'],domainReplyIds:[],evidenceIds:[],persistenceReceiptIds:[],requiredDomains:[],missingDomains:[],failedDomains:[],missingReceipts:[],missingRequiredOperations:[],completionReasons:['TASK_NOT_FOUND']};
    const corePayload=result.coreResult?.result as Record<string,unknown>|undefined;
    return {commandId:command.commandId,operationInstanceId:command.operationInstanceId,taskId:result.task.taskId,taskRevision:result.task.revision,corePlanRevision:typeof corePayload?.corePlanRevision==='number'?corePayload.corePlanRevision:undefined,planRevision:typeof corePayload?.corePlanRevision==='number'?corePayload.corePlanRevision:undefined,currentOperationInstanceId:typeof corePayload?.currentOperationInstanceId==='string'?corePayload.currentOperationInstanceId:undefined,currentBusinessStage:typeof corePayload?.currentBusinessStage==='string'?corePayload.currentBusinessStage:undefined,nextOperationInstanceId:typeof corePayload?.nextOperationInstanceId==='string'?corePayload.nextOperationInstanceId:undefined,currentStage:typeof corePayload?.currentBusinessStage==='string'?corePayload.currentBusinessStage:result.task.status,nextStage:typeof corePayload?.nextOperationInstanceId==='string'?corePayload.nextOperationInstanceId:(result.task.status==='COMPLETED'?undefined:'CORE_REPLAN'),stopReason:result.coreResult?.error,unresolved:this.stringArray(corePayload?.unknowns),domainReplyIds:this.stringArray(corePayload?.replyIds),evidenceIds:this.stringArray(corePayload?.evidenceIds),persistenceReceiptIds:this.stringArray(corePayload?.persistenceReceiptIds),decisionId:typeof corePayload?.decisionId==='string'?corePayload.decisionId:undefined,requiredDomains:this.stringArray(corePayload?.requiredDomains),missingDomains:this.stringArray(corePayload?.missingDomains),failedDomains:this.stringArray(corePayload?.failedDomains),missingReceipts:this.stringArray(corePayload?.missingReceipts),missingRequiredOperations:this.stringArray(corePayload?.missingRequiredOperations),completionReasons:this.stringArray(corePayload?.completionReasons),coreResult:result.coreResult};
  }

  private stringArray(value:unknown):string[]{return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];}

  listRestoredPriorityOneRuntime(){return priorityOneRuntimeReadModelService.list();}
  getLatestCoreRuntime(){const items=priorityOneRuntimeReadModelService.list();return items[items.length-1];}
  isCoreRuntimeBusy(){const latest=this.getLatestCoreRuntime();return Boolean(latest&&(latest.taskStatus==='running'||latest.operationStatus==='RUNNING'));}

  ingestDirective(...args: Parameters<typeof workDirectiveIngestionService.ingestDirective>) {
    return workDirectiveIngestionService.ingestDirective(...args);
  }
  ingestDirectiveText(...args: Parameters<typeof workDirectiveIngestionService.ingestDirectiveText>) {
    return workDirectiveIngestionService.ingestDirectiveText(...args);
  }
  receiveDirectiveFile(...args: Parameters<typeof externalDirectiveIntakeService.receiveTextFile>) {
    return externalDirectiveIntakeService.receiveTextFile(...args);
  }
  deleteDirective(directiveId:string) { return externalDirectiveIntakeService.deleteDirective(directiveId); }
}

export const typedImprovementUiGatewayService = new TypedImprovementUiGatewayService();
