import type { MikiDomain } from './crossDomainCirculationService';
import { type BlackboardTask, type BlackboardEntry } from './taskBlackboardService';
import type { DomainCommand } from './domainRouterService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { coreCompletionGateService, type CoreCompletionAssessment } from './coreCompletionGateService';
import { EvidenceService } from '../../memory/services/evidenceService';
import { proposalQuarantineService } from './proposalQuarantineService';
import { autonomousCandidatePreparationService } from './autonomousCandidatePreparationService';
import { decomposeMultiIntent, selectMultiIntentHypothesis, type MultiIntentPlan } from '../../unknown/services/multiIntentDecompositionService';
import { detectUnknownTermsFromBlackboardValue } from '../../unknown/services/unknownTermDetectionService';

export interface PlannedRoute {
  target:MikiDomain;
  command:DomainCommand;
  reason:string;
  payload:Record<string,unknown>;
}

export interface CoreGoalCandidate {
  id:string;
  goal:string;
  priority:number;
  foreground?:boolean;
  safetyRequired?:boolean;
  permissionGranted?:boolean;
  deadlineAt?:number;
  dependsOn?:string[];
  conflictsWith?:string[];
  includes?:string[];
  status?:'ACTIVE'|'PAUSED'|'BLOCKED'|'WAITING_USER'|'COMPLETED'|'CANCELLED';
}

export interface GoalConflictDecision {
  selectedGoalId:string;
  selectedGoal:string;
  conflictDetected:boolean;
  pausedGoalIds:string[];
  blockedGoalIds:string[];
  decisions:Array<{
    goalId:string;
    action:'SELECT'|'PAUSE'|'BLOCK'|'WAIT';
    reason:string;
    comparisonKey:string;
  }>;
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
   * COREだけが改善対象ファイルを決定する。
   * Domain側のCandidatePreparationは、この結果を実行するだけで
   * 独自に対象を再選定してはならない。
   */
  private resolveCoreTargetPaths(
    task:BlackboardTask,
    input:Record<string,unknown>
  ):string[] {
    const explicit=Array.isArray(input.targetFiles)
      ? input.targetFiles.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).map(value=>value.trim())
      : [];
    if(explicit.length>0)return [...new Set(explicit)].slice(0,3);

    const target=String(input.target||'').trim();
    if(target){
      const normalized=target.toLowerCase();
      const exact=autonomousCandidatePreparationService.getSourceFiles()
        .filter(file=>{
          const path=file.path.toLowerCase();
          return path===normalized||path.endsWith(`/${normalized}`);
        })
        .map(file=>file.path);
      if(exact.length>0)return exact.slice(0,3);
    }

    const sourceSnapshot=autonomousCandidatePreparationService.getSourceFiles();
    if(sourceSnapshot.length===0)return [];

    const results=task.entries.filter(entry=>entry.kind==='RESULT');
    let issueText=task.goal;

    const discovery=[...results].reverse().find(entry=>{
      const value=objectValue(entry);
      return value?.operation==='DISCOVER_IMPROVEMENT_ISSUE';
    });

    if(discovery){
      const value=objectValue(discovery);
      const reply=value?.reply&&typeof value.reply==='object'
        ? value.reply as Record<string,unknown>
        : undefined;
      const data=reply?.data&&typeof reply.data==='object'
        ? reply.data as Record<string,unknown>
        : undefined;
      const issues=Array.isArray(data?.issues)
        ? data.issues.filter((item):item is Record<string,unknown>=>Boolean(item&&typeof item==='object'))
        : [];
      const requestedIssueId=String(input.issueId||'').trim();
      const issue=issues.find(item=>!requestedIssueId||String(item.id||'')===requestedIssueId)
        || issues.find(item=>item.resolvedAt===undefined&&!item.queuedAt)
        || issues[0];
      if(issue){
        issueText=[
          String(issue.title||''),
          String(issue.detail||''),
          String(issue.sourceId||''),
          String(issue.kind||'')
        ].join(' ');
      }
    }

    const terms=[...new Set(
      issueText
        .toLowerCase()
        .split(/[^a-z0-9_\u3040-\u30ff\u3400-\u9fff]+/)
        .filter(term=>term.length>=3)
    )].slice(0,40);

