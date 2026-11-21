import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { sha256HexFromText } from '../miki/core/services/canonicalSha256Service';

export interface GitHubSyncFile {
  path: string;
  content: string;
  sha256: string;
  blobSha?: string;
}

export interface GitHubSyncState {
  repository: string;
  branch: string;
  commitSha: string;
  treeSha: string;
  complete: boolean;
  files: GitHubSyncFile[];
  syncedAt: number;
  source?: 'GITHUB' | 'BUNDLED_SEED';
}

export type GitHubSyncDiagnosticStatus =
  | 'READY'
  | 'KEY_MISSING'
  | 'JSON_INVALID'
  | 'STATE_INVALID'
  | 'INCOMPLETE'
  | 'FILES_EMPTY';

export interface GitHubSyncDiagnostic {
  status: GitHubSyncDiagnosticStatus;
  diagnosticCode: string;
  key: string;
  repository: string;
  branch: string;
  backend: ReturnType<typeof storageService.getBackendName>;
  rawPresent: boolean;
  complete: boolean;
  fileCount: number;
  source?: GitHubSyncState['source'];
  commitSha?: string;
  treeSha?: string;
  syncedAt?: number;
  error?: string;
}


const KEY_PREFIX = 'miki_github_sync_v2_';
// P1118: 分割保存（P1112方式）。従来はワークスペース全体を1キーに
// JSON で丸ごと保存しており（実機で約21.5M）、読み書きのたびに全体の
// パースと書き戻しが走っていた。マニフェスト（メタのみ）＋ファイル
// 単位キーに分け、保存は変更ファイルだけに、読みは必要時だけにする。
const MANIFEST_PREFIX = 'miki_github_sync_manifest_v3_';
const FILE_PREFIX = 'miki_github_sync_file_v3_';

interface SplitManifestFile {
  path: string;
  sha256: string;
  blobSha?: string;
}

interface SplitManifest {
  repository: string;
  branch: string;
  commitSha: string;
  treeSha: string;
  complete: boolean;
  source?: 'GITHUB' | 'BUNDLED_SEED';
  syncedAt: number;
  files: SplitManifestFile[];
}

function normalizeRepository(repository: string): string {
  return repository
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/g, '');
}

function makeKey(repository: string, branch: string): string {
  return `${KEY_PREFIX}${encodeURIComponent(normalizeRepository(repository))}_${encodeURIComponent(branch.trim())}`;
}

function makeManifestKey(repository: string, branch: string): string {
  return `${MANIFEST_PREFIX}${encodeURIComponent(normalizeRepository(repository))}_${encodeURIComponent(branch.trim())}`;
}

function makeFileKey(repository: string, branch: string, path: string): string {
  return `${FILE_PREFIX}${encodeURIComponent(normalizeRepository(repository))}_${encodeURIComponent(branch.trim())}:${encodeURIComponent(path)}`;
}

function hashContent(content: string): string {
  return sha256HexFromText(content);
}

function normalizeFiles(
  files: Array<{
    path: string;
    content: string;
    blobSha?: string;
  }>
): GitHubSyncFile[] {
  const map = new Map<string, GitHubSyncFile>();

  for (const file of files) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      continue;
    }

    const path = file.path.replace(/^\/+/, '');
    if (!path) continue;

    map.set(path, {
      path,
      content: file.content,
      sha256: hashContent(file.content),
      blobSha:
        typeof file.blobSha === 'string' && file.blobSha
          ? file.blobSha
          : undefined,
    });
  }

  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

class GitHubSyncService {
  get(repository: string, branch: string): GitHubSyncState | undefined {
    // P1118: 分割保存があればそちらから読む。無ければ旧キー（丸ごと
    // 保存）を読み、初回に分割へ移行して旧キーを消す。
    const split = this.readSplitState(repository, branch);
    if (split) return split;
    const legacy = this.readLegacyState(repository, branch);
    if (legacy) {
      try {
        this.writeSplit(legacy);
        storageService.removeItem(makeKey(repository, branch));
      } catch { /* 移行は補助経路：読めた内容はそのまま返す */ }
      return legacy;
    }
    return undefined;
  }

