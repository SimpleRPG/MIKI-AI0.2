import { AnswerContentIR, AnswerSkeletonType, MultiAxisPersonaConfig } from '../../../types';
import { answerContentIrService } from './answerContentIrService';
import { personaProfileService } from './personaProfileService';
import { autonomousAnswerCompositionPlanService, AutonomousAnswerCompositionPlan } from './autonomousAnswerCompositionPlanService';
import { conversationSurfaceDiversityService } from './conversationSurfaceDiversityService';
import type { CoreResult } from '../../core/services/coreResultService';
import { coreResultAnswerContentIrService, CoreResultAnswerContent } from './coreResultAnswerContentIrService';
import { conversationLearningEpisodeService } from './conversationLearningEpisodeService';
import type { ConversationFeedbackScope } from './conversationFeedbackEvidenceService';
import { systemLogger } from '../../../services/systemLogger';

export interface RuntimeConversationCompositionOptions { maxCandidates?: number; timeBudgetMs?: number; assembledCode?: string; }
export interface RuntimeConversationConcurrencyState { inFlight: boolean; startedAt?: number; }
export interface RuntimeConversationSelectionCriteria {
  accuracy: number;
  goalFit: number;
  constraintCompliance: number;
  evidenceSupport: number;
  unknownHandling: number;
  detailFit: number;
  safety: number;
  userStateFit: number;
}

export interface RuntimeConversationSelectionRecord {
  method: 'DETERMINISTIC_WEIGHTED_SELECTION_V1';
  selectedCandidateId: string;
  selectedSkeleton: AnswerSkeletonType;
  selectedScore: number;
  evaluatedCandidates: Array<{
    candidateId: string;
    skeleton: AnswerSkeletonType;
    score: number;
    criteria: RuntimeConversationSelectionCriteria;
    tieBreakKey: string;
  }>;
}

export interface RuntimeConversationCandidate { skeleton: AnswerSkeletonType; surfaceText: string; semanticPreserved: boolean; repetitionScore: number; score: number; elapsedMs: number; }
export interface CoreResultRuntimeConversationCompositionResult extends RuntimeConversationCompositionResult { answerContent: CoreResultAnswerContent; }
export interface RuntimeConversationCompositionResult { surfaceText: string; selectedSkeleton: AnswerSkeletonType; candidatesEvaluated: number; cacheHit: boolean; elapsedMs: number; bounded: true; personaProfileId: string; personaRevision: number; personaApplied: boolean; compositionPlan: AutonomousAnswerCompositionPlan; compositionPlanId: string; compositionPlanSha256: string; selectedSurfaceSignature: string; repetitionAvoided: boolean; reusedConversationEpisodeIds: string[]; selection?: RuntimeConversationSelectionRecord; }
interface CachedRuntimeComposition { result: RuntimeConversationCompositionResult; createdAt: number; }

const DEFAULT_MAX_CANDIDATES = 4;
const DEFAULT_TIME_BUDGET_MS = 12;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

