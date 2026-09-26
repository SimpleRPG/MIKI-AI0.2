import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';
import { WorkManagerConstraints } from '../../../types';

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

  fetchRenderedPage(options: {
    url: string;
    timeoutMs?: number;
    renderWaitMs?: number;
  }): Promise<{ success: boolean; text: string; url: string; length?: number; html?: string; markdown?: string; navigationText?: string; advertisementText?: string; menuText?: string; footerText?: string }>;

  runCandidateBrowserE2E(options: { url:string; scenarios:any[]; timeoutMs?:number }): Promise<{success:boolean;results:any[];consoleErrors:string[];network:any[];screenshots:any[];domSnapshots:any[];reasons:string[]}>;

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
      async fetchRenderedPage(options: { url: string; timeoutMs?: number; renderWaitMs?: number }) {
        try {
          const res = await fetch(options.url, { signal: AbortSignal.timeout(options.timeoutMs || 10000) });
          const html = await res.text();
          const text = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
          return { success: true, text, url: options.url, length: text.length };
        } catch (e: any) {
          return { success: false, text: '', url: options.url, length: 0 };
        }
      },
      async runCandidateBrowserE2E(options: {url:string;scenarios:any[];timeoutMs?:number}) { return {success:false,results:[],consoleErrors:[],network:[],screenshots:[],domSnapshots:[],reasons:['NATIVE_INDEPENDENT_WEBVIEW_REQUIRED']}; },
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

  /**
   * 指示1: ヘッドレスWebViewによるページレンダリングとテキスト抽出
   * - Android Native: MikiWorkManagerPlugin.fetchRenderedPage (onPageFinished + SPA待機 + 順次破棄)
   * - Web/Node: fetch + テキストパースでフォールバック
   */
  public async fetchRenderedPage(
    url: string,
    options?: { timeoutMs?: number; renderWaitMs?: number }
  ): Promise<{ success: boolean; text: string; url: string; length: number; error?: string }> {
    const timeoutMs = options?.timeoutMs ?? 10000;
    const renderWaitMs = options?.renderWaitMs ?? 1500;

    if (this.isAndroidNative()) {
      try {
        const res = await NativeWorkManagerPlugin.fetchRenderedPage({
          url,
          timeoutMs,
          renderWaitMs,
        });
        return {
          success: res.success,
          text: res.text || '',
          url: res.url || url,
          length: res.text ? res.text.length : 0,
        };
      } catch (e: any) {
        console.warn('NativeWorkManagerService.fetchRenderedPage native error:', e);
        return {
          success: false,
          text: '',
          url,
          length: 0,
          error: e?.message || String(e),
        };
      }
    }

    // Web / Node フォールバック
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        return { success: false, text: '', url, length: 0, error: `HTTP ${res.status}` };
      }
      const html = await res.text();
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      return { success: true, text, url, length: text.length };
    } catch (e: any) {
      return {
        success: false,
        text: '',
        url,
        length: 0,
        error: e?.message || String(e),
      };
    }
  }
  public async runCandidateBrowserE2E(options:{url:string;scenarios:any[];timeoutMs?:number}){
    if(!this.isAndroidNative())return {success:false,results:[],consoleErrors:[],network:[],screenshots:[],domSnapshots:[],reasons:['ANDROID_NATIVE_REQUIRED']};
    try{return await NativeWorkManagerPlugin.runCandidateBrowserE2E(options);}catch(e){return {success:false,results:[],consoleErrors:[],network:[],screenshots:[],domSnapshots:[],reasons:[e instanceof Error?e.message:String(e)]};}
  }

}

export const nativeWorkManagerService = new NativeWorkManagerService();
