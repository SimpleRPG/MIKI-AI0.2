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
  counterfactualReasoningService,
} from '../../services/counterfactualReasoningService';
import {
  latentIntentMiningService,
} from '../../services/latentIntentMiningService';
import {
  metacognitiveCalibrationService,
} from '../../services/metacognitiveCalibrationService';
import {
  affectionDynamicsService,
} from '../../services/affectionDynamicsService';
import {
  formalConstraintSolverService,
  ConstraintSolveResult,
} from '../../services/formalConstraintSolverService';
import {
  autonomousContinuousEvolutionService,
  AutonomousEvolutionRecord,
} from '../../services/autonomousContinuousEvolutionService';
import {
  chapter31Service,
  CollocationMatch,
  AstRefactorProposal,
} from '../../autonomous_modules/chapter_31_collocation_ast_refactor';
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
  BranchReasoningSimulation,
  LatentGoalInference,
  MetacognitiveCalibrationResult,
  AffectionDynamicState,
  AffectionEvaluationResult,
  CompiledRequestType,
  AnswerSkeletonType,
} from '../../types';
import { requestTypeCompilerService } from '../../services/requestTypeCompilerService';
import { LlmMigrationSubView } from './non_llm_views/LlmMigrationSubView';
import { AutonomousHardeningSubView } from './non_llm_views/AutonomousHardeningSubView';
import { CloudGatewaySubView } from './non_llm_views/CloudGatewaySubView';
import { HardwarePipelineSubView } from './non_llm_views/HardwarePipelineSubView';
import {
  GitBranch,
  Sparkles,
  Brain,
  Heart,
  Layers,
  Cpu,
  GitMerge,
  ShieldAlert,
  Cloud,
} from 'lucide-react';

