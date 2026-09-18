import type { MemoryItem } from '../../../types';

export type MemoryUsePurpose = 'RETRIEVAL' | 'PROMPT' | 'CLOUD' | 'GRAPH' | 'SELF_IMPROVEMENT' | 'EXPORT';

export interface MemoryEligibilityResult {
  allowed: boolean;
  reasons: string[];
}

export function evaluateMemoryEligibility(memory: MemoryItem, purpose: MemoryUsePurpose, now = Date.now()): MemoryEligibilityResult {
  const reasons: string[] = [];
  if (memory.active === false) reasons.push('INACTIVE');
  if (memory.status === 'archived' || memory.status === 'deprecated') reasons.push('LIFECYCLE_BLOCKED');
  if (memory.lifecycleStatus === 'ARCHIVED' || memory.lifecycleStatus === 'REPLACED') reasons.push('LIFECYCLE_BLOCKED');
  if (memory.destination === 'quarantine') reasons.push('QUARANTINED');
  if (memory.destination === 'discard_candidate') reasons.push('DISCARD_CANDIDATE');
  if (memory.expiresAt !== undefined && memory.expiresAt < now) reasons.push('EXPIRED');
  if (memory.replacedBy) reasons.push('SUPERSEDED');
  if (memory.pendingVerificationDiff) reasons.push('PENDING_REVALIDATION');
  if (purpose !== 'RETRIEVAL' && memory.approved !== true) reasons.push('NOT_APPROVED');
  if ((purpose === 'PROMPT' || purpose === 'CLOUD' || purpose === 'SELF_IMPROVEMENT') && memory.factStatus === 'fictional') reasons.push('FICTIONAL');
  if ((purpose === 'PROMPT' || purpose === 'CLOUD') && memory.factStatus === 'unverified') reasons.push('UNVERIFIED_FACT');
  return { allowed: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function isMemoryEligible(memory: MemoryItem, purpose: MemoryUsePurpose, now = Date.now()): boolean {
  return evaluateMemoryEligibility(memory, purpose, now).allowed;
}
