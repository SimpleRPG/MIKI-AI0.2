import { registerPlugin } from '@capacitor/core';

export interface WorkManagerPlugin {
  schedulePeriodicWork(options: { intervalMinutes: number }): Promise<{ scheduled: boolean; intervalMinutes: number }>;
  cancelPeriodicWork(): Promise<{ cancelled: boolean }>;
}

const NativeWorkManager = registerPlugin<WorkManagerPlugin>('MikiWorkManagerPlugin');

class WorkManagerService {
  private isNativeAvailable(): boolean {
    return typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform();
  }

  public async scheduleMaintenance(intervalMinutes: number = 60): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      console.log('[WorkManagerService] Non-native environment, skipping native WorkManager');
      return false;
    }
    try {
      const res = await NativeWorkManager.schedulePeriodicWork({ intervalMinutes });
      return res.scheduled;
    } catch (e) {
      console.warn('[WorkManagerService] Failed to schedule WorkManager:', e);
      return false;
    }
  }

  public async cancelMaintenance(): Promise<boolean> {
    if (!this.isNativeAvailable()) {
      return false;
    }
    try {
      const res = await NativeWorkManager.cancelPeriodicWork();
      return res.cancelled;
    } catch (e) {
      console.warn('[WorkManagerService] Failed to cancel WorkManager:', e);
      return false;
    }
  }
}

export const workManagerService = new WorkManagerService();
