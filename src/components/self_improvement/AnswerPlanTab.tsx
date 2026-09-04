import React, { useState } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Copy,
  Check,
  Search,
  BookOpen,
  Filter,
  BarChart2,
  Sparkles,
} from 'lucide-react';
import { ResponseSkeleton, ConversationStage } from '../../types';
import { answerPlanService } from '../../services/answerPlanService';

export const AnswerPlanTab: React.FC = () => {
  const [skeletons, setSkeletons] = useState<ResponseSkeleton[]>(() =>
    answerPlanService.getAllSkeletons()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSkeleton, setSelectedSkeleton] = useState<ResponseSkeleton | null>(null);

  // 新規登録フォーム用状態
  const [isAdding, setIsAdding] = useState(false);
  const [newPatternId, setNewPatternId] = useState('');
  const [newSituation, setNewSituation] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newStage, setNewStage] = useState<ConversationStage>('CORRECTION');
  const [newPlanSteps, setNewPlanSteps] = useState('');
  const [newAvoid, setNewAvoid] = useState('');
  const [newSamplePrompt, setNewSamplePrompt] = useState('');
  const [newExampleTemplate, setNewExampleTemplate] = useState('');

  const refreshSkeletons = () => {
    setSkeletons([...answerPlanService.getAllSkeletons()]);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateSkeleton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatternId.trim() || !newSituation.trim()) return;

    const created: ResponseSkeleton = {
      pattern_id: newPatternId.trim().toUpperCase(),
      situation: newSituation.trim(),
      triggerKeywords: newKeywords.split(/[,、\s]+/).filter(Boolean),
      stage: newStage,
      response_plan: newPlanSteps.split('\n').filter(Boolean),
      avoid: newAvoid.split('\n').filter(Boolean),
      reuse_mode: 'PLAN_ONLY',
      samplePrompt: newSamplePrompt.trim(),
      exampleResponseTemplate: newExampleTemplate.trim(),
      usageCount: 0,
      successRate: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    answerPlanService.saveSkeleton(created);
    refreshSkeletons();
    setIsAdding(false);
    // フォームリセット
    setNewPatternId('');
    setNewSituation('');
    setNewKeywords('');
    setNewPlanSteps('');
    setNewAvoid('');
    setNewSamplePrompt('');
    setNewExampleTemplate('');
  };

  const filtered = skeletons.filter((s) => {
    const matchesSearch =
      s.pattern_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.situation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.triggerKeywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStage = stageFilter === 'ALL' || s.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const totalUsages = skeletons.reduce((acc, s) => acc + s.usageCount, 0);
  const avgSuccessRate =
    skeletons.length > 0
      ? Math.round(skeletons.reduce((acc, s) => acc + s.successRate, 0) / skeletons.length)
      : 100;

  return (
    <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)] text-slate-200">
      {/* Overview Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/50 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center gap-1 border border-amber-500/30">
              <Zap className="w-3.5 h-3.5" />
              <span>設計思想 9章</span>
            </span>
            <h3 className="font-bold text-sm text-amber-200">
              回答骨格と思考節約 (Answer Plan & Thought Saving)
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            「状況分類（訂正・矛盾・短答・明確化）に一致した段階で思考手順を定型化し、ゼロからの冗長な推論を省略する」アーキテクチャです。プロンプトトークンと初回応答速度(TTFT)を節約します。
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-2 bg-black/40 border border-slate-800 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 font-mono">登録骨格数</div>
            <div className="text-base font-bold text-amber-300">{skeletons.length}件</div>
          </div>
          <div className="px-3 py-2 bg-black/40 border border-slate-800 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 font-mono">累計適用回数</div>
            <div className="text-base font-bold text-emerald-400">{totalUsages}回</div>
          </div>
          <div className="px-3 py-2 bg-black/40 border border-slate-800 rounded-lg text-center">
            <div className="text-[10px] text-slate-400 font-mono">平均成功率</div>
            <div className="text-base font-bold text-sky-400">{avgSuccessRate}%</div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="パターンID、状況、キーワードで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">全ステージ</option>
              <option value="CORRECTION">訂正 (CORRECTION)</option>
              <option value="QUESTION">質問 (QUESTION)</option>
              <option value="CLARIFICATION">明確化 (CLARIFICATION)</option>
              <option value="INITIAL">初期 (INITIAL)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAdding ? 'フォームを閉じる' : '新規骨格を登録'}</span>
        </button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <form
          onSubmit={handleCreateSkeleton}
          className="p-4 bg-slate-950/90 border border-amber-500/50 rounded-xl space-y-3 text-xs shadow-lg animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>新規回答骨格の登録 (9章 応答パターン)</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                パターンID (英大文字・ハイフン) *
              </label>
              <input
                type="text"
                required
                placeholder="例: PATTERN-EXCEPTION-01"
                value={newPatternId}
                onChange={(e) => setNewPatternId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">適用ステージ *</label>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value as ConversationStage)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
              >
                <option value="CORRECTION">訂正 (CORRECTION)</option>
                <option value="QUESTION">質問 (QUESTION)</option>
                <option value="CLARIFICATION">明確化 (CLARIFICATION)</option>
                <option value="AGREED">合意 (AGREED)</option>
                <option value="INITIAL">初期 (INITIAL)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              適用状況の説明 (どのようなユーザー意図に合致したか) *
            </label>
            <input
              type="text"
              required
              placeholder="例: 複数の条件が提示されたが、特定条件の例外が後から追加された"
              value={newSituation}
              onChange={(e) => setNewSituation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              トリガーキーワード (カンマ区切り)
            </label>
            <input
              type="text"
              placeholder="例: ただし, 追記, 追加で, やっぱ, 訂正"
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-emerald-300 font-bold mb-1">
                推奨回答手順 (改行区切り)
              </label>
              <textarea
                rows={3}
                placeholder="1. 追加条件を素直に反映&#10;2. 以前の前提との差分を明示&#10;3. 新しい結論を先に答える"
                value={newPlanSteps}
                onChange={(e) => setNewPlanSteps(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] text-rose-300 font-bold mb-1">
                禁止・回避事項 (改行区切り)
              </label>
              <textarea
                rows={3}
                placeholder="古い前提を残す&#10;謝罪だけで終わる&#10;前と同じ回答を繰り返す"
                value={newAvoid}
                onChange={(e) => setNewAvoid(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
            >
              骨格を保存する
            </button>
          </div>
        </form>
      )}

      {/* Skeletons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((s) => {
          const isSelected = selectedSkeleton?.pattern_id === s.pattern_id;
          return (
            <div
              key={s.pattern_id}
              className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-md'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-mono font-bold text-amber-300 text-[11px] bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded">
                      {s.pattern_id}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      {s.stage}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] font-mono text-slate-400 shrink-0">
                    <span>適用 {s.usageCount}回</span>
                    <span className="text-emerald-400 font-bold">{s.successRate}%</span>
                  </div>
                </div>

                <div className="font-semibold text-slate-200 text-xs line-clamp-2">
                  {s.situation}
                </div>

                {/* Keywords Chips */}
                <div className="flex flex-wrap gap-1">
                  {s.triggerKeywords.map((kw, kwIdx) => (
                    <span
                      key={kwIdx}
                      className="px-1.5 py-0.2 rounded bg-black/40 border border-slate-800 text-slate-400 text-[10px]"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>

                {/* Plan Steps */}
                <div className="p-2 bg-black/40 rounded-lg border border-slate-900 space-y-1 text-[11px]">
                  <div className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>手順 (Plan)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
                    {s.response_plan.map((step, stepIdx) => (
                      <li key={stepIdx} className="truncate">
                        {step.replace(/^\d+\.\s*/, '')}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Avoid */}
                {s.avoid.length > 0 && (
                  <div className="p-2 bg-rose-950/20 rounded-lg border border-rose-900/30 space-y-1 text-[11px]">
                    <div className="text-rose-400 font-bold text-[10px] flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>禁止・回避事項</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-rose-300/90 text-[10.5px]">
                      {s.avoid.map((item, itemIdx) => (
                        <li key={itemIdx} className="truncate">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2.5 mt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedSkeleton(isSelected ? null : s)}
                  className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>{isSelected ? '詳細を閉じる' : '例文・テンプレート'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `【${s.pattern_id}】\n状況: ${s.situation}\n手順:\n${s.response_plan.join(
                        '\n'
                      )}\n禁止:\n${s.avoid.join('\n')}`,
                      s.pattern_id
                    )
                  }
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 border border-slate-700"
                >
                  {copiedId === s.pattern_id ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span>コピー完了</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>コピー</span>
                    </>
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              {isSelected && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-500/20 space-y-2 text-[11px] bg-black/50 p-2.5 rounded-lg">
                  {s.samplePrompt && (
                    <div>
                      <div className="text-slate-400 font-bold text-[10px]">想定プロンプト例:</div>
                      <div className="text-slate-300 font-mono bg-slate-900 p-1.5 rounded mt-0.5 border border-slate-800">
                        {s.samplePrompt}
                      </div>
                    </div>
                  )}
                  {s.exampleResponseTemplate && (
                    <div>
                      <div className="text-emerald-400 font-bold text-[10px]">模範応答テンプレート:</div>
                      <div className="text-emerald-200/90 font-mono bg-slate-900 p-1.5 rounded mt-0.5 border border-slate-800 whitespace-pre-wrap">
                        {s.exampleResponseTemplate}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
