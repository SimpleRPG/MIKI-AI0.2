import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';
import { coreTaskIngressService } from './coreTaskIngressService';
import type { CoreOrchestrationResult } from './coreOrchestratorService';
import { lifecycleTransitionPolicyService } from './lifecycleTransitionPolicyService';
import { reviewZipExportService, type ReviewPackageStatus } from './reviewZipExportService';
import { reviewDecisionLearningService } from './reviewDecisionLearningService';
import { reviewLearningArtifactService } from './reviewLearningArtifactService';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { externalDirectiveIntakeService, type ExternalDirectiveStatus } from './externalDirectiveIntakeService';
import { EvidenceService } from '../../memory/services/evidenceService';
import { multiReviewerConsensusService, type ReviewConsensus, type ReviewerOpinion } from './multiReviewerConsensusService';
import { reviewerReliabilityService, type ReviewOutcome, type ReviewerReliabilityProfile } from './reviewerReliabilityService';
import { humanAdoptionApprovalReceiptService } from '../../selfDevelopment/services/humanAdoptionApprovalReceiptService';
import { formalAdoptionAuthorizationService } from '../../selfDevelopment/services/formalAdoptionAuthorizationService';
import { formalAdoptionAuthorizationLedgerService } from '../../selfDevelopment/services/formalAdoptionAuthorizationLedgerService';
import { isolatedCandidateWorkspaceService } from './isolatedCandidateWorkspaceService';

export type ExternalAiRole = 'REVIEWER' | 'UNKNOWN_COMPONENT_AUTHOR' | 'TEACHER';
export type ExternalReviewSourceType = 'PASTED_TEXT' | 'IMPORTED_TXT' | 'IMPORTED_JSON';
export type ExternalReviewVerdict = 'ACCEPT' | 'REJECT' | 'CHANGES_REQUESTED' | 'UNCLEAR';
export type ExternalReviewStatus = 'DRAFT' | 'IMPORTED' | 'PARSED' | 'MISMATCH' | 'USER_DECIDED' | 'ARCHIVED';
export type ExternalReviewDecisionValue = 'ACCEPT' | 'REJECT' | 'REQUEST_CHANGES' | 'HOLD' | 'PARTIAL_ACCEPT' | 'PARTIAL_REJECT';

export interface ExternalReviewRecord {
  externalReviewId: string;
  externalAiRole: ExternalAiRole;
  reviewerId: string;
  reviewDomain: string;
  packageId: string;
  packageRevision: number;
  candidateManifestSha256: string;
  zipSha256: string;
  sourceType: ExternalReviewSourceType;
  rawResponse: string;
  rawResponseSha256: string;
  importedFileName?: string;
  importedFileSize?: number;
  importedAt: number;
  reviewSummary: string;
  strengths: string[];
  risks: string[];
  requestedChanges: string[];
  externalVerdict: ExternalReviewVerdict;
  parserVersion: 1;
  trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI';
  promptSha256?: string;
  corePlanRevision?: number;
  operationInstanceId?: string;
  claims: string[];
  suggestions: string[];
  unknownComponents: string[];
  questions: string[];
  mismatchReasons: string[];
  status: ExternalReviewStatus;
  coreTaskId?: string;
}

export interface ExternalReviewDecision {
  decisionId: string;
  externalReviewId: string;
  externalAiRole: ExternalAiRole;
  packageId: string;
  packageRevision: number;
  decision: ExternalReviewDecisionValue;
  reason: string;
  decidedAt: number;
  coreTaskId: string;
  coreDecisionId: string;
  status: 'PENDING_CORE' | 'SUBMITTED_TO_CORE' | 'BLOCKED';
}

const RECORDS_KEY = 'miki_external_review_records_v1';
const DECISIONS_KEY = 'miki_external_review_decisions_v1';
const DRAFT_PREFIX = 'miki_external_review_draft_v1:';

class ExternalReviewIntakeService {
  private records = new Map<string, ExternalReviewRecord>();
  private decisions = new Map<string, ExternalReviewDecision>();

