import React, { useState, useEffect } from 'react';
import {
  Compass,
  Zap,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { uncertaintyTeacherService } from '../../services/uncertaintyTeacherService';
import { capabilityGapService } from '../../services/capabilityGapService';
import { UncertaintyDivergenceItem, CapabilityGapEntry } from '../../types';

export const UncertaintyTeacherTab: React.FC = () => {
  const [history, setHistory] = useState<UncertaintyDivergenceItem[]>([]);
  const [inputPrompt, setInputPrompt] = useState(
    'Galaxy S25上で完全にオフラインかつファンレスで3Bモデルを2時間チャットし続けた場合、発熱とメモリ不足のどちらが先に致命的になりますか？'
  );
  const [selectedCapId, setSelectedCapId] = useState('cap_conv_naturalness');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [latestResult, setLatestResult] = useState<UncertaintyDivergenceItem | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const items = uncertaintyTeacherService.getHistory();
    setHistory(items);
    if (items.length > 0 && !latestResult) {
      setLatestResult(items[0]);
    }
  };

  const handleEvaluate = async () => {
    if (!inputPrompt.trim()) return;
    setIsEvaluating(true);
    try {
      const res = await uncertaintyTeacherService.evaluateUncertainty(inputPrompt, {
        targetCapabilityId: selectedCapId,
      });
      setLatestResult(res);
      loadData();
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleClear = () => {
    if (confirm('不確実性駆動サンプリングログを初期化しますか？')) {
      uncertaintyTeacherService.clearHistory();
      setLatestResult(null);
      loadData();
    }
  };

  const allGaps: CapabilityGapEntry[] = capabilityGapService.getAllGaps();
  const generalizationGaps = allGaps.filter((g: CapabilityGapEntry) => g.gap_type === 'generalization_gap');

  return (
    <div className="space-y-6">
      {/* 20章 設計思想ヘッダー */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <Compass className="w-5 h-5 text-amber-400" />
            <span>設計思想 20章: 不確実性駆動の教師利用 ＆ 対策の汎化不足検知</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs border border-amber-500/30 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Chapter 20 Uncertainty Routing</span>
          </span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          端末内LLMに同じ意味の課題へ<strong>複数候補（マルチサンプリング）</strong>を出させ、判断が割れた（不確実性が高い）場合のみ外部教師へ送信します。
          教師の役割は「その場の返信」ではなく<strong>「対策（回答骨格・修復パターン）」を生成して保存</strong>することです。
          さらに、対策を保存した後も類似の未知の言い回し（16.1）で同一能力が再び送信条件に該当した場合、回答が正解でも<strong>「対策の汎化不足」として32章不足能力レジストリへ自動記録</strong>します。
        </p>

        {/* 判定基準5要素 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
            <strong>1. 結論の不一致</strong>
            <div className="text-[10px] text-slate-400 mt-0.5">候補間で真逆の結論</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
            <strong>2. 意図推定不一致</strong>
            <div className="text-[10px] text-slate-400 mt-0.5">着眼点の解釈のズレ</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
            <strong>3. 回答長の不安定</strong>
            <div className="text-[10px] text-slate-400 mt-0.5">短文と長文の極端差</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
            <strong>4. 条件・例外相違</strong>
            <div className="text-[10px] text-slate-400 mt-0.5">例外条件の抜け漏れ</div>
          </div>
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
            <strong>5. 記憶選択の相違</strong>
            <div className="text-[10px] text-slate-400 mt-0.5">参照記憶の不整合</div>
          </div>
        </div>
      </div>

      {/* サンプリング検証フォーム */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
          <span>複数候補サンプリング＆不確実性検証テスト</span>
          <button
            onClick={handleClear}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>ログ初期化</span>
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] text-slate-400 block">
            検証対象のプロンプト（未知の言い回しや判断が割れやすい質問）:
          </label>
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            rows={3}
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
            placeholder="テストする質問文を入力..."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">紐付け能力プロファイル:</span>
            <select
              value={selectedCapId}
              onChange={(e) => setSelectedCapId(e.target.value)}
              className="p-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
            >
              <option value="cap_conv_naturalness">自然な会話の継続 (cap_conv_naturalness)</option>
              <option value="cap_premise_correction">前提訂正の即座反映 (cap_premise_correction)</option>
              <option value="cap_vba_split">VBAプロシージャ分割 (cap_vba_split)</option>
              <option value="cap_abstract_vba_design">抽象VBA設計支援 (cap_abstract_vba_design)</option>
            </select>
          </div>

          <button
            onClick={handleEvaluate}
            disabled={isEvaluating || !inputPrompt.trim()}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-900/30"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isEvaluating ? '複数候補サンプリング中...' : '複数候補サンプリング＆不確実性検証'}</span>
          </button>
        </div>
      </div>

      {/* 最新実行結果詳細 */}
      {latestResult && (
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              {latestResult.shouldSendToTeacher ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
              <div>
                <div className="text-xs font-bold text-slate-200">
                  不確実性スコア: <strong className="text-amber-300">{latestResult.uncertaintyScore}点</strong>
                  <span className="ml-2 font-normal text-slate-400">
                    ({latestResult.shouldSendToTeacher ? '判断ブレ検出 ➔ 教師要請' : '判断安定 ➔ 端末内完結'})
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  検出相違項目: {latestResult.divergenceTypes.length > 0 ? latestResult.divergenceTypes.join(' / ') : '相違なし（安定一致）'}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border uppercase ${
                latestResult.teacherActionTaken === 'recorded_generalization_gap'
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : latestResult.teacherActionTaken === 'created_skeleton'
                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-800'
              }`}>
                {latestResult.teacherActionTaken === 'recorded_generalization_gap'
                  ? '⚠️ 32章 対策の汎化不足を記録'
                  : latestResult.teacherActionTaken === 'created_skeleton'
                  ? '🎓 対策骨格 (回答骨格) 生成'
                  : '✅ 端末内安定処理'}
              </span>
            </div>
          </div>

          {/* 汎化不足警告メッセージ */}
          {latestResult.generalizationGapReason && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>【20章＆32章 対策の汎化不足を自動記録】</span>
              </div>
              <p className="text-[11px] text-rose-200 leading-relaxed">
                {latestResult.generalizationGapReason}
              </p>
              {latestResult.gapIdRecorded && (
                <div className="text-[10px] font-mono text-rose-400">
                  登録された不足能力ID: {latestResult.gapIdRecorded}
                </div>
              )}
            </div>
          )}

          {/* 生成された回答骨格 */}
          {latestResult.generatedSkeletonId && (
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/80 text-indigo-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>【20章＆9章 対策骨格 (回答骨格) を自動保存】</span>
              </div>
              <p className="text-[11px] text-indigo-200">
                教師の対策として回答骨格 (<strong>{latestResult.generatedSkeletonId}</strong>) を登録しました。以後はゼロから推論せず回答骨格で思考を節約します。
              </p>
            </div>
          )}

          {/* 候補応答の横並び比較 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between pb-1 border-b border-slate-800">
                <span>候補 1 (通常サンプリング)</span>
                <span className="text-[10px] font-mono text-slate-500">{latestResult.candidateResponses[0]?.length || 0}文字</span>
              </div>
              <div className="text-xs text-slate-200 max-h-40 overflow-y-auto leading-relaxed">
                {latestResult.candidateResponses[0] || '(応答なし)'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between pb-1 border-b border-slate-800">
                <span>候補 2 (検証・慎重サンプリング)</span>
                <span className="text-[10px] font-mono text-slate-500">{latestResult.candidateResponses[1]?.length || 0}文字</span>
              </div>
              <div className="text-xs text-slate-200 max-h-40 overflow-y-auto leading-relaxed">
                {latestResult.candidateResponses[1] || '(応答なし)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 32章 不足能力レジストリ（汎化不足型GAP一覧） */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>32章 不足能力レジストリ: 対策の汎化不足 ({generalizationGaps.length}件)</span>
          </div>
          <span className="text-[10px] text-slate-400">
            20章規定により自動記録された弱点
          </span>
        </div>

        {generalizationGaps.length === 0 ? (
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
            現在、対策の汎化不足として記録されているGAPはありません。
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {generalizationGaps.map((gap) => (
              <div
                key={gap.gap_id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{gap.gap_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-900">
                      汎化不足
                    </span>
                    <span className="text-[10px] text-slate-400">能力: {gap.capabilityId}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{gap.description}</p>
                  <div className="text-[10px] text-slate-400">
                    暫定対策: {gap.current_workaround || 'なし'}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-300 shrink-0">
                  {gap.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
