import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Brain,
  Wrench,
  GitBranch,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Search,
  FlaskConical,
  Award,
  BookOpen,
  ArrowRight,
  Zap,
  Compass,
  Activity,
  BatteryCharging,
  Wifi,
  Moon,
  Clock,
  Play,
  Shield,
  Bell,
  Database,
  PieChart,
  Filter,
  AlertCircle,
} from 'lucide-react';
import {
  SelfImprovementRecord,
  TrainingSampleJSONL,
  TrainingDataSplitStats,
  ModelGeneration,
  SkillItem,
  ChatMessage,
  MemoryItem,
  ActionPrediction,
  PredictionErrorRecord,
  WorkManagerStatus,
  BackgroundTaskExecutionLog,
  RegressionSuiteRunReport,
  WorkspaceFile,
  ToolDefinition,
  ToolExecutionResult,
  ReviewQueueItem,
} from '../types';
import { selfImprovementService } from '../services/selfImprovementService';
import { skillsService } from '../services/skillsService';
import { worldModelService } from '../services/worldModelService';
import {
  backgroundWorkerService,
  canRunShallowSleep,
  canRunDeepSleep,
  getDeepSleepUnmetReasons,
  getShallowSleepUnmetReasons,
} from '../services/backgroundWorkerService';
import { regressionBenchmarkService } from '../services/regressionBenchmarkService';
import { nativeBackgroundService } from '../services/nativeBackgroundService';
import { toolsService } from '../services/toolsService';
import { retrieveScoredMemories } from '../utils/memoryRetrieval';

export interface SelfImprovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  memories: MemoryItem[];
  workspaceFiles?: WorkspaceFile[];
  initialTab?: 'diagnosis' | 'world_model' | 'workmanager' | 'benchmark' | 'skills' | 'tools' | 'lab' | 'colab' | 'generations';
}