function stableSignature(ir: AnswerContentIR, skeleton: AnswerSkeletonType, assembledCode: string | undefined, personaProfileId: string, personaRevision: number): string {
  const payload = JSON.stringify({ conclusion: ir.conclusion, target: ir.target, reasons: ir.reasons, conditions: ir.conditions, exceptions: ir.exceptions, next_actions: ir.next_actions, certainty: ir.certainty, detail_level: ir.detail_level, interaction_mode: ir.interaction_mode, skeleton, assembledCode, personaProfileId, personaRevision });
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) { hash ^= payload.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function uniqueSkeletons(primary: AnswerSkeletonType): AnswerSkeletonType[] {
  const values: AnswerSkeletonType[] = [primary];
  if (primary !== 'GENERAL_ANSWER') values.push('GENERAL_ANSWER');
  if (primary !== 'RECOMMENDATION') values.push('RECOMMENDATION');
  if (primary !== 'TASK_COMPLETION') values.push('TASK_COMPLETION');
  return [...new Set(values)];
}
function detailFitScore(text: string, detailLevel: AnswerContentIR['detail_level']): number {
  const length = text.length;
  if (detailLevel === 'BRIEF') return length <= 220 ? 100 : Math.max(0, 100 - (length - 220) / 8);
  if (detailLevel === 'DETAILED') return length >= 260 ? 100 : Math.min(100, 60 + length / 6);
  if (length >= 100 && length <= 900) return 100;
  if (length < 100) return Math.max(40, length);
  return Math.max(40, 100 - (length - 900) / 12);
}

function goalFitScore(candidate: RuntimeConversationCandidate, primary: AnswerSkeletonType, ir: AnswerContentIR): number {
  if (candidate.skeleton === primary) return 100;
  if (ir.strategy === 'SHORT_ACK' || ir.strategy === 'EMPATHY_ONLY' || ir.strategy === 'CLOSE_CONVERSATION') {
    return candidate.skeleton === 'GENERAL_ANSWER' ? 90 : 55;
  }
  if (ir.interaction_mode === 'CODE_DELIVERY') return candidate.skeleton === 'TASK_COMPLETION' ? 85 : 50;
  if (ir.interaction_mode === 'TROUBLESHOOTING') {
    return candidate.skeleton === 'UNKNOWN_INVESTIGATION' || candidate.skeleton === 'CORRECTION' ? 82 : 50;
  }
  if (ir.certainty === 'UNKNOWN') return candidate.skeleton === 'UNKNOWN_INVESTIGATION' ? 85 : 45;
  return candidate.skeleton === 'GENERAL_ANSWER' ? 75 : 50;
}

function safetyScore(candidate: RuntimeConversationCandidate, ir: AnswerContentIR): number {
  const sensitive = ir.interaction_mode === 'SAFETY_GATE' || /禁止|危険|権限|破壊|個人情報/.test(
    `${ir.conclusion} ${ir.conditions.join(' ')} ${ir.exceptions.join(' ')}`
  );
  if (!sensitive) return 100;
  return /禁止|危険|権限|条件|前提|確認|できない|制限|保留/.test(candidate.surfaceText) ? 100 : 25;
}

function userStateFitScore(candidate: RuntimeConversationCandidate, ir: AnswerContentIR, persona: Pick<MultiAxisPersonaConfig, 'currentScene'>): number {
  const scene = persona.currentScene;
  if (scene === 'SHORT_MODE') return candidate.surfaceText.length <= 260 ? 100 : Math.max(30, 100 - (candidate.surfaceText.length - 260) / 6);
  if (scene === 'DETAILED_MODE') return candidate.surfaceText.length >= 260 ? 100 : 70;
  if (scene === 'CODE_DELIVERY') return candidate.skeleton === 'TASK_COMPLETION' ? 100 : 65;
  if (scene === 'ERROR_REPORT' || scene === 'DISASTER_RECOVERY') {
    return /確認|原因|対処|復旧|保留|失敗/.test(candidate.surfaceText) ? 100 : 65;
  }
  if (ir.strategy === 'SHORT_ACK') return candidate.surfaceText.length <= 180 ? 100 : 60;
  return 85;
}

function evidenceSupportScore(ir: AnswerContentIR): number {
  if (ir.certainty === 'UNKNOWN') return ir.reasons.length > 0 || ir.exceptions.length > 0 ? 70 : 35;
  if (ir.certainty === 'HYPOTHETICAL' || ir.certainty === 'CONDITIONAL') {
    return ir.reasons.length > 0 || ir.conditions.length > 0 ? 90 : 60;
  }
  return ir.reasons.length > 0 || ir.conditions.length > 0 ? 100 : 80;
}

function selectionCriteria(
  candidate: RuntimeConversationCandidate,
  primary: AnswerSkeletonType,
  ir: AnswerContentIR,
  persona: Pick<MultiAxisPersonaConfig, 'currentScene'>,
): RuntimeConversationSelectionCriteria {
  return {
    accuracy: candidate.semanticPreserved ? 100 : 0,
    goalFit: goalFitScore(candidate, primary, ir),
    constraintCompliance: candidate.semanticPreserved ? (ir.conditions.length > 0 ? 100 : 90) : 0,
    evidenceSupport: evidenceSupportScore(ir),
    unknownHandling: ir.certainty === 'UNKNOWN'
      ? (candidate.skeleton === 'UNKNOWN_INVESTIGATION' ? 100 : 35)
      : 95,
    detailFit: detailFitScore(candidate.surfaceText, ir.detail_level),
    safety: safetyScore(candidate, ir),
    userStateFit: userStateFitScore(candidate, ir, persona),
  };
}

function weightedSelectionScore(criteria: RuntimeConversationSelectionCriteria): number {
  const weights: Array<[keyof RuntimeConversationSelectionCriteria, number]> = [
    ['accuracy', 25],
    ['goalFit', 18],
    ['constraintCompliance', 14],
    ['evidenceSupport', 10],
    ['unknownHandling', 10],
    ['detailFit', 8],
    ['safety', 10],
    ['userStateFit', 5],
  ];
  const weighted = weights.reduce((sum, [key, weight]) => sum + criteria[key] * weight, 0);
  return Math.round(weighted) / 100;
}

function deterministicTieBreak(
  a: { candidate: RuntimeConversationCandidate; score: number; criteria: RuntimeConversationSelectionCriteria; tieBreakKey: string },
  b: { candidate: RuntimeConversationCandidate; score: number; criteria: RuntimeConversationSelectionCriteria; tieBreakKey: string },
  primary: AnswerSkeletonType,
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.criteria.accuracy !== a.criteria.accuracy) return b.criteria.accuracy - a.criteria.accuracy;
  if (b.criteria.safety !== a.criteria.safety) return b.criteria.safety - a.criteria.safety;
  if (b.criteria.goalFit !== a.criteria.goalFit) return b.criteria.goalFit - a.criteria.goalFit;
  if (b.criteria.detailFit !== a.criteria.detailFit) return b.criteria.detailFit - a.criteria.detailFit;
  if (a.candidate.repetitionScore !== b.candidate.repetitionScore) return a.candidate.repetitionScore - b.candidate.repetitionScore;
  if ((a.candidate.skeleton === primary) !== (b.candidate.skeleton === primary)) return a.candidate.skeleton === primary ? -1 : 1;
  if (a.candidate.surfaceText.length !== b.candidate.surfaceText.length) return a.candidate.surfaceText.length - b.candidate.surfaceText.length;
  return a.tieBreakKey.localeCompare(b.tieBreakKey);
}

