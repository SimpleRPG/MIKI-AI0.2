import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { CapabilityContract } from './capabilityContractSynthesisService';
import {
  GENERATED_HELPERS_CODE,
  firstOperationTemplate,
  operationCodeFor,
} from './generatedComponentTemplateSpecService';

export interface SynthesizedComponent {
  componentId: string;
  implementation: string;
  tests: string;
  contract: CapabilityContract;
}

class AtomicComponentTemplateSynthesisService {
  synthesize(contract: CapabilityContract): SynthesizedComponent {
    const fn = this.identifier(contract.capabilityId);
    const markers = contract.templateIds.map((id) => this.markerFor(id));
    const operations = contract.templateIds
      .map((id) => operationCodeFor(id))
      .filter((code) => code.length > 0)
      .join('\n');
    // P443(G3): テンプレート名のマーカーだけでなく、実処理コードを生成する。
    // 実処理は generatedComponentTemplateSpecService の仕様テーブルから作る
    // 文字列操作（アンカー探索・カンマ処理・冪等チェック・安全な失敗）。
    // パラメータは input.request.operations[<templateId>] から読む。
    // 検証は決して throw しない（サーバは1入力でも投げると全体を失敗にする）。
    // allowed === false の要求は実行せず PERMISSION_DENIED で拒否する。
    const implementation = `export interface DeterministicComponentInput { source: string; request: Record<string, unknown>; }\nexport interface DeterministicComponentOutput { candidate: string; report: string[]; }\n// [P443] Generated operation code: string-based deterministic edits.\n// Contract templates are applied in order to input.source. Parameters come\n// from input.request.operations[<templateId>] (structured change request).\n// Validation never throws: an operation with missing or mistyped parameters\n// is skipped with a reason in report and leaves candidate unchanged.\n// If input.request.allowed === false the run is refused (PERMISSION_DENIED).\n${GENERATED_HELPERS_CODE}\nexport function ${fn}(input: DeterministicComponentInput): DeterministicComponentOutput {\n  const report: string[] = [];\n${markers.map((m) => `  report.push(${JSON.stringify(m)});`).join('\n')}\n  if (!input || typeof input !== "object") { report.push("INVALID_INPUT"); return { candidate: "", report: report }; }\n  if (typeof input.source !== "string") { report.push("INVALID_SOURCE"); return { candidate: "", report: report }; }\n  let candidate = input.source;\n  const req = isRec(input.request) ? input.request : {};\n  if (req["allowed"] === false) { report.push("PERMISSION_DENIED"); return { candidate: candidate, report: report }; }\n  const ops = isRec(req["operations"]) ? req["operations"] : {};\n${operations}\n  return { candidate: candidate, report: report };\n}\n`;
    // P443(G3): tests_txt は実処理の実行を assert する。
    // NORMAL/BOUNDARY/REGRESSION は先頭の操作テンプレートの _APPLIED
    // （実行結果からの逆算ではなく、実行前に決めたマーカー）。
    // INVALID は入力検証の安全な失敗（REQUEST_INCOMPLETE）。
    // PERMISSION は allowed: false の拒否（PERMISSION_DENIED）。
    const firstOp = firstOperationTemplate(contract.templateIds);
    const assertApplied = firstOp ? `ASSERT: CONTAINS "${firstOp}_APPLIED"` : 'ASSERT: NON_EMPTY';
    const tests = `TEST_CASE: NORMAL, ${assertApplied}\nTEST_CASE: EMPTY, ASSERT: NON_EMPTY\nTEST_CASE: BOUNDARY, ${assertApplied}\nTEST_CASE: INVALID, ASSERT: CONTAINS "REQUEST_INCOMPLETE"\nTEST_CASE: REGRESSION, ${assertApplied}\nTEST_CASE: PERMISSION, ASSERT: CONTAINS "PERMISSION_DENIED"\nTEMPLATES: ${contract.templateIds.join(',')}`;
    return { componentId: contract.capabilityId, implementation, tests, contract };
  }

  /** operation() が report に積むマーカー文字列（実装と assertion で共有）。 */
  private markerFor(id: string): string {
    if (id === 'TEST_ROUNDTRIP') return 'ROUNDTRIP_REQUIRED';
    if (id === 'TEST_UNIQUENESS') return 'UNIQUENESS_REQUIRED';
    if (id === 'REGISTRY_EXPORT_CONNECT') return 'REGISTRY_CONNECT_REQUIRED';
    return id;
  }

  private identifier(value: string): string {
    return value.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^([^A-Za-z_$])/, '_$1');
  }
}

export const atomicComponentTemplateSynthesisService = new AtomicComponentTemplateSynthesisService();
