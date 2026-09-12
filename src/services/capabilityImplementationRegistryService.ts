import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

/** 第91/96章: 能力と実現方式を分離するための機械可読レジストリ。 */
export type CapabilityImplementationMode =
  | 'NO_LLM'
  | 'CLASSIFIER_ONLY'
  | 'RETRIEVAL_TEMPLATE'
  | 'SYMBOLIC_SOLVER'
  | 'SPECIALIST_MODEL';

export interface CapabilityImplementationRecord {
  capabilityId: string;
  implementationId: string;
  mode: CapabilityImplementationMode;
  entryPoint: string;
  inputContract: string;
  outputContract: string;
  deterministic: boolean;
  sideEffectClass: 'READ_ONLY' | 'LOCAL_WRITE' | 'NETWORK' | 'PROCESS_EXECUTION' | 'PRIVILEGED';
  requiresLlm: boolean;
  enabled: boolean;
  priority: number;
  scope: string[];
  evidenceIds: string[];
  observedRuns: number;
  successfulRuns: number;
  lastObservedAt?: number;
}

const KEY = 'miki_capability_implementation_registry_v1';

export class CapabilityImplementationRegistryService {
  private records = new Map<string, CapabilityImplementationRecord>();
  constructor() { this.load(); this.seedDefaults(); }

  private load() {
    try {
      const raw = storageService.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) for (const r of parsed) if (r?.capabilityId && r?.implementationId) this.records.set(this.key(r.capabilityId, r.implementationId), r);
    } catch { /* fail closed: defaults are re-created */ }
  }
  private save() { storageService.setItem(KEY, JSON.stringify([...this.records.values()])); }
  private key(c: string, i: string) { return `${c}::${i}`; }

  private seedDefaults() {
    const defaults: CapabilityImplementationRecord[] = [
      { capabilityId: 'dialogue.act.classification', implementationId: 'dialogue_act_rules', mode: 'NO_LLM', entryPoint: 'conversationStateService.classifyDialogueAct', inputContract: 'string', outputContract: 'DialogueAct', deterministic: true, sideEffectClass: 'READ_ONLY', requiresLlm: false, enabled: true, priority: 100, scope: ['known_patterns'], evidenceIds: [], observedRuns: 0, successfulRuns: 0 },
      { capabilityId: 'request.type.compilation', implementationId: 'request_type_compiler', mode: 'NO_LLM', entryPoint: 'requestTypeCompilerService.compile', inputContract: 'string+ConversationState', outputContract: 'CompiledRequestType', deterministic: true, sideEffectClass: 'READ_ONLY', requiresLlm: false, enabled: true, priority: 100, scope: ['known_domains'], evidenceIds: [], observedRuns: 0, successfulRuns: 0 },
      { capabilityId: 'answer.surface.generation', implementationId: 'answer_ir_surface', mode: 'RETRIEVAL_TEMPLATE', entryPoint: 'answerContentIrService.generateSurfaceTextFromIR', inputContract: 'AnswerContentIR', outputContract: 'string', deterministic: true, sideEffectClass: 'READ_ONLY', requiresLlm: false, enabled: true, priority: 100, scope: ['structured_answer'], evidenceIds: [], observedRuns: 0, successfulRuns: 0 },
      { capabilityId: 'code.component.composition', implementationId: 'component_composition', mode: 'NO_LLM', entryPoint: 'componentCompositionService.composeFromCapabilityPlan', inputContract: 'CapabilityPlan', outputContract: 'CompositionPlan', deterministic: true, sideEffectClass: 'READ_ONLY', requiresLlm: false, enabled: true, priority: 100, scope: ['verified_components'], evidenceIds: [], observedRuns: 0, successfulRuns: 0 },
      { capabilityId: 'constraint.solving', implementationId: 'formal_constraint_solver', mode: 'SYMBOLIC_SOLVER', entryPoint: 'formalConstraintSolverService', inputContract: 'ConstraintProblem', outputContract: 'ConstraintSolution', deterministic: true, sideEffectClass: 'READ_ONLY', requiresLlm: false, enabled: true, priority: 100, scope: ['formal_constraints'], evidenceIds: [], observedRuns: 0, successfulRuns: 0 },
    ];
    let changed = false;
    for (const r of defaults) {
      const k = this.key(r.capabilityId, r.implementationId);
      if (!this.records.has(k)) { this.records.set(k, r); changed = true; }
    }
    if (changed) this.save();
  }

  register(record: CapabilityImplementationRecord): void {
    this.records.set(this.key(record.capabilityId, record.implementationId), { ...record, evidenceIds: [...new Set(record.evidenceIds)] });
    this.save();
  }
  list(capabilityId?: string): CapabilityImplementationRecord[] {
    return [...this.records.values()].filter(r => !capabilityId || r.capabilityId === capabilityId);
  }
  get(capabilityId: string, implementationId: string) { return this.records.get(this.key(capabilityId, implementationId)); }

  /** 実測なしで品質優位を捏造しない。実績が同点なら安全・決定論・高優先度を優先する。 */
  select(capabilityId: string, options: { allowLlm?: boolean; requireDeterministic?: boolean } = {}): CapabilityImplementationRecord | undefined {
    const candidates = this.list(capabilityId).filter(r => r.enabled && (options.allowLlm !== false || !r.requiresLlm) && (!options.requireDeterministic || r.deterministic));
    candidates.sort((a, b) => {
      const ar = a.observedRuns ? a.successfulRuns / a.observedRuns : -1;
      const br = b.observedRuns ? b.successfulRuns / b.observedRuns : -1;
      return Number(b.deterministic) - Number(a.deterministic) || br - ar || b.priority - a.priority || a.implementationId.localeCompare(b.implementationId);
    });
    return candidates[0];
  }

  recordObservation(capabilityId: string, implementationId: string, success: boolean, evidenceId?: string): void {
    const r = this.get(capabilityId, implementationId); if (!r) return;
    r.observedRuns += 1; if (success) r.successfulRuns += 1; r.lastObservedAt = Date.now();
    if (evidenceId) r.evidenceIds = [...new Set([...r.evidenceIds, evidenceId])];
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[第91章 Capability Registry] ${capabilityId}/${implementationId}: ${success ? 'PASS' : 'FAIL'}`);
  }
}
export const capabilityImplementationRegistryService = new CapabilityImplementationRegistryService();