export class RuntimeConversationCompositionService {
  private readonly cache = new Map<string, CachedRuntimeComposition>();
  private readonly inFlight = new Map<string, RuntimeConversationConcurrencyState>();
  public compose(ir: AnswerContentIR, primarySkeleton: AnswerSkeletonType, options: RuntimeConversationCompositionOptions = {}): RuntimeConversationCompositionResult {
    const startedAt = performance.now();
    const personaProfile = personaProfileService.get();
    const compositionPlan = autonomousAnswerCompositionPlanService.create(ir);
    const sceneScopes: ConversationFeedbackScope[] = ['WORDING', 'TONE', 'ANSWER_STRUCTURE', ...(ir.detail_level === 'BRIEF' || ir.detail_level === 'DETAILED' ? ['DETAIL_LEVEL' as const] : [])];
    const reusedConversationEpisodes = conversationLearningEpisodeService.findReusableForSimilarScene(sceneScopes);
    const communicationStyle = personaProfileService.deriveCommunicationStyle(personaProfile);
    const surfacePersona = {
      politeness: communicationStyle.politeness >= 80 ? 'VERY_POLITE' : communicationStyle.politeness <= 35 ? 'CASUAL' : 'CASUAL_POLITE',
      warmth: communicationStyle.warmth >= 80 ? 'HIGH' : communicationStyle.warmth <= 35 ? 'LOW' : 'MEDIUM_HIGH',
      formality: communicationStyle.formality >= 80 ? 'HIGH' : communicationStyle.formality <= 35 ? 'LOW' : 'MEDIUM_LOW',
      verbosity: communicationStyle.verbosity <= 35 ? 'CONCISE' : communicationStyle.verbosity >= 80 ? 'DETAILED' : 'ADAPTIVE',
      technicalTerminology: communicationStyle.technicalExplanation ? 'BALANCED' : 'PLAIN_LANGUAGE',
    } as Partial<MultiAxisPersonaConfig>;
    const cacheKey = stableSignature(ir, primarySkeleton, options.assembledCode, personaProfile.profileId, personaProfile.revision);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt <= CACHE_TTL_MS) return { ...cached.result, cacheHit: true, elapsedMs: performance.now() - startedAt };
    const active = this.inFlight.get(cacheKey);
    if (active?.inFlight && Date.now() - (active.startedAt || 0) < 1000) {
      const fallbackRendered = answerContentIrService.generateSurfaceTextFromIR(ir, primarySkeleton, surfacePersona, options.assembledCode);
      const fallbackDiversity = conversationSurfaceDiversityService.assess(fallbackRendered.surfaceText);
      return {
        surfaceText: fallbackRendered.surfaceText, selectedSkeleton: primarySkeleton, candidatesEvaluated: 0, cacheHit: false,
        elapsedMs: performance.now() - startedAt, bounded: true, personaProfileId: personaProfile.profileId,
        personaRevision: personaProfile.revision, personaApplied: true, compositionPlan, compositionPlanId: compositionPlan.planId,
        compositionPlanSha256: compositionPlan.planSha256, selectedSurfaceSignature: fallbackDiversity.signature,
        repetitionAvoided: false, reusedConversationEpisodeIds: reusedConversationEpisodes.map((episode) => episode.episodeId),
      };
    }
    this.inFlight.set(cacheKey, { inFlight: true, startedAt: Date.now() });
    const maxCandidates = Math.max(1, Math.min(8, options.maxCandidates || DEFAULT_MAX_CANDIDATES));
    const timeBudgetMs = Math.max(2, Math.min(50, options.timeBudgetMs || DEFAULT_TIME_BUDGET_MS));
    const candidates: RuntimeConversationCandidate[] = [];
    for (const skeleton of uniqueSkeletons(primarySkeleton).slice(0, maxCandidates)) {
      if (candidates.length > 0 && performance.now() - startedAt >= timeBudgetMs) break;
      const candidateStartedAt = performance.now();
      const rendered = answerContentIrService.generateSurfaceTextFromIR(ir, skeleton, surfacePersona, options.assembledCode);
      const inspection = answerContentIrService.verifySemanticPreservation(ir, rendered.surfaceText);
      const diversity = conversationSurfaceDiversityService.assess(rendered.surfaceText);
      const candidate: RuntimeConversationCandidate = { skeleton, surfaceText: rendered.surfaceText, semanticPreserved: inspection.isPreserved, repetitionScore: diversity.repetitionScore, score: 0, elapsedMs: performance.now() - candidateStartedAt };
      candidates.push(candidate);
    }
    const selectionScene: MultiAxisPersonaConfig['currentScene'] =
      ir.interaction_mode === 'CODE_DELIVERY' ? 'CODE_DELIVERY' :
      ir.interaction_mode === 'TROUBLESHOOTING' ? 'ERROR_REPORT' :
      ir.interaction_mode === 'SAFETY_GATE' ? 'DISASTER_RECOVERY' :
      ir.detail_level === 'BRIEF' ? 'SHORT_MODE' :
      ir.detail_level === 'DETAILED' ? 'DETAILED_MODE' : 'NORMAL';
    const scored = candidates.map((candidate, index) => {
      const criteria = selectionCriteria(candidate, primarySkeleton, ir, { currentScene: selectionScene });
      const score = weightedSelectionScore(criteria);
      candidate.score = score;
      const tieBreakKey = stableSignature(ir, candidate.skeleton, candidate.surfaceText, personaProfile.profileId, personaProfile.revision);
      return { candidate, score, criteria, tieBreakKey, candidateId: `runtime-candidate-${index + 1}-${tieBreakKey}` };
    });
    scored.sort((a, b) => deterministicTieBreak(a, b, primarySkeleton));
    const chosen = scored.find(item => item.candidate.semanticPreserved) || scored[0];
    const selected = chosen?.candidate;
    const fallback = selected || { skeleton: primarySkeleton, surfaceText: answerContentIrService.generateSurfaceTextFromIR(ir, primarySkeleton, surfacePersona, options.assembledCode).surfaceText };
    const selection: RuntimeConversationSelectionRecord | undefined = chosen ? {
      method: 'DETERMINISTIC_WEIGHTED_SELECTION_V1',
      selectedCandidateId: chosen.candidateId,
      selectedSkeleton: chosen.candidate.skeleton,
      selectedScore: chosen.score,
      evaluatedCandidates: scored.map(item => ({ candidateId: item.candidateId, skeleton: item.candidate.skeleton, score: item.score, criteria: item.criteria, tieBreakKey: item.tieBreakKey })),
    } : undefined;
    const selectedDiversity = conversationSurfaceDiversityService.assess(fallback.surfaceText);
    conversationSurfaceDiversityService.record(fallback.surfaceText);
    const composedResult: RuntimeConversationCompositionResult = { surfaceText: fallback.surfaceText, selectedSkeleton: fallback.skeleton, candidatesEvaluated: candidates.length, cacheHit: false, elapsedMs: performance.now() - startedAt, bounded: true, personaProfileId: personaProfile.profileId, personaRevision: personaProfile.revision, personaApplied: true, compositionPlan, compositionPlanId: compositionPlan.planId, compositionPlanSha256: compositionPlan.planSha256, selectedSurfaceSignature: selectedDiversity.signature, repetitionAvoided: selectedDiversity.repetitionScore < 0.5, reusedConversationEpisodeIds: reusedConversationEpisodes.map(episode => episode.episodeId), selection };
    const result = composedResult;
    if (selection) systemLogger.info('ANSWER_PLAN', `🎯 [deterministic selection] ${selection.selectedSkeleton} / score=${selection.selectedScore} / candidates=${selection.evaluatedCandidates.length}`);
    this.cache.set(cacheKey, { result, createdAt: Date.now() }); this.trimCache(); this.inFlight.delete(cacheKey); return result;
  }
  public composeCoreResult(coreResult: CoreResult, options: RuntimeConversationCompositionOptions = {}): CoreResultRuntimeConversationCompositionResult {
    const answerContent = coreResultAnswerContentIrService.convert(coreResult);
    const composed = this.compose(answerContent.ir, answerContent.skeleton, options);
    return { ...composed, answerContent };
  }
  public clearCache(): void { this.cache.clear(); }
  private trimCache(): void { if (this.cache.size <= MAX_CACHE_ENTRIES) return; const oldest = [...this.cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt); for (const [key] of oldest.slice(0, this.cache.size - MAX_CACHE_ENTRIES)) this.cache.delete(key); }
}
export const runtimeConversationCompositionService = new RuntimeConversationCompositionService();
