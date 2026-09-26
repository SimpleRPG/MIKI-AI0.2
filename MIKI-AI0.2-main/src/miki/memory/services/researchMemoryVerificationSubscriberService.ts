import type { MemoryItem } from '../../../types';
import { storageService } from '../../../services/storageService';
import { claimDatabaseService } from '../../../services/claimDatabaseService';
import { systemLogger } from '../../../services/systemLogger';
import {
  claimVerificationEventService,
  type ClaimVerificationEvent,
} from '../../verification/services/claimVerificationEventService';

type ResearchMemoryVerificationStatus =
  | 'VERIFIED'
  | 'CONTRADICTED'
  | 'UNVERIFIED';

class ResearchMemoryVerificationSubscriberService {
  private initialized = false;
  private unsubscribe?: () => void;

  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.unsubscribe = claimVerificationEventService.subscribe((event) => {
      this.reconcileClaim(event.claimId, event);
    });
  }

  public dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.initialized = false;
  }

  private reconcileClaim(
    claimIdInput: string,
    event: ClaimVerificationEvent,
  ): void {
    const claimId = String(claimIdInput || '').trim();
    if (!claimId) return;

    const memories = storageService.getMemories();
    let changedCount = 0;

    for (const memory of memories) {
      if (!this.isResearchCandidate(memory)) continue;

      const claimIds = this.stringArray(memory.claimIds);
      if (!claimIds.includes(claimId)) continue;

      const claims = claimIds.map((id) => claimDatabaseService.getClaim(id));
      const missingClaim = claims.some((claim) => !claim);

      const outcomes = Object.fromEntries(
        claimIds.map((id) => [
          id,
          claimDatabaseService.getClaim(id)?.status || 'MISSING',
        ]),
      );

      const statuses = claims
        .filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
        .map((claim) => claim.status);

      const contradictedClaimIds = claimIds.filter((id) => {
        const status = claimDatabaseService.getClaim(id)?.status;
        return status === 'CONTRADICTED' || status === 'FALSE';
      });

      const verified =
        !missingClaim &&
        statuses.length === claimIds.length &&
        statuses.every(
          (status) =>
            status === 'SUPPORTED' ||
            status === 'DEVICE_VERIFIED',
        );

      const verifiedAt = Number(event.verifiedAt || Date.now());

      memory.verificationAt = verifiedAt;
      memory.verificationOutcomes = outcomes;
      memory.updatedAt = Date.now();

      if (verified) {
        memory.approved = true;
        memory.active = true;
        memory.lifecycleStatus = 'APPROVED';
        memory.verificationStatus = 'VERIFIED';
        memory.verifiedAt = verifiedAt;
        delete memory.contradictionClaimIds;
      } else if (contradictedClaimIds.length > 0) {
        // 反証時は自動採用しない。候補として保持し、確定知識化を止める。
        memory.approved = false;
        memory.active = true;
        memory.lifecycleStatus = 'CANDIDATE';
        memory.verificationStatus = 'CONTRADICTED';
        memory.contradictionClaimIds = contradictedClaimIds;
      } else {
        // 未解決・証拠不足は候補のまま保持する。
        memory.approved = false;
        memory.active = true;
        memory.lifecycleStatus = 'CANDIDATE';
        memory.verificationStatus = 'UNVERIFIED';
        delete memory.verifiedAt;
        delete memory.contradictionClaimIds;
      }

      storageService.saveMemoryItem(memory);
      changedCount += 1;
    }

    if (changedCount > 0) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `[ResearchMemoryVerification] claim=${claimId} affected=${changedCount}`,
      );
    }
  }

  private isResearchCandidate(memory: MemoryItem): boolean {
    if (memory.active === false) return false;
    if (!memory.researchGapId) return false;
    if (memory.memoryScope !== 'long_term') return false;
    if (memory.memoryType !== 'semantic') return false;
    if (!Array.isArray(memory.claimIds) || memory.claimIds.length === 0) return false;

    return memory.lifecycleStatus === 'CANDIDATE';
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? [...new Set(value.map(String).map((value) => value.trim()).filter(Boolean))]
      : [];
  }
}

export const researchMemoryVerificationSubscriberService =
  new ResearchMemoryVerificationSubscriberService();

export function initializeResearchMemoryVerificationSubscriber(): void {
  researchMemoryVerificationSubscriberService.initialize();
}
