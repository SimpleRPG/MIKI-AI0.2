import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

// P378: preservation of what MIKI has learned. The accumulated
// experience, lessons, promoted knowledge, cases, evidence and
// prediction history live only in this device's storage. The source
// code can be re-fetched from GitHub and the understanding index can
// be rebuilt, but learned state cannot be re-derived — losing the
// device would lose the growth itself. This service exports the
// learned state as a single ZIP the user can move by hand (no
// continuous sync, so nothing grows in any repository), and imports
// it back with hash verification. Only the registered keys below can
// ever be written by an import; operational state (queues, runs,
// workspaces, receipts) and re-derivable state (source snapshot,
// understanding index) are deliberately not part of the archive.
export interface LearningArchiveEntry {
  key: string;
  label: string;
  bytes: number;
  sha256: string;
}
export interface LearningArchiveManifest {
  format: 'miki-learning-archive';
  version: 1;
  exportedAt: number;
  totalBytes: number;
  entries: LearningArchiveEntry[];
}

const REGISTRY: Array<{ key: string; label: string }> = [
  { key: 'miki_unified_learning_continuum_v1', label: '学習の連続体（経験・教訓・確かさ）' },
  { key: 'miki_unified_experience_v1', label: '統合経験（自己コード経験を含む）' },
  { key: 'miki_task_case_memory_v1', label: '解けた事例の記憶' },
  { key: 'miki_outcome_predictions_v1', label: '結果予測と校正の履歴' },
  { key: 'miki_verified_knowledge_promotions_v1', label: '検証を経て昇格した知識' },
  { key: 'miki_knowledge_os_v1', label: '知識ストア' },
  { key: 'miki_claim_db_v1', label: '主張と検証状態' },
  { key: 'miki_evidence_db_v1', label: '証拠' },
  { key: 'miki_causal_memory_ledger_v1', label: '因果の台帳' },
  { key: 'miki_causal_investigations_v1', label: '原因の仮説と観測' },
  { key: 'miki_failure_signatures_v51', label: '失敗カタログ' },
  { key: 'miki_verified_capabilities_v1', label: '検証済み能力' },
  { key: 'miki_development_outcome_learning_v1', label: '開発結果からの学習' },
  { key: 'miki:p214:conversation-graph', label: '会話グラフ（育つ関連）' },
];
const BACKUP_KEY = 'miki_learning_archive_pre_import_backup_v1';
const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;
const entryFileName = (key: string): string => `state/${key.replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`;

class LearningStateArchiveService {
  registeredKeys(): string[] {
    return REGISTRY.map(item => item.key);
  }

  inspectLocalState(): Array<{ key: string; label: string; present: boolean; bytes: number }> {
    return REGISTRY.map(item => {
      const raw = storageService.getItem(item.key);
      return { key: item.key, label: item.label, present: raw !== null, bytes: raw ? utf8Bytes(raw) : 0 };
    });
  }

