// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  AlertTriangle,
  FileText,
  UploadCloud,
  Layers,
  Cpu,
  ShieldCheck,
  Database,
  ListTree,
  RefreshCw,
  Eye,
  ArrowRight,
  Zap,
  ExternalLink,
  Check,
  X,
  Search,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Award,
  AlertCircle,
  FileCode,
  Shield,
  Send,
  Boxes,
} from 'lucide-react';

import {
  typedImprovementUiGatewayService,
  type AutonomousImprovementRequest,
  type ExternalDirective,
  type ImprovementIntakeRun,
  type CandidateWorkspace,
  type CandidateValidationEvidence,
  type CoreResult,
  type ImprovementUiCommandResult,
  type PriorityOneRuntimeItem,
} from '../miki/core/ui/typedImprovementUiGatewayService';
import {
  MIKI_CATEGORIES,
  MikiCategory,
} from '../miki/core/mikiInteractionBus';
import { ReviewPackageLibrary } from './ReviewPackageLibrary';
import { typedCoreUiGatewayService } from '../miki/core/ui/typedCoreUiGatewayService';
import { isEditableInputActive } from '../utils/isEditableInputActive';

export interface AutonomousImprovementHomeProps {
  onOpenActivityMonitor?: () => void;
}

type MainSection =
  | 'status'
  | 'directives'
  | 'execution'
  | 'queue'
  | 'validation'
  | 'history'
  | 'core_18'
  | 'review_packages'
;

const formatRuntimeStatus = (value: string) => {
  switch ((value || '').toUpperCase()) {
    case 'COMPLETED': return '完了';
    case 'FAILED': return '失敗終了';
    case 'WAITING': return '待機';
    case 'RUNNING': return '実行中';
    case 'BLOCKED': return 'ブロック';
    case 'REJECTED': return '拒否';
    case 'PROCESSING': return '処理中';
    case 'WAIT_EXTERNAL_FEEDBACK': return '外部評価待ち';
    default: return value || '状態不明';
  }
};

const formatRuntimeAction = (value: string) => {
  switch ((value || '').toUpperCase()) {
    case 'NONE': return 'なし（終了）';
    case 'WAIT': return '待機';
    case 'RETRY': return '再試行';
    case 'REPLAN': return '再計画';
    case 'REGENERATE_CANDIDATE': return '候補を再生成';
    case 'IMPORT_FEEDBACK': return '評価結果を取り込み';
    case 'RECOVER': return '復旧';
    default: return value || '不明';
  }
};

