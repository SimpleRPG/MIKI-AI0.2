import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { ConversationFeedbackObservation, ConversationFeedbackScope } from './conversationFeedbackEvidenceService';

export type ConversationLearningEpisodeStatus = 'OBSERVED' | 'REVISION_REQUIRED' | 'ELIGIBLE_FOR_REUSE' | 'QUARANTINED';
export type ConversationLearningTarget = 'SURFACE_STYLE' | 'COMPOSITION_PLAN' | 'CONTENT_OR_FACT' | 'UNKNOWN';

export interface ConversationLearningEpisode {
  episodeId: string;
  responseId: string;
  conversationId?: string;
  observationId: string;
  target: ConversationLearningTarget;
  status: ConversationLearningEpisodeStatus;
  positiveScopes: ConversationFeedbackScope[];
  negativeScopes: ConversationFeedbackScope[];
  rejectedText?: string;
  replacementText?: string;
  epistemicStatus: ConversationFeedbackObservation['epistemicStatus'];
  unknownTerms: string[];
  supportingClaimIds: string[];
  conflictingClaimIds: string[];
  reusableForSurface: boolean;
  reusableForComposition: boolean;
  generalizationAllowed: false;
  scope: 'THIS_RESPONSE_ONLY';
  createdAt: number;
  episodeSha256: string;
}

const STORAGE_KEY = 'miki_conversation_learning_episodes_v1';
const MAX_EPISODES = 2000;
const SURFACE_SCOPES = new Set<ConversationFeedbackScope>(['WORDING', 'TONE', 'DETAIL_LEVEL', 'ANSWER_STRUCTURE']);
const CONTENT_SCOPES = new Set<ConversationFeedbackScope>(['FACT', 'TARGET', 'ACTION', 'CONDITION', 'EXCEPTION', 'REASONING', 'NEXT_ACTION']);

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function targetFor(observation: ConversationFeedbackObservation): ConversationLearningTarget {
  const scopes = unique([...observation.positiveScopes, ...observation.negativeScopes, ...observation.scopes]);
  if (scopes.some(scope => CONTENT_SCOPES.has(scope))) return 'CONTENT_OR_FACT';
  if (scopes.includes('ANSWER_STRUCTURE')) return 'COMPOSITION_PLAN';
  if (scopes.some(scope => SURFACE_SCOPES.has(scope))) return 'SURFACE_STYLE';
  return 'UNKNOWN';
}

function statusFor(observation: ConversationFeedbackObservation, target: ConversationLearningTarget): ConversationLearningEpisodeStatus {
  if (observation.epistemicStatus === 'CONFLICTED') return 'QUARANTINED';
  if (observation.unknownTerms.length > 0 || observation.epistemicStatus === 'UNKNOWN') return 'OBSERVED';
  if (observation.negativeScopes.length > 0 || observation.polarity === 'CORRECTION' || observation.polarity === 'NEGATIVE' || observation.polarity === 'PARTIAL') return 'REVISION_REQUIRED';
  if (target === 'SURFACE_STYLE' && observation.positiveScopes.length > 0 && observation.confidence >= 0.75) return 'ELIGIBLE_FOR_REUSE';
  return 'OBSERVED';
}

export class ConversationLearningEpisodeService {
  private episodes: ConversationLearningEpisode[] = [];

  constructor() {
    this.load();
  }

  public record(observation: ConversationFeedbackObservation): ConversationLearningEpisode {
    const target = targetFor(observation);
    const status = statusFor(observation, target);
    const reusableForSurface = status === 'ELIGIBLE_FOR_REUSE' && target === 'SURFACE_STYLE';
    const reusableForComposition = false;
    const createdAt = Date.now();
    const material = {
      responseId: observation.responseId,
      conversationId: observation.conversationId,
      observationId: observation.observationId,
      target,
      status,
      positiveScopes: unique(observation.positiveScopes),
      negativeScopes: unique(observation.negativeScopes),
      rejectedText: observation.rejectedText,
      replacementText: observation.replacementText,
      epistemicStatus: observation.epistemicStatus,
      unknownTerms: unique(observation.unknownTerms),
      supportingClaimIds: unique(observation.supportingClaimIds),
      conflictingClaimIds: unique(observation.conflictingClaimIds),
      reusableForSurface,
      reusableForComposition,
      generalizationAllowed: false as const,
      scope: 'THIS_RESPONSE_ONLY' as const,
      createdAt,
    };
    const episodeSha256 = canonicalSha256(material);
    const episode: ConversationLearningEpisode = {
      ...material,
      episodeId: `CLE-${episodeSha256.slice(0, 20)}`,
      episodeSha256,
    };
    const existingIndex = this.episodes.findIndex(item => item.observationId === observation.observationId);
    if (existingIndex >= 0) this.episodes[existingIndex] = episode;
    else this.episodes.unshift(episode);
    if (this.episodes.length > MAX_EPISODES) this.episodes.length = MAX_EPISODES;
    this.save();
    return episode;
  }

  public list(): ConversationLearningEpisode[] {
    return this.episodes.map(item => ({ ...item, positiveScopes: [...item.positiveScopes], negativeScopes: [...item.negativeScopes], unknownTerms: [...item.unknownTerms], supportingClaimIds: [...item.supportingClaimIds], conflictingClaimIds: [...item.conflictingClaimIds] }));
  }


  public findReusableForSimilarScene(scopes: ConversationFeedbackScope[], limit = 5): ConversationLearningEpisode[] {
    const requested = new Set(unique(scopes));
    if (requested.size === 0) return [];
    return this.list()
      .filter(item => item.status === 'ELIGIBLE_FOR_REUSE' && item.reusableForSurface && item.epistemicStatus === 'SUPPORTED')
      .map(item => {
        const episodeScopes = new Set(item.positiveScopes.filter(scope => SURFACE_SCOPES.has(scope)));
        const overlap = [...requested].filter(scope => episodeScopes.has(scope)).length;
        const union = new Set([...requested, ...episodeScopes]).size;
        return { item, similarity: union === 0 ? 0 : overlap / union };
      })
      .filter(match => match.similarity >= 0.5)
      .sort((left, right) => right.similarity - left.similarity || right.item.createdAt - left.item.createdAt)
      .slice(0, Math.max(0, limit))
      .map(match => match.item);
  }

  public getByResponseId(responseId: string): ConversationLearningEpisode[] {
    return this.list().filter(item => item.responseId === responseId);
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.episodes = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.episodes = [];
    }
  }

  private save(): void {
    storageService.setItem(STORAGE_KEY, JSON.stringify(this.episodes));
  }
}

export const conversationLearningEpisodeService = new ConversationLearningEpisodeService();
