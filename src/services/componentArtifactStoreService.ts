import { ComponentTxtPackage } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

/**
 * 第9.1章: 部品TXT正本の論理アーティファクト層。
 *
 * 各version/hashを不変スナップショットとして保存し、current manifestは
 * そのうちの1件を指す。これにより「同じversion番号を再利用した更新」で
 * 過去の検証対象TXTが上書きされることを防ぐ。
 */
export interface ComponentArtifactRecord {
  component_id: string;
  version: string;
  implementation_hash: string;
  validation_hash: string;
  component_txt: string;
  implementation_txt: string;
  tests_txt: string;
  validation_txt: string;
  sources_txt?: string;
  history_txt?: string;
  saved_at: number;
}

export interface ComponentArtifactManifest {
  component_id: string;
  version: string;
  implementation_hash: string;
  validation_hash: string;
  artifact_keys: string[];
  saved_at: number;
  snapshot_key: string;
}

const PREFIX = 'miki_component_artifact_v2:';
const INDEX_KEY = 'miki_component_artifact_index_v2';
const LEGACY_PREFIX = 'miki_component_artifact_v1:';
const LEGACY_INDEX_KEY = 'miki_component_artifact_index_v1';

class ComponentArtifactStoreService {
  private static instance: ComponentArtifactStoreService;
  private manifests = new Map<string, ComponentArtifactManifest>();
  private history = new Map<string, ComponentArtifactManifest[]>();

  private constructor() { this.loadIndex(); }

  public static getInstance(): ComponentArtifactStoreService {
    if (!this.instance) this.instance = new ComponentArtifactStoreService();
    return this.instance;
  }

  private manifestKey(componentId: string): string { return componentId; }
  private snapshotKey(componentId: string, version: string, implementationHash: string): string {
    return `${PREFIX}${encodeURIComponent(componentId)}@${encodeURIComponent(version)}#${encodeURIComponent(implementationHash)}`;
  }

  private loadIndex(): void {
    try {
      const raw = storageService.getItem(INDEX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { current?: ComponentArtifactManifest[]; history?: Record<string, ComponentArtifactManifest[]> };
        if (Array.isArray(parsed.current)) for (const item of parsed.current) if (item?.component_id && item.snapshot_key) this.manifests.set(this.manifestKey(item.component_id), item);
        if (parsed.history && typeof parsed.history === 'object') {
          for (const [id, items] of Object.entries(parsed.history)) if (Array.isArray(items)) this.history.set(id, items);
        }
      }
      // One-time compatibility migration. v1 records remain untouched; they are
      // imported into v2 as immutable snapshots and are never overwritten.
      if (this.manifests.size === 0) this.migrateLegacyIndex();
    } catch {
      this.manifests.clear();
      this.history.clear();
    }
  }

  private migrateLegacyIndex(): void {
    try {
      const raw = storageService.getItem(LEGACY_INDEX_KEY);
      if (!raw) return;
      const legacy = JSON.parse(raw) as ComponentArtifactManifest[];
      if (!Array.isArray(legacy)) return;
      for (const item of legacy) {
        const rawRecord = storageService.getItem(`${LEGACY_PREFIX}${item.component_id}@${item.version}`);
        if (!rawRecord) continue;
        const record = JSON.parse(rawRecord) as ComponentArtifactRecord;
        this.writeSnapshot(record, false);
      }
      this.persistIndex();
      systemLogger.info('TOOLS', `📚 [ComponentArtifact] v1→v2 immutable snapshot migration: ${legacy.length}件`);
    } catch (e) {
      systemLogger.warn('TOOLS', `📚 [ComponentArtifact] legacy migration skipped: ${String(e)}`);
    }
  }

  private persistIndex(): void {
    storageService.setItem(INDEX_KEY, JSON.stringify({
      current: Array.from(this.manifests.values()),
      history: Object.fromEntries(this.history.entries()),
    }));
  }

  private writeSnapshot(record: ComponentArtifactRecord, makeCurrent: boolean): ComponentArtifactManifest {
    const snapshotKey = this.snapshotKey(record.component_id, record.version, record.implementation_hash);
    const existingRaw = storageService.getItem(snapshotKey);
    if (!existingRaw) storageService.setItem(snapshotKey, JSON.stringify(record));

    const manifest: ComponentArtifactManifest = {
      component_id: record.component_id,
      version: record.version,
      implementation_hash: record.implementation_hash,
      validation_hash: record.validation_hash,
      artifact_keys: [
        'component.txt', 'implementation.txt', 'tests.txt', 'validation.txt',
        ...(record.sources_txt ? ['sources.txt'] : []),
        ...(record.history_txt ? ['history.txt'] : []),
      ],
      saved_at: record.saved_at,
      snapshot_key: snapshotKey,
    };
    const history = this.history.get(record.component_id) || [];
    if (!history.some(h => h.snapshot_key === snapshotKey)) history.push(manifest);
    history.sort((a, b) => b.saved_at - a.saved_at);
    this.history.set(record.component_id, history.slice(0, 100));
    if (makeCurrent) this.manifests.set(this.manifestKey(record.component_id), manifest);
    return manifest;
  }