export const AutonomousImprovementHome: React.FC<AutonomousImprovementHomeProps> = ({
  onOpenSelfImprovementModal,
  onOpenActivityMonitor,
}) => {
  const [activeSection, setActiveSection] = useState<MainSection>('status');
  const [refreshTick, setRefreshTick] = useState(0);

  // States from services
  const [coreRuntimes, setCoreRuntimes] = useState<PriorityOneRuntimeItem[]>(() =>
    typedImprovementUiGatewayService.listRestoredPriorityOneRuntime()
  );
  const coreRuntime = coreRuntimes[coreRuntimes.length - 1];
  const [loopState, setLoopState] = useState(() =>
    typedImprovementUiGatewayService.getLoopState()
  );
  const canonicalRuns = coreRuntimes.map((item) => ({
    run_id: item.taskId,
    verdict: item.waitingPackageIds.length > 0 ? 'WAIT_EXTERNAL_FEEDBACK' : item.taskStatus,
    taskStatus: item.taskStatus,
    decision: { action: item.allowedActions[0] || 'NONE' },
  })).reverse();
  const [externalDirectives, setExternalDirectives] = useState<ExternalDirective[]>(() =>
    typedImprovementUiGatewayService.getExternalDirectives()
  );
  const [intakeRuns, setIntakeRuns] = useState<ImprovementIntakeRun[]>(() =>
    typedImprovementUiGatewayService.getIntakeRuns(50)
  );
  const [workspaces, setWorkspaces] = useState<CandidateWorkspace[]>(() =>
    typedImprovementUiGatewayService.getWorkspaces()
  );
  const [evidences, setEvidences] = useState<CandidateValidationEvidence[]>(() =>
    typedImprovementUiGatewayService.getValidationEvidence()
  );
  const [coreResults, setCoreResults] = useState<CoreResult[]>(() =>
    typedImprovementUiGatewayService.getCoreResults(50)
  );

  // Directive creation inputs
  const [newDirectiveText, setNewDirectiveText] = useState('');
  const [newDirectiveFileName, setNewDirectiveFileName] = useState('pasted-directive.txt');
  const directiveFileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedDirectiveId, setSelectedDirectiveId] = useState<string | null>(null);

  // Execution triggers state
  const [manualTriggerObjective, setManualTriggerObjective] = useState('');
  const [manualTriggerSource, setManualTriggerSource] = useState<'UI' | 'AUTOPILOT'>('UI');
  const [specifiedImprovementTarget, setSpecifiedImprovementTarget] = useState('');
  const [resumeImprovementTaskId, setResumeImprovementTaskId] = useState('');
  const [lastImprovementCommandResult, setLastImprovementCommandResult] = useState<ImprovementUiCommandResult | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Core test flow state
  const [testFlowInput, setTestFlowInput] = useState('自律改善の基本連鎖を実行して');
  const [isTestingFlow, setIsTestingFlow] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<CoreResult | null>(null);

  // Auto-refresh timer & real-time subscriptions
  useEffect(() => {
    const unsubCore = typedImprovementUiGatewayService.subscribeCore(() => {
      if (isEditableInputActive()) return;
      setCoreResults(typedImprovementUiGatewayService.getCoreResults(50));
    });

    const timer = setInterval(() => {
      if (isEditableInputActive()) return;
      setCoreRuntimes(typedImprovementUiGatewayService.listRestoredPriorityOneRuntime());
      setLoopState(typedImprovementUiGatewayService.getLoopState());
      setExternalDirectives(typedImprovementUiGatewayService.getExternalDirectives());
      setIntakeRuns(typedImprovementUiGatewayService.getIntakeRuns(50));
      setWorkspaces(typedImprovementUiGatewayService.getWorkspaces());
      setEvidences(typedImprovementUiGatewayService.getValidationEvidence());
      setCoreResults(typedImprovementUiGatewayService.getCoreResults(50));
    }, 2000);

    return () => {
      clearInterval(timer);
      unsubCore();
    };
  }, []);

  const triggerRefresh = () => {
    setCoreRuntimes(typedImprovementUiGatewayService.listRestoredPriorityOneRuntime());
    setLoopState(typedImprovementUiGatewayService.getLoopState());
    setExternalDirectives(typedImprovementUiGatewayService.getExternalDirectives());
    setIntakeRuns(typedImprovementUiGatewayService.getIntakeRuns(50));
    setWorkspaces(typedImprovementUiGatewayService.getWorkspaces());
    setEvidences(typedImprovementUiGatewayService.getValidationEvidence());
    setCoreResults(typedImprovementUiGatewayService.getCoreResults(50));
    setRefreshTick((prev) => prev + 1);
  };

  const handleDirectiveFileChange = async (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const lowerName = String(file.name || '').toLowerCase();
    const supported = /\.(txt|md|markdown|json|yaml|yml)$/.test(lowerName);
    if (!supported && file.type && !String(file.type).startsWith('text/') && file.type !== 'application/json') {
      setActionMessage({ text: '対応していないファイル形式です。txt / md / markdown / json / yaml / yml を使用してください。', type: 'error' });
      event.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      setNewDirectiveText(text);
      setNewDirectiveFileName(file.name || 'imported-directive.txt');
      setActionMessage({ text: `${file.name} を読み込みました。内容を確認して「指示書を取り込む」を押してください。`, type: 'info' });
    } catch (err: any) {
      setActionMessage({ text: `ファイル読み込み失敗: ${err?.message || String(err)}`, type: 'error' });
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteDirective = async (directiveId: string) => {
    try {
      setIsExecutingAction(true);
      typedImprovementUiGatewayService.deleteDirective(directiveId);
      if (selectedDirectiveId === directiveId) setSelectedDirectiveId(null);
      setActionMessage({ text: `指示書 [${directiveId}] を削除しました。CORE実行履歴・検証証拠・評価用ZIPは保持されます。`, type: 'success' });
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({ text: `指示書を削除できません: ${err?.message || String(err)}`, type: 'error' });
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleCreateDirective = async () => {
    const text = newDirectiveText.trim();
    if (!text) {
      setActionMessage({ text: '指示書テキストを入力してください', type: 'error' });
      return;
    }
    try {
      setIsExecutingAction(true);
      const received = await typedImprovementUiGatewayService.receiveDirectiveFile(newDirectiveFileName || 'pasted-directive.txt', text);
      setNewDirectiveText('');
      setNewDirectiveFileName('pasted-directive.txt');
      setActionMessage({
        text: `指示書を取り込みました: ${received.directive.title} (ID: ${received.directive.directiveId}, Run: ${received.run.runId})。CORE Queueへ登録済みです。`,
        type: 'success',
      });
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({ text: `指示受付エラー: ${err?.message || String(err)}`, type: 'error' });
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Execute directive through canonical CORE ingress
  const handleExecuteDirective = async (directiveId: string) => {
    try {
      setIsExecutingAction(true);
      const reqId = typedImprovementUiGatewayService.generateRequestId();
      typedImprovementUiGatewayService.createRequest({
        requestId: reqId,
        sourceCategory: 'improvement',
        targetCategory: 'improvement',
        directiveId,
        goal: `Execute directive ${directiveId}`,
        createdAt: Date.now(),
      });
      typedImprovementUiGatewayService.updateRequestStatus(reqId, 'processing', {
        directiveId,
        route: ['improvement', 'core'],
        processedCategories: ['improvement', 'core'],
      });
      setActionMessage({
        text: `指示 [${directiveId}] (Req: ${reqId}) をCOREへ送信中...`,
        type: 'info',
      });

      const result = await typedImprovementUiGatewayService.executeDirective(directiveId);
      const stage = String(result.currentBusinessStage || result.currentStage || '').toUpperCase();
      const finished = stage === 'COMPLETED';
      const failed = ['FAILED', 'BLOCKED', 'REJECTED'].includes(stage);
      const message = result.stopReason || result.completionReasons?.[0] || '';
      const detail = result.nextStage ? ` → 次: ${result.nextStage}` : '';

      const payload = {
        directiveId,
        taskId: result.taskId,
        currentStage: result.currentBusinessStage || result.currentStage,
        nextStage: result.nextStage,
        stopReason: result.stopReason,
        completionReasons: result.completionReasons,
        missingRequiredOperations: result.missingRequiredOperations,
        missingReceipts: result.missingReceipts,
      };

      if (finished) {
        typedImprovementUiGatewayService.completeRequest(reqId, payload, {
          runId: result.taskId,
          directiveId,
          route: ['improvement', 'core'],
          processedCategories: ['improvement', 'core'],
        });
      } else {
        typedImprovementUiGatewayService.updateRequestStatus(reqId, failed ? 'failed' : 'processing', {
          runId: result.taskId,
          directiveId,
          route: ['improvement', 'core'],
          processedCategories: ['improvement', 'core'],
          error: failed ? (message || stage) : undefined,
          result: payload,
        });
      }

      setActionMessage({
        text: finished
          ? `指示 [${directiveId}] の実行が完了しました (Req: ${reqId}, Task: ${result.taskId || '―'})`
          : failed
            ? `指示 [${directiveId}] は完了せず停止しました (Req: ${reqId}, 状態: ${formatRuntimeStatus(stage)}${message ? `, ${message}` : ''})`
            : `指示 [${directiveId}] をCOREで受け付けました (Req: ${reqId}, 状態: ${formatRuntimeStatus(stage)}${detail})`,
        type: finished ? 'success' : failed ? 'error' : 'info',
      });
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({
        text: `実行失敗: ${err?.message || String(err)}`,
        type: 'error',
      });
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Start a user-specified improvement through the typed core ingress.
  const handleStartSpecifiedImprovement = async () => {
    const goal = manualTriggerObjective.trim();
    const target = specifiedImprovementTarget.trim();
    if (!goal || !target) {
      setActionMessage({ text: '改善目的と改善対象を入力してください', type: 'error' });
      return;
    }
    try {
      setIsExecutingAction(true);
      const result = await typedImprovementUiGatewayService.startSpecifiedImprovement(goal, target);
      setLastImprovementCommandResult(result);
      setActionMessage({ text: `改善受付完了: ${result.currentBusinessStage || result.currentStage || '状態を確認中'}${result.nextStage ? ` → 次: ${result.nextStage}` : ''}`, type: result.stopReason ? 'error' : 'success' });
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({ text: `指定改善の開始失敗: ${err?.message || String(err)}`, type: 'error' });
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Ask core to discover an improvement target through the same ingress.
  const handleDiscoverImprovementTarget = async () => {
    try {
      setIsExecutingAction(true);
      const result = await typedImprovementUiGatewayService.discoverImprovementTarget(manualTriggerObjective.trim() || undefined);
      setLastImprovementCommandResult(result);
      setActionMessage({ text: `自律改善対象を確認中: ${result.currentBusinessStage || result.currentStage || '状態を確認中'}${result.nextStage ? ` → 次: ${result.nextStage}` : ''}`, type: result.stopReason ? 'error' : 'success' });
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({ text: `自律発見の開始失敗: ${err?.message || String(err)}`, type: 'error' });
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Resume an existing improvement task only through core ingress.
  const handleResumeImprovementTask = async () => {
    const taskId = resumeImprovementTaskId.trim();
    if (!taskId) {
      setActionMessage({ text: '再開するTask IDを入力してください', type: 'error' });
      return;
    }
    try {
      setIsExecutingAction(true);
      const result = await typedImprovementUiGatewayService.resumeImprovementTask(taskId);
      setLastImprovementCommandResult(result);
      setActionMessage({ text: `改善処理を再開: ${result.currentBusinessStage || result.currentStage}${result.nextStage ? ` → 次: ${result.nextStage}` : ''}`, type: result.stopReason ? 'error' : 'success' });
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({ text: `Task再開失敗: ${err?.message || String(err)}`, type: 'error' });
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Run test flow: UI -> CORE -> conversation -> data -> execution -> CORE Result -> UI
  const handleRunTestFlow = async () => {
    if (!testFlowInput.trim()) return;
    try {
      setIsTestingFlow(true);
      setLastTestResult(null);

      const coreTask = await typedCoreUiGatewayService.submitConversation(testFlowInput.trim());
      const requestId = coreTask.coreResult?.requestId || coreTask.task.taskId;
      const res = coreTask.coreResult || {
        requestId,
        status: coreTask.task.status === 'COMPLETED' ? 'completed' : 'waiting',
        route: coreTask.coreResult?.route || [],
        processedCategories: coreTask.coreResult?.processedCategories || [],
      };

      setActionMessage({
        text: `CORE Request [${requestId}] を発行しました。現在のAdaptive CORE経路を追跡しました。`,
        type: 'info',
      });

      setLastTestResult(res);
      setActionMessage({
        text: `CORE Result [${requestId}] を受信しました (ステータス: ${res.status})`,
        type: 'success',
      });
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({
        text: `テストフロー実行エラー: ${err?.message || String(err)}`,
        type: 'error',
      });
    } finally {
      setIsTestingFlow(false);
    }
  };

  const filteredDirectives = useMemo(() => externalDirectives, [externalDirectives]);
  const selectedDirective = useMemo(() => {
    if (!selectedDirectiveId) return null;
    return externalDirectives.find((d) => d.directiveId === selectedDirectiveId) || null;
  }, [selectedDirectiveId, externalDirectives]);
  const getDirectiveRuntimeStatus = (directive: ExternalDirective) =>
    intakeRuns.find((run) => run.runId === directive.runId)?.status || directive.status;

  // Format timestamp helper
  const fmtTime = (ts?: number) => {
    if (!ts) return '―';
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-slate-100 tracking-tight">
                MIKI 自律改善統合ホーム
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                18構成 (CORE + 17分類)
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  loopState.status === 'RUNNING'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse'
                    : loopState.status === 'PAUSED'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Loop: {loopState.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              状態・作業指示・実行・キュー・検証・履歴・18構成を1画面で統合管理
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerRefresh}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition"
            title="最新状態に更新"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">更新</span>
          </button>
        </div>
      </div>

      {/* Action Notification Message Bar */}
      {actionMessage && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : actionMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
              : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : actionMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Activity className="w-4 h-4 shrink-0 animate-spin" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        {[
          { id: 'status', label: '現在の状態', icon: Activity },
          { id: 'directives', label: '作業指示', icon: FileText, count: externalDirectives.length },
          { id: 'execution', label: '実行', icon: Play },
          { id: 'queue', label: 'Queue', icon: ListTree, count: loopState.queue.length },
          { id: 'validation', label: '検証', icon: ShieldCheck, count: evidences.length },
          { id: 'history', label: '履歴', icon: Clock, count: canonicalRuns.length },
          { id: 'core_18', label: '18構成 & CORE Result', icon: Boxes, count: coreResults.length },
          { id: 'review_packages', label: '評価用ZIP', icon: UploadCloud },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as MainSection)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {/* ================= SECTION 1: 現在の状態 (STATUS) ================= */}
        {activeSection === 'status' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Canonical Controller */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    Canonical Controller
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      typedImprovementUiGatewayService.isCoreRuntimeBusy()
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {typedImprovementUiGatewayService.isCoreRuntimeBusy() ? 'CORE RUNNING' : (coreRuntime?.taskStatus?.toUpperCase() || 'CORE IDLE')}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-300 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between">
                    <span className="text-slate-500">直近Run ID:</span>
                    <span className="font-mono text-indigo-300 text-[11px]">
                      {canonicalRuns[0]?.run_id || 'なし'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">判定(Verdict):</span>
                    <span
                      className={`font-semibold ${
                        canonicalRuns[0]?.verdict === 'COMPLETED'
                          ? 'text-emerald-400'
                          : canonicalRuns[0]?.verdict === 'CANCELLED'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {canonicalRuns[0]?.verdict || '―'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">アクション:</span>
                    <span className="text-[11px] text-slate-200">
                      {canonicalRuns[0]?.decision?.action || 'IDLE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Autonomous Loop */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                    Autonomous Loop
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    {loopState.status}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-300 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between">
                    <span className="text-slate-500">待機キュー数:</span>
                    <span className="font-semibold text-sky-300">{loopState.queue.length} 件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">実行状態:</span>
                    <span className="text-[11px] text-slate-300">
                      {loopState.activeRequestId ? '処理中' : '待機中'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">現在工程:</span>
                    <span className="text-[11px] text-slate-300">
                      {lastImprovementCommandResult?.currentBusinessStage || lastImprovementCommandResult?.currentStage || '待機中'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Next Retry & Wait Reason */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    次回再試行 & 待機
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {loopState.retryAt ? fmtTime(loopState.retryAt) : '待機なし'}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-300 pt-1 border-t border-slate-800/60">
                  <div className="flex flex-col">
                    <span className="text-slate-500">待機理由:</span>
                    <span className="text-[11px] text-amber-300/90 truncate">
                      {loopState.lastReason || '正常待機中'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">更新時刻:</span>
                    <span className="text-[11px] text-slate-400">
                      {fmtTime(loopState.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: CORE Result Overview */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                    CORE Result 統一
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {coreResults.length} 件管理
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-300 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between">
                    <span className="text-slate-500">最新処理:</span>
                    <span className="text-[11px] text-emerald-300 truncate max-w-[120px]">
                      {coreResults[0]?.status || '待機'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">状態:</span>
                    <span className="text-[11px] font-semibold text-slate-200">
                      {coreResults[0]?.status || '待機'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">通過分類:</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                      {coreResults[0]?.processedCategories?.join(', ') || '―'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-slate-200">
                  正規実行制御 (Canonical Controller & Loop)
                </div>
                <p className="text-[11px] text-slate-400">
                  曖昧な単一ボタンを廃止し、明確に分離された受付・実行・再開コマンドを提供
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setResumeImprovementTaskId(loopState.lastTaskId || ''); setActiveSection('execution'); }}
                  disabled={isExecutingAction}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
                  title="待機中または中断されたLoopを再開"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Loop再開 (Resume)</span>
                </button>

                <button
                  onClick={() => setActiveSection('execution')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>実行画面へ移動</span>
                </button>
              </div>
            </div>

            {/* Recent Loop Queue Preview */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ListTree className="w-4 h-4 text-indigo-400" />
                  待機中Queue (直近)
                </h3>
                <span className="text-[11px] text-slate-400">
                  {loopState.queue.length} 件待機中
                </span>
              </div>

              {loopState.queue.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/40">
                  現在、待機中の改善要求はありません
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 border border-slate-800/60 rounded-lg overflow-hidden">
                  {loopState.queue.slice(0, 5).map((q) => (
                    <div
                      key={q.id}
                      className="p-3 bg-slate-900/40 hover:bg-slate-800/40 transition flex items-center justify-between text-xs gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-indigo-300 text-[11px]">
                            {q.id}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-400">
                            {q.source}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            優先度: {q.priority || 50}
                          </span>
                        </div>
                        <div className="text-slate-200 font-medium truncate">
                          {q.trigger}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 whitespace-nowrap">
                        試行: {q.attempts || 0}回
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SECTION 2: 作業指示 (DIRECTIVES) ================= */}
        {activeSection === 'directives' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    作業指示書の取り込み
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    貼り付け・txt / md / markdown / json / yaml / yml を同じ取り込み経路で処理します。タイトルは自動判定します。
                  </p>
                </div>
                <input
                  ref={directiveFileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,.json,.yaml,.yml,text/plain,text/markdown,application/json,text/yaml"
                  onChange={handleDirectiveFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => directiveFileInputRef.current?.click()}
                  disabled={isExecutingAction}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 disabled:opacity-50"
                >
                  ファイルを選択
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <span className="text-slate-500">入力:</span> {newDirectiveFileName}
                <span className="ml-3 text-slate-500">タイトル:</span> 自動判定
              </div>

              <textarea
                placeholder="作業指示書を貼り付けてください。JSONもそのまま受け付けます。"
                value={newDirectiveText}
                onChange={(e) => setNewDirectiveText(e.target.value)}
                onInput={(e) => setNewDirectiveText(e.currentTarget.value)}
                onCompositionStart={(e) => setNewDirectiveText(e.currentTarget.value)}
                onCompositionUpdate={(e) => setNewDirectiveText(e.currentTarget.value)}
                onCompositionEnd={(e) => setNewDirectiveText(e.currentTarget.value)}
                onKeyUp={(e) => setNewDirectiveText(e.currentTarget.value)}
                onBlur={(e) => setNewDirectiveText(e.currentTarget.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-hidden focus:border-indigo-500"
              />

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-500">
                  取り込み時にタイトル・目的・対象・要件・禁止事項・不変条件・検証条件・納品条件を構造化します。
                </div>
                <button
                  onClick={handleCreateDirective}
                  disabled={isExecutingAction || !newDirectiveText.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>指示書を取り込む</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200">
                登録済み指示書一覧 ({filteredDirectives.length}件)
              </h3>

              {filteredDirectives.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/40">
                  登録済みの指示書はありません
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredDirectives.map((d) => {
                    const runtimeStatus = getDirectiveRuntimeStatus(d);
                    const intakeRun = intakeRuns.find((run) => run.runId === d.runId);
                    return (
                      <div
                        key={d.directiveId}
                        onClick={() => setSelectedDirectiveId(d.directiveId)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer space-y-2 ${
                          selectedDirectiveId === d.directiveId
                            ? 'bg-slate-800/80 border-indigo-500 shadow-xs'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-mono text-indigo-300 font-medium text-[11px]">{d.directiveId}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                            {runtimeStatus}
                          </span>
                        </div>
                        <div className="font-bold text-slate-100 text-xs">{d.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-2">{d.objective}</div>
                        <div className="text-[10px] text-slate-500">
                          Run: {d.runId || '―'} {intakeRun?.taskId ? ` / Task: ${intakeRun.taskId}` : ''}
                        </div>
                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                          <span>受領: {fmtTime(d.receivedAt)}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleDeleteDirective(d.directiveId); }}
                            disabled={isExecutingAction}
                            className="px-2.5 py-1 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white font-medium flex items-center gap-1 transition disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                            <span>削除</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedDirective && (
                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3 mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-indigo-400 font-bold text-xs">{selectedDirective.directiveId}</div>
                      <h4 className="font-bold text-xs text-slate-100 mt-1">{selectedDirective.title}</h4>
                    </div>
                    <button onClick={() => setSelectedDirectiveId(null)} className="text-slate-400 hover:text-white p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-1"><span className="text-[11px] text-slate-500 font-semibold">目的:</span><p className="text-slate-200">{selectedDirective.objective}</p></div>
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-1"><span className="text-[11px] text-slate-500 font-semibold">対象ファイル:</span><p className="text-slate-200 font-mono text-[11px]">{selectedDirective.targetFiles?.join(', ') || '全体'}</p></div>
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-1"><span className="text-[11px] text-slate-500 font-semibold">要件:</span><p className="text-slate-300 text-[11px]">{selectedDirective.requirements?.join(' / ') || '特になし'}</p></div>
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-1"><span className="text-[11px] text-slate-500 font-semibold">禁止事項:</span><p className="text-slate-300 text-[11px]">{selectedDirective.prohibitions?.join(' / ') || '特になし'}</p></div>
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-1 md:col-span-2"><span className="text-[11px] text-slate-500 font-semibold">検証条件 / 納品条件:</span><p className="text-slate-300 text-[11px]">{[...(selectedDirective.validationRequirements || []), ...(selectedDirective.deliveryRequirements || [])].join(' / ') || '指定なし'}</p></div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800 pt-3 gap-3">
                    <span className="text-[10px] text-slate-500">削除してもCORE実行履歴・検証証拠・評価用ZIPは削除されません。実行中の指示書は安全上削除できません。</span>
                    <button
                      onClick={() => void handleDeleteDirective(selectedDirective.directiveId)}
                      disabled={isExecutingAction}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50"
                    >この指示書を削除</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SECTION 3: 実行 (EXECUTION) ================= */}
        {activeSection === 'execution' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Play className="w-4 h-4 text-emerald-400" />
                実行制御 (Execution Intake & Controls)
              </h3>
              <p className="text-[11px] text-slate-400">
                各実行方式を混同せず、目的別に分離された実行受付を提供します
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {/* Flow 1: Execute Pending Directive */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      1. 指示書を実行 (Directive Run)
                    </div>
                    <p className="text-[11px] text-slate-400">
                      登録済みの作業指示を最優先でCanonical Controllerへ投入し、決定論的パイプラインで実行
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSection('directives')}
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                  >
                    指示書一覧から選択
                  </button>
                </div>

                {/* Flow 2: Typed core improvement entry */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5"><ListTree className="w-3.5 h-3.5" />2. 自己コード改善をcoreで開始</div>
                    <p className="text-[11px] text-slate-400">指定改善と自律発見を同じTyped Core入口へ送信</p>
                    <input type="text" placeholder="改善目的" value={manualTriggerObjective} onChange={(e) => setManualTriggerObjective(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 mt-2" />
                    <input type="text" placeholder="改善対象 File / Module / Issue" value={specifiedImprovementTarget} onChange={(e) => setSpecifiedImprovementTarget(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleStartSpecifiedImprovement} disabled={isExecutingAction} className="py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50">改善対象を指定</button>
                    <button onClick={handleDiscoverImprovementTarget} disabled={isExecutingAction} className="py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50">自動で改善対象を探す</button>
                  </div>
                </div>

                {/* Flow 3: Resume typed core task */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />3. 既存Runを再開</div>
                    <p className="text-[11px] text-slate-400">Task IDを指定し、coreの最後の正常工程から再開</p>
                    <input type="text" placeholder="Task ID" value={resumeImprovementTaskId} onChange={(e) => setResumeImprovementTaskId(e.target.value)} className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 mt-2" />
                    {lastImprovementCommandResult && <div className="text-[10px] text-slate-400 break-all">Task: {lastImprovementCommandResult.taskId || '未発行'}<br />Task revision: {lastImprovementCommandResult.taskRevision ?? '未確定'}<br />Core Plan revision: {lastImprovementCommandResult.corePlanRevision ?? '未確定'}<br />Operation: {lastImprovementCommandResult.operationInstanceId}<br />Operation: {lastImprovementCommandResult.currentOperationInstanceId || '未確定'}<br />Business stage: {lastImprovementCommandResult.currentBusinessStage || lastImprovementCommandResult.currentStage}<br />Next operation: {lastImprovementCommandResult.nextOperationInstanceId || 'なし'}<br />Next: {lastImprovementCommandResult.nextStage || 'なし'}<br />Decision: {lastImprovementCommandResult.decisionId || '未確定'}<br />Replies ({lastImprovementCommandResult.domainReplyIds.length}): {lastImprovementCommandResult.domainReplyIds.length > 0 ? lastImprovementCommandResult.domainReplyIds.join(', ') : 'なし'}<br />Evidence ({lastImprovementCommandResult.evidenceIds.length}): {lastImprovementCommandResult.evidenceIds.length > 0 ? lastImprovementCommandResult.evidenceIds.join(', ') : 'なし'}<br />Receipts ({lastImprovementCommandResult.persistenceReceiptIds.length}): {lastImprovementCommandResult.persistenceReceiptIds.length > 0 ? lastImprovementCommandResult.persistenceReceiptIds.join(', ') : 'なし'}<br />Required domains: {lastImprovementCommandResult.requiredDomains.join(', ') || 'なし'}<br />Missing domains: {lastImprovementCommandResult.missingDomains.join(', ') || 'なし'}<br />Failed domains: {lastImprovementCommandResult.failedDomains.join(', ') || 'なし'}<br />Missing receipts: {lastImprovementCommandResult.missingReceipts.join(', ') || 'なし'}<br />Missing operations: {lastImprovementCommandResult.missingRequiredOperations.join(', ') || 'なし'}<br />Stop reasons: {lastImprovementCommandResult.completionReasons.join(', ') || lastImprovementCommandResult.stopReason || 'なし'}<br />Unresolved: {lastImprovementCommandResult.unresolved.length > 0 ? lastImprovementCommandResult.unresolved.join(', ') : 'なし'}</div>}
                  </div>
                  <button onClick={handleResumeImprovementTask} disabled={isExecutingAction} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition disabled:opacity-50">既存Runを再開</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= SECTION 4: QUEUE ================= */}
        {activeSection === 'queue' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ListTree className="w-4 h-4 text-sky-400" />
                  待機中キュー詳細 (Autonomous Loop Queue)
                </h3>
                <span className="text-xs text-slate-400">
                  全 {loopState.queue.length} 件
                </span>
              </div>

              {loopState.queue.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/40">
                  待機中のRunはありません
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {loopState.queue.map((req, idx) => (
                    <div
                      key={req.id}
                      className="p-4 bg-slate-900/40 hover:bg-slate-800/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sky-300 font-bold">
                            #{idx + 1} {req.id}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-semibold">
                            発生元: {req.source}
                          </span>
                          <span className="text-[10px] text-amber-400 font-mono">
                            優先度: {req.priority ?? 50}
                          </span>
                        </div>
                        <div className="text-slate-100 font-medium">
                          {req.trigger}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3">
                          <span>登録: {fmtTime(req.createdAt)}</span>
                          {req.runId && <span>Run ID: {req.runId}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          試行回数: {req.attempts}回
                          <span className="ml-2 text-indigo-300">CORE安全上限: {typedCoreUiGatewayService.getCoreCycleSettings().selfImprovementMaxCycles}サイクル</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SECTION 5: 検証 (VALIDATION) ================= */}
        {activeSection === 'validation' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Validation Stages Overview */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  7段階エビデンス品質ゲート (Validation Stages)
                </h3>
                <div className="space-y-2 text-xs">
                  {[
                    { id: 'STATIC', label: '1. STATIC (AST構文・静的解析)' },
                    { id: 'TYPECHECK', label: '2. TYPECHECK (TypeScript型検証)' },
                    { id: 'REGRESSION', label: '3. REGRESSION (回帰テスト通過)' },
                    { id: 'COUNTEREXAMPLE', label: '4. COUNTEREXAMPLE (反証・境界値テスト)' },
                    { id: 'GENERALIZATION', label: '5. GENERALIZATION (一般化・過学習防止)' },
                    { id: 'PERSISTENCE', label: '6. PERSISTENCE (永続化整合性確認)' },
                    { id: 'DEVICE', label: '7. DEVICE (端末制約・リソース整合)' },
                  ].map((st) => {
                    const stageCount = evidences.filter((e) => e.stage === st.id).length;
                    const passedCount = evidences.filter((e) => e.stage === st.id && e.passed).length;
                    return (
                      <div
                        key={st.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-200">{st.label}</span>
                        <span className="text-[11px] font-mono text-emerald-400">
                          {passedCount} / {stageCount} 通過
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Requirement Contract & Candidate Workspaces */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  独立候補ワークスペース ({workspaces.length}件)
                </h3>

                {workspaces.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/40">
                    現在、アクティブな分離ワークスペースはありません
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {workspaces.map((w) => (
                      <div
                        key={w.workspaceId}
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-indigo-300">{w.workspaceId}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {w.status}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          変更ファイル: {w.files.map((f) => f.path).join(', ') || '―'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= SECTION 6: 履歴 (HISTORY) ================= */}
        {activeSection === 'history' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Canonical Controller 改善実行履歴 ({canonicalRuns.length}件)
                </h3>
              </div>

              {canonicalRuns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/40">
                  実行履歴はありません
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {canonicalRuns.map((run) => (
                    <div
                      key={run.run_id}
                      className="p-3.5 bg-slate-900/40 hover:bg-slate-800/40 transition text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-indigo-300 font-bold text-[11px]">
                            {run.run_id}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                            状態: {formatRuntimeStatus(run.verdict)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                            次の操作: {formatRuntimeAction(run.decision.action)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {formatRuntimeStatus(run.verdict)}
                        </span>
                      </div>

                      <div className="text-slate-200">{run.trigger}</div>

                      {run.result && (
                        <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/60">
                          {run.result}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                        <span>実行時刻: {fmtTime(run.created_at)}</span>
                        {run.score_delta !== undefined && (
                          <span>スコア変化: {run.score_delta > 0 ? `+${run.score_delta}` : run.score_delta}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SECTION 7: 18構成 & CORE RESULT ================= */}
        {activeSection === 'core_18' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* 18 Structure Architecture Overview */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-indigo-400" />
                    18構成 (CORE + 17分類) システムアーキテクチャ
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    基本経路: UI → CORE Request → 必要な分類 (17分類) → CORE Result → UI
                  </p>
                </div>
              </div>

              {/* Central CORE Node + 17 Classification Categories */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                {/* CORE Layer */}
                <div className="p-3 rounded-lg bg-indigo-950/60 border border-indigo-500/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="font-bold text-indigo-200 text-xs sm:text-sm">
                      CORE (第18統括層)
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-300">
                    UI入出力境界・要求相関・動的ルーティング
                  </span>
                </div>

                {/* 17 Categories Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {MIKI_CATEGORIES.map((cat) => (
                    <div
                      key={cat}
                      className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-1 hover:border-slate-700 transition"
                    >
                      <span className="font-mono text-[11px] text-slate-200 font-semibold">
                        {cat}
                      </span>
                      <span className="text-[10px] text-slate-500 capitalize">
                        category
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Test Flow Execution Panel */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Play className="w-4 h-4 text-emerald-400" />
                正規基準経路テスト (UI → CORE → conversation → data → execution → CORE Result)
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testFlowInput}
                  onChange={(e) => setTestFlowInput(e.target.value)}
                  placeholder="テスト入力テキスト..."
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  onClick={handleRunTestFlow}
                  disabled={isTestingFlow || !testFlowInput.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isTestingFlow ? (
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>フロー検証実行</span>
                </button>
              </div>

              {lastTestResult && (
                <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/40 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-emerald-300 font-bold">
                      RequestId: {lastTestResult.requestId}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold text-[10px]">
                      {lastTestResult.status}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[11px]">
                    通過ルート: {lastTestResult.route.join(' ➔ ')}
                  </div>
                  <div className="text-slate-300 text-[11px]">
                    処理分類: {lastTestResult.processedCategories.join(', ')}
                  </div>
                </div>
              )}
            </div>

            {/* CORE Results Table */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-indigo-400" />
                CORE Result 相関管理テーブル ({coreResults.length}件)
              </h3>

              {coreResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800/40">
                  CORE Result はまだありません
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {coreResults.slice(0, 20).map((cr) => (
                    <div
                      key={cr.requestId}
                      className="p-3 bg-slate-900/40 hover:bg-slate-800/40 transition flex flex-col gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-indigo-300 font-bold text-[11px]">
                            {cr.requestId}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              cr.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : cr.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : cr.status === 'processing'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse'
                                : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {cr.status}
                          </span>
                          <span className="text-slate-400 text-[10.5px]">
                            Source: {cr.sourceCategory}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {fmtTime(cr.updatedAt)}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                        <div>
                          <span className="text-slate-600 font-sans">Interaction: </span>
                          <span className="text-slate-300">{cr.interactionId || '―'}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 font-sans">Run ID: </span>
                          <span className="text-slate-300">{cr.runId || '―'}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 font-sans">Directive: </span>
                          <span className="text-slate-300">{cr.directiveId || '―'}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 font-sans">Categories: </span>
                          <span className="text-slate-300">{cr.processedCategories?.join(', ') || '―'}</span>
                        </div>
                        <div className="sm:col-span-2 md:col-span-4">
                          <span className="text-slate-600 font-sans">Route: </span>
                          <span className="text-emerald-400">{cr.route?.join(' ➔ ') || '―'}</span>
                        </div>
                        {cr.error && (
                          <div className="sm:col-span-2 md:col-span-4 text-rose-400">
                            <span className="text-slate-600 font-sans">Error: </span>
                            <span>{cr.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}


      </div>
    </div>
  );
};
