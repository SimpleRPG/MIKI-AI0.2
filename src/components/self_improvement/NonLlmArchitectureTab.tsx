import React, { useState } from 'react';
import {
  Database,
  Scale,
  Boxes,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Search,
  Code2,
  Zap,
  ShieldCheck,
  History,
  TrendingUp,
} from 'lucide-react';
import {
  claimDatabaseService,
} from '../../services/claimDatabaseService';
import {
  unifiedDecisionEngineService,
} from '../../services/unifiedDecisionEngineService';
import {
  componentRegistryService,
} from '../../services/componentRegistryService';
import {
  answerContentIrService,
} from '../../services/answerContentIrService';
import {
  ClaimRecord,
  ClaimWorld,
  ClaimKind,
  ClaimVerificationStatus,
  ClaimMaturity,
  ComponentStatus,
  UserContextProfileType,
  DecisionDelayCheckpoint,
  DecisionFailureCause,
  SemanticPreservationInspection,
  AnswerContentIR,
} from '../../types';

export const NonLlmArchitectureTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'decisions' | 'components' | 'answer_ir'>('claims');

  // --- Claim DB State ---
  const [claims, setClaims] = useState<ClaimRecord[]>(() => claimDatabaseService.getAllClaims());
  const [claimSearch, setClaimSearch] = useState('');
  const [selectedWorld, setSelectedWorld] = useState<ClaimWorld | 'ALL'>('ALL');
  const [newClaimStatement, setNewClaimStatement] = useState('');
  const [newClaimWorld, setNewClaimWorld] = useState<ClaimWorld>('REAL');
  const [newClaimKind, setNewClaimKind] = useState<ClaimKind>('EXTERNAL_FACT');

  // --- Decision Engine State ---
  const [decisions, setDecisions] = useState(() => unifiedDecisionEngineService.getAllDecisions());
  const [activeProfile, setActiveProfile] = useState<UserContextProfileType>(() => 'WORK_EFFICIENCY');
  const [delayDecisionId, setDelayDecisionId] = useState('');
  const [delayCheckpoint, setDelayCheckpoint] = useState<DecisionDelayCheckpoint>('CHECKPOINT_1H');
  const [delayOutcome, setDelayOutcome] = useState<'SUCCESS' | 'SUBOPTIMAL' | 'FAILURE'>('SUCCESS');
  const [delayCause, setDelayCause] = useState<DecisionFailureCause>('UNVERIFIED_ASSUMPTION');
  const [delayFeedback, setDelayFeedback] = useState('');

  // --- Component Registry State ---
  const [components, setComponents] = useState(() => componentRegistryService.getAllComponents());
  const [macroSourceSheet, setMacroSourceSheet] = useState('DataSheet');
  const [macroHeaderKey, setMacroHeaderKey] = useState('社員番号');
  const [macroDestSheet, setMacroDestSheet] = useState('UniqueReport');
  const [synthesizedResult, setSynthesizedResult] = useState<{
    code: string;
    used: string[];
    checklist: string[];
  } | null>(null);

  // --- Answer IR State ---
  const [irConclusion, setIrConclusion] = useState('配列一括読込によるVBA処理の高速化を推奨する');
  const [irConditions, setIrConditions] = useState('データ行数が1,000件以上の場合');
  const [irCertainty, setIrCertainty] = useState<AnswerContentIR['certainty']>('CONDITIONAL');
  const [irWorld, setIrWorld] = useState<ClaimWorld>('REAL');
  const [testSurfaceText, setTestSurfaceText] = useState('データが1,000件以上の場合、配列一括読込を使うと高速化できます。');
  const [inspectionResult, setInspectionResult] = useState<SemanticPreservationInspection | null>(null);

  // Refresh data
  const refreshAll = () => {
    setClaims(claimDatabaseService.getAllClaims());
    setDecisions(unifiedDecisionEngineService.getAllDecisions());
    setComponents(componentRegistryService.getAllComponents());
  };

  // Handle Add Claim
  const handleAddClaim = () => {
    if (!newClaimStatement.trim()) return;
    claimDatabaseService.registerClaim({
      statement: newClaimStatement,
      world: newClaimWorld,
      kind: newClaimKind,
      source: 'user_input',
      status: 'SUPPORTED',
      maturity: 'DISCOVERED',
    });
    setNewClaimStatement('');
    setClaims(claimDatabaseService.getAllClaims());
  };

  // Handle Component Synthesis
  const handleSynthesizeVba = () => {
    const res = componentRegistryService.synthesizeVbaMacro({
      macroName: 'FilterAndExtractBatch',
      sourceSheetName: macroSourceSheet,
      headerKeyName: macroHeaderKey,
      destSheetName: macroDestSheet,
    });
    if (res.success) {
      setSynthesizedResult({
        code: res.assembledCode,
        used: res.usedComponents,
        checklist: res.verificationChecklist,
      });
    }
  };

  // Handle Semantic Check
  const handleRunSemanticCheck = () => {
    const ir = answerContentIrService.buildAnswerIR({
      conclusion: irConclusion,
      conditions: irConditions ? [irConditions] : [],
      certainty: irCertainty,
      target: 'USER_QUERY',
      worldScope: irWorld,
    });
    const check = answerContentIrService.verifySemanticPreservation(ir, testSurfaceText);
    setInspectionResult(check);
  };

  const claimStats = claimDatabaseService.getSummaryStats();

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              非LLM中心設計思想・統合版
            </span>
            <h3 className="text-lg font-bold text-white">非LLM自律判断・主張DB・部品レジストリ</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            LLMの不確定性に依存せず、事実性(主張DB)・過剰機能抑制(削減知能)・検証済みTXT部品合成・意味保持検査を決定論的ルールで担保
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          最新状態に更新
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-slate-700/80 gap-2">
        <button
          onClick={() => setActiveSubTab('claims')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'claims'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          第6章: 主張DB (Claim DB)
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {claimStats.total}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('decisions')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'decisions'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4" />
          第8章: 統合判断 & 削減知能
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {decisions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('components')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'components'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          第9章: 検証済みTXT部品レジストリ
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {components.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('answer_ir')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'answer_ir'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          第5.2/13.4節: 回答IR & 意味保持検査
        </button>
      </div>

      {/* --- Tab 1: Claims DB --- */}
      {activeSubTab === 'claims' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">総主張数</span>
              <p className="text-xl font-bold text-white mt-0.5">{claimStats.total}</p>
            </div>
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">現実 (REAL) / 創作 (FICTION)</span>
              <p className="text-xl font-bold text-emerald-400 mt-0.5">
                {claimStats.byWorld.REAL} <span className="text-xs text-slate-500">/</span> {claimStats.byWorld.FICTION}
              </p>
            </div>
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">検証済み (SUPPORTED / VERIFIED)</span>
              <p className="text-xl font-bold text-blue-400 mt-0.5">
                {claimStats.byStatus.SUPPORTED + claimStats.byStatus.DEVICE_VERIFIED}
              </p>
            </div>
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">自己証明排除 (INDEPENDENT)</span>
              <p className="text-xl font-bold text-amber-400 mt-0.5">
                {claims.filter((c) => c.self_provenance === 'INDEPENDENTLY_SUPPORTED').length}
              </p>
            </div>
          </div>

          {/* Add Claim Form */}
          <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              新規命題・主張の登録 (第6章 命題構造化)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <input
                type="text"
                value={newClaimStatement}
                onChange={(e) => setNewClaimStatement(e.target.value)}
                placeholder="主張文 (例: Excel VBAのCells反復参照は配列読込に比べ10倍以上遅い)"
                className="md:col-span-6 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <select
                value={newClaimWorld}
                onChange={(e) => setNewClaimWorld(e.target.value as ClaimWorld)}
                className="md:col-span-3 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200"
              >
                <option value="REAL">REAL (客観事実世界)</option>
                <option value="FICTION">FICTION (創作・設定世界)</option>
                <option value="HYPOTHETICAL">HYPOTHETICAL (仮定世界)</option>
              </select>
              <select
                value={newClaimKind}
                onChange={(e) => setNewClaimKind(e.target.value as ClaimKind)}
                className="md:col-span-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200"
              >
                <option value="EXTERNAL_FACT">EXTERNAL_FACT</option>
                <option value="EMPIRICAL_RULE">EMPIRICAL_RULE</option>
                <option value="USER_PROFILE">USER_PROFILE</option>
                <option value="TECHNICAL_SPEC">TECHNICAL_SPEC</option>
              </select>
              <button
                onClick={handleAddClaim}
                className="md:col-span-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center justify-center transition"
              >
                追加
              </button>
            </div>
          </div>

          {/* Filter & Search */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                placeholder="主張文・キーワードで検索..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={selectedWorld}
              onChange={(e) => setSelectedWorld(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
            >
              <option value="ALL">全世界スコープ</option>
              <option value="REAL">REAL のみ</option>
              <option value="FICTION">FICTION のみ</option>
              <option value="HYPOTHETICAL">HYPOTHETICAL のみ</option>
            </select>
          </div>

          {/* Claims List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {claims
              .filter((c) => {
                if (selectedWorld !== 'ALL' && c.world !== selectedWorld) return false;
                if (claimSearch && !c.statement.toLowerCase().includes(claimSearch.toLowerCase())) return false;
                return true;
              })
              .map((c) => (
                <div
                  key={c.claim_id}
                  className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-slate-600 transition"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-300">{c.claim_id}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        c.world === 'REAL' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        c.world === 'FICTION' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {c.world}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-300">
                        {c.kind}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : c.status === 'DISPUTED' || c.status === 'CONTRADICTED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {c.status}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                        成熟度: {c.maturity}
                      </span>
                      {c.self_provenance === 'SELF_SUPPORTED' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-600/40">
                          ⚠️ 自己生成
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-100 font-medium">{c.statement}</p>
                    {c.contradicted_by && c.contradicted_by.length > 0 && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        矛盾する主張: {c.contradicted_by.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const nextRank: Record<ClaimMaturity, ClaimMaturity> = {
                          DISCOVERED: 'DEFINED',
                          DEFINED: 'CONNECTED',
                          CONNECTED: 'APPLIED',
                          APPLIED: 'REPRODUCED',
                          REPRODUCED: 'TRANSFERRED',
                          TRANSFERRED: 'MATURE',
                          MATURE: 'MATURE',
                          RESTRICTED: 'DEFINED',
                        };
                        claimDatabaseService.promoteMaturity(c.claim_id, nextRank[c.maturity], 'UIユーザー承認昇格');
                        setClaims(claimDatabaseService.getAllClaims());
                      }}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition flex items-center gap-1"
                    >
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      成熟度昇格
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* --- Tab 2: Decision Engine & Reduction Intelligence --- */}
      {activeSubTab === 'decisions' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              第8章: コンテキストプロファイル適合 & 削減知能 (Reduction Intelligence)
            </h4>
            <p className="text-xs text-slate-400">
              ユーザーの現在のコンテキストプロファイルに応じ、不必要な機能拡張・過剰な複雑性を非LLMルールで即座に却下します。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              {(['WORK_EFFICIENCY', 'CRITICAL_ACCURACY', 'CASUAL_CHAT', 'CREATIVE_EXPLORATION'] as UserContextProfileType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setActiveProfile(p);
                    unifiedDecisionEngineService.setActiveProfile(p);
                  }}
                  className={`p-3 rounded-lg border text-left transition ${
                    activeProfile === p
                      ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="text-xs font-bold block">{p}</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {p === 'WORK_EFFICIENCY' ? '最速解決・余計な機能禁止' :
                     p === 'CRITICAL_ACCURACY' ? '絶対検証・厳格反証優先' :
                     p === 'CASUAL_CHAT' ? '親身な対話・簡潔応答' : '設定遵守・仮定・創造世界'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Decisions List */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              判断履歴と遅延評価 (8.4 後悔学習)
            </h4>
            {decisions.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-800/20 rounded-xl border border-slate-800">
                記録された判断ログはありません。チャットで発話すると自動的に削減知能と判断が記録されます。
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {decisions.map((d) => (
                  <div
                    key={d.decision_id}
                    className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-300">{d.decision_id}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                          選択: {d.chosen_option_id}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          {d.context_profile.profile_type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          d.reduction_verdict.verdict === 'ALLOW'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          削減知能: {d.reduction_verdict.verdict}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(d.decided_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-200">
                      トピック: <span className="font-medium text-white">{d.topic}</span>
                    </p>

                    {d.reduction_verdict.reasons.length > 0 && (
                      <p className="text-xs text-slate-400">
                        削減知能理由: {d.reduction_verdict.reasons.join(', ')}
                      </p>
                    )}

                    {d.evaluations && Object.keys(d.evaluations).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700/60 text-xs space-y-1">
                        <span className="font-semibold text-slate-300">遅延評価結果:</span>
                        {Object.entries(d.evaluations).map(([cp, ev]) => (
                          <div key={cp} className="flex items-center gap-2 text-slate-400">
                            <span className="text-slate-500">{cp}:</span>
                            <span className={ev.outcome === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'}>
                              {ev.outcome}
                            </span>
                            {ev.feedback && <span>({ev.feedback})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 3: Component Registry --- */}
      {activeSubTab === 'components' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              第9章: 検証済みTXT部品からの決定論的VBAマクロ合成
            </h4>
            <p className="text-xs text-slate-400">
              LLMに一からVBAを書かせるのではなく、テスト検証済みの安全な部品 (見出し動的探索 + 配列一括読込 + 重複排除 + 一括出力) を安全に連結合成します。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">読込シート名</label>
                <input
                  type="text"
                  value={macroSourceSheet}
                  onChange={(e) => setMacroSourceSheet(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">キー見出し名</label>
                <input
                  type="text"
                  value={macroHeaderKey}
                  onChange={(e) => setMacroHeaderKey(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">出力先シート名</label>
                <input
                  type="text"
                  value={macroDestSheet}
                  onChange={(e) => setMacroDestSheet(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
            </div>

            <button
              onClick={handleSynthesizeVba}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Code2 className="w-4 h-4" />
              検証済み部品からVBAマクロを決定論的合成
            </button>

            {synthesizedResult && (
              <div className="mt-3 p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    合成完了 (使用部品: {synthesizedResult.used.join(', ')})
                  </span>
                </div>
                <div className="text-xs text-slate-300 space-y-0.5">
                  {synthesizedResult.checklist.map((chk, i) => (
                    <div key={i}>{chk}</div>
                  ))}
                </div>
                <pre className="p-3 bg-slate-950 rounded text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60">
                  {synthesizedResult.code}
                </pre>
              </div>
            )}
          </div>

          {/* Component Packages List */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-400" />
              登録済みTXT部品一覧
            </h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {components.map((comp) => (
                <div
                  key={comp.component_id}
                  className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-2 hover:border-slate-600 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">{comp.component_id}</span>
                      <span className="text-xs font-mono text-slate-400">({comp.entry_point})</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        comp.status === 'VERIFIED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : comp.status === 'PROPOSED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {comp.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Hash: {comp.validation_hash}</span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">{comp.purpose}</p>

                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                    <span>不変条件: {comp.invariants.join(', ')}</span>
                  </div>

                  <div className="pt-2 flex gap-2">
                    {(['COLLECTED', 'PROPOSED', 'VERIFIED', 'DEPRECATED'] as ComponentStatus[]).map((st) => (
                      <button
                        key={st}
                        disabled={comp.status === st}
                        onClick={() => {
                          componentRegistryService.transitionStatus(comp.component_id, st, 'UI操作によるステータス変更');
                          setComponents(componentRegistryService.getAllComponents());
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] transition ${
                          comp.status === st
                            ? 'bg-emerald-600 text-white font-bold cursor-default'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- Tab 4: Answer IR & Semantic Check --- */}
      {activeSubTab === 'answer_ir' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              第5.2節 / 第13.4節: 回答内容IRと意味保持検査 (Semantic Preservation Check)
            </h4>
            <p className="text-xs text-slate-400">
              「何を言うか (回答内容IR)」と「どう言うか (表層表現)」を完全分離し、表層文で条件・否定・確実性・世界スコープが脱落または歪曲されていないかを決定論的に検査します。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">IR 結論 (Conclusion)</label>
                <input
                  type="text"
                  value={irConclusion}
                  onChange={(e) => setIrConclusion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">IR 前提条件 (Conditions)</label>
                <input
                  type="text"
                  value={irConditions}
                  onChange={(e) => setIrConditions(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">IR 確実性 (Certainty)</label>
                <select
                  value={irCertainty}
                  onChange={(e) => setIrCertainty(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                >
                  <option value="CERTAIN">CERTAIN (完全確実)</option>
                  <option value="HIGH_CONFIDENCE">HIGH_CONFIDENCE (高確信)</option>
                  <option value="CONDITIONAL">CONDITIONAL (条件付き)</option>
                  <option value="HYPOTHETICAL">HYPOTHETICAL (仮定・推測)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">IR 世界スコープ (World Scope)</label>
                <select
                  value={irWorld}
                  onChange={(e) => setIrWorld(e.target.value as ClaimWorld)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                >
                  <option value="REAL">REAL (現実事実)</option>
                  <option value="FICTION">FICTION (創作・設定)</option>
                  <option value="HYPOTHETICAL">HYPOTHETICAL (思考実験・仮定)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs text-slate-300 font-semibold block mb-1">テスト表層生成文 (Surface Text to Inspect)</label>
              <textarea
                rows={2}
                value={testSurfaceText}
                onChange={(e) => setTestSurfaceText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
              />
            </div>

            <button
              onClick={handleRunSemanticCheck}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              意味保持検査を実行
            </button>

            {inspectionResult && (
              <div className={`p-4 rounded-xl border ${
                inspectionResult.isPreserved
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/20 border-red-500/40 text-red-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-2">
                  {inspectionResult.isPreserved ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      検査合格: 条件・否定・確実性・世界スコープが完全維持されています
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      違反検知: 表層文に意味の脱落または歪曲が存在します
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                  <div className={`p-2 rounded bg-slate-900/60 border ${
                    inspectionResult.checkedElements.conditionsPreserved ? 'border-emerald-700 text-emerald-300' : 'border-red-700 text-red-300'
                  }`}>
                    条件保持: {inspectionResult.checkedElements.conditionsPreserved ? '合格' : '脱落'}
                  </div>
                  <div className={`p-2 rounded bg-slate-900/60 border ${
                    inspectionResult.checkedElements.negationPreserved ? 'border-emerald-700 text-emerald-300' : 'border-red-700 text-red-300'
                  }`}>
                    否定保持: {inspectionResult.checkedElements.negationPreserved ? '合格' : '反転'}
                  </div>
                  <div className={`p-2 rounded bg-slate-900/60 border ${
                    inspectionResult.checkedElements.certaintyPreserved ? 'border-emerald-700 text-emerald-300' : 'border-red-700 text-red-300'
                  }`}>
                    確実性保持: {inspectionResult.checkedElements.certaintyPreserved ? '合格' : '過剰断定'}
                  </div>
                  <div className={`p-2 rounded bg-slate-900/60 border ${
                    inspectionResult.checkedElements.worldScopePreserved ? 'border-emerald-700 text-emerald-300' : 'border-red-700 text-red-300'
                  }`}>
                    世界スコープ: {inspectionResult.checkedElements.worldScopePreserved ? '合格' : '混同'}
                  </div>
                </div>

                {inspectionResult.missingOrDistortedElements.length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-red-300 space-y-1">
                    {inspectionResult.missingOrDistortedElements.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