  constructor() {
    this.load();
  }

  saveDraft(packageId: string, rawResponse: string): void {
    storageService.setItem(`${DRAFT_PREFIX}${packageId}`, rawResponse);
  }

  getDraft(packageId: string): string {
    return storageService.getItem(`${DRAFT_PREFIX}${packageId}`) || '';
  }

  async importResponse(input: {
    packageId: string;
    rawResponse: string;
    sourceType: ExternalReviewSourceType;
    externalAiRole?: ExternalAiRole;
    reviewerId?: string;
    reviewDomain?: string;
    importedFileName?: string;
    importedFileSize?: number;
  }): Promise<ExternalReviewRecord> {
    const reviewPackage = reviewZipExportService.list().find(item => item.packageId === input.packageId);
    if (!reviewPackage) throw new Error('REVIEW_PACKAGE_NOT_FOUND');
    const rawResponse = input.rawResponse.trim();
    if (!rawResponse) throw new Error('EXTERNAL_REVIEW_RESPONSE_REQUIRED');
    const rawResponseSha256 = canonicalSha256(rawResponse);
    const parsed = this.parse(rawResponse);
    const packageReferences = this.extractPackageReferences(rawResponse);
    const mismatchReasons: string[] = [];
    if (packageReferences.packageId && packageReferences.packageId !== reviewPackage.packageId) mismatchReasons.push('PACKAGE_ID_MISMATCH');
    if (packageReferences.packageRevision !== undefined && packageReferences.packageRevision !== reviewPackage.packageRevision) mismatchReasons.push('PACKAGE_REVISION_MISMATCH');
    if (packageReferences.candidateManifestSha256 && packageReferences.candidateManifestSha256 !== reviewPackage.candidateManifestSha256) mismatchReasons.push('CANDIDATE_MANIFEST_SHA256_MISMATCH');
    if (packageReferences.zipSha256 && packageReferences.zipSha256 !== reviewPackage.zipSha256) mismatchReasons.push('ZIP_SHA256_MISMATCH');
    const mismatch = mismatchReasons.length > 0;

    const coreResult = await coreTaskIngressService.submit({
      kind: 'USER_REQUEST',
      goal: '外部AI評価返信を対象Packageへ対応付け、正規化して保存可否を判断する',
      source: 'conversation',
      payload: {
        operation: 'IMPORT_EXTERNAL_AI_REVIEW',
        packageId: reviewPackage.packageId,
        packageRevision: reviewPackage.packageRevision,
        candidateManifestSha256: reviewPackage.candidateManifestSha256,
        zipSha256: reviewPackage.zipSha256,
        rawResponseSha256,
        sourceType: input.sourceType,
        mismatch,
      },
      maxCycles: 18,
    });

    const externalReviewId = `ER-${crypto.randomUUID()}`;
    const record: ExternalReviewRecord = {
      externalReviewId,
      externalAiRole: input.externalAiRole || 'REVIEWER',
      reviewerId: input.reviewerId?.trim() || 'EXTERNAL_AI_DEFAULT',
      reviewDomain: input.reviewDomain?.trim() || 'GENERAL',
      packageId: reviewPackage.packageId,
      packageRevision: reviewPackage.packageRevision,
      candidateManifestSha256: reviewPackage.candidateManifestSha256,
      zipSha256: reviewPackage.zipSha256,
      sourceType: input.sourceType,
      rawResponse,
      rawResponseSha256,
      importedFileName: input.importedFileName,
      importedFileSize: input.importedFileSize,
      importedAt: Date.now(),
      reviewSummary: parsed.reviewSummary,
      strengths: parsed.strengths,
      risks: parsed.risks,
      requestedChanges: parsed.requestedChanges,
      externalVerdict: parsed.externalVerdict,
      parserVersion: 1,
      trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI',
      promptSha256: packageReferences.promptSha256,
      corePlanRevision: packageReferences.corePlanRevision,
      operationInstanceId: packageReferences.operationInstanceId,
      claims: parsed.claims, suggestions: parsed.requestedChanges, unknownComponents: parsed.unknownComponents, questions: parsed.questions, mismatchReasons,
      status: mismatch || coreResult.task.status !== 'COMPLETED' ? 'MISMATCH' : 'PARSED',
      coreTaskId: coreResult.task.taskId,
    };
    this.records.set(externalReviewId, record);
    this.persistRecords();
    this.saveDraft(reviewPackage.packageId, '');
    return this.cloneRecord(record);
  }

