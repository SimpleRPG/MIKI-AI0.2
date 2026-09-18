import type { MemoryItem, MemoryType, MemoryDestination } from '../../../types';
import { storageService } from '../../../services/storageService';
import { experienceRouterService } from '../../experience/services/experienceRouterService';
import { longTermMemoryService } from '../../memory/services/longTermMemoryService';
import { embeddingService } from '../../research/services/embeddingService';
import { memoryAuditService } from '../../memory/services/memoryAuditService';
import { selfImprovementService } from '../../improvement/services/selfImprovementService';

export type { EmbeddingStats } from '../../research/services/embeddingService';
export type { MemoryAuditCycleRecord } from '../../memory/services/memoryAuditService';

class TypedMemoryUiGatewayService {
  getMemories(): MemoryItem[] { return storageService.getMemories(); }
  setMemories(memories: MemoryItem[]): void { storageService.setMemories(memories); }
  saveMemoryItem(memory: MemoryItem): void { storageService.saveMemoryItem(memory); }
  deleteMemoryItem(id: string): void { storageService.deleteMemoryItem(id); }
  batchDeleteMemories(ids: string[]): void { storageService.batchDeleteMemories(ids); }
  getApprovedMemories(): MemoryItem[] { return storageService.getApprovedMemories(); }
  getUnapprovedMemories(): MemoryItem[] { return storageService.getUnapprovedMemories(); }
  getConflictedMemories(): MemoryItem[] { return storageService.getConflictedMemories(); }
  getQuarantinedMemories(): MemoryItem[] { return storageService.getQuarantinedMemories(); }
  getDiscardCandidateMemories(): MemoryItem[] { return storageService.getDiscardCandidateMemories(); }
  getProjectMemories(): MemoryItem[] { return storageService.getProjectMemories(); }
  getMemoriesByDestination(destination: MemoryDestination): MemoryItem[] { return storageService.getMemoriesByDestination(destination); }
  getMemoriesByType(type: MemoryType): MemoryItem[] { return storageService.getMemoriesByType(type); }
  resolveConflict(id: string): void { storageService.resolveConflict(id); }
  dismissConflict(id: string): void { storageService.dismissConflict(id); }

  applyRoutingToMemory(...args: Parameters<typeof experienceRouterService.applyRoutingToMemory>): ReturnType<typeof experienceRouterService.applyRoutingToMemory> {
    return experienceRouterService.applyRoutingToMemory(...args);
  }
  exportToRegressionBenchmark(...args: Parameters<typeof experienceRouterService.exportToRegressionBenchmark>): ReturnType<typeof experienceRouterService.exportToRegressionBenchmark> {
    return experienceRouterService.exportToRegressionBenchmark(...args);
  }
  exportToSkill(...args: Parameters<typeof experienceRouterService.exportToSkill>): ReturnType<typeof experienceRouterService.exportToSkill> {
    return experienceRouterService.exportToSkill(...args);
  }
  markForDiscard(...args: Parameters<typeof experienceRouterService.markForDiscard>): ReturnType<typeof experienceRouterService.markForDiscard> {
    return experienceRouterService.markForDiscard(...args);
  }
  promoteFromQuarantine(...args: Parameters<typeof experienceRouterService.promoteFromQuarantine>): ReturnType<typeof experienceRouterService.promoteFromQuarantine> {
    return experienceRouterService.promoteFromQuarantine(...args);
  }
  unmarkDiscard(...args: Parameters<typeof experienceRouterService.unmarkDiscard>): ReturnType<typeof experienceRouterService.unmarkDiscard> {
    return experienceRouterService.unmarkDiscard(...args);
  }

  getSubstitutionChain(...args: Parameters<typeof longTermMemoryService.getSubstitutionChain>): ReturnType<typeof longTermMemoryService.getSubstitutionChain> {
    return longTermMemoryService.getSubstitutionChain(...args);
  }
  searchPipeline(...args: Parameters<typeof longTermMemoryService.searchPipeline>): ReturnType<typeof longTermMemoryService.searchPipeline> {
    return longTermMemoryService.searchPipeline(...args);
  }
  supersedeMemory(...args: Parameters<typeof longTermMemoryService.supersedeMemory>): ReturnType<typeof longTermMemoryService.supersedeMemory> {
    return longTermMemoryService.supersedeMemory(...args);
  }

  getEmbeddingStats(): ReturnType<typeof embeddingService.getStats> { return embeddingService.getStats(); }
  ensureMemoryEmbedding(...args: Parameters<typeof embeddingService.ensureMemoryEmbedding>): ReturnType<typeof embeddingService.ensureMemoryEmbedding> {
    return embeddingService.ensureMemoryEmbedding(...args);
  }
  syncMemoryEmbeddings(...args: Parameters<typeof embeddingService.syncMemoriesEmbeddings>): ReturnType<typeof embeddingService.syncMemoriesEmbeddings> {
    return embeddingService.syncMemoriesEmbeddings(...args);
  }
  runMemoryAudit(...args: Parameters<typeof memoryAuditService.runFullAuditCycle>): ReturnType<typeof memoryAuditService.runFullAuditCycle> {
    return memoryAuditService.runFullAuditCycle(...args);
  }
  getTrainingSamples(): ReturnType<typeof selfImprovementService.getTrainingSamples> { return selfImprovementService.getTrainingSamples(); }
}

export const typedMemoryUiGatewayService = new TypedMemoryUiGatewayService();