  /** P1123: マニフェスト（パス＋ハッシュ）だけを読む。内容は読まない。 */
  manifest(repository: string, branch: string): SplitManifest | undefined {
    const split = this.readManifest(repository, branch);
    if (split) return split;
    const legacy = this.readLegacyState(repository, branch);
    if (!legacy) return undefined;
    try {
      this.writeSplit(legacy);
      storageService.removeItem(makeKey(repository, branch));
    } catch { /* 移行は補助経路 */ }
    return {
      repository: normalizeRepository(repository),
      branch: branch.trim(),
      commitSha: legacy.commitSha,
      treeSha: legacy.treeSha,
      complete: legacy.complete,
      source: legacy.source,
      syncedAt: legacy.syncedAt,
      files: legacy.files.map((file) => ({ path: file.path, sha256: file.sha256, blobSha: file.blobSha })),
    };
  }

  /** P1123: 1ファイルの内容だけを読む（全体の組み立てをしない）。 */
  readFileContent(repository: string, branch: string, path: string): string | undefined {
    try {
      const raw = storageService.getItem(makeFileKey(repository, branch, path));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.content === 'string') return parsed.content;
      }
    } catch { /* 下の全体読みへ落とす */ }
    const state = this.get(repository, branch);
    return state?.files.find((file) => file.path === path)?.content;
  }

  private readManifest(repository: string, branch: string): SplitManifest | undefined {
    try {
      const raw = storageService.getItem(makeManifestKey(repository, branch));
      if (!raw) return undefined;
      const value = JSON.parse(raw);
      if (!value || !Array.isArray(value.files)) return undefined;
      const files = value.files.filter(
        (file: any) => file && typeof file.path === 'string' && typeof file.sha256 === 'string'
      );
      if (files.length !== value.files.length) return undefined;
      return {
        repository: normalizeRepository(repository),
        branch: branch.trim(),
        commitSha: String(value.commitSha || ''),
        treeSha: String(value.treeSha || ''),
        complete: value.complete === true,
        source: value.source === 'BUNDLED_SEED' ? 'BUNDLED_SEED' : 'GITHUB',
        syncedAt: Number(value.syncedAt || 0),
        files: files.map((file: any) => ({
          path: file.path,
          sha256: file.sha256,
          blobSha: typeof file.blobSha === 'string' ? file.blobSha : undefined,
        })),
      };
    } catch {
      return undefined;
    }
  }

  private readSplitState(repository: string, branch: string): GitHubSyncState | undefined {
    const manifest = this.readManifest(repository, branch);
    if (!manifest) return undefined;
    try {
      const files: GitHubSyncFile[] = [];
      for (const entry of manifest.files) {
        const raw = storageService.getItem(makeFileKey(repository, branch, entry.path));
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.content !== 'string') return undefined;
        files.push({ path: entry.path, content: parsed.content, sha256: entry.sha256, blobSha: entry.blobSha });
      }
      return {
        repository: manifest.repository,
        branch: manifest.branch,
        commitSha: manifest.commitSha,
        treeSha: manifest.treeSha,
        complete: manifest.complete,
        source: manifest.source,
        files,
        syncedAt: manifest.syncedAt,
      };
    } catch {
      return undefined;
    }
  }

  private writeSplit(state: GitHubSyncState): void {
    const previous = this.readManifest(state.repository, state.branch);
    const previousSha = new Map<string, string>((previous?.files || []).map((f) => [f.path, f.sha256]));
    const nextPaths = new Set<string>();
    for (const file of state.files) {
      nextPaths.add(file.path);
      if (previousSha.get(file.path) !== file.sha256) {
        storageService.setItem(
          makeFileKey(state.repository, state.branch, file.path),
          JSON.stringify({ content: file.content })
        );
      }
    }
    for (const old of previous?.files || []) {
      if (!nextPaths.has(old.path)) {
        storageService.removeItem(makeFileKey(state.repository, state.branch, old.path));
      }
    }
    const manifest: SplitManifest = {
      repository: normalizeRepository(state.repository),
      branch: state.branch.trim(),
      commitSha: state.commitSha,
      treeSha: state.treeSha,
      complete: state.complete,
      source: state.source,
      syncedAt: state.syncedAt,
      files: state.files.map((file) => ({ path: file.path, sha256: file.sha256, blobSha: file.blobSha })),
    };
    storageService.setItem(makeManifestKey(state.repository, state.branch), JSON.stringify(manifest));
  }

  private readLegacyState(repository: string, branch: string): GitHubSyncState | undefined {
    try {
      const raw = storageService.getItem(makeKey(repository, branch));
      if (!raw) return undefined;

      const value = JSON.parse(raw);

      if (!value || !Array.isArray(value.files)) {
        return undefined;
      }

      return {
        repository: normalizeRepository(repository),
        branch: branch.trim(),
        commitSha: String(value.commitSha || ''),
        treeSha: String(value.treeSha || ''),
        complete: value.complete === true,
        source:
          value.source === 'BUNDLED_SEED'
            ? 'BUNDLED_SEED'
            : 'GITHUB',
        files: value.files
          .filter(
            (file: any) =>
              file &&
              typeof file.path === 'string' &&
              typeof file.content === 'string'
          )
          .map((file: any) => ({
            path: file.path,
            content: file.content,
            sha256:
              typeof file.sha256 === 'string'
                ? file.sha256
                : hashContent(file.content),
            blobSha:
              typeof file.blobSha === 'string'
                ? file.blobSha
                : undefined,
          })),
        syncedAt: Number(value.syncedAt || 0),
      };
    } catch {
      return undefined;
    }
  }

  private save(state: GitHubSyncState): GitHubSyncState {
    // P1132: ネイティブへの書き写し用に、保存前のマニフェストを覚える。
    let prevFiles: Array<{ path: string; sha256: string }> = [];
    try { prevFiles = this.readManifest(state.repository, state.branch)?.files ?? []; } catch { prevFiles = []; }
    // P1118: 分割保存へ書く（変更ファイル＋マニフェストのみ）。
    // 旧キーが残っていたら移行済みとして消す。
    this.writeSplit(state);
    try {
      if (storageService.getItem(makeKey(state.repository, state.branch))) {
        storageService.removeItem(makeKey(state.repository, state.branch));
      }
    } catch { /* 旧キーの掃除は補助経路 */ }
    this.mirrorToNative(state, prevFiles);

    return state;
  }

  /**
   * P1132: 保存後の状態をネイティブのワークスペースへ書き写す。
   * 正本は IndexedDB の分割保存のままで、こちらは実機のディスクを
   * 追いつかせるための写し（差分のみ・非同期・失敗しても同期は
   * 壊さない）。読みのディスク優先化は、実機ログで写しの一致が
   * 確認できてから別段で行う。
   */
  private mirrorToNative(state: GitHubSyncState, prevFiles: Array<{ path: string; sha256: string }>): void {
    void (async () => {
      try {
        const { nativeWorkspaceBridgeService } = await import('../miki/execution/services/nativeWorkspaceBridgeService');
        if (!(await nativeWorkspaceBridgeService.available())) return;
        const prev = new Map(prevFiles.map((file) => [file.path, file.sha256]));
        const next = new Set(state.files.map((file) => file.path));
        let written = 0;
        let deleted = 0;
        let failed = 0;
        for (const file of state.files) {
          if (prev.get(file.path) === file.sha256) continue;
          const result = await nativeWorkspaceBridgeService.writeFile(file.path, file.content);
          if (result && result.sha256 === file.sha256) written++;
          else failed++;
        }
        for (const path of prev.keys()) {
          if (next.has(path)) continue;
          const result = await nativeWorkspaceBridgeService.deleteFile(path);
          if (result !== undefined) deleted++;
          else failed++;
        }
        systemLogger.recordRuntimeDiagnostic('NATIVE_SYNC_MIRROR', {
          repository: state.repository,
          branch: state.branch,
          written,
          deleted,
          failed,
        });
      } catch { /* 写しは補助経路 */ }
    })();
  }

  diagnose(repository: string, branch: string): GitHubSyncDiagnostic {
    const key = makeKey(repository, branch);
    const normalizedRepository = normalizeRepository(repository);
    const normalizedBranch = branch.trim();

    // P1118: 分割保存があればマニフェスト＋ファイルキーの実在で診断する。
    const manifestKey = makeManifestKey(repository, branch);
    let manifestRaw: string | null = null;
    try { manifestRaw = storageService.getItem(manifestKey); } catch { manifestRaw = null; }
    if (manifestRaw) {
      const manifest = this.readManifest(repository, branch);
      if (!manifest) {
        return {
          status: 'JSON_INVALID',
          diagnosticCode: 'SELF_CODE_SYNC_STATE_JSON_INVALID',
          key: manifestKey,
          repository: normalizedRepository,
          branch: normalizedBranch,
          backend: storageService.getBackendName(),
          rawPresent: true,
          complete: false,
          fileCount: 0,
        };
      }
      let validCount = 0;
      for (const entry of manifest.files) {
        try {
          const fr = storageService.getItem(makeFileKey(repository, branch, entry.path));
          if (fr && typeof JSON.parse(fr)?.content === 'string') validCount++;
        } catch { /* 数えない */ }
      }
      if (manifest.complete !== true) {
        return {
          status: 'INCOMPLETE',
          diagnosticCode: 'SELF_CODE_SYNC_STATE_INCOMPLETE',
          key: manifestKey,
          repository: normalizedRepository,
          branch: normalizedBranch,
          backend: storageService.getBackendName(),
          rawPresent: true,
          complete: false,
          fileCount: manifest.files.length,
          source: manifest.source,
          commitSha: manifest.commitSha,
          treeSha: manifest.treeSha,
          syncedAt: manifest.syncedAt,
        };
      }
      if (!validCount) {
        return {
          status: 'FILES_EMPTY',
          diagnosticCode: 'SELF_CODE_SYNC_FILES_EMPTY',
          key: manifestKey,
          repository: normalizedRepository,
          branch: normalizedBranch,
          backend: storageService.getBackendName(),
          rawPresent: true,
          complete: true,
          fileCount: 0,
          source: manifest.source,
          commitSha: manifest.commitSha,
          treeSha: manifest.treeSha,
          syncedAt: manifest.syncedAt,
        };
      }
      return {
        status: 'READY',
        diagnosticCode: 'SELF_CODE_WORKSPACE_READY',
        key: manifestKey,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: true,
        complete: true,
        fileCount: validCount,
        source: manifest.source,
        commitSha: manifest.commitSha,
        treeSha: manifest.treeSha,
        syncedAt: manifest.syncedAt,
      };
    }

    let raw: string | null = null;

    try {
      raw = storageService.getItem(key);
    } catch (error) {
      return {
        status: 'JSON_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STORAGE_READ_FAILED',
        key,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: false,
        complete: false,
        fileCount: 0,
        error: String(error),
      };
    }

    if (!raw) {
      return {
        status: 'KEY_MISSING',
        diagnosticCode: 'SELF_CODE_SYNC_KEY_MISSING',
        key,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: false,
        complete: false,
        fileCount: 0,
      };
    }

    let value: any;

    try {
      value = JSON.parse(raw);
    } catch (error) {
      return {
        status: 'JSON_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_JSON_INVALID',
        key,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: true,
        complete: false,
        fileCount: 0,
        error: String(error),
      };
    }

    if (!value || typeof value !== 'object') {
      return {
        status: 'STATE_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_INVALID',
        key,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: true,
        complete: false,
        fileCount: 0,
      };
    }

    if (value.complete !== true) {
      return {
        status: 'INCOMPLETE',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_INCOMPLETE',
        key,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: true,
        complete: false,
        fileCount: Array.isArray(value.files) ? value.files.length : 0,
        source:
          value.source === 'BUNDLED_SEED'
            ? 'BUNDLED_SEED'
            : 'GITHUB',
        commitSha: String(value.commitSha || ''),
        treeSha: String(value.treeSha || ''),
        syncedAt: Number(value.syncedAt || 0),
      };
    }

    if (!Array.isArray(value.files)) {
      return {
        status: 'STATE_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_INVALID',
        key,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: true,
        complete: true,
        fileCount: 0,
      };
    }

    const validFiles = value.files.filter(
      (file: any) =>
        file &&
        typeof file.path === 'string' &&
        typeof file.content === 'string'
    );

    if (!validFiles.length) {
      return {
        status: 'FILES_EMPTY',
        diagnosticCode: 'SELF_CODE_SYNC_FILES_EMPTY',
        key,
        repository: normalizedRepository,
        branch: normalizedBranch,
        backend: storageService.getBackendName(),
        rawPresent: true,
        complete: true,
        fileCount: 0,
        source:
          value.source === 'BUNDLED_SEED'
            ? 'BUNDLED_SEED'
            : 'GITHUB',
        commitSha: String(value.commitSha || ''),
        treeSha: String(value.treeSha || ''),
        syncedAt: Number(value.syncedAt || 0),
      };
    }

    return {
      status: 'READY',
      diagnosticCode: 'SELF_CODE_WORKSPACE_READY',
      key,
      repository: normalizedRepository,
      branch: normalizedBranch,
      backend: storageService.getBackendName(),
      rawPresent: true,
      complete: true,
      fileCount: validFiles.length,
      source:
        value.source === 'BUNDLED_SEED'
          ? 'BUNDLED_SEED'
          : 'GITHUB',
      commitSha: String(value.commitSha || ''),
      treeSha: String(value.treeSha || ''),
      syncedAt: Number(value.syncedAt || 0),
    };
  }

  knownFiles(
    repository: string,
    branch: string
  ): Array<{
    path: string;
    blobSha?: string;
    sha256?: string;
  }> {
    const state = this.get(repository, branch);

    if (!state) {
      return [];
    }

    if (!state.complete) {
      return [];
    }

    return state.files.map(file => ({
      path: file.path,
      blobSha: file.blobSha,
      sha256: file.sha256,
    }));
  }

  applyImport(
    repository: string,
    branch: string,
    response: {
      files: Array<{
        path: string;
        content: string;
        blobSha?: string;
        sha256?: string;
      }>;
      manifest: Array<{
        path: string;
        blobSha: string;
        sha256?: string;
      }>;
      deletedPaths: string[];
      commitSha: string;
      treeSha: string;
    }
  ): GitHubSyncState {
    const previous = this.get(repository, branch);

    const previousMap = new Map(
      (previous?.files || []).map(file => [file.path, file])
    );

    const changedMap = new Map(
      (response.files || []).map(file => [
        file.path,
        {
          path: file.path,
          content: file.content,
          sha256: file.sha256 || hashContent(file.content),
          blobSha: file.blobSha,
        },
      ])
    );

    const deleted = new Set(response.deletedPaths || []);
    const merged: GitHubSyncFile[] = [];

    for (const meta of response.manifest || []) {
      if (deleted.has(meta.path)) continue;

      const changed = changedMap.get(meta.path);
      const old = previousMap.get(meta.path);
      const content = changed?.content ?? old?.content;

      if (content === undefined) {
        throw new Error(
          `GITHUB_SYNC_CONTENT_BASE_MISSING:${meta.path}:previous=${Boolean(old)}:changed=${Boolean(changed)}:manifestBlobSha=${meta.blobSha}`
        );
      }

      merged.push({
        path: meta.path,
        content,
        sha256:
          meta.sha256 ||
          changed?.sha256 ||
          old?.sha256 ||
          hashContent(content),
        blobSha:
          meta.blobSha ||
          changed?.blobSha ||
          old?.blobSha,
      });
    }

    return this.save({
      repository: normalizeRepository(repository),
      branch: branch.trim(),
      commitSha: String(response.commitSha || ''),
      treeSha: String(response.treeSha || ''),
      complete: true,
      files: merged.sort((a, b) => a.path.localeCompare(b.path)),
      syncedAt: Date.now(),
      source: 'GITHUB',
    });
  }

  applyBundledSeed(
    repository: string,
    branch: string,
    input: {
      files: Array<{
        path: string;
        content: string;
        sha256: string;
        blobSha?: string;
      }>;
      commitSha: string;
      seedRevision: string;
    }
  ): GitHubSyncState {
    return this.save({
      repository: normalizeRepository(repository),
      branch: branch.trim(),
      commitSha: String(input.commitSha || ''),
      treeSha: String(input.seedRevision || ''),
      complete: true,
      files: normalizeFiles(input.files),
      syncedAt: Date.now(),
      source: 'BUNDLED_SEED',
    });
  }

  preparePush(
    repository: string,
    branch: string,
    files: Array<{ path: string; content: string }>
  ) {
    const previous = this.get(repository, branch);
    const current = normalizeFiles(files);

    const currentMap = new Map(
      current.map(file => [file.path, file])
    );

    const baseMap = new Map(
      (previous?.complete ? previous.files : [])
        .map(file => [file.path, file])
    );

    const changedFiles: Array<{
      path: string;
      content: string;
    }> = [];

    for (const file of current) {
      const base = baseMap.get(file.path);

      if (!base || base.sha256 !== file.sha256) {
        changedFiles.push({
          path: file.path,
          content: file.content,
        });
      }
    }

    const deletedPaths = previous?.complete
      ? [...baseMap.keys()]
          .filter(path => !currentMap.has(path))
          .sort()
      : [];

    return {
      changedFiles,
      deletedPaths,
      expectedBaseCommitSha: previous?.complete
        ? previous.commitSha
        : undefined,
    };
  }

  applyPushResult(
    repository: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    result: {
      commitSha: string;
      treeSha?: string;
      changedFilesMeta?: Array<{
        path: string;
        blobSha?: string;
        sha256?: string;
      }>;
    }
  ): GitHubSyncState {
    const previous = this.get(repository, branch);
    const current = normalizeFiles(files);

    const metaMap = new Map(
      (result.changedFilesMeta || []).map(item => [
        item.path,
        item,
      ])
    );

    const previousMap = new Map(
      (previous?.files || []).map(file => [
        file.path,
        file,
      ])
    );

    const nextFiles = current.map(file => {
      const previousFile = previousMap.get(file.path);
      const meta = metaMap.get(file.path);

      return {
        ...file,
        blobSha:
          meta?.blobSha ||
          previousFile?.blobSha,
      };
    });

    return this.save({
      repository: normalizeRepository(repository),
      branch: branch.trim(),
      commitSha: String(
        result.commitSha ||
        previous?.commitSha ||
        ''
      ),
      treeSha: String(
        result.treeSha ||
        previous?.treeSha ||
        ''
      ),
      complete: true,
      files: nextFiles,
      syncedAt: Date.now(),
      source: 'GITHUB',
    });
  }
}

export const githubSyncService =
  new GitHubSyncService();
