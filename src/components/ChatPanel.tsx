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
  Table,
  AlertTriangle,
  Compass,
  MessageSquare,
} from 'lucide-react';
import { ChatMessage, PersonaConfig, MemoryItem, WorkspaceFile, EngineMode, CompletionEvaluation } from '../types';
import { extractCodeBlocks } from '../utils/codeParser';
import { SPEAKER_PROFILES } from '../data/speakers';
import { systemLogger } from '../services/systemLogger';
import { selfImprovementService } from '../services/selfImprovementService';
import { skillsService } from '../services/skillsService';
import { TaskPlanCard } from './TaskPlanCard';
import { CompletionBadge } from './CompletionBadge';
import { completionJudgeService } from '../services/completionJudgeService';
import { workflowSynthesisService } from '../services/workflowSynthesisService';
import { experienceRouterService } from '../services/experienceRouterService';
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
  const [expandedWorkflowMsgId, setExpandedWorkflowMsgId] = useState<string | null>(null);
  const [executingWorkflowId, setExecutingWorkflowId] = useState<string | null>(null);
  const [workflowStatusMessage, setWorkflowStatusMessage] = useState<{ [wfId: string]: string }>({});
  const [experienceToast, setExperienceToast] = useState<{ msgId: string; text: string } | null>(null);

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
          const zip = new JSZip();
          const zipData = await zip.loadAsync(file);

          // ワークスペースに展開しないパス(依存パッケージ・ビルド成果物など)の除外ルール
          const EXCLUDED_PATH_SEGMENTS = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', '__pycache__/'];
          const EXCLUDED_EXTENSIONS = [
            '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            '.mp3', '.mp4', '.wav', '.ogg', '.mov',
            '.zip', '.gz', '.tar', '.rar', '.7z',
            '.exe', '.dll', '.so', '.class', '.jar', '.gguf', '.bin', '.pyc', '.lock',
          ];
          const MAX_FILE_BYTES = 500 * 1024; // 500KB超のファイルは自動展開の対象外

          const getLanguageFromPath = (p: string): string => {
            const ext = p.slice(p.lastIndexOf('.')).toLowerCase();
            const map: Record<string, string> = {
              '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
              '.html': 'html', '.css': 'css', '.json': 'json', '.md': 'markdown',
              '.py': 'python', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'cpp',
              '.vba': 'vba', '.bas': 'vba', '.cls': 'vba', '.yml': 'yaml', '.yaml': 'yaml',
              '.sh': 'bash', '.txt': 'text', '.xml': 'xml', '.sql': 'sql',
            };
            return map[ext] || 'text';
          };

          const fileNames: string[] = [];
          const extractedFiles: { path: string; name: string; content: string; language: string }[] = [];
          let skippedCount = 0;

          for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
            if (zipEntry.dir) continue;
            fileNames.push(relativePath);

            const isExcludedPath = EXCLUDED_PATH_SEGMENTS.some((seg) => relativePath.includes(seg));
            const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
            const isExcludedExt = EXCLUDED_EXTENSIONS.includes(ext);

            if (isExcludedPath || isExcludedExt) {
              skippedCount++;
              continue;
            }

            try {
              const text = await zipEntry.async('string');
              if (new Blob([text]).size > MAX_FILE_BYTES) {
                skippedCount++;
                continue;
              }
              const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
              extractedFiles.push({
                path: cleanPath,
                name: cleanPath.split('/').pop() || cleanPath,
                content: text,
                language: getLanguageFromPath(cleanPath),
              });
            } catch {
              skippedCount++;
            }
          }

          // フォルダ構造(path)を保持したままワークスペースへ展開
          if (extractedFiles.length > 0 && onApplyCode) {
            onApplyCode(extractedFiles);
          }

          const summary = `ZIP アーカイブ「${file.name}」から ${extractedFiles.length} 件のファイルをワークスペースに展開しました${skippedCount > 0 ? `(${skippedCount} 件はバイナリ/大容量/除外対象のためスキップ)` : ''}。\n\n展開したファイル:\n${extractedFiles.slice(0, 30).map((f) => f.path).join('\n')}${extractedFiles.length > 30 ? `\n...他 ${extractedFiles.length - 30} 件` : ''}\n\nGitHubへ反映する場合は「GitHubクラウド同期」タブから内容を確認のうえプッシュしてください(自動プッシュはしません)。`;

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

                        {/* 設計思想 49章: 経験仕分け判定ボタン */}
                        <span>•</span>
                        <button
                          onClick={() => handleRouteMessageExperience(msg)}
                          className="hover:text-purple-300 flex items-center gap-1 transition-colors text-[10px]"
                          title="49章 経験の保存先ルーターでこの応答を評価し、適切な記憶・スキル・教材へ仕分け判定"
                        >
                          <Compass className="w-3 h-3 text-purple-400" />
                          <span>49章 仕分け</span>
                        </button>
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
