import { registerPlugin, Capacitor } from '@capacitor/core';
import { ExecutionRequest, ExecutionResultInput, executionRunnerService } from './executionRunnerService';
import { systemLogger } from './systemLogger';

interface NativeRunnerPlugin {
  execute(request: {
    request_id: string;
    component_id: string;
    implementation_hash: string;
    artifact_snapshot_key: string;
    environment: 'ANDROID';
    test_category: string;
    test_case_id: string;
    input_summary: string;
  }): Promise<{
    request_id: string;
    passed: boolean;
    output_summary: string;
    error_message?: string;
    duration_ms?: number;
    environment: 'ANDROID';
    runner_id: string;
    implementation_hash: string;
    artifact_snapshot_key: string;
    test_case_id: string;
  }>;
  health?: () => Promise<{ ready: boolean; runner_id?: string }>;
}

const MIKINativeRunner = registerPlugin<NativeRunnerPlugin>('MIKINativeRunner');

/**
 * Android本体のNative Runner Bridge。
 *
 * Termux/localhost HTTPを前提にせず、Capacitor Native Plugin
 * `MIKINativeRunner` との境界だけを担当する。
 * 任意コードをJSから実行せず、Native側にも「登録済み安全Adapterのみ」
 * を実行させる契約を前提とする。
 */
export class AndroidNativeRunnerAdapterService {
  private static instance: AndroidNativeRunnerAdapterService;
  private active = new Set<string>();

  private constructor() {}

  public static getInstance(): AndroidNativeRunnerAdapterService {
    if (!this.instance) this.instance = new AndroidNativeRunnerAdapterService();
    return this.instance;
  }

  public isAvailable(): boolean {
    return Capacitor.isNativePlatform() && typeof MIKINativeRunner.execute === 'function';
  }

  public async health(): Promise<{ available: boolean; ready: boolean; runnerId?: string; reason?: string }> {
    if (!Capacitor.isNativePlatform()) return { available: false, ready: false, reason: 'Android Native Platformではありません。' };
    if (!MIKINativeRunner.health) return { available: true, ready: true, runnerId: 'android-native' };
    try {
      const result = await MIKINativeRunner.health();
      return { available: true, ready: !!result.ready, runnerId: result.runner_id || 'android-native' };
    } catch (error) {
      return { available: true, ready: false, reason: `Native Runner health失敗: ${String(error)}` };
    }
  }

  public async dispatch(request: ExecutionRequest): Promise<{ accepted: boolean; reason: string }> {
    if (request.environment !== 'ANDROID') return { accepted: false, reason: 'Android Native RunnerはANDROID環境専用です。' };
    if (request.status !== 'SUBMITTED') return { accepted: false, reason: `Request状態=${request.status}のため送信できません。` };
    if (this.active.has(request.request_id)) return { accepted: false, reason: '同一Requestは送信中です。' };

    if (!Capacitor.isNativePlatform()) return { accepted: false, reason: 'Android Native Platformではありません。' };
    if (!this.isAvailable()) return { accepted: false, reason: 'MIKINativeRunner Pluginが利用できません。' };

    this.active.add(request.request_id);
    try {
      const result = await MIKINativeRunner.execute({
        request_id: request.request_id,
        component_id: request.component_id,
        implementation_hash: request.implementation_hash,
        artifact_snapshot_key: request.artifact_snapshot_key,
        test_case_id: request.test_case_id,
        environment: 'ANDROID',
        test_category: request.test_category,
        input_summary: request.input_summary,
      });

      const normalized: ExecutionResultInput = {
        request_id: result.request_id,
        passed: result.passed,
        output_summary: result.output_summary || '',
        error_message: result.error_message,
        duration_ms: result.duration_ms,
        environment: result.environment,
        runner_id: result.runner_id || 'android-native',
        implementation_hash: result.implementation_hash,
        artifact_snapshot_key: result.artifact_snapshot_key,
        test_case_id: result.test_case_id,
      };

      if (normalized.request_id !== request.request_id) return { accepted: false, reason: 'Native Runner結果のrequest_idが一致しません。' };
      if (normalized.implementation_hash !== request.implementation_hash) return { accepted: false, reason: 'Native Runner結果の実装ハッシュが一致しません。' };
      if (normalized.test_case_id !== request.test_case_id) return { accepted: false, reason: 'Native Runner結果のTest Case IDが一致しません。' };
      if (normalized.artifact_snapshot_key !== request.artifact_snapshot_key) return { accepted: false, reason: 'Native Runner結果のArtifact snapshotが一致しません。' };
      if (normalized.environment !== request.environment) return { accepted: false, reason: 'Native Runner結果の環境が一致しません。' };

      const accepted = executionRunnerService.submitResult(normalized).accepted;
      return { accepted, reason: accepted ? 'Android Native Runner結果を受領しました。' : 'Native Runner結果を受領できませんでした。' };
    } catch (error) {
      const reason = `Android Native Runner実行失敗: ${String(error)}`;
      systemLogger.warn('TOOLS', `📱 [AndroidNativeRunner] ${request.request_id}: ${reason}`);
      return { accepted: false, reason };
    } finally {
      this.active.delete(request.request_id);
    }
  }

}

export const androidNativeRunnerAdapterService = AndroidNativeRunnerAdapterService.getInstance();
