/**
 * 設計思想14.4: ストレージ資源ガバナンス
 *
 * 保存量を増やすことを賢さとみなさず、空き容量に応じて収集・試験・索引更新を制御する。
 * Native StorageManager が利用できない場合は StorageManager API / IndexedDB の推定値へフォールバックする。
 */
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type ResourceMode = 'NORMAL' | 'CONSERVE' | 'CLEANUP' | 'STOP_COLLECTION';
export type StorageTier = 'HOT' | 'WARM' | 'COLD' | 'DORMANT' | 'QUARANTINED';

export type ResourceTier='LIGHT'|'MEDIUM'|'HEAVY'|'EXTREME';
export interface CapabilityBudget { tier:ResourceTier; maxDurationMs:number; maxStorageBytes:number; backgroundAllowed:boolean; reason:string; }
export interface ResourceSnapshot {
  quotaBytes: number | null;
  usageBytes: number | null;
  freeBytes: number | null;
  freeGb: number | null;
  mode: ResourceMode;
  measuredAt: number;
}

const SNAPSHOT_KEY = 'miki_resource_governance_snapshot_v1';
const GB = 1024 ** 3;
const DEFAULT_FREE_GB = 65;

class ResourceGovernanceService {
  private snapshot: ResourceSnapshot = {
    quotaBytes: null, usageBytes: null, freeBytes: null, freeGb: null,
    mode: 'NORMAL', measuredAt: 0,
  };

  initialize(): void {
    try {
      const raw = storageService.getItem(SNAPSHOT_KEY);
      if (raw) this.snapshot = { ...this.snapshot, ...JSON.parse(raw) };
    } catch { /* safe defaults */ }
    void this.refresh();
  }

  async refresh(): Promise<ResourceSnapshot> {
    let quota: number | null = null;
    let usage: number | null = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        quota = typeof estimate.quota === 'number' ? estimate.quota : null;
        usage = typeof estimate.usage === 'number' ? estimate.usage : null;
      }
    } catch (error) {
      systemLogger.warn('RESOURCE_GOVERNANCE', `容量推定に失敗: ${String(error)}`);
    }

    const free = quota !== null && usage !== null ? Math.max(0, quota - usage) : null;
    const freeGb = free === null ? null : free / GB;
    const effectiveFreeGb = freeGb ?? DEFAULT_FREE_GB;
    const mode: ResourceMode =
      effectiveFreeGb < 5 ? 'STOP_COLLECTION' :
      effectiveFreeGb < 10 ? 'CLEANUP' :
      effectiveFreeGb < 15 ? 'CONSERVE' : 'NORMAL';

    this.snapshot = { quotaBytes: quota, usageBytes: usage, freeBytes: free, freeGb, mode, measuredAt: Date.now() };
    try { storageService.setItem(SNAPSHOT_KEY, JSON.stringify(this.snapshot)); } catch { /* quota may be full */ }
    return this.snapshot;
  }

  budgetFor(tier:ResourceTier, critical=false): CapabilityBudget {
    const mode=this.snapshot.mode;
    const table:Record<ResourceTier,[number,number]>={LIGHT:[15000,5*1024**2],MEDIUM:[60000,25*1024**2],HEAVY:[180000,100*1024**2],EXTREME:[300000,250*1024**2]};
    const [maxDurationMs,maxStorageBytes]=table[tier];
    if(mode==='STOP_COLLECTION'&&!critical)return {tier,maxDurationMs:0,maxStorageBytes:0,backgroundAllowed:false,reason:'STOP_COLLECTION'};
    if(mode==='CLEANUP'&&tier==='EXTREME'&&!critical)return {tier,maxDurationMs:0,maxStorageBytes:0,backgroundAllowed:false,reason:'CLEANUP_BLOCKS_EXTREME'};
    if(mode==='CONSERVE'&&tier==='EXTREME'&&!critical)return {tier,maxDurationMs:Math.floor(maxDurationMs/2),maxStorageBytes:Math.floor(maxStorageBytes/2),backgroundAllowed:false,reason:'CONSERVE_LIMIT'};
    return {tier,maxDurationMs,maxStorageBytes,backgroundAllowed:mode==='NORMAL'||tier==='LIGHT',reason:'ALLOWED'};
  }

  getSnapshot(): ResourceSnapshot { return { ...this.snapshot }; }

  canCollectLargeData(): boolean { return this.snapshot.mode === 'NORMAL'; }
  canRunBackgroundIndexing(): boolean { return this.snapshot.mode === 'NORMAL' || this.snapshot.mode === 'CONSERVE'; }
  canRunComponentTests(): boolean { return this.snapshot.mode !== 'STOP_COLLECTION'; }

  /** 低価値成果物を保存する前の判定。重要証拠・検証ログは別途保護する。 */
  shouldPersist(tier: StorageTier, critical = false): boolean {
    if (critical) return true;
    if (this.snapshot.mode === 'STOP_COLLECTION') return tier === 'HOT';
    if (this.snapshot.mode === 'CLEANUP') return tier === 'HOT' || tier === 'WARM';
    if (this.snapshot.mode === 'CONSERVE') return tier !== 'DORMANT';
    return tier !== 'QUARANTINED';
  }
}

export const resourceGovernanceService = new ResourceGovernanceService();
