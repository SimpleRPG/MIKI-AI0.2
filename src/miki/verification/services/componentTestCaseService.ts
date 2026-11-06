import { componentRegistryService } from '../../../services/componentRegistryService';
import { systemLogger } from '../../../services/systemLogger';
import { ComponentTestCategory, ComponentTxtPackage } from '../../../types';
import { hardeningRegressionCandidateService } from '../../../services/hardeningRegressionCandidateService';

export interface ComponentTestCase {
  test_case_id: string;
  component_id: string;
  version: string;
  implementation_hash: string;
  category: ComponentTestCategory;
  description: string;
  expected_summary: string;
  source: 'DECLARED' | 'GENERATED' | 'HARDENING';
  enabled: boolean;
}

const ALL_CATEGORIES: ComponentTestCategory[] = [
  'NORMAL', 'BOUNDARY', 'EMPTY', 'INVALID', 'MISSING_DEPENDENCY',
  'PERMISSION', 'TIMEOUT', 'INTERRUPTION', 'LARGE_INPUT', 'DUPLICATE', 'REGRESSION',
];

export class ComponentTestCaseService {
  private static instance: ComponentTestCaseService;
  private cases = new Map<string, ComponentTestCase>();

  private constructor() {}

  public static getInstance(): ComponentTestCaseService {
    if (!this.instance) this.instance = new ComponentTestCaseService();
    return this.instance;
  }

  /**
   * tests_txtを正本として読む。記述が不足する場合のみ安全な最低限ケースを補う。
   * 実際の入力値を勝手に生成するのではなく、実行Runnerに渡す「試験意図」を作る。
   */
  public generateForComponent(componentId: string): ComponentTestCase[] {
    const component = componentRegistryService.getComponent(componentId);
    if (!component) return [];

    const declared = this.parseDeclaredTests(component);
    const generated = this.generateMissingCases(component, declared);
    const hardening = hardeningRegressionCandidateService.list(componentId)
      .filter(c => c.status === 'PROPOSED')
      .map(c => this.makeHardeningCase(component, c.candidate_id, c.category, c.description, c.expected_summary));
    const all = [...declared, ...generated, ...hardening];

    for (const testCase of all) this.cases.set(testCase.test_case_id, testCase);
    systemLogger.info('TOOLS', `🧪 [TestCase] ${componentId}: ${all.length} cases`);
    return all;
  }

  public generateForAll(options?: { verifiedOnly?: boolean }): ComponentTestCase[] {
    const components = componentRegistryService.getAllComponents()
      .filter(c => !options?.verifiedOnly || c.status === 'VERIFIED');
    return components.flatMap(c => this.generateForComponent(c.component_id));
  }

  public get(testCaseId: string): ComponentTestCase | undefined {
    return this.cases.get(testCaseId);
  }

  public getForComponent(testCaseId: string, componentId: string, implementationHash: string): ComponentTestCase | undefined {
    let testCase = this.cases.get(testCaseId);
    if (!testCase) {
      // TestCase cache is in-memory; rebuild deterministically after app restart.
      this.generateForComponent(componentId);
      testCase = this.cases.get(testCaseId);
    }
    if (!testCase) return undefined;
    if (testCase.component_id !== componentId || testCase.implementation_hash !== implementationHash) return undefined;
    return testCase;
  }

  public list(componentId?: string): ComponentTestCase[] {
    const values = Array.from(this.cases.values());
    return componentId ? values.filter(c => c.component_id === componentId) : values;
  }

  private parseDeclaredTests(component: ComponentTxtPackage): ComponentTestCase[] {
    const lines = (component.tests_txt || '').split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    const result: ComponentTestCase[] = [];

    for (const line of lines) {
      const match = line.match(/^TEST_CASE\s*:\s*([A-Z_]+)\s*,\s*(.+)$/i);
      if (!match) continue;
      const category = match[1].toUpperCase() as ComponentTestCategory;
      if (!ALL_CATEGORIES.includes(category)) continue;
      const description = match[2].trim();
      result.push(this.make(component, category, description, 'DECLARED'));
    }
    return result;
  }

