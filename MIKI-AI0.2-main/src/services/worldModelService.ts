import { ActionPrediction, PredictionErrorRecord, MemoryItem, PersonaConfig, SkillItem } from '../types';
import { skillsService } from './skillsService';
import { storageService } from './storageService';

const WORLD_MODEL_PREDICTIONS_KEY = 'miki_ai_world_model_predictions';
const PREDICTION_ERRORS_KEY = 'miki_ai_prediction_error_records';

// 記憶「未使用」判定のしきい値。文字2-gram重複率がこれ以上なら「使われた」とみなす。
// (第52章 記憶利用ポリシー乖離判定の日本語対応 参照)
const MEMORY_USAGE_BIGRAM_THRESHOLD = 0.12;

/**
 * 日本語(分かち書き無し)でも機能する簡易類似度: 文字2-gram集合の重複率。
 * 形態素解析器・埋め込みサーバーに依存しない同期処理で、
 * 「記憶内容の断片が応答に反映されているか」を近似判定する。
 */
function charBigrams(text: string): Set<string> {
  const cleaned = text.replace(/[\s、。,.!?！？「」『』()（）\-ー・]/g, '');
  const grams = new Set<string>();
  for (let i = 0; i < cleaned.length - 1; i++) {
    grams.add(cleaned.slice(i, i + 2));
  }
  return grams;
}

function charBigramOverlapRatio(memoryContent: string, response: string): number {
  const memGrams = charBigrams(memoryContent);
  if (memGrams.size === 0) return 0;
  const respGrams = charBigrams(response);
  let overlap = 0;
  for (const g of memGrams) {
    if (respGrams.has(g)) overlap++;
  }
  return overlap / memGrams.size;
}

/**
 * 世界モデル & 予測誤差エンジン (第52章 世界モデル & 予測誤差エンジン完全仕様 参照)
 * 
 * 核心原理:
 * 1. AIが行動（回答生成・ツール利用）する前に、結果を予測する。
 *    現在状態 ＋ ユーザー入力 → 事前予測（意図、必要記憶、トーン、リスク）
 * 2. 行動完了後、実際の結果（使われた記憶、生成コード、口調、ユーザー評価、実行エラー）と比較する。
 * 3. 予測誤差（Prediction Error / Surprisal）を算出し、誤差要因を分類する。
 *    （例: 「記憶追加で改善すると予測したが実際には使われなかった → 記憶不足ではなく利用方針の問題」）
 * 4. 予測誤差が大きい事象を学習シグナル（LoRA教材、メタ記憶、プロンプト境界修正）として蓄積する。
 */
export class WorldModelService {
  private predictions: ActionPrediction[] = [];
  private errorRecords: PredictionErrorRecord[] = [];

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const savedPreds = storageService.getItem(WORLD_MODEL_PREDICTIONS_KEY);
      if (savedPreds) this.predictions = JSON.parse(savedPreds);