export const NonLlmArchitectureTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    | 'hardware_pipeline'
    | 'claims'
    | 'decisions'
    | 'components'
    | 'answer_ir'
    | 'collocation_ast'
    | 'counterfactual'
    | 'latent_intent'
    | 'metacognitive'
    | 'affection_dynamics'
    | 'formal_csp'
    | 'llm_migration'
    | 'autonomous_hardening'
    | 'cloud_gateway'
  >('hardware_pipeline');

  // --- Claim DB State ---
  const [claims, setClaims] = useState<ClaimRecord[]>(() => claimDatabaseService.getAllClaims());
  const [claimSearch, setClaimSearch] = useState('');
  const [selectedWorld, setSelectedWorld] = useState<ClaimWorld | 'ALL'>('ALL');
  const [newClaimStatement, setNewClaimStatement] = useState('');
  const [newClaimWorld, setNewClaimWorld] = useState<ClaimWorld>('REAL');
  const [newClaimKind, setNewClaimKind] = useState<ClaimKind>('FACT_CLAIM');

  // --- Decision Engine State ---
  const [decisions, setDecisions] = useState(() => unifiedDecisionEngineService.getAllDecisions());
  const [activeProfile, setActiveProfile] = useState<UserContextProfileType>(() => 'code_design');
  const [delayDecisionId, setDelayDecisionId] = useState('');
  const [delayCheckpoint, setDelayCheckpoint] = useState<DecisionDelayCheckpoint>('IMMEDIATE');
  const [delayOutcome, setDelayOutcome] = useState<'SUCCESS' | 'SUBOPTIMAL' | 'FAILURE'>('SUCCESS');
  const [delayCause, setDelayCause] = useState<DecisionFailureCause>('DECISION_ERROR');
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

  // --- Chapter 10.1: Request Type Compiler & 5.2 Surface Generation State ---
  const [compilerInput, setCompilerInput] = useState('Excelで重複データを1列にまとめて高速に抽出するマクロを作って');
  const [compiledResult, setCompiledResult] = useState<CompiledRequestType | null>(() =>
    requestTypeCompilerService.compile('Excelで重複データを1列にまとめて高速に抽出するマクロを作って')
  );
  const [selectedSkeleton, setSelectedSkeleton] = useState<AnswerSkeletonType>('TASK_COMPLETION');
  const [surfaceResultState, setSurfaceResultState] = useState<{
    surfaceText: string;
    inspection: SemanticPreservationInspection;
  } | null>(null);

  // --- Chapter 36: Counterfactual Reasoning State ---
  const [cfTopic, setCfTopic] = useState('VBA大量データ処理アーキテクチャ選定');
  const [cfFactualDecision, setCfFactualDecision] = useState('セル単位直接参照 (Cells(i, j)) の採用');
  const [cfTriggerContext, setCfTriggerContext] = useState('ユーザーから50,000行処理時のフリーズ解消要求');
  const [cfResult, setCfResult] = useState<BranchReasoningSimulation | null>(null);
  const [cfHistory, setCfHistory] = useState<BranchReasoningSimulation[]>(() =>
    counterfactualReasoningService.getSimulationHistory()
  );

  // --- Chapter 37: Latent Intent Mining State ---
  const [latentInput, setLatentInput] = useState('マクロが重くてエクセルが固まる。なんとかして');
  const [latentInference, setLatentInference] = useState<LatentGoalInference | null>(null);

  // --- Chapter 38: Metacognitive Calibration State ---
  const [metaTopic, setMetaTopic] = useState('Excel VBA 高速化');
  const [metaText, setMetaText] = useState(
    'Option Explicit を宣言し、RangeデータをVariant配列に一括代入して処理することで100倍高速化できます。'
  );
  const [metaDomain, setMetaDomain] = useState('vba');
  const [metaHasTestRun, setMetaHasTestRun] = useState(false);
  const [metaHasMemoryGrounding, setMetaHasMemoryGrounding] = useState(true);
  const [metaResult, setMetaResult] = useState<MetacognitiveCalibrationResult | null>(null);

  // --- Chapter 31: Collocation & Safe AST Refactoring State ---
  const [collocationInput, setCollocationInput] = useState('画面更新を停止してエラーが発生しました');
  const [collocationResults, setCollocationResults] = useState<CollocationMatch[]>([]);
  const [astSourceCode, setAstSourceCode] = useState(
    'For i = 1 To 100\n  Cells(i, 1).Value = arr(i)\nNext i\nActiveSheet.Calculate'
  );
  const [astRefactorResults, setAstRefactorResults] = useState<AstRefactorProposal[]>([]);

  // --- Chapter 39: Affection Dynamics & Continuous Transfer State ---
  const [affectionInput, setAffectionInput] = useState('みきちゃん、マクロが無事に動いたよ！本当にありがとう！');
  const [affectionState, setAffectionState] = useState<AffectionDynamicState>(() => affectionDynamicsService.getCurrentState());
  const [affectionEvalResult, setAffectionEvalResult] = useState<AffectionEvaluationResult | null>(null);

  // --- Chapter 59: CSP Formal Constraint Solver State ---
  const [cspTargetFiles, setCspTargetFiles] = useState('src/services/vbaDesignAssistantService.ts, src/types.ts');
  const [cspForbiddenFiles, setCspForbiddenFiles] = useState('.env, /weights/qwen_3b.bin');
  const [cspMustPreserve, setCspMustPreserve] = useState('Qwen-3B-Base, IMMUTABLE');
  const [cspSolveResult, setCspSolveResult] = useState<ConstraintSolveResult | null>(null);

  // --- Autonomous Evolution State (Chapter 13) ---
  const [isEvolutionRunning, setIsEvolutionRunning] = useState(false);
  const [evolutionRecord, setEvolutionRecord] = useState<AutonomousEvolutionRecord | null>(null);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);

  const handleRunAutonomousEvolution = async () => {
    setIsEvolutionRunning(true);
    setEvolutionError(null);
    try {
      const record = await autonomousContinuousEvolutionService.runFullAutonomousCycle();
      setEvolutionRecord(record);
      refreshAll();
    } catch (err: any) {
      setEvolutionError(err?.message || '自律自己改善サイクルの実行中にエラーが発生しました');
    } finally {
      setIsEvolutionRunning(false);
    }
  };

  // Refresh data
  const refreshAll = () => {
    setClaims(claimDatabaseService.getAllClaims());
    setDecisions(unifiedDecisionEngineService.getAllDecisions());
    setComponents(componentRegistryService.getAllComponents());
    setCfHistory(counterfactualReasoningService.getSimulationHistory());
    setAffectionState(affectionDynamicsService.getCurrentState());
  };

  // Chapter 31 Handlers
  const handleRunCollocation = () => {
    const res = chapter31Service.evaluateCollocation(collocationInput);
    setCollocationResults(res);
  };

  const handleRunAstRefactor = () => {
    const res = chapter31Service.proposeSafeAstRefactoring(astSourceCode);
    setAstRefactorResults(res);
  };

  // Chapter 39 Handlers
  const handleRunAffectionEval = () => {
    const res = affectionDynamicsService.evaluateAndTransfer(affectionInput);
    setAffectionEvalResult(res);
    setAffectionState(affectionDynamicsService.getCurrentState());
  };

  const handleRunSessionTransfer = () => {
    const updated = affectionDynamicsService.transferSession();
    setAffectionState(updated);
  };

  // Chapter 59 Handlers
  const handleRunCspSolve = () => {
    const targets = cspTargetFiles.split(',').map((s) => s.trim()).filter(Boolean);
    const forbidden = cspForbiddenFiles.split(',').map((s) => s.trim()).filter(Boolean);
    const mustPreserve = cspMustPreserve.split(',').map((s) => s.trim()).filter(Boolean);
    const res = formalConstraintSolverService.solveCSP({
      targetFiles: targets,
      forbiddenFiles: forbidden,
      mustPreserve,
    });
    setCspSolveResult(res);
  };

  // Handle Counterfactual Simulation
  const handleRunCounterfactual = () => {
    const sim = counterfactualReasoningService.simulateBranchReasoning(
      cfTopic,
      cfFactualDecision,
      cfTriggerContext
    );
    setCfResult(sim);
    setCfHistory(counterfactualReasoningService.getSimulationHistory());
  };

  // Handle Latent Intent Mining
  const handleInferLatentIntent = () => {
    if (!latentInput.trim()) return;
    const inf = latentIntentMiningService.inferLatentGoal(latentInput);
    latentIntentMiningService.trackMultiTurnIntent(latentInput);
    setLatentInference(inf);
  };

  // Handle Metacognitive Calibration
  const handleRunMetacognitiveCalib = () => {
    const res = metacognitiveCalibrationService.calibrateConfidence(metaTopic, metaText, {
      domain: metaDomain,
      hasTestRun: metaHasTestRun,
      hasMemoryGrounding: metaHasMemoryGrounding,
    });
    setMetaResult(res);
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

  // Handle Chapter 10.1 Request Compile & 5.2 Surface Generation
  const handleCompileRequest = () => {
    if (!compilerInput.trim()) return;
    const res = requestTypeCompilerService.compile(compilerInput);
    setCompiledResult(res);

    const ir = answerContentIrService.buildAnswerIR({
      conclusion: res.category === 'CODE_SYNTHESIS' ? '非LLM部品レジストリからの決定論的VBA合成' : `要求型「${res.category || '要求'}」に対する直接回答`,
      conditions: res.constraints,
      reasons: [res.expectedDeliverable || '要求成果物', `ドメイン: ${res.domain || '全般'}`],
      target: res.targetEntity || res.target || 'USER_REQUEST',
    });
    const generated = answerContentIrService.generateSurfaceTextFromIR(
      ir,
      selectedSkeleton,
      undefined,
      res.category === 'CODE_SYNTHESIS' ? 'Sub SynthesizedMacro()\n    \' 決定論的合成モジュール\n    MsgBox "Generated without LLM"\nEnd Sub' : undefined
    );
    setSurfaceResultState(generated);
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAutonomousEvolution}
            disabled={isEvolutionRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
              isEvolutionRunning
                ? 'bg-purple-900/50 text-purple-300 border border-purple-500/40 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
            }`}
            title="全不変条件・AST構文・TDDテスト検証を伴う自律自己改善サイクルを一貫実行"
          >
            <Zap className={`w-3.5 h-3.5 ${isEvolutionRunning ? 'animate-spin text-purple-300' : 'text-emerald-200'}`} />
            <span>{isEvolutionRunning ? '自律改善サイクル実行中...' : '🤖 第13章 自律自己改善サイクル実行'}</span>
          </button>
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            最新状態に更新
          </button>
        </div>
      </div>

      {/* Autonomous Evolution Result Card (if any) */}
      {evolutionRecord && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>自律自己改善サイクルが正常完了しました！ (+{Math.max(0, evolutionRecord.newScore - evolutionRecord.previousScore)}点)</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
              Score: {evolutionRecord.previousScore} ➔ {evolutionRecord.newScore}
            </span>
          </div>
          <div className="text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">改善対象仕様</span>
              <span className="font-semibold text-slate-200">
                {evolutionRecord.chapterNumber ? `第${evolutionRecord.chapterNumber}章『${evolutionRecord.chapterTitle}』` : evolutionRecord.targetFile}
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">検証 (AST & TDD)</span>
              <span className="font-semibold text-emerald-300">
                TDD {evolutionRecord.verification.testPassedCount}/{evolutionRecord.verification.testTotalCount} 合格 / 循環 0件
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">不変条件 & 安全機構</span>
              <span className="font-semibold text-teal-300">5大不変条件パス / スナップショット保存済</span>
            </div>
          </div>
        </div>
      )}

      {evolutionError && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{evolutionError}</span>
        </div>
      )}

      {/* Sub tabs */}
      <div className="flex border-b border-slate-700/80 gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setActiveSubTab('hardware_pipeline')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'hardware_pipeline'
              ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
              : 'border-transparent text-emerald-400/70 hover:text-emerald-300'
          }`}
        >
          <Cpu className="w-4 h-4 text-emerald-400" />
          ⚡ 第14章: 全機駆動 (CPU+NPU+GPU)
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
            30ms
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('claims')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'claims'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          第6章: 主張DB
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {claimStats.total}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('decisions')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
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
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'components'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          第9章: TXT部品レジストリ
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {components.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('answer_ir')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'answer_ir'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          第5.2/13.4節: 回答IR & 意味保持
        </button>

        <button
          onClick={() => setActiveSubTab('collocation_ast')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'collocation_ast'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          第31章: コロケーション & AST
        </button>

        <button
          onClick={() => setActiveSubTab('counterfactual')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'counterfactual'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          第36章: 反事実推論
        </button>

        <button
          onClick={() => setActiveSubTab('latent_intent')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'latent_intent'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          第37章: 潜在意図マイニング
        </button>

        <button
          onClick={() => setActiveSubTab('metacognitive')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'metacognitive'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4" />
          第38章: メタ認知較正
        </button>

        <button
          onClick={() => setActiveSubTab('affection_dynamics')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'affection_dynamics'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Heart className="w-4 h-4" />
          第39章: 感情力動 & 親愛トランスファー
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
            {affectionState.affectionScore}点
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('formal_csp')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'formal_csp'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          第59章: CSP形式制約ソルバー
        </button>

        <button
          onClick={() => setActiveSubTab('llm_migration')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'llm_migration'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitMerge className="w-4 h-4" />
          第13.3節: LLM移管判定
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            シャドー
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('autonomous_hardening')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'autonomous_hardening'
              ? 'border-teal-500 text-teal-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          第7.3節: 自律的賢化・レッドチーム
        </button>

        <button
          onClick={() => setActiveSubTab('cloud_gateway')}
          className={`flex items-center gap-2 px-3 py-2 text-xs md:text-sm font-medium border-b-2 whitespace-nowrap transition ${
            activeSubTab === 'cloud_gateway'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cloud className="w-4 h-4" />
          第11章: クラウド限定連携 & 監査
        </button>
      </div>

      {/* --- Tab 0: Chapter 14 Hardware Pipeline (CPU / NPU / GPU 全機協調駆動) --- */}
      {activeSubTab === 'hardware_pipeline' && <HardwarePipelineSubView />}

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
              {([
                { type: 'code_design', label: '設計・開発', desc: '最速解決・余計な機能禁止' },
                { type: 'casual_chat', label: '対話・雑談', desc: '親身な対話・簡潔応答' },
                { type: 'technical_research', label: '調査・検証', desc: '絶対検証・厳格反証優先' },
                { type: 'troubleshooting', label: '問題解決', desc: '原因特定・安全第一' },
              ] as const).map((p) => (
                <button
                  key={p.type}
                  onClick={() => {
                    setActiveProfile(p.type);
                    unifiedDecisionEngineService.setActiveProfile(p.type);
                  }}
                  className={`p-3 rounded-lg border text-left transition ${
                    activeProfile === p.type
                      ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="text-xs font-bold block">{p.type}</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {p.desc}
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
                          選択: {d.chosen_option}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                          {d.applied_profile}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          d.reduction_verdict === 'IMPLEMENT' || d.reduction_verdict === 'COMPOSE_EXISTING'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          削減知能: {d.reduction_verdict}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(d.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-sm text-slate-200">
                      トピック: <span className="font-medium text-white">{d.topic}</span>
                    </p>

                    {d.reasons.length > 0 && (
                      <p className="text-xs text-slate-400">
                        削減知能理由: {d.reasons.join(', ')}
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
                          : comp.status === 'CANDIDATE'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {comp.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Hash: {comp.validation_hash || 'verified'}</span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">{comp.purpose}</p>

                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                    <span>事前条件: {comp.preconditions.join(', ') || 'なし'}</span>
                    <span>事後条件: {comp.postconditions.join(', ') || 'なし'}</span>
                  </div>

                  <div className="pt-2 flex gap-2">
                    {(['COLLECTED', 'CANDIDATE', 'VERIFIED', 'DEPRECATED'] as ComponentStatus[]).map((st) => (
                      <button
                        key={st}
                        disabled={comp.status === st}
                        onClick={() => {
                          componentRegistryService.advanceComponentStatus(comp.component_id, st, 'UI操作によるステータス変更');
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

          {/* Chapter 10.1: Request Type Compiler & 5.2 Surface Generation Engine */}
          <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-400" />
                第10.1節: 要求型コンパイラ & 第5.2節: 非LLM回答骨格・表層生成
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                NON-LLM DETERMINISTIC
              </span>
            </div>
            <p className="text-xs text-slate-400">
              LLMの曖昧なプロンプト解釈に依存せず、ユーザー要求を「要求カテゴリ」「ドメイン」「制約」「期待成果物」「確実性要件」へ決定論的にコンパイル。5大骨格と多軸性格プロファイルから表層文を一意かつ高速に合成します。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-slate-300 font-semibold block mb-1">自然言語ユーザー要求</label>
                <input
                  type="text"
                  value={compilerInput}
                  onChange={(e) => setCompilerInput(e.target.value)}
                  placeholder="例: Excelで重複データを1列にまとめて高速に抽出するマクロを作って"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">適用する回答骨格 (5.2節)</label>
                <select
                  value={selectedSkeleton}
                  onChange={(e) => setSelectedSkeleton(e.target.value as AnswerSkeletonType)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                >
                  <option value="TASK_COMPLETION">作業完了骨格 (完了内容→成果物→検証→留意点)</option>
                  <option value="RECOMMENDATION">推薦骨格 (結論→理由→欠点→条件変化)</option>
                  <option value="CORRECTION">訂正骨格 (認識→旧前提無効化→影響範囲→結論)</option>
                  <option value="UNKNOWN_INVESTIGATION">不明骨格 (既知事項→未知事項→不足証拠→次手段)</option>
                  <option value="GENERAL_ANSWER">一般回答骨格 (結論→条件→理由→次ステップ)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCompileRequest}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Cpu className="w-4 h-4" />
              要求型をコンパイル＆非LLM表層文を合成
            </button>

            {compiledResult && (
              <div className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400">
                    コンパイル済み要求型 (CompiledRequestType)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {compiledResult.compiled_id}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400 text-[10px]">要求カテゴリ</span>
                    <p className="font-bold text-slate-200 mt-0.5">{compiledResult.category}</p>
                  </div>
                  <div className="p-2 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400 text-[10px]">ドメイン</span>
                    <p className="font-bold text-slate-200 mt-0.5">{compiledResult.domain}</p>
                  </div>
                  <div className="p-2 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400 text-[10px]">確実性要件</span>
                    <p className="font-bold text-slate-200 mt-0.5">{compiledResult.certaintyRequirement}</p>
                  </div>
                  <div className="p-2 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400 text-[10px]">照応・代名詞解決</span>
                    <p className="font-bold text-slate-200 mt-0.5">
                      {compiledResult.resolvedAnaphora?.length ? `${compiledResult.resolvedAnaphora.length}件解決` : 'なし'}
                    </p>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <div className="text-slate-400">
                    <span className="text-slate-500">期待成果物:</span> <span className="text-slate-200 font-medium">{compiledResult.expectedDeliverable}</span>
                  </div>
                  {compiledResult.constraints.length > 0 && (
                    <div className="text-slate-400">
                      <span className="text-slate-500">抽出された制約:</span> <span className="text-emerald-300">{compiledResult.constraints.join(' / ')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {surfaceResultState && (
              <div className="p-3 bg-slate-900/80 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    非LLM決定論的合成 表層テキスト (骨格: {selectedSkeleton})
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                    surfaceResultState.inspection.isPreserved
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}>
                    意味保持検査: {surfaceResultState.inspection.isPreserved ? '合格' : '脱落あり'}
                  </span>
                </div>
                <pre className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 whitespace-pre-wrap">
                  {surfaceResultState.surfaceText}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 5: Counterfactual Reasoning (Chapter 36) --- */}
      {activeSubTab === 'counterfactual' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                第36章: 反実仮想推論 & 分岐シミュレータ (Counterfactual Reasoning)
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                過去の決定に対して「もし別の選択肢を採用していたら」の仮説シナリオを非LLMルールで比較評価。不変条件（安全性・プライバシー）を検査し、次回の最適選択（後悔学習）へフィードバックします。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">検証トピック</label>
                <input
                  type="text"
                  value={cfTopic}
                  onChange={(e) => setCfTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">事実の選択 (Factual Decision)</label>
                <input
                  type="text"
                  value={cfFactualDecision}
                  onChange={(e) => setCfFactualDecision(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">発生文脈 (Trigger Context)</label>
                <input
                  type="text"
                  value={cfTriggerContext}
                  onChange={(e) => setCfTriggerContext(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
            </div>

            <button
              onClick={handleRunCounterfactual}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <GitBranch className="w-4 h-4" />
              反実仮想分岐シミュレーションを実行
            </button>

            {cfResult && (
              <div className="mt-4 space-y-3 p-4 bg-slate-900/80 border border-slate-700/80 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="text-xs text-emerald-400 font-bold">
                    推論結論: {cfResult.conclusion}
                  </div>
                  {cfResult.bestAlternative && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      最良代替案 Δ=+{cfResult.bestAlternative.overallDeltaScore}点
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-300">分岐シナリオ評価結果:</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {cfResult.evaluations.map((ev, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs ${
                          ev.overallDeltaScore > 0
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200'
                            : 'bg-slate-950/40 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span>{ev.scenarioName}</span>
                          <span
                            className={
                              ev.overallDeltaScore > 0
                                ? 'text-emerald-400 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            Δ = {ev.overallDeltaScore > 0 ? `+${ev.overallDeltaScore}` : ev.overallDeltaScore}点
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-400 my-1">
                          <span>安全: {ev.safetyScore}</span>
                          <span>性能: {ev.performanceScore}</span>
                          <span>精度: {ev.accuracyScore}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{ev.reasoning}</p>
                        <div className="mt-1 flex items-center gap-1 text-[10px]">
                          {ev.invariantsPassed ? (
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> 不変条件保護 合格
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> 不変条件違反
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {cfHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-400 block mb-2">過去の反事実推論履歴 ({cfHistory.length}件)</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {cfHistory.slice(0, 5).map((h) => (
                    <div key={h.id} className="p-2 bg-slate-900/60 border border-slate-800 rounded text-xs flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-200">{h.topic}</span>
                        <span className="text-slate-500 ml-2">事実: {h.factualDecision}</span>
                      </div>
                      <span className="text-[11px] text-emerald-400">
                        {h.bestAlternative ? `推奨: ${h.bestAlternative.scenarioName}` : '現状維持'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 6: Latent Intent Mining (Chapter 37) --- */}
      {activeSubTab === 'latent_intent' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                第37章: 多段意図推定 & 潜在欲求マイニング (Latent Intent Mining)
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                ユーザーの曖昧な表面指示の背後にある「真の業務ゴール」「暗黙の前提」「不安要因」を推定し、対話の方針転換（Intent Drift）を先回りして解決します。
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">ユーザー発話テキスト</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={latentInput}
                  onChange={(e) => setLatentInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
                <button
                  onClick={handleInferLatentIntent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  潜在ゴール推定
                </button>
              </div>
            </div>

            {latentInference && (
              <div className="mt-4 space-y-3 p-4 bg-slate-900/80 border border-slate-700/80 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                    <span className="text-xs text-slate-400">表面上の要求 (Surface Intent)</span>
                    <p className="text-sm font-semibold text-slate-200 mt-1">{latentInference.surfaceIntent}</p>
                  </div>
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/40 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-300 font-semibold">真の潜在ゴール (Latent Goal)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200">
                        確信度: {latentInference.confidenceScore}%
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white mt-1">{latentInference.latentGoal}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                    <span className="text-slate-400 font-semibold block mb-1">言語化されていない潜在欲求 (Unexpressed Needs):</span>
                    <ul className="list-disc pl-4 space-y-1 text-slate-300">
                      {latentInference.unexpressedNeeds.map((need, idx) => (
                        <li key={idx}>{need}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400 font-semibold">先回り提案アクション:</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        latentInference.urgencyLevel === 'HIGH' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                        latentInference.urgencyLevel === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        緊急度: {latentInference.urgencyLevel}
                      </span>
                    </div>
                    <p className="text-slate-200">{latentInference.suggestedProactiveAction}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 7: Metacognitive Calibration (Chapter 38) --- */}
      {activeSubTab === 'metacognitive' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                第38章: メタ認知モニタリング & 自己確信度較正 (Metacognitive Calibration)
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                回答や生成コードに対して、事実根拠・構文健全性・制約充足度・ドメイン熟練度を客観的に評価。過信・ハルシネーションを検知した場合はキャリブレーションペナルティを課し、前提条件や検証要請を動的挿入します。
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">検証トピック</label>
                <input
                  type="text"
                  value={metaTopic}
                  onChange={(e) => setMetaTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">ドメイン分類</label>
                <select
                  value={metaDomain}
                  onChange={(e) => setMetaDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                >
                  <option value="vba">VBA / Excelマクロ (熟練度: 極高)</option>
                  <option value="frontend">Frontend / React (熟練度: 高)</option>
                  <option value="general">一般常識・対話 (熟練度: 標準)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">対象回答または提案コード</label>
              <textarea
                rows={3}
                value={metaText}
                onChange={(e) => setMetaText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 font-mono"
              />
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metaHasTestRun}
                  onChange={(e) => setMetaHasTestRun(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                />
                実機実行・テスト検証済み (Test Run Verified)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metaHasMemoryGrounding}
                  onChange={(e) => setMetaHasMemoryGrounding(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500"
                />
                主張DB/構造化記憶による事実裏付けあり
              </label>
            </div>

            <button
              onClick={handleRunMetacognitiveCalib}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Brain className="w-4 h-4" />
              確信度スコアリング & 過信防止較正を実行
            </button>

            {metaResult && (
              <div className="mt-4 space-y-3 p-4 bg-slate-900/80 border border-slate-700/80 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">較正後確信度:</span>
                    <span className="text-lg font-bold text-emerald-400">{metaResult.calibratedConfidence}%</span>
                    <span className="text-xs text-slate-400">(生確信度: {metaResult.rawConfidence}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                      metaResult.overconfidenceRisk !== 'LOW'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {metaResult.overconfidenceRisk !== 'LOW' ? `⚠️ 過信警戒 (${metaResult.overconfidenceRisk})` : '✅ 健全な較正 (LOW)'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {metaResult.calibrationAction}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400">事実根拠スコア</span>
                    <p className="text-sm font-bold text-slate-200 mt-0.5">{metaResult.factors.factualGroundingScore}</p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400">構文健全性スコア</span>
                    <p className="text-sm font-bold text-slate-200 mt-0.5">{metaResult.factors.syntaxValidityScore}</p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400">制約充足度スコア</span>
                    <p className="text-sm font-bold text-slate-200 mt-0.5">{metaResult.factors.constraintSatisfactionScore}</p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded">
                    <span className="text-slate-400">ドメイン熟練度</span>
                    <p className="text-sm font-bold text-slate-200 mt-0.5">{metaResult.factors.domainFamiliarityScore}</p>
                  </div>
                </div>

                {metaResult.calibrationAction === 'ATTACH_HEDGE' && (
                  <div className="p-3 bg-amber-950/20 border border-amber-500/40 rounded-lg text-xs text-amber-200">
                    <span className="font-semibold block mb-1">過信防止ヘッジ付加推奨:</span>
                    検証根拠が薄いため、「※実機実行環境による検証が必要です」等の前提条件を回答に付加することを推奨します。
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab: Chapter 31 Collocation & Safe AST Refactoring --- */}
      {activeSubTab === 'collocation_ast' && (
        <div className="space-y-6">
          {/* Card 1: Japanese Collocation Naturalness Evaluation */}
          <div className="p-5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h4 className="text-base font-semibold text-white">第31章: 日本語共起・コロケーション自然さ評価器</h4>
            </div>
            <p className="text-xs text-slate-400">
              会話文やエラー説明における不自然な日本語・共起表現を検知し、自然で誤解のない言い回しを提示します。
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={collocationInput}
                onChange={(e) => setCollocationInput(e.target.value)}
                placeholder="評価する文（例: 画面更新を停止してエラーが発生しました）"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleRunCollocation}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
              >
                コロケーション解析
              </button>
            </div>

            {collocationResults.length > 0 && (
              <div className="space-y-2 mt-3">
                <span className="text-xs text-slate-400 font-medium">検出された共起パターン & 改善推奨:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {collocationResults.map((c, idx) => (
                    <div key={idx} className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-emerald-300">{c.phrase}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          自然度: {c.naturalnessScore}/100
                        </span>
                      </div>
                      <p className="text-slate-400">カテゴリ: {c.contextCategory}</p>
                      {c.suggestion && <p className="text-amber-300 font-medium">💡 推奨: {c.suggestion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Safe AST Refactoring */}
          <div className="p-5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-emerald-400" />
              <h4 className="text-base font-semibold text-white">第31章: VBA/TypeScript AST安全リファクタリング推薦器</h4>
            </div>
            <p className="text-xs text-slate-400">
              安全な構文木置換パターンに基づき、副作用のない高速化・堅牢化コードへの変換を決定論的に提案します。
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-400">対象ソースコード (VBA/TS):</label>
              <textarea
                value={astSourceCode}
                onChange={(e) => setAstSourceCode(e.target.value)}
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleRunAstRefactor}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
              >
                AST安全リファクタリング提案を生成
              </button>
            </div>

            {astRefactorResults.length > 0 && (
              <div className="space-y-3 mt-3">
                <span className="text-xs text-slate-400 font-medium">安全変換候補 ({astRefactorResults.length}件):</span>
                {astRefactorResults.map((ref) => (
                  <div key={ref.ruleId} className="p-3 bg-slate-900/90 border border-slate-700 rounded-lg text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-emerald-400">ルール: {ref.ruleId}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                        見込み高速化: {ref.expectedSpeedup || '1.5x'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
                      <div className="p-2 bg-rose-950/20 border border-rose-500/30 rounded text-rose-200">
                        <span className="block text-[10px] text-rose-400 font-sans mb-1 font-bold">置換前 (非効率):</span>
                        {ref.beforeCode}
                      </div>
                      <div className="p-2 bg-emerald-950/20 border border-emerald-500/30 rounded text-emerald-200">
                        <span className="block text-[10px] text-emerald-400 font-sans mb-1 font-bold">置換後 (安全・高速):</span>
                        {ref.afterCode}
                      </div>
                    </div>
                    <p className="text-slate-400 text-[11px]">🛡️ 安全保証: {ref.safetyProof}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab: Chapter 39 Affection Dynamics & Continuous Transfer --- */}
      {activeSubTab === 'affection_dynamics' && (
        <div className="space-y-6">
          {/* Current State Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">親愛度スコア</span>
              <p className="text-2xl font-bold text-pink-400 mt-0.5">{affectionState.affectionScore}点</p>
            </div>
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">共感レベル</span>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">{affectionState.empathyLevel}%</p>
            </div>
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">最新感情価</span>
              <p className="text-sm font-bold text-amber-300 mt-1">{affectionState.valence}</p>
            </div>
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">口調スタンス</span>
              <p className="text-xs font-bold text-purple-300 mt-1">{affectionState.toneStance}</p>
            </div>
            <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
              <span className="text-xs text-slate-400">セッション継承</span>
              <p className="text-xl font-bold text-cyan-400 mt-0.5">{affectionState.sessionTransferCount}回</p>
            </div>
          </div>

          {/* Emotion Dynamic Analyzer */}
          <div className="p-5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-400" />
                <h4 className="text-base font-semibold text-white">第39章: 感情共感力動・親愛度連続トランスファー</h4>
              </div>
              <button
                onClick={handleRunSessionTransfer}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-900/40 hover:bg-pink-900/60 text-pink-300 border border-pink-700/60 rounded-lg text-xs font-medium transition"
              >
                セッション間トランスファー実行
              </button>
            </div>
            <p className="text-xs text-slate-400">
              会話中の感謝・達成感・困惑を決定論的に解析し、親愛トーンを自然にグラデーション制御します。ドメイン移行や再接続後も親密さを失いません。
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={affectionInput}
                onChange={(e) => setAffectionInput(e.target.value)}
                placeholder="ユーザー発話（例: エクセルが動いたよ！本当に助かった！）"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              />
              <button
                onClick={handleRunAffectionEval}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-medium transition"
              >
                感情共感解析
              </button>
            </div>

            {affectionEvalResult && (
              <div className="p-4 bg-slate-900/90 border border-pink-500/30 rounded-lg text-xs space-y-2 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-pink-300">
                    検出感情: {affectionEvalResult.detectedEmotion} (Δ=+{affectionEvalResult.emotionalScoreDelta}点)
                  </span>
                  <span className="font-mono text-emerald-400">新親愛度: {affectionEvalResult.newAffectionScore}点</span>
                </div>
                <p className="text-slate-300">
                  <span className="text-slate-400">推奨トーン:</span> {affectionEvalResult.recommendedTone}
                </p>
                <p className="text-amber-300">
                  <span className="text-slate-400">共感ガイダンス:</span> {affectionEvalResult.empathyGuidance}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab: Chapter 59 CSP Formal Constraint Solver --- */}
      {activeSubTab === 'formal_csp' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-800/80 border border-slate-700/80 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <h4 className="text-base font-semibold text-white">第59章: CSP形式知識・制約ソルバー (Formal Constraint Engine)</h4>
            </div>
            <p className="text-xs text-slate-400">
              数理論理学および制約充足問題 (CSP) アルゴリズムにより、自己コード改善契約や不変条件の無矛盾性（SAT）を数学的に証明します。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">変更対象ファイル (カンマ区切り):</label>
                <input
                  type="text"
                  value={cspTargetFiles}
                  onChange={(e) => setCspTargetFiles(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">禁止ファイル (変更不可):</label>
                <input
                  type="text"
                  value={cspForbiddenFiles}
                  onChange={(e) => setCspForbiddenFiles(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">維持必須条件 (不変条件):</label>
                <input
                  type="text"
                  value={cspMustPreserve}
                  onChange={(e) => setCspMustPreserve(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleRunCspSolve}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
            >
              CSP形式無矛盾性検証 (Solve CSP)
            </button>

            {cspSolveResult && (
              <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-lg text-xs space-y-3 mt-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {cspSolveResult.isSatisfied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="font-semibold text-white">
                      判定結果: {cspSolveResult.isSatisfied ? '充足 (SAT - 安全に変更可能)' : '矛盾あり (UNSAT - 適用却下)'}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono">探索反復数: {cspSolveResult.iterations}</span>
                </div>

                {cspSolveResult.contradictionsFound.length > 0 && (
                  <div className="p-2.5 bg-rose-950/30 border border-rose-500/40 rounded text-rose-200">
                    <span className="font-semibold block mb-1">検出された制約抵触:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {cspSolveResult.contradictionsFound.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block mb-1 font-medium">割り当て変数ドメイン:</span>
                  <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                    {JSON.stringify(cspSolveResult.assignedVariables, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Tab 11: LLM Migration Protocol (第13.3節) --- */}
      {activeSubTab === 'llm_migration' && <LlmMigrationSubView />}

      {/* --- Tab 12: Autonomous Hardening & Red Teaming (第7.3節) --- */}
      {activeSubTab === 'autonomous_hardening' && <AutonomousHardeningSubView />}

      {/* --- Tab 13: Cloud Gateway & Privacy Audit (第11章) --- */}
      {activeSubTab === 'cloud_gateway' && <CloudGatewaySubView />}
    </div>
  );
};
