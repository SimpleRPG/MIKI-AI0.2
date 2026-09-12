import { componentRegistryService } from './componentRegistryService';
import { componentVerificationService } from './componentVerificationService';
import { systemLogger } from './systemLogger';
import { ComponentTestCategory } from '../types';
import { executionEventBusService } from './executionEventBusService';
import { storageService } from './storageService';
import { componentArtifactStoreService } from './componentArtifactStoreService';
import { testAssertionService } from './testAssertionService';

export type ExecutionEnvironment = 'ANDROID' | 'TERMUX' | 'EXCEL_WINDOWS' | 'EXCEL_MAC' | 'EXTERNAL_RUNNER';
export type ExecutionRequestStatus = 'QUEUED' | 'UNSUPPORTED' | 'SUBMITTED' | 'COMPLETED' | 'FAILED' | 'INCONCLUSIVE';

export interface ExecutionRequest {
  request_id: string;
  component_id: string;
  implementation_hash: string;
  artifact_snapshot_key: string;
  test_case_id: string;
  environment: ExecutionEnvironment;
  test_category: ComponentTestCategory;
  input_summary: string;
  expected_summary: string;
  actual_output_summary?: string;
  evidence_id?: string;
  completed_at?: number;
  assertion_status?: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  assertion_rule?: string;
  assertion_reason?: string;
  created_at: number;
  status: ExecutionRequestStatus;
  reason?: string;
  /** 8.4: この実行が検証する判断への追跡ID（任意） */
  decision_id?: string;
}

export interface ExecutionResultInput {
  request_id: string;
  passed: boolean;
  output_summary: string;
  error_message?: string;
  duration_ms?: number;
  environment: ExecutionEnvironment;
  runner_id: string;
  implementation_hash: string;
  artifact_snapshot_key: string;
  test_case_id: string;
}

/**
 * 実行Runnerの安全な境界。
 * 任意コマンドをAndroid/Termuxから直接実行しない。
 * 現段階では「実行要求の生成」と「外部Runnerからの結果受領」を担当する。
 */
export class ExecutionRunnerService {
  private static instance: ExecutionRunnerService;
  private requests = new Map<string, ExecutionRequest>();
  private readonly storageKey = 'miki_execution_requests_v2';

  private constructor() { this.load(); }

  public static getInstance(): ExecutionRunnerService {
    if (!ExecutionRunnerService.instance) ExecutionRunnerService.instance = new ExecutionRunnerService();
    return ExecutionRunnerService.instance;
  }

  public createRequest(input: {
    componentId: string;
    environment: ExecutionEnvironment;
    testCategory: ComponentTestCategory;
    testCaseId?: string;
    inputSummary?: string;
    expectedSummary?: string;
    artifactSnapshotKey?: string;
    decisionId?: string;
  }): ExecutionRequest {
    const component = componentRegistryService.getComponent(input.componentId);
    const requestId = this.makeId(input.componentId, input.environment, input.testCategory, input.testCaseId || '', Date.now());

    if (!component) {
      const unsupported: ExecutionRequest = {
        request_id: requestId,
        component_id: input.componentId,
        implementation_hash: '',
        artifact_snapshot_key: '',
        test_case_id: input.testCaseId || '',
        environment: input.environment,
        test_category: input.testCategory,
        input_summary: input.inputSummary || '',
        expected_summary: input.expectedSummary || '',
        created_at: Date.now(),
        status: 'UNSUPPORTED',
        decision_id: input.decisionId,
        reason: 'ComponentがRegistryに存在しません。',
      };
      this.requests.set(requestId, unsupported);
      this.save();
      return unsupported;
    }

    if (!input.testCaseId) {
      const unsupported: ExecutionRequest = {
        request_id: requestId, component_id: component.component_id, implementation_hash: component.implementation_hash,
        artifact_snapshot_key: '', test_case_id: '', environment: input.environment, test_category: input.testCategory,
        input_summary: input.inputSummary || '', expected_summary: input.expectedSummary || '', created_at: Date.now(), status: 'UNSUPPORTED',
        decision_id: input.decisionId,
        reason: 'Test Case IDが指定されていません。Regression実行ではTest Case単位の固定が必要です。',
      };
      this.requests.set(requestId, unsupported); this.save(); return unsupported;
    }

    const currentArtifact = componentArtifactStoreService.get(component.component_id, component.version, component.implementation_hash);
    const artifactSnapshotKey = input.artifactSnapshotKey || (currentArtifact
      ? componentArtifactStoreService.getManifest(component.component_id)?.snapshot_key
      : undefined);
    const supported = component.supported_environments.some((env) =>
      env.toLowerCase().includes(input.environment.toLowerCase()) ||
      (input.environment.startsWith('EXCEL_') && env.toLowerCase().includes('excel'))
    );
    const artifactReady = !!currentArtifact && !!artifactSnapshotKey &&
      currentArtifact.implementation_hash === component.implementation_hash;

    const request: ExecutionRequest = {
      request_id: requestId,
      component_id: component.component_id,
      implementation_hash: component.implementation_hash,
      artifact_snapshot_key: artifactSnapshotKey || '',
      test_case_id: input.testCaseId || '',
      environment: input.environment,
      test_category: input.testCategory,
      input_summary: input.inputSummary || '',
      decision_id: input.decisionId,
      expected_summary: input.expectedSummary || '',
      created_at: Date.now(),
      status: supported && artifactReady ? 'QUEUED' : 'UNSUPPORTED',
      reason: !supported ? `対応環境に${input.environment}が登録されていません。` : !artifactReady ? '実行対象の不変Artifact snapshotを解決できません。' : undefined,
    };
    this.requests.set(requestId, request);
    this.save();

    systemLogger.info('TOOLS', `🧪 [Runner] ${requestId}: ${request.status}`);
    executionEventBusService.publish({
      type: request.status === 'QUEUED' ? 'execution.queued' : 'execution.rejected',
      request_id: request.request_id, component_id: request.component_id,
      implementation_hash: request.implementation_hash, environment: request.environment,
      test_category: request.test_category, test_case_id: request.test_case_id, metadata: { reason: request.reason || '' },
    });
    return request;
  }

