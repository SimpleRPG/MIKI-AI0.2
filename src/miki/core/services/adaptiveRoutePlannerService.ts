import type { MikiDomain } from './crossDomainCirculationService';
import { type BlackboardTask, type BlackboardEntry } from './taskBlackboardService';
import type { DomainCommand } from './domainRouterService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { coreCompletionGateService, type CoreCompletionAssessment } from './coreCompletionGateService';
import { EvidenceService } from '../../memory/services/evidenceService';
import { proposalQuarantineService } from './proposalQuarantineService';
import { autonomousCandidatePreparationService } from './autonomousCandidatePreparationService';

export interface PlannedRoute {
  target:MikiDomain;
  command:DomainCommand;
  reason:string;
  payload:Record<string,unknown>;
}

export interface ImprovementReadiness {
  issueEstablished:boolean;
  repositoryContextAvailable:boolean;
  targetFilesKnown:boolean;
  requiredEvidenceSatisfied:boolean;
  unresolvedKnowledge:string[];
  unresolvedCapability:string[];
  reusableComponents:string[];
  candidateGenerationReady:boolean;
  validationReady:boolean;
  reviewPackageReady:boolean;
  blockingReasons:string[];
  recommendedOperations:DomainCommand[];
}

function objectValue(entry:BlackboardEntry):Record<string,unknown>|undefined {
  return entry.value && typeof entry.value === 'object' && !Array.isArray(entry.value)
    ? entry.value as Record<string,unknown> : undefined;
}

function successfulBusinessEntries(task:BlackboardTask):BlackboardEntry[] {
  return task.entries.filter(entry => {
    if(entry.kind!=='RESULT') return false;
    const value=objectValue(entry);
    const reply=value?.reply && typeof value.reply==='object' ? value.reply as Record<string,unknown> : undefined;
    return value?.operationClass==='BUSINESS' && reply?.operationClass==='BUSINESS'
      && ['SUCCEEDED','SUCCESS','COMPLETED'].includes(String(reply.status||'').toUpperCase());
  });
}