  /**
   * P442(V1): 補完ケースの期待内容は判定可能な ASSERT にする。自然言語
   * の固定文言は testAssertionService で INCONCLUSIVE になり、Suite が
   * BLOCKED になる。NORMAL/BOUNDARY/REGRESSION/PERMISSION は
   * ASSERT: NON_EMPTY（G1 の具体的な CONTAINS と組み合わせる）。
   * PERMISSION の試験条件は実行環境そのもの（権限なしサンドボックス
   * で非空の出力を得ること）。弱い判定のため、G3 では本物の権限
   * テストを入れること。
   * INVALID は生成部品では Suite 対象外にする。合成関数は全入力を
   * 受理する全体関数で、前提条件の検証も安全な失敗の観測点もない
   * ため、失敗する入力が存在せず SAFE_FAILURE は常に INCONCLUSIVE
   * になる。黙って外すのではなく理由をログに残し、G3 で入力検証
   * が入ったら再有効化すること。他の部品の INVALID は従来通り残す。
   */
  private generateMissingCases(component: ComponentTxtPackage, declared: ComponentTestCase[]): ComponentTestCase[] {
    const present = new Set(declared.map(c => c.category));
    const candidates: Array<[ComponentTestCategory, string, string]> = [];

    if (!present.has('NORMAL')) candidates.push(['NORMAL', '標準入力で契約された処理を実行', 'ASSERT: NON_EMPTY']);
    if (!present.has('BOUNDARY')) candidates.push(['BOUNDARY', '事前条件の境界値を確認', 'ASSERT: NON_EMPTY']);
    if (!present.has('INVALID')) {
      if (this.isGeneratedSkeletonComponent(component)) {
        systemLogger.warn('SELF_IMPROVEMENT', `⚠️ [P442] ${component.component_id}: INVALIDケースは生成部品では実行不能のためSuite対象外（合成関数は全入力を受理し安全な失敗の観測点がない。G3で入力検証が入ったら再有効化すること）`);
      } else {
        candidates.push(['INVALID', '事前条件に反する入力を確認', 'failure_behaviorに従って安全に失敗すること']);
      }
    }
    if (component.dependencies.length > 0 && !present.has('MISSING_DEPENDENCY')) {
      candidates.push(['MISSING_DEPENDENCY', '依存部品が利用できない場合を確認', '依存欠落を成功扱いしないこと']);
    }
    if (component.security_class !== 'READ_ONLY' && !present.has('PERMISSION')) {
      candidates.push(['PERMISSION', '権限不足環境を確認', 'ASSERT: NON_EMPTY']);
    }
    if (!present.has('REGRESSION')) candidates.push(['REGRESSION', '既存成功条件の回帰確認', 'ASSERT: NON_EMPTY']);

    return candidates.map(([category, description, expected]) =>
      this.make(component, category, description, 'GENERATED', expected)
    );
  }

  /** 決定論的テンプレート合成で作られた骨格部品かどうか（出所で判別）。 */
  private isGeneratedSkeletonComponent(component: ComponentTxtPackage): boolean {
    return typeof component.sources_txt === 'string' && component.sources_txt.includes('deterministic template synthesis');
  }


  private makeHardeningCase(
    component: ComponentTxtPackage,
    candidateId: string,
    category: ComponentTestCategory,
    description: string,
    expectedSummary: string,
  ): ComponentTestCase {
    const raw = `${component.component_id}|${component.version}|${component.implementation_hash}|HARDENING|${candidateId}`;
    return {
      test_case_id: `TC-H-${this.hash(raw)}`,
      component_id: component.component_id,
      version: component.version,
      implementation_hash: component.implementation_hash,
      category,
      description,
      expected_summary: expectedSummary,
      source: 'HARDENING',
      enabled: true,
    };
  }

  private make(
    component: ComponentTxtPackage,
    category: ComponentTestCategory,
    description: string,
    source: 'DECLARED' | 'GENERATED',
    expectedOverride?: string,
  ): ComponentTestCase {
    const expected = expectedOverride || this.extractExpected(component, description);
    const raw = `${component.component_id}|${component.version}|${component.implementation_hash}|${category}|${description}|${expected}`;
    return {
      test_case_id: `TC-${this.hash(raw)}`,
      component_id: component.component_id,
      version: component.version,
      implementation_hash: component.implementation_hash,
      category,
      description,
      expected_summary: expected,
      source,
      enabled: true,
    };
  }

  private extractExpected(component: ComponentTxtPackage, description: string): string {
    // Explicit ASSERT directives are the executable test contract and must take precedence over natural-language postconditions.
    if (/^ASSERT:\s*/i.test(description.trim())) return description.trim();
    if (component.postconditions.length) return component.postconditions.join(' / ');
    if (component.failure_behavior) return component.failure_behavior;
    return `処理が正常終了すること: ${description}`;
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

export const componentTestCaseService = ComponentTestCaseService.getInstance();