  public markSubmitted(requestId: string): ExecutionRequest | undefined {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'QUEUED') return undefined;
    request.status = 'SUBMITTED';
    this.save();
    executionEventBusService.publish({
      type: 'execution.submitted', request_id: request.request_id, component_id: request.component_id,
      implementation_hash: request.implementation_hash, environment: request.environment,
      test_category: request.test_category, test_case_id: request.test_case_id,
    });
    return request;
  }

  /** 外部Runnerの結果を受領。ハッシュ不一致は即拒否。 */
  public submitResult(input: ExecutionResultInput): {
    accepted: boolean;
    verification?: ReturnType<typeof componentVerificationService.verifyExecution>;
    reason?: string;
  } {
    const request = this.requests.get(input.request_id);
    if (!request) return { accepted: false, reason: 'ExecutionRequestが存在しません。' };
    if (request.status !== 'SUBMITTED' && request.status !== 'QUEUED') {
      return { accepted: false, reason: `Request状態=${request.status}のため結果を受領できません。` };
    }
    if (request.test_case_id !== input.test_case_id) {
      request.status = 'FAILED'; this.save();
      executionEventBusService.publish({ type: 'execution.rejected', request_id: request.request_id, component_id: request.component_id,
        implementation_hash: input.implementation_hash, environment: input.environment, test_category: request.test_category, test_case_id: request.test_case_id,
        error_message: 'Test Case ID不一致' });
      return { accepted: false, reason: 'Test Case IDがRequest時点と一致しません。' };
    }
    if (request.implementation_hash !== input.implementation_hash) {
      request.status = 'FAILED';
      this.save();
      executionEventBusService.publish({
        type: 'execution.rejected', request_id: request.request_id, component_id: request.component_id,
        implementation_hash: input.implementation_hash, environment: input.environment,
        test_category: request.test_category, test_case_id: request.test_case_id, error_message: '実装ハッシュ不一致',
      });
      return { accepted: false, reason: '実装ハッシュがRequest時点と一致しません。' };
    }
    if (!input.artifact_snapshot_key || request.artifact_snapshot_key !== input.artifact_snapshot_key) {
      request.status = 'FAILED';
      this.save();
      executionEventBusService.publish({
        type: 'execution.rejected', request_id: request.request_id, component_id: request.component_id,
        implementation_hash: input.implementation_hash, environment: input.environment,
        test_category: request.test_category, test_case_id: request.test_case_id, error_message: 'Artifact snapshot不一致',
      });
      return { accepted: false, reason: 'Artifact snapshotがRequest時点と一致しません。' };
    }
    const artifact = componentArtifactStoreService.getBySnapshotKey(request.artifact_snapshot_key);
    if (!artifact || artifact.component_id !== request.component_id || artifact.implementation_hash !== request.implementation_hash) {
      request.status = 'FAILED';
      this.save();
      return { accepted: false, reason: '指定Artifact snapshotが現在の不変Artifact索引と一致しません。' };
    }

    if (request.environment !== input.environment) {
      request.status = 'FAILED';
      this.save();
      executionEventBusService.publish({
        type: 'execution.rejected', request_id: request.request_id, component_id: request.component_id,
        implementation_hash: input.implementation_hash, environment: input.environment,
        test_category: request.test_category, test_case_id: request.test_case_id, error_message: `実行環境不一致: request=${request.environment}, result=${input.environment}` ,
      });
      return { accepted: false, reason: `実行環境不一致: request=${request.environment}, result=${input.environment}` };
    }

    const assertion = testAssertionService.evaluate({
      expectedSummary: request.expected_summary,
      actualOutput: input.output_summary,
      runnerPassed: input.passed,
      errorMessage: input.error_message,
      category: request.test_category,
    });
    request.assertion_status = assertion.status;
    request.assertion_rule = assertion.rule;
    request.assertion_reason = assertion.reason;
    request.actual_output_summary = input.output_summary;
    request.completed_at = Date.now();
    request.status = assertion.status === 'PASS' ? 'COMPLETED' : assertion.status === 'FAIL' ? 'FAILED' : 'INCONCLUSIVE';
    this.save();

    if (assertion.status === 'INCONCLUSIVE') {
      executionEventBusService.publish({
        type: 'execution.inconclusive', request_id: request.request_id, component_id: request.component_id,
        implementation_hash: input.implementation_hash, environment: input.environment,
        test_category: request.test_category, test_case_id: request.test_case_id,
        passed: false, output_summary: input.output_summary, error_message: input.error_message,
        runner_id: input.runner_id, duration_ms: input.duration_ms,
        metadata: { assertion_status: assertion.status, assertion_rule: assertion.rule, assertion_reason: assertion.reason, artifact_snapshot_key: request.artifact_snapshot_key },
      });
      return { accepted: true, reason: `AssertionがINCONCLUSIVEのため、実行成功を検証成功として扱いません: ${assertion.reason}` };
    }

    const verification = componentVerificationService.verifyExecution({
      componentId: request.component_id,
      implementationHash: input.implementation_hash,
      environment: input.environment,
      testCategory: request.test_category,
      passed: input.passed,
      outputSummary: input.output_summary,
      errorMessage: input.error_message,
      durationMs: input.duration_ms,
      runnerId: input.runner_id,
      artifactSnapshotKey: input.artifact_snapshot_key,
      testCaseId: input.test_case_id,
      expectedSummary: request.expected_summary,
      assertionStatus: assertion.status,
      assertionRule: assertion.rule,
      assertionReason: assertion.reason,
    });
    if (verification?.evidenceId) request.evidence_id = verification.evidenceId;
    this.save();

    executionEventBusService.publish({
      type: input.passed ? 'execution.completed' : 'execution.failed',
      request_id: request.request_id, component_id: request.component_id,
      implementation_hash: input.implementation_hash, environment: input.environment,
      test_category: request.test_category, test_case_id: request.test_case_id, passed: input.passed,
      output_summary: input.output_summary, error_message: input.error_message,
      runner_id: input.runner_id, duration_ms: input.duration_ms,
      metadata: { test_case_id: request.test_case_id, verification_promoted: verification?.nextStatus === 'VERIFIED', component_state_changed: verification?.previousStatus !== verification?.nextStatus, failure_scope: request.test_category === 'REGRESSION' ? 'REGRESSION' : 'NORMAL_EXECUTION', goal: request.input_summary, input_summary: request.input_summary, artifact_snapshot_key: request.artifact_snapshot_key },
    });

    return { accepted: true, verification };
  }

  public getRequest(requestId: string): ExecutionRequest | undefined {
    return this.requests.get(requestId);
  }

  public listRequests(): ExecutionRequest[] {
    return Array.from(this.requests.values()).sort((a, b) => b.created_at - a.created_at);
  }

  /** Androidアプリ再起動後も監査可能なように要求履歴を復元する。SUBMITTEDは結果未受領としてQUEUEDへ戻し、再投入可能にする。 */
  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (!raw) return;
      const items = JSON.parse(raw) as ExecutionRequest[];
      if (!Array.isArray(items)) return;
      let recovered = false;
      for (const item of items) {
        if (!item?.request_id) continue;
        if (item.status === 'SUBMITTED') { item.status = 'QUEUED'; recovered = true; }
        this.requests.set(item.request_id, item);
      }
      if (recovered) this.save();
    } catch { this.requests.clear(); }
  }

  private save(): void {
    try {
      const items = this.listRequests().slice(0, 2000);
      storageService.setItem(this.storageKey, JSON.stringify(items));
    } catch { /* storage failure must not become an execution authority */ }
  }

  private makeId(componentId: string, environment: string, category: string, testCaseId: string, now: number): string {
    const raw = `${componentId}|${environment}|${category}|${testCaseId}|${now}`;
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `RUN-${(h >>> 0).toString(16).padStart(8, '0')}`;
  }
}

export const executionRunnerService = ExecutionRunnerService.getInstance();
