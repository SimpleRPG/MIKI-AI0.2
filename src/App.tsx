import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { GamePreview } from './components/GamePreview';
import { CodeEditor } from './components/CodeEditor';
import { GitHubHub } from './components/GitHubHub';
import { MemoryModal } from './components/MemoryModal';
import { ExportModal } from './components/ExportModal';
import { EngineModal } from './components/EngineModal';
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
import { extractCodeBlocks } from './utils/codeParser';
import { classifyPromptForMoE, buildExpertSystemPrompt } from './utils/moeRouter';
import { generateCouncilDeliberation } from './utils/councilEngine';
import { SPEAKER_PROFILES, SpeakerProfile } from './data/speakers';
import { MessageCircle, Play, Code2, Github, Brain, Sparkles, Cpu } from 'lucide-react';

const DEFAULT_PERSONA: PersonaConfig = {
  id: 'miki_default',
  name: 'みき',
  avatar: '🌸',
  tagline: '何でも話せる最高の相棒 & MoE自律開発アーキテクト',
  basePersonality:
    '明るく好奇心旺盛で、相手の気持ちに寄り添う親友のようなパートナー。日常の雑談・相談も親身に聞きつつ、MoE (Mixture of Experts)・Gemini 3.7・WebGPU/3D/2D自律プログラミングの超絶スキルを持つ。',
  speakingStyle:
    '親しみやすいタメ口口調（〜だよ、〜だね！、〜かな？、たまに絵文字✨）。自然で温かい会話をする。',
  userNickname: 'あなた',
  intimacyLevel: 2,
  intimacyExp: 65,
  autoExtractMemories: true,
  moeStyle: 'default',
};

