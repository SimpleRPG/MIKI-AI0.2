import { AnswerContentIR, AnswerSkeletonType, MultiAxisPersonaConfig } from '../../../types';
import { answerContentIrService } from './answerContentIrService';
import { personaProfileService } from './personaProfileService';
import { autonomousAnswerCompositionPlanService, AutonomousAnswerCompositionPlan } from './autonomousAnswerCompositionPlanService';
import { conversationSurfaceDiversityService } from './conversationSurfaceDiversityService';
import type { CoreResult } from '../../core/services/coreResultService';
import { coreResultAnswerContentIrService, CoreResultAnswerContent } from './coreResultAnswerContentIrService';
import { conversationLearningEpisodeService } from './conversationLearningEpisodeService';
import type { ConversationFeedbackScope } from './conversationFeedbackEvidenceService';

export interface RuntimeConversationCompositionOptions { maxCandidates?: number; timeBudgetMs?: number; assembledCode?: string; }
export interface RuntimeConversationCandidate { skeleton: AnswerSkeletonType; surfaceText: string; semanticPreserved: boolean; repetitionScore: number; score: number; elapsedMs: number; }
export interface CoreResultRuntimeConversationCompositionResult extends RuntimeConversationCompositionResult { answerContent: CoreResultAnswerContent; }
export interface RuntimeConversationCompositionResult { surfaceText: string; selectedSkeleton: AnswerSkeletonType; candidatesEvaluated: number; cacheHit: boolean; elapsedMs: number; bounded: true; personaProfileId: string; personaRevision: number; personaApplied: boolean; compositionPlan: AutonomousAnswerCompositionPlan; compositionPlanId: string; compositionPlanSha256: string; selectedSurfaceSignature: string; repetitionAvoided: boolean; reusedConversationEpisodeIds: string[]; }
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
function score(candidate: RuntimeConversationCandidate, primary: AnswerSkeletonType): number {
  return (candidate.semanticPreserved ? 1000 : 0) + (candidate.skeleton === primary ? 100 : 0) + Math.max(0, 50 - candidate.elapsedMs) - Math.min(100, candidate.surfaceText.length / 20) - candidate.repetitionScore * 180;
}

export class RuntimeConversationCompositionService {
  private readonly cache = new Map<string, CachedRuntimeComposition>();
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
      candidate.score = score(candidate, primarySkeleton); candidates.push(candidate);
    }
    const selected = candidates.filter(candidate => candidate.semanticPreserved).sort((a, b) => b.score - a.score)[0] || candidates.sort((a, b) => b.score - a.score)[0];
    const fallback = selected || { skeleton: primarySkeleton, surfaceText: answerContentIrService.generateSurfaceTextFromIR(ir, primarySkeleton, surfacePersona, options.assembledCode).surfaceText };
    const selectedDiversity = conversationSurfaceDiversityService.assess(fallback.surfaceText);
    conversationSurfaceDiversityService.record(fallback.surfaceText);
    const result: RuntimeConversationCompositionResult = { surfaceText: fallback.surfaceText, selectedSkeleton: fallback.skeleton, candidatesEvaluated: candidates.length, cacheHit: false, elapsedMs: performance.now() - startedAt, bounded: true, personaProfileId: personaProfile.profileId, personaRevision: personaProfile.revision, personaApplied: true, compositionPlan, compositionPlanId: compositionPlan.planId, compositionPlanSha256: compositionPlan.planSha256, selectedSurfaceSignature: selectedDiversity.signature, repetitionAvoided: selectedDiversity.repetitionScore < 0.5, reusedConversationEpisodeIds: reusedConversationEpisodes.map(episode => episode.episodeId) };
    this.cache.set(cacheKey, { result, createdAt: Date.now() }); this.trimCache(); return result;
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
