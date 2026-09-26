import { unknownKnowledgeIntegrationService } from '../../unknown/services/unknownKnowledgeIntegrationService';
import { unknownResolutionService } from '../../unknown/services/unknownResolutionService';
import { claimVerificationEventService } from './claimVerificationEventService';

let initialized = false;

export function initializeUnknownVerificationSubscriber(): void {
  if (initialized) return;
  initialized = true;

  claimVerificationEventService.subscribe((event) => {
    unknownKnowledgeIntegrationService.reconcileVerification(event.claimId);
    return;
  });
}

initializeUnknownVerificationSubscriber();
