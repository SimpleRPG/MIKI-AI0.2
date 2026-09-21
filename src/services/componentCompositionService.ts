import { ComponentTxtPackage } from '../types';
import { capabilityGraphService, ComponentPlan } from './capabilityGraphService';
import { componentRegistryService } from './componentRegistryService';
import { systemLogger } from './systemLogger';

export type CompositionFailurePolicy = 'STOP' | 'RETRY_ONCE' | 'SKIP_OPTIONAL';

export interface CompositionStep {
  step_id: string;
  order: number;
  component_id: string;
  entry_point: string;
  input_types: string[];
  output_types: string[];
  consumes_from: string[];
  dependency_ids: string[];
  failure_policy: CompositionFailurePolicy;
  rollback_safe: boolean;
}

export interface CompositionPlan {
  plan_id: string;
  goal: string;
  capability_plan_id?: string;
  steps: CompositionStep[];
  verified: boolean;
  executable: boolean;
  score: number;
  reasons: string[];
  blocked_reason?: string;
}

/**
 * 能力グラフの候補を、実際にA→B→Cとして扱える実行計画へ変換する。
 * ここでは自然言語の推測でI/Oを作らず、Registryに登録された型だけを使う。
 */
export class ComponentCompositionService {
  private static instance: ComponentCompositionService;
  private constructor() {}

  public static getInstance(): ComponentCompositionService {
    if (!this.instance) this.instance = new ComponentCompositionService();
    return this.instance;
  }

  public compose(goal: string, maxComponents = 4, excludedComponentIds: string[] = [], environment?: string): CompositionPlan | undefined {
    const capabilityPlan = capabilityGraphService.plan(goal, maxComponents, excludedComponentIds, environment);
    if (!capabilityPlan) return undefined;
    return this.composeFromCapabilityPlan(goal, capabilityPlan);
  }

  /**
   * Task Case Memoryが示した「既に成功した部品集合」を再利用する。
   * 推奨順序は記憶を尊重するが、実行前に現在のVERIFIED/I-O/依存条件を再検証する。
   */
  public composeFromComponentIds(goal: string, componentIds: string[], environment?: string): CompositionPlan | undefined {
    const uniqueIds = [...new Set(componentIds)];
    if (!uniqueIds.length) return undefined;
    const components = uniqueIds
      .map(id => componentRegistryService.getComponent(id))
      .filter((c): c is ComponentTxtPackage => Boolean(c));
    if (components.length !== uniqueIds.length || !components.every(c => c.status === 'VERIFIED')) return undefined;
    if (environment && !components.every(c => this.supportsEnvironment(c, environment))) return undefined;
    if (!components.every(c => c.implementation_hash)) return undefined;
    const ordered = this.orderByDependenciesAndDataFlow(components);
    if (!ordered) return undefined;
    const steps: CompositionStep[] = ordered.map((component, index) => {
      const previous = ordered.slice(0, index);
      const consumes = previous.filter(p => this.matchTypes(p, component).length > 0).map(p => p.component_id);
      const deps = (component.dependencies || []).filter(dep => ordered.some(p => p.component_id === dep));
      return {
        step_id: `STEP-${this.hash(`CASE|${goal}|${component.component_id}|${index}`)}`,
        order: index + 1, component_id: component.component_id, entry_point: component.entry_point,
        input_types: (component.inputs || []).map(x => x.type), output_types: (component.outputs || []).map(x => x.type),
        consumes_from: consumes, dependency_ids: deps, failure_policy: this.failurePolicy(component), rollback_safe: this.isRollbackSafe(component),
      };
    });
    const planId = `CASEPLAN-${this.hash(`${goal}|${ordered.map(c => c.component_id).join('|')}`)}`;
    return { plan_id: planId, goal, capability_plan_id: undefined, steps, verified: true, executable: true,
      score: ordered.length * 100, reasons: ['Task Case Memoryの成功経路を再利用し、実行前に現在のVERIFIED/I-O/依存条件を再検証しました。'] };
  }

