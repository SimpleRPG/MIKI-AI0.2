import { systemLogger } from '../../../services/systemLogger';
import { codeComponentSpecService } from './codeComponentSpecService';
import { generatedComponentVerificationRegistrationService } from './generatedComponentVerificationRegistrationService';
import type { SynthesizedComponent } from './atomicComponentTemplateSynthesisService';

/**
 * P919: コード生成・第3段の供給接続。P918 の部品仕様（不足の
 * 下書き）を宛先にして、実装とテストを受け取り、既存の検証・
 * 登録の門（generatedComponentVerificationRegistrationService）
 * へ通す。
 *
 * 門の判定は既存のまま：TS の構文・決定性（Date.now /
 * Math.random / fetch / eval の禁止）・契約の完全性を静的に
 * 検証し、通ればレジストリへ ANALYZED で登録される。
 * VERIFIED への昇格は実行証拠の蓄積が担う（この受け口では
 * 昇格しない）。静的検証に落ちた実装は登録されず、理由が
 * 返る。供給者は当面は教師（Muse）を想定するが、宛先と
 * 門は供給者に依存しない。
 */
export interface CodeComponentSupplyInput {
  capabilityId: string;
  componentId: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  preconditions: string[];
  postconditions: string[];
  securityClass?: 'READ_ONLY' | 'LOCAL_WRITE';
  implementation: string;
  tests: string;
}

export interface CodeComponentSupplyResult {
  accepted: boolean;
  reason: 'REGISTERED_ANALYZED' | 'STATIC_VERIFICATION_FAILED' | 'SPEC_NOT_FOUND';
  registeredStatus?: string;
  diagnostics: string[];
}

class CodeComponentSupplyService {
  private static instance: CodeComponentSupplyService;

  public static getInstance(): CodeComponentSupplyService {
    if (!CodeComponentSupplyService.instance) {
      CodeComponentSupplyService.instance = new CodeComponentSupplyService();
    }
    return CodeComponentSupplyService.instance;
  }

  public receiveImplementation(input: CodeComponentSupplyInput): CodeComponentSupplyResult {
    const spec = codeComponentSpecService.get(input.capabilityId);
    if (!spec) {
      return { accepted: false, reason: 'SPEC_NOT_FOUND', diagnostics: [] };
    }
    const component: SynthesizedComponent = {
      componentId: input.componentId,
      implementation: input.implementation,
      tests: input.tests,
      contract: {
        contractId: `CCON-SUPPLY-${input.capabilityId}`,
        capabilityId: input.capabilityId,
        purpose: input.purpose || spec.purpose,
        inputs: input.inputs,
        outputs: input.outputs,
        preconditions: input.preconditions,
        postconditions: input.postconditions,
        securityClass: input.securityClass ?? 'READ_ONLY',
        deterministic: true,
        templateIds: [],
      },
    };
    const result = generatedComponentVerificationRegistrationService.verifyAndRegister(component);
    const registeredStatus = String((result.component as { status?: string })?.status || '');
    if (registeredStatus !== 'ANALYZED') {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `🧩 [部品供給] 静的検証で止まった: ${input.componentId} status=${registeredStatus} diagnostics=${result.diagnostics.slice(0, 2).join(' / ')}`,
      );
      return { accepted: false, reason: 'STATIC_VERIFICATION_FAILED', registeredStatus, diagnostics: result.diagnostics };
    }
    codeComponentSpecService.markSupplied(
      input.capabilityId,
      input.componentId,
      '実装とテストが到着し、静的検証を通って ANALYZED で登録された',
    );
    systemLogger.info('SELF_IMPROVEMENT', `🧩 [部品供給] 登録: ${input.componentId}（仕様 ${input.capabilityId}）`);
    return { accepted: true, reason: 'REGISTERED_ANALYZED', registeredStatus, diagnostics: result.diagnostics };
  }
}

export const codeComponentSupplyService = CodeComponentSupplyService.getInstance();
