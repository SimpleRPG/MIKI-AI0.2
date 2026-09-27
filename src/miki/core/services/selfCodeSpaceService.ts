import { storageService } from '../../../services/storageService';
import {
  apiService,
  type GitHubPullProgressUpdate,
} from '../../../services/api';
import { canonicalSha256, sha256HexFromText } from './canonicalSha256Service';
import { githubSyncService } from '../../../services/githubSyncService';
import type { GitHubSyncDiagnosticStatus } from '../../../services/githubSyncService';

export interface SelfCodeFile {
  path: string;
  content: string;
  sha256: string;
  blobSha?: string;
}

export interface SelfCodeSeedProgress {
  phase: 'FETCH' | 'VERIFY' | 'APPLY' | 'FALLBACK' | 'COMPLETE';
  completed?: number;
  total?: number;
  detail: string;
}

export interface SelfCodeSnapshot {
  repository: string;
  branch: string;
  repoSha256: string;
  files: SelfCodeFile[];
  syncedAt: number;
  dirty?: boolean;
  baseRepoSha256?: string;
  source?: 'BUNDLED_SEED' | 'GITHUB';
}

const KEY = 'miki_self_code_space_v1';
const SETTINGS_KEY = 'miki_self_code_github_settings_v1';
const SEED_APPLIED_KEY = 'miki_self_code_seed_revision_v1';
const DEFAULT_REPOSITORY = 'SimpleRPG/MIKI-AI0.2';
const DEFAULT_BRANCH = 'main';
export interface SelfCodeGitHubSettings { repository:string; branch:string; commitMessage:string; }

const WORKSPACE_DIAGNOSTIC_KEY = 'miki_self_code_workspace_diagnostic_v1';

export interface SelfCodeWorkspaceDiagnostic {
  status:
    | 'READY'
    | 'DIRTY'
    | 'KEY_MISSING'
    | 'JSON_INVALID'
    | 'STATE_INVALID'
    | 'INCOMPLETE'
    | 'FILES_EMPTY'
    | 'PERSISTENT_BACKEND_MEMORY'
    | 'NO_SOURCE';
  diagnosticCode: string;
  summary: string;
  nextAction: string;
  backend: ReturnType<typeof storageService.getBackendName>;
  repository: string;
  branch: string;
  fileCount: number;
  syncKey?: string;
  commitSha?: string;
  treeSha?: string;
  seedRevision?: string;
  seedError?: string;
  fallbackError?: string;
  recordedAt: number;
}


class SelfCodeSpaceService {
  getGitHubSettings(): SelfCodeGitHubSettings {
    try {
      const raw=storageService.getItem(SETTINGS_KEY);
      if(raw){const v=JSON.parse(raw);if(v?.repository&&v?.branch&&v?.commitMessage)return v;}
    } catch {}
    return {repository:DEFAULT_REPOSITORY,branch:DEFAULT_BRANCH,commitMessage:'Update self code space'};
  }
  saveGitHubSettings(input:Partial<SelfCodeGitHubSettings>):SelfCodeGitHubSettings {
    const c=this.getGitHubSettings();
    const next={repository:String(input.repository??c.repository).trim(),branch:String(input.branch??c.branch).trim(),commitMessage:String(input.commitMessage??c.commitMessage).trim()};
    if(!next.repository||!next.branch||!next.commitMessage)throw new Error('SELF_CODE_GITHUB_SETTINGS_REQUIRED');
    storageService.setItem(SETTINGS_KEY,JSON.stringify(next));return next;
  }

  getGitHubPat(): string {
    return storageService.getItem('miki_self_code_github_pat') || '';
  }

  saveGitHubPat(token: string): string {
    const value=token.trim();
    if(value) storageService.setItem('miki_self_code_github_pat',value);
    else storageService.removeItem('miki_self_code_github_pat');
    return value;
  }

