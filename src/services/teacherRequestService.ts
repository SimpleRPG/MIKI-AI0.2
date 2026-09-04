import {
  TeacherBudgetLimits,
  TeacherBudgetUsage,
  TeacherBudgetStatus,
  TeacherRequestPayload,
  TeacherGeneratedMaterial,
  TeacherUsageRecord,
  FailureRecurrenceEntry,
  TrainingSampleJSONL,
  MemoryItem,
  ResponseSkeleton,
} from '../types';
import { storageService } from './storageService';
import { selfImprovementService } from './selfImprovementService';
import { systemLogger } from './systemLogger';
import { checkSampleSafety } from '../utils/trainingSampleSafetyFilter';
import { completionJudgeService } from './completionJudgeService';
import { schemaValidationService } from './schemaValidationService';
import { sendChatMessage } from './api';
import { capabilityGapService } from './capabilityGapService';
import { answerPlanService } from './answerPlanService';

const BUDGET_LIMITS_KEY = 'miki_ai_teacher_budget_limits';
const BUDGET_USAGE_KEY = 'miki_ai_teacher_budget_usage';
const USAGE_RECORDS_KEY = 'miki_ai_teacher_usage_records';

const DEFAULT_LIMITS: TeacherBudgetLimits = {
  dailyCalls: 10,
  monthlyCalls: 100,
};

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCurrentMonthString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 外部教師リクエストパイプラインサービス (設計思想 37〜39節 フェーズ8)
 *
 * 1. 端末内解決不可の弱点パターンのみを判定ゲート(shouldRequestTeacher)で通過
 * 2. 生会話・固有名詞を徹底的に匿名化・抽象化(anonymizeFailureExample)
 * 3. 失敗例・期待条件・教材形式のみを構造化JSON化(buildTeacherRequestPayload)
 * 4. 日次/月次の厳格な予算・呼び出し上限管理(checkBudget)
 * 5. Gemini応答の安全・品質二重フィルタリング検証 & external_teacher中信頼保存
 */
export class TeacherRequestService {
  private limits: TeacherBudgetLimits = { ...DEFAULT_LIMITS };
  private usage: TeacherBudgetUsage;
  private usageRecords: TeacherUsageRecord[] = [];

  constructor() {
    this.usage = {
      currentDate: getTodayString(),
      currentMonth: getCurrentMonthString(),
      dailyCalls: 0,
      monthlyCalls: 0,
      dailyPromptTokens: 0,
      dailyOutputTokens: 0,
      monthlyPromptTokens: 0,
      monthlyOutputTokens: 0,
      totalGeneratedMaterials: 0,
      totalVerifiedPassed: 0,
    };
    this.loadState();
  }

  private loadState(): void {
    try {
      const rawLimits = storageService.getItem(BUDGET_LIMITS_KEY);
      if (rawLimits) {
        this.limits = { ...DEFAULT_LIMITS, ...JSON.parse(rawLimits) };
      }

      const rawUsage = storageService.getItem(BUDGET_USAGE_KEY);
      if (rawUsage) {
        const parsed: TeacherBudgetUsage = JSON.parse(rawUsage);
        const today = getTodayString();
        const thisMonth = getCurrentMonthString();

        this.usage = {
          currentDate: today,
          currentMonth: thisMonth,
          dailyCalls: parsed.currentDate === today ? parsed.dailyCalls || 0 : 0,
          monthlyCalls: parsed.currentMonth === thisMonth ? parsed.monthlyCalls || 0 : 0,
          dailyPromptTokens: parsed.currentDate === today ? parsed.dailyPromptTokens || 0 : 0,
          dailyOutputTokens: parsed.currentDate === today ? parsed.dailyOutputTokens || 0 : 0,
          monthlyPromptTokens: parsed.currentMonth === thisMonth ? parsed.monthlyPromptTokens || 0 : 0,
          monthlyOutputTokens: parsed.currentMonth === thisMonth ? parsed.monthlyOutputTokens || 0 : 0,
          totalGeneratedMaterials: parsed.totalGeneratedMaterials || 0,
          totalVerifiedPassed: parsed.totalVerifiedPassed || 0,
        };
      }

      const rawRecords = storageService.getItem(USAGE_RECORDS_KEY);
      if (rawRecords) {
        this.usageRecords = JSON.parse(rawRecords);
      }
    } catch (e) {
      console.warn('[TeacherRequestService] Failed to load budget state:', e);
    }
  }

