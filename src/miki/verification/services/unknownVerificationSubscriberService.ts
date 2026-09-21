import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { unknownKnowledgeIntegrationService } from '../../unknown/services/unknownKnowledgeIntegrationService';
import { unknownResolutionService } from '../../unknown/services/unknownResolutionService';
import { claimVerificationEventService } from './claimVerificationEventService';

let initialized = false;

export function initializeUnknownVerificationSubscriber(): void {
  if (initialized) return;
  initialized = true;

  claimVerificationEventService.subscribe((event) => {
    unknownKnowledgeIntegrationService.reconcileVerification(event.claimId);
    if (!event.promoted) return;

    const resolutions = unknownResolutionService
      .list(500)
      .filter((item: any) => item.claimIds && item.claimIds.includes(event.claimId));

    for (const resolution of resolutions) {
      for (const gapId of resolution.capabilityGapIds || []) {
        capabilityGapService.updateGapStatus(gapId, 'MITIGATED');
      }
      for (const gapId of resolution.knowledgeGapIds || []) {
        knowledgeGapService.markResolved(gapId);
      }
    }
  });
}

initializeUnknownVerificationSubscriber();