class AdaptiveRoutePlannerService {
  /**
   * The readiness object is a CORE decision artifact. Domains may provide
   * observations, but they never append required operations themselves.
   */
  assessImprovementReadiness(task:BlackboardTask):ImprovementReadiness {
    const input=objectValue(task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')||({} as BlackboardEntry))||{};
    const results=task.entries.filter(entry=>entry.kind==='RESULT');
    const observations=task.entries.filter(entry=>entry.kind==='OBSERVATION');
    const issueEstablished=Boolean(
      String(input.target||'').trim() ||
      String(input.issueId||'').trim() ||
      results.some(entry=>/improvement|selfAwareness|DISCOVER_IMPROVEMENT_ISSUE/i.test(entry.domain+':'+entry.key))
    );

    const sourceSnapshot=autonomousCandidatePreparationService.getSourceFiles();
    const targetText=String(input.target||'').trim().toLowerCase();
    const repositoryContextAvailable=Boolean(
      input.repositoryContext || input.repositoryPath || sourceSnapshot.length>0 ||
      results.some(entry=>this.containsKey(entry,/repository.?context|repositoryPath|target.?files|targetFiles|sourceSnapshot/i))
    );
    const targetFilesKnown=Boolean(
      input.targetFiles && Array.isArray(input.targetFiles) && input.targetFiles.length>0 ||
      (!targetText && issueEstablished && sourceSnapshot.length>0) ||
      (targetText && sourceSnapshot.some(file=>file.path.toLowerCase()===targetText || file.path.toLowerCase().endsWith(`/${targetText}`))) ||
      results.some(entry=>this.containsKey(entry,/target.?files|targetPaths|changedFilePaths/i))
    );

    const evidenceIds=new Set<string>();
    for(const entry of [...results,...observations,...task.entries.filter(entry=>entry.kind==='EVIDENCE')]){
      for(const id of entry.evidenceIds||[]) evidenceIds.add(id);
      const value=objectValue(entry);
      for(const key of ['evidenceIds','generationEvidenceIds','validationEvidenceIds']){
        const ids=value?.[key];
        if(Array.isArray(ids)) for(const id of ids) if(typeof id==='string'&&id) evidenceIds.add(id);
      }
    }
    const evidenceRequirementExplicit=Boolean(
      input.requiredEvidence || input.requiredEvidenceIds || input.requiredEvidenceSatisfied===false ||
      task.entries.some(entry=>/requiredEvidence|evidenceRequirement/i.test(entry.key))
    );
    const requiredEvidenceSatisfied=!evidenceRequirementExplicit || (
      evidenceIds.size>0 && [...evidenceIds]
        .map(id=>EvidenceService.getInstance().getEvidence(id))
        .every(record=>Boolean(record&&record.status!=='REJECTED'))
    );

    const unresolvedKnowledge=this.collectUnresolved(task,/knowledge|unknown|gap|unresolved|missing/i);
    const unresolvedCapability=this.collectUnresolved(task,/capability|component.?gap|missing.?component/i);
    const reusableComponents=this.collectValues(task,/reusable|component/i);

    const candidateResult=this.latestBusinessResult(task,'GENERATE_CANDIDATE');
    const validationResult=this.latestBusinessResult(task,'VALIDATE_CANDIDATE');
    const packageResult=this.latestBusinessResult(task,'CREATE_REVIEW_PACKAGE');
    const candidateGenerationReady=issueEstablished && repositoryContextAvailable && targetFilesKnown
      && requiredEvidenceSatisfied && unresolvedKnowledge.length===0 && unresolvedCapability.length===0;
    const validationReady=Boolean(candidateResult && this.hasCandidateIdentity(candidateResult));
    const reviewPackageReady=Boolean(validationResult && this.hasValidationIdentity(validationResult));

    const blockingReasons:string[]=[];
    if(!issueEstablished) blockingReasons.push('IMPROVEMENT_ISSUE_NOT_ESTABLISHED');
    if(!repositoryContextAvailable) blockingReasons.push('REPOSITORY_CONTEXT_MISSING');
    if(!targetFilesKnown) blockingReasons.push('TARGET_FILES_UNKNOWN');
    if(!requiredEvidenceSatisfied) blockingReasons.push('REQUIRED_EVIDENCE_NOT_SATISFIED');
    if(unresolvedKnowledge.length) blockingReasons.push(`KNOWLEDGE_GAPS:${unresolvedKnowledge.join('|')}`);
    if(unresolvedCapability.length) blockingReasons.push(`CAPABILITY_GAPS:${unresolvedCapability.join('|')}`);
    if(candidateResult&&!validationReady) blockingReasons.push('CANDIDATE_IDENTITY_INCOMPLETE');
    if(validationResult&&!reviewPackageReady) blockingReasons.push('VALIDATION_IDENTITY_INCOMPLETE');

    const recommendedOperations:DomainCommand[]=[];
    if(!issueEstablished) recommendedOperations.push('DISCOVER_IMPROVEMENT_ISSUE');
    else if(!repositoryContextAvailable || !targetFilesKnown) recommendedOperations.push('ASSESS_DOMAIN');
    else if(unresolvedKnowledge.length) recommendedOperations.push('RESOLVE_UNKNOWN','RUN_RESEARCH');
    else if(unresolvedCapability.length) recommendedOperations.push('RESOLVE_CAPABILITY_GAPS','ASSESS_DOMAIN');
    else if(!candidateResult) recommendedOperations.push('GENERATE_CANDIDATE');
    else if(!validationResult) recommendedOperations.push('VALIDATE_CANDIDATE');
    else if(!packageResult) recommendedOperations.push('CREATE_REVIEW_PACKAGE');

    return {
      issueEstablished,repositoryContextAvailable,targetFilesKnown,requiredEvidenceSatisfied,
      unresolvedKnowledge,unresolvedCapability,reusableComponents,
      candidateGenerationReady,validationReady,reviewPackageReady,blockingReasons,
      recommendedOperations:[...new Set(recommendedOperations)]
    };
  }

  plan(task:BlackboardTask):PlannedRoute[] {
    const input=this.payload(task);
    const kind=String(input.kind||'SYSTEM_TASK');
    const entry=String(input.entry||'');
    const uiSelfImprovement=kind==='SELF_IMPROVEMENT' && entry==='TYPED_IMPROVEMENT_UI_GATEWAY';

    // SELF_IMPROVEMENT from the new UI is an adaptive plan, not a legacy
    // domain pipeline. Keep this branch exclusive so old fixed flows cannot
    // inject extra routes into the same cycle.
    if(uiSelfImprovement) return this.planAdaptiveImprovement(task,input);
    if(kind==='USER_REQUEST' && entry==='TYPED_CONVERSATION_UI_GATEWAY') return this.planConversation(task,input);

    return this.planGeneral(task,input,kind);
  }

  private planAdaptiveImprovement(task:BlackboardTask,input:Record<string,unknown>):PlannedRoute[] {
    const readiness=this.assessImprovementReadiness(task);
    task.entries; // keep the decision based solely on the current Blackboard snapshot
    const routes:PlannedRoute[]=[];

    const latestCandidate=this.latestBusinessResult(task,'GENERATE_CANDIDATE');
    const latestValidation=this.latestBusinessResult(task,'VALIDATE_CANDIDATE');
    const latestPackage=this.latestBusinessResult(task,'CREATE_REVIEW_PACKAGE');

    // First operation: establish/assess the current state. It is the only
    // unconditional starting point; Candidate/Validation/Package are never
    // injected together.
    if(!readiness.issueEstablished) {
      routes.push({
        target:'improvement',command:'DISCOVER_IMPROVEMENT_ISSUE',
        reason:'Core requires the improvement issue to be established before planning implementation',
        payload:{taskId:task.taskId,trigger:`core-adaptive:${task.taskId}`,adaptive:true,priority:100}
      });
    } else if(!readiness.repositoryContextAvailable || !readiness.targetFilesKnown) {
      const target: MikiDomain = readiness.repositoryContextAvailable ? 'data' : 'selfDevelopment';
      routes.push({
        target,command:'ASSESS_DOMAIN',
        reason:readiness.repositoryContextAvailable
          ? 'Core needs target-file structure before candidate generation'
          : 'Core needs repository context before candidate generation',
        payload:{
          taskId:task.taskId,goal:task.goal,kind:'SELF_IMPROVEMENT',adaptive:true,
          requestedAssessment:'REPOSITORY_CONTEXT',repositoryContext:input.repositoryContext,
          target:input.target,priority:95
        }
      });
    } else if(readiness.unresolvedKnowledge.length>0) {
      // Resolve the gap first. Search execution is only selected when the
      // Blackboard has an actionable research gap/query.
      const hasResearchableGap=task.entries.some(entry=>/gapId|researchQuestion|queryPlanId/i.test(entry.key));
      if(hasResearchableGap) {
        routes.push({
          target:'research',command:'RUN_RESEARCH',
          reason:'Core selected research to resolve an explicit knowledge gap',
          payload:{taskId:task.taskId,goal:task.goal,gapId:this.readStringFromEntries(task,/gapId/i),adaptive:true,priority:90}
        });
      } else {
        routes.push({
          target:'unknown',command:'RESOLVE_UNKNOWN',
          reason:'Core selected unknown resolution before research',
          payload:{taskId:task.taskId,question:task.goal,useSearch:true,hasAttachments:Boolean(input.hasAttachments),adaptive:true,priority:90}
        });
      }
    } else if(readiness.unresolvedCapability.length>0) {
      routes.push({
        target:'capability',command:'RESOLVE_CAPABILITY_GAPS',
        reason:'Core selected capability resolution before candidate generation',
        payload:{taskId:task.taskId,gapIds:this.stringArrayFromEntries(task,/gapIds/i),adaptive:true,priority:85}
      });
    } else if(!latestCandidate && readiness.candidateGenerationReady) {
      routes.push({
        target:'selfDevelopment',command:'GENERATE_CANDIDATE',
        reason:'Core readiness assessment satisfied candidate-generation preconditions',
        payload:{
          taskId:task.taskId,runId:String(input.runId||task.taskId),goal:task.goal,
          candidateRevision:Number(input.candidateRevision||1),
          requirements:input.requirements,validationRequirements:input.validationRequirements,
          adaptive:true,priority:80
        }
      });
    } else if(latestCandidate && this.lastOperationFailed(task,'VALIDATE_CANDIDATE')) {
      const candidate=this.extractCandidateIdentity(latestCandidate!);
      routes.push({
        target:'selfDevelopment',command:'GENERATE_CANDIDATE',
        reason:'Validation rejected the candidate; Core requests a new Candidate Revision',
        payload:{taskId:task.taskId,runId:String(input.runId||task.taskId),goal:task.goal,
          candidateRevision:Number(candidate.candidateRevision||1)+1,adaptive:true,priority:75}
      });
    } else if(latestCandidate && !latestValidation && readiness.validationReady) {
      const candidate=this.extractCandidateIdentity(latestCandidate!);
      const candidateOperationInstanceId=this.operationInstanceFor(task,'GENERATE_CANDIDATE');
      routes.push({
        target:'verification',command:'VALIDATE_CANDIDATE',
        reason:'Core re-evaluated the successful Candidate output and selected validation',
        payload:{
          taskId:task.taskId,runId:String(input.runId||task.taskId),
          ...candidate,
          sourceOperationInstanceId:candidateOperationInstanceId,
          adaptive:true,priority:70
        }
      });
    } else if(latestValidation && !latestPackage && readiness.reviewPackageReady) {
      const candidate=this.extractCandidateIdentity(latestCandidate!);
      const validation=this.extractValidationIdentity(latestValidation);
      const validationOperationInstanceId=this.operationInstanceFor(task,'VALIDATE_CANDIDATE');
      routes.push({
        target:'promotion',command:'CREATE_REVIEW_PACKAGE',
        reason:'Core re-evaluated successful Validation and selected external review packaging',
        payload:{
          taskId:task.taskId,runId:String(input.runId||task.taskId),
          ...candidate,...validation,
          externalReviewQuestions:input.externalReviewQuestions,
          sourceOperationInstanceId:validationOperationInstanceId,
          adaptive:true,priority:60
        }
      });
    } else if(latestPackage) {
      // External feedback is a separate UI ingress/Task. Do not manufacture a
      // fixed post-package route here.
      return [];
    } else if(readiness.blockingReasons.length>0) {
      const target: MikiDomain=readiness.unresolvedCapability.length>0?'capability':'unknown';
      routes.push({
        target,command:'ASSESS_DOMAIN',
        reason:`Core blocked by current readiness state: ${readiness.blockingReasons.join(', ')}`,
        payload:{taskId:task.taskId,goal:task.goal,adaptive:true,priority:50}
      });
    }

    return this.decorateOperations(task,this.uniqueOperations(routes));
  }

  private adoptAssessmentProposals(task:BlackboardTask):PlannedRoute[] {
    const operationMap:Record<string,{target:MikiDomain;command:DomainCommand}>={
      PLAN_PENDING_IMPROVEMENT_RUN:{target:'strategy',command:'PLAN_PENDING_IMPROVEMENT_RUN'},
      RESOLVE_CAPABILITY_GAPS:{target:'capability',command:'RESOLVE_CAPABILITY_GAPS'},
      DISCOVER_IMPROVEMENT_ISSUE:{target:'improvement',command:'DISCOVER_IMPROVEMENT_ISSUE'}
    };
    const routes:PlannedRoute[]=[];
    const observations=task.entries.filter(entry=>entry.kind==='OBSERVATION'&&entry.domain==='improvement');
    for(const observation of observations){
      const value=objectValue(observation); if(!value) continue;
      const reply=value.reply&&typeof value.reply==='object'?value.reply as Record<string,unknown>:undefined;
      const result=(reply?.data||reply?.result) as Record<string,unknown>|undefined;
      if(result?.operation!=='IMPROVEMENT_ASSESSMENT'||result.operationClass!=='DIAGNOSTIC'||!Array.isArray(result.evidenceIds)||result.evidenceIds.length===0||!Array.isArray(result.proposedOperations))continue;
      for(const raw of result.proposedOperations){
        if(!raw||typeof raw!=='object')continue;
        const item=raw as Record<string,unknown>;const type=String(item.type||'');const mapped=operationMap[type];
        const dedupeKey=String(item.dedupeKey||'');const idempotencyKey=String(item.idempotencyKey||'');const proposalSha256=String(item.proposalSha256||'');
        const schemaValid=Boolean(mapped&&dedupeKey&&idempotencyKey&&/^[a-f0-9]{64}$/.test(proposalSha256)&&Number.isFinite(Number(item.priority))&&Array.isArray(item.dependsOn)&&Array.isArray(item.preconditions));
        const evidenceIds=result.evidenceIds.filter((id:unknown):id is string=>typeof id==='string'&&id.length>0);
        const evidenceValid=evidenceIds.every(id=>{
          const record=EvidenceService.getInstance().getEvidence(id);
          return Boolean(record&&record.status!=='REJECTED'&&record.kind==='EXECUTION'&&record.source_id===task.taskId&&record.metadata?.component_id==='improvementAssessmentService');
        });
        const dependencyTypes=(item.dependsOn as unknown[]).map(String);
        const missingDependencies=dependencyTypes.filter(type=>{
          const command=operationMap[type]?.command||type;
          return !this.successfulOperationInstanceFor(task,command);
        });
        const reasons:string[]=[];
        if(!schemaValid)reasons.push('PROPOSAL_SCHEMA_INVALID');
        if(!evidenceValid)reasons.push('ASSESSMENT_EVIDENCE_NOT_COMMITTED_OR_MISMATCHED');
        if(missingDependencies.length)reasons.push(`DEPENDENCY_NOT_SUCCEEDED:${missingDependencies.join(',')}`);
        if(reasons.length){
          proposalQuarantineService.quarantine({
            taskId:task.taskId,assessmentDispatchId:String(value.dispatchId||''),
            proposalType:type,dedupeKey,reasons,evidenceIds
          });
          continue;
        }
        const dependsOn=dependencyTypes.map(type=>this.successfulOperationInstanceFor(task,operationMap[type]?.command||type)).filter(Boolean);
        const alreadySucceeded=task.entries.some(entry=>entry.kind==='RESULT'&&objectValue(entry)?.operation===mapped?.command&&objectValue(entry)?.dedupeKey===dedupeKey);
        if(mapped&&!alreadySucceeded)routes.push({
          target:mapped.target,command:mapped.command,
          reason:`Assessment proposal adopted by core: ${type}`,
          payload:{
            ...(item.input&&typeof item.input==='object'?item.input as Record<string,unknown>:{}),
            dedupeKey,idempotencyKey,proposalSha256,priority:Number(item.priority),
            dependsOn,preconditions:item.preconditions,
            assessmentDispatchId:String(value.dispatchId||''),
            assessmentEvidenceIds:evidenceIds,proposedBy:'IMPROVEMENT_ASSESSMENT'
          }
        });
      }
    }
    return routes;
  }

  private planConversation(task:BlackboardTask,input:Record<string,unknown>):PlannedRoute[] {
    const text=String(input.text||task.goal||'');
    const conversationResult=this.latestBusinessResult(task,'ANALYZE_TEXT');
    const unknownResult=this.latestBusinessResult(task,'RESOLVE_UNKNOWN');
    const researchResult=this.latestBusinessResult(task,'RUN_RESEARCH');
    const routes:PlannedRoute[]=[];

    if(!conversationResult){
      routes.push({target:'conversation',command:'ANALYZE_TEXT',reason:'COREが会話入力を解析し、必要な分類判断の基礎を作る',payload:{taskId:task.taskId,text,hasAttachments:Boolean(input.hasAttachments),adaptive:true,priority:100}});
    } else if(/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(text) && !unknownResult){
      routes.push({target:'unknown',command:'RESOLVE_UNKNOWN',reason:'COREが不足知識を検出し、回答に必要な未知事項を解消する',payload:{taskId:task.taskId,question:text,useSearch:/調べ|検索|最新/i.test(text),hasAttachments:Boolean(input.hasAttachments),adaptive:true,priority:90}});
    } else if(unknownResult && !researchResult && task.entries.some(e=>e.kind==='RESULT'&&/gapId|researchQuestion|queryPlanId/i.test(e.key))){
      routes.push({target:'research',command:'RUN_RESEARCH',reason:'COREが未知解消結果を再評価し、明示された知識Gapを調査する',payload:{taskId:task.taskId,gapId:this.readStringFromEntries(task,/gapId/i),adaptive:true,priority:80}});
    }
    return this.decorateOperations(task,this.uniqueOperations(routes));
  }

  private planGeneral(task:BlackboardTask,input:Record<string,unknown>,kind:string):PlannedRoute[] {
    const text=`${task.goal} ${task.entries.map(e=>`${e.key} ${String(e.value)}`).join(' ')}`;
    const routes:PlannedRoute[]=[...this.adoptAssessmentProposals(task)];
    const isUnknown=/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(text);
    const isSelfImprovement=kind==='SELF_IMPROVEMENT';
    if(!task.visitedDomains.includes('conversation'))
      routes.push({target:'conversation',command:'ANALYZE_TEXT',reason:'入力を構造化する',payload:{text:task.goal}});
    if(isUnknown&&!task.visitedDomains.includes('unknown'))
      routes.push({target:'unknown',command:'RESOLVE_UNKNOWN',reason:'未知・不足情報を分類する',payload:{question:task.goal,useSearch:/調べ|検索|最新/i.test(text),hasAttachments:Boolean(input.hasAttachments)}});
    if(isSelfImprovement&&!task.visitedDomains.includes('improvement'))
      routes.push({target:'improvement',command:'RUN_SELF_IMPROVEMENT',reason:'自己改善入口を評価する',payload:{trigger:`blackboard-${task.taskId}`,taskId:task.taskId}});
    if(routes.length===0&&!task.visitedDomains.includes('strategy'))
      routes.push({target:'strategy',command:'ASSESS_DOMAIN',reason:'次経路を決定するため戦略状態を取得する',payload:{taskId:task.taskId,kind}});
    return this.decorateOperations(task,this.uniqueOperations(routes));
  }

  assessCompletion(task:BlackboardTask):CoreCompletionAssessment {
    const input=this.payload(task);
    const isUiSelfImprovement=String(input.kind||'')==='SELF_IMPROVEMENT' && String(input.entry||'')==='TYPED_IMPROVEMENT_UI_GATEWAY';
    if(isUiSelfImprovement) return coreCompletionGateService.evaluate(task,[]);
    const isUiConversation=String(input.kind||'')==='USER_REQUEST' && String(input.entry||'')==='TYPED_CONVERSATION_UI_GATEWAY';
    if(isUiConversation) return this.evaluateConversationCompletion(task);
    const text=`${task.goal} ${String(input.kind||'')}`;
    const isUnknown=/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(text);
    const isSelfImprovement=String(input.kind||'')==='SELF_IMPROVEMENT';
    const required=isUnknown
      ? ['conversation','unknown','research','verification','experience','learning','memory'] as MikiDomain[]
      : (isSelfImprovement
        ? ['conversation','strategy','improvement','verification','safety','learning','memory'] as MikiDomain[]
        : ['conversation','strategy','safety','experience','memory'] as MikiDomain[]);
    return coreCompletionGateService.evaluate(task,required);
  }

  private evaluateConversationCompletion(task:BlackboardTask):CoreCompletionAssessment {
    const analysis=this.latestBusinessResult(task,'ANALYZE_TEXT');
    const unknownNeeded=/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(task.goal);
    const unknown=unknownNeeded?this.latestBusinessResult(task,'RESOLVE_UNKNOWN'):undefined;
    const researchNeeded=task.entries.some(e=>e.kind==='RESULT'&&/gapId|researchQuestion|queryPlanId/i.test(e.key));
    const research=researchNeeded?this.latestBusinessResult(task,'RUN_RESEARCH'):undefined;
    const final=task.entries.some(e=>e.domain==='core'&&e.kind==='RESULT'&&e.key==='conversationFinalResponse');
    const reasons:string[]=[];
    if(!analysis) reasons.push('CONVERSATION_ANALYSIS_MISSING');
    if(unknownNeeded&&!unknown) reasons.push('UNKNOWN_RESOLUTION_MISSING');
    if(researchNeeded&&!research) reasons.push('RESEARCH_RESULT_MISSING');
    if(!final) reasons.push('FINAL_RESPONSE_MISSING');
    return {businessCompletion:reasons.length===0,failClosed:true,requiredDomains:[],missingDomains:[],failedDomains:[],missingReceipts:[],persistenceConfirmed:true,evidenceQualityPassed:true,reasons,missingRequiredOperations:[]};
  }

  shouldComplete(task:BlackboardTask):boolean {
    return this.assessCompletion(task).businessCompletion;
  }

  private payload(task:BlackboardTask):Record<string,unknown> {
    return objectValue(task.entries.find(entry=>entry.kind==='INPUT'&&entry.key==='payload')||({} as BlackboardEntry))||{};
  }

  private latestBusinessResult(task:BlackboardTask,operation:string):BlackboardEntry|undefined {
    return [...successfulBusinessEntries(task)].reverse().find(entry=>objectValue(entry)?.operation===operation);
  }

  private hasCandidateIdentity(entry:BlackboardEntry):boolean {
    const value=objectValue(entry); if(!value) return false;
    const identity=this.extractCandidateIdentity(value);
    return Boolean(identity.candidateId&&identity.workspaceId&&identity.candidateRevision
      &&identity.candidateManifestSha256&&identity.baselineSnapshotSha256
      &&Array.isArray(identity.changedFilePaths)&&identity.changedFilePaths.length>0
      &&Array.isArray(identity.persistenceReceiptIds)&&identity.persistenceReceiptIds.length>0);
  }

  private hasValidationIdentity(entry:BlackboardEntry):boolean {
    const value=objectValue(entry); if(!value) return false;
    const identity=this.extractValidationIdentity(value);
    return identity.validationStatus==='PASSED' && identity.reviewEligibility===true
      && Boolean(identity.validationBundleId);
  }

  private extractCandidateIdentity(entry:BlackboardEntry|Record<string,unknown>):Record<string,unknown> {
    const value=entry instanceof Object && 'value' in entry ? objectValue(entry as BlackboardEntry)||{} : entry as Record<string,unknown>;
    return {
      candidateId:value.candidateId,
      workspaceId:value.workspaceId,
      candidateRevision:value.candidateRevision,
      candidateManifestSha256:value.candidateManifestSha256,
      baselineSnapshotSha256:value.baselineSnapshotSha256,
      changedFilePaths:this.stringArray(value.changedFilePaths),
      unresolvedItems:this.stringArray(value.unresolvedItems),
      generationEvidenceIds:this.stringArray(value.generationEvidenceIds),
      persistenceReceiptIds:this.stringArray(value.persistenceReceiptIds),
      learningLineage:value.learningLineage
    };
  }

  private extractValidationIdentity(entry:BlackboardEntry|Record<string,unknown>):Record<string,unknown> {
    const value=entry instanceof Object && 'value' in entry ? objectValue(entry as BlackboardEntry)||{} : entry as Record<string,unknown>;
    return {
      validationBundleId:value.validationBundleId,
      validationStatus:value.validationStatus,
      passedChecks:this.stringArray(value.passedChecks),
      failedChecks:this.stringArray(value.failedChecks),
      unexecutedChecks:this.stringArray(value.unexecutedChecks),
      evidenceIds:this.stringArray(value.evidenceIds),
      persistenceReceiptIds:this.stringArray(value.persistenceReceiptIds),
      reviewEligibility:value.reviewEligibility
    };
  }

  private lastOperationFailed(task:BlackboardTask,operation:string):boolean {
    return task.entries.some(entry=>{
      if(entry.kind!=='ERROR') return false;
      const value=objectValue(entry);
      const reply=value?.reply;
      const command=value?.operation;
      return command===operation && (reply===undefined || typeof reply==='string' || (typeof reply==='object'&&reply!==null));
    }) && ![...successfulBusinessEntries(task)].some(entry=>objectValue(entry)?.operation===operation);
  }

  private successfulOperationInstanceFor(task:BlackboardTask,operation:string):string {
    const result=[...successfulBusinessEntries(task)].reverse().find(entry=>objectValue(entry)?.operation===operation);
    return result&&typeof objectValue(result)?.operationInstanceId==='string'
      ? String(objectValue(result)?.operationInstanceId) : '';
  }

  private operationInstanceFor(task:BlackboardTask,operation:string):string {
    const planEntries=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION'&&entry.key.startsWith('corePlanRevision:')).reverse();
    for(const entry of planEntries){
      const value=objectValue(entry); const ops=Array.isArray(value?.requiredOperations)?value.requiredOperations:[];
      const op=ops.find((item:unknown)=>item&&typeof item==='object'&&(item as Record<string,unknown>).operation===operation
        && typeof (item as Record<string,unknown>).operationInstanceId==='string');
      if(op)return String((op as Record<string,unknown>).operationInstanceId);
    }
    const result=this.latestBusinessResult(task,operation);
    return result&&typeof objectValue(result)?.operationInstanceId==='string'?String(objectValue(result)?.operationInstanceId):'';
  }

  private containsKey(entry:BlackboardEntry,pattern:RegExp):boolean {
    return pattern.test(entry.key)||pattern.test(JSON.stringify(entry.value||{}));
  }

  private collectUnresolved(task:BlackboardTask,pattern:RegExp):string[] {
    const found=new Set<string>();
    for(const entry of task.entries){
      if(entry.kind!=='ERROR'&&entry.kind!=='OBSERVATION'&&entry.kind!=='RESULT') continue;
      if(!pattern.test(entry.key)&&!pattern.test(JSON.stringify(entry.value||{}))) continue;
      const value=objectValue(entry);
      const values=value?.unresolvedItems||value?.unresolvedRequirements||value?.unknowns||value?.reasons;
      if(Array.isArray(values)) for(const item of values) if(typeof item==='string'&&item) found.add(item);
    }
    return [...found];
  }

  private collectValues(task:BlackboardTask,pattern:RegExp):string[] {
    const found=new Set<string>();
    for(const entry of task.entries){
      if(pattern.test(entry.key)||pattern.test(JSON.stringify(entry.value||{}))) {
        const value=objectValue(entry); const values=value?.reusableComponents||value?.componentIds||value?.usedCodeComponentIds;
        if(Array.isArray(values)) for(const item of values) if(typeof item==='string'&&item) found.add(item);
      }
    }
    return [...found];
  }

  private readStringFromEntries(task:BlackboardTask,pattern:RegExp):string {
    for(const entry of [...task.entries].reverse()){
      if(pattern.test(entry.key)&&typeof entry.value==='string') return entry.value;
      const value=objectValue(entry);
      if(value) for(const [key,item] of Object.entries(value)) if(pattern.test(key)&&typeof item==='string') return item;
    }
    return '';
  }

  private stringArray(value:unknown):string[] {
    return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'&&item.length>0):[];
  }
  private stringArrayFromEntries(task:BlackboardTask,pattern:RegExp):string[] {
    const found=new Set<string>();
    for(const entry of [...task.entries].reverse()){
      const value=objectValue(entry);
      if(value) for(const [key,item] of Object.entries(value)) if(pattern.test(key)&&Array.isArray(item))
        for(const id of item) if(typeof id==='string'&&id) found.add(id);
    }
    return [...found];
  }

  private decorateOperations(task:BlackboardTask,routes:PlannedRoute[]):PlannedRoute[] {
    const latestPlan=task.entries.filter(entry=>entry.domain==='core'&&entry.kind==='DECISION'&&entry.key.startsWith('corePlanRevision:')).at(-1);
    const planned=objectValue(latestPlan||({} as BlackboardEntry));
    const existing=Array.isArray(planned?.requiredOperations)?planned.requiredOperations:[];
    return routes.map(route=>{
      const existingPending=existing.find((item:unknown)=>{
        if(!item||typeof item!=='object') return false;
        const row=item as Record<string,unknown>;
        return row.operation===route.command && row.targetDomain===route.target
          && ['PENDING','BLOCKED','RUNNING'].includes(String(row.status||''));
      }) as Record<string,unknown>|undefined;
      if(existingPending?.operationInstanceId){
        const failed=task.entries.some(entry=>{
          if(entry.kind!=='ERROR') return false;
          const value=objectValue(entry);
          return value?.operationInstanceId===String(existingPending.operationInstanceId)
            || String(entry.key).includes(String(existingPending.operationInstanceId));
        });
        if(!failed) return {...route,payload:{...route.payload,
          operationInstanceId:String(existingPending.operationInstanceId),
          dedupeKey:String(existingPending.dedupeKey||`${task.taskId}:${route.command}`),
          attempt:Number(existingPending.attempt||0)
        }};
      }
      const prior=task.entries.filter(entry=>entry.kind==='RESULT'&&objectValue(entry)?.operation===route.command).length;
      const attempt=prior+1;
      const operationInstanceId=`OPI-${task.taskId}-${route.command}-${attempt}`;
      const dedupeKey=`${task.taskId}:${route.command}:${attempt}`;
      const sourceOperationInstanceId=typeof route.payload.sourceOperationInstanceId==='string'
        ? route.payload.sourceOperationInstanceId : '';
      return {...route,payload:{...route.payload,operationInstanceId,dedupeKey,attempt,
        ...(sourceOperationInstanceId?{dependsOn:[sourceOperationInstanceId]}:{})}};
    });
  }

  private uniqueOperations(routes:PlannedRoute[]):PlannedRoute[] {
    const unique=new Map<string,PlannedRoute>();
    for(const route of routes){
      // Deduplication is intentionally operation-instance based. The same
      // target/command can be visited again with a new input/attempt/revision.
      const identity=String(route.payload.operationInstanceId||'');
      const dedupe=String(route.payload.dedupeKey||'');
      const key=identity || dedupe || canonicalRouteKey(route);
      if(!unique.has(key)) unique.set(key,route);
    }
    return [...unique.values()];
  }
}

function canonicalRouteKey(route:PlannedRoute):string {
  return `${route.target}:${route.command}:${JSON.stringify(route.payload)}`;
}

export const adaptiveRoutePlannerService=new AdaptiveRoutePlannerService();