export const SelfImprovementModal: React.FC<SelfImprovementModalProps> = ({
  isOpen,
  onClose,
  chatMessages,
  memories,
  workspaceFiles = [],
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'world_model' | 'workmanager' | 'benchmark' | 'skills' | 'tools' | 'lab' | 'colab' | 'generations'>('diagnosis');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [notificationTestStatus, setNotificationTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // ベンチマーク & 退行テストステート (設計思想 9)
  const [benchmarkReports, setBenchmarkReports] = useState<RegressionSuiteRunReport[]>([]);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);
  const [selectedReport, setSelectedReport] = useState<RegressionSuiteRunReport | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);

  // 世界モデルステート (設計思想 17)
  const [worldModelErrors, setWorldModelErrors] = useState<PredictionErrorRecord[]>([]);
  const [worldModelStats, setWorldModelStats] = useState<any>(null);

  // WorkManager ステート (設計思想 11 & 23)
  const [wmStatus, setWmStatus] = useState<WorkManagerStatus | null>(null);
  const [wmLogs, setWmLogs] = useState<BackgroundTaskExecutionLog[]>([]);
  const [isWmRunning, setIsWmRunning] = useState(false);
  const [wmMessage, setWmMessage] = useState<string | null>(null);

  // 診断ステート
  const [diagnosedIssue, setDiagnosedIssue] = useState<any>(null);
  const [diagnosisRecords, setDiagnosisRecords] = useState<SelfImprovementRecord[]>([]);
  const [diagnosisCountsByArea, setDiagnosisCountsByArea] = useState<Record<string, number>>({});

  // スキルステート
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<SkillItem['category']>('coding');
  const [newSkillTrigger, setNewSkillTrigger] = useState('');
  const [newSkillSteps, setNewSkillSteps] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');

  // 実験室 (A/Bテスト & 検索比較)
  const [abPromptInput, setAbPromptInput] = useState('タメ口でゲームのバグを直してほしい');
  const [abResult, setAbResult] = useState<any>(null);
  const [searchBenchmarkQuery, setSearchBenchmarkQuery] = useState('Canvas 当たり判定 バグ');

  // Colab & 学習データ (Train / Validation / Test 分割対応)
  const [trainingSamples, setTrainingSamples] = useState<TrainingSampleJSONL[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(() =>
    selfImprovementService.getReviewQueue()
  );
  const [colabScript, setColabScript] = useState('');
  const [splitMessage, setSplitMessage] = useState<string | null>(null);
  const [selectedSplitFilter, setSelectedSplitFilter] = useState<'all' | 'train' | 'validation' | 'test'>('all');
  const [splitStats, setSplitStats] = useState<TrainingDataSplitStats>(() =>
    selfImprovementService.getSplitStats()
  );

  // 世代管理ステート
  const [generations, setGenerations] = useState<ModelGeneration[]>([]);
  const [showAddGen, setShowAddGen] = useState(false);
  const [newGenName, setNewGenName] = useState('');
  const [newGenVersion, setNewGenVersion] = useState('v1.1.0');
  const [newGenBranch, setNewGenBranch] = useState<ModelGeneration['branch']>('chat_specialized');
  const [newGenRank, setNewGenRank] = useState(16);
  const [newGenSamples, setNewGenSamples] = useState(100);
  const [newGenReportId, setNewGenReportId] = useState<string>('');
  const [newGenNotes, setNewGenNotes] = useState('');
  const [promotionError, setPromotionError] = useState<string | null>(null);

  // 安定版昇格モーダルステート
  const [promotingGenId, setPromotingGenId] = useState<string | null>(null);
  const [selectedPromoteReportId, setSelectedPromoteReportId] = useState<string>('');
  const [promotionSuccessMsg, setPromotionSuccessMsg] = useState<string | null>(null);

  // データセット・クリーンアップステート
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const [skillsMessage, setSkillsMessage] = useState<string | null>(null);

  // ツール管理ステート (:feature:tools / 設計思想 14 & 22章)
  const [toolsList] = useState<ToolDefinition[]>(() => toolsService.getAllTools());
  const [selectedToolId, setSelectedToolId] = useState<string>('tool_safe_calculator');
  const [toolTestInput, setToolTestInput] = useState<string>('1250 * 1.1 + 500');
  const [toolExecutionResult, setToolExecutionResult] = useState<ToolExecutionResult | null>(null);
  const [isToolExecuting, setIsToolExecuting] = useState(false);

  const handleExecuteInteractiveTool = async () => {
    setIsToolExecuting(true);
    setToolExecutionResult(null);
    try {
      let params: Record<string, any> = {};
      if (selectedToolId === 'tool_safe_calculator') {
        params = { expression: toolTestInput };
      } else if (selectedToolId === 'tool_code_syntax_audit') {
        const file =
          workspaceFiles.find(
            (f) => f.path.endsWith('.html') || f.path.endsWith('.js') || f.path.endsWith('.ts')
          ) || workspaceFiles[0];
        params = {
          code: toolTestInput || (file ? file.content : 'console.log("hello");'),
          language: file ? file.language : 'javascript',
        };
      } else if (selectedToolId === 'tool_workspace_search') {
        params = { query: toolTestInput || 'canvas' };
      } else {
        params = { path: 'test_tool.txt', content: toolTestInput };
      }

      const res = await toolsService.executeTool(
        selectedToolId,
        params,
        {
          workspaceFiles,
          userNickname: 'ユーザー',
        },
        { userConfirmed: true }
      );
      setToolExecutionResult(res);
    } catch (e: any) {
      setToolExecutionResult({
        toolId: selectedToolId,
        toolName: selectedToolId,
        permission: 'read_only',
        executionTimeMs: 0,
        success: false,
        result: null,
        error: e.message,
        outputSummary: `エラー: ${e.message}`,
        executedAt: Date.now(),
      });
    } finally {
      setIsToolExecuting(false);
    }
  };

  const handleTestNotification = async () => {
    setNotificationTestStatus('実機/Web通知を送信中...');
    try {
      const ok = await nativeBackgroundService.sendLocalNotification({
        id: 7001,
        title: '🎯 [通知テスト] 学習データ蓄積通知',
        body: '承認済み学習サンプルが目標閾値に達した際の実機通知テストです。タップするとトレーニングタブが開きます。',
        data: {
          action: 'open_self_improvement',
          tab: 'colab',
        },
      });
      if (ok) {
        setNotificationTestStatus('✓ 通知を発火しました！(通知をタップすると本画面が開きます)');
      } else {
        setNotificationTestStatus('⚠️ 通知権限が未許可、またはブラウザ/OSによりブロックされました');
      }
    } catch (e: any) {
      setNotificationTestStatus(`❌ エラー: ${e?.message || '送信失敗'}`);
    }
    setTimeout(() => setNotificationTestStatus(null), 5000);
  };

  useEffect(() => {
    if (isOpen) {
      setSkills(skillsService.getAllSkills());
      setTrainingSamples(selfImprovementService.getTrainingSamples());
      setReviewQueue(selfImprovementService.getReviewQueue());
      setSplitStats(selfImprovementService.getSplitStats());
      setGenerations(selfImprovementService.getGenerations());
      setColabScript(selfImprovementService.generateColabTrainingScript());
      setWorldModelErrors(worldModelService.getErrorRecords());
      setWorldModelStats(worldModelService.getStats());
      setWmStatus(backgroundWorkerService.getStatus());
      setWmLogs(backgroundWorkerService.getLogs());
      const reports = regressionBenchmarkService.getReports();
      setBenchmarkReports(reports);
      if (reports.length > 0) {
        setSelectedReport(reports[0]);
      }

      // 最新のメッセージから失敗診断を自動実行
      setDiagnosisRecords(selfImprovementService.getRecords());
      setDiagnosisCountsByArea(selfImprovementService.getRecordCountsByArea());

      const lastFailedMsg = [...chatMessages].reverse().find((m) => m.isError || m.userFeedback === 'bad');
      if (lastFailedMsg) {
        // プレビュー表示なので副作用なしの computeDiagnosis を使う (diagnoseFailure は
        // ChatPanel の👎フィードバック時に1回だけ呼ばれ、this.records へ記録される)
        const diag = selfImprovementService.computeDiagnosis(
          'ユーザーからの直前の指示',
          lastFailedMsg.content,
          lastFailedMsg.feedbackNote || (lastFailedMsg.isError ? 'Inference Exception' : undefined),
          {
            memoriesUsedCount: (lastFailedMsg.usedMemories || []).length,
            promptLengthChars: 1500,
            engineMode: lastFailedMsg.engineMode || 'native_gpu',
          }
        );
        setDiagnosedIssue(diag);
      } else {
        setDiagnosedIssue({
          category: '全システム正常稼働中 (All Systems Nominal)',
          rootCause: '致命的な推論エラーや低評価フィードバックは現在検出されていません。',
          suggestedFixArea: 'no_change',
          recommendation: '良好な会話データが蓄積されています。「Colab連携」タブから最新教材のLoRAエクスポートが可能です。',
        });
      }
    }
  }, [isOpen, chatMessages]);

  // WorkManager ステータス & 睡眠判定の定期更新ポーリング
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setWmStatus(backgroundWorkerService.getStatus());
      setWmLogs(backgroundWorkerService.getLogs());
    }, 1500);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 3000);
  };

  const handleCreateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;

    const stepsArray = newSkillSteps
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const created = skillsService.addSkill({
      name: newSkillName.trim(),
      category: newSkillCategory,
      description: newSkillDesc.trim() || 'ユーザー定義スキル',
      triggerCondition: newSkillTrigger.trim() || newSkillName.trim(),
      requiredInputs: ['ユーザー入力'],
      steps: stepsArray.length > 0 ? stepsArray : ['1. 要件を確認して適切な処理を実行'],
      usedTools: ['codeParser'],
      outputFormat: '解説付きコードまたはテキスト',
      verificationMethod: '静的検証',
      status: 'official',
      version: '1.0.0',
    });

    setSkills(skillsService.getAllSkills());
    setNewSkillName('');
    setNewSkillSteps('');
    setNewSkillDesc('');
    setNewSkillTrigger('');
    setShowAddSkill(false);
  };

  const handleDeleteSkill = (id: string) => {
    skillsService.deleteSkill(id);
    setSkills(skillsService.getAllSkills());
  };

  const handleRunABTest = async () => {
    setAbResult({ isLoading: true });
    const res = await selfImprovementService.runPromptABBenchmark(
      abPromptInput,
      {
        name: '候補A: 脱ロボット親友プロンプト',
        systemPrompt: 'あなたは親友のみきだよ。タメ口で明るく自然な日本語で話してね。でっち上げは禁止。',
      },
      {
        name: '候補B: 厳格技術アシスタントプロンプト',
        systemPrompt: 'あなたは技術アシスタントです。論理的かつ簡潔にエラーを修正してください。',
      }
    );
    setAbResult(res);
  };

  const handleCreateGeneration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenName.trim()) return;
    setPromotionError(null);

    const linkedReport = benchmarkReports.find((r) => r.id === newGenReportId);

    // 設計思想: stable ブランチへの直接登録は合格済みレポートが必須 & 対象モデル一致必須
    if (newGenBranch === 'stable') {
      if (!newGenReportId) {
        setPromotionError('総合安定版(stable)への直接登録には、合格済みの回帰テストレポートの選択が必須です。');
        return;
      }
      const val = selfImprovementService.validatePromotionReport(newGenReportId, {
        generationId: 'candidate_check',
        modelName: newGenName.trim(),
        baseModel: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
        version: newGenVersion.trim() || 'v1.1.0',
        branch: 'stable',
        status: 'active',
        createdAt: Date.now(),
        notes: newGenNotes.trim(),
      });
      if (!val.valid) {
        setPromotionError(`安定版の昇格基準を満たしていません: ${val.error}`);
        return;
      }
    }

    try {
      selfImprovementService.addGeneration({
        modelName: newGenName.trim(),
        baseModel: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
        version: newGenVersion.trim() || 'v1.1.0',
        branch: newGenBranch,
        loraRank: Number(newGenRank) || 16,
        trainingSamplesCount: Number(newGenSamples) || 0,
        status: newGenBranch === 'stable' ? 'active' : 'shadow_testing',
        benchmarkScore: linkedReport ? linkedReport.overallScore : undefined,
        benchmarkReportId: linkedReport?.id,
        promotedAt: newGenBranch === 'stable' ? Date.now() : undefined,
        promotionNotes: newGenBranch === 'stable' ? '全回帰テスト合格により直接承認' : undefined,
        notes: newGenNotes.trim() || 'ColabでLoRA学習・量子化した新世代モデル',
      });

      setGenerations(selfImprovementService.getGenerations());
      setNewGenName('');
      setNewGenNotes('');
      setNewGenReportId('');
      setPromotionError(null);
      setShowAddGen(false);
    } catch (err: any) {
      setPromotionError(err?.message || '世代登録に失敗しました');
    }
  };

  const handlePromoteToStable = (generationId: string, reportId: string) => {
    setPromotionError(null);
    try {
      const res = selfImprovementService.promoteToStable(generationId, reportId);
      if (!res.success) {
        setPromotionError(res.error || '昇格処理に失敗しました');
        return;
      }
      setGenerations(selfImprovementService.getGenerations());
      setPromotingGenId(null);
      setSelectedPromoteReportId('');
      setPromotionSuccessMsg('🎉 厳格な回帰ベンチマーク検証を通過し、総合安定版(stable)への昇格が完了しました！');
      setTimeout(() => setPromotionSuccessMsg(null), 5000);
    } catch (err: any) {
      setPromotionError(err?.message || '昇格処理に失敗しました');
    }
  };

  const handleCleanDataset = () => {
    const res = selfImprovementService.cleanAndDeduplicateSamples();
    setTrainingSamples(selfImprovementService.getTrainingSamples());
    setCleanupMessage(
      `✓ クリーンアップ完了: 重複除外 ${res.removedDuplicates}件, 低品質除外 ${res.prunedLowQuality}件 (現在有効データ: ${res.afterCount}件)`
    );
    setTimeout(() => setCleanupMessage(null), 5000);
  };

  const handleAutoExtractSkills = () => {
    const newSkills = skillsService.autoExtractSkillsFromHistory(chatMessages);
    skillsService.evaluateAllSkillsPromotion();
    setSkills(skillsService.getAllSkills());
    setSkillsMessage(
      newSkills.length > 0
        ? `✓ 会話ログから新たに ${newSkills.length} 件のスキル候補を自動抽出しました！`
        : '会話ログを走査しました。新たな高頻度スキルパターンは検出されませんでした（既存スキル登録済み）。'
    );
    setTimeout(() => setSkillsMessage(null), 4000);
  };

  const handleDeleteGeneration = (id: string) => {
    selfImprovementService.deleteGeneration(id);
    setGenerations(selfImprovementService.getGenerations());
  };

  const handleResetGenerations = () => {
    selfImprovementService.resetGenerationsToDefault();
    setGenerations(selfImprovementService.getGenerations());
  };

  // 学習データの Train / Validation / Test 自動分割
  const handleAutoAssignSplits = () => {
    const res = selfImprovementService.autoAssignSplits({ train: 0.8, val: 0.1, test: 0.1 });
    setTrainingSamples(selfImprovementService.getTrainingSamples());
    setSplitStats(selfImprovementService.getSplitStats());
    setSplitMessage(
      `✓ データセットを自動分割しました: Train ${res.train}件 (80%), Validation ${res.validation}件 (10%), Test ${res.test}件 (10%)`
    );
    setTimeout(() => setSplitMessage(null), 5000);
  };

  // サンプルの split 個別変更
  const handleUpdateSampleSplit = (index: number, split: 'train' | 'validation' | 'test') => {
    selfImprovementService.updateSampleSplit(index, split);
    setTrainingSamples(selfImprovementService.getTrainingSamples());
    setSplitStats(selfImprovementService.getSplitStats());
  };

  // サンプルの承認トグル
  const handleToggleApproveSample = (index: number) => {
    const samples = selfImprovementService.getTrainingSamples();
    if (samples[index]) {
      samples[index].approved = !samples[index].approved;
      setTrainingSamples([...samples]);
      setSplitStats(selfImprovementService.getSplitStats());
    }
  };

  // 保留中要確認キューの個別承認
  const handleApproveReviewItem = (id: string) => {
    selfImprovementService.approveReviewQueueItem(id);
    setReviewQueue([...selfImprovementService.getReviewQueue()]);
    setTrainingSamples([...selfImprovementService.getTrainingSamples()]);
    setSplitStats(selfImprovementService.getSplitStats());
  };

  // 保留中要確認キューの個別却下
  const handleDismissReviewItem = (id: string) => {
    selfImprovementService.dismissReviewQueueItem(id);
    setReviewQueue([...selfImprovementService.getReviewQueue()]);
  };

  // JSONLエクスポート (全件 or 特定split)
  const handleExportJSONLFile = (split?: 'train' | 'validation' | 'test') => {
    const jsonl = selfImprovementService.exportTrainingJSONL(false, split);
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miki_lora_${split || 'all'}_dataset_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunBenchmark = async () => {
    setIsBenchmarkRunning(true);
    setBenchmarkError(null);
    try {
      const report = await regressionBenchmarkService.runFullSuite();
      const updatedReports = regressionBenchmarkService.getReports();
      setBenchmarkReports(updatedReports);
      setSelectedReport(report);
    } catch (e: any) {
      console.warn('Benchmark suite execution failed:', e);
      setBenchmarkError(e?.message || 'ベンチマーク実行に失敗しました');
    } finally {
      setIsBenchmarkRunning(false);
    }
  };

  const handleClearBenchmarkReports = () => {
    regressionBenchmarkService.clearReports();
    setBenchmarkReports([]);
    setSelectedReport(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 text-lg">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>自己改善研究所 & 進化エンジン (Self-Improvement Lab)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                  第1〜第5世代 統合アーキテクチャ
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                失敗原因の多層自動診断、スキルライブラリ、Colab LoRA学習教材生成、モデル世代系統樹を完全管理
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 gap-1.5 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'diagnosis'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-4 h-4 text-purple-400" />
            <span>失敗診断 & 改善ルーター</span>
          </button>

          <button
            onClick={() => setActiveTab('world_model')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'world_model'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4 text-indigo-400" />
            <span>🧠 世界モデル ({worldModelErrors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('workmanager')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'workmanager'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BatteryCharging className="w-4 h-4 text-amber-400" />
            <span>⚡ WorkManager 自律処理</span>
          </button>

          <button
            onClick={() => setActiveTab('benchmark')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'benchmark'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 text-rose-400" />
            <span>🧪 ベンチマーク & 退行テスト ({benchmarkReports.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('skills')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'skills'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4 text-sky-400" />
            <span>スキルライブラリ ({skills.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tools')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'tools'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>🛠️ ツール管理 (:feature:tools)</span>
          </button>

          <button
            onClick={() => setActiveTab('lab')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'lab'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span>実験室 (A/B & 検索評価)</span>
          </button>

          <button
            onClick={() => setActiveTab('colab')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'colab'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>Colab連携 & LoRA教材</span>
          </button>

          <button
            onClick={() => setActiveTab('generations')}
            className={`py-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'generations'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4 text-pink-400" />
            <span>モデル世代 & 系統樹</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* TAB 1: 失敗診断 & 改善ルーター (第3世代) */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span>多層診断エンジン & 改善ルーター (設計思想 9 & 14)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px] border border-purple-500/30">
                    Live Diagnostics
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  「小型モデルが失敗したとき、何が原因で、どこを修正すべきか」を自動分類します。
                  すべてをモデル再学習に押し付けるのではなく、<strong>記憶、検索、プロンプト、スキル、ツール、モデル学習</strong>の最適な階層へ改善タスクをルーティングします。
                </p>
              </div>

              {diagnosedIssue && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>診断結果: {diagnosedIssue.category}</span>
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase ${
                      diagnosedIssue.suggestedFixArea === 'no_change'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      改善推奨先: {diagnosedIssue.suggestedFixArea}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 space-y-1">
                    <span className="text-slate-400 font-medium text-[10px]">根本原因 (Root Cause):</span>
                    <p className="text-slate-200 leading-relaxed text-[11px]">{diagnosedIssue.rootCause}</p>
                  </div>

                  <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-800/40 space-y-1">
                    <span className="text-purple-300 font-bold text-[10px]">アクション提案 (Recommendation):</span>
                    <p className="text-purple-200 leading-relaxed text-[11px]">{diagnosedIssue.recommendation}</p>
                  </div>
                </div>
              )}

              {/* 蓄積された診断記録: どの改善対象が繰り返し問題になっているか */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs">
                    蓄積された診断記録 (累計 {diagnosisRecords.length}件)
                  </span>
                  {diagnosisRecords.length > 0 && (
                    <button
                      onClick={() => {
                        selfImprovementService.clearRecords();
                        setDiagnosisRecords([]);
                        setDiagnosisCountsByArea({});
                      }}
                      className="text-[10px] text-slate-500 hover:text-rose-400 underline"
                    >
                      記録をクリア
                    </button>
                  )}
                </div>

                {diagnosisRecords.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">
                    まだ記録がありません。チャットで👎フィードバックを送ると、ここに診断が蓄積されます。
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(diagnosisCountsByArea).map(([area, count]) => (
                        <span
                          key={area}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-mono"
                        >
                          {area}: {count}件
                        </span>
                      ))}
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {diagnosisRecords.slice(0, 20).map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/70 border border-slate-800/70 text-[10px]"
                        >
                          <span className="text-slate-400 font-mono whitespace-nowrap">
                            {new Date(rec.timestamp).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-slate-300 truncate flex-1">{rec.hypothesis}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 shrink-0">
                            {rec.targetArea}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 改善ルーター階層マップ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-sky-300 flex items-center gap-1 text-[11px]">
                    <Search className="w-3.5 h-3.5" />
                    <span>1. 検索・RAG層</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    記憶不足やコンテキスト溢れ。バイグラム検索、承認フィルター、スコア調整で解決。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1 text-[11px]">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>2. スキル・ツール層</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    コード構文エラーやCanvasループ崩壊。再利用可能な手順（スキル）を注入して解決。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-pink-300 flex items-center gap-1 text-[11px]">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>3. モデルLoRA層</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    表現力・口調崩れ・複雑タスク。高品質JSONLをColabへ送り、LoRA学習で重み更新。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: 🧠 世界モデル & 予測誤差 (設計思想 17. 世界モデルと予測誤差) */}
          {activeTab === 'world_model' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-indigo-400" />
                    <span>世界モデル & 予測誤差エンジン (World Model & Prediction Error)</span>
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    設計思想 17: AIが行動する前に結果を予測し、実際の応答や利用記憶との「差分（誤差）」を自己学習シグナルに変換
                  </p>
                </div>
                <button
                  onClick={() => {
                    worldModelService.clearRecords();
                    setWorldModelErrors([]);
                    setWorldModelStats(worldModelService.getStats());
                  }}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 rounded-lg text-xs flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ログ消去</span>
                </button>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-indigo-900/40 space-y-1">
                  <div className="text-[10px] text-slate-400">行動予測ログ総数</div>
                  <div className="text-base font-bold text-indigo-300 font-mono">
                    {worldModelStats?.totalPredictions || 0} 件
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-indigo-900/40 space-y-1">
                  <div className="text-[10px] text-slate-400">平均予測乖離度 (Surprisal)</div>
                  <div className="text-base font-bold text-slate-200 font-mono">
                    {worldModelStats?.avgErrorMagnitude || 0} / 1.0
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-indigo-900/40 space-y-1">
                  <div className="text-[10px] text-slate-400">記憶利用不一致率</div>
                  <div className="text-base font-bold text-sky-300 font-mono">
                    {worldModelStats?.memoryMismatchRate || 0}%
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-indigo-900/40 space-y-1">
                  <div className="text-[10px] text-slate-400">口調・制約違反率</div>
                  <div className="text-base font-bold text-amber-300 font-mono">
                    {worldModelStats?.toneDriftRate || 0}%
                  </div>
                </div>
              </div>

              {/* Mechanism Explanation Box */}
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/50 space-y-2">
                <div className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>設計思想 17 が定義する学習メカニズム</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  ユーザーが質問した瞬間、世界モデルは<strong>「意図・必要な記憶数・期待トーン・リスク」</strong>を事前予測します。応答生成後、実際に使われた記憶やトーンの崩れ、ユーザーの訂正を比較して<strong>「予測誤差（差分）」</strong>を算出。<br />
                  <span className="text-indigo-300 font-semibold">「記憶追加で改善すると予測したが実際には使われなかった ➔ 記憶不足ではなくプロンプト注入方針の問題」</span>のように、失敗の真因を自動特定して次回プロンプトやLoRA教材へフィードバックします。
                </p>
              </div>

              {/* Prediction Error Records List */}
              <div className="space-y-3">
                <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>最近の行動前予測 & 事後検証ログ (最新 {worldModelErrors.length} 件)</span>
                </div>

                {worldModelErrors.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center space-y-2">
                    <p className="text-slate-400 text-xs">まだ会話の予測ログがありません。</p>
                    <p className="text-slate-500 text-[11px]">
                      チャットでメッセージを送信すると、世界モデルが自動的に事前予測と事後誤差評価を記録します。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...worldModelErrors].reverse().map((record) => {
                      const errorMag = record.predictionError.errorMagnitude;
                      const isHighError = errorMag >= 0.4;

                      return (
                        <div
                          key={record.id}
                          className={`p-4 rounded-xl border space-y-3 transition-colors ${
                            isHighError
                              ? 'bg-slate-950/90 border-amber-800/60'
                              : 'bg-slate-950/70 border-slate-800'
                          }`}
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isHighError
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                }`}
                              >
                                乖離度: {errorMag.toFixed(2)}
                              </span>
                              <span className="text-slate-300 font-bold text-xs truncate max-w-[200px] sm:max-w-md">
                                「{record.prediction.userPrompt}」
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(record.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Prediction vs Actual Outcome Comparison Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Prediction Side */}
                            <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-900/30 space-y-1">
                              <div className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                                <Compass className="w-3 h-3" />
                                <span>事前予測 (Prediction)</span>
                              </div>
                              <div className="text-slate-300 text-[11px] space-y-0.5">
                                <div>想定意図: <strong className="text-slate-100">{record.prediction.expectedIntent}</strong></div>
                                <div>期待トーン: <strong className="text-slate-100">{record.prediction.expectedTone}</strong></div>
                                <div>予測記憶数: <strong className="text-slate-100">{record.prediction.expectedMemoryUsage.predictedMemoryCount}件</strong></div>
                                <div>潜在リスク: <span className="text-amber-300 font-mono text-[10px]">{record.prediction.predictedRisk}</span></div>
                              </div>
                            </div>

                            {/* Actual Outcome Side */}
                            <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 space-y-1">
                              <div className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>実際の結果 (Actual Outcome)</span>
                              </div>
                              <div className="text-slate-300 text-[11px] space-y-0.5">
                                <div>実利用記憶数: <strong className="text-slate-100">{record.actualOutcome.actualUsedMemoriesCount}件</strong> ({record.predictionError.memorySurprisal})</div>
                                <div>トーン判定: <strong className={record.actualOutcome.hasToneViolation ? 'text-rose-400' : 'text-emerald-300'}>
                                  {record.actualOutcome.hasToneViolation ? 'ロボット敬語混入 (逸脱)' : '自然なタメ口 (適合)'}
                                </strong></div>
                                <div>コード生成: {record.actualOutcome.hasCodeBlock ? 'あり' : 'なし'}</div>
                                <div>推論所要: {record.actualOutcome.elapsedMs}ms</div>
                              </div>
                            </div>
                          </div>

                          {/* Diagnosis & Suggested Action */}
                          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                            <div className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>誤差診断 & 自動改善提案 (Diagnosis & Next Action)</span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed">
                              {record.predictionError.diagnosisNote}
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[10px] text-slate-400">推奨アクション:</span>
                              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] border border-indigo-800">
                                {record.predictionError.suggestedImprovement}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: ⚡ Android WorkManager & 自律バックグラウンド処理 (設計思想 11 & 23, 浅い睡眠 / 深い睡眠ゲート) */}
          {activeTab === 'workmanager' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <BatteryCharging className="w-4 h-4 text-amber-400" />
                    <span>Android WorkManager 自律バックグラウンド処理</span>
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    設計思想: 「浅い睡眠 / 深い睡眠」2段階ゲート制御。充電中・低温・バッテリー残量30%超・無操作時のみ重い推論（A/Bテスト・シャドー評価）を実行
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={isWmRunning}
                    onClick={async () => {
                      setIsWmRunning(true);
                      setWmMessage('⚡ バックグラウンド自律処理を実行中 (睡眠ゲート判定)...');
                      try {
                        const log = await backgroundWorkerService.runAutonomousBackgroundCycle('periodic_scheduled', {
                          memories,
                          messages: chatMessages,
                        });
                        setWmLogs(backgroundWorkerService.getLogs());
                        setWmStatus(backgroundWorkerService.getStatus());
                        setTrainingSamples(selfImprovementService.getTrainingSamples());
                        setSkills(skillsService.getAllSkills());
                        setWmMessage(`✓ 自律処理完了: ${log.summary}`);
                        setTimeout(() => setWmMessage(null), 5000);
                      } catch (err: any) {
                        setWmMessage(`⚠️ 実行保留/中断: ${err?.message || '不明'}`);
                      } finally {
                        setIsWmRunning(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isWmRunning ? '実行中...' : '自律サイクル実行 (ゲート判定検証)'}</span>
                  </button>

                  <button
                    disabled={isWmRunning}
                    onClick={async () => {
                      setIsWmRunning(true);
                      setWmMessage('⚡ 手動強制実行中 (条件無視フルサイクル)...');
                      try {
                        const log = await backgroundWorkerService.runAutonomousBackgroundCycle('manual', {
                          memories,
                          messages: chatMessages,
                        });
                        setWmLogs(backgroundWorkerService.getLogs());
                        setWmStatus(backgroundWorkerService.getStatus());
                        setTrainingSamples(selfImprovementService.getTrainingSamples());
                        setSkills(skillsService.getAllSkills());
                        setWmMessage(`✓ 手動フルサイクル完了 (${log.durationMs}ms)`);
                        setTimeout(() => setWmMessage(null), 5000);
                      } catch (err: any) {
                        setWmMessage(`❌ 実行エラー: ${err?.message || '不明'}`);
                      } finally {
                        setIsWmRunning(false);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium rounded-lg text-xs flex items-center gap-1 border border-slate-700 transition-all"
                    title="開発・テスト用に条件を無視して深い睡眠を含め即時実行します"
                  >
                    <span>強制即時実行</span>
                  </button>
                </div>
              </div>

              {wmMessage && (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-200 text-xs font-semibold animate-fadeIn flex items-center justify-between">
                  <span>{wmMessage}</span>
                  <button onClick={() => setWmMessage(null)} className="text-amber-400 hover:text-amber-200 text-[11px] ml-2">閉じる</button>
                </div>
              )}

              {/* 睡眠モード可視化バナー (浅い睡眠中 / 深い睡眠中 / 待機中) */}
              {(() => {
                const conditions = wmStatus?.currentConditions || backgroundWorkerService.getExecutionConditions();
                const isShallowPossible = canRunShallowSleep(conditions);
                const isDeepPossible = canRunDeepSleep(conditions);
                const currentSleep = wmStatus?.currentSleepState || 'idle';
                const unmetDeep = wmStatus?.unmetReasons?.deep || getDeepSleepUnmetReasons(conditions);

                return (
                  <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-slate-300">現在のバックグラウンド状態:</div>
                        {currentSleep === 'deep' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 animate-pulse">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>🌌 深い睡眠中 (Deep Sleep Active: A/Bテスト・シャドー評価)</span>
                          </span>
                        ) : currentSleep === 'shallow' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                            <Moon className="w-3.5 h-3.5" />
                            <span>🌙 浅い睡眠中 (Shallow Sleep Active: 記憶整理・重複検出)</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>⏸️ 待機中 ({isDeepPossible ? '深い睡眠スタンバイ' : isShallowPossible ? '浅い睡眠スタンバイ' : '条件未達・待機'})</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            backgroundWorkerService.toggleRegistered(!(wmStatus?.isRegistered ?? true));
                            setWmStatus(backgroundWorkerService.getStatus());
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            wmStatus?.isRegistered
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200'
                          }`}
                        >
                          {wmStatus?.isRegistered ? 'WorkManager 一時停止' : 'WorkManager 再開'}
                        </button>
                      </div>
                    </div>

                    {/* 2段階ゲート判定状況 (Shallow Sleep vs Deep Sleep) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Shallow Sleep Gate Card */}
                      <div className={`p-3 rounded-lg border ${isShallowPossible ? 'bg-amber-950/20 border-amber-800/40' : 'bg-slate-900/40 border-slate-800'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold flex items-center gap-1 text-slate-200">
                            <Moon className="w-3.5 h-3.5 text-amber-400" />
                            <span>1. 浅い睡眠 (Shallow Sleep Gate)</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isShallowPossible ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                            {isShallowPossible ? '✓ 実行可能' : '✕ 不可'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <div>・対象: 記憶の統合、グラフリンク構築、LoRAサンプルの重複除去、スキル抽出</div>
                          <div>・条件: ユーザー非操作 かつ 温度が危険域(critical)でないこと</div>
                        </div>
                      </div>

                      {/* Deep Sleep Gate Card */}
                      <div className={`p-3 rounded-lg border ${isDeepPossible ? 'bg-indigo-950/20 border-indigo-800/40' : 'bg-slate-900/40 border-slate-800'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold flex items-center gap-1 text-slate-200">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>2. 深い睡眠 (Deep Sleep Gate)</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDeepPossible ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                            {isDeepPossible ? '✓ 実行可能' : '✕ 未達・保留'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <div>・対象: 弱点自己対話シミュレーション、プロンプトA/Bテスト、回帰ベンチマーク評価</div>
                          <div>・条件: <strong>充電中</strong> かつ <strong>バッテリー &gt; 30%</strong> かつ <strong>無操作</strong> かつ <strong>低温(normal/warm)</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* 条件未達の理由 (未達の場合のみ表示) */}
                    {unmetDeep.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-900/40 text-xs space-y-1">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>深い睡眠が保留される理由 (外出中・低バッテリー・発熱・会話中の負荷防止):</span>
                        </div>
                        <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5 pl-1">
                          {unmetDeep.map((reason, idx) => (
                            <li key={idx} className="text-amber-200/90 font-medium">
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Hardware Status & Interactive Test Simulator */}
              {(() => {
                const conditions = wmStatus?.currentConditions || backgroundWorkerService.getExecutionConditions();

                return (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-amber-400" />
                        <span>実機環境モニタリング &amp; ゲートテストシミュレーター</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        ※ボタンを押して条件を変更し、受け入れ基準の動作（電池20%で重処理停止など）をテストできます
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      {/* 1. バッテリー & 充電 */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                            <span>バッテリー & 充電</span>
                          </span>
                          <span className={`font-mono font-bold text-xs ${conditions.isCharging ? 'text-emerald-400' : 'text-slate-300'}`}>
                            {conditions.isCharging ? '⚡充電中' : '放電中'} ({Math.round(conditions.batteryLevel * 100)}%)
                          </span>
                        </div>

                        {/* モック切替ボタン */}
                        <div className="space-y-1.5 pt-1">
                          <button
                            onClick={() => {
                              backgroundWorkerService.setMockBattery(!conditions.isCharging, conditions.batteryLevel);
                              setWmStatus(backgroundWorkerService.getStatus());
                            }}
                            className={`w-full py-1 px-2 rounded text-[11px] font-bold border transition-all ${
                              conditions.isCharging
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {conditions.isCharging ? '⚡ 充電中 ➔ 放電へ切替' : '🔌 充電器に接続する'}
                          </button>

                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                backgroundWorkerService.setMockBattery(conditions.isCharging, 0.2);
                                setWmStatus(backgroundWorkerService.getStatus());
                              }}
                              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                                Math.round(conditions.batteryLevel * 100) <= 20
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              20% (低残量)
                            </button>
                            <button
                              onClick={() => {
                                backgroundWorkerService.setMockBattery(conditions.isCharging, 0.5);
                                setWmStatus(backgroundWorkerService.getStatus());
                              }}
                              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                                Math.round(conditions.batteryLevel * 100) === 50
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              50%
                            </button>
                            <button
                              onClick={() => {
                                backgroundWorkerService.setMockBattery(conditions.isCharging, 1.0);
                                setWmStatus(backgroundWorkerService.getStatus());
                              }}
                              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                                Math.round(conditions.batteryLevel * 100) >= 90
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              100%
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 2. サーマルステート (端末発熱) */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-rose-400" />
                            <span>端末発熱 (Thermal)</span>
                          </span>
                          <span className={`font-bold text-xs ${
                            conditions.thermalState === 'normal'
                              ? 'text-emerald-400'
                              : conditions.thermalState === 'warm'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}>
                            {conditions.thermalState.toUpperCase()}
                          </span>
                        </div>

                        {/* サーマル切替ボタン */}
                        <div className="grid grid-cols-2 gap-1 pt-1">
                          <button
                            onClick={() => {
                              backgroundWorkerService.setThermalState('normal');
                              setWmStatus(backgroundWorkerService.getStatus());
                            }}
                            className={`py-1 rounded text-[10px] font-bold border transition-all ${
                              conditions.thermalState === 'normal'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            normal (正常)
                          </button>
                          <button
                            onClick={() => {
                              backgroundWorkerService.setThermalState('warm');
                              setWmStatus(backgroundWorkerService.getStatus());
                            }}
                            className={`py-1 rounded text-[10px] font-bold border transition-all ${
                              conditions.thermalState === 'warm'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            warm (微熱)
                          </button>
                          <button
                            onClick={() => {
                              backgroundWorkerService.setThermalState('hot');
                              setWmStatus(backgroundWorkerService.getStatus());
                            }}
                            className={`py-1 rounded text-[10px] font-bold border transition-all ${
                              conditions.thermalState === 'hot'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            hot (高温)
                          </button>
                          <button
                            onClick={() => {
                              backgroundWorkerService.setThermalState('critical');
                              setWmStatus(backgroundWorkerService.getStatus());
                            }}
                            className={`py-1 rounded text-[10px] font-bold border transition-all ${
                              conditions.thermalState === 'critical'
                                ? 'bg-rose-600/30 text-rose-200 border-rose-500'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            critical (危険)
                          </button>
                        </div>
                      </div>

                      {/* 3. ユーザーアクティビティ (会話割り込み防止) */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>ユーザー操作判定</span>
                          </span>
                          <span className={`font-bold text-xs ${conditions.isUserActive ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {conditions.isUserActive ? '操作中 / クールダウン' : '✓ アイドル (無操作)'}
                          </span>
                        </div>

                        <div className="pt-1 space-y-1">
                          <button
                            onClick={() => {
                              backgroundWorkerService.recordUserActivity();
                              setWmStatus(backgroundWorkerService.getStatus());
                              setWmMessage('💬 チャット操作をシミュレートしました (2分間のユーザーアクティブ待機モード)');
                              setTimeout(() => setWmMessage(null), 3000);
                            }}
                            className="w-full py-1.5 px-2 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-all"
                          >
                            💬 チャット操作発生をシミュレート
                          </button>
                          <div className="text-[9px] text-slate-500 text-center">
                            操作中は深い睡眠を即時中断して応答速度を最優先
                          </div>
                        </div>
                      </div>

                      {/* 4. ネットワーク環境 */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="text-[10px] text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Wifi className="w-3.5 h-3.5 text-sky-400" />
                            <span>ネットワーク環境</span>
                          </span>
                          <span className={`font-bold text-xs ${wmStatus?.currentNetworkState.isWifi ? 'text-sky-300' : 'text-amber-400'}`}>
                            {wmStatus?.currentNetworkState.isWifi ? '✓ Wi-Fi (定額)' : 'モバイル従量制'}
                          </span>
                        </div>

                        <div className="pt-1">
                          <button
                            onClick={() => {
                              backgroundWorkerService.setMockWifi(!wmStatus?.currentNetworkState.isWifi);
                              setWmStatus(backgroundWorkerService.getStatus());
                            }}
                            className="w-full py-1.5 px-2 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-all"
                          >
                            {wmStatus?.currentNetworkState.isWifi ? 'モバイル回線へ切替' : 'Wi-Fiへ切替'}
                          </button>
                          <div className="text-[9px] text-slate-500 text-center mt-1">
                            定期実行間隔: {wmStatus?.intervalMinutes || 360}分 (6時間)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* WorkManager Constraints Config */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>WorkManager 実行制約ポリシー設定 (Constraints)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    定期実行間隔: {wmStatus?.intervalMinutes || 360}分 (6時間)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                  <label className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={wmStatus?.constraints.requiresCharging ?? true}
                      onChange={(e) => {
                        backgroundWorkerService.updateConstraints({ requiresCharging: e.target.checked });
                        setWmStatus(backgroundWorkerService.getStatus());
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-200 text-[11px]">充電中のみ実行 (Charging)</div>
                      <div className="text-[10px] text-slate-400">バッテリー消耗を完全に防止</div>
                    </div>
                  </label>

                  <label className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={wmStatus?.constraints.requiresUnmeteredWifi ?? true}
                      onChange={(e) => {
                        backgroundWorkerService.updateConstraints({ requiresUnmeteredWifi: e.target.checked });
                        setWmStatus(backgroundWorkerService.getStatus());
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-200 text-[11px]">Wi-Fi接続時のみ (Unmetered)</div>
                      <div className="text-[10px] text-slate-400">モバイル回線通信量を保護</div>
                    </div>
                  </label>

                  <label className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={wmStatus?.constraints.requiresDeviceIdle ?? true}
                      onChange={(e) => {
                        backgroundWorkerService.updateConstraints({ requiresDeviceIdle: e.target.checked });
                        setWmStatus(backgroundWorkerService.getStatus());
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-200 text-[11px]">無操作アイドル時 (Idle)</div>
                      <div className="text-[10px] text-slate-400">ユーザーの操作レスポンスを最優先</div>
                    </div>
                  </label>

                  <label className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={wmStatus?.constraints.batteryNotLow ?? true}
                      onChange={(e) => {
                        backgroundWorkerService.updateConstraints({ batteryNotLow: e.target.checked });
                        setWmStatus(backgroundWorkerService.getStatus());
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-200 text-[11px]">バッテリー20%以上 (Not Low)</div>
                      <div className="text-[10px] text-slate-400">低バッテリー時の起動を防止</div>
                    </div>
                  </label>

                  <label className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-2 cursor-pointer hover:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={wmStatus?.constraints.nightTimeOnly ?? false}
                      onChange={(e) => {
                        backgroundWorkerService.updateConstraints({ nightTimeOnly: e.target.checked });
                        setWmStatus(backgroundWorkerService.getStatus());
                      }}
                      className="rounded bg-slate-950 border-slate-700 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-semibold text-slate-200 text-[11px]">深夜帯限定 (02:00〜05:00)</div>
                      <div className="text-[10px] text-slate-400">就寝時の完全自動メンテナンス</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Kotlin WorkManager Code Box */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>Android ネイティブ WorkManager 実装コード (Section 23 準拠)</span>
                  </div>
                  <button
                    onClick={() => handleCopy(backgroundWorkerService.generateAndroidWorkManagerCode(), 'wm_kotlin')}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-900/50 rounded text-[11px] flex items-center gap-1"
                  >
                    {copiedText === 'wm_kotlin' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>Kotlin コードコピー</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 rounded-lg text-slate-300 font-mono text-[10px] max-h-48 overflow-y-auto border border-slate-900">
                  {backgroundWorkerService.generateAndroidWorkManagerCode()}
                </pre>
              </div>

              {/* Execution Logs List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span>自律バックグラウンドタスク実行履歴 ({wmLogs.length}件)</span>
                  </div>
                  {wmLogs.length > 0 && (
                    <button
                      onClick={() => {
                        backgroundWorkerService.clearLogs();
                        setWmLogs([]);
                      }}
                      className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      履歴クリア
                    </button>
                  )}
                </div>

                {wmLogs.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-slate-500 text-xs">
                    まだバックグラウンド実行ログがありません。「自律サイクル即時実行」ボタンで手動テストが可能です。
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {wmLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold font-mono">
                              ✓ 完了 ({log.durationMs}ms)
                            </span>
                            <span className="font-bold text-slate-200 text-[11px]">{log.summary}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {log.details.weaknessFound && log.details.weaknessFound.length > 0 && (
                          <div className="p-2 rounded bg-slate-900/60 border border-slate-800/60 space-y-1 text-[11px] text-slate-300">
                            <div className="text-[10px] text-amber-300 font-semibold">自己対話テスト検証結果:</div>
                            {log.details.weaknessFound.map((w, wIdx) => (
                              <div key={wIdx} className="text-[10px] text-slate-400 flex items-center gap-1">
                                <span>•</span>
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono">
                          {log.details.cleanedDuplicatesCount !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-900/50">
                              🧹 教材クリーン: -{log.details.cleanedDuplicatesCount}重複, -{log.details.prunedLowQualityCount ?? 0}低品質 (有効{log.details.cleanedDatasetSamplesCount ?? 0}件)
                            </span>
                          )}
                          {log.details.skillsExtractedCount !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-900/50">
                              🛠️ スキル抽出: +{log.details.skillsExtractedCount}件 (昇格{log.details.skillsPromotedCount ?? 0}件)
                            </span>
                          )}
                          {log.details.regressionBenchmarkScore !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-900/50">
                              🧪 回帰評価: {log.details.regressionBenchmarkScore}点
                            </span>
                          )}
                          {log.details.trainingThresholdReached !== undefined && (
                            <span className={`px-2 py-0.5 rounded border ${
                              log.details.trainingThresholdReached
                                ? 'bg-purple-950 text-purple-300 border-purple-700 font-bold'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}>
                              🎯 蓄積: {log.details.trainingCurrentCount ?? '?'}/{log.details.trainingTargetThreshold ?? 50}件 ({log.details.trainingThresholdReached ? '閾値達成! LoRA推奨' : '学習待機'})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB: ベンチマーク & 退行テスト (設計思想 9)                     */}
          {/* ============================================================ */}
          {activeTab === 'benchmark' && (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border border-rose-900/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-400" />
                      <span>包括的ベンチマーク & 退行テストスイート (Regression Suite)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30">
                        設計思想 9 準拠
                      </span>
                    </h3>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      脱ロボット口調・Excel VBA・JS Canvas・敬語トラップ等の定型テストを一括実行し、新バージョンによる能力退行（Regression）を自動検出します。
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const activeInfo = regressionBenchmarkService.getActiveLoadedModelInfo();
                      return (
                        <div className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-slate-400">現在ロード中モデル:</span>
                          {activeInfo.isReady ? (
                            <span className="font-mono font-bold text-emerald-400">
                              {activeInfo.modelName} ({activeInfo.engineType === 'native_gguf' ? 'Native GGUF' : 'WebLLM'})
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold">
                              ⚠️ 未ロード (端末ローカルLLM設定でロード必要)
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleRunBenchmark}
                      disabled={isBenchmarkRunning}
                      className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/50 transition-all shrink-0"
                    >
                      {isBenchmarkRunning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>テスト実行中...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>スイート一括実行</span>
                        </>
                      )}
                    </button>

                    {benchmarkReports.length > 0 && (
                      <button
                        onClick={handleClearBenchmarkReports}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs"
                        title="レポート履歴クリア"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {benchmarkError && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{benchmarkError}</span>
                </div>
              )}

              {/* Latest Run Overview */}
              {selectedReport ? (
                <div className="space-y-4">
                  {/* Summary Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400">総合スコア</div>
                      <div className="text-xl font-bold text-rose-400 font-mono">
                        {selectedReport.overallScore} <span className="text-xs text-slate-500">/ 100</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400">テスト合格率</div>
                      <div className="text-xl font-bold text-emerald-400 font-mono">
                        {selectedReport.passedTests} <span className="text-xs text-slate-500">/ {selectedReport.totalTests} 合格</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400">退行 (Regressions)</div>
                      <div className="text-xl font-bold font-mono">
                        {selectedReport.regressionsCount === 0 ? (
                          <span className="text-emerald-400">0 件 (正常)</span>
                        ) : (
                          <span className="text-rose-400">{selectedReport.regressionsCount} 件検知</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="text-[10px] text-slate-400">平均レイテンシ</div>
                      <div className="text-xl font-bold text-sky-400 font-mono">
                        {selectedReport.averageLatencyMs} <span className="text-xs text-slate-500">ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-slate-200">カテゴリ別スコア内訳</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {Object.entries(selectedReport.categoryScores).map(([cat, sc]) => (
                        <div key={cat} className="p-2 rounded bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                          <span className="text-slate-400 text-[11px] font-mono capitalize">{cat.replace('_', ' ')}</span>
                          <span className={`font-mono font-bold ${sc >= 85 ? 'text-emerald-400' : sc >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {sc}点
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Test Cases Results List */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-rose-400" />
                      <span>個別テストケース検証結果 ({selectedReport.results.length}件)</span>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {selectedReport.results.map((res) => (
                        <div
                          key={res.testId}
                          className={`p-3 rounded-xl border text-xs space-y-2 transition-colors ${
                            res.isRegression
                              ? 'bg-rose-950/30 border-rose-800/60'
                              : res.passed
                              ? 'bg-slate-950/80 border-slate-800'
                              : 'bg-amber-950/20 border-amber-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  res.passed
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                                }`}
                              >
                                {res.passed ? 'PASSED' : 'FAILED'}
                              </span>
                              <span className="font-bold text-slate-200 text-[11px] font-mono">{res.testId}</span>
                              {res.isRegression && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/30">
                                  ⚠️ 退行 (Regression)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-slate-400 text-[10px] font-mono">
                              <span>スコア: <strong className="text-slate-100">{res.score}点</strong></span>
                              <span>差分: <strong className={res.scoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {res.scoreDelta >= 0 ? `+${res.scoreDelta}` : res.scoreDelta}
                              </strong></span>
                              <span>{res.latencyMs}ms</span>
                            </div>
                          </div>

                          {/* Response snippet */}
                          <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {res.generatedResponse}
                          </div>

                          <div className="flex flex-wrap gap-2 text-[10px]">
                            <span className="text-emerald-400">一致キーワード: {res.matchedKeywords.join(', ') || 'なし'}</span>
                            {res.foundForbiddenKeywords.length > 0 && (
                              <span className="text-rose-400 font-bold">禁止語混入: {res.foundForbiddenKeywords.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center space-y-3">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-slate-400 text-xs">まだベンチマーク実行レポートがありません。</p>
                  <button
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarkRunning}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                  >
                    テストスイートを一括実行する
                  </button>
                </div>
              )}
            </div>
          )}
          {activeTab === 'skills' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-sky-400" />
                    <span>スキルライブラリ (手続き記憶 / Procedural Memory)</span>
                  </h3>
                  <p className="text-slate-400 text-[11px]">
                    成功した手順を再利用可能なスキルとして登録し、モデルの推論時に動的インジェクト
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoExtractSkills}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-800/60 rounded-lg text-xs flex items-center gap-1.5 font-semibold transition-all"
                    title="会話ログを走査し成功した実装パターン（正規表現・UIレイアウト・データ保存など）からスキル候補を自動生成します"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                    <span>会話ログから自動抽出</span>
                  </button>
                  <button
                    onClick={() => setShowAddSkill(!showAddSkill)}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddSkill ? '閉じる' : '新規スキル登録'}</span>
                  </button>
                </div>
              </div>

              {skillsMessage && (
                <div className="p-3 rounded-lg bg-sky-950/50 border border-sky-800 text-sky-200 text-xs animate-in fade-in">
                  {skillsMessage}
                </div>
              )}

              {/* Add Skill Form */}
              {showAddSkill && (
                <form onSubmit={handleCreateSkill} className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 space-y-3 animate-in fade-in duration-150">
                  <div className="font-bold text-sky-300 text-xs">新規再利用可能スキルの追加</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">スキル名称</label>
                      <input
                        type="text"
                        placeholder="例: VBAマクロ ➔ TypeScript変換"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">カテゴリ</label>
                      <select
                        value={newSkillCategory}
                        onChange={(e: any) => setNewSkillCategory(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      >
                        <option value="coding">coding (コード実装)</option>
                        <option value="debug">debug (不具合修復)</option>
                        <option value="vba">vba (Excel/VBA移植)</option>
                        <option value="planning">planning (要件分解)</option>
                        <option value="summarize">summarize (要約)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 text-[10px]">発動トリガーキーワード (カンマ区切り)</label>
                    <input
                      type="text"
                      placeholder="例: vba, macro, excel, ワークシート"
                      value={newSkillTrigger}
                      onChange={(e) => setNewSkillTrigger(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 text-[10px]">実行手順ステップ (1行に1ステップ)</label>
                    <textarea
                      rows={3}
                      placeholder="1. 変数定義とスコープを解析&#10;2. ループ構造を抽出&#10;3. TypeScript関数として実装"
                      value={newSkillSteps}
                      onChange={(e) => setNewSkillSteps(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-xs font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddSkill(false)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs"
                    >
                      スキルを保存・登録
                    </button>
                  </div>
                </form>
              )}

              {/* Skills List */}
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {skills.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800">
                          {s.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            s.status === 'official'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : s.status === 'tested'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : s.status === 'disabled'
                              ? 'bg-slate-900 text-slate-500 border-slate-700'
                              : 'bg-slate-800 text-slate-300 border-slate-600'
                          }`}
                          title="候補(candidate) → 試験済み(tested) → 正式(official) は実行結果の蓄積に応じて自動昇格します"
                        >
                          {s.status === 'official' ? '正式' : s.status === 'tested' ? '試験済み' : s.status === 'disabled' ? '無効' : '候補'}
                        </span>
                        <span className="font-bold text-slate-100 text-xs">{s.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">v{s.version}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-400 font-mono">
                          成功: {s.successCount}回
                        </span>
                        {s.failureCount > 0 && (
                          <span className="text-[10px] text-rose-400 font-mono">
                            失敗: {s.failureCount}回
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteSkill(s.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-300 text-[11px]">{s.description}</p>
                    <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/80 text-[10px] text-slate-400 space-y-1">
                      <div className="font-mono text-sky-400">適用トリガー: {s.triggerCondition}</div>
                      <div className="text-slate-300">
                        {s.steps.map((st, idx) => (
                          <div key={idx}>・{st}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: ツール管理モジュール (:feature:tools / 設計思想 14 & 22章) */}
          {activeTab === 'tools' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-indigo-300 text-xs flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <span>APK内モジュール構成: :feature:tools (設計思想 14 & 22章)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                    登録ツール: {toolsList.length}基
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  端末オンデバイスAIが推論時に呼び出すツール群です。計算ツールは脆弱な<code className="text-rose-400 font-mono">eval</code>や<code className="text-rose-400 font-mono">new Function()</code>を一切使用せず、構文木（AST）に基づく再帰下降パーサーで安全に計算されます。また破壊的操作（ファイル書き換え等）はユーザーの明示的な承認ゲートを通過します。
                </p>
              </div>

              {/* ツールカタログ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {toolsList.map((tool) => (
                  <div
                    key={tool.id}
                    onClick={() => {
                      setSelectedToolId(tool.id);
                      if (tool.id === 'tool_safe_calculator') setToolTestInput('1250 * 1.1 + 500');
                      else if (tool.id === 'tool_code_syntax_audit') setToolTestInput('function test() { console.log("OK"); }');
                      else if (tool.id === 'tool_workspace_search') setToolTestInput('canvas');
                      else setToolTestInput('Hello from toolsService test');
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      selectedToolId === tool.id
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{tool.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border ${
                          tool.permission === 'workspace_write'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                            : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        }`}>
                          {tool.permission}
                        </span>
                        {tool.requiresConfirmation && (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800">
                            要承認
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{tool.description}</p>
                    <div className="font-mono text-[9.5px] text-slate-500 bg-black/40 p-1.5 rounded border border-slate-800/80 flex items-center justify-between">
                      <span>ID: {tool.id}</span>
                      <span>安全度: {tool.permission === 'read_only' ? '高 (Read-Only)' : '要確認 (Write)'}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 対話的ツールテスト実行環境 */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <Play className="w-4 h-4 text-indigo-400" />
                    <span>ツール対話テスト実行環境</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    選択中: <strong className="text-indigo-300">{toolsList.find(t => t.id === selectedToolId)?.name}</strong>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-300 block font-medium">
                    {selectedToolId === 'tool_safe_calculator' && 'テスト数式 (例: 1250 * 1.1 + 500, sqrt(144) + sin(0.5)): '}
                    {selectedToolId === 'tool_code_syntax_audit' && 'テスト対象コード (構文検証): '}
                    {selectedToolId === 'tool_workspace_search' && 'ワークスペース内検索キーワード: '}
                    {selectedToolId === 'tool_workspace_write' && 'テスト書き込み内容: '}
                  </label>
                  <textarea
                    value={toolTestInput}
                    onChange={(e) => setToolTestInput(e.target.value)}
                    rows={selectedToolId === 'tool_code_syntax_audit' ? 4 : 2}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="入力パラメータ..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExecuteInteractiveTool}
                    disabled={isToolExecuting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isToolExecuting ? 'ツール実行中...' : 'ツールを実行テスト'}</span>
                  </button>
                </div>

                {toolExecutionResult && (
                  <div className={`p-3 rounded-xl border space-y-2 text-xs font-mono animate-fadeIn ${
                    toolExecutionResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {toolExecutionResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>{toolExecutionResult.toolName} - {toolExecutionResult.success ? '実行成功' : '実行失敗'}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans">
                        所要時間: {toolExecutionResult.executionTimeMs}ms
                      </span>
                    </div>
                    <div className="text-[11px] font-sans text-slate-200 bg-black/40 p-2 rounded-lg border border-slate-800">
                      {toolExecutionResult.outputSummary}
                    </div>
                    {toolExecutionResult.result && (
                      <pre className="text-[10px] p-2 bg-black/60 rounded border border-slate-800 overflow-x-auto text-slate-300">
                        {JSON.stringify(toolExecutionResult.result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: 実験室 & ベンチマーク (第3世代) */}
          {activeTab === 'lab' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-300 text-xs flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <span>プロンプト構成規則の静的シミュレーション (設計思想 16)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    実推論 + 応答ルール採点
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  現在ロード中のモデルへ候補A・候補Bそれぞれのシステムプロンプトで実際に推論を実行し、生成された応答をタメ口維持・脱ロボット度で採点して比較します。
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={abPromptInput}
                    onChange={(e) => setAbPromptInput(e.target.value)}
                    placeholder="テスト用のユーザー発言"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs"
                  />
                  <button
                    onClick={handleRunABTest}
                    disabled={abResult?.isLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>{abResult?.isLoading ? '実行中...' : '両候補を実際に推論して比較'}</span>
                  </button>
                </div>

                {abResult && !abResult.isLoading && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span className="text-emerald-300">評価結果: 勝者 ➔ 候補 {abResult.winner}</span>
                      <span className="text-slate-400 font-mono">Score A: {abResult.scoreA}点 vs Score B: {abResult.scoreB}点</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{abResult.analysis}</p>
                    {(abResult.responseA || abResult.responseB) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          <span className="text-slate-500 font-bold block mb-1">候補Aの実際の応答:</span>
                          {abResult.responseA || '(応答なし)'}
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                          <span className="text-slate-500 font-bold block mb-1">候補Bの実際の応答:</span>
                          {abResult.responseB || '(応答なし)'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 検索方式ベンチマーク */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="font-bold text-sky-300 text-xs flex items-center gap-2">
                  <Search className="w-4 h-4 text-sky-400" />
                  <span>記憶検索 RAG スコアリング検証 (設計思想 4 & 12)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchBenchmarkQuery}
                    onChange={(e) => setSearchBenchmarkQuery(e.target.value)}
                    placeholder="検索テストクエリ"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">ハイブリッドスコアリング上位抽出結果:</span>
                  {retrieveScoredMemories(searchBenchmarkQuery, memories, { limit: 3 }).map((s, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-200 truncate">{s.memory.content}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-mono text-[10px]">
                          Score: {Math.round(s.score * 10) / 10}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {s.matchReasons.join(', ') || 'ピン留め/重要度優先'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Colab連携 & LoRA教材 (第4世代) */}
          {activeTab === 'colab' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    <span>Google Colab LoRA Fine-Tuning & GGUF 自動変換 (設計思想 1 & 7)</span>
                  </div>
                  <button
                    onClick={() => handleExportJSONLFile()}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>教材データセット(JSONL)保存</span>
                  </button>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  端末内で蓄積された高品質な会話・修復成功パターンを<strong>SFT/LoRA学習用JSONL</strong>としてエクスポート。
                  Colab上の無料T4 GPUで10分でファインチューニングし、GGUF(Q4_K_M)に量子化してGalaxy S25へ即座に取り込めます。
                </p>
              </div>

              {/* Colab Script Code Box */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-amber-300">
                    📄 Colab用 Python学習スクリプト (Unsloth / PEFT 自動量子化)
                  </span>
                  <button
                    onClick={() => handleCopy(colabScript, 'colabScript')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  >
                    {copiedText === 'colabScript' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === 'colabScript' ? 'コピー完了！' : 'スクリプトをコピー'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={colabScript}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-slate-300 font-mono text-[10px] leading-relaxed"
                />
              </div>

              {/* 4-Step Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-[10px]">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300">Step 1. JSONL保存</div>
                  <p className="text-slate-400">右上のボタンからdataset.jsonlをダウンロード</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-300">Step 2. Colab実行</div>
                  <p className="text-slate-400">上記スクリプトをColabに貼り付けてRun</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-purple-300">Step 3. GGUF出力</div>
                  <p className="text-slate-400">スクリプトが自動でQ4_K_M GGUFへ量子化変換</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-300">Step 4. 端末へ転送</div>
                  <p className="text-slate-400">GGUFモデルマネージャーから読み込んで進化完了！</p>
                </div>
              </div>

              {/* Dataset Hygiene & Quality Management Card (設計思想 1 & 18) */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-900/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-amber-300 text-xs flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>LoRA学習データセット品質管理 & 自動クリーンアップ</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      短文ゴミデータ・重複ログの排除、および品質基準を満たした有効サンプルの蓄積状況
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleTestNotification}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-700/60 rounded-lg text-xs flex items-center gap-1.5 font-semibold transition-all"
                      title="Android実機通知 / Web通知の発火とタップ遷移（本画面オープン）をテストします"
                    >
                      <Bell className="w-3.5 h-3.5 text-sky-400" />
                      <span>通知テスト送信</span>
                    </button>
                    <button
                      onClick={handleCleanDataset}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-700/60 rounded-lg text-xs flex items-center gap-1.5 font-semibold transition-all"
                      title="重複するプロンプト/応答や、短文・低品質サンプルを走査して自動排除します"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>重複排除 & クリーンアップ実行</span>
                    </button>
                  </div>
                </div>

                {notificationTestStatus && (
                  <div className="p-2.5 rounded-lg bg-sky-950/50 border border-sky-800 text-sky-200 text-xs animate-in fade-in font-mono flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{notificationTestStatus}</span>
                  </div>
                )}

                {cleanupMessage && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs animate-in fade-in font-mono">
                    {cleanupMessage}
                  </div>
                )}

                {(() => {
                  const approvedCount = trainingSamples.filter((s) => s.approved).length;
                  const threshold = 50;
                  const pct = Math.min(100, Math.round((approvedCount / threshold) * 100));
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">
                          有効学習サンプル数: <strong className="text-slate-100 font-mono">{trainingSamples.length}件</strong> (承認済み: <strong className="text-amber-300 font-mono">{approvedCount}件</strong> / 次期学習推奨閾値: <strong className="text-slate-200 font-mono">{threshold}件</strong>)
                        </span>
                        <span className={`text-[11px] font-bold ${approvedCount >= threshold ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {approvedCount >= threshold ? '🎉 閾値達成! 学習推奨' : `${pct}% 蓄積中`}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${approvedCount >= threshold ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Train / Validation / Test 分離管理カード (設計思想 18・過学習防止 & 課題 2) */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-sky-900/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-sky-300 text-xs flex items-center gap-2">
                      <Database className="w-4 h-4 text-sky-400" />
                      <span>学習データ Train / Validation / Test 分割管理 (データ漏洩防止)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      学習に使ったデータでモデルを自己評価する漏洩(Data Leakage)を防ぎ、未見データでの汎化性能を保証します。
                    </p>
                  </div>
                  <button
                    onClick={handleAutoAssignSplits}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs flex items-center gap-1.5 font-bold transition-all shadow-md shrink-0"
                    title="現在のサンプル群を Train(80%) / Validation(10%) / Test(10%) にシャッフル自動分割"
                  >
                    <PieChart className="w-3.5 h-3.5" />
                    <span>🎲 自動分割 (80:10:10)</span>
                  </button>
                </div>

                {splitMessage && (
                  <div className="p-2.5 rounded-lg bg-sky-950/60 border border-sky-700 text-sky-200 text-xs animate-in fade-in font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>{splitMessage}</span>
                  </div>
                )}

                {/* 3-Column Split Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-400" />
                        Train (学習用)
                      </span>
                      <span className="font-mono text-sky-200">{splitStats.trainRatio}%</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white">
                      {splitStats.train} <span className="text-xs text-slate-400 font-normal">件</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      SFT / LoRA の重み更新パラメータ学習にのみ使用。
                    </p>
                    <button
                      onClick={() => handleExportJSONLFile('train')}
                      className="w-full mt-1.5 px-2 py-1 bg-sky-900/50 hover:bg-sky-800/60 text-sky-200 border border-sky-700/50 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>train.jsonl</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Validation (検証用)
                      </span>
                      <span className="font-mono text-emerald-200">{splitStats.validationRatio}%</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white">
                      {splitStats.validation} <span className="text-xs text-slate-400 font-normal">件</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      学習中の過学習検知 & eval_loss 最適停止判定に使用。
                    </p>
                    <button
                      onClick={() => handleExportJSONLFile('validation')}
                      className="w-full mt-1.5 px-2 py-1 bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-200 border border-emerald-700/50 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>validation.jsonl</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                        Test (未見評価用)
                      </span>
                      <span className="font-mono text-purple-200">{splitStats.testRatio}%</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white">
                      {splitStats.test} <span className="text-xs text-slate-400 font-normal">件</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      学習には一切含めず、最終モデルの客観的性能判定に使用。
                    </p>
                    <button
                      onClick={() => handleExportJSONLFile('test')}
                      className="w-full mt-1.5 px-2 py-1 bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 border border-purple-700/50 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>test.jsonl</span>
                    </button>
                  </div>
                </div>

                {/* Samples Inspection & Split Assignment List */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span>サンプル分割プレビュー & 手動割り当て</span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                      {(['all', 'train', 'validation', 'test'] as const).map((splitKey) => (
                        <button
                          key={splitKey}
                          onClick={() => setSelectedSplitFilter(splitKey)}
                          className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                            selectedSplitFilter === splitKey
                              ? 'bg-sky-600 text-white font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {splitKey === 'all'
                            ? `全件 (${trainingSamples.length})`
                            : splitKey === 'train'
                            ? `Train (${splitStats.train})`
                            : splitKey === 'validation'
                            ? `Val (${splitStats.validation})`
                            : `Test (${splitStats.test})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {trainingSamples
                      .map((sample, idx) => ({ sample, originalIdx: idx }))
                      .filter(({ sample }) => {
                        if (selectedSplitFilter === 'all') return true;
                        return (sample.split || 'train') === selectedSplitFilter;
                      })
                      .slice(0, 15)
                      .map(({ sample, originalIdx }) => (
                        <div
                          key={originalIdx}
                          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={sample.approved}
                              onChange={() => handleToggleApproveSample(originalIdx)}
                              className="mt-1 rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                              title="教材承認状態"
                            />
                            <div className="min-w-0 space-y-0.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-200 truncate max-w-xs">
                                  Q: {sample.instruction}
                                </span>
                                {sample.failureReason && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                                    {sample.failureReason.length > 25 ? `${sample.failureReason.substring(0, 25)}...` : sample.failureReason}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate max-w-md">
                                A: {sample.outputTarget}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <select
                              value={sample.split || 'train'}
                              onChange={(e) =>
                                handleUpdateSampleSplit(
                                  originalIdx,
                                  e.target.value as 'train' | 'validation' | 'test'
                                )
                              }
                              className={`text-[11px] font-bold rounded-lg px-2 py-1 border cursor-pointer ${
                                (sample.split || 'train') === 'train'
                                  ? 'bg-sky-950/80 border-sky-700 text-sky-200'
                                  : (sample.split || 'train') === 'validation'
                                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                                  : 'bg-purple-950/80 border-purple-700 text-purple-200'
                              }`}
                            >
                              <option value="train">Train (学習)</option>
                              <option value="validation">Validation (検証)</option>
                              <option value="test">Test (未見評価)</option>
                            </select>
                          </div>
                        </div>
                      ))}

                    {trainingSamples.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-500">
                        学習サンプルがまだ蓄積されていません。会話や自己対話サイクルが進行すると自動登録されます。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 要確認キュー (第3分類: TRPG・フィクション文脈) */}
              {reviewQueue.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-amber-300 text-xs flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>📝 保留中の要確認キュー ({reviewQueue.length}件) - TRPG・フィクション文脈</span>
                    </div>
                    <button
                      onClick={() => {
                        selfImprovementService.clearReviewQueue();
                        setReviewQueue([]);
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      全て却下
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    TRPGのクラフト・ポーション調合やゲーム戦闘演出などの文脈シグナルを検知したため、即除外せず保留しています。
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {reviewQueue.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/50">
                              {item.reasons.join(', ')}
                            </span>
                          </div>
                          <p className="text-slate-200 font-semibold truncate">Q: {item.instruction}</p>
                          <p className="text-slate-400 text-[11px] truncate">A: {item.outputTarget}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveReviewItem(item.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition-all shadow-sm"
                          >
                            承認して追加
                          </button>
                          <button
                            onClick={() => handleDismissReviewItem(item.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 rounded text-[11px] transition-all"
                          >
                            却下
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: モデル世代 & 系統樹 (第4世代/第5世代) */}
          {activeTab === 'generations' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-pink-300 text-xs flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-pink-400" />
                    <span>モデル世代管理 & 系統樹 (設計思想 18 & 24)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetGenerations}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] rounded-lg border border-slate-800"
                      title="初期状態にリセット"
                    >
                      初期化
                    </button>
                    <button
                      onClick={() => setShowAddGen(!showAddGen)}
                      className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-md shadow-pink-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddGen ? 'フォームを閉じる' : '学習済み新モデルを登録'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-slate-400 text-[11px]">
                  万能モデル1つに頼るのではなく、<strong>「安定版 (基準)」「会話特化」「コード修復特化」</strong>などのブランチ系統樹を構築し、用途に応じて切り替え・シャドー検証します。
                </p>
              </div>

              {/* Add Generation Form */}
              {showAddGen && (
                <form
                  onSubmit={handleCreateGeneration}
                  className="p-4 rounded-xl bg-slate-950 border border-pink-500/40 space-y-3 animate-in fade-in"
                >
                  <div className="font-bold text-pink-300 text-xs">
                    🌟 Colabで学習・量子化した新世代モデルの登録
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">モデル表示名</label>
                      <input
                        type="text"
                        placeholder="例: Qwen 1.5B (Chat LoRA v1)"
                        value={newGenName}
                        onChange={(e) => setNewGenName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">バージョン</label>
                      <input
                        type="text"
                        placeholder="例: v1.1.0"
                        value={newGenVersion}
                        onChange={(e) => setNewGenVersion(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">系統ブランチ</label>
                      <select
                        value={newGenBranch}
                        onChange={(e: any) => setNewGenBranch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      >
                        <option value="chat_specialized">chat_specialized (会話・親友特化)</option>
                        <option value="code_specialized">code_specialized (コード修復特化)</option>
                        <option value="memory_retrieval">memory_retrieval (記憶検索特化)</option>
                        <option value="stable">stable (総合安定版 - ※合格レポート必須)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">LoRA Rank</label>
                      <input
                        type="number"
                        value={newGenRank}
                        onChange={(e) => setNewGenRank(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">学習教材件数</label>
                      <input
                        type="number"
                        value={newGenSamples}
                        onChange={(e) => setNewGenSamples(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 text-[10px]">
                        紐付ける回帰テストレポート (stableは必須)
                      </label>
                      <select
                        value={newGenReportId}
                        onChange={(e) => setNewGenReportId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                      >
                        <option value="">-- レポート未紐付け (測定待ち) --</option>
                        {benchmarkReports.map((r) => {
                          const passes = r.overallScore >= 80 && r.regressionsCount === 0 && r.failedTests === 0;
                          const isMatch = selfImprovementService.checkModelReportMatch(r, {
                            generationId: 'candidate',
                            modelName: newGenName.trim() || 'candidate',
                            baseModel: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
                            version: newGenVersion.trim() || 'v1.1.0',
                            branch: newGenBranch,
                            status: 'shadow_testing',
                            createdAt: Date.now(),
                            notes: newGenNotes.trim(),
                          });
                          return (
                            <option key={r.id} value={r.id}>
                              {passes ? (isMatch ? '✅ [合格・適合]' : '⚠️ [合格・他モデル]') : '❌ [不合格]'}: {r.modelName} (スコア: {r.overallScore}点 / 退行: {r.regressionsCount}件 / 失敗: {r.failedTests}件)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {newGenBranch === 'stable' && (
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/80 text-[11px] text-amber-200 leading-relaxed">
                      ⚠️ <strong>設計原則: 自動昇格の禁止</strong><br />
                      総合安定版(stable)への登録には、退行0件・失敗0件・スコア80点以上の合格レポートが必須です。未検証のモデルはまず『chat_specialized』等のブランチとして登録し、ベンチマーク実行後に昇格してください。
                    </div>
                  )}

                  {promotionError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-semibold animate-in fade-in">
                      ❌ {promotionError}
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400 mb-1 text-[10px]">モデルの特徴・メモ</label>
                    <input
                      type="text"
                      placeholder="例: 会話の脱ロボットとタメ口応答に特化してColabで30ステップ学習"
                      value={newGenNotes}
                      onChange={(e) => setNewGenNotes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddGen(false);
                        setPromotionError(null);
                      }}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg text-xs"
                    >
                      新世代モデルを系統樹に追加
                    </button>
                  </div>
                </form>
              )}

              {promotionSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-xs font-semibold animate-in fade-in">
                  {promotionSuccessMsg}
                </div>
              )}

              {/* Generation Cards */}
              <div className="space-y-2.5">
                {generations.map((gen) => {
                  const isPromotingThis = promotingGenId === gen.generationId;

                  return (
                    <div
                      key={gen.generationId}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              gen.branch === 'stable'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800 font-bold'
                                : gen.branch === 'chat_specialized'
                                ? 'bg-pink-950 text-pink-300 border-pink-800'
                                : 'bg-sky-950 text-sky-300 border-sky-800'
                            }`}
                          >
                            {gen.branch}
                          </span>
                          <span className="font-bold text-slate-100 text-xs">{gen.modelName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Ver {gen.version}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px]">
                            {typeof gen.benchmarkScore === 'number'
                              ? `実測スコア: ${gen.benchmarkScore}点`
                              : '実測未実施 (測定待ち)'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              gen.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {gen.status === 'active' ? '● 基準稼働中' : '◐ 候補モデル'}
                          </span>

                          {gen.branch !== 'stable' && (
                            <>
                              <button
                                onClick={() => {
                                  setPromotingGenId(isPromotingThis ? null : gen.generationId);
                                  setSelectedPromoteReportId('');
                                  setPromotionError(null);
                                }}
                                className="px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 border border-emerald-700/60 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                                title="回帰テスト合格レポートを紐付けて総合安定版(stable)へ昇格"
                              >
                                <Award className="w-3 h-3 text-emerald-400" />
                                <span>{isPromotingThis ? '閉じる' : '安定版へ昇格'}</span>
                              </button>
                              <button
                                onClick={() => handleDeleteGeneration(gen.generationId)}
                                className="text-slate-500 hover:text-rose-400 p-1"
                                title="モデル登録を削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-slate-300 text-[11px]">{gen.notes}</p>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-mono">
                        <span>ベース: {gen.baseModel}</span>
                        <span>LoRA Rank: {gen.loraRank || 'None'}</span>
                        <span>教材数: {gen.trainingSamplesCount}件</span>
                        {gen.benchmarkReportId && (
                          <span className="text-sky-400">🔗 レポート: {gen.benchmarkReportId}</span>
                        )}
                        {gen.promotedAt && (
                          <span className="text-emerald-400">
                            🏆 昇格日: {new Date(gen.promotedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Inline Promotion Workflow Box */}
                      {isPromotingThis && (
                        <div className="p-3 rounded-xl bg-slate-900 border border-emerald-600/60 space-y-3 animate-in fade-in">
                          <div className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-emerald-400" />
                            <span>「{gen.modelName}」を総合安定版 (stable) へ昇格</span>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            安定版への昇格には、<strong>「総合スコア80点以上」「退行(Regression) 0件」「失敗テスト 0件」</strong>を満たすベンチマークレポートの紐付けが必須です。
                          </p>

                          <div>
                            <label className="block text-slate-400 mb-1 text-[10px]">
                              合格済みの回帰ベンチマークレポートを選択
                            </label>
                            <select
                              value={selectedPromoteReportId}
                              onChange={(e) => setSelectedPromoteReportId(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs"
                            >
                              <option value="">-- レポートを選択してください --</option>
                              {benchmarkReports.map((r) => {
                                const passes =
                                  r.overallScore >= 80 && r.regressionsCount === 0 && r.failedTests === 0;
                                const isMatch = selfImprovementService.checkModelReportMatch(r, gen);
                                return (
                                  <option key={r.id} value={r.id}>
                                    {passes ? (isMatch ? '✅ [合格・適合]' : '⚠️ [合格・他モデル不適合]') : '❌ [不合格]'}: {r.modelName} (スコア: {r.overallScore}点 / 退行: {r.regressionsCount}件 / 失敗: {r.failedTests}件)
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {promotionError && (
                            <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px] font-semibold">
                              ❌ {promotionError}
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPromotingGenId(null);
                                setPromotionError(null);
                              }}
                              className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              disabled={!selectedPromoteReportId}
                              onClick={() => handlePromoteToStable(gen.generationId, selectedPromoteReportId)}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
                            >
                              昇格を確定
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-colors cursor-pointer"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
