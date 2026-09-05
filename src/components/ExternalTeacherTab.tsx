import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Send,
  Lock,
  FileCode,
  Settings,
  RefreshCw,
  Sliders,
  Sparkles,
  Clock,
  ArrowRight,
  Database,
  Check,
  Copy,
  Info,
  Moon,
  Trash2,
  Play,
  Zap,
  Plus,
} from 'lucide-react';
import {
  FailureRecurrenceEntry,
  TeacherBudgetStatus,
  TeacherRequestPayload,
  TeacherGeneratedMaterial,
  TeacherUsageRecord,
  TrainingSampleJSONL,
  ResponseSkeleton,
  DelayedTeacherQueueItem,
} from '../types';
import { teacherRequestService } from '../services/teacherRequestService';
import { selfImprovementService } from '../services/selfImprovementService';

interface ExternalTeacherTabProps {
  onJumpToColab?: () => void;
}

export const ExternalTeacherTab: React.FC<ExternalTeacherTabProps> = ({ onJumpToColab }) => {
  const [budgetStatus, setBudgetStatus] = useState<TeacherBudgetStatus>(() =>
    teacherRequestService.checkBudget()
  );
  const [failurePatterns, setFailurePatterns] = useState<FailureRecurrenceEntry[]>([]);
  const [externalSamples, setExternalSamples] = useState<TrainingSampleJSONL[]>([]);
  const [usageRecords, setUsageRecords] = useState<TeacherUsageRecord[]>([]);

  // 選択・プレビュー中の弱点パターンとペイロード
  const [selectedPattern, setSelectedPattern] = useState<FailureRecurrenceEntry | null>(null);
  const [previewPayload, setPreviewPayload] = useState<TeacherRequestPayload | null>(null);
  const [anonymizedText, setAnonymizedText] = useState<string>('');

  // 実行ステート
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestResult, setRequestResult] = useState<{
    success: boolean;
    material?: TeacherGeneratedMaterial;
    error?: string;
    verifiedPassed?: boolean;
    savedSample?: TrainingSampleJSONL | null;
    savedSkeleton?: ResponseSkeleton | null;
    verifiedEffective?: boolean;
    verificationNote?: string;
    generalizationGapRecorded?: boolean;
  } | null>(null);

  // 予算設定エディタの開閉
  const [isEditingLimits, setIsEditingLimits] = useState(false);
  const [dailyLimitInput, setDailyLimitInput] = useState<number>(budgetStatus.limits.dailyCalls);
  const [monthlyLimitInput, setMonthlyLimitInput] = useState<number>(budgetStatus.limits.monthlyCalls);

  // コピー表示
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 遅延送信キュー (11章 睡眠ゲート連携)
  const [delayedQueue, setDelayedQueue] = useState<DelayedTeacherQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const refreshData = () => {
    const status = teacherRequestService.checkBudget();
    setBudgetStatus(status);
    setDailyLimitInput(status.limits.dailyCalls);
    setMonthlyLimitInput(status.limits.monthlyCalls);

    const recurrences = selfImprovementService.getFailureRecurrences();
    setFailurePatterns([...recurrences]);

    const samples = selfImprovementService
      .getTrainingSamples()
      .filter((s) => s.source === 'external_teacher');
    setExternalSamples(samples);

    setUsageRecords(teacherRequestService.getUsageRecords());
    setDelayedQueue(teacherRequestService.getDelayedQueue());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleRunBatchNow = async () => {
    setIsProcessingQueue(true);
    setBatchNotice(null);
    try {
      const res = await teacherRequestService.processDelayedTeacherQueue(3);
      setBatchNotice(
        `バッチ処理完了: ${res.processedCount}件処理 (成功: ${res.succeededCount}件, 失敗: ${res.failedCount}件)`
      );
      refreshData();
    } catch (e: any) {
      setBatchNotice(`バッチエラー: ${e?.message || String(e)}`);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const handleEnqueueSample = () => {
    teacherRequestService.enqueueDelayedRequest({
      source: 'manual',
      targetCapabilityId: 'cap_logical_priority',
      userPrompt: '「AとBを両方有効にして」と言われた場合、どちらの例外処理を最優先で適用すべきか解説して',
      failureCategory: 'chat',
      divergenceTypes: ['divergence_conclusion', 'divergence_priority'],
      uncertaintyScore: 78,
      candidateResponses: ['Aを優先すべきです', 'Bを最優先と判定します'],
    });
    setBatchNotice('テスト用の不確実性ブレ要請を遅延キューに追加しました。');
    refreshData();
  };

  const handleRemoveQueueItem = (id: string) => {
    teacherRequestService.removeQueueItem(id);
    refreshData();
  };

  const handleClearQueue = () => {
    teacherRequestService.clearDelayedQueue();
    refreshData();
  };

  // 弱点パターンを選択し、匿名化・ペイロードプレビューを生成
  const handleSelectPattern = (pattern: FailureRecurrenceEntry) => {
    setSelectedPattern(pattern);
    setRequestResult(null);

    // 1. 匿名化・抽象化処理 (設計思想 38節)
    const rawContent = `${pattern.samplePrompt}${pattern.notes ? ` (メモ: ${pattern.notes})` : ''}`;
    const anonymized = teacherRequestService.anonymizeFailureExample(rawContent);
    setAnonymizedText(anonymized);

    // 2. ペイロード構築
    const payload = teacherRequestService.buildTeacherRequestPayload(
      anonymized,
      pattern.category,
      pattern.notes || undefined
    );
    setPreviewPayload(payload);
  };

  // 外部教師へのリクエスト送信
  const handleSendRequest = async () => {
    if (!previewPayload) return;

    setIsRequesting(true);
    setRequestResult(null);

    try {
      const res = await teacherRequestService.requestTeacherMaterial(
        previewPayload,
        selectedPattern?.patternKey
      );
      setRequestResult(res);
      refreshData();
    } catch (e: any) {
      setRequestResult({
        success: false,
        error: e?.message || '予期せぬエラーが発生しました',
      });
    } finally {
      setIsRequesting(false);
    }
  };

  // 予算上限保存
  const handleSaveLimits = () => {
    teacherRequestService.updateBudgetLimits(Number(dailyLimitInput), Number(monthlyLimitInput));
    setIsEditingLimits(false);
    refreshData();
  };

  // サンプル弱点パターンの投入（初回テスト用）
  const handleSeedSampleFailure = () => {
    const samples = [
      {
        category: 'code' as const,
        samplePrompt: 'Three.jsのジオメトリとマテリアルをdisposeせずにシーン切替を繰り返してVRAMが枯渇した',
        reason: 'Three.js BufferGeometry cleanup leak in WebGL canvas',
        notes: 'Three.jsの破棄処理漏れ。requestAnimationFrameの解除とdispose()呼び出しが必要',
      },
      {
        category: 'vba' as const,
        samplePrompt: 'VBAで特定の文字列パターンから金額をRegExpで抽出する際にエラーが出る',
        reason: 'VBScript.RegExp runtime error and object reference issue',
        notes: '正規表現オブジェクトのインスタンス生成とMatchCollectionの境界チェック不足',
      },
      {
        category: 'chat' as const,
        samplePrompt: 'ユーザーが「おつかれ！」と言ったのに、過剰にロボットのような敬語長文で返して親密さが崩れた',
        reason: 'Over-polite robotic reply in casual conversational context',
        notes: '親密な日常会話コンテキストにおいて過度な定型挨拶を連発してしまう対話トーンの乖離',
      },
    ];

    const pick = samples[Math.floor(Math.random() * samples.length)];
    // 2回記録して再発回数を2にし、ゲートを通過できるようにする
    selfImprovementService.recordOrCheckFailureRecurrence({
      category: pick.category,
      prompt: pick.samplePrompt,
      reason: pick.reason ? `${pick.reason} (${pick.notes})` : pick.notes,
    });
    const result = selfImprovementService.recordOrCheckFailureRecurrence({
      category: pick.category,
      prompt: pick.samplePrompt,
      reason: pick.reason ? `${pick.reason} (${pick.notes})` : pick.notes,
    });

    refreshData();
    handleSelectPattern(result.entry);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* HEADER & ARCHITECTURE CONCEPT BANNER */}
      <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  外部教師リクエスト・パイプライン (Phase 8)
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                  Gemini API 連携
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                端末内で解決困難な弱点を抽象化・匿名化して外部AIに教材化を依頼。安全境界と品質フィルタを経て中信頼教材として蓄積します。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors text-xs"
              title="データを再読み込み"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>更新</span>
            </button>
            <button
              onClick={() => setIsEditingLimits(!isEditingLimits)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors text-xs"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>予算上限設定</span>
            </button>
          </div>
        </div>

        {/* 予算設定エディタ */}
        {isEditingLimits && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-slate-900/80 p-3 rounded-lg">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                1日あたり呼び出し上限 (回)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                1ヶ月あたり呼び出し上限 (回)
              </label>
              <input
                type="number"
                min="5"
                max="1000"
                value={monthlyLimitInput}
                onChange={(e) => setMonthlyLimitInput(Math.max(5, parseInt(e.target.value) || 5))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveLimits}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs transition-colors"
              >
                保存する
              </button>
              <button
                onClick={() => setIsEditingLimits(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1. 予算 & 利用状況ステータスカード */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 本日の呼び出し予算 */}
        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              本日呼び出し (Daily)
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                budgetStatus.usage.dailyCalls >= budgetStatus.limits.dailyCalls
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              残り {budgetStatus.remaining.daily} 回
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-slate-100">
              {budgetStatus.usage.dailyCalls}
            </span>
            <span className="text-xs text-slate-500">/ {budgetStatus.limits.dailyCalls} 回</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                budgetStatus.usage.dailyCalls >= budgetStatus.limits.dailyCalls
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  (budgetStatus.usage.dailyCalls / budgetStatus.limits.dailyCalls) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* 当月の呼び出し予算 */}
        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              当月呼び出し (Monthly)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded font-bold">
              残り {budgetStatus.remaining.monthly} 回
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-slate-100">
              {budgetStatus.usage.monthlyCalls}
            </span>
            <span className="text-xs text-slate-500">/ {budgetStatus.limits.monthlyCalls} 回</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  (budgetStatus.usage.monthlyCalls / budgetStatus.limits.monthlyCalls) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* トークン消費 */}
        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            本日トークン推計
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-slate-100">
              {budgetStatus.usage.dailyPromptTokens + budgetStatus.usage.dailyOutputTokens}
            </span>
            <span className="text-xs text-slate-500">tokens</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            In: {budgetStatus.usage.dailyPromptTokens} / Out: {budgetStatus.usage.dailyOutputTokens}
          </p>
        </div>

        {/* 教材化実績 & 検証合格率 */}
        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
          <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            教材生成 & 安全検証
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-extrabold text-emerald-300">
              {budgetStatus.usage.totalVerifiedPassed}
            </span>
            <span className="text-xs text-slate-500">
              / {budgetStatus.usage.totalGeneratedMaterials} 件合格
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            蓄積教材: {externalSamples.length} 件 (中信頼扱い)
          </p>
        </div>
      </div>

      {/* 予算超過アラート */}
      {!budgetStatus.allowed && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div>
            <div className="font-bold">呼び出し予算リミットに到達しました</div>
            <div className="text-rose-200/80 text-[11px] mt-0.5">{budgetStatus.reason}</div>
          </div>
        </div>
      )}

      {/* 2. MAIN WORKFLOW: 検出された弱点パターン vs 送信前プレビュー */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 左側: 弱点パターン一覧 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>検出された弱点パターン</span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                  {failurePatterns.length} 件
                </span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                再発回数・既存教材の有無・機械検証可否を判定ゲートで自動評価
              </p>
            </div>
            <button
              onClick={handleSeedSampleFailure}
              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[11px] transition-colors"
            >
              + テスト弱点を追加
            </button>
          </div>

          {failurePatterns.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-xs">現在記録された未解決の弱点パターンはありません</p>
              <button
                onClick={handleSeedSampleFailure}
                className="mt-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs transition-colors"
              >
                テスト用パターンを注入してパイプラインを試す
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {failurePatterns.map((pattern) => {
                const shouldRequest = teacherRequestService.shouldRequestTeacher(pattern);
                const isSelected = selectedPattern?.patternKey === pattern.patternKey;

                return (
                  <div
                    key={pattern.patternKey}
                    onClick={() => handleSelectPattern(pattern)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-950/30 border-emerald-500/60 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] uppercase">
                          {pattern.category}
                        </span>
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-bold">
                          再発 {pattern.recurrenceCount} 回
                        </span>
                        {pattern.promotedToSample && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px]">
                            教材化済
                          </span>
                        )}
                      </div>

                      {shouldRequest ? (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          外部教師推奨
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                          端末内解決
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-200 font-medium line-clamp-2 mb-1">
                      {pattern.samplePrompt}
                    </div>

                    {pattern.notes && (
                      <div className="text-[11px] text-slate-400 line-clamp-1 bg-slate-900/80 px-2 py-1 rounded border border-slate-800/50">
                        メモ: {pattern.notes}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                      <span>最終発生: {new Date(pattern.lastSeenAt).toLocaleTimeString()}</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                        リクエスト作成 <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右側: 送信前プレビュー & 実行エリア */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>送信前プレビュー (厳格なプライバシー保護)</span>
            </h4>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold">
              生会話・個人情報 排除保証
            </span>
          </div>

          {!selectedPattern || !previewPayload ? (
            <div className="flex-1 flex flex-col items-center justify-center py-14 text-center text-slate-500">
              <FileCode className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-xs">
                左側の弱点パターンを選択すると、匿名化されたリクエスト内容のプレビューが表示されます
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                {/* 匿名化・抽象化テキスト */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    抽象化・匿名化後の課題パターン
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono whitespace-pre-wrap">
                    {anonymizedText}
                  </div>
                </div>

                {/* 達成期待条件 */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1">
                    達成すべき期待条件 (Expected Condition)
                  </div>
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-emerald-300">
                    {previewPayload.expectedCondition}
                  </div>
                </div>

                {/* 実際にGeminiへ送られるJSONプレビュー */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                    <span>送信JSONペイロード</span>
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(previewPayload, null, 2), 'payload')
                      }
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[10px]"
                    >
                      {copiedId === 'payload' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>コピー</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-300 font-mono overflow-x-auto max-h-40">
                    {JSON.stringify(previewPayload, null, 2)}
                  </pre>
                </div>
              </div>

              {/* 送信ボタン & アクション */}
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={handleSendRequest}
                  disabled={isRequesting || !budgetStatus.allowed}
                  className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    isRequesting || !budgetStatus.allowed
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                  }`}
                >
                  {isRequesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>外部AI (Gemini) に教材作成を依頼中...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>外部AI (Gemini) に教材作成を依頼する</span>
                    </>
                  )}
                </button>

                {!budgetStatus.allowed && (
                  <p className="text-[10px] text-rose-400 text-center mt-1.5">
                    ⚠️ 予算上限に達しているため送信できません
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. 生成結果 & 二重検証レポート */}
      {requestResult && (
        <div
          className={`p-4 rounded-xl border ${
            requestResult.success
              ? 'bg-emerald-950/30 border-emerald-500/40'
              : 'bg-rose-950/30 border-rose-500/40'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {requestResult.success ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-emerald-200">
                  外部教師 教材生成・検証合格 & 中信頼教材として保存完了！
                </h4>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h4 className="text-sm font-bold text-rose-200">教材化リクエスト エラー</h4>
              </>
            )}
          </div>

          {requestResult.error && (
            <p className="text-xs text-rose-300 mb-3">{requestResult.error}</p>
          )}

          {requestResult.material && (
            <div className="space-y-3 bg-slate-950/80 p-3 rounded-lg border border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono">
                  source: external_teacher
                </span>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono">
                  reliability: medium (中信頼)
                </span>
                <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded font-mono">
                  安全境界・品質フィルタ検証済
                </span>
                {requestResult.savedSkeleton && (
                  <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded font-mono flex items-center gap-1">
                    <span>9章 対策骨格生成:</span>
                    <strong className="text-white">{requestResult.savedSkeleton.pattern_id}</strong>
                  </span>
                )}
                {requestResult.generalizationGapRecorded && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-mono">
                    ⚠️ 32章 不足能力レジストリ(汎化不足)に自動登録
                  </span>
                )}
                {requestResult.verifiedEffective !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono ${
                      requestResult.verifiedEffective
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {requestResult.verifiedEffective ? '🧪 13章端末効果検証合格' : '⚠️ 汎化不足(要改善)'}
                    {requestResult.verificationNote && ` [${requestResult.verificationNote}]`}
                  </span>
                )}
              </div>

              <div>
                <div className="text-[11px] text-slate-400 font-semibold mb-0.5">
                  生成された指示文 (Instruction)
                </div>
                <div className="text-slate-200 bg-slate-900 p-2 rounded border border-slate-800">
                  {requestResult.material.instruction}
                </div>
              </div>

              {requestResult.material.inputContext && (
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold mb-0.5">
                    文脈・前提 (Input Context)
                  </div>
                  <div className="text-slate-300 bg-slate-900 p-2 rounded border border-slate-800">
                    {requestResult.material.inputContext}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] text-slate-400 font-semibold mb-0.5">
                  模範正解 (Output Target)
                </div>
                <pre className="text-emerald-300 bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {requestResult.material.outputTarget}
                </pre>
              </div>

              {requestResult.material.reasoningExplanation && (
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold mb-0.5">
                    解説 (Reasoning)
                  </div>
                  <div className="text-slate-300 text-[11px] italic bg-slate-900 p-2 rounded border border-slate-800">
                    {requestResult.material.reasoningExplanation}
                  </div>
                </div>
              )}

              {onJumpToColab && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={onJumpToColab}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Colab連携タブでLoRA教材を確認</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3.5. オフライン遅延送信キュー (設計思想 11章 睡眠ゲート ＆ 20章 不確実性連携) */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-slate-200">
                オフライン遅延送信キュー (11章 睡眠ゲート ＆ 20章 不確実性連携)
              </h4>
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full text-[10px] font-bold">
                {delayedQueue.length} 件
              </span>
              {delayedQueue.filter((q) => q.status === 'PENDING').length > 0 && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[10px] font-bold">
                  待機中: {delayedQueue.filter((q) => q.status === 'PENDING').length} 件
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              会話中の判断ブレや未解決要請を一時退避し、深夜・充電中・Wi-Fi接続時（深い睡眠バッチ）に外部教師から対策骨格と教材を一括安全取得します
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEnqueueSample}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>テスト要請追加</span>
            </button>
            <button
              onClick={handleRunBatchNow}
              disabled={isProcessingQueue || delayedQueue.filter((q) => q.status === 'PENDING').length === 0}
              className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 font-medium transition-colors ${
                isProcessingQueue || delayedQueue.filter((q) => q.status === 'PENDING').length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isProcessingQueue ? 'バッチ処理中...' : '今すぐバッチ実行'}</span>
            </button>
            {delayedQueue.length > 0 && (
              <button
                onClick={handleClearQueue}
                title="キューを全件消去"
                className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {batchNotice && (
          <div className="mb-3 px-3 py-2 bg-cyan-950/40 border border-cyan-500/30 rounded text-xs text-cyan-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{batchNotice}</span>
          </div>
        )}

        {delayedQueue.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
            現在待機中の遅延教師要請はありません。20章不確実性テストまたは上記ボタンから追加できます。
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {delayedQueue.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'PENDING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : item.status === 'PROCESSING'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : item.status === 'PROCESSED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {item.status === 'PENDING'
                        ? '待機中 (深い睡眠待ち)'
                        : item.status === 'PROCESSING'
                        ? '処理中...'
                        : item.status === 'PROCESSED'
                        ? '完了 (骨格・教材反映済)'
                        : '失敗'}
                    </span>

                    <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">
                      {item.source === 'uncertainty_divergence'
                        ? '20章 不確実性ブレ'
                        : item.source === 'failure_recurrence'
                        ? '37章 失敗再発'
                        : '手動追加'}
                    </span>

                    <span className="text-[10px] text-slate-400 font-mono">
                      対象: {item.targetCapabilityId}
                    </span>

                    {item.uncertaintyScore !== undefined && (
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-[10px]">
                        ブレ度: {item.uncertaintyScore}点
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.enqueuedAt).toLocaleTimeString()}
                    </span>
                    <button
                      onClick={() => handleRemoveQueueItem(item.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="この項目を削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-200">
                  {item.anonymizedPrompt || item.userPrompt}
                </div>

                {item.divergenceTypes && item.divergenceTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center text-[10px]">
                    <span className="text-slate-500">検出乖離:</span>
                    {item.divergenceTypes.map((dt) => (
                      <span
                        key={dt}
                        className="px-1.5 py-0.2 bg-slate-800 text-amber-300/80 rounded border border-slate-700"
                      >
                        {dt}
                      </span>
                    ))}
                  </div>
                )}

                {item.status === 'PROCESSED' && (
                  <div className="flex items-center gap-3 text-[10px] text-emerald-400 bg-emerald-950/20 px-2 py-1 rounded border border-emerald-500/20">
                    <span>✓ 処理完了: {new Date(item.processedAt || 0).toLocaleTimeString()}</span>
                    {item.resultSkeletonId && <span>生成骨格: {item.resultSkeletonId}</span>}
                    {item.verificationPassed !== undefined && (
                      <span>
                        13章端末検証: {item.verificationPassed ? '合格(効果確認)' : '汎化不足検知'}
                      </span>
                    )}
                  </div>
                )}

                {item.status === 'FAILED' && item.errorMessage && (
                  <div className="text-[10px] text-red-400 bg-red-950/20 px-2 py-1 rounded border border-red-500/20">
                    エラー: {item.errorMessage} (試行回数: {item.retryCount})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. 外部教師経由の蓄積教材リスト */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-slate-200">
              外部教師 (external_teacher) 経由で蓄積された教材
            </h4>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
              {externalSamples.length} 件
            </span>
          </div>
          {onJumpToColab && (
            <button
              onClick={onJumpToColab}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Colab用JSONLエクスポートへ</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {externalSamples.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            外部教師経由で登録された教材はまだありません。
          </div>
        ) : (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {externalSamples.map((sample) => (
              <div
                key={sample.id}
                className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px] uppercase">
                      {sample.category}
                    </span>
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-mono">
                      medium (中信頼)
                    </span>
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-mono">
                      source: external_teacher
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(sample.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="font-semibold text-slate-200 mb-1">{sample.instruction}</div>
                <div className="text-slate-400 line-clamp-2 font-mono text-[11px] bg-slate-900 p-1.5 rounded">
                  {sample.outputTarget}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. 外部教師利用記録 (Teacher Usage Records) */}
      {usageRecords.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>外部教師 呼び出し履歴ログ ({usageRecords.length} 件)</span>
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-[11px]">
            {usageRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-2 bg-slate-950/60 border border-slate-800/80 rounded flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${rec.success ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  />
                  <span className="text-slate-300 font-medium">
                    [{rec.category}] 生成: {rec.generatedCount}件 (合格: {rec.verifiedCount}件)
                  </span>
                  {rec.notes && <span className="text-slate-500 line-clamp-1">- {rec.notes}</span>}
                </div>
                <div className="text-slate-500 font-mono text-[10px] shrink-0">
                  {new Date(rec.timestamp).toLocaleTimeString()} ({rec.promptTokens + rec.outputTokens} t)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