  private saveState(): void {
    try {
      storageService.setItem(BUDGET_LIMITS_KEY, JSON.stringify(this.limits));
      storageService.setItem(BUDGET_USAGE_KEY, JSON.stringify(this.usage));
      storageService.setItem(USAGE_RECORDS_KEY, JSON.stringify(this.usageRecords.slice(0, 100)));
    } catch (e) {
      console.warn('[TeacherRequestService] Failed to save budget state:', e);
    }
  }

  /**
   * 外部教師リクエスト判定ゲート (設計思想 37節)
   *
   * 条件:
   * 1. 同種失敗が複数回再現されている (recurrenceCount >= 2)
   * 2. 既存教材に同種の正解がない (approved high-reliability sample exists? no)
   * 3. 端末の機械検証だけでは不足している (semantic, complex code, tool logic, reasoning error)
   */
  public shouldRequestTeacher(failurePattern: {
    patternKey?: string;
    category: string;
    samplePrompt: string;
    recurrenceCount?: number;
    notes?: string;
    reason?: string;
  }): boolean {
    const recurrence = failurePattern.recurrenceCount ?? 1;

    // 条件1: 同種失敗が2回以上再現
    if (recurrence < 2) {
      return false;
    }

    // 条件2: 既存教材に同種の正解がないか検索
    const existingSamples = selfImprovementService.getTrainingSamples();
    const normPrompt = (failurePattern.samplePrompt || '').trim().toLowerCase();
    const promptKeywords = normPrompt
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, ' ')
      .split(/\s+/)
      .filter((k) => k.length >= 3);

    const hasApprovedExisting = existingSamples.some((s) => {
      if (s.category !== failurePattern.category) return false;
      if (!s.approved || s.reliability === 'low') return false;

      const normInst = (s.instruction || '').toLowerCase();
      // キーワードが2件以上重複し、模範回答が十分な長さを持つ場合は解決済みと判定
      const matchingKeywords = promptKeywords.filter((k) => normInst.includes(k));
      return matchingKeywords.length >= 2 && (s.outputTarget || '').length > 40;
    });

    if (hasApprovedExisting) {
      return false;
    }

    // 条件3: 端末の機械検証（単純正規表現、定型ルール等）だけでは不足している
    // コード・自然言語対話・多段推論・VBA・ツール選択など、外部知見が必要な領域
    const complexCategories = ['code', 'chat', 'tool_use', 'vba', 'logic', 'retrieval', 'correction'];
    const isComplexCategory = complexCategories.includes(failurePattern.category.toLowerCase());

    const failureReason = (failurePattern.reason || failurePattern.notes || '').toLowerCase();
    const isSemanticOrComplex =
      isComplexCategory ||
      failureReason.includes('syntax') ||
      failureReason.includes('logic') ||
      failureReason.includes('runtime') ||
      failureReason.includes('semantic') ||
      failureReason.includes('reasoning') ||
      failureReason.includes('hallucination') ||
      normPrompt.length > 20;