  async submitDecision(input: {
    externalReviewId: string;
    decision: ExternalReviewDecisionValue;
    reason: string;
  }): Promise<ExternalReviewDecision> {
    const record = this.records.get(input.externalReviewId);
    if (!record) throw new Error('EXTERNAL_REVIEW_NOT_FOUND');
    if (record.status === 'MISMATCH') throw new Error('PACKAGE_REVIEW_MISMATCH');
    const normalizedReason=input.reason.trim();
    const existingDecisions=this.listDecisions(record.externalReviewId).filter(item=>item.packageId===record.packageId&&item.packageRevision===record.packageRevision&&item.status!=='BLOCKED');
    const identicalDecision=existingDecisions.find(item=>item.decision===input.decision&&item.reason===normalizedReason);
    if(identicalDecision)return {...identicalDecision};
    if(existingDecisions.length>0)throw new Error('REVIEW_DECISION_ALREADY_FINALIZED');
    if (!normalizedReason && input.decision === 'REJECT') throw new Error('REJECTION_REASON_REQUIRED');
    if (!normalizedReason && (input.decision === 'REQUEST_CHANGES' || input.decision === 'PARTIAL_ACCEPT' || input.decision === 'PARTIAL_REJECT')) throw new Error('CHANGE_SCOPE_OR_REASON_REQUIRED');
    if((input.decision === 'PARTIAL_ACCEPT' || input.decision === 'PARTIAL_REJECT')&&!reviewZipExportService.list().some(item=>item.packageId===record.packageId&&item.inputs.files.some(file=>normalizedReason.includes(file.path))))throw new Error('PARTIAL_DECISION_TARGET_FILE_REQUIRED');
    const reviewPackage = reviewZipExportService.list().find(item => item.packageId === record.packageId);
    if (!reviewPackage || reviewPackage.packageRevision !== record.packageRevision || reviewPackage.candidateManifestSha256 !== record.candidateManifestSha256) {
      throw new Error('PACKAGE_REVISION_OR_MANIFEST_MISMATCH');
    }
    if(!lifecycleTransitionPolicyService.isDecisionEligiblePackageStatus(reviewPackage.status))throw new Error(`REVIEW_PACKAGE_NOT_DECISION_ELIGIBLE:${reviewPackage.status}`);

    let adoptionAuthorization;
    if (input.decision === 'ACCEPT') {
      const workspace=isolatedCandidateWorkspaceService.get(reviewPackage.workspaceId);
      if(!workspace)throw new Error('ADOPTION_WORKSPACE_NOT_FOUND');
      const candidateId=reviewPackage.candidateId||reviewPackage.packageId;
      const approvalReceipt=humanAdoptionApprovalReceiptService.create({candidateId,candidateHash:reviewPackage.candidateManifestSha256,reviewPackageHash:reviewPackage.zipSha256,baseRevision:workspace.baseSnapshotSha256,approver:'LOCAL_USER',decision:'APPROVE',reason:normalizedReason||'Explicit candidate adoption approval'});
      adoptionAuthorization=formalAdoptionAuthorizationService.authorize({candidateId,candidateHash:reviewPackage.candidateManifestSha256,reviewPackageHash:reviewPackage.zipSha256,baseRevision:workspace.baseSnapshotSha256,currentBaseRevision:workspace.baseSnapshotSha256,validationPassed:true,unexecutedChecks:[],externalReview:{candidateId,candidateHash:record.candidateManifestSha256,reviewPackageHash:record.zipSha256,verdict:record.externalVerdict,warnings:record.risks},humanApproved:false,approvalReceipt});
      if(!adoptionAuthorization.authorized)throw new Error(`FORMAL_ADOPTION_AUTHORIZATION_BLOCKED:${adoptionAuthorization.reasons.join('|')}`);
      formalAdoptionAuthorizationLedgerService.register(adoptionAuthorization);
    }

    const decisionId = `ERD-${crypto.randomUUID()}`;
    let decision: ExternalReviewDecision = {
      decisionId, externalReviewId: record.externalReviewId,
      externalAiRole: record.externalAiRole, packageId: record.packageId,
      packageRevision: record.packageRevision, decision: input.decision,
      reason: normalizedReason, decidedAt: Date.now(),
      coreTaskId: 'PENDING', coreDecisionId: 'PENDING', status: 'PENDING_CORE'
    };
    this.decisions.set(decisionId, decision);
    this.persistDecisions();

    let coreResult:CoreOrchestrationResult;
    try{
      coreResult=await coreTaskIngressService.submit({
        kind:'USER_REQUEST',
        goal:'外部AI評価を参考資料として使用し、利用者の候補採否Decisionを処理する',
        source:'conversation',
        payload:{
          operation:'DECIDE_CANDIDATE_ADOPTION',
          externalReviewId:record.externalReviewId,
          packageId:record.packageId,
          packageRevision:record.packageRevision,
          candidateManifestSha256:record.candidateManifestSha256,
          rawResponseSha256:record.rawResponseSha256,
          externalVerdict:record.externalVerdict,
          userDecision:input.decision,
          reason:normalizedReason,
          workspaceId:reviewPackage.workspaceId,
          transactionId:reviewPackage.transactionId,
          persistenceReceiptId:reviewPackage.persistenceReceiptId,
          operationInstanceId:reviewPackage.operationInstanceId,
          adoptionAuthorization,
        },
        maxCycles:18,
      });
    }catch(error){
      decision={...decision,status:'BLOCKED',coreTaskId:'FAILED_BEFORE_TASK',coreDecisionId:'FAILED_BEFORE_CORE_DECISION'};
      this.decisions.set(decisionId,decision);
      this.persistDecisions();
      throw error;
    }

    decision = {
      ...decision,
      coreTaskId: coreResult.task.taskId,
      coreDecisionId: `CORE-${coreResult.task.taskId}-${coreResult.task.revision}`,
      status: coreResult.task.status === 'COMPLETED' ? 'SUBMITTED_TO_CORE' : 'BLOCKED'
    };
    this.decisions.set(decisionId, decision);
    if (coreResult.task.status === 'COMPLETED') {
      const originatingRun=improvementIntakeRouterService.get(reviewPackage.runId);
      const originatingDirective=originatingRun?.runType==='EXTERNAL_DIRECTIVE'
        ? externalDirectiveIntakeService.get(originatingRun.sourceId)
        : undefined;
      const directiveStatus:ExternalDirectiveStatus=input.decision==='ACCEPT'
        ? 'ADOPTION_PENDING'
        : input.decision==='REJECT'
          ? 'REJECTED'
          : input.decision==='REQUEST_CHANGES'
            ? 'CHANGES_REQUESTED'
            : input.decision==='HOLD'
              ? 'HOLD'
              : input.decision==='PARTIAL_ACCEPT'
                ? 'PARTIALLY_ACCEPTED'
                : 'PARTIALLY_REJECTED';
      if(originatingDirective){externalDirectiveIntakeService.updateStatus(originatingDirective.directiveId,directiveStatus,originatingDirective.runId);externalDirectiveIntakeService.updateMetadata(originatingDirective.directiveId,{activePackageId:reviewPackage.packageId,activePackageRevision:reviewPackage.packageRevision,activeExternalReviewId:record.externalReviewId,adoptionTaskId:input.decision==='ACCEPT'?decision.coreTaskId:undefined});}
      if(input.decision==='REQUEST_CHANGES'&&originatingRun){
        const revisionResult=await coreTaskIngressService.submit({
          kind:'SELF_IMPROVEMENT',
          goal:`${originatingRun.objective}
外部評価の修正要求を反映する`,
          source:'core',
          payload:{
            ...originatingRun.payload,
            operation:'REVISE_REVIEWED_CANDIDATE',
            parentRunId:originatingRun.runId,
            sourcePackageId:reviewPackage.packageId,
            externalReviewId:record.externalReviewId,
            requestedChanges:[...record.requestedChanges],
            reviewReason:normalizedReason,
            candidateRevision:reviewPackage.candidateRevision+1,
          },
          maxCycles:18,
        });
        if(originatingDirective)externalDirectiveIntakeService.updateMetadata(originatingDirective.directiveId,{revisionTaskId:revisionResult.task.taskId});
      }
      // ACCEPTEDは、promotion側でCandidate適用・Transaction・Manifest/Revision整合性を
      // すべて確認した後にだけ確定する。ここでは二重に状態を書き換えない。
      if(input.decision !== 'ACCEPT'){
        const packageStatus: ReviewPackageStatus =
          input.decision === 'REJECT'
            ? 'REJECTED'
            : input.decision === 'REQUEST_CHANGES' || input.decision === 'PARTIAL_ACCEPT' || input.decision === 'PARTIAL_REJECT'
              ? 'NEEDS_CHANGES'
              : 'HOLD';
        reviewZipExportService.updateStatus(record.packageId, packageStatus);
      }
      const learningProjection = reviewDecisionLearningService.project({
        record,
        decision: input.decision,
        reason: normalizedReason,
        coreTaskId: decision.coreTaskId,
        coreDecisionId: decision.coreDecisionId,
        userDecisionId: decision.decisionId,
      });
      const artifactProjection = reviewLearningArtifactService.deriveAndPersist(learningProjection.episode, decision.decisionId);
      const reusableComponents = artifactProjection.artifacts.flatMap(artifact => reusableComponentFactoryService.extract(artifact, learningProjection.episode));
      reusableComponentFactoryService.storeCandidates(reusableComponents);
      if(input.decision==="ACCEPT"){
        const generalizedArtifactIds=reviewLearningArtifactService.generalizeAcceptedPatterns();
        const generalizedSet=new Set(generalizedArtifactIds);
        const generalizedSourceArtifactIds=new Set(
          reviewLearningArtifactService.list()
            .filter(artifact=>artifact.lifecycleStatus==='SUPERSEDED'&&artifact.supersededBy&&generalizedSet.has(artifact.supersededBy))
            .map(artifact=>artifact.artifactId)
        );
        const approvalArtifactIds=new Set([...generalizedArtifactIds,...generalizedSourceArtifactIds]);
        const knowledgeComponentIds=reusableComponentFactoryService.list()
          .filter(component=>component.componentKind==='KNOWLEDGE'&&component.sourceLearningArtifactIds.some(id=>approvalArtifactIds.has(id)))
          .map(component=>component.componentId);
        const evidence=EvidenceService.getInstance().recordCloudAiEvidence({
          title:`External AI review accepted: ${record.packageId}`,
          snippet:record.rawResponse.slice(0,4000),
          source:'external_review',
          sourceId:record.externalReviewId,
          metadata:{
            external_bundle_id:record.packageId,
            response_sha256:record.rawResponseSha256,
            trust_boundary:'UNTRUSTED_EXTERNAL_AI'
          }
        });
        await coreTaskIngressService.submit({
          kind:'SYSTEM_TASK',
          goal:'COREが一般化された学習から再利用コンポーネント採否を判断する',
          source:'core',
          payload:{operation:'APPROVE_REUSABLE_COMPONENTS',decisionId:decision.decisionId,externalReviewId:record.externalReviewId,packageId:record.packageId,generalizedArtifactIds,knowledgeComponentIds,evidenceIds:[evidence.evidence_id]},
          maxCycles:18,
        });
      }
      if (input.decision === 'REQUEST_CHANGES' || input.decision === 'PARTIAL_ACCEPT' || input.decision === 'PARTIAL_REJECT') {
        await improvementIntakeRouterService.receive({
          runType: 'REVALIDATION',
          sourceId: record.externalReviewId,
          objective: `外部評価の修正要求を反映する: ${record.packageId}`,
          priority: 90,
          payload: {
            operation: 'REGENERATE_FROM_EXTERNAL_REVIEW',
            packageId: record.packageId,
            packageRevision: record.packageRevision,
            candidateRevision: reviewPackage.candidateRevision + 1,
            sourcePackageId: record.packageId,
            candidateManifestSha256: record.candidateManifestSha256,
            externalReviewId: record.externalReviewId,
            issueId: reviewPackage.inputs.issueId,
            targetFiles: reviewPackage.inputs.files.map(file=>file.path),
            requestedChanges: [...new Set([...record.requestedChanges,normalizedReason].filter(Boolean))],
            userReason: normalizedReason,
          },
        });
      }
      record.status = 'USER_DECIDED';
    }
    this.persistRecords();
    this.persistDecisions();
    return { ...decision };
  }

