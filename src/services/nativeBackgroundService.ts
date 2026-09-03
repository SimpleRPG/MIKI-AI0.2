import { registerPlugin, Capacitor } from '@capacitor/core';

/**
 * Bridge to MikiBackgroundServicePlugin (Android native, see build-apk.yml).
 *
 * This plugin starts/stops a minimal Android foreground Service
 * (MikiKeepAliveService) whose only job is to keep the app's process — and
 * therefore the WebView/JS engine running backgroundWorkerService.ts's
 * setInterval-based scheduler — alive while the app is backgrounded or the
 * screen is off. It runs no self-improvement logic itself; that stays in JS,
 * unchanged. On any non-Android platform (web preview, iOS) this is a no-op.
 */
interface MikiBackgroundServicePluginInterface {
  start(): Promise<{ success: boolean; running: boolean }>;
  stop(): Promise<{ success: boolean; running: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
}

const NativeBackgroundPlugin = registerPlugin<MikiBackgroundServicePluginInterface>('MikiBackgroundServicePlugin', {
  web: () => ({
    async start() {
      return { success: false, running: false };
    },
    async stop() {
      return { success: false, running: false };
    },
    async isRunning() {
      return { running: false };
    },
  }),
});

class NativeBackgroundService {
  private isAndroidNative(): boolean {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Start the foreground keep-alive service. Safe to call repeatedly
   * (Android just re-delivers onStartCommand to the same running service).
   */
  public async start(): Promise<boolean> {
    if (!this.isAndroidNative()) return false;
    try {
      const res = await NativeBackgroundPlugin.start();
      return !!res?.running;
    } catch (e) {
      console.warn('NativeBackgroundService: failed to start keep-alive service', e);
      return false;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isAndroidNative()) return;
    try {
      await NativeBackgroundPlugin.stop();
    } catch (e) {
      console.warn('NativeBackgroundService: failed to stop keep-alive service', e);
    }
  }

  public async isRunning(): Promise<boolean> {
    if (!this.isAndroidNative()) return false;
    try {
      const res = await NativeBackgroundPlugin.isRunning();
      return !!res?.running;
    } catch (e) {
      return false;
    }
  }
}

export const nativeBackgroundService = new NativeBackgroundService();
