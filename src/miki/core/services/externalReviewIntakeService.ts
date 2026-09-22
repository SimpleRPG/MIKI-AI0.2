import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';
import { coreTaskIngressService } from './coreTaskIngressService';
import { reviewZipExportService, type ReviewPackageStatus } from './reviewZipExportService';
import { reviewDecisionLearningService } from './reviewDecisionLearningService';
import { reviewLearningArtifactService } from './reviewLearningArtifactService';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';

export type ExternalAiRole = 'REVIEWER' | 'UNKNOWN_COMPONENT_AUTHOR' | 'TEACHER';
export type ExternalReviewSourceType = 'PASTED_TEXT' | 'IMPORTED_TXT' | 'IMPORTED_JSON';
export type ExternalReviewVerdict = 'ACCEPT' | 'REJECT' | 'CHANGES_REQUESTED' | 'UNCLEAR';
export type ExternalReviewStatus = 'DRAFT' | 'IMPORTED' | 'PARSED' | 'MISMATCH' | 'USER_DECIDED' | 'ARCHIVED';
export type ExternalReviewDecisionValue = 'ACCEPT' | 'REJECT' | 'REQUEST_CHANGES' | 'HOLD' | 'PARTIAL_ACCEPT' | 'PARTIAL_REJECT';

export interface ExternalReviewRecord {
  externalReviewId: string;
  externalAiRole: ExternalAiRole;
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
  status: 'SUBMITTED_TO_CORE' | 'BLOCKED';
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
    if (packageReferences.packageRevision !== undefined && packageReferences.packageRevision !== reviewPackage.candidateRevision) mismatchReasons.push('PACKAGE_REVISION_MISMATCH');
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
        packageRevision: reviewPackage.candidateRevision,
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
      packageId: reviewPackage.packageId,
      packageRevision: reviewPackage.candidateRevision,
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
    if (!input.reason.trim() && input.decision === 'REJECT') throw new Error('REJECTION_REASON_REQUIRED');
    const reviewPackage = reviewZipExportService.list().find(item => item.packageId === record.packageId);
    if (!reviewPackage || reviewPackage.candidateRevision !== record.packageRevision || reviewPackage.candidateManifestSha256 !== record.candidateManifestSha256) {
      throw new Error('PACKAGE_REVISION_OR_MANIFEST_MISMATCH');
    }

    const coreResult = await coreTaskIngressService.submit({
      kind: 'USER_REQUEST',
      goal: '外部AI評価を参考資料として使用し、利用者の候補採否Decisionを処理する',
      source: 'conversation',
      payload: {
        operation: 'DECIDE_CANDIDATE_ADOPTION',
        externalReviewId: record.externalReviewId,
        packageId: record.packageId,
        packageRevision: record.packageRevision,
        candidateManifestSha256: record.candidateManifestSha256,
        rawResponseSha256: record.rawResponseSha256,
        externalVerdict: record.externalVerdict,
        userDecision: input.decision,
        reason: input.reason.trim(),
        workspaceId: reviewPackage.workspaceId,
        transactionId: reviewPackage.transactionId,
        persistenceReceiptId: reviewPackage.persistenceReceiptId,
        operationInstanceId: reviewPackage.operationInstanceId,
      },
      maxCycles: 18,
    });

    const decisionId = `ERD-${crypto.randomUUID()}`;
    const decision: ExternalReviewDecision = {
      decisionId,
      externalReviewId: record.externalReviewId,
      externalAiRole: record.externalAiRole,
      packageId: record.packageId,
      packageRevision: record.packageRevision,
      decision: input.decision,
      reason: input.reason.trim(),
      decidedAt: Date.now(),
      coreTaskId: coreResult.task.taskId,
      coreDecisionId: `CORE-${coreResult.task.taskId}-${coreResult.task.revision}`,
      status: coreResult.task.status === 'COMPLETED' ? 'SUBMITTED_TO_CORE' : 'BLOCKED',
    };
    this.decisions.set(decisionId, decision);
    if (coreResult.task.status === 'COMPLETED') {
      const packageStatus: ReviewPackageStatus = input.decision === 'ACCEPT'
        ? 'ACCEPTED'
        : input.decision === 'REJECT'
          ? 'REJECTED'
          : input.decision === 'REQUEST_CHANGES' || input.decision === 'PARTIAL_ACCEPT' || input.decision === 'PARTIAL_REJECT'
            ? 'NEEDS_CHANGES'
            : 'HOLD';
      reviewZipExportService.updateStatus(record.packageId, packageStatus);
      const learningProjection = reviewDecisionLearningService.project({
        record,
        decision: input.decision,
        reason: input.reason.trim(),
        coreTaskId: decision.coreTaskId,
        coreDecisionId: decision.coreDecisionId,
        userDecisionId: decision.decisionId,
      });
      const artifactProjection = reviewLearningArtifactService.deriveAndPersist(learningProjection.episode, decision.decisionId);
      const reusableComponents = artifactProjection.artifacts.flatMap(artifact => reusableComponentFactoryService.extract(artifact, learningProjection.episode));
      reusableComponentFactoryService.storeCandidates(reusableComponents);
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
            candidateManifestSha256: record.candidateManifestSha256,
            externalReviewId: record.externalReviewId,
            issueId: reviewPackage.inputs.issueId,
            targetFiles: reviewPackage.inputs.files.map(file=>file.path),
            requestedChanges: [...new Set([...record.requestedChanges,input.reason.trim()].filter(Boolean))],
            userReason: input.reason.trim(),
          },
        });
      }
      record.status = 'USER_DECIDED';
    }
    this.persistRecords();
    this.persistDecisions();
    return { ...decision };
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
    const revision = Number(value.packageRevision || value.candidateRevision);
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
      if (Array.isArray(records)) for (const record of records) if (record?.externalReviewId) this.records.set(record.externalReviewId, record);
      const decisions = storageService.getJson<ExternalReviewDecision[]>(DECISIONS_KEY, []);
      if (Array.isArray(decisions)) for (const decision of decisions) if (decision?.decisionId) this.decisions.set(decision.decisionId, decision);
    } catch {
      this.records.clear();
      this.decisions.clear();
    }
  }
}

export const externalReviewIntakeService = new ExternalReviewIntakeService();
