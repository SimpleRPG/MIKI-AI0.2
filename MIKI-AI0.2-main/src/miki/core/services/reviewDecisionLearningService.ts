import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from './canonicalSha256Service';
import type { ExternalReviewDecisionValue, ExternalReviewRecord } from './externalReviewIntakeService';
import { persistenceReceiptLedgerService, type PersistenceReceipt } from './persistenceReceiptLedgerService';

export type LearningSignal = 'ACCEPTED_EXAMPLE' | 'REJECTED_EXAMPLE' | 'CORRECTION_PAIR' | 'HELD_NO_GENERALIZATION';

export interface ReviewLearningEpisode {
  episodeId: string;
  packageId: string;
  packageRevision: number;
  candidateManifestSha256: string;
  externalReviewId: string;
  externalAiRole: import('./externalReviewIntakeService').ExternalAiRole;
  rawResponseSha256: string;
  decision: ExternalReviewDecisionValue;
  signal: LearningSignal;
  reason: string;
  strengths: string[];
  risks: string[];
  requestedChanges: string[];
  scope: 'THIS_PACKAGE_ONLY';
  generalizationAllowed: boolean;
  coreTaskId: string;
  coreDecisionId: string;
  createdAt: number;
  episodeSha256: string;
}


const EPISODES_KEY = 'miki_review_learning_episodes_v1';
const RECEIPTS_KEY = 'miki_review_learning_persistence_receipts_v1' as const;

class ReviewDecisionLearningService {
  project(input: {
    record: ExternalReviewRecord;
    decision: ExternalReviewDecisionValue;
    reason: string;
    coreTaskId: string;
    coreDecisionId: string;
    userDecisionId?: string;
  }): { episode: ReviewLearningEpisode; receipt: PersistenceReceipt } {
    if (!input.coreTaskId || !input.coreDecisionId) throw new Error('CORE_DECISION_REQUIRED');
    const signal: LearningSignal = input.decision === 'ACCEPT'
      ? 'ACCEPTED_EXAMPLE'
      : input.decision === 'REJECT'
        ? 'REJECTED_EXAMPLE'
        : input.decision === 'REQUEST_CHANGES' || input.decision === 'PARTIAL_ACCEPT' || input.decision === 'PARTIAL_REJECT'
          ? 'CORRECTION_PAIR'
          : 'HELD_NO_GENERALIZATION';
    const createdAt = Date.now();
    const base = {
      packageId: input.record.packageId,
      packageRevision: input.record.packageRevision,
      candidateManifestSha256: input.record.candidateManifestSha256,
      externalReviewId: input.record.externalReviewId,
      externalAiRole: input.record.externalAiRole,
      rawResponseSha256: input.record.rawResponseSha256,
      decision: input.decision,
      signal,
      reason: input.reason,
      strengths: [...input.record.strengths],
      risks: [...input.record.risks],
      requestedChanges: [...input.record.requestedChanges],
      scope: 'THIS_PACKAGE_ONLY' as const,
      generalizationAllowed: false,
      coreTaskId: input.coreTaskId,
      coreDecisionId: input.coreDecisionId,
      createdAt,
    };
    const episodeSha256 = canonicalSha256Object(base);
    const episode: ReviewLearningEpisode = {
      episodeId: `LEP-${episodeSha256.slice(0, 20)}`,
      ...base,
      episodeSha256,
    };
    const episodes = this.read<ReviewLearningEpisode>(EPISODES_KEY);
    const nextEpisodes = [episode, ...episodes.filter(item => item.episodeId !== episode.episodeId)].slice(0, 500);
    storageService.setItem(EPISODES_KEY, JSON.stringify(nextEpisodes));
    const reloaded = this.read<ReviewLearningEpisode>(EPISODES_KEY).some(item => item.episodeId === episode.episodeId && item.episodeSha256 === episodeSha256);
    if (!reloaded) throw new Error('LEARNING_EPISODE_PERSISTENCE_FAILED');
    const receipt: PersistenceReceipt = {
      receiptId: `PR-${canonicalSha256Object({ episodeSha256, createdAt }).slice(0, 20)}`,
      entityType: 'REVIEW_LEARNING_EPISODE',
      entityId: episode.episodeId,
      entitySha256: episodeSha256,
      storageKey: EPISODES_KEY,
      persistedAt: Date.now(),
      reloaded,
    };
    persistenceReceiptLedgerService.register(receipt, RECEIPTS_KEY);
    return { episode: { ...episode }, receipt: { ...receipt } };
  }

  listEpisodes(): ReviewLearningEpisode[] {
    return this.read<ReviewLearningEpisode>(EPISODES_KEY).map(item => ({ ...item, strengths: [...item.strengths], risks: [...item.risks], requestedChanges: [...item.requestedChanges] }));
  }

  private read<T>(key: string): T[] {
    try {
      const raw = storageService.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const reviewDecisionLearningService = new ReviewDecisionLearningService();
