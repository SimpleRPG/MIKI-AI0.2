import {
  SelfImprovementRecord,
  TrainingSampleJSONL,
  TrainingDataSplitStats,
  ModelGeneration,
  MemoryItem,
  ChatMessage,
  SkillItem,
  RegressionSuiteRunReport,
  RejectedTrainingSampleLog,
  ReviewQueueItem,
  ModelSizeComparisonReport,
  FailureRecurrenceEntry,
} from '../types';

export type { FailureRecurrenceEntry };
import { nativeLlmService } from './nativeLlmService';
import { webLLMService } from './webLlmService';
import { systemLogger } from './systemLogger';
import { storageService } from './storageService';
import { regressionBenchmarkService } from './regressionBenchmarkService';
import { nativeBackgroundService } from './nativeBackgroundService';
import { checkSampleSafety, generateSafeExcerptHash } from '../utils/trainingSampleSafetyFilter';

const RECORDS_STORAGE_KEY = 'miki_ai_self_improvement_records';
const TRAINING_DATA_STORAGE_KEY = 'miki_ai_training_samples';
const MODEL_GENERATIONS_KEY = 'miki_ai_model_generations';
const TRAINING_THRESHOLD_KEY = 'miki_ai_training_threshold';
const LAST_NOTIFIED_THRESHOLD_KEY = 'miki_ai_training_notified_count';
const FAILURE_RECURRENCES_KEY = 'miki_ai_failure_recurrences';
const REJECTED_SAMPLES_LOG_KEY = 'miki_ai_rejected_samples_log';
const REVIEW_QUEUE_KEY = 'miki_ai_review_queue';

/**
 * 初期モデル世代リスト (設計思想 18. 系統樹 & 25. 安全・品質境界)
 * フェイク数値を排し、基準ベースモデルのみの初期状態からスタートします。
 */
export const INITIAL_GENERATIONS: ModelGeneration[] = [
  {
    generationId: 'gen_v1_0_base',
    modelName: 'Qwen 2.5 Coder 1.5B (Base Stable)',
    baseModel: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
    version: 'v1.0.0',
    branch: 'stable',
    parameterCount: 1.5e9, // 1.5B パラメータ
    loraRank: 0,
    trainingSamplesCount: 0,
    status: 'active',
    benchmarkScore: undefined, // 実測未実施
    notes: '基準安定版（初期1.5Bベースモデル）。Colab等でLoRA学習・量子化した新世代モデルをインポートすると系統樹に追加されます。',
    createdAt: Date.now(),
  },
  {
    generationId: 'gen_v2_0_candidate_3b',
    modelName: 'Qwen 2.5 Coder 3B (Candidate)',
    baseModel: 'Qwen/Qwen2.5-Coder-3B-Instruct',
    version: 'v2.0.0-candidate',
    branch: 'experimental',
    parameterCount: 3.0e9, // 3.0B パラメータ (フェーズ6 モデルサイズ比較対象)
    loraRank: 0,
    trainingSamplesCount: 0,
    status: 'shadow_testing',
    benchmarkScore: undefined,
    notes: 'フェーズ6 モデルサイズ比較用 3B候補モデル。1.5Bとの品質・速度・発熱・メモリ総合検証対象。',
    createdAt: Date.now(),
  },
];

class SelfImprovementService {
  private records: SelfImprovementRecord[] = [];
  private trainingSamples: TrainingSampleJSONL[] = [];
  private generations: ModelGeneration[] = [];
  private failureRecurrences: Map<string, FailureRecurrenceEntry> = new Map();
  private rejectedSamplesLog: RejectedTrainingSampleLog[] = [];
  private reviewQueue: ReviewQueueItem[] = [];

  constructor() {
    this.loadAll();
  }

  private loadAll(): void {
    if (typeof storageService !== 'undefined') {
      try {
        const rawRec = storageService.getItem(RECORDS_STORAGE_KEY);
        if (rawRec) this.records = JSON.parse(rawRec);

        const rawTrain = storageService.getItem(TRAINING_DATA_STORAGE_KEY);
        if (rawTrain) {
          const parsed: TrainingSampleJSONL[] = JSON.parse(rawTrain);
          // 互換性担保: 既存サンプルに split がなければ 'train' をデフォルト設定
          this.trainingSamples = parsed.map((s) => ({
            ...s,
            split: s.split || 'train',
          }));
        }

        const rawGen = storageService.getItem(MODEL_GENERATIONS_KEY);
        if (rawGen) {
          const parsedGen: ModelGeneration[] = JSON.parse(rawGen);
          this.generations = parsedGen.map((g) => {
            if (!g.parameterCount) {
              const nameLower = (g.modelName + ' ' + g.baseModel).toLowerCase();
              if (nameLower.includes('3b')) return { ...g, parameterCount: 3.0e9 };
              if (nameLower.includes('0.5b')) return { ...g, parameterCount: 0.5e9 };
              if (nameLower.includes('7b')) return { ...g, parameterCount: 7.0e9 };
              return { ...g, parameterCount: 1.5e9 };
            }
            return g;
          });
          // 3B候補モデルが存在しない場合は追加
          if (!this.generations.some((g) => g.parameterCount && g.parameterCount >= 2.5e9)) {
            this.generations.push(INITIAL_GENERATIONS[1]);
            this.saveGenerations();
          }
        } else {
          this.generations = [...INITIAL_GENERATIONS];
          this.saveGenerations();
        }

        const rawRecurrences = storageService.getItem(FAILURE_RECURRENCES_KEY);
        if (rawRecurrences) {
          const arr: FailureRecurrenceEntry[] = JSON.parse(rawRecurrences);
          this.failureRecurrences = new Map(arr.map((e) => [e.patternKey, e]));
        }

        const rawRejected = storageService.getItem(REJECTED_SAMPLES_LOG_KEY);
        if (rawRejected) {
          this.rejectedSamplesLog = JSON.parse(rawRejected);
        }

        const rawReview = storageService.getItem(REVIEW_QUEUE_KEY);
        if (rawReview) {
          this.reviewQueue = JSON.parse(rawReview);
        }
      } catch (e) {
        console.warn('Failed to load self-improvement data:', e);
      }
    }
  }

  public saveRecords(): void {
    if (typeof storageService !== 'undefined') {
      try {
        storageService.setItem(RECORDS_STORAGE_KEY, JSON.stringify(this.records));
      } catch (e) {}
    }
  }

  public saveTrainingSamples(): void {
    if (typeof storageService !== 'undefined') {
      try {
        storageService.setItem(TRAINING_DATA_STORAGE_KEY, JSON.stringify(this.trainingSamples));
      } catch (e) {}
    }
  }

