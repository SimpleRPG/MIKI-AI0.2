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
  Plus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  autonomousSearchService,
  AutonomousSearchConfig,
  AutonomousSearchStats,
} from '../../services/autonomousSearchService';
import { AutonomousSearchLearningRecord } from '../../types';
import {
  bannedTopicsConfigService,
  BannedTopicsConfig,
} from '../../services/bannedTopicsConfigService';

export const AutonomousSearchTab: React.FC = () => {
  const [config, setConfig] = useState<AutonomousSearchConfig>(() => autonomousSearchService.getConfig());
  const [stats, setStats] = useState<AutonomousSearchStats>(() => autonomousSearchService.getStats());
  const [records, setRecords] = useState<AutonomousSearchLearningRecord[]>(() => autonomousSearchService.getRecentRecords(20));

  // テスト検索用
  const [testQuery, setTestQuery] = useState('React 19 Server Actions 仕様');
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

  // 禁止トピック手動設定 (設計思想 21.2 & 作業指示書 v19)
  const [bannedConfig, setBannedConfig] = useState<BannedTopicsConfig>(() =>
    bannedTopicsConfigService.getConfig()
  );
  const [newBannedTopic, setNewBannedTopic] = useState('');

  const refreshData = () => {
    setStats(autonomousSearchService.getStats());
    setRecords(autonomousSearchService.getRecentRecords(20));
    setBannedConfig(bannedTopicsConfigService.getConfig());
  };

  const handleToggleBannedConfig = () => {
    bannedTopicsConfigService.setEnabled(!bannedConfig.enabled);
    setBannedConfig(bannedTopicsConfigService.getConfig());
  };

  const handleAddBannedTopic = () => {
    if (!newBannedTopic.trim()) return;
    const added = bannedTopicsConfigService.addTopic(newBannedTopic.trim());
    if (added) {
      setNewBannedTopic('');
      setBannedConfig(bannedTopicsConfigService.getConfig());
    }
  };

  const handleRemoveBannedTopic = (topic: string) => {
    bannedTopicsConfigService.removeTopic(topic);
    setBannedConfig(bannedTopicsConfigService.getConfig());
  };

  const handleResetBannedTopics = () => {
    bannedTopicsConfigService.resetToDefault();
    setBannedConfig(bannedTopicsConfigService.getConfig());
  };

  const handleToggleConfig = (key: keyof AutonomousSearchConfig) => {
    const updated = autonomousSearchService.saveConfig({ [key]: !config[key] });
    setConfig(updated);
  };

  const handleExecuteTestSearch = async () => {
    if (!testQuery.trim() || isSearching) return;
    setIsSearching(true);
    setSearchOutput(null);
    try {
      const res = await autonomousSearchService.executeSearch(testQuery.trim(), { maxResults: 4, bypassCache: true });
      const record = autonomousSearchService.learnFromSearch(testQuery.trim(), res.results, res.summary, {
        triggerType: 'in_conversation',
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
      const res = await autonomousSearchService.performIdleAutonomousLearning();
      setIdleResult(res);
      refreshData();
    } catch (e: any) {
      console.error('Idle learning error:', e);
    } finally {
      setIsIdleRunning(false);
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
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-sky-400" />
          <span>Web検索 & ナレッジ抽出テスト</span>
        </h4>
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
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>検索 & 学習</span>
          </button>
        </div>

        {/* 検索テスト結果 */}
        {searchOutput && (
          <div className="mt-3 p-3 bg-slate-900/90 border border-sky-500/40 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-sky-300">プロバイダー: {searchOutput.provider}</span>
              <span className="text-[10px] text-emerald-400 font-mono">
                ✓ 長期記憶・合成データセットに還元完了
              </span>
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