  buildConsensus(packageId:string,minimumReviewers=2):ReviewConsensus{
    const reviews=this.list(packageId);
    if(!reviews.length)throw new Error('EXTERNAL_REVIEWS_REQUIRED');
    const candidateManifestSha256=reviews[0].candidateManifestSha256;
    const opinions:ReviewerOpinion[]=reviews.map(review=>({externalReviewId:review.externalReviewId,reviewerId:review.reviewerId,domain:review.reviewDomain,candidateManifestSha256:review.candidateManifestSha256,verdict:review.externalVerdict==='ACCEPT'?'ACCEPT':review.externalVerdict==='REJECT'?'REJECT':review.externalVerdict==='CHANGES_REQUESTED'?'REQUEST_CHANGES':'HOLD',reasons:[...review.risks,...review.strengths],requestedChanges:[...review.requestedChanges]}));
    return multiReviewerConsensusService.build({candidateManifestSha256,opinions,minimumReviewers});
  }

  recordReviewerOutcome(externalReviewId:string,outcome:ReviewOutcome):ReviewerReliabilityProfile{
    const review=this.records.get(externalReviewId);if(!review)throw new Error('EXTERNAL_REVIEW_NOT_FOUND');
    return reviewerReliabilityService.record({reviewerId:review.reviewerId,domain:review.reviewDomain,outcome});
  }

