import { evidenceService } from './evidenceService';
import { claimDatabaseService } from './claimDatabaseService';
import { knowledgeOperatingSystemService, KnowledgeObject } from './knowledgeOperatingSystemService';
import { systemLogger } from './systemLogger';

/** Chapter 55/57/62: research evidence -> claim -> Knowledge OS bridge.
 * Search is never treated as truth. Only existing admissible evidence/claims are mirrored.
 */
class CognitiveEvidenceIntegrationService {
  ingestClaim(claimId: string): KnowledgeObject | undefined {
    const claim = claimDatabaseService.getClaim(claimId);
    if (!claim) return undefined;
    const evidence = evidenceService.list({ claimId }).filter(e => e.status !== 'REJECTED');
    if (!evidence.length) return undefined;

    const id = `CLAIM-${claimId}`;
    const existing = knowledgeOperatingSystemService.get(id);
    const object = existing || knowledgeOperatingSystemService.register({
      id,
      type: 'CLAIM',
      title: claim.statement.slice(0, 120),
      content: claim.statement,
      sourceIds: evidence.map(e => e.source_id || e.url || e.evidence_id),
      evidenceIds: evidence.map(e => e.evidence_id),
      dependsOn: [], replaces: [], conditions: [],
      confidence: claim.status === 'SUPPORTED' || claim.status === 'DEVICE_VERIFIED' ? 1 : 0,
      freshness: 1,
      metadata: { claimStatus: claim.status, sourceCount: evidence.length },
    });

    if (existing) {
      for (const e of evidence) knowledgeOperatingSystemService.link(id, e.evidence_id, 'SUPPORTED_BY');
    }
    systemLogger.info('SELF_IMPROVEMENT', `[Chapter 62] Claim→KOS同期: ${claimId}`);
    return object;
  }

  ingestClaims(claimIds: string[]): KnowledgeObject[] {
    return claimIds.map(id => this.ingestClaim(id)).filter((x): x is KnowledgeObject => Boolean(x));
  }
}
export const cognitiveEvidenceIntegrationService = new CognitiveEvidenceIntegrationService();
