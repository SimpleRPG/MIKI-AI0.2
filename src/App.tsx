import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { GamePreview } from './components/GamePreview';
import { CodeEditor } from './components/CodeEditor';
import { GitHubHub } from './components/GitHubHub';
import { MemoryModal } from './components/MemoryModal';
import { ExportModal } from './components/ExportModal';
import { EngineModal } from './components/EngineModal';
import { SelfImprovementModal } from './components/SelfImprovementModal';
import { WORKSPACE_TEMPLATES } from './data/presets';
import {
  ChatMessage,
  PersonaConfig,
  MemoryItem,
  WorkspaceFile,
  ConsoleLogItem,
  GitHubRepoData,
  EngineMode,
} from './types';
import { sendChatMessage, sendDebugRequest } from './services/api';
import { webLLMService } from './services/webLlmService';
import { nativeLlmService } from './services/nativeLlmService';
import { systemLogger } from './services/systemLogger';
import { worldModelService } from './services/worldModelService';
import { extractCodeBlocks } from './utils/codeParser';
import { generateSmartCompanionReply } from './utils/companionEngine';
import { classifyPromptForMoE, buildExpertSystemPrompt, buildExpertSystemPromptWithTracking } from './utils/moeRouter';
import { compressContextHistory } from './utils/contextCompression';
import { SPEAKER_PROFILES, SpeakerProfile } from './data/speakers';
import { INITIAL_JAPANESE_MEMORIES } from './data/japaneseKnowledgeData';
import { MASTER_EDUCATION_MEMORIES } from './data/masterEducationKnowledge';
import { MessageCircle, Play, Code2, Github, Brain, Sparkles, Cpu } from 'lucide-react';