  getWorkspaceDiagnostic(): SelfCodeWorkspaceDiagnostic {
    const settings = this.getGitHubSettings();
    const backend = storageService.getBackendName();

    if (backend === 'memory') {
      const diagnostic: SelfCodeWorkspaceDiagnostic = {
        status: 'PERSISTENT_BACKEND_MEMORY',
        diagnosticCode: 'SELF_CODE_PERSISTENT_BACKEND_MEMORY',
        summary: '永続Storageではなくmemory backendで動作しています。',
        nextAction: 'Storage初期化・永続化状態を確認してから自己コードWorkspaceを再同期します。',
        backend,
        repository: settings.repository,
        branch: settings.branch,
        fileCount: 0,
        recordedAt: Date.now(),
      };
      this.saveWorkspaceDiagnostic(diagnostic);
      return diagnostic;
    }

    const raw = storageService.getItem(KEY);

    if (raw) {
      try {
        const value = JSON.parse(raw);

        if (value?.files && value?.dirty === true) {
          const diagnostic: SelfCodeWorkspaceDiagnostic = {
            status: 'DIRTY',
            diagnosticCode: 'SELF_CODE_WORKSPACE_DIRTY',
            summary: '自己コードWorkspaceに未反映の変更があります。',
            nextAction: '変更内容を保持したまま検証・PUSH判断を行います。',
            backend,
            repository: settings.repository,
            branch: settings.branch,
            fileCount: Array.isArray(value.files) ? value.files.length : 0,
            recordedAt: Date.now(),
          };
          this.saveWorkspaceDiagnostic(diagnostic);
          return diagnostic;
        }
      } catch (error) {
        const diagnostic: SelfCodeWorkspaceDiagnostic = {
          status: 'JSON_INVALID',
          diagnosticCode: 'SELF_CODE_SYNC_STATE_JSON_INVALID',
          summary: '自己コードWorkspaceの作業状態JSONを読み取れません。',
          nextAction: 'clean snapshotの診断を確認し、必要ならSeed再適用またはGitHub PULLを行います。',
          backend,
          repository: settings.repository,
          branch: settings.branch,
          fileCount: 0,
          seedError: String(error),
          recordedAt: Date.now(),
        };
        this.saveWorkspaceDiagnostic(diagnostic);
        return diagnostic;
      }
    }

    const sync = githubSyncService.diagnose(
      settings.repository,
      settings.branch
    );

    const mapped: Record<
      GitHubSyncDiagnosticStatus,
      {
        status: SelfCodeWorkspaceDiagnostic['status'];
        diagnosticCode: string;
        summary: string;
        nextAction: string;
      }
    > = {
      READY: {
        status: 'READY',
        diagnosticCode: 'SELF_CODE_WORKSPACE_READY',
        summary: '自己コードWorkspaceは正常なclean snapshotです。',
        nextAction: 'そのまま自己改善処理へ進めます。',
      },
      KEY_MISSING: {
        status: 'KEY_MISSING',
        diagnosticCode: 'SELF_CODE_SYNC_KEY_MISSING',
        summary: 'GitHub同期のclean snapshotキーがStorageに存在しません。',
        nextAction: '同梱Seed再適用またはGitHub PULLを実行します。',
      },
      JSON_INVALID: {
        status: 'JSON_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_JSON_INVALID',
        summary: 'GitHub同期状態のJSONを読み取れません。',
        nextAction: '同梱Seed再適用またはGitHub PULLでclean snapshotを再構築します。',
      },
      STATE_INVALID: {
        status: 'STATE_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_INVALID',
        summary: 'GitHub同期状態の構造が不正です。',
        nextAction: '同梱Seed再適用またはGitHub PULLでclean snapshotを再構築します。',
      },
      INCOMPLETE: {
        status: 'INCOMPLETE',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_INCOMPLETE',
        summary: 'GitHub同期状態は存在しますがcompleteではありません。',
        nextAction: '同期処理を再実行してcompleteなsnapshotを作成します。',
      },
      FILES_EMPTY: {
        status: 'FILES_EMPTY',
        diagnosticCode: 'SELF_CODE_SYNC_FILES_EMPTY',
        summary: '同期状態はcompleteですが有効なソースファイルがありません。',
        nextAction: 'Seed内容またはGitHub PULL結果を再確認して再同期します。',
      },
    };

    const state = mapped[sync.status];

    const diagnostic: SelfCodeWorkspaceDiagnostic = {
      status: state.status,
      diagnosticCode: state.diagnosticCode,
      summary: state.summary,
      nextAction: state.nextAction,
      backend,
      repository: sync.repository,
      branch: sync.branch,
      fileCount: sync.fileCount,
      syncKey: sync.key,
      commitSha: sync.commitSha,
      treeSha: sync.treeSha,
      recordedAt: Date.now(),
    };

    this.saveWorkspaceDiagnostic(diagnostic);
    return diagnostic;
  }

