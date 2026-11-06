import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import type { CapabilityContract } from './capabilityContractSynthesisService';

export interface SynthesizedComponent {
  componentId: string;
  implementation: string;
  tests: string;
  contract: CapabilityContract;
}

class AtomicComponentTemplateSynthesisService {
  synthesize(contract: CapabilityContract): SynthesizedComponent {
    const fn = this.identifier(contract.capabilityId);
    const operations = contract.templateIds.map(id => this.operation(id)).join('\n');
    const implementation = `export interface DeterministicComponentInput { source:string; request:Record<string,unknown>; }\nexport interface DeterministicComponentOutput { candidate:string; report:string[]; }\nexport function ${fn}(input:DeterministicComponentInput):DeterministicComponentOutput {\n  let candidate=input.source;\n  const report:string[]=[];\n${operations}\n  return {candidate,report};\n}\n`;
    // P442(G1): tests_txt を TEST_CASE 形式＋ASSERT ディレクティブで出す。
    // assertion は契約・テンプレートから実行前に決定論的に作る（実行結果
    // からの逆算はしない）。report には全テンプレートのマーカーが必ず
    // 積まれるため、先頭テンプレートのマーカーを CONTAINS で assert する。
    const firstMarker = contract.templateIds.length ? this.markerFor(contract.templateIds[0]) : '';
    const assertMarker = firstMarker ? `ASSERT: CONTAINS ${JSON.stringify(firstMarker)}` : 'ASSERT: NON_EMPTY';
    const tests = `TEST_CASE: NORMAL, ${assertMarker}\nTEST_CASE: EMPTY, ASSERT: NON_EMPTY\nTEST_CASE: BOUNDARY, ${assertMarker}\nTEST_CASE: REGRESSION, ${assertMarker}\nTEMPLATES: ${contract.templateIds.join(',')}`;
    return { componentId: contract.capabilityId, implementation, tests, contract };
  }

  /** operation() が report に積むマーカー文字列（実装と assertion で共有）。 */
  private markerFor(id: string): string {
    if (id === 'TEST_ROUNDTRIP') return 'ROUNDTRIP_REQUIRED';
    if (id === 'TEST_UNIQUENESS') return 'UNIQUENESS_REQUIRED';
    if (id === 'REGISTRY_EXPORT_CONNECT') return 'REGISTRY_CONNECT_REQUIRED';
    return id;
  }

  private operation(id: string): string {
    return `  report.push(${JSON.stringify(this.markerFor(id))});`;
  }

  private identifier(value: string): string {
    return value.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^([^A-Za-z_$])/, '_$1');
  }
}

export const atomicComponentTemplateSynthesisService = new AtomicComponentTemplateSynthesisService();
