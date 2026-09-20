import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { evidenceService, type EvidenceRecord } from '../../memory/services/evidenceService';
import { verifierService, type VerificationResult } from '../../verification/services/verifierService';

export interface ClaimEvidenceAssessment {
  sentence: string;
  claimId?: string;
  evidenceIds: string[];
  independentEvidenceCount: number;
  admissibleEvidenceCount: number;
  outcome: VerificationResult['outcome'] | 'UNREGISTERED';
  reasons: string[];
}

/** Claim/Evidenceの解析窓口。保存・昇格の権限は既存ClaimDB/Evidence/Verifierへ委譲する。 */
export class ClaimEvidenceService {
  public extractClaimSentences(text: string): string[] {
    return String(text || '')
      .split(/(?<=[。！？!?])\s*|\n+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 8 && /[。！？!?]|だ$|です$|ます$|である$/.test(sentence));
  }

  public assessSentence(sentence: string, evidenceIds?: string[]): ClaimEvidenceAssessment {
    const target = String(sentence || '').trim();
    const evidence = evidenceIds?.length
      ? evidenceService.list().filter((record) => evidenceIds.includes(record.evidence_id))
      : evidenceService.list().filter((record) => record.snippet.includes(target.slice(0, Math.min(24, target.length))));
    const linkedClaimIds = [...new Set(evidence.flatMap((record) => record.claim_ids))];
    const claimId = linkedClaimIds[0];
    if (!claimId) {
      return {
        sentence: target,
        evidenceIds: evidence.map((record) => record.evidence_id),
        independentEvidenceCount: new Set(evidence.map((record) => record.independence_cluster_id)).size,
        admissibleEvidenceCount: evidence.filter((record) => record.status === 'ADMISSIBLE').length,
        outcome: 'UNREGISTERED',
        reasons: ['既存Evidenceに紐づくClaimがありません。'],
      };
    }

    const verification = verifierService.verifyClaim({ claimId });
    const claim = claimDatabaseService.getClaim(claimId);
    const admissible: EvidenceRecord[] = evidence.filter((record) => record.status === 'ADMISSIBLE');
    return {
      sentence: target,
      claimId,
      evidenceIds: evidence.map((record) => record.evidence_id),
      independentEvidenceCount: new Set(admissible.map((record) => record.independence_cluster_id)).size,
      admissibleEvidenceCount: admissible.length,
      outcome: verification.outcome,
      reasons: [
        ...verification.reasons,
        claim?.status ? `ClaimStatus=${claim.status}` : '',
      ].filter(Boolean),
    };
  }
}

export const claimEvidenceService = new ClaimEvidenceService();