  public saveRejectedSamplesLog(): void {
    if (typeof storageService !== 'undefined') {
      try {
        storageService.setItem(REJECTED_SAMPLES_LOG_KEY, JSON.stringify(this.rejectedSamplesLog));
      } catch (e) {}
    }
  }

  public saveReviewQueue(): void {
    if (typeof storageService !== 'undefined') {
      try {
        storageService.setItem(REVIEW_QUEUE_KEY, JSON.stringify(this.reviewQueue));
      } catch (e) {}
    }
  }

  public getRejectedSamplesLog(): RejectedTrainingSampleLog[] {
    return this.rejectedSamplesLog;
  }

  public getRejectedSamplesCount(): number {
    return this.rejectedSamplesLog.length;
  }

  public getReviewQueue(): ReviewQueueItem[] {
    return this.reviewQueue;
  }

  public getReviewQueueCount(): number {
    return this.reviewQueue.length;
  }

  public approveReviewQueueItem(id: string): TrainingSampleJSONL | null {
    const idx = this.reviewQueue.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    const item = this.reviewQueue[idx];
    this.reviewQueue.splice(idx, 1);
    this.saveReviewQueue();

    const newSample: TrainingSampleJSONL = {
      id: 'train_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      instruction: item.instruction,
      inputContext: item.inputContext,
      outputTarget: item.outputTarget,
      category: (item.category as any) || 'chat',
      reliability: 'high',
      approved: true,
      split: 'train',
      createdAt: Date.now(),
    };
    this.trainingSamples.unshift(newSample);
    this.saveTrainingSamples();
    this.checkTrainingThreshold();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `✅ [要確認キュー承認] サンプルを学習データセットに追加しました (ID: ${item.id})`
    );
    return newSample;
  }

  public dismissReviewQueueItem(id: string): boolean {
    const idx = this.reviewQueue.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    this.reviewQueue.splice(idx, 1);
    this.saveReviewQueue();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🗑️ [要確認キュー却下] サンプルを保留キューから除外しました (ID: ${id})`
    );
    return true;
  }

  public clearReviewQueue(): void {
    this.reviewQueue = [];
    this.saveReviewQueue();
  }

  public getRedactedSamplesCount(): number {
    return this.trainingSamples.filter((s) => s.redacted).length;
  }

  public clearRejectedSamplesLog(): void {
    this.rejectedSamplesLog = [];
    this.saveRejectedSamplesLog();
  }

  public saveGenerations(): void {
    if (typeof storageService !== 'undefined') {
      try {
        storageService.setItem(MODEL_GENERATIONS_KEY, JSON.stringify(this.generations));
      } catch (e) {}
    }
  }

  public saveFailureRecurrences(): void {
    if (typeof storageService !== 'undefined') {
      try {
        const arr = Array.from(this.failureRecurrences.values());
        storageService.setItem(FAILURE_RECURRENCES_KEY, JSON.stringify(arr));
      } catch (e) {}
    }
  }

  public getRecords(): SelfImprovementRecord[] {
    return this.records;
  }

  /**
   * 学習サンプル一覧を取得 (スプリット別フィルタ対応)
   * 設計思想 7. 学習データの改善 (train / validation / test 分離)
   */
  public getTrainingSamples(split?: 'train' | 'validation' | 'test' | 'all'): TrainingSampleJSONL[] {
    if (!split || split === 'all') {
      return this.trainingSamples;
    }
    return this.trainingSamples.filter((s) => (s.split || 'train') === split);
  }

  public getGenerations(): ModelGeneration[] {
    if (this.generations.length === 0) {
      this.generations = [...INITIAL_GENERATIONS];
    }
    return this.generations;
  }

  /**
   * 失敗原因の自動診断ロジック本体 (副作用なし・純粋関数)
   * モーダルのプレビュー表示など、記録を残さず計算結果だけ欲しい場合はこちらを使う。
   * 設計思想 9. メタ学習 & 14. タスク計画
   */
  public computeDiagnosis(
    userMessage: string,
    assistantResponse: string,
    errorDetails?: string,
    contextInfo?: {
      memoriesUsedCount: number;
      promptLengthChars: number;
      engineMode: string;
      modelId?: string;
    }
  ): {
    category: string;
    rootCause: string;
    suggestedFixArea: 'memory' | 'retrieval' | 'prompt' | 'skill' | 'tool' | 'model' | 'no_change';
    recommendation: string;
  } {
    const err = (errorDetails || '').toLowerCase();
    const resp = assistantResponse.toLowerCase();
    const promptLen = contextInfo?.promptLengthChars || 0;

    // 1. コンテキスト長オーバーフロー
    if (err.includes('context') || err.includes('overflow') || err.includes('decode') || promptLen > 3500) {
      return {
        category: 'コンテキスト長超過 (Context Overflow)',
        rootCause: '会話履歴・添付コード・記憶の合算がモデルのコンテキスト予算を超過しました。',
        suggestedFixArea: 'retrieval',
        recommendation: '記憶検索の取得件数を絞り込むか、古い会話履歴を要約してプロンプト予算を圧縮してください。',
      };
    }

    // 2. 記憶不足・事実の食い違い
    if (
      userMessage.includes('覚えてる') ||
      userMessage.includes('前の話') ||
      userMessage.includes('約束') ||
      userMessage.includes('名前は') ||
      userMessage.includes('設定した')
    ) {
      if (contextInfo?.memoriesUsedCount === 0) {
        return {
          category: '記憶検索の不一致 (Retrieval Miss)',
          rootCause: '関連する記憶が端末ストレージに存在するものの、検索クエリに合致せず取得されませんでした。',
          suggestedFixArea: 'retrieval',
          recommendation: '記憶にタグや同義語を追加するか、バイグラム検索の重みを調整してください。',
        };
      }
      return {
        category: '記憶の未登録 (Memory Missing)',
        rootCause: 'ユーザーの過去の意図や事実が記憶に登録されていませんでした。',
        suggestedFixArea: 'memory',
        recommendation: '「かんたんAI教育」または会話から確定事実を記憶として登録してください。',
      };
    }

    // 3. コード文法エラーや複雑なゲームロジックの破綻
    if (
      resp.includes('syntaxerror') ||
      resp.includes('uncaught') ||
      resp.includes('not defined') ||
      userMessage.includes('動かない') ||
      userMessage.includes('エラーが出る') ||
      userMessage.includes('バグ')
    ) {
      return {
        category: 'コード生成・修復の論理破綻 (Code Logic Bug)',
        rootCause: '小型モデル単体の推論力だけでは、依存関係の長い構文やCanvas座標系を正しく処理できませんでした。',
        suggestedFixArea: 'skill',
        recommendation: '「Canvasデバッグスキル」や「構文検証パーサー」の手続きをプロンプトにインジェクトするか、Colabでのコード修復教材でモデルを専門化してください。',
      };
    }

    // 4. 口調やキャラ崩れ
    if (resp.includes('承知いたしました') || resp.includes('申し訳ございません') || resp.includes('人工知能')) {
      return {
        category: '口調・ペルソナ崩れ (Robotic Regression)',
        rootCause: '小型モデルの事前学習重みが強く出て、ロボット的な敬語や定型文に逆戻りしました。',
        suggestedFixArea: 'prompt',
        recommendation: 'プロンプト内の「脱ロボット辞書」の優先順位を上げ、システム指示の末尾にタメ口制約を再バインドしてください。',
      };
    }

    // 5. モデルの表現力上限
    return {
      category: '小型モデル表現力の限界 (Model Capacity Limit)',
      rootCause: '現在の1.5B/0.5Bモデルでは、高度な文脈追従や複雑な複数条件の同時処理が困難でした。',
      suggestedFixArea: 'model',
      recommendation: 'この失敗ケースをJSONL学習データとして保存し、Colab環境でのLoRA学習データセットに含めてください。',
    };
  }

  /**
   * 失敗原因の自動診断 & 改善先ルーター (this.records へ永続化する版)
   * ユーザーからの実際の👎フィードバック等、「1回の失敗イベント」につき1回だけ呼ぶこと。
   * プレビュー表示など繰り返し呼ばれる可能性がある箇所では computeDiagnosis() を使うこと。
   */
  public diagnoseFailure(
    userMessage: string,
    assistantResponse: string,
    errorDetails?: string,
    contextInfo?: {
      memoriesUsedCount: number;
      promptLengthChars: number;
      engineMode: string;
      modelId?: string;
    }
  ): {
    category: string;
    rootCause: string;
    suggestedFixArea: 'memory' | 'retrieval' | 'prompt' | 'skill' | 'tool' | 'model' | 'no_change';
    recommendation: string;
  } {
    const diagnosis = this.computeDiagnosis(userMessage, assistantResponse, errorDetails, contextInfo);

    const record: SelfImprovementRecord = {
      id: 'diag_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      type: 'failure_diagnosis',
      targetArea: diagnosis.suggestedFixArea,
      hypothesis: diagnosis.category,
      baseline: userMessage,
      candidate: assistantResponse,
      result: 'inconclusive',
      adopted: false,
    };
    this.records.unshift(record);
    this.saveRecords();

    return diagnosis;
  }

  /**
   * 蓄積された診断記録の削除 (設計思想 25. 安全・品質境界)
   */
  public clearRecords(): void {
    this.records = [];
    this.saveRecords();
  }

  /**
   * 改善対象領域(記憶/検索/プロンプト/スキル/モデル)別の蓄積件数
   * SelfImprovementModal での「どの改善対象が繰り返し問題になっているか」表示に使用
   */
  public getRecordCountsByArea(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const rec of this.records) {
      counts[rec.targetArea] = (counts[rec.targetArea] || 0) + 1;
    }
    return counts;
  }

  /**
   * ユーザーからの👎フィードバックや会話の成功を学習用JSONLに追加
   * 設計思想 7. 学習データの改善 (train / validation / test 分離) & 25. 安全・品質境界
   */
  public addTrainingSample(sample: {
    instruction: string;
    inputContext?: string;
    outputTarget: string;
    category?: TrainingSampleJSONL['category'];
    reliability?: TrainingSampleJSONL['reliability'];
    source?: TrainingSampleJSONL['source'];
    approved?: boolean;
    split?: 'train' | 'validation' | 'test';
    originalFailureOutput?: string;
    failureReason?: string;
  }): TrainingSampleJSONL | null {
    // 1. コンテンツ安全境界チェック (設計思想 25. 安全・品質境界)
    // 既存のcleanAndDeduplicateSamplesより前に必ず実行
    const safety = checkSampleSafety(sample.instruction, sample.outputTarget);

    if (!safety.safe) {
      // safe: false の場合: 本文は保存せず理由とハッシュだけ記録
      const excerptHash = generateSafeExcerptHash(sample.instruction + '|||' + sample.outputTarget);
      const rejectedLog: RejectedTrainingSampleLog = {
        id: 'rej_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        timestamp: Date.now(),
        reasons: safety.reasons,
        excerptHash,
        category: sample.category || 'chat',
      };
      this.rejectedSamplesLog.unshift(rejectedLog);
      this.saveRejectedSamplesLog();

      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `🛡️ [安全境界ガード] 危険/不適切コンテンツを検知したため教材追加を除外しました (理由: ${safety.reasons.join(', ')}, ハッシュ: ${excerptHash})`
      );
      return null;
    }

    if (safety.needsReview) {
      // needsReview: true の場合: 第3分類 (TRPG等のフィクション文脈)
      // 学習データ(trainingSamples)および除外ログ(rejectedSamplesLog)には含めず、
      // 別の reviewQueue に振り分け
      const reviewItem: ReviewQueueItem = {
        id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        instruction: safety.redactedUserText ?? sample.instruction,
        inputContext: sample.inputContext,
        outputTarget: safety.redactedAssistantText ?? sample.outputTarget,
        category: sample.category || 'chat',
        reasons: safety.reasons,
        createdAt: Date.now(),
      };
      this.reviewQueue.unshift(reviewItem);
      this.saveReviewQueue();

      systemLogger.info(
        'SELF_IMPROVEMENT',
        `📝 [要確認キュー (第3分類)] フィクション文脈内の表現を検知したためreviewQueueに保留しました (理由: ${safety.reasons.join(', ')})`
      );
      return null;
    }

    // 伏字化されたテキストがある場合は、伏字化後のテキストを保存
    const finalInstruction = safety.redactedUserText ?? sample.instruction;
    const finalOutputTarget = safety.redactedAssistantText ?? sample.outputTarget;
    const isRedacted = Boolean(safety.redacted);

    // 外部教師(external_teacher)経由は無条件で正解とせず中信頼扱いとする (設計方針 39節)
    const effectiveReliability: TrainingSampleJSONL['reliability'] = sample.reliability
      ? sample.reliability
      : sample.source === 'external_teacher'
      ? 'medium'
      : 'high';

    const newSample: TrainingSampleJSONL = {
      id: 'train_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      instruction: finalInstruction,
      inputContext: sample.inputContext,
      outputTarget: finalOutputTarget,
      category: sample.category || 'chat',
      reliability: effectiveReliability,
      source: sample.source || 'local_user',
      approved: sample.approved ?? true,
      split: sample.split || 'train',
      originalFailureOutput: sample.originalFailureOutput,
      failureReason: sample.failureReason,
      redacted: isRedacted,
      redactedReasons: isRedacted ? safety.reasons : undefined,
      createdAt: Date.now(),
    };

    this.trainingSamples.unshift(newSample);
    this.saveTrainingSamples();
    this.checkTrainingThreshold();

    if (isRedacted) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🔒 [個人情報伏字化完了] 電話番号/メール/住所等の個人情報を [REDACTED] に置換して保存しました (理由: ${safety.reasons.join(', ')})`
      );
    }

    return newSample;
  }

  /**
   * 特定サンプルのデータスプリットを変更 (train / validation / test)
   */
  public updateSampleSplit(idOrIndex: string | number, split: 'train' | 'validation' | 'test'): boolean {
    let sample: TrainingSampleJSONL | undefined;
    if (typeof idOrIndex === 'number') {
      sample = this.trainingSamples[idOrIndex];
    } else {
      sample = this.trainingSamples.find((s) => s.id === idOrIndex);
    }
    if (!sample) return false;
    sample.split = split;
    this.saveTrainingSamples();
    return true;
  }

  /**
   * 学習・検証・テストデータの分割統計を取得
   * 設計思想 7. 学習データの改善 & 評価信頼性 (データリーク防止)
   */
  public getSplitStats(): TrainingDataSplitStats {
    const approved = this.trainingSamples.filter((s) => s.approved);
    const total = approved.length;
    let train = 0;
    let validation = 0;
    let test = 0;
    let unassigned = 0;

    for (const s of approved) {
      if (s.split === 'train') train++;
      else if (s.split === 'validation') validation++;
      else if (s.split === 'test') test++;
      else unassigned++;
    }

    const effectiveTrain = train + unassigned;
    const vRatio = total > 0 ? Math.round((validation / total) * 100) : 0;
    return {
      total,
      train: effectiveTrain,
      validation,
      test,
      unassigned,
      trainRatio: total > 0 ? Math.round((effectiveTrain / total) * 100) : 0,
      valRatio: vRatio,
      validationRatio: vRatio,
      testRatio: total > 0 ? Math.round((test / total) * 100) : 0,
    };
  }

  /**
   * 承認済み学習データを指定比率（デフォルト 8:1:1）で自動分割
   * 設計思想 7. 学習データの改善 (Train 80% / Val 10% / Test 10%)
   */
  public autoAssignSplits(ratio: { train: number; val: number; test: number } = { train: 0.8, val: 0.1, test: 0.1 }): TrainingDataSplitStats {
    const approved = this.trainingSamples.filter((s) => s.approved);
    if (approved.length === 0) {
      return this.getSplitStats();
    }

    // シャッフルして偏りを防ぐ
    const shuffled = [...approved].sort(() => Math.random() - 0.5);
    const total = shuffled.length;
    const trainCount = Math.max(1, Math.round(total * ratio.train));
    const valCount = Math.max(total > 2 ? 1 : 0, Math.round(total * ratio.val));

    shuffled.forEach((sample, idx) => {
      if (idx < trainCount) {
        sample.split = 'train';
      } else if (idx < trainCount + valCount) {
        sample.split = 'validation';
      } else {
        sample.split = 'test';
      }
    });

    this.saveTrainingSamples();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📊 [データ分割完了] 全${total}件を自動分配: Train ${trainCount}件, Val ${valCount}件, Test ${total - trainCount - valCount}件`
    );
    return this.getSplitStats();
  }

  /**
   * 失敗パターンの再現性追跡 & 一過性ノイズ排除ガード
   * 設計思想 9. ベンチマークと退行テスト & 25. 安全・品質境界
   * 1回の偶発的な失敗で即サンプル化するのを防ぎ、同一パターンが2回以上再現された場合のみ昇格可能とする
   */
  public recordOrCheckFailureRecurrence(failure: {
    prompt: string;
    category: string;
    reason?: string;
  }): {
    recurrenceCount: number;
    isActionable: boolean;
    patternKey: string;
    entry: FailureRecurrenceEntry;
  } {
    // プロンプトの先頭とカテゴリから正規化キーを生成
    const normPrompt = failure.prompt.trim().replace(/\s+/g, ' ').toLowerCase();
    const shortPromptKey = normPrompt.slice(0, 40);
    const patternKey = `${failure.category}:::${shortPromptKey}`;

    let entry = this.failureRecurrences.get(patternKey);
    const now = Date.now();

    if (!entry) {
      entry = {
        patternKey,
        category: failure.category,
        firstSeenAt: now,
        lastSeenAt: now,
        recurrenceCount: 1,
        samplePrompt: failure.prompt,
        promotedToTraining: false,
        notes: failure.reason,
      };
      this.failureRecurrences.set(patternKey, entry);
      this.saveFailureRecurrences();

      systemLogger.info(
        'SELF_IMPROVEMENT',
        `⏳ [一過性失敗ガード] 初回失敗検知 (保留: 1/2回)。再発を待機します: 「${failure.prompt.slice(0, 25)}...」`
      );

      return {
        recurrenceCount: 1,
        isActionable: false,
        patternKey,
        entry,
      };
    } else {
      entry.recurrenceCount += 1;
      entry.lastSeenAt = now;
      if (failure.reason) entry.notes = failure.reason;
      this.saveFailureRecurrences();

      // 2回以上再現し、かつ未昇格であればアクション可能（学習データ化を承認）
      const isActionable = entry.recurrenceCount >= 2 && !entry.promotedToTraining;

      if (isActionable) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `🚨 [再現性確認] 弱点パターンが再発しました (再現: ${entry.recurrenceCount}回) ➔ 学習プールへ昇格承認: 「${failure.prompt.slice(0, 25)}...」`
        );
      }

      return {
        recurrenceCount: entry.recurrenceCount,
        isActionable,
        patternKey,
        entry,
      };
    }
  }

  /**
   * 失敗パターンの学習データ昇格済みフラグを記録
   */
  public markFailurePromoted(patternKey: string): void {
    const entry = this.failureRecurrences.get(patternKey);
    if (entry) {
      entry.promotedToTraining = true;
      this.saveFailureRecurrences();
    }
  }

  public getFailureRecurrences(): FailureRecurrenceEntry[] {
    return Array.from(this.failureRecurrences.values());
  }

  public clearFailureRecurrences(): void {
    this.failureRecurrences.clear();
    this.saveFailureRecurrences();
  }

  public deleteTrainingSample(id: string): void {
    this.trainingSamples = this.trainingSamples.filter((s) => s.id !== id);
    this.saveTrainingSamples();
  }

  /**
   * 学習教材蓄積しきい値設定 (デフォルト: 25件)
   * 設計思想 7: 一定量たまったら学習を自動トリガー・提示
   */
  public getTrainingThreshold(): number {
    if (typeof storageService !== 'undefined') {
      const val = storageService.getItem(TRAINING_THRESHOLD_KEY);
      if (val) {
        const num = Number(val);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return 25;
  }

  public setTrainingThreshold(threshold: number): void {
    if (typeof storageService !== 'undefined') {
      storageService.setItem(TRAINING_THRESHOLD_KEY, String(threshold));
    }
  }

  /**
   * 学習サンプル件数がしきい値に達したか判定
   */
  public checkTrainingThreshold(): {
    thresholdReached: boolean;
    currentCount: number;
    threshold: number;
    unnotified: boolean;
  } {
    const approvedCount = this.trainingSamples.filter((s) => s.approved).length;
    const threshold = this.getTrainingThreshold();
    const thresholdReached = approvedCount >= threshold;

    let lastNotified = 0;
    if (typeof storageService !== 'undefined') {
      const stored = storageService.getItem(LAST_NOTIFIED_THRESHOLD_KEY);
      if (stored) lastNotified = Number(stored) || 0;
    }

    const unnotified = thresholdReached && approvedCount >= lastNotified + threshold;

    if (unnotified) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🎯 [学習トリガー] 承認済み学習データがしきい値(${approvedCount}/${threshold}件)に到達しました。Colab学習または新世代GGUFのインポートを推奨します。`
      );

      // 実機Android通知 / ローカル通知の発火 (設計思想 7. 一定量たまったら学習を提示 & 23. Android実機通知)
      nativeBackgroundService
        .sendLocalNotification({
          id: 7001,
          title: '🎯 みきの学習データが目標蓄積数に到達！',
          body: `承認済み学習データが${approvedCount}件(${threshold}件目標)に達しました。タップしてLoRA学習スクリプトやエクスポートを確認しよう！`,
          data: {
            action: 'open_self_improvement',
            tab: 'colab',
          },
        })
        .catch((err) => {
          console.warn('Failed to dispatch training threshold notification:', err);
        });

      this.markTrainingThresholdNotified();
    }

    return {
      thresholdReached,
      currentCount: approvedCount,
      threshold,
      unnotified,
    };
  }

  public markTrainingThresholdNotified(): void {
    if (typeof storageService !== 'undefined') {
      const approvedCount = this.trainingSamples.filter((s) => s.approved).length;
      storageService.setItem(LAST_NOTIFIED_THRESHOLD_KEY, String(approvedCount));
    }
  }

  /**
   * DPO/LoRA学習サンプルの自動クリーンアップ・重複除去
   * (名ばかりの空処理を排し、内容の正規化・重複排除・低品質サンプルの刈り込みを実際に実行)
   * 設計思想 7. 学習データの改善 & 11. バックグラウンド自己対話
   */
  public cleanAndDeduplicateSamples(): {
    beforeCount: number;
    afterCount: number;
    removedDuplicates: number;
    prunedLowQuality: number;
    prunedUnsafe: number;
    sanitizedRedacted: number;
  } {
    const beforeCount = this.trainingSamples.length;
    const seenInstructions = new Map<string, TrainingSampleJSONL>();
    let removedDuplicates = 0;
    let prunedLowQuality = 0;
    let prunedUnsafe = 0;
    let sanitizedRedacted = 0;

    for (const sample of this.trainingSamples) {
      // 0. 安全境界ガード: 既存サンプル内の危険・有害コンテンツ検知
      const safety = checkSampleSafety(sample.instruction, sample.outputTarget);
      if (!safety.safe) {
        const excerptHash = generateSafeExcerptHash(sample.instruction + '|||' + sample.outputTarget);
        this.rejectedSamplesLog.unshift({
          id: 'rej_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          timestamp: Date.now(),
          reasons: safety.reasons,
          excerptHash,
          category: sample.category || 'chat',
        });
        prunedUnsafe++;
        continue;
      }

      if (safety.needsReview) {
        // フィクション文脈での保留: reviewQueueに退避し、通常の学習サンプルからは除外
        this.reviewQueue.unshift({
          id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          instruction: safety.redactedUserText ?? sample.instruction,
          inputContext: sample.inputContext,
          outputTarget: safety.redactedAssistantText ?? sample.outputTarget,
          category: sample.category || 'chat',
          reasons: safety.reasons,
          createdAt: Date.now(),
        });
        prunedUnsafe++;
        continue;
      }

      let currentInst = sample.instruction;
      let currentOut = sample.outputTarget;
      let isRedacted = sample.redacted || false;
      let redactedReasons = sample.redactedReasons;

      if (safety.redacted) {
        currentInst = safety.redactedUserText ?? currentInst;
        currentOut = safety.redactedAssistantText ?? currentOut;
        isRedacted = true;
        redactedReasons = safety.reasons;
        sanitizedRedacted++;
      }

      const normInst = (currentInst || '').trim().replace(/\s+/g, ' ');
      const normOut = (currentOut || '').trim();

      // 品質フィルタ: 空または極小(5文字未満)、または同一入出力の自己矛盾サンプルを刈り込み
      if (!normInst || !normOut || normInst.length < 5 || normOut.length < 5) {
        prunedLowQuality++;
        continue;
      }

      if (normInst === normOut) {
        prunedLowQuality++;
        continue;
      }

      // 重複判定キー: 指示内容 + 入力コンテキスト
      const dedupeKey = normInst + '|||' + (sample.inputContext || '').trim();

      if (seenInstructions.has(dedupeKey)) {
        const existing = seenInstructions.get(dedupeKey)!;
        // 既存より信頼度が高いか、承認済みの場合は上書き
        if (!existing.approved && sample.approved) {
          seenInstructions.set(dedupeKey, {
            ...sample,
            instruction: normInst,
            outputTarget: normOut,
            redacted: isRedacted,
            redactedReasons,
          });
        }
        removedDuplicates++;
      } else {
        const normalizedSample: TrainingSampleJSONL = {
          ...sample,
          instruction: normInst,
          outputTarget: normOut,
          redacted: isRedacted,
          redactedReasons,
        };
        seenInstructions.set(dedupeKey, normalizedSample);
      }
    }

    if (prunedUnsafe > 0) {
      this.saveRejectedSamplesLog();
      this.saveReviewQueue();
    }

    this.trainingSamples = Array.from(seenInstructions.values());
    this.saveTrainingSamples();

    const afterCount = this.trainingSamples.length;

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🧹 [データセットクリーンアップ] 実行前: ${beforeCount}件 ➔ 実行後: ${afterCount}件 (重複除外: ${removedDuplicates}件, 低品質刈取: ${prunedLowQuality}件, 安全除外: ${prunedUnsafe}件, 伏字化置換: ${sanitizedRedacted}件)`
    );

    return {
      beforeCount,
      afterCount,
      removedDuplicates,
      prunedLowQuality,
      prunedUnsafe,
      sanitizedRedacted,
    };
  }

  /**
   * Colab / LoRA学習用のJSONLファイル出力 (スプリット指定対応)
   * 設計思想 7. 学習データの改善 (train / validation / test 分離 & リーク防止)
   */
  public exportTrainingJSONL(
    filterOnlyApproved: boolean = true,
    split?: 'train' | 'validation' | 'test' | 'all'
  ): string {
    let pool = filterOnlyApproved
      ? this.trainingSamples.filter((s) => s.approved)
      : this.trainingSamples;

    if (split && split !== 'all') {
      pool = pool.filter((s) => (s.split || 'train') === split);
    }

    const jsonlRows = pool.map((item) => {
      const messages = [
        {
          role: 'system',
          content: 'あなたはユーザー専属のAIパートナー「みき」です。自然な日本語のタメ口で、温かく親身に、高い開発能力を発揮して回答してください。',
        },
      ];

      if (item.inputContext) {
        messages.push({
          role: 'user',
          content: `【参照資料・記憶】\n${item.inputContext}\n\n【依頼】\n${item.instruction}`,
        });
      } else {
        messages.push({
          role: 'user',
          content: item.instruction,
        });
      }

      messages.push({
        role: 'assistant',
        content: item.outputTarget,
      });

      return JSON.stringify({
        id: item.id,
        category: item.category,
        reliability: item.reliability,
        split: item.split || 'train',
        messages,
      });
    });

    return jsonlRows.join('\n');
  }

  /**
   * Google Colab用のLoRA学習Pythonスクリプト(Unsloth / PEFT)を生成
   * 設計思想 1. Colab、学習、量子化、GGUF変換 & 7. 学習・検証・テスト分離
   */
  public generateColabTrainingScript(modelName: string = 'Qwen/Qwen2.5-Coder-1.5B-Instruct'): string {
    return `# ==============================================================================
# MIKI-AI 自己進化 Colab LoRA Fine-Tuning & GGUF 量子化スクリプト
# 設計思想 1. Colab、学習、量子化、GGUF変換 & 7. train / val / test 厳格分離
# ==============================================================================

# 1. 依存ライブラリのインストール (高速LoRA Unsloth / PEFT / llama.cpp)
!pip install --no-deps unsloth
!pip install --no-deps "xformers<0.0.29" "trl<0.9.0" peft accelerate bitsandbytes
!pip install datasets torch

import torch
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

# 2. ベースモデルの設定 (Galaxy S25推奨: 1.5B Q4_K_M)
max_seq_length = 2048
dtype = None # Auto detection
load_in_4bit = True # 4bit 量子化ベース

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "${modelName}",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)

