import {
  componentCompositionService,
  type CompositionPlan,
} from '../../capability/services/componentCompositionService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { capabilityConfidenceService } from '../../capability/services/capabilityConfidenceService';
import { reusableComponentFactoryService } from './reusableComponentFactoryService';
import { coreResultService, type CoreResult } from './coreResultService';
import { canonicalSha256Object } from './canonicalSha256Service';

export type SynthesisSelectionMode =
  | 'REUSE_AS_IS'
  | 'ADAPT_EXISTING'
  | 'COMPOSE_MULTIPLE'
  | 'CREATE_NEW'
  | 'ESCALATE_UNKNOWN';

export interface UniversalSynthesisRequest {
  requestId: string;
  taskId?: string;
  goal: string;
  input?: unknown;
  constraints?: string[];
  requiredOutput?: string;
  environment?: string;
  availableComponentIds?: string[];
  maxComponents?: number;
  synthesisContext?: {
    currentState?: string;
    visitedDomains?: string[];
    pendingDomains?: string[];
    evidenceRefs?: string[];
    knowledgeRefs?: string[];
    memoryRefs?: string[];
    experienceRefs?: string[];
    failureExperienceRefs?: string[];
    verificationRefs?: string[];
    recentDecisions?: string[];
    unresolvedRefs?: string[];
    semanticContext?: string[];
    validatedCandidate?: Record<string, unknown>;
    validationResult?: Record<string, unknown>;
    priorSynthesisId?: string;
  };
}

export interface SynthesisArtifact {
  artifactId: string;
  synthesisId: string;
  goal: string;
  environment: string;
  inputContract: { types: string[] };
  outputContract: { types: string[] };
  componentIds: string[];
  adaptedComponentIds: string[];
  compositionPlan?: CompositionPlan;
  evidenceRefs: string[];
  contextRefs: {
    evidenceRefs: string[];
    knowledgeRefs: string[];
    memoryRefs: string[];
    experienceRefs: string[];
    failureExperienceRefs: string[];
    verificationRefs: string[];
    candidateRefs: string[];
  };
  contextFingerprint: string;
  validatedCandidate?: Record<string, unknown>;
  validationResult?: Record<string, unknown>;
  priorSynthesisId?: string;
  lineage: { source: 'CORE'; generatedAt: number };
  artifactHash: string;
}

export interface SynthesisResult {
  synthesisId: string;
  requestId: string;
  taskId?: string;
  goal: string;
  selectionMode: SynthesisSelectionMode;
  compositionPlan?: CompositionPlan;
  usedComponentIds: string[];
  adaptedComponentIds: string[];
  candidateComponentIds: string[];
  reusableComponentIds: string[];
  synthesisArtifact: SynthesisArtifact;
  validation: {
    status: 'NOT_RUN' | 'PASSED' | 'BLOCKED';
    reasons: string[];
  };
  unresolved: string[];
  evidenceRefs: string[];
  lineage: {
    source: 'CORE';
    generatedAt: number;
  };
  validatedCandidate?: Record<string, unknown>;
  validationResult?: Record<string, unknown>;
  priorSynthesisId?: string;
  nextCoreAction:
    | 'RE_EVALUATE'
    | 'RESEARCH_COMPONENT_GAP'
    | 'VERIFY_CANDIDATE';
}

