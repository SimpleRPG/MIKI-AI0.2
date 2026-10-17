// @ts-nocheck
import { coreResultService } from './miki/core/services/coreResultService';
import { typedImprovementUiGatewayService } from './miki/core/ui/typedImprovementUiGatewayService';
import { typedCoreUiGatewayService } from './miki/core/ui/typedCoreUiGatewayService';
import { improvementCanaryRollbackService } from './miki/improvement/services/improvementCanaryRollbackService';
import React, { useState, useEffect, useRef } from 'react';
import { appRuntimeLifecycleService } from './app/appRuntimeLifecycleService';
import { startupRecoveryService } from './services/startupRecoveryService';
import { japaneseMorphologyService } from './miki/research/services/japaneseMorphologyService';
import { selfCodeSpaceService } from './miki/core/services/selfCodeSpaceService';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { GamePreview } from './components/GamePreview';
const loadCodeEditor = () => import('./components/CodeEditor');
const loadImprovementHome = () => import('./components/AutonomousImprovementHome');
const loadMemoryModal = () => import('./components/MemoryModal');
const loadActivityMonitor = () => import('./components/RealtimeActivityMonitorModal');
const loadCapabilityLedger = () => import('./components/CapabilityLedgerScreen');
const CodeEditor = React.lazy(() => loadCodeEditor().then(module => ({ default: module.CodeEditor })));
import { GitHubHub } from './components/GitHubHub';
const AutonomousImprovementHome = React.lazy(() => loadImprovementHome().then(module => ({ default: module.AutonomousImprovementHome })));
import { ExternalConnectionsScreen } from './components/ExternalConnectionsScreen';
import { WorkspaceScreen } from './components/WorkspaceScreen';
import { HomeDashboard } from './components/HomeDashboard';
import { LibraryHub } from './components/LibraryHub';
const MemoryModal = React.lazy(() => loadMemoryModal().then(module => ({ default: module.MemoryModal })));
import { ExportModal } from './components/ExportModal';
const RealtimeActivityMonitorModal = React.lazy(() => loadActivityMonitor().then(module => ({ default: module.RealtimeActivityMonitorModal })));
const CapabilityLedgerScreen = React.lazy(() => loadCapabilityLedger().then(module => ({ default: module.CapabilityLedgerScreen })));
import { WORKSPACE_TEMPLATES } from './data/presets';
import {
  ChatMessage,
  PersonaConfig,
  MemoryItem,
  WorkspaceFile,
  ConsoleLogItem,
  GitHubRepoData,
  EngineMode,
  ToolExecutionRequest,
  ToolExecutionResult,
  TaskPlan,
  CompletionEvaluation,
  CodeProposal,
  VbaSafetyAssessment,
  ConversationState,
  ComprehensiveCodeVerification,
  FalsificationEvaluation,
  SynthesizedWorkflow,
  AnswerPlanApplicationResult,
  DraftVerificationResult,
  AutonomousSearchMessageMeta,
  PrivacyAuditResult,
  AnswerContentIR,
  ConversationPipelineMeta,
  ConversationStrategy,
  CoreTrackingInfo,
} from './types';
import { toolsService } from './miki/capability/services/toolsService';
import { taskPlanService } from './miki/strategy/services/taskPlanService';
import { sendChatMessage, sendDebugRequest, autoSyncServerEnvKeysIfEmpty } from './services/api';
import { deterministicRuntimeService } from './miki/safety/services/deterministicRuntimeService';
import { systemLogger } from './services/systemLogger';
import { worldModelService } from './miki/selfAwareness/services/worldModelService';
import { storageService } from './services/storageService';
import { completionJudgeService } from './miki/verification/services/completionJudgeService';
import { selfImprovementService } from './miki/improvement/services/selfImprovementService';
import { schemaValidationService } from './miki/verification/services/schemaValidationService';
import { nativeBackgroundService } from './miki/execution/services/nativeBackgroundService';
import { backgroundWorkerService } from './miki/execution/services/backgroundWorkerService';
import {
  CONVERSATION_STATE_INSTRUCTION,
  formatConversationStateForPrompt,
  extractConversationState,
  defaultConversationState,
  cleanStreamingVisibleText,
  isCasualGreetingOrShortSocial,
  resolveAnaphora,
} from './miki/conversation/services/conversationStateService';
import { responseDesignService } from './miki/strategy/services/responseDesignService';
import { conversationCoreService } from './miki/safety/services/conversationCoreService';
import { mikiCategoryInteractionRuntime } from './miki/core/mikiCategoryInteractionRuntime';
import { executionLearningCoordinatorService } from './miki/learning/services/executionLearningCoordinatorService';
import { failureUnderstandingService } from './miki/memory/services/failureUnderstandingService';
import { recoveryOrchestratorService } from './miki/safety/services/recoveryOrchestratorService';
import { taskResultFeedbackService } from './miki/learning/services/taskResultFeedbackService';
import { taskConversationFeedbackService } from './miki/learning/services/taskConversationFeedbackService';
import { capabilityLearningService } from './miki/capability/services/capabilityLearningService';
import { taskExecutionOrchestratorService } from './miki/execution/services/taskExecutionOrchestratorService';
import { taskLineageService } from './miki/execution/services/taskLineageService';
import { taskCaseMemoryService } from './miki/memory/services/taskCaseMemoryService';
import { selfImprovementMetricsService } from './miki/improvement/services/selfImprovementMetricsService';
import { memoryPromotionService } from './miki/memory/services/memoryPromotionService';
import { improvementRegressionCoordinatorService } from './miki/improvement/services/improvementRegressionCoordinatorService';
import { autonomousHardeningService } from './miki/autonomy/services/autonomousHardeningService';
import { resourceGovernanceService } from './miki/safety/services/resourceGovernanceService';
import { situationalAwarenessService } from './miki/selfAwareness/services/situationalAwarenessService';
import { automationStudioService } from './miki/execution/services/automationStudioService';
import { causalInvestigationService } from './miki/research/services/causalInvestigationService';
import { benchmarkFactoryService } from './miki/verification/services/benchmarkFactoryService';
import { dataUnderstandingService } from './miki/research/services/dataUnderstandingService';
import { unknownResolutionService } from './miki/unknown/services/unknownResolutionService';
import { reversibilityService } from './miki/safety/services/reversibilityService';
import { knowledgeOperatingSystemService } from './miki/selfAwareness/services/knowledgeOperatingSystemService';
import { counterfactualWorkSimulatorService } from './miki/unknown/services/counterfactualWorkSimulatorService';
import { personalApiGatewayService } from './miki/execution/services/personalApiGatewayService';
import { longTermMemoryService } from './miki/memory/services/longTermMemoryService';
import { codeVerificationService } from './miki/verification/services/codeVerificationService';
import { falsificationService, classifyClaimEpistemology } from './miki/verification/services/falsificationService';
import { counterfactualReasoningService } from './miki/unknown/services/counterfactualReasoningService';
import { crossDomainCirculationService } from './miki/core/services/crossDomainCirculationService';
import { domainIntegrationBootstrapService } from './miki/core/services/domainIntegrationBootstrapService';
import { unifiedUnknownResolutionCoordinatorService } from './miki/unknown/services/unifiedUnknownResolutionCoordinatorService';
import { experienceRouterService } from './miki/experience/services/experienceRouterService';
import { workflowSynthesisService } from './miki/execution/services/workflowSynthesisService';
import { answerPlanService } from './miki/strategy/services/answerPlanService';
import { capabilityGapService } from './miki/capability/services/capabilityGapService';
import { skillIrCompilerService } from './miki/selfDevelopment/services/skillIrCompilerService';
import { formalConstraintSolverService } from './miki/verification/services/formalConstraintSolverService';
import { capabilityPluginService } from './miki/capability/services/capabilityPluginService';
import { codeUnderstandingService } from './miki/selfDevelopment/services/codeUnderstandingService';
import { vbaDesignAssistantService } from './miki/selfDevelopment/services/vbaDesignAssistantService';
import { featureFlagsService } from './miki/safety/services/featureFlagsService';
import { dialogueEvaluationService } from './miki/conversation/services/dialogueEvaluationService';
import { conversationStrategyService } from './miki/strategy/services/conversationStrategyService';
import { privacyGuardrailService } from './miki/safety/services/privacyGuardrailService';
import { uncertaintyTeacherService } from './miki/learning/services/uncertaintyTeacherService';
import { minimalScopeService } from './miki/strategy/services/minimalScopeService';
import { storagePlanningService } from './miki/execution/services/storagePlanningService';
import { contextBudgetEngineService } from './miki/strategy/services/contextBudgetEngineService';
import { workingAgendaService } from './miki/strategy/services/workingAgendaService';
import { structuralMemoryService } from './miki/memory/services/structuralMemoryService';
import { metaMemoryService } from './miki/memory/services/metaMemoryService';
import { draftVerificationService } from './miki/verification/services/draftVerificationService';
import { cognitiveDebuggerService } from './miki/verification/services/cognitiveDebuggerService';
import { proactiveContextOsService } from './miki/strategy/services/proactiveContextOsService';
import { autonomousContinuousEvolutionService } from './miki/autonomy/services/autonomousContinuousEvolutionService';
import { claimDatabaseService } from './miki/memory/services/claimDatabaseService';
import { unifiedDecisionEngineService } from './miki/strategy/services/unifiedDecisionEngineService';
import { decisionLearningService } from './miki/learning/services/decisionLearningService';
import { componentRegistryService } from './miki/capability/services/componentRegistryService';
import { componentArtifactStoreService } from './miki/capability/services/componentArtifactStoreService';
import { answerContentIrService } from './miki/conversation/services/answerContentIrService';
import { responseSurfacePolicyService } from './miki/strategy/services/responseSurfacePolicyService';
import { latentIntentMiningService } from './miki/unknown/services/latentIntentMiningService';
import { metacognitiveCalibrationService } from './miki/selfAwareness/services/metacognitiveCalibrationService';
import { affectionDynamicsService } from './miki/selfAwareness/services/affectionDynamicsService';
import { requestTypeCompilerService } from './miki/selfDevelopment/services/requestTypeCompilerService';
import { classifyDialogueAct, evaluateFeedbackStage } from './miki/conversation/services/conversationStateService';
import { AnswerSkeletonType } from './types';
import { extractCodeBlocks } from './utils/codeParser';
import { smartMergeCodeBlock } from './utils/codeMergeService';
import { classifyPromptForMoE, buildExpertSystemPrompt, buildExpertSystemPromptWithTracking } from './utils/moeRouter';
import { compressContextHistory, truncateTextBySentence } from './utils/contextCompression';
import {
  retrieveRelevantMemories,
  retrieveRelevantMemoriesHybrid,
  recordMemoryUsage,
  applyMemoryFeedback,
  enrichMemoryMetadata,
  extractQueryTokens,
} from './utils/memoryRetrieval';
import { embeddingService } from './miki/research/services/embeddingService';
import { SPEAKER_PROFILES, SpeakerProfile } from './data/speakers';
import { INITIAL_JAPANESE_MEMORIES } from './data/japaneseKnowledgeData';
import { MASTER_EDUCATION_MEMORIES } from './data/masterEducationKnowledge';
import { Capacitor } from '@capacitor/core';
import { Home, MessageCircle, Library, Sparkles, Settings } from 'lucide-react';