# 3. LoRA アダプターの設定 (Rank 16-32)
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# 4. train / validation / test 分離データセットの読み込み (データリーク完全防止)
# アプリからエクスポートした train.jsonl / val.jsonl (または miki_dataset.jsonl) をアップロード
import os
if os.path.exists("train.jsonl") and os.path.exists("val.jsonl"):
    dataset = load_dataset("json", data_files={"train": "train.jsonl", "validation": "val.jsonl"})
else:
    raw_dataset = load_dataset("json", data_files={"train": "miki_dataset.jsonl"})["train"]
    dataset = raw_dataset.train_test_split(test_size=0.1, seed=3407)
    dataset["validation"] = dataset.pop("test")

def formatting_prompts_func(examples):
    convs = examples["messages"]
    texts = []
    for conv in convs:
        formatted = tokenizer.apply_chat_template(conv, tokenize=False, add_generation_prompt=False)
        texts.append(formatted)
    return { "text": texts }

train_dataset = dataset["train"].map(formatting_prompts_func, batched=True)
eval_dataset = dataset["validation"].map(formatting_prompts_func, batched=True)

# 5. SFT Trainer のセットアップ (Validation Lossのモニタリング)
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = train_dataset,
    eval_dataset = eval_dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    packing = False,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60,
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        evaluation_strategy = "steps",
        eval_steps = 10,
        save_strategy = "steps",
        save_steps = 30,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