  list(packageId?: string): ExternalReviewRecord[] {
    return [...this.records.values()]
      .filter(record => !packageId || record.packageId === packageId)
      .sort((left, right) => right.importedAt - left.importedAt)
      .map(record => this.cloneRecord(record));
  }

  listDecisions(externalReviewId?: string): ExternalReviewDecision[] {
    return [...this.decisions.values()]
      .filter(decision => !externalReviewId || decision.externalReviewId === externalReviewId)
      .sort((left, right) => right.decidedAt - left.decidedAt)
      .map(decision => ({ ...decision }));
  }

  private parse(rawResponse: string): Pick<ExternalReviewRecord, 'reviewSummary' | 'strengths' | 'risks' | 'requestedChanges' | 'claims' | 'unknownComponents' | 'questions' | 'externalVerdict'> {
    let structured: Record<string, unknown> | undefined;
    try {
      const value = JSON.parse(rawResponse);
      if (value && typeof value === 'object') structured = value;
    } catch {
      structured = undefined;
    }
    const text = rawResponse.toUpperCase();
    const explicit = String(structured?.decision || structured?.verdict || '').toUpperCase();
    const externalVerdict: ExternalReviewVerdict =
      explicit === 'ACCEPT' || /\bACCEPT\b/.test(text) ? 'ACCEPT' :
      explicit === 'REJECT' || /\bREJECT\b/.test(text) ? 'REJECT' :
      explicit === 'NEEDS_CHANGES' || explicit === 'CHANGES_REQUESTED' || /NEEDS_CHANGES|CHANGES_REQUESTED/.test(text) ? 'CHANGES_REQUESTED' :
      'UNCLEAR';
    const toLines = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    return {
      reviewSummary: typeof structured?.summary === 'string' ? structured.summary : rawResponse.slice(0, 500),
      strengths: toLines(structured?.strengths),
      risks: toLines(structured?.risks || structured?.findings),
      requestedChanges: toLines(structured?.requestedChanges || structured?.requiredChanges),
      claims: toLines(structured?.claims || structured?.findings),
      unknownComponents: toLines(structured?.unknownComponents || structured?.missingComponents),
      questions: toLines(structured?.questions),
      externalVerdict,
    };
  }