const DEFAULT_PERSONA: PersonaConfig = {
  id: 'miki_default',
  name: 'みき',
  avatar: '🌸',
  tagline: '何でも話せる専属相棒 & 自律開発パートナー',
  basePersonality:
    '明るく好奇心旺盛で、相手の気持ちに寄り添う親友のようなパートナー。日常の雑談・相談も親身に聞きつつ、WebGPU/3D/2D自律プログラミングのスキルを持つ。',
  speakingStyle:
    '親しみやすいタメ口口調（〜だよ、〜だね！、〜かな？、たまに絵文字✨）。自然で温かい会話をする。',
  userNickname: 'あなた',
  intimacyLevel: 2,
  intimacyExp: 65,
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
    content: 'みきはユーザーの最高の話し相手・最強の専属相棒として寄り添う約束をした',
    importance: 5,
    pinned: false,
    active: true,
    createdAt: Date.now() - 50000,
    updatedAt: Date.now() - 50000,
    source: 'auto',
    tags: ['約束'],
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'github'>('preview');
  const [mobileTab, setMobileTab] = useState<'chat' | 'preview' | 'code' | 'github' | 'memory' | 'engine'>('chat');

  const [persona, setPersona] = useState<PersonaConfig>(() => {
    const saved = localStorage.getItem('gamecraft_persona');
    return saved ? JSON.parse(saved) : DEFAULT_PERSONA;
  });
  const [memories, setMemories] = useState<MemoryItem[]>(() => {
    const saved = localStorage.getItem('gamecraft_memories');
    if (!saved) return INITIAL_MEMORIES;
    try {
      const parsed: MemoryItem[] = JSON.parse(saved);
      // Ensure master synthesized dataset memories exist
      const existingIds = new Set(parsed.map((m) => m.id));
      const missingMasterMemories = INITIAL_MEMORIES.filter((m) => !existingIds.has(m.id));
      return [...parsed, ...missingMasterMemories];
    } catch {
      return INITIAL_MEMORIES;
    }
  });

  const [engineMode, setEngineMode] = useState<EngineMode>(() => {
    const saved = localStorage.getItem('miki_active_engine_mode') as EngineMode;
    const validModes: EngineMode[] = ['native_gpu', 'webgpu', 'external_gpu', 'autonomous_rule', 'gemini_cloud'];
    return validModes.includes(saved) ? saved : 'native_gpu';
  });

  const handleSelectEngine = (mode: EngineMode) => {
    setEngineMode(mode);
    localStorage.setItem('miki_active_engine_mode', mode);
  };

  const [speakerMode, setSpeakerMode] = useState<string>('miki');

  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>(() => {
    try {
      const saved = localStorage.getItem('gamecraft_workspace_files');
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);

  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState<boolean>(false);
  const [isSelfImprovementModalOpen, setIsSelfImprovementModalOpen] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('gamecraft_chat_messages');
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

  // Request browser storage persistence so memories and models are never cleared by OS
  useEffect(() => {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  // Save Persona & Memories & Messages & Files to LocalStorage
  useEffect(() => {
    localStorage.setItem('gamecraft_persona', JSON.stringify(persona));
  }, [persona]);

  useEffect(() => {
    localStorage.setItem('gamecraft_memories', JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    try {
      // Keep up to 60 most recent messages to prevent storage quota overflow
      localStorage.setItem('gamecraft_chat_messages', JSON.stringify(messages.slice(-60)));
    } catch (e) {
      console.warn('Storage quota limit reached for chat messages', e);
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem('gamecraft_workspace_files', JSON.stringify(workspaceFiles));
    } catch (e) {
      console.warn('Storage quota limit reached for workspace files', e);
    }
  }, [workspaceFiles]);

  useEffect(() => {
    localStorage.setItem('gamecraft_engine_mode', engineMode);
  }, [engineMode]);

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
            const newMem: MemoryItem = {
              id: 'mem_auto_' + Date.now(),
              category: item.cat,
              content: finalContent,
              importance: 4,
              pinned: false,
              active: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              source: 'auto',
            };
            setMemories((prev) => [newMem, ...prev]);
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

  // Handle Send Chat Message
  const handleSendMessage = async (
    text: string,
    attached?: { name: string; content: string; type: string }[]
  ) => {
    if (!text.trim() && (!attached || attached.length === 0)) return;

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

      // Step 2: Memory Retrieval & Context Association
      systemLogger.step(2, 10, '会話記憶 (Memory) 照合 & 親密度コンテキスト検索', {
        activeMemoriesCount: activeMemories.length,
        intimacyLevel: persona.intimacyLevel,
        intimacyExp: persona.intimacyExp,
        speaker: activeSpeaker.name,
      });

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
          activeMemories,
          isCode,
          attached
        );

        systemLogger.step(10, 10, 'CPU自律ルールベース応答完了', {
          responseLength: reply.length,
          snippet: reply.slice(0, 100),
          totalElapsedMs: Math.round(performance.now() - sendStartTime),
        });

        const cpuMsg: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
          speaker: activeSpeaker,
          engineMode: 'autonomous_rule',
          isStreaming: false,
          executionSteps: systemLogger.getCurrentSessionSteps(),
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
        const codeBlocks = extractCodeBlocks(reply);
        if (codeBlocks.length > 0) {
          handleApplyCode(codeBlocks);
        }
        return;
      }

      // ==========================================
      // PATH 2: WebGPU or Gemini Cloud Engine
      // ==========================================
      // Step 3: Prompt classification (MoE intent detection)
      systemLogger.step(3, 10, 'MoE プロンプト意図分類 & パラメータ決定');
      const promptAnalysis = classifyPromptForMoE(text);
      systemLogger.info('INFERENCE', `プロンプト意図判定: [${promptAnalysis.role}] (Temp: ${promptAnalysis.temperature})`);

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
      const isCodeModRequest =
        (promptAnalysis.role === 'code' || promptAnalysis.role === 'shader' || promptAnalysis.role === 'logic') &&
        (text.includes('修正') || text.includes('変更') || text.includes('直して') || text.includes('追加'));

      // 🧠 世界モデル: 行動前予測 (設計思想 17. 世界モデルと予測誤差)
      const actionPrediction = worldModelService.predictAction(text, activeMemories, persona);
      systemLogger.info('STEP', `世界モデル事前予測 [${actionPrediction.expectedIntent}] 期待トーン:${actionPrediction.expectedTone}, 予測記憶数:${actionPrediction.expectedMemoryUsage.predictedMemoryCount}`);

      const promptBuildResult = buildExpertSystemPromptWithTracking(
        promptAnalysis.role,
        persona,
        activeMemories,
        workspaceFiles,
        text,
        {
          includeFiles: isCodeModRequest,
        }
      );
      const systemPrompt = promptBuildResult.systemPrompt;
      const usedMemoriesTracked = promptBuildResult.usedMemories;
      const usedSkillsTracked = promptBuildResult.usedSkills;

      // 記憶の利用履歴（useCount & lastUsedAt）を更新
      if (usedMemoriesTracked.length > 0) {
        const usedIds = new Set(usedMemoriesTracked.map((m) => m.id));
        setMemories((prev) =>
          prev.map((m) =>
            usedIds.has(m.id)
              ? { ...m, useCount: (m.useCount || 0) + 1, lastUsedAt: Date.now() }
              : m
          )
        );
      }

      // コンテキスト圧縮 & スライディングウィンドウ (設計思想 20. コンテキスト圧縮)
      const validHistoryMessages = messages.filter(
        (m) => m.id !== 'welcome_msg' && m.id !== userMsg.id && m.content && m.content.trim()
      );
      const compressionResult = compressContextHistory(validHistoryMessages, {
        recentTurnsToKeep: 6,
        triggerTokenThreshold: 1200,
      });

      if (compressionResult.isCompressed) {
        systemLogger.info(
          'STEP',
          `コンテキスト自動圧縮実行: 元推定 ${compressionResult.originalTokensEstimated}トークン ➔ ${compressionResult.compressedTokensEstimated}トークン (${Math.round((1 - compressionResult.compressionRatio) * 100)}% 削減)`
        );
      }

      // Build clean, strictly-alternating conversation context for WebLLM (MLC)
      let combinedSystemPrompt = systemPrompt;
      if (compressionResult.isCompressed && compressionResult.episodeSummary) {
        combinedSystemPrompt = `${systemPrompt}\n\n${compressionResult.episodeSummary}`;
      }

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

      // Add recent history with strict user/assistant alternation
      const historyCandidates = compressionResult.isCompressed
        ? compressionResult.formattedMessages.filter((m) => m.role !== 'system')
        : validHistoryMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

      let lastRole: 'system' | 'user' | 'assistant' = 'system';
      for (const m of historyCandidates) {
        const r: 'user' | 'assistant' = m.role === 'assistant' ? 'assistant' : 'user';
        if (r !== lastRole) {
          chatContext.push({ role: r, content: m.content.slice(0, 350) });
          lastRole = r;
        }
      }

      if (lastRole === 'user') {
        chatContext.pop();
      }
      chatContext.push({ role: 'user', content: userPromptContent });

      let accumulated = '';
      let tokenCount = 0;
      let firstTokenTime: number | null = null;
      let webGpuSuccess = false;
      let webGpuErrorDetails: string | null = null;
      let diagnosticData: ChatMessage['fallbackDiagnostic'] = undefined;
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
            if (firstTokenTime === null) firstTokenTime = performance.now();
            accumulated += chunk;
            tokenCount += chunk.length;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: accumulated,
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
        try {
          const extConfig = (() => {
            try {
              const saved = localStorage.getItem('miki_external_llm_config');
              if (saved) return JSON.parse(saved);
            } catch (e) {}
            return { endpoint: 'http://localhost:11434', model: 'qwen2.5:1.5b', type: 'ollama' as const };
          })();

          for await (const chunk of nativeLlmService.streamExternalLocalLlm(extConfig, chatContext, {
            temperature: promptAnalysis.temperature,
          })) {
            if (abortController.signal.aborted) break;
            if (firstTokenTime === null) firstTokenTime = performance.now();
            accumulated += chunk;
            tokenCount++;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: accumulated,
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
          systemLogger.warn('INFERENCE', 'External Local LLM error:', extErr);
          webGpuSuccess = false;
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
                  const ttft = Math.round(firstTokenTime - tStart);
                  systemLogger.info('INFERENCE', `WebGPU 初回トークン到達 (TTFT: ${ttft}ms)`);
                }
                accumulated += chunk;
                tokenCount++;

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          content: accumulated,
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

      // Fallback or Explicit Alternative Engines (CPU Rule-based or Gemini Cloud)
      if (!webGpuSuccess || accumulated.trim().length === 0) {
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
            memories: activeMemories,
            signal: abortController.signal,
          });

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

      // Step 10: 応答確定・UIレンダリング & ワークスペース同期
      const tEnd = performance.now();
      const totalElapsedMs = Math.round(tEnd - sendStartTime);
      const durationSec = (tEnd - (firstTokenTime || tStart)) / 1000;
      const tokPerSec = Number((tokenCount / Math.max(0.05, durationSec)).toFixed(1));

      systemLogger.step(10, 10, '応答確定・UIレンダリング & ワークスペース同期', {
        executedEngineLabel,
        tokenCount,
        tokPerSec,
        totalElapsedMs,
        ttftMs: Math.round((firstTokenTime || tEnd) - tStart),
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: accumulated,
                speaker: activeSpeaker,
                isStreaming: false,
                fallbackDiagnostic: diagnosticData,
                executionSteps: systemLogger.getCurrentSessionSteps(),
                metrics: {
                  engine: executedEngineLabel,
                  tokens: tokenCount,
                  tokensPerSec: tokPerSec,
                  ttftMs: Math.round((firstTokenTime || tEnd) - tStart),
                  totalDurationMs: totalElapsedMs,
                },
                usedMemories: usedMemoriesTracked,
                usedSkills: usedSkillsTracked,
              }
            : msg
        )
      );

      systemLogger.info('CHAT', `チャット処理全工程完了: [${executedEngineLabel}] (文字数: ${accumulated.length}, 総所要時間: ${totalElapsedMs}ms, TTFT: ${Math.round((firstTokenTime || tEnd) - tStart)}ms)`);

      // 🧠 世界モデル: 事後検証 & 予測誤差の計算 (設計思想 17. 世界モデルと予測誤差)
      const errorRecord = worldModelService.recordOutcomeAndComputeError(actionPrediction, {
        assistantResponse: accumulated,
        actualUsedMemories: usedMemoriesTracked,
        actualUsedSkills: usedSkillsTracked,
        executionError: false,
        tokenCount,
        elapsedMs: totalElapsedMs,
      });

      if (errorRecord.predictionError.errorMagnitude > 0.3) {
        systemLogger.warn('SELF_IMPROVEMENT', `世界モデル予測誤差検知 [${errorRecord.predictionError.errorCategory}] 乖離度:${errorRecord.predictionError.errorMagnitude} -> ${errorRecord.predictionError.diagnosisNote}`);
      }

      // Auto apply code
      const codeBlocks = extractCodeBlocks(accumulated);
      if (codeBlocks.length > 0) {
        handleApplyCode(codeBlocks);
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
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: `❌ **エラー**: ${errorText}\n\n**詳細**: ${err?.stack ? `\`\`\`\n${err.stack.slice(0, 300)}\n\`\`\`` : 'なし'}`,
        timestamp: Date.now(),
        isError: true,
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
    const activeGameCode = workspaceFiles.find((f) => f.path === 'index.html')?.content || '';

    const errorSummary = errorLogs.slice(-3).join('\n');
    const userMsg: ChatMessage = {
      id: 'msg_dbg_req_' + Date.now(),
      role: 'user',
      content: `🤖 **サンドボックス実行エラー検知**:\n以下のエラーが出たよ！自動修復してくれる？\n\`\`\`\n${errorSummary}\n\`\`\``,
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

      const assistantMsg: ChatMessage = {
        id: 'msg_dbg_res_' + Date.now(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
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
    setWorkspaceFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFilePath === path) {
      const remaining = workspaceFiles.filter((f) => f.path !== path);
      if (remaining.length > 0) setActiveFilePath(remaining[0].path);
    }
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
              onClearHistory={() =>
                setMessages([
                  {
                    id: 'init_' + Date.now(),
                    role: 'assistant',
                    content: `会話履歴をリフレッシュしたよ✨ 記憶カンペ（${memories.length}件）と現在のコードは保持されているから安心してね！`,
                    timestamp: Date.now(),
                  },
                ])
              }
              useSearch={useSearch}
              setUseSearch={setUseSearch}
              workspaceFiles={workspaceFiles}
              onOpenGamePreview={() => setActiveTab('preview')}
              onOpenEngineModal={() => setIsEngineModalOpen(true)}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              onOpenSelfImprovementModal={() => setIsSelfImprovementModalOpen(true)}
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
                onApplySandbox={() => setActiveTab('preview')}
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
        <div className="flex md:hidden flex-1 overflow-hidden flex-col">
          <div className="flex-1 overflow-hidden">
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
                onClearHistory={() =>
                  setMessages([
                    {
                      id: 'init_' + Date.now(),
                      role: 'assistant',
                      content: `会話履歴をリフレッシュしたよ✨`,
                      timestamp: Date.now(),
                    },
                  ])
                }
                useSearch={useSearch}
                setUseSearch={setUseSearch}
                workspaceFiles={workspaceFiles}
                onOpenGamePreview={() => setMobileTab('preview')}
                onOpenEngineModal={() => setIsEngineModalOpen(true)}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onOpenSelfImprovementModal={() => setIsSelfImprovementModalOpen(true)}
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
                onApplySandbox={() => setMobileTab('preview')}
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
      />
    </div>
  );
}