# 6. 学習実行
trainer_stats = trainer.train()

# 7. GGUF形式 (q4_k_m) への自動量子化 & 保存 (Galaxy S25 実機最適)
model.save_pretrained_gguf("miki_model_gguf", tokenizer, quantization_method="q4_k_m")
print("✅ LoRA学習とQ4_K_M GGUF変換が完了しました！miki_model_gguf ディレクトリの .gguf ファイルをアプリにインポートしてください。")
`;
  }

  /**
   * 回帰テストレポートの測定対象モデルと、昇格対象のモデル世代が一致しているか判定
   * 別のモデルで取得した合格レポートを使って異なるモデルを昇格させる「評価のすり替え」を阻止する
   * 設計思想 25. 安全・品質境界 & 評価基準の改ざん防止
   */
  public checkModelReportMatch(
    report: RegressionSuiteRunReport,
    targetGen: ModelGeneration
  ): boolean {
    const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const normReportName = normalize(report.modelName);
    const normReportId = normalize(report.modelId);
    const normGenName = normalize(targetGen.modelName);
    const normGenBase = normalize(targetGen.baseModel);
    const normGenId = normalize(targetGen.generationId);
    const normGenNotes = normalize(targetGen.notes);

    // 1. 完全一致
    if (normReportName && normGenName && (normReportName === normGenName || normReportId === normGenName)) {
      return true;
    }

    // 2. 相互包含 (例: "miki_model_candidate_q4" と "miki_model_candidate_q4.gguf")
    if (normReportName && normGenName && (normReportName.includes(normGenName) || normGenName.includes(normReportName))) {
      return true;
    }
    if (normReportId && normGenName && (normReportId.includes(normGenName) || normGenName.includes(normReportId))) {
      return true;
    }

    // 3. ベースモデルとの一致 (例: Qwen/Qwen2.5-Coder-1.5B-Instruct と Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC)
    if (normGenBase && normReportName && (normReportName.includes(normGenBase) || normGenBase.includes(normReportName))) {
      return true;
    }
    if (normGenBase && normReportId && (normReportId.includes(normGenBase) || normGenBase.includes(normReportId))) {
      return true;
    }

    // 4. ノーツや世代IDに含まれているファイル名・モデル名
    if (normGenNotes && ((normReportName && normGenNotes.includes(normReportName)) || (normReportId && normGenNotes.includes(normReportId)))) {
      return true;
    }
    if (normGenId && (normReportName.includes(normGenId) || normReportId.includes(normGenId))) {
      return true;
    }

    // 5. 主要モデルファミリ & パラメータサイズの共通トークン照合
    const significantTokens = [
      'qwen25coder15b',
      'qwen25coder7b',
      'qwen2505b',
      'qwen2515b',
      'qwen253b',
      'qwen257b',
      'llama321b',
      'llama323b',
      'gemma22b',
      'gemma29b',
      'phi35mini',
      'smollm135m',
      'smollm360m',
      'smollm17b',
    ];

    for (const token of significantTokens) {
      const inReport = normReportName.includes(token) || normReportId.includes(token);
      const inGen = normGenName.includes(token) || normGenBase.includes(token) || normGenNotes.includes(token);
      if (inReport && inGen) {
        return true;
      }
    }

    return false;
  }

  /**
   * 回帰テストレポートが総合安定版(stable)への昇格基準を満たしているか検証
   * 設計思想 25. 安全・品質境界 & 設計思想 9. ベンチマークと退行テスト
   * - 全テストケース実行済み & 合格率100% (failedTests === 0)
   * - 退行(Regression)ゼロ (regressionsCount === 0)
   * - 総合スコア80点以上
   * - 【必須】テスト対象モデルと昇格対象世代の同一性一致 (すり替え防止)
   */
  public validatePromotionReport(
    reportId: string,
    targetGenOrId?: string | ModelGeneration
  ): {
    valid: boolean;
    report?: RegressionSuiteRunReport;
    targetGen?: ModelGeneration;
    error?: string;
  } {
    const reports = regressionBenchmarkService.getReports();
    const report = reports.find((r) => r.id === reportId);
    if (!report) {
      return {
        valid: false,
        error: '指定された回帰テストレポートが存在しません。実機ベンチマークを実行してください。',
      };
    }

    if (report.regressionsCount > 0) {
      return {
        valid: false,
        report,
        error: `退行(Regression)が${report.regressionsCount}件検出されているため、安定版への昇格は許可されません。`,
      };
    }

    if (report.failedTests > 0) {
      return {
        valid: false,
        report,
        error: `不合格テストが${report.failedTests}件存在します。全テストケースの合格が必要です。`,
      };
    }

    if (report.overallScore < 80) {
      return {
        valid: false,
        report,
        error: `総合スコア(${report.overallScore}点)が合格基準(80点)に達していません。`,
      };
    }

    // 昇格対象モデル世代とテスト対象モデルの同一性チェック (設計思想 25)
    let targetGen: ModelGeneration | undefined;
    if (typeof targetGenOrId === 'string') {
      targetGen = this.generations.find((g) => g.generationId === targetGenOrId);
      if (!targetGen) {
        return {
          valid: false,
          report,
          error: `昇格対象のモデル世代(ID: ${targetGenOrId})が見つかりません。`,
        };
      }
    } else if (targetGenOrId && typeof targetGenOrId === 'object') {
      targetGen = targetGenOrId;
    }

    if (targetGen) {
      const match = this.checkModelReportMatch(report, targetGen);
      if (!match) {
        return {
          valid: false,
          report,
          targetGen,
          error: `【テスト対象と昇格対象の不一致】選択されたレポート[${report.id}]のテスト対象モデルは「${report.modelName}」(${report.modelId || 'IDなし'})ですが、昇格対象の世代は「${targetGen.modelName}」(Base: ${targetGen.baseModel || '未指定'})です。別モデルで実施されたベンチマーク結果を流用して安定版へ昇格させることはできません。昇格対象モデルをロードした上で回帰テストを再実行してください。`,
        };
      }
    }

    return {
      valid: true,
      report,
      targetGen,
    };
  }

  public addGeneration(gen: Omit<ModelGeneration, 'generationId' | 'createdAt'>): ModelGeneration {
    let finalBranch = gen.branch;
    let finalScore = gen.benchmarkScore;
    let finalReportId = gen.benchmarkReportId;
    let promotedAt = gen.promotedAt;
    let promotionNotes = gen.promotionNotes;

    // stable指定時は回帰レポート検証を強制 (レポートなしの安定化を拒否 & モデル同一性チェック)
    if (finalBranch === 'stable') {
      if (!finalReportId) {
        throw new Error(
          '総合安定版(stable)としての登録には、退行ゼロかつ全テスト合格の実機回帰ベンチマークレポートの選択が必須です。合格レポートを選択するか、候補ブランチ(chat_specialized/experimental等)として登録してください。'
        );
      }
      const tempGen: ModelGeneration = {
        ...gen,
        generationId: 'temp_validation',
        createdAt: Date.now(),
      };
      const check = this.validatePromotionReport(finalReportId, tempGen);
      if (!check.valid) {
        throw new Error(check.error || '回帰テスト合格基準を満たしていません。');
      }
      finalScore = check.report!.overallScore;
      promotedAt = Date.now();
      promotionNotes = `回帰レポート[${finalReportId}]合格承認 (テスト対象「${check.report!.modelName}」一致確認済, スコア: ${finalScore}点, 退行: 0件)`;
    }

    const newGen: ModelGeneration = {
      ...gen,
      branch: finalBranch,
      benchmarkScore: finalScore,
      benchmarkReportId: finalReportId,
      promotedAt,
      promotionNotes,
      generationId: 'gen_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: Date.now(),
    };

    // stableが新設された場合、既存のactive stableをarchivedに退避
    if (newGen.branch === 'stable' && newGen.status === 'active') {
      this.generations = this.generations.map((g) =>
        g.branch === 'stable' && g.status === 'active'
          ? { ...g, status: 'archived' }
          : g
      );
    }

    this.generations.push(newGen);
    this.saveGenerations();
    return newGen;
  }

  /**
   * 候補モデルを回帰レポートに基づいて総合安定版(stable)へ正式昇格させるガード関数
   * (手入力での昇格を構造的に排除し、実測レポートのみを昇格根拠とする)
   * 設計思想 25. 安全・品質境界 & 評価基準の改ざん防止 (テスト対象と昇格対象の同一性チェック)
   */
  public promoteToStable(
    generationId: string,
    reportId: string
  ): { success: boolean; error?: string; generation?: ModelGeneration } {
    const targetGen = this.generations.find((g) => g.generationId === generationId);
    if (!targetGen) {
      return { success: false, error: '指定されたモデル世代が見つかりません。' };
    }

    // 基準検証 (テスト品質 + テスト対象と昇格対象世代の同一性チェック)
    const check = this.validatePromotionReport(reportId, targetGen);
    if (!check.valid) {
      return { success: false, error: check.error };
    }

    const report = check.report!;

    // 既存の稼働中stableモデルをアーカイブに退避
    this.generations = this.generations.map((g) => {
      if (g.branch === 'stable' && g.status === 'active' && g.generationId !== generationId) {
        return {
          ...g,
          status: 'archived',
        };
      }
      return g;
    });

    // 昇格
    targetGen.branch = 'stable';
    targetGen.status = 'active';
    targetGen.benchmarkScore = report.overallScore;
    targetGen.benchmarkReportId = report.id;
    targetGen.promotedAt = Date.now();
    targetGen.promotionNotes = `回帰レポート[${report.id}]合格により正式昇格 (対象モデル「${report.modelName}」と一致確認済, 総合スコア: ${report.overallScore}点, 合格: ${report.passedTests}/${report.totalTests}, 退行: 0件)`;

    this.saveGenerations();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🏆 [モデル昇格成功] 「${targetGen.modelName}」が回帰レポート[${report.id}]（テスト対象: ${report.modelName}）に基づいて総合安定版(stable)へ昇格しました (スコア: ${report.overallScore}点)`
    );

    return { success: true, generation: targetGen };
  }

  /**
   * モデルサイズ比較レポート (ADOPT_B) の人手承認に基づいて常用モデルへ昇格・切り替える
   * (設計思想 25. 人の確認なしの自動昇格を避ける)
   */
  public adoptModelFromComparison(
    candidateGenerationId: string,
    comparisonReport: ModelSizeComparisonReport
  ): { success: boolean; error?: string; generation?: ModelGeneration } {
    if (comparisonReport.verdict !== 'ADOPT_B') {
      return {
        success: false,
        error: `比較判定が「ADOPT_B」ではないため常用モデルへ昇格できません (現在の判定: ${comparisonReport.verdict})`,
      };
    }

    const targetGen = this.generations.find((g) => g.generationId === candidateGenerationId);
    if (!targetGen) {
      return { success: false, error: '指定されたモデル世代が見つかりません。' };
    }

    // 既存の稼働中stableモデルをアーカイブに退避
    this.generations = this.generations.map((g) => {
      if (g.branch === 'stable' && g.status === 'active' && g.generationId !== candidateGenerationId) {
        return {
          ...g,
          status: 'archived',
        };
      }
      return g;
    });

    // 常用モデル (active stable) へ昇格
    targetGen.branch = 'stable';
    targetGen.status = 'active';
    targetGen.benchmarkScore = comparisonReport.modelB.scores.overallScore;
    targetGen.promotedAt = Date.now();
    targetGen.promotionNotes = `モデルサイズ比較レポート[${comparisonReport.id}]承認により常用モデルに採用 (パラメータ: ${(comparisonReport.modelB.params / 1e9).toFixed(1)}B, スコア: ${comparisonReport.modelB.scores.overallScore}点, TPS: ${comparisonReport.modelB.avgTps} tok/s, 判定: ADOPT_B)`;

    this.saveGenerations();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `👑 [常用モデル昇格] モデルサイズ比較承認により「${targetGen.modelName}」を総合安定常用モデルに昇格しました`
    );

    return { success: true, generation: targetGen };
  }

  public deleteGeneration(generationId: string): void {
    // 基準安定版は削除禁止 (設計思想 25. 安全・品質境界)
    this.generations = this.generations.filter((g) => g.generationId !== generationId || g.branch === 'stable');
    this.saveGenerations();
  }

  public resetGenerationsToDefault(): void {
    this.generations = [...INITIAL_GENERATIONS];
    this.saveGenerations();
  }

  /**
   * プロンプト構成規則の静的シミュレーション評価 (ルールベース簡易採点)
   * 設計思想 16. 複数候補、反証、テスト
   * ※実モデル推論のA/Bテストではなく、プロンプト内のタメ口制約・脱ロボット文言・安全境界の含有度を静的評価するシミュレーションです。
   */
  /**
   * 実際にロード中のモデルへ候補A/Bのシステムプロンプトを送信し、
   * 生成された応答を静的ルールで採点して比較する (プロンプトA/Bテスト)。
   * 設計思想 15. 評価・検証 & 16. 複数候補、反証、テスト
   * (以前はプロンプト文字列自体にキーワードが含まれるかだけを見る、実推論を伴わない偽の判定だった)
   */
  public async runPromptABBenchmark(
    testPrompt: string,
    variantA: { name: string; systemPrompt: string },
    variantB: { name: string; systemPrompt: string }
  ): Promise<{
    winner: 'A' | 'B' | 'TIE';
    scoreA: number;
    scoreB: number;
    responseA: string;
    responseB: string;
    analysis: string;
    isSimulation: boolean;
  }> {
    const isNativeReady = nativeLlmService.isNative() && !!nativeLlmService.getActiveModelId();
    const isWebReady = webLLMService.isLoaded();

    if (!isNativeReady && !isWebReady) {
      return {
        winner: 'TIE',
        scoreA: 0,
        scoreB: 0,
        responseA: '',
        responseB: '',
        analysis: '⚠️ モデルが未ロードのためA/Bテストを実行できませんでした。「端末ローカルLLM設定」でモデルをロードしてから再実行してください。',
        isSimulation: true,
      };
    }

    const runVariant = async (variant: { systemPrompt: string }): Promise<string> => {
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: variant.systemPrompt },
        { role: 'user', content: testPrompt },
      ];
      let out = '';
      try {
        const stream = isNativeReady
          ? nativeLlmService.streamNativeChat(messages, { temperature: 0.7, max_tokens: 400 })
          : webLLMService.streamChat(messages, { temperature: 0.7, max_tokens: 400 });
        for await (const chunk of stream) {
          out += chunk;
        }
      } catch (err: any) {
        systemLogger.error('SELF_IMPROVEMENT', 'プロンプトA/Bテストの推論に失敗しました', err);
        out = '';
      }
      return out;
    };

    const [responseA, responseB] = await Promise.all([runVariant(variantA), runVariant(variantB)]);

    // 実際の生成結果を静的ルールで採点 (プロンプト文字列自体ではなく、モデルの応答を見る)
    const evaluate = (resp: string) => {
      if (!resp.trim()) return 0;
      let s = 50;
      if (resp.includes('だよ') || resp.includes('だね') || resp.includes('よ！') || resp.includes('ね！')) s += 15;
      if (resp.includes('でございます') || resp.includes('承知いたしました') || resp.includes('恐縮')) s -= 25;
      if (resp.length > 20 && resp.length < 600) s += 10;
      if (resp.includes('```')) s += 5;
      return Math.max(0, Math.min(100, s));
    };

    const scoreA = evaluate(responseA);
    const scoreB = evaluate(responseB);
    const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'TIE';

    return {
      winner,
      scoreA,
      scoreB,
      responseA,
      responseB,
      analysis:
        winner === 'TIE'
          ? '両候補の実際の生成応答が同等の静的ルール適合度を示しています。'
          : `候補${winner}「${winner === 'A' ? variantA.name : variantB.name}」の実際の生成応答が、脱ロボット度・タメ口維持・応答長のルールで優勢でした。`,
      isSimulation: false,
    };
  }
}

export const selfImprovementService = new SelfImprovementService();
