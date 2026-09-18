import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Terminal,
  ShieldCheck,
  Key,
  FolderGit2,
  Loader2,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface GitStatusResponse {
  success: boolean;
  initialized: boolean;
  branch: string | null;
  filesCount?: number;
  files?: Array<{ code: string; filePath: string }>;
  remotes?: string[];
  lastCommit?: string | null;
  message?: string;
}

interface GitCommitItem {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export const GitIntegrationView: React.FC = () => {
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [gitLogs, setGitLogs] = useState<GitCommitItem[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // コミット用
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitNotice, setCommitNotice] = useState<{ type: 'success' | 'error'; text: string; violations?: any[] } | null>(null);

  // Push用
  const [githubPat, setGithubPat] = useState(() => localStorage.getItem('miki_github_pat') || '');
  const [repoUrl, setRepoUrl] = useState(() => localStorage.getItem('miki_github_repo_url') || '');
  const [pushBranch, setPushBranch] = useState('main');
  const [pushing, setPushing] = useState(false);
  const [pushNotice, setPushNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 初期化
  const [initializing, setInitializing] = useState(false);

  // PAT変更時にローカルストレージ（ブラウザ側のみ）に退避
  const handlePatChange = (val: string) => {
    setGithubPat(val);
    if (val) {
      localStorage.setItem('miki_github_pat', val);
    } else {
      localStorage.removeItem('miki_github_pat');
    }
  };

  const handleRepoUrlChange = (val: string) => {
    setRepoUrl(val);
    if (val) {
      localStorage.setItem('miki_github_repo_url', val);
    } else {
      localStorage.removeItem('miki_github_repo_url');
    }
  };

  // ステータス取得
  const fetchStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/git/status');
      const data: GitStatusResponse = await res.json();
      setGitStatus(data);
      if (data.initialized) {
        fetchLogs();
      }
    } catch (err: any) {
      setStatusError('Gitステータス取得エラー: ' + (err?.message || '通信失敗'));
    } finally {
      setLoadingStatus(false);
    }
  };

  // ログ取得
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/git/log');
      const data = await res.json();
      if (data.success && Array.isArray(data.commits)) {
        setGitLogs(data.commits);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Git初期化
  const handleGitInit = async () => {
    setInitializing(true);
    try {
      const res = await fetch('/api/git/init', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCommitNotice({ type: 'success', text: '✅ Gitリポジトリを初期化しました (branch: main)' });
        fetchStatus();
      } else {
        setCommitNotice({ type: 'error', text: '❌ 初期化失敗: ' + (data.error || '不明なエラー') });
      }
    } catch (err: any) {
      setCommitNotice({ type: 'error', text: '❌ 通信エラー: ' + err.message });
    } finally {
      setInitializing(false);
    }
  };

  // コミット実行
  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) return;

    setCommitting(true);
    setCommitNotice(null);

