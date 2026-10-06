import { externalDirectiveIntakeService } from '../services/externalDirectiveIntakeService';
import { improvementIntakeRouterService } from '../services/improvementIntakeRouterService';
import { isolatedCandidateWorkspaceService } from '../services/isolatedCandidateWorkspaceService';
import { reviewZipExportService } from '../services/reviewZipExportService';
import { candidateValidationEvidenceService } from '../services/candidateValidationEvidenceService';
import { coreResultService } from '../services/coreResultService';
import { coreTaskIngressService, type CoreTaskIngressRequest } from '../services/coreTaskIngressService';
import { coreCycleSettingsService } from '../services/coreCycleSettingsService';
import { directiveReviewPackageCompletionService } from '../services/directiveReviewPackageCompletionService';
import { taskBlackboardService } from '../services/taskBlackboardService';
import { selfCodeSpaceService } from '../services/selfCodeSpaceService';
import { priorityOneRuntimeReadModelService } from '../services/priorityOneRuntimeReadModelService';
export type { PriorityOneRuntimeItem, PriorityOneAllowedAction } from '../services/priorityOneRuntimeReadModelService';
import { selfImprovementControllerService } from '../../improvement/services/selfImprovementControllerService';
import { autonomousSelfImprovementLoopService } from '../services/autonomousSelfImprovementLoopService';
import { domainReplyLedgerService } from '../services/domainReplyLedgerService';
import { persistenceReceiptLedgerService } from '../services/persistenceReceiptLedgerService';
import type { AutopilotConfig } from '../../autonomy/services/autonomousContinuousEvolutionService';
import { naturalLanguageToReviewPackageService } from '../../selfDevelopment/services/naturalLanguageToReviewPackageService';
import { developmentReviewLifecycleService } from '../../selfDevelopment/services/developmentReviewLifecycleService';
import { evaluationPackageDownloadService } from '../../selfDevelopment/services/evaluationPackageDownloadService';
import { mikiSelfCodingSuperchargerService } from '../../selfDevelopment/services/mikiSelfCodingSuperchargerService';

export type { AutonomousLoopState, AutonomousImprovementRequest } from '../services/autonomousSelfImprovementLoopService';
export type { ImprovementRun } from '../../improvement/services/selfImprovementControllerService';
export type { ExternalDirective } from '../services/externalDirectiveIntakeService';
export type { ImprovementIntakeRun } from '../services/improvementIntakeRouterService';
export type { CandidateWorkspace } from '../services/isolatedCandidateWorkspaceService';
export type { CandidateValidationEvidence } from '../services/candidateValidationEvidenceService';
export type { CoreResult } from '../services/coreResultService';

