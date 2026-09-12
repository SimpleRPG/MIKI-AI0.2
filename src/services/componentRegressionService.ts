import { componentRegistryService } from './componentRegistryService';
import { componentTestCaseService, ComponentTestCase } from './componentTestCaseService';
import { executionRunnerService, ExecutionEnvironment, ExecutionRequest } from './executionRunnerService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { componentArtifactStoreService } from './componentArtifactStoreService';
import { ComponentTestCategory } from '../types';
import { evidenceService } from './evidenceService';

export type RegressionSuiteStatus = 'PLANNED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'BLOCKED';

export interface RegressionSuite {
  suite_id: string;
  component_id: string;
  implementation_hash: string;
  artifact_snapshot_key: string;
  artifact_version: string;
  validation_hash: string;
  environment: ExecutionEnvironment;
  test_case_ids: string[];
  request_ids: string[];
  case_bindings: Array<{ test_case_id: string; request_id: string }>;
  status: RegressionSuiteStatus;
  passed_count: number;
  failed_count: number;
  blocked_count: number;
  created_at: number;
  updated_at: number;
}

/**
 * 回帰テストの計画・集計層。
 * 実行そのものはExecutionRunnerServiceに委譲する。
 */
export class ComponentRegressionService {
  private static instance: ComponentRegressionService;
  private readonly storageKey = 'miki_component_regression_suites_v2';
  private suites = new Map<string, RegressionSuite>();

  private constructor() { this.load(); }

  public static getInstance(): ComponentRegressionService {
    if (!this.instance) this.instance = new ComponentRegressionService();
    return this.instance;
  }

  public plan(componentId: string, environment: ExecutionEnvironment): RegressionSuite | undefined {
    const component = componentRegistryService.getComponent(componentId);
    if (!component) return undefined;

    // Regression開始時点のArtifactを固定する。以後Registry側が更新されても、
    // このSuiteは別世代の実装へ結果を適用できない。
    const artifact = componentArtifactStoreService.get(componentId, component.version, component.implementation_hash);
    if (!artifact) {
      systemLogger.warn('TOOLS', `🔁 [Regression] ${componentId}: immutable artifact snapshot missing`);
      return undefined;
    }

    const cases = componentTestCaseService.generateForComponent(componentId)
      .filter(c => c.enabled);

    const requestIds: string[] = [];
    const caseBindings: Array<{ test_case_id: string; request_id: string }> = [];
    const artifactSnapshotKey = artifactSnapshotKeyFor(artifact);
    for (const testCase of cases) {
      const request = executionRunnerService.createRequest({
        componentId,
        environment,
        testCategory: testCase.category,
        testCaseId: testCase.test_case_id,
        inputSummary: `${testCase.test_case_id}: ${testCase.description}; expected=${testCase.expected_summary}`,
        expectedSummary: testCase.expected_summary,
        artifactSnapshotKey: artifactSnapshotKey,
      });
      requestIds.push(request.request_id);
      caseBindings.push({ test_case_id: testCase.test_case_id, request_id: request.request_id });
    }

    const now = Date.now();
    const suite: RegressionSuite = {
      suite_id: `REG-${this.hash(`${componentId}|${component.implementation_hash}|${environment}`)}`,
      component_id: componentId,
      implementation_hash: component.implementation_hash,
      artifact_snapshot_key: artifactSnapshotKey,
      artifact_version: artifact.version,
      validation_hash: artifact.validation_hash,
      environment,
      test_case_ids: cases.map(c => c.test_case_id),
      request_ids: requestIds,
      case_bindings: caseBindings,
      status: requestIds.length ? 'PLANNED' : 'BLOCKED',
      passed_count: 0,
      failed_count: 0,
      blocked_count: requestIds.length ? 0 : cases.length,
      created_at: now,
      updated_at: now,
    };
    this.suites.set(suite.suite_id, suite);
    this.save();
    systemLogger.info('TOOLS', `🔁 [Regression] ${suite.suite_id}: ${cases.length} cases planned`);
    return suite;
  }

  public get(suiteId: string): RegressionSuite | undefined {
    return this.suites.get(suiteId);
  }

