import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Play,
  RotateCw,
  Trash2,
  FileCode,
  Globe,
  ExternalLink,
  Zap,
  Cpu,
  X,
  Heart,
  Users,
  User,
  Share2,
  Square,
  StopCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ListTree,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Wrench,
  FlaskConical,
  Layers,
  AlignLeft,
  ShieldCheck,
  SearchCheck,
  Workflow,
  Code2,
  Compass,
  Table,
  AlertTriangle,
  MessageSquare,
  Lock,
  GitBranch,
  CheckSquare,
  HelpCircle,
  MoreHorizontal,
  Rocket,
  HeartPulse,
  Eye,
  Bug,
  Network,
  History,
  RefreshCw,
  Bot,
  Terminal,
} from 'lucide-react';
import {
  ChatMessage,
  PersonaConfig,
  MemoryItem,
  WorkspaceFile,
  EngineMode,
  CompletionEvaluation,
  AutonomousGrowthReport,
  ConversationBranch,
  WhyAnswerInspection,
  ConversationTaskCard,
  ProactiveSuggestionLevel,
  ManualExplanationOverride,
  AutonomousVerificationData,
} from '../types';
import { extractCodeBlocks, extractFilesFromZip } from '../utils/codeParser';
import { SPEAKER_PROFILES } from '../data/speakers';
import { systemLogger, StepExecutionSnapshot } from '../services/systemLogger';
import { selfImprovementService } from '../services/selfImprovementService';
import { skillsService } from '../services/skillsService';
import { TaskPlanCard } from './TaskPlanCard';
import { CompletionBadge } from './CompletionBadge';
import { completionJudgeService } from '../services/completionJudgeService';
import { workflowSynthesisService } from '../services/workflowSynthesisService';
import { experienceRouterService } from '../services/experienceRouterService';
import { autonomousEvolutionService } from '../services/autonomousEvolutionService';
import { mikiSelfCodingSuperchargerService } from '../services/mikiSelfCodingSuperchargerService';
import { autonomousContinuousEvolutionService } from '../services/autonomousContinuousEvolutionService';
import { userProficiencyService } from '../services/userProficiencyService';
import { codeSkeletonService } from '../services/codeSkeletonService';
import { conversationBranchService } from '../services/conversationBranchService';
import { liveConversationRepairService } from '../services/liveConversationRepairService';
import { whyAnswerInspectorService } from '../services/whyAnswerInspectorService';
import { conversationTaskboardService } from '../services/conversationTaskboardService';
import { proactiveContextOsService, ProactiveInsightItem } from '../services/proactiveContextOsService';
import { WhyAnswerInspectorModal } from './chat/WhyAnswerInspectorModal';
import { ConversationBranchModal } from './chat/ConversationBranchModal';
import { ConversationTaskboardModal } from './chat/ConversationTaskboardModal';
import { RealtimeActivityMonitorModal } from './RealtimeActivityMonitorModal';
import { DiffPreviewModal } from './chat/DiffPreviewModal';
import { UnitTestStudioModal } from './chat/UnitTestStudioModal';
import { DependencyGraphModal } from './chat/DependencyGraphModal';
import { SnapshotTimeMachineModal } from './chat/SnapshotTimeMachineModal';
import { AutonomousSelfImprovementModal } from './chat/AutonomousSelfImprovementModal';
import { AutonomousEvolutionCard } from './chat/AutonomousEvolutionCard';
import JSZip from 'jszip';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, files?: { name: string; content: string; type: string }[]) => void;
  isLoading: boolean;
  isGenerating?: boolean;
  onStopGeneration?: () => void;
  persona: PersonaConfig;
  memories: MemoryItem[];
  onUpdateMemories?: React.Dispatch<React.SetStateAction<MemoryItem[]>> | ((memories: MemoryItem[]) => void);
  engineMode: EngineMode;
  speakerMode: string;
  setSpeakerMode: (mode: string) => void;
  onApplyCode: (files: { path: string; name: string; content: string; language: string }[]) => void;
  onClearHistory: () => void;
  useSearch: boolean;
  setUseSearch: (val: boolean) => void;
  workspaceFiles: WorkspaceFile[];
  onOpenGamePreview?: () => void;
  onOpenEngineModal?: () => void;
  onOpenExportModal?: () => void;
  onOpenSelfImprovementModal?: () => void;
  onExecuteTool?: (toolId: string, params: Record<string, any>, userConfirmed?: boolean) => void;
  onConfirmToolExecution?: (request: any) => void;
  onRejectToolExecution?: (requestId: string) => void;
  isMultiStepEnabled?: boolean;
  onToggleMultiStep?: () => void;
  onResumeTaskPlan?: (planId: string) => void;
  onUpdateMessageEvaluation?: (messageId: string, evaluation: CompletionEvaluation) => void;
  onApplyCodeProposal?: (proposal: any) => void;
  onRejectCodeProposal?: (proposalId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  isGenerating = false,
  onStopGeneration,
  persona,
  memories,
  onUpdateMemories,
  engineMode,
  speakerMode,
  setSpeakerMode,
  onApplyCode,
  onClearHistory,
  useSearch,
  setUseSearch,
  workspaceFiles,
  onOpenGamePreview,
  onOpenEngineModal,
  onOpenExportModal,
  onOpenSelfImprovementModal,
  onExecuteTool,
  onConfirmToolExecution,
  onRejectToolExecution,
  isMultiStepEnabled = false,
  onToggleMultiStep,
  onResumeTaskPlan,
  onUpdateMessageEvaluation,
  onApplyCodeProposal,
  onRejectCodeProposal,
  onDeleteMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; type: string; size: number }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [expandedStepsMsgId, setExpandedStepsMsgId] = useState<string | null>(null);
  const [feedbackFeedbackId, setFeedbackFeedbackId] = useState<string | null>(null);
  const [feedbackReasons, setFeedbackReasons] = useState<{ [msgId: string]: string }>({});
  const [expandedAnswerPlanMsgId, setExpandedAnswerPlanMsgId] = useState<string | null>(null);
  const [expandedCodeIrMsgId, setExpandedCodeIrMsgId] = useState<string | null>(null);
  const [expandedVbaSpecMsgId, setExpandedVbaSpecMsgId] = useState<string | null>(null);
  const [expandedVbaVerificationMsgId, setExpandedVbaVerificationMsgId] = useState<string | null>(null);
  const [expandedPrivacyAuditMsgId, setExpandedPrivacyAuditMsgId] = useState<string | null>(null);
  const [expandedWorkflowMsgId, setExpandedWorkflowMsgId] = useState<string | null>(null);
  const [executingWorkflowId, setExecutingWorkflowId] = useState<string | null>(null);
  const [workflowStatusMessage, setWorkflowStatusMessage] = useState<{ [wfId: string]: string }>({});
  const [experienceToast, setExperienceToast] = useState<{ msgId: string; text: string } | null>(null);
  const [activeMoreMenuMsgId, setActiveMoreMenuMsgId] = useState<string | null>(null);
  const [showToolsRow, setShowToolsRow] = useState(false);

  // 第19章: 放置型自律進化レポート状態
  const [unviewedGrowthReport, setUnviewedGrowthReport] = useState<AutonomousGrowthReport | null>(null);
  const [showGrowthDetail, setShowGrowthDetail] = useState(false);
  const [isSimulatingEvolution, setIsSimulatingEvolution] = useState(false);

  // 第31章: 会話・コード理解を伸ばす新機能パッケージ 状態管理
  const [branches, setBranches] = useState<ConversationBranch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('branch_main');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  const [tasks, setTasks] = useState<ConversationTaskCard[]>([]);
  const [proactiveLevel, setProactiveLevel] = useState<ProactiveSuggestionLevel>('STANDARD');
  const [explanationOverride, setExplanationOverride] = useState<ManualExplanationOverride>('AUTO');
  const [isTaskboardModalOpen, setIsTaskboardModalOpen] = useState(false);

  const [selectedInspection, setSelectedInspection] = useState<WhyAnswerInspection | null>(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [liveRepairAlert, setLiveRepairAlert] = useState<{ trigger: string; advice: string } | null>(null);

  // リアルタイム行動・思考モニター状態 (ユーザー要望: リアルタイムに今何をしているか可視化)
  const [isActivityMonitorOpen, setIsActivityMonitorOpen] = useState(false);
  const [latestLiveStep, setLatestLiveStep] = useState<StepExecutionSnapshot | null>(null);
  const [liveLogMessage, setLiveLogMessage] = useState<string>('');

  // 差分プレビュー & 自律自己実装ランチャー状態
  const [diffModalState, setDiffModalState] = useState<{
    isOpen: boolean;
    fileName: string;
    oldCode: string;
    newCode: string;
    filePath: string;
  } | null>(null);
  const [testModalState, setTestModalState] = useState<{
    isOpen: boolean;
    fileName: string;
    code: string;
  } | null>(null);
  const [isDependencyGraphModalOpen, setIsDependencyGraphModalOpen] = useState(false);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [isSelfImplementLauncherOpen, setIsSelfImplementLauncherOpen] = useState(false);
  const [isAutonomousImprovementModalOpen, setIsAutonomousImprovementModalOpen] = useState(false);
  const [autonomousVerifications, setAutonomousVerifications] = useState<Record<string, AutonomousVerificationData>>({});
  const [expandedExternalDiagMsgId, setExpandedExternalDiagMsgId] = useState<string | null>(null);

  // 設計思想 第35/54章: みきの先回りインサイト・気配りバー状態
  const [proactiveInsights, setProactiveInsights] = useState<ProactiveInsightItem[]>(() =>
    proactiveContextOsService.getActiveInsights()
  );
  const [isProactiveBarDismissed, setIsProactiveBarDismissed] = useState<boolean>(false);

  useEffect(() => {
    const unsub = proactiveContextOsService.subscribe((_snap, insights) => {
      setProactiveInsights(insights);
    });
    return unsub;
  }, []);

  const handleApplyInsight = (insight: ProactiveInsightItem) => {
    if (insight.actionType === 'INSERT_PROMPT' && insight.suggestedPrompt) {
      setInputText(insight.suggestedPrompt);
      if (textareaRef.current) {
        textareaRef.current.value = insight.suggestedPrompt;
        textareaRef.current.focus();
      }
    } else if (insight.actionType === 'OPEN_VITALS' || insight.actionType === 'OPEN_EVOLUTION') {
      setIsAutonomousImprovementModalOpen(true);
    }
  };

  // みき自律自動検証パイプライン: アシスタントからコードが生成されたら全自動でTDDテスト・構文検査・依存関係スキャンを実行
  useEffect(() => {
    const assistantMsgsWithCode = messages.filter(
      (m) =>
        m.role === 'assistant' &&
        !m.isStreaming &&
        (m.content.includes('```typescript') ||
          m.content.includes('```ts') ||
          m.content.includes('```javascript') ||
          m.content.includes('```tsx') ||
          m.content.includes('```jsx'))
    );
    assistantMsgsWithCode.forEach((msg) => {
      if (autonomousVerifications[msg.id]) return;
      const blocks = extractCodeBlocks(msg.content);
      if (blocks.length === 0) return;

      const targetBlock = blocks[0];
      mikiSelfCodingSuperchargerService
        .runAutonomousVerificationPipeline(targetBlock.content, targetBlock.name, workspaceFiles)
        .then((result: any) => {
          setAutonomousVerifications((prev) => ({
            ...prev,
            [msg.id]: result.verification,
          }));
        })
        .catch(() => {});
    });
  }, [messages, workspaceFiles, autonomousVerifications]);

  const handleOpenUnitTest = (codeBlock: { name: string; content: string }) => {
    setTestModalState({
      isOpen: true,
      fileName: codeBlock.name,
      code: codeBlock.content,
    });
  };

  const handleOpenDiffPreview = (codeBlock: { name: string; content: string; language: string }) => {
    const existing = workspaceFiles.find(
      (f) => f.name === codeBlock.name || f.path === codeBlock.name || f.path.endsWith('/' + codeBlock.name)
    );
    const oldCode = existing ? existing.content : '';
    const filePath = existing ? existing.path : (codeBlock.name.startsWith('src/') ? codeBlock.name : `src/${codeBlock.name}`);
    setDiffModalState({
      isOpen: true,
      fileName: codeBlock.name,
      oldCode,
      newCode: codeBlock.content,
      filePath,
    });
  };

  const handleApplyDiffCode = (appliedCode: string) => {
    if (!diffModalState) return;
    onApplyCode([
      {
        name: diffModalState.fileName,
        path: diffModalState.filePath,
        content: appliedCode,
        language: 'typescript',
      },
    ]);
    if (onOpenGamePreview) onOpenGamePreview();
    setDiffModalState(null);
  };

  useEffect(() => {
    // リアルタイム行動ログ＆ステップのPub/Subリスナー登録
    const unsubStep = systemLogger.subscribeStep((step) => {
      setLatestLiveStep(step);
    });
    const unsubLog = systemLogger.subscribeLog((entry) => {
      if (entry.category === 'STEP' || entry.category === 'INFERENCE' || entry.category === 'SELF_IMPROVEMENT') {
        setLiveLogMessage(entry.message.replace(/^▶\s*/, ''));
      }
    });

    return () => {
      unsubStep();
      unsubLog();
    };
  }, []);

  useEffect(() => {
    // 未確認の自律成長レポートを取得
    const rep = autonomousEvolutionService.getLatestUnviewedReport();
    if (rep) {
      setUnviewedGrowthReport(rep);
    }
    // 第31章 状態初期化
    setBranches(conversationBranchService.getAllBranches());
    setActiveBranchId(conversationBranchService.getActiveBranchId());
    setTasks(conversationTaskboardService.getAllTasks());
    setProactiveLevel(conversationTaskboardService.getProactiveLevel());
    setExplanationOverride(conversationTaskboardService.getExplanationOverride());
  }, []);

  const handleDismissGrowthReport = (reportId: string) => {
    autonomousEvolutionService.markReportAsViewed(reportId);
    setUnviewedGrowthReport(null);
    setShowGrowthDetail(false);
  };

  const handleSimulateIdleEvolution = async () => {
    setIsSimulatingEvolution(true);
    try {
      const rep = await autonomousEvolutionService.runIdleEvolutionCycle();
      setUnviewedGrowthReport(rep);
      setShowGrowthDetail(true);
    } catch (e: any) {
      console.warn('Simulate evolution failed', e);
    } finally {
      setIsSimulatingEvolution(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSendTimeRef = useRef<number>(0);

  const PUBLIC_APP_URL =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin.replace('ais-dev-', 'ais-pre-')
      : 'https://ais-pre-3wfkdwmq4s7d422alblgnd-387287333639.asia-northeast1.run.app';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyPublicUrl = () => {
    navigator.clipboard.writeText(PUBLIC_APP_URL);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2500);
  };

  const handleSend = (e?: React.FormEvent | React.MouseEvent | React.TouchEvent | React.PointerEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastSendTimeRef.current < 600) {
      // Debounce rapid duplicate touch/click events on mobile
      return;
    }

    const domValue = textareaRef.current?.value ?? '';
    const textToSend = (domValue || inputText || '').trim();

    if ((!textToSend && attachedFiles.length === 0) || isLoading || isGenerating) return;

    lastSendTimeRef.current = now;

    // 設計思想 第28章 28.4: ユーザー理解度追従型・専門用語出現頻度をドメイン別解析
    if (textToSend) {
      userProficiencyService.analyzeUserUtterance(textToSend);
      // 設計思想 第35/54章: 能動知覚OS・作業コンテキスト＆認知疲労状態の同期
      proactiveContextOsService.perceiveCurrentContext(textToSend);
    }

    // 設計思想 第31章 31.1: ライブ会話リペアトリガー検知 (違う/長い/結論は？等の即時修復)
    let augmentedText = textToSend;
    if (textToSend) {
      const repairCheck = liveConversationRepairService.detectRepairTrigger(textToSend);
      if (repairCheck.isRepair && repairCheck.triggerType) {
        const lastAiMsg = [...messages].reverse().find((m) => m.role === 'assistant' || m.sender === 'ai' || m.sender === 'assistant');
        if (lastAiMsg) {
          const repairDirective = liveConversationRepairService.generateRepairSystemPrompt(
            repairCheck.triggerType,
            lastAiMsg.content,
            textToSend
          );
          augmentedText = `${textToSend}\n${repairDirective}`;
          liveConversationRepairService.recordRepair(
            lastAiMsg.id,
            textToSend,
            repairCheck.triggerType,
            lastAiMsg.content,
            '修正回答生成中...',
            repairCheck.intentAdvice || '意図再推定'
          );
          setLiveRepairAlert({
            trigger: repairCheck.triggerType,
            advice: repairCheck.intentAdvice || '意図を再計算して修正回答を導出中',
          });
          setTimeout(() => setLiveRepairAlert(null), 6000);
        }
      }
    }

    systemLogger.info('CHAT', `[UIイベント] チャット送信トリガー発火 (文字数: ${textToSend.length}, 添付: ${attachedFiles.length}件, モード: ${engineMode})`, {
      textSnippet: textToSend.slice(0, 80),
      attachedFiles: attachedFiles.map((a) => ({ name: a.name, size: a.size })),
      speakerMode,
      engineMode,
    });

    onSendMessage(augmentedText, attachedFiles.length > 0 ? attachedFiles : undefined);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
    setAttachedFiles([]);
  };

  // メッセージ更新時の自動タスク抽出 (31.10) とインスペクター自動生成 (31.3)
  useEffect(() => {
    if (messages.length >= 2) {
      const last = messages[messages.length - 1];
      const prev = messages[messages.length - 2];
      if (
        (last.role === 'assistant' || last.sender === 'ai' || last.sender === 'assistant') &&
        (prev.role === 'user' || prev.sender === 'user')
      ) {
        const extracted = conversationTaskboardService.extractTasksFromTurn(prev.content, last.content, last.id);
        if (extracted.length > 0) {
          setTasks(conversationTaskboardService.getAllTasks());
        }
        // インスペクションレコードの事前生成
        whyAnswerInspectorService.generateAndSaveInspection({
          turnId: last.id,
          userPrompt: prev.content,
          aiResponse: last.content,
          answerPlanType: last.answerPlan ? `${last.answerPlan.planType} (${last.answerPlan.coreFocus})` : undefined,
          activeMemories: last.usedMemories?.map((m) => ({ id: m.id, content: m.content })),
          usedTools: last.executedTools?.map((t) => t.toolName),
          explanationLevel: userProficiencyService.getExplanationAdvice('general').recommendedLevel,
        });
      }
    }
    conversationBranchService.syncCurrentBranchMessages(messages);
  }, [messages]);

  // 第31章 31.2: ブランチ操作ハンドラー
  const handleForkFromMessage = (msgId: string) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    const snippet = targetMsg?.content?.slice(0, 20) || '指定地点';
    const newBranch = conversationBranchService.forkBranch(
      activeBranchId,
      msgId,
      messages,
      `分岐: ${snippet}...`,
      `メッセージ [${msgId}] から分岐した仮説検討`
    );
    setBranches(conversationBranchService.getAllBranches());
    setActiveBranchId(newBranch.id);
    setIsBranchModalOpen(true);
  };

  const handleSwitchBranch = (branchId: string) => {
    const target = conversationBranchService.switchBranch(branchId);
    if (target) {
      setActiveBranchId(branchId);
      setBranches(conversationBranchService.getAllBranches());
    }
  };

  const handleMergeBranch = (sourceBranchId: string) => {
    const res = conversationBranchService.mergeIntoMain(sourceBranchId);
    if (res.success) {
      setActiveBranchId('branch_main');
      setBranches(conversationBranchService.getAllBranches());
    }
  };

  const handleDeleteBranch = (branchId: string) => {
    conversationBranchService.deleteBranch(branchId);
    setBranches(conversationBranchService.getAllBranches());
    setActiveBranchId(conversationBranchService.getActiveBranchId());
  };

  const handleCreateBranch = (name: string, note?: string) => {
    const latestId = messages.length > 0 ? messages[messages.length - 1].id : 'root';
    const newBranch = conversationBranchService.forkBranch(activeBranchId, latestId, messages, name, note);
    setBranches(conversationBranchService.getAllBranches());
    setActiveBranchId(newBranch.id);
  };

  // 第31章 31.10 / 31.14 / 31.15: タスクボード＆設定ハンドラー
  const handleUpdateTaskStatus = (taskId: string, status: 'BACKLOG' | 'IN_PROGRESS' | 'COMPLETED') => {
    conversationTaskboardService.updateTaskStatus(taskId, status);
    setTasks(conversationTaskboardService.getAllTasks());
  };

  const handleDeleteTask = (taskId: string) => {
    conversationTaskboardService.deleteTask(taskId);
    setTasks(conversationTaskboardService.getAllTasks());
  };

  const handleAddTask = (params: any) => {
    conversationTaskboardService.addTask(params);
    setTasks(conversationTaskboardService.getAllTasks());
  };

  const handleSetProactiveLevel = (lvl: ProactiveSuggestionLevel) => {
    conversationTaskboardService.setProactiveLevel(lvl);
    setProactiveLevel(lvl);
  };

  const handleSetExplanationOverride = (ov: ManualExplanationOverride) => {
    conversationTaskboardService.setExplanationOverride(ov);
    setExplanationOverride(ov);
  };

  // 第31章 31.3: なぜこの回答？インスペクター表示ハンドラー
  const handleOpenWhyInspector = (msg: ChatMessage) => {
    let ins = whyAnswerInspectorService.getInspection(msg.id);
    if (!ins) {
      const idx = messages.findIndex((m) => m.id === msg.id);
      const prevUser = idx > 0 ? messages[idx - 1].content : 'ユーザーの質問';
      ins = whyAnswerInspectorService.generateAndSaveInspection({
        turnId: msg.id,
        userPrompt: prevUser,
        aiResponse: msg.content,
        answerPlanType: msg.answerPlan ? `${msg.answerPlan.planType} (${msg.answerPlan.coreFocus})` : undefined,
        activeMemories: msg.usedMemories?.map((m) => ({ id: m.id, content: m.content })),
        usedTools: msg.executedTools?.map((t) => t.toolName),
        explanationLevel: userProficiencyService.getExplanationAdvice('general').recommendedLevel,
      });
    }
    setSelectedInspection(ins);
    setIsInspectionModalOpen(true);
  };

  const handleSafeStop = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Prevent accidental stop triggered by finger release right after tapping send (under 750ms)
    const elapsedSinceSend = Date.now() - lastSendTimeRef.current;
    if (elapsedSinceSend < 750) {
      systemLogger.warn('CHAT', `送信直後の誤タッチによる停止要求をブロックしました (経過時間: ${elapsedSinceSend}ms)`);
      return;
    }
    systemLogger.info('CHAT', 'ユーザーが「停止」ボタンを押しました。');
    onStopGeneration?.();
  };

  const handleFeedback = (msg: ChatMessage, type: 'good' | 'bad', reason?: string) => {
    msg.userFeedback = type;
    if (reason) msg.feedbackNote = reason;

    // 記憶の評価スコアを更新
    if (msg.usedMemories && msg.usedMemories.length > 0 && typeof onUpdateMemories === 'function') {
      const usedIds = new Set(msg.usedMemories.map((m) => m.id));
      (onUpdateMemories as any)((prev: MemoryItem[]) => {
        const list = Array.isArray(prev) ? prev : memories;
        return list.map((mem) => {
          if (usedIds.has(mem.id)) {
            return {
              ...mem,
              goodCount: type === 'good' ? (mem.goodCount ?? 0) + 1 : mem.goodCount,
              badCount: type === 'bad' ? (mem.badCount ?? 0) + 1 : mem.badCount,
            };
          }
          return mem;
        });
      });
    }

    // 該当アシスタント応答の直前にあるユーザーメッセージを特定
    const msgIndex = messages.findIndex((m) => m.id === msg.id);
    let userPrompt = '直前の会話指示';
    if (msgIndex > 0) {
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userPrompt = messages[i].content;
          break;
        }
      }
    }

    // 適用されたスキルの成功/失敗カウントを更新（50章: 文脈の多様性検証のためにuserPromptを連携）
    if (msg.usedSkills && msg.usedSkills.length > 0) {
      msg.usedSkills.forEach((s) => {
        skillsService.recordExecutionResult(s.id, type === 'good', userPrompt);
      });
    }

    // 学習データ / 自己改善データへ追加
    if (type === 'good') {
      const added = selfImprovementService.addTrainingSample({
        instruction: userPrompt,
        outputTarget: msg.content,
        category: msg.content.includes('```') ? 'code' : 'chat',
        reliability: 'high',
        approved: true,
      });
      if (added) {
        systemLogger.info('SELF_IMPROVEMENT', 'ユーザーから高評価(👍)を受信。安全検査通過済みColab/LoRA用高品質教材に自動登録しました。');

        // 設計思想 第28章 28.3: コード骨格の実績テンプレート化連携
        if (msg.content.includes('```')) {
          const codeBlocks = extractCodeBlocks(msg.content);
          if (codeBlocks.length > 0) {
            const firstBlock = codeBlocks[0];
            const lang = (firstBlock.language || 'typescript').toLowerCase();
            if (['vba', 'typescript', 'python', 'sql'].includes(lang)) {
              systemLogger.info('SELF_IMPROVEMENT', `[第28.3章 実績コード骨格候補] ${lang.toUpperCase()} コードを高評価骨格テンプレート候補として記録しました。`);
            }
          }
        }
      } else {
        systemLogger.warn('SELF_IMPROVEMENT', 'ユーザー高評価(👍)を受信しましたが、コンテンツ安全境界フィルタにより教材登録から除外・ログ記録されました。');
      }
    } else {
      if (msg.completionEvaluation?.autoDiagnosedAt) {
        systemLogger.info(
          'SELF_IMPROVEMENT',
          'この応答は既に完了判定(48章)により自動診断済みのため、👎による重複登録をスキップしました。'
        );
      } else {
        selfImprovementService.diagnoseFailure(
          userPrompt,
          msg.content,
          reason || 'ユーザー低評価フィードバック',
          {
            memoriesUsedCount: (msg.usedMemories || []).length,
            promptLengthChars: 1200,
            engineMode: msg.engineMode || 'native_gpu',
          }
        );
        systemLogger.warn('SELF_IMPROVEMENT', `ユーザーから低評価(👎)を受信 (理由: ${reason || '未指定'})。改善ルーターに記録しました。`);
      }
    }

    setFeedbackFeedbackId(null);
  };

  // 設計思想 47章: ワークフロー自律実行ハンドラ
  const handleExecuteWorkflow = async (workflowId: string) => {
    if (executingWorkflowId) return;
    setExecutingWorkflowId(workflowId);
    setWorkflowStatusMessage((prev) => ({ ...prev, [workflowId]: '🚀 ワークフローを順次自律実行中...' }));

    try {
      const res = await workflowSynthesisService.executeAllSteps(workflowId, (updatedWf) => {
        setWorkflowStatusMessage((prev) => ({
          ...prev,
          [workflowId]: `進捗: ${updatedWf.steps.filter((s) => s.status === 'completed').length}/${updatedWf.steps.length} 工程完了`,
        }));
      });

      if (res && res.status === 'completed') {
        setWorkflowStatusMessage((prev) => ({
          ...prev,
          [workflowId]: '🎉 全工程の自律ワークフローが安全に完了しました！',
        }));
      } else {
        setWorkflowStatusMessage((prev) => ({
          ...prev,
          [workflowId]: '⚠️ 一部工程で確認または権限同意が必要です。',
        }));
      }
    } catch (e: any) {
      setWorkflowStatusMessage((prev) => ({
        ...prev,
        [workflowId]: `❌ 実行時エラー: ${e?.message || e}`,
      }));
    } finally {
      setExecutingWorkflowId(null);
    }
  };

  const handleExecuteWorkflowStep = async (workflowId: string, stepId: string) => {
    try {
      const res = await workflowSynthesisService.executeStep(workflowId, stepId);
      if (res.success) {
        setWorkflowStatusMessage((prev) => ({
          ...prev,
          [workflowId]: `✓ ステップが完了しました: ${res.resultExcerpt}`,
        }));
      } else if (res.requiresConsent) {
        setWorkflowStatusMessage((prev) => ({
          ...prev,
          [workflowId]: `⚠️ 46章 権限ゲート: プラグインの実行権限同意が必要です (自己改善モーダル ➔ 能力プラグインから有効化できます)。`,
        }));
      } else {
        setWorkflowStatusMessage((prev) => ({
          ...prev,
          [workflowId]: `❌ 失敗: ${res.error}`,
        }));
      }
    } catch (e: any) {
      setWorkflowStatusMessage((prev) => ({
        ...prev,
        [workflowId]: `❌ エラー: ${e?.message || e}`,
      }));
    }
  };

  // 設計思想 49章: メッセージを手動で経験保存先ルーターに判定・仕分けする
  const handleRouteMessageExperience = (msg: ChatMessage) => {
    const res = experienceRouterService.routeExperience(
      {
        content: msg.content,
        source: 'conversation',
        category: msg.content.includes('```') ? 'code' : 'chat',
      },
      memories
    );

    const destLabelMap: Record<string, string> = {
      working_memory: '作業記憶',
      long_term_memory: '長期記憶',
      project_memory: 'プロジェクト記憶',
      skill: 'スキル',
      search_policy: '検索ポリシー',
      evaluation_set: '評価セット',
      lora_dataset: 'LoRA教材',
      quarantine: '安全隔離',
      discard_candidate: '破棄候補',
    };

    setExperienceToast({
      msgId: msg.id,
      text: `🧭 49章 判定結果: 【${destLabelMap[res.destination] || res.destination}】に仕分け推奨 (${res.reason})`,
    });
    setTimeout(() => setExperienceToast(null), 5000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSend(e);
    }
  };

  // Handle File Upload (Drag & Drop or Manual)
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(async (file) => {
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const result = await extractFilesFromZip(file);
          if (result.success && result.files.length > 0) {
            // フォルダ構造(path)を保持したままワークスペースへ展開
            if (onApplyCode) {
              onApplyCode(
                result.files.map((f) => ({
                  path: f.path,
                  name: f.name,
                  content: f.content,
                  language: f.language || 'text',
                }))
              );
            }

            const summary = `📦 ZIP アーカイブ「${file.name}」から ${result.files.length} 件のファイルをワークスペースに解凍・展開しました（フォルダ数: ${result.folders.length}個${result.rootPrefix ? `, ルートプレフィックス: ${result.rootPrefix}` : ''}）。\n\n展開したファイル構造:\n${result.files.slice(0, 30).map((f) => `• ${f.path}`).join('\n')}${result.files.length > 30 ? `\n...他 ${result.files.length - 30} 件` : ''}\n\nコードタブやプレビューで即座に動作確認できます。`;

            setAttachedFiles((prev) => [
              ...prev,
              {
                name: file.name,
                content: summary,
                type: 'application/zip',
                size: file.size,
              },
            ]);
          } else {
            throw new Error(result.error || '解凍可能なファイルが見つかりませんでした');
          }
        } catch (zipErr: any) {
          console.warn('ZIP parse error:', zipErr);
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              content: `ZIP アーカイブ (${file.name}, ${Math.round(file.size / 1024)} KB) の展開に失敗しました: ${zipErr?.message || 'エラー'}`,
              type: 'application/zip',
              size: file.size,
            },
          ]);
        }
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              content: (e.target?.result as string) || '',
              type: file.type,
              size: file.size,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              content: (e.target?.result as string) || '',
              type: file.type || 'text/plain',
              size: file.size,
            },
          ]);
        };
        reader.readAsText(file);
      }
    });
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // TTS Web Speech Synthesizer
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/```[\s\S]*?```/g, 'コードを作成したよ。').replace(/[#*_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.05;
    utterance.pitch = 1.2;
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyBlocks = (markdown: string, msgId: string) => {
    const extracted = extractCodeBlocks(markdown);
    if (extracted.length > 0) {
      onApplyCode(extracted);
      setAppliedId(msgId);
      setTimeout(() => setAppliedId(null), 2500);
      if (onOpenGamePreview) {
        onOpenGamePreview();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 relative select-text">
      {/* Chat Header Toolbar */}
      <div className="bg-slate-950/80 border-b border-slate-800/80 shrink-0">
        {/* Row 1: Assistant Personality Focus & Streamlined Actions */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>

            {/* Model / Personality Focus Selector */}
            <select
              value={speakerMode}
              onChange={(e) => setSpeakerMode(e.target.value)}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-medium rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500/60 transition-colors cursor-pointer"
            >
              <option value="miki">🌸 通常・総合対話</option>
              <option value="qwen_coder">💻 コード開発</option>
              <option value="deepseek_logic">🧩 原因分析・推論</option>
              <option value="gpu_shader">⚡ WebGPU・シェーダー</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tools drawer toggle */}
            <button
              onClick={() => setShowToolsRow(!showToolsRow)}
              className={`px-2 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition-all ${
                showToolsRow
                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40 shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
              title="詳細ツール・ブランチ・タスクを展開"
            >
              <Wrench className="w-3 h-3" />
              <span>ツール</span>
              {showToolsRow ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </button>

            {/* Voice toggle button */}
            <button
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (!voiceEnabled) speakText('音声読み上げをオンにしたよ！何でも話してね✨');
                else window.speechSynthesis?.cancel();
              }}
              className={`p-1.5 rounded-lg border transition-all shadow-xs ${
                voiceEnabled
                  ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
              title="音声読み上げ (TTS)"
            >
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Clear history */}
            <button
              onClick={onClearHistory}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-slate-700 transition-all shadow-xs"
              title="会話履歴をクリア"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Clean Studio Tool Chips (Collapsible to save mobile screen space) */}
        {showToolsRow && (
          <div className="px-3 pb-2 pt-0.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-slate-800/40 animate-in fade-in">
          {/* 第31.2章 会話ブランチボタン */}
          <button
            onClick={() => setIsBranchModalOpen(true)}
            className="px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all bg-slate-900 hover:bg-slate-800/90 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700 shrink-0 shadow-xs"
            title="第31.2章 会話分岐・巻き戻し (仮説ブランチ並列検証)"
          >
            <GitBranch className="w-3 h-3 text-violet-400" />
            <span className="truncate max-w-[80px]">
              {branches.find((b) => b.id === activeBranchId)?.name || '本線'}
            </span>
          </button>

          {/* 第31.10章 タスクボードボタン */}
          <button
            onClick={() => setIsTaskboardModalOpen(true)}
            className="px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all bg-slate-900 hover:bg-slate-800/90 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700 shrink-0 shadow-xs"
            title="第31.10章 会話タスクボード & 31.14/31.15章設定"
          >
            <CheckSquare className="w-3 h-3 text-emerald-400" />
            <span>タスク ({tasks.filter((t) => t.status !== 'COMPLETED').length})</span>
          </button>

          {/* リアルタイム行動モニターボタン */}
          <button
            onClick={() => setIsActivityMonitorOpen(true)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all shrink-0 shadow-xs ${
              isLoading || isGenerating
                ? 'bg-pink-950/40 text-pink-200 border-pink-500/40 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800/90 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
            }`}
            title="みきが今リアルタイムに何をしているか（推論工程・記憶検索・自己改善）を秒単位でライブ監視"
          >
            <Activity className={`w-3 h-3 ${isLoading || isGenerating ? 'animate-spin text-pink-400' : 'text-indigo-400'}`} />
            <span>{isLoading || isGenerating ? '推論実行中...' : 'リアルタイム行動'}</span>
          </button>

          {/* Self Improvement Lab Button */}
          {onOpenSelfImprovementModal && (
            <button
              onClick={onOpenSelfImprovementModal}
              className="px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all bg-slate-900 hover:bg-slate-800/90 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700 shrink-0 shadow-xs"
              title="設計思想指示書 & 自己コード改善研究所"
            >
              <Compass className="w-3 h-3 text-indigo-400" />
              <span>自己コード改善</span>
            </button>
          )}

          {/* Idle Evolution Trigger Button */}
          <button
            onClick={handleSimulateIdleEvolution}
            disabled={isSimulatingEvolution}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all shrink-0 shadow-xs ${
              isSimulatingEvolution
                ? 'bg-slate-900 text-slate-500 border-slate-800'
                : 'bg-slate-900 hover:bg-slate-800/90 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
            }`}
            title="第19章 放置型自律進化（反省・定石蒸留・宿題調査・ドリル）を今すぐ実行"
          >
            {isSimulatingEvolution ? (
              <RotateCw className="w-3 h-3 animate-spin text-emerald-400" />
            ) : (
              <Sparkles className="w-3 h-3 text-emerald-400" />
            )}
            <span>{isSimulatingEvolution ? '進化中...' : '自律進化'}</span>
          </button>

          {/* みき全方位認知ヘルス＆内省日誌ボタン */}
          <button
            onClick={() => setIsAutonomousImprovementModalOpen(true)}
            className="px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all bg-slate-900 hover:bg-slate-800/90 text-purple-300 hover:text-white border-purple-900/40 hover:border-purple-700 shrink-0 shadow-xs"
            title="みきの全方位認知ヘルスレーダー（健康度スコア）＆内省日誌を開く"
          >
            <HeartPulse className="w-3 h-3 text-pink-400" />
            <span>認知ヘルス</span>
          </button>
        </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
      >
        {/* 第19章 放置型自律進化 お出迎え成長バナー */}
        {unviewedGrowthReport && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/70 border border-emerald-500/40 shadow-lg text-slate-100 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                      第19章 放置型自律進化成果
                    </span>
                    <span className="text-[10.5px] text-slate-400">
                      {new Date(unviewedGrowthReport.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 完了
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-100 mt-1">
                    「{unviewedGrowthReport.welcomeGreetingCandidate}」
                  </h4>
                </div>
              </div>

              <button
                onClick={() => handleDismissGrowthReport(unviewedGrowthReport.id)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors shrink-0"
              >
                了解！
              </button>
            </div>

            {/* Growth Metrics Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">反省・教訓</span>
                <span className="font-bold text-rose-400">{unviewedGrowthReport.reflectionsCount} 件</span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">蒸留された定石</span>
                <span className="font-bold text-amber-400">{unviewedGrowthReport.distilledRulesCount} 件</span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">解決した宿題</span>
                <span className="font-bold text-sky-400">{unviewedGrowthReport.resolvedHomeworkCount} 件</span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">ドリル熟達度</span>
                <span className="font-bold text-emerald-400">{Math.round(unviewedGrowthReport.masteryScore * 100)}%</span>
              </div>
            </div>

            {/* Expand / Collapse Details */}
            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between">
              <button
                onClick={() => setShowGrowthDetail(!showGrowthDetail)}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <span>{showGrowthDetail ? '成長詳細をたたむ' : '留守中に学んだ詳細を見る'}</span>
                {showGrowthDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {onOpenSelfImprovementModal && (
                <button
                  onClick={onOpenSelfImprovementModal}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  自己改善研究所で全ログを確認 ➔
                </button>
              )}
            </div>

            {showGrowthDetail && (
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-2.5 mt-2">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 mb-1">自律進化ハイライト:</div>
                  <ul className="space-y-1">
                    {unviewedGrowthReport.growthHighlights.map((h, i) => (
                      <li key={i} className="text-[11.5px] text-slate-300 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {unviewedGrowthReport.details?.resolvedTopics && unviewedGrowthReport.details.resolvedTopics.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] font-bold text-sky-400">解決完了した宿題: </span>
                    <span className="text-slate-300">{unviewedGrowthReport.details.resolvedTopics.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const codeBlocks = !isUser ? extractCodeBlocks(msg.content) : [];
          const hasCode = codeBlocks.length > 0;
          const speakerName = msg.speaker?.name || (isUser ? persona.userNickname : persona.name);
          const speakerAvatar = msg.speaker?.avatar || (isUser ? '👤' : persona.avatar);
          const speakerColor = msg.speaker?.color || '#f43f5e';

          return (
            <div key={msg.id} className={`flex gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-base shadow-md shrink-0 select-none"
                  style={{
                    background: `linear-gradient(135deg, ${speakerColor}, #3b82f6)`,
                    boxShadow: `0 4px 12px ${speakerColor}33`,
                  }}
                >
                  {speakerAvatar}
                </div>
              )}

              <div className={`max-w-[92%] sm:max-w-[86%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Message Header info */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                  <span className="font-bold text-slate-200">{speakerName}</span>
                  {msg.speaker?.roleName && (
                    <span
                      className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold border"
                      style={{
                        color: speakerColor,
                        borderColor: `${speakerColor}55`,
                        backgroundColor: `${speakerColor}15`,
                      }}
                    >
                      {msg.speaker.roleName}
                    </span>
                  )}
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Processing Speed, Engine stats & 10-Step Telemetry Toggle */}
                {!isUser && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {(msg.metrics?.engine || msg.metrics?.tokensPerSec || msg.metrics?.ttftMs) && (
                      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-2.5 py-0.5 rounded-lg text-[10px] text-slate-400 font-mono shadow-sm">
                        <span className="text-pink-400 font-bold flex items-center gap-1 font-sans">
                          {msg.metrics?.engine && msg.metrics.engine.includes('WebGPU') ? (
                            <>
                              <Cpu className="w-3 h-3 text-purple-400" />
                              <span className="text-purple-300 font-bold">{msg.metrics.engine}</span>
                            </>
                          ) : msg.metrics?.engine && msg.metrics.engine.includes('Gemini') ? (
                            <>
                              <Sparkles className="w-3 h-3 text-sky-400" />
                              <span className="text-sky-300 font-bold">{msg.metrics.engine}</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 text-amber-400" />
                              <span className="text-amber-300 font-bold">{msg.metrics?.engine || 'CPUルールベース'}</span>
                            </>
                          )}
                        </span>
                        {msg.metrics?.ttftMs ? <span>⚡ 応答: {msg.metrics.ttftMs}ms</span> : null}
                        {msg.metrics?.tokensPerSec ? (
                          <span className="text-emerald-400 font-bold">({msg.metrics.tokensPerSec} tok/s)</span>
                        ) : null}
                      </div>
                    )}

                    {/* Interactive 10-Step Telemetry Inspector Button */}
                    {msg.executionSteps && msg.executionSteps.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedStepsMsgId(expandedStepsMsgId === msg.id ? null : msg.id)
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-mono flex items-center gap-1 transition-all border ${
                          expandedStepsMsgId === msg.id
                            ? 'bg-sky-950 text-sky-200 border-sky-400/50 shadow-sm'
                            : 'bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-sky-300 border-slate-800'
                        }`}
                        title="送信から返信までの10工程リアルタイムログを展開して確認"
                      >
                        <Activity className="w-3 h-3 text-sky-400" />
                        <span>
                          {expandedStepsMsgId === msg.id ? '工程ログを閉じる' : `10工程ログ (${msg.executionSteps.length}/10)`}
                        </span>
                        {expandedStepsMsgId === msg.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    {/* 外部ローカルLLM 推論遅延・TTFT・キャッシュ診断バッジ */}
                    {msg.externalLlmDiagnostic && (
                      <button
                        onClick={() =>
                          setExpandedExternalDiagMsgId(
                            expandedExternalDiagMsgId === msg.id ? null : msg.id
                          )
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-mono flex items-center gap-1 transition-all border ${
                          expandedExternalDiagMsgId === msg.id
                            ? 'bg-indigo-900 text-indigo-100 border-indigo-400 shadow-sm'
                            : msg.externalLlmDiagnostic.comparisonWithPrevious?.verdict === 'cache_hit'
                            ? 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border-emerald-700/80'
                            : msg.externalLlmDiagnostic.comparisonWithPrevious?.verdict === 'no_cache'
                            ? 'bg-rose-950/90 hover:bg-rose-900 text-rose-300 border-rose-700/80'
                            : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border-indigo-800/80'
                        }`}
                        title="外部LLMのStage A〜E遅延細分化、TTFT実測、KVキャッシュ判定を展開"
                      >
                        <Terminal className="w-3 h-3 text-indigo-400" />
                        <span>
                          外部LLM診断 (TTFT: {msg.externalLlmDiagnostic.observedTtftMs}ms
                          {msg.externalLlmDiagnostic.comparisonWithPrevious?.verdict === 'cache_hit' ? ' / ⚡Hit' : ''})
                        </span>
                        {expandedExternalDiagMsgId === msg.id ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    {/* Used Memories (RAG) Badge */}
                    {msg.usedMemories && msg.usedMemories.length > 0 && (
                      <div className="flex items-center gap-1 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-lg text-[9.5px] text-purple-300 font-mono" title={msg.usedMemories.map((m) => `・${m.content}`).join('\n')}>
                        <Brain className="w-3 h-3 text-purple-400" />
                        <span>記憶参照 ({msg.usedMemories.length}件)</span>
                      </div>
                    )}

                    {/* Used Skills Badge */}
                    {msg.usedSkills && msg.usedSkills.length > 0 && (
                      <div className="flex items-center gap-1 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-lg text-[9.5px] text-sky-300 font-mono" title={msg.usedSkills.map((s) => s.name).join(', ')}>
                        <Wrench className="w-3 h-3 text-sky-400" />
                        <span>スキル適用: {msg.usedSkills[0].name}</span>
                      </div>
                    )}

                    {/* Executed Tools Badge (:feature:tools) */}
                    {msg.executedTools && msg.executedTools.length > 0 && (
                      <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-lg text-[9.5px] text-emerald-300 font-mono" title={msg.executedTools.map((t) => `・${t.toolName}: ${t.outputSummary} (${t.executionTimeMs}ms)`).join('\n')}>
                        <Cpu className="w-3 h-3 text-emerald-400" />
                        <span>ツール実行 ({msg.executedTools.length}件)</span>
                      </div>
                    )}

                    {/* Pending Tool Confirmation Badge (:feature:tools) */}
                    {msg.pendingToolConfirmation && (
                      <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-500/70 px-2 py-0.5 rounded-lg text-[9.5px] text-amber-300 font-mono animate-pulse" title="破壊的操作の承認待ち">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>要承認ツール</span>
                      </div>
                    )}

                    {/* 設計思想 第3段階: 回答品質・回答長・直接回答バッジ */}
                    {msg.responseQuality && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border ${
                          msg.responseQuality.passed
                            ? 'bg-teal-950/60 border-teal-800/60 text-teal-300'
                            : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                        }`}
                        title={`【設計思想 第3段階: 回答品質・三段階分離】\n・選定回答長: ${msg.responseQuality.lengthCategory.toUpperCase()} (${msg.responseQuality.actualLengthChars}文字 / ${msg.responseQuality.lengthCompliant ? '文字数適合' : '文字数要調整'})\n・質問への直接回答: ${msg.responseQuality.directAnswerFirst ? '結論ファースト' : '前置きあり'}\n・重複文削除: ${msg.responseQuality.duplicatesRemovedCount}件\n・自然日本語化: ${msg.responseQuality.unnaturalPhrasesFixed}件\n${msg.responseQuality.feedback.length > 0 ? `・フィードバック: ${msg.responseQuality.feedback.join(' / ')}` : ''}`}
                      >
                        <AlignLeft className="w-3 h-3 text-teal-400" />
                        <span>
                          {msg.responseQuality.lengthCategory.toUpperCase()} ({msg.responseQuality.actualLengthChars}字)
                          {msg.responseQuality.duplicatesRemovedCount > 0 && ` 重複-${msg.responseQuality.duplicatesRemovedCount}`}
                        </span>
                      </div>
                    )}

                    {/* 設計思想 第5段階 (10章): コード・VBA安全準備ゲートバッジ */}
                    {msg.codeVerification && msg.codeVerification.hasCode && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border ${
                          msg.codeVerification.safetyLevel === 'PASS_SAFE'
                            ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                            : msg.codeVerification.safetyLevel === 'WARN_REVIEW_NEEDED'
                            ? 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                            : 'bg-rose-950/60 border-rose-800/60 text-rose-300'
                        }`}
                        title={`【設計思想 10章: コード・VBA安全準備ゲート】\n・言語: ${msg.codeVerification.languages.join(', ') || 'コード'}\n・安全スコア: ${msg.codeVerification.safetyScore}点 (${msg.codeVerification.safetyLevel})\n・準備ステータス: ${msg.codeVerification.readiness}\n・構文整合性: ${msg.codeVerification.syntaxValid ? 'OK' : 'エラーあり'}${msg.codeVerification.syntaxErrors.length > 0 ? ` (${msg.codeVerification.syntaxErrors.join(' / ')})` : ''}\n・検知リスク: ${msg.codeVerification.risks.length > 0 ? msg.codeVerification.risks.map((r) => r.description).join(' / ') : 'なし'}\n・環境前提: ${msg.codeVerification.environmentRequirements.join(' / ') || 'なし'}`}
                      >
                        <ShieldCheck className={`w-3 h-3 ${msg.codeVerification.safetyLevel === 'PASS_SAFE' ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span>
                          {msg.codeVerification.languages[0]?.toUpperCase() || 'CODE'}安全 {msg.codeVerification.safetyScore}点
                          {msg.codeVerification.readiness === 'EXTERNAL_TEST_REQUIRED' ? ' (外部検証要)' : ''}
                        </span>
                      </div>
                    )}

                    {/* 設計思想 第5段階 (15-16章): 内的自己反証・エッジケース検証バッジ */}
                    {msg.falsificationReport && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border ${
                          msg.falsificationReport.passed
                            ? 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300'
                            : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                        }`}
                        title={`【設計思想 15-16章: 内的自己反証テスト】\n・反証スコア: ${msg.falsificationReport.falsificationScore}点 (${msg.falsificationReport.passed ? '堅牢性合格' : '警告・改善点あり'})\n${msg.falsificationReport.checks.map((c) => `・${c.title}: [${c.status.toUpperCase()}] ${c.detail}`).join('\n')}\n${msg.falsificationReport.suggestedMitigations.length > 0 ? `・推奨緩和策: ${msg.falsificationReport.suggestedMitigations.join(' / ')}` : ''}`}
                      >
                        <SearchCheck className="w-3 h-3 text-indigo-400" />
                        <span>反証 {msg.falsificationReport.falsificationScore}%</span>
                      </div>
                    )}

                    {/* 設計思想 第5段階 (47章): 自然言語ワークフローバッジ */}
                    {msg.synthesizedWorkflow && (
                      <button
                        type="button"
                        onClick={() => setExpandedWorkflowMsgId(expandedWorkflowMsgId === msg.id ? null : msg.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border transition-all cursor-pointer ${
                          expandedWorkflowMsgId === msg.id
                            ? 'bg-purple-900/80 border-purple-500 text-purple-200 shadow'
                            : 'bg-purple-950/60 border-purple-800/60 text-purple-300 hover:border-purple-600'
                        }`}
                        title={`【設計思想 47章: 自律合成ワークフロー】\n・目的: ${msg.synthesizedWorkflow.userGoal}\n・構成ステップ: ${msg.synthesizedWorkflow.steps.length}工程\n・所要時間目安: ${Math.round(msg.synthesizedWorkflow.budgetEstimate.estimatedDurationMs / 1000)}秒\n・リスク区分: ${msg.synthesizedWorkflow.budgetEstimate.riskLevel}\n(クリックでワークフロー実行パネルを開閉)`}
                      >
                        <Workflow className="w-3 h-3 text-purple-400" />
                        <span>{msg.synthesizedWorkflow.steps.length}段ワークフロー</span>
                      </button>
                    )}

                    {/* 設計思想 49章: 経験保存先ルーター自動判定バッジ */}
                    {msg.experienceRouting && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border ${
                          msg.experienceRouting.destination === 'quarantine'
                            ? 'bg-rose-950/60 border-rose-800/60 text-rose-300'
                            : msg.experienceRouting.destination === 'skill'
                            ? 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300'
                            : msg.experienceRouting.destination === 'evaluation_set'
                            ? 'bg-pink-950/60 border-pink-800/60 text-pink-300'
                            : msg.experienceRouting.destination === 'discard_candidate'
                            ? 'bg-slate-900/60 border-slate-700/60 text-slate-400'
                            : 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                        }`}
                        title={`【設計思想 49章: 経験保存先ルーター判定】\n・判定先: ${msg.experienceRouting.destination}\n・理由: ${msg.experienceRouting.reason}\n・リスクスコア: ${msg.experienceRouting.riskScore}点\n・推奨アクション: ${msg.experienceRouting.suggestedAction || '保持'}`}
                      >
                        <Compass className="w-3 h-3 text-purple-400" />
                        <span>49章: {msg.experienceRouting.destination}</span>
                      </div>
                    )}

                    {/* 設計思想 9章: 回答骨格と思考節約バッジ */}
                    {msg.answerPlan && msg.answerPlan.applied && msg.answerPlan.matchedSkeleton && (
                      <button
                        type="button"
                        onClick={() => setExpandedAnswerPlanMsgId(expandedAnswerPlanMsgId === msg.id ? null : msg.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border transition-all cursor-pointer ${
                          expandedAnswerPlanMsgId === msg.id
                            ? 'bg-amber-900/80 border-amber-500 text-amber-200 shadow'
                            : 'bg-amber-950/60 border-amber-800/60 text-amber-300 hover:border-amber-600'
                        }`}
                        title={`【設計思想 9章: 回答骨格と思考節約】\n・骨格ID: ${msg.answerPlan.matchedSkeleton.pattern_id}\n・状況分類: ${msg.answerPlan.matchedSkeleton.situation}\n・理由: ${msg.answerPlan.reason}\n(クリックで骨格詳細を開閉)`}
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>骨格: {msg.answerPlan.matchedSkeleton.pattern_id}</span>
                      </button>
                    )}

                    {/* 設計思想 22〜25章: コード理解中間IRバッジ */}
                    {msg.codeUnderstandingIR && (
                      <button
                        type="button"
                        onClick={() => setExpandedCodeIrMsgId(expandedCodeIrMsgId === msg.id ? null : msg.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border transition-all cursor-pointer ${
                          msg.codeUnderstandingIR.commentCodeContradictions.length > 0
                            ? 'bg-amber-950/70 border-amber-600/70 text-amber-300'
                            : 'bg-sky-950/60 border-sky-800/60 text-sky-300'
                        }`}
                        title={`【設計思想 22〜25章: コード理解中間IR】\n・プロシージャ: ${msg.codeUnderstandingIR.procedures.length}個\n・コメント矛盾: ${msg.codeUnderstandingIR.commentCodeContradictions.length}件\n(クリックで中間IR・矛盾検出を開閉)`}
                      >
                        <Code2 className="w-3 h-3 text-sky-400" />
                        <span>
                          CodeIR ({msg.codeUnderstandingIR.procedures.length}Proc
                          {msg.codeUnderstandingIR.commentCodeContradictions.length > 0 ? ` / 矛盾${msg.codeUnderstandingIR.commentCodeContradictions.length}` : ''})
                        </span>
                      </button>
                    )}

                    {/* 設計思想 26章: 抽象VBA設計仕様書バッジ */}
                    {msg.vbaDesignSpecification && (
                      <button
                        type="button"
                        onClick={() => setExpandedVbaSpecMsgId(expandedVbaSpecMsgId === msg.id ? null : msg.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border transition-all cursor-pointer ${
                          expandedVbaSpecMsgId === msg.id
                            ? 'bg-indigo-900/80 border-indigo-500 text-indigo-200 shadow'
                            : 'bg-indigo-950/60 border-indigo-800/60 text-indigo-300 hover:border-indigo-600'
                        }`}
                        title={`【設計思想 26章: 抽象VBA設計仕様書】\n・決定表ルール: ${msg.vbaDesignSpecification.decisionTable.rules.length}則\n・抽象プロシージャ: ${msg.vbaDesignSpecification.procedurePlans.length}件\n(クリックで決定表・Copilot指示書を開閉)`}
                      >
                        <Table className="w-3 h-3 text-indigo-400" />
                        <span>決定表仕様書 ({msg.vbaDesignSpecification.decisionTable.rules.length}則)</span>
                      </button>
                    )}

                    {/* 設計思想 18章: 会話評価11指標バッジ */}
                    {msg.dialogueEvaluation && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border ${
                          msg.dialogueEvaluation.overallScore >= 75
                            ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                            : 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                        }`}
                        title={`【設計思想 18章: 会話評価11指標】\n・総合スコア: ${msg.dialogueEvaluation.overallScore}点\n・直接性: ${msg.dialogueEvaluation.directness}点\n・文脈維持: ${msg.dialogueEvaluation.contextRetention}点\n・意図理解: ${msg.dialogueEvaluation.intentRecognition}点\n・訂正反映: ${msg.dialogueEvaluation.correctionUpdate}点\n・重複排除: ${msg.dialogueEvaluation.noRepetition}点\n・自然さ: ${msg.dialogueEvaluation.naturalness}点\n・不明点誠実性: ${msg.dialogueEvaluation.uncertaintyHandling}点\n・応答速度: ${msg.dialogueEvaluation.latencyMs}ms`}
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-400" />
                        <span>18章評価 {msg.dialogueEvaluation.overallScore}点</span>
                      </div>
                    )}

                    {/* 設計思想 20章: 不確実性・判断ブレ判定バッジ */}
                    {msg.uncertaintyEvaluation && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border ${
                          msg.uncertaintyEvaluation.divergenceDetected
                            ? 'bg-amber-950/70 border-amber-600/70 text-amber-300'
                            : 'bg-slate-900/60 border-slate-700/60 text-slate-300'
                        }`}
                        title={`【設計思想 20章: 不確実性評価】\n・不確実性スコア: ${msg.uncertaintyEvaluation.uncertaintyScore}点\n・ブレ検知: ${msg.uncertaintyEvaluation.divergenceDetected ? '検知あり (外部教師要請推奨)' : '安定 (端末内完結)'}\n・ブレ項目: ${msg.uncertaintyEvaluation.divergenceTypes.join(', ') || 'なし'}\n・教師送信対象: ${msg.uncertaintyEvaluation.shouldSendToTeacher ? '送信要請対象' : '端末内完結'}`}
                      >
                        <Compass className="w-3 h-3 text-amber-400" />
                        <span>20章不確実性 {msg.uncertaintyEvaluation.uncertaintyScore}点</span>
                      </div>
                    )}

                    {/* 設計思想 Master v5.0 第10章 & 63-64章: VBA 8大静的検証バッジ */}
                    {(msg.vbaStaticVerification || msg.codeVerification?.vbaStaticResult) && (
                      (() => {
                        const vbaResult = msg.vbaStaticVerification || msg.codeVerification?.vbaStaticResult;
                        if (!vbaResult) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => setExpandedVbaVerificationMsgId(expandedVbaVerificationMsgId === msg.id ? null : msg.id)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border transition-all cursor-pointer ${
                              expandedVbaVerificationMsgId === msg.id
                                ? 'bg-emerald-900/90 border-emerald-400 text-emerald-100 shadow'
                                : vbaResult.overallPassed
                                ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300 hover:border-emerald-500'
                                : 'bg-amber-950/70 border-amber-600/70 text-amber-300 hover:border-amber-500'
                            }`}
                            title={`【VBA 8大静的検証＆SHA-256納品ゲート】\n・判定スコア: ${vbaResult.verdictScore}点 (${vbaResult.overallPassed ? '全合格' : '警告/要修正'})\n・Option Explicit: ${vbaResult.hasOptionExplicit ? '記載済' : '未記載'}\n・全プロシージャ終端: ${vbaResult.allProceduresFullyClosed ? '完全閉鎖' : '未閉鎖あり'}\n・ブロック構文: ${vbaResult.blockNestingValid ? '正常' : '不正あり'}\n・禁止パターン: ${vbaResult.forbiddenPatterns.length}件\n・SHA-256: ${vbaResult.deliveryVerification.sha256Checksum.slice(0, 16)}...\n(クリックで検証詳細を開閉)`}
                          >
                            <ShieldCheck className={`w-3 h-3 ${vbaResult.overallPassed ? 'text-emerald-400' : 'text-amber-400'}`} />
                            <span>
                              VBA検証 {vbaResult.verdictScore}点
                              {vbaResult.overallPassed ? ' (合格)' : ` (${vbaResult.forbiddenPatterns.length}警告)`}
                            </span>
                          </button>
                        );
                      })()
                    )}

                    {/* 設計思想 Master v5.0 第11章 & 27章: プライバシー保護・送信境界監査バッジ */}
                    {msg.privacyAudit && (
                      <button
                        type="button"
                        onClick={() => setExpandedPrivacyAuditMsgId(expandedPrivacyAuditMsgId === msg.id ? null : msg.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono border transition-all cursor-pointer ${
                          expandedPrivacyAuditMsgId === msg.id
                            ? 'bg-sky-900/90 border-sky-400 text-sky-100 shadow'
                            : msg.privacyAudit.allowed
                            ? 'bg-sky-950/60 border-sky-800/60 text-sky-300 hover:border-sky-500'
                            : 'bg-rose-950/70 border-rose-600/70 text-rose-300 hover:border-rose-500'
                        }`}
                        title={`【送信ガードレール＆プライバシー監査】\n・判定: ${msg.privacyAudit.allowed ? '安全送信可' : '外部送信遮断'}\n・分類: ${msg.privacyAudit.classification}\n・検知違反: ${msg.privacyAudit.violations.length}件\n${msg.privacyAudit.violations.map((v) => `・[${v.severity}] ${v.message}`).join('\n')}\n(クリックで監査詳細を開閉)`}
                      >
                        <Lock className={`w-3 h-3 ${msg.privacyAudit.allowed ? 'text-sky-400' : 'text-rose-400'}`} />
                        <span>
                          {msg.privacyAudit.classification === 'PUBLIC_SYNTHETIC' ? '公開データ' : '抽象化済'}
                          {msg.privacyAudit.violations.length > 0 ? ` (${msg.privacyAudit.violations.length}マスキング)` : ''}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* 10-Step Interactive Telemetry Timeline Drawer */}
                {!isUser && expandedStepsMsgId === msg.id && msg.executionSteps && (
                  <div className="w-full bg-slate-950/95 border border-sky-500/30 rounded-xl p-2.5 sm:p-3 my-1 text-xs space-y-2 shadow-lg animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-800 text-[11px]">
                      <div className="flex items-center gap-1.5 text-sky-300 font-bold">
                        <ListTree className="w-3.5 h-3.5 text-sky-400" />
                        <span>チャット送信〜応答 10工程リアルタイム追跡</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const stepText = msg.executionSteps
                              ?.map(
                                (s) =>
                                  `[工程 ${s.stepNumber}/${s.totalSteps}] +${s.elapsedMs}ms (Δ${s.relativeDeltaMs}ms) : ${s.title}${
                                    s.details ? '\n  ' + JSON.stringify(s.details) : ''
                                  }`
                              )
                              .join('\n');
                            if (stepText) {
                              navigator.clipboard.writeText(stepText);
                              alert('工程ログをクリップボードにコピーしました！');
                            }
                          }}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 transition-colors border border-slate-700"
                          title="このメッセージの工程ログをコピー"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>ログコピー</span>
                        </button>
                        <button
                          onClick={async () => {
                            await systemLogger.downloadDiagnosticsTxtFile({
                              engineMode: msg.engineMode,
                              targetModel: msg.metrics?.engine,
                            });
                          }}
                          className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded text-[10px] flex items-center gap-1 transition-colors border border-emerald-500/40 font-bold"
                          title="全システム診断レポート(.txt)を保存"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          <span>診断txt保存</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 font-mono text-[10.5px]">
                      {msg.executionSteps.map((step, idx) => {
                        const isErr = step.status === 'error';
                        const isWarn = step.status === 'warn';
                        return (
                          <div
                            key={idx}
                            className={`p-1.5 rounded-lg border ${
                              isErr
                                ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                                : isWarn
                                ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                                : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="px-1.5 py-0.2 rounded bg-sky-950 border border-sky-500/40 text-sky-300 font-bold text-[9.5px]">
                                  {step.stepNumber}/{step.totalSteps}
                                </span>
                                <span className="font-sans font-medium text-slate-200 truncate">
                                  {step.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[9.5px] text-slate-400 shrink-0">
                                <span className="text-emerald-400 font-bold">+{step.elapsedMs}ms</span>
                                {(step.relativeDeltaMs ?? 0) > 0 && (
                                  <span className="text-slate-500">(Δ{step.relativeDeltaMs}ms)</span>
                                )}
                              </div>
                            </div>
                            {step.details && (
                              <div className="mt-1 pt-1 border-t border-slate-800/60 text-[9.5px] text-slate-400 whitespace-pre-wrap break-all bg-black/30 p-1 rounded">
                                {typeof step.details === 'string'
                                  ? step.details
                                  : JSON.stringify(step.details, null, 2)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 外部ローカルLLM Stage A〜E 遅延細分化＆TTFT診断ドロワー */}
                {!isUser && expandedExternalDiagMsgId === msg.id && msg.externalLlmDiagnostic && (
                  <div className="w-full bg-slate-950/95 border border-indigo-500/40 rounded-xl p-3 my-1.5 text-xs space-y-3 shadow-xl animate-fadeIn">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-indigo-900/40 text-[11px]">
                      <div className="flex items-center gap-1.5 text-indigo-200 font-bold">
                        <Terminal className="w-4 h-4 text-indigo-400" />
                        <span>外部ローカルLLM 推論遅延細分化・TTFT・KVキャッシュ診断</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                          #{msg.externalLlmDiagnostic.queryNumber}回目
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-slate-400">
                          {msg.externalLlmDiagnostic.model} ({msg.externalLlmDiagnostic.endpoint})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const diag = msg.externalLlmDiagnostic!;
                            const textSummary = `【外部ローカルLLM推論遅延 診断結果】
実行回数: #${diag.queryNumber} (${diag.timestamp})
モデル: ${diag.model} (${diag.endpoint})
スロットID: ${diag.slotId !== undefined ? diag.slotId : '自動'}
・Stage A (MIKI-AI内部処理): ${diag.stageTimings.stageA_preFetchMs}ms
・Stage B (HTTP接続応答): ${diag.stageTimings.stageB_httpConnectMs}ms
・Stage C/D (実測TTFT初回トークン): ${diag.observedTtftMs}ms (Prefillのみ: ${diag.stageTimings.stageD_prefillOnlyMs}ms)
・Stage E (ストリーミング生成): ${diag.stageTimings.stageE_streamMs}ms (${diag.tokensGenerated} tok, ${diag.tokensPerSec} tok/s)
・総所要時間: ${diag.stageTimings.totalElapsedMs}ms
【プロンプト構成】
・全体: ${diag.promptStats.charsTotal}文字 (~${diag.promptStats.estimatedTokens}トークン)
・Systemプロンプト: ${diag.promptStats.charsCombinedSystem}文字 (静的: ${diag.promptStats.charsStaticPrefix}文字, 動的: ${diag.promptStats.charsDynamicContext}文字 / ${diag.promptStats.dynamicElementsCount}要素)
・履歴: ${diag.promptStats.charsHistory}文字 (${diag.promptStats.historyMessageCount}件)
・ユーザー入力: ${diag.promptStats.charsUser}文字
【タイムアウト・コールドスタート】
・初回タイムアウト: ${diag.timeoutStats.initialTimeoutMs}ms (前回学習TTFT: ${diag.timeoutStats.learnedTtftBeforeMs ?? 'なし'}, コールド判定: ${diag.timeoutStats.isColdStart})
${diag.comparisonWithPrevious ? `【連続実行TTFT比較判定】\n${diag.comparisonWithPrevious.explanation}` : ''}`;
                            navigator.clipboard.writeText(textSummary);
                            alert('外部LLM診断サマリーをクリップボードにコピーしました！');
                          }}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded flex items-center gap-1 border border-slate-700"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>診断コピー</span>
                        </button>
                      </div>
                    </div>

                    {/* Stage A〜E 遅延ブレークダウン */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9.5px] text-slate-400">Stage A (内部処理)</div>
                        <div className="text-sm font-bold text-sky-400">+{msg.externalLlmDiagnostic.stageTimings.stageA_preFetchMs}ms</div>
                        <div className="text-[9px] text-slate-500 truncate">想起・状態・骨格</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9.5px] text-slate-400">Stage B (HTTP接続)</div>
                        <div className="text-sm font-bold text-indigo-400">+{msg.externalLlmDiagnostic.stageTimings.stageB_httpConnectMs}ms</div>
                        <div className="text-[9px] text-slate-500 truncate">HTTP 200受信</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-indigo-700/60 bg-indigo-950/30">
                        <div className="text-[9.5px] text-indigo-300 font-bold">Stage C/D (TTFT)</div>
                        <div className="text-base font-bold text-amber-300">{msg.externalLlmDiagnostic.observedTtftMs}ms</div>
                        <div className="text-[9px] text-amber-400/80">Prefill: +{msg.externalLlmDiagnostic.stageTimings.stageD_prefillOnlyMs}ms</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9.5px] text-slate-400">Stage E (ストリーム)</div>
                        <div className="text-sm font-bold text-emerald-400">+{msg.externalLlmDiagnostic.stageTimings.stageE_streamMs}ms</div>
                        <div className="text-[9px] text-slate-500">{msg.externalLlmDiagnostic.tokensGenerated}tok ({msg.externalLlmDiagnostic.tokensPerSec} t/s)</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                        <div className="text-[9.5px] text-slate-400">Total (全工程)</div>
                        <div className="text-sm font-bold text-slate-200">{msg.externalLlmDiagnostic.stageTimings.totalElapsedMs}ms</div>
                        <div className="text-[9px] text-slate-500">スロット: {msg.externalLlmDiagnostic.slotId !== undefined ? `Slot ${msg.externalLlmDiagnostic.slotId}` : '自動'}</div>
                      </div>
                    </div>

                    {/* 連続実行TTFT比較判定結果バナー (2回目のキャッシュ短縮確認) */}
                    {msg.externalLlmDiagnostic.comparisonWithPrevious && (
                      <div
                        className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                          msg.externalLlmDiagnostic.comparisonWithPrevious.verdict === 'cache_hit'
                            ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                            : msg.externalLlmDiagnostic.comparisonWithPrevious.verdict === 'no_cache'
                            ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                            : 'bg-indigo-950/60 border-indigo-500/60 text-indigo-200'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5 text-[11px] mb-1">
                          {msg.externalLlmDiagnostic.comparisonWithPrevious.verdict === 'cache_hit' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span>連続実行TTFT比較診断 (#1 ➔ #{msg.externalLlmDiagnostic.queryNumber})</span>
                        </div>
                        <p className="text-[11px] font-sans">
                          {msg.externalLlmDiagnostic.comparisonWithPrevious.explanation}
                        </p>
                      </div>
                    )}

                    {/* プロンプト文字数・トークン詳細内訳 */}
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5 font-mono text-[10.5px]">
                      <div className="font-sans font-bold text-slate-300 text-[11px] flex items-center justify-between">
                        <span>📝 送信プロンプト (chatContext) の詳細構造</span>
                        <span className="text-indigo-300">
                          全体: {msg.externalLlmDiagnostic.promptStats.charsTotal}文字 (~{msg.externalLlmDiagnostic.promptStats.estimatedTokens} トークン)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-slate-300">
                        <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                          <div className="text-[10px] text-slate-400">Systemプロンプト</div>
                          <div className="font-bold text-sky-300">{msg.externalLlmDiagnostic.promptStats.charsCombinedSystem} 文字</div>
                          <div className="text-[9px] text-slate-500">静的: {msg.externalLlmDiagnostic.promptStats.charsStaticPrefix}字 / 動的: {msg.externalLlmDiagnostic.promptStats.charsDynamicContext}字 ({msg.externalLlmDiagnostic.promptStats.dynamicElementsCount}要素)</div>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                          <div className="text-[10px] text-slate-400">会話履歴コンテキスト</div>
                          <div className="font-bold text-amber-300">{msg.externalLlmDiagnostic.promptStats.charsHistory} 文字</div>
                          <div className="text-[9px] text-slate-500">{msg.externalLlmDiagnostic.promptStats.historyMessageCount} 件の対話ターン</div>
                        </div>
                        <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                          <div className="text-[10px] text-slate-400">今回ユーザー入力</div>
                          <div className="font-bold text-emerald-300">{msg.externalLlmDiagnostic.promptStats.charsUser} 文字</div>
                          <div className="text-[9px] text-slate-500">直近プロンプト (添付含)</div>
                        </div>
                      </div>
                      <div className="pt-1 text-[10px] text-slate-400 font-sans flex items-center justify-between flex-wrap gap-1">
                        <span>
                          ⏱️ 初回タイムアウト: <strong>{msg.externalLlmDiagnostic.timeoutStats.initialTimeoutMs}ms</strong>
                          {msg.externalLlmDiagnostic.timeoutStats.learnedTtftBeforeMs != null ? ` (前回学習TTFT: ${msg.externalLlmDiagnostic.timeoutStats.learnedTtftBeforeMs}ms)` : ' (初回デフォルト)'}
                        </span>
                        <span>
                          コールドスタート判定: <strong className={msg.externalLlmDiagnostic.timeoutStats.isColdStart ? 'text-amber-400' : 'text-emerald-400'}>{msg.externalLlmDiagnostic.timeoutStats.isColdStart ? 'あり (モデル再ロード待機)' : 'なし (ウォーム状態)'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback & WebGPU Status info bar */}
                {!isUser && msg.fallbackDiagnostic && (
                  <div className="flex flex-col gap-1.5 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg text-[11px] text-amber-200">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold text-[10px]">
                          {msg.fallbackDiagnostic.category}
                        </span>
                        <span className="truncate text-slate-300">{msg.fallbackDiagnostic.cause}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          onClick={async () => {
                            await systemLogger.downloadDiagnosticsTxtFile();
                          }}
                          className="text-[10px] text-emerald-300 hover:text-emerald-200 flex items-center gap-1 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded font-bold transition-all hover:bg-emerald-900"
                          title="診断レポート(.txt)をダウンロードして原因を確認・共有できます"
                        >
                          <FileText className="w-3 h-3" />
                          <span>📄 診断txt保存</span>
                        </button>
                        {onOpenEngineModal && (
                          <button
                            onClick={onOpenEngineModal}
                            className="text-[10px] text-sky-400 hover:text-sky-300 underline font-medium transition-colors"
                          >
                            端末LLM設定
                          </button>
                        )}
                      </div>
                    </div>
                    {msg.fallbackDiagnostic.rawErrorMessage && (
                      <details className="text-[10px] text-slate-400 cursor-pointer pt-0.5 border-t border-amber-500/20">
                        <summary className="hover:text-amber-300 transition-colors font-mono select-none">
                          ▶ 生のエラーログ詳細を表示
                        </summary>
                        <div className="mt-1 p-1.5 bg-slate-950/80 border border-slate-800 rounded font-mono text-[9.5px] text-rose-300/90 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                          {msg.fallbackDiagnostic.rawErrorMessage}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* 48章 完成条件と完了判定器 (Completion Judge) バッジ & チェックリスト */}
                {!isUser && msg.completionEvaluation && (
                  <CompletionBadge
                    evaluation={msg.completionEvaluation}
                    onMarkCompleted={
                      onUpdateMessageEvaluation
                        ? () => {
                            const updated = completionJudgeService.markAsCompleted(msg.completionEvaluation!);
                            onUpdateMessageEvaluation(msg.id, updated);
                          }
                        : undefined
                    }
                    onMarkFailed={
                      onUpdateMessageEvaluation
                        ? (reason: string) => {
                            const updated = completionJudgeService.markAsFailed(msg.completionEvaluation!, reason);
                            onUpdateMessageEvaluation(msg.id, updated);
                          }
                        : undefined
                    }
                  />
                )}

                {/* Bubble */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl text-[13px] leading-relaxed break-words relative shadow-xs ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-slate-900/95 text-slate-100 border border-slate-800/80 rounded-tl-sm'
                  }`}
                >
                  {/* Attached files if any */}
                  {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                    <div className="mb-2 pb-2 border-b border-white/10 flex flex-wrap gap-1.5">
                      {msg.attachedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1 bg-black/25 px-2 py-1 rounded-md text-[10.5px] font-mono text-sky-200 border border-sky-400/30"
                        >
                          <FileCode className="w-3 h-3 text-sky-300" />
                          <span className="truncate max-w-[120px]">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message content text */}
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                  {/* Pending Tool Confirmation Card (:feature:tools / 破壊的操作の確認) */}
                  {msg.pendingToolConfirmation && (
                    <div className="mt-3 p-3 bg-amber-950/70 border-2 border-amber-500/80 rounded-xl space-y-2 text-xs shadow-lg animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>破壊的操作の承認リクエスト (:feature:tools)</span>
                      </div>
                      <p className="text-slate-200 text-[11px] leading-relaxed">
                        ツール「<strong className="text-amber-200">{msg.pendingToolConfirmation.toolName}</strong>」を実行するにはユーザーの明示的な承認が必要です。
                      </p>
                      <div className="p-2 bg-black/50 rounded-lg border border-amber-900/60 font-mono text-[10px] text-amber-300 break-all space-y-1">
                        <div><span className="text-slate-400">操作理由:</span> {msg.pendingToolConfirmation.reason || 'ワークスペースファイル変更'}</div>
                        {msg.pendingToolConfirmation.params && (
                          <div>
                            <span className="text-slate-400">対象:</span> {msg.pendingToolConfirmation.params.path || 'ファイル'}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => onConfirmToolExecution?.(msg.pendingToolConfirmation)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>承認して実行</span>
                        </button>
                        <button
                          onClick={() => onRejectToolExecution?.(msg.pendingToolConfirmation!.id)}
                          className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-all"
                        >
                          <span>拒否 / キャンセル</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Code Proposal Confirmation Gate (設計思想 ②: 生成と適用の分離 & ⑩: VBA準備ゲート) */}
                  {msg.codeProposal && (
                    <div className="mt-3 p-3 bg-slate-900/95 border-2 border-indigo-500/80 rounded-xl space-y-2.5 text-xs shadow-lg animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-[12px]">
                          <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>コード変更提案 (確認ゲート: 設計思想 ②)</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          msg.codeProposal.status === 'applied'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : msg.codeProposal.status === 'rejected'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                        }`}>
                          {msg.codeProposal.status === 'applied' ? '✅ 適用済み' : msg.codeProposal.status === 'rejected' ? '❌ 却下済み' : '⏳ 承認待ち'}
                        </span>
                      </div>

                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        AIがコードファイルを生成しました。勝手な自動上書きを防ぐため、内容を確認して適用を承認してください。
                      </p>

                      {/* File targets list */}
                      <div className="space-y-1">
                        {msg.codeProposal.files.map((file, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between p-1.5 bg-black/50 rounded-lg border border-slate-800 text-[11px] font-mono text-indigo-200">
                            <span className="truncate">{file.path || file.name}</span>
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300">{file.language}</span>
                          </div>
                        ))}
                      </div>

                      {/* VBA Safety Assessment Gate (設計思想 ⑩) */}
                      {msg.vbaAssessment && (
                        <div className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 ${
                          msg.vbaAssessment.status === 'safe'
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                            : msg.vbaAssessment.status === 'warning'
                            ? 'bg-amber-950/60 border-amber-700/80 text-amber-200'
                            : 'bg-red-950/70 border-red-700/90 text-red-200'
                        }`}>
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                              <span>VBA安全評価ゲート ({msg.vbaAssessment.targetApplication || 'Excel'} マクロ)</span>
                            </span>
                            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded font-mono bg-black/40">
                              {msg.vbaAssessment.status === 'safe' ? '安全 (Safe)' : msg.vbaAssessment.status === 'warning' ? '注意 (Warning)' : '高リスク (Restricted)'}
                            </span>
                          </div>
                          {msg.vbaAssessment.warnings.length > 0 && (
                            <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] text-amber-300/90">
                              {msg.vbaAssessment.warnings.map((w, wIdx) => (
                                <li key={wIdx}>{w}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Action buttons if still pending */}
                      {msg.codeProposal.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => onApplyCodeProposal?.(msg.codeProposal)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ワークスペースに適用</span>
                          </button>
                          <button
                            onClick={() => onRejectCodeProposal?.(msg.codeProposal!.id)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-all"
                          >
                            <span>提案を却下</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Task Plan (Phase 3: Multi-step Reasoning) */}
                  {msg.taskPlan && (
                    <div className="mt-2.5">
                      <TaskPlanCard plan={msg.taskPlan} onResume={onResumeTaskPlan} />
                    </div>
                  )}

                  {/* Executed Tools Summary Card (:feature:tools) */}
                  {msg.executedTools && msg.executedTools.length > 0 && (
                    <div className="mt-3 p-2.5 bg-slate-900/90 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between text-emerald-300 font-bold text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ツール実行結果 (:feature:tools)</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {msg.executedTools.map((t) => `${t.executionTimeMs}ms`).join(', ')}
                        </span>
                      </div>
                      {msg.executedTools.map((t, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-[10.5px] space-y-1 ${
                            t.requiresPluginConsent
                              ? 'bg-amber-950/20 border-amber-500/40'
                              : 'bg-black/40 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono font-bold">
                            <span className={t.requiresPluginConsent ? 'text-amber-400' : 'text-emerald-400'}>
                              {t.toolName}
                            </span>
                            <span
                              className={`text-[9.5px] px-1.5 py-0.2 rounded border ${
                                t.requiresPluginConsent
                                  ? 'bg-amber-950 border-amber-800 text-amber-300'
                                  : 'bg-emerald-950 border-emerald-800 text-emerald-300'
                              }`}
                            >
                              {t.requiresPluginConsent ? '権限同意待ち' : t.permission}
                            </span>
                          </div>
                          <div className="text-slate-300 font-sans leading-relaxed">{t.outputSummary}</div>
                          {t.requiresPluginConsent && onOpenSelfImprovementModal && (
                            <div className="pt-1 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={onOpenSelfImprovementModal}
                                className="px-2 py-0.5 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span>能力プラグインを確認・承認する</span>
                                <span>→</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggested Tools Quick Actions (:feature:tools) */}
                  {!isUser && msg.suggestedTools && msg.suggestedTools.length > 0 && !msg.executedTools?.length && (
                    <div className="mt-3 p-2.5 bg-slate-900/90 border border-sky-500/30 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between text-sky-300 font-bold text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-sky-400" />
                          <span>推奨ツール連携 (:feature:tools)</span>
                        </span>
                        <span className="text-[9.5px] text-slate-400 font-mono">第14・22章</span>
                      </div>
                      <div className="space-y-1.5">
                        {msg.suggestedTools.map((tool, tIdx) => (
                          <div key={tIdx} className="flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-lg bg-black/40 border border-slate-800">
                            <div className="flex-1 min-w-[160px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-200 text-[11px]">{tool.name}</span>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-sky-950 border border-sky-700 text-sky-300 font-mono">
                                  {tool.permission}
                                </span>
                                {tool.requiresConfirmation && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 border border-amber-700 text-amber-300 font-mono">
                                    要確認
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{tool.reason}</p>
                            </div>
                            <button
                              onClick={() => onExecuteTool?.(tool.toolId, tool.suggestedParams || {}, false)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow shrink-0"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span>実行</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error & Quota Helper Action Buttons */}
                  {msg.isError && (
                    <div className="mt-3 pt-2.5 border-t border-rose-500/30 space-y-2">
                      <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-rose-400" />
                        <span>おすすめのアクション:</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {onOpenExportModal && (
                          <button
                            onClick={onOpenExportModal}
                            className="flex-1 py-1.5 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[11px] font-bold shadow-md shadow-purple-600/20 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <span>📦 アプリをZIPダウンロード</span>
                          </button>
                        )}
                        {onOpenEngineModal && (
                          <button
                            onClick={onOpenEngineModal}
                            className="flex-1 py-1.5 px-2.5 bg-slate-700 hover:bg-slate-600 text-purple-200 border border-purple-500/40 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <span>⚡ 端末WebGPUモデルをDL</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Google Search Grounding Sources Citations */}
                  {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/70">
                      <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-400 mb-1">
                        <Globe className="w-3 h-3" />
                        <span>Google Search 参照元 ({msg.groundingChunks.length}件):</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.groundingChunks.map((chunk, idx) => {
                          const uri = chunk.web?.uri || chunk.maps?.uri;
                          const title = chunk.web?.title || chunk.maps?.title || 'Web Source';
                          if (!uri) return null;
                          return (
                            <a
                              key={idx}
                              href={uri}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-[10px] px-2 py-0.5 rounded transition-colors"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span className="max-w-[140px] truncate">{title}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Extracted Code Blocks Action Card */}
                  {hasCode && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/70">
                      <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-2 sm:p-2.5 shadow-inner">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1 text-sky-400 font-bold text-[11px]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>生成されたコード ({codeBlocks.length}ファイル)</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                            {codeBlocks.map((c) => c.name).join(', ')}
                          </span>
                        </div>

                        {/* みき自律自動検証バッジ (自律TDD・構文・循環参照の事前合格状況) */}
                        {autonomousVerifications[msg.id] ? (
                          <div className="mb-2 p-1.5 bg-slate-900/90 border border-emerald-500/30 rounded-lg flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-emerald-400 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                <span>みき自律検証済</span>
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono ${
                                  autonomousVerifications[msg.id].syntaxPassed
                                    ? 'bg-emerald-950 text-emerald-300'
                                    : 'bg-rose-950 text-rose-300'
                                }`}
                              >
                                構文: {autonomousVerifications[msg.id].syntaxPassed ? 'PASS' : 'FAIL'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono">
                                TDD: {autonomousVerifications[msg.id].testPassedCount}/
                                {autonomousVerifications[msg.id].testTotalCount} 合格 (
                                {autonomousVerifications[msg.id].coverageOverall}%)
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono ${
                                  autonomousVerifications[msg.id].cyclesFound === 0
                                    ? 'bg-slate-800 text-slate-300'
                                    : 'bg-rose-950 text-rose-300'
                                }`}
                              >
                                循環参照:{' '}
                                {autonomousVerifications[msg.id].cyclesFound === 0
                                  ? 'なし'
                                  : `${autonomousVerifications[msg.id].cyclesFound}件検知`}
                              </span>
                            </div>
                            {autonomousVerifications[msg.id].autoHealed && (
                              <span className="text-amber-300 text-[10px] flex items-center gap-0.5">
                                <Zap className="w-3 h-3 text-amber-400" />
                                <span>自律補完済</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="mb-1.5 px-2 py-1 bg-slate-900/50 rounded flex items-center gap-1.5 text-[10px] text-slate-400">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-sky-400" />
                            <span>みきがコードの単体テスト＆依存関係を自律検証中...</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApplyBlocks(msg.content, msg.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-1.5 sm:py-2 px-2.5 rounded-lg shadow-md shadow-sky-500/20 text-xs transition-all"
                          >
                            {appliedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                                <span>反映完了！</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>ワークスペースに反映＆実行</span>
                              </>
                            )}
                          </button>

                          {codeBlocks.length > 0 && (
                            <button
                              onClick={() => handleOpenDiffPreview(codeBlocks[0])}
                              className="flex items-center gap-1 px-2.5 py-1.5 sm:py-2 bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 rounded-lg text-purple-300 hover:text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
                              title="既存ファイルとの変更行（差分）を確認して安全に適用"
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-400" />
                              <span className="hidden sm:inline">差分確認</span>
                            </button>
                          )}

                          {codeBlocks.length > 0 && (
                            <button
                              onClick={() => handleOpenUnitTest(codeBlocks[0])}
                              className="flex items-center gap-1 px-2.5 py-1.5 sm:py-2 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 rounded-lg text-indigo-300 hover:text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
                              title="生成コードの単体テストを自動合成して実行・検証"
                            >
                              <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="hidden sm:inline">テスト</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                            title="コードをコピー"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 9章: 回答骨格と思考節約 詳細展開パネル */}
                  {expandedAnswerPlanMsgId === msg.id && msg.answerPlan && msg.answerPlan.matchedSkeleton && (
                    <div className="mt-3 p-3 bg-slate-950/95 border border-amber-500/50 rounded-xl space-y-2 text-xs shadow-lg animate-fadeIn">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>9章 回答骨格詳細: {msg.answerPlan.matchedSkeleton.pattern_id}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {msg.answerPlan.matchedSkeleton.stage}
                        </span>
                      </div>
                      <div className="text-slate-300 text-[11px] leading-relaxed">
                        <strong className="text-amber-200">適合状況:</strong> {msg.answerPlan.matchedSkeleton.situation}
                      </div>
                      <div className="p-2 bg-black/40 rounded-lg border border-slate-800 space-y-1 text-[11px]">
                        <div className="text-emerald-400 font-bold text-[10.5px]">推奨手順 (Plan):</div>
                        <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
                          {msg.answerPlan.matchedSkeleton.response_plan.map((step, sIdx) => (
                            <li key={sIdx}>{step.replace(/^\d+\.\s*/, '')}</li>
                          ))}
                        </ol>
                      </div>
                      {msg.answerPlan.matchedSkeleton.avoid.length > 0 && (
                        <div className="p-2 bg-rose-950/20 rounded-lg border border-rose-900/30 text-[10.5px] space-y-0.5 text-rose-300">
                          <div className="font-bold text-rose-400">禁止・回避事項:</div>
                          <ul className="list-disc list-inside">
                            {msg.answerPlan.matchedSkeleton.avoid.map((av, avIdx) => (
                              <li key={avIdx}>{av}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 22〜25章: コード理解中間IR 詳細展開パネル */}
                  {expandedCodeIrMsgId === msg.id && msg.codeUnderstandingIR && (
                    <div className="mt-3 p-3 bg-slate-950/95 border border-sky-500/50 rounded-xl space-y-2.5 text-xs shadow-lg animate-fadeIn">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-sky-300 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-sky-400" />
                          <span>22〜25章 コード理解中間IR ({msg.codeUnderstandingIR.sourceLanguage})</span>
                        </span>
                        <button
                          onClick={() => handleCopy(JSON.stringify(msg.codeUnderstandingIR, null, 2), `ir_${msg.id}`)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 border border-slate-700"
                        >
                          {copiedId === `ir_${msg.id}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          <span>IR(JSON)コピー</span>
                        </button>
                      </div>
                      <div className="text-slate-300 text-[11px] leading-relaxed bg-black/40 p-2 rounded border border-slate-800">
                        {msg.codeUnderstandingIR.naturalJapaneseSummary}
                      </div>

                      {/* 矛盾警告 */}
                      {msg.codeUnderstandingIR.commentCodeContradictions.length > 0 && (
                        <div className="p-2 bg-amber-950/40 border border-amber-500/50 rounded text-amber-200 text-[10.5px] space-y-1">
                          <div className="font-bold text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>コメントと実装の矛盾検知 ({msg.codeUnderstandingIR.commentCodeContradictions.length}件)</span>
                          </div>
                          {msg.codeUnderstandingIR.commentCodeContradictions.map((c, cIdx) => (
                            <div key={cIdx} className="border-t border-amber-800/40 pt-1">
                              <div><span className="text-slate-400">コメント:</span> {c.commentClaim}</div>
                              <div><span className="text-emerald-300">実際の実装:</span> {c.actualCodeBehavior}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* プロシージャ一覧 */}
                      <div className="space-y-1 text-[10.5px]">
                        <div className="font-bold text-slate-400">プロシージャ構成:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {msg.codeUnderstandingIR.procedures.map((proc, prIdx) => (
                            <div key={prIdx} className="p-1.5 bg-slate-900 rounded border border-slate-800 font-mono">
                              <span className="text-sky-300 font-bold">{proc.procedureName}</span>
                              <span className="text-slate-400 block text-[9.5px]">呼出: {proc.calls.join(', ') || 'なし'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 26章: 抽象VBA設計仕様書 詳細展開パネル */}
                  {expandedVbaSpecMsgId === msg.id && msg.vbaDesignSpecification && (
                    <div className="mt-3 p-3 bg-slate-950/95 border border-indigo-500/50 rounded-xl space-y-3 text-xs shadow-lg animate-fadeIn">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                        <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                          <Table className="w-3.5 h-3.5 text-indigo-400" />
                          <span>26章 抽象VBA設計仕様書: {msg.vbaDesignSpecification.title}</span>
                        </span>
                        <button
                          onClick={() => handleCopy(msg.vbaDesignSpecification!.externalCopilotPrompt, `vba_${msg.id}`)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[10px] flex items-center gap-1 shadow"
                        >
                          {copiedId === `vba_${msg.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>外部Copilot指示書をコピー</span>
                        </button>
                      </div>

                      {/* 決定表ルール */}
                      <div className="space-y-1">
                        <div className="font-bold text-slate-300 text-[11px]">決定表 (Decision Table):</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px] font-mono border border-slate-800 rounded">
                            <thead className="bg-slate-900 text-slate-400">
                              <tr>
                                <th className="p-1.5 text-left">ルール</th>
                                <th className="p-1.5 text-left">条件</th>
                                <th className="p-1.5 text-left">アクション</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-black/40">
                              {msg.vbaDesignSpecification.decisionTable.rules.map((r) => (
                                <tr key={r.ruleId}>
                                  <td className="p-1.5 text-indigo-300 font-bold">{r.ruleId}</td>
                                  <td className="p-1.5 text-slate-300">
                                    {Object.entries(r.conditionValues).map(([k, v]) => `${k}=${v}`).join(' & ')}
                                  </td>
                                  <td className="p-1.5 text-emerald-300">
                                    {Object.entries(r.actionValues).map(([k, v]) => `${k}=${v}`).join(', ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 構成案 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10.5px]">
                        {msg.vbaDesignSpecification.procedurePlans.map((pp, ppIdx) => (
                          <div key={ppIdx} className="p-1.5 bg-slate-900 rounded border border-slate-800">
                            <span className="font-mono font-bold text-indigo-300">{pp.name}</span>: {pp.role}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Master v5.0 第10章 & 63-64章: VBA 8大静的検証＆SHA-256納品ゲート 詳細展開パネル */}
                  {expandedVbaVerificationMsgId === msg.id && (msg.vbaStaticVerification || msg.codeVerification?.vbaStaticResult) && (
                    (() => {
                      const vba = msg.vbaStaticVerification || msg.codeVerification?.vbaStaticResult!;
                      return (
                        <div className="mt-3 p-3 bg-slate-950/95 border border-emerald-500/50 rounded-xl space-y-3 text-xs shadow-lg animate-fadeIn font-mono">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded ${vba.overallPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <div className="font-bold text-emerald-300 font-sans text-[12px] flex items-center gap-2">
                                  <span>VBA 8大静的検証＆納品ゲート</span>
                                  <span className={`px-2 py-0.2 rounded text-[10px] ${vba.overallPassed ? 'bg-emerald-900/60 border border-emerald-600 text-emerald-200' : 'bg-amber-900/60 border border-amber-600 text-amber-200'}`}>
                                    {vba.verdictScore}点 / {vba.overallPassed ? '全合格' : '要確認'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 block">
                                  SHA-256: {vba.deliveryVerification.sha256Checksum} | {vba.deliveryVerification.lineCount}行 ({vba.deliveryVerification.charCount}文字)
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => setExpandedVbaVerificationMsgId(null)}
                              className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded hover:bg-slate-800"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                            {vba.summary}
                          </div>

                          {/* 4大チェック状態 */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px]">
                            <div className={`p-2 rounded border ${vba.hasOptionExplicit ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                              <div className="font-bold">Option Explicit</div>
                              <div className="text-[9.5px] mt-0.5">{vba.hasOptionExplicit ? '✅ 宣言確認済' : '❌ 未記載 (要追加)'}</div>
                            </div>
                            <div className={`p-2 rounded border ${vba.allProceduresFullyClosed ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                              <div className="font-bold">プロシージャ終端</div>
                              <div className="text-[9.5px] mt-0.5">{vba.allProceduresFullyClosed ? `✅ 全${vba.procedures.length}件閉鎖` : '❌ 未閉鎖あり'}</div>
                            </div>
                            <div className={`p-2 rounded border ${vba.blockNestingValid ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                              <div className="font-bold">ブロックネスト</div>
                              <div className="text-[9.5px] mt-0.5">{vba.blockNestingValid ? '✅ 正常' : `❌ ${vba.openBlocks.length}件不正`}</div>
                            </div>
                            <div className={`p-2 rounded border ${vba.deliveryVerification.isCompleteCode ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/40 border-rose-800/40 text-rose-300'}`}>
                              <div className="font-bold">コード完全性 (非省略)</div>
                              <div className="text-[9.5px] mt-0.5">{vba.deliveryVerification.isCompleteCode ? '✅ 全文生成' : '❌ 省略記号検知'}</div>
                            </div>
                          </div>

                          {/* 8大スキャナー検知一覧 */}
                          {vba.forbiddenPatterns.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="font-bold text-amber-300 text-[11px] font-sans">検知されたアンチパターン・規約違反 ({vba.forbiddenPatterns.length}件):</div>
                              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                {vba.forbiddenPatterns.map((fp, fpIdx) => (
                                  <div key={fpIdx} className="p-1.5 bg-amber-950/30 border border-amber-700/40 rounded text-[10px]">
                                    <div className="flex items-center justify-between text-amber-200 font-bold">
                                      <span>[行{fp.line}] {fp.type}</span>
                                    </div>
                                    <div className="text-slate-300 mt-0.5">{fp.explanation}</div>
                                    <div className="text-slate-400 bg-black/40 p-1 rounded mt-1 break-all">{fp.codeSnippet}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 外部参照 & シート依存 */}
                          {(vba.dependencies.externalAPIs.length > 0 || vba.dependencies.worksheets.length > 0) && (
                            <div className="text-[10px] space-y-1 bg-slate-900 p-2 rounded border border-slate-800">
                              <div className="font-bold text-slate-300 font-sans">動作前提・依存関係:</div>
                              {vba.dependencies.externalAPIs.length > 0 && (
                                <div className="text-sky-300">・外部API/ライブラリ参照: {vba.dependencies.externalAPIs.join(', ')}</div>
                              )}
                              {vba.dependencies.worksheets.length > 0 && (
                                <div className="text-slate-300">・参照ワークシート: {vba.dependencies.worksheets.join(', ')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* Master v5.0 第11章: プライバシー保護・送信境界ガードレール 詳細展開パネル */}
                  {expandedPrivacyAuditMsgId === msg.id && msg.privacyAudit && (
                    <div className="mt-3 p-3 bg-slate-950/95 border border-sky-500/50 rounded-xl space-y-3 text-xs shadow-lg animate-fadeIn font-mono">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className={`p-1 rounded ${msg.privacyAudit.allowed ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <div className="font-bold text-sky-300 font-sans text-[12px] flex items-center gap-2">
                              <span>外部送信プライバシーガードレール監査 (第11章)</span>
                              <span className={`px-2 py-0.2 rounded text-[10px] ${msg.privacyAudit.allowed ? 'bg-sky-900/60 border border-sky-600 text-sky-200' : 'bg-rose-900/60 border border-rose-600 text-rose-200'}`}>
                                {msg.privacyAudit.allowed ? '外部送信許可' : '外部送信遮断'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              分類カテゴリ: {msg.privacyAudit.classification} ({msg.privacyAudit.classification === 'PUBLIC_SYNTHETIC' ? '一般公開・架空データ' : '抽象化・機密マスク済'})
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedPrivacyAuditMsgId(null)}
                          className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded hover:bg-slate-800"
                        >
                          ✕
                        </button>
                      </div>

                      {/* 違反/マスク項目一覧 */}
                      {msg.privacyAudit.violations.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="font-bold text-amber-300 text-[11px] font-sans">
                            検知・マスキング項目 ({msg.privacyAudit.violations.length}件):
                          </div>
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {msg.privacyAudit.violations.map((viol, vIdx) => (
                              <div key={vIdx} className="p-1.5 bg-slate-900/80 border border-slate-700/60 rounded text-[10px]">
                                <div className="flex items-center justify-between font-bold">
                                  <span className={viol.severity === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}>
                                    [{viol.severity}] {viol.type}
                                  </span>
                                  <span className="text-slate-400">{viol.snippet}</span>
                                </div>
                                <div className="text-slate-300 mt-0.5">{viol.message}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 bg-emerald-950/30 border border-emerald-800/40 rounded text-[11px] text-emerald-300">
                          ✅ 機密情報・認証情報・社内UNCパス等の外部漏洩パターンは検出されませんでした。安全に送信可能です。
                        </div>
                      )}

                      {/* 抽象シンボル置換マップ */}
                      {Object.keys(msg.privacyAudit.symbolReplacements || {}).length > 0 && (
                        <div className="p-2 bg-slate-900/90 border border-slate-800 rounded text-[10px] space-y-1">
                          <div className="font-bold text-sky-400 font-sans">抽象シンボル化マップ (Abstract Sanitizer):</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[9.5px]">
                            {Object.entries(msg.privacyAudit.symbolReplacements).map(([orig, sym], sIdx) => (
                              <div key={sIdx} className="flex items-center gap-1.5">
                                <span className="text-slate-400 line-through truncate max-w-[120px]">{orig}</span>
                                <span className="text-slate-500">→</span>
                                <span className="text-emerald-400 font-bold">{sym}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 47章: 自律合成ワークフロー 詳細展開パネル */}
                  {expandedWorkflowMsgId === msg.id && msg.synthesizedWorkflow && (
                    <div className="mt-3 p-3 bg-slate-950/95 border border-purple-500/50 rounded-xl space-y-3 text-xs shadow-lg animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Workflow className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <span className="font-bold text-purple-300">
                              47章 自律合成ワークフロー ({msg.synthesizedWorkflow.steps.length}工程)
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              所要目安: ~{Math.round(msg.synthesizedWorkflow.budgetEstimate.estimatedDurationMs / 1000)}秒 | リスク: {msg.synthesizedWorkflow.budgetEstimate.riskLevel} | トークン予算: {msg.synthesizedWorkflow.budgetEstimate.estimatedTokens}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleExecuteWorkflow(msg.synthesizedWorkflow!.workflowId)}
                          disabled={executingWorkflowId === msg.synthesizedWorkflow.workflowId}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg text-[10.5px] flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                        >
                          {executingWorkflowId === msg.synthesizedWorkflow.workflowId ? (
                            <>
                              <RotateCw className="w-3 h-3 animate-spin" />
                              <span>実行中...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>全工程を一括自律実行</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* 実行状態・ログメッセージ */}
                      {workflowStatusMessage[msg.synthesizedWorkflow.workflowId] && (
                        <div className="p-2 bg-purple-950/40 border border-purple-800/60 rounded-lg text-[11px] text-purple-200">
                          {workflowStatusMessage[msg.synthesizedWorkflow.workflowId]}
                        </div>
                      )}

                      {/* 合成根拠 */}
                      <div className="p-2 bg-black/40 rounded border border-slate-800 text-[10.5px] text-slate-300">
                        <span className="text-purple-300 font-bold">分解根拠:</span> {msg.synthesizedWorkflow.synthesisRationale}
                      </div>

                      {/* ステップ一覧 */}
                      <div className="space-y-2">
                        <div className="font-bold text-slate-400 text-[10.5px] flex items-center justify-between">
                          <span>パイプライン構成ステップ:</span>
                          <span className="text-[9.5px] font-normal text-slate-500">※ 46章 原則: 未承認プラグインは権限同意なしに実行されません</span>
                        </div>
                        {msg.synthesizedWorkflow.steps.map((step) => (
                          <div
                            key={step.stepId}
                            className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-800 text-purple-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                  {step.stepNumber}
                                </span>
                                <span className="font-bold text-slate-200 text-[11px]">{step.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 font-mono">
                                  {step.assignedTool}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono ${
                                    step.status === 'completed'
                                      ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                                      : step.status === 'running'
                                      ? 'bg-amber-950 border border-amber-800 text-amber-300 animate-pulse'
                                      : step.status === 'failed'
                                      ? 'bg-rose-950 border border-rose-800 text-rose-300'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {step.status === 'completed'
                                    ? '完了'
                                    : step.status === 'running'
                                    ? '実行中'
                                    : step.status === 'failed'
                                    ? '中断/失敗'
                                    : '待機中'}
                                </span>
                                {step.status !== 'completed' && (
                                  <button
                                    onClick={() => handleExecuteWorkflowStep(msg.synthesizedWorkflow!.workflowId, step.stepId)}
                                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9.5px] transition-colors"
                                  >
                                    単体実行
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-400 pl-7">{step.intent}</p>

                            {step.resultExcerpt && (
                              <div className="ml-7 p-1.5 bg-black/50 border border-slate-800/80 rounded text-[9.5px] text-emerald-300 font-mono">
                                {step.resultExcerpt}
                              </div>
                            )}

                            {step.requiresConsent && (
                              <div className="ml-7 text-[9px] text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>要明示同意 (46章 プラグイン権限)</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 設計思想 Master v5.0 第9章1節: 1.5B/3B ドラフト検算結果カード */}
                  {msg.draftVerification && (
                    <div className="mt-3 p-2.5 bg-slate-950/90 border border-teal-500/40 rounded-xl space-y-2 text-xs shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-300 flex items-center gap-1.5 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                          <span>9章1節 1.5Bドラフト/3B検算 ({msg.draftVerification.verifierModel})</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          msg.draftVerification.agreed
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-700'
                        }`}>
                          スコア: {msg.draftVerification.score}/100 {msg.draftVerification.agreed ? '✅ 検算合格' : '⚠️ 要修正'}
                        </span>
                      </div>
                      {msg.draftVerification.critiqueNotes && msg.draftVerification.critiqueNotes.length > 0 && (
                        <div className="text-[10.5px] text-slate-300 bg-black/40 p-2 rounded border border-slate-800">
                          <span className="text-teal-400 font-semibold">3B講評: </span>
                          {msg.draftVerification.critiqueNotes.join(' ')}
                        </div>
                      )}
                      {msg.draftVerification.verifiedText && (
                        <div className="text-[10px] text-teal-300/90 flex items-center gap-1">
                          <span>※ 3Bモデルによる高精度な推敲・補正が適用されました</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 設計思想 Master v5.0 第13章: 自律型Web検索＆能動学習結果カード */}
                  {msg.autonomousSearch && (
                    <div className="mt-3 p-2.5 bg-slate-950/90 border border-sky-500/40 rounded-xl space-y-2 text-xs shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-300 flex items-center gap-1.5 text-[11px]">
                          <Globe className="w-3.5 h-3.5 text-sky-400" />
                          <span>13章 自律Web検索学習 ({msg.autonomousSearch.provider || 'API Search'})</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-700">
                          {msg.autonomousSearch.searchTimeMs}ms • {msg.autonomousSearch.results.length}件調査
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-300 bg-black/40 p-2 rounded border border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-1 text-sky-400 font-semibold">
                          <Search className="w-3 h-3" />
                          <span>検索クエリ: 「{msg.autonomousSearch.query}」</span>
                        </div>
                        {msg.autonomousSearch.summary && (
                          <div className="text-slate-300 pl-4 border-l-2 border-sky-500/60 leading-relaxed">
                            {msg.autonomousSearch.summary}
                          </div>
                        )}
                        {msg.autonomousSearch.learnedFacts && msg.autonomousSearch.learnedFacts.length > 0 && (
                          <div className="pt-1 text-[10px] text-emerald-400 font-mono">
                            ✓ 獲得した知識を長期記憶(意味記憶)および合成学習データセットへ自動定着しました
                          </div>
                        )}
                      </div>
                      {msg.autonomousSearch.results.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {msg.autonomousSearch.results.map((r, rIdx) => (
                            <a
                              key={rIdx}
                              href={r.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[10px] bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 px-2 py-1 rounded border border-slate-800 inline-flex items-center gap-1 transition-colors"
                              title={r.snippet}
                            >
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                              <span className="truncate max-w-[150px]">{r.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* みき自律自己改善・オートパイロット結果カード */}
                  {msg.autonomousEvolution && (
                    <div className="mt-3">
                      <AutonomousEvolutionCard
                        record={msg.autonomousEvolution}
                        onApplyRestoredCode={(filePath, content) => {
                          const fileName = filePath.split('/').pop() || filePath;
                          onApplyCode([
                            {
                              name: fileName,
                              path: filePath,
                              content,
                              language: 'typescript',
                            },
                          ]);
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Clean, minimalist message actions toolbar - strictly no vertical wrapping */}
                {!isUser && (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between gap-2 px-1 text-slate-500 select-none">
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        {/* Voice read */}
                        <button
                          type="button"
                          onClick={() => speakText(msg.content)}
                          className="p-1 rounded-md text-slate-500 hover:text-pink-400 hover:bg-slate-800/80 transition-colors"
                          title="音声で読み上げ"
                          aria-label="音声読み上げ"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Copy */}
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                          title="コピー"
                          aria-label="コピー"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Inline Feedback Rating */}
                        <button
                          type="button"
                          onClick={() => handleFeedback(msg, 'good')}
                          className={`p-1 rounded-md transition-colors ${
                            msg.userFeedback === 'good'
                              ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30'
                              : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-800/80'
                          }`}
                          title="良い回答 (高評価)"
                          aria-label="高評価"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (msg.userFeedback === 'bad') {
                              handleFeedback(msg, 'bad');
                            } else {
                              setFeedbackFeedbackId(feedbackFeedbackId === msg.id ? null : msg.id);
                            }
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            msg.userFeedback === 'bad'
                              ? 'text-rose-400 bg-rose-950/60 border border-rose-500/30'
                              : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800/80'
                          }`}
                          title="改善が必要 (低評価)"
                          aria-label="低評価"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>

                        {/* More options dropdown: なぜこの回答・分岐・仕分けなどを格納して常時露出を排除 */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setActiveMoreMenuMsgId(activeMoreMenuMsgId === msg.id ? null : msg.id)}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
                            title="その他の機能"
                            aria-label="その他"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {activeMoreMenuMsgId === msg.id && (
                            <div className="absolute left-0 bottom-full mb-1.5 z-30 w-48 bg-slate-950 border border-slate-800 rounded-xl p-1 shadow-2xl text-xs space-y-0.5 whitespace-nowrap animate-in fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenWhyInspector(msg);
                                  setActiveMoreMenuMsgId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span>なぜこの回答？ (思考ログ)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleForkFromMessage(msg.id);
                                  setActiveMoreMenuMsgId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <GitBranch className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                <span>ここから会話を分岐</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleRouteMessageExperience(msg);
                                  setActiveMoreMenuMsgId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Compass className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span>記憶・スキルの仕分け</span>
                              </button>
                              {onDeleteMessage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteMessage(msg.id);
                                    setActiveMoreMenuMsgId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-800/80 mt-0.5 pt-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <span>この発言を削除</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {msg.isStreaming && onStopGeneration && (
                        <button
                          type="button"
                          onClick={onStopGeneration}
                          className="flex items-center gap-1 px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 hover:text-rose-100 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap active:scale-95 cursor-pointer"
                        >
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>停止</span>
                        </button>
                      )}
                    </div>

                    {/* 49章 経験仕分け判定通知トースト */}
                    {experienceToast && experienceToast.msgId === msg.id && (
                      <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-500/50 text-[10.5px] text-purple-200 animate-fadeIn flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>{experienceToast.text}</span>
                      </div>
                    )}

                    {/* Negative Feedback Reasoning Popover */}
                    {feedbackFeedbackId === msg.id && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-rose-500/40 text-xs space-y-2 animate-in fade-in">
                        <div className="text-rose-300 font-bold text-[10.5px] flex items-center justify-between">
                          <span>改善が必要な理由（自己改善ルーターに送信されます）:</span>
                          <button
                            onClick={() => setFeedbackFeedbackId(null)}
                            className="text-slate-500 hover:text-slate-300"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            '記憶・過去の話を忘れている',
                            'コードが動かない・構文エラー',
                            '口調がロボット的・硬すぎる',
                            '指示と違う・見当違い',
                          ].map((reason, rIdx) => (
                            <button
                              key={rIdx}
                              onClick={() => handleFeedback(msg, 'bad', reason)}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-200 border border-slate-800 text-[10px] transition-colors"
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {(isLoading || isGenerating) && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center text-white text-base shadow-md shadow-pink-500/20 shrink-0 animate-pulse">
              {persona.avatar}
            </div>
            <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl rounded-tl-sm text-xs text-slate-300 max-w-[85%] shadow-lg">
              <div className="flex items-center justify-between gap-4 mb-1.5 font-semibold text-pink-400">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {engineMode === 'webgpu'
                      ? 'オンデバイス GPU で応答を生成中...'
                      : `${persona.name}が思考中...`}
                  </span>
                </div>
                {onStopGeneration && (
                  <button
                    onClick={onStopGeneration}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[11px] font-bold shadow transition-all active:scale-95"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>停止</span>
                  </button>
                )}
              </div>
              <div className="space-y-1.5 text-[10.5px] text-slate-400">
                {/* リアルタイム実行ステップバッジ */}
                {latestLiveStep ? (
                  <div className="p-2 bg-slate-950/70 rounded-lg border border-indigo-500/30 text-indigo-200 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-pink-300 font-bold flex items-center gap-1">
                        <Activity className="w-3 h-3 animate-spin text-pink-400" />
                        工程 {latestLiveStep.stepNumber}/{latestLiveStep.totalSteps}:
                      </span>
                      <span className="text-slate-400">+{latestLiveStep.elapsedMs}ms</span>
                    </div>
                    <div className="font-sans font-semibold text-slate-100 text-[11px] truncate">
                      {latestLiveStep.title}
                    </div>
                    {/* プログレスバー */}
                    <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden mt-0.5">
                      <div
                        className="bg-gradient-to-r from-pink-500 via-indigo-500 to-emerald-400 h-1 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(10, (latestLiveStep.stepNumber / latestLiveStep.totalSteps) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-pink-300">
                    <Heart className="w-3 h-3" />
                    <span>あなたとの会話＆記憶を読み込み中...</span>
                  </div>
                )}

                {useSearch && (
                  <div className="flex items-center gap-1.5 text-emerald-400 animate-pulse">
                    <Search className="w-3 h-3" />
                    <span>Google Search で最新情報を検索中...</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setIsActivityMonitorOpen(true)}
                    className="text-[10px] text-indigo-300 hover:text-indigo-200 underline flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>⚡ リアルタイム思考モニターを開く</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached files preview bar */}
      {attachedFiles.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 bg-sky-950/80 border border-sky-500/40 text-sky-300 text-[10.5px] px-2 py-0.5 rounded-lg"
            >
              <FileCode className="w-3 h-3 text-sky-400" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                onClick={() => removeAttachment(idx)}
                className="hover:text-rose-400 ml-1 p-0.5 text-slate-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Form Footer */}
      <div className="p-2 sm:p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        {/* みき自律改善クイックランチャートレイ */}
        {isSelfImplementLauncherOpen && (
          <div className="mb-2 p-2.5 bg-slate-950/95 border border-fuchsia-500/40 rounded-xl space-y-1.5 text-xs shadow-xl animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="font-bold text-fuchsia-300 flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>みき自律コード改善＆自己実装ランチャー</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSelfImplementLauncherOpen(false)}
                className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setInputText('【自律バグ修復】現在のコードベース内の構文エラーや実行時例外、不整合を自己診断し、直ちに修正差分を作成して適用してください。');
                  setIsSelfImplementLauncherOpen(false);
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-fuchsia-950/60 border border-slate-800 hover:border-fuchsia-500/40 rounded-lg text-slate-300 hover:text-fuchsia-200 text-left transition-colors cursor-pointer"
              >
                <Bug className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate">🐛 構文＆例外の自己診断・自律修復</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText('【自律リファクタリング】不要なデッドコード、重複処理を排除し、最新のTypeScriptベストプラクティスに従ってコードを最適化してください。');
                  setIsSelfImplementLauncherOpen(false);
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-fuchsia-950/60 border border-slate-800 hover:border-fuchsia-500/40 rounded-lg text-slate-300 hover:text-fuchsia-200 text-left transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">⚡ デッドコード排除・最適化</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText('【ASTシンボル＆未実装分析】リポジトリ内の関数・クラス・エクスポートをスキャンし、まだ実装されていない機能ギャップを特定して実装計画を立ててください。');
                  setIsSelfImplementLauncherOpen(false);
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-fuchsia-950/60 border border-slate-800 hover:border-fuchsia-500/40 rounded-lg text-slate-300 hover:text-fuchsia-200 text-left transition-colors cursor-pointer"
              >
                <ListTree className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">🗺️ ASTシンボル構造＆ギャップ診断</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelfImplementLauncherOpen(false);
                  setIsDependencyGraphModalOpen(true);
                }}
                className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-teal-950/60 border border-slate-800 hover:border-teal-500/40 rounded-lg text-slate-300 hover:text-teal-200 text-left transition-colors cursor-pointer"
              >
                <Network className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="truncate">🕸️ 依存関係＆循環参照インスペクター</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText('【TDD単体テスト生成＆検証】主要モジュールの正常系・境界値・不変条件テストスイートを自動合成し、全テストPassを確認してください。');
                  setIsSelfImplementLauncherOpen(false);
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/40 rounded-lg text-slate-300 hover:text-indigo-200 text-left transition-colors cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">🧪 TDD単体テスト自動合成＆検証</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelfImplementLauncherOpen(false);
                  setIsTimeMachineOpen(true);
                }}
                className="flex items-center gap-1.5 p-2 bg-slate-900 hover:bg-fuchsia-950/60 border border-slate-800 hover:border-fuchsia-500/40 rounded-lg text-slate-300 hover:text-fuchsia-200 text-left transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                <span className="truncate">⏱️ タイムマシン (自動退避から即時復元)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelfImplementLauncherOpen(false);
                  setIsAutonomousImprovementModalOpen(true);
                }}
                className="flex items-center gap-1.5 p-2 bg-gradient-to-r from-emerald-950/80 to-teal-950/80 hover:from-emerald-900/90 hover:to-teal-900/90 border border-emerald-500/50 rounded-lg text-emerald-200 text-left transition-all cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 text-emerald-300 shrink-0 animate-pulse" />
                <span className="truncate font-semibold">🤖 自律コード巡回・オートパイロット</span>
              </button>

              {onOpenSelfImprovementModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSelfImplementLauncherOpen(false);
                    onOpenSelfImprovementModal();
                  }}
                  className="flex items-center gap-1.5 p-2 bg-gradient-to-r from-fuchsia-950/80 to-indigo-950/80 hover:from-fuchsia-900/90 hover:to-indigo-900/90 border border-fuchsia-500/50 rounded-lg text-fuchsia-200 text-left transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                  <span className="truncate">🛠️ 自己改善スタジオを開く</span>
                </button>
              )}
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          accept=".html,.js,.ts,.json,.css,.txt,.md,.png,.jpg,.jpeg,.svg,.glsl,.wgsl,.zip,application/zip"
        />

        {/* 設計思想 第35/54章: みきの先回りインサイト・気配りバー */}
        {proactiveInsights.length > 0 && !isProactiveBarDismissed && (
          <div className="mb-2 p-2 rounded-xl bg-slate-950/90 border border-purple-900/40 backdrop-blur-xs shadow-xs animate-in fade-in slide-in-from-bottom-1">
            <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                <span>みきの先回り気配り・おすすめアクション</span>
              </div>
              <button
                type="button"
                onClick={() => setIsProactiveBarDismissed(true)}
                className="text-slate-500 hover:text-slate-300 text-xs px-1 py-0.5 rounded transition-colors"
                title="閉じる"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
              {proactiveInsights.map((insight) => {
                const colorMap: Record<string, string> = {
                  CARE: 'bg-pink-950/40 border-pink-800/50 text-pink-200 hover:bg-pink-900/50',
                  TIP: 'bg-indigo-950/40 border-indigo-800/50 text-indigo-200 hover:bg-indigo-900/50',
                  SHORTCUT: 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200 hover:bg-emerald-900/50',
                  EVOLUTION: 'bg-cyan-950/40 border-cyan-800/50 text-cyan-200 hover:bg-cyan-900/50',
                };
                const borderClass = colorMap[insight.type] || 'bg-slate-900 border-slate-700 text-slate-200';

                return (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => handleApplyInsight(insight)}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-all flex items-center gap-2 cursor-pointer ${borderClass}`}
                  >
                    <span className="text-sm shrink-0">{insight.emoji}</span>
                    <div className="max-w-[200px] sm:max-w-[260px] truncate">
                      <div className="font-bold truncate text-[11px]">{insight.title}</div>
                      <div className="text-[10px] opacity-80 truncate">{insight.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-end gap-1.5 sm:gap-2 bg-slate-950 border border-slate-800 focus-within:border-indigo-500/60 focus-within:ring-1 focus-within:ring-indigo-500/20 rounded-xl p-1 sm:p-1.5 transition-all shadow-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition-colors shrink-0"
            title="画像・ファイル・コードを添付"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsSelfImplementLauncherOpen(!isSelfImplementLauncherOpen)}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              isSelfImplementLauncherOpen
                ? 'text-fuchsia-300 bg-fuchsia-950/80 border border-fuchsia-500/50 shadow-xs'
                : 'text-slate-400 hover:text-fuchsia-300 hover:bg-slate-900'
            }`}
            title="みき自己実装・自律コード改善ランチャー"
          >
            <Rocket className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsAutonomousImprovementModalOpen(true)}
            className="p-2 rounded-lg transition-colors shrink-0 text-slate-400 hover:text-emerald-300 hover:bg-slate-900"
            title="みき自律コード改善・オートパイロット"
          >
            <Bot className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setUseSearch(!useSearch)}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              useSearch
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Google検索グラウンディング"
          >
            <Search className="w-4 h-4" />
          </button>

          {onToggleMultiStep && (
            <button
              type="button"
              onClick={onToggleMultiStep}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                isMultiStepEnabled
                  ? 'text-indigo-400 bg-indigo-950/60 border border-indigo-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title={
                isMultiStepEnabled
                  ? '多段推論タスク計画モード: 有効 (要件分析・検証ステップを実行)'
                  : '多段推論タスク計画モード: 自動判定 (クリックで常時計画モードに固定)'
              }
            >
              <Layers className="w-4 h-4" />
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onInput={(e) => {
              const val = (e.target as HTMLTextAreaElement).value;
              setInputText(val);
            }}
            onCompositionStart={(e) => {
              const val = (e.currentTarget as HTMLTextAreaElement).value;
              setInputText(val);
            }}
            onCompositionUpdate={(e) => {
              const val = (e.currentTarget as HTMLTextAreaElement).value;
              setInputText(val);
            }}
            onCompositionEnd={(e) => {
              const val = (e.currentTarget as HTMLTextAreaElement).value;
              setInputText(val);
            }}
            onKeyUp={(e) => {
              const val = (e.currentTarget as HTMLTextAreaElement).value;
              if (val !== inputText) setInputText(val);
            }}
            onBlur={(e) => {
              const val = (e.currentTarget as HTMLTextAreaElement).value;
              if (val !== inputText) setInputText(val);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`${persona.name}にメッセージを入力...`}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-xs text-slate-100 placeholder-slate-500 resize-none py-2 px-1 leading-relaxed max-h-24"
          />

          {isLoading || isGenerating ? (
            <button
              type="button"
              onClick={handleSafeStop}
              className="px-3 py-2 min-h-[38px] rounded-lg flex items-center gap-1.5 font-semibold transition-all shrink-0 bg-rose-600 hover:bg-rose-500 text-white shadow-xs animate-pulse active:scale-95 cursor-pointer touch-manipulation text-xs"
              title="生成を中断する"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>停止</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              className="p-2 sm:p-2.5 min-w-[38px] min-h-[38px] rounded-lg flex items-center justify-center font-bold transition-all shrink-0 cursor-pointer touch-manipulation bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-xs"
              title="メッセージを送信"
              aria-label="送信"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Engine status indicator */}
        <div className="mt-1 px-1 flex items-center justify-between text-[10px] text-slate-500 select-none">
          <div className="flex items-center gap-1.5 text-emerald-400/90 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">WebGPUローカル実行（完全無料）</span>
          </div>
          {onOpenEngineModal && (
            <button
              onClick={onOpenEngineModal}
              className="text-slate-400 hover:text-slate-200 text-[10px] shrink-0"
            >
              設定
            </button>
          )}
        </div>
      </div>

      {/* 第31.1章 ライブ会話リペア発火通知バナー */}
      {liveRepairAlert && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 bg-amber-950/90 border border-amber-500/60 text-amber-200 px-4 py-2 rounded-xl shadow-xl backdrop-blur-sm flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <div>
            <span className="font-bold text-amber-300">[第31.1章 ライブリペア]</span>{' '}
            指摘トリガー「{liveRepairAlert.trigger}」を検知。
            <span className="text-amber-100/90 ml-1">{liveRepairAlert.advice}</span>
          </div>
          <button
            onClick={() => setLiveRepairAlert(null)}
            className="text-amber-400 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* 第31.2章 会話ブランチ・巻き戻しモーダル */}
      <ConversationBranchModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        branches={branches}
        activeBranchId={activeBranchId}
        onSwitchBranch={handleSwitchBranch}
        onMergeIntoMain={handleMergeBranch}
        onDeleteBranch={handleDeleteBranch}
        onCreateNewBranch={handleCreateBranch}
      />

      {/* 第31.3章 なぜこの回答？説明パネルモーダル */}
      <WhyAnswerInspectorModal
        isOpen={isInspectionModalOpen}
        onClose={() => setIsInspectionModalOpen(false)}
        inspection={selectedInspection}
      />

      {/* 第31.10 / 31.14 / 31.15章 会話タスクボード＆設定モーダル */}
      <ConversationTaskboardModal
        isOpen={isTaskboardModalOpen}
        onClose={() => setIsTaskboardModalOpen(false)}
        tasks={tasks}
        proactiveLevel={proactiveLevel}
        explanationOverride={explanationOverride}
        onUpdateStatus={handleUpdateTaskStatus}
        onDeleteTask={handleDeleteTask}
        onAddTask={handleAddTask}
        onSetProactiveLevel={handleSetProactiveLevel}
        onSetExplanationOverride={handleSetExplanationOverride}
      />

      {/* リアルタイム行動・思考モニターモーダル (ユーザー要望: リアルタイムに今何をしているか可視化) */}
      <RealtimeActivityMonitorModal
        isOpen={isActivityMonitorOpen}
        onClose={() => setIsActivityMonitorOpen(false)}
        isLoading={isLoading}
        isGenerating={isGenerating}
      />

      {/* 差分プレビュー & 安全適用モーダル */}
      {diffModalState && (
        <DiffPreviewModal
          isOpen={diffModalState.isOpen}
          onClose={() => setDiffModalState(null)}
          fileName={diffModalState.fileName}
          oldCode={diffModalState.oldCode}
          newCode={diffModalState.newCode}
          onApply={handleApplyDiffCode}
        />
      )}

      {/* 🧪 TDD ユニットテスト自動合成＆検証スタジオモーダル */}
      {testModalState && (
        <UnitTestStudioModal
          isOpen={testModalState.isOpen}
          onClose={() => setTestModalState(null)}
          fileName={testModalState.fileName}
          code={testModalState.code}
          onSaveTestFile={(testFileName, testContent) => {
            onApplyCode([
              {
                name: testFileName,
                path: testFileName.startsWith('src/') ? testFileName : `src/${testFileName}`,
                content: testContent,
                language: 'typescript',
              },
            ]);
            setTestModalState(null);
          }}
          onRequestFix={(failInfo) => {
            setInputText(`【単体テスト駆動修復】以下のテスト失敗を解決するようにコードを修正してください：\n${failInfo}`);
            textareaRef.current?.focus();
            setTestModalState(null);
          }}
        />
      )}

      {/* 🕸️ 依存関係＆循環参照インスペクターモーダル */}
      <DependencyGraphModal
        isOpen={isDependencyGraphModalOpen}
        onClose={() => setIsDependencyGraphModalOpen(false)}
        files={workspaceFiles}
        onSelectFile={(path) => {
          setIsDependencyGraphModalOpen(false);
        }}
        onRequestRefactor={(prompt) => {
          setInputText(prompt);
          textareaRef.current?.focus();
          setIsDependencyGraphModalOpen(false);
        }}
      />

      {/* ⏱️ みき自律コード スナップショット・タイムマシンモーダル */}
      <SnapshotTimeMachineModal
        isOpen={isTimeMachineOpen}
        onClose={() => setIsTimeMachineOpen(false)}
        onRollbackComplete={(filePath, restoredContent) => {
          const fileName = filePath.split('/').pop() || filePath;
          onApplyCode([
            {
              name: fileName,
              path: filePath,
              content: restoredContent,
              language: 'typescript',
            },
          ]);
        }}
      />

      {/* 🤖 みき自律コード自動巡回・オートパイロット＆自己改善スタジオモーダル */}
      <AutonomousSelfImprovementModal
        isOpen={isAutonomousImprovementModalOpen}
        onClose={() => setIsAutonomousImprovementModalOpen(false)}
        onOpenDiff={(fileName, oldCode, newCode, filePath) => {
          setDiffModalState({
            isOpen: true,
            fileName,
            oldCode,
            newCode,
            filePath,
          });
        }}
        onOpenUnitTest={(block) => {
          setTestModalState({
            isOpen: true,
            fileName: block.name,
            code: block.content,
          });
        }}
        onApplyRestoredCode={(filePath, content) => {
          const fileName = filePath.split('/').pop() || filePath;
          onApplyCode([
            {
              name: fileName,
              path: filePath,
              content,
              language: 'typescript',
            },
          ]);
        }}
      />
    </div>
  );
};