    return isSemanticOrComplex;
  }

  /**
   * 失敗例の匿名化・一般化 (設計思想 38節 & 25節)
   *
   * 既存の trainingSampleSafetyFilter のPII伏字化を適用した上で、
   * 人名、敬称、ニックネーム、私的文脈を「ユーザー」「システム」等の一般概念に抽象化します。
   */
  public anonymizeFailureExample(
    sample:
      | string
      | {
          prompt: string;
          output?: string;
          failureReason?: string;
          context?: string;
        }
  ): string {
    const rawText = typeof sample === 'string' ? sample : `${sample.prompt}${sample.failureReason ? ` (失敗理由: ${sample.failureReason})` : ''}`;

    let anonymized = rawText;

    // 1. 電話番号
    anonymized = anonymized.replace(/(?:^|[^\d])(0\d{1,4}[-ー]?\d{1,4}[-ー]?\d{3,4})(?=[^\d]|$)/g, ' [REDACTED_PHONE] ');

    // 2. メールアドレス
    anonymized = anonymized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

    // 3. 郵便番号
    anonymized = anonymized.replace(/(?:〒\s*)?\b\d{3}[-ー]\d{4}\b/g, '[REDACTED_POSTAL]');

    // 4. 日本の住所
    anonymized = anonymized.replace(
      /(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)\s*[\u4e00-\u9fa5]+[市区町村]\s*[\u4e00-\u9fa50-9０-９\-丁目番地号]+/g,
      '[REDACTED_ADDRESS]'
    );

    // 5. 12〜16桁の連続数字 (カード番号等)
    anonymized = anonymized.replace(/\b(?:\d{4}[- ]){3}\d{4}\b|\b\d{14,16}\b/g, '[REDACTED_ID]');

    // 6. 人名・敬称・ニックネームの一般化 (「〇〇さん」「〇〇くん」→「ユーザー」)
    anonymized = anonymized.replace(
      /(?:[ぁ-んァ-ヶ一-龠a-zA-Z0-9]{1,10})(?:さん|くん|君|ちゃん|様|氏|先生|先輩)/g,
      'ユーザー'
    );

    // 7. 一人称やプライベート固有文脈の置換
    anonymized = anonymized.replace(/(?:私|僕|俺|自分|当方|弊社)の(?:名前|本名|会社|学校|住所|電話|メール|年齢|家族)/g, 'ユーザー情報');
    anonymized = anonymized.replace(/(?:私の名前は|ぼくの名前は|おれは|わたしは|僕は)\s*([^\s、。]{1,10})/g, 'ユーザーは');

    // 8. ファイルパスや個人ディレクトリ
    anonymized = anonymized.replace(/(?:\/Users\/[a-zA-Z0-9._-]+|\/home\/[a-zA-Z0-9._-]+|[A-Z]:\\Users\\[a-zA-Z0-9._-]+)/g, '/workspace');

    // 9. APIキーやトークンらしき英数字
    anonymized = anonymized.replace(/\b(?:ghp_[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{20,})\b/g, '[TOKEN_REDACTED]');

    // 10. 親愛表現や挨拶フィラーのトリミング
    anonymized = anonymized.replace(/^(?:ねえねえ|あのね|やっほー|こんにちは|みきちゃん|みき|AI)[、,!\s]*/g, '');

    return anonymized.trim();
  }

  /**
   * Gemini API向け構造化リクエストペイロード構築 (設計思想 38節)
   *
   * 会話全文は一切送らず、抽象化された課題パターン・期待条件・教材フォーマットのみをJSON化
   */
  public buildTeacherRequestPayload(
    anonymizedExample: string,
    failureCategory: string = 'chat',
    failureReason?: string
  ): TeacherRequestPayload {
    let expectedCondition = '正確で論理的な応答と、再発を防ぐ模範的出力';
    const cat = failureCategory.toLowerCase();

    if (cat.includes('code') || cat.includes('vba')) {
      expectedCondition = '構文エラーがなく、ベストプラクティスに準拠した動作可能でクリーンなコード';
    } else if (cat.includes('tool')) {
      expectedCondition = '適切なツール選定とスキーマに適合した正確な引数指定';
    } else if (cat.includes('retrieval') || cat.includes('memory')) {
      expectedCondition = '過去の記憶や事実関係に基づいた矛盾のない正確な情報提示';
    } else if (cat.includes('chat')) {
      expectedCondition = '親しみやすく自然な日本語で、過剰なロボット敬語や不自然な言い回しのない対話';
    }

    return {
      failureCategory,
      abstractFailurePattern: anonymizedExample,
      anonymizedExample,
      expectedCondition,
      failureReason,
      suggestedFormat: {
        instruction: 'オンデバイスAIが学習すべき、一般化された明快な指示文（ユーザー入力相当）',
        inputContext: '前提知識やコード・設定などの文脈（不要な場合は省略）',
        idealOutput: '再発を防ぐ高品質な模範正解（コードまたは応答テキスト）',
        reasoningExplanation: 'なぜこの出力が正解であり、AIが何を学習すべきかの解説（1〜2文）',
        category: failureCategory,
      },
      privacyDeclaration:
        'Raw conversation context stripped; PII redacted; generalized to abstract learning pattern',
    };
  }

  /**
   * 1日/1ヶ月の呼び出し予算チェック (設計思想 39節)
   */
  public checkBudget(): TeacherBudgetStatus {
    this.refreshDateWindows();

    const dailyRemaining = Math.max(0, this.limits.dailyCalls - this.usage.dailyCalls);
    const monthlyRemaining = Math.max(0, this.limits.monthlyCalls - this.usage.monthlyCalls);

    let allowed = true;
    let reason: string | undefined;

    if (this.usage.dailyCalls >= this.limits.dailyCalls) {
      allowed = false;
      reason = `1日の外部教師リクエスト上限(${this.limits.dailyCalls}件)に達しました。明日自動リセットされます。`;
    } else if (this.usage.monthlyCalls >= this.limits.monthlyCalls) {
      allowed = false;
      reason = `当月の外部教師リクエスト上限(${this.limits.monthlyCalls}件)に達しました。来月自動リセットされます。`;
    }

    return {
      allowed,
      reason,
      remaining: {
        daily: dailyRemaining,
        monthly: monthlyRemaining,
      },
      usage: { ...this.usage },
      limits: { ...this.limits },
    };
  }

  /**
   * 外部教師の利用実績を記録 (設計思想 39節)
   */
  public recordTeacherUsage(callResult: {
    promptTokens?: number;
    outputTokens?: number;
    generatedSamplesCount: number;
    verifiedPassedCount: number;
    category?: string;
    success: boolean;
    notes?: string;
  }): void {
    this.refreshDateWindows();

    const pTokens = callResult.promptTokens || 0;
    const oTokens = callResult.outputTokens || 0;

    if (callResult.success) {
      this.usage.dailyCalls += 1;
      this.usage.monthlyCalls += 1;
      this.usage.dailyPromptTokens += pTokens;
      this.usage.dailyOutputTokens += oTokens;
      this.usage.monthlyPromptTokens += pTokens;
      this.usage.monthlyOutputTokens += oTokens;
      this.usage.totalGeneratedMaterials += callResult.generatedSamplesCount;
      this.usage.totalVerifiedPassed += callResult.verifiedPassedCount;
    }

    const record: TeacherUsageRecord = {
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      category: callResult.category || 'general',
      promptTokens: pTokens,
      outputTokens: oTokens,
      generatedCount: callResult.generatedSamplesCount,
      verifiedCount: callResult.verifiedPassedCount,
      success: callResult.success,
      notes: callResult.notes,
    };

    this.usageRecords.unshift(record);
    this.saveState();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📊 [外部教師利用記録] 呼び出し: 本日 ${this.usage.dailyCalls}/${this.limits.dailyCalls}件, ` +
        `生成: ${callResult.generatedSamplesCount}件 (合格: ${callResult.verifiedPassedCount}件), ` +
        `トークン: in ${pTokens} / out ${oTokens}`
    );
  }

  /**
   * 外部教師(Gemini)に教材作成をリクエスト
   *
   * 返ってきた教材は無条件で正解とせず:
   * 1. checkSampleSafety によるコンテンツ安全境界チェック
   * 2. 品質フィルタ（文字数、自己矛盾）チェック
   * 3. source: 'external_teacher' / 中信頼(medium)ラベルで addTrainingSample に保存
   */
  public async requestTeacherMaterial(
    payload: TeacherRequestPayload,
    patternKeyToPromote?: string
  ): Promise<{
    success: boolean;
    material?: TeacherGeneratedMaterial;
    error?: string;
    verifiedPassed?: boolean;
    savedSample?: TrainingSampleJSONL | null;
    savedSkeleton?: ResponseSkeleton | null;
    verifiedEffective?: boolean;
    verificationNote?: string;
    generalizationGapRecorded?: boolean;
  }> {
    // 1. 予算チェック
    const budget = this.checkBudget();
    if (!budget.allowed) {
      return {
        success: false,
        verifiedPassed: false,
        error: budget.reason || '予算上限に達したため送信できません。',
      };
    }

    // 20章 改訂規定:
    // 同一の能力について、対策を保存した後も類似の未知の言い回し(16.1)で再び本章の送信条件に該当した場合、
    // 回答が正解でも「対策の汎化不足」として扱い、32章の不足能力レジストリへ記録する。
    const targetCapabilityId = payload.failureCategory.toLowerCase().includes('vba')
      ? 'cap_abstract_vba_design'
      : payload.failureCategory.toLowerCase().includes('code')
      ? 'cap_code_comprehension'
      : payload.failureCategory.toLowerCase().includes('retrieval') || payload.failureCategory.toLowerCase().includes('memory')
      ? 'cap_logical_priority'
      : payload.failureCategory.toLowerCase().includes('contradiction')
      ? 'cap_contradiction'
      : 'cap_correction';

    const existingProfile = capabilityGapService.getProfileById(targetCapabilityId);
    let generalizationGapRecorded = false;
    if (existingProfile && existingProfile.associatedSkeletons && existingProfile.associatedSkeletons.length > 0) {
      capabilityGapService.recordGap({
        description: `【20章 対策の汎化不足】${existingProfile.name}の対策骨格を保存済みだが、未知の言い回しにより再度教師要請が発生`,
        gap_type: 'generalization_gap',
        capabilityId: targetCapabilityId,
        impact: 'MEDIUM',
        current_workaround: '教師に対策を再要請し、骨格パターンを一般化',
        candidate_solution: '骨格のトリガー語彙拡張、状況カテゴリ単位への抽象化、システムプロンプト強化',
        samplePrompt: payload.anonymizedExample || payload.abstractFailurePattern,
        associatedPatternId: existingProfile.associatedSkeletons[0],
      });
      generalizationGapRecorded = true;
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `⚠️ [20章&32章 対策の汎化不足検知] ${existingProfile.name}（既存骨格: ${existingProfile.associatedSkeletons.join(', ')}）において未知の言い回しによる教師要請が発生したため、32章不足能力レジストリへ汎化不足として自動記録しました`
      );
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🎓 [外部教師リクエスト開始] カテゴリ: ${payload.failureCategory}, パターン: 「${payload.abstractFailurePattern.slice(0, 30)}...」`
    );

    try {
      const res = await fetch('/api/teacher-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || `サーバー通信エラー (HTTP ${res.status})`;
        this.recordTeacherUsage({
          generatedSamplesCount: 0,
          verifiedPassedCount: 0,
          category: payload.failureCategory,
          success: false,
          notes: errMsg,
        });
        return { success: false, verifiedPassed: false, error: errMsg };
      }

      const data = await res.json();
      if (!data.success || !data.material) {
        const errMsg = data.error || '教材生成に失敗しました';
        this.recordTeacherUsage({
          generatedSamplesCount: 0,
          verifiedPassedCount: 0,
          category: payload.failureCategory,
          success: false,
          notes: errMsg,
        });
        return { success: false, verifiedPassed: false, error: errMsg };
      }

      const mat: TeacherGeneratedMaterial = data.material;
      const tokensUsed = data.tokensUsed || { promptTokens: 0, outputTokens: 0 };

      // 2. 返ってきた教材の検証 (無条件で正解としない - 設計方針 39節)
      // (a) コンテンツ安全境界チェック
      const safety = checkSampleSafety(mat.instruction, mat.outputTarget);
      if (!safety.safe) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `🛡️ [外部教師教材 棄却] 教材が安全境界フィルターに抵触しました (理由: ${safety.reasons.join(', ')})`
        );
        this.recordTeacherUsage({
          promptTokens: tokensUsed.promptTokens,
          outputTokens: tokensUsed.outputTokens,
          generatedSamplesCount: 1,
          verifiedPassedCount: 0,
          category: payload.failureCategory,
          success: true,
          notes: `安全境界により不合格: ${safety.reasons.join(', ')}`,
        });
        return {
          success: false,
          verifiedPassed: false,
          material: mat,
          error: `外部AIが生成した教材がコンテンツ安全基準を満たしていません (理由: ${safety.reasons.join(', ')})`,
        };
      }

      // (b) 品質チェック (最小文字数、自己矛盾)
      const normInst = (mat.instruction || '').trim();
      const normOut = (mat.outputTarget || '').trim();
      if (normInst.length < 5 || normOut.length < 5 || normInst === normOut) {
        this.recordTeacherUsage({
          promptTokens: tokensUsed.promptTokens,
          outputTokens: tokensUsed.outputTokens,
          generatedSamplesCount: 1,
          verifiedPassedCount: 0,
          category: payload.failureCategory,
          success: true,
          notes: '低品質（文字数不足または同一内容）のため刈り込み',
        });
        return {
          success: false,
          verifiedPassed: false,
          material: mat,
          error: '外部AIの生成教材が短すぎるか、指示と回答が自己矛盾しています。',
        };
      }

      // (c) 完了判定器による独立検証 (設計思想 ⑨: 外部教師の独立検証 - 鵜呑みにしない)
      const completionEval = completionJudgeService.evaluateCompletion({
        userGoal: mat.instruction,
        assistantResponse: mat.outputTarget,
      });

      if (completionEval.status === 'FAILED' || completionEval.status === 'BLOCKED' || completionEval.score < 60) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `🛡️ [外部教師教材 独立検証不合格] 完了判定器による評価スコア不足 (${completionEval.score}点, status: ${completionEval.status}): ${completionEval.headline}`
        );
        this.recordTeacherUsage({
          promptTokens: tokensUsed.promptTokens,
          outputTokens: tokensUsed.outputTokens,
          generatedSamplesCount: 1,
          verifiedPassedCount: 0,
          category: payload.failureCategory,
          success: true,
          notes: `完了判定器による独立検証不合格: スコア${completionEval.score}点 (${completionEval.headline})`,
        });
        return {
          success: false,
          verifiedPassed: false,
          material: mat,
          error: `外部AIの生成教材がローカル完了判定器の基準を満たしていません (スコア: ${completionEval.score}点 / 100点)。`,
        };
      }

      // (d) VBA安全性 & 構造化スキーマ検査 (設計思想 ⑧, ⑩)
      if (mat.outputTarget.toLowerCase().includes('sub ') || mat.outputTarget.toLowerCase().includes('dim ')) {
        const vbaEval = schemaValidationService.evaluateVbaSafety(mat.outputTarget);
        if (vbaEval.status === 'restricted') {
          systemLogger.warn(
            'SELF_IMPROVEMENT',
            `🛡️ [外部教師教材 棄却] 教材内のVBAマクロが高リスク操作(Restricted)と判定されました: ${vbaEval.warnings.join(', ')}`
          );
          this.recordTeacherUsage({
            promptTokens: tokensUsed.promptTokens,
            outputTokens: tokensUsed.outputTokens,
            generatedSamplesCount: 1,
            verifiedPassedCount: 0,
            category: payload.failureCategory,
            success: true,
            notes: `高リスクVBAコード検出のため棄却: ${vbaEval.warnings.join(', ')}`,
          });
          return {
            success: false,
            verifiedPassed: false,
            material: mat,
            error: `教材内に安全基準を超える高リスクなVBAコードが含まれています (${vbaEval.warnings.join(', ')})。`,
          };
        }
      }

      // (e) 教師教材の端末側効果検証ループ (設計思想 13章 ステップ7〜9)
      // 外部教師教材を端末内モデルに一時注入し、「本当に改善するか」を追加API呼び出しゼロで検証
      const anonymizedPrompt =
        payload.anonymizedExample || payload.abstractFailurePattern || mat.instruction;

      // 1. ベースライン回答の取得(材料なし)
      const baselineRespOriginal = await sendChatMessage({
        prompt: anonymizedPrompt,
        history: [],
        memories: [],
        engineMode: 'autonomous_rule',
      });
      const baselineTextOriginal = baselineRespOriginal.text || '';

      // 2. 材料ありの再回答 (教材の outputTarget / reasoningExplanation を一時的な MemoryItem として注入)
      const tempMemory: MemoryItem = {
        id: `temp_mat_${Date.now()}`,
        category: (mat.category as any) || (payload.failureCategory as any) || 'code',
        content: `【参照教材・解法指針】\n目標出力例:\n${mat.outputTarget}${
          mat.reasoningExplanation ? `\n解説:\n${mat.reasoningExplanation}` : ''
        }`,
        active: true,
        source: 'txt_import',
        importance: 5,
      };

      const withMaterialRespOriginal = await sendChatMessage({
        prompt: anonymizedPrompt,
        history: [],
        memories: [tempMemory],
        engineMode: 'autonomous_rule',
      });
      const withMaterialTextOriginal = withMaterialRespOriginal.text || '';

      // 3. 言い換え問題を1問作る (端末内処理、教師API不使用)
      const paraphraseGenResp = await sendChatMessage({
        prompt: `次の質問を意味を変えずに言い換えてください: ${anonymizedPrompt}`,
        history: [],
        memories: [],
        engineMode: 'autonomous_rule',
      });
      let paraphrasePrompt = (paraphraseGenResp.text || '').trim();
      paraphrasePrompt = paraphrasePrompt.replace(/^言い換え[:：\s]*|^「|」$/g, '').trim();
      if (!paraphrasePrompt || paraphrasePrompt.length < 5) {
        paraphrasePrompt = `${anonymizedPrompt}（別表現での質問: 具体的な対応手順と模範コードを教えてください）`;
      }

      // 4. 言い換え問題でも同様に材料なし/材料ありの2回答を取得
      const baselineRespParaphrase = await sendChatMessage({
        prompt: paraphrasePrompt,
        history: [],
        memories: [],
        engineMode: 'autonomous_rule',
      });
      const baselineTextParaphrase = baselineRespParaphrase.text || '';

      const withMaterialRespParaphrase = await sendChatMessage({
        prompt: paraphrasePrompt,
        history: [],
        memories: [tempMemory],
        engineMode: 'autonomous_rule',
      });
      const withMaterialTextParaphrase = withMaterialRespParaphrase.text || '';

      // 5. 改善判定 (原文×材料なし/あり、言い換え×材料なし/あり)
      const evalBaselineOriginal = completionJudgeService.evaluateCompletion({
        userGoal: anonymizedPrompt,
        assistantResponse: baselineTextOriginal,
      });
      const evalWithMaterialOriginal = completionJudgeService.evaluateCompletion({
        userGoal: anonymizedPrompt,
        assistantResponse: withMaterialTextOriginal,
      });

      const evalBaselineParaphrase = completionJudgeService.evaluateCompletion({
        userGoal: paraphrasePrompt,
        assistantResponse: baselineTextParaphrase,
      });
      const evalWithMaterialParaphrase = completionJudgeService.evaluateCompletion({
        userGoal: paraphrasePrompt,
        assistantResponse: withMaterialTextParaphrase,
      });

      const baselineScoreOriginal = evalBaselineOriginal.score;
      const withMaterialScoreOriginal = evalWithMaterialOriginal.score;
      const baselineScoreParaphrase = evalBaselineParaphrase.score;
      const withMaterialScoreParaphrase = evalWithMaterialParaphrase.score;

      const diffOriginal = withMaterialScoreOriginal - baselineScoreOriginal;
      const diffParaphrase = withMaterialScoreParaphrase - baselineScoreParaphrase;

      const originalImproved = diffOriginal >= 10;
      const paraphraseImproved = diffParaphrase >= 10;
      const verifiedEffective = originalImproved && paraphraseImproved;

      const verificationNote = `原文${diffOriginal >= 0 ? `+${diffOriginal}` : diffOriginal}点 (${baselineScoreOriginal}→${withMaterialScoreOriginal}) / 言い換え${diffParaphrase >= 0 ? `+${diffParaphrase}` : diffParaphrase}点 (${baselineScoreParaphrase}→${withMaterialScoreParaphrase})`;

      // 6. 結果の反映
      if (verifiedEffective) {
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🧪 [13章 端末側効果検証合格] 教材注入による改善を確認しました: ${verificationNote}`
        );
      } else {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `対策の汎化不足(13章検証不合格): ${mat.category || payload.failureCategory} / 原文改善${originalImproved} 言い換え改善${paraphraseImproved}`
        );
        // 32章 不足能力レジストリへの正式記録
        capabilityGapService.recordGap({
          description: `【13章 端末検証不合格】${payload.failureCategory}の外部教師教材を端末内モデルへ注入したが、改善基準(+10点)に達せず汎化不足を検出 [${verificationNote}]`,
          gap_type: 'generalization_gap',
          capabilityId: targetCapabilityId,
          impact: 'MEDIUM',
          current_workaround: '教師教材を承認待ちで保持しつつ、回答骨格の一般化および分解を検討',
          candidate_solution: '回答骨格の適用条件を状況カテゴリ単位へ一般化、16.3仮想学習試験による検証',
          samplePrompt: anonymizedPrompt,
        });
        generalizationGapRecorded = true;
      }

      // 3. 独立検証合格 ➔ 中信頼(medium) & source: 'external_teacher' で保存
      // 勝手な自動マージを防止するため approved: false (ユーザーによる確認・承認待ち) とする
      const savedSample = selfImprovementService.addTrainingSample({
        instruction: safety.redactedUserText ?? mat.instruction,
        inputContext: mat.inputContext,
        outputTarget: safety.redactedAssistantText ?? mat.outputTarget,
        category: (mat.category as any) || (payload.failureCategory as any) || 'chat',
        reliability: 'medium', // 中信頼扱い
        source: 'external_teacher',
        approved: false, // 勝手な自動マージ防止: ユーザー確認待ち
        split: 'train',
        failureReason: payload.failureReason,
        verifiedEffective,
        verificationNote,
      });

      // 弱点昇格フラグを更新
      if (patternKeyToPromote) {
        selfImprovementService.markFailurePromoted(patternKeyToPromote);
      }

      // 20章 & 9章: 教師教材から「対策(回答骨格・修復パターン)」を生成・保存
      // 教師はその場の返信のためではなく、対策を作らせて回答骨格として保存することが目的
      let savedSkeleton: ResponseSkeleton | null = null;
      try {
        savedSkeleton = answerPlanService.createSkeletonFromTeacherMaterial({
          instruction: mat.instruction,
          outputTarget: mat.outputTarget,
          reasoningExplanation: mat.reasoningExplanation,
          category: mat.category || payload.failureCategory,
        });

        // 該当能力プロファイルの紐づき骨格リストに追加
        const prof = capabilityGapService.getProfileById(targetCapabilityId);
        if (prof && savedSkeleton) {
          if (!prof.associatedSkeletons.includes(savedSkeleton.pattern_id)) {
            prof.associatedSkeletons.push(savedSkeleton.pattern_id);
            capabilityGapService.saveMasteryProfiles();
          }
        }
      } catch (skErr) {
        console.warn('Failed to auto-create answer plan skeleton from teacher material:', skErr);
      }

      // 4. 実績記録
      this.recordTeacherUsage({
        promptTokens: tokensUsed.promptTokens,
        outputTokens: tokensUsed.outputTokens,
        generatedSamplesCount: 1,
        verifiedPassedCount: 1,
        category: payload.failureCategory,
        success: true,
        notes: `独立検証合格 (スコア: ${completionEval.score}点, 端末検証: ${verifiedEffective ? '合格' : '汎化不足'} [${verificationNote}], 対策骨格: ${savedSkeleton?.pattern_id || 'なし'})・ユーザー確認待ちとして安全登録完了`,
      });

      systemLogger.info(
        'SELF_IMPROVEMENT',
        `✅ [外部教師教材 独立検証合格] 教材を external_teacher (中信頼/承認待ち) として追加しました (ID: ${savedSample?.id || 'unknown'}, 品質スコア: ${completionEval.score}点, 端末効果検証: ${verifiedEffective ? '合格' : '汎化不足'}, 対策骨格: ${savedSkeleton?.pattern_id || '未作成'})`
      );

      return {
        success: true,
        verifiedPassed: true,
        material: mat,
        savedSample,
        savedSkeleton,
        verifiedEffective,
        verificationNote,
        generalizationGapRecorded,
      };
    } catch (err: any) {
      const errMsg = err?.message || '通信例外が発生しました';
      this.recordTeacherUsage({
        generatedSamplesCount: 0,
        verifiedPassedCount: 0,
        category: payload.failureCategory,
        success: false,
        notes: errMsg,
      });
      return { success: false, verifiedPassed: false, error: errMsg };
    }
  }

  /**
   * 予算上限の変更 (設定更新)
   */
  public updateBudgetLimits(dailyCalls: number, monthlyCalls: number): void {
    this.limits.dailyCalls = Math.max(1, dailyCalls);
    this.limits.monthlyCalls = Math.max(this.limits.dailyCalls, monthlyCalls);
    this.saveState();
  }

  public getUsageRecords(): TeacherUsageRecord[] {
    return this.usageRecords;
  }

  public resetUsage(): void {
    this.usage.dailyCalls = 0;
    this.usage.monthlyCalls = 0;
    this.usage.dailyPromptTokens = 0;
    this.usage.dailyOutputTokens = 0;
    this.usage.monthlyPromptTokens = 0;
    this.usage.monthlyOutputTokens = 0;
    this.saveState();
  }

  private refreshDateWindows(): void {
    const today = getTodayString();
    const thisMonth = getCurrentMonthString();

    let changed = false;
    if (this.usage.currentDate !== today) {
      this.usage.currentDate = today;
      this.usage.dailyCalls = 0;
      this.usage.dailyPromptTokens = 0;
      this.usage.dailyOutputTokens = 0;
      changed = true;
    }

    if (this.usage.currentMonth !== thisMonth) {
      this.usage.currentMonth = thisMonth;
      this.usage.monthlyCalls = 0;
      this.usage.monthlyPromptTokens = 0;
      this.usage.monthlyOutputTokens = 0;
      changed = true;
    }

    if (changed) {
      this.saveState();
    }
  }
}

export const teacherRequestService = new TeacherRequestService();
