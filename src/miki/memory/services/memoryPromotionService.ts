import { MemoryItem } from '../../../types';
import { TaskCaseRecord } from './taskCaseMemoryService';
import { longTermMemoryService } from './longTermMemoryService';
import { systemLogger } from '../../../services/systemLogger';

import { strictMemoryPromotionGateService } from './strictMemoryPromotionGateService';
/**
 * 実行ケース→長期記憶の境界。
 * 「実行に成功した」という事実を世界知識へ変換せず、同じ要求で
 * 安定して再利用できた手順だけを procedural / episodic memory として提案する。
 */
export class MemoryPromotionService {
  private static instance: MemoryPromotionService;
  private constructor() {}
  public static getInstance(): MemoryPromotionService {
    return this.instance || (this.instance = new MemoryPromotionService());
  }

  public shouldPromote(taskCase: TaskCaseRecord): boolean {
    return taskCase.outcome === 'SUCCESS' && taskCase.maturity === 'STABLE' && taskCase.component_ids.length > 0;
  }

  public createCandidate(taskCase: TaskCaseRecord, existing: MemoryItem[]): MemoryItem | undefined {
    if (!this.shouldPromote(taskCase)) return undefined;
    const sourceRef = `task_case:${taskCase.case_id}`;
    if (existing.some(m => m.sourceRef === sourceRef && m.active !== false)) return undefined;

    const content = `実行手順（検証済みケース）: 「${taskCase.goal}」では ${taskCase.component_ids.join(' → ')} の構成が ${taskCase.environment} 環境で安定して成功した。実装hashはケース記録を参照し、変更時は再検証する。`;
    const now = Date.now();
    const candidate: MemoryItem = {
      id: `mem_case_${taskCase.case_id}`,
      category: 'code',
      content,
      importance: 4,
      pinned: false,
      active: true,
      approved: false,
      source: 'auto_reflection',
      sourceRef,
      rawExcerpt: content,
      tags: ['task_case', 'procedural', 'verified_reuse', taskCase.environment],
      memoryType: 'procedural',
      memoryScope: 'long_term',
      longTermType: 'general_rule',
      lifecycleStatus: 'CANDIDATE',
      destination: 'long_term_memory',
      projectScopeId: undefined,
      createdAt: now,
      updatedAt: now,
      useCount: 0,
      heat: 0.7,
    };

    const decision = strictMemoryPromotionGateService.evaluate(candidate, {
      evidenceIds: [taskCase.case_id],
      independentContextCount: candidate.independentSuccessContextCount || 0,
      validationSuccessCount: candidate.validationSuccessCount || 0,
      validationFailureCount: candidate.validationFailureCount || 0,
      unresolvedConflictCount: (candidate.conflictWith || []).length,
      sourceVerified: Boolean(candidate.sourceRef),
    });
    if (!decision.allowed) {
      systemLogger.info('TOOLS', `🧠 [MemoryPromotion] candidate retained without promotion: ${decision.reasons.join(',')}`);
      return candidate;
    }
    const promoted = { ...candidate, approved: true, lifecycleStatus: 'APPROVED' as const };
    const linked = longTermMemoryService.autoLinkRelatedMemories(promoted, existing);
    systemLogger.info('TOOLS', `🧠 [MemoryPromotion] strict gate passed: ${taskCase.case_id}`);
    return linked.updatedTarget;
  }
}

export const memoryPromotionService = MemoryPromotionService.getInstance();
