import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';
import { WorkManagerConstraints } from '../types';

export interface NativeWorkManagerPluginInterface {
  schedule(options: {
    intervalMinutes: number;
    requiresCharging?: boolean;
    requiresDeviceIdle?: boolean;
    requiresUnmeteredWifi?: boolean;
    batteryNotLow?: boolean;
  }): Promise<{ success: boolean; intervalMinutes: number }>;

  cancel(): Promise<{ success: boolean }>;

  getStatus(): Promise<{
    registered: boolean;
    state: string;
    id?: string;
    runAttemptCount?: number;
    batteryLevel?: number;
    isWorkerExecuting?: boolean;
  }>;

  addListener(
    eventName: 'autonomousCycleTriggered',
    listenerFunc: (data: { triggerSource: string; timestamp: number }) => void
  ): Promise<PluginListenerHandle>;
}

const NativeWorkManagerPlugin = registerPlugin<NativeWorkManagerPluginInterface>(
  'MikiWorkManagerPlugin',
  {
    web: () => ({
      async schedule(options: { intervalMinutes: number; [key: string]: any }) {
        return { success: false, intervalMinutes: options.intervalMinutes };
      },
      async cancel() {
        return { success: false };
      },
      async getStatus() {
        return { registered: false, state: 'WEB_PLATFORM' };
      },
      async addListener() {
        return { remove: async () => {} };
      },
    }),
  }
);

class NativeWorkManagerService {
  private listenerHandle: PluginListenerHandle | null = null;

  public isAndroidNative(): boolean {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * WorkManager へのスケジュール登録
   */
  public async schedule(
    intervalMinutes: number,
    constraints: WorkManagerConstraints
  ): Promise<{ success: boolean; intervalMinutes: number }> {
    if (!this.isAndroidNative()) {
      return { success: false, intervalMinutes };
    }
    try {
      return await NativeWorkManagerPlugin.schedule({
        intervalMinutes,
        requiresCharging: constraints.requiresCharging,
        requiresDeviceIdle: constraints.requiresDeviceIdle,
        requiresUnmeteredWifi: constraints.requiresUnmeteredWifi,
        batteryNotLow: constraints.batteryNotLow,
      });
    } catch (e) {
      console.warn('NativeWorkManagerService: schedule failed', e);
      return { success: false, intervalMinutes };
    }
  }

  /**
   * 登録中の WorkManager ジョブをキャンセル
   */
  public async cancel(): Promise<boolean> {
    if (!this.isAndroidNative()) return false;
    try {
      const res = await NativeWorkManagerPlugin.cancel();
      return !!res?.success;
    } catch (e) {
      console.warn('NativeWorkManagerService: cancel failed', e);
      return false;
    }
  }

  /**
   * WorkManager のジョブ状態と実行状況を取得
   */
  public async getStatus(): Promise<{
    registered: boolean;
    state: string;
    id?: string;
    batteryLevel?: number;
    isWorkerExecuting?: boolean;
  }> {
    if (!this.isAndroidNative()) {
      return { registered: false, state: 'WEB_PLATFORM' };
    }
    try {
      return await NativeWorkManagerPlugin.getStatus();
    } catch (e) {
      return { registered: false, state: 'ERROR' };
    }
  }

  /**
   * ネイティブ Worker からの自律成長実行トリガーをリッスン
   */
  public async setupTriggerListener(
    onTrigger: (triggerSource: 'android_intent') => void
  ): Promise<void> {
    if (!this.isAndroidNative()) return;
    try {
      if (this.listenerHandle) {
        await this.listenerHandle.remove();
        this.listenerHandle = null;
      }
      this.listenerHandle = await NativeWorkManagerPlugin.addListener(
        'autonomousCycleTriggered',
        (data) => {
          console.log('NativeWorkManagerService: Received autonomousCycleTriggered event', data);
          onTrigger('android_intent');
        }
      );
    } catch (e) {
      console.warn('NativeWorkManagerService: setupTriggerListener failed', e);
    }
  }
}

export const nativeWorkManagerService = new NativeWorkManagerService();