class UniversalSynthesisService {
  public synthesize(
    request: UniversalSynthesisRequest,
  ): SynthesisResult {
    const environment = request.environment || 'universal';
    const context=request.synthesisContext || {};
    const inputTerms =
      typeof request.input === 'string'
        ? request.input
        : request.input === undefined || request.input === null
          ? ''
          : JSON.stringify(request.input);

    const contextTerms=[
      request.goal,
      request.requiredOutput || '',
      inputTerms,
      context.currentState || '',
      ...(context.semanticContext || []),
      ...(context.visitedDomains || []),
      ...(context.pendingDomains || []),
      ...(context.recentDecisions || []),
      ...(context.unresolvedRefs || []),
      ...(context.knowledgeRefs || []),
      ...(context.memoryRefs || []),
      ...(context.experienceRefs || []),
      ...(context.failureExperienceRefs || []),
      ...(context.verificationRefs || []),
    ].filter(Boolean).join(' ');

    const selectionQuery=[request.goal, contextTerms]
      .filter(Boolean)
      .join(' ');

    const suppliedComponentIds = [...new Set(
      request.availableComponentIds?.filter(Boolean) || []
    )];

    const requestedIds = suppliedComponentIds.length > 0
      ? suppliedComponentIds
      : [
          ...new Set(
            capabilityConfidenceService
              .findRelevant(selectionQuery, environment, request.maxComponents || 4)
              .map(item => item.componentId)
          )
        ];

    const components = requestedIds
      .map(id => componentRegistryService.getComponent(id))
      .filter(Boolean);

    // Research/learning components live in the reusable-component repository.
    // CORE synthesis must inspect that repository as well as the executable registry.
    const reusablePack = reusableComponentFactoryService.plan({
      taskId: request.taskId || request.requestId,
      purpose: selectionQuery,
      environmentFingerprint: environment,
    });
    const reusableComponentIds = [
      ...reusablePack.usedKnowledgeComponentIds,
      ...reusablePack.usedCodeComponentIds,
      ...reusablePack.usedConversationComponentIds,
    ];

    const validatedCandidate =
      context.validatedCandidate &&
      typeof context.validatedCandidate === 'object' &&
      !Array.isArray(context.validatedCandidate)
        ? context.validatedCandidate
        : undefined;

    const validationResult =
      context.validationResult &&
      typeof context.validationResult === 'object' &&
      !Array.isArray(context.validationResult)
        ? context.validationResult
        : undefined;

    const validatedCandidateReady = Boolean(
      validatedCandidate &&
      String(validatedCandidate.candidateId || '').trim() &&
      String(validatedCandidate.workspaceId || '').trim() &&
      String(validatedCandidate.candidateRevision || '').trim() &&
      String(validatedCandidate.candidateManifestSha256 || '').trim() &&
      String(validatedCandidate.baselineSnapshotSha256 || '').trim() &&
      Array.isArray(validatedCandidate.changedFilePaths) &&
      validatedCandidate.changedFilePaths.length > 0 &&
      Array.isArray(validatedCandidate.persistenceReceiptIds) &&
      validatedCandidate.persistenceReceiptIds.length > 0 &&
      validationResult &&
      String(validationResult.validationStatus || '').toUpperCase() === 'PASSED' &&
      validationResult.reviewEligibility === true &&
      String(validationResult.validationBundleId || '').trim(),
    );

    const executableIds = components
      .filter(component =>
        ['ANALYZED', 'DEVICE_TESTED', 'VERIFIED'].includes(component!.status) &&
        component!.deterministic === true &&
        component!.security_class === 'READ_ONLY' &&
        Boolean(component!.implementation_hash) &&
        this.supportsEnvironment(component!, environment),
      )
      .map(component => component!.component_id);

    const unresolved = requestedIds
      .filter(id => !components.some(component => component!.component_id === id))
      .map(id => `COMPONENT_NOT_FOUND:${id}`);

    let compositionPlan: CompositionPlan | undefined;

    if (executableIds.length > 0) {
      compositionPlan =
        componentCompositionService.composeRuntimeComponentIds(
          request.goal,
          executableIds.slice(
            0,
            Math.max(1, Math.min(request.maxComponents || 4, 20)),
          ),
          environment,
          this.inputTypes(request.input),
        );
    }

    if (!compositionPlan && executableIds.length > 0) {
      unresolved.push(
        '既存ComponentだけではI/O・依存・環境契約を満たす構成を作成できません。',
      );
    }

    if (executableIds.length === 0) {
      if (reusableComponentIds.length > 0) {
        unresolved.push(
          `実行可能Component不足: 再利用可能なReusable Component ${reusableComponentIds.length}件を候補として取得しました。検証・適応後に再合成が必要です。`,
        );
      } else if (reusablePack.unresolvedComponentNeeds.length > 0) {
        unresolved.push(...reusablePack.unresolvedComponentNeeds);
      } else {
        unresolved.push('実行可能な既存Componentがありません。');
      }
    }

    if (reusablePack.excludedComponentIds.length > 0) {
      unresolved.push(
        ...reusablePack.excludedComponentIds.map(
          id => `REUSABLE_COMPONENT_EXCLUDED:${id}:${reusablePack.exclusionReasons[id] || 'UNKNOWN'}`,
        ),
      );
    }

    const uniqueUnresolved = validatedCandidateReady
      ? []
      : [...new Set(unresolved)];

    const passed = Boolean(
      compositionPlan?.executable ||
      validatedCandidateReady
    );

    const hasReusableCandidates = reusableComponentIds.length > 0;
    const hasCodeReusableCandidates = reusableComponentIds.some(id => {
      const item = reusablePack.usedCodeComponentIds.includes(id);
      return item;
    });
    const generatedAt = Date.now();
    const synthesisId = `SYN-${this.hash(
      `${request.requestId}|${request.goal}|${generatedAt}`,
    )}`;
    const componentIds = compositionPlan?.steps.map(step => step.component_id) || [];
    const inputContract = { types: this.inputTypes(request.input) };
    const outputContract = {
      types: compositionPlan?.steps.at(-1)?.output_types || [],
    };
    const evidenceRefs = [
      ...new Set([
        ...(context.evidenceRefs || []),
        ...componentIds.map(id => `component:${id}`),
        ...reusableComponentIds.map(id => `reusable-component:${id}`),
      ]),
    ];

    const candidateRefs = validatedCandidate
      ? [
          validatedCandidate.candidateId,
          validatedCandidate.workspaceId,
          validatedCandidate.candidateRevision,
          ...(Array.isArray(validatedCandidate.persistenceReceiptIds)
            ? validatedCandidate.persistenceReceiptIds
            : []),
          ...(Array.isArray(validatedCandidate.generationEvidenceIds)
            ? validatedCandidate.generationEvidenceIds
            : []),
          validationResult?.validationBundleId,
          ...(Array.isArray(validationResult?.persistenceReceiptIds)
            ? validationResult.persistenceReceiptIds
            : []),
          ...(Array.isArray(validationResult?.evidenceIds)
            ? validationResult.evidenceIds
            : []),
        ].filter(Boolean).map(String)
      : [];

    const contextRefs={
      evidenceRefs:[...(context.evidenceRefs || [])],
      knowledgeRefs:[...(context.knowledgeRefs || [])],
      memoryRefs:[...(context.memoryRefs || [])],
      experienceRefs:[...(context.experienceRefs || [])],
      failureExperienceRefs:[...(context.failureExperienceRefs || [])],
      verificationRefs:[...(context.verificationRefs || [])],
      candidateRefs,
    };

    const contextFingerprint=canonicalSha256Object({
      currentState:context.currentState || '',
      visitedDomains:[...(context.visitedDomains || [])],
      pendingDomains:[...(context.pendingDomains || [])],
      ...contextRefs,
      validatedCandidate,
      validationResult,
      priorSynthesisId:context.priorSynthesisId || '',
      recentDecisions:[...(context.recentDecisions || [])],
      unresolvedRefs:[...(context.unresolvedRefs || [])],
      semanticContext:[...(context.semanticContext || [])],
    });

    const artifactPayload = {
      synthesisId,
      requestId: request.requestId,
      taskId: request.taskId,
      goal: request.goal,
      environment,
      inputContract,
      outputContract,
      componentIds,
      adaptedComponentIds: [] as string[],
      compositionPlan,
      evidenceRefs,
      contextRefs,
      contextFingerprint,
      validatedCandidate,
      validationResult,
      priorSynthesisId:context.priorSynthesisId || undefined,
    };
    const synthesisArtifact: SynthesisArtifact = {
      artifactId: `SYNART-${this.hash(`${synthesisId}|artifact`)}`,
      synthesisId,
      goal: request.goal,
      environment,
      inputContract,
      outputContract,
      componentIds,
      adaptedComponentIds: [],
      compositionPlan,
      evidenceRefs,
      contextRefs,
      contextFingerprint,
      validatedCandidate,
      validationResult,
      priorSynthesisId:context.priorSynthesisId || undefined,
      lineage: { source: 'CORE', generatedAt },
      artifactHash: canonicalSha256Object(artifactPayload),
    };

    return {
      synthesisId,
      requestId: request.requestId,
      taskId: request.taskId,
      goal: request.goal,
      selectionMode: validatedCandidateReady
        ? 'REUSE_AS_IS'
        : passed
          ? compositionPlan!.steps.length > 1
            ? 'COMPOSE_MULTIPLE'
            : 'REUSE_AS_IS'
          : hasReusableCandidates
            ? 'ADAPT_EXISTING'
            : 'ESCALATE_UNKNOWN',
      compositionPlan,
      usedComponentIds:
        compositionPlan?.steps.map(step => step.component_id) || [],
      adaptedComponentIds: [],
      candidateComponentIds: reusablePack.createdComponentIds,
      reusableComponentIds,
      synthesisArtifact,
      validation: {
        status: passed ? 'PASSED' : 'BLOCKED',
        reasons: validatedCandidateReady
          ? ['検証済みCandidateをUniversal Synthesisの成果物として再利用し、COREへ再評価を返します。']
          : compositionPlan?.reasons || uniqueUnresolved,
      },
      unresolved: uniqueUnresolved,
      evidenceRefs,
      lineage: {
        source: 'CORE',
        generatedAt: Date.now(),
      },
      validatedCandidate,
      validationResult,
      priorSynthesisId:context.priorSynthesisId || undefined,
      nextCoreAction: passed
        ? 'RE_EVALUATE'
        : hasCodeReusableCandidates
          ? 'GENERATE_CANDIDATE'
          : hasReusableCandidates
            ? 'VERIFY_CANDIDATE'
            : uniqueUnresolved.length > 0
              ? 'RESEARCH_COMPONENT_GAP'
              : 'RE_EVALUATE',
    };
  }