  public list(): RegressionSuite[] {
    return Array.from(this.suites.values()).sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Runnerの現在状態を集計する。未実行はPASS扱いにしない。
   */
  public refresh(suiteId: string): RegressionSuite | undefined {
    const suite = this.suites.get(suiteId);
    if (!suite) return undefined;

    let passed = 0, failed = 0, blocked = 0, submitted = 0;
    const bindings = suite.case_bindings?.length
      ? suite.case_bindings
      : suite.request_ids.map(request_id => ({ test_case_id: '', request_id }));
    for (const binding of bindings) {
      const req = executionRunnerService.getRequest(binding.request_id);
      if (!req || (binding.test_case_id && req.test_case_id !== binding.test_case_id)) { blocked++; continue; }
      if (req.status === 'COMPLETED') passed++;
      else if (req.status === 'FAILED') failed++;
      else if (req.status === 'UNSUPPORTED' || req.status === 'INCONCLUSIVE') blocked++;
      else submitted++;
    }

    suite.passed_count = passed;
    suite.failed_count = failed;
    suite.blocked_count = blocked;
    suite.status =
      failed > 0 ? 'FAILED' :
      blocked > 0 ? 'BLOCKED' :
      submitted > 0 ? 'RUNNING' :
      passed === suite.request_ids.length && passed > 0 ? 'PASSED' :
      'PLANNED';
    suite.updated_at = Date.now();
    this.save();
    return suite;
  }

  public planForVerifiedComponents(environment: ExecutionEnvironment): RegressionSuite[] {
    return componentRegistryService.getAllComponents()
      .filter(c => c.status === 'VERIFIED')
      .map(c => this.plan(c.component_id, environment))
      .filter((s): s is RegressionSuite => !!s);
  }

  public getArtifactSnapshot(suiteId: string) {
    const suite = this.suites.get(suiteId);
    if (!suite) return undefined;
    return componentArtifactStoreService.get(suite.component_id, suite.artifact_version, suite.implementation_hash);
  }

  public isSafeToPromote(suiteId: string): { safe: boolean; reason: string } {
    const suite = this.refresh(suiteId);
    if (!suite) return { safe: false, reason: 'Regression suiteが存在しません。' };
    if (suite.status !== 'PASSED') return { safe: false, reason: `Regression status=${suite.status}; 全件成功が必要です。` };

    const component = componentRegistryService.getComponent(suite.component_id);
    if (!component) return { safe: false, reason: 'Componentが存在しません。' };
    if (component.implementation_hash !== suite.implementation_hash) {
      return { safe: false, reason: 'Suite作成後に実装ハッシュが変化しています。再テストが必要です。' };
    }
    const bindings = suite.case_bindings || [];
    if (bindings.length !== suite.request_ids.length) return { safe: false, reason: 'Regression SuiteのTest Case/Request対応表が不完全です。再計画が必要です。' };
    for (const binding of bindings) {
      const req = executionRunnerService.getRequest(binding.request_id);
      if (!req || req.test_case_id !== binding.test_case_id) return { safe: false, reason: `Test Case/Request対応不一致: ${binding.test_case_id}` };
      const testCase = componentTestCaseService.getForComponent(binding.test_case_id, suite.component_id, suite.implementation_hash);
      if (!testCase || testCase.category !== req.test_category) return { safe: false, reason: `Test Case契約不一致: ${binding.test_case_id}` };
    }
    for (const binding of bindings) {
      const req = executionRunnerService.getRequest(binding.request_id);
      if (!req?.evidence_id) return { safe: false, reason: `Execution Evidence未生成: ${binding.test_case_id}` };
      if (!evidenceService.isAdmissibleExecutionEvidence({
        evidenceId: req.evidence_id,
        componentId: suite.component_id,
        implementationHash: suite.implementation_hash,
        artifactSnapshotKey: suite.artifact_snapshot_key,
        testCaseId: binding.test_case_id,
        environment: suite.environment,
        expectedSummary: req.expected_summary,
      })) {
        return { safe: false, reason: `Execution Evidence契約不一致または未受理: ${binding.test_case_id}` };
      }
    }

    const artifact = this.getArtifactSnapshot(suiteId);
    if (!artifact) return { safe: false, reason: 'Regression開始時点の不変Artifact snapshotが見つかりません。' };
    if (artifact.implementation_hash !== suite.implementation_hash || artifact.validation_hash !== suite.validation_hash) {
      return { safe: false, reason: 'Artifact snapshotとRegression Suiteのhashが一致しません。' };
    }
    return { safe: true, reason: '全回帰テスト成功、実装hash一致、Artifact snapshot一致。' };
  }

  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (!raw) return;
      const items = JSON.parse(raw) as RegressionSuite[];
      if (!Array.isArray(items)) return;
      for (const suite of items) {
        if (suite?.suite_id && suite.component_id && suite.implementation_hash && suite.artifact_snapshot_key) {
          if (!Array.isArray(suite.case_bindings)) {
            suite.case_bindings = suite.request_ids.map(request_id => ({
              request_id,
              test_case_id: executionRunnerService.getRequest(request_id)?.test_case_id || '',
            }));
          }
          this.suites.set(suite.suite_id, suite);
        }
      }
    } catch { this.suites.clear(); }
  }

  private save(): void {
    try {
      storageService.setItem(this.storageKey, JSON.stringify(this.list().slice(0, 500)));
    } catch { /* persistence is audit support, not execution authority */ }
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

function artifactSnapshotKeyFor(artifact: { component_id: string; version: string; implementation_hash: string }): string {
  return componentArtifactStoreService.getManifest(artifact.component_id)?.snapshot_key || '';
}

export const componentRegressionService = ComponentRegressionService.getInstance();