  public composeFromCapabilityPlan(goal: string, capabilityPlan: ComponentPlan): CompositionPlan {
    const components = capabilityPlan.component_ids
      .map(id => componentRegistryService.getComponent(id))
      .filter((c): c is ComponentTxtPackage => Boolean(c));

    const reasons = [...capabilityPlan.reasons];
    const verified = components.length === capabilityPlan.component_ids.length &&
      components.every(c => c.status === 'VERIFIED');

    if (!verified) {
      return this.blocked(goal, capabilityPlan, 'VERIFIED部品だけで計画を構成できません。');
    }

    const ordered = this.orderByDependenciesAndDataFlow(components);
    if (!ordered) {
      return this.blocked(goal, capabilityPlan, '依存関係またはI/O型から安全な実行順序を決定できません。');
    }

    const steps: CompositionStep[] = ordered.map((component, index) => {
      const previous = ordered.slice(0, index);
      const consumes = previous
        .filter(p => this.matchTypes(p, component).length > 0)
        .map(p => p.component_id);
      const deps = (component.dependencies || []).filter(dep =>
        ordered.some(p => p.component_id === dep)
      );

      return {
        step_id: `STEP-${this.hash(`${capabilityPlan.plan_id}|${component.component_id}|${index}`)}`,
        order: index + 1,
        component_id: component.component_id,
        entry_point: component.entry_point,
        input_types: (component.inputs || []).map(x => x.type),
        output_types: (component.outputs || []).map(x => x.type),
        consumes_from: consumes,
        dependency_ids: deps,
        failure_policy: this.failurePolicy(component),
        rollback_safe: this.isRollbackSafe(component),
      };
    });

    // 複数部品の場合は、各段階が前段の出力または明示依存を持つことを要求する。
    // 「同じ分野だから」という理由だけで直列実行可能とはしない。
    for (let i = 1; i < ordered.length; i++) {
      const current = ordered[i];
      const previous = ordered.slice(0, i);
      const hasFlow = previous.some(p => this.matchTypes(p, current).length > 0);
      const hasDependency = (current.dependencies || []).some(dep =>
        previous.some(p => p.component_id === dep)
      );
      if (!hasFlow && !hasDependency) {
        return this.blocked(goal, capabilityPlan, `${current.component_id}への入力供給経路がありません。`);
      }
    }

    const planId = `CMP-${this.hash(`${goal}|${steps.map(s => s.component_id).join('>')}`)}`;
    const result: CompositionPlan = {
      plan_id: planId,
      goal,
      capability_plan_id: capabilityPlan.plan_id,
      steps,
      verified,
      executable: true,
      score: capabilityPlan.score,
      reasons,
    };
    systemLogger.info('TOOLS', `🔗 [Composition] ${planId}: ${steps.map(s => s.component_id).join(' → ')}`);
    return result;
  }

  private orderByDependenciesAndDataFlow(components: ComponentTxtPackage[]): ComponentTxtPackage[] | undefined {
    const remaining = new Map(components.map(c => [c.component_id, c]));
    const ordered: ComponentTxtPackage[] = [];

    while (remaining.size) {
      const ready = [...remaining.values()].filter(c => {
        const deps = c.dependencies || [];
        return deps.every(dep => !remaining.has(dep));
      });
      if (!ready.length) return undefined;

      // まず「現在までに得られた出力を入力として消費できる部品」を優先。
      ready.sort((a, b) => {
        const aFlow = ordered.some(p => this.matchTypes(p, a).length > 0) ? 1 : 0;
        const bFlow = ordered.some(p => this.matchTypes(p, b).length > 0) ? 1 : 0;
        return bFlow - aFlow || a.component_id.localeCompare(b.component_id);
      });

      const next = ready[0];
      ordered.push(next);
      remaining.delete(next.component_id);
    }
    return ordered;
  }

  private supportsEnvironment(c: ComponentTxtPackage, environment: string): boolean {
    const declared = (c.supported_environments || []).map(v => String(v).trim().toLowerCase()).filter(Boolean);
    if (!declared.length) return true;
    const matches = (patterns: RegExp[]) => declared.some(value => patterns.some(pattern => pattern.test(value)));
    switch (environment.trim().toLowerCase()) {
      case 'android': return matches([/\bandroid\b/, /galaxy/]);
      case 'termux': return matches([/\btermux\b/, /\bandroid\b/]);
      case 'excel_windows': return matches([/\bwindows\b/, /excel/]) && !matches([/\bmac(?:os)?\b/]);
      case 'excel_mac': return matches([/\bmac(?:os)?\b/, /excel/]);
      case 'external_runner': return matches([/external/, /runner/, /http/]);
      default: return declared.includes(environment.trim().toLowerCase());
    }
  }

  private matchTypes(from: ComponentTxtPackage, to: ComponentTxtPackage): string[] {
    const outputs = new Set((from.outputs || []).map(x => x.type.toLowerCase()));
    return (to.inputs || []).map(x => x.type.toLowerCase()).filter(t => outputs.has(t));
  }

  private failurePolicy(c: ComponentTxtPackage): CompositionFailurePolicy {
    const text = `${c.failure_behavior || ''} ${(c.side_effects || []).join(' ')}`.toLowerCase();
    if (c.idempotent && c.deterministic && !/delete|write|send|publish|external/i.test(text)) return 'RETRY_ONCE';
    return 'STOP';
  }

  private isRollbackSafe(c: ComponentTxtPackage): boolean {
    const sideEffects = (c.side_effects || []).join(' ').toLowerCase();
    return c.idempotent === true && !/delete|overwrite|send|publish|irreversible|external/i.test(sideEffects);
  }

  private blocked(goal: string, capabilityPlan: ComponentPlan, reason: string): CompositionPlan {
    const planId = `CMP-BLOCKED-${this.hash(`${goal}|${capabilityPlan.plan_id}|${reason}`)}`;
    systemLogger.warn('TOOLS', `🔒 [Composition] ${planId}: ${reason}`);
    return {
      plan_id: planId,
      goal,
      capability_plan_id: capabilityPlan.plan_id,
      steps: [],
      verified: false,
      executable: false,
      score: capabilityPlan.score,
      reasons: capabilityPlan.reasons,
      blocked_reason: reason,
    };
  }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const componentCompositionService = ComponentCompositionService.getInstance();
