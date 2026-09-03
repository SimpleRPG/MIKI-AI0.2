import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

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

export type NotificationActionListener = (data: { action?: string; tab?: string; [key: string]: any }) => void;

class NativeBackgroundService {
  private actionListeners: NotificationActionListener[] = [];

  constructor() {
    this.initNotificationListeners();
  }

  private isAndroidNative(): boolean {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  private initNotificationListeners(): void {
    if (typeof window === 'undefined') return;

    // Capacitor LocalNotifications action listener
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const extra = notificationAction.notification.extra || {};
        this.notifyActionListeners(extra);
      });
    } catch (err) {
      console.warn('LocalNotifications listener init warning:', err);
    }
  }

  public addActionListener(listener: NotificationActionListener): () => void {
    this.actionListeners.push(listener);
    return () => {
      this.actionListeners = this.actionListeners.filter((l) => l !== listener);
    };
  }

  public notifyActionListeners(data: any): void {
    this.actionListeners.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('Error in notification action listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('miki:notification-action', { detail: data }));
    }
  }

  /**
   * Ensures notification permission is granted across Android native (POST_NOTIFICATIONS)
   * and Web/PWA (Notification API).
   */
  public async ensureNotificationPermission(): Promise<boolean> {
    if (this.isAndroidNative()) {
      try {
        const capPerm = await LocalNotifications.checkPermissions();
        if (capPerm.display === 'granted') return true;
        const req = await LocalNotifications.requestPermissions();
        if (req.display === 'granted') return true;
      } catch (e) {
        console.warn('LocalNotifications permission check/request failed:', e);
      }

      try {
        const current = await NativeBackgroundPlugin.checkNotificationPermission();
        if (current.granted) return true;
        const requested = await NativeBackgroundPlugin.requestNotificationPermission();
        return !!requested?.granted;
      } catch (e) {
        console.warn('NativeBackgroundPlugin notification permission failed:', e);
        return false;
      }
    } else {
      // Web Notification API
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission !== 'denied') {
          try {
            const res = await Notification.requestPermission();
            return res === 'granted';
          } catch (e) {
            console.warn('Web Notification requestPermission error:', e);
          }
        }
      }
      return false;
    }
  }

  /**
   * Send a local on-device notification (Android native via Capacitor LocalNotifications or Web Notification).
   * Supports custom extra data so clicking the notification opens the relevant modal/tab.
   */
  public async sendLocalNotification(options: {
    id?: number;
    title: string;
    body: string;
    data?: any;
  }): Promise<boolean> {
    const hasPerm = await this.ensureNotificationPermission();
    if (!hasPerm) {
      console.warn('Notification permission not granted, notification cannot be delivered');
      return false;
    }

    const notifId = options.id || Math.floor(Date.now() % 100000);

    // 1. Android Native via Capacitor LocalNotifications
    if (this.isAndroidNative()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: options.title,
              body: options.body,
              extra: options.data || {},
            },
          ],
        });
        return true;
      } catch (e) {
        console.warn('LocalNotifications schedule failed:', e);
      }
    }

    // 2. Web fallback (Browser / PWA)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(options.title, {
          body: options.body,
          icon: '/favicon.ico',
          data: options.data,
        });
        notif.onclick = () => {
          window.focus();
          this.notifyActionListeners(options.data || {});
          notif.close();
        };
        return true;
      } catch (e) {
        console.warn('Web notification delivery failed:', e);
      }
    }

    return false;
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

