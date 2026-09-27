import { storageService } from './storageService';
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
    storageService.setItem(
      makeKey(state.repository, state.branch),
      JSON.stringify(state)
    );

    return state;
  }

  diagnose(repository: string, branch: string): GitHubSyncDiagnostic {
    const key = makeKey(repository, branch);
    const normalizedRepository = normalizeRepository(repository);
    const normalizedBranch = branch.trim();

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
