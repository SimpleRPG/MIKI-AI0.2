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
  checkNotificationPermission(): Promise<{ granted: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
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
    async checkNotificationPermission() {
      return { granted: false };
    },
    async requestNotificationPermission() {
      return { granted: false };
    },
  }),
});

class NativeBackgroundService {
  private isAndroidNative(): boolean {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Ensures the Android 13+ POST_NOTIFICATIONS permission is granted,
   * prompting the user automatically if it has not been decided yet.
   * A foreground service still runs without this permission, but its
   * notification (and the "一時停止" action inside it) silently fails to
   * show without it, which would make the running service invisible to the
   * user. Safe to call on any platform/version — resolves true immediately
   * where the permission does not apply (< Android 13, non-Android).
   */
  public async ensureNotificationPermission(): Promise<boolean> {
    if (!this.isAndroidNative()) return false;
    try {
      const current = await NativeBackgroundPlugin.checkNotificationPermission();
      if (current.granted) return true;
      const requested = await NativeBackgroundPlugin.requestNotificationPermission();
      return !!requested?.granted;
    } catch (e) {
      console.warn('NativeBackgroundService: notification permission check/request failed', e);
      return false;
    }
  }

  /**
   * Start the foreground keep-alive service. Safe to call repeatedly
   * (Android just re-delivers onStartCommand to the same running service).
   * Requests the notification permission first (if not already decided) so
   * the persistent "実行中" notification and its 一時停止 button are visible.
   */
  public async start(): Promise<boolean> {
    if (!this.isAndroidNative()) return false;
    await this.ensureNotificationPermission();
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
