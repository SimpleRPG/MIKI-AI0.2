import type { MemoryItem } from '../../../types';
import { storageService } from '../../../services/storageService';
import { isMemoryEligible, type MemoryUsePurpose } from './memoryEligibilityPolicyService';

export interface MemoryMetricDelta {
  retrievalCount?: number;
  usageCount?: number;
  executionSuccessCount?: number;
  validationSuccessCount?: number;
  validationFailureCount?: number;
  positiveFeedbackEvidenceCount?: number;
  negativeFeedbackEvidenceCount?: number;
  correctionEvidenceCount?: number;
  independentSuccessContextCount?: number;
}

function add(base: number | undefined, delta: number | undefined): number | undefined {
  if (delta === undefined) return base;
  return Math.max(0, (base || 0) + delta);
}

class MemoryRecordRepositoryService {
  public listAll(): MemoryItem[] { return storageService.getMemories(); }
  public getById(id: string): MemoryItem | undefined { return this.listAll().find(memory => memory.id === id); }
  public listEligible(purpose: MemoryUsePurpose): MemoryItem[] { return this.listAll().filter(memory => isMemoryEligible(memory, purpose)); }
  public upsert(memory: MemoryItem): void { storageService.saveMemoryItem(memory); }
  public remove(id: string): void { storageService.deleteMemoryItem(id); }
  public recordMetrics(id: string, delta: MemoryMetricDelta): MemoryItem | undefined {
    const memory = this.getById(id);
    if (!memory) return undefined;
    const updated: MemoryItem = {
      ...memory,
      retrievalCount: add(memory.retrievalCount, delta.retrievalCount),
      usageCount: add(memory.usageCount, delta.usageCount),
      executionSuccessCount: add(memory.executionSuccessCount, delta.executionSuccessCount),
      validationSuccessCount: add(memory.validationSuccessCount, delta.validationSuccessCount),
      validationFailureCount: add(memory.validationFailureCount, delta.validationFailureCount),
      positiveFeedbackEvidenceCount: add(memory.positiveFeedbackEvidenceCount, delta.positiveFeedbackEvidenceCount),
      negativeFeedbackEvidenceCount: add(memory.negativeFeedbackEvidenceCount, delta.negativeFeedbackEvidenceCount),
      correctionEvidenceCount: add(memory.correctionEvidenceCount, delta.correctionEvidenceCount),
      independentSuccessContextCount: add(memory.independentSuccessContextCount, delta.independentSuccessContextCount),
      lastUsedAt: delta.usageCount || delta.retrievalCount ? Date.now() : memory.lastUsedAt,
      lastValidatedAt: delta.validationSuccessCount || delta.validationFailureCount ? Date.now() : memory.lastValidatedAt,
      updatedAt: Date.now(),
    };
    this.upsert(updated);
    return updated;
  }
  public backend(): 'sqlite' | 'indexeddb' | 'memory' { return storageService.getBackendName(); }
  public async flush(): Promise<void> { await storageService.flushNow(); }
}
export const memoryRecordRepositoryService = new MemoryRecordRepositoryService();
