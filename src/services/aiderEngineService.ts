/**
 * AIDER 統合エンジン サービス (Aider-Inspired Self-Coding Engine)
 *
 * Aiderの4大強力コア機構:
 * 1. Repo Map (プロジェクト全体のAST構文地図)
 * 2. Search/Replace ブロック差分置換 (低トークン・高精度パッチ)
 * 3. 自動構文自己修復ループ (Auto-Healing Loop)
 * 4. アトミックGitコミット & 1秒ロールバック管理
 */

import { systemLogger } from './systemLogger';

export interface RepoMapSymbol {
  kind: string;
  name: string;
  signature?: string;
}

export interface RepoMapEntry {
  file: string;
  symbols: RepoMapSymbol[];
}

export interface RepoMapResponse {
  success: boolean;
  scannedFilesCount: number;
  totalSymbolsCount: number;
  entries: RepoMapEntry[];
  formattedRepoMap: string;
  generatedAt: number;
}

export interface SearchReplaceResult {
  success: boolean;
  filePath?: string;
  diffSummary?: string;
  error?: string;
}

export interface AutoHealResult {
  success: boolean;
  healed: boolean;
  attempts: number;
  cleanCode: string;
  repairHistory: Array<{ attempt: number; error: string; fixApplied: string }>;
  finalErrorCount: number;
}

export interface AiderCommitRecord {
  hash: string;
  message: string;
  timestamp: number;
  files: string[];
  status: 'COMMITTED' | 'ROLLED_BACK';
  snapshots?: Array<{ filePath: string; snapshotId?: string }>;
  isStub?: boolean;
  engine?: string;
  author?: string;
}

export class AiderEngineService {
  /**
   * 1. Aider Repo Map を取得
   */
  public async fetchRepoMap(): Promise<RepoMapResponse> {
    try {
      const res = await fetch('/api/aider/repo-map');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RepoMapResponse = await res.json();
      systemLogger.info('SELF_IMPROVEMENT', `[Aider Repo Map] ${data.scannedFilesCount} ファイル / ${data.totalSymbolsCount} シンボル走査完了`);
      return data;
    } catch (err: any) {
      console.warn('fetchRepoMap failed:', err);
      return {
        success: false,
        scannedFilesCount: 0,
        totalSymbolsCount: 0,
        entries: [],
        formattedRepoMap: '=== AIDER REPOSITORY MAP (OFFLINE FALLBACK) ===\n',
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * 2. Search/Replace ブロック差分置換
   */
  public async applySearchReplace(filePath: string, searchBlock: string, replaceBlock: string): Promise<SearchReplaceResult> {
    try {
      const res = await fetch('/api/aider/search-replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, searchBlock, replaceBlock }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || '置換に失敗しました' };
      }
      systemLogger.info('SELF_IMPROVEMENT', `[Aider Diff] ${data.diffSummary}`);
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || '通信エラー' };
    }
  }

  /**
   * 3. 自動エラー自己修復ループ
   */
  public async autoHealCode(code: string, filename: string = 'module.ts'): Promise<AutoHealResult> {
    try {
      const res = await fetch('/api/aider/auto-heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename }),
      });
      const data = await res.json();
      systemLogger.info('SELF_IMPROVEMENT', `[Aider Auto-Heal] 修復試行: ${data.attempts}回, 解決: ${data.healed}`);
      return data;
    } catch (err: any) {
      return {
        success: false,
        healed: false,
        attempts: 1,
        cleanCode: code,
        repairHistory: [{ attempt: 1, error: err.message || '通信エラー', fixApplied: '修復不可' }],
        finalErrorCount: 1,
      };
    }
  }

  /**
   * 4. コミット履歴取得 & コミット & ロールバック
   */
  public async fetchCommits(): Promise<AiderCommitRecord[]> {
    try {
      const res = await fetch('/api/aider/commits');
      if (!res.ok) return [];
      const data = await res.json();
      return data.commits || [];
    } catch (e) {
      return [];
    }
  }

  public async createCommit(message: string, files?: string[]): Promise<AiderCommitRecord | null> {
    try {
      const res = await fetch('/api/aider/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, files }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      systemLogger.info('SELF_IMPROVEMENT', `[Aider Git Commit] [${data.commit.hash}] ${data.commit.message}`);
      return data.commit;
    } catch (e) {
      return null;
    }
  }

  public async rollbackCommit(hash: string): Promise<{ success: boolean; message: string; restoredFiles?: string[] }> {
    try {
      const res = await fetch('/api/aider/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      });
      const data = await res.json();
      systemLogger.info('SELF_IMPROVEMENT', `[Aider Rollback] コミット [${hash}] を物理復元しました: ${data.message}`);
      return { success: data.success, message: data.message || data.error, restoredFiles: data.restoredFiles };
    } catch (err: any) {
      return { success: false, message: err.message || 'ロールバック通信エラー' };
    }
  }
}

export const aiderEngineService = new AiderEngineService();
