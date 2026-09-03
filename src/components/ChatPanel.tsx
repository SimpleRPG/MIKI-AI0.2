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
  ListTree,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Brain,
  Wrench,
  FlaskConical,
  Layers,
} from 'lucide-react';
import { ChatMessage, PersonaConfig, MemoryItem, WorkspaceFile, EngineMode } from '../types';
import { extractCodeBlocks } from '../utils/codeParser';
import { SPEAKER_PROFILES } from '../data/speakers';
import { systemLogger } from '../services/systemLogger';
import { selfImprovementService } from '../services/selfImprovementService';
import { skillsService } from '../services/skillsService';
import { TaskPlanCard } from './TaskPlanCard';
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
    systemLogger.info('CHAT', `[UIイベント] チャット送信トリガー発火 (文字数: ${textToSend.length}, 添付: ${attachedFiles.length}件, モード: ${engineMode})`, {
      textSnippet: textToSend.slice(0, 80),
      attachedFiles: attachedFiles.map((a) => ({ name: a.name, size: a.size })),
      speakerMode,
      engineMode,
    });

    onSendMessage(textToSend, attachedFiles.length > 0 ? attachedFiles : undefined);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
    setAttachedFiles([]);
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

    // 適用されたスキルの成功/失敗カウントを更新（候補スキル試験の判断材料）
    if (msg.usedSkills && msg.usedSkills.length > 0) {
      msg.usedSkills.forEach((s) => {
        skillsService.recordExecutionResult(s.id, type === 'good');
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
      } else {
        systemLogger.warn('SELF_IMPROVEMENT', 'ユーザー高評価(👍)を受信しましたが、コンテンツ安全境界フィルタにより教材登録から除外・ログ記録されました。');
      }
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

    setFeedbackFeedbackId(null);
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
          const zip = new JSZip();
          const zipData = await zip.loadAsync(file);
          const fileNames: string[] = [];
          const textExtracts: string[] = [];

          for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
            if (!zipEntry.dir) {
              fileNames.push(relativePath);
              // Extract preview of code/text files inside ZIP
              if (
                relativePath.endsWith('.html') ||
                relativePath.endsWith('.js') ||
                relativePath.endsWith('.ts') ||
                relativePath.endsWith('.tsx') ||
                relativePath.endsWith('.css') ||
                relativePath.endsWith('.json') ||
                relativePath.endsWith('.txt') ||
                relativePath.endsWith('.md')
              ) {
                try {
                  const text = await zipEntry.async('string');
                  if (textExtracts.length < 5) {
                    textExtracts.push(`--- ${relativePath} ---\n${text.slice(0, 1000)}`);
                  }
                } catch {
                  // ignore
                }
              }
            }
          }

          const summary = `ZIP アーカイブ内容 (${fileNames.length} ファイル):\n${fileNames.slice(0, 20).join('\n')}${fileNames.length > 20 ? `\n...他 ${fileNames.length - 20} 件` : ''}\n\n${textExtracts.join('\n\n')}`;

          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              content: summary,
              type: 'application/zip',
              size: file.size,
            },
          ]);
        } catch (zipErr) {
          console.warn('ZIP parse error:', zipErr);
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              content: `ZIP アーカイブ (${file.name}, ${Math.round(file.size / 1024)} KB)`,
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
      {/* Chat Header Subbar */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
          </span>
          <span className="font-semibold text-slate-300">相棒AI:</span>

          {/* Model / Personality Focus Selector */}
          <select
            value={speakerMode}
            onChange={(e) => setSpeakerMode(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-pink-300 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-pink-500 transition-colors"
          >
            <option value="miki">🌸 みき (通常・全対話)</option>
            <option value="qwen_coder">💻 みき (コード・開発モード)</option>
            <option value="deepseek_logic">🧩 みき (原因分析・ロジックモード)</option>
            <option value="gpu_shader">⚡ みき (WebGPU・シェーダーモード)</option>
          </select>

          <button
            onClick={onOpenEngineModal}
            className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors inline-flex items-center gap-1 border ${
              engineMode === 'webgpu'
                ? 'bg-purple-950/80 text-purple-300 hover:bg-purple-900 border-purple-500/50'
                : engineMode === 'gemini_cloud'
                ? 'bg-sky-950/80 text-sky-300 hover:bg-sky-900 border-sky-500/50'
                : 'bg-amber-950/80 text-amber-300 hover:bg-amber-900 border-amber-500/50'
            }`}
            title="推論エンジン設定（WebGPU / CPUルールベース / Gemini Cloud を選択）"
          >
            {engineMode === 'webgpu' ? (
              <>
                <Cpu className="w-2.5 h-2.5 text-purple-400" />
                <span>WebGPU (GPU推論)</span>
              </>
            ) : engineMode === 'gemini_cloud' ? (
              <>
                <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                <span>Gemini Cloud</span>
              </>
            ) : (
              <>
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                <span>CPUルールベース</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Self Improvement Lab Button */}
          {onOpenSelfImprovementModal && (
            <button
              onClick={onOpenSelfImprovementModal}
              className="px-2 py-1 rounded-lg border text-[10.5px] font-bold flex items-center gap-1 transition-all bg-purple-950/70 hover:bg-purple-900/90 text-purple-300 border-purple-500/40 shadow-sm"
              title="自己改善研究所 (失敗診断・スキルライブラリ・Colab LoRA学習教材・系統樹)"
            >
              <FlaskConical className="w-3 h-3 text-purple-400" />
              <span>自己改善</span>
            </button>
          )}

          {/* Public Share URL Copy Button */}
          <button
            onClick={handleCopyPublicUrl}
            className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold flex items-center gap-1 transition-all ${
              urlCopied
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800 text-sky-300 hover:text-sky-200 border-slate-700 hover:bg-slate-700'
            }`}
            title="スマホや外部ブラウザから誰でも直接開ける公開URL (ais-pre) をコピー"
          >
            <Share2 className="w-3 h-3" />
            <span>{urlCopied ? 'URLコピー完了!' : '公開URL'}</span>
          </button>

          <button
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              if (!voiceEnabled) speakText('音声読み上げをオンにしたよ！何でも話してね✨');
              else window.speechSynthesis?.cancel();
            }}
            className={`p-1.5 rounded-lg border transition-colors ${
              voiceEnabled
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="音声読み上げ (TTS)"
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearHistory}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
            title="会話履歴をクリア (記憶は保持)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
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

                {/* Fallback & WebGPU Status info bar */}
                {!isUser && msg.fallbackDiagnostic && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg text-[11px] text-amber-200">
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
                )}

                {/* Bubble */}
                <div
                  className={`p-3 sm:p-3.5 rounded-2xl text-xs sm:text-xs leading-relaxed break-words relative shadow-md ${
                    isUser
                      ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-tr-sm'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-sm'
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
                        <div key={idx} className="p-2 rounded-lg bg-black/40 border border-slate-800 text-[10.5px] space-y-1">
                          <div className="flex items-center justify-between font-mono text-emerald-400 font-bold">
                            <span>{t.toolName}</span>
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                              {t.permission}
                            </span>
                          </div>
                          <div className="text-slate-300 font-sans leading-relaxed">{t.outputSummary}</div>
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
                </div>

                {/* Message action buttons & Streaming Stop Button */}
                {!isUser && (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between px-1 text-[10px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => speakText(msg.content)}
                          className="hover:text-pink-400 flex items-center gap-1 transition-colors"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>音声</span>
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>コピー</span>
                        </button>

                        {/* Inline Feedback Rating (設計思想 24. 第1世代) */}
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleFeedback(msg, 'good')}
                            className={`p-1 rounded transition-all ${
                              msg.userFeedback === 'good'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : 'hover:text-emerald-400 text-slate-500'
                            }`}
                            title="役に立った (記憶スコア+ / LoRA教材に登録)"
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (msg.userFeedback === 'bad') {
                                handleFeedback(msg, 'bad');
                              } else {
                                setFeedbackFeedbackId(feedbackFeedbackId === msg.id ? null : msg.id);
                              }
                            }}
                            className={`p-1 rounded transition-all ${
                              msg.userFeedback === 'bad'
                                ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                : 'hover:text-rose-400 text-slate-500'
                            }`}
                            title="見当違い・改善が必要 (改善ルーターに送信)"
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {msg.isStreaming && onStopGeneration && (
                        <button
                          onClick={onStopGeneration}
                          className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-rose-100 rounded text-[10.5px] font-semibold transition-all shadow-sm active:scale-95"
                        >
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>生成を停止</span>
                        </button>
                      )}
                    </div>

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
              <div className="space-y-1 text-[10.5px] text-slate-400">
                <div className="flex items-center gap-1.5 text-pink-300">
                  <Heart className="w-3 h-3" />
                  <span>あなたとの会話＆記憶を読み込み中...</span>
                </div>
                {useSearch && (
                  <div className="flex items-center gap-1.5 text-emerald-400 animate-pulse">
                    <Search className="w-3 h-3" />
                    <span>Google Search で最新情報を検索中...</span>
                  </div>
                )}
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
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          accept=".html,.js,.ts,.json,.css,.txt,.md,.png,.jpg,.jpeg,.svg,.glsl,.wgsl"
        />

        <div className="flex items-end gap-1.5 sm:gap-2 bg-slate-950 border border-slate-700/80 focus-within:border-pink-500/80 rounded-xl p-1 sm:p-1.5 transition-colors shadow-inner">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-pink-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
            title="画像・ファイル・コードを添付"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setUseSearch(!useSearch)}
            className={`p-2 rounded-lg transition-colors shrink-0 ${
              useSearch
                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
            placeholder={`${persona.name}に指示（端末WebGPU・トークン消費0・ゲーム制作や雑談など）`}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-xs text-slate-100 placeholder-slate-500 resize-none py-2 px-1 leading-relaxed max-h-24"
          />

          {isLoading || isGenerating ? (
            <button
              type="button"
              onClick={handleSafeStop}
              className="px-3 py-2 min-h-[40px] rounded-lg flex items-center gap-1.5 font-bold transition-all shrink-0 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-md shadow-rose-600/30 animate-pulse active:scale-95 cursor-pointer touch-manipulation"
              title="生成を中断する"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="text-xs">停止</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              className="p-2 sm:p-2.5 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center font-bold transition-all shrink-0 cursor-pointer touch-manipulation bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 active:scale-90 text-white shadow-md shadow-pink-500/30 ring-1 ring-white/20"
              title="メッセージを送信"
              aria-label="送信"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Zero Cloud Token Guarantee Bar */}
        <div className="mt-1.5 px-1 flex items-center justify-between text-[10.5px] text-slate-400 select-none">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-semibold">端末ローカルWebGPU実行中（クラウドトークン消費: 0 / 完全無料）</span>
          </div>
          {onOpenEngineModal && (
            <button
              onClick={onOpenEngineModal}
              className="text-purple-300 hover:text-purple-200 underline font-medium"
            >
              モデル管理
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