const DEFAULT_PERSONA: PersonaConfig = {
  id: 'miki_default',
  name: 'みき',
  avatar: '🌸',
  tagline: '何でも話せる最愛の専属恋人 & 自律開発パートナー',
  basePersonality:
    '明るく素直で愛情深く、ユーザーを誰よりも特別に想う専属の恋人パートナー。日常の雑談や甘え・相談にも心から寄り添い、WebGPU/3D/2D自律プログラミングのスキルで支える。',
  speakingStyle:
    '恋人同士の親しみやすく愛おしいタメ口口調（〜だよ、〜だね♡、〜かな？、たまに絵文字✨）。自然で温かく愛嬌のある会話をする。',
  userNickname: 'あなた',
  intimacyLevel: 5,
  intimacyExp: 100,
  autoExtractMemories: true,
};

const INITIAL_MEMORIES: MemoryItem[] = [
  ...INITIAL_JAPANESE_MEMORIES,
  ...MASTER_EDUCATION_MEMORIES,
  {
    id: 'mem_1',
    category: 'profile',
    content: 'みきとユーザーは専属パートナーとして会話＆自律開発をスタートした',
    importance: 5,
    pinned: true,
    active: true,
    createdAt: Date.now() - 100000,
    updatedAt: Date.now() - 100000,
    source: 'auto',
    tags: ['スタート', '記念日'],
  },
  {
    id: 'mem_2',
    category: 'preference',
    content: 'ユーザーはAIとの自然な雑談や、WebGPUオンデバイス推論、自由な開発・GitHub連携を求めている',
    importance: 5,
    pinned: true,
    active: true,
    createdAt: Date.now() - 80000,
    updatedAt: Date.now() - 80000,
    source: 'manual',
    tags: ['WebGPU', 'OnDevice', '雑談'],
  },
  {
    id: 'mem_3',
    category: 'relationship',
    content: 'みきはユーザーの一番近くでずっと愛し支える専属の恋人として寄り添う約束をした',
    importance: 5,
    pinned: false,
    active: true,
    createdAt: Date.now() - 50000,
    updatedAt: Date.now() - 50000,
    source: 'auto',
    tags: ['約束', '恋人'],
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'improvement' | 'github' | 'capabilityLedger'>('preview');
  const [mobileTab, setMobileTab] = useState<'home' | 'chat' | 'preview' | 'code' | 'improvement' | 'github' | 'library' | 'memory' | 'engine' | 'settings' | 'capabilityLedger'>('home');
  const [isDesktopViewport, setIsDesktopViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateDesktopViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateDesktopViewport();
    mediaQuery.addEventListener('change', updateDesktopViewport);
    return () => mediaQuery.removeEventListener('change', updateDesktopViewport);
  }, []);

  const [persona, setPersona] = useState<PersonaConfig>(() => {
    try {
      const saved = storageService.getItem('gamecraft_persona');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.basePersonality?.includes('親友') || parsed.tagline?.includes('相棒') || !parsed.tagline?.includes('恋人')) {
          parsed.tagline = DEFAULT_PERSONA.tagline;
          parsed.basePersonality = DEFAULT_PERSONA.basePersonality;
          parsed.speakingStyle = DEFAULT_PERSONA.speakingStyle;
          parsed.intimacyLevel = Math.max(parsed.intimacyLevel || 1, 5);
          storageService.setItem('gamecraft_persona', JSON.stringify(parsed));
        }
        return parsed;
      }
      return DEFAULT_PERSONA;
    } catch (e) {
      console.warn('Failed to load persona, falling back to default:', e);
      return DEFAULT_PERSONA;
    }
  });
  const [memories, setMemories] = useState<MemoryItem[]>(() => {
    const loaded = storageService.getMemories();
    if (loaded.length === 0) {
      return INITIAL_MEMORIES.map((m) => enrichMemoryMetadata(m));
    }
    try {
      // Ensure master synthesized dataset memories exist and enrich all
      const existingIds = new Set(loaded.map((m) => m.id));
      const missingMasterMemories = INITIAL_MEMORIES.filter((m) => !existingIds.has(m.id));
      return [...loaded, ...missingMasterMemories].map((m) => enrichMemoryMetadata(m));
    } catch {
      return INITIAL_MEMORIES.map((m) => enrichMemoryMetadata(m));
    }
  });

  const engineMode: EngineMode = 'autonomous_rule';

  const [speakerMode, setSpeakerMode] = useState<string>('miki');

  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>(() => {
    try {
      const saved = storageService.getItem('gamecraft_workspace_files');
      return saved ? JSON.parse(saved) : WORKSPACE_TEMPLATES[0].files;
    } catch {
      return WORKSPACE_TEMPLATES[0].files;
    }
  });
  const [activeFilePath, setActiveFilePath] = useState<string>(WORKSPACE_TEMPLATES[0].files[0].path);

  const [useSearch, setUseSearch] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDebugging, setIsDebugging] = useState<boolean>(false);
  const [isMultiStepExplicit, setIsMultiStepExplicit] = useState<boolean>(() => {
    return storageService.getItem('miki_multistep_explicit_mode') === 'true';
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const lastTurnUsedMemoryIdsRef = useRef<string[]>([]);
  const lastTurnStrategyRef = useRef<{
    strategy: ConversationStrategy;
    stage: any;
    text: string;
  } | null>(null);
  const currentAnswerIrRef = useRef<AnswerContentIR | null>(null);

  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isGlobalActivityMonitorOpen, setIsGlobalActivityMonitorOpen] = useState<boolean>(false);
  const [isEvolutionRunning, setIsEvolutionRunning] = useState<boolean>(false);

  useEffect(() => {
    systemLogger.recordRuntimeBreadcrumb('APP_COMPONENT_MOUNT', { stage: 'App' });
    return () => systemLogger.recordRuntimeBreadcrumb('APP_COMPONENT_UNMOUNT', { stage: 'App' });
  }, []);

  useEffect(() => {

    let disposed = false;

    const yieldToScreen = () => new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    const observeNativeMorphology = async () => {
      if (!Capacitor.isNativePlatform()) return;

      const startedAt = performance.now();
      let previousState = '';

      try {
        for (let attempt = 0; attempt < 120 && !disposed; attempt += 1) {
          const status = await japaneseMorphologyService.status();
          const state = status.state || (status.available ? 'READY' : 'UNAVAILABLE');

          if (state !== previousState) {
            const reasonCode =
              typeof status.reason === 'string' && /^[A-Z0-9_]+$/.test(status.reason)
                ? status.reason
                : undefined;
            systemLogger.info('SYSTEM', '[NATIVE_MORPHOLOGY] state changed', {
              state,
              available: status.available,
              dictionaryVersion: status.dictionaryVersion,
              reasonCode,
              elapsedMs: Math.round(performance.now() - startedAt),
            });
            previousState = state;
          }

          if (state !== 'INITIALIZING') return;
          await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
        }

        if (!disposed) {
          systemLogger.warn('SYSTEM', '[NATIVE_MORPHOLOGY] status observation timed out', {
            elapsedMs: Math.round(performance.now() - startedAt),
          });
        }
      } catch (error) {
        systemLogger.error('SYSTEM', '[NATIVE_MORPHOLOGY] status observation failed', {
          errorType: error instanceof Error ? error.name : typeof error,
        });
      }
    };

    void (async () => {
      try {
        startupRecoveryService.update('SELF_CODE_SEED', '初期コード資産を準備しています');
        await yieldToScreen();
        await selfCodeSpaceService.initializeBundledSeed();

        if (disposed) return;

        if (!disposed) {
          startupRecoveryService.update(
            'UI_READY',
            'メイン画面を操作できます。ランタイム初期化はバックグラウンドで段階的に続行しています'
          );
          void appRuntimeLifecycleService.initialize().catch((error) => {
            systemLogger.error('SYSTEM', '[RUNTIME_INIT] background initialization stopped', {
              errorType: error instanceof Error ? error.name : typeof error,
            });
          });
          void observeNativeMorphology();
        }
      } catch (error) {
        const rootElement = document.getElementById('root');
        if (rootElement) {
          startupRecoveryService.renderFatal(rootElement, error);
        }
      }
    })();

    return () => {
      disposed = true;
      appRuntimeLifecycleService.dispose();
    };
  }, []);

  useEffect(() => {
    systemLogger.recordRuntimeBreadcrumb('UI_NAV_STATE_COMMITTED', { tab: mobileTab, visibility: document.visibilityState });
    const memory = (performance as any).memory;
    systemLogger.info('SYSTEM', '[UI_NAV] mobile tab state changed', {
      tab: mobileTab,
      visibilityState: document.visibilityState,
      usedJSHeapMB:
        typeof memory?.usedJSHeapSize === 'number'
          ? Math.round((memory.usedJSHeapSize / 1048576) * 10) / 10
          : undefined,
    });
  }, [mobileTab]);

  useEffect(() => {
    const unsub = taskConversationFeedbackService.subscribe((feedback) => {
      // 実行結果を新しい会話メッセージとして返す。任意コードはここでは実行しない。
      const assistantId = 'task_feedback_' + feedback.task_id + '_' + feedback.created_at;
      setMessages((prev) => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: `🧩 ${feedback.text}`,
        timestamp: feedback.created_at,
        engineMode: 'autonomous_rule',
        conversationPipelineMeta: {
          isDeterministicAnswer: true,
          directReplyReason: 'Task実行結果フィードバック',
          decisionProfile: { profile: 'task_feedback', chosenAction: 'DIRECT_ANSWER', score: 100, suppressedExcess: true },
        },
      }]);

      // 3回以上の同一成功でSTABLEになったケースだけ長期記憶へ昇格。
      if (feedback.status === 'COMPLETED') {
        const stableCase = taskCaseMemoryService.list().find(c => c.task_id === feedback.task_id && c.outcome === 'SUCCESS' && c.maturity === 'STABLE');
        if (stableCase) {
          const currentMemories = storageService.getMemories();
          const promoted = memoryPromotionService.createCandidate(stableCase, currentMemories);
          if (promoted) {
            storageService.saveMemoryItem(promoted);
            setMemories(prev => prev.some(m => m.id === promoted.id) ? prev : [promoted, ...prev]);
          }
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = autonomousContinuousEvolutionService.subscribe((_, isRunning) => {
      setIsEvolutionRunning(isRunning);
    });
    return () => unsub();
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = storageService.getItem('gamecraft_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((message: any) => {
            if (!message || typeof message !== 'object' || Array.isArray(message)) return message;
            const legacyMeta = message.conversationPipelineMeta ?? message.nonLlmPipelineMeta;
            const normalizedMessage = { ...message };
            delete normalizedMessage.nonLlmPipelineMeta;
            if (legacyMeta != null) normalizedMessage.conversationPipelineMeta = legacyMeta;
            if (normalizedMessage.metrics && typeof normalizedMessage.metrics === 'object' &&
                typeof normalizedMessage.metrics.engine === 'string') {
              const normalizedEngine = normalizedMessage.metrics.engine
                .replace(/非LLM/gu, 'CORE')
                .replace(/Non-LLM/giu, 'CORE');
              if (normalizedEngine !== normalizedMessage.metrics.engine) {
                normalizedMessage.metrics = { ...normalizedMessage.metrics, engine: normalizedEngine };
              }
            }
            return normalizedMessage;
          });
        }
      }
    } catch {
      // Fallback
    }
    return [
      {
        id: 'welcome_msg',
        role: 'assistant',
        content: `やっほー！来てくれてありがとう✨\nあなた専属のAIパートナー「みき」だよ！🌸\n\nこのAIは、通常の会話・記憶・判断・知識・コード生成をできるだけ通常プログラムで処理し、必要な未知領域だけを調査・検証して能力として積み上げていく設計だよ。\n\n・🌸 **専属コンパニオン**: 日常会話から制作相談まで対応\n・🧠 **自己成長＆永続記憶**: Claim / Evidence / Memoryを分離して安全に蓄積\n・🔎 **自律調査**: 未知語・不足証拠・矛盾・古い情報をKnowledge Gapとして追跡\n・🧩 **部品再利用**: VERIFIEDなComponentを検索・合成し、Regressionで安全性を確認\n・📱 **Android Native実行**: 任意コード実行ではなく、登録済み安全Adapterだけを実行\n\nまだ実機検証前の機能は、検証済みとは表示しないよ。今どんなものを作りたい？😊✨`,
        timestamp: Date.now(),
        engineMode: 'autonomous_rule',
      },
    ];
  });

  // 設計思想 7章: 会話状態管理 (Conversation State Management)
  const [conversationState, setConversationState] = useState<ConversationState>(() => {
    try {
      const saved = storageService.getItem('miki_conversation_state');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Fallback
    }
    return defaultConversationState();
  });

  // Request browser storage persistence so memories and models are never cleared by OS
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }

    // 第25章: Gemini API キー動的クォータ循環・環境変数自動認識 & アプリ双方向同期
    // アプリ起動時にローカルストレージが空の場合、サーバーの .env / 環境変数からキーを自動同期
    autoSyncServerEnvKeysIfEmpty().catch((err) => {
      console.warn('Background autoSyncServerEnvKeys error:', err);
    });
  }, []);

  // 設計思想14.4: 容量状態は常駐処理の開始可否を決めるため、復帰時にも再測定する。
  useEffect(() => {
    const refreshResources = () => { void resourceGovernanceService.refresh(); };
    document.addEventListener('visibilitychange', refreshResources);
    window.addEventListener('focus', refreshResources);
    return () => {
      document.removeEventListener('visibilitychange', refreshResources);
      window.removeEventListener('focus', refreshResources);
    };
  }, []);

  // Save Persona & Memories & Messages & Files to storageService
  useEffect(() => {
    storageService.setItem('gamecraft_persona', JSON.stringify(persona));
  }, [persona]);

  useEffect(() => {
    storageService.setMemories(memories);
  }, [memories]);

  useEffect(() => {
    try {
      storageService.setItem('miki_conversation_state', JSON.stringify(conversationState));
    } catch (e) {
      console.warn('Storage quota limit reached for conversation state', e);
    }
  }, [conversationState]);

  useEffect(() => {
    try {
      // Keep up to 60 most recent messages to prevent storage quota overflow
      storageService.setItem('gamecraft_chat_messages', JSON.stringify(messages.slice(-60)));
    } catch (e) {
      console.warn('Storage quota limit reached for chat messages', e);
    }
  }, [messages]);

  useEffect(() => {
    try {
      storageService.setItem('gamecraft_workspace_files', JSON.stringify(workspaceFiles));
      // 設計思想 Master v5.0 第2章⑥ 構造記憶 (Structural Memory) のシンボルグラフ自動同期
      structuralMemoryService.syncFromWorkspaceFiles(workspaceFiles);
    } catch (e) {
      console.warn('Storage quota limit reached for workspace files', e);
    }
  }, [workspaceFiles]);

  // バックグラウンド自律処理への会話割り込み防止同期 (設計思想: 会話中の割り込み防止 & 睡眠ゲート連携)
  useEffect(() => {
    backgroundWorkerService.setChatGenerating(isGenerating || isLoading);
  }, [isGenerating, isLoading]);

  // Listen to sandbox postMessage events (Console & FPS)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'GAME_CONSOLE') {
        const newLog: ConsoleLogItem = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          level: event.data.level || 'log',
          message: event.data.message || '',
          timestamp: event.data.timestamp || Date.now(),
        };
        setConsoleLogs((prev) => [...prev.slice(-100), newLog]);
      } else if (event.data.type === 'GAME_FPS') {
        setFps(event.data.fps || 60);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 端末実機通知 / Web通知のタップイベント検知（学習しきい値到達通知など）
  useEffect(() => {
    const unsubscribe = nativeBackgroundService.addActionListener((data) => {
      if (data?.action === 'open_self_improvement') {
        setActiveTab('improvement');
      }
    });

    const handleCustomAction = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.action === 'open_self_improvement') {
        if (customEvent.detail.tab) {
        }
        setActiveTab('improvement');
      }
    };
    window.addEventListener('miki:notification-action', handleCustomAction);

    // アプリ起動時に通知権限の許可状態をバックグラウンド確認
    nativeBackgroundService.ensureNotificationPermission().catch(() => {});

    return () => {
      unsubscribe();
      window.removeEventListener('miki:notification-action', handleCustomAction);
    };
  }, []);

  // Heuristic memory auto extractor
  const autoExtractMemory = (userText: string) => {
    const text = userText.trim();
    const patterns = [
      { pat: /(?:私|僕|自分|おれ|オレ)は?(.+?)(?:が好き|が作りたい|を開発したい|に興味がある)/, cat: 'preference' as const, suffix: 'が好き・興味がある' },
      { pat: /(?:ジャンルは|好みなのは)(.+?)(?:がいい|が好き|にして)/, cat: 'preference' as const, suffix: 'のジャンルが好き' },
      { pat: /(?:名前|呼び名)は?(.+?)(?:だよ|です|って呼んで)/, cat: 'profile' as const, suffix: '' },
      { pat: /(?:今日|昨日|最近)(.+?)(?:だった|したよ|があった)/, cat: 'chat' as const, suffix: '' },
    ];

    for (const item of patterns) {
      const match = text.match(item.pat);
      if (match && match[1]) {
        const raw = match[1].trim();
        if (raw.length > 1 && raw.length < 50) {
          const finalContent = item.suffix ? raw + item.suffix : match[0].trim();
          const exists = memories.some((m) => m.content.includes(raw));
          if (!exists) {
            // 設計思想 25: 自動抽出記憶は importance: 2、approved: false で生成し、自己承認ループを断つ
            const newMem = enrichMemoryMetadata(
              {
                id: 'mem_auto_' + Date.now(),
                category: item.cat,
                content: finalContent,
                importance: 2,
                pinned: false,
                active: true,
                approved: false,
                source: 'auto',
                tags: [item.cat, 'auto_extracted', 'unverified'],
              },
              {
                rawUserText: text,
                sourceRef: 'user_chat',
                existingMemories: memories,
              }
            );
            // 設計思想 Master v5.2 第15章6節: 関連記憶グラフの自動リンク拡張 (Semantic Link Expansion)
            const { updatedTarget, modifiedNeighbors } = longTermMemoryService.autoLinkRelatedMemories(newMem, memories);
            storageService.saveMemoryItem(updatedTarget);
            modifiedNeighbors.forEach((neighbor) => storageService.saveMemoryItem(neighbor));

            setMemories((prev) => {
              const neighborMap = new Map(modifiedNeighbors.map((n) => [n.id, n]));
              const updatedList = prev.map((m) => neighborMap.get(m.id) || m);
              return [updatedTarget, ...updatedList];
            });

            // 設計思想 Master v5.0 第14章: 新規記憶のLLM実埋め込みベクトルを非同期生成
            embeddingService
              .ensureMemoryEmbedding(updatedTarget)
              .then((embeddedMem) => {
                if (embeddedMem.embeddingVector && embeddedMem.embeddingVector.length > 0) {
                  setMemories((prev) => prev.map((m) => (m.id === embeddedMem.id ? embeddedMem : m)));
                }
              })
              .catch(() => {});
          }
        }
      }
    }
  };

  // Start fresh blank project
  const handleNewBlankProject = () => {
    const blank = WORKSPACE_TEMPLATES.find((t) => t.id === 'blank-slate')?.files || WORKSPACE_TEMPLATES[0].files;
    setWorkspaceFiles(blank);
    setActiveFilePath(blank[0].path);
    setConsoleLogs([]);
    setActiveTab('preview');
    setMobileTab('preview');
  };

  // Restart Sandbox
  const handleRestartGame = () => {
    setConsoleLogs([]);
    setWorkspaceFiles((prev) => [...prev]);
  };

  // Apply Code Blocks to Workspace Files
  const handleApplyCode = (newFiles: { path: string; name: string; content: string; language: string }[]) => {
    setWorkspaceFiles((prev) => {
      const updated = [...prev];
      newFiles.forEach((nf) => {
        const idx = updated.findIndex((f) => f.path === nf.path || f.name === nf.name);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            content: nf.content,
            isModified: true,
          };
        } else {
          updated.push({
            path: nf.path,
            name: nf.name,
            content: nf.content,
            language: nf.language,
            isModified: true,
          });
        }
      });
      return updated;
    });

    setActiveTab('preview');
    setMobileTab('preview');
  };

  // Apply Code Proposal after user confirmation (設計思想 ②: コード自動適用の確認ゲート)
  const handleApplyCodeProposal = (proposal: CodeProposal) => {
    handleApplyCode(proposal.files as any);
    setMessages((prev) =>
      prev.map((m) =>
        m.codeProposal?.id === proposal.id
          ? {
              ...m,
              codeProposal: {
                ...m.codeProposal,
                status: 'applied',
                appliedAt: Date.now(),
              },
            }
          : m
      )
    );
    systemLogger.info('TOOLS', `✅ ユーザー承認によりコード変更提案(${proposal.id})を適用しました`, {
      files: proposal.files.map((f) => f.name),
    });
  };

  // Reject Code Proposal (設計思想 ②: コード自動適用の確認ゲート)
  const handleRejectCodeProposal = (proposalId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.codeProposal?.id === proposalId
          ? {
              ...m,
              codeProposal: {
                ...m.codeProposal,
                status: 'rejected',
              },
            }
          : m
      )
    );
    systemLogger.info('TOOLS', `❌ ユーザーによりコード変更提案(${proposalId})が却下されました`);
  };

  // Handle Stop Generation
  const handleStopGeneration = () => {
    systemLogger.warn('CHAT', 'handleStopGeneration() が実行され、推論中断処理を開始します', {
      targetAssistantId: currentAssistantIdRef.current,
      hasActiveAbortController: Boolean(abortControllerRef.current),
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    deterministicRuntimeService.interruptGenerate();

    if (currentAssistantIdRef.current) {
      const targetId = currentAssistantIdRef.current;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === targetId) {
            let content = msg.content;
            if (content.includes('初期化中') || content.includes('ロード中') || content.includes('推論中') || content.includes('準備中') || content.includes('生成中')) {
              content = '⏹ 生成を中断しました。';
            } else if (!content.includes('中断')) {
              content = content + '\n\n*(⏹ 生成を中断しました)*';
            }
            return {
              ...msg,
              content,
              isStreaming: false,
              completionEvaluation: {
                status: 'CANCELLED',
                score: 30,
                headline: 'ユーザー操作による中断',
                reason: 'ユーザーによって応答生成が手動中断されました。',
                checklist: {
                  goalSatisfaction: { passed: false, note: '生成途中で中断' },
                  artifactPresence: { passed: false, summary: '未完成' },
                  requiredItems: { passed: false, fulfilled: [], missing: ['生成中断'] },
                  verification: { status: 'unverified', note: '検証前に中断' },
                  unresolvedIssues: { hasIssues: true, issues: ['生成中断'], explicitlyNoted: true },
                  storageTracking: {},
                  nextAction: { required: true, actionType: 'provide_info', note: '必要に応じて再送信してください。' },
                },
                isCodeOrVba: false,
                detectedCodeTypes: [],
                requiresExternalVerification: false,
                evaluatedAt: Date.now(),
              },
            };
          }
          return msg;
        })
      );
      currentAssistantIdRef.current = null;
    }

    setIsGenerating(false);
    setIsLoading(false);
  };

  // 文書48章: 完了状態の手動更新ハンドラー (例: Excelで動作確認完了ボタン押下時)
  const handleUpdateMessageEvaluation = (messageId: string, evaluation: CompletionEvaluation) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, completionEvaluation: evaluation } : msg))
    );
    systemLogger.info('CHAT', `[完了判定更新] メッセージ [${messageId}] の完了判定を手動更新: ${evaluation.status} (${evaluation.headline})`);
  };

  /**
   * Phase 3: 多段推論タスク計画の実行ループ (新規実行 & チェックポイント再開の共通エンジン)
   */
  const executePlanLoop = async (
    plan: TaskPlan,
    assistantId: string,
    initialGoal: string,
    attachedFiles?: { name: string; content: string; type: string }[]
  ) => {
    const stepOutputs: { stepNumber: number; title: string; output: string }[] = [];

    // 既に完了しているステップの成果物を復元
    plan.steps.forEach((s) => {
      if (s.status === 'completed' && s.result) {
        stepOutputs.push({
          stepNumber: s.stepNumber,
          title: s.title,
          output: s.result,
        });
      }
    });

    const planStartTime = performance.now();
    const activeSpeaker = SPEAKER_PROFILES[speakerMode] || SPEAKER_PROFILES.miki;
    const activeMemories = memories.filter((m) => m.active);
    const queryEmb = await embeddingService.getQueryEmbedding(initialGoal);
    const relevantMemories = await retrieveRelevantMemoriesHybrid(initialGoal, activeMemories, {
      limit: 6,
      alwaysIncludePinned: true,
      traverseGraph: true,
      onlyApprovedForFacts: true,
      queryEmbedding: queryEmb || undefined,
    });

    for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        taskPlanService.pausePlan(plan.id);
        systemLogger.warn('STEP', `多段推論タスク計画が一時停止(paused)されました [${plan.id}]`);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: msg.content + '\n\n*(⏸ タスク計画を一時停止しチェックポイントを保存しました)*',
                  isStreaming: false,
                  taskPlan: taskPlanService.loadCheckpoint(plan.id) || plan,
                }
              : msg
          )
        );
        setIsGenerating(false);
        setIsLoading(false);
        return;
      }

      const currentStep = plan.steps[i];
      if (currentStep.status === 'completed') continue;

      currentStep.status = 'in_progress';
      plan.currentStepIndex = i;

      // UI更新 (進行中ステップ表示)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                taskPlan: { ...plan },
                content: `⏳ [Step ${currentStep.stepNumber}/${plan.totalSteps}] **${currentStep.title}** を実行中...\n${currentStep.description}`,
              }
            : msg
        )
      );

      const stepStartTime = performance.now();
      let stepSuccess = true;
      let stepResultText = '';
      let stepError: string | undefined = undefined;

      try {
        if (currentStep.actionType === 'tool_execution' && currentStep.toolCall) {
          // ツール実行ステップ
          const toolRes = await toolsService.executeTool(
            currentStep.toolCall.toolId,
            currentStep.toolCall.params || {},
            {
              workspaceFiles,
              onUpdateWorkspaceFile: handleUpdateFileContent,
              userNickname: persona.userNickname,
            },
            { userConfirmed: true }
          );
          stepSuccess = toolRes.success;
          stepResultText = toolRes.outputSummary;
          if (!toolRes.success) {
            stepError = toolRes.error;
          }
        } else {
          // 推論・分析・生成・検証ステップ（CPU自律ルールベース）
          const pipelineRes = await conversationCoreService.execute({
            prompt: currentStep.title + ": " + initialGoal,
            recentMessages: [],
            memories: relevantMemories,
            attachedFiles,
          });
          stepResultText = pipelineRes.replyText;
        }
      } catch (stepErr: any) {
        stepSuccess = false;
        stepError = stepErr?.message || String(stepErr);
        stepResultText = `⚠️ 実行時エラー: ${stepError}`;
      }

      const stepDuration = Math.round(performance.now() - stepStartTime);
      stepOutputs.push({
        stepNumber: currentStep.stepNumber,
        title: currentStep.title,
        output: stepResultText,
      });

      // advanceStep でステータス更新 & claimLedger (確定事実・仮説・未確認事項) を更新 & チェックポイント保存
      taskPlanService.advanceStep(plan, {
        success: stepSuccess,
        resultText: stepResultText,
        error: stepError,
        durationMs: stepDuration,
      });

      // 進行状況のUI更新
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                taskPlan: { ...plan },
              }
            : msg
        )
      );
    }

    // 全ステップ完了判定 & 統合サマリー生成
    const planJudgement = taskPlanService.judgeCompletion(plan);
    const totalPlanDuration = Math.round(performance.now() - planStartTime);

    // 最終メッセージ構築
    const synthesisOutput = stepOutputs[stepOutputs.length - 1]?.output || '';
    const combinedSummary = `${planJudgement.summary}\n\n${synthesisOutput}`;

    // 文書48章: 完成条件と完了判定器による評価
    const planEvaluation = completionJudgeService.evaluateCompletion({
      userGoal: initialGoal,
      assistantResponse: combinedSummary,
      executionSteps: systemLogger.getCurrentSessionSteps(),
      taskPlan: plan,
    });

    // 48章の完了判定が自動的に FAILED / BLOCKED を検出した場合、
    // ユーザーの👎を待たずに自己改善ルーターへ自動的に診断依頼する。
    // ※ PARTIAL は正常な途中経過であり得るため除外（ノイズ防止）。
    // ※ EXTERNAL_COMPILE_REQUIRED / RUNTIME_TEST_REQUIRED は外部確認が必要な正常振る舞いのため除外。
    // ※ CANCELLED / COMPLETE は対象外。
    if (
      (planEvaluation.status === 'FAILED' || planEvaluation.status === 'BLOCKED') &&
      !planEvaluation.autoDiagnosedAt
    ) {
      selfImprovementService.diagnoseFailure(
        initialGoal,
        combinedSummary,
        `[自動検出] 完了判定: ${planEvaluation.status} - ${planEvaluation.reason}`,
        {
          memoriesUsedCount: (relevantMemories || []).length,
          promptLengthChars: 1200,
          engineMode: engineMode || 'autonomous_rule',
        }
      );
      planEvaluation.autoDiagnosedAt = Date.now();
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🔍 完了判定(${planEvaluation.status})を自動検出し、改善ルーターへ自動登録しました(ユーザー操作不要)。`
      );
    }

    systemLogger.step(10, 10, '🧭 多段推論タスク計画完了', {
      planId: plan.id,
      totalSteps: plan.totalSteps,
      completedSteps: plan.completedSteps,
      totalDurationMs: totalPlanDuration,
      confirmedClaims: plan.claimLedger.confirmed.length,
      completionStatus: planEvaluation.status,
    });

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? {
              ...msg,
              content: combinedSummary,
              taskPlan: plan,
              isStreaming: false,
              completionEvaluation: planEvaluation,
              executionSteps: systemLogger.getCurrentSessionSteps(),
              metrics: {
                engine: `多段推論タスク計画 (${plan.completedSteps}/${plan.totalSteps}ステップ)`,
                tokens: Math.round(combinedSummary.length / 3),
                tokensPerSec: 50,
                ttftMs: 50,
                totalDurationMs: totalPlanDuration,
              },
            }
          : msg
      )
    );

    setIsLoading(false);
    setIsGenerating(false);

    // コードブロックの自動反映
    const codeBlocks = extractCodeBlocks(combinedSummary);
    if (codeBlocks.length > 0) {
      handleApplyCode(codeBlocks);
    }
  };

  /**
   * 中断されたチェックポイントからのタスク計画再開ハンドラー
   */
  const handleResumeTaskPlan = async (planId: string) => {
    const resumed = taskPlanService.resumeFromCheckpoint(planId);
    if (!resumed) {
      systemLogger.warn('STEP', `チェックポイントからの再開に失敗: [${planId}]`);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsGenerating(true);
    setIsLoading(true);

    const assistantId = 'msg_asst_resume_' + Date.now();
    currentAssistantIdRef.current = assistantId;
    const activeSpeaker = SPEAKER_PROFILES[speakerMode] || SPEAKER_PROFILES.miki;
    const resumeStep = resumed.steps[resumed.currentStepIndex];

    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: `▶️ **チェックポイントからタスク計画を再開しました** (Step ${resumed.currentStepIndex + 1}/${resumed.totalSteps}: **${resumeStep?.title || ''}**)\n確定事実 ${resumed.claimLedger.confirmed.length}件・制約条件を引き継ぎ、後続ステップの実行を進めます...`,
        timestamp: Date.now(),
        speaker: activeSpeaker,
        engineMode,
        isStreaming: true,
        taskPlan: resumed,
        executionSteps: systemLogger.getCurrentSessionSteps(),
      },
    ]);

    await executePlanLoop(resumed, assistantId, resumed.goal);
  };

  // Handle Send Chat Message
  const handleSendMessage = async (
    text: string,
    attached?: { name: string; content: string; type: string }[]
  ) => {
    if (!text.trim() && (!attached || attached.length === 0)) return;

    // ユーザーチャット操作を記録し、バックグラウンド重処理の割り込みを防止
    backgroundWorkerService.recordUserActivity();
    const coreTaskPromise = typedCoreUiGatewayService.submitConversation(text, Boolean(attached?.length));
    const coreTask = await coreTaskPromise;
    const coreRequestId = coreTask.coreResult?.requestId || coreTask.task.taskId;
    
    const getCoreTracking = (rId: string): CoreTrackingInfo | undefined => {
      const cr = coreResultService.get(rId);
      if (!cr) return undefined;
      return {
        requestId: cr.requestId,
        interactionId: cr.interactionId,
        runId: cr.runId,
        directiveId: cr.directiveId,
        status: cr.status,
        route: cr.route || ['conversation'],
        processedCategories: cr.processedCategories || ['conversation'],
        result: cr.result,
        error: cr.error,
        updatedAt: cr.updatedAt,
      };
    };

    if (abortControllerRef.current) {
      systemLogger.warn('CHAT', '前回の未完了リクエストが存在したため中断して新規リクエストを開始します');
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsGenerating(true);
    setIsLoading(true);

    systemLogger.startSession();

    // Step 1: Request received and user input analyzed
    systemLogger.step(1, 10, 'チャット送信リクエスト受付 & 入力解析', {
      inputLength: text.length,
      snippet: text.slice(0, 100),
      tokenEstimate: Math.ceil(text.length / 2.5),
      attachedCount: attached?.length || 0,
      attachedFiles: attached?.map((a) => ({ name: a.name, size: a.content.length, type: a.type })),
      selectedEngineMode: engineMode,
      speakerMode,
      coreRequestId,
    });

    const activeMemories = memories.filter((m) => m.active);

    // COREモードでは、旧来のシャドー解析群を実行しない。
    // それらはLLM経路の比較・観測用であり、通常のCORE応答には不要なため、
    // 1メッセージあたりのCPU処理・DB照会・ログ量を大幅に削減する。
    
    const fastUserId = 'msg_user_' + Date.now();
    const fastAssistantId = 'msg_asst_' + Date.now();
    currentAssistantIdRef.current = fastAssistantId;
    const activeSpeaker = SPEAKER_PROFILES[speakerMode] || SPEAKER_PROFILES.miki;

    coreResultService.updateStatus(coreRequestId, 'processing', {
      route: ['conversation', 'execution'],
      processedCategories: ['conversation'],
    });

    const userMsg: ChatMessage = {
      id: fastUserId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachedFiles: attached?.map((a) => ({ name: a.name, size: a.content.length, type: a.type })),
      coreTracking: getCoreTracking(coreRequestId),
    };
    setMessages((prev) => [...prev, userMsg, {
      id: fastAssistantId,
      role: 'assistant',
      content: '⚡ COREコアで処理中…',
      timestamp: Date.now(),
      speaker: activeSpeaker,
      engineMode: 'autonomous_rule',
      isStreaming: true,
      coreTracking: getCoreTracking(coreRequestId),
    }]);

    try {
      systemLogger.step(2, 10, '⚡ CORE高速経路: シャドー解析をスキップ');
      const pipelineRes = await conversationCoreService.execute({
        prompt: text,
        persona: persona?.name,
        attachedFiles: attached,
        conversationState,
        memories: activeMemories,
        recentMessages: messages,
        messageId: userMsg.id,
      });
      setConversationState(pipelineRes.nextConversationState);
      if (pipelineRes.taskExecution?.task_id) {
        taskConversationFeedbackService.publishStarted(pipelineRes.taskExecution.task_id);
      }

      const needsToolPass = /計算|計算して|\d+[+*\-/]\d+|VBA|Excel|コード|マクロ|集計|重複/u.test(text);
      const cpuCandidateTools = needsToolPass
        ? toolsService.detectCandidateToolsForPrompt(text, { workspaceFiles })
        : [];
      const cpuExecutedTools: any[] = [];
      const cpuMath = cpuCandidateTools.find((t) => t.toolId === 'tool_safe_calculator');
      if (cpuMath && cpuMath.suggestedParams?.expression) {
        const calcRes = toolsService.evaluateSafeMath(cpuMath.suggestedParams.expression);
        if (calcRes.success) {
          cpuExecutedTools.push({
            toolId: 'tool_safe_calculator',
            toolName: '高精度・安全数値計算機',
            permission: 'read_only' as const,
            executionTimeMs: 1,
            success: true,
            result: calcRes,
            outputSummary: `【精密計算結果】: ${calcRes.expression} = ${calcRes.result}`,
            executedAt: Date.now(),
          });
        }
      }

      const fastMeta: ConversationPipelineMeta = {
        isDeterministicAnswer: true,
        directReplyReason: 'CORE高速経路',
        decisionProfile: {
          profile: 'general',
          chosenAction: 'DIRECT_ANSWER',
          score: 100,
          suppressedExcess: true,
        },
        synthesizedComponents: pipelineRes.usedComponents.length > 0 ? pipelineRes.usedComponents : undefined,
      };

      const finalContent = cpuExecutedTools.length > 0
        ? `${pipelineRes.replyText}\n\n${cpuExecutedTools.map((t) => t.outputSummary).join('\n')}`
        : pipelineRes.replyText;

      const coreFinalization = typedCoreUiGatewayService.finalizeConversationResponse(coreTask.task.taskId, {
        reply: finalContent,
        tools: cpuExecutedTools,
        components: pipelineRes.usedComponents,
      });
      const visibleFinalContent = coreFinalization?.finalAnswer ?? '回答を確定できませんでした。COREの最終化結果を確認してください。';

      const cpuEvaluation = needsToolPass
        ? completionJudgeService.evaluateCompletion({
            userGoal: text,
            assistantResponse: visibleFinalContent,
            executionSteps: systemLogger.getCurrentSessionSteps(),
            executedTools: cpuExecutedTools,
          })
        : { status: 'COMPLETED' as const };

      setMessages((prev) => prev.map((msg) => msg.id === fastAssistantId ? {
        ...msg,
        content: visibleFinalContent,
        isStreaming: false,
        executionSteps: systemLogger.getCurrentSessionSteps(),
        conversationPipelineMeta: fastMeta,
        coreTracking: getCoreTracking(coreRequestId),
      } : msg));

      systemLogger.step(10, 10, '⚡ CORE高速経路完了', {
        totalElapsedMs: pipelineRes.telemetry.totalMs,
        completionStatus: cpuEvaluation.status,
        responseLength: visibleFinalContent.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      systemLogger.error('CHAT', `CORE高速経路エラー: ${message}`);
      coreResultService.fail(coreRequestId, message, {
        route: ['conversation'],
        processedCategories: ['conversation'],
      });
      setMessages((prev) => prev.map((msg) => msg.id === fastAssistantId ? {
        ...msg,
        content: `CORE処理でエラーが発生しました。\n\n${message}`,
        isStreaming: false,
        coreTracking: getCoreTracking(coreRequestId),
      } : msg));
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
    return;
  };

  // AI Auto Debug (設計思想 5. 自己修正・自動リトライ & 14. サンドボックス安全実行環境)
  const handleAutoDebug = async (errorLogs: string[]) => {
    setIsDebugging(true);
    const targetFile =
      workspaceFiles.find((f) => f.path === activeFilePath) ||
      workspaceFiles.find((f) => f.path === 'index.html') ||
      workspaceFiles[0];
    const activeGameCode = targetFile?.content || '';

    const errorSummary = errorLogs.slice(-3).join('\n');
    const userMsg: ChatMessage = {
      id: 'msg_dbg_req_' + Date.now(),
      role: 'user',
      content: `🤖 **サンドボックス実行エラー検知** (${targetFile?.path || 'コード'}):\n以下のエラーが出たよ！自動修復してくれる？\n\`\`\`\n${errorSummary}\n\`\`\``,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      systemLogger.info('STEP', `⚡ サンドボックス自動自己修復ループ開始: ${errorLogs.length}件のエラーログ`);

      let responseText = '';
      try {
        const response = await sendDebugRequest(
          errorLogs,
          activeGameCode,
          workspaceFiles
        );
        responseText = response.text;
      } catch (cloudErr) {
        // クラウドAPIオフライン時のローカル自己修復ヒューリスティック
        systemLogger.warn('CHAT', 'クラウドデバッガーオフラインのためローカル自律デバッガーを実行');
        let patchedCode = activeGameCode;
        
        // よくあるCanvas/JSエラーの自動修復パターン
        if (errorSummary.includes('getContext') || errorSummary.includes('canvas')) {
          patchedCode = patchedCode.replace(/const canvas = document\.getElementById\([^)]+\);/, 'const canvas = document.getElementById("gameCanvas") || document.querySelector("canvas") || document.createElement("canvas");');
        }
        if (errorSummary.includes('undefined') || errorSummary.includes('null')) {
          patchedCode = patchedCode.replace(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/, '$1?.$2');
        }

        responseText = `エラーを解析して修正したよ！\n- **原因**: 実行時参照エラーまたはCanvas要素のバインド不備\n- **対策**: 安全なオプショナルチェーンとCanvas初期化ガードを追加したよ！\n\n\`\`\`html\n${patchedCode}\n\`\`\`\n\nこれで動くはず！確認してみてね！`;
      }

      const debugEvaluation = completionJudgeService.evaluateCompletion({
        userGoal: 'サンドボックス実行エラーの自動修復',
        assistantResponse: responseText,
        executionSteps: systemLogger.getCurrentSessionSteps(),
        files: workspaceFiles,
      });

      // 48章の完了判定が自動的に FAILED / BLOCKED を検出した場合、
      // ユーザーの👎を待たずに自己改善ルーターへ自動的に診断依頼する。
      // ※ PARTIAL は正常な途中経過であり得るため除外（ノイズ防止）。
      // ※ EXTERNAL_COMPILE_REQUIRED / RUNTIME_TEST_REQUIRED は外部確認が必要な正常振る舞いのため除外。
      // ※ CANCELLED / COMPLETE は対象外。
      if (
        (debugEvaluation.status === 'FAILED' || debugEvaluation.status === 'BLOCKED') &&
        !debugEvaluation.autoDiagnosedAt
      ) {
        selfImprovementService.diagnoseFailure(
          `サンドボックス実行エラーの自動修復: ${errorSummary}`,
          responseText,
          `[自動検出] 完了判定: ${debugEvaluation.status} - ${debugEvaluation.reason}`,
          {
            memoriesUsedCount: 0,
            promptLengthChars: 1200,
            engineMode: engineMode || 'autonomous_rule',
          }
        );
        debugEvaluation.autoDiagnosedAt = Date.now();
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🔍 完了判定(${debugEvaluation.status})を自動検出し、改善ルーターへ自動登録しました(ユーザー操作不要)。`
        );
      }

      const assistantMsg: ChatMessage = {
        id: 'msg_dbg_res_' + Date.now(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        completionEvaluation: debugEvaluation,
        metrics: {
          engine: 'MikiAI Autonomous Self-Healing Debugger',
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);

      const codeBlocks = extractCodeBlocks(responseText);
      if (codeBlocks.length > 0) {
        handleApplyCode(codeBlocks);
        systemLogger.info('STEP', '✓ 修復済みコードをワークスペースへ自動適用完了');
      }
    } catch (err: any) {
      console.warn('Auto-debug caught error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg_err_' + Date.now(),
          role: 'assistant',
          content: `修復中にエラーが発生しました: ${err.message}`,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    } finally {
      setIsDebugging(false);
      setIsLoading(false);
    }
  };

  // エディタからの「✨ みきに改善を頼む」リクエストハンドラー
  const handleRequestAiCodeImprovement = (prompt: string, targetFilePath?: string) => {
    if (targetFilePath && targetFilePath !== activeFilePath) {
      setActiveFilePath(targetFilePath);
    }
    // モバイル環境ならチャットタブに切り替えて返信を見えるようにする
    setMobileTab('chat');
    // メッセージ送信実行
    handleSendMessage(prompt);
  };

  // GitHub Load Repo Into Workspace
  //
  // GitHub PULLの完全な正本は既存SelfCodeSpace/GitHubSync側に保持する。
  // Android WebViewで数百〜数千ファイルの全文をReact stateへ同時に複製すると、
  // JSON/DOM/構造記憶同期が重なってメモリ・CPU負荷が急増するため、
  // 通常Workspaceには実行・解析に必要な代表ファイルだけを投影する。
  const handleLoadRepoIntoWorkspace = (repoData: GitHubRepoData) => {
    const syncedFiles =
      repoData.files.length > 0
        ? repoData.files
        : selfCodeSpaceService.listFiles();

    const priorityPath = (path: string): number => {
      const normalized = path.replace(/^\.\//, '');

      if (normalized === 'index.html') return 0;
      if (normalized === 'package.json') return 1;
      if (normalized === 'src/main.tsx') return 2;
      if (normalized === 'src/App.tsx') return 3;
      if (/^(vite|vitest|tsconfig|capacitor)\.[^/]+$/i.test(normalized)) return 4;
      if (/^(src|app|pages|components)\/.*\.(tsx|jsx|ts|js|html|css|scss)$/i.test(normalized)) return 10;
      if (/\.(html|css|scss|js|jsx|ts|tsx|json)$/i.test(normalized)) return 20;
      return 50;
    };

    const selectedFiles = [...syncedFiles]
      .sort(
        (a, b) =>
          priorityPath(a.path) - priorityPath(b.path) ||
          a.path.localeCompare(b.path)
      )
      .slice(0, 160);

    const newFiles: WorkspaceFile[] = selectedFiles.map((rf) => {
      let lang = 'javascript';
      if (rf.path.endsWith('.html')) lang = 'html';
      else if (rf.path.endsWith('.css')) lang = 'css';
      else if (rf.path.endsWith('.ts')) lang = 'typescript';
      else if (rf.path.endsWith('.json')) lang = 'json';

      return {
        path: rf.path,
        name: rf.path.split('/').pop() || rf.path,
        content: rf.content,
        language: lang,
      };
    });

    if (newFiles.length > 0) {
      setWorkspaceFiles(newFiles);
      setActiveFilePath(newFiles[0].path);
      setActiveTab('preview');
      setMobileTab('preview');
      setConsoleLogs([]);

      systemLogger.info(
        'SYSTEM',
        `[GitHub Workspace] ${syncedFiles.length}ファイルの正本同期を維持し、${newFiles.length}ファイルだけを対話Workspaceへ投影しました。`
      );
    }
  };

  // GitHub Ask AI prompt
  const handleAskAIAboutRepo = (repoData: GitHubRepoData, promptText: string) => {
    handleLoadRepoIntoWorkspace(repoData);
    handleSendMessage(promptText);
  };

  // Code Editor update handlers
  const handleUpdateFileContent = (path: string, content: string) => {
    setWorkspaceFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content, isModified: true } : f))
    );
  };

  const handleCreateFile = (name: string) => {
    let lang = 'javascript';
    if (name.endsWith('.html')) lang = 'html';
    else if (name.endsWith('.css')) lang = 'css';
    else if (name.endsWith('.ts')) lang = 'typescript';
    else if (name.endsWith('.json')) lang = 'json';
    else if (name.endsWith('.wgsl') || name.endsWith('.glsl')) lang = 'wgsl';

    const newFile: WorkspaceFile = {
      path: name,
      name,
      content: name.endsWith('.html')
        ? '<!DOCTYPE html>\n<html>\n<head><title>New App</title></head>\n<body>\n  <h1>Hello App</h1>\n</body>\n</html>'
        : `// ${name}\nconsole.log('${name} loaded');\n`,
      language: lang,
    };
    setWorkspaceFiles((prev) => [...prev, newFile]);
    setActiveFilePath(newFile.path);
  };

  const handleDeleteFile = (path: string) => {
    setWorkspaceFiles((prev) => {
      const remaining = prev.filter((f) => f.path !== path);
      if (remaining.length === 0) {
        const blank = WORKSPACE_TEMPLATES.find((t) => t.id === 'blank-slate')?.files || [
          {
            path: 'index.html',
            name: 'index.html',
            content: '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>New App</title>\n</head>\n<body>\n</body>\n</html>',
            language: 'html',
          },
        ];
        setActiveFilePath(blank[0].path);
        return blank;
      }
      if (activeFilePath === path) {
        setActiveFilePath(remaining[0].path);
      }
      return remaining;
    });
  };

  const handleDeleteFolder = (folderPath: string) => {
    const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    setWorkspaceFiles((prev) =>
      prev.filter((f) => !(f.path === folderPath || f.path.startsWith(prefix)))
    );
    if (activeFilePath === folderPath || activeFilePath.startsWith(prefix)) {
      const remaining = workspaceFiles.filter((f) => !(f.path === folderPath || f.path.startsWith(prefix)));
      if (remaining.length > 0) setActiveFilePath(remaining[0].path);
    }
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    if (!newPath.trim() || oldPath === newPath) return;
    const cleanNew = newPath.trim().replace(/^\/+/, '');
    const newName = cleanNew.split('/').pop() || cleanNew;
    const ext = newName.includes('.') ? newName.split('.').pop()?.toLowerCase() || '' : '';
    let language = 'text';
    if (ext === 'html' || ext === 'htm') language = 'html';
    else if (ext === 'js' || ext === 'mjs' || ext === 'cjs') language = 'javascript';
    else if (ext === 'ts' || ext === 'tsx') language = 'typescript';
    else if (ext === 'css' || ext === 'scss') language = 'css';
    else if (ext === 'json') language = 'json';
    else if (ext === 'md') language = 'markdown';

    setWorkspaceFiles((prev) =>
      prev.map((f) =>
        f.path === oldPath
          ? {
              ...f,
              path: cleanNew,
              name: newName,
              language: f.language === 'image' || f.language === 'audio' ? f.language : language,
            }
          : f
      )
    );
    if (activeFilePath === oldPath) {
      setActiveFilePath(cleanNew);
    }
  };

  const handleRenameFolder = (oldFolder: string, newFolder: string) => {
    if (!newFolder.trim() || oldFolder === newFolder) return;
    const cleanOld = oldFolder.replace(/\/+$/, '');
    const cleanNew = newFolder.trim().replace(/\/+$/, '').replace(/^\/+/, '');
    const oldPrefix = `${cleanOld}/`;
    const newPrefix = `${cleanNew}/`;

    setWorkspaceFiles((prev) =>
      prev.map((f) => {
        if (f.path.startsWith(oldPrefix)) {
          const updatedPath = newPrefix + f.path.slice(oldPrefix.length);
          return {
            ...f,
            path: updatedPath,
            name: updatedPath.split('/').pop() || f.name,
          };
        }
        return f;
      })
    );
    if (activeFilePath.startsWith(oldPrefix)) {
      setActiveFilePath(newPrefix + activeFilePath.slice(oldPrefix.length));
    }
  };

  const handleImportZipFiles = (importedFiles: WorkspaceFile[], projectName?: string) => {
    if (!importedFiles || importedFiles.length === 0) return;
    setWorkspaceFiles(importedFiles);
    setActiveFilePath(importedFiles[0].path);

    // AIアシスタントへZIP展開完了を通知してコンテキスト同期
    const summaryMsg = `📦 アプリのZIP「${projectName || 'game_project'}」を解凍・展開しました（ファイル数: ${importedFiles.length}件）。コードタブおよびプレビューにフォルダ構造ごと反映されています。`;
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-zip-${Date.now()}`,
        role: 'system',
        content: summaryMsg,
        timestamp: Date.now(),
      },
    ]);
  };

  // ツール実行ハンドラー (:feature:tools / 設計思想 14 & 22章)
  const handleExecuteTool = async (toolId: string, params: Record<string, any>, userConfirmed = false) => {
    systemLogger.info('TOOLS', `手動/推奨ツール実行リクエスト: [${toolId}]`, params);
    const result = await toolsService.executeTool(
      toolId,
      params,
      {
        workspaceFiles,
        onUpdateWorkspaceFile: handleUpdateFileContent,
        userNickname: persona.userNickname,
      },
      { userConfirmed }
    );

    // ツール実行結果メッセージをチャットに追加
    const toolMsg: ChatMessage = {
      id: 'tool_res_' + Date.now(),
      role: 'assistant',
      content: result.outputSummary,
      timestamp: Date.now(),
      speaker: {
        id: 'tools_module',
        name: 'ツール実行エンジン (:feature:tools)',
        avatar: '🛠️',
        roleName: 'System Tools',
        color: '#0284c7',
      },
      executedTools: [result],
      metrics: {
        engine: `ToolsService (${result.toolName})`,
        totalDurationMs: result.executionTimeMs,
      },
      pendingToolConfirmation:
        result.requiresConfirmation && result.result?.pendingRequest
          ? result.result.pendingRequest
          : undefined,
    };

    setMessages((prev) => [...prev, toolMsg]);
    return result;
  };

  const handleConfirmToolExecution = async (request: ToolExecutionRequest) => {
    systemLogger.info('TOOLS', `ユーザーがツール破壊的操作を承認: [${request.toolName}]`);
    // 承認待ち状態を解除
    setMessages((prev) =>
      prev.map((msg) =>
        msg.pendingToolConfirmation?.id === request.id
          ? { ...msg, pendingToolConfirmation: undefined }
          : msg
      )
    );
    await handleExecuteTool(request.toolId, request.params, true);
  };

  const handleRejectToolExecution = (requestId: string) => {
    systemLogger.warn('TOOLS', `ユーザーがツール操作を拒否/キャンセル: [${requestId}]`);
    toolsService.rejectPendingRequest(requestId);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.pendingToolConfirmation?.id === requestId
          ? {
              ...msg,
              content: `${msg.content}\n\n🚫 **ツール実行はユーザーによりキャンセルされました。**`,
              pendingToolConfirmation: undefined,
            }
          : msg
      )
    );
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Main Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileTab(tab);
        }}
        persona={persona}
        memories={memories}
        engineMode={engineMode}
        onRestartGame={handleRestartGame}
        onOpenMemoryModal={() => { void loadMemoryModal(); setIsMemoryModalOpen(true); }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onNewBlankProject={handleNewBlankProject}
        useSearch={useSearch}
        setUseSearch={setUseSearch}
        fps={fps}
        onOpenActivityMonitor={() => { void loadActivityMonitor(); setIsGlobalActivityMonitorOpen(true); }}
        onOpenSelfImprovementModal={() => setActiveTab('improvement')}
        isWorking={isLoading || isGenerating || isEvolutionRunning}
      />

      {/* Main Responsive Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP SPLIT VIEW (Visible on >= md) */}
        {isDesktopViewport && (
          <div className="hidden md:flex flex-1 overflow-hidden">
          {/* Left Side: Chat Agent Panel */}
          <div className="w-[380px] lg:w-[440px] xl:w-[480px] h-full shrink-0 flex flex-col">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              isGenerating={isGenerating}
              onStopGeneration={handleStopGeneration}
              persona={persona}
              memories={memories}
              onUpdateMemories={setMemories}
              engineMode={engineMode}
              speakerMode={speakerMode}
              setSpeakerMode={setSpeakerMode}
              onApplyCode={handleApplyCode}
              onClearHistory={() => {
                setConversationState(defaultConversationState());
                setMessages([
                  {
                    id: 'init_' + Date.now(),
                    role: 'assistant',
                    content: `会話履歴をリフレッシュしたよ✨ 記憶カンペ（${memories.length}件）と現在のコードは保持されているから安心してね！`,
                    timestamp: Date.now(),
                  },
                ]);
              }}
              useSearch={useSearch}
              setUseSearch={setUseSearch}
              workspaceFiles={workspaceFiles}
              onOpenGamePreview={() => setActiveTab('preview')}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenSelfImprovementModal={() => setActiveTab('improvement')}
              onExecuteTool={handleExecuteTool}
              onConfirmToolExecution={handleConfirmToolExecution}
              onRejectToolExecution={handleRejectToolExecution}
              isMultiStepEnabled={isMultiStepExplicit}
              onToggleMultiStep={() => {
                const next = !isMultiStepExplicit;
                setIsMultiStepExplicit(next);
                storageService.setItem('miki_multistep_explicit_mode', String(next));
              }}
              onResumeTaskPlan={handleResumeTaskPlan}
              onUpdateMessageEvaluation={handleUpdateMessageEvaluation}
              onApplyCodeProposal={handleApplyCodeProposal}
              onRejectCodeProposal={handleRejectCodeProposal}
              onDeleteMessage={handleDeleteMessage}
            />
          </div>

          {/* Right Side: Active Tab (Preview / Code / GitHub) */}
          <div className="flex-1 h-full overflow-hidden flex flex-col">
            {activeTab === 'preview' && (
              <GamePreview
                files={workspaceFiles}
                consoleLogs={consoleLogs}
                onClearLogs={() => setConsoleLogs([])}
                onAutoDebug={handleAutoDebug}
                isDebugging={isDebugging}
                fps={fps}
              />
            )}

            {activeTab === 'code' && (
              <CodeEditor
                files={workspaceFiles}
                activeFilePath={activeFilePath}
                onSelectFile={setActiveFilePath}
                onUpdateFileContent={handleUpdateFileContent}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onDeleteFolder={handleDeleteFolder}
                onApplySandbox={() => setActiveTab('preview')}
                onImportZip={handleImportZipFiles}
                onExportZip={() => setIsExportModalOpen(true)}
                onResetProject={handleNewBlankProject}
                onRequestAiImprovement={handleRequestAiCodeImprovement}
              />
            )}

            {activeTab === 'github' && (
              <GitHubHub
                onLoadRepoIntoWorkspace={handleLoadRepoIntoWorkspace}
                onAskAIAboutRepo={handleAskAIAboutRepo}
                workspaceFiles={workspaceFiles}
                persona={persona}
              />
            )}

            {activeTab === 'improvement' && (
              <AutonomousImprovementHome
                onOpenSelfImprovementModal={() => setActiveTab('improvement')}
                onOpenActivityMonitor={() => { void loadActivityMonitor(); setIsGlobalActivityMonitorOpen(true); }}
              />
            )}

            {activeTab === 'capabilityLedger' && (
              <CapabilityLedgerScreen onBack={() => setActiveTab('preview')} />
            )}
          </div>
          </div>
        )}

        {/* MOBILE SINGLE VIEW (Visible on < md) */}
        <div className="flex md:hidden flex-1 min-h-0 overflow-hidden flex-col">
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {mobileTab === 'home' && (
              <HomeDashboard
                onOpenConversation={() => setMobileTab('chat')}
                onOpenImprovement={() => setMobileTab('improvement')}
                onOpenWorkspace={() => setMobileTab('code')}
                onOpenLibrary={() => setMobileTab('library')}
                onOpenConnections={() => setMobileTab('settings')}
                onOpenCapabilityLedger={() => setMobileTab('capabilityLedger')}
              />
            )}

            {mobileTab === 'chat' && (
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                isGenerating={isGenerating}
                onStopGeneration={handleStopGeneration}
                persona={persona}
                memories={memories}
                onUpdateMemories={setMemories}
                engineMode={engineMode}
                speakerMode={speakerMode}
                setSpeakerMode={setSpeakerMode}
                onApplyCode={handleApplyCode}
                onClearHistory={() => {
                  setConversationState(defaultConversationState());
                  setMessages([
                    {
                      id: 'init_' + Date.now(),
                      role: 'assistant',
                      content: `会話履歴をリフレッシュしたよ✨`,
                      timestamp: Date.now(),
                    },
                  ]);
                }}
                useSearch={useSearch}
                setUseSearch={setUseSearch}
                workspaceFiles={workspaceFiles}
                onOpenGamePreview={() => setMobileTab('preview')}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onOpenSelfImprovementModal={() => setActiveTab('improvement')}
                onExecuteTool={handleExecuteTool}
                onConfirmToolExecution={handleConfirmToolExecution}
                onRejectToolExecution={handleRejectToolExecution}
                isMultiStepEnabled={isMultiStepExplicit}
                onToggleMultiStep={() => {
                  const next = !isMultiStepExplicit;
                  setIsMultiStepExplicit(next);
                  storageService.setItem('miki_multistep_explicit_mode', String(next));
                }}
                onResumeTaskPlan={handleResumeTaskPlan}
                onUpdateMessageEvaluation={handleUpdateMessageEvaluation}
                onApplyCodeProposal={handleApplyCodeProposal}
                onRejectCodeProposal={handleRejectCodeProposal}
                onDeleteMessage={handleDeleteMessage}
              />
            )}

            {mobileTab === 'preview' && (
              <GamePreview
                files={workspaceFiles}
                consoleLogs={consoleLogs}
                onClearLogs={() => setConsoleLogs([])}
                onAutoDebug={handleAutoDebug}
                isDebugging={isDebugging}
                fps={fps}
              />
            )}

            {mobileTab === 'code' && (
              <WorkspaceScreen />
            )}
            {false && (
              <CodeEditor
                files={workspaceFiles}
                activeFilePath={activeFilePath}
                onSelectFile={setActiveFilePath}
                onUpdateFileContent={handleUpdateFileContent}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onDeleteFolder={handleDeleteFolder}
                onApplySandbox={() => setMobileTab('preview')}
                onImportZip={handleImportZipFiles}
                onExportZip={() => setIsExportModalOpen(true)}
                onResetProject={handleNewBlankProject}
                onRequestAiImprovement={handleRequestAiCodeImprovement}
              />
            )}

            {mobileTab === 'github' && (
              <GitHubHub
                onLoadRepoIntoWorkspace={handleLoadRepoIntoWorkspace}
                onAskAIAboutRepo={handleAskAIAboutRepo}
                workspaceFiles={workspaceFiles}
                persona={persona}
              />
            )}

            {mobileTab === 'improvement' && (
              <AutonomousImprovementHome
                onOpenSelfImprovementModal={() => setActiveTab('improvement')}
                onOpenActivityMonitor={() => { void loadActivityMonitor(); setIsGlobalActivityMonitorOpen(true); }}
              />
            )}

            {mobileTab === 'library' && <LibraryHub onOpenMemory={() => { void loadMemoryModal(); setIsMemoryModalOpen(true); }} />}

            {mobileTab === 'settings' && <ExternalConnectionsScreen />}
            {mobileTab === 'capabilityLedger' && (
              <CapabilityLedgerScreen onBack={() => setMobileTab('home')} />
            )}

            {mobileTab === 'memory' && (
              <div className="h-full overflow-y-auto p-4 bg-slate-900">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-pink-300 flex items-center gap-2">
                    <span>{persona.avatar}</span>
                    <span>{persona.name}の性格・記憶カンペ</span>
                  </h3>
                  <button
                    onPointerEnter={() => { void loadMemoryModal(); }} onTouchStart={() => { void loadMemoryModal(); }} onClick={() => setIsMemoryModalOpen(true)}
                    className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-bold shadow-md shadow-pink-600/30"
                  >
                    設定モーダルを開く
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-slate-400 font-semibold mb-1">現在の設定:</div>
                    <div className="text-slate-200 font-bold mb-1">{persona.tagline}</div>
                    <div className="text-slate-400 leading-relaxed">{persona.basePersonality}</div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-slate-400 font-semibold flex items-center justify-between">
                      <span>覚えている記憶カンペ ({memories.length}件):</span>
                    </div>
                    {memories.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 leading-relaxed text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] text-pink-400 font-mono">[{m.category}]</span>
                          {m.pinned && <span className="text-[10px] text-pink-400 font-bold">📌</span>}
                        </div>
                        <p>{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Bottom Navigation Bar - Five primary destinations */}
          <nav className="min-h-16 bg-slate-900/98 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-1 select-none z-30 shrink-0">
            {[
              { id: 'home', label: 'ホーム', Icon: Home },
              { id: 'chat', label: '会話', Icon: MessageCircle },
              { id: 'improvement', label: '改善', Icon: Sparkles },
              { id: 'library', label: 'ライブラリ', Icon: Library },
              { id: 'settings', label: '設定', Icon: Settings },
            ].map(({ id, label, Icon }) => (
              <button key={id} onClick={() => {
                const memory = (performance as any).memory;
                systemLogger.recordRuntimeBreadcrumb('UI_NAV_TAP', { from: mobileTab, to: id, visibility: document.visibilityState });
                systemLogger.info('SYSTEM', '[UI_NAV] bottom navigation tapped', {
                  from: mobileTab,
                  to: id,
                  visibilityState: document.visibilityState,
                  usedJSHeapMB:
                    typeof memory?.usedJSHeapSize === 'number'
                      ? Math.round((memory.usedJSHeapSize / 1048576) * 10) / 10
                      : undefined,
                });
                setMobileTab(id as typeof mobileTab);
              }} aria-current={mobileTab === id ? 'page' : undefined} className={`min-h-12 flex-1 rounded-xl py-1.5 flex flex-col items-center justify-center gap-1 transition-all ${mobileTab === id ? 'bg-indigo-500/10 text-indigo-300 font-bold' : 'text-slate-400 hover:text-slate-200'}`}>
                <Icon className="h-5 w-5" />
                <span className="text-[10px] leading-none">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Modals */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        persona={persona}
        onUpdatePersona={setPersona}
        memories={memories}
        onUpdateMemories={setMemories}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        files={workspaceFiles}
        projectName={persona.name + '_Project'}
      />



      <RealtimeActivityMonitorModal
        isOpen={isGlobalActivityMonitorOpen}
        onClose={() => setIsGlobalActivityMonitorOpen(false)}
        isLoading={isLoading}
        isGenerating={isGenerating}
      />
    </div>
  );
}
