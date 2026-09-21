import { workDirectiveIngestionService } from '../../execution/services/workDirectiveIngestionService';
import { externalDirectiveIntakeService } from '../services/externalDirectiveIntakeService';
import { improvementIntakeRouterService } from '../services/improvementIntakeRouterService';
import { isolatedCandidateWorkspaceService } from '../services/isolatedCandidateWorkspaceService';
import { candidateValidationEvidenceService } from '../services/candidateValidationEvidenceService';
import { coreResultService } from '../services/coreResultService';
import { coreTaskIngressService, type CoreTaskIngressRequest } from '../services/coreTaskIngressService';
import { coreCycleSettingsService } from '../services/coreCycleSettingsService';
import { priorityOneRuntimeReadModelService } from '../services/priorityOneRuntimeReadModelService';
export type { PriorityOneRuntimeItem, PriorityOneAllowedAction } from '../services/priorityOneRuntimeReadModelService';
import { selfImprovementControllerService } from '../../improvement/services/selfImprovementControllerService';
import { autonomousSelfImprovementLoopService } from '../services/autonomousSelfImprovementLoopService';
import type { AutopilotConfig } from '../../autonomy/services/autonomousContinuousEvolutionService';

export type { AutonomousLoopState, AutonomousImprovementRequest } from '../services/autonomousSelfImprovementLoopService';
export type { ImprovementRun } from '../../improvement/services/selfImprovementControllerService';
export type { ExternalDirective } from '../services/externalDirectiveIntakeService';
export type { ImprovementIntakeRun } from '../services/improvementIntakeRouterService';
export type { CandidateWorkspace } from '../services/isolatedCandidateWorkspaceService';
export type { CandidateValidationEvidence } from '../services/candidateValidationEvidenceService';
export type { CoreResult } from '../services/coreResultService';

export type ImprovementUiCommand =
  | { commandType:'START_SPECIFIED_IMPROVEMENT'; goal:string; target:string; requestedAt:number; commandId:string; operationInstanceId:string; }
  | { commandType:'DISCOVER_IMPROVEMENT_TARGET'; goal:string; requestedAt:number; commandId:string; operationInstanceId:string; }
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
  subscribeCore(listener: () => void) { return coreResultService.subscribeAll(listener); }

  async sendImprovementCommand(command:ImprovementUiCommand):Promise<ImprovementUiCommandResult>{
    if(command.commandType==='RESUME_IMPROVEMENT_TASK'){
      const resumed=await coreTaskIngressService.resume(command.taskId,coreCycleSettingsService.maxCyclesFor('SELF_IMPROVEMENT'));
      return this.toCommandResult(command,resumed);
    }
    const request:CoreTaskIngressRequest={kind:'SELF_IMPROVEMENT',goal:command.goal,source:'core',payload:{commandId:command.commandId,operationInstanceId:command.operationInstanceId,requestedAt:command.requestedAt,entry:'TYPED_IMPROVEMENT_UI_GATEWAY',mode:command.commandType,...(command.commandType==='START_SPECIFIED_IMPROVEMENT'?{target:command.target}:command.commandType==='COMMIT_CANDIDATE_TRANSACTION'?{workspaceId:command.workspaceId,persistenceReceiptId:command.persistenceReceiptId}:command.commandType==='IMPORT_EXTERNAL_FEEDBACK'?{packageId:command.packageId,rawResponse:command.rawResponse,sourceType:command.sourceType}:command.commandType==='SUBMIT_REVIEW_DECISION'?{externalReviewId:command.externalReviewId,decision:command.decision,reason:command.reason}:{autonomousDiscovery:true})}};
    const result=await coreTaskIngressService.submit(request);
    return this.toCommandResult(command,result);
  }

  async executeDirective(directiveId:string){
    const directive = externalDirectiveIntakeService.list().find((item) => item.directiveId === directiveId);
    const goal = directive?.objective?.trim() || `指示書 ${directiveId} を実行し、評価可能な候補まで進める`;
    const target = directive?.targetFiles?.find((item) => typeof item === 'string' && item.trim()) || 'src/components/AutonomousImprovementHome.tsx';
    return this.startSpecifiedImprovement(goal, target);
  }
  startSpecifiedImprovement(goal:string,target:string){return this.sendImprovementCommand({commandType:'START_SPECIFIED_IMPROVEMENT',goal,target,requestedAt:Date.now(),commandId:coreResultService.generateRequestId('ui-improvement'),operationInstanceId:coreResultService.generateRequestId('operation')});}
  discoverImprovementTarget(goal='改善対象を自動で探し、評価可能な候補を作る'){return this.sendImprovementCommand({commandType:'DISCOVER_IMPROVEMENT_TARGET',goal,requestedAt:Date.now(),commandId:coreResultService.generateRequestId('ui-discovery'),operationInstanceId:coreResultService.generateRequestId('operation')});}
  resumeImprovementTask(taskId:string){return this.sendImprovementCommand({commandType:'RESUME_IMPROVEMENT_TASK',taskId,requestedAt:Date.now(),commandId:coreResultService.generateRequestId('ui-resume'),operationInstanceId:coreResultService.generateRequestId('operation')});}
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
  generateRequestId() { return coreResultService.generateRequestId(); }
  createRequest(...args: Parameters<typeof coreResultService.createRequest>) { return coreResultService.createRequest(...args); }
  updateRequestStatus(...args: Parameters<typeof coreResultService.updateStatus>) { return coreResultService.updateStatus(...args); }
  completeRequest(...args: Parameters<typeof coreResultService.complete>) { return coreResultService.complete(...args); }
}

export const typedImprovementUiGatewayService = new TypedImprovementUiGatewayService();
