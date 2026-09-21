import React, { useState, useEffect } from 'react';
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
import { isEditableInputActive } from '../utils/isEditableInputActive';
import {
  typedGitHubUiGatewayService,
  type DomainCoverage,
  type ExternalDirective,
  type ImprovementDirection,
  type UnknownResolution,
} from '../miki/core/ui/typedGitHubUiGatewayService';

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
  const [directiveRows, setDirectiveRows] = useState<ExternalDirective[]>(() => typedGitHubUiGatewayService.externalDirective.list().slice(0, 5));
  const [directiveText, setDirectiveText] = useState('');
  const [directiveFileName, setDirectiveFileName] = useState('external-ai-directive.txt');
  const [directiveBusy, setDirectiveBusy] = useState(false);
  const [directiveStatus, setDirectiveStatus] = useState('');
  const [token, setToken] = useState(() => typedGitHubUiGatewayService.storage.getItem('miki_github_pat') || '');
  const [repoUrl, setRepoUrlState] = useState(() => typedGitHubUiGatewayService.storage.getItem('miki_github_repo_url') || '');
  const [branch, setBranchState] = useState(() => typedGitHubUiGatewayService.storage.getItem('miki_github_branch') || 'main');
  const [commitMessage, setCommitMessageState] = useState(
    () => typedGitHubUiGatewayService.storage.getItem('miki_github_commit_msg') || '✨ Update via Miki AI Partner Studio'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fetchedRepo, setFetchedRepo] = useState<GitHubRepoData | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(workspaceFiles.map((f) => f.path))
  );

  const [unknownRecords, setUnknownRecords] = useState<UnknownResolution[]>(() => typedGitHubUiGatewayService.unknown.list(8));
  const [domainCoverage, setDomainCoverage] = useState<DomainCoverage[]>(() => typedGitHubUiGatewayService.circulation.getCoverage());
  const [improvementDirection, setImprovementDirection] = useState<ImprovementDirection>(() => typedGitHubUiGatewayService.improvementDirection.getPolicy().direction);
  const [discoveryInterval, setDiscoveryInterval] = useState<number>(() => typedGitHubUiGatewayService.issueDiscovery.getConfig().intervalMinutes);
  useEffect(() => {
    const refresh = () => {
      if (isEditableInputActive()) return;
      setUnknownRecords(typedGitHubUiGatewayService.unknown.list(8));
      setDomainCoverage(typedGitHubUiGatewayService.circulation.getCoverage());
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const [apiBaseUrl, setApiBaseUrlState] = useState(() => typedGitHubUiGatewayService.storage.getItem('miki_api_base_url') || '');
  const setApiBaseUrl = (val: string) => {
    setApiBaseUrlState(val);
    try {
      typedGitHubUiGatewayService.storage.setItem('miki_api_base_url', val.trim());
    } catch (e) {}
  };
  const [searxngBaseUrl, setSearxngBaseUrlState] = useState(() => typedGitHubUiGatewayService.storage.getItem('miki_searxng_base_url') || '');
  const setSearxngBaseUrl = (val: string) => {
    setSearxngBaseUrlState(val);
    try {
      typedGitHubUiGatewayService.storage.setItem('miki_searxng_base_url', val.trim());
    } catch (e) {}
  };
  const handleSaveToken = (val: string) => {
    setToken(val);
    try {
      typedGitHubUiGatewayService.storage.setItem('miki_github_pat', val.trim());
    } catch (e) {}
  };

  const setRepoUrl = (val: string) => {
    setRepoUrlState(val);
    try {
      typedGitHubUiGatewayService.storage.setItem('miki_github_repo_url', val);
    } catch (e) {}
  };

  const setBranch = (val: string) => {
    setBranchState(val);
    try {
      typedGitHubUiGatewayService.storage.setItem('miki_github_branch', val);
    } catch (e) {}
  };

  const setCommitMessage = (val: string) => {
    setCommitMessageState(val);
    try {
      typedGitHubUiGatewayService.storage.setItem('miki_github_commit_msg', val);
    } catch (e) {}
  };

  // ワークスペースのファイルが増減したら選択状態を追従させる
  useEffect(() => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      workspaceFiles.forEach((f) => next.add(f.path));
      Array.from(next).forEach((p) => {
        if (!workspaceFiles.some((f) => f.path === p)) next.delete(p);
      });
      return next;
    });
  }, [workspaceFiles]);

  const toggleFile = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
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
      const res = await typedGitHubUiGatewayService.api.importFromGitHub({
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

    if (selectedPaths.size === 0) {
      setStatusMessage({
        type: 'error',
        text: 'プッシュするファイルを1件以上選択してください。',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await typedGitHubUiGatewayService.api.pushToGitHub({
        token: token.trim(),
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || 'main',
        commitMessage: commitMessage.trim() || 'Update via Miki AI Partner Studio',
        files: workspaceFiles
          .filter((f) => selectedPaths.has(f.path))
          .map((f) => ({ path: f.path, content: f.content })),
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

  const receiveExternalDirective = async () => {
    if (!directiveText.trim() || directiveBusy) return;
    setDirectiveBusy(true);
    setDirectiveStatus('');
    try {
      const result = await typedGitHubUiGatewayService.externalDirective.receiveTextFile(directiveFileName, directiveText);
      setDirectiveRows(typedGitHubUiGatewayService.externalDirective.list().slice(0, 5));
      setDirectiveStatus(`別Runで受付済み: ${result.run.runId}`);
      setDirectiveText('');
    } catch (error) {
      setDirectiveStatus(error instanceof Error ? error.message : '外部指示書を受け付けられませんでした');
    } finally {
      setDirectiveBusy(false);
    }
  };

  const loadDirectiveFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDirectiveFileName(file.name);
    setDirectiveText(await file.text());
    event.target.value = '';
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


        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div>
            <div className="text-sm font-bold text-amber-300">外部AI作業指示書</div>
            <p className="text-[11px] text-slate-400 mt-1">自動発見課題とは別Runで受け付け、共通Queue以降だけ同じ安全パイプラインを使います。</p>
          </div>
          <label className="min-h-11 flex items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 text-xs text-slate-300 cursor-pointer px-3">
            TXTを選択
            <input type="file" accept=".txt,text/plain" className="hidden" onChange={loadDirectiveFile} />
          </label>
          <input value={directiveFileName} onChange={(event) => setDirectiveFileName(event.target.value)} className="w-full min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-base text-slate-100" aria-label="作業指示書ファイル名" />
          <textarea value={directiveText} onChange={(event) => setDirectiveText(event.target.value)} rows={7} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base text-slate-100 resize-y" placeholder="外部AIの作業指示書を貼り付けるか、TXTを選択" />
          <button onClick={receiveExternalDirective} disabled={!directiveText.trim() || directiveBusy} className="w-full min-h-11 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm disabled:opacity-40">
            {directiveBusy ? '受付処理中' : '別Runとして受け付ける'}
          </button>
          {directiveStatus && <div className="text-xs rounded-lg bg-slate-950 border border-slate-800 p-2 text-slate-300">{directiveStatus}</div>}
          {directiveRows.length > 0 && <div className="space-y-2">{directiveRows.map((row) => <div key={row.directiveId} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="text-xs font-semibold text-slate-200 break-all">{row.sourceFileName}</div><div className="text-[10px] text-slate-400 mt-1">{row.status} / {row.runId || 'Run未発行'} / 対象 {row.targetFiles.length}件</div></div>)}</div>}
        </section>

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
              <label className="block text-slate-400 mb-1">
                APIサーバーURL [本体GPU(APK)モードでTermuxのサーバーを使う時のみ入力]
              </label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="例: http://127.0.0.1:3000 (空欄ならこのアプリと同じサーバーを使う)"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                GoogleAIStudioのプレビューやWeb版ではこの欄は空のままでOKです。APK版で「Unexpected token &lt;」エラーが出る場合は、Termuxで`npm run dev`を起動した上でこのURLを設定してください。
              </p>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                SearXNG検索プロキシURL (Termux等で自己ホストする場合のみ入力。空欄ならローカル検索プロキシなしで従来の外部検索のみ使用)
              </label>
              <input
                type="text"
                value={searxngBaseUrl}
                onChange={(e) => setSearxngBaseUrl(e.target.value)}
                placeholder="例: http://127.0.0.1:8888 (空欄時は従来の外部検索のみ使用)"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Termux環境等でSearXNG（自己ホスト型メタ検索エンジン）を動かしている場合に設定します。未起動時や空欄の場合は従来の外部検索（Wikipedia / DuckDuckGo）へ自動で静かにフォールバックします。
              </p>
            </div>

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

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-violet-300 font-bold text-sm"><Search className="w-4 h-4" /><span>未知調査・GitHub探索台帳</span></div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {unknownRecords.length === 0 ? <p className="text-xs text-slate-500">未知調査の記録はまだありません。</p> : unknownRecords.map((record) => (
              <article key={record.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-xs text-slate-200 line-clamp-2">{record.question}</p>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] text-slate-400"><span>{record.classification}</span><span>Evidence {record.evidenceIds.length}</span><span>Claim {record.claimIds.length}</span><span>{record.verificationStatus}</span></div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="text-sm font-bold text-fuchsia-300">自己改善の方向・間隔</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {([
              ['BALANCED','バランス'],['CODE_QUALITY','コードの書き方'],['CONVERSATION','会話・理解力'],
              ['VBA_EXPERTISE','VBA解析・修復'],['RESEARCH','ネット調査'],['MOBILE_STABILITY','スマホ安定性'],
            ] as Array<[ImprovementDirection,string]>).map(([value,label]) => (
              <button key={value} onClick={() => { typedGitHubUiGatewayService.improvementDirection.setDirection(value); setImprovementDirection(value); }} className={`rounded-lg border px-2 py-2 text-[10px] font-semibold ${improvementDirection === value ? 'border-fuchsia-400 bg-fuchsia-950/50 text-fuchsia-200' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select value={discoveryInterval} onChange={(event) => { const value=Number(event.target.value); typedGitHubUiGatewayService.issueDiscovery.setConfig({ intervalMinutes:value, enabled:true }); setDiscoveryInterval(value); }} className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              <option value={60}>1時間ごと</option><option value={180}>3時間ごと</option><option value={360}>6時間ごと</option><option value={720}>12時間ごと</option><option value={1440}>24時間ごと</option><option value={2880}>48時間ごと</option><option value={10080}>7日ごと</option>
            </select>
            <button onClick={() => { void typedGitHubUiGatewayService.issueDiscovery.scan(); }} className="rounded-lg border border-cyan-700 bg-cyan-950/30 px-3 py-2 text-[10px] font-semibold text-cyan-200">今すぐ課題検索</button>
          </div>
          <div className="text-[9px] text-slate-500">選んだ方向は課題の優先順位へ反映されます。検証なしの適用やGitHub pushは行いません。</div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between"><div className="text-sm font-bold text-cyan-300">18分類 相互循環カバレッジ</div><div className="text-[10px] text-slate-400">Blackboard {typedGitHubUiGatewayService.blackboard.list(200).length}件 / 課題 {typedGitHubUiGatewayService.issueDiscovery.list(200).filter(item => !item.resolvedAt).length}件 / 必要資産 {typedGitHubUiGatewayService.requiredAssets.list(200).filter(item => item.status !== 'ACQUIRED').length}件 / 自己改善 {typedGitHubUiGatewayService.getImprovementStatus().status}{typedGitHubUiGatewayService.getImprovementStatus().activeTaskId ? ` / Task ${typedGitHubUiGatewayService.getImprovementStatus().activeTaskId}` : ''}</div></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {domainCoverage.map((item) => (
              <div key={item.domain} className={`rounded-lg border p-2 ${item.connected ? 'border-emerald-800 bg-emerald-950/20' : 'border-amber-800 bg-amber-950/20'}`}>
                <div className="text-[11px] font-semibold text-slate-200 truncate">{item.domain}</div>
                <div className="text-[9px] text-slate-400">IN {item.inbound} / OUT {item.outbound}</div>
                <div className={`text-[9px] ${item.connected ? 'text-emerald-300' : 'text-amber-300'}`}>{typedGitHubUiGatewayService.bootstrap.getStatus().registered.some((entry) => entry.domain === item.domain) ? (item.connected ? '入口登録・循環確認' : '入口登録・実循環待ち') : '入口未登録'}</div>
              </div>
            ))}
          </div>
        </section>

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
                選択したファイル ({selectedPaths.size} / {workspaceFiles.length} 件) を GitHub にコミット＆プッシュします。
              </p>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-950 border border-slate-800 rounded-xl p-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[10px] text-slate-500">
                  {selectedPaths.size} / {workspaceFiles.length} 件選択中
                </span>
                <button
                  onClick={() =>
                    setSelectedPaths(
                      selectedPaths.size === workspaceFiles.length
                        ? new Set()
                        : new Set(workspaceFiles.map((f) => f.path))
                    )
                  }
                  className="text-[10px] text-sky-400 hover:text-sky-300"
                >
                  {selectedPaths.size === workspaceFiles.length ? 'すべて解除' : 'すべて選択'}
                </button>
              </div>
              {workspaceFiles.map((f) => (
                <label
                  key={f.path}
                  className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-900 cursor-pointer text-xs text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedPaths.has(f.path)}
                    onChange={() => toggleFile(f.path)}
                    className="accent-sky-500"
                  />
                  <span className="truncate">{f.path}</span>
                </label>
              ))}
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
