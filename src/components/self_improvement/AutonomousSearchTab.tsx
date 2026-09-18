import React, { useState, useEffect } from 'react';
import {
  Globe,
  Search,
  BookOpen,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Clock,
  Play,
  Database,
  Brain,
  Layers,
  HelpCircle,
  AlertCircle,
  Shield,
  Key,
  Eye,
  EyeOff,
  Check,
  Trash2,
  RotateCcw,
  Plus,
} from 'lucide-react';
import {
  typedResearchUiGatewayService,
  type AutonomousSearchConfig,
  type AutonomousSearchStats,
  type AutonomousSearchLearningRecord,
  type BannedTopicsConfig,
} from '../../miki/core/ui/typedResearchUiGatewayService';

export const AutonomousSearchTab: React.FC = () => {
  const [config, setConfig] = useState<AutonomousSearchConfig>(() => typedResearchUiGatewayService.snapshot().config);
  const [stats, setStats] = useState<AutonomousSearchStats>(() => typedResearchUiGatewayService.snapshot().stats);
  const [records, setRecords] = useState<AutonomousSearchLearningRecord[]>(() => typedResearchUiGatewayService.snapshot(20).records);
  const [searxngUrl, setSearxngUrl] = useState(() => typedResearchUiGatewayService.snapshot().searxngUrl);
  const [searxngNotice, setSearxngNotice] = useState<string | null>(null);


  // テスト検索用
  const [testQuery, setTestQuery] = useState('React 19 Server Actions 仕様');
  const [preferredProvider, setPreferredProvider] = useState<'auto' | 'searxng' | 'wikipedia' | 'duckduckgo'>('auto');
  const [isSearching, setIsSearching] = useState(false);
  const [searchOutput, setSearchOutput] = useState<{
    results: any[];
    summary?: string;
    provider?: string;
    learnedRecord?: AutonomousSearchLearningRecord;
  } | null>(null);

  // アイドル自律学習の手動キック用
  const [isIdleRunning, setIsIdleRunning] = useState(false);
  const [idleResult, setIdleResult] = useState<{
    learnedCount: number;
    queriesInvestigated: string[];
    details: string[];
  } | null>(null);

  // 指示1 & 指示5: ヘッドレスWebViewレンダリング・テキスト抽出テスト用
  const [headlessUrl, setHeadlessUrl] = useState('https://ja.wikipedia.org/wiki/React');
  const [isFetchingHeadless, setIsFetchingHeadless] = useState(false);
  const [headlessOutput, setHeadlessOutput] = useState<{
    success: boolean;
    text: string;
    url: string;
    length: number;
    patternsCount: number;
    error?: string;
  } | null>(null);

  // 禁止トピック手動設定 (設計思想 21.2 & 作業指示書 v19)
  const [bannedConfig, setBannedConfig] = useState<BannedTopicsConfig>(() =>
    typedResearchUiGatewayService.snapshot().bannedTopics
  );
  const [newBannedTopic, setNewBannedTopic] = useState('');

  const refreshData = () => {
    setStats(typedResearchUiGatewayService.snapshot().stats);
    setRecords(typedResearchUiGatewayService.snapshot(20).records);
    setBannedConfig(typedResearchUiGatewayService.snapshot().bannedTopics);
  };

  const handleToggleBannedConfig = () => {
    void typedResearchUiGatewayService.setBannedTopicsEnabled(!bannedConfig.enabled).then(setBannedConfig);
  };

  const handleAddBannedTopic = async () => {
    if (!newBannedTopic.trim()) return;
    const result = await typedResearchUiGatewayService.addBannedTopic(newBannedTopic.trim());
    const added = result.added;
    if (added) {
      setNewBannedTopic('');
      setBannedConfig(result.config);
    }
  };

  const handleRemoveBannedTopic = async (topic: string) => {
    setBannedConfig(await typedResearchUiGatewayService.removeBannedTopic(topic));
  };

  const handleResetBannedTopics = async () => {
    setBannedConfig(await typedResearchUiGatewayService.resetBannedTopics());
  };

  const handleToggleConfig = async (key: keyof AutonomousSearchConfig) => {
    const updated = await typedResearchUiGatewayService.saveSearchConfig({ [key]: !config[key] });
    setConfig(updated);
  };

  const handleSaveSearxngUrl = async () => {
    await typedResearchUiGatewayService.saveSearxngUrl(searxngUrl);
    setSearxngNotice('SearXNG検索プロキシURLを端末内に保存しました。');
    setTimeout(() => setSearxngNotice(null), 3000);
  };

  const handleClearSearxngUrl = async () => {
    setSearxngUrl('');
    await typedResearchUiGatewayService.saveSearxngUrl('');
    setSearxngNotice('SearXNG検索プロキシURLを解除しました（空欄設定）。');
    setTimeout(() => setSearxngNotice(null), 3000);
  };


  const handleExecuteTestSearch = async () => {
    if (!testQuery.trim() || isSearching) return;
    setIsSearching(true);
    setSearchOutput(null);
    try {
      const res = await typedResearchUiGatewayService.executeSearch(testQuery.trim(), {
        maxResults: 4,
        bypassCache: true,
        preferredProvider,
      });
      const record = typedResearchUiGatewayService.learnFromSearch(testQuery.trim(), res.results, res.summary, {
        triggerType: 'in_conversation',
        provider: res.provider,
      });
      setSearchOutput({
        results: res.results,
        summary: res.summary,
        provider: res.provider,
        learnedRecord: record,
      });
      refreshData();
    } catch (e: any) {
      console.error('Test search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRunIdleLearningNow = async () => {
    if (isIdleRunning) return;
    setIsIdleRunning(true);
    setIdleResult(null);
    try {
      const res = await typedResearchUiGatewayService.performIdleLearning();
      setIdleResult(res);
      refreshData();
    } catch (e: any) {
      console.error('Idle learning error:', e);
    } finally {
      setIsIdleRunning(false);
    }
  };

  const handleFetchHeadlessPage = async () => {
    if (!headlessUrl.trim() || isFetchingHeadless) return;
    setIsFetchingHeadless(true);
    setHeadlessOutput(null);
    try {
      const res = await typedResearchUiGatewayService.fetchRenderedPage(headlessUrl.trim(), {
        timeoutMs: 12000,
        renderWaitMs: 1500,
      });
      setHeadlessOutput(res);
      refreshData();
    } catch (e: any) {
      console.error('Headless webview fetch error:', e);
      setHeadlessOutput({
        success: false,
        text: '',
        url: headlessUrl,
        length: 0,
        patternsCount: 0,
        error: e?.message || String(e),
      });
    } finally {
      setIsFetchingHeadless(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-200">
      {/* ヘッダー概要 */}
      <div className="p-4 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/30 border border-sky-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-sky-900/50 text-sky-400 rounded-xl border border-sky-500/40 shadow-sm">
              <Globe className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-sky-200 flex items-center gap-2">
              <span>第13章 自律型Web検索 ＆ 能動学習ループ</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-900/80 text-sky-300 border border-sky-600 font-mono">
                Active Learning Engine
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            みきが会話中の必要時や、会話していない待機時（アイドル・深い睡眠サイクル）に、
            未解決の宿題や最新仕様・事実をインターネットから自律的に検索・調査し、
            抽出した知識を長期記憶（意味記憶）や合成学習データセットへ還元する能動知性システムです。
          </p>
        </div>

        <button
          onClick={handleRunIdleLearningNow}
          disabled={isIdleRunning}
          className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md hover:shadow-sky-500/20 transition-all shrink-0"
        >
          {isIdleRunning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>自律Web学習中...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>今すぐ非会話時学習を実行</span>
            </>
          )}
        </button>
      </div>

      {/* 統計パネル */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Search className="w-3.5 h-3.5 text-sky-400" />
            <span>総Web検索数</span>
          </div>
          <div className="text-xl font-bold font-mono text-sky-300">{stats.totalSearches}回</div>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>非会話時・自律学習</span>
          </div>
          <div className="text-xl font-bold font-mono text-indigo-300">{stats.idleAutonomousSearches}回</div>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
            <span>獲得・定着ナレッジ数</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">{stats.knowledgeItemsLearned}件</div>
        </div>

        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 mb-1">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>最終学習日時</span>
          </div>
          <div className="text-xs font-bold font-mono text-amber-300 truncate">
            {stats.lastSearchAt ? new Date(stats.lastSearchAt).toLocaleTimeString() : '未実行'}
          </div>
        </div>
      </div>

      {/* 設定トグル */}
      <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>自律Web検索 & 能動学習 設定</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <label className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <span className="text-slate-300">Web検索エンジン機能の有効化</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={() => handleToggleConfig('enabled')}
              className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <span className="text-slate-300">会話中の自動検索検知 (最新情報・仕様・定義)</span>
            <input
              type="checkbox"
              checked={config.autoSearchInChat}
              onChange={() => handleToggleConfig('autoSearchInChat')}
              className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <span className="text-slate-300">非会話時・睡眠時の自律学習 (宿題・未解決の調査)</span>
            <input
              type="checkbox"
              checked={config.idleSearchEnabled}
              onChange={() => handleToggleConfig('idleSearchEnabled')}
              className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
            <span className="text-slate-300">検索結果を長期記憶(意味記憶)に自動定着</span>
            <input
              type="checkbox"
              checked={config.autoLearnToLongTermMemory}
              onChange={() => handleToggleConfig('autoLearnToLongTermMemory')}
              className="rounded accent-sky-500 w-4 h-4 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* SearXNG (Termuxローカル) 検索プロキシ設定 (任意) */}
      <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span>SearXNG 検索プロキシURL (Termuxローカル・任意)</span>
          </h4>
          <span
            className={`text-[10.5px] px-2 py-0.5 rounded-full font-mono border ${
              searxngUrl
                ? 'bg-purple-950/70 text-purple-300 border-purple-600/50'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {searxngUrl ? `接続先: ${searxngUrl}` : '空欄 (未起動時は従来の外部検索のみ使用)'}
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Termux等で自己ホスト型SearXNG（メタ検索エンジンJSON API）を動かしている場合にURLを設定します。未起動時や空欄の場合は従来の外部検索（Wikipedia / DuckDuckGo）へ自動で静かにフォールバックします。
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searxngUrl}
            onChange={(e) => setSearxngUrl(e.target.value)}
            placeholder="例: http://127.0.0.1:8888 (空欄なら従来の外部検索のみ使用)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />

          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleSaveSearxngUrl}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存</span>
            </button>
            {searxngUrl && (
              <button
                onClick={handleClearSearxngUrl}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl flex items-center gap-1 transition-colors"
                title="URLをクリア"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>クリア</span>
              </button>
            )}
          </div>
        </div>

        {searxngNotice && (
          <div className="text-[11px] text-purple-400 bg-purple-950/40 border border-purple-800/50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{searxngNotice}</span>
          </div>
        )}
      </div>


      {/* 設計思想 21.2 & 作業指示書 v19: 禁止トピック手動設定パネル */}
      <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>自律学習・禁止トピック手動設定 (安全除外フィルター)</span>
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetBannedTopics}
              className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg flex items-center gap-1 transition-colors"
              title="デフォルト禁止トピック群にリセット"
            >
              <RotateCcw className="w-3 h-3" />
              <span>初期値へリセット</span>
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer pl-1">
              <span>フィルター有効</span>
              <input
                type="checkbox"
                checked={bannedConfig.enabled}
                onChange={handleToggleBannedConfig}
                className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
              />
            </label>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          本人利用専用の安全設計として、コード固定フィルタではなく手動設定方式を採用しています。
          登録されたキーワードに一致するWeb検索クエリや取得素材は、縦(骨格)・横(言い回し)の自律学習候補から安全に完全除外されます。
        </p>

        {/* キーワード追加フォーム */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newBannedTopic}
            onChange={(e) => setNewBannedTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBannedTopic()}
            placeholder="除外したい禁止キーワードを入力して追加 (例: 暴力, 誹謗中傷)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleAddBannedTopic}
            disabled={!newBannedTopic.trim()}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>追加</span>
          </button>
        </div>

        {/* 登録済み禁止トピックタグ一覧 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {bannedConfig.topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs rounded-lg"
            >
              <span>{topic}</span>
              <button
                onClick={() => handleRemoveBannedTopic(topic)}
                className="hover:text-red-400 transition-colors p-0.5"
                title={`「${topic}」を削除`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
          {bannedConfig.topics.length === 0 && (
            <span className="text-xs text-slate-500 italic py-1">
              登録されている禁止トピックはありません。
            </span>
          )}
        </div>
      </div>

      {/* 手動検索・学習テスト */}
      <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-sky-400" />
            <span>Web検索 & ナレッジ抽出テスト</span>
          </h4>
          {/* プロバイダ優先セレクタ */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400 text-[10px]">実行順序:</span>
            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setPreferredProvider('auto')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  preferredProvider === 'auto'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="自動パイプライン: SearXNG → Wikipedia → DuckDuckGo"
              >
                自動
              </button>
              <button
                type="button"
                onClick={() => setPreferredProvider('searxng')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  preferredProvider === 'searxng'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="SearXNG (Termuxローカル) 直接優先"
              >
                SearXNG
              </button>
              <button
                type="button"
                onClick={() => setPreferredProvider('duckduckgo')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  preferredProvider === 'duckduckgo'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="DuckDuckGo 即答直接優先"
              >
                DDG
              </button>
              <button
                type="button"
                onClick={() => setPreferredProvider('wikipedia')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  preferredProvider === 'wikipedia'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Wikipedia 直接優先"
              >
                Wiki
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecuteTestSearch()}
            placeholder="調べたいキーワードを入力 (例: Python 3.13 新機能, VBA 64bit PtrSafe)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={handleExecuteTestSearch}
            disabled={isSearching || !testQuery.trim()}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>検索 & 学習</span>
          </button>
        </div>

        {/* 検索テスト結果 */}
        {searchOutput && (
          <div className="mt-3 p-3 bg-slate-900/90 border border-sky-500/40 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">プロバイダー:</span>
                <span
                  className={`text-[10.5px] px-2 py-0.5 rounded font-mono font-bold border ${
                    searchOutput.provider === 'searxng'
                      ? 'bg-purple-950 text-purple-300 border-purple-700'
                      : searchOutput.provider === 'duckduckgo_direct'
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : searchOutput.provider === 'wikipedia_direct'
                      ? 'bg-sky-950 text-sky-300 border-sky-700'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {searchOutput.provider === 'searxng'
                    ? '🔍 SearXNG (searxng)'
                    : searchOutput.provider === 'duckduckgo_direct'
                    ? '🦆 DuckDuckGo Instant Answer (duckduckgo_direct)'
                    : searchOutput.provider === 'wikipedia_direct'
                    ? '📖 Wikipedia (wikipedia_direct)'
                    : '⚠️ ローカルフォールバック (local_fallback)'}
                </span>
              </div>
              {searchOutput.results.length > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  ✓ 長期記憶・合成データセットに還元完了
                </span>
              )}
            </div>
            {searchOutput.summary && (
              <div className="p-2.5 bg-black/40 border border-slate-800 rounded-lg text-slate-200 leading-relaxed text-[11px]">
                <div className="text-sky-400 font-bold mb-1">【要約・知見】</div>
                {searchOutput.summary}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="text-[10.5px] font-bold text-slate-400">参照ソース ({searchOutput.results.length}件):</div>
              {searchOutput.results.map((r, idx) => (
                <div key={idx} className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg text-[10.5px] space-y-1">
                  <div className="flex items-center justify-between">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    >
                      <span>{r.title}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <span className="text-[9.5px] text-slate-500">{r.source}</span>
                  </div>
                  <p className="text-slate-400">{r.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 非会話時学習結果 */}
        {idleResult && (
          <div className="p-3 bg-indigo-950/30 border border-indigo-500/40 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>非会話時自律学習の実行結果: {idleResult.learnedCount}件の課題を解消</span>
            </div>
            <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
              {idleResult.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 指示1 & 指示5: ヘッドレスWebViewレンダリング＆テキスト抽出テスト */}
      <div className="p-4 bg-slate-950/70 border border-purple-900/50 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span>ヘッドレスWebView ページレンダリング ＆ テキスト抽出テスト</span>
          </h4>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
              typedResearchUiGatewayService.snapshot().androidNative
                ? 'bg-purple-950/80 text-purple-300 border-purple-600'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {typedResearchUiGatewayService.snapshot().androidNative
              ? '🤖 Android Native (MikiWorkManagerPlugin.kt)'
              : '💻 Web環境 (HTML fetch & parse フォールバック)'}
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          SPAや動的JS生成ページから確実にテキストを抽出するためのヘッドレスレンダリング機能です。
          Android実機ではネイティブの非表示WebViewで描画待機（SPAレンダリング完了）後に
          <code className="text-purple-300 px-1 font-mono">document.body.innerText</code> を抽出し、
          縦（回答骨格）および横（言い回し）の自律学習素材として安全に還元します（fetchMethod: headless_webview）。
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={headlessUrl}
            onChange={(e) => setHeadlessUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetchHeadlessPage()}
            placeholder="レンダリング対象のURL (例: https://ja.wikipedia.org/wiki/React)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <button
            onClick={handleFetchHeadlessPage}
            disabled={isFetchingHeadless || !headlessUrl.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            {isFetchingHeadless ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
            <span>レンダリング取得</span>
          </button>
        </div>

        {headlessOutput && (
          <div className="p-3 bg-slate-900/90 border border-purple-500/40 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                  headlessOutput.success
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950 text-rose-300 border-rose-700'
                }`}>
                  {headlessOutput.success ? '✓ 取得成功' : '✕ 取得失敗'}
                </span>
                <span className="text-[10.5px] font-mono text-purple-300 bg-purple-950/70 border border-purple-700/50 px-2 py-0.5 rounded">
                  fetchMethod: headless_webview
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {headlessOutput.length}文字
                </span>
              </div>
              {headlessOutput.patternsCount > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  ✓ {headlessOutput.patternsCount}件の自律学習パターン/骨格を還元
                </span>
              )}
            </div>

            {headlessOutput.error && (
              <div className="p-2 bg-rose-950/30 border border-rose-800/40 text-rose-300 text-[11px] rounded">
                エラー: {headlessOutput.error}
              </div>
            )}

            {headlessOutput.text && (
              <div className="p-2.5 bg-black/50 border border-slate-800 rounded-lg text-slate-300 font-mono text-[10.5px] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {headlessOutput.text.slice(0, 600)}
                {headlessOutput.text.length > 600 && '... (省略)'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 最近の自律学習レコード一覧 */}
      <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>最近の自律検索＆学習レコード (最新{records.length}件)</span>
          </h4>
          <button
            onClick={refreshData}
            className="text-[11px] text-slate-400 hover:text-sky-300 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>更新</span>
          </button>
        </div>

        {records.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            まだ学習レコードがありません。チャットで質問するか、手動検索テストを実行してください。
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {records.map((rec) => (
              <div
                key={rec.id}
                className="p-3 bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 rounded-xl space-y-2 text-xs transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                      {rec.triggerType === 'in_conversation'
                        ? '会話中検索'
                        : rec.triggerType === 'working_agenda'
                        ? '宿題解決'
                        : '能力ギャップ調査'}
                    </span>
                    <span className="font-semibold text-slate-200">クエリ: 「{rec.query}」</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(rec.timestamp).toLocaleString()}
                  </span>
                </div>

                {rec.summary && (
                  <p className="text-[11px] text-slate-300 bg-black/30 p-2 rounded border border-slate-800/60 leading-relaxed">
                    {rec.summary}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10.5px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>ソース数: {rec.results?.length || 0}件</span>
                  <div className="flex items-center gap-3">
                    {rec.integratedToMemory && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>長期記憶定着済</span>
                      </span>
                    )}
                    {rec.integratedToSyntheticData && (
                      <span className="text-indigo-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>合成教材化済</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