  public synthesizeToCore(
    request: UniversalSynthesisRequest,
  ): CoreResult<SynthesisResult> {
    if (!coreResultService.get(request.requestId)) {
      coreResultService.createRequest({
        requestId: request.requestId,
        goal: request.goal,
        sourceCategory: 'core',
        payload: request as unknown as Record<string, unknown>,
        createdAt: Date.now(),
      });
    }

    const result = this.synthesize(request);

    // Synthesis is a CORE capability, not the completion authority.
    // Even a valid artifact must return to CORE for re-evaluation before
    // Completion Gate is allowed to produce the final CoreResult.
    return coreResultService.inconclusive(
      request.requestId,
      result.validation.status === 'PASSED'
        ? 'SYNTHESIS_REQUIRES_CORE_REEVALUATION'
        : result.unresolved.join('; ') || 'SYNTHESIS_BLOCKED',
      {
        result,
        route: ['core'],
        processedCategories: [],
      },
    ) as CoreResult<SynthesisResult>;
  }

  private inputTypes(input: unknown): string[] {
    if (typeof input === 'string') return ['String'];
    if (input === undefined || input === null) return [];
    if (Array.isArray(input)) return ['Array'];
    return ['Object'];
  }

  private supportsEnvironment(
    component: { supported_environments?: string[] },
    environment: string,
  ): boolean {
    const declared = (component.supported_environments || [])
      .map(value => String(value).trim().toLowerCase())
      .filter(Boolean);

    if (!declared.length || environment === 'universal') return true;

    const env = environment.trim().toLowerCase();

    if (env === 'android') {
      return declared.some(value => /android|galaxy/.test(value));
    }

    if (env === 'termux') {
      return declared.some(value => /termux|android/.test(value));
    }

    return declared.includes(env);
  }

  private hash(raw: string): string {
    let hash = 2166136261;

    for (let i = 0; i < raw.length; i += 1) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

export const universalSynthesisService =
  new UniversalSynthesisService();