type ImprovementDirectiveContext = {
  directiveId?:string;
  title?:string;
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
  | { commandType:'START_SPECIFIED_IMPROVEMENT'; goal:string; target:string; directiveContext?:ImprovementDirectiveContext; context?:Record<string,unknown>; directiveId?:string; runId?:string; requirements?:string[]; prohibitions?:string[]; invariants?:string[]; validationRequirements?:string[]; deliveryRequirements?:string[]; requestedAt:number; commandId:string; operationInstanceId:string; }
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
  recordCanonicalRun(taskId:string, trigger:string, result:string, decision?:Parameters<typeof selfImprovementControllerService.recordCanonicalRun>[3]){
    return selfImprovementControllerService.recordCanonicalRun(taskId, trigger, result, decision);
  }
  getExternalDirectives() { return externalDirectiveIntakeService.list(); }
  getIntakeRuns(limit = 50) { return improvementIntakeRouterService.list(limit); }
  getWorkspaces() { return isolatedCandidateWorkspaceService.list(); }
  getValidationEvidence() { return candidateValidationEvidenceService.list(); }
  getCoreResults(limit = 50) { return coreResultService.list(limit); }

  getDevelopmentReviewRequests() { return developmentReviewLifecycleService.list(); }
  getDevelopmentReviewPackages() { return developmentReviewLifecycleService.packages(); }
  async startDevelopmentReview(text:string, targetPaths:string[] = []) {
    const normalized=text.trim();
    if(!normalized)throw new Error('DEVELOPMENT_INSTRUCTION_REQUIRED');
    return developmentReviewLifecycleService.start(developmentReviewLifecycleService.create(normalized,targetPaths));
  }
  async decideDevelopmentReview(instructionId:string, decision:'ACCEPT'|'REJECT'|'REQUEST_CHANGES', reason:string) {
    return developmentReviewLifecycleService.decide({ instructionId, decision, reason });
  }
  downloadDevelopmentEvaluationPackage(packageId:string, revision:number) {
    return evaluationPackageDownloadService.download(packageId,revision);
  }

  runCouncilReview(code:string,fileName:string,chapter:number){return mikiSelfCodingSuperchargerService.runCouncilReview(code,fileName,chapter);}
  generateAndRunUnitTests(code:string,specification:string,chapter:number){return mikiSelfCodingSuperchargerService.generateAndRunUnitTests(code,specification,chapter);}
  fetchImprovementLessons(filter?:string){return mikiSelfCodingSuperchargerService.fetchLessons(filter);}
  recordImprovementLesson(input:Parameters<typeof mikiSelfCodingSuperchargerService.recordLesson>[0]){return mikiSelfCodingSuperchargerService.recordLesson(input);}
  scanImprovementDeadCode(){return mikiSelfCodingSuperchargerService.scanDeadCode();}
  generateImprovementPromptToPatch(prompt:string){return mikiSelfCodingSuperchargerService.generatePromptToPatch(prompt);}
  fetchImprovementSnapshots(){return mikiSelfCodingSuperchargerService.fetchSnapshots();}
  fetchImprovementGapRecommendations(){return mikiSelfCodingSuperchargerService.fetchGapRecommendations();}
  rollbackImprovementSnapshot(snapshotId:string){return mikiSelfCodingSuperchargerService.rollbackSnapshot(snapshotId);}

  getTaskTitle(taskId:string):string|undefined{
    return taskBlackboardService.get(taskId)?.title;
  }

  getImprovementRunDetail(taskId:string){
    const task=taskBlackboardService.get(taskId);
    if(!task)return undefined;
    const result=coreResultService.list(200).find(x=>(x.result as any)?.taskId===taskId);
    const replies=domainReplyLedgerService.listByTask(taskId);
    const intake=this.getIntakeRuns(200).find(x=>x.taskId===taskId);
    const canonicalRun=this.getRuns().find(run=>run.taskId===taskId);
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
      runId:canonicalRun?.run_id,
      coreResult:result,
      coreDecisions:task.entries.filter(x=>x.domain==='core'&&(x.kind==='DECISION'||x.kind==='RESULT')),
      diagnosticLogs,
      checkpoints: task.entries
        .filter(x => x.kind === 'CHECKPOINT' && x.domain === 'core')
        .map(x => ({
          id: x.id,
          key: x.key,
          cycle: typeof x.value === 'object' && x.value !== null
            ? (x.value as Record<string, unknown>).cycle
            : undefined,
          stage: typeof x.value === 'object' && x.value !== null
            ? (x.value as Record<string, unknown>).stage
            : undefined,
          value: x.value,
          evidenceIds: x.evidenceIds || []
        })),
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
    if(command.commandType==='START_SPECIFIED_IMPROVEMENT'||command.commandType==='DISCOVER_IMPROVEMENT_TARGET'){
      const diagnostic=selfCodeSpaceService.getWorkspaceDiagnostic();
      const sourceFiles=selfCodeSpaceService.listSourceFiles();
      if(sourceFiles.length===0||['JSON_INVALID','STATE_INVALID','INCOMPLETE','FILES_EMPTY','NO_SOURCE'].includes(diagnostic.status)){
        throw new Error(`SELF_CODE_PREFLIGHT_FAILED:${diagnostic.diagnosticCode}:${diagnostic.nextAction}`);
      }
    }
    if(command.commandType==='RESUME_IMPROVEMENT_TASK'){
      const resumed=await coreTaskIngressService.resume(command.taskId,coreCycleSettingsService.maxCyclesFor('SELF_IMPROVEMENT'));
      const commandResult=this.toCommandResult(command,resumed);

      if(commandResult.taskId){
        selfImprovementControllerService.recordCanonicalRun(
          commandResult.taskId,
          'RESUME_IMPROVEMENT_TASK',
          `status=${commandResult.currentStage || 'UNKNOWN'};taskRevision=${commandResult.taskRevision ?? '―'};cycle=${resumed?.cycles ?? '―'}`,
          {
            action:'AUTONOMOUS_CODE_EVOLUTION',
            reason:'Canonical CORE resume persisted to existing SelfImprovementController history'
          }
        );
      }

      return commandResult;
    }
    const suppliedContext='directiveContext' in command ? (command.directiveContext||{}) : {};
    const suppliedTargets='targetFiles' in suppliedContext&&Array.isArray(suppliedContext.targetFiles)?suppliedContext.targetFiles:[];
    const nlPlan=(command.commandType==='START_SPECIFIED_IMPROVEMENT'||command.commandType==='DISCOVER_IMPROVEMENT_TARGET')
      ? naturalLanguageToReviewPackageService.compile(command.goal,suppliedTargets)
      : undefined;
    const request:CoreTaskIngressRequest={kind:'SELF_IMPROVEMENT',goal:command.goal,source:'core',payload:{...suppliedContext,...(nlPlan?{naturalLanguagePlanId:nlPlan.planId,naturalLanguagePlan:nlPlan,requirements:[...nlPlan.requirements,...(('requirements' in suppliedContext&&Array.isArray(suppliedContext.requirements))?suppliedContext.requirements:[])],prohibitions:[...nlPlan.prohibitions,...(('prohibitions' in suppliedContext&&Array.isArray(suppliedContext.prohibitions))?suppliedContext.prohibitions:[])],invariants:[...nlPlan.invariants,...(('invariants' in suppliedContext&&Array.isArray(suppliedContext.invariants))?suppliedContext.invariants:[])],validationRequirements:[...nlPlan.validationRequirements,...(('validationRequirements' in suppliedContext&&Array.isArray(suppliedContext.validationRequirements))?suppliedContext.validationRequirements:[])],deliveryRequirements:[...nlPlan.deliveryRequirements,...(('deliveryRequirements' in suppliedContext&&Array.isArray(suppliedContext.deliveryRequirements))?suppliedContext.deliveryRequirements:[])]}:{}),commandId:command.commandId,operationInstanceId:command.operationInstanceId,requestedAt:command.requestedAt,entry:'TYPED_IMPROVEMENT_UI_GATEWAY',mode:command.commandType,...(command.commandType==='START_SPECIFIED_IMPROVEMENT'?{target:command.target,targetFiles:suppliedTargets.length?suppliedTargets:(nlPlan?.targetFiles.length?nlPlan.targetFiles:[command.target])}:command.commandType==='COMMIT_CANDIDATE_TRANSACTION'?{workspaceId:command.workspaceId,persistenceReceiptId:command.persistenceReceiptId}:command.commandType==='IMPORT_EXTERNAL_FEEDBACK'?{packageId:command.packageId,rawResponse:command.rawResponse,sourceType:command.sourceType}:command.commandType==='SUBMIT_REVIEW_DECISION'?{externalReviewId:command.externalReviewId,decision:command.decision,reason:command.reason}:{autonomousDiscovery:true,targetFiles:nlPlan?.targetFiles||[]})}};
    const result=await coreTaskIngressService.submit(request);
    const commandResult=this.toCommandResult(command,result);

    if(commandResult.taskId){
      selfImprovementControllerService.recordCanonicalRun(
        commandResult.taskId,
        command.goal,
        `status=${commandResult.currentStage || 'UNKNOWN'};taskRevision=${commandResult.taskRevision ?? '―'};cycle=${result?.cycles ?? '―'}`,
        {
          action: command.commandType === 'START_SPECIFIED_IMPROVEMENT'
            ? 'AUTONOMOUS_CODE_EVOLUTION'
            : command.commandType === 'DISCOVER_IMPROVEMENT_TARGET'
              ? 'AUTONOMOUS_CODE_EVOLUTION'
              : 'EXECUTE_DIRECTIVE',
          reason: 'Canonical CORE execution persisted to existing SelfImprovementController history'
        }
      );
    }

    return commandResult;
  }


  private toCommandResult(command:ImprovementUiCommand,result:Awaited<ReturnType<typeof coreTaskIngressService.submit>>):ImprovementUiCommandResult{
    const task=result.task;
    const core=(result.coreResult&&typeof result.coreResult==='object') ? result.coreResult as unknown as Record<string,unknown> : {};
    const strings=(value:unknown):string[]=>Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];
    return {
      commandId:command.commandId,
      operationInstanceId:command.operationInstanceId,
      taskId:task?.taskId,
      taskRevision:task?.revision,
      corePlanRevision:typeof core.corePlanRevision==='number'?core.corePlanRevision:undefined,
      planRevision:typeof core.planRevision==='number'?core.planRevision:undefined,
      currentOperationInstanceId:typeof core.currentOperationInstanceId==='string'?core.currentOperationInstanceId:undefined,
      currentBusinessStage:typeof core.currentBusinessStage==='string'?core.currentBusinessStage:undefined,
      nextOperationInstanceId:typeof core.nextOperationInstanceId==='string'?core.nextOperationInstanceId:undefined,
      currentStage:typeof core.status==='string'?core.status:(task?.status||'WAITING'),
      nextStage:typeof core.nextStage==='string'?core.nextStage:undefined,
      stopReason:typeof core.stopReason==='string'?core.stopReason:undefined,
      unresolved:strings(core.unresolved),
      domainReplyIds:strings(core.domainReplyIds),
      evidenceIds:strings(core.evidenceIds),
      persistenceReceiptIds:strings(core.persistenceReceiptIds),
      decisionId:typeof core.decisionId==='string'?core.decisionId:undefined,
      requiredDomains:strings(core.requiredDomains),
      missingDomains:strings(core.missingDomains),
      failedDomains:strings(core.failedDomains),
      missingReceipts:strings(core.missingReceipts),
      missingRequiredOperations:strings(core.missingRequiredOperations),
      completionReasons:strings(core.completionReasons),
      coreResult:result.coreResult
    };
  }

  async executeDirective(directiveId:string){
    const externalDirective=externalDirectiveIntakeService.list().find(
      (item)=>item.directiveId===directiveId
    );
    const directive=externalDirective;
    if(!directive){
      throw new Error('EXTERNAL_DIRECTIVE_NOT_FOUND');
    }
    const directiveTitle=directive.title?.trim() || undefined;
    const goal=directive.objective?.trim()
      || directiveTitle
      || `指示書 ${directiveId} を実行し、評価可能な候補まで進める`;

    const targetFiles=directive.targetFiles || [];

    const directiveContext:ImprovementDirectiveContext={
      directiveId,
      title:directiveTitle,
      sourceHash:directive?.sourceHash,
      targetFiles,
      requirements:directive.requirements || [],
      prohibitions:directive.prohibitions || [],
      invariants:directive.invariants || [],
      validationRequirements:directive.validationRequirements || [],
      deliveryRequirements:directive.deliveryRequirements || [],
      relatedIssueIds:directive.relatedIssueIds || []
    };

    externalDirectiveIntakeService.updateStatus(directiveId,'IN_PROGRESS',directive.runId);
    const existingRunId=directive.runId;
    const existingRun=existingRunId
      ? this.getIntakeRuns(100).find(item=>item.runId===existingRunId)
      : this.getIntakeRuns(200).find(item=>
          item.runType==='USER_REQUEST' &&
          String(item.payload?.directiveId||'')===directiveId
        );

    if(existingRun?.taskId){
      const task=taskBlackboardService.get(existingRun.taskId);
      if(task){
        return this.taskSnapshotResult(task.taskId,task.revision,task.status);
      }
    }

    if(existingRun){
      const status=existingRun.status || directive.status || "WAITING";
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

    const target=targetFiles.find(
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
    const result=await this.executeDirective(directiveId);
    const run=result.taskId
      ? this.getIntakeRuns(100).find(item=>item.taskId===result.taskId)
      : undefined;
    if(!result.taskId||!run){
      return {...result,terminalState:'BLOCKED' as const,cycles:0,completedAt:Date.now(),reasons:['DIRECTIVE_RUN_OR_TASK_NOT_FOUND']};
    }
    const completion=await directiveReviewPackageCompletionService.wait(run.runId,result.taskId,{
      maxCycles:coreCycleSettingsService.maxCyclesFor('SELF_IMPROVEMENT'),
      timeoutMs:120000,
      pollMs:100,
      noProgressLimit:4
    });
    const directiveStatus=completion.terminalState==='REVIEW_PACKAGE_READY'
      ? 'REVIEW_READY'
      : completion.terminalState==='FAILED'||completion.terminalState==='BLOCKED'
        ? 'VALIDATION_FAILED'
        : 'IN_PROGRESS';
    externalDirectiveIntakeService.updateStatus(directiveId,directiveStatus,run.runId);
    return {...result,...completion};
  }

  importExternalFeedback(packageId:string,rawResponse:string,sourceType:'PASTED_TEXT'|'IMPORTED_TXT'|'IMPORTED_JSON'='PASTED_TEXT'){
    return this.sendImprovementCommand({commandType:'IMPORT_EXTERNAL_FEEDBACK',goal:'外部AI評価をCOREへ取り込む',packageId,rawResponse,sourceType,requestedAt:Date.now(),commandId:coreResultService.generateRequestId('ui-review-import'),operationInstanceId:coreResultService.generateRequestId('operation')});
  }
  submitReviewDecision(externalReviewId:string,decision:'ACCEPT'|'REJECT'|'REQUEST_CHANGES'|'HOLD'|'PARTIAL_ACCEPT'|'PARTIAL_REJECT',reason:string){
    return this.sendImprovementCommand({commandType:'SUBMIT_REVIEW_DECISION',goal:'利用者の外部評価採否をCOREで処理する',externalReviewId,decision,reason,requestedAt:Date.now(),commandId:coreResultService.generateRequestId('ui-review-decision'),operationInstanceId:coreResultService.generateRequestId('operation')});
  }

  listRestoredPriorityOneRuntime(){return priorityOneRuntimeReadModelService.list();}
  getLatestCoreRuntime(){const items=priorityOneRuntimeReadModelService.list();return items[items.length-1];}
  isCoreRuntimeBusy(){const latest=this.getLatestCoreRuntime();return Boolean(latest&&(latest.taskStatus==='running'||latest.operationStatus==='RUNNING'));}

  receiveDirectiveFile(...args: Parameters<typeof externalDirectiveIntakeService.receiveTextFile>) {
    return externalDirectiveIntakeService.receiveTextFile(...args);
  }
  deleteDirective(directiveId:string) { return externalDirectiveIntakeService.deleteDirective(directiveId); }
}

export const typedImprovementUiGatewayService = new TypedImprovementUiGatewayService();