const INITIAL_MEMORIES: MemoryItem[] = [
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
    content: 'ユーザーはAIとの自然な雑談やMoe要素、WebGPUオンデバイス推論、自由な開発・GitHub連携を求めている',
    importance: 5,
    pinned: true,
    active: true,
    createdAt: Date.now() - 80000,
    updatedAt: Date.now() - 80000,
    source: 'manual',
    tags: ['MoE', 'WebGPU', 'OnDevice', '雑談'],
  },
  {
    id: 'mem_3',
    category: 'relationship',
    content: 'みきはユーザーの最高の話し相手・最強の自律型MoE相棒として寄り添う約束をした',
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
    return saved ? JSON.parse(saved) : INITIAL_MEMORIES;
  });

  const [engineMode, setEngineMode] = useState<EngineMode>(() => {
    const saved = localStorage.getItem('gamecraft_engine_mode');
    return (saved as EngineMode) || 'webgpu';
  });

  const [speakerMode, setSpeakerMode] = useState<string>('council');

  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>(WORKSPACE_TEMPLATES[0].files);
  const [activeFilePath, setActiveFilePath] = useState<string>(WORKSPACE_TEMPLATES[0].files[0].path);

  const [useSearch, setUseSearch] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDebugging, setIsDebugging] = useState<boolean>(false);

  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      role: 'assistant',
      content: `やっほー！来てくれてありがとう✨\nユーザー専属AIパートナーの「みき」だよ！🌸\n\nこのAIスタジオは**100% 端末オンデバイス WebGPU & ローカル推論**で動作しているから、クラウドAPIの通信やトークン制限なしで完全自由に開発・対話できるよ！🚀\n\n・✨ **オンデバイス MoE (Mixture of Experts)**: プロンプトの内容に応じてCode・GPU・Logic・対話の専門エキスパートが端末内で自動協調！\n・💻 **WebGPU & ハードウェアアクセラレーション**: 端末のGPU演算やWGSLシェーダーパイプラインをローカルで高速最適化。\n・💬 **日常のおしゃべり＆人生相談**: 雑談や愚痴、嬉しいこともいつでも話してね💕\n・🐙 **GitHub連携**: 作ったコードはいつでもGitHubリポジトリに直接プッシュ可能！\n・📦 **ZIPダウンロード**: 作成したアプリ・ゲーム一式をいつでもワンクリックで保存！\n\n今どんなものを作りたい？それとも今日あったことお話しする？😊✨`,
      timestamp: Date.now(),
      engineMode: 'webgpu',
      moeRoute: {
        primaryExpert: 'Code Architect Expert',
        activeExperts: [
          { id: 'expert-code', name: 'Code Architect Expert', weight: 45, color: '#38bdf8', icon: '💻' },
          { id: 'expert-companion', name: 'Companion Moe', weight: 35, color: '#f43f5e', icon: '🌸' },
          { id: 'expert-gpu', name: 'GPU Shader Expert', weight: 20, color: '#a855f7', icon: '⚡' },
        ],
        routingReason: 'On-Device WebGPU & Multi-Agent Architecture Initialized',
        computeLatencyMs: 15,
      },
    },
  ]);

  // Save Persona & Memories to LocalStorage
  useEffect(() => {
    localStorage.setItem('gamecraft_persona', JSON.stringify(persona));
  }, [persona]);

  useEffect(() => {
    localStorage.setItem('gamecraft_memories', JSON.stringify(memories));
  }, [memories]);

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

  // Handle Send Chat Message
  const handleSendMessage = async (
    text: string,
    attached?: { name: string; content: string; type: string }[]
  ) => {
    if (!text.trim() && (!attached || attached.length === 0)) return;

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
    setIsLoading(true);

    try {
      const activeMemories = memories.filter((m) => m.active);
      const activeGameCode = workspaceFiles.find((f) => f.path === 'index.html')?.content || '';
      const cachedModelsList = await webLLMService.listAllCachedModels().catch(() => []);

      const activeSpeaker = SPEAKER_PROFILES[speakerMode] || SPEAKER_PROFILES.council || SPEAKER_PROFILES.miki;
      const isLocalPreferred = localStorage.getItem('miki_use_local_in_moe') !== 'false';
      const shouldRunLocal = engineMode === 'webgpu' || engineMode === 'moe' || (isLocalPreferred && webLLMService.isLoaded());

      // MoE Prompt Classification & Expert Specialization
      const moeAnalysis = classifyPromptForMoE(text);

      // If local WebGPU execution is requested or active
      if (shouldRunLocal) {
        const gpuCheck = await webLLMService.isWebGPUSupported();

        if (!gpuCheck.supported) {
          const assistantId = 'msg_asst_' + Date.now();
          const zeroTokenNoticeMsg: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: `⚠️ **WebGPU がブラウザで検出されませんでした**\n\n【トークン消費ゼロ保護】\nクラウドトークンを意図せず消費しないよう、クラウドAPIへの自動切り替えを停止しました。\n\n・ChromeやEdgeの「設定 > システム > ハードウェアアクセラレーション」が有効になっているかご確認ください。\n・AIモデル設定画面からWebGPU対応状況をご確認いただけます。`,
            timestamp: Date.now(),
            speaker: activeSpeaker,
            engineMode: 'webgpu',
            moeRoute: moeAnalysis.route,
            metrics: {
              engine: 'WebGPU (Zero Cloud Tokens Policy)',
            },
          };
          setMessages((prev) => [...prev, zeroTokenNoticeMsg]);
          setIsLoading(false);
          return;
        }

        // Priority 1: If an engine is already loaded in VRAM, use it directly to prevent reload latency/failures!
        const targetModelId = (webLLMService.isLoaded() && webLLMService.getActiveModelId())
          ? webLLMService.getActiveModelId()!
          : await webLLMService.findBestAvailableModel(moeAnalysis.role);

        const assistantId = 'msg_asst_' + Date.now();
        const placeholderMsg: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: webLLMService.isLoaded()
            ? `⚡ 端末 MoE (${activeSpeaker.name}) オンデバイス推論中...`
            : `🔄 端末内モデル (${targetModelId.split('-')[0]}) をロード中... (トークン消費: 0)`,
          timestamp: Date.now(),
          speaker: activeSpeaker,
          engineMode: engineMode === 'moe' ? 'moe' : 'webgpu',
          moeRoute: moeAnalysis.route,
          isStreaming: true,
          metrics: {
            engine: `On-Device MoE (${targetModelId.split('-')[0]})`,
          },
        };
        setMessages((prev) => [...prev, placeholderMsg]);
        setIsLoading(false); // Hide the bottom loading indicator since placeholderMsg is active

        // Check if model is cached before attempting VRAM load
        const isTargetCached = await webLLMService.isModelCached(targetModelId);
        let isModelReady = webLLMService.isModelLoaded(targetModelId);

        // Always proceed to load/download if not yet ready
        if (!isModelReady) {
          try {
            await webLLMService.loadModel(targetModelId, (report) => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        content: isTargetCached
                          ? `🔄 モデル初期化中: ${report.text} (${report.progress}%)`
                          : `📥 モデルダウンロード＆初期化中: ${report.text} (${report.progress}%)`,
                      }
                    : msg
                )
              );
            });
            isModelReady = webLLMService.isModelLoaded(targetModelId);
          } catch (loadErr: any) {
            console.warn('WebGPU Model download/load failed:', loadErr);
            isModelReady = false;
          }
        }

        const tStart = performance.now();
        const isCodeModRequest =
          (moeAnalysis.role === 'code' || moeAnalysis.role === 'shader' || moeAnalysis.role === 'logic') &&
          (text.includes('修正') || text.includes('変更') || text.includes('直して') || text.includes('追加'));

        const systemPrompt = buildExpertSystemPrompt(
          moeAnalysis.role,
          persona,
          activeMemories,
          workspaceFiles,
          { includeFiles: isCodeModRequest }
        );

        // Build clean, strictly-alternating conversation context for WebLLM (MLC)
        const chatContext: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt },
        ];

        let userPromptContent = text;
        if (attached && attached.length > 0) {
          const attachedDesc = attached
            .map((a) => `[添付: ${a.name} (${a.type})]\n${(a.content || '').slice(0, 600)}`)
            .join('\n\n');
          userPromptContent = `${attachedDesc}\n\n${text}`;
        }

        // Add recent history with strict user/assistant alternation to prevent MLC template parse errors
        const historyCandidates = messages
          .filter((m) => m.id !== 'welcome_msg' && m.id !== userMsg.id && m.content && m.content.trim())
          .slice(-4);

        let lastRole: 'system' | 'user' | 'assistant' = 'system';
        for (const m of historyCandidates) {
          const r: 'user' | 'assistant' = m.role === 'assistant' ? 'assistant' : 'user';
          if (r !== lastRole) {
            chatContext.push({ role: r, content: m.content.slice(0, 250) });
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

        if (isModelReady) {
          try {
            for await (const chunk of webLLMService.streamChat(chatContext, {
              temperature: moeAnalysis.temperature,
              max_tokens: 384,
              fallbackModelId: targetModelId,
            })) {
              if (firstTokenTime === null) {
                firstTokenTime = performance.now();
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
                      }
                    : msg
                )
              );
            }
            webGpuSuccess = accumulated.trim().length > 0;
          } catch (gpuErr: any) {
            webGpuErrorDetails = gpuErr?.message || String(gpuErr);
            console.error('WebGPU execution error caught:', gpuErr);
            webGpuSuccess = false;
          }
        } else {
          webGpuErrorDetails = isTargetCached
            ? 'モデルのVRAMロード待機中'
            : 'モデル未ダウンロード (端末ローカルLLM設定でダウンロード可能)';
        }

        // If WebGPU encountered an error or model not cached, smoothly fallback to high-speed hybrid engine
        if (!webGpuSuccess || accumulated.trim().length === 0) {
          try {
            const fallbackRes = await sendChatMessage({
              prompt: text,
              history: messages,
              useSearch: false,
              engineMode: 'moe',
              speakerMode,
              cachedModels: cachedModelsList,
              workspaceFiles,
              attachedFiles: attached,
              persona,
              memories: activeMemories,
            });

            let diagnosticCategory = 'ハイブリッド自動切替';
            let diagnosticCause = '端末モデル未ロードのため、高速ハイブリッド推論で即座に返信しました。';
            let diagnosticTip = '完全オフライン推論を行う場合は「端末ローカルLLM設定」からモデルをダウンロードしてください。';

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

            accumulated = fallbackRes.text || '返答の生成が完了しました！';
            tokenCount = Math.round(accumulated.length / 3);
            firstTokenTime = performance.now();
          } catch (apiErr: any) {
            console.error('Fallback chat API error:', apiErr);
            accumulated = `⚠️ 応答生成中にエラーが発生しました:\n・API詳細: ${apiErr.message || '接続エラー'}`;
          }
        }

        const tEnd = performance.now();
        const durationSec = (tEnd - (firstTokenTime || tStart)) / 1000;
        const tokPerSec = Number((tokenCount / Math.max(0.05, durationSec)).toFixed(1));

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: accumulated,
                  speaker: activeSpeaker,
                  isStreaming: false,
                  moeRoute: moeAnalysis.route,
                  fallbackDiagnostic: diagnosticData,
                  metrics: {
                    engine: webGpuSuccess
                      ? `On-Device WebGPU (${targetModelId.split('-')[0]})`
                      : `ハイブリッド合議知能 (${activeSpeaker.name})`,
                    tokens: tokenCount,
                    tokensPerSec: tokPerSec,
                    ttftMs: Math.round((firstTokenTime || tEnd) - tStart),
                  },
                }
              : msg
          )
        );

        // Auto apply code
        const codeBlocks = extractCodeBlocks(accumulated);
        if (codeBlocks.length > 0) {
          handleApplyCode(codeBlocks);
        }
      } else {
        // Cloud / Unified Hybrid Backend
        const response = await sendChatMessage({
          prompt: text,
          history: messages,
          useSearch,
          engineMode,
          speakerMode,
          cachedModels: cachedModelsList,
          workspaceFiles,
          attachedFiles: attached,
          persona,
          memories: activeMemories,
          activeGameCode,
        });

        const assistantMsg: ChatMessage = {
          id: 'msg_asst_' + Date.now(),
          role: 'assistant',
          content: response.text,
          timestamp: Date.now(),
          speaker: activeSpeaker,
          engineMode: response.engineMode || engineMode,
          moeRoute: response.moeRoute || moeAnalysis.route,
          groundingChunks: response.groundingChunks,
          webSearchQueries: response.webSearchQueries,
          metrics: {
            engine: `合議型知能 (${activeSpeaker.name})`,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Automatically check and apply code if present
        const codeBlocks = extractCodeBlocks(response.text);
        if (codeBlocks.length > 0) {
          handleApplyCode(codeBlocks);
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);

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
    }
  };

  // AI Auto Debug
  const handleAutoDebug = async (errorLogs: string[]) => {
    setIsDebugging(true);
    const activeGameCode = workspaceFiles.find((f) => f.path === 'index.html')?.content || '';

    const userMsg: ChatMessage = {
      id: 'msg_dbg_req_' + Date.now(),
      role: 'user',
      content: `🤖 **AI自動修復リクエスト**:\nエラーを検知したよ！直してくれる？\n\`${errorLogs.join('\n')}\``,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await sendDebugRequest(
        errorLogs,
        activeGameCode,
        workspaceFiles
      );

      const assistantMsg: ChatMessage = {
        id: 'msg_dbg_res_' + Date.now(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        metrics: {
          engine: 'Gemini 3.7 Flash Auto-Debugger',
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);

      const codeBlocks = extractCodeBlocks(response.text);
      if (codeBlocks.length > 0) {
        handleApplyCode(codeBlocks);
      }
    } catch (err: any) {
      console.error(err);
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
              persona={persona}
              memories={memories}
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
                persona={persona}
                memories={memories}
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
        onSelectEngine={(mode) => {
          setEngineMode(mode);
        }}
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
    </div>
  );
}