  getLastWorkspaceDiagnostic(): SelfCodeWorkspaceDiagnostic | undefined {
    try {
      const raw = storageService.getItem(WORKSPACE_DIAGNOSTIC_KEY);
      if (!raw) return undefined;
      return JSON.parse(raw) as SelfCodeWorkspaceDiagnostic;
    } catch {
      return undefined;
    }
  }

  private saveWorkspaceDiagnostic(
    diagnostic: SelfCodeWorkspaceDiagnostic
  ): void {
    storageService.setItem(
      WORKSPACE_DIAGNOSTIC_KEY,
      JSON.stringify(diagnostic)
    );
  }


  getWorkspaceDiagnostic(): SelfCodeWorkspaceDiagnostic {
    const settings = this.getGitHubSettings();
    const backend = storageService.getBackendName();

    if (backend === 'memory') {
      const diagnostic: SelfCodeWorkspaceDiagnostic = {
        status: 'PERSISTENT_BACKEND_MEMORY',
        diagnosticCode: 'SELF_CODE_PERSISTENT_BACKEND_MEMORY',
        summary: '永続Storageではなくmemory backendで動作しています。',
        nextAction: 'Storage初期化・永続化状態を確認してから自己コードWorkspaceを再同期します。',
        backend,
        repository: settings.repository,
        branch: settings.branch,
        fileCount: 0,
        recordedAt: Date.now(),
      };
      this.saveWorkspaceDiagnostic(diagnostic);
      return diagnostic;
    }

    const raw = storageService.getItem(KEY);
    if (raw) {
      try {
        const value = JSON.parse(raw);
        if (value?.files && value?.dirty === true) {
          const diagnostic: SelfCodeWorkspaceDiagnostic = {
            status: 'DIRTY',
            diagnosticCode: 'SELF_CODE_WORKSPACE_DIRTY',
            summary: '自己コードWorkspaceに未反映の変更があります。',
            nextAction: '変更内容を保持したまま検証・PUSH判断を行います。',
            backend,
            repository: settings.repository,
            branch: settings.branch,
            fileCount: Array.isArray(value.files) ? value.files.length : 0,
            recordedAt: Date.now(),
          };
          this.saveWorkspaceDiagnostic(diagnostic);
          return diagnostic;
        }
      } catch {
        const diagnostic: SelfCodeWorkspaceDiagnostic = {
          status: 'JSON_INVALID',
          diagnosticCode: 'SELF_CODE_SYNC_STATE_JSON_INVALID',
          summary: '自己コードWorkspaceの作業状態JSONを読み取れません。',
          nextAction: 'clean snapshotの診断を確認し、必要ならSeed再適用またはGitHub PULLを行います。',
          backend,
          repository: settings.repository,
          branch: settings.branch,
          fileCount: 0,
          recordedAt: Date.now(),
        };
        this.saveWorkspaceDiagnostic(diagnostic);
        return diagnostic;
      }
    }

    const sync = githubSyncService.diagnose(
      settings.repository,
      settings.branch
    );

    const diagnosticMap: Record<string, {
      status: SelfCodeWorkspaceDiagnostic['status'];
      diagnosticCode: string;
      summary: string;
      nextAction: string;
    }> = {
      READY: {
        status: 'READY',
        diagnosticCode: 'SELF_CODE_WORKSPACE_READY',
        summary: '自己コードWorkspaceは正常なclean snapshotです。',
        nextAction: 'そのまま自己改善処理へ進めます。',
      },
      KEY_MISSING: {
        status: 'KEY_MISSING',
        diagnosticCode: 'SELF_CODE_SYNC_KEY_MISSING',
        summary: 'GitHub同期のclean snapshotキーがStorageに存在しません。',
        nextAction: '同梱Seed再適用またはGitHub PULLを実行します。',
      },
      JSON_INVALID: {
        status: 'JSON_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_JSON_INVALID',
        summary: 'GitHub同期状態のJSONを読み取れません。',
        nextAction: '同梱Seed再適用またはGitHub PULLでclean snapshotを再構築します。',
      },
      STATE_INVALID: {
        status: 'STATE_INVALID',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_INVALID',
        summary: 'GitHub同期状態の構造が不正です。',
        nextAction: '同梱Seed再適用またはGitHub PULLでclean snapshotを再構築します。',
      },
      INCOMPLETE: {
        status: 'INCOMPLETE',
        diagnosticCode: 'SELF_CODE_SYNC_STATE_INCOMPLETE',
        summary: 'GitHub同期状態は存在しますがcompleteではありません。',
        nextAction: '同期処理を再実行してcompleteなsnapshotを作成します。',
      },
      FILES_EMPTY: {
        status: 'FILES_EMPTY',
        diagnosticCode: 'SELF_CODE_SYNC_FILES_EMPTY',
        summary: '同期状態はcompleteですが有効なソースファイルがありません。',
        nextAction: 'Seed内容またはGitHub PULL結果を再確認して再同期します。',
      },
    };

    const mapped = diagnosticMap[sync.status];
    const diagnostic: SelfCodeWorkspaceDiagnostic = {
      status: mapped.status,
      diagnosticCode: mapped.diagnosticCode,
      summary: mapped.summary,
      nextAction: mapped.nextAction,
      backend,
      repository: sync.repository,
      branch: sync.branch,
      fileCount: sync.fileCount,
      syncKey: sync.key,
      commitSha: sync.commitSha,
      treeSha: sync.treeSha,
      recordedAt: Date.now(),
    };
    this.saveWorkspaceDiagnostic(diagnostic);
    return diagnostic;
  }

