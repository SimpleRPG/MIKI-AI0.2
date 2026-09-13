import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Search,
  Lock,
  Cpu,
  RefreshCw,
  Zap,
  BookOpen,
  Code2,
  Check,
  Compass,
  Brain,
  Layers,
  ArrowRight,
  ShieldAlert,
  GitCommit,
  FlaskConical,
  Scale,
  Activity,
  Filter,
} from 'lucide-react';
import { workDirectiveIngestionService } from '../../services/workDirectiveIngestionService';
import { evidenceBasedSelfImprovementEngine } from '../../services/evidenceBasedSelfImprovementEngine';
import { selfImprovementControllerService, ImprovementDecision } from '../../services/selfImprovementControllerService';
import {
  StructuredDirective,
  RequirementContract,
  ImplementationEvidence,
  SelfImprovementStrategy,
  NoChangeDecision,
} from '../../types/evidenceSelfImprovementTypes';

export const EvidenceBasedLoopSubView: React.FC = () => {
  const [rawDirectiveText, setRawDirectiveText] = useState('');
  const [directives, setDirectives] = useState<StructuredDirective[]>([]);
  const [selectedDirective, setSelectedDirective] = useState<StructuredDirective | null>(null);
  const [contracts, setContracts] = useState<RequirementContract[]>([]);
  const [evidences, setEvidences] = useState<ImplementationEvidence[]>([]);
  const [strategies, setStrategies] = useState<SelfImprovementStrategy[]>([]);
  const [noChangeDecisions, setNoChangeDecisions] = useState<NoChangeDecision[]>([]);
  const [targetDecision, setTargetDecision] = useState<ImprovementDecision | null>(null);
  const [lockStatus, setLockStatus] = useState({ locked: false, holder: '', remainingSeconds: 0 });
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'directive' | 'evidence' | 'contracts' | 'strategies' | 'nochange'>('directive');

  const refreshState = () => {
    const allDirectives = workDirectiveIngestionService.getAllDirectives();
    setDirectives(allDirectives);
    if (!selectedDirective && allDirectives.length > 0) {
      setSelectedDirective(allDirectives[0]);
    }

    setContracts(evidenceBasedSelfImprovementEngine.getAllContracts());
    setEvidences(evidenceBasedSelfImprovementEngine.getAllEvidences());
    setStrategies(evidenceBasedSelfImprovementEngine.getStrategies());
    setNoChangeDecisions(evidenceBasedSelfImprovementEngine.getNoChangeDecisions());
    setLockStatus(evidenceBasedSelfImprovementEngine.getLockStatus());
    setTargetDecision(selfImprovementControllerService.decide());
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleIngestText = () => {
    if (!rawDirectiveText.trim()) return;
    const structured = workDirectiveIngestionService.ingestDirectiveText(rawDirectiveText);
    setSelectedDirective(structured);
    setRawDirectiveText('');
    refreshState();
  };

  const handleLoadV24Preset = () => {
    const v24Directive = workDirectiveIngestionService.ingestV24Directive();
    setSelectedDirective(v24Directive);
    refreshState();
  };

  const handleRunCanonicalCycle = async () => {
    setIsExecuting(true);
    setExecutionMessage('正規自己改善パイプライン (Canonical Pipeline) を実行中...');
    try {
      const runResult = await selfImprovementControllerService.runOnce('manual-ui');
      setExecutionMessage(
        `サイクル完了: [${runResult.decision.action}] ${runResult.result || '完了'} (判定: ${runResult.verdict || 'N/A'})`
      );
      refreshState();
    } catch (err: any) {
      setExecutionMessage(`実行エラー: ${err?.message || String(err)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* ── ヘッダー ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                Canonical Architecture
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                14-Point Evidence Pipeline
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <FlaskConical className="w-7 h-7 text-indigo-400" />
              証拠ベース自己改善ループ & 作業指示書取込
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              作業指示書テキストを目的・対象・要求内容・禁止事項・完了条件に構造化し、
              ChangeSetID・反例ゲート・汎化ゲート・因果性実験・排他ロックによる14要件の厳格証拠パイプラインを統合運用します。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshState}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              再読込
            </button>
            <button
              onClick={handleRunCanonicalCycle}
              disabled={isExecuting || lockStatus.locked}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            >
              <Play className="w-4 h-4 fill-white" />
              {isExecuting ? '実行中...' : '正規改善サイクル実行'}
            </button>
          </div>
        </div>

        {/* 排他ロック & 司令塔ターゲット選定バー */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <Lock className={`w-4 h-4 ${lockStatus.locked ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="font-semibold text-slate-300">グローバル排他ロック:</span>
            {lockStatus.locked ? (
              <span className="text-amber-300">
                ロック中 ({lockStatus.holder} / 残り {lockStatus.remainingSeconds}秒)
              </span>
            ) : (
              <span className="text-emerald-400">解除済 (二重実行防止待機中)</span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <Compass className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">次回選定ターゲット:</span>
            <span className="text-indigo-200 truncate">
              {targetDecision ? `[${targetDecision.action}] ${targetDecision.reason}` : '判定中...'}
            </span>
          </div>
        </div>

        {executionMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-xs text-indigo-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
            {executionMessage}
          </div>
        )}
      </div>

      {/* ── ナビゲーションサブタブ ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('directive')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeSubTab === 'directive'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          作業指示書 取込・構造化 ({directives.length})
        </button>

        <button
          onClick={() => setActiveSubTab('evidence')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeSubTab === 'evidence'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          実装証拠 (Evidence) ({evidences.length})
        </button>

        <button
          onClick={() => setActiveSubTab('contracts')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeSubTab === 'contracts'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-4 h-4" />
          要求契約 (Contracts) ({contracts.length})
        </button>

        <button
          onClick={() => setActiveSubTab('strategies')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeSubTab === 'strategies'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Brain className="w-4 h-4" />
          自己改善戦略メモリ ({strategies.length})
        </button>

        <button
          onClick={() => setActiveSubTab('nochange')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeSubTab === 'nochange'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          無変更採択 ({noChangeDecisions.length})
        </button>
      </div>

      {/* ── サブタブ 1: 作業指示書 取込・構造化 ── */}
      {activeSubTab === 'directive' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左側: 入力フォーム & プリセット */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  作業指示書・方針テキストの取り込み
                </h3>
                <button
                  onClick={handleLoadV24Preset}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition border border-indigo-200"
                >
                  指示書(v24)を即時取込
                </button>
              </div>
              <p className="text-xs text-slate-500">
                自然言語で記述された作業指示や方針テキストを入力すると、目的・対象・要求内容・禁止事項・完了条件に自動分解して構造化します。
              </p>
              <textarea
                value={rawDirectiveText}
                onChange={(e) => setRawDirectiveText(e.target.value)}
                placeholder="ここに作業指示テキストを貼り付け... (例: 第2章 証拠ベースの自律改善ループの確立...)"
                className="w-full h-44 p-3 border border-slate-200 rounded-xl text-xs font-mono bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleIngestText}
                  disabled={!rawDirectiveText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  指示書を解析・構造化
                </button>
              </div>
            </div>

            {/* 取り込み済み指示書リスト */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                取込済み指示書一覧 ({directives.length})
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {directives.map((dir) => (
                  <div
                    key={dir.directiveId}
                    onClick={() => setSelectedDirective(dir)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      selectedDirective?.directiveId === dir.directiveId
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 truncate max-w-[200px]">{dir.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          dir.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : dir.status === 'IN_PROGRESS'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {dir.status}
                      </span>
                    </div>
                    <p className="text-slate-500 line-clamp-1">{dir.goal}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>要求: {dir.requirements.length}項目</span>
                      <span>禁止: {(dir.forbiddenItems || dir.forbiddenBehaviors || []).length}項目</span>
                      <span>完了条件: {(dir.acceptanceCriteria || dir.completionCriteria || []).length}項目</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右側: 構造化結果の詳細カード (第2章 報告対象) */}
          <div className="lg:col-span-7">
            {selectedDirective ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono text-slate-400">{selectedDirective.directiveId}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          selectedDirective.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : selectedDirective.status === 'IN_PROGRESS'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {selectedDirective.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedDirective.title}</h3>
                  </div>

                  <button
                    onClick={() => {
                      workDirectiveIngestionService.markStatus(
                        selectedDirective.directiveId,
                        selectedDirective.status === 'PENDING' ? 'IN_PROGRESS' : 'PENDING'
                      );
                      refreshState();
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-600 transition"
                  >
                    優先ターゲット切替
                  </button>
                </div>

                {/* 1. 目的 (Goal) */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-indigo-600" />
                    1. 目的 (Goal)
                  </h4>
                  <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed font-sans">
                    {selectedDirective.goal}
                  </p>
                </div>

                {/* 2. 対象 (Targets) */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-blue-600" />
                    2. 対象 (Targets)
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDirective.targets.map((tgt, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-mono font-medium"
                      >
                        {tgt}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 3. 要求内容 (Requirements) */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    3. 要求内容 (Requirements - {selectedDirective.requirements.length}項目)
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedDirective.requirements.map((req, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-700 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100 flex items-start gap-2"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 4. 禁止事項 (Forbidden Behaviors) */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    4. 禁止事項 (Forbidden Behaviors - {(selectedDirective.forbiddenItems || selectedDirective.forbiddenBehaviors || []).length}項目)
                  </h4>
                  <ul className="space-y-1.5">
                    {(selectedDirective.forbiddenItems || selectedDirective.forbiddenBehaviors || []).map((forb, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-rose-800 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100 flex items-start gap-2 font-medium"
                      >
                        <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          ✕
                        </span>
                        <span>{forb}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 5. 完了条件 (Acceptance Criteria) */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-purple-600" />
                    5. 完了条件 (Acceptance Criteria - {(selectedDirective.acceptanceCriteria || selectedDirective.completionCriteria || []).length}項目)
                  </h4>
                  <ul className="space-y-1.5">
                    {(selectedDirective.acceptanceCriteria || selectedDirective.completionCriteria || []).map((acc, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-purple-800 bg-purple-50/40 p-2.5 rounded-xl border border-purple-100 flex items-start gap-2"
                      >
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span>{acc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedDirective.executionNote && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <span className="font-bold text-slate-700">実行ログ:</span> {selectedDirective.executionNote}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs p-6 text-center">
                <FileText className="w-8 h-8 mb-2 text-slate-300" />
                左側のリストから指示書を選択するか、「指示書(v24)を即時取込」ボタンを押してください。
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── サブタブ 2: 実装証拠 (Implementation Evidence - 14要件) ── */}
      {activeSubTab === 'evidence' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">総集約証拠数</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{evidences.length}件</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">採択率 (ADOPT)</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {evidences.length > 0
                  ? `${Math.round((evidences.filter((e) => e.finalVerdict === 'ADOPT').length / evidences.length) * 100)}%`
                  : '0%'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">反例探索クリア率</span>
              <p className="text-2xl font-bold text-indigo-600 mt-1">
                {evidences.length > 0
                  ? `${Math.round(
                      (evidences.filter((e) => e.counterexampleGate?.passed).length / evidences.length) * 100
                    )}%`
                  : '100%'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">平均汎化スコア</span>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {evidences.length > 0
                  ? `${Math.round(
                      evidences.reduce((acc, e) => acc + (e.generalizationGate?.generalizationScore || 0), 0) /
                        evidences.length
                    )}点`
                  : 'N/A'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {evidences.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
                まだ実装証拠が記録されていません。「正規改善サイクル実行」をクリックして自律改善サイクルを完了させてください。
              </div>
            ) : (
              evidences.map((evi) => (
                <div key={evi.evidenceId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <GitCommit className="w-4 h-4 text-indigo-600" />
                      <span className="font-mono text-xs font-bold text-slate-800">{evi.changeSetId}</span>
                      <span className="text-[11px] text-slate-400">({evi.evidenceId})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        Git: {evi.deploymentState}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        Adoption: {evi.adoptionState}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          evi.finalVerdict === 'ADOPT'
                            ? 'bg-emerald-100 text-emerald-700'
                            : evi.finalVerdict === 'HOLD'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        判定: {evi.finalVerdict}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="font-bold text-slate-700 block mb-1">ハッシュ & シンボル</span>
                      <p className="font-mono text-[11px] text-slate-600">前: {evi.beforeImplementationHash || evi.beforeHash || '---'}</p>
                      <p className="font-mono text-[11px] text-slate-600">後: {evi.afterImplementationHash || evi.afterHash || '---'}</p>
                      <p className="text-slate-500 mt-1">対象: {(evi.targetSymbols || evi.changedSymbols || []).join(', ')} (+{evi.linesAdded ?? evi.linesCount ?? 0}行)</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="font-bold text-slate-700 block mb-1">品質ゲート検証</span>
                      {(() => {
                        const ce = evi.counterexampleGate || evi.testResults?.counterexampleResult;
                        const gen = evi.generalizationGate || evi.testResults?.generalizationResult;
                        const cau = evi.causalExperiment || evi.causalResult;
                        return (
                          <>
                            <p className="text-slate-600">
                              反例ゲート: {ce?.passed ? '✅ 合格' : '⚠️ 不合格'} ({((ce?.passRate ?? (ce?.passed ? 100 : 0))).toFixed(0)}%)
                            </p>
                            <p className="text-slate-600">
                              汎化ゲート: {gen?.passed ? '✅ 合格' : '⚠️ 不合格'} ({(gen?.generalizationScore ?? 0).toFixed(0)}点)
                            </p>
                            <p className="text-slate-600">
                              因果実験: {cau?.isCausal ? '✅ 因果性実証' : '保留'} (+{(cau?.averageScoreDelta ?? cau?.observedDelta ?? 0).toFixed(1)}点)
                            </p>
                          </>
                        );
                      })()}
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="font-bold text-slate-700 block mb-1">
                        テスト実行実績 ({(evi.testsExecuted || []).length}件)
                      </span>
                      <div className="space-y-1">
                        {(evi.testsExecuted || []).map((t: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-600">{t.message}</span>
                            <span className={t.passed ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {t.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── サブタブ 3: 要求契約 (Requirement Contracts) ── */}
      {activeSubTab === 'contracts' && (
        <div className="space-y-3">
          {contracts.map((ctr) => (
            <div key={ctr.contractId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-mono text-slate-400">{ctr.contractId}</span>
                  <h4 className="text-sm font-bold text-slate-800">{ctr.title}</h4>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    ctr.verdict === 'SATISFIED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : ctr.verdict === 'VIOLATED'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {ctr.verdict}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="font-bold text-emerald-800 block mb-1">受入基準 (Acceptance Criteria)</span>
                  <ul className="list-disc list-inside text-emerald-900 space-y-0.5">
                    {ctr.acceptanceCriteria.map((a, i) => (
                      <li key={i} className="truncate">{a}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-800 block mb-1">必須挙動 (Required Behaviors)</span>
                  <ul className="list-disc list-inside text-indigo-900 space-y-0.5">
                    {ctr.requiredBehaviors.map((r, i) => (
                      <li key={i} className="truncate">{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                  <span className="font-bold text-rose-800 block mb-1">禁止事項 (Forbidden Behaviors)</span>
                  <ul className="list-disc list-inside text-rose-900 space-y-0.5">
                    {ctr.forbiddenBehaviors.map((f, i) => (
                      <li key={i} className="truncate">{f}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {ctr.verdictReason && (
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700">判定根拠:</span> {ctr.verdictReason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── サブタブ 4: 自己改善戦略メモリ (Strategy Memory - 5 & 14) ── */}
      {activeSubTab === 'strategies' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
            <span className="font-bold">自己改善戦略メモリ (Strategy Memory) と閉ループ還元:</span>
            <br />
            「何を直すか」だけでなく「どう直すか」の改善戦略を蓄積。過去の自己改善成功・失敗実績から最も効果的な戦略を自律選択し、サイクル完了時に成果を還元します。
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((st) => (
              <div key={st.strategyId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400">{st.strategyId}</span>
                    <h4 className="text-sm font-bold text-slate-900">{st.strategyName}</h4>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold font-mono">
                    Score: {(st.effectivenessScore ?? Math.round(((st.successCount + 1) / (st.successCount + st.failureCount + 2)) * 100)).toFixed(0)}
                  </span>
                </div>

                <p className="text-xs text-slate-600">{st.description}</p>

                <div className="flex flex-wrap gap-1">
                  {(st.applicableConditions || []).map((sc: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">
                      {sc}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    成功: <b className="text-emerald-600">{st.successCount}回</b> / 失敗: <b className="text-rose-600">{st.failureCount}回</b>
                  </span>
                  <span>最終利用: {new Date(st.lastUsedAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── サブタブ 5: 無変更採択 (No-Change Decisions - 10) ── */}
      {activeSubTab === 'nochange' && (
        <div className="space-y-3">
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100 text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">無変更採択 (No-Change Decisions):</span>
            <br />
            改善幅が微小、または不変条件破壊リスクが利益を上回る場合に「変更しない判断」を正式記録。不要なコード膨張や不安定化を阻止した積極的成果として評価されます。
          </div>

          {noChangeDecisions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
              無変更採択の履歴はありません。
            </div>
          ) : (
            noChangeDecisions.map((nc, idx) => (
              <div key={nc.changeSetId || idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">{nc.targetFile || nc.target}</span>
                  <span className="text-[11px] text-slate-400">{new Date(nc.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">停止理由:</span> {nc.reason || nc.rationale}
                </p>
                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-700">リスク比較:</span> {nc.riskComparison || nc.rationale}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
