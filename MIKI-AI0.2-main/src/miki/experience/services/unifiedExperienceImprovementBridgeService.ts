import type { UnifiedExperienceDomain, UnifiedOutcome } from './unifiedMikiExperienceService';
import { unifiedMikiExperienceService } from './unifiedMikiExperienceService';

export interface UnifiedExperienceEnvelope {
  domain: UnifiedExperienceDomain;
  action: string;
  summary: string;
  outcome: UnifiedOutcome;
  verified: boolean;
  sourceFingerprint?: string;
  capabilityIds?: string[];
  concepts?: string[];
  lesson?: string;
}

class UnifiedExperienceImprovementBridgeService {
  ingest(input: UnifiedExperienceEnvelope) {
    return unifiedMikiExperienceService.observe({
      domain: input.domain,
      action: input.action,
      input: input.summary,
      outcome: input.outcome,
      verified: input.verified,
      sourceFingerprint: input.sourceFingerprint,
      capabilityIds: input.capabilityIds,
      lesson: input.lesson,
    });
  }
}

export const unifiedExperienceImprovementBridgeService = new UnifiedExperienceImprovementBridgeService();
