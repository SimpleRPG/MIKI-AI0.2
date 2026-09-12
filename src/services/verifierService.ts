import { ClaimRecord, ClaimVerificationStatus } from '../types';
import { claimDatabaseService } from './claimDatabaseService';
import { evidenceService, EvidenceRecord } from './evidenceService';
import { knowledgeGapService } from './knowledgeGapService';
import { systemLogger } from './systemLogger';

export type VerificationOutcome =
  | 'SUPPORTED'
  | 'DEVICE_VERIFIED'
  | 'CONTRADICTED'
  | 'UNRESOLVED';

export interface VerificationResult {
  claimId: string;
  outcome: VerificationOutcome;
  previousStatus: ClaimVerificationStatus;
  independentEvidenceCount: number;
  evidenceCount: number;
  executionEvidenceCount: number;
  contradictionCount: number;
  stale: boolean;
  reasons: string[];
  promoted: boolean;
}

/**
 * Evidence -> verification boundary.
 *
 * Rules:
 * - 1 source is never enough for SUPPORTED.
 * - Multiple independent evidence clusters can promote UNVERIFIED -> SUPPORTED.
 * - DEVICE_VERIFIED requires explicit admissible EXECUTION evidence.
 * - Contradiction blocks promotion.
 * - Stale evidence cannot establish a fresh claim.
 * - This service is the only normal path that promotes evidence-derived claims.
 */
export class VerifierService {
  private static instance: VerifierService;

  private constructor() {}

  public static getInstance(): VerifierService {
    if (!VerifierService.instance) VerifierService.instance = new VerifierService();
    return VerifierService.instance;
  }

  public verifyClaim(params: {
    claimId: string;
    evidenceIds?: string[];
    executionEvidenceIds?: string[];
    requireFresh?: boolean;
    maxAgeDays?: number;
    resolveGapId?: string;
  }): VerificationResult {
    const claim = claimDatabaseService.getClaim(params.claimId);
    if (!claim) {
      return {
        claimId: params.claimId,
        outcome: 'UNRESOLVED',
        previousStatus: 'UNRESOLVED',
        independentEvidenceCount: 0,
        evidenceCount: 0,
        executionEvidenceCount: 0,
        contradictionCount: 0,
        stale: false,
        reasons: ['対象Claimが存在しません。'],
        promoted: false,
      };
    }

    const previousStatus = claim.status;
    const evidence = this.collectEvidence(params.claimId, params.evidenceIds);
    const executionEvidence = this.collectEvidence(params.claimId, params.executionEvidenceIds)
      .filter((e) => e.kind === 'EXECUTION');

    const admissible = evidence.filter((e) => e.status === 'ADMISSIBLE');
    const independentClusters = new Set(admissible.map((e) => e.independence_cluster_id));
    const contradictionCount = (claim.contradicted_by || []).filter((id) => {
      const other = claimDatabaseService.getClaim(id);
      return !!other && other.status !== 'SUPERSEDED' && other.status !== 'FALSE';
    }).length;

    const maxAgeDays = Math.max(1, params.maxAgeDays ?? 365);
    const stale = params.requireFresh === true && this.isStale(admissible, maxAgeDays);
    const reasons: string[] = [];
    let outcome: VerificationOutcome = 'UNRESOLVED';

    if (claim.status === 'FALSE' || claim.status === 'SUPERSEDED') {
      reasons.push(`Claim状態が${claim.status}のため昇格できません。`);
    } else if (contradictionCount > 0) {
      outcome = 'CONTRADICTED';
      reasons.push(`反証関係が${contradictionCount}件あります。`);
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'CONTRADICTED', 'Verifier: contradiction detected');
    } else if (stale) {
      reasons.push(`証拠が${maxAgeDays}日を超えて古いため、最新性を要求するClaimは確定しません。`);
    } else if (executionEvidence.length > 0 && executionEvidence.every((e) => e.status === 'ADMISSIBLE')) {
      outcome = 'DEVICE_VERIFIED';
      reasons.push('明示的なEXECUTION証拠が確認されました。');
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'DEVICE_VERIFIED', 'Verifier: admissible execution evidence');
    } else if (independentClusters.size >= 2) {
      outcome = 'SUPPORTED';
      reasons.push(`独立証拠クラスター${independentClusters.size}件を確認しました。`);
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'SUPPORTED', 'Verifier: independent evidence');
    } else {
      reasons.push(`独立証拠クラスターが${independentClusters.size}件しかありません。SUPPORTEDには2件以上必要です。`);
    }

    const promoted = outcome === 'SUPPORTED' || outcome === 'DEVICE_VERIFIED';

    if (promoted && params.resolveGapId) {
      knowledgeGapService.markResolved(params.resolveGapId);
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔐 [Verifier] ${claim.claim_id}: ${claim.status} -> ${outcome} / independent=${independentClusters.size} / execution=${executionEvidence.length}`
    );

    return {
      claimId: claim.claim_id,
      outcome,
      previousStatus,
      independentEvidenceCount: independentClusters.size,
      evidenceCount: admissible.length,
      executionEvidenceCount: executionEvidence.length,
      contradictionCount,
      stale,
      reasons,
      promoted,
    };
  }

  public verifyMany(params: {
    claimIds: string[];
    requireFresh?: boolean;
    maxAgeDays?: number;
    resolveGapId?: string;
  }): VerificationResult[] {
    return params.claimIds.map((claimId) =>
      this.verifyClaim({
        claimId,
        requireFresh: params.requireFresh,
        maxAgeDays: params.maxAgeDays,
        resolveGapId: params.resolveGapId,
      })
    );
  }

  private collectEvidence(claimId: string, evidenceIds?: string[]): EvidenceRecord[] {
    const records = evidenceService.list({ claimId });
    if (!evidenceIds || evidenceIds.length === 0) return records;
    const wanted = new Set(evidenceIds);
    return records.filter((record) => wanted.has(record.evidence_id));
  }

  private isStale(records: EvidenceRecord[], maxAgeDays: number): boolean {
    if (records.length === 0) return false;
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const dated = records
      .map((record) => {
        if (!record.published_date) return undefined;
        const time = Date.parse(record.published_date);
        return Number.isFinite(time) ? time : undefined;
      })
      .filter((time): time is number => typeof time === 'number');

    // Unknown publication date is not treated as proof of staleness.
    if (dated.length === 0) return false;
    return dated.every((time) => now - time > maxAgeMs);
  }
}

export const verifierService = VerifierService.getInstance();
