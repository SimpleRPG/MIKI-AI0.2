import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type ComponentVersionChangeType = 'CREATED' | 'UPDATED' | 'SUPERSEDED' | 'REACTIVATED';

export interface ComponentVersionRecord {
  version_record_id: string;
  component_id: string;
  version: string;
  implementation_hash: string;
  validation_hash: string;
  status: string;
  change_type: ComponentVersionChangeType;
  previous_version?: string;
  previous_implementation_hash?: string;
  changed_at: number;
  reason: string;
}

/**
 * Componentのversion/hashごとのライフサイクルを保持する監査台帳。
 *
 * 「同じComponent IDだから過去の検証・成功実績を新しい実装へ継承する」ことを防ぐ。
 * 実行実績そのものは各サービスが保持するが、現在版と過去版を照合できる共通の
 * version ledgerをここに集約する。VERIFIED化や実装変更の権限は持たない。
 */
export class ComponentVersionHistoryService {
  private static instance: ComponentVersionHistoryService;
  private readonly storageKey = 'miki_component_version_history_v1';
  private records: ComponentVersionRecord[] = [];

  private constructor() { this.load(); }

  public static getInstance(): ComponentVersionHistoryService {
    return this.instance || (this.instance = new ComponentVersionHistoryService());
  }

  public record(input: Omit<ComponentVersionRecord, 'version_record_id' | 'changed_at'>): ComponentVersionRecord {
    const existing = this.records.find(r =>
      r.component_id === input.component_id &&
      r.version === input.version &&
      r.implementation_hash === input.implementation_hash
    );
    if (existing) return existing;

    const previous = this.getCurrentRecord(input.component_id);
    const now = Date.now();
    const changeType: ComponentVersionChangeType = !previous
      ? 'CREATED'
      : previous.implementation_hash === input.implementation_hash
        ? 'REACTIVATED'
        : 'UPDATED';

    const record: ComponentVersionRecord = {
      ...input,
      version_record_id: `CVH-${this.hash(`${input.component_id}|${input.version}|${input.implementation_hash}|${now}`)}`,
      changed_at: now,
      change_type: input.change_type || changeType,
      previous_version: input.previous_version || previous?.version,
      previous_implementation_hash: input.previous_implementation_hash || previous?.implementation_hash,
    };

    this.records.unshift(record);
    if (previous && previous.version_record_id !== record.version_record_id && previous.status !== 'SUPERSEDED') {
      previous.status = 'SUPERSEDED';
      previous.change_type = 'SUPERSEDED';
    }
    this.records = this.records.slice(0, 5000);
    this.save();
    systemLogger.info('TOOLS', `🧬 [ComponentVersion] ${record.component_id}: ${record.version} / ${record.implementation_hash} (${record.change_type})`);
    return record;
  }

  public getCurrentRecord(componentId: string): ComponentVersionRecord | undefined {
    return this.records
      .filter(r => r.component_id === componentId && r.status !== 'SUPERSEDED')
      .sort((a, b) => b.changed_at - a.changed_at)[0];
  }

  /** Registry復元時に、まだ台帳へ記録されていない現行Componentを一度だけ取り込む。 */
  public reconcileCurrent(components: Array<{
    component_id: string;
    version: string;
    implementation_hash: string;
    validation_hash: string;
    status: string;
  }>): { created: number } {
    let created = 0;
    for (const component of components) {
      if (!component.component_id || !component.version || !component.implementation_hash) continue;
      if (this.get(component.component_id, component.version, component.implementation_hash)) continue;
      this.record({
        component_id: component.component_id,
        version: component.version,
        implementation_hash: component.implementation_hash,
        validation_hash: component.validation_hash,
        status: component.status,
        change_type: 'CREATED',
        reason: 'Existing Registry state reconciled into the version ledger.',
      });
      created++;
    }
    return { created };
  }

  public updateStatus(componentId: string, version: string, implementationHash: string, status: string, reason: string): ComponentVersionRecord | undefined {
    const record = this.get(componentId, version, implementationHash);
    if (!record) {
      return this.record({
        component_id: componentId,
        version,
        implementation_hash: implementationHash,
        validation_hash: '',
        status,
        change_type: 'CREATED',
        reason,
      });
    }
    record.status = status;
    record.reason = reason || record.reason;
    record.changed_at = Date.now();
    this.save();
    return record;
  }

  public get(componentId: string, version: string, implementationHash?: string): ComponentVersionRecord | undefined {
    return this.records.find(r =>
      r.component_id === componentId &&
      r.version === version &&
      (!implementationHash || r.implementation_hash === implementationHash)
    );
  }

  public list(componentId?: string): ComponentVersionRecord[] {
    return this.records
      .filter(r => !componentId || r.component_id === componentId)
      .sort((a, b) => b.changed_at - a.changed_at);
  }

  /** 現在版だけが過去実績を継承可能であることを機械的に判定する。 */
  public isCurrent(componentId: string, version: string, implementationHash: string): boolean {
    const current = this.getCurrentRecord(componentId);
    return !!current && current.version === version && current.implementation_hash === implementationHash && current.status !== 'SUPERSEDED';
  }

  private load(): void {
    try {
      const raw = storageService.getItem(this.storageKey);
      if (raw) this.records = JSON.parse(raw) as ComponentVersionRecord[];
      if (!Array.isArray(this.records)) this.records = [];
    } catch { this.records = []; }
  }

  private save(): void {
    try { storageService.setItem(this.storageKey, JSON.stringify(this.records)); } catch { /* storage is optional */ }
  }

  private hash(raw: string): string {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const componentVersionHistoryService = ComponentVersionHistoryService.getInstance();
