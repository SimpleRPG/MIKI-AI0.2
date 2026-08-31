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
  X,
  Heart,
  Users,
  User,
  Share2,
} from 'lucide-react';
import { ChatMessage, PersonaConfig, MemoryItem, WorkspaceFile, EngineMode } from '../types';
import { extractCodeBlocks } from '../utils/codeParser';
import { SPEAKER_PROFILES } from '../data/speakers';
import JSZip from 'jszip';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, files?: { name: string; content: string; type: string }[]) => void;
  isLoading: boolean;
  persona: PersonaConfig;
  memories: MemoryItem[];
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
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  persona,
  memories,
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
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; type: string; size: number }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const PUBLIC_APP_URL = 'https://ais-pre-lmii4pykmv4ucirau7mbyp-23659957062.asia-northeast1.run.app';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyPublicUrl = () => {
    navigator.clipboard.writeText(PUBLIC_APP_URL);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2500);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if ((!inputText.trim() && attachedFiles.length === 0) || isLoading) return;
    onSendMessage(inputText.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setInputText('');
    setAttachedFiles([]);
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

  // Dual-purpose prompt suggestions (Moe Chat, Code & WebGPU)
  const suggestions = [
    { label: 'WebGPUシェーダーでリアルタイム流体アート作って', icon: '⚡' },
    { label: 'Three.jsで3D惑星シミュレーター作成', icon: '🚀' },
    { label: '今日何してた？雑談しよ！', icon: '🌸' },
    { label: 'みき、大好きだよ〜', icon: '💖' },
    { label: '疲れたから癒やして…', icon: '☕' },
    { label: 'ミニゲームをゼロから開発して！', icon: '🎮' },
    { label: 'コードのバグを診断・自動修正して', icon: '🔧' },
    { label: 'GitHubにプッシュして保存して！', icon: '🐙' },
  ];

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
            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-pink-300 hover:bg-slate-700 border border-pink-500/40 font-mono transition-colors inline-flex items-center gap-1"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>WebGPUオンデバイス</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
                  {msg.engineMode && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 border border-slate-700 font-mono hidden sm:inline">
                      {msg.engineMode === 'webgpu' ? 'WebGPU' : 'ハイブリッド'}
                    </span>
                  )}
                </div>

                {/* Processing Speed & Token Stats */}
                {!isUser && (msg.metrics?.ttftMs || msg.metrics?.tokensPerSec) && (
                  <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-2.5 py-0.5 rounded-lg text-[10px] text-slate-400 font-mono shadow-sm">
                    <span className="text-pink-400 font-bold flex items-center gap-1 font-sans">
                      🌸 みき (オンデバイス推論)
                    </span>
                    {msg.metrics?.ttftMs ? (
                      <span>⚡ 応答: {msg.metrics.ttftMs}ms</span>
                    ) : null}
                    {msg.metrics?.tokensPerSec ? (
                      <span className="text-emerald-400 font-bold">
                        ({msg.metrics.tokensPerSec} tok/s)
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Fallback & WebGPU Status info bar */}
                {!isUser && msg.fallbackDiagnostic && (
                  <div className="flex items-center justify-between gap-2 bg-sky-950/40 border border-sky-500/20 px-2.5 py-1 rounded-lg text-[10.5px] text-sky-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="px-1.5 py-0.2 bg-sky-500/20 text-sky-300 rounded font-medium text-[10px]">
                        {msg.fallbackDiagnostic.category}
                      </span>
                      <span className="truncate text-slate-300">{msg.fallbackDiagnostic.cause}</span>
                    </div>
                    {onOpenEngineModal && (
                      <button
                        onClick={onOpenEngineModal}
                        className="text-[10px] text-sky-400 hover:text-sky-300 underline shrink-0 font-medium transition-colors"
                      >
                        端末LLM設定
                      </button>
                    )}
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

                {/* Message action buttons */}
                {!isUser && (
                  <div className="flex items-center gap-2 px-1 text-[10px] text-slate-500">
                    <button
                      onClick={() => speakText(msg.content)}
                      className="hover:text-pink-400 flex items-center gap-1 transition-colors"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>音声で聴く</span>
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="hover:text-slate-300 flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>コピー</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 flex items-center justify-center text-white text-base shadow-md shadow-pink-500/20 shrink-0 animate-pulse">
              {persona.avatar}
            </div>
            <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-2xl rounded-tl-sm text-xs text-slate-300 max-w-[85%] shadow-lg">
              <div className="flex items-center gap-2 mb-1.5 font-semibold text-pink-400">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {engineMode === 'webgpu'
                    ? 'オンデバイス GPU で応答を生成中...'
                    : `${persona.name}が思考中...`}
                </span>
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

      {/* Suggestion Prompts */}
      <div className="px-2.5 py-1.5 bg-slate-900/80 border-t border-slate-800/80 overflow-x-auto flex items-center gap-1.5 shrink-0 scrollbar-none">
        <span className="text-[10px] text-slate-500 font-semibold uppercase shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-pink-400" />
          <span className="hidden sm:inline">提案:</span>
        </span>
        {suggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(s.label)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition-colors"
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
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

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${persona.name}に指示（端末WebGPU・トークン消費0・ゲーム制作や雑談など）`}
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-xs text-slate-100 placeholder-slate-500 resize-none py-1.5 px-1 leading-relaxed max-h-24"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={(!inputText.trim() && attachedFiles.length === 0) || isLoading}
            className={`p-2 sm:p-2.5 rounded-lg flex items-center justify-center font-bold transition-all shrink-0 ${
              (!inputText.trim() && attachedFiles.length === 0) || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white shadow-md shadow-pink-500/25'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
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
