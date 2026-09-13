import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Code,
  Check,
  Play,
  RotateCw,
  Terminal,
  ShieldCheck,
  FileCode,
  Download,
  Copy,
  Lightbulb,
  Wrench,
  Stethoscope,
  ChevronRight,
  Sliders,
  Zap,
  FolderCode,
  AlertTriangle,
  Bug,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import {
  mikiAutonomousDevStudioService,
  DevIdeaSuggestion,
} from '../../services/mikiAutonomousDevStudioService';
import {
  AutonomousDevProject,
  AutonomousDevCategory,
  AutonomousDevLanguage,
  CodeHealingReport,
} from '../../types';

interface AutonomousDevStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export const AutonomousDevStudioModal: React.FC<AutonomousDevStudioModalProps> = ({
  isOpen,
  onClose,
  initialPrompt = '',
}) => {
  const [activeTab, setActiveTab] = useState<'forge' | 'healer' | 'history'>('forge');

  // Forge State
  const [titleInput, setTitleInput] = useState<string>('');
  const [categoryInput, setCategoryInput] = useState<AutonomousDevCategory>('DYNAMIC_TOOL');
  const [languageInput, setLanguageInput] = useState<AutonomousDevLanguage>('typescript');
  const [promptInput, setPromptInput] = useState<string>(initialPrompt);
  const [isDeveloping, setIsDeveloping] = useState<boolean>(false);
  const [currentProject, setCurrentProject] = useState<AutonomousDevProject | null>(null);
  const [resultSubTab, setResultSubTab] = useState<'code' | 'tests' | 'spec' | 'review' | 'sandbox'>('code');

  // Interactive Sandbox State
  const [sandboxCustomInput, setSandboxCustomInput] = useState<string>('');
  const [isExecutingSandbox, setIsExecutingSandbox] = useState<boolean>(false);
  const [deployNotice, setDeployNotice] = useState<string | null>(null);

  // Suggestions & History
  const [suggestions, setSuggestions] = useState<DevIdeaSuggestion[]>([]);
  const [projectsList, setProjectsList] = useState<AutonomousDevProject[]>([]);

  // Code Healer State
  const [healerCodeInput, setHealerCodeInput] = useState<string>('');
  const [healerLanguage, setHealerLanguage] = useState<AutonomousDevLanguage>('vba');
  const [isHealing, setIsHealing] = useState<boolean>(false);
  const [healingReport, setHealingReport] = useState<CodeHealingReport | null>(null);

  // Copy notice
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSuggestions(mikiAutonomousDevStudioService.suggestDevIdeas());
      const allProjects = mikiAutonomousDevStudioService.getProjects();
      setProjectsList(allProjects);
      if (allProjects.length > 0 && !currentProject) {
        setCurrentProject(allProjects[0]);
      }
      if (initialPrompt && !promptInput) {
        setPromptInput(initialPrompt);
        setTitleInput('自律機能拡張ツール');
      }
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  const showCopyFeedback = (msg: string) => {
    setCopyNotice(msg);
    setTimeout(() => setCopyNotice(null), 3000);
  };

  const handleApplySuggestion = (idea: DevIdeaSuggestion) => {
    setTitleInput(idea.title);
    setCategoryInput(idea.category);
    setLanguageInput(idea.language);
    setPromptInput(idea.prompt);
    showCopyFeedback(`💡 アイデア「${idea.title}」をセットしました`);
  };

  const handleStartAutonomousDev = async () => {
    if (!titleInput.trim() || !promptInput.trim()) return;

    try {
      setIsDeveloping(true);
      setDeployNotice(null);

      const project = await mikiAutonomousDevStudioService.runAutonomousForgePipeline(
        {
          title: titleInput.trim(),
          category: categoryInput,
          language: languageInput,
          prompt: promptInput.trim(),
        },
        (progressProject) => {
          setCurrentProject({ ...progressProject });
        }
      );

      setCurrentProject(project);
      setProjectsList(mikiAutonomousDevStudioService.getProjects());
      setSandboxCustomInput(JSON.stringify(project.sandboxExecution?.inputUsed || {}, null, 2));
      setDeployNotice('✨ 自律開発が完了し、サンドボックス検証に合格しました！');
    } catch (err: any) {
      setDeployNotice(`⚠️ 開発中にエラーが発生しました: ${err?.message || err}`);
    } finally {
      setIsDeveloping(false);
    }
  };

  const handleRunCustomSandbox = async () => {
    if (!currentProject) return;
    try {
      setIsExecutingSandbox(true);
      let parsedInput: any = {};
      try {
        parsedInput = sandboxCustomInput.trim() ? JSON.parse(sandboxCustomInput) : {};
      } catch {
        parsedInput = sandboxCustomInput;
      }

      const res = await mikiAutonomousDevStudioService.runSandboxExecution(
        currentProject.implementationCode,
        currentProject.spec,
        currentProject.language,
        parsedInput
      );

      setCurrentProject((prev) => (prev ? { ...prev, sandboxExecution: res } : null));
      showCopyFeedback('⚡ サンドボックス実行が完了しました');
    } catch (err: any) {
      showCopyFeedback(`⚠️ 実行エラー: ${err?.message}`);
    } finally {
      setIsExecutingSandbox(false);
    }
  };

  const handleDeployToTools = async () => {
    if (!currentProject) return;
    const res = await mikiAutonomousDevStudioService.deployToDynamicTools(currentProject);
    setDeployNotice(res.message);
    setProjectsList(mikiAutonomousDevStudioService.getProjects());
  };

  const handleCopyCode = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showCopyFeedback(`📋 ${label}をクリップボードにコピーしました！`);
  };

  const handleDownloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showCopyFeedback(`💾 ファイル「${filename}」をダウンロードしました`);
  };

  const handleRunCodeHealing = async () => {
    if (!healerCodeInput.trim()) return;
    try {
      setIsHealing(true);
      const report = await mikiAutonomousDevStudioService.healCode(healerCodeInput, healerLanguage);
      setHealingReport(report);
      showCopyFeedback('🩹 コード自己診断と自動修復パッチの生成が完了しました！');
    } catch (err: any) {
      showCopyFeedback(`⚠️ 診断エラー: ${err?.message}`);
    } finally {
      setIsHealing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
              <Wrench className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  みき自律コード開発工房 (Autonomous Code Forge)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  設計思想 第171/172章
                </span>
              </div>
              <p className="text-xs text-slate-400">
                要件から仕様化・TDDテスト・実装・3賢者レビュー・サンドボックス検証・ツール配備までみきが自走します
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab Nav Buttons */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('forge')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'forge'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                自律開発フォージ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('healer')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'healer'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 text-pink-400" />
                コード自己診断＆修復
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderCode className="w-3.5 h-3.5 text-cyan-400" />
                開発済み ({projectsList.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Toast Notice */}
        {(copyNotice || deployNotice) && (
          <div className="px-5 py-2 bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-purple-950/80 border-b border-purple-800/40 text-xs text-purple-200 flex items-center justify-between animate-in fade-in shrink-0">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              {copyNotice || deployNotice}
            </span>
            <button
              onClick={() => {
                setCopyNotice(null);
                setDeployNotice(null);
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ======================================================== */}
          {/* TAB 1: AUTONOMOUS FORGE                                  */}
          {/* ======================================================== */}
          {activeTab === 'forge' && (
            <div className="space-y-6">
              {/* Top Suggestions Bar */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    みきの自律着想提案 (不足しているツールの候補)
                  </span>
                  <span className="text-[11px] text-slate-400">ワンクリックでフォームに入力できます</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {suggestions.slice(0, 3).map((idea) => (
                    <button
                      key={idea.id}
                      type="button"
                      onClick={() => handleApplySuggestion(idea)}
                      className="p-3 rounded-xl bg-slate-950/80 hover:bg-purple-950/30 border border-slate-800 hover:border-purple-600/40 text-left transition-all group flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {idea.language.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-purple-400 font-semibold">{idea.difficulty}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                          {idea.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-2">{idea.rationale}</p>
                      </div>
                      <div className="mt-2 text-[10px] text-purple-400 font-medium flex items-center gap-1">
                        <span>この機能を採用する</span>
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Requirement Input Form Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    自律開発プロジェクトの要件設定
                  </h3>
                  <span className="text-xs text-slate-500">自然言語で伝えるだけで自動プログラミング</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-medium">ツール / 機能名:</label>
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder="例: Excel TSV ↔ JSON 変換器"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-medium">開発カテゴリ:</label>
                    <select
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value as AutonomousDevCategory)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-hidden focus:border-purple-500"
                    >
                      <option value="DYNAMIC_TOOL">動的ツール (Dynamic Tool - みきに即装備)</option>
                      <option value="VBA_MACRO">VBA マクロ (Excel高速・安全マクロ)</option>
                      <option value="TYPESCRIPT_HELPER">TypeScript ヘルパーモジュール</option>
                      <option value="DATA_PROCESSOR">データ処理・変換エンジン</option>
                      <option value="ALGORITHM">最適化アルゴリズム</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-medium">出力言語:</label>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name="langSelect"
                          checked={languageInput === 'typescript'}
                          onChange={() => setLanguageInput('typescript')}
                          className="text-purple-600"
                        />
                        <span>TypeScript (動的実行可)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer ml-3">
                        <input
                          type="radio"
                          name="langSelect"
                          checked={languageInput === 'vba'}
                          onChange={() => setLanguageInput('vba')}
                          className="text-purple-600"
                        />
                        <span>Excel VBA</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">機能要件・達成したいこと:</label>
                  <textarea
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="例: Excelの表テキストを貼り付けたら、空行やヘッダーを自動判定してJSON配列とMarkdownの表の両方に変換する関数を作って。数値や日付の型変換も自動でやってほしい。"
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 font-sans"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>仕様策定 ➔ TDDテスト生成 ➔ 3賢者レビュー ➔ サンドボックス即時実行</span>
                  </div>
                  <button
                    id="btn-run-autonomous-dev"
                    type="button"
                    onClick={handleStartAutonomousDev}
                    disabled={isDeveloping || !titleInput.trim() || !promptInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isDeveloping ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin text-white" />
                        <span>みき自律プログラミング中...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-300 fill-current" />
                        <span>⚡ みきに完全自律開発を依頼する</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Development Progress & Result Workspace */}
              {currentProject && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl animate-in fade-in">
                  
                  {/* Progress Pipeline */}
                  <div className="space-y-2 border-b border-slate-800 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{currentProject.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800/60">
                          {currentProject.language.toUpperCase()}
                        </span>
                        {currentProject.deployedToolId && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            みきに配備済み
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-purple-300 font-mono font-bold">
                        進捗: {currentProject.progress}% ({currentProject.stage})
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${currentProject.progress}%` }}
                      />
                    </div>

                    {/* Pipeline Stage Badges */}
                    <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] pt-1">
                      {[
                        { label: '1. 仕様・不変条件', active: currentProject.progress >= 20 },
                        { label: '2. TDDテスト生成', active: currentProject.progress >= 40 },
                        { label: '3. 本番コーディング', active: currentProject.progress >= 60 },
                        { label: '4. 3賢者レビュー', active: currentProject.progress >= 80 },
                        { label: '5. サンドボックス実証', active: currentProject.progress >= 100 },
                      ].map((stg, sIdx) => (
                        <div
                          key={sIdx}
                          className={`py-1 rounded-lg font-medium transition-all ${
                            stg.active
                              ? 'bg-purple-900/40 border border-purple-600/40 text-purple-200'
                              : 'bg-slate-900/40 text-slate-500 border border-slate-900'
                          }`}
                        >
                          {stg.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subtabs for Inspecting Code & Artifacts */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setResultSubTab('code')}
                        className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          resultSubTab === 'code' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" />
                        本番実装コード
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultSubTab('sandbox')}
                        className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          resultSubTab === 'sandbox' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        ライブ実行サンドボックス
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultSubTab('tests')}
                        className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          resultSubTab === 'tests' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        TDDテストスイート ({currentProject.testCases.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultSubTab('review')}
                        className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          resultSubTab === 'review' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 text-amber-400" />
                        3賢者レビュー ({currentProject.reviewResult?.overallScore ?? 0}点)
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultSubTab('spec')}
                        className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                          resultSubTab === 'spec' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5 text-pink-400" />
                        仕様＆不変条件
                      </button>
                    </div>

                    {/* Actions: Deploy, Copy, Download */}
                    <div className="flex items-center gap-2">
                      {currentProject.language === 'typescript' && !currentProject.deployedToolId && (
                        <button
                          type="button"
                          onClick={handleDeployToTools}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                          title="みきの頭脳にこのツールを配備してチャットで使えるようにします"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          みきのツールに配備
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyCode(currentProject.implementationCode, '実装コード')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 border border-slate-700"
                        title="コードをコピー"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        コピー
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadFile(
                            currentProject.implementationCode,
                            `${currentProject.spec.featureName}.${currentProject.language === 'vba' ? 'bas' : 'ts'}`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1 border border-slate-700"
                        title="ファイルとしてダウンロード"
                      >
                        <Download className="w-3.5 h-3.5" />
                        保存
                      </button>
                    </div>
                  </div>

                  {/* Subtab 1: Code View */}
                  {resultSubTab === 'code' && (
                    <div className="space-y-2">
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 overflow-x-auto max-h-[350px]">
                        <pre className="font-mono text-xs text-emerald-300 leading-relaxed whitespace-pre">
                          {currentProject.implementationCode || '// コード生成中...'}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Subtab 2: Interactive Sandbox */}
                  {resultSubTab === 'sandbox' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Input Panel */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">テスト引数入力 (JSONまたは値):</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSandboxCustomInput(
                                JSON.stringify(
                                  currentProject.spec.inputs.reduce(
                                    (acc, cur) => ({ ...acc, [cur.name]: cur.sampleValue }),
                                    {}
                                  ),
                                  null,
                                  2
                                )
                              )
                            }
                            className="text-[11px] text-purple-400 hover:underline"
                          >
                            サンプル値を復元
                          </button>
                        </div>
                        <textarea
                          value={sandboxCustomInput}
                          onChange={(e) => setSandboxCustomInput(e.target.value)}
                          rows={8}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-purple-500"
                          placeholder='{"paramName": "value"}'
                        />
                        <button
                          type="button"
                          onClick={handleRunCustomSandbox}
                          disabled={isExecutingSandbox}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isExecutingSandbox ? (
                            <RotateCw className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                          <span>▶️ サンドボックスで即座に実行テスト</span>
                        </button>
                      </div>

                      {/* Output Panel */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">実行結果 & コンソールログ:</span>
                          {currentProject.sandboxExecution && (
                            <span className="text-[11px] text-emerald-400 font-mono">
                              ⏱️ {currentProject.sandboxExecution.elapsedMs} ms
                            </span>
                          )}
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 h-[240px] overflow-y-auto space-y-2">
                          {currentProject.sandboxExecution ? (
                            <>
                              <div className="text-xs font-mono text-emerald-300">
                                <div className="text-[10px] text-slate-500 mb-1 border-b border-slate-800 pb-1">
                                  戻り値 (Return Value):
                                </div>
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(currentProject.sandboxExecution.output, null, 2)}
                                </pre>
                              </div>
                              <div className="pt-2 border-t border-slate-800/80">
                                <div className="text-[10px] text-slate-500 mb-1">コンソール出力:</div>
                                {currentProject.sandboxExecution.consoleLogs.map((log, idx) => (
                                  <div key={idx} className="text-[11px] font-mono text-slate-400">
                                    {log}
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-slate-500">
                              まだ実行されていません
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subtab 3: TDD Test Cases */}
                  {resultSubTab === 'tests' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {currentProject.testCases.map((tc) => (
                          <div
                            key={tc.id}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800/40">
                                {tc.testType}
                              </span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                                <Check className="w-3.5 h-3.5" />
                                PASSED ({tc.executionMs}ms)
                              </span>
                            </div>
                            <h5 className="font-bold text-slate-100 text-[11.5px]">{tc.title}</h5>
                            <div className="text-[10.5px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800 truncate">
                              検証式: {tc.expectedResultSnippet}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 overflow-x-auto max-h-[220px]">
                        <pre className="font-mono text-[11px] text-cyan-300 whitespace-pre">
                          {currentProject.testSuiteCode}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Subtab 4: Council Review */}
                  {resultSubTab === 'review' && currentProject.reviewResult && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">🛡️ SecOps 監査</span>
                          <span className="text-sm font-bold text-emerald-400">
                            {currentProject.reviewResult.secOpsScore}点
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {currentProject.reviewResult.secOpsCritique}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">💎 CleanCode 規約</span>
                          <span className="text-sm font-bold text-cyan-400">
                            {currentProject.reviewResult.cleanCodeScore}点
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {currentProject.reviewResult.cleanCodeCritique}
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">🧪 QA & 変異体テスト</span>
                          <span className="text-sm font-bold text-purple-400">
                            {currentProject.reviewResult.qaScore}点
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {currentProject.reviewResult.qaCritique}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Subtab 5: Specification & Invariants */}
                  {resultSubTab === 'spec' && (
                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[10px]">機能概要:</span>
                        <p className="text-slate-200">{currentProject.spec.summary}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <span className="text-slate-400 block text-[10px]">入力シグネチャ:</span>
                        <div className="space-y-1">
                          {currentProject.spec.inputs.map((inp, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-950 p-1.5 rounded border border-slate-800 font-mono text-[11px]">
                              <span className="text-purple-300">{inp.name}: <span className="text-cyan-300">{inp.type}</span></span>
                              <span className="text-slate-400 text-[10px]">{inp.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                        <span className="text-slate-400 block text-[10px]">仕様不変条件 (Invariants):</span>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                          {currentProject.spec.invariants.map((inv, idx) => (
                            <li key={idx}>{inv}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CODE HEALER & PATCH ENGINE                         */}
          {/* ======================================================== */}
          {activeTab === 'healer' && (
            <div className="space-y-5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-pink-300 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-pink-400" />
                  自律コード診断＆修復パッチワーク (Code Healer)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  任意のコード（VBAマクロやTypeScript関数）を貼り付けると、みきが静的AST検査を行い、実行時例外の温床・型欠損・パフォーマンス低下要因を自動検知して安全な修復パッチを生成します。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Input Code */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-400 font-medium">診断対象コード:</label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setHealerLanguage('vba');
                          setHealerCodeInput(`Sub ProcessSalesData()\n    Range("A1").Select\n    For i = 1 To 1000\n        Cells(i, 1).Value = Cells(i, 1).Value * 1.1\n    Next i\nEnd Sub`);
                        }}
                        className="text-[10.5px] text-purple-400 hover:underline"
                      >
                        VBAサンプル
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHealerLanguage('typescript');
                          setHealerCodeInput(`async function fetchUserData(id: any) {\n    var res = await api.get('/user/' + id);\n    return res.data;\n}`);
                        }}
                        className="text-[10.5px] text-cyan-400 hover:underline"
                      >
                        TSサンプル
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={healerCodeInput}
                    onChange={(e) => setHealerCodeInput(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-100 focus:outline-hidden focus:border-pink-500"
                    placeholder="ここに診断したいコードを貼り付け..."
                  />

                  <button
                    type="button"
                    onClick={handleRunCodeHealing}
                    disabled={isHealing || !healerCodeInput.trim()}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isHealing ? (
                      <RotateCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Stethoscope className="w-4 h-4" />
                    )}
                    <span>🩺 自律コード診断＆自動修復を実行</span>
                  </button>
                </div>

                {/* Right: Healed Code & Findings */}
                <div className="space-y-3">
                  {healingReport ? (
                    <>
                      {/* Score Comparison */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 block">健全性スコア改善:</span>
                          <span className="text-xs font-bold text-rose-400">{healingReport.healthScoreBefore}点</span>
                          <span className="text-xs text-slate-500 mx-2">➔</span>
                          <span className="text-sm font-bold text-emerald-400">{healingReport.healthScoreAfter}点</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(healingReport.healedCode, '修復済みコード')}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          修復コードをコピー
                        </button>
                      </div>

                      {/* Findings List */}
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                        {healingReport.findings.map((f, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-slate-900/90 border border-rose-950/60 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-rose-300 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                {f.category}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300">
                                {f.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">{f.message}</p>
                            <p className="text-[10.5px] text-emerald-300 italic">💡 処置: {f.fixProposal}</p>
                          </div>
                        ))}
                      </div>

                      {/* Healed Code Display */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 h-[180px] overflow-y-auto font-mono text-xs text-emerald-300 whitespace-pre">
                        {healingReport.healedCode}
                      </div>
                    </>
                  ) : (
                    <div className="h-full border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2">
                      <Stethoscope className="w-8 h-8 text-slate-600" />
                      <span className="text-xs">左側にコードを入力して「自律コード診断」を実行してください</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: PROJECTS REPOSITORY                               */}
          {/* ======================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderCode className="w-4 h-4 text-cyan-400" />
                  これまでに自律開発したツール・プロジェクト一覧 ({projectsList.length}件)
                </h3>
                <span className="text-xs text-slate-500">ブラウザ内に安全に永続保存されています</span>
              </div>

              {projectsList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  まだ自律開発されたプロジェクトはありません。「自律開発フォージ」タブから作成してください。
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projectsList.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-purple-600/40 transition-all space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/40">
                            {proj.language.toUpperCase()} / {proj.category}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(proj.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">{proj.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2">{proj.spec.summary}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentProject(proj);
                              setActiveTab('forge');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-xs font-medium transition-all"
                          >
                            開いて検証
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(proj.implementationCode, proj.title)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="コードをコピー"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            mikiAutonomousDevStudioService.deleteProject(proj.id);
                            setProjectsList(mikiAutonomousDevStudioService.getProjects());
                          }}
                          className="text-slate-500 hover:text-rose-400 text-xs transition-colors"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>自律コーディングエンジン: 稼働中 (Sandbox Level 3 隔離保護)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-medium transition-colors"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
