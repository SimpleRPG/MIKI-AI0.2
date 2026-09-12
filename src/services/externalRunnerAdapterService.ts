import { ExecutionEnvironment, ExecutionRequest, executionRunnerService } from './executionRunnerService';
import { systemLogger } from './systemLogger';

export interface ExternalRunnerResponse {
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

export interface ExternalRunnerAdapterConfig {
  endpoint: string;
  runnerId: string;
  timeoutMs?: number;
  enabled?: boolean;
}

/**
 * 外部Runnerとの通信だけを担当する薄いAdapter。
 * 任意コードを実行せず、ExecutionRequestをJSONとして送信し、結果を
 * executionRunnerService.submitResult()へ返す。実行権限は外部Runner側に限定する。
 */
export class ExternalRunnerAdapterService {
  private static instance: ExternalRunnerAdapterService;
  private config: ExternalRunnerAdapterConfig = { endpoint: '', runnerId: 'external-runner', enabled: false };
  private active = new Set<string>();

  private constructor() {}
  public static getInstance(): ExternalRunnerAdapterService {
    if (!ExternalRunnerAdapterService.instance) ExternalRunnerAdapterService.instance = new ExternalRunnerAdapterService();
    return ExternalRunnerAdapterService.instance;
  }

  public configure(config: ExternalRunnerAdapterConfig): void {
    this.config = {
      ...config,
      endpoint: config.endpoint.replace(/\/$/, ''),
      timeoutMs: config.timeoutMs ?? 120000,
      enabled: config.enabled ?? false,
    };
  }

  public getConfig(): ExternalRunnerAdapterConfig { return { ...this.config }; }

  public isEnabled(): boolean {
    return !!this.config.enabled && !!this.config.endpoint && !!this.config.runnerId;
  }

  public async dispatch(request: ExecutionRequest): Promise<{ accepted: boolean; reason: string }> {
    if (!this.isEnabled()) return { accepted: false, reason: 'External Runner Adapterが無効です。' };
    if (request.status !== 'SUBMITTED') return { accepted: false, reason: `Request状態=${request.status}のため送信できません。` };
    if (this.active.has(request.request_id)) return { accepted: false, reason: '同一Requestは送信中です。' };

    this.active.add(request.request_id);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120000);
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: request.request_id,
          component_id: request.component_id,
          implementation_hash: request.implementation_hash,
          artifact_snapshot_key: request.artifact_snapshot_key,
          environment: request.environment,
          test_category: request.test_category,
          test_case_id: request.test_case_id,
          input_summary: request.input_summary,
        }),
        signal: controller.signal,
      });
      if (!response.ok) return { accepted: false, reason: `Runner HTTP ${response.status}` };
      const result = await response.json() as ExternalRunnerResponse;
      if (result.request_id !== request.request_id) return { accepted: false, reason: 'Runner結果のrequest_idが一致しません。' };
      if (result.implementation_hash !== request.implementation_hash) return { accepted: false, reason: 'Runner結果の実装ハッシュが一致しません。' };
      if (result.test_case_id !== request.test_case_id) return { accepted: false, reason: 'Runner結果のTest Case IDが一致しません。' };
      if (result.artifact_snapshot_key !== request.artifact_snapshot_key) return { accepted: false, reason: 'Runner結果のArtifact snapshotが一致しません。' };
      if (result.environment !== request.environment) return { accepted: false, reason: 'Runner結果の実行環境が一致しません。' };

      const accepted = executionRunnerService.submitResult(result).accepted;
      return { accepted, reason: accepted ? 'Runner結果を受領しました。' : 'Runner結果を受領できませんでした。' };
    } catch (error) {
      const reason = error instanceof Error && error.name === 'AbortError' ? 'Runner通信がタイムアウトしました。' : `Runner通信失敗: ${String(error)}`;
      systemLogger.warn('TOOLS', `🛰️ [ExternalRunner] ${request.request_id}: ${reason}`);
      return { accepted: false, reason };
    } finally {
      clearTimeout(timer);
      this.active.delete(request.request_id);
    }
  }
}

export const externalRunnerAdapterService = ExternalRunnerAdapterService.getInstance();