  getLastWorkspaceDiagnostic(): SelfCodeWorkspaceDiagnostic | undefined {
    try {
      const raw = storageService.getItem(WORKSPACE_DIAGNOSTIC_KEY);
      if (!raw) return undefined;
      return JSON.parse(raw) as SelfCodeWorkspaceDiagnostic;
    } catch {
      return undefined;
    }
  }

  private saveWorkspaceDiagnostic(
    diagnostic: SelfCodeWorkspaceDiagnostic
  ): void {
    storageService.setItem(
      WORKSPACE_DIAGNOSTIC_KEY,
      JSON.stringify(diagnostic)
    );
  }

  async initializeBundledSeed(
    overwrite = false,
    onProgress?: (progress: SelfCodeSeedProgress) => void
  ): Promise<{
    status:
      | 'SEEDED'
      | 'ALREADY_CURRENT'
      | 'PRESERVED_DIRTY'
      | 'FALLBACK_GITHUB'
      | 'NO_SOURCE';
    seedRevision?: string;
    error?: string;
  }> {
    const existing = this.get();

    const report = (progress: SelfCodeSeedProgress) => {
      try {
        onProgress?.(progress);
      } catch {}
    };

    if (existing?.dirty === true && !overwrite) {
      report({
        phase: 'COMPLETE',
        detail: '変更中のWorkspaceを保持しました。',
      });

      return {
        status: 'PRESERVED_DIRTY',
        seedRevision: existing.repoSha256,
      };
    }

    try {
      report({
        phase: 'FETCH',
        detail: 'アプリ同梱Seedを取得しています…',
      });

      const response = await fetch('/self-code-seed.zip', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`BUNDLED_SELF_CODE_SEED_HTTP_${response.status}`);
      }

      const bytes = await response.arrayBuffer();

      report({
        phase: 'FETCH',
        detail: `Seed取得完了: ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB`,
      });

      const JSZipModule = await import('jszip');
      const JSZipCtor = JSZipModule.default || JSZipModule;
      const zip = await JSZipCtor.loadAsync(bytes);

      const manifestEntry = zip.file('self-code-seed.manifest.json');

      if (!manifestEntry) {
        throw new Error('BUNDLED_SELF_CODE_SEED_MANIFEST_MISSING');
      }

      const manifest = JSON.parse(
        await manifestEntry.async('text')
      );

      if (
        manifest?.schemaVersion !== 1 ||
        !Array.isArray(manifest.files) ||
        !manifest.seedRevision ||
        !manifest.commitSha
      ) {
        throw new Error(
          'BUNDLED_SELF_CODE_SEED_MANIFEST_INVALID'
        );
      }

      const total = manifest.files.length;
      const files: SelfCodeFile[] = [];

      report({
        phase: 'VERIFY',
        completed: 0,
        total,
        detail: `Seed検証 0/${total}`,
      });

      for (const item of manifest.files) {
        const filePath = String(item?.path || '')
          .replace(/^\/+/, '');

        const expectedSha = String(item?.sha256 || '');
        const blobSha =
          typeof item?.blobSha === 'string'
            ? item.blobSha
            : undefined;

        if (!filePath || !expectedSha) {
          throw new Error(
            'BUNDLED_SELF_CODE_SEED_FILE_MANIFEST_INVALID'
          );
        }

        const entry = zip.file(filePath);

        if (!entry) {
          throw new Error(
            `BUNDLED_SELF_CODE_SEED_FILE_MISSING:${filePath}`
          );
        }

        const content = await entry.async('text');

        // Seed生成側と同じ生テキストSHA-256を使用する。
        const actualSha = sha256HexFromText(content);

        if (actualSha !== expectedSha) {
          throw new Error(
            `BUNDLED_SELF_CODE_SEED_SHA_MISMATCH:${filePath}`
          );
        }

        files.push({
          path: filePath,
          content,
          sha256: actualSha,
          blobSha,
        });

        if (
          files.length === 1 ||
          files.length % 25 === 0 ||
          files.length === total
        ) {
          report({
            phase: 'VERIFY',
            completed: files.length,
            total,
            detail: `Seed検証 ${files.length}/${total}`,
          });

          // UIへ描画機会を返す。
          await new Promise(resolve =>
            setTimeout(resolve, 0)
          );
        }
      }

      if (!files.length) {
        throw new Error(
          'BUNDLED_SELF_CODE_SEED_EMPTY'
        );
      }

      const repoSha256 = canonicalSha256(
        files.map(file => ({
          path: file.path,
          sha256: file.sha256,
        }))
      );

      if (
        repoSha256 !== String(manifest.seedRevision)
      ) {
        throw new Error(
          'BUNDLED_SELF_CODE_SEED_REVISION_MISMATCH'
        );
      }

      const appliedRevision =
        storageService.getItem(SEED_APPLIED_KEY) || '';

      if (
        existing &&
        existing.repoSha256 === repoSha256 &&
        appliedRevision === manifest.seedRevision &&
        existing.files.every(file => Boolean(file.blobSha))
      ) {
        report({
          phase: 'COMPLETE',
          completed: total,
          total,
          detail: `Seedは最新状態です（${total}ファイル）。`,
        });

        return {
          status: 'ALREADY_CURRENT',
          seedRevision: manifest.seedRevision,
        };
      }

      report({
        phase: 'APPLY',
        completed: total,
        total,
        detail: `SelfCodeWorkspaceへ${total}ファイルを展開しています…`,
      });

      const settings = this.getGitHubSettings();

      githubSyncService.applyBundledSeed(
        settings.repository,
        settings.branch,
        {
          files,
          commitSha: String(manifest.commitSha),
          seedRevision: String(manifest.seedRevision),
        }
      );

      storageService.setItem(
        SEED_APPLIED_KEY,
        String(manifest.seedRevision)
      );
      await storageService.flushNow();
      this.getWorkspaceDiagnostic();
      await storageService.flushNow();

      report({
        phase: 'COMPLETE',
        completed: total,
        total,
        detail: `Seed展開完了: ${total}ファイル`,
      });

      return {
        status: 'SEEDED',
        seedRevision: manifest.seedRevision,
      };
    } catch (error) {
      const reason = String(error);

      report({
        phase: 'FALLBACK',
        detail:
          `Seed処理に失敗。既存GitHub PULLへフォールバックします。${reason}`,
      });

      try {
        const fallback = await this.sync(
          undefined,
          progress => {
            report({
              phase: 'FALLBACK',
              detail: `GitHub PULL: ${progress.detail}`,
            });
          }
        );

        await storageService.flushNow();
        const fallbackDiagnostic = this.getWorkspaceDiagnostic();
        this.saveWorkspaceDiagnostic({
          ...fallbackDiagnostic,
          status: 'READY',
          diagnosticCode: 'SELF_CODE_SEED_FAILED_FALLBACK_GITHUB',
          summary: '同梱Seedに失敗したためGitHub PULLへフォールバックしてWorkspaceを構築しました。',
          nextAction: '現在のGitHub由来Workspaceを使用できます。',
          seedError: reason,
          recordedAt: Date.now(),
        });
        await storageService.flushNow();

        return {
          status: 'FALLBACK_GITHUB',
          seedRevision: fallback.repoSha256,
          error: reason,
        };
      } catch (fallbackError) {
        if (existing) {
          return {
            status: 'NO_SOURCE',
            seedRevision: existing.repoSha256,
            error:
              `${reason}|GITHUB_FALLBACK:${String(fallbackError)}`,
          };
        }

        const fallbackMessage = String(fallbackError);
        const settings = this.getGitHubSettings();
        const diagnostic: SelfCodeWorkspaceDiagnostic = {
          status: 'NO_SOURCE',
          diagnosticCode: 'SELF_CODE_SEED_AND_GITHUB_FALLBACK_FAILED',
          summary: '同梱SeedとGitHub PULLの両方に失敗し、自己コードWorkspaceを初期化できませんでした。',
          nextAction: 'Seedファイル・Storage・GitHub接続を確認してから再初期化します。',
          backend: storageService.getBackendName(),
          repository: settings.repository,
          branch: settings.branch,
          fileCount: 0,
          seedError: reason,
          fallbackError: fallbackMessage,
          recordedAt: Date.now(),
        };
        this.saveWorkspaceDiagnostic(diagnostic);
        await storageService.flushNow();

        return {
          status: 'NO_SOURCE',
          error:
            `${reason}|GITHUB_FALLBACK:${fallbackMessage}`,
        };
      }
    }
  }

  async sync(
    token?: string,
    onProgress?: (
      progress: GitHubPullProgressUpdate
    ) => void | Promise<void>
  ): Promise<SelfCodeSnapshot> {
    const existing=this.get();
    if(existing?.dirty) throw new Error('SELF_CODE_SPACE_DIRTY_SYNC_REQUIRED');
    const settings=this.getGitHubSettings();
    const effectiveToken=(token?.trim() || this.getGitHubPat()).trim();
    const result = await apiService.importFromGitHub(
      {
        repoUrl: settings.repository,
        branch: settings.branch,
        token: effectiveToken || undefined,
      },
      onProgress
    );

    if (!result.success) {
      throw new Error(
        result.message || 'SELF_CODE_SPACE_PULL_FAILED'
      );
    }

    if (!result.files?.length) {
      throw new Error(
        `SELF_CODE_SPACE_PULL_EMPTY:repository=${settings.repository}:branch=${settings.branch}`
      );
    }

    // apiService.importFromGitHub() は githubSyncService の正規化済み
    // files を返すため、ここで全ファイル内容を filter/map/hash し直さない。
    // 約970ファイルのPULL時に巨大な文字列配列をもう一つ生成するのを防ぐ。
    const files = result.files as SelfCodeFile[];

    if (!files.length) throw new Error('SELF_CODE_SPACE_NO_FILES');

    const repoSha256 = canonicalSha256(
      files.map(file => ({ path: file.path, sha256: file.sha256 }))
    );

    const snapshot: SelfCodeSnapshot = {
      repository: settings.repository,
      branch: settings.branch,
      repoSha256,
      files,
      syncedAt: Date.now(),
      dirty: false,
      baseRepoSha256: repoSha256,
    };

    // 正常PULL時の正本は githubSyncService に一本化する。
    // clean snapshot を別KEYへJSON.stringifyして二重保存しない。
    storageService.removeItem(KEY);

    return snapshot;
  }

  get(): SelfCodeSnapshot | undefined {
    try {
      const raw = storageService.getItem(KEY);

      // dirty snapshot は自己改善中の作業状態なので最優先で保持する。
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.files && value?.dirty === true) {
          return this.clone(value);
        }

        // 旧バージョンのclean snapshotが残っている場合は一度だけ削除。
        if (value?.files && value?.dirty !== true) {
          storageService.removeItem(KEY);
        }
      }

      // clean状態はGitHub同期サービスを唯一の正本として読む。
      const settings = this.getGitHubSettings();
      const sync = githubSyncService.get(
        settings.repository,
        settings.branch
      );

      if (!sync?.complete || !sync.files.length) {
        return undefined;
      }

      const repoSha256 = canonicalSha256(
        sync.files.map(file => ({
          path: file.path,
          sha256: file.sha256,
        }))
      );

      // githubSyncService が保持する正規化済みファイル配列をそのまま利用する。
      // SelfCodeFile と GitHubSyncFile は path/content/sha256 が共通で、
      // clean PULL状態ではここで再コピーする必要がない。
      return {
        repository: settings.repository,
        branch: settings.branch,
        repoSha256,
        files: sync.files as SelfCodeFile[],
        syncedAt: sync.syncedAt || Date.now(),
        dirty: false,
        baseRepoSha256: repoSha256,
        source: sync.source === 'BUNDLED_SEED' ? 'BUNDLED_SEED' : 'GITHUB',
      };
    } catch {
      return undefined;
    }
  }

  listFiles(): SelfCodeFile[] {
    return this.get()?.files || [];
  }

  readFile(path: string): SelfCodeFile | undefined {
    return this.listFiles().find(file => file.path === path);
  }

  listSourceFiles() {
    const snapshot = this.get();
    if (!snapshot) return [];

    const syncedAt = snapshot.syncedAt || Date.now();
    return snapshot.files.map(file => ({
      path: file.path,
      content: file.content,
      language: this.language(file.path),
      evidenceIds: [],
      updatedAt: syncedAt,
      contentHash: file.sha256,
    }));
  }

  applyCandidate(files: Array<{path:string; baselineSha256:string; candidateContent:string}>): SelfCodeSnapshot {
    const snapshot=this.get();
    if(!snapshot) throw new Error('SELF_CODE_SPACE_NOT_SYNCED');
    const current=new Map(snapshot.files.map(file=>[file.path,file]));
    for(const file of files){
      const target=current.get(file.path);
      if(!target) throw new Error(`SELF_CODE_FILE_NOT_FOUND:${file.path}`);
      if(target.sha256!==file.baselineSha256) throw new Error(`SELF_CODE_BASELINE_CONFLICT:${file.path}`);
    }
    const next=snapshot.files.map(file=>{
      const change=files.find(item=>item.path===file.path);
      return change ? {...file,content:change.candidateContent,sha256:canonicalSha256(change.candidateContent)} : {...file};
    });
    const updated:SelfCodeSnapshot={...snapshot,files:next,repoSha256:canonicalSha256(next.map(file=>({path:file.path,sha256:file.sha256}))),syncedAt:Date.now(),dirty:true,baseRepoSha256:snapshot.baseRepoSha256||snapshot.repoSha256};
    storageService.setItem(KEY,JSON.stringify(updated));
    return this.clone(updated);
  }

  async push(token:string,commitMessage?:string): Promise<SelfCodeSnapshot> {
    const snapshot=this.get();
    if(!snapshot) throw new Error('SELF_CODE_SPACE_NOT_SYNCED');
    if(!snapshot.dirty) throw new Error('SELF_CODE_SPACE_NOT_DIRTY');
    if(!token.trim()) throw new Error('GITHUB_TOKEN_REQUIRED');
    const settings=this.getGitHubSettings();
    if(snapshot.repository!==settings.repository||snapshot.branch!==settings.branch)throw new Error('SELF_CODE_GITHUB_CONFIG_CHANGED_SYNC_REQUIRED');
    const result=await apiService.pushToGitHubRepo({
      repoUrl:settings.repository,
      branch:settings.branch,
      commitMessage:commitMessage?.trim()||settings.commitMessage,
      files:snapshot.files.map(file=>({path:file.path,content:file.content})),
      githubToken:token.trim()
    });
    if(!result.success) throw new Error('SELF_CODE_SPACE_PUSH_FAILED');
    const clean={...snapshot,dirty:false,baseRepoSha256:snapshot.repoSha256,syncedAt:Date.now()};
    storageService.setItem(KEY,JSON.stringify(clean));
    return this.clone(clean);
  }

  restoreSnapshot(snapshot: SelfCodeSnapshot, expectedCurrentRepoSha256: string): SelfCodeSnapshot {
    const current=this.get();
    if(!current) throw new Error("SELF_CODE_SPACE_NOT_SYNCED");
    if(current.repoSha256!==expectedCurrentRepoSha256) throw new Error("SELF_CODE_SPACE_RESTORE_CONFLICT");
    if(snapshot.repository!==current.repository||snapshot.branch!==current.branch) throw new Error("SELF_CODE_SPACE_RESTORE_TARGET_MISMATCH");
    storageService.setItem(KEY,JSON.stringify(snapshot));
    return this.clone(snapshot);
  }

  search(query: string): SelfCodeFile[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.listFiles()
      .filter(file => file.path.toLowerCase().includes(q) || file.content.toLowerCase().includes(q));
  }

  private language(path: string): string { const ext = path.split(".").pop()?.toLowerCase(); return ext === "tsx" ? "typescriptreact" : ext === "ts" ? "typescript" : ext === "js" ? "javascript" : ext === "json" ? "json" : ext || "text"; }

  private clone(snapshot: SelfCodeSnapshot): SelfCodeSnapshot {
    return {
      ...snapshot,
      files: snapshot.files.map(file => ({ ...file })),
    };
  }
}

export const selfCodeSpaceService = new SelfCodeSpaceService();
