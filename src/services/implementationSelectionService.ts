import { CompiledRequestType } from '../types';
import { capabilityImplementationRegistryService, CapabilityImplementationMode } from './capabilityImplementationRegistryService';

export interface ImplementationSelection {
  mode: CapabilityImplementationMode;
  implementationId?: string;
  capabilityId: string;
  reason: string;
  fallbackAllowed: boolean;
}

/** 第91/96章: 「能力」から最小の実現方式を選ぶ。LLMを既定値にしない。 */
export class ImplementationSelectionService {
  select(request: CompiledRequestType): ImplementationSelection {
    const capabilityId = this.capabilityFor(request);
    const deterministic = request.canExecuteDeterministically;
    const candidate = capabilityImplementationRegistryService.select(capabilityId, { allowLlm: false, requireDeterministic: deterministic });
    if (candidate) return { mode: candidate.mode, implementationId: candidate.implementationId, capabilityId, reason: '既知かつ機械検証可能な経路が存在するため非LLM実装を優先', fallbackAllowed: false };
    return {
      mode: 'NO_LLM',
      implementationId: 'deterministic_unknown_gate',
      capabilityId,
      reason: '検証済みNon-LLM実装を特定できないため、推測生成せず未確定として停止する',
      fallbackAllowed: false,
    };
  }

  private capabilityFor(request: CompiledRequestType): string {
    if (request.category === 'CODE_SYNTHESIS') return 'code.component.composition';
    if (request.category === 'FACT_INQUIRY') return 'research.claim.answer';
    return 'answer.surface.generation';
  }
}
export const implementationSelectionService = new ImplementationSelectionService();