      const savedErrors = storageService.getItem(PREDICTION_ERRORS_KEY);
      if (savedErrors) this.errorRecords = JSON.parse(savedErrors);
    } catch (e) {
      console.warn('Failed to load WorldModel state:', e);
    }
  }

  private saveState(): void {
    try {
      // 直近100件を保持
      const trimmedPreds = this.predictions.slice(-100);
      const trimmedErrors = this.errorRecords.slice(-100);
      storageService.setItem(WORLD_MODEL_PREDICTIONS_KEY, JSON.stringify(trimmedPreds));
      storageService.setItem(PREDICTION_ERRORS_KEY, JSON.stringify(trimmedErrors));
    } catch (e) {
      console.warn('Failed to save WorldModel state:', e);
    }
  }

  /**
   * 行動前予測 (Action Prediction)
   * ユーザープロンプトと現在状態から、意図・必要記憶・スキル・トーン・リスクを事前予測
   */
  public predictAction(
    userPrompt: string,
    activeMemories: MemoryItem[],
    persona?: PersonaConfig
  ): ActionPrediction {
    const promptLower = userPrompt.toLowerCase();

    // 1. 意図の事前予測
    let expectedIntent: ActionPrediction['expectedIntent'] = 'chat_casual';
    if (
      promptLower.includes('コード') ||
      promptLower.includes('作って') ||
      promptLower.includes('html') ||
      promptLower.includes('javascript') ||
      promptLower.includes('vba') ||
      promptLower.includes('canvas') ||
      promptLower.includes('ゲーム')
    ) {
      expectedIntent = 'code_generation';
    } else if (
      promptLower.includes('直して') ||
      promptLower.includes('エラー') ||
      promptLower.includes('動かない') ||
      promptLower.includes('バグ') ||
      promptLower.includes('修正')
    ) {
      expectedIntent = 'code_repair';
    } else if (
      promptLower.includes('教えて') ||
      promptLower.includes('どうやって') ||
      promptLower.includes('とは') ||
      promptLower.includes('仕組み')
    ) {
      expectedIntent = 'qa_technical';
    } else if (
      promptLower.includes('実行') ||
      promptLower.includes('export') ||
      promptLower.includes('ダウンロード')
    ) {
      expectedIntent = 'tool_execution';
    }

    // 2. 記憶必要性の予測
    const memoryKeywords = ['前言ってた', '覚えてる', '私の', '僕の', '設定', '前回の', '約束', '名前'];
    const memoryNeeded = memoryKeywords.some((k) => promptLower.includes(k)) || activeMemories.length > 0;
    const predictedMemoryTopics = activeMemories
      .filter((m) => m.approved && (m.importance || 3) >= 3)
      .slice(0, 3)
      .map((m) => m.content.substring(0, 20));

    // 3. スキル利用の予測
    const availableSkills = skillsService.getAllSkills();
    const matchedSkills = availableSkills.filter((s: SkillItem) => {
      const keywords = (s.triggerCondition || '').split(',').map((k) => k.trim().toLowerCase());
      return keywords.some((kw) => kw.length > 0 && promptLower.includes(kw));
    });
    const predictedSkillIds = matchedSkills.map((s: SkillItem) => s.id);

    // 4. トーン & リスクの予測
    const expectedTone: ActionPrediction['expectedTone'] =
      expectedIntent === 'code_generation' || expectedIntent === 'code_repair'
        ? 'friendly_casual'
        : 'friendly_casual';

    let predictedRisk: ActionPrediction['predictedRisk'] = 'none';
    let confidenceScore = 0.85;

    if (expectedIntent === 'code_repair') {
      predictedRisk = 'syntax_error_risk';
      confidenceScore = 0.72;
    } else if (userPrompt.length < 5) {
      predictedRisk = 'missing_context_risk';
      confidenceScore = 0.6;
    } else if (promptLower.includes('です') || promptLower.includes('ます')) {
      // ユーザーが敬語を使ってきた場合のロボット口調引きずられリスク
      predictedRisk = 'persona_drift_risk';
      confidenceScore = 0.78;
    }

    const prediction: ActionPrediction = {
      predictionId: 'pred_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      userPrompt,
      expectedIntent,
      expectedTone,
      expectedMemoryUsage: {
        needed: memoryNeeded,
        predictedMemoryCount: memoryNeeded ? Math.min(activeMemories.length, 3) : 0,
        predictedMemoryTopics,
      },
      expectedSkillUsage: {
        needed: predictedSkillIds.length > 0,
        predictedSkillIds,
      },
      expectedExecutionPath:
        expectedIntent === 'code_generation' || expectedIntent === 'code_repair'
          ? 'code_sandbox'
          : memoryNeeded
          ? 'retrieval_augmented'
          : 'direct_llm',
      confidenceScore,
      predictedRisk,
    };

    this.predictions.push(prediction);
    this.saveState();
    return prediction;
  }

  /**
   * 事後検証 & 予測誤差の計算 (Prediction Error / Surprisal Calculation)
   * 第52章: 「予測結果 → 実際の結果 → 差分の記録 → 次回の改善」
   */
  public recordOutcomeAndComputeError(
    prediction: ActionPrediction,
    actual: {
      assistantResponse: string;
      actualUsedMemories: Array<{ id: string; content: string }>;
      actualUsedSkills: Array<{ id: string; name: string }>;
      executionError?: boolean;
      userFeedback?: 'good' | 'bad' | 'correction' | 'neutral';
      tokenCount?: number;
      elapsedMs?: number;
    }
  ): PredictionErrorRecord {
    const resp = actual.assistantResponse;
    const hasCodeBlock = resp.includes('```');

    // ロボット口調 / 過剰敬語の混入チェック (脱ロボット検証)
    const robotWords = ['承知いたしました', 'かしこまりました', 'ご案内いたします', 'AIアシスタントとして', '申し訳ございません'];
    const hasToneViolation = robotWords.some((rw) => resp.includes(rw));

    // 記憶利用の乖離判定 (Memory Surprisal)
    let memorySurprisal: PredictionErrorRecord['predictionError']['memorySurprisal'] = 'matched';
    const actualMemCount = actual.actualUsedMemories.length;
    const predMemCount = prediction.expectedMemoryUsage.predictedMemoryCount;

    if (prediction.expectedMemoryUsage.needed && actualMemCount === 0) {
      memorySurprisal = 'under_retrieved';
    } else if (!prediction.expectedMemoryUsage.needed && actualMemCount > 0) {
      memorySurprisal = 'over_retrieved';
    } else if (predMemCount > 0 && actualMemCount > 0) {
      // 記憶は取得されたが、回答本文にその記憶の内容がほぼ反映されていないケース。
      // 旧実装は日本語を想定せず「スペース/句読点分割」で単語を切り出していたが、
      // 日本語は分かち書きしないため実質どの応答でも不一致判定になり、
      // 誤差検知(memory_policy_mismatch)がほぼ常時発火する構造的バグがあった。
      // → 形態素解析器を持たない環境でも動く文字2-gram重複率で近似する方式に修正(第52章参照)。
      const usedKeywordInResp = actual.actualUsedMemories.some(
        (m) => charBigramOverlapRatio(m.content, resp) >= MEMORY_USAGE_BIGRAM_THRESHOLD
      );
      if (!usedKeywordInResp) {
        memorySurprisal = 'retrieved_but_unused';
      }
    }

    // スキル利用の乖離判定 (Skill Surprisal)
    let skillSurprisal: PredictionErrorRecord['predictionError']['skillSurprisal'] = 'matched';
    const actualSkillCount = actual.actualUsedSkills.length;
    const predSkillCount = prediction.expectedSkillUsage.predictedSkillIds.length;

    if (predSkillCount > 0 && actualSkillCount === 0) {
      skillSurprisal = 'predicted_skill_failed';
    } else if (predSkillCount === 0 && actualSkillCount > 0) {
      skillSurprisal = 'unpredicted_skill_used';
    }

    // トーン乖離
    const toneSurprisal = hasToneViolation ? 'drifted_to_robot' : 'matched';

    // 誤差の総合スコア (0.0 = 完全一致 〜 1.0 = 完全乖離)
    let errorMagnitude = 0.0;
    if (memorySurprisal !== 'matched') errorMagnitude += 0.25;
    if (skillSurprisal !== 'matched') errorMagnitude += 0.2;
    if (hasToneViolation) errorMagnitude += 0.3;
    if (actual.executionError) errorMagnitude += 0.4;
    if (actual.userFeedback === 'bad' || actual.userFeedback === 'correction') errorMagnitude += 0.35;
    errorMagnitude = Math.min(1.0, errorMagnitude);

    // 誤差要因の分類 (Root Cause Diagnosis)
    let errorCategory: PredictionErrorRecord['predictionError']['errorCategory'] = 'none';
    let diagnosisNote = '予測と実際の結果は概ね一致しています。';
    let suggestedImprovement: PredictionErrorRecord['predictionError']['suggestedImprovement'] = 'no_action';

    if (memorySurprisal === 'retrieved_but_unused') {
      errorCategory = 'memory_policy_mismatch';
      diagnosisNote = '【第52章 記憶利用ポリシー乖離】記憶は取得されましたが回答で参照されませんでした。記憶不足ではなくプロンプト注入時の利用指示方針を強化する必要があります。';
      suggestedImprovement = 'update_memory_policy';
    } else if (hasToneViolation) {
      errorCategory = 'constraint_violation';
      diagnosisNote = '親友タメ口設定にもかかわらず丁寧語・ロボット口調が混入しました。システムプロンプトのペルソナ境界強化またはDPO教材化が有効です。';
      suggestedImprovement = 'refine_prompt_boundary';
    } else if (actual.executionError) {
      errorCategory = 'model_capacity_limit';
      diagnosisNote = '生成されたコードに構文エラーまたは実行時例外が発生しました。失敗例と修復後の正解をペアにしてLoRA学習データへ送るべきです。';
      suggestedImprovement = 'export_dpo_sample';
    } else if (skillSurprisal === 'unpredicted_skill_used') {
      errorCategory = 'intent_misclassification';
      diagnosisNote = '想定外のスキルが実行されました。スキルのトリガー条件を見直す必要があります。';
      suggestedImprovement = 'add_skill';
    }

    const errorRecord: PredictionErrorRecord = {
      id: 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      predictionId: prediction.predictionId,
      timestamp: Date.now(),
      prediction,
      actualOutcome: {
        actualIntent: prediction.expectedIntent,
        actualUsedMemoriesCount: actualMemCount,
        actualUsedSkillsCount: actualSkillCount,
        hasCodeBlock,
        hasToneViolation,
        executionError: Boolean(actual.executionError),
        userFeedback: actual.userFeedback || 'neutral',
        tokenCount: actual.tokenCount || 0,
        elapsedMs: actual.elapsedMs || 0,
      },
      predictionError: {
        errorMagnitude,
        memorySurprisal,
        skillSurprisal,
        toneSurprisal,
        errorCategory,
        diagnosisNote,
        suggestedImprovement,
      },
    };

    this.errorRecords.push(errorRecord);
    this.saveState();
    return errorRecord;
  }

  public getPredictions(): ActionPrediction[] {
    return [...this.predictions];
  }

  public getErrorRecords(): PredictionErrorRecord[] {
    return [...this.errorRecords];
  }

  public clearRecords(): void {
    this.predictions = [];
    this.errorRecords = [];
    storageService.removeItem(WORLD_MODEL_PREDICTIONS_KEY);
    storageService.removeItem(PREDICTION_ERRORS_KEY);
  }

  /**
   * 統計サマリー
   */
  public getStats() {
    const total = this.errorRecords.length;
    if (total === 0) {
      return {
        totalPredictions: 0,
        avgErrorMagnitude: 0,
        memoryMismatchRate: 0,
        toneDriftRate: 0,
        highSurprisalCount: 0,
      };
    }

    const sumError = this.errorRecords.reduce((acc, r) => acc + r.predictionError.errorMagnitude, 0);
    const memoryMismatch = this.errorRecords.filter((r) => r.predictionError.memorySurprisal !== 'matched').length;
    const toneDrift = this.errorRecords.filter((r) => r.predictionError.toneSurprisal !== 'matched').length;
    const highSurprisal = this.errorRecords.filter((r) => r.predictionError.errorMagnitude >= 0.4).length;

    return {
      totalPredictions: total,
      avgErrorMagnitude: Number((sumError / total).toFixed(2)),
      memoryMismatchRate: Math.round((memoryMismatch / total) * 100),
      toneDriftRate: Math.round((toneDrift / total) * 100),
      highSurprisalCount: highSurprisal,
    };
  }
}

export const worldModelService = new WorldModelService();
