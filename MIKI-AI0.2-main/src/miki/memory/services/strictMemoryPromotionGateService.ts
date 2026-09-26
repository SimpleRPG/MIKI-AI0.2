import type { MemoryItem } from '../../../types';
import { evaluateMemoryEligibility } from './memoryEligibilityPolicyService';

export interface MemoryPromotionEvidence {
  evidenceIds: string[];
  independentContextCount: number;
  validationSuccessCount: number;
  validationFailureCount: number;
  unresolvedConflictCount: number;
  sourceVerified: boolean;
}

export interface MemoryPromotionDecision { allowed: boolean; reasons: string[]; }

class StrictMemoryPromotionGateService {
  public evaluate(memory: MemoryItem, evidence: MemoryPromotionEvidence): MemoryPromotionDecision {
    const reasons = evaluateMemoryEligibility({ ...memory, approved: true }, 'SELF_IMPROVEMENT').reasons.filter(reason => reason !== 'NOT_APPROVED');
    if (!memory.sourceRef && !memory.rawSourceId) reasons.push('SOURCE_REFERENCE_REQUIRED');
    if (!evidence.sourceVerified) reasons.push('SOURCE_NOT_VERIFIED');
    if (evidence.evidenceIds.length === 0) reasons.push('EVIDENCE_REQUIRED');
    if (evidence.independentContextCount < 2) reasons.push('INDEPENDENT_CONTEXTS_REQUIRED');
    if (evidence.validationSuccessCount < 2) reasons.push('VALIDATION_SUCCESSES_REQUIRED');
    if (evidence.validationFailureCount > 0) reasons.push('VALIDATION_FAILURE_PRESENT');
    if (evidence.unresolvedConflictCount > 0 || (memory.conflictWith || []).length > 0) reasons.push('UNRESOLVED_CONFLICT');
    if (memory.positiveFeedbackEvidenceCount && !memory.validationSuccessCount) reasons.push('USER_FEEDBACK_ONLY');
    return { allowed: reasons.length === 0, reasons: [...new Set(reasons)] };
  }
}
export const strictMemoryPromotionGateService = new StrictMemoryPromotionGateService();