    try {
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setCommitNotice({
          type: 'success',
          text: `🎉 本物のGitコミットを作成しました！ (${data.shortHash} - ${data.message})\n※${data.note}`,
        });
        setCommitMessage('');
        fetchStatus();
      } else {
        setCommitNotice({
          type: 'error',
          text: `❌ コミット拒否: ${data.error || 'コミットに失敗しました'}`,
          violations: data.violations,
        });
      }
    } catch (err: any) {
      setCommitNotice({ type: 'error', text: '❌ 通信エラー: ' + err.message });
    } finally {
      setCommitting(false);
    }
  };

  // Push実行（人間による明示的操作）
  const handlePush = async () => {
    if (!githubPat && !repoUrl) {
      if (!confirm('GitHub PATまたはリポジトリURLが設定されていません。登録済みのデフォルトリモート (origin) に対しそのまま push を試行しますか？')) {
        return;
      }
    }

    setPushing(true);
    setPushNotice(null);

    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: pushBranch.trim() || 'main',
          token: githubPat.trim() || undefined,
          repoUrl: repoUrl.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPushNotice({
          type: 'success',
          text: `🚀 GitHubへのPushが成功しました！ (${data.branch}ブランチへ反映完了)`,
        });
        fetchStatus();
      } else {
        setPushNotice({
          type: 'error',
          text: `❌ Push失敗: ${data.error || '不明なエラーが発生しました'}`,
        });
      }
    } catch (err: any) {
      setPushNotice({ type: 'error', text: '❌ 通信エラー: ' + err.message });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 導入ヘッダー */}
      <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-start gap-3">
        <FolderGit2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-emerald-200 text-sm flex items-center gap-2">
            Termux / 実Git・GitHub連携ハブ (第2.4節)
            <span className="px-2 py-0.5 bg-emerald-900/80 text-emerald-300 rounded text-[10px] border border-emerald-700">
              実Git CLI連動
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            自己改善や機能実装の成果を、本物のGitリポジトリへコミットし、TermuxやGitHubリモートへ安全にPush・同期します。<br />
            <strong>秘密情報自動検知ガードレール</strong>により、APIキーや個人トークンがコードベースに含まれている場合はコミットが自動遮断されます。
          </p>
        </div>
      </div>

      {/* ステータスバナー */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-slate-200 text-sm">Git リポジトリステータス</span>
            {gitStatus?.initialized ? (
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[11px] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                初期化済み (ブランチ: {gitStatus.branch})
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[11px] font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                .git 未初期化
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
              ステータス更新
            </button>
            {!gitStatus?.initialized && (
              <button
                onClick={handleGitInit}
                disabled={initializing}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
              >
                {initializing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderGit2 className="w-3.5 h-3.5" />}
                Gitリポジトリを初期化 (git init)
              </button>
            )}
          </div>
        </div>

        {statusError && (
          <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            {statusError}
          </div>
        )}

        {gitStatus?.initialized && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-slate-400 text-[11px]">最新コミット</div>
              <div className="font-mono text-slate-200 mt-1 truncate">
                {gitStatus.lastCommit || '(コミット履歴なし)'}
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-slate-400 text-[11px]">未コミットの変更ファイル</div>
              <div className="font-bold text-slate-200 mt-1">
                {gitStatus.filesCount ?? 0} 件
              </div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <div className="text-slate-400 text-[11px]">リモート設定 (Remotes)</div>
              <div className="font-mono text-slate-300 mt-1 truncate">
                {gitStatus.remotes && gitStatus.remotes.length > 0
                  ? gitStatus.remotes[0]
                  : '(リモート未登録)'}
              </div>
            </div>
          </div>
        )}

        {/* 変更ファイル一覧プレビュー */}
        {gitStatus?.files && gitStatus.files.length > 0 && (
          <div className="mt-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
              <span>変更されたファイル ({gitStatus.files.length}件):</span>
              <span className="text-[10px] text-slate-500">M: 変更 / A: 追加 / ?: 未追跡</span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px]">
              {gitStatus.files.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-300">
                  <span className="px-1 py-0.2 bg-slate-800 text-amber-300 rounded text-[9px] font-bold">
                    {f.code}
                  </span>
                  <span className="truncate">{f.filePath}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2カラム構成: コミット作成 & GitHub Push */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左: 本物のGitコミット作成 */}
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <GitCommit className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-sm">本物のGitコミットを作成 (指示書 2.4-3)</h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            ステージング差分を走査し、<strong>秘密情報（APIキー・アクセストークン等）が含まれていないことを自動検証</strong>した上で、実Gitコミットオブジェクトを生成します。
          </p>

          <form onSubmit={handleCommit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                コミットメッセージ <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="例: feat(self-code): 自律改善提案の検証完了と不変条件テスト合格"
                rows={3}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="p-2.5 bg-indigo-950/30 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-[11px] text-indigo-300">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>コミット前にAPIキー・PAT・秘密鍵のスキャンが自動実行されます。</span>
            </div>

            <button
              type="submit"
              disabled={committing || !commitMessage.trim() || !gitStatus?.initialized}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
            >
              {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
              Gitコミットを実行する
            </button>
          </form>

          {commitNotice && (
            <div
              className={`p-3 rounded-xl text-xs space-y-1 ${
                commitNotice.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-700/60 text-rose-200'
              }`}
            >
              <div className="whitespace-pre-wrap font-medium">{commitNotice.text}</div>
              {commitNotice.violations && (
                <div className="mt-2 pt-2 border-t border-rose-800/40 space-y-1">
                  <div className="font-bold text-rose-300">⚠️ 検出された秘密情報:</div>
                  {commitNotice.violations.map((v, i) => (
                    <div key={i} className="text-[11px] text-rose-400 font-mono">
                      • {v.file}: {v.reasons.join(', ')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右: Termux / GitHub Push 操作 */}
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-slate-200 text-sm">GitHubへPush (人間による明示的操作・指示書 2.4-5)</h3>
            </div>
            <span className="px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded text-[10px] font-bold">
              手動実行限定
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            自動ループから不用意にPushされることはありません。<strong>人間が明示的に確認したタイミングでのみ</strong>GitHubへPushを送信します。
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>GitHub リポジトリ URL</span>
                <span className="text-[10px] text-slate-500 font-normal">ブラウザ内にのみ保持</span>
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => handleRepoUrlChange(e.target.value)}
                placeholder="https://github.com/username/miki.git"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  GitHub Personal Access Token (PAT)
                </span>
                <span className="text-[10px] text-amber-400/80 font-normal">リポジトリ外（ブラウザlocalStorage）保持</span>
              </label>
              <input
                type="password"
                value={githubPat}
                onChange={(e) => handlePatChange(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                プッシュ先ブランチ
              </label>
              <input
                type="text"
                value={pushBranch}
                onChange={(e) => setPushBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <button
              onClick={handlePush}
              disabled={pushing || !gitStatus?.initialized}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
            >
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              GitHubへプッシュを実行する
            </button>
          </div>

          {pushNotice && (
            <div
              className={`p-3 rounded-xl text-xs whitespace-pre-wrap font-medium ${
                pushNotice.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-700/60 text-rose-200'
              }`}
            >
              {pushNotice.text}
            </div>
          )}
        </div>
      </div>

      {/* 本物のコミット履歴タイムライン */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-slate-200 text-sm">実Git コミット履歴 (直近15件)</h3>
          </div>
          <span className="text-[11px] text-slate-400">
            git log 由来（.aider_commits.jsonのスナップショットとは別物）
          </span>
        </div>

        {gitLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            コミット履歴がまだありません。上のフォームから最初のコミットを作成してください。
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {gitLogs.map((c, i) => (
              <div
                key={i}
                className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded shrink-0">
                    {c.hash}
                  </span>
                  <span className="text-slate-200 font-medium truncate">{c.message}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                  <span>{c.author}</span>
                  <span className="text-slate-500">{c.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
