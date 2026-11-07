import { ClaimRecord, ClaimVerificationStatus } from '../../../types';
import { claimDatabaseService } from '../../../services/claimDatabaseService';
import { evidenceService, EvidenceRecord } from '../../../services/evidenceService';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimVerificationEventService } from './claimVerificationEventService';

// P440 D5: 勉強の測定値の置き場所（reusableComponentFactoryService・
// domainIntegrationBootstrapService・researchService と同じキー・同じ形）。
const STUDY_MEASUREMENT_KEY = 'miki_study_measurement_v1';

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
  // P463: 一次・公式情報（PRIMARY / OFFICIAL ロール）が admissible に
  // 含まれていたか。検証台帳にも残す。
  hasPrimaryOrOfficialSource: boolean;
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
        hasPrimaryOrOfficialSource: false,
      };
    }

    const previousStatus = claim.status;
    const evidence = this.collectEvidence(params.claimId, params.evidenceIds);
    const executionEvidence = this.collectEvidence(params.claimId, params.executionEvidenceIds)
      .filter((e) => e.kind === 'EXECUTION');

    const admissible = evidence.filter((e) => e.status === 'ADMISSIBLE' && e.metadata?.research_source_role !== 'COUNTEREVIDENCE');
    const independentClusters = new Set(admissible.map((e) => e.independence_cluster_id));
    // P463: 一次資料の判定接続。収集ポリシーでは一次資料が必須でも、
    // 判定段の昇格条件には入っていなかった。証拠全件に役割が明示されて
    // いる場合（研究経由）に限り、一次・公式情報なしでは確定しない。
    // 役割が未記録の証拠が混ざる経路は従来どおり（クラスタ数で判定）。
    const hasPrimaryOrOfficialSource = admissible.some((e) => {
      const role = e.metadata?.research_source_role;
      return role === 'PRIMARY' || role === 'OFFICIAL';
    });
    const allEvidenceRolesClassified =
      admissible.length > 0 &&
      admissible.every((e) => {
        const role = e.metadata?.research_source_role;
        return typeof role === 'string' && role !== 'UNCLASSIFIED';
      });
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
    } else if (independentClusters.size >= 2 && allEvidenceRolesClassified && !hasPrimaryOrOfficialSource) {
      reasons.push('独立クラスターは足りていますが、一次・公式情報が含まれていません。二次情報のみでは確定しません。');
    } else if (independentClusters.size >= 2) {
      outcome = 'SUPPORTED';
      reasons.push(`独立証拠クラスター${independentClusters.size}件を確認しました。`);
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'SUPPORTED', 'Verifier: independent evidence');
    } else {
      reasons.push(`独立証拠クラスターが${independentClusters.size}件しかありません。SUPPORTEDには2件以上必要です。`);
    }

    const promoted = outcome === 'SUPPORTED' || outcome === 'DEVICE_VERIFIED';

    // P440 D5: 検証結果の内訳を永続化カウンタに残す（測定の集計層）。
    // UNRESOLVED の内訳（クラスタ不足／ADMISSIBLE なし／反証あり／鮮度）
    // も区別して残す。測定の永続化失敗は検証結果を変えない。
    this.incrementStudyMeasurement(
      outcome === 'SUPPORTED'
        ? { supportedPromotions: 1 }
        : outcome === 'DEVICE_VERIFIED'
          ? { deviceVerifiedPromotions: 1 }
          : outcome === 'CONTRADICTED'
            ? { contradictedPromotions: 1 }
            : stale
              ? { unresolvedStale: 1 }
              : admissible.length === 0
                ? { unresolvedNoAdmissible: 1 }
                : { unresolvedClusterShortage: 1 },
    );

    // P463: 判定の根拠を Claim 単位で読み返せる台帳に残す（従来は
    // ログと集計カウンタしか残らなかった）。台帳の失敗は判定を変えない。
    try {
      const ledgerKey = 'miki_claim_verification_ledger_v1';
      const rawLedger = storageService.getItem(ledgerKey);
      const parsedLedger: unknown = rawLedger ? JSON.parse(rawLedger) : [];
      const entries: unknown[] = Array.isArray(parsedLedger) ? parsedLedger : [];
      entries.push({
        claimId: claim.claim_id,
        outcome,
        reasons: [...reasons],
        evidenceIds: admissible.map((e) => e.evidence_id),
        independentClusters: independentClusters.size,
        hasPrimaryOrOfficialSource,
        contradictionCount,
        stale,
        verifiedAt: Date.now(),
      });
      storageService.setItem(ledgerKey, JSON.stringify(entries.slice(-300)));
    } catch { /* 台帳は補助記録 */ }

    claimVerificationEventService.publish({
      claimId: claim.claim_id,
      outcome,
      promoted,
      verifiedAt: Date.now(),
      reasons: [...reasons],
    });

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
      hasPrimaryOrOfficialSource,
    };
  }

  public verifyMany(params: {
    claimIds: string[];
    requireFresh?: boolean;
    maxAgeDays?: number;
  }): VerificationResult[] {
    return params.claimIds.map((claimId) =>
      this.verifyClaim({
        claimId,
        requireFresh: params.requireFresh,
        maxAgeDays: params.maxAgeDays,
      })
    );
  }

  // P440 D5: 勉強の測定値の累計。数値だけを置く。
  private incrementStudyMeasurement(patch: Record<string, number>): void {
    try {
      const raw = storageService.getItem(STUDY_MEASUREMENT_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      const current: Record<string, number> =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, number>)
          : {};
      const next: Record<string, number> = { ...current };
      for (const [key, value] of Object.entries(patch)) {
        const base = typeof next[key] === 'number' ? next[key] : 0;
        next[key] = base + value;
      }
      next.updatedAt = Date.now();
      storageService.setItem(STUDY_MEASUREMENT_KEY, JSON.stringify(next));
    } catch {
      // 測定の永続化失敗は検証結果を変えない。
    }
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