  private extractPackageReferences(rawResponse: string): { packageId?: string; packageRevision?: number; candidateManifestSha256?: string; zipSha256?: string; promptSha256?: string; corePlanRevision?: number; operationInstanceId?: string } {
    let value: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(rawResponse);
      if (parsed && typeof parsed === 'object') value = parsed;
    } catch {
      value = {};
    }
    const revision = Number(value.packageRevision);
    return {
      packageId: typeof value.packageId === 'string' ? value.packageId : undefined,
      packageRevision: Number.isFinite(revision) && revision > 0 ? revision : undefined,
      candidateManifestSha256: typeof value.candidateManifestSha256 === 'string' ? value.candidateManifestSha256 : undefined,
      zipSha256: typeof value.zipSha256 === 'string' ? value.zipSha256 : undefined,
      promptSha256: typeof value.promptSha256 === 'string' ? value.promptSha256 : undefined,
      corePlanRevision: Number.isFinite(Number(value.corePlanRevision)) && Number(value.corePlanRevision) > 0 ? Number(value.corePlanRevision) : undefined,
      operationInstanceId: typeof value.operationInstanceId === 'string' ? value.operationInstanceId : undefined,
    };
  }

  private cloneRecord(record: ExternalReviewRecord): ExternalReviewRecord {
    return { ...record, strengths: [...record.strengths], risks: [...record.risks], requestedChanges: [...record.requestedChanges], claims: [...record.claims], suggestions: [...record.suggestions], unknownComponents: [...record.unknownComponents], questions: [...record.questions], mismatchReasons: [...record.mismatchReasons] };
  }

  private persistRecords(): void {
    storageService.setItem(RECORDS_KEY, JSON.stringify(this.list()));
  }

  private persistDecisions(): void {
    storageService.setItem(DECISIONS_KEY, JSON.stringify(this.listDecisions()));
  }

  private load(): void {
    try {
      const records = storageService.getJson<ExternalReviewRecord[]>(RECORDS_KEY, []);
      if (Array.isArray(records)) for (const record of records) if (record?.externalReviewId) this.records.set(record.externalReviewId, { reviewerId:'EXTERNAL_AI_DEFAULT', reviewDomain:'GENERAL', ...record });
      const decisions=storageService.getJson<ExternalReviewDecision[]>(DECISIONS_KEY,[]);
      let recoveredPending=false;
      if(Array.isArray(decisions)){
        const now=Date.now();
        for(const stored of decisions){
          if(!stored?.decisionId)continue;
          const decision={...stored};
          const pendingAge=now-Number(decision.decidedAt||0);
          if(decision.status==='PENDING_CORE'&&pendingAge>15*60*1000){
            decision.status='BLOCKED';
            decision.coreTaskId=decision.coreTaskId==='PENDING'?'STALE_PENDING_RECOVERED':decision.coreTaskId;
            decision.coreDecisionId=decision.coreDecisionId==='PENDING'?'STALE_PENDING_RECOVERED':decision.coreDecisionId;
            recoveredPending=true;
          }
          this.decisions.set(decision.decisionId,decision);
        }
      }
      if(recoveredPending)this.persistDecisions();
    } catch {
      this.records.clear();
      this.decisions.clear();
    }
  }
}

export const externalReviewIntakeService = new ExternalReviewIntakeService();
