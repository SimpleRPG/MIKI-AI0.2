import type { MikiDomain } from './crossDomainCirculationService';
import { taskBlackboardService, type BlackboardTask, type BlackboardEntry } from './taskBlackboardService';
import type { DomainCommand } from './domainRouterService';
import { evidenceQualityGateService } from './evidenceQualityGateService';
import { coreCompletionGateService, type CoreCompletionAssessment } from './coreCompletionGateService';
import { corePlanRevisionService } from './corePlanRevisionService';
import { EvidenceService } from '../../memory/services/evidenceService';
import { proposalQuarantineService } from './proposalQuarantineService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
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
  codeUnderstandingReady:boolean;
  codeUnderstandingReused:boolean;
  codeUnderstandingSnapshotSha256?:string;
  relatedCodePaths:string[];
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
  private resolveCoreTargetPaths(task:BlackboardTask,input:Record<string,unknown>):string[] {
    const explicit=Array.isArray(input.targetFiles)
      ? input.targetFiles
        .filter((value):value is string=>typeof value==="string"&&Boolean(value.trim()))
        .map(value=>value.trim())
      : [];

    const sourcePaths=selfCodeSpaceService.listSourceFiles().map(file=>file.path);
    const explicitCanonical=explicit.map(target=>{
      const normalized=String(target||'').trim().replace(/^\.\//,'');
      if(!normalized)return '';
      if(sourcePaths.includes(normalized))return normalized;
      const suffixMatches=sourcePaths.filter(path=>path.endsWith('/'+normalized));
      return suffixMatches.length===1?suffixMatches[0]:'';
    }).filter(Boolean);

    // CORE must not treat a stale/missing explicit target as a valid
    // candidate-generation snapshot. If any explicit target is missing,
    // fall back to observations so ASSESS_DOMAIN can refresh the planning
    // snapshot before GENERATE_CANDIDATE is selected again.
    const explicitSnapshotComplete=
      explicit.length>0 &&
      explicitCanonical.length===explicit.length;

    const fromEntries=!explicitSnapshotComplete
      ? this.stringArrayFromEntries(task,/target.?files|targetPaths|changedFilePaths/i)
      : [];

    const discovered:string[]=[
      ...(explicitSnapshotComplete?explicitCanonical:[]),
      ...fromEntries
    ];

    // ASSESS_DOMAIN is intentionally observational. CORE must promote the
    // observed targetFiles into the next planning snapshot instead of
    // dispatching ASSESS_DOMAIN repeatedly.
    if(discovered.length===0){
      for(const entry of [...task.entries].reverse()){
        if(entry.kind!=='RESULT'&&entry.kind!=='OBSERVATION') continue;
        if(entry.domain!=='selfDevelopment') continue;

        const value=objectValue(entry);
        if(!value) continue;

        const operation=String(value.operation||'');
        const reply=value.reply&&typeof value.reply==='object'
          ? value.reply as Record<string,unknown>
          : undefined;

        const dataCandidate=reply?.data||reply?.result||value.result;
        const data=dataCandidate&&typeof dataCandidate==='object'&&!Array.isArray(dataCandidate)
          ? dataCandidate as Record<string,unknown>
          : undefined;

        if(operation!=='ASSESS_DOMAIN' && String(data?.operation||'')!=='ASSESS_DOMAIN') continue;

        if(Array.isArray(data?.targetFiles)){
          discovered.push(
            ...data.targetFiles
              .filter((value):value is string=>typeof value==='string'&&Boolean(value.trim()))
              .map(value=>value.trim())
          );
          break;
        }
      }
    }

    const canonicalized=discovered.map(target=>{
      const normalized=String(target||'').trim().replace(/^\.\//,'');
      if(!normalized)return '';
      if(sourcePaths.includes(normalized))return normalized;
      const suffixMatches=sourcePaths.filter(path=>path.endsWith('/'+normalized));
      return suffixMatches.length===1?suffixMatches[0]:normalized;
    }).filter(Boolean);

    return [...new Set(canonicalized)].slice(0,3);
  }

  private resolveCoreRunId(task:BlackboardTask,input:Record<string,unknown>):string {
    const explicit=String(input.runId||'').trim();
    if(explicit) return explicit;

    const decision=[...task.entries].reverse().find(entry=>
      entry.kind==='DECISION' &&
      entry.domain==='core' &&
      entry.key==='coreSelfImprovementRun'
    );

    const decisionValue=decision?objectValue(decision):undefined;
    const decisionRunId=String(decisionValue?.runId||'').trim();
    if(decisionRunId) return decisionRunId;

    const linkedRuns=task.entries
      .filter(entry=>entry.domain==='core'&&/improvementRun|runId/i.test(entry.key))
      .map(entry=>String(objectValue(entry)?.runId||'').trim())
      .filter(Boolean);

    return linkedRuns[linkedRuns.length-1]||task.taskId;
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
      results.some(entry=>/improvement|selfAwareness|DISCOVER_IMPROVEMENT_ISSUE/i.test(entry.domain+':'+entry.key)) ||
      observations.some(entry=>{
        const value=objectValue(entry);
        const operation=String(value?.operation||entry.key||'');
        const operationClass=String(value?.operationClass||'');
        return operationClass==='DIAGNOSTIC' &&
          /DISCOVER_IMPROVEMENT_ISSUE|IMPROVEMENT_ASSESSMENT/i.test(operation);
      })
    );

    const sourceSnapshot=selfCodeSpaceService.listSourceFiles();
    const targetText=String(input.target||'').trim().toLowerCase();
    const repositoryContextAvailable=Boolean(
      input.repositoryContext || input.repositoryPath || sourceSnapshot.length>0 ||
      results.some(entry=>this.containsKey(entry,/repository.?context|repositoryPath|target.?files|targetFiles|sourceSnapshot/i))
    );
    const coreTargetPaths=this.resolveCoreTargetPaths(task,input);
    const targetFilesKnown=coreTargetPaths.length>0;
    const understanding=targetFilesKnown
      ? selfCodeUnderstandingService.ensure(coreTargetPaths)
      : {ready:false,reused:false,repoSha256:'',targetPaths:[],relatedPaths:[],reasons:['TARGET_FILES_UNKNOWN']};

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
      && understanding.ready && requiredEvidenceSatisfied && unresolvedKnowledge.length===0 && unresolvedCapability.length===0;
    const validationReady=Boolean(candidateResult && this.hasCandidateIdentity(candidateResult));
    const reviewPackageReady=Boolean(validationResult && this.hasValidationIdentity(validationResult));

    const blockingReasons:string[]=[];
    if(!issueEstablished) blockingReasons.push('IMPROVEMENT_ISSUE_NOT_ESTABLISHED');
    if(!repositoryContextAvailable) blockingReasons.push('REPOSITORY_CONTEXT_MISSING');
    if(!targetFilesKnown) blockingReasons.push('TARGET_FILES_UNKNOWN');
    if(targetFilesKnown && !understanding.ready) blockingReasons.push(...understanding.reasons);
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
      recommendedOperations:[...new Set(recommendedOperations)],
      codeUnderstandingReady:understanding.ready,
      codeUnderstandingReused:understanding.reused,
      codeUnderstandingSnapshotSha256:understanding.snapshotSha256,
      relatedCodePaths:understanding.relatedPaths
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

    const memoryRecovery=this.planMemoryRecovery(task,input);
    if(memoryRecovery.length>0){
      return this.decorateOperations(task,this.uniqueOperations(memoryRecovery));
    }

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

  private planMemoryRecovery(task:BlackboardTask,input:Record<string,unknown>):PlannedRoute[] {
    const latestAssessment=[...task.entries]
      .map((entry,index)=>({entry,index}))
      .reverse()
      .find(({entry}) =>
        entry.domain==='core' &&
        entry.kind==='DECISION' &&
        String(entry.key).startsWith('coreMemoryContextAssessment:')
      );

    const assessmentValue=latestAssessment
      ? objectValue(latestAssessment.entry)
      : undefined;

    if(String(assessmentValue?.status||'').toUpperCase()!=='CONTEXT_INSUFFICIENT'){
      return [];
    }

    const latestUnknown=this.latestBusinessResult(task,'RESOLVE_UNKNOWN');
    const unknownIndex=latestUnknown
      ? task.entries.indexOf(latestUnknown)
      : -1;

    const assessmentIndex=latestAssessment?.index ?? -1;

    if(!latestUnknown || unknownIndex<assessmentIndex){
      return [{
        target:'unknown',
        command:'RESOLVE_UNKNOWN',
        reason:'CORE memory context is insufficient and no context-recovery UNKNOWN result exists for the current assessment',
        payload:{
          taskId:task.taskId,
          question:task.goal,
          useSearch:true,
          hasAttachments:Boolean(input.hasAttachments),
          contextRecovery:true,
          contextRecoveryReason:'CONTEXT_INSUFFICIENT',
          adaptive:true,
          priority:100
        }
      }];
    }

    const unknownValue=objectValue(latestUnknown);
    const unknownReply=
      unknownValue?.reply &&
      typeof unknownValue.reply==='object'
        ? unknownValue.reply as Record<string,unknown>
        : undefined;

    const unknownData=
      unknownReply?.data &&
      typeof unknownReply.data==='object'
        ? unknownReply.data as Record<string,unknown>
        : unknownReply?.result &&
          typeof unknownReply.result==='object'
            ? unknownReply.result as Record<string,unknown>
            : undefined;

    const unknownStatus=String(
      unknownData?.status ||
      unknownValue?.status ||
      unknownReply?.status ||
      ''
    ).toUpperCase();

    const researchQuery=String(
      unknownData?.researchQuestion ||
      unknownData?.query ||
      unknownValue?.researchQuestion ||
      unknownValue?.query ||
      task.goal ||
      ''
    ).trim();

    if(
      (unknownStatus==='RESEARCH_REQUIRED' || unknownStatus==='SEARCH_FAILED') &&
      researchQuery
    ){
      const latestResearch=this.latestBusinessResult(task,'RUN_RESEARCH');
      const researchIndex=latestResearch
        ? task.entries.indexOf(latestResearch)
        : -1;

      if(researchIndex<=unknownIndex){
        return [{
          target:'research',
          command:'RUN_RESEARCH',
          reason:'CORE context recovery produced a research-required unknown; CORE now routes the query to Research',
          payload:{
            taskId:task.taskId,
            query:researchQuery,
            contextRecovery:true,
            contextRecoveryReason:'UNKNOWN_REQUIRES_RESEARCH',
            adaptive:true,
            priority:99
          }
        }];
      }
    }

    return [];
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

    /*
     * GENERATE_CANDIDATE の生成前依存解決失敗は、
     * Candidate/Canary の検証失敗とは別のCORE再評価経路として扱う。
     *
     * CODE_COMPOSITION_COMPONENT_UNRESOLVED は retryable=false でも
     * 同じ GENERATE_CANDIDATE を再投入してはいけない。
     * まず未解決ComponentをUNKNOWN/Research側へ渡し、
     * その結果をCOREが再評価してからCandidate生成へ戻す。
     */
    const latestCandidateGenerationError=this.latestOperationError(task,'GENERATE_CANDIDATE');

    if(latestCandidateGenerationError.startsWith('CODE_COMPOSITION_COMPONENT_UNRESOLVED:')){
      const unresolved=latestCandidateGenerationError
        .slice('CODE_COMPOSITION_COMPONENT_UNRESOLVED:'.length)
        .split(',')
        .map(value=>value.trim())
        .filter(Boolean);

      const errorIndex=[...task.entries].map((entry,index)=>({entry,index})).reverse()
        .find(({entry})=>{
          if(entry.kind!=='ERROR') return false;
          const value=objectValue(entry);
          return String(value?.operation||'')==='GENERATE_CANDIDATE'
            && String(value?.error||'')===latestCandidateGenerationError;
        })?.index ?? -1;

      const resolutionAfterError=[...task.entries].some((entry,index)=>{
        if(index<=errorIndex) return false;
        if(entry.domain!=='unknown' && entry.domain!=='research' && entry.domain!=='capability' && entry.domain!=='learning')
          return false;
        return entry.kind==='RESULT' || entry.kind==='OBSERVATION' || entry.kind==='EVIDENCE';
      });

      if(!resolutionAfterError){
        routes.push({
          target:'unknown',
          command:'RESOLVE_UNKNOWN',
          reason:'CORE detected a non-retryable CODE composition component gap; resolve missing components before repeating Candidate generation',
          payload:{
            taskId:task.taskId,
            question:unresolved.join(', '),
            unresolvedComponents:unresolved,
            componentGap:true,
            useSearch:true,
            adaptive:true,
            priority:92
          }
        });

        return this.decorateOperations(task,this.uniqueOperations(routes));
      }
    }

    // GENERATE_CANDIDATE が新規CODE Component Candidateを作成した場合、
    // Candidate Workspace検証とは別に、CODE Component自身のExecution Verificationへ進む。
    // 未検証Componentを通常の再合成へ混入させない。
    const createdCodeComponentIds = latestCandidate
      ? this.stringArrayFromValue(objectValue(latestCandidate), /createdCodeComponentIds/i)
      : [];

    const latestCandidateIndex = latestCandidate
      ? task.entries.indexOf(latestCandidate)
      : -1;

    const latestCodeComponentVerification = [...task.entries]
      .map((entry,index)=>({entry,index}))
      .reverse()
      .find(({entry,index}) => {
        if(index <= latestCandidateIndex) return false;
        if(entry.kind!=='RESULT' && entry.kind!=='OBSERVATION') return false;
        const value=objectValue(entry);
        return String(value?.operation||'') === 'VERIFY_CODE_COMPONENT';
      });

    const latestCodeComponentVerificationValue =
      latestCodeComponentVerification
        ? objectValue(latestCodeComponentVerification.entry)
        : undefined;

    const latestCodeComponentVerificationStatus =
      String(latestCodeComponentVerificationValue?.status || '').toUpperCase();

    const codeComponentVerificationWaiting =
      createdCodeComponentIds.length > 0 &&
      Boolean(latestCodeComponentVerification) &&
      (
        latestCodeComponentVerificationStatus === 'WAITING_EXECUTION' ||
        latestCodeComponentVerificationStatus === 'PROCESSING' ||
        latestCodeComponentVerificationStatus === 'ACCEPTED'
      );

    const codeComponentVerificationSucceeded =
      createdCodeComponentIds.length > 0 &&
      Boolean(latestCodeComponentVerification) &&
      (
        latestCodeComponentVerificationStatus === 'SUCCEEDED' ||
        latestCodeComponentVerificationStatus === 'DEVICE_TESTED' ||
        latestCodeComponentVerificationStatus === 'VERIFIED'
      );

    const codeComponentVerificationFailed =
      createdCodeComponentIds.length > 0 &&
      Boolean(latestCodeComponentVerification) &&
      (
        latestCodeComponentVerificationStatus === 'FAILED' ||
        latestCodeComponentVerificationStatus === 'REJECTED' ||
        latestCodeComponentVerificationStatus === 'ROLLED_BACK'
      );

    const codeComponentVerificationExists =
      codeComponentVerificationSucceeded;

    /*
     * NEW_COMPONENT Canary/Regression failure must return to CORE rather
     * than repeatedly verifying the rejected component.
     *
     * The failed component remains isolated as REJECTED by the safety
     * boundary. CORE owns the next decision: create a new Candidate
     * Revision using the failure information as input.
     */
    if(
      codeComponentVerificationFailed &&
      latestCandidate &&
      !codeComponentVerificationSucceeded
    ){
      const candidate=this.extractCandidateIdentity(latestCandidate);
      const failureValue=latestCodeComponentVerificationValue || {};
      const failureResults=Array.isArray(failureValue.results)
        ? failureValue.results
        : [];
      const failureReasons=failureResults
        .filter((item): item is Record<string,unknown> => Boolean(item && typeof item==='object'))
        .map(item=>String(item.reason||''))
        .filter(Boolean);

      routes.push({
        target:'selfDevelopment',
        command:'GENERATE_CANDIDATE',
        reason:'CODE Component verification/Canary failed; CORE isolates the failed NEW_COMPONENT and generates the next Candidate Revision',
        payload:{
          taskId:task.taskId,
          runId:this.resolveCoreRunId(task,input),
          goal:task.goal,
          candidateRevision:Number(candidate.candidateRevision||1)+1,
          targetFiles:coreTargetPaths,
          requirements:input.requirements,
          prohibitions:input.prohibitions,
          invariants:input.invariants,
          validationRequirements:input.validationRequirements,
          failureFeedback:{
            sourceOperation:'VERIFY_CODE_COMPONENT',
            status:latestCodeComponentVerificationStatus,
            componentIds:createdCodeComponentIds,
            reasons:failureReasons,
            result:failureValue,
            retryOfCandidateRevision:Number(candidate.candidateRevision||1),
          },
          adaptive:true,
          priority:85
        }
      });

      return this.decorateOperations(task,this.uniqueOperations(routes));
    }

    if(
      createdCodeComponentIds.length > 0 &&
      !codeComponentVerificationExists
    ){
      routes.push({
        target:'verification',
        command:'VERIFY_CODE_COMPONENT',
        reason:codeComponentVerificationWaiting
          ? 'CORE received the CODE Component execution continuation and re-evaluates the existing Regression Gate'
          : 'CORE detected newly created CODE Component Candidates and selected their execution verification before reuse',
        payload:{
          taskId:task.taskId,
          runId:this.resolveCoreRunId(task,input),
          componentIds:createdCodeComponentIds,
          environment:'ANDROID',
          adaptive:true,
          priority:100
        }
      });

      return this.decorateOperations(task,this.uniqueOperations(routes));
    }

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
      const target: MikiDomain = 'selfDevelopment';
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
          payload:{taskId:task.taskId,goal:task.goal,gapId:this.readStringFromEntries(task,/gapId/i),query:this.readStringFromEntries(task,/researchQuestion|queryPlanId/i),adaptive:true,priority:90}
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
    } else if(
      !latestCandidate &&
      (
        this.latestOperationError(task,'GENERATE_CANDIDATE')==='SOURCE_SNAPSHOT_INCOMPLETE' ||
        this.latestOperationError(task,'GENERATE_CANDIDATE')==='CORE_TARGET_FILES_NOT_FOUND' ||
        this.latestOperationError(task,'GENERATE_CANDIDATE')==='CORE_TARGET_FILES_REQUIRED'
      )
    ) {
      routes.push({
        target:'selfDevelopment',
        command:'ASSESS_DOMAIN',
        reason:'Core received an incomplete candidate source snapshot; repository context must be re-observed before candidate generation',
        payload:{
          taskId:task.taskId,
          goal:task.goal,
          kind:'SELF_IMPROVEMENT',
          adaptive:true,
          requestedAssessment:'REPOSITORY_CONTEXT',
          target:input.target,
          priority:95
        }
      });
    } else if(!latestCandidate && readiness.candidateGenerationReady) {
      routes.push({
        target:'selfDevelopment',command:'GENERATE_CANDIDATE',
        reason:'Core readiness assessment satisfied candidate-generation preconditions',
        payload:{
          taskId:task.taskId,runId:this.resolveCoreRunId(task,input),goal:task.goal,
          candidateRevision:Number(input.candidateRevision||1),
          targetFiles:coreTargetPaths,
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
        payload:{taskId:task.taskId,runId:this.resolveCoreRunId(task,input),goal:task.goal,
          candidateRevision:Number(candidate.candidateRevision||1)+1,
          targetFiles:coreTargetPaths,
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
          taskId:task.taskId,runId:this.resolveCoreRunId(task,input),
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
          taskId:task.taskId,runId:this.resolveCoreRunId(task,input),
          ...candidate,...validation,
          candidateRevision:Number(input.candidateRevision||0)||undefined,
          sourcePackageId:typeof input.sourcePackageId==="string"?input.sourcePackageId:typeof input.packageId==="string"?input.packageId:undefined,
          learningLineage:this.extractCandidateIdentity(latestCandidate).learningLineage,
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
      routes.push({target:'selfDevelopment',command:'GENERATE_CANDIDATE',reason:`COREがBUILD_OR_CHANGE Intent ${selectedUnit.id} をselfDevelopmentへ委譲する`,payload:{taskId:task.taskId,runId:this.resolveCoreRunId(task,input),goal:selectedUnit.text,candidateRevision:Number(input.candidateRevision||1),requirements:input.requirements,prohibitions:input.prohibitions,invariants:input.invariants,validationRequirements:input.validationRequirements,deliveryRequirements:input.deliveryRequirements,operationMode:'MULTI_INTENT_BUILD',adaptive:true,priority:80,...intentPayload,intentIds:[selectedUnit.id]}});
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

    // ResearchでClaimが生成された場合、学習より先に独立Verificationへ戻す。
    // Verification結果がResearchより後に存在し、必要なClaimをすべて対象としている場合だけ通過する。
    const latestResearch = task.entries
      .map((entry,index)=>({entry,index}))
      .filter(({entry}) =>
        entry.domain==='research' &&
        entry.kind==='RESULT' &&
        objectValue(entry)?.operation==='RUN_RESEARCH'
      )
      .at(-1);

    if(latestResearch){
      const researchValue=objectValue(latestResearch.entry);
      const researchClaimIds=this.stringArrayFromValue(
        researchValue,
        /claim(?:[_-]?ids?)/i
      );

      if(researchClaimIds.length>0){
        const latestVerification = [...successfulBusinessEntries(task)]
          .map((entry,index)=>({entry,index}))
          .reverse()
          .find(({entry})=>objectValue(entry)?.operation==='VERIFY_RESEARCH_CLAIMS');

        const verificationClaimIds=latestVerification
          ? this.stringArrayFromValue(
              objectValue(latestVerification.entry),
              /claim(?:[_-]?ids?)/i
            )
          : [];

        const verificationAfterResearch=Boolean(
          latestVerification &&
          task.entries.indexOf(latestVerification.entry)>latestResearch.index
        );

        const verificationValue=latestVerification
          ? objectValue(latestVerification.entry)
          : undefined;

        const verificationVerified=
          verificationAfterResearch &&
          verificationValue?.verified===true &&
          researchClaimIds.every(id=>verificationClaimIds.includes(id));

        if(!verificationAfterResearch){
          const researchComponentIds=this.stringArrayFromValue(
            researchValue,
            /component(?:[_-]?ids?)/i
          );

          routes.push({
            target:'verification',
            command:'VERIFY_RESEARCH_CLAIMS',
            reason:'CORE selected independent verification for Claims produced by Research before learning',
            payload:{
              taskId:task.taskId,
              claimIds:researchClaimIds,
              gapId:String(researchValue?.gapId||''),
              knowledgeComponentIds:researchComponentIds,
              requireFresh:false,
              adaptive:true,
              priority:95
            }
          });

          return this.decorateOperations(task,this.uniqueOperations(routes));
        }

        if(!verificationVerified){
          const continuationAvailable=
            researchValue?.continuationAvailable===true;

          const continuationQuery=String(
            researchValue?.nextQuery||
            researchValue?.researchQuery||
            ''
          ).trim();

          const gapId=String(
            researchValue?.gapId||
            verificationValue?.researchGapId||
            ''
          ).trim();

          if(continuationAvailable && (gapId || continuationQuery)){
            routes.push({
              target:'research',
              command:'RUN_RESEARCH',
              reason:'CORE verification was unresolved or contradicted; Research continuation is available',
              payload:{
                taskId:task.taskId,
                gapId,
                query:continuationQuery,
                continuationRound:Number(researchValue?.continuationRound||0)+1,
                adaptive:true,
                priority:94
              }
            });

            return this.decorateOperations(task,this.uniqueOperations(routes));
          }

          // Verification failed without an available Research continuation.
          // Do not learn the unverified/contradicted result.
          return [];
        }
      }
    }

    for(const entry of [...successfulBusinessEntries(task)].reverse()){
      if(!sources.includes(entry.domain as typeof sources[number])) continue; const value=objectValue(entry); if(!value) continue;
      const sourceOperation=String(value.operation||''); const sourceOperationInstanceId=String(value.operationInstanceId||'');
      if(!sourceOperation||!sourceOperationInstanceId||sourceOperation==='LEARN_FROM_CORE_RESULT') continue;
      const evidenceIds=[...new Set(entry.evidenceIds||[])]; if(evidenceIds.length===0) continue;
      const alreadyLearned=task.entries.some(existing=>existing.kind==='RESULT'&&objectValue(existing)?.operation==='LEARN_FROM_CORE_RESULT'&&String(objectValue(existing)?.sourceOperationInstanceId||'')===sourceOperationInstanceId);
      if(alreadyLearned) continue;
      const reply=value.reply&&typeof value.reply==='object'?value.reply as Record<string,unknown>:{}; const data=reply.data&&typeof reply.data==='object'?reply.data as Record<string,unknown>:{};
      const verified=entry.domain==='research'
        ? data.resolved===true
        : entry.domain==='verification'
          ? (sourceOperation==='VERIFY_RESEARCH_CLAIMS'
              ? data.verified===true
              : (data.validationStatus==='PASSED'||data.passed===true||data.verified===true))
          : (data.passed===true||data.verified===true);

      if(entry.domain==='verification' &&
         sourceOperation==='VERIFY_RESEARCH_CLAIMS' &&
         data.verified!==true){
        continue;
      }
      const rawOutcome=String(reply.status||'SUCCEEDED').toUpperCase(); const outcome=rawOutcome==='FAILED'||rawOutcome==='REJECTED'?'FAILURE':'SUCCESS';
      const capabilityIds=Array.isArray(data.capabilityIds)?data.capabilityIds.map(String).filter(Boolean):[]; const concepts=`${task.goal} ${sourceOperation}`.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean).slice(0,12);
      routes.push({target:'learning',command:'LEARN_FROM_CORE_RESULT',reason:`CORE selected learning from evidence-producing ${entry.domain}:${sourceOperation}`,payload:{taskId:task.taskId,sourceDomain:entry.domain,sourceOperation,sourceOperationInstanceId,evidenceIds,outcome,verified,learningDomain:'system',key:`${entry.domain}:${sourceOperation}:${sourceOperationInstanceId}`,input:task.goal,concepts,capabilityIds,lesson:`${entry.domain}:${sourceOperation} -> unified learning; verified=${verified}`,adaptive:true,priority:90}}); break;
    } return routes;
  }

  private planGeneral(task:BlackboardTask,input:Record<string,unknown>,kind:string):PlannedRoute[] {
    const text=`${task.goal} ${task.entries.map(e=>`${e.key} ${String(e.value)}`).join(' ')}`;
    const operation=String(input.operation||'');
    const routes:PlannedRoute[]=[];

    const synthesisRequested =
      input.synthesisRequested === true ||
      operation === 'SYNTHESIZE' ||
      typeof input.requiredOutput === 'string' && Boolean(input.requiredOutput.trim());

    const synthesisEntries = task.entries
      .map((entry, index) => ({entry, index}))
      .filter(({entry}) =>
        entry.domain === 'core' &&
        (entry.kind === 'ERROR' || entry.kind === 'RESULT') &&
        objectValue(entry)?.operation === 'SYNTHESIZE_UNIVERSAL'
      );

    const latestSynthesis = synthesisEntries.at(-1);

    const latestCandidate = this.latestBusinessResult(task,'GENERATE_CANDIDATE');
    const latestValidation = this.latestBusinessResult(task,'VALIDATE_CANDIDATE');

    const latestCandidateIndex = latestCandidate
      ? task.entries.indexOf(latestCandidate)
      : -1;

    const latestValidationIndex = latestValidation
      ? task.entries.indexOf(latestValidation)
      : -1;

    const latestSynthesisIndex = latestSynthesis?.index ?? -1;

    const candidateProducedAfterLatestSynthesis =
      Boolean(
        latestCandidate &&
        latestCandidateIndex > latestSynthesisIndex
      );

    const validationPassedAfterCandidate =
      Boolean(
        candidateProducedAfterLatestSynthesis &&
        latestValidation &&
        latestValidationIndex > latestCandidateIndex &&
        this.hasValidationIdentity(latestValidation)
      );

    const validationRejectedAfterCandidate =
      Boolean(
        candidateProducedAfterLatestSynthesis &&
        latestValidation &&
        latestValidationIndex > latestCandidateIndex &&
        !this.hasValidationIdentity(latestValidation)
      );

    const candidateAwaitingValidation =
      Boolean(
        candidateProducedAfterLatestSynthesis &&
        !validationPassedAfterCandidate &&
        !validationRejectedAfterCandidate &&
        (!latestValidation || latestValidationIndex <= latestCandidateIndex)
      );

    const synthesisAlreadyCompleted = task.entries.some(entry =>
      entry.domain === 'core' &&
      entry.kind === 'RESULT' &&
      objectValue(entry)?.operation === 'SYNTHESIZE_UNIVERSAL' &&
      String(objectValue(entry)?.status || '').toUpperCase() === 'SUCCEEDED'
    ) && !validationPassedAfterCandidate;

    const synthesisBlocked = latestSynthesis &&
      String(objectValue(latestSynthesis.entry)?.status || '').toUpperCase() === 'BLOCKED'
      ? objectValue(latestSynthesis.entry)
      : undefined;

    const latestResearch = task.entries
      .map((entry, index) => ({entry, index}))
      .filter(({entry}) =>
        entry.domain === 'research' &&
        (entry.kind === 'RESULT' || entry.kind === 'ERROR') &&
        (
          objectValue(entry)?.operation === 'RUN_RESEARCH' ||
          /research/i.test(entry.key)
        )
      )
      .at(-1);

    const latestResearchValue = latestResearch
      ? objectValue(latestResearch.entry)
      : undefined;

    const researchSucceeded =
      latestResearch?.entry.kind === 'RESULT' &&
      String(
        latestResearchValue?.status ||
        (latestResearchValue?.reply && typeof latestResearchValue.reply === 'object'
          ? (latestResearchValue.reply as Record<string, unknown>).status
          : '') ||
        ''
      ).toUpperCase() === 'SUCCEEDED';

    const researchCompletedAfterBlockedSynthesis = Boolean(
      synthesisBlocked &&
      latestSynthesis &&
      latestResearch &&
      latestResearch.index > latestSynthesis.index &&
      researchSucceeded
    );

    const blockedSynthesisId = synthesisBlocked
      ? String(synthesisBlocked.synthesisId || '').trim()
      : '';

    const synthesisGapResearchAlreadyRequested = task.entries.some(entry => {
      if (entry.domain !== 'core' || entry.kind !== 'DECISION') return false;
      if (!String(entry.key).startsWith('synthesisComponentGapResearchRequested:')) return false;
      const value = objectValue(entry);
      const requestedSynthesisId = String(value?.synthesisId || '').trim();
      return Boolean(
        blockedSynthesisId &&
        requestedSynthesisId &&
        requestedSynthesisId === blockedSynthesisId
      );
    });

    const researchComponentIds = this.stringArrayFromValue(
      latestResearchValue,
      /component(?:[_-]?ids?)/i
    );
    const researchEvidenceIds = this.stringArrayFromValue(
      latestResearchValue,
      /evidence(?:[_-]?ids?)/i
    );

    const reusableApprovalAlreadyRequested = Boolean(
      synthesisBlocked &&
      researchComponentIds.length > 0 &&
      task.entries.some(entry =>
        entry.domain === 'core' &&
        entry.kind === 'DECISION' &&
        entry.key === `synthesisReusableApprovalRequested:${blockedSynthesisId}`
      )
    );

    if (
      synthesisBlocked &&
      researchCompletedAfterBlockedSynthesis &&
      researchComponentIds.length > 0 &&
      !reusableApprovalAlreadyRequested
    ) {
      taskBlackboardService.append(
        task.taskId,
        'DECISION',
        'core',
        `synthesisReusableApprovalRequested:${blockedSynthesisId}`,
        {
          operation: 'APPROVE_REUSABLE_COMPONENTS',
          synthesisId: blockedSynthesisId,
          componentIds: researchComponentIds,
          evidenceIds: researchEvidenceIds,
          reason: 'CORE selected the approval gate for verified research-created reusable components before retrying synthesis'
        },
        researchEvidenceIds
      );

      return this.decorateOperations(task, this.uniqueOperations([{
        target: 'learning',
        command: 'APPROVE_REUSABLE_COMPONENTS',
        reason: 'CORE selected reusable-component approval before retrying universal synthesis',
        payload: {
          ...input,
          taskId: task.taskId,
          operation: 'APPROVE_REUSABLE_COMPONENTS',
          knowledgeComponentIds: researchComponentIds,
          componentIds: researchComponentIds,
          evidenceIds: researchEvidenceIds,
          synthesisId: blockedSynthesisId,
          adaptive: true,
          priority: 100
        }
      }]));
    }

    if (synthesisRequested && !synthesisAlreadyCompleted && researchCompletedAfterBlockedSynthesis) {
      routes.push({
        target: 'core',
        command: 'SYNTHESIZE_UNIVERSAL' as DomainCommand,
        reason: 'CORE re-evaluated completed component-gap research and retried universal synthesis',
        payload: {
          ...input,
          taskId: task.taskId,
          requestId: String(input.requestId || task.taskId),
          goal: task.goal,
          requiredOutput: typeof input.requiredOutput === 'string' ? input.requiredOutput : '',
          adaptive: true,
          synthesisRetry: true,
          priority: 100
        }
      });

      return this.decorateOperations(task, this.uniqueOperations(routes));
    }

    if (
      synthesisBlocked &&
      String(synthesisBlocked.nextCoreAction || '').toUpperCase() === 'RESEARCH_COMPONENT_GAP' &&
      !synthesisGapResearchAlreadyRequested
    ) {
      const unresolved = Array.isArray(synthesisBlocked.unresolved)
        ? synthesisBlocked.unresolved.map(String).filter(Boolean)
        : [];

      const researchMarkerKey =
        `synthesisComponentGapResearchRequested:${blockedSynthesisId || latestSynthesis?.index || 'unknown'}`;

      taskBlackboardService.append(
        task.taskId,
        'DECISION',
        'core',
        researchMarkerKey,
        {
          operation: 'SYNTHESIZE_UNIVERSAL',
          synthesisId: blockedSynthesisId,
          nextCoreAction: 'RESEARCH_COMPONENT_GAP',
          unresolved,
          reason: 'CORE re-evaluated blocked synthesis and selected research for the unresolved component gap'
        }
      );

      routes.push({
        target: 'research',
        command: 'RUN_RESEARCH',
        reason: 'CORE selected research to resolve an unresolved universal synthesis component gap',
        payload: {
          ...input,
          taskId: task.taskId,
          operation: 'RUN_RESEARCH',
          synthesisId: blockedSynthesisId,
          synthesisGap: true,
          query: [
            task.goal,
            typeof input.requiredOutput === 'string' ? input.requiredOutput : '',
            ...unresolved
          ].filter(Boolean).join(' '),
          unresolved,
          adaptive: true,
          priority: 100
        }
      });

      return this.decorateOperations(task, this.uniqueOperations(routes));
    }

    // A successful synthesis is itself an intermediate CORE result.
    // Do not fall through to an unrelated generic route: CORE must explicitly
    // evaluate the synthesis before Completion Gate / CoreResult.
    if (synthesisRequested && synthesisAlreadyCompleted && latestSynthesis) {
      const value = objectValue(latestSynthesis.entry);
      const synthesisStatus = String(value?.status || '').toUpperCase();
      const synthesisResult =
        value?.result && typeof value.result === 'object'
          ? value.result as Record<string, unknown>
          : value;

      const validation =
        synthesisResult?.validation && typeof synthesisResult.validation === 'object'
          ? synthesisResult.validation as Record<string, unknown>
          : undefined;

      const unresolved = Array.isArray(synthesisResult?.unresolved)
        ? synthesisResult.unresolved.map(String).filter(Boolean)
        : [];

      const nextCoreAction = String(
        synthesisResult?.nextCoreAction || value?.nextCoreAction || ''
      ).toUpperCase();

      const synthesisEvaluationKey =
        `coreSynthesisPostEvaluation:${String(synthesisResult?.synthesisId || value?.synthesisId || latestSynthesis.index)}`;

      const alreadyEvaluated = task.entries.some(entry =>
        entry.domain === 'core' &&
        entry.kind === 'DECISION' &&
        entry.key === synthesisEvaluationKey
      );

      if (!alreadyEvaluated) {
        taskBlackboardService.append(
          task.taskId,
          'DECISION',
          'core',
          synthesisEvaluationKey,
          {
            operation: 'SYNTHESIZE_UNIVERSAL',
            synthesisId: String(synthesisResult?.synthesisId || value?.synthesisId || ''),
            synthesisStatus,
            validationStatus: String(validation?.status || ''),
            unresolved,
            nextCoreAction,
            phase: 'POST_SYNTHESIS_REEVALUATION',
            completionBlocked:
              synthesisStatus !== 'SUCCEEDED' ||
              String(validation?.status || '').toUpperCase() !== 'PASSED' ||
              unresolved.length > 0,
            reason: 'CORE must evaluate the synthesized artifact before accepting task completion'
          }
        );
      }

      // A clean synthesis is handed to Completion Gate only when no other
      // CORE-required business operation remains.
      if (
        synthesisStatus === 'SUCCEEDED' &&
        String(validation?.status || '').toUpperCase() === 'PASSED' &&
        unresolved.length === 0 &&
        (nextCoreAction === '' || nextCoreAction === 'RE_EVALUATE')
      ) {
        const remainingRequiredOperations = corePlanRevisionService
          .missingOperations(task)
          .filter(operation => operation.operation !== 'SYNTHESIZE_UNIVERSAL');

        if (remainingRequiredOperations.length === 0) return [];
      }

      // If the synthesis itself says what CORE needs next, honor that
      // decision instead of falling through to an unrelated route.
      if (nextCoreAction === 'RESEARCH_COMPONENT_GAP') {
        return this.decorateOperations(task, this.uniqueOperations([{
          target: 'research',
          command: 'RUN_RESEARCH',
          reason: 'CORE post-synthesis re-evaluation selected component-gap research',
          payload: {
            ...input,
            taskId: task.taskId,
            operation: 'RUN_RESEARCH',
            synthesisId: String(synthesisResult?.synthesisId || value?.synthesisId || ''),
            synthesisGap: true,
            unresolved,
            query: [
              task.goal,
              typeof input.requiredOutput === 'string' ? input.requiredOutput : '',
              ...unresolved
            ].filter(Boolean).join(' '),
            adaptive: true,
            priority: 100
          }
        }]));
      }

      if (validationPassedAfterCandidate) {
        const candidateIdentity = this.extractCandidateIdentity(latestCandidate!);
        const validationIdentity = this.extractValidationIdentity(latestValidation!);

        return this.decorateOperations(task, this.uniqueOperations([{
          target: 'core',
          command: 'SYNTHESIZE_UNIVERSAL' as DomainCommand,
          reason: 'CORE received a validated Candidate and must re-synthesize before completion',
          payload: {
            ...input,
            taskId: task.taskId,
            requestId: String(input.requestId || task.taskId),
            goal: task.goal,
            requiredOutput: typeof input.requiredOutput === 'string'
              ? input.requiredOutput
              : '',
            availableComponentIds: Array.isArray(input.availableComponentIds)
              ? input.availableComponentIds.map(String)
              : undefined,
            validatedCandidate: candidateIdentity,
            validationResult: validationIdentity,
            priorSynthesisId: String(
              synthesisResult?.synthesisId ||
              value?.synthesisId ||
              ''
            ),
            synthesisReevaluation: true,
            synthesisRequested: true,
            adaptive: true,
            priority: 100
          }
        }]));
      }

      if (validationRejectedAfterCandidate) {
        const candidateIdentity = this.extractCandidateIdentity(latestCandidate!);
        const resolvedTargetFiles = this.resolveCoreTargetPaths(task, input);

        if (resolvedTargetFiles.length === 0) {
          return this.decorateOperations(task, this.uniqueOperations([{
            target: 'selfDevelopment',
            command: 'ASSESS_DOMAIN',
            reason: 'Validated Candidate was rejected and CORE needs a refreshed repository target snapshot',
            payload: {
              taskId: task.taskId,
              goal: task.goal,
              kind: 'SELF_IMPROVEMENT',
              adaptive: true,
              requestedAssessment: 'REPOSITORY_CONTEXT',
              target: input.target,
              priority: 100
            }
          }]));
        }

        return this.decorateOperations(task, this.uniqueOperations([{
          target: 'selfDevelopment',
          command: 'GENERATE_CANDIDATE',
          reason: 'CORE rejected the Candidate during validation and requests the next Candidate revision',
          payload: {
            ...input,
            taskId: task.taskId,
            runId: this.resolveCoreRunId(task, input),
            goal: task.goal,
            synthesisId: String(
              synthesisResult?.synthesisId ||
              value?.synthesisId ||
              ''
            ),
            targetFiles: resolvedTargetFiles,
            requirements: input.requirements,
            prohibitions: input.prohibitions,
            invariants: input.invariants,
            validationRequirements: input.validationRequirements,
            candidateRevision: Number(
              candidateIdentity.candidateRevision ||
              input.candidateRevision ||
              1
            ) + 1,
            adaptive: true,
            priority: 100
          }
        }]));
      }

      if (candidateAwaitingValidation) {
        const candidateIdentity = this.extractCandidateIdentity(latestCandidate!);
        const candidateOperationInstanceId =
          this.operationInstanceFor(task,'GENERATE_CANDIDATE');

        return this.decorateOperations(task, this.uniqueOperations([{
          target: 'verification',
          command: 'VALIDATE_CANDIDATE',
          reason: 'CORE re-evaluated the generated Candidate and selected Candidate validation',
          payload: {
            ...input,
            taskId: task.taskId,
            runId: this.resolveCoreRunId(task, input),
            ...candidateIdentity,
            sourceOperationInstanceId: candidateOperationInstanceId,
            adaptive: true,
            priority: 100
          }
        }]));
      }

      if (nextCoreAction === 'GENERATE_CANDIDATE') {
        const resolvedTargetFiles = this.resolveCoreTargetPaths(task, input);

        // Universal Synthesis must reuse the existing CORE Candidate
        // generation path. If the synthesis result does not yet contain
        // a complete repository target snapshot, let CORE observe it first
        // instead of dispatching an incomplete Candidate request.
        if (resolvedTargetFiles.length === 0) {
          return this.decorateOperations(task, this.uniqueOperations([{
            target: 'selfDevelopment',
            command: 'ASSESS_DOMAIN',
            reason: 'CORE post-synthesis Candidate generation requires a complete repository target snapshot',
            payload: {
              taskId: task.taskId,
              goal: task.goal,
              kind: 'SELF_IMPROVEMENT',
              adaptive: true,
              requestedAssessment: 'REPOSITORY_CONTEXT',
              target: input.target,
              priority: 100
            }
          }]));
        }

        return this.decorateOperations(task, this.uniqueOperations([{
          target: 'selfDevelopment',
          command: 'GENERATE_CANDIDATE',
          reason: 'CORE post-synthesis re-evaluation selected the existing Candidate generation path',
          payload: {
            ...input,
            taskId: task.taskId,
            runId: this.resolveCoreRunId(task, input),
            goal: task.goal,
            synthesisId: String(
              synthesisResult?.synthesisId ||
              value?.synthesisId ||
              ''
            ),
            reusableComponentIds: Array.isArray(
              synthesisResult?.reusableComponentIds
            )
              ? synthesisResult.reusableComponentIds.map(String)
              : [],
            targetFiles: resolvedTargetFiles,
            requirements: input.requirements,
            prohibitions: input.prohibitions,
            invariants: input.invariants,
            validationRequirements: input.validationRequirements,
            candidateRevision: Number(input.candidateRevision || 1),
            adaptive: true,
            priority: 100
          }
        }]));
      }

      if (nextCoreAction === 'VERIFY_CANDIDATE') {
        return this.decorateOperations(task, this.uniqueOperations([{
          target: 'verification',
          command: 'VERIFY_RESEARCH_CLAIMS',
          reason: 'CORE post-synthesis re-evaluation selected verification',
          payload: {
            ...input,
            taskId: task.taskId,
            synthesisId: String(synthesisResult?.synthesisId || value?.synthesisId || ''),
            adaptive: true,
            priority: 100
          }
        }]));
      }
    }

    if (synthesisRequested && !synthesisAlreadyCompleted && !synthesisBlocked) {
      routes.push({
        target:'core',
        command:'SYNTHESIZE_UNIVERSAL' as DomainCommand,
        reason:'CORE selected the universal synthesis engine for a synthesis-required request',
        payload:{
          ...input,
          taskId:task.taskId,
          requestId:String(input.requestId || task.taskId),
          goal:task.goal,
          requiredOutput:typeof input.requiredOutput==='string' ? input.requiredOutput : '',
          availableComponentIds:Array.isArray(input.availableComponentIds)
            ? input.availableComponentIds.map(String)
            : undefined,
          adaptive:true,
          priority:100
        }
      });
      return this.decorateOperations(task,this.uniqueOperations(routes));
    }
    if(operation==='EXECUTE_AUTONOMOUS_SEARCH'){
      routes.push({
        target:'research',
        command:'RUN_RESEARCH',
        reason:'CORE selected the research classification for an explicit UI research execution request',
        payload:{...input,taskId:task.taskId,operation,query:String(input.query||''),adaptive:true,priority:100}
      });
      return this.decorateOperations(task,this.uniqueOperations(routes));
    }
    if(operation==='APPROVE_REUSABLE_COMPONENTS'){
      routes.push({target:'learning',command:'APPROVE_REUSABLE_COMPONENTS',reason:'CORE selected learning to approve reusable components from generalized learning',payload:{...input,taskId:task.taskId,operation,adaptive:true,priority:100}});
      return this.decorateOperations(task,this.uniqueOperations(routes));
    }
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
    const coreOwnedResearchOperations=new Set(['EXECUTE_AUTONOMOUS_SEARCH']);
    if(coreOwnedResearchOperations.has(operation)){
      routes.push({target:'research',command:'RUN_RESEARCH',reason:'CORE selected research for explicit autonomous search',payload:{...input,taskId:task.taskId,operation,query:String(input.query||''),adaptive:true,priority:100}});return this.decorateOperations(task,this.uniqueOperations(routes));
    }
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
    const latestVerification=this.latestBusinessResult(task,'VERIFY_RESEARCH_CLAIMS');
    const verificationValue=latestVerification?objectValue(latestVerification):undefined;
    const verificationReply=verificationValue?.reply && typeof verificationValue.reply==='object'
      ? verificationValue.reply as Record<string,unknown>
      : undefined;
    const verificationData=(verificationReply?.data||verificationReply?.result) as Record<string,unknown>|undefined;
    const verificationItems=Array.isArray(verificationData?.verification)
      ? verificationData.verification as Array<Record<string,unknown>>:[];
    const verificationComplete=researchClaimIds.length>0&&researchClaimIds.every(id=>
      verificationItems.some(x=>
        String(x.claimId||'')===id &&
        (x.outcome==='SUPPORTED'||x.outcome==='DEVICE_VERIFIED')
      )
    );

    const knowledgeComponentIds=this.stringArrayFromEntries(task,/knowledgeComponentIds/i);
    const verifiedKnowledgeComponentIds=Array.isArray(verificationData?.verifiedKnowledgeComponentIds)
      ? verificationData.verifiedKnowledgeComponentIds.map(String).filter(Boolean)
      : [];
    const verificationEvidenceIds=Array.isArray(verificationData?.evidenceIds)
      ? verificationData.evidenceIds.map(String).filter(Boolean)
      : [];

    if(researchOutcome==='INSUFFICIENT_VERIFICATION'&&researchClaimIds.length>0&&!verificationComplete){
      routes.push({
        target:'verification',
        command:'VERIFY_RESEARCH_CLAIMS',
        reason:'CORE re-evaluated Research verification insufficiency and selected the Verification domain',
        payload:{
          taskId:task.taskId,
          claimIds:researchClaimIds,
          gapId:researchGapId,
          knowledgeComponentIds,
          adaptive:true,
          priority:96
        }
      });
    } else if(verificationComplete&&verifiedKnowledgeComponentIds.length>0){
      routes.push({
        target:'learning',
        command:'APPROVE_REUSABLE_COMPONENTS',
        reason:'CORE re-evaluated verified research knowledge and selected reusable-component approval',
        payload:{
          taskId:task.taskId,
          operation:'APPROVE_REUSABLE_COMPONENTS',
          knowledgeComponentIds:verifiedKnowledgeComponentIds,
          evidenceIds:verificationEvidenceIds,
          adaptive:true,
          priority:94
        }
      });
    } else if(continuationAvailable && researchGapId){
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
    const hasUniversalSynthesis = task.entries.some(entry =>
      entry.domain === 'core' &&
      (entry.kind === 'RESULT' || entry.kind === 'ERROR') &&
      objectValue(entry)?.operation === 'SYNTHESIZE_UNIVERSAL'
    );
    if(
      operation==='SYNTHESIZE' ||
      input.synthesisRequested===true ||
      hasUniversalSynthesis
    ){
      return coreCompletionGateService.evaluateUniversalSynthesisCompletion(task);
    }
    if(operation==='APPROVE_REVIEWED_CANDIDATE'){
      return coreCompletionGateService.evaluate(task,['promotion']);
    }
    if(operation==='DECIDE_CANDIDATE_ADOPTION'){
      return coreCompletionGateService.evaluateCoreOwnedOperation(task,operation,'strategy');
    }
    if(operation==='APPROVE_REUSABLE_COMPONENTS'){
      const completed=Boolean(this.latestBusinessResult(task,'APPROVE_REUSABLE_COMPONENTS'));
      const reasons:string[]=[];
      if(task.entries.some(entry=>entry.kind==='ERROR'))reasons.push('UNRESOLVED_DOMAIN_ERROR');
      if(task.pendingDomains.length)reasons.push('PENDING_DOMAIN_REMAINS');
      return {businessCompletion:completed&&reasons.length===0,failClosed:true,requiredDomains:[],missingDomains:completed?[]:['learning'],failedDomains:completed?[]:['learning'],missingReceipts:[],persistenceConfirmed:false,evidenceQualityPassed:true,reasons,missingRequiredOperations:[]};
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
    // 通常Taskも固定Domain一覧では完了判定しない。
    // CORE Plan RevisionとBlackboardの最新状態から必要な処理だけを判定する。
    return coreCompletionGateService.evaluate(task,[]);
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
    const researchValue=research?objectValue(research):undefined;
    const researchReply=researchValue?.reply&&typeof researchValue.reply==='object'?researchValue.reply as Record<string,unknown>:undefined;
    const researchData=(researchReply?.data||researchReply?.result||researchValue) as Record<string,unknown>|undefined;
    const researchResolved=researchData?.resolved===true;
    const researchOutcome=String(researchData?.outcome||'');
    const researchContinuation=researchData?.continuationAvailable===true;
    const researchClaimIds=Array.isArray(researchData?.claimIds)?researchData.claimIds.map(String).filter(Boolean):[];
    const verification=this.latestBusinessResult(task,'VERIFY_RESEARCH_CLAIMS');
    const verificationValue=verification?objectValue(verification):undefined;
    const verificationItems=Array.isArray(verificationValue?.verification)?verificationValue.verification as Array<Record<string,unknown>>:[];
    const verificationComplete=researchClaimIds.length>0&&researchClaimIds.every(id=>verificationItems.some(x=>String(x.claimId||'')===id&&(x.outcome==='SUPPORTED'||x.outcome==='DEVICE_VERIFIED')));
    const researchTerminal=researchResolved||verificationComplete||(researchOutcome==='NOT_FOUND_AFTER_COVERAGE'&&!researchContinuation);
    const reasons:string[]=[];
    if(!analysis) reasons.push('CONVERSATION_ANALYSIS_MISSING');
    if(unknownNeeded&&!unknown) reasons.push('UNKNOWN_RESOLUTION_MISSING');
    if(researchNeeded&&!research) reasons.push('RESEARCH_RESULT_MISSING');
    if(researchNeeded&&research&&!researchTerminal) reasons.push(`RESEARCH_NOT_TERMINAL:${researchOutcome||'UNRESOLVED'}`);
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

  private latestOperationError(task:BlackboardTask,operation:string):string {
    for(const entry of [...task.entries].reverse()){
      if(entry.kind!=='ERROR') continue;
      const value=objectValue(entry);
      if(String(value?.operation||'')!==operation) continue;
      const error=String(value?.error||'');
      if(error)return error;
      const reply=value?.reply;
      if(reply&&typeof reply==='object'){
        const replyError=String((reply as Record<string,unknown>).error||'');
        if(replyError)return replyError;
      }
    }
    return '';
  }

  private lastOperationFailed(task:BlackboardTask,operation:string):boolean {
    return Boolean(this.latestOperationError(task,operation))
      && ![...successfulBusinessEntries(task)].some(entry=>objectValue(entry)?.operation===operation);
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
    for(const entry of [...task.entries].reverse()){
      if(entry.kind!=="ERROR"&&entry.kind!=="OBSERVATION"&&entry.kind!=="RESULT") continue;
      if(!pattern.test(entry.key)&&!pattern.test(JSON.stringify(entry.value||{}))) continue;
      const value=objectValue(entry); if(!value) continue;
      const values=value.unresolvedItems??value.unresolvedRequirements??value.unknowns;
      if(Array.isArray(values)) return [...new Set(values.filter((item):item is string=>typeof item==="string"&&item.trim().length>0).map(item=>item.trim()))];
    }
    return [];
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

  private stringArrayFromValue(value:unknown,pattern:RegExp):string[] {
    const found=new Set<string>();

    const walk=(item:unknown,depth:number):void=>{
      if(depth>6||!item||typeof item!=='object') return;

      if(Array.isArray(item)){
        for(const child of item) walk(child,depth+1);
        return;
      }

      for(const [key,child] of Object.entries(item as Record<string,unknown>)){
        if(pattern.test(key)&&Array.isArray(child)){
          for(const id of child){
            if(typeof id==='string'&&id.trim()) found.add(id.trim());
          }
        }
        walk(child,depth+1);
      }
    };

    walk(value,0);
    return [...found];
  }

  private stringArray(value:unknown):string[] {
    return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'&&item.length>0):[];
  }
  private stringArrayFromEntries(task:BlackboardTask,pattern:RegExp):string[] {
    const found=new Set<string>();
    const walk=(value:unknown,depth:number):void=>{
      if(depth>6||!value||typeof value!=='object')return;
      if(Array.isArray(value)){for(const item of value)walk(item,depth+1);return;}
      for(const [key,item] of Object.entries(value as Record<string,unknown>)){
        if(pattern.test(key)&&Array.isArray(item))
          for(const id of item)if(typeof id==='string'&&id.trim())found.add(id.trim());
        walk(item,depth+1);
      }
    };
    for(const entry of [...task.entries].reverse())walk(entry.value,0);
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
      const diagnosticCommand=route.command==='DISCOVER_IMPROVEMENT_ISSUE' ||
        route.command==='IMPROVEMENT_ASSESSMENT';
      const prior=task.entries.filter(entry=>{
        if(entry.kind==='RESULT'||entry.kind==='ERROR'){
          return objectValue(entry)?.operation===route.command;
        }
        if(diagnosticCommand && entry.kind==='OBSERVATION'){
          const value=objectValue(entry);
          return String(value?.operation||entry.key||'')===route.command &&
            String(value?.operationClass||'DIAGNOSTIC')==='DIAGNOSTIC';
        }
        return false;
      }).length;
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
