import React, { useState } from 'react';
import {
  Github,
  GitBranch,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Lock,
  Key,
  ShieldCheck,
  Star,
  Search,
  BookOpen,
  MessageSquare,
} from 'lucide-react';
import { GitHubRepoData, PersonaConfig, WorkspaceFile } from '../types';
import { apiService } from '../services/api';

export interface GitHubHubProps {
  onLoadRepoIntoWorkspace: (repoData: GitHubRepoData) => void;
  onAskAIAboutRepo: (repoData: GitHubRepoData, promptText: string) => void;
  workspaceFiles: WorkspaceFile[];
  persona: PersonaConfig;
}

export const GitHubHub: React.FC<GitHubHubProps> = ({
  onLoadRepoIntoWorkspace,
  onAskAIAboutRepo,
  workspaceFiles,
  persona,
}) => {
  const [token, setToken] = useState(() => localStorage.getItem('miki_github_pat') || '');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('✨ Update via Miki AI Partner Studio');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fetchedRepo, setFetchedRepo] = useState<GitHubRepoData | null>(null);

  const handleSaveToken = (val: string) => {
    setToken(val);
    try {
      localStorage.setItem('miki_github_pat', val.trim());
    } catch (e) {}
  };

  const handleImport = async () => {
    if (!repoUrl.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'リポジトリ名 (owner/repo または URL) を入力してください。',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await apiService.importFromGitHub({
        token: token.trim() || undefined,
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || 'main',
      });

      if (res.success && res.files && res.files.length > 0) {
        const repoData: GitHubRepoData = {
          repoName: res.repoName || repoUrl.split('/').pop() || 'repo',
          owner: res.owner || 'github',
          stars: res.stars || 0,
          description: res.description || 'Imported GitHub Repository',
          branch: branch.trim() || 'main',
          files: res.files,
        };
        setFetchedRepo(repoData);
        setStatusMessage({
          type: 'success',
          text: `「${repoData.repoName}」から ${res.files.length} 件のファイルを取得しました！`,
        });
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'リポジトリの取得に失敗しました' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'GitHub 通信エラー' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePush = async () => {
    if (!token.trim() || !repoUrl.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Personal Access Token (PAT) と リポジトリ名 (例: owner/repo) を入力してください。',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await apiService.pushToGitHub({
        token: token.trim(),
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || 'main',
        commitMessage: commitMessage.trim() || 'Update via Miki AI Partner Studio',
        files: workspaceFiles.map((f) => ({ path: f.path, content: f.content })),
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `コミット＆プッシュ完了！ (SHA: ${res.commitSha?.slice(0, 7) || 'latest'})`,
        });
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'プッシュに失敗しました' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'GitHub API 通信エラー' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 p-4 sm:p-8 overflow-y-auto select-none">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 shadow-md">
            <Github className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">GitHub クラウド同期 & リポジトリ連携</h2>
            <p className="text-xs text-slate-400">
              GitHub上のオープンソースや自身のコードをインポートして{persona.name}と共同開発・プッシュ保存
            </p>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <Lock className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Configuration Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-sky-400" />
              <span>認証＆リポジトリ情報</span>
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>PAT トークンは端末内にのみ保存されます</span>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">GitHub Personal Access Token (PAT) [公開リポジトリは不要]</label>
              <input
                type="password"
                value={token}
                onChange={(e) => handleSaveToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (プライベートリポやプッシュ時に必要)"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">対象リポジトリ (owner/repo または URL)</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="mrdoob/three.js または user/my-game"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">ブランチ名</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">コミットメッセージ (プッシュ時)</label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="✨ Update via Miki AI Partner Studio"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Import Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <DownloadCloud className="w-5 h-5" />
                <span>リポジトリを取得 (インポート)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                GitHub リポジトリからファイル一式を取得して解析・展開します。
              </p>
            </div>

            <button
              onClick={handleImport}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              <span>リポジトリを取得する</span>
            </button>
          </div>

          {/* Push Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                <UploadCloud className="w-5 h-5" />
                <span>GitHub にプッシュ (保存)</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                現在のワークスペース ({workspaceFiles.length} ファイル) を GitHub にコミット＆プッシュします。
              </p>
            </div>

            <button
              onClick={handlePush}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <span>リポジトリにプッシュ</span>
            </button>
          </div>
        </div>

        {/* Fetched Repo Detail Card */}
        {fetchedRepo && (
          <div className="bg-slate-900 border border-sky-500/40 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {fetchedRepo.owner} / {fetchedRepo.repoName}
                  </h3>
                  <p className="text-xs text-slate-400">{fetchedRepo.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{fetchedRepo.stars}</span>
              </div>
            </div>

            <div className="text-xs text-slate-300">
              取得ファイル数: <strong>{fetchedRepo.files.length} 件</strong>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => onLoadRepoIntoWorkspace(fetchedRepo)}
                className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <span>🚀 ワークスペースに展開＆実行</span>
              </button>

              <button
                onClick={() => {
                  onAskAIAboutRepo(
                    fetchedRepo,
                    `リポジトリ「${fetchedRepo.owner}/${fetchedRepo.repoName}」のコード構造と主要機能をわかりやすく解説して！`
                  );
                }}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{persona.name}にコード解説を依頼</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