  async exportArchive(): Promise<{ blob: Blob; fileName: string; manifest: LearningArchiveManifest }> {
    const entries: LearningArchiveEntry[] = [];
    const zip = new JSZip();
    for (const item of REGISTRY) {
      const raw = storageService.getItem(item.key);
      if (raw === null) continue;
      entries.push({ key: item.key, label: item.label, bytes: utf8Bytes(raw), sha256: canonicalSha256(raw) });
      zip.file(entryFileName(item.key), raw);
    }
    const manifest: LearningArchiveManifest = {
      format: 'miki-learning-archive',
      version: 1,
      exportedAt: Date.now(),
      totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      entries,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file(
      'README.txt',
      [
        'MIKI 学習アーカイブ',
        '',
        'このZIPは、MIKIがこの端末で学んだ内容（経験・教訓・知識・事例・証拠・予測の履歴）を',
        'まとめたものです。自己コードや理解索引は含まれていません（GitHubから再取得・再構築できます）。',
        '別の端末へ移す、または復元するには、MIKIの「改善」タブ→「学習の保全」でこのZIPを読み込んでください。',
        '読み込み前の状態は自動で控えられ、元に戻すこともできます。',
      ].join('\n')
    );
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const stamp = new Date(manifest.exportedAt).toISOString().slice(0, 10);
    return { blob, fileName: `MIKI-learning-archive-${stamp}.zip`, manifest };
  }

  async inspectArchive(blob: Blob): Promise<{ ok: boolean; message: string; manifest?: LearningArchiveManifest }> {
    try {
      const zip = await JSZip.loadAsync(blob);
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) return { ok: false, message: 'manifest.json がありません' };
      const manifest = JSON.parse(await manifestFile.async('string')) as LearningArchiveManifest;
      if (manifest.format !== 'miki-learning-archive' || manifest.version !== 1 || !Array.isArray(manifest.entries)) {
        return { ok: false, message: 'MIKI学習アーカイブの形式ではありません' };
      }
      return { ok: true, message: '読み込み可能な学習アーカイブです', manifest };
    } catch (error) {
      return { ok: false, message: `アーカイブを読めません: ${String(error instanceof Error ? error.message : error)}` };
    }
  }

  async importArchive(blob: Blob): Promise<{ ok: boolean; message: string; restored: string[] }> {
    const inspected = await this.inspectArchive(blob);
    if (!inspected.ok || !inspected.manifest) return { ok: false, message: inspected.message, restored: [] };
    const zip = await JSZip.loadAsync(blob);
    const allowed = new Set(REGISTRY.map(item => item.key));
    // Verify everything before writing anything.
    const writes: Array<{ key: string; raw: string }> = [];
    for (const entry of inspected.manifest.entries) {
      if (!allowed.has(entry.key)) continue;
      const file = zip.file(entryFileName(entry.key));
      if (!file) return { ok: false, message: `項目が欠けています: ${entry.key}`, restored: [] };
      const raw = await file.async('string');
      if (canonicalSha256(raw) !== entry.sha256) {
        return { ok: false, message: `ハッシュが一致しません（破損の可能性）: ${entry.key}`, restored: [] };
      }
      writes.push({ key: entry.key, raw });
    }
    if (!writes.length) return { ok: false, message: '復元できる項目がありません', restored: [] };
    // Keep a rollback copy of the current values first.
    const backup: Record<string, string | null> = {};
    for (const write of writes) backup[write.key] = storageService.getItem(write.key);
    try {
      storageService.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), values: backup }));
    } catch {
      return { ok: false, message: '復元前の控えを保存できなかったため、中止しました', restored: [] };
    }
    for (const write of writes) storageService.setItem(write.key, write.raw);
    return {
      ok: true,
      message: `${writes.length}件の学習状態を復元しました。各サービスの読み直しのため、アプリを再起動してください`,
      restored: writes.map(write => write.key),
    };
  }

  hasPreImportBackup(): boolean {
    try {
      return storageService.getItem(BACKUP_KEY) !== null;
    } catch {
      return false;
    }
  }

  rollbackImport(): { ok: boolean; message: string } {
    try {
      const raw = storageService.getItem(BACKUP_KEY);
      if (!raw) return { ok: false, message: '復元前の控えがありません' };
      const parsed = JSON.parse(raw) as { values?: Record<string, string | null> };
      const values = parsed.values || {};
      for (const [key, value] of Object.entries(values)) {
        if (value === null) storageService.removeItem(key);
        else storageService.setItem(key, value);
      }
      storageService.removeItem(BACKUP_KEY);
      return { ok: true, message: '読み込み前の状態に戻しました。アプリを再起動してください' };
    } catch (error) {
      return { ok: false, message: `巻き戻しに失敗しました: ${String(error instanceof Error ? error.message : error)}` };
    }
  }
}

export const learningStateArchiveService = new LearningStateArchiveService();
