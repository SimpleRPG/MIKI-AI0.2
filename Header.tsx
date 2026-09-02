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
    <header className="h-12 sm:h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-2.5 sm:px-4 flex items-center justify-between gap-2 select-none z-30 shrink-0">
      {/* Brand & Persona Identity */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Logo / Partner Avatar */}
        <button
          onClick={onOpenMemoryModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-xs transition-all text-slate-200 hover:text-pink-300 group shrink-0"
          title="みきの性格設定＆記憶カンペ"
        >
          <span className="text-base">{persona.avatar}</span>
          <span className="font-bold text-slate-100 text-xs sm:text-sm">{persona.name}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-500/25 text-pink-400 font-bold border border-pink-500/30">
            Lv.{persona.intimacyLevel}
          </span>
          <Brain className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform hidden sm:inline" />
        </button>

        {/* Engine Switcher Quick Button */}
        <button
          onClick={onOpenEngineModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
            engineMode === 'native_gpu'
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/30 ring-1 ring-emerald-500/40'
              : engineMode === 'webgpu'
              ? 'bg-purple-500/20 border-purple-500/60 text-purple-200 hover:bg-purple-500/30 ring-1 ring-purple-500/30'
              : engineMode === 'external_gpu'
              ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-200 hover:bg-indigo-500/30 ring-1 ring-indigo-500/30'
              : engineMode === 'gemini_cloud'
              ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 hover:bg-sky-500/30 ring-1 ring-sky-500/30'
              : 'bg-amber-500/20 border-amber-500/60 text-amber-200 hover:bg-amber-500/30 ring-1 ring-amber-500/30'
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
              <Zap className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">⚡ 本体GPU直結</span>
              <span className="sm:hidden">本体GPU</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </>
          ) : engineMode === 'webgpu' ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden sm:inline">🌐 WebGPU (ブラウザ)</span>
              <span className="sm:hidden">WebGPU</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
            </>
          ) : engineMode === 'external_gpu' ? (
            <>
              <Cpu className="w-3.5 h-3.5 text-indigo-300" />
              <span className="hidden sm:inline">🖥️ 外部ローカルLLM</span>
              <span className="sm:hidden">外部LLM</span>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            </>
          ) : engineMode === 'gemini_cloud' ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              <span className="hidden sm:inline">☁️ Gemini Cloud</span>
              <span className="sm:hidden">Gemini</span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">⚙️ CPUルール</span>
              <span className="sm:hidden">CPU</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            </>
          )}
        </button>
      </div>

      {/* Center: Main View Switcher (Desktop Only, on mobile handled by bottom bar) */}
      <div className="hidden md:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'preview'
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>プレビュー</span>
          {fps > 0 && activeTab === 'preview' && (
            <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded text-emerald-400 font-mono">
              {fps} FPS
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'code'
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>コード</span>
        </button>

        <button
          onClick={() => setActiveTab('github')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'github'
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Github className="w-3.5 h-3.5" />
          <span>GitHub</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* New / Reset Canvas */}
        <button
          onClick={onNewBlankProject}
          className="flex items-center gap-1 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs text-slate-200 transition-colors"
          title="キャンバスをクリア・新規作成"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">新規</span>
        </button>

        {/* Google Search Grounding Toggle */}
        <button
          onClick={() => setUseSearch(!useSearch)}
          className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            useSearch
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10'
              : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Google検索グラウンディング (最新情報を検索)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Web検索</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              useSearch ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
        </button>

        {/* Restart View */}
        <button
          onClick={onRestartGame}
          className="p-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs transition-colors"
          title="プレビューをリロード"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Export Button */}
        <button
          onClick={onOpenExportModal}
          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-sky-500/20 transition-all flex items-center gap-1"
          title="HTML/ZIPエクスポート"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">保存</span>
        </button>

        {/* Public Share URL Button */}
        <button
          onClick={handleCopyPublicUrl}
          className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
            urlCopied
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : 'bg-slate-800/80 hover:bg-slate-800 text-sky-300 border-slate-700 hover:text-sky-200'
          }`}
          title="スマホや外部ブラウザから誰でも開ける公開URL (ais-pre) をコピー"
        >
          {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-sky-400" />}
          <span className="hidden md:inline">{urlCopied ? 'コピー完了!' : '公開URL'}</span>
        </button>
      </div>
    </header>
  );
};
