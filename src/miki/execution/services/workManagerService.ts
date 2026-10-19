import { nativeWorkManagerService } from './nativeWorkManagerService';
import type { WorkManagerConstraints } from '../../../types';

/**
 * Compatibility facade for older callers.
 * The canonical Android WorkManager contract is nativeWorkManagerService;
 * this module must not register a second plugin interface with mismatched method names.
 */
const DEFAULT_CONSTRAINTS: WorkManagerConstraints = {
  requiresCharging: true,
  requiresDeviceIdle: false,
  requiresUnmeteredWifi: false,
  batteryNotLow: true,
  nightTimeOnly: false,
};

class WorkManagerService {
  public async scheduleMaintenance(intervalMinutes = 60): Promise<boolean> {
    if (!nativeWorkManagerService.isAndroidNative()) return false;
    const result = await nativeWorkManagerService.schedule(intervalMinutes, DEFAULT_CONSTRAINTS);
    return result.success;
  }

  public async cancelMaintenance(): Promise<boolean> {
    if (!nativeWorkManagerService.isAndroidNative()) return false;
    return nativeWorkManagerService.cancel();
  }
}

export const workManagerService = new WorkManagerService();
