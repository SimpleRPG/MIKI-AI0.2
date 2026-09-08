import React, { useState } from 'react';
import {
  Code2,
  Github,
  Search,
  Sparkles,
  Download,
  Play,
  RotateCcw,
  Brain,
  Cpu,
  Zap,
  Activity,
  Plus,
  Share2,
  Check,
} from 'lucide-react';
import { PersonaConfig, MemoryItem, EngineMode } from '../types';

interface HeaderProps {
  activeTab: 'preview' | 'code' | 'github';
  setActiveTab: (tab: 'preview' | 'code' | 'github') => void;
  persona: PersonaConfig;
  memories: MemoryItem[];
  engineMode: EngineMode;
  onOpenEngineModal: () => void;
  onRestartGame: () => void;
  onOpenMemoryModal: () => void;
  onOpenExportModal: () => void;
  onNewBlankProject: () => void;
  useSearch: boolean;
  setUseSearch: (val: boolean) => void;
  fps: number;
  onOpenActivityMonitor?: () => void;
  isWorking?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  persona,
  memories,
  engineMode,
  onOpenEngineModal,
  onRestartGame,
  onOpenMemoryModal,
  onOpenExportModal,
  onNewBlankProject,
  useSearch,
  setUseSearch,
  fps,
  onOpenActivityMonitor,
  isWorking = false,
}) => {
  const [urlCopied, setUrlCopied] = useState(false);
  const getPublicUrl = () => {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin.replace('ais-dev-', 'ais-pre-');
    }
    return 'https://ais-pre-3wfkdwmq4s7d422alblgnd-387287333639.asia-northeast1.run.app';
  };

  const handleCopyPublicUrl = () => {
    navigator.clipboard.writeText(getPublicUrl());
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2500);
  };
  return (
    <header className="h-13 sm:h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-4 flex items-center justify-between gap-3 select-none z-30 shrink-0">
      {/* Brand & Persona Identity */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Logo / Partner Avatar */}
        <button
          onClick={onOpenMemoryModal}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-xs transition-all text-slate-200 hover:text-pink-300 group shrink-0 shadow-xs"
          title="みきの性格設定＆記憶カンペ"
        >
          <span className="text-base leading-none">{persona.avatar}</span>
          <span className="font-bold text-slate-100 text-xs sm:text-sm tracking-tight">{persona.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/15 text-pink-400 font-semibold border border-pink-500/30">
            Lv.{persona.intimacyLevel}
          </span>
          <Brain className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform hidden sm:inline" />
        </button>

        {/* Engine Switcher Quick Button */}
        <button
          onClick={onOpenEngineModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all shadow-xs ${
            engineMode === 'native_gpu'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
              : engineMode === 'webgpu'
              ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-900/50'
              : engineMode === 'external_gpu'
              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
              : engineMode === 'gemini_cloud'
              ? 'bg-sky-950/40 border-sky-500/40 text-sky-300 hover:bg-sky-900/50'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50'
          }`}
          title={
            engineMode === 'native_gpu'
              ? '【本体GPU直結】スマホ・PC物理GPU (Vulkan / OpenCL / NPU) ダイレクト推論'
              : engineMode === 'webgpu'
              ? '【WebGPU】ブラウザ標準オンデバイスLLM（GPUニューラルネットワーク推論）'
              : engineMode === 'external_gpu'
              ? '【外部ローカルLLM】Ollama / LM Studio (localhost:11434)'
              : engineMode === 'gemini_cloud'
              ? '【Gemini Cloud】Google Gemini 高性能クラウドAI'
              : '【CPUルールベース】GPU不要の軽量バックアッププログラム'
          }
        >
          {engineMode === 'native_gpu' ? (
            <>
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">本体GPU直結</span>
              <span className="sm:hidden">本体GPU</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </>
          ) : engineMode === 'webgpu' ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">WebGPU (ブラウザ)</span>
              <span className="sm:hidden">WebGPU</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
            </>
          ) : engineMode === 'external_gpu' ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">外部ローカルLLM</span>
              <span className="sm:hidden">外部LLM</span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            </>
          ) : engineMode === 'gemini_cloud' ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Gemini Cloud</span>
              <span className="sm:hidden">Gemini</span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">CPUルール</span>
              <span className="sm:hidden">CPU</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            </>
          )}
        </button>

        {/* リアルタイム思考・行動モニターボタン */}
        {onOpenActivityMonitor && (
          <button
            onClick={onOpenActivityMonitor}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all shadow-xs ${
              isWorking
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/80 shadow-emerald-500/20'
                : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="みきのリアルタイム思考・行動・自律改善モニターを開く"
          >
            <Activity className={`w-3.5 h-3.5 ${isWorking ? 'text-emerald-400 animate-spin' : 'text-indigo-400'}`} />
            <span className="hidden sm:inline font-bold">行動モニター</span>
            <span className="sm:hidden font-bold">モニター</span>
            {isWorking ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/80" />
            )}
          </button>
        )}
      </div>

      {/* Center: Main View Switcher (Desktop Only, on mobile handled by bottom bar) */}
      <div className="hidden md:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 shadow-xs">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'preview'
              ? 'bg-slate-800 text-slate-100 shadow-xs border border-slate-700/70 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
          <span>プレビュー</span>
          {fps > 0 && activeTab === 'preview' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-950/80 rounded-md text-emerald-400 font-mono border border-slate-800">
              {fps} FPS
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'code'
              ? 'bg-slate-800 text-slate-100 shadow-xs border border-slate-700/70 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Code2 className="w-3.5 h-3.5 text-sky-400" />
          <span>コード</span>
        </button>

        <button
          onClick={() => setActiveTab('github')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'github'
              ? 'bg-slate-800 text-slate-100 shadow-xs border border-slate-700/70 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Github className="w-3.5 h-3.5 text-purple-400" />
          <span>GitHub</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* New / Reset Canvas */}
        <button
          onClick={onNewBlankProject}
          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white transition-all shadow-xs"
          title="キャンバスをクリア・新規作成"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline font-medium">新規</span>
        </button>

        {/* Google Search Grounding Toggle */}
        <button
          onClick={() => setUseSearch(!useSearch)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all shadow-xs ${
            useSearch
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
          title="Google検索グラウンディング (最新情報を検索)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Web検索</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              useSearch ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
            }`}
          />
        </button>

        {/* Restart View */}
        <button
          onClick={onRestartGame}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs transition-all shadow-xs"
          title="プレビューをリロード"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Export Button */}
        <button
          onClick={onOpenExportModal}
          className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-sky-500/20 transition-all flex items-center gap-1.5 active:scale-95"
          title="HTML/ZIPエクスポート"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">保存</span>
        </button>

        {/* Public Share URL Button */}
        <button
          onClick={handleCopyPublicUrl}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 shadow-xs active:scale-95 ${
            urlCopied
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 font-semibold'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
          }`}
          title="スマホや外部ブラウザから誰でも開ける公開URL (ais-pre) をコピー"
        >
          {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-sky-400" />}
          <span className="hidden md:inline">{urlCopied ? 'コピー完了!' : '共有URL'}</span>
        </button>
      </div>
    </header>
  );
};