  public save(pkg: ComponentTxtPackage): ComponentArtifactManifest {
    const record: ComponentArtifactRecord = {
      component_id: pkg.component_id,
      version: pkg.version,
      implementation_hash: pkg.implementation_hash,
      validation_hash: pkg.validation_hash,
      component_txt: pkg.component_txt,
      implementation_txt: pkg.implementation_txt,
      tests_txt: pkg.tests_txt,
      validation_txt: pkg.validation_txt,
      sources_txt: pkg.sources_txt,
      history_txt: pkg.history_txt,
      saved_at: Date.now(),
    };
    const manifest = this.writeSnapshot(record, true);
    this.persistIndex();
    return manifest;
  }

  public get(componentId: string, version?: string, implementationHash?: string): ComponentArtifactRecord | undefined {
    const manifest = this.manifests.get(componentId);
    if (!version && !implementationHash) {
      return manifest ? this.readSnapshot(manifest.snapshot_key) : undefined;
    }
    const candidates = this.history.get(componentId) || [];
    const target = candidates.find(m => m.version === version && (!implementationHash || m.implementation_hash === implementationHash));
    if (!target) return undefined;
    return this.readSnapshot(target.snapshot_key);
  }

  private readSnapshot(snapshotKey: string): ComponentArtifactRecord | undefined {
    try {
      const raw = storageService.getItem(snapshotKey);
      return raw ? JSON.parse(raw) as ComponentArtifactRecord : undefined;
    } catch { return undefined; }
  }

  public getManifest(componentId: string): ComponentArtifactManifest | undefined { return this.manifests.get(componentId); }

  /** Immutable snapshot lookup used by execution-result validation. */
  public getBySnapshotKey(snapshotKey: string): ComponentArtifactRecord | undefined {
    if (!snapshotKey || !snapshotKey.startsWith(PREFIX)) return undefined;
    return this.readSnapshot(snapshotKey);
  }
  /**
   * 9.1 TXT正本の境界。論理Storageでも物理ファイルでも同一の6ファイル契約を返す。
   * 書き出し側はこの結果をZIP/Library/外部Runnerへ渡せるが、検証時はsnapshot_keyを正本IDとして使う。
   */
  public getCanonicalFiles(componentId: string, version?: string, implementationHash?: string): Record<string, string> | undefined {
    const record = this.get(componentId, version, implementationHash);
    if (!record) return undefined;
    const files: Record<string, string> = {
      'component.txt': record.component_txt,
      'implementation.txt': record.implementation_txt,
      'tests.txt': record.tests_txt,
      'validation.txt': record.validation_txt,
    };
    if (record.sources_txt !== undefined) files['sources.txt'] = record.sources_txt;
    if (record.history_txt !== undefined) files['history.txt'] = record.history_txt;
    return files;
  }

  public getAllManifests(): ComponentArtifactManifest[] { return Array.from(this.manifests.values()); }
  public getHistory(componentId: string): ComponentArtifactManifest[] { return [...(this.history.get(componentId) || [])]; }

  public getIntegrity(componentId: string): { version: string; implementation_hash: string; validation_hash: string } | undefined {
    const manifest = this.manifests.get(componentId);
    if (!manifest) return undefined;
    return { version: manifest.version, implementation_hash: manifest.implementation_hash, validation_hash: manifest.validation_hash };
  }

  /** Registry blobからアーティファクト索引を同期する。既存snapshotは上書きしない。 */
  public reconcile(packages: ComponentTxtPackage[]): { created: number; mismatched: string[] } {
    let created = 0;
    const mismatched: string[] = [];
    for (const pkg of packages) {
      const current = this.manifests.get(pkg.component_id);
      if (!current) {
        this.save(pkg);
        created++;
        continue;
      }
      if (current.version !== pkg.version || current.implementation_hash !== pkg.implementation_hash || current.validation_hash !== pkg.validation_hash) {
        mismatched.push(pkg.component_id);
        // Keep the old snapshot for audit/history and create a new current snapshot.
        this.save(pkg);
      }
    }
    if (created || mismatched.length) systemLogger.info('TOOLS', `📚 [ComponentArtifact] 索引同期: created=${created}, hash_mismatch=${mismatched.length}`);
    return { created, mismatched };
  }
}

export const componentArtifactStoreService = ComponentArtifactStoreService.getInstance();