    const scored=sourceSnapshot.map(file=>{
      const hay=`${file.path} ${file.content.slice(0,12000)}`.toLowerCase();
      const hits=terms.filter(term=>hay.includes(term));
      const pathHits=terms.filter(term=>file.path.toLowerCase().includes(term));
      return {
        path:file.path,
        score:hits.length+pathHits.length*3
      };
    })
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path))
    .slice(0,3);

    return scored.map(item=>item.path);
  }

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
    const coreTargetPaths=this.resolveCoreTargetPaths(task,input);
    const targetFilesKnown=Boolean(
      input.targetFiles && Array.isArray(input.targetFiles) && input.targetFiles.length>0 ||
      (targetText && sourceSnapshot.some(file=>file.path.toLowerCase()===targetText || file.path.toLowerCase().endsWith(`/${targetText}`))) ||
      coreTargetPaths.length>0 ||
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

  /**
   * Goal間の競合をCOREが決定論的に解決する。
   * 候補が与えられていない場合は現在Goalのみを正本候補として扱う。
   * 配列順・Map挿入順・非同期完了順は最終判断に使用しない。
   */
  resolveGoalConflicts(task:BlackboardTask):GoalConflictDecision {
    const input=this.payload(task);
    const raw=Array.isArray(input.goalCandidates)?input.goalCandidates:[];

    const candidates:CoreGoalCandidate[]=[{
      id:'CURRENT_TASK_GOAL',
      goal:task.goal,
      priority:100,
      foreground:String(input.kind||'')==='USER_REQUEST' || input.foreground===true,
      safetyRequired:false,
      permissionGranted:true,
      status:'ACTIVE'
    }];

    for(const item of raw){
      if(!item||typeof item!=='object')continue;
      const x=item as Record<string,unknown>;
      const goal=String(x.goal||'').trim();
      const id=String(x.id||'').trim();
      if(!goal||!id||id==='CURRENT_TASK_GOAL')continue;
      candidates.push({
        id,goal,
        priority:Number.isFinite(Number(x.priority))?Number(x.priority):0,
        foreground:x.foreground===true,
        safetyRequired:x.safetyRequired===true,
        permissionGranted:x.permissionGranted!==false,
        deadlineAt:Number.isFinite(Number(x.deadlineAt))?Number(x.deadlineAt):undefined,
        dependsOn:Array.isArray(x.dependsOn)?x.dependsOn.map(String):[],
        conflictsWith:Array.isArray(x.conflictsWith)?x.conflictsWith.map(String):[],
        includes:Array.isArray(x.includes)?x.includes.map(String):[],
        status:(typeof x.status==='string'?x.status:'ACTIVE') as CoreGoalCandidate['status']
      });
    }

    const byId=new Map(candidates.map(x=>[x.id,x]));
    const actionable=candidates.filter(x=>!['COMPLETED','CANCELLED'].includes(String(x.status||'')));
    const dependencySatisfied=(x:CoreGoalCandidate)=>{
      return (x.dependsOn||[]).every(depId=>{
        const dep=byId.get(depId);
        return Boolean(dep && dep.status==='COMPLETED');
      });
    };
    const safetyRank=(x:CoreGoalCandidate)=>x.safetyRequired?2:(x.permissionGranted?1:0);
    const permissionRank=(x:CoreGoalCandidate)=>x.permissionGranted?1:0;
    const dependencyRank=(x:CoreGoalCandidate)=>dependencySatisfied(x)?1:0;
    const deadlineRank=(x:CoreGoalCandidate)=>Number.isFinite(x.deadlineAt)?-(x.deadlineAt as number):Number.MIN_SAFE_INTEGER;
    const canonicalKey=(x:CoreGoalCandidate)=>
      `${x.id}\u0000${x.goal}\u0000${String(x.priority).padStart(12,'0')}\u0000${x.deadlineAt||0}`;

    const compare=(a:CoreGoalCandidate,b:CoreGoalCandidate)=>{
      const ordered=[
        Number(a.foreground===true)-Number(b.foreground===true),
        Number(a.priority)-Number(b.priority),
        safetyRank(a)-safetyRank(b),
        permissionRank(a)-permissionRank(b),
        dependencyRank(a)-dependencyRank(b),
        deadlineRank(a)-deadlineRank(b),
      ];
      for(const d of ordered){
        if(d!==0)return d;
      }
      const ak=canonicalKey(a),bk=canonicalKey(b);
      return ak<bk?-1:ak>bk?1:0;
    };

    const sorted=[...actionable].sort((a,b)=>-compare(a,b));
    const selected=sorted.find(x=>dependencySatisfied(x)&&x.permissionGranted!==false) || sorted[0] || candidates[0];
    const pausedGoalIds:string[]=[];
    const blockedGoalIds:string[]=[];
    const decisions:GoalConflictDecision['decisions']=[];

    for(const x of actionable){
      if(x.id===selected.id){
        decisions.push({goalId:x.id,action:'SELECT',reason:'CORE deterministic goal precedence',comparisonKey:canonicalKey(x)});
        continue;
      }
      const blocked=!dependencySatisfied(x);
      const denied=x.permissionGranted===false;
      let action:'PAUSE'|'BLOCK'|'WAIT'='PAUSE';
      let reason='Foreground/priority conflict; goal paused for later resume';
      if(blocked){ action='BLOCK'; reason='Goal dependency is not satisfied'; blockedGoalIds.push(x.id); }
      else if(denied){ action='WAIT'; reason='User/permission decision is required'; }
      else { pausedGoalIds.push(x.id); }
      decisions.push({goalId:x.id,action,reason,comparisonKey:canonicalKey(x)});
    }

    return {
      selectedGoalId:selected.id,
      selectedGoal:selected.goal,
      conflictDetected:actionable.length>1,
      pausedGoalIds:[...new Set(pausedGoalIds)],
      blockedGoalIds:[...new Set(blockedGoalIds)],
      decisions
    };
  }

  plan(task:BlackboardTask):PlannedRoute[] {
    const input=this.payload(task);
    const kind=String(input.kind||'SYSTEM_TASK');
    const entry=String(input.entry||'');
    const selfImprovement=kind==='SELF_IMPROVEMENT';

    // All SELF_IMPROVEMENT tasks use the same adaptive CORE cognition,
    // regardless of whether the task originated from UI, AUTOPILOT,
    // execution-failure recovery, or another CORE/system ingress. The
    // ingress metadata remains descriptive; it must not create a second
    // self-improvement brain or a second planning algorithm.
    if(selfImprovement) return this.planAdaptiveImprovement(task,input);
    if(kind==='USER_REQUEST' && entry==='TYPED_CONVERSATION_UI_GATEWAY') return this.planConversation(task,input);

    const learningRoutes=this.planLearningFromCompletedResults(task);
    if(learningRoutes.length>0) return this.decorateOperations(task,this.uniqueOperations(learningRoutes));

    return this.planGeneral(task,input,kind);
  }

  private planAdaptiveImprovement(task:BlackboardTask,input:Record<string,unknown>):PlannedRoute[] {
    const learningRoutes=this.planLearningFromCompletedResults(task);
    if(learningRoutes.length>0)
      return this.decorateOperations(task,this.uniqueOperations(learningRoutes));

    const readiness=this.assessImprovementReadiness(task);
    const coreTargetPaths=this.resolveCoreTargetPaths(task,input);
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
          targetFiles:Array.isArray(input.targetFiles)
            ? input.targetFiles.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).slice(0,3)
            : coreTargetPaths,
          requirements:input.requirements,
          prohibitions:input.prohibitions,
          invariants:input.invariants,
          validationRequirements:input.validationRequirements,
          adaptive:true,priority:80
        }
      });
    } else if(latestCandidate && this.lastOperationFailed(task,'VALIDATE_CANDIDATE')) {
      const candidate=this.extractCandidateIdentity(latestCandidate!);
      routes.push({
        target:'selfDevelopment',command:'GENERATE_CANDIDATE',
        reason:'Validation rejected the candidate; Core requests a new Candidate Revision',
        payload:{taskId:task.taskId,runId:String(input.runId||task.taskId),goal:task.goal,
          candidateRevision:Number(candidate.candidateRevision||1)+1,
          targetFiles:Array.isArray(input.targetFiles)
            ? input.targetFiles.filter((value):value is string=>typeof value==='string'&&Boolean(value.trim())).slice(0,3)
            : coreTargetPaths,
          requirements:input.requirements,
          prohibitions:input.prohibitions,
          invariants:input.invariants,
          validationRequirements:input.validationRequirements,
          adaptive:true,priority:75}
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

  private buildIntentHypothesisContext(task:BlackboardTask, plan:MultiIntentPlan){
    const completed:string[]=[]; const failed:string[]=[]; const evidence:string[]=[];
    for(const entry of task.entries){
      if(entry.kind!=='RESULT'&&entry.kind!=='ERROR'&&entry.kind!=='OBSERVATION') continue;
      const value=objectValue(entry);
      const ids=Array.isArray(value?.intentIds)?value.intentIds.filter((x):x is string=>typeof x==='string'):[];
      if(entry.kind==='RESULT') completed.push(...ids);
      if(entry.kind==='ERROR') failed.push(...ids);
      if(Array.isArray(value?.evidenceIds)) evidence.push(...value.evidenceIds.filter((x):x is string=>typeof x==='string'));
    }
    return {completedIntentIds:[...new Set(completed)],failedIntentIds:[...new Set(failed)],evidenceIntentIds:[...new Set(evidence)]};
  }

  private planConversation(task:BlackboardTask,input:Record<string,unknown>):PlannedRoute[] {
    const text=String(input.text||task.goal||'');
    const intentPlan=decomposeMultiIntent(text);
    const intentContext=this.buildIntentHypothesisContext(task,intentPlan);
    const hypothesisSelection=selectMultiIntentHypothesis(intentPlan,intentContext);
    const selectedHypothesis=intentPlan.hypotheses.find((h: MultiIntentPlan['hypotheses'][number])=>h.id===hypothesisSelection.selectedId);
    const selectedIntentIds=selectedHypothesis?.intentIds||intentPlan.units.map((unit: MultiIntentPlan['units'][number])=>unit.id);
    const completedSet=new Set(intentContext.completedIntentIds);
    const pendingUnits=intentPlan.units.filter((unit: MultiIntentPlan['units'][number])=>selectedIntentIds.includes(unit.id)&&!completedSet.has(unit.id));
    const selectedUnit=(hypothesisSelection.selectedKind==='SEQUENTIAL'||hypothesisSelection.selectedKind==='DEPENDENT')
      ? pendingUnits.find((unit: MultiIntentPlan['units'][number])=>unit.dependencies.every((dep:string)=>completedSet.has(dep))) || pendingUnits[0]
      : pendingUnits[0];
    const focusedText=selectedUnit?.text||text;
    const intentPayload={intentPlanKey:intentPlan.deterministicKey,intentHypothesisId:hypothesisSelection.selectedId,intentHypothesisKind:hypothesisSelection.selectedKind,intentIds:selectedUnit?[selectedUnit.id]:pendingUnits.map((unit: MultiIntentPlan['units'][number])=>unit.id)};
    const parallelKnowledgeUnits=hypothesisSelection.selectedKind==='PARALLEL'
      ? pendingUnits.filter((unit: MultiIntentPlan['units'][number])=>unit.goal==='KNOWLEDGE' || unit.action==='RESEARCH')
      : [];
    const conversationResult=this.latestBusinessResult(task,'ANALYZE_TEXT');
    const unknownResult=this.latestBusinessResult(task,'RESOLVE_UNKNOWN');
    const researchResult=this.latestBusinessResult(task,'RUN_RESEARCH');
    const routes:PlannedRoute[]=[];

    if(!conversationResult){
      routes.push({target:'conversation',command:'ANALYZE_TEXT',reason:'COREが会話入力を解析し、必要な分類判断の基礎を作る',payload:{taskId:task.taskId,text,hasAttachments:Boolean(input.hasAttachments),adaptive:true,priority:100,...intentPayload,intentIds:[]}});
    } else if(parallelKnowledgeUnits.length>0){
      for(const unit of parallelKnowledgeUnits){
        const perUnit={...intentPayload,intentIds:[unit.id]};
        routes.push({target:'unknown',command:'RESOLVE_UNKNOWN',reason:`COREがPARALLEL仮説で独立Intent ${unit.id} を処理する`,payload:{taskId:task.taskId,question:unit.text,useSearch:/調べ|検索|最新/i.test(unit.text),hasAttachments:Boolean(input.hasAttachments),adaptive:true,priority:90,...perUnit}});
      }
    } else if(selectedUnit?.goal==='BUILD_OR_CHANGE'){
      routes.push({target:'selfDevelopment',command:'GENERATE_CANDIDATE',reason:`COREがBUILD_OR_CHANGE Intent ${selectedUnit.id} をselfDevelopmentへ委譲する`,payload:{taskId:task.taskId,runId:String(input.runId||task.taskId),goal:selectedUnit.text,candidateRevision:Number(input.candidateRevision||1),requirements:input.requirements,prohibitions:input.prohibitions,invariants:input.invariants,validationRequirements:input.validationRequirements,deliveryRequirements:input.deliveryRequirements,operationMode:'MULTI_INTENT_BUILD',adaptive:true,priority:80,...intentPayload,intentIds:[selectedUnit.id]}});
    } else {
      const unknownTerms=conversationResult&&!this.lastOperationFailed(task,'RESOLVE_UNKNOWN')?detectUnknownTermsFromBlackboardValue(objectValue(conversationResult)):[];
      if((/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(focusedText) || unknownTerms.length>0) && !unknownResult){
        routes.push({target:'unknown',command:'RESOLVE_UNKNOWN',reason:unknownTerms.length>0?`COREが解析結果から未解決語(${unknownTerms.join('、')})を検出し、調査で解消する`:'COREが不足知識を検出し、回答に必要な未知事項を解消する',payload:{taskId:task.taskId,question:focusedText,useSearch:unknownTerms.length>0||/調べ|検索|最新/i.test(focusedText),unknownTerms,hasAttachments:Boolean(input.hasAttachments),adaptive:true,priority:90,...intentPayload}});
      } else if(unknownResult && !researchResult && task.entries.some(e=>e.kind==='RESULT'&&/gapId|researchQuestion|queryPlanId/i.test(e.key))){
        routes.push({target:'research',command:'RUN_RESEARCH',reason:'COREが未知解消結果を再評価し、明示された知識Gapを調査する',payload:{taskId:task.taskId,gapId:this.readStringFromEntries(task,/gapId/i),query:focusedText,adaptive:true,priority:80,...intentPayload}});
      }
    }
    return this.decorateOperations(task,this.uniqueOperations(routes));
  }

  private planLearningFromCompletedResults(task:BlackboardTask):PlannedRoute[] {
    const routes:PlannedRoute[]=[]; const sources=['research','execution','verification'] as const;
    for(const entry of [...successfulBusinessEntries(task)].reverse()){
      if(!sources.includes(entry.domain as typeof sources[number])) continue; const value=objectValue(entry); if(!value) continue;
      const sourceOperation=String(value.operation||''); const sourceOperationInstanceId=String(value.operationInstanceId||'');
      if(!sourceOperation||!sourceOperationInstanceId||sourceOperation==='LEARN_FROM_CORE_RESULT') continue;
      const evidenceIds=[...new Set(entry.evidenceIds||[])]; if(evidenceIds.length===0) continue;
      const alreadyLearned=task.entries.some(existing=>existing.kind==='RESULT'&&objectValue(existing)?.operation==='LEARN_FROM_CORE_RESULT'&&String(objectValue(existing)?.sourceOperationInstanceId||'')===sourceOperationInstanceId);
      if(alreadyLearned) continue;
      const reply=value.reply&&typeof value.reply==='object'?value.reply as Record<string,unknown>:{}; const data=reply.data&&typeof reply.data==='object'?reply.data as Record<string,unknown>:{};
      const verified=entry.domain==='research'?data.resolved===true:entry.domain==='verification'?(data.validationStatus==='PASSED'||data.passed===true||data.verified===true):(data.passed===true||data.verified===true);
      const rawOutcome=String(reply.status||'SUCCEEDED').toUpperCase(); const outcome=rawOutcome==='FAILED'||rawOutcome==='REJECTED'?'FAILURE':'SUCCESS';
      const capabilityIds=Array.isArray(data.capabilityIds)?data.capabilityIds.map(String).filter(Boolean):[]; const concepts=`${task.goal} ${sourceOperation}`.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean).slice(0,12);
      routes.push({target:'learning',command:'LEARN_FROM_CORE_RESULT',reason:`CORE selected learning from evidence-producing ${entry.domain}:${sourceOperation}`,payload:{taskId:task.taskId,sourceDomain:entry.domain,sourceOperation,sourceOperationInstanceId,evidenceIds,outcome,verified,learningDomain:'system',key:`${entry.domain}:${sourceOperation}:${sourceOperationInstanceId}`,input:task.goal,concepts,capabilityIds,lesson:`${entry.domain}:${sourceOperation} -> unified learning; verified=${verified}`,adaptive:true,priority:90}}); break;
    } return routes;
  }

  private planGeneral(task:BlackboardTask,input:Record<string,unknown>,kind:string):PlannedRoute[] {
    const text=`${task.goal} ${task.entries.map(e=>`${e.key} ${String(e.value)}`).join(' ')}`;
    const operation=String(input.operation||'');
    const routes:PlannedRoute[]=[];
    if(operation==='DECIDE_CANDIDATE_ADOPTION'){
      const decision=String(input.userDecision||'').toUpperCase();
      if(decision==='ACCEPT'){
        routes.push({target:'promotion',command:'APPROVE_REVIEWED_CANDIDATE',reason:'COREが外部評価後の利用者採用決定をpromotionへ委譲する',payload:{...input,taskId:task.taskId,operation,adaptive:true,priority:100}});
      }else{
        routes.push({target:'strategy',command:'ASSESS_DOMAIN',reason:`COREが外部レビューDecision ${decision||'UNKNOWN'} を受理し、採用経路以外の後続処理を確定する`,payload:{...input,taskId:task.taskId,operation,userDecision:decision,adaptive:true,priority:100}});
      }
      return this.decorateOperations(task,this.uniqueOperations(routes));
    }
    if(operation==='APPROVE_REVIEWED_CANDIDATE'){
      routes.push({target:'promotion',command:'APPROVE_REVIEWED_CANDIDATE',reason:'COREが明示承認済みCandidateの適用をpromotion経路へ委譲する',payload:{...input,taskId:task.taskId,operation,adaptive:true,priority:100}});
      return this.decorateOperations(task,this.uniqueOperations(routes));
    }

    // UI-owned persistence/diagnostic operations still enter CORE, but they
    // must not fall into the generic conversation/strategy fallback.
    // The operation is already an explicit structured field in the request;
    // no new entry tag is introduced.
    const coreOwnedDataOperations=new Set([
      'SAVE_EXTERNAL_CONNECTION_CONFIG',
      'TEST_EXTERNAL_CONNECTION',
      'SAVE_WEB_RESEARCH_POLICY',
      'SAVE_RESEARCH_QUERY_PLANNING_POLICY',
      'SAVE_CORE_CYCLE_SETTINGS'
    ]);
    const coreOwnedAutonomyOperations=new Set(['SAVE_AUTONOMY_CONFIG']);
    if(coreOwnedAutonomyOperations.has(operation)){
      routes.push({
        target:'autonomy',
        command:'SAVE_AUTONOMY_CONFIG',
        reason:`CORE selected the autonomy classification for operation ${operation}`,
        payload:{...input,taskId:task.taskId,operation,requestedOperation:operation,goal:task.goal,adaptive:true,priority:100}
      });
      return this.decorateOperations(task,this.uniqueOperations(routes));
    }
    if(coreOwnedDataOperations.has(operation)){
      routes.push({
        target:'data',
        command:'ASSESS_DOMAIN',
        reason:`CORE selected the data classification for operation ${operation}`,
        payload:{
          ...input,
          taskId:task.taskId,
          operation,
          requestedOperation:operation,
          goal:task.goal,
          adaptive:true,
          priority:100
        }
      });
      return this.decorateOperations(task,this.uniqueOperations(routes));
    }

    const routesFromAssessment=[...this.adoptAssessmentProposals(task)];
    routes.push(...routesFromAssessment);

    const isUnknown=/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(text);
    const isSelfImprovement=kind==='SELF_IMPROVEMENT';

    /*
     * P0: Researchは「1回やったら終了」ではない。
     * 最新のRUN_RESEARCH結果が continuationAvailable=true なら、COREが
     * 同じTaskの次cycleでResearchを再選択する。これは固定チェーンではなく、
     * Evidence/Verificationの状態に応じた再評価である。
     */
    const latestResearch=this.latestBusinessResult(task,'RUN_RESEARCH');
    const latestResearchValue=latestResearch ? objectValue(latestResearch) : undefined;
    const latestResearchReply=latestResearchValue?.reply && typeof latestResearchValue.reply==='object'
      ? latestResearchValue.reply as Record<string,unknown>
      : undefined;
    const latestResearchData=(latestResearchReply?.data||latestResearchReply?.result) as Record<string,unknown>|undefined;
    const continuationAvailable=Boolean(
      latestResearchData?.continuationAvailable===true ||
      latestResearchValue?.continuationAvailable===true
    );
    const researchGapId=String(
      latestResearchData?.gapId ||
      latestResearchValue?.gapId ||
      this.readStringFromEntries(task,/gapId/i) ||
      ''
    );

    if(continuationAvailable && researchGapId){
      routes.push({
        target:'research',
        command:'RUN_RESEARCH',
        reason:'CORE re-evaluated insufficient verification and continued the same Knowledge Gap research',
        payload:{
          taskId:task.taskId,
          gapId:researchGapId,
          query:latestResearchData?.nextQuery,
          continuationRound: Number.isFinite(Number(latestResearchData?.continuationRound))
            ? Number(latestResearchData?.continuationRound) + 1
            : 1,
          adaptive:true,
          researchContinuation:true,
          priority:95
        }
      });
    } else {
      if(!task.visitedDomains.includes('conversation'))
        routes.push({target:'conversation',command:'ANALYZE_TEXT',reason:'入力を構造化する',payload:{text:task.goal}});
      if(isUnknown&&!task.visitedDomains.includes('unknown'))
        routes.push({target:'unknown',command:'RESOLVE_UNKNOWN',reason:'未知・不足情報を分類する',payload:{question:task.goal,useSearch:/調べ|検索|最新/i.test(text),hasAttachments:Boolean(input.hasAttachments)}});
      if(isSelfImprovement&&!task.visitedDomains.includes('improvement'))
        routes.push({target:'improvement',command:'RUN_SELF_IMPROVEMENT',reason:'自己改善入口を評価する',payload:{trigger:`blackboard-${task.taskId}`,taskId:task.taskId}});
      if(routes.length===0&&!task.visitedDomains.includes('strategy'))
        routes.push({target:'strategy',command:'ASSESS_DOMAIN',reason:'次経路を決定するため戦略状態を取得する',payload:{taskId:task.taskId,kind}});
    }
    return this.decorateOperations(task,this.uniqueOperations(routes));
  }

  assessCompletion(task:BlackboardTask):CoreCompletionAssessment {
    const input=this.payload(task);
    const isSelfImprovement=String(input.kind||'')==='SELF_IMPROVEMENT';
    if(isSelfImprovement) return coreCompletionGateService.evaluate(task,[]);
    const isUiConversation=String(input.kind||'')==='USER_REQUEST' && String(input.entry||'')==='TYPED_CONVERSATION_UI_GATEWAY';
    if(isUiConversation) return this.evaluateConversationCompletion(task);

    const operation=String(input.operation||'');
    if(operation==='APPROVE_REVIEWED_CANDIDATE'){
      return coreCompletionGateService.evaluate(task,['promotion']);
    }
    if(operation==='DECIDE_CANDIDATE_ADOPTION'){
      return coreCompletionGateService.evaluateCoreOwnedOperation(task,operation,'strategy');
    }
    const coreOwnedAutonomyOperations=new Set(['SAVE_AUTONOMY_CONFIG']);
    if(coreOwnedAutonomyOperations.has(operation)){
      return coreCompletionGateService.evaluateCoreOwnedOperation(task,operation,'autonomy');
    }
    const coreOwnedDataOperations=new Set([
      'SAVE_EXTERNAL_CONNECTION_CONFIG',
      'TEST_EXTERNAL_CONNECTION',
      'SAVE_WEB_RESEARCH_POLICY',
      'SAVE_RESEARCH_QUERY_PLANNING_POLICY',
      'SAVE_CORE_CYCLE_SETTINGS'
    ]);
    if(coreOwnedDataOperations.has(operation)){
      return coreCompletionGateService.evaluateCoreOwnedOperation(task,operation,'data');
    }

    const text=`${task.goal} ${String(input.kind||'')}`;
    const isUnknown=/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(text);
    const required=isUnknown
      ? ['conversation','unknown','research','verification','experience','learning','memory'] as MikiDomain[]
      : ['conversation','strategy','safety','experience','memory'] as MikiDomain[];
    return coreCompletionGateService.evaluate(task,required);
  }

  private evaluateConversationCompletion(task:BlackboardTask):CoreCompletionAssessment {
    const analysis=this.latestBusinessResult(task,'ANALYZE_TEXT');
    const intentPlan=decomposeMultiIntent(task.goal);
    const completedIntentIds=new Set<string>();
    const failedIntentIds=new Set<string>();
    for(const entry of task.entries){
      if(entry.kind!=='RESULT'&&entry.kind!=='ERROR') continue;
      const value=objectValue(entry);
      const ids=Array.isArray(value?.intentIds)?value.intentIds.filter((x):x is string=>typeof x==='string'):[];
      if(entry.kind==='RESULT') ids.forEach(id=>completedIntentIds.add(id));
      else ids.forEach(id=>failedIntentIds.add(id));
    }
    const final=task.entries.some(e=>e.domain==='core'&&e.kind==='RESULT'&&e.key==='conversationFinalResponse');
    if(intentPlan.isMultiIntent){
      const missing=intentPlan.units.filter((unit: MultiIntentPlan['units'][number])=>unit.goal!=='INTERACT'&&!completedIntentIds.has(unit.id)).map((unit: MultiIntentPlan['units'][number])=>unit.id);
      const failed=[...failedIntentIds].filter(id=>!completedIntentIds.has(id));
      const reasons:string[]=[];
      if(!analysis) reasons.push('CONVERSATION_ANALYSIS_MISSING');
      if(missing.length) reasons.push(`INTENT_RESULTS_MISSING:${missing.join('|')}`);
      if(failed.length) reasons.push(`INTENT_RESULTS_FAILED:${failed.join('|')}`);
      if(!final) reasons.push('FINAL_RESPONSE_MISSING');
      return {businessCompletion:reasons.length===0,failClosed:true,requiredDomains:[],missingDomains:[],failedDomains:[],missingReceipts:[],persistenceConfirmed:true,evidenceQualityPassed:true,reasons,missingRequiredOperations:[]};
    }
    const unknownNeeded=/不明|未知|調べ|検索|最新|わから|knowledge.?gap/i.test(task.goal);
    const unknown=unknownNeeded?this.latestBusinessResult(task,'RESOLVE_UNKNOWN'):undefined;
    const researchNeeded=task.entries.some(e=>e.kind==='RESULT'&&/gapId|researchQuestion|queryPlanId/i.test(e.key));
    const research=researchNeeded?this.latestBusinessResult(task,'RUN_RESEARCH'):undefined;
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
      const intentSuffix=Array.isArray(route.payload.intentIds)&&route.payload.intentIds.length>0
        ? `-${route.payload.intentIds.map(String).join('-')}` : '';
      const operationInstanceId=`OPI-${task.taskId}-${route.command}-${attempt}${intentSuffix}`;
      const dedupeKey=`${task.taskId}:${route.command}:${attempt}${intentSuffix}`;
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
    return [...unique.values()].sort((a,b)=>{
      const pa=Number(a.payload.priority||0), pb=Number(b.payload.priority||0);
      if(pa!==pb)return pb-pa;
      const sa=Boolean(a.payload.safetyApproved===true), sb=Boolean(b.payload.safetyApproved===true);
      if(sa!==sb)return Number(sb)-Number(sa);
      const da=Boolean(a.payload.dependenciesSatisfied===true), db=Boolean(b.payload.dependenciesSatisfied===true);
      if(da!==db)return Number(db)-Number(da);
      const ea=Array.isArray(a.payload.evidenceIds)?a.payload.evidenceIds.length:0;
      const eb=Array.isArray(b.payload.evidenceIds)?b.payload.evidenceIds.length:0;
      if(ea!==eb)return eb-ea;
      const ca=Number(a.payload.confidence||0), cb=Number(b.payload.confidence||0);
      if(ca!==cb)return cb-ca;
      const keyA=`${a.target}\u0000${a.command}\u0000${String(a.payload.operationInstanceId||'')}\u0000${String(a.payload.dedupeKey||'')}`;
      const keyB=`${b.target}\u0000${b.command}\u0000${String(b.payload.operationInstanceId||'')}\u0000${String(b.payload.dedupeKey||'')}`;
      return keyA<keyB?-1:keyA>keyB?1:0;
    });
  }
}

function canonicalRouteKey(route:PlannedRoute):string {
  return `${route.target}:${route.command}:${JSON.stringify(route.payload)}`;
}

export const adaptiveRoutePlannerService=new AdaptiveRoutePlannerService();
