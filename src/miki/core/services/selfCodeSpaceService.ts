import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import {
  apiService,
  type GitHubPullProgressUpdate,
} from '../../../services/api';
import { canonicalSha256, sha256HexFromText } from './canonicalSha256Service';
import { githubSyncService } from '../../../services/githubSyncService';
import type { GitHubSyncDiagnosticStatus } from '../../../services/githubSyncService';
import { nativeWorkspaceBridgeService } from '../../execution/services/nativeWorkspaceBridgeService';

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

export interface SelfCodeLightManifest {
  repository: string;
  branch: string;
  commitSha: string;
  files: Array<{ path: string; blobSha: string }>;
  syncedAt: number;
}

// P372: local edits accumulated against the light manifest, before
// they are pushed. Only the changed files' contents are held; the
// rest of the tree stays as manifest entries.
export interface SelfCodeLightChangeset {
  repository: string;
  branch: string;
  baseCommitSha: string;
  files: Array<{ path: string; content: string; sha256: string }>;
  updatedAt: number;
}

const KEY = 'miki_self_code_space_v1';
// P1127: dirty snapshot の分割保存。マニフェスト（内容なし）と
// ファイル別キーに分け、編集のたびの全量書き直しをやめる。
const DIRTY_MANIFEST_KEY = 'miki_self_code_space_dirty_manifest_v1';
const DIRTY_FILE_PREFIX = 'miki_self_code_space_dirty_file_v1_';
const LIGHT_KEY = 'miki_self_code_light_manifest_v1';
const LIGHT_CHANGESET_KEY = 'miki_self_code_light_changeset_v1';
const SETTINGS_KEY = 'miki_self_code_github_settings_v1';
const SEED_APPLIED_KEY = 'miki_self_code_seed_revision_v1';
// P3003: 理解索引の背景更新を遅らせる時間。ensure() は全ツリーを
// 同期的に解析する重い処理で、Seed 適用のフラッシュと同じ窓で走る
// とメインスレッドを占有し、フラッシュ完了前にレンダラがメモリ圧
// で死んで適用が毎回やり直しになる（2026-11-27 ラボで実証）。
// Seed の永続化はマーカー順序で先に確定するため、索引が遅れても
// 状態は壊れない。
const LIGHT_INDEX_REFRESH_DELAY_MS = 30_000;
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
  private lightContentCache = new Map<string, string>();
  private lightIndexRefreshInFlight = false;

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

    // P1127: 分割保存の dirty はマニフェストだけで判定する。
    const splitManifest = this.readDirtyManifest();
    if (splitManifest) {
      const diagnostic: SelfCodeWorkspaceDiagnostic = {
        status: 'DIRTY',
        diagnosticCode: 'SELF_CODE_WORKSPACE_DIRTY',
        summary: '自己コードWorkspaceに未反映の変更があります。',
        nextAction: '変更内容を保持したまま検証・PUSH判断を行います。',
        backend,
        repository: settings.repository,
        branch: settings.branch,
        fileCount: splitManifest.files.length,
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
    const seedStartedAt = Date.now();
    const checkpoint = (phase: string, details: Record<string, unknown> = {}) => {
      systemLogger.recordRuntimeDiagnostic('SELF_CODE_SEED_CHECKPOINT', {
        phase,
        elapsedMs: Date.now() - seedStartedAt,
        ...details,
      });
    };
    checkpoint('START');
    const existing = this.get();
    let manifestFileCount = 0;
    let totalContentChars = 0;
    let maxFileChars = 0;

    const report = (progress: SelfCodeSeedProgress) => {
      try {
        onProgress?.(progress);
      } catch {}
    };

    if (existing?.dirty === true && !overwrite) {
      checkpoint('PRESERVED_DIRTY', { fileCount: existing.files.length });
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
      checkpoint('FETCH_BEGIN');
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
      checkpoint('ZIP_FETCHED', { zipBytes: bytes.byteLength });

      report({
        phase: 'FETCH',
        detail: `Seed取得完了: ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB`,
      });

      checkpoint('DECOMPRESS_BEGIN', { zipBytes: bytes.byteLength });
      const JSZipModule = await import('jszip');
      const JSZipCtor = JSZipModule.default || JSZipModule;
      const zip = await JSZipCtor.loadAsync(bytes);
      checkpoint('DECOMPRESS_COMPLETE', { zipBytes: bytes.byteLength });

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
      manifestFileCount = total;
      checkpoint('MANIFEST_VALIDATED', { fileCount: total, zipBytes: bytes.byteLength });
      const settings = this.getGitHubSettings();
      const appliedRevision =
        storageService.getItem(SEED_APPLIED_KEY) || '';

      // P3003 高速路: 適用済みマーカーと保存済み分割マニフェストの
      // treeSha（Seed 適用では seedRevision が入る）と既存
      // スナップショットのリビジョンが、同梱 Seed のリビジョンと
      // 全部一致するなら、全ファイルの展開・検証をせず最新とみなす。
      // リビジョンが変わった時だけ下の全検証へ進む。
      if (
        existing &&
        appliedRevision === manifest.seedRevision &&
        existing.repoSha256 === manifest.seedRevision &&
        existing.files.every(file => Boolean(file.blobSha))
      ) {
        const storedManifest = githubSyncService.manifest(
          settings.repository,
          settings.branch
        );
        if (
          storedManifest?.complete &&
          storedManifest.treeSha === manifest.seedRevision &&
          storedManifest.files.length === total
        ) {
          checkpoint('ALREADY_CURRENT', { fileCount: total, fastPath: true });
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
      }

      const metaFiles: Array<{ path: string; sha256: string; blobSha?: string }> = [];
      // P3003: 保存済みマニフェストとハッシュが違うファイルだけ、
      // 後段の保存のために内容を保持する。全ファイルの内容
      // （約20MB）とその複製を同時に保持し続けない。
      const storedManifestForDiff = githubSyncService.manifest(
        settings.repository,
        settings.branch
      );
      const storedShaByPath = new Map(
        (storedManifestForDiff?.files || []).map(file => [file.path, file.sha256])
      );
      const changedContents = new Map<string, string>();

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
        totalContentChars += content.length;
        maxFileChars = Math.max(maxFileChars, content.length);

        // Seed生成側と同じ生テキストSHA-256を使用する。
        const actualSha = sha256HexFromText(content);

        if (actualSha !== expectedSha) {
          throw new Error(
            `BUNDLED_SELF_CODE_SEED_SHA_MISMATCH:${filePath}`
          );
        }

        metaFiles.push({
          path: filePath,
          sha256: actualSha,
          blobSha,
        });
        if (storedShaByPath.get(filePath) !== actualSha) {
          changedContents.set(filePath, content);
        }
        if (metaFiles.length === 1 || metaFiles.length % 100 === 0 || metaFiles.length === total) {
          checkpoint('VERIFY_PROGRESS', {
            completedCount: metaFiles.length,
            totalCount: total,
            fileCount: total,
            totalContentChars,
            maxFileChars,
          });
        }

        if (
          metaFiles.length === 1 ||
          metaFiles.length % 25 === 0 ||
          metaFiles.length === total
        ) {
          report({
            phase: 'VERIFY',
            completed: metaFiles.length,
            total,
            detail: `Seed検証 ${metaFiles.length}/${total}`,
          });

          // UIへ描画機会を返す。
          await new Promise(resolve =>
            setTimeout(resolve, 0)
          );
        }
      }

      if (!metaFiles.length) {
        throw new Error(
          'BUNDLED_SELF_CODE_SEED_EMPTY'
        );
      }

      const repoSha256 = canonicalSha256(
        metaFiles.map(file => ({
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

      if (
        existing &&
        existing.repoSha256 === repoSha256 &&
        appliedRevision === manifest.seedRevision &&
        existing.files.every(file => Boolean(file.blobSha))
      ) {
        checkpoint('ALREADY_CURRENT', { fileCount: total, totalContentChars, maxFileChars });
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

      checkpoint('APPLY_BEGIN', { fileCount: total, totalContentChars, maxFileChars });

      githubSyncService.applyBundledSeedState(
        settings.repository,
        settings.branch,
        {
          files: metaFiles,
          changedContents,
          commitSha: String(manifest.commitSha),
          seedRevision: String(manifest.seedRevision),
        }
      );
      this.recordLightManifest(metaFiles);
      checkpoint('APPLY_COMPLETE', { fileCount: total, totalContentChars, maxFileChars });

      // P3003: 状態（分割ファイル＋マニフェスト＋軽量マニフェスト）を
      // 先に確定させてから、適用マーカーだけを単独の小さな
      // フラッシュで書く。途中で落ちても、マーカーが先行して
      // 「未適用なのに適用済み」になることはない（逆に、状態だけ
      // 新しくてマーカーが古い場合は次回起動の全検証で自己修復する）。
      await storageService.flushNow();
      checkpoint('SEED_STATE_FLUSH_COMPLETE', { fileCount: total, totalContentChars });
      storageService.setItem(
        SEED_APPLIED_KEY,
        String(manifest.seedRevision)
      );
      await storageService.flushNow();
      checkpoint('SEED_STORAGE_FLUSH_COMPLETE', { fileCount: total, totalContentChars });
      this.getWorkspaceDiagnostic();
      await storageService.flushNow();
      checkpoint('WORKSPACE_DIAGNOSTIC_FLUSH_COMPLETE', { fileCount: total });

      checkpoint('COMPLETE', { status: 'SEEDED', fileCount: total, totalContentChars, maxFileChars });

      // P1121: ネイティブ側のディスク・ワークスペースも用意する
      // （種の展開＋Rust ハッシュ）。読み経路はまだ JS 側で、これは
      // 第2段の土台と件数照合のため。失敗しても種の成立に影響させない。
      void nativeWorkspaceBridgeService.extractSeed()
        .then((native) => {
          if (native) {
            checkpoint('NATIVE_SEED_EXTRACT', {
              nativeFileCount: native.file_count,
              nativeTotalBytes: native.total_bytes,
              nativeDurationMs: native.duration_ms,
              jsFileCount: total,
              fileCountMatch: native.file_count === total,
            });
          }
        })
        .catch(() => { /* ネイティブの用意は補助経路 */ });

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
      checkpoint('SEED_FAILED_FALLBACK_BEGIN', {
        errorType: error instanceof Error ? error.name : typeof error,
        fileCount: manifestFileCount,
        totalContentChars,
        maxFileChars,
      });
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
        checkpoint('GITHUB_FALLBACK_SYNC_COMPLETE', { fileCount: fallback.files.length });

        await storageService.flushNow();
        checkpoint('GITHUB_FALLBACK_STORAGE_FLUSH_COMPLETE', { fileCount: fallback.files.length });
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

        checkpoint('COMPLETE', { status: 'FALLBACK_GITHUB', fileCount: fallback.files.length });
        return {
          status: 'FALLBACK_GITHUB',
          seedRevision: fallback.repoSha256,
          error: reason,
        };
      } catch (fallbackError) {
        checkpoint('GITHUB_FALLBACK_FAILED', {
          errorType: fallbackError instanceof Error ? fallbackError.name : typeof fallbackError,
          fileCount: manifestFileCount,
        });
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
    // P1127: 分割保存の dirty も残さない。
    this.clearDirtyStorage();
    this.recordLightManifest(files);

    return snapshot;
  }

  get(): SelfCodeSnapshot | undefined {
    try {
      // dirty snapshot は自己改善中の作業状態なので最優先で保持する。
      // P1127: 分割保存から組み立てる（旧単一キーは読み時に移行）。
      const dirty = this.readDirtySnapshot();
      if (dirty) return this.clone(dirty);

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

  // P1123: 内容を含まない一覧（パス＋ハッシュだけ）。理解サービスの
  // 既定の入力で、全体の内容を組み立てない。dirty な作業状態がある間は
  // そちらが正本。
  listSourceFileManifest(): Array<{ path: string; contentHash: string }> {
    // P1127: dirty はマニフェストだけから返す（内容は読まない）。
    const splitManifest = this.readDirtyManifest();
    if (splitManifest) {
      return splitManifest.files.map(file => ({
        path: file.path,
        contentHash: file.sha256,
      }));
    }
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.files && value?.dirty === true) {
          return (value.files as SelfCodeFile[]).map(file => ({
            path: file.path,
            contentHash: file.sha256,
          }));
        }
      }
    } catch { /* clean 側へ */ }
    const settings = this.getGitHubSettings();
    const manifest = githubSyncService.manifest(
      settings.repository,
      settings.branch
    );
    if (!manifest?.complete || !manifest.files.length) return [];
    return manifest.files.map(file => ({
      path: file.path,
      contentHash: file.sha256,
    }));
  }

  // P1123: 1ファイルの内容だけを読む（全体の組み立てをしない）。
  readSourceFileContent(path: string): string | undefined {
    // P1127: dirty はファイル別キーだけを読む。
    const splitManifest = this.readDirtyManifest();
    if (splitManifest) {
      if (!splitManifest.files.some(file => file.path === path)) return undefined;
      try {
        const raw = storageService.getItem(this.dirtyFileKey(path));
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        return typeof parsed?.content === 'string' ? parsed.content : undefined;
      } catch {
        return undefined;
      }
    }
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.files && value?.dirty === true) {
          return (value.files as SelfCodeFile[]).find(
            file => file.path === path
          )?.content;
        }
      }
    } catch { /* clean 側へ */ }
    const settings = this.getGitHubSettings();
    return githubSyncService.readFileContent(
      settings.repository,
      settings.branch,
      path
    );
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
    // P1127: dirty は分割保存へ（変わったファイルだけ書く）。
    this.writeDirtySnapshot(updated);
    return this.clone(updated);
  }

  // P354: whenever the classic sync state is (re)built, also record
  // the light manifest so index-first consumers can work without a
  // separate light sync. The understanding index is refreshed in
  // the background and never blocks the sync itself.
  // P3003: 使うのは path と blobSha だけなので、その形で受ける
  // （Seed 適用側は内容を持たないメタだけで呼べるようになる）。
  private recordLightManifest(files: Array<{ path: string; blobSha?: string }>): void {
    try {
      const settings = this.getGitHubSettings();
      const sync = githubSyncService.get(
        settings.repository,
        settings.branch
      );
      const commitSha = sync?.commitSha || '';
      if (!commitSha) return;
      const manifestFiles = files
        .filter(
          file =>
            typeof file.blobSha === 'string' && Boolean(file.blobSha)
        )
        .map(file => ({ path: file.path, blobSha: String(file.blobSha) }));
      if (manifestFiles.length === 0) return;
      const lightManifest: SelfCodeLightManifest = {
        repository: settings.repository,
        branch: settings.branch,
        commitSha,
        files: manifestFiles,
        syncedAt: Date.now(),
      };
      storageService.setItem(LIGHT_KEY, JSON.stringify(lightManifest));
      this.refreshLightIndexInBackground();
    } catch {
      // Index-first state is an accelerator; never fail the sync.
    }
  }

  private refreshLightIndexInBackground(): void {
    if (this.lightIndexRefreshInFlight) return;
    this.lightIndexRefreshInFlight = true;
    // P3003: 起動・同期の窓を空けるため遅延起動にする
    // （LIGHT_INDEX_REFRESH_DELAY_MS のコメント参照）。in-flight
    // フラグは遅延の間も保持し、二重に積まれないようにする。
    setTimeout(() => {
      void (async () => {
        try {
          const { selfCodeUnderstandingService } = await import(
            './selfCodeUnderstandingService'
          );
          selfCodeUnderstandingService.ensure([]);
          const manifestCommit = this.getLightManifest()?.commitSha;
          if (manifestCommit) selfCodeUnderstandingService.stampSourceCommit(manifestCommit);
        } catch {
          // Background indexing is best-effort.
        } finally {
          this.lightIndexRefreshInFlight = false;
        }
      })();
    }, LIGHT_INDEX_REFRESH_DELAY_MS);
  }

  // P354: the light manifest may stand in for the classic source
  // tree when both describe the same commit and no local edits are
  // pending. Server validation uses this to avoid posting every
  // file (the classic body exceeds the server request size limit).
  isLightSourceCurrent(): boolean {
    const manifest = this.getLightManifest();
    if (!manifest) return false;
    const snapshot = this.get();
    if (snapshot?.dirty) return false;
    if (!snapshot) return true;
    const settings = this.getGitHubSettings();
    const sync = githubSyncService.get(
      settings.repository,
      settings.branch
    );
    return Boolean(sync?.commitSha) && sync!.commitSha === manifest.commitSha;
  }

  getLightManifest(): SelfCodeLightManifest | undefined {
    try {
      const raw = storageService.getItem(LIGHT_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed.commitSha !== 'string' ||
        !Array.isArray(parsed.files)
      )
        return undefined;
      return parsed as SelfCodeLightManifest;
    } catch {
      return undefined;
    }
  }

  getLightChangeset(): SelfCodeLightChangeset | undefined {
    try {
      const raw = storageService.getItem(LIGHT_CHANGESET_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as SelfCodeLightChangeset;
      if (
        !parsed ||
        typeof parsed.repository !== 'string' ||
        typeof parsed.branch !== 'string' ||
        typeof parsed.baseCommitSha !== 'string' ||
        !Array.isArray(parsed.files) ||
        !parsed.files.every(
          file =>
            file &&
            typeof file.path === 'string' &&
            typeof file.content === 'string' &&
            typeof file.sha256 === 'string'
        )
      )
        return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  // Identity of the effective light tree: manifest entries, with
  // pending changeset contents standing in for their paths. With no
  // changeset this equals the classic manifest hash.
  private lightRevisionSha256(
    manifest: SelfCodeLightManifest,
    changeset: SelfCodeLightChangeset | undefined
  ): string {
    const changed = new Map(
      (changeset?.files || []).map(file => [file.path, file.sha256])
    );
    return canonicalSha256(
      manifest.files.map(file => ({
        path: file.path,
        sha256: changed.get(file.path) ?? file.blobSha,
      }))
    );
  }

  // P372: light-mode counterpart of applyCandidate. Changed files
  // are verified against their baselines (pending changeset content
  // for stacked edits, the manifest-commit content otherwise) and
  // accumulated as a changeset; the full tree is never materialized.
  async applyCandidateLight(
    files: Array<{ path: string; baselineSha256: string; candidateContent: string }>
  ): Promise<{ repoSha256: string }> {
    const manifest = this.getLightManifest();
    if (!manifest) throw new Error('SELF_CODE_SPACE_NOT_SYNCED');
    const settings = this.getGitHubSettings();
    if (manifest.repository !== settings.repository || manifest.branch !== settings.branch)
      throw new Error('SELF_CODE_GITHUB_CONFIG_CHANGED_SYNC_REQUIRED');
    const existing = this.getLightChangeset();
    if (
      existing &&
      (existing.repository !== manifest.repository ||
        existing.branch !== manifest.branch ||
        existing.baseCommitSha !== manifest.commitSha)
    )
      throw new Error('SELF_CODE_BASELINE_CONFLICT:CHANGESET_BASE_MOVED');
    const existingByPath = new Map(
      (existing?.files || []).map(file => [file.path, file])
    );
    const manifestPaths = new Set(manifest.files.map(file => file.path));
    const freshPaths: string[] = [];
    for (const file of files) {
      const pending = existingByPath.get(file.path);
      if (pending) {
        if (pending.sha256 !== file.baselineSha256)
          throw new Error(`SELF_CODE_BASELINE_CONFLICT:${file.path}`);
      } else {
        if (!manifestPaths.has(file.path))
          throw new Error(`SELF_CODE_FILE_NOT_FOUND:${file.path}`);
        freshPaths.push(file.path);
      }
    }
    if (freshPaths.length > 0) {
      const baselines = await this.ensureFileContents(freshPaths);
      for (const file of files) {
        if (existingByPath.has(file.path)) continue;
        const baseline = baselines.get(file.path);
        if (baseline === undefined || canonicalSha256(baseline) !== file.baselineSha256)
          throw new Error(`SELF_CODE_BASELINE_CONFLICT:${file.path}`);
      }
    }
    const merged = new Map(existingByPath);
    for (const file of files)
      merged.set(file.path, {
        path: file.path,
        content: file.candidateContent,
        sha256: canonicalSha256(file.candidateContent),
      });
    const changeset: SelfCodeLightChangeset = {
      repository: manifest.repository,
      branch: manifest.branch,
      baseCommitSha: manifest.commitSha,
      files: [...merged.values()].sort((a, b) => a.path.localeCompare(b.path)),
      updatedAt: Date.now(),
    };
    storageService.setItem(LIGHT_CHANGESET_KEY, JSON.stringify(changeset));
    for (const file of changeset.files)
      this.lightContentCache.set(file.path, file.content);
    return { repoSha256: this.lightRevisionSha256(manifest, changeset) };
  }

  // P372: compensation counterpart for applyCandidateLight, mirroring
  // restoreSnapshot's expected-revision guard.
  restoreLightChangeset(
    previous: SelfCodeLightChangeset | undefined,
    expectedCurrentRepoSha256: string
  ): void {
    const manifest = this.getLightManifest();
    if (!manifest) throw new Error('SELF_CODE_SPACE_NOT_SYNCED');
    const current = this.lightRevisionSha256(manifest, this.getLightChangeset());
    if (current !== expectedCurrentRepoSha256)
      throw new Error('SELF_CODE_SPACE_RESTORE_CONFLICT');
    if (previous) storageService.setItem(LIGHT_CHANGESET_KEY, JSON.stringify(previous));
    else storageService.removeItem(LIGHT_CHANGESET_KEY);
    this.lightContentCache.clear();
  }

  // P372: push only the pending changeset. The server endpoint
  // builds the new tree on top of the remote head (base_tree), so
  // the full file set is never needed; expectedBaseCommitSha makes
  // the server refuse with a conflict when the remote moved on.
  private async pushLight(
    token: string,
    commitMessage?: string
  ): Promise<SelfCodeSnapshot> {
    const manifest = this.getLightManifest();
    const changeset = this.getLightChangeset();
    if (!manifest || !changeset) throw new Error('SELF_CODE_SPACE_NOT_SYNCED');
    if (changeset.files.length === 0) throw new Error('SELF_CODE_SPACE_NOT_DIRTY');
    if (!token.trim()) throw new Error('GITHUB_TOKEN_REQUIRED');
    const settings = this.getGitHubSettings();
    if (
      changeset.repository !== settings.repository ||
      changeset.branch !== settings.branch ||
      manifest.repository !== settings.repository ||
      manifest.branch !== settings.branch
    )
      throw new Error('SELF_CODE_GITHUB_CONFIG_CHANGED_SYNC_REQUIRED');
    if (manifest.commitSha !== changeset.baseCommitSha)
      throw new Error('SELF_CODE_BASELINE_CONFLICT:CHANGESET_BASE_MOVED');
    const result = await apiService.pushToGitHubRepo({
      repoUrl: settings.repository,
      branch: settings.branch,
      commitMessage: commitMessage?.trim() || settings.commitMessage,
      files: changeset.files.map(file => ({ path: file.path, content: file.content })),
      deletedPaths: [],
      expectedBaseCommitSha: changeset.baseCommitSha,
      githubToken: token.trim(),
    });
    if (!result.success) throw new Error('SELF_CODE_SPACE_PUSH_FAILED');
    const blobByPath = new Map(
      (result.changedFilesMeta || [])
        .filter(meta => typeof meta.blobSha === 'string')
        .map(meta => [meta.path, String(meta.blobSha)])
    );
    const nextManifest: SelfCodeLightManifest = {
      ...manifest,
      commitSha: result.commitSha,
      files: manifest.files.map(file =>
        blobByPath.has(file.path)
          ? { path: file.path, blobSha: blobByPath.get(file.path)! }
          : file
      ),
      syncedAt: Date.now(),
    };
    storageService.setItem(LIGHT_KEY, JSON.stringify(nextManifest));
    storageService.removeItem(LIGHT_CHANGESET_KEY);
    for (const file of changeset.files) this.lightContentCache.delete(file.path);
    return {
      repository: settings.repository,
      branch: settings.branch,
      repoSha256: this.lightRevisionSha256(nextManifest, undefined),
      files: [],
      syncedAt: Date.now(),
      source: 'GITHUB',
    };
  }

  // P352: index-first sync. Fetch only the manifest, refresh the
  // understanding index from the contents of new/changed source
  // files, and do not retain file contents afterwards.
  async syncIndexFirst(): Promise<{
    repository: string;
    branch: string;
    commitSha: string;
    fileCount: number;
    indexedFiles: number;
    fetchedFiles: number;
    syncedAt: number;
  }> {
    const settings = this.getGitHubSettings();
    const token = this.getGitHubPat();
    const repoUrl = `https://github.com/${settings.repository}`;
    const previous = this.getLightManifest();
    const knownFiles = (previous?.files || []).map(file => ({
      path: file.path,
      blobSha: file.blobSha,
    }));

    const data: any = await apiService.importGitHubRepo(
      repoUrl,
      settings.branch,
      token || undefined,
      knownFiles,
      undefined,
      { includeContents: false }
    );

    const manifest: Array<{ path: string; blobSha: string }> = (
      Array.isArray(data?.manifest) ? data.manifest : []
    ).map((item: any) => ({
      path: String(item.path),
      blobSha: String(item.blobSha || ''),
    }));
    if (!data?.commitSha || manifest.length === 0) {
      throw new Error('SELF_CODE_LIGHT_SYNC_INVALID_RESPONSE');
    }
    const changedPaths = new Set<string>(
      Array.isArray(data.changedPaths) ? data.changedPaths : []
    );

    const { selfCodeUnderstandingService } = await import(
      './selfCodeUnderstandingService'
    );
    const previousIndex = selfCodeUnderstandingService.getSnapshot();
    const entryByPath = new Map(
      (previousIndex?.entries || []).map(entry => [entry.path, entry])
    );

    const isSource = (path: string) => /\.(?:ts|tsx|js|jsx)$/.test(path);
    const fetchTargets = manifest.filter(
      item =>
        isSource(item.path) &&
        (changedPaths.has(item.path) || !entryByPath.has(item.path))
    );

    const fetchedContents = new Map<string, string>();
    for (let i = 0; i < fetchTargets.length; i += 25) {
      const batch = fetchTargets.slice(i, i + 25);
      const result = await apiService.fetchGitHubFileContents(repoUrl, {
        commitSha: String(data.commitSha),
        githubToken: token || undefined,
        items: batch,
      });
      for (const file of result.files) {
        fetchedContents.set(file.path, file.content);
      }
    }

    const sourceFiles: Array<{
      path: string;
      content: string;
      contentHash: string;
    }> = [];
    for (const item of manifest) {
      if (!isSource(item.path)) continue;
      const content = fetchedContents.get(item.path);
      if (content !== undefined) {
        sourceFiles.push({
          path: item.path,
          content,
          contentHash: sha256HexFromText(content),
        });
        continue;
      }
      const entry = entryByPath.get(item.path);
      if (entry) {
        sourceFiles.push({
          path: item.path,
          content: '',
          contentHash: entry.contentHash,
        });
      }
    }

    selfCodeUnderstandingService.ensure([], sourceFiles);
    selfCodeUnderstandingService.stampSourceCommit(String(data.commitSha));

    const lightManifest: SelfCodeLightManifest = {
      repository: settings.repository,
      branch: settings.branch,
      commitSha: String(data.commitSha),
      files: manifest,
      syncedAt: Date.now(),
    };
    storageService.setItem(LIGHT_KEY, JSON.stringify(lightManifest));

    return {
      repository: lightManifest.repository,
      branch: lightManifest.branch,
      commitSha: lightManifest.commitSha,
      fileCount: manifest.length,
      indexedFiles: sourceFiles.length,
      fetchedFiles: fetchedContents.size,
      syncedAt: lightManifest.syncedAt,
    };
  }

  // P352: read one file's content, fetching it on demand when the
  // classic full snapshot does not hold it.
  async ensureFileContent(path: string): Promise<string> {
    const contents = await this.ensureFileContents([path]);
    const content = contents.get(path);
    if (content !== undefined) return content;
    const manifest = this.getLightManifest();
    if (!manifest) throw new Error('SELF_CODE_NOT_SYNCED');
    if (!manifest.files.some(file => file.path === path))
      throw new Error(`SELF_CODE_FILE_NOT_FOUND:${path}`);
    throw new Error(`SELF_CODE_FILE_CONTENT_MISSING:${path}`);
  }

  // P352: batch variant of ensureFileContent. Held or cached files
  // are served locally; the rest are fetched in one request.
  async ensureFileContents(
    paths: string[]
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const manifest = this.getLightManifest();
    // P372: pending light edits are the current local state of those
    // paths; serve them ahead of the manifest-commit contents.
    const pendingByPath = new Map(
      (this.getLightChangeset()?.files || []).map(file => [file.path, file.content])
    );
    const missing: Array<{ path: string; blobSha: string }> = [];
    for (const path of paths) {
      const held = this.readFile(path);
      if (held) {
        result.set(path, held.content);
        continue;
      }
      const pending = pendingByPath.get(path);
      if (pending !== undefined) {
        result.set(path, pending);
        continue;
      }
      const cached = this.lightContentCache.get(path);
      if (cached !== undefined) {
        result.set(path, cached);
        continue;
      }
      const entry = manifest?.files.find(file => file.path === path);
      if (entry) missing.push(entry);
    }
    if (missing.length > 0 && manifest) {
      const settings = this.getGitHubSettings();
      const fetched = await apiService.fetchGitHubFileContents(
        `https://github.com/${settings.repository}`,
        {
          commitSha: manifest.commitSha,
          githubToken: this.getGitHubPat() || undefined,
          items: missing,
        }
      );
      for (const file of fetched.files) {
        if (this.lightContentCache.size > 50)
          this.lightContentCache.clear();
        this.lightContentCache.set(file.path, file.content);
        result.set(file.path, file.content);
      }
    }
    return result;
  }

  // P352: the source snapshot identity shared by intake and
  // candidate generation. Classic mode hashes file contents;
  // index-first mode hashes the manifest (path + blobSha), which is
  // stable no matter which files are currently hydrated.
  getSourceSnapshotSha256(): string {
    // P1133: ハッシュは目録（パス＋内容ハッシュ）から作れる。
    // 全体の内容を組み立てるのは、目録で表せない旧・不完全な
    // 状態の時だけにする（結果は従来と一致させる）。
    const manifestFiles = this.listSourceFileManifest();
    if (manifestFiles.length > 0) {
      return canonicalSha256(
        manifestFiles.map(file => ({ path: file.path, sha256: file.contentHash }))
      );
    }
    const manifest = this.getLightManifest();
    if (manifest && manifest.files.length > 0) {
      return this.lightRevisionSha256(manifest, this.getLightChangeset());
    }
    const files = this.listSourceFiles();
    if (files.length > 0) {
      return canonicalSha256(
        files.map(file => ({ path: file.path, sha256: file.contentHash }))
      );
    }
    return '';
  }

  toSourceFile(path: string, content: string) {
    return {
      path,
      content,
      language: this.language(path),
      evidenceIds: [] as string[],
      updatedAt: Date.now(),
      contentHash: sha256HexFromText(content),
    };
  }

  async push(token:string,commitMessage?:string): Promise<SelfCodeSnapshot> {
    const snapshot=this.get();
    if(!snapshot) return this.pushLight(token,commitMessage);
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
    // P1127: dirty な復元は分割保存へ、clean は従来の単一キーへ。
    if (snapshot.dirty) this.writeDirtySnapshot(snapshot);
    else storageService.setItem(KEY,JSON.stringify(snapshot));
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

  // ---- P1127: dirty snapshot の分割保存 ----
  private dirtyFileKey(path: string): string {
    return DIRTY_FILE_PREFIX + encodeURIComponent(path);
  }

  private readDirtyManifest(): { repository: string; branch: string; repoSha256: string; baseRepoSha256?: string; syncedAt: number; source?: 'BUNDLED_SEED' | 'GITHUB'; files: Array<{ path: string; sha256: string; blobSha?: string }> } | null {
    try {
      const raw = storageService.getItem(DIRTY_MANIFEST_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value?.files || !Array.isArray(value.files)) return null;
      return value;
    } catch {
      return null;
    }
  }

  private writeDirtySnapshot(snapshot: SelfCodeSnapshot): void {
    const previous = this.readDirtyManifest();
    const previousSha = new Map((previous?.files ?? []).map(f => [f.path, f.sha256]));
    const nextPaths = new Set(snapshot.files.map(f => f.path));
    for (const file of snapshot.files) {
      if (previousSha.get(file.path) !== file.sha256) {
        storageService.setItem(this.dirtyFileKey(file.path), JSON.stringify({ content: file.content, ...(file.blobSha ? { blobSha: file.blobSha } : {}) }));
      }
    }
    for (const old of previous?.files ?? []) {
      if (!nextPaths.has(old.path)) storageService.removeItem(this.dirtyFileKey(old.path));
    }
    storageService.setItem(DIRTY_MANIFEST_KEY, JSON.stringify({
      repository: snapshot.repository,
      branch: snapshot.branch,
      repoSha256: snapshot.repoSha256,
      ...(snapshot.baseRepoSha256 ? { baseRepoSha256: snapshot.baseRepoSha256 } : {}),
      syncedAt: snapshot.syncedAt,
      ...(snapshot.source ? { source: snapshot.source } : {}),
      files: snapshot.files.map(f => ({ path: f.path, sha256: f.sha256, ...(f.blobSha ? { blobSha: f.blobSha } : {}) })),
    }));
    storageService.removeItem(KEY);
  }

  private clearDirtyStorage(): void {
    const manifest = this.readDirtyManifest();
    for (const f of manifest?.files ?? []) storageService.removeItem(this.dirtyFileKey(f.path));
    storageService.removeItem(DIRTY_MANIFEST_KEY);
    storageService.removeItem(KEY);
  }

  /** 分割側に dirty があれば組み立てて返す。旧単一キーの dirty は
   * ここで分割へ移行する。旧 clean が残っていれば従来どおり削除。 */
  private readDirtySnapshot(): SelfCodeSnapshot | undefined {
    const manifest = this.readDirtyManifest();
    if (manifest) {
      const files: SelfCodeFile[] = [];
      for (const entry of manifest.files) {
        try {
          const raw = storageService.getItem(this.dirtyFileKey(entry.path));
          if (!raw) return undefined;
          const parsed = JSON.parse(raw);
          if (typeof parsed?.content !== 'string') return undefined;
          files.push({ path: entry.path, content: parsed.content, sha256: entry.sha256, ...(entry.blobSha || parsed.blobSha ? { blobSha: entry.blobSha || parsed.blobSha } : {}) });
        } catch {
          return undefined;
        }
      }
      return {
        repository: manifest.repository,
        branch: manifest.branch,
        repoSha256: manifest.repoSha256,
        files,
        syncedAt: manifest.syncedAt,
        dirty: true,
        ...(manifest.baseRepoSha256 ? { baseRepoSha256: manifest.baseRepoSha256 } : {}),
        ...(manifest.source ? { source: manifest.source } : {}),
      };
    }
    try {
      const raw = storageService.getItem(KEY);
      if (!raw) return undefined;
      const value = JSON.parse(raw);
      if (value?.files && value?.dirty === true) {
        const snapshot = value as SelfCodeSnapshot;
        this.writeDirtySnapshot(snapshot);
        return snapshot;
      }
      if (value?.files && value?.dirty !== true) {
        storageService.removeItem(KEY);
      }
    } catch { /* 読めない旧値は無いものとして扱う */ }
    return undefined;
  }

  /** dirty の有無と件数だけを軽く見る（診断用・内容は読まない） */
  private dirtyInfo(): { fileCount: number } | null {
    const manifest = this.readDirtyManifest();
    if (manifest) return { fileCount: manifest.files.length };
    try {
      const raw = storageService.getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (value?.files && value?.dirty === true) {
        return { fileCount: Array.isArray(value.files) ? value.files.length : 0 };
      }
    } catch { return null; }
    return null;
  }
}

export const selfCodeSpaceService = new SelfCodeSpaceService();
