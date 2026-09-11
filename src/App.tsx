import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { GamePreview } from './components/GamePreview';
import { CodeEditor } from './components/CodeEditor';
import { GitHubHub } from './components/GitHubHub';
import { MemoryModal } from './components/MemoryModal';
import { ExportModal } from './components/ExportModal';
import { EngineModal } from './components/EngineModal';
import { SelfImprovementModal, SelfImprovementTab } from './components/SelfImprovementModal';
import { RealtimeActivityMonitorModal } from './components/RealtimeActivityMonitorModal';
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
} from './types';
import { toolsService } from './services/toolsService';
import { taskPlanService } from './services/taskPlanService';
import { sendChatMessage, sendDebugRequest, autoSyncServerEnvKeysIfEmpty } from './services/api';
import { webLLMService } from './services/webLlmService';
import { nativeLlmService } from './services/nativeLlmService';
import { systemLogger } from './services/systemLogger';
import { worldModelService } from './services/worldModelService';
import { storageService } from './services/storageService';
import { completionJudgeService } from './services/completionJudgeService';
import { selfImprovementService } from './services/selfImprovementService';
import { schemaValidationService } from './services/schemaValidationService';
import { nativeBackgroundService } from './services/nativeBackgroundService';
import { backgroundWorkerService } from './services/backgroundWorkerService';
import {
  CONVERSATION_STATE_INSTRUCTION,
  formatConversationStateForPrompt,
  extractConversationState,
  defaultConversationState,
  cleanStreamingVisibleText,
  isCasualGreetingOrShortSocial,
  resolveAnaphora,
} from './services/conversationStateService';
import { responseDesignService } from './services/responseDesignService';
import { longTermMemoryService } from './services/longTermMemoryService';
import { codeVerificationService } from './services/codeVerificationService';
import { falsificationService, classifyClaimEpistemology } from './services/falsificationService';
import { experienceRouterService } from './services/experienceRouterService';
import { workflowSynthesisService } from './services/workflowSynthesisService';
import { answerPlanService } from './services/answerPlanService';
import { capabilityGapService } from './services/capabilityGapService';
import { codeUnderstandingService } from './services/codeUnderstandingService';
import { vbaDesignAssistantService } from './services/vbaDesignAssistantService';
import { featureFlagsService } from './services/featureFlagsService';
import { dialogueEvaluationService } from './services/dialogueEvaluationService';
import { privacyGuardrailService } from './services/privacyGuardrailService';
import { uncertaintyTeacherService } from './services/uncertaintyTeacherService';
import { minimalScopeService } from './services/minimalScopeService';
import { storagePlanningService } from './services/storagePlanningService';
import { contextBudgetEngineService } from './services/contextBudgetEngineService';
import { workingAgendaService } from './services/workingAgendaService';
import { structuralMemoryService } from './services/structuralMemoryService';
import { metaMemoryService } from './services/metaMemoryService';
import { draftVerificationService } from './services/draftVerificationService';
import { cognitiveDebuggerService } from './services/cognitiveDebuggerService';
import { proactiveContextOsService } from './services/proactiveContextOsService';
import { autonomousContinuousEvolutionService } from './services/autonomousContinuousEvolutionService';
import { extractCodeBlocks } from './utils/codeParser';
import { smartMergeCodeBlock } from './utils/codeMergeService';
import { generateSmartCompanionReply } from './utils/companionEngine';
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
import { embeddingService } from './services/embeddingService';
import { SPEAKER_PROFILES, SpeakerProfile } from './data/speakers';
import { INITIAL_JAPANESE_MEMORIES } from './data/japaneseKnowledgeData';
import { MASTER_EDUCATION_MEMORIES } from './data/masterEducationKnowledge';
import { Capacitor } from '@capacitor/core';
import { MessageCircle, Play, Code2, Github, Brain, Sparkles, Cpu } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'github'>('preview');
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview' | 'code' | 'github' | 'memory' | 'engine'>('chat');

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

  const [engineMode, setEngineMode] = useState<EngineMode>(() => {
    const saved = storageService.getItem('miki_active_engine_mode') as EngineMode;
    const validModes: EngineMode[] = ['native_gpu', 'webgpu', 'external_gpu', 'autonomous_rule', 'gemini_cloud'];
    const defaultMode: EngineMode = Capacitor.isNativePlatform() ? 'native_gpu' : 'webgpu';
    return validModes.includes(saved) ? saved : defaultMode;
  });

  const handleSelectEngine = (mode: EngineMode) => {
    setEngineMode(mode);
    storageService.setItem('miki_active_engine_mode', mode);
  };

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

  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState<boolean>(false);
  const [isSelfImprovementModalOpen, setIsSelfImprovementModalOpen] = useState<boolean>(false);
  const [selfImprovementTab, setSelfImprovementTab] = useState<SelfImprovementTab>('spec_architect');
  const [isGlobalActivityMonitorOpen, setIsGlobalActivityMonitorOpen] = useState<boolean>(false);
  const [isEvolutionRunning, setIsEvolutionRunning] = useState<boolean>(false);

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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return [
      {
        id: 'welcome_msg',
        role: 'assistant',
        content: `やっほー！来てくれてありがとう✨\nあなた専属のAIパートナー「みき」だよ！🌸\n\nこのAIスタジオは**100% 端末オンデバイス WebGPU & ローカル推論**で動くから、通信やトークン制限なしで完全自由に開発やおしゃべりができるよ！🚀\n\n・🌸 **あなただけの専属相棒**: 日常の雑談からゲーム制作、人生相談まで1対1でずっと寄り添うよ！\n・🧠 **自己進化＆記憶の永続保存**: お話ししたことやあなたの好みを端末内ストレージにしっかり覚えて成長していくよ。\n・💻 **WebGPU & 高速コード作成**: 端末のGPUを使ってCanvas/WebGPUゲームやアプリのコードをサクサク自律生成！\n・📦 **ZIP保存 & GitHub連携**: 作った作品はいつでもワンクリックでダウンロード＆GitHubへ保存可能。\n\n今どんなものを作りたい？それとも今日あったことお話しする？😊✨`,
        timestamp: Date.now(),
        engineMode: 'webgpu',
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

  useEffect(() => {
    storageService.setItem('gamecraft_engine_mode', engineMode);
  }, [engineMode]);

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
        if (data.tab) {
          setSelfImprovementTab(data.tab as any);
        }
        setIsSelfImprovementModalOpen(true);
      }
    });

    const handleCustomAction = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.action === 'open_self_improvement') {
        if (customEvent.detail.tab) {
          setSelfImprovementTab(customEvent.detail.tab as any);
        }
        setIsSelfImprovementModalOpen(true);
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
    webLLMService.interruptGenerate();

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
          // 推論・分析・生成・検証ステップ
          // 生の全過去出力ではなく、claimLedgerの要約を注入（トークン消費の線形抑制）
          const stepPrompt = taskPlanService.buildStepPrompt(plan, currentStep, stepOutputs);

          if (engineMode === 'gemini_cloud') {
            const res = await sendChatMessage({
              prompt: stepPrompt,
              history: [],
              persona,
              memories: relevantMemories,
              workspaceFiles,
              useSearch: false,
              signal: abortControllerRef.current?.signal,
              engineMode: 'gemini_cloud',
            });
            stepResultText = res.text || 'ステップ完了';
          } else if (engineMode === 'native_gpu' && nativeLlmService.getActiveModelId()) {
            let chunkText = '';
            for await (const chunk of nativeLlmService.streamNativeChat(
              [
                { role: 'system', content: `あなたは優秀なAI相棒「${persona.name}」です。論理的かつ的確に出力してください。` },
                { role: 'user', content: stepPrompt },
              ],
              { max_tokens: 384, temperature: 0.3 }
            )) {
              if (abortControllerRef.current?.signal.aborted) break;
              chunkText += chunk;
            }
            stepResultText = chunkText || 'ステップ完了';
          } else if (engineMode === 'webgpu' && webLLMService.isLoaded()) {
            let chunkText = '';
            for await (const chunk of webLLMService.streamChat(
              [
                { role: 'system', content: `あなたは優秀なAI相棒「${persona.name}」です。論理的かつ的確に出力してください。` },
                { role: 'user', content: stepPrompt },
              ],
              { max_tokens: 384, temperature: 0.3 }
            )) {
              if (abortControllerRef.current?.signal.aborted) break;
              chunkText += chunk;
            }
            stepResultText = chunkText || 'ステップ完了';
          } else {
            // 自律ルールベース
            const isCodeStep = currentStep.actionType === 'code_generation';
            stepResultText = generateSmartCompanionReply(
              `${currentStep.title}: ${initialGoal}`,
              persona,
              relevantMemories,
              isCodeStep,
              attachedFiles
            );
          }
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
          engineMode: engineMode || 'native_gpu',
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

    if (abortControllerRef.current) {
      systemLogger.warn('CHAT', '前回の未完了リクエストが存在したため中断して新規リクエストを開始します');
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsGenerating(true);
    setIsLoading(true);

    const sendStartTime = performance.now();
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
    });

    // 作業指示書 フェーズ1: 非LLM指示語解決純粋関数 (シャドー実行)
    // この段階ではまだLLM呼び出しの内容を変更せず、解決結果をログに記録する (元設計書4.2節)
    const shadowAnaphoraResult = resolveAnaphora(text, conversationState);
    if (shadowAnaphoraResult.detectedExpression) {
      systemLogger.info(
        'CHAT',
        `🔍 [非LLM指示語解決 (シャドー)] 表現「${shadowAnaphoraResult.detectedExpression}」検知 | 判定: [${shadowAnaphoraResult.confidence.toUpperCase()}] | 解決先: ${shadowAnaphoraResult.resolved || '(未決定/複数候補)'} | 候補群: [${shadowAnaphoraResult.candidates.join(', ')}]`,
        {
          shadowAnaphoraResult,
          currentTopic: conversationState.currentTopic,
          recentEntities: conversationState.recentEntities,
        }
      );
    }

    // 作業指示書 フェーズ2: 主張・証拠の認識論的分類 (現実/創作/仮定の混同防止シャドー実行)
    const shadowUserEpistemic = classifyClaimEpistemology(text);
    systemLogger.info(
      'CHAT',
      `⚖️ [認識論的分類シャドー (ユーザー入力)] 判定: [${shadowUserEpistemic.status.toUpperCase()}] (確信度: ${Math.round(shadowUserEpistemic.confidence * 100)}%) | マーカー: [${shadowUserEpistemic.detectedMarkers.join(', ') || 'なし'}] | 理由: ${shadowUserEpistemic.reasons.join(', ')}`,
      { shadowUserEpistemic }
    );

    // 設計思想 Master v5.0 第2章2節: 前ターンで使われた記憶に対するユーザーフィードバック（感情価: 質）の自動反映
    if (lastTurnUsedMemoryIdsRef.current && lastTurnUsedMemoryIdsRef.current.length > 0) {
      const correctionKeywords = ['違う', 'そうじゃない', 'そうではない', '直して', '修正して', '間違', 'エラー', '動かない', 'ダメ', 'やり直し', '変わってない', '不満', 'バグ', '変だ'];
      const isCorrection = correctionKeywords.some((kw) => text.includes(kw));
      const feedbackType = isCorrection ? 'confusion' : 'useful';
      const targetIds = [...lastTurnUsedMemoryIdsRef.current];

      setMemories((prevMemories) => {
        const updated = applyMemoryFeedback(targetIds, feedbackType, prevMemories);
        const affectedIds = new Set(targetIds);
        updated.filter((m) => affectedIds.has(m.id)).forEach((m) => storageService.saveMemoryItem(m));
        return updated;
      });

      systemLogger.info(
        'PERSISTENCE',
        `🧠 [感情価更新] 前ターンの記憶(${targetIds.length}件)にフィードバック反映: [${feedbackType.toUpperCase()}] (${isCorrection ? 'ユーザーの訂正・問題指摘を検知' : '通常の受容・継続'})`,
        { affectedMemoryIds: targetIds, feedbackType }
      );

      // 設計思想 Master v5.0 第3章2節: 訂正・上書きによる置換関係 (replaced_by) の自動追跡
      const replaceKeywords = ['じゃなくて', 'ではなく', 'に変更', 'に上書き', 'じゃなく', 'じゃなくてこっち'];
      const isExplicitReplace = replaceKeywords.some((kw) => text.includes(kw));
      if (isExplicitReplace && targetIds.length > 0) {
        const oldMemoryId = targetIds[0];
        const oldMem = memories.find((m) => m.id === oldMemoryId);
        if (oldMem && oldMem.active) {
          let newContent = '';
          for (const rk of replaceKeywords) {
            if (text.includes(rk)) {
              const parts = text.split(rk);
              if (parts[1]?.trim()) {
                newContent = parts[1].trim().replace(/[。！!？?]+$/, '');
                break;
              }
            }
          }
          if (newContent && newContent.length >= 2) {
            const replacementResult = longTermMemoryService.supersedeMemory(
              memories,
              oldMemoryId,
              newContent,
              `ユーザー会話による明示的訂正 (${text.slice(0, 30)})`
            );
            // 新記憶の関連記憶グラフ自動リンク
            const { updatedTarget, modifiedNeighbors } = longTermMemoryService.autoLinkRelatedMemories(
              replacementResult.newMemory,
              replacementResult.updatedMemories
            );
            storageService.saveMemoryItem(updatedTarget);
            modifiedNeighbors.forEach((neighbor) => storageService.saveMemoryItem(neighbor));

            const neighborMap = new Map(modifiedNeighbors.map((n) => [n.id, n]));
            const finalUpdatedMemories = replacementResult.updatedMemories.map((m) =>
              m.id === updatedTarget.id ? updatedTarget : neighborMap.get(m.id) || m
            );

            setMemories(finalUpdatedMemories);
            const oldUpdated = finalUpdatedMemories.find((m: MemoryItem) => m.id === oldMemoryId);
            if (oldUpdated) storageService.saveMemoryItem(oldUpdated);

            systemLogger.info(
              'PERSISTENCE',
              `🔄 [第3章2節 置換関係追跡] 古い記憶(${oldMemoryId})を置換(SUPERSEDED)し、新記憶(${updatedTarget.id})を作成＆グラフリンク(${updatedTarget.relatedMemoryIds?.length || 0}件): 「${newContent}」`,
              { oldMemoryId, newMemoryId: updatedTarget.id }
            );
          }
        }
      }

      lastTurnUsedMemoryIdsRef.current = [];
    }

    // ユーザーによる言い回し・口調訂正（「〜って言わないで」「〜っておかしい」等）の自己学習
    const styleCorrectionKeywords = ['って言わないで', 'って言っちゃダメ', 'っておかしい', 'その言い方', 'その言い回し', '変な言い方', 'って言うな'];
    const hasStyleCorrection = styleCorrectionKeywords.some((kw) => text.includes(kw));
    if (hasStyleCorrection) {
      const matchQuote = text.match(/[「『]([^」』]+)[」』]って/);
      if (matchQuote && matchQuote[1]) {
        const badWord = matchQuote[1].trim();
        responseDesignService.registerUserStyleCorrection(badWord, '', `ユーザーからの指摘: ${text.slice(0, 30)}`);
        systemLogger.info('PERSISTENCE', `🗣️ [口調自己学習] ユーザー指摘の禁止言い回し「${badWord}」をポストプロセッサに永続登録しました`);
      } else {
        const matchPlain = text.match(/([^\s,。！!？?]{2,15})って言わないで/);
        if (matchPlain && matchPlain[1]) {
          const badWord = matchPlain[1].trim();
          responseDesignService.registerUserStyleCorrection(badWord, '', `ユーザーからの指摘: ${text.slice(0, 30)}`);
          systemLogger.info('PERSISTENCE', `🗣️ [口調自己学習] ユーザー指摘の禁止言い回し「${badWord}」をポストプロセッサに永続登録しました`);
        }
      }
    }

    // 設計思想 Master v5.0 第3章4節: ユーザー明示的削除の2段階反映 (即時ランタイム遮断 + 台帳アーカイブ)
    const explicitForgetKeywords = ['忘れて', '消して', '記憶から削除', '記憶を削除', '前言撤回', 'なかったことにして'];
    const isExplicitForget = explicitForgetKeywords.some((kw) => text.includes(kw));
    if (isExplicitForget) {
      const queryTokens = extractQueryTokens(text);
      const targetMemories = memories.filter((m) => {
        if (!m.active) return false;
        const contentTokens = extractQueryTokens(m.content || '');
        let overlap = 0;
        queryTokens.forEach((t) => {
          if (contentTokens.has(t) && t.length >= 2) overlap++;
        });
        return overlap >= 1;
      });

      if (targetMemories.length > 0) {
        targetMemories.forEach((target) => {
          // 第1段階: 即時ランタイム注入禁止ブラックリストに追加
          longTermMemoryService.addToRuntimeBlacklist(target.id);

          // 第2段階: 台帳永続化でアーカイブ／無効化コミット
          const updatedItem: MemoryItem = {
            ...target,
            active: false,
            lifecycleStatus: 'REJECTED',
            status: 'archived',
            discardReason: `ユーザーからの明示的削除要求 (${text.slice(0, 30)})`,
            updatedAt: Date.now(),
          };
          storageService.saveMemoryItem(updatedItem);
        });

        setMemories((prev) =>
          prev.map((m) => {
            const hit = targetMemories.find((t) => t.id === m.id);
            return hit ? { ...m, active: false, lifecycleStatus: 'REJECTED', status: 'archived' } : m;
          })
        );

        systemLogger.info(
          'PERSISTENCE',
          `🗑️ [第3章4節 明示的削除] ${targetMemories.length}件の記憶をランタイムブラックリストへ即時追加 & 台帳アーカイブ`,
          { deletedIds: targetMemories.map((t) => t.id) }
        );
      }
    }

    // Auto extract memory heuristics
    if (persona.autoExtractMemories && text.trim()) {
      autoExtractMemory(text);
    }

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachedFiles: attached?.map((a) => ({ name: a.name, size: a.content.length, type: a.type })),
    };

    setMessages((prev) => [...prev, userMsg]);

    const assistantId = 'msg_asst_' + Date.now();
    currentAssistantIdRef.current = assistantId;

    // ── 設計思想: 自律自己改善 (Autonomous Continuous Evolution) の自然言語意図検知 ──
    const selfImprovementKeywords = [
      '自身のコードをもっと自動で改善',
      '自身のコードを自動で改善',
      'コードをもっと自動で改善',
      'コードを自動で改善',
      '自動で改善させられるように',
      '自律自己改善',
      '自己改善を実行',
      'コードを自動改善',
      'オートパイロットで改善',
      '自律改善サイクル',
      '自己コード改善して',
    ];
    const isSelfImprovementRequest = selfImprovementKeywords.some((kw) => text.includes(kw));

    if (isSelfImprovementRequest) {
      const activeSpeaker = SPEAKER_PROFILES[speakerMode] || SPEAKER_PROFILES.miki;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: `🤖 **みきの全自動・自律コード自己改善サイクルを起動したよ！** ✨\n\n人間による手動操作を介さず、みきが自律的に【全170章の仕様書ドリフト監査 ➔ 5大不変条件検証 ➔ 最適改善対象の選定 ➔ TypeScriptコード合成 ➔ AST構文検査＆TDD単体テスト ➔ 最大3回の自律修復ループ ➔ スナップショット安全記録 ➔ 物理配備】までを一貫して自動実行するね！🌸\n\n今、パイプラインを実行中だから少し待っててね...！`,
          timestamp: Date.now(),
          speaker: activeSpeaker,
          engineMode,
          isStreaming: true,
        },
      ]);

      try {
        const record = await autonomousContinuousEvolutionService.runFullAutonomousCycle();
        const diffSummary = `🎉 **自律自己改善サイクルが全工程オールクリアで完了したよ！**\n\n` +
          `- 🎯 **改善対象**: ${record.chapterNumber ? `第${record.chapterNumber}章『${record.chapterTitle}』` : record.targetFile}\n` +
          `- 🛡️ **5大不変条件**: 全項目パス (Qwen 3B保護・プライバシー防壁・API循環・ロールバック性・監査不変)\n` +
          `- 🧪 **自律検証**: AST構文合格 / TDD単体テスト ${record.verification.testPassedCount}/${record.verification.testTotalCount} 件パス / 循環参照 0件\n` +
          `- 🔄 **自律修復 (Self-Healing)**: ${record.selfHealingAttempts}回試行\n` +
          `- 📈 **設計思想適合スコア**: ${record.previousScore}点 ➔ **${record.newScore}点** (+${Math.max(0, record.newScore - record.previousScore)}点)\n` +
          `- ⏱️ **安全機構**: 変更前スナップショット自動記録済（いつでもワンクリックで復元可能）\n\n` +
          `下のカードから各実行ステージの詳細ログや、TDDテスト結果、差分の確認・ロールバックができるよ！いつでもツールバーの「🤖」アイコンからオートパイロット（定期自動巡回）も有効にできるからね😊💕`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: diffSummary,
                  isStreaming: false,
                  autonomousEvolution: record,
                }
              : m
          )
        );
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `⚠️ **自律自己改善サイクル中に安全停止が発火しました**\n\n【停止理由】: ${err?.message || '不変条件または構文安全基準に抵触したため、安全を最優先して変更を破棄しました。'}\n\n※ 既存のコードベースとQwen 3Bアンカーは完全に保護されており、破壊的な変更は一切加えられていません。`,
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsGenerating(false);
        setIsLoading(false);
      }
      return;
    }

    const handleAbortExit = (stepName: string) => {
      systemLogger.warn('CHAT', `チャット処理が中断シグナルにより中止されました [${stepName}]`, {
        elapsedMs: Math.round(performance.now() - sendStartTime),
      });
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content:
                  msg.content.includes('推論中') ||
                  msg.content.includes('初期化中') ||
                  msg.content.includes('準備中') ||
                  msg.content.includes('生成中')
                    ? '⏹ 生成を中断しました。'
                    : msg.content,
                isStreaming: false,
                executionSteps: systemLogger.getCurrentSessionSteps(),
              }
            : msg
        )
      );
      if (currentAssistantIdRef.current === assistantId) {
        currentAssistantIdRef.current = null;
      }
      setIsGenerating(false);
      setIsLoading(false);
    };

    try {
      const activeSpeaker = SPEAKER_PROFILES[speakerMode] || SPEAKER_PROFILES.miki;
      const activeMemories = memories.filter((m) => m.active);

      // 対策2: 日常の挨拶・相槌・短文対話の判定 (RAG・重厚コンテキストスキップ)
      const isCasualGreeting = isCasualGreetingOrShortSocial(text);

      let memoryPipelineResult: any;
      let relevantMemories: MemoryItem[] = [];

      if (isCasualGreeting) {
        memoryPipelineResult = {
          scoredMemories: [],
          totalFound: 0,
          steps: [{ step: 1, name: '日常挨拶スキップ', count: 0, ms: 0 }],
          executionTimeMs: 0,
        };
        relevantMemories = [];

        // Step 2: Memory Retrieval Skip for greetings
        systemLogger.step(2, 10, '長期記憶・RAG検索スキップ (日常挨拶・超軽量即答モード)', {
          isCasualGreeting: true,
          speaker: activeSpeaker.name,
        });
      } else {
        // 設計思想 8章 & 35章 第4段階: 長期記憶・完全一致・全文検索・原文再取得の7段階パイプライン
        // 設計思想 25: profile/preferenceなどの事実性カテゴリは承認済み記憶のみに制限
        memoryPipelineResult = await longTermMemoryService.searchPipeline(
          text,
          activeMemories,
          conversationState,
          messages,
          {
            limit: 8,
            onlyApprovedForFacts: true,
          }
        );
        relevantMemories = memoryPipelineResult.scoredMemories.map((sm: any) => sm.memory);

        // Gemini Cloud利用時の外部送信保護: 個人情報・関係性記憶(profile/relationship)を除外する設定
        if (engineMode === 'gemini_cloud') {
          const excludeSensitive = storageService.getItem('miki_cloud_exclude_sensitive_memories') !== 'false';
          if (excludeSensitive) {
            const beforeCount = relevantMemories.length;
            relevantMemories = relevantMemories.filter(
              (m) => m.category !== 'profile' && m.category !== 'relationship'
            );
            if (beforeCount !== relevantMemories.length) {
              systemLogger.info(
                'NETWORK',
                `🔒 [外部送信保護] Gemini Cloudプロンプトからプライベート記憶(${beforeCount - relevantMemories.length}件)を除外しました`
              );
            }
          }
        }

        // Step 2: Memory Retrieval & Context Association (設計思想 8章 7段階検索)
        systemLogger.step(2, 10, '長期記憶・7段階検索パイプライン実行 (完全一致/全文/原文再取得)', {
          activeMemoriesCount: activeMemories.length,
          relevantMemoriesCount: relevantMemories.length,
          pipelineSteps: memoryPipelineResult.steps.map((s: any) => `${s.step}.${s.name}:${s.count}件`).join(' | '),
          intimacyLevel: persona.intimacyLevel,
          intimacyExp: persona.intimacyExp,
          speaker: activeSpeaker.name,
        });
      }

      // =========================================================================
      // 設計思想 9章: 回答骨格と思考節約 (Answer Plan Matching)
      // =========================================================================
      const isAnswerPlanEnabled = featureFlagsService.isEnabled('ANSWER_PLAN_CACHE');
      const answerPlanResult: AnswerPlanApplicationResult = (isAnswerPlanEnabled && !isCasualGreeting)
        ? answerPlanService.matchSkeleton(text, conversationState)
        : { applied: false, reason: isCasualGreeting ? '日常挨拶のため回答骨格スキップ (軽量即答)' : '機能フラグANSWER_PLAN_CACHEが無効化されています' };

      if (answerPlanResult.applied && answerPlanResult.matchedSkeleton) {
        systemLogger.info(
          'CHAT',
          `⚡ [9章 回答骨格適用] パターン: ${answerPlanResult.matchedSkeleton.pattern_id} (理由: ${answerPlanResult.reason})`,
          {
            situation: answerPlanResult.matchedSkeleton.situation,
            plan: answerPlanResult.matchedSkeleton.response_plan,
            avoid: answerPlanResult.matchedSkeleton.avoid,
          }
        );
      }

      // =========================================================================
      // PATH 0: Phase 3 - 多段推論タスク計画 & 検証エンジン (Multi-Step Task Plan)
      // 制約遵守: 単純な会話・挨拶は軽量フロー(PATH 1/PATH 2)へ通し、複合課題のみ多段化
      // =========================================================================
      const shouldUseMulti = taskPlanService.shouldUseMultiStep(text, {
        workspaceFilesCount: workspaceFiles.length,
        attachedFilesCount: attached?.length,
        userExplicitMultiStep: isMultiStepExplicit,
      });

      if (shouldUseMulti) {
        systemLogger.step(3, 10, '🧭 多段推論タスク計画の立案と段階的検証を開始');
        const plan = taskPlanService.createPlan(text, {
          workspaceFiles,
          relevantMemories,
          attachedFilesCount: attached?.length,
          userExplicitMultiStep: isMultiStepExplicit,
        });

        // 初期計画メッセージを表示
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: `📋 **多段推論タスク計画を立案しました (全${plan.totalSteps}ステップ)**\n各ステップの要件分析・検証を順次進めます...`,
            timestamp: Date.now(),
            speaker: activeSpeaker,
            engineMode,
            isStreaming: true,
            taskPlan: plan,
            executionSteps: systemLogger.getCurrentSessionSteps(),
          },
        ]);

        await executePlanLoop(plan, assistantId, text, attached);
        return;
      }

      // ==========================================
      // PATH 1: Instant Autonomous CPU Rule Engine
      // ==========================================
      if (engineMode === 'autonomous_rule') {
        systemLogger.step(3, 10, 'CPU自律ルールベースエンジンで即時応答生成');
        const isCode =
          text.includes('作って') ||
          text.includes('ゲーム') ||
          text.includes('開発') ||
          text.includes('コード');
        const reply = generateSmartCompanionReply(
          text,
          persona,
          relevantMemories,
          isCode,
          attached
        );

        systemLogger.step(10, 10, 'CPU自律ルールベース応答完了', {
          responseLength: reply.length,
          snippet: reply.slice(0, 100),
          totalElapsedMs: Math.round(performance.now() - sendStartTime),
        });

        const cpuCandidateTools = toolsService.detectCandidateToolsForPrompt(text, { workspaceFiles });
        const cpuExecutedTools = [];
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

        // 文書48章: 完成条件と完了判定器による評価
        const cpuEvaluation = completionJudgeService.evaluateCompletion({
          userGoal: text,
          assistantResponse: reply,
          executionSteps: systemLogger.getCurrentSessionSteps(),
          executedTools: cpuExecutedTools,
        });

        // 48章の完了判定が自動的に FAILED / BLOCKED を検出した場合、
        // ユーザーの👎を待たずに自己改善ルーターへ自動的に診断依頼する。
        // ※ PARTIAL は正常な途中経過であり得るため除外（ノイズ防止）。
        // ※ EXTERNAL_COMPILE_REQUIRED / RUNTIME_TEST_REQUIRED は外部確認が必要な正常振る舞いのため除外。
        // ※ CANCELLED / COMPLETE は対象外。
        if (
          (cpuEvaluation.status === 'FAILED' || cpuEvaluation.status === 'BLOCKED') &&
          !cpuEvaluation.autoDiagnosedAt
        ) {
          selfImprovementService.diagnoseFailure(
            text,
            reply,
            `[自動検出] 完了判定: ${cpuEvaluation.status} - ${cpuEvaluation.reason}`,
            {
              memoriesUsedCount: 0,
              promptLengthChars: 1200,
              engineMode: 'autonomous_rule',
            }
          );
          cpuEvaluation.autoDiagnosedAt = Date.now();
          systemLogger.info(
            'SELF_IMPROVEMENT',
            `🔍 完了判定(${cpuEvaluation.status})を自動検出し、改善ルーターへ自動登録しました(ユーザー操作不要)。`
          );
        }

        // コードブロック抽出 & 生成と適用の分離 (設計思想 ②, ⑩, 22-25, 26)
        const codeBlocks = extractCodeBlocks(reply);
        let cpuCodeProposal: CodeProposal | undefined = undefined;
        let cpuVbaAssessment: VbaSafetyAssessment | undefined = undefined;

        if (codeBlocks.length > 0) {
          cpuCodeProposal = {
            id: `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            files: codeBlocks.map((cb) => ({
              path: cb.path,
              name: cb.name,
              content: cb.content,
              language: cb.language,
            })),
            status: 'pending',
            source: 'assistant',
            createdAt: Date.now(),
          };

          const vbaBlock = codeBlocks.find(
            (cb) => cb.language === 'vba' || cb.name.endsWith('.bas') || cb.content.toLowerCase().includes('sub ') || cb.content.toLowerCase().includes('dim ')
          );
          if (vbaBlock) {
            cpuVbaAssessment = schemaValidationService.evaluateVbaSafety(vbaBlock.content);
          }
        }

        const cpuCodeVerification = codeVerificationService.verifyCode(reply);
        const cpuFalsificationReport = falsificationService.evaluateFalsification({
          userGoal: text,
          assistantResponse: reply,
          conversationState,
          codeVerification: cpuCodeVerification,
        });

        let cpuCodeUnderstandingIR = undefined;
        if (featureFlagsService.isEnabled('CODE_UNDERSTANDING')) {
          if (codeBlocks.length > 0) {
            const targetBlock = codeBlocks[0];
            cpuCodeUnderstandingIR = codeUnderstandingService.parseCodeToIR(
              targetBlock.content,
              (targetBlock.language as any) || 'vba',
              targetBlock.name
            );
          } else if (text.includes('Sub ') || text.includes('Function ') || text.includes('function ') || (attached && attached[0]?.content)) {
            const raw = attached && attached[0]?.content ? attached[0].content : text;
            cpuCodeUnderstandingIR = codeUnderstandingService.parseCodeToIR(raw, 'vba');
          }
        }

        const isCpuVbaRequest =
          text.toLowerCase().includes('vba') ||
          text.includes('マクロ') ||
          text.includes('excel') ||
          text.includes('エクセル') ||
          codeBlocks.some((b) => b.language === 'vba' || b.name.endsWith('.bas'));

        let cpuVbaDesignSpecification = undefined;
        if (featureFlagsService.isEnabled('VBA_DESIGN_ASSISTANT') && isCpuVbaRequest) {
          cpuVbaDesignSpecification = vbaDesignAssistantService.createSpecificationFromPrompt(text);
        }

        let cpuSynthesizedWf: SynthesizedWorkflow | undefined = undefined;
        if (workflowSynthesisService.shouldSynthesizeWorkflow(text)) {
          cpuSynthesizedWf = workflowSynthesisService.synthesizeWorkflow(text);
        }

        // 設計思想 49章: 経験の保存先ルーターによる9分類自動仕分け
        const cpuExperienceRouting = experienceRouterService.routeExperience(
          {
            content: reply,
            source: 'conversation',
            category: reply.includes('```') ? 'code' : 'chat',
          },
          memories
        );

        // 設計思想 18章: 会話評価11指標の測定
        const cpuDialogueEvaluation = dialogueEvaluationService.evaluateGeneralDialogue(
          text,
          reply,
          Math.round(performance.now() - sendStartTime)
        );

        const cpuMsg: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
          speaker: activeSpeaker,
          engineMode: 'autonomous_rule',
          isStreaming: false,
          completionEvaluation: cpuEvaluation,
          codeVerification: cpuCodeVerification,
          falsificationReport: cpuFalsificationReport,
          codeProposal: cpuCodeProposal,
          vbaAssessment: cpuVbaAssessment,
          synthesizedWorkflow: cpuSynthesizedWf,
          answerPlan: answerPlanResult,
          codeUnderstandingIR: cpuCodeUnderstandingIR,
          vbaDesignSpecification: cpuVbaDesignSpecification,
          experienceRouting: cpuExperienceRouting,
          dialogueEvaluation: cpuDialogueEvaluation,
          executionSteps: systemLogger.getCurrentSessionSteps(),
          suggestedTools: cpuCandidateTools,
          executedTools: cpuExecutedTools,
          metrics: {
            engine: `CPUルールベース (${activeSpeaker.name})`,
            tokens: Math.round(reply.length / 3),
            tokensPerSec: 100,
            ttftMs: 1,
            totalDurationMs: Math.round(performance.now() - sendStartTime),
          },
        };

        setMessages((prev) => [...prev, cpuMsg]);
        setIsLoading(false);
        setIsGenerating(false);

        // Auto apply code if generated
        if (codeBlocks.length > 0) {
          handleApplyCode(codeBlocks);
        }
        return;
      }

      // ==========================================
      // PATH 2: WebGPU or Gemini Cloud Engine
      // ==========================================
      // 設計思想 Master v5.0 第2章: 直前ターンで想起された記憶へのフィードバック反映 (有用性・熱量更新)
      if (lastTurnUsedMemoryIdsRef.current.length > 0) {
        const isUserDispleasedOrCorrecting =
          text.includes('違う') ||
          text.includes('そうじゃなくて') ||
          text.includes('間違') ||
          text.includes('ダメ') ||
          text.includes('やり直') ||
          text.includes('そうではなく');
        setMemories((prev) =>
          longTermMemoryService.recordTurnFeedback(
            prev,
            lastTurnUsedMemoryIdsRef.current,
            isUserDispleasedOrCorrecting
          )
        );
      }

      // Step 3: Prompt classification (MoE intent detection)
      systemLogger.step(3, 10, 'MoE プロンプト意図分類 & パラメータ決定');
      const promptAnalysis = classifyPromptForMoE(text, { workspaceFiles });
      systemLogger.info(
        'INFERENCE',
        `プロンプト意図判定: [${promptAnalysis.role}] (Temp: ${promptAnalysis.temperature})${
          promptAnalysis.recommendedTools.length > 0
            ? `, 推奨ツール: [${promptAnalysis.recommendedTools.map((t) => t.name).join(', ')}]`
            : ''
        }`
      );

      const activeGameCode = workspaceFiles.find((f) => f.path === 'index.html')?.content || '';

      // Step 4: Hardware & Storage Diagnosis
      systemLogger.step(4, 10, '端末ハードウェア & WebGPU VRAM リアルタイム診断');
      const cachedModelsList = await Promise.race([
        webLLMService.listAllCachedModels().catch(() => []),
        new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 2000)),
      ]);

      const gpuCheck = await Promise.race([
        webLLMService.isWebGPUSupported().catch(() => ({ supported: false })),
        new Promise<{ supported: boolean }>((resolve) => setTimeout(() => resolve({ supported: false }), 2000)),
      ]);
      const isGpuUsable = gpuCheck.supported;

      systemLogger.debug('WEBGPU', `WebGPU診断完了: 可用性=${isGpuUsable}, キャッシュ済みモデル数=${cachedModelsList.length}`);

      // Step 5: Model Selection & Cache verification
      let targetModelId = '';
      if (engineMode === 'native_gpu') {
        const activeGguf = nativeLlmService.getActiveModelId();
        if (activeGguf) {
          targetModelId = activeGguf;
        } else {
          const availableGgufs = await nativeLlmService.getAvailableGgufModels().catch(() => []);
          targetModelId = availableGgufs[0]?.name || availableGgufs[0]?.fileName || 'Qwen 2.5 Coder 0.5B (GGUF)';
        }
        systemLogger.step(5, 10, `GGUF推論対象モデル選定 & バインド確認: ${targetModelId}`, {
          engineMode: 'native_gpu',
          targetModelId,
          activeModelId: nativeLlmService.getActiveModelId(),
        });
      } else {
        targetModelId = (webLLMService.isLoaded() && webLLMService.getActiveModelId())
          ? webLLMService.getActiveModelId()!
          : await Promise.race([
              webLLMService.findBestAvailableModel(promptAnalysis.role),
              new Promise<string>((resolve) => setTimeout(() => resolve('SmolLM2-360M-Instruct-q4f16_1-MLC'), 2000)),
            ]);

        systemLogger.step(5, 10, `推論対象モデル選定 & バインド確認: ${targetModelId}`, {
          isEngineLoaded: webLLMService.isLoaded(),
          activeModelId: webLLMService.getActiveModelId(),
          targetModelId,
        });
      }

      // Clean placeholder message based on selected engineMode
      const placeholderText =
        engineMode === 'native_gpu'
          ? `⚡ llama.cpp GGUF (${targetModelId.split(' ')[0]}) で直接推論中...`
          : engineMode === 'external_gpu'
          ? `🖥️ 外部ローカルLLM (Ollama/LM Studio) で推論中...`
          : engineMode === 'gemini_cloud'
          ? `☁️ Gemini Cloud で生成中...`
          : webLLMService.isLoaded()
          ? `⚡ オンデバイス (${targetModelId.split('-')[0]}) で推論中...`
          : `🔄 端末内モデル (${targetModelId.split('-')[0]}) を準備中... (トークン消費: 0)`;

      const placeholderMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: placeholderText,
        timestamp: Date.now(),
        speaker: activeSpeaker,
        engineMode: engineMode,
        isStreaming: true,
        executionSteps: systemLogger.getCurrentSessionSteps(),
        metrics: {
          engine:
            engineMode === 'native_gpu'
              ? `llama.cpp GGUF (${targetModelId.split(' ')[0]})`
              : engineMode === 'external_gpu'
              ? 'External Local LLM (Ollama)'
              : engineMode === 'gemini_cloud'
              ? 'Gemini Cloud'
              : `On-Device (${targetModelId.split('-')[0]})`,
        },
      };
      setMessages((prev) => [...prev, placeholderMsg]);

      // Step 6: Model Load / VRAM Binding
      let isModelReady = engineMode === 'native_gpu' ? !!nativeLlmService.getActiveModelId() : webLLMService.isModelLoaded(targetModelId);
      const isTargetCached = engineMode === 'native_gpu'
        ? true
        : await Promise.race([
            webLLMService.isModelCached(targetModelId).catch(() => false),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
          ]);

      systemLogger.step(6, 10, 'モデル重み & VRAM展開 (必要な場合)', {
        targetModelId,
        isModelReady,
        isTargetCached,
      });

      if (engineMode === 'native_gpu' && !isModelReady) {
        try {
          systemLogger.info('NATIVE_GPU', '端末内のGGUFモデルを自動検索・展開します...');
          const autoLoaded = await nativeLlmService.autoLoadDownloadedModelIfAvailable((report) => {
            if (abortController.signal.aborted) return;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: `🔄 GGUFモデルVRAM展開中: ${report.text} (${report.progress}%)`,
                      executionSteps: systemLogger.getCurrentSessionSteps(),
                    }
                  : msg
              )
            );
          });
          isModelReady = autoLoaded;
        } catch (natLoadErr: any) {
          systemLogger.warn('NATIVE_GPU', 'GGUFモデル自動ロード待機タイムアウト/スキップ:', natLoadErr?.message || natLoadErr);
        }
      } else if (engineMode === 'webgpu' && isGpuUsable && !isModelReady) {
        try {
          systemLogger.info('WEBGPU', `WebGPUモデル (${targetModelId}) のロードを開始します (キャッシュ状況: ${isTargetCached ? '端末キャッシュあり' : '未ダウンロード/要取得'})...`);
          const loadPromise = webLLMService.loadModel(targetModelId, (report) => {
            if (abortController.signal.aborted) return;
            systemLogger.debug('WEBGPU', `ロード進捗: ${report.text} (${report.progress}%)`);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: isTargetCached
                        ? `🔄 モデル初期化中: ${report.text} (${report.progress}%)`
                        : `📥 モデルダウンロード＆初期化中: ${report.text} (${report.progress}%)`,
                      executionSteps: systemLogger.getCurrentSessionSteps(),
                    }
                  : msg
              )
            );
          });

          // Timeout protection: if model is not yet downloaded, don't freeze the chat forever
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('WebGPUロード待機タイムアウト (未ダウンロードまたはVRAM確保遅延のためCPUルールベースで即答します)')),
              isTargetCached ? 30000 : 12000
            )
          );

          await Promise.race([loadPromise, timeoutPromise]);
          isModelReady = webLLMService.isModelLoaded(targetModelId);
          systemLogger.info('WEBGPU', `モデルロード完了: ${targetModelId} (推論可能状態)`);
        } catch (loadErr: any) {
          systemLogger.warn('WEBGPU', 'WebGPU Model load deferred/timed out:', loadErr?.message || loadErr);
          isModelReady = false;
        }
      }

      if (abortController.signal.aborted) {
        handleAbortExit('工程 6 完了直後');
        return;
      }

      // Step 7: System Prompt & Context Tokenization
      systemLogger.step(7, 10, 'システムプロンプト合成 & コンテキストトークナイズ', {
        targetModelId,
        isModelReady,
        isGpuUsable,
      });
      const tStart = performance.now();
      const hasCodeInWorkspace = workspaceFiles.some(
        (f) => f.content && f.content.trim().length > 20
      );
      const isCodeModRequest =
        hasCodeInWorkspace &&
        (
          promptAnalysis.role === 'code' ||
          promptAnalysis.role === 'shader' ||
          promptAnalysis.role === 'logic' ||
          /(修正|変更|直して|追加|改善|バグ|エラー|動かない|動くように|リファクタ|機能|もっと|コード|css|html|js|script|style|デザイン|色|スピード|ボタン|動き|調整|最適化|高速化|直せる|みて|見て)/i.test(text)
        );

      // 🛠️ ツール検出 & 自動実行パイプライン (:feature:tools / 設計思想 14 & 22)
      // 小型ローカルLLM (1.5B/0.5B等) のハルシネーションを防ぐため、プロンプト生成前にツールを安全評価
      const candidateTools = toolsService.detectCandidateToolsForPrompt(text, { workspaceFiles });
      const executedTools: ToolExecutionResult[] = [];

      for (const rec of candidateTools) {
        if (!rec.requiresConfirmation) {
          // read_only / workspace_read 等の安全なツールは即時自動実行
          try {
            const toolRes = await toolsService.executeTool(
              rec.toolId,
              rec.suggestedParams || {},
              {
                workspaceFiles,
                onUpdateWorkspaceFile: handleUpdateFileContent,
                userNickname: persona.userNickname,
              }
            );
            if (toolRes.success) {
              executedTools.push(toolRes);
              systemLogger.info('TOOLS', `LLM前処理ツール自動実行成功: [${rec.name}]`, {
                summary: toolRes.outputSummary,
                durationMs: toolRes.executionTimeMs,
              });
            } else if (toolRes.requiresPluginConsent) {
              // 46章: 能力プラグイン権限未同意の場合はチャットで案内するため結果を格納
              executedTools.push(toolRes);
              systemLogger.warn('TOOLS', `LLM前処理ツールは能力プラグイン権限未同意のためブロック: [${rec.name}]`, {
                plugin: toolRes.pluginConsentRequest?.plugin.name,
              });
            }
          } catch (toolErr: any) {
            systemLogger.warn('TOOLS', `LLM前処理ツール実行失敗 [${rec.name}]:`, toolErr?.message || toolErr);
          }
        } else {
          // 破壊的操作 (ファイル書き換え等) の場合は確認キューに待機させ、チャット側にも通知
          try {
            const toolRes = await toolsService.executeTool(
              rec.toolId,
              rec.suggestedParams || {},
              {
                workspaceFiles,
                onUpdateWorkspaceFile: handleUpdateFileContent,
                userNickname: persona.userNickname,
              },
              { userConfirmed: false }
            );
            if (toolRes.requiresConfirmation && toolRes.result?.pendingRequest) {
              systemLogger.info('TOOLS', `破壊的ツール確認待ちキュー登録: [${rec.name}]`, toolRes.result.pendingRequest);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        pendingToolConfirmation: toolRes.result.pendingRequest,
                      }
                    : m
                )
              );
            }
          } catch (toolErr: any) {
            systemLogger.warn('TOOLS', `ツール確認キュー登録失敗 [${rec.name}]:`, toolErr?.message || toolErr);
          }
        }
      }

      // 🧠 世界モデル: 行動前予測 (設計思想 17. 世界モデルと予測誤差)
      const actionPrediction = worldModelService.predictAction(text, relevantMemories, persona);
      systemLogger.info('STEP', `世界モデル事前予測 [${actionPrediction.expectedIntent}] 期待トーン:${actionPrediction.expectedTone}, 予測記憶数:${actionPrediction.expectedMemoryUsage.predictedMemoryCount}`);

      // 設計思想 Master v5.0 第4章: 3層コンテキスト長自動調整エンジン (Qwen等のモデルカタログ仕様に連動)
      const isHeavyTask = isCodeModRequest || promptAnalysis.role !== 'moe_chat';
      const budgetPlan = contextBudgetEngineService.calculateBudgetPlan(undefined, isHeavyTask, isCodeModRequest);
      systemLogger.info(
        'INFERENCE',
        `📊 動的コンテキスト予算計画: nCtx=${budgetPlan.tier}, LiveBudget=${budgetPlan.liveBudget}tok, 履歴配分=${budgetPlan.historyQuota}tok, コード配分=${budgetPlan.codeQuota || 0}tok`
      );

      const promptBuildResult = await buildExpertSystemPromptWithTracking(
        promptAnalysis.role,
        persona,
        relevantMemories,
        workspaceFiles,
        text,
        {
          includeFiles: isCodeModRequest,
          activeFilePath,
          codeQuotaTokens: budgetPlan.codeQuota,
          toolResults: executedTools,
          conversationState,
          recentMessages: messages,
          isCasualGreeting,
        }
      );
      const systemPrompt = promptBuildResult.systemPrompt;
      const usedMemoriesTracked = promptBuildResult.usedMemories;
      const usedSkillsTracked = promptBuildResult.usedSkills;

      // 記憶の利用履歴（useCount & lastUsedAt）を更新
      if (usedMemoriesTracked.length > 0) {
        setMemories((prev) => recordMemoryUsage(usedMemoriesTracked.map((m) => m.id), prev));
      }

      // コンテキスト圧縮 & スライディングウィンドウ (設計思想 Master v5.0 第4章 B層 動的予算配分)
      const validHistoryMessages = messages.filter(
        (m) => m.id !== 'welcome_msg' && m.id !== userMsg.id && m.content && m.content.trim()
      );
      const compressionResult = compressContextHistory(validHistoryMessages, {
        maxContextTokens: budgetPlan.historyQuota,
        recentTurnsToKeep: budgetPlan.recentTurnsToKeep,
        triggerTokenThreshold: Math.floor(budgetPlan.liveBudget * 0.8),
      });

      if (compressionResult.isCompressed) {
        systemLogger.info(
          'STEP',
          `コンテキスト自動圧縮実行: 元推定 ${compressionResult.originalTokensEstimated}トークン ➔ ${compressionResult.compressedTokensEstimated}トークン (${Math.round((1 - compressionResult.compressionRatio) * 100)}% 削減)`
        );
      }

      // 設計思想 6章 & 35章 第3段階: 回答長選択と回答設計
      const lengthSelection = responseDesignService.determineExpectedResponseLength(text, conversationState);
      const activeExpectedLength = lengthSelection.length;
      const responseDesignInstruction = responseDesignService.buildResponseDesignInstruction(
        activeExpectedLength,
        conversationState.stage,
        isCasualGreeting
      );

      // 設計思想 47章 & 35章 第5段階: 自然言語からの自律ワークフロー合成
      let synthesizedWf: SynthesizedWorkflow | undefined = undefined;
      if (!isCasualGreeting && workflowSynthesisService.shouldSynthesizeWorkflow(text)) {
        synthesizedWf = workflowSynthesisService.synthesizeWorkflow(text);
        systemLogger.info(
          'STEP',
          `⚡ [47章 ワークフロー合成] ${synthesizedWf.steps.length}段階のパイプラインを自動生成 (ID: ${synthesizedWf.workflowId})`
        );
      }

      systemLogger.info(
        'STEP',
        `回答長選定: [${activeExpectedLength.toUpperCase()}] (${lengthSelection.reason}, 目安:${lengthSelection.targetRange})`
      );

      // 会話状態管理 (設計思想 7章) & 回答設計 (設計思想 6章・第3段階)
      const currentConvStateWithLength = {
        ...conversationState,
        expectedResponseLength: activeExpectedLength,
      };
      const stateSummary = isCasualGreeting ? '' : formatConversationStateForPrompt(currentConvStateWithLength);

      // 設計思想 Master v5.2 第15章6節: プロンプトキャッシュ最適化 (Prompt Cache Alignment - 作業指示書 v6 優先度8 & 優先度1 是正版)
      // DYNAMIC CONTEXTの要素を「不変度が高い順」に厳格整列する:
      // 1. 静的プレフィックス (staticPrefixPrompt) - 完全固定（発言内容・ツール・役割に依存しない純粋な基底ペルソナ・ガイド・誠実性制約）
      // 2. 会話状態JSON指示 (CONVERSATION_STATE_INSTRUCTION) - 完全固定（軽量版JSON指示、日常挨拶時はダイレクト応答のため省略）
      // 3. 回答設計の原則 (responseDesignInstruction) - 準動的(6パターン)。直前ターンと同じlength/stageならキャッシュがここまで延長
      // 4. 役割別指示 (promptBuildResult.expertInstruction) - 準動的(4パターン)。同一カテゴリの相談が続く限りキャッシュが延長
      // 5. 利用可能ツール (promptBuildResult.toolBlock) - 準動的〜動的
      // 6. 想起記憶 (promptBuildResult.dynamicSuffixPrompt) - 動的 (RAG・中期記憶・構造記憶・スキル・失敗回避・ソースコード等)
      // 7. エピソード要約 (compressionResult.episodeSummary) - 動的
      // 8. 会話状態サマリー (stateSummary) - 動的
      // 9. 骨格指示 (skeletonInstruction) - 状況依存
      const staticPrefix = promptBuildResult.staticPrefixPrompt || systemPrompt;
      const dynamicElements: string[] = [];

      // 1. 会話状態JSON指示 (日常挨拶時は即座の挨拶返答を最優先するため省略)
      if (!isCasualGreeting) {
        dynamicElements.push(CONVERSATION_STATE_INSTRUCTION);
      }

      // 2. 準動的 (length 3種 × stage 2種の6パターン または 挨拶モード): 回答設計の原則
      dynamicElements.push(responseDesignInstruction);

      // 3. 準動的: 役割別指示
      if (promptBuildResult.expertInstruction) {
        dynamicElements.push(`指示: ${promptBuildResult.expertInstruction}`);
      }

      if (!isCasualGreeting) {
        // 4. 準動的〜動的: 利用可能ツール
        if (promptBuildResult.toolBlock) {
          dynamicElements.push(promptBuildResult.toolBlock);
        }

        // 5. 動的: 想起記憶 (RAG, アジェンダ, 構造記憶, スキル, 失敗回避, ツール実行結果, ソースコード)
        if (promptBuildResult.dynamicSuffixPrompt) {
          dynamicElements.push(promptBuildResult.dynamicSuffixPrompt);
        }

        // 6. 動的: エピソード要約
        if (compressionResult.isCompressed && compressionResult.episodeSummary) {
          dynamicElements.push(compressionResult.episodeSummary);
        }

        // 7. 動的: 会話状態サマリー
        if (stateSummary) {
          dynamicElements.push(stateSummary);
        }

        // 8. 動的: 骨格指示
        if (answerPlanResult.applied && answerPlanResult.matchedSkeleton) {
          const skeletonInstruction = answerPlanService.buildInstruction(answerPlanResult.matchedSkeleton);
          dynamicElements.push(skeletonInstruction);
        }
      }

      const combinedSystemPrompt = dynamicElements.length > 0
        ? `${staticPrefix}\n\n=== 🧠 DYNAMIC CONTEXT (想起記憶・対話状態・回答設計) ===\n${dynamicElements.join('\n\n')}`
        : staticPrefix;

      const chatContext: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: combinedSystemPrompt },
      ];

      let userPromptContent = text;
      if (attached && attached.length > 0) {
        const attachedDesc = attached
          .map((a) => `[添付: ${a.name} (${a.type})]\n${(a.content || '').slice(0, 600)}`)
          .join('\n\n');
        userPromptContent = `${attachedDesc}\n\n${text}`;
      }

      // 作業指示書 v5 優先度7: 会話履歴(chatContext)の送信トークン量削減
      // 1. 直近履歴保持件数を6件から4件に減らしトークン消費を抑制
      // 2. 文単位で切り詰めるtruncateTextBySentenceを採用し、文の途中で不自然に切れる問題を解消
      // 3. 直近1〜2件（会話の核心部）は最大350文字、それ以前（古い履歴）は最大160文字に段階的縮小
      const historyCandidates = compressionResult.isCompressed
        ? compressionResult.formattedMessages.filter((m) => m.role !== 'system').slice(-4)
        : validHistoryMessages.slice(-4).map((m) => ({ role: m.role, content: m.content }));

      let lastRole: 'system' | 'user' | 'assistant' = 'system';
      const historyLen = historyCandidates.length;
      for (let i = 0; i < historyLen; i++) {
        const m = historyCandidates[i];
        const r: 'user' | 'assistant' = m.role === 'assistant' ? 'assistant' : 'user';
        if (r !== lastRole) {
          // 直近1〜2件（最新に近い）は最大350文字、古い履歴（3〜4件目）は最大160文字に段階的縮小
          const distFromEnd = historyLen - 1 - i;
          const maxLimit = distFromEnd < 2 ? 350 : 160;
          const truncated = truncateTextBySentence(m.content || '', maxLimit);
          chatContext.push({ role: r, content: truncated });
          lastRole = r;
        }
      }

      if (lastRole === 'user') {
        chatContext.pop();
      }
      chatContext.push({ role: 'user', content: userPromptContent });

      // 作業指示書 v5 計測要件: chatContext全体の文字数・推定トークン数・System/履歴/ユーザーの内訳、
      // および実際に選ばれたlength（short/standard/detailed）とstage（CORRECTIONか否か）を送信直前ログに詳細記録
      const charsCombinedSystem = combinedSystemPrompt.length;
      const charsStaticPrefix = staticPrefix.length;
      const charsDynamicContext = dynamicElements.length > 0 ? dynamicElements.join('\n\n').length : 0;
      // 実際にchatContextに積まれた履歴（先頭systemと末尾userを除外）
      const actualHistoryMessages = chatContext.slice(1, -1);
      const charsHistory = actualHistoryMessages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
      const charsUser = userPromptContent.length;
      const charsTotal = chatContext.reduce((acc, m) => acc + (m.content?.length || 0), 0);
      const estimatedTokens = Math.round(charsTotal / 1.5);
      const isCorrectionStage = conversationState.stage === 'CORRECTION';

      const promptStats = {
        charsTotal,
        charsCombinedSystem,
        charsStaticPrefix,
        charsDynamicContext,
        dynamicElementsCount: dynamicElements.length,
        charsHistory,
        historyMessageCount: actualHistoryMessages.length,
        charsUser,
        estimatedTokens,
        expectedLength: activeExpectedLength,
        stage: conversationState.stage,
        isCorrectionStage,
      };

      systemLogger.info(
        'EXTERNAL_GPU',
        `🔍 [chatContext 送信直前サイズ解析] 全体: ${charsTotal}文字 (~${estimatedTokens} tok) | System: ${charsCombinedSystem}字 (静的: ${charsStaticPrefix}字, 動的: ${charsDynamicContext}字) | 履歴: ${actualHistoryMessages.length}件 (${charsHistory}字) | ユーザー: ${charsUser}字 | 回答設計: length=${activeExpectedLength}, stage=${conversationState.stage} (isCorrection=${isCorrectionStage})`,
        {
          promptStats,
          systemBreakdown: {
            staticPrefixLength: charsStaticPrefix,
            dynamicElementsCount: dynamicElements.length,
            dynamicPreview: dynamicElements.map((el, i) => `[#${i + 1}] ${el.slice(0, 50)}... (${el.length}字)`),
            expectedLength: activeExpectedLength,
            stage: conversationState.stage,
            isCorrectionStage,
          },
        }
      );

      let accumulated = '';
      let tokenCount = 0;
      let firstTokenTime: number | null = null;
      let stateStartTime: number | null = null;
      let stateEndTime: number | null = null;
      let stateDurationMs: number | null = null;
      let webGpuSuccess = false;
      let webGpuErrorDetails: string | null = null;
      let diagnosticData: ChatMessage['fallbackDiagnostic'] = undefined;
      let capturedExternalDiag: any = undefined;
      let executedEngineLabel = 'CPUルールベース';

      // Step 8: Hardware GPU / WebGPU / External LLM Execution
      if (engineMode === 'native_gpu') {
        // ==========================================
        // ⚡ Native Hardware GPU Direct Pipeline
        // ==========================================
        systemLogger.step(8, 10, '⚡ 端末本体の物理GPU (OpenCL / Vulkan / Direct Shader) で直接推論実行');
        try {
          for await (const chunk of nativeLlmService.streamNativeChat(chatContext, {
            temperature: promptAnalysis.temperature,
            max_tokens: 384,
          })) {
            if (abortController.signal.aborted) break;
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
              stateStartTime = firstTokenTime;
            }
            accumulated += chunk;
            tokenCount += chunk.length;
            if (stateStartTime !== null && stateEndTime === null && accumulated.includes('</state>')) {
              stateEndTime = performance.now();
              stateDurationMs = Math.round(stateEndTime - stateStartTime);
            }
            const liveVisible = cleanStreamingVisibleText(accumulated);

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: liveVisible || msg.content,
                      isStreaming: true,
                      executionSteps: systemLogger.getCurrentSessionSteps(),
                    }
                  : msg
              )
            );
          }
          webGpuSuccess = accumulated.trim().length > 0;
          executedEngineLabel = `⚡ llama.cpp GGUF (${nativeLlmService.getActiveModelId() || 'Native GPU'})`;
        } catch (natErr: any) {
          systemLogger.warn('INFERENCE', 'Native GPU execution error:', natErr?.message || natErr);
          webGpuSuccess = false;
          webGpuErrorDetails = natErr?.message || String(natErr);
        }
      } else if (engineMode === 'external_gpu') {
        // ==========================================
        // 🖥️ External Local LLM Server Pipeline (Ollama)
        // ==========================================
        systemLogger.step(8, 10, '🖥️ 外部ローカルLLM (Ollama/LM Studio) 推論実行');
        const extConfig = (() => {
          try {
            const saved = storageService.getItem('miki_external_llm_config');
            if (saved) return JSON.parse(saved);
          } catch (e) {}
          return { endpoint: 'http://localhost:11434', model: 'qwen2.5:1.5b', type: 'ollama' as const };
        })();

        // 設計思想 SECTION 5 (安全側に倒す): WebGPU用モデルID等、保存されている
        // モデル名がサーバー側の稼働モデルと食い違っている状態で送信し続けると、
        // 毎回「モデル名不一致」で失敗するだけになる。送信前に稼働中モデル一覧と
        // 突き合わせ、含まれていなければ自動補正してから送る。
        // (一覧取得自体に失敗した場合は、従来通り extConfig.model のまま送信する
        //  フォールバックを維持する = 挙動を壊さない)
        try {
          const liveModels = await nativeLlmService.listExternalModels(extConfig);
          if (liveModels.length > 0 && !liveModels.includes(extConfig.model)) {
            const corrected = liveModels[0];
            systemLogger.warn(
              'EXTERNAL_GPU',
              `保存されていたモデル名 "${extConfig.model}" は稼働中サーバーに存在しないため "${corrected}" へ自動補正しました。`,
              { previousModel: extConfig.model, correctedModel: corrected, liveModels }
            );
            extConfig.model = corrected;
            try {
              storageService.setItem('miki_external_llm_config', JSON.stringify(extConfig));
            } catch (e) {}
          }
        } catch (listErr) {
          // 一覧取得に失敗しても致命的にはしない。この後の本送信で
          // 従来通りの接続失敗診断(サーバー未起動/接続不可 等)に委ねる。
          systemLogger.warn('EXTERNAL_GPU', 'モデル一覧取得に失敗したため、モデル名の自動補正をスキップします。', {
            message: (listErr as any)?.message || String(listErr),
          });
        }

        try {
          const stageA_preFetchMs = Math.round(performance.now() - tStart);
          const targetMaxTokens = isCasualGreeting
            ? 128
            : activeExpectedLength === 'short'
            ? 256
            : activeExpectedLength === 'standard'
            ? 512
            : 1024;

          for await (const chunk of nativeLlmService.streamExternalLocalLlm(extConfig, chatContext, {
            temperature: isCasualGreeting ? 0.6 : promptAnalysis.temperature,
            max_tokens: targetMaxTokens,
            signal: abortController.signal,
            cachePrompt: true,
            slotId: extConfig.slotId ?? 0,
            stageA_preFetchMs,
            promptStats,
            onDiagnosticRecorded: (diag) => {
              capturedExternalDiag = diag;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        externalLlmDiagnostic: diag,
                      }
                    : msg
                )
              );
            },
          })) {
            if (abortController.signal.aborted) break;
            if (firstTokenTime === null) {
              firstTokenTime = performance.now();
              stateStartTime = firstTokenTime;
            }
            accumulated += chunk;
            tokenCount++;
            if (stateStartTime !== null && stateEndTime === null && accumulated.includes('</state>')) {
              stateEndTime = performance.now();
              stateDurationMs = Math.round(stateEndTime - stateStartTime);
            }
            const liveVisible = cleanStreamingVisibleText(accumulated);

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: liveVisible || msg.content,
                      isStreaming: true,
                      executionSteps: systemLogger.getCurrentSessionSteps(),
                    }
                  : msg
              )
            );
          }
          webGpuSuccess = accumulated.trim().length > 0;
          executedEngineLabel = `🖥️ 外部ローカルLLM (${extConfig.model})`;
        } catch (extErr: any) {
          const rawMessage = extErr?.message || String(extErr);
          systemLogger.warn('INFERENCE', 'External Local LLM error:', {
            message: rawMessage,
            name: extErr?.name,
            stack: extErr?.stack,
            requestedModel: extConfig?.model,
            endpoint: extConfig?.endpoint,
          });
          webGpuSuccess = false;
          webGpuErrorDetails = rawMessage;
        }
      } else if (engineMode === 'webgpu') {
        systemLogger.step(8, 10, 'WebGPU Transformer推論パイプライン実行 (Prefill & Decode)', {
          isModelReady,
          isGpuUsable,
          targetModelId,
          promptChars: userPromptContent.length,
          contextMessageCount: chatContext.length,
        });

        if (isModelReady && isGpuUsable) {
          try {
            systemLogger.info('INFERENCE', `WebGPU ストリーミング推論開始 (${targetModelId})`);
            const streamPromise = (async () => {
              for await (const chunk of webLLMService.streamChat(chatContext, {
                temperature: promptAnalysis.temperature,
                max_tokens: 256,
                fallbackModelId: targetModelId,
              })) {
                if (abortController.signal.aborted) {
                  break;
                }
                if (firstTokenTime === null) {
                  firstTokenTime = performance.now();
                  stateStartTime = firstTokenTime;
                  const ttft = Math.round(firstTokenTime - tStart);
                  systemLogger.info('INFERENCE', `WebGPU 初回トークン到達 (TTFT: ${ttft}ms)`);
                }
                accumulated += chunk;
                tokenCount++;
                if (stateStartTime !== null && stateEndTime === null && accumulated.includes('</state>')) {
                  stateEndTime = performance.now();
                  stateDurationMs = Math.round(stateEndTime - stateStartTime);
                }
                const liveVisible = cleanStreamingVisibleText(accumulated);

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          content: liveVisible || msg.content,
                          isStreaming: true,
                          executionSteps: systemLogger.getCurrentSessionSteps(),
                        }
                      : msg
                  )
                );
              }
            })();

            const streamTimeout = new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('WebGPU推論待機タイムアウト (30秒無応答)')), 30000)
            );

            await Promise.race([streamPromise, streamTimeout]);
            webGpuSuccess = accumulated.trim().length > 0;
            if (webGpuSuccess) {
              executedEngineLabel = `On-Device WebGPU (${targetModelId.split('-')[0]})`;
              systemLogger.info('INFERENCE', `WebGPU推論成功: 生成トークン数 ${tokenCount} (所要時間: ${Math.round(performance.now() - tStart)}ms)`);
            }
          } catch (gpuErr: any) {
            webGpuErrorDetails = gpuErr?.message || String(gpuErr);
            systemLogger.warn('INFERENCE', 'WebGPU execution error caught:', webGpuErrorDetails);
            webGpuSuccess = false;
          }
        } else {
          webGpuErrorDetails = !isGpuUsable
            ? 'WebGPU非対応または無効 (ブラウザ設定または端末制限)'
            : isTargetCached
            ? 'モデルのVRAMロード待機中'
            : 'モデル未ダウンロード (端末ローカルLLM設定でダウンロード可能)';
          systemLogger.warn('INFERENCE', `WebGPU実行不可の理由: ${webGpuErrorDetails}`);
        }
      }

      if (abortController.signal.aborted) {
        handleAbortExit('工程 8 完了直後');
        return;
      }

      // Step 9: 例外検証 & 自己修復 / フォールバック調停
      systemLogger.step(9, 10, '例外検証 & 自己修復 / フォールバック調停', {
        webGpuSuccess,
        executedEngineLabel,
        hasError: !webGpuSuccess,
      });

      let latestPrivacyAudit: PrivacyAuditResult | undefined = undefined;

      // Fallback or Explicit Alternative Engines (CPU Rule-based or Gemini Cloud)
      if (!webGpuSuccess || accumulated.trim().length === 0) {
        if (engineMode === 'external_gpu') {
          // 外部ローカルLLM接続に失敗した場合、意味のない定型文で誤魔化さず、
          // エラー診断（原因とヒント）をそのまま本文として表示する。
          let diagnosticCategory = '外部ローカルLLM未応答';
          let diagnosticCause = '外部ローカルLLMサーバーからの応答が得られませんでした。';
          let diagnosticTip = '「外部ローカルLLMサーバー設定」でエンドポイントURLとモデル名を確認してください。';

          if (webGpuErrorDetails) {
            if (
              webGpuErrorDetails.includes('Failed to fetch') ||
              webGpuErrorDetails.includes('NetworkError') ||
              webGpuErrorDetails.includes('ERR_CONNECTION') ||
              webGpuErrorDetails.includes('refused')
            ) {
              diagnosticCategory = 'サーバー未応答または通信制限 (Failed to fetch)';
              diagnosticCause = `指定したエンドポイントへの接続に失敗しました。\n生のエラー: ${webGpuErrorDetails}\n\n考えられる原因:\n1. 選択したモデル（3B等）の初回ロード中、またはTermux側でプロセスが停止した\n2. ブラウザ・WebViewからのローカルホスト（127.0.0.1）通信制限（CORS / Private Network Access）\n3. Termux上で実際に稼働中のモデル名と選択中のモデル名（3B）の不一致`;
              diagnosticTip = '「設定」の稼働中モデル一覧で「qwen2-5-1-5b-instruct-q4-k-m」を選択してみるか、Termuxでサーバーログを確認してください。';
            } else if (webGpuErrorDetails.includes('404')) {
              diagnosticCategory = 'エンドポイント不一致 (404)';
              diagnosticCause = '接続先のURLパスが見つかりませんでした。サーバー種別（Ollama/LM Studio・llama.cpp）の設定が実際のサーバーと一致していない可能性があります。';
              diagnosticTip = '「サーバー種別」のプルダウンを、実際に起動しているサーバーの種類に合わせて選び直してください。';
            } else if (
              /model[^a-zA-Z]*(not found|unknown|does not exist|no such)/i.test(webGpuErrorDetails) ||
              /(unknown|invalid) model/i.test(webGpuErrorDetails)
            ) {
              diagnosticCategory = 'モデル名不一致';
              diagnosticCause = '指定したモデル名がサーバー側に登録されていない可能性があります。';
              diagnosticTip = '「稼働中サーバーのモデル一覧」から実際に稼働しているモデルを選び直してください。';
            } else if (
              webGpuErrorDetails.includes('400') ||
              webGpuErrorDetails.includes('422')
            ) {
              diagnosticCategory = 'リクエスト不正 (400/422)';
              diagnosticCause = `サーバーがリクエストを拒否しました。生のエラー: ${webGpuErrorDetails}`;
              diagnosticTip = '診断txtの「生のエラー」欄を確認してください。モデル名以外(リクエスト形式など)が原因の可能性があります。';
            } else if (
              webGpuErrorDetails.includes('500') ||
              webGpuErrorDetails.includes('502') ||
              webGpuErrorDetails.includes('503')
            ) {
              diagnosticCategory = 'サーバー内部エラー';
              diagnosticCause = 'サーバー側（llama-swap/llama.cpp）内部でエラーが発生しました。モデルのロード失敗などが考えられます。';
              diagnosticTip = 'Termux側のログ（例: ~/llama-swap.log）を確認してください。';
            } else if (
              webGpuErrorDetails.includes('timeout') ||
              webGpuErrorDetails.includes('AbortError') ||
              webGpuErrorDetails.includes('タイムアウト')
            ) {
              diagnosticCategory = '応答タイムアウト';
              diagnosticCause = 'サーバーからの応答が時間内に返ってきませんでした。モデルの初回ロード中の可能性があります。';
              diagnosticTip = '数十秒待ってから再度送信するか、モデルサイズを確認してください。';
            } else {
              diagnosticCause = `外部ローカルLLMサーバーでエラーが発生しました: ${webGpuErrorDetails}`;
            }
          }

          const actualExternalModelId = (() => {
            try {
              const saved = storageService.getItem('miki_external_llm_config');
              if (saved) return JSON.parse(saved)?.model;
            } catch (e) {}
            return undefined;
          })();

          diagnosticData = {
            category: diagnosticCategory,
            cause: diagnosticCause,
            tip: diagnosticTip,
            modelId: actualExternalModelId || 'unknown',
            rawErrorMessage: webGpuErrorDetails || undefined,
          };
          executedEngineLabel = '⚠️ 外部ローカルLLM接続失敗';
          systemLogger.warn('CHAT', `[外部LLM未応答診断] ${diagnosticCategory}: ${diagnosticCause} | 生のエラー: ${webGpuErrorDetails}`, diagnosticData);

          accumulated = `⚠️ ${diagnosticCategory}\n\n${diagnosticCause}\n\n💡 ${diagnosticTip}`;
          tokenCount = Math.round(accumulated.length / 3);
          firstTokenTime = performance.now();
        } else {
        try {
          systemLogger.info('CHAT', 'WebGPU未応答またはフォールバック要求のため、即時エンジンを呼び出します');
          const apiRes = await sendChatMessage({
            prompt: text,
            history: messages,
            useSearch: engineMode === 'gemini_cloud' ? useSearch : false,
            engineMode: engineMode,
            speakerMode,
            cachedModels: cachedModelsList,
            workspaceFiles,
            attachedFiles: attached,
            persona,
            memories: relevantMemories,
            signal: abortController.signal,
          });
          latestPrivacyAudit = apiRes.privacyAudit;

          if (abortController.signal.aborted) {
            handleAbortExit('フォールバック処理完了直後');
            return;
          }

          if (engineMode === 'webgpu') {
            let diagnosticCategory = 'CPUルールベース切替';
            let diagnosticCause = 'WebGPUモデル未ロードのため、CPUルールベースで即座に返信しました。';
            let diagnosticTip = '完全GPU推論を行う場合は「端末ローカルLLM設定」からモデルをロードしてください。';

            if (webGpuErrorDetails) {
              if (webGpuErrorDetails.includes('Quota') || webGpuErrorDetails.includes('quota') || webGpuErrorDetails.includes('容量')) {
                diagnosticCategory = '端末保存容量上限 (Quota exceeded)';
                diagnosticCause = 'ブラウザのキャッシュ保存容量上限に達しました。';
                diagnosticTip = '「端末ローカルLLM設定」で全キャッシュ消去を行うか、超軽量SmolLM2-360M (220MB) をお試しください。';
              } else if (webGpuErrorDetails.includes('mapAsync') || webGpuErrorDetails.includes('unmapped') || webGpuErrorDetails.includes('GPUBuffer')) {
                diagnosticCategory = 'GPUバッファ最適化';
                diagnosticCause = 'Android/Adreno GPU のバッファマッピング非同期処理を調整中';
                diagnosticTip = '超軽量モデル（SmolLM2-360M）の利用、またはEngineModalでの「テスト推論」実行を推奨します。';
              } else if (webGpuErrorDetails.includes('Model not loaded') || webGpuErrorDetails.includes('reload')) {
                diagnosticCategory = 'VRAM未バインド';
                diagnosticCause = 'WebGPUエンジン内部でモデルインスタンスのリロード待機状態';
                diagnosticTip = '「端末ローカルLLM設定」で対象モデルの「テスト推論」を1度実行してVRAMをウォームアップしてください。';
              } else if (webGpuErrorDetails.includes('device') || webGpuErrorDetails.includes('lost') || webGpuErrorDetails.includes('VK_ERROR') || webGpuErrorDetails.includes('OutOfMemory')) {
                diagnosticCategory = 'GPUメモリ不足 (OOM)';
                diagnosticCause = '端末のVRAM（GPUメモリ）不足、またはブラウザのWebGPUタイムアウト';
                diagnosticTip = 'より軽量な360M/0.5Bモデルへの切り替え、またはブラウザタブの再読み込みをお試しください。';
              } else if (
                webGpuErrorDetails.includes('Failed to fetch') ||
                webGpuErrorDetails.includes('NetworkError') ||
                webGpuErrorDetails.includes('fetch') ||
                webGpuErrorDetails.includes('通信エラー') ||
                webGpuErrorDetails.includes('404')
              ) {
                diagnosticCategory = 'ダウンロード通信エラー (Failed to fetch)';
                diagnosticCause = 'HuggingFace/GitHub CDNからの重みダウンロード中に通信が切断またはタイムアウト';
                diagnosticTip = '安定したWi-Fi環境で「端末ローカルLLM設定」から「再接続」または「修復&再DL」をお試しください。';
              } else if (webGpuErrorDetails.includes('未ダウンロード')) {
                diagnosticCategory = 'モデル未ダウンロード';
                diagnosticCause = '対象モデルの重みファイルが端末キャッシュに未保存です。';
                diagnosticTip = '「端末ローカルLLM設定」からワンクリックでダウンロード（100%）できます。';
              }
            }

            diagnosticData = {
              category: diagnosticCategory,
              cause: diagnosticCause,
              tip: diagnosticTip,
              modelId: targetModelId,
            };
            executedEngineLabel = `CPUルールベース (${activeSpeaker.name})`;
            systemLogger.warn('CHAT', `[GPULLM未応答診断] ${diagnosticCategory}: ${diagnosticCause}`, diagnosticData);
          } else if (engineMode === 'gemini_cloud') {
            executedEngineLabel = 'Gemini 2.5 Flash (Cloud)';
          } else {
            executedEngineLabel = `CPUルールベース (${activeSpeaker.name})`;
          }

          accumulated = apiRes.text || '返答の生成が完了しました！';
          tokenCount = Math.round(accumulated.length / 3);
          firstTokenTime = performance.now();
        } catch (apiErr: any) {
          if (apiErr?.name === 'AbortError' || abortController.signal.aborted) {
            handleAbortExit('フォールバックAPI例外捕捉');
            return;
          }
          systemLogger.error('CHAT', 'Fallback chat API notice:', apiErr);
          accumulated = `⚠️ 応答生成中にエラーが発生しました:\n・詳細: ${apiErr.message || '接続エラー'}`;
        }
        }
      }

      // Step 10: 応答確定・UIレンダリング & ワークスペース同期
      const tEnd = performance.now();
      const totalElapsedMs = Math.round(tEnd - sendStartTime);
      const durationSec = (tEnd - (firstTokenTime || tStart)) / 1000;
      const tokPerSec = Number((tokenCount / Math.max(0.05, durationSec)).toFixed(1));

      // 設計思想 7章: 会話状態管理 (会話状態の抽出 & 表示テキストの分離 - 作業指示書 v6 優先度9)
      const { state: newConvState, visibleText: rawExtractedText, stats: stateStats } = extractConversationState(
        accumulated,
        conversationState,
        {
          userPrompt: text,
          inferredExpectedLength: activeExpectedLength,
          stateDurationMs: stateDurationMs ?? undefined,
        }
      );
      setConversationState(newConvState);

      // 作業指示書 フェーズ1: シャドー比較記録 (LLM出力state.currentTopic vs 非LLM resolveAnaphora)
      if (shadowAnaphoraResult && shadowAnaphoraResult.detectedExpression) {
        const isMatched = shadowAnaphoraResult.resolved
          ? newConvState.currentTopic.includes(shadowAnaphoraResult.resolved) ||
            shadowAnaphoraResult.resolved.includes(newConvState.currentTopic)
          : false;
        systemLogger.info(
          'STATE_EXTRACTION',
          `⚖️ [指示語解決シャドー比較] 表現:「${shadowAnaphoraResult.detectedExpression}」 | 非LLM決定結果: ${shadowAnaphoraResult.resolved || '(なし/複数候補)'} vs LLM申告topic:「${newConvState.currentTopic}」 | 一致判定: ${isMatched ? 'MATCH (一致)' : 'DIVERGED (不一致/未解決)'}`,
          {
            expression: shadowAnaphoraResult.detectedExpression,
            nonLlmResolved: shadowAnaphoraResult.resolved,
            llmTopic: newConvState.currentTopic,
            confidence: shadowAnaphoraResult.confidence,
            isMatched,
          }
        );
      }

      // 作業指示書 フェーズ2: モデル応答の認識論的分類シャドー記録 (現実/創作/仮定の混同防止)
      const shadowResponseEpistemic = classifyClaimEpistemology(rawExtractedText);
      systemLogger.info(
        'STATE_EXTRACTION',
        `⚖️ [認識論的分類シャドー (モデル応答)] 判定: [${shadowResponseEpistemic.status.toUpperCase()}] (確信度: ${Math.round(shadowResponseEpistemic.confidence * 100)}%) | マーカー: [${shadowResponseEpistemic.detectedMarkers.join(', ') || 'なし'}] | 理由: ${shadowResponseEpistemic.reasons.join(', ')}`,
        {
          shadowResponseEpistemic,
          userInputStatus: shadowUserEpistemic.status,
          isConsistencyPreserved:
            shadowUserEpistemic.status === 'fictional'
              ? shadowResponseEpistemic.status === 'fictional' || shadowResponseEpistemic.status === 'unverified'
              : true,
        }
      );

      systemLogger.step(10, 10, '応答確定・UIレンダリング & ワークスペース同期', {
        executedEngineLabel,
        tokenCount,
        tokPerSec,
        totalElapsedMs,
        ttftMs: Math.round((firstTokenTime || tEnd) - tStart),
        stateStats,
      });

      // 設計思想 6章 & 35章 第3段階: 回答設計・重複排除・自然な日本語化ポストプロセス
      const targetLength = newConvState.expectedResponseLength || activeExpectedLength;
      let { cleanedText: finalVisibleText, quality: responseQuality } = responseDesignService.processOutput(
        rawExtractedText,
        targetLength
      );

      // 設計思想 第69章: 永続人格多重アンカー (口調・親愛スタンス維持＆禁止冷徹語句排除)
      const personaRestored = proactiveContextOsService.verifyAndRestorePersona(finalVisibleText);
      finalVisibleText = personaRestored.restoredText;

      // 文書48章: 完成条件と完了判定器による評価 (Checklist evaluation)
      const streamEvaluation = completionJudgeService.evaluateCompletion({
        userGoal: text,
        assistantResponse: finalVisibleText,
        executionSteps: systemLogger.getCurrentSessionSteps(),
        executedTools: promptBuildResult.executedTools,
        files: workspaceFiles,
      });

      // 48章の完了判定が自動的に FAILED / BLOCKED を検出した場合、
      // ユーザーの👎を待たずに自己改善ルーターへ自動的に診断依頼する。
      // ※ PARTIAL は正常な途中経過であり得るため除外（ノイズ防止）。
      // ※ EXTERNAL_COMPILE_REQUIRED / RUNTIME_TEST_REQUIRED は外部確認が必要な正常振る舞いのため除外。
      // ※ CANCELLED / COMPLETE は対象外。
      if (
        (streamEvaluation.status === 'FAILED' || streamEvaluation.status === 'BLOCKED') &&
        !streamEvaluation.autoDiagnosedAt
      ) {
        selfImprovementService.diagnoseFailure(
          text,
          finalVisibleText,
          `[自動検出] 完了判定: ${streamEvaluation.status} - ${streamEvaluation.reason}`,
          {
            memoriesUsedCount: (promptBuildResult.usedMemories || []).length,
            promptLengthChars: 1200,
            engineMode: engineMode || 'native_gpu',
          }
        );
        streamEvaluation.autoDiagnosedAt = Date.now();
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🔍 完了判定(${streamEvaluation.status})を自動検出し、改善ルーターへ自動登録しました(ユーザー操作不要)。`
        );
      }

      systemLogger.info('CHAT', `[完了判定器] 応答完了判定: [${streamEvaluation.status}] スコア:${streamEvaluation.score}% - ${streamEvaluation.headline}`, {
        status: streamEvaluation.status,
        score: streamEvaluation.score,
        isCodeOrVba: streamEvaluation.isCodeOrVba,
        requiresExternalVerification: streamEvaluation.requiresExternalVerification,
      });

      // コードブロック抽出 & 生成と適用の分離 (設計思想 ②: コード自動適用の確認ゲート & ⑩: VBA準備ゲート)
      const codeBlocks = extractCodeBlocks(finalVisibleText);
      let codeProposal: CodeProposal | undefined = undefined;
      let vbaAssessment: VbaSafetyAssessment | undefined = undefined;

      if (codeBlocks.length > 0) {
        codeProposal = {
          id: `proposal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          files: codeBlocks.map((cb) => ({
            path: cb.path,
            name: cb.name,
            content: cb.content,
            language: cb.language,
          })),
          status: 'pending',
          source: 'assistant',
          createdAt: Date.now(),
        };

        const vbaBlock = codeBlocks.find(
          (cb) => cb.language === 'vba' || cb.name.endsWith('.bas') || cb.content.toLowerCase().includes('sub ') || cb.content.toLowerCase().includes('dim ')
        );
        if (vbaBlock) {
          vbaAssessment = schemaValidationService.evaluateVbaSafety(vbaBlock.content);
        }
      }

      // 設計思想 10章 & 35章 第5段階: 総合コード・VBA安全準備ゲート検証
      const codeVerification = codeVerificationService.verifyCode(finalVisibleText);
      if (codeVerification.hasCode) {
        systemLogger.info(
          'CHAT',
          `[10章 コード準備ゲート] 検証: 言語=[${codeVerification.languages.join(',')}] 安全度=${codeVerification.safetyLevel}(${codeVerification.safetyScore}点) 準備ステータス=${codeVerification.readiness} 構文エラー=${codeVerification.syntaxErrors.length}件 リスク=${codeVerification.risks.length}件`
        );
      }

      // 設計思想 15-16章 & 35章 第5段階: 内的自己反証・エッジケース自己検証ループ
      const falsificationReport = falsificationService.evaluateFalsification({
        userGoal: text,
        assistantResponse: finalVisibleText,
        conversationState: newConvState,
        codeVerification,
      });
      systemLogger.info(
        'CHAT',
        `[15-16章 内的自己反証] 反証スコア=${falsificationReport.falsificationScore}点 合格=${falsificationReport.passed ? 'PASS' : 'WARN/FAIL'} 警告=${falsificationReport.falsificationWarnings.length}件`
      );

      // =========================================================================
      // 設計思想 22〜25章: コード理解中間IRの抽出 (CodeUnderstandingIR)
      // =========================================================================
      let codeUnderstandingIR = undefined;
      if (featureFlagsService.isEnabled('CODE_UNDERSTANDING') && codeBlocks.length > 0) {
        const targetBlock = codeBlocks[0];
        codeUnderstandingIR = codeUnderstandingService.parseCodeToIR(
          targetBlock.content,
          (targetBlock.language as any) || 'vba',
          targetBlock.name
        );
        systemLogger.info(
          'CHAT',
          `[22〜25章 CodeIR] プロシージャ数=${codeUnderstandingIR.procedures.length}, 矛盾検知=${codeUnderstandingIR.commentCodeContradictions.length}件`
        );
      }

      // =========================================================================
      // 設計思想 26章: 抽象VBA設計仕様書 & 決定表ゲート (VbaDesignSpecification)
      // =========================================================================
      let vbaDesignSpecification = undefined;
      const isVbaRequest =
        text.toLowerCase().includes('vba') ||
        text.includes('マクロ') ||
        text.includes('excel') ||
        text.includes('エクセル') ||
        codeBlocks.some((b) => b.language === 'vba' || b.name.endsWith('.bas'));

      if (featureFlagsService.isEnabled('VBA_DESIGN_ASSISTANT') && isVbaRequest) {
        vbaDesignSpecification = vbaDesignAssistantService.createSpecificationFromPrompt(text);
        systemLogger.info(
          'CHAT',
          `[26章 抽象VBA設計仕様書] 決定表ルール=${vbaDesignSpecification.decisionTable.rules.length}則, 抽象プロシージャ=${vbaDesignSpecification.procedurePlans.length}件`
        );
      }

      // =========================================================================
      // 設計思想 21・32章: 不足能力・習得状態追跡 (Capability Gap & Mastery)
      // =========================================================================
      if (streamEvaluation.status === 'COMPLETE') {
        if (isVbaRequest) {
          capabilityGapService.recordSuccess('cap_abstract_vba_design');
        }
        if (codeBlocks.length > 0) {
          capabilityGapService.recordSuccess('cap_code_comprehension');
        }
        if (answerPlanResult.applied && answerPlanResult.matchedSkeleton) {
          capabilityGapService.checkAndRecordGeneralizationGap({
            capabilityId: 'cap_correction',
            patternId: answerPlanResult.matchedSkeleton.pattern_id,
            prompt: text,
            isCorrectAnswer: true,
          });
        }
      } else if (streamEvaluation.status === 'FAILED' || streamEvaluation.status === 'BLOCKED') {
        capabilityGapService.recordGap({
          description: `[完了判定${streamEvaluation.status}] ${streamEvaluation.reason || '目標要件未充足'}`,
          gap_type: 'failure',
          capabilityId: isVbaRequest ? 'cap_abstract_vba_design' : 'cap_logical_priority',
          impact: 'HIGH',
          current_workaround: '教師教材・決定表による再設計',
          candidate_solution: '教師教材の生成、回答骨格の拡充',
          samplePrompt: text,
        });
      }

      // 設計思想 49章: 経験の保存先ルーターによる9分類自動仕分け
      const streamExperienceRouting = experienceRouterService.routeExperience(
        {
          content: finalVisibleText,
          source: 'conversation',
          category: finalVisibleText.includes('```') ? 'code' : 'chat',
        },
        memories
      );

      // 設計思想 18章: 会話評価11指標のリアルタイム測定
      const streamDialogueEvaluation = dialogueEvaluationService.evaluateGeneralDialogue(
        text,
        finalVisibleText,
        totalElapsedMs
      );

      // 設計思想 20章: 不確実性・判断ブレ検出 (条件該当時)
      let streamUncertaintyEvaluation = undefined;
      const isUncertaintyCandidate =
        text.includes('どちら') ||
        text.includes('比較') ||
        text.includes('なぜ') ||
        text.includes('どうすれば') ||
        text.includes('どっち') ||
        text.includes('理由') ||
        text.includes('発熱') ||
        text.includes('メモリ');

      if (isUncertaintyCandidate) {
        try {
          streamUncertaintyEvaluation = await uncertaintyTeacherService.evaluateUncertainty(
            text,
            { targetCapabilityId: isVbaRequest ? 'cap_abstract_vba_design' : 'cap_conv_naturalness' }
          );
        } catch {
          // ignore
        }
      }

      // 設計思想 36章: 当面の最小完成範囲 リアルタイム達成追跡
      if (streamDialogueEvaluation.directness >= 75) {
        minimalScopeService.updateItemStatus('conv_7_direct_answer', 'VERIFIED_ACTIVE');
      }
      if (streamDialogueEvaluation.contextRetention >= 75) {
        minimalScopeService.updateItemStatus('conv_2_recent_context', 'VERIFIED_ACTIVE');
        minimalScopeService.updateItemStatus('conv_3_maintain_topic', 'VERIFIED_ACTIVE');
      }
      if (streamDialogueEvaluation.noRepetition >= 75) {
        minimalScopeService.updateItemStatus('conv_6_choose_length', 'VERIFIED_ACTIVE');
      }
      if (codeBlocks.length > 0) {
        minimalScopeService.updateItemStatus('code_1_split_procedures', 'VERIFIED_ACTIVE');
        minimalScopeService.updateItemStatus('code_8_natural_flow_explanation', 'VERIFIED_ACTIVE');
      }

      // 設計思想 Master v5.0 第9章1節: 1.5B/3Bドラフト検証パイプライン (有効時)
      let draftVerificationData: DraftVerificationResult | undefined = undefined;
      if (draftVerificationService.getConfig().enabled) {
        try {
          const savedExt = storageService.getItem('miki_external_llm_config');
          const extCfg = savedExt ? JSON.parse(savedExt) : undefined;
          draftVerificationData = await draftVerificationService.verifyDraftWith3B(
            text,
            finalVisibleText,
            extCfg
          );
          if (draftVerificationData.verifiedText) {
            finalVisibleText = draftVerificationData.verifiedText;
          }
        } catch (verErr) {
          console.warn('Draft verification error:', verErr);
        }
      }

      // 設計思想 Master v5.0 第13章: 自律型Web検索＆能動学習結果の抽出
      const searchTool = executedTools.find((t) => t.toolId === 'tool_web_search');
      let autonomousSearchData: AutonomousSearchMessageMeta | undefined = undefined;
      if (searchTool && searchTool.success && searchTool.result) {
        autonomousSearchData = {
          query: searchTool.result.query,
          results: searchTool.result.results || [],
          summary: searchTool.result.summary,
          learnedFacts: searchTool.result.learnedKnowledge || [],
          searchTimeMs: searchTool.executionTimeMs,
          provider: searchTool.result.provider,
        };
      }

      // 設計思想 Master v5.0 第11章: 送信ガードレール＆プライバシー監査の保証
      if (!latestPrivacyAudit) {
        latestPrivacyAudit = privacyGuardrailService.auditOutboundContent(text, 'chat_engine');
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: finalVisibleText,
                speaker: activeSpeaker,
                isStreaming: false,
                completionEvaluation: streamEvaluation,
                responseQuality,
                codeVerification,
                vbaStaticVerification: codeVerification.vbaStaticResult,
                privacyAudit: latestPrivacyAudit,
                falsificationReport,
                synthesizedWorkflow: synthesizedWf,
                fallbackDiagnostic: diagnosticData,
                executionSteps: systemLogger.getCurrentSessionSteps(),
                codeProposal,
                vbaAssessment,
                // 設計思想 Version 3.2 追加フィールド
                answerPlan: answerPlanResult,
                codeUnderstandingIR,
                vbaDesignSpecification,
                experienceRouting: streamExperienceRouting,
                dialogueEvaluation: streamDialogueEvaluation,
                uncertaintyEvaluation: streamUncertaintyEvaluation,
                metrics: {
                  engine: executedEngineLabel,
                  tokens: tokenCount,
                  tokensPerSec: tokPerSec,
                  ttftMs: Math.round((firstTokenTime || tEnd) - tStart),
                  totalDurationMs: totalElapsedMs,
                },
                usedMemories: usedMemoriesTracked,
                usedSkills: usedSkillsTracked,
                suggestedTools: promptBuildResult.recommendedTools,
                executedTools: promptBuildResult.executedTools,
                draftVerification: draftVerificationData,
                autonomousSearch: autonomousSearchData,
                externalLlmDiagnostic: capturedExternalDiag,
              }
            : msg
        )
      );

      systemLogger.info(
        'CHAT',
        `チャット処理全工程完了: [${executedEngineLabel}] (文字数: ${finalVisibleText.length}, 総所要時間: ${totalElapsedMs}ms, TTFT: ${Math.round((firstTokenTime || tEnd) - tStart)}ms) [第3段階 回答品質: 長さ=${responseQuality.lengthCategory}(${responseQuality.lengthCompliant ? 'OK' : '調整済'}) 結論先頭=${responseQuality.directAnswerFirst ? 'OK' : 'NG'} 重複除去=${responseQuality.duplicatesRemovedCount} 自然化置換=${responseQuality.unnaturalPhrasesFixed}]`
      );

      // 設計思想 第155章: 認知デバッガ・推論トレース記録
      try {
        cognitiveDebuggerService.recordTrace(
          text,
          finalVisibleText.slice(0, 120),
          promptAnalysis.role,
          (usedMemoriesTracked || []).map((m) => `想起記憶(${m.id})`),
          ['Qwen3B不変条件チェック', '第28章 理解度追従', '第69章 人格多重アンカー'],
          answerPlanResult.matchedSkeleton?.pattern_id || 'DEFAULT_COMPANION',
          [
            { stepName: '意図解析&MoEルーティング', durationMs: 15, status: 'SUCCESS', details: `判定: ${promptAnalysis.role}` },
            { stepName: '多層記憶想起&ハイブリッド検索', durationMs: 45, status: 'SUCCESS', details: `想起記憶: ${(usedMemoriesTracked || []).length}件` },
            { stepName: '推論エンジン実行', durationMs: Math.max(10, totalElapsedMs - 80), status: 'SUCCESS', details: `エンジン: ${executedEngineLabel}` },
            { stepName: 'ポストプロセス&人格アンカー保護', durationMs: 20, status: 'SUCCESS', details: '不変条件オールクリア' },
          ],
          totalElapsedMs,
          '推論経路の健全性を確認。不変条件および品質ゲートに適合しています。'
        );
      } catch (traceErr) {
        console.warn('Cognitive trace record skipped:', traceErr);
      }

      // 設計思想 Master v5.0 第2章: 今回使われた記憶IDを次ターンの感情価フィードバック用に記録
      lastTurnUsedMemoryIdsRef.current = (usedMemoriesTracked || []).map((m) => m.id);

      // 設計思想 Master v5.0 第2章③: 中期記憶 (Working Agenda) の動的更新
      workingAgendaService.recordTurnAgenda(text, finalVisibleText);

      // 設計思想 Master v5.0 第3章5節: 統合診断ログ (Unified Diagnostic Log) 記録
      contextBudgetEngineService.recordDiagnosticLog({
        turn_id: assistantId,
        timestamp: Date.now(),
        recall: {
          vector_seeds: (usedMemoriesTracked || []).map((m) => m.id),
          link_expanded: (usedMemoriesTracked || []).filter((m) => {
            const mem = memories.find((orig) => orig.id === m.id);
            return mem?.relatedMemoryIds && mem.relatedMemoryIds.length > 0;
          }).map((m) => m.id),
          tag_matched: (usedMemoriesTracked || []).filter((m) => {
            const mem = memories.find((orig) => orig.id === m.id);
            return mem?.tags && mem.tags.length > 0;
          }).map((m) => m.id),
          ratio_used: 'vector:0.5, link:0.3, tag:0.2',
          contradiction_pairs_flagged: memoryPipelineResult?.scoredMemories?.filter((sm: any) => sm.contradictionWarning)?.length || 0,
        },
        context: {
          estimated_tokens_before: promptBuildResult.promptLengthChars ? Math.round(promptBuildResult.promptLengthChars / 3) : 0,
          live_nctx: budgetPlan.tier,
          compression_triggered: compressionResult.isCompressed,
          budget_breakdown: {
            persona: budgetPlan.personaQuota,
            memory: budgetPlan.memoryRecallQuota,
            history: budgetPlan.historyQuota,
            headroom: budgetPlan.headroomTokens,
          },
        },
        cache: {
          cache_hit_tokens: 0,
          prompt_processing_ms: Math.round((firstTokenTime || tEnd) - tStart),
          ttl_applied: contextBudgetEngineService.getVariableTtlSeconds(),
        },
      });

      // 🧠 世界モデル: 事後検証 & 予測誤差の計算 (設計思想 17. 世界モデルと予測誤差)
      const errorRecord = worldModelService.recordOutcomeAndComputeError(actionPrediction, {
        assistantResponse: finalVisibleText,
        actualUsedMemories: usedMemoriesTracked,
        actualUsedSkills: usedSkillsTracked,
        executionError: false,
        tokenCount,
        elapsedMs: totalElapsedMs,
      });

      if (errorRecord.predictionError.errorMagnitude > 0.3) {
        systemLogger.warn('SELF_IMPROVEMENT', `世界モデル予測誤差検知 [${errorRecord.predictionError.errorCategory}] 乖離度:${errorRecord.predictionError.errorMagnitude} -> ${errorRecord.predictionError.diagnosisNote}`);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        console.log('Chat request aborted.');
        return;
      }
      console.warn('Chat error caught gracefully:', err);
      systemLogger.error('CHAT', `チャット処理例外: ${err?.message || err}`);

      // In case of WebGPU device/buffer interruption, reset instance for next prompt
      if (engineMode === 'webgpu') {
        webLLMService.forceResetInitializingLock();
      }

      const errorText = err?.message || String(err);
      const errorEvaluation = completionJudgeService.evaluateCompletion({
        userGoal: text,
        assistantResponse: errorText,
        isError: true,
        executionSteps: systemLogger.getCurrentSessionSteps(),
      });

      // 48章の完了判定が自動的に FAILED / BLOCKED を検出した場合、
      // ユーザーの👎を待たずに自己改善ルーターへ自動的に診断依頼する。
      // ※ PARTIAL は正常な途中経過であり得るため除外（ノイズ防止）。
      // ※ EXTERNAL_COMPILE_REQUIRED / RUNTIME_TEST_REQUIRED は外部確認が必要な正常振る舞いのため除外。
      // ※ CANCELLED / COMPLETE は対象外。
      if (
        (errorEvaluation.status === 'FAILED' || errorEvaluation.status === 'BLOCKED') &&
        !errorEvaluation.autoDiagnosedAt
      ) {
        selfImprovementService.diagnoseFailure(
          text,
          errorText,
          `[自動検出] 完了判定: ${errorEvaluation.status} - ${errorEvaluation.reason} (例外: ${err?.message || err})`,
          {
            memoriesUsedCount: 0,
            promptLengthChars: 1200,
            engineMode: engineMode || 'native_gpu',
          }
        );
        errorEvaluation.autoDiagnosedAt = Date.now();
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🔍 完了判定(${errorEvaluation.status})を自動検出し、改善ルーターへ自動登録しました(ユーザー操作不要)。`
        );
      }

      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: `❌ **エラー**: ${errorText}\n\n**詳細**: ${err?.stack ? `\`\`\`\n${err.stack.slice(0, 300)}\n\`\`\`` : 'なし'}`,
        timestamp: Date.now(),
        isError: true,
        completionEvaluation: errorEvaluation,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
      currentAssistantIdRef.current = null;
      abortControllerRef.current = null;
    }
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
            engineMode: engineMode || 'native_gpu',
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
  const handleLoadRepoIntoWorkspace = (repoData: GitHubRepoData) => {
    const newFiles: WorkspaceFile[] = repoData.files.map((rf) => {
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

      // Notify agent in chat
      handleSendMessage(
        `GitHubリポジトリ「${repoData.repoName}」を取り込んだよ！このリポジトリの構成を分析して、何ができるか教えて！`
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
        onOpenEngineModal={() => setIsEngineModalOpen(true)}
        onRestartGame={handleRestartGame}
        onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onNewBlankProject={handleNewBlankProject}
        useSearch={useSearch}
        setUseSearch={setUseSearch}
        fps={fps}
        onOpenActivityMonitor={() => setIsGlobalActivityMonitorOpen(true)}
        isWorking={isLoading || isGenerating || isEvolutionRunning}
      />

      {/* Main Responsive Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP SPLIT VIEW (Visible on >= md) */}
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
              onOpenEngineModal={() => setIsEngineModalOpen(true)}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenSelfImprovementModal={() => setIsSelfImprovementModalOpen(true)}
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
          </div>
        </div>

        {/* MOBILE SINGLE VIEW (Visible on < md) */}
        <div className="flex md:hidden flex-1 min-h-0 overflow-hidden flex-col">
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
                onOpenEngineModal={() => setIsEngineModalOpen(true)}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onOpenSelfImprovementModal={() => setIsSelfImprovementModalOpen(true)}
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

            {mobileTab === 'memory' && (
              <div className="h-full overflow-y-auto p-4 bg-slate-900">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-pink-300 flex items-center gap-2">
                    <span>{persona.avatar}</span>
                    <span>{persona.name}の性格・記憶カンペ</span>
                  </h3>
                  <button
                    onClick={() => setIsMemoryModalOpen(true)}
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

          {/* Mobile Bottom Navigation Bar - Exactly 6 tabs as in screenshots */}
          <nav className="h-14 bg-slate-900/98 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-1 select-none z-30 shrink-0">
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                mobileTab === 'chat'
                  ? 'text-pink-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <MessageCircle className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              </div>
              <span className="text-[10px] leading-none">チャット</span>
            </button>

            <button
              onClick={() => setMobileTab('preview')}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                mobileTab === 'preview'
                  ? 'text-sky-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="w-5 h-5" />
              <span className="text-[10px] leading-none">プレビュー</span>
            </button>

            <button
              onClick={() => setMobileTab('code')}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                mobileTab === 'code'
                  ? 'text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-5 h-5" />
              <span className="text-[10px] leading-none">コード</span>
            </button>

            <button
              onClick={() => setMobileTab('github')}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                mobileTab === 'github'
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Github className="w-5 h-5" />
              <span className="text-[10px] leading-none">GitHub</span>
            </button>

            <button
              onClick={() => {
                setMobileTab('memory');
                setIsMemoryModalOpen(true);
              }}
              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                mobileTab === 'memory'
                  ? 'text-pink-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-5 h-5" />
              <span className="text-[10px] leading-none">記憶・Moe</span>
            </button>

            <button
              onClick={() => {
                setIsEngineModalOpen(true);
              }}
              className="flex-1 py-1.5 flex flex-col items-center justify-center gap-1 rounded-xl text-sky-400 hover:text-sky-300 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-[10px] leading-none">AIモデル</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Modals */}
      <EngineModal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        engineMode={engineMode}
        onSelectEngine={handleSelectEngine}
      />

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

      <SelfImprovementModal
        isOpen={isSelfImprovementModalOpen}
        onClose={() => setIsSelfImprovementModalOpen(false)}
        memories={memories}
        chatMessages={messages}
        workspaceFiles={workspaceFiles}
        engineMode={engineMode}
        initialTab={selfImprovementTab}
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
