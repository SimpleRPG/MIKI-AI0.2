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
  DelayedTeacherQueueItem,
  AutoTeacherRequestRecord,
  MaterialValueMetric,
  TeacherBudgetTier,
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
const DELAYED_QUEUE_STORAGE_KEY = 'miki_ai_delayed_teacher_queue';
const AUTO_REQUEST_RECORDS_KEY = 'miki_ai_auto_teacher_request_records';
const AUTO_REQUEST_ENABLED_KEY = 'miki_ai_auto_teacher_request_enabled';

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
 * 外部教師リクエストパイプラインサービス (設計思想 37〜39節 フェーズ8 & 64章)
 *
 * 1. 端末内解決不可の弱点パターンのみを判定ゲート(shouldRequestTeacher)で通過
 * 2. 生会話・固有名詞を徹底的に匿名化・抽象化(anonymizeFailureExample)
 * 3. 失敗例・期待条件・教材形式のみを構造化JSON化(buildTeacherRequestPayload)
 * 4. 日次/月次の厳格な予算・呼び出し上限管理(checkBudget)
 * 5. 再発する失敗検知時の自動発火(handleRecurringFailureAutoRequest) & 予算超過時の遅延キュー退避
 * 6. Gemini応答の安全・品質二重フィルタリング検証 & external_teacher中信頼保存
 */
export class TeacherRequestService {
  private limits: TeacherBudgetLimits = { ...DEFAULT_LIMITS };
  private usage: TeacherBudgetUsage;
  private usageRecords: TeacherUsageRecord[] = [];
  private delayedQueue: DelayedTeacherQueueItem[] = [];
  private autoRequestRecords: AutoTeacherRequestRecord[] = [];
  private autoRequestEnabled: boolean = true;
  private inFlightPatternKeys: Set<string> = new Set();

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

      const rawQueue = storageService.getItem(DELAYED_QUEUE_STORAGE_KEY);
      if (rawQueue) {
        const parsed = JSON.parse(rawQueue);
        this.delayedQueue = Array.isArray(parsed)
          ? parsed.map((q: any) => ({ ...q, priority: typeof q.priority === 'number' ? q.priority : 0 }))
          : [];
      }

      const rawAutoRecords = storageService.getItem(AUTO_REQUEST_RECORDS_KEY);
      if (rawAutoRecords) {
        this.autoRequestRecords = JSON.parse(rawAutoRecords);
      }

      const rawAutoEnabled = storageService.getItem(AUTO_REQUEST_ENABLED_KEY);
      if (rawAutoEnabled !== null) {
        this.autoRequestEnabled = rawAutoEnabled !== 'false';
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
      storageService.setItem(DELAYED_QUEUE_STORAGE_KEY, JSON.stringify(this.delayedQueue.slice(0, 100)));
      storageService.setItem(AUTO_REQUEST_RECORDS_KEY, JSON.stringify(this.autoRequestRecords.slice(0, 100)));
      storageService.setItem(AUTO_REQUEST_ENABLED_KEY, String(this.autoRequestEnabled));
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

    let tier: TeacherBudgetTier = 'WAITING_NEXT_BUDGET';
    const remainingRatio = dailyRemaining / Math.max(1, this.limits.dailyCalls);

    if (!allowed || dailyRemaining <= 0) {
      tier = 'WAITING_NEXT_BUDGET';
    } else if (remainingRatio > 0.6) {
      tier = 'FULL_EXPANSIVE'; // 複数ターン会話・詳細批評・模範回答・反例・言い換え試験
    } else if (remainingRatio >= 0.2) {
      tier = 'STANDARD_CRITIQUE'; // 批評・模範回答・短縮推論
    } else if (remainingRatio >= 0.05) {
      tier = 'CONSERVATIVE_PRINCIPLES'; // 改善原則・回答骨格・採点規則
    } else {
      tier = 'WAITING_NEXT_BUDGET';
    }

    return {
      allowed,
      reason,
      tier,
      remaining: {
        daily: dailyRemaining,
        monthly: monthlyRemaining,
      },
      usage: { ...this.usage },
      limits: { ...this.limits },
    };
  }

  /**
   * 11章: 教材価値の設計指標算出
   * 教材価値 = 失敗頻度 × 影響度 × 再利用可能性 × 検証可能性 ÷ 既存教材との重複度
   */
  public calculateMaterialValue(params: {
    failureFrequency: number;
    impactScore: number;
    reusabilityScore: number;
    verifiabilityScore: number;
    duplicationScore: number;
  }): MaterialValueMetric {
    const freq = Math.max(1, params.failureFrequency || 1);
    const impact = Math.max(1, params.impactScore || 1);
    const reuse = Math.max(1, params.reusabilityScore || 1);
    const verify = Math.max(1, params.verifiabilityScore || 1);
    const dup = Math.max(1, params.duplicationScore || 1);

    const calculatedValue = Math.round((freq * impact * reuse * verify) / dup);

    return {
      failureFrequency: freq,
      impactScore: impact,
      reusabilityScore: reuse,
      verifiabilityScore: verify,
      duplicationScore: dup,
      calculatedValue,
    };
  }

  /**
   * 11章: 現在の予算残量階層 (TeacherBudgetTier) を取得
   */
  public getBudgetTier(): TeacherBudgetTier {
    const status = this.checkBudget();
    return status.tier || 'WAITING_NEXT_BUDGET';
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

  // =========================================================================
  // オフライン遅延教師リクエストキュー管理 (設計思想 11章 睡眠ゲート ＆ 20章 不確実性連携)
  // =========================================================================

  public getDelayedQueue(): DelayedTeacherQueueItem[] {
    return [...this.delayedQueue];
  }

  /**
   * 設計思想 12章: 教材要求キュー優先度スコア計算式 (基準点0)
   *
   * 加点:
   * ・ユーザーから明確に訂正された          +30
   * ・以前の説明と矛盾した                  +20
   * ・質問の意図を外した                    +20
   * ・古い前提を使った                      +15
   * ・複数条件を落とした                    +15
   * ・同じ失敗を繰り返した(頻度に応じ加点) +5 × (frequency - 1)、上限+25
   * ・日本語が不自然だった                  +10
   * ・回答長が大きく不適切だった            +10
   *
   * 減点:
   * ・実用効果を検証できない                -15
   * ・単なる語尾の違い                      -20
   * ・既存教材とほぼ同じ                    -30
   * ・端末モデルが既に安定して正解する      -30
   *
   * 合計が0以下の要求はキューに追加しない(却下)。
   * キュー処理時は合計スコアの高い順に処理する。
   */
  public calculateQueuePriority(params: {
    userPrompt: string;
    source?: 'uncertainty_divergence' | 'failure_recurrence' | 'manual';
    failureCategory?: string;
    divergenceTypes?: string[];
    uncertaintyScore?: number;
    candidateResponses?: string[];
    recurrenceCount?: number;
    failureReason?: string;
    reasons?: string[];
    userCorrection?: boolean;
    contradictedPreviousExplanation?: boolean;
    missedUserIntent?: boolean;
    outdatedPremise?: boolean;
    missedMultipleConditions?: boolean;
    unnaturalJapanese?: boolean;
    inappropriateResponseLength?: boolean;
    unverifiableEffect?: boolean;
    trivialEndingVariation?: boolean;
    duplicateOfExistingSample?: boolean;
    deviceModelStableCorrect?: boolean;
  }): { priority: number; breakdown: string[] } {
    let score = 0;
    const breakdown: string[] = [];

    const reasonText = (params.failureReason || params.reasons?.join(' ') || '').toLowerCase();
    const promptText = (params.userPrompt || '').toLowerCase();
    const divergences = params.divergenceTypes || [];

    // 1. ユーザーから明確に訂正された (+30)
    if (
      params.userCorrection ||
      reasonText.includes('訂正') ||
      reasonText.includes('ユーザー指摘') ||
      reasonText.includes('誤り指摘') ||
      promptText.includes('違います') ||
      promptText.includes('そうではなく') ||
      promptText.includes('間違ってい')
    ) {
      score += 30;
      breakdown.push('ユーザーから明確に訂正された (+30)');
    }

    // 2. 以前の説明と矛盾した (+20)
    if (
      params.contradictedPreviousExplanation ||
      divergences.includes('divergence_conclusion') ||
      reasonText.includes('矛盾') ||
      reasonText.includes('以前の説明と異') ||
      reasonText.includes('前言撤回')
    ) {
      score += 20;
      breakdown.push('以前の説明と矛盾した (+20)');
    }

    // 3. 質問の意図を外した (+20)
    if (
      params.missedUserIntent ||
      reasonText.includes('意図を外') ||
      reasonText.includes('的外れ') ||
      reasonText.includes('意図不一致') ||
      reasonText.includes('質問の意図')
    ) {
      score += 20;
      breakdown.push('質問の意図を外した (+20)');
    }

    // 4. 古い前提を使った (+15)
    if (
      params.outdatedPremise ||
      reasonText.includes('古い前提') ||
      reasonText.includes('前提の更新漏れ') ||
      reasonText.includes('前提不一致')
    ) {
      score += 15;
      breakdown.push('古い前提を使った (+15)');
    }

    // 5. 複数条件を落とした (+15)
    if (
      params.missedMultipleConditions ||
      divergences.includes('divergence_priority') ||
      reasonText.includes('複数条件') ||
      reasonText.includes('条件落') ||
      reasonText.includes('条件漏れ') ||
      reasonText.includes('制約違反')
    ) {
      score += 15;
      breakdown.push('複数条件を落とした (+15)');
    }

    // 6. 同じ失敗を繰り返した (頻度に応じ加点: +5 × (frequency - 1)、上限+25)
    const frequency = params.recurrenceCount ?? (params.source === 'failure_recurrence' ? 2 : 1);
    if (frequency > 1) {
      const freqScore = Math.min(25, 5 * (frequency - 1));
      score += freqScore;
      breakdown.push(`同じ失敗を繰り返した (再発${frequency}回: +${freqScore})`);
    }

    // 7. 日本語が不自然だった (+10)
    if (
      params.unnaturalJapanese ||
      reasonText.includes('日本語が不自然') ||
      reasonText.includes('文法不自然') ||
      reasonText.includes('不自然な表現')
    ) {
      score += 10;
      breakdown.push('日本語が不自然だった (+10)');
    }

    // 8. 回答長が大きく不適切だった (+10)
    if (
      params.inappropriateResponseLength ||
      reasonText.includes('回答長') ||
      reasonText.includes('長すぎ') ||
      reasonText.includes('短すぎ') ||
      reasonText.includes('冗長')
    ) {
      score += 10;
      breakdown.push('回答長が大きく不適切だった (+10)');
    }

    // 減点項目
    // 9. 実用効果を検証できない (-15)
    if (
      params.unverifiableEffect ||
      reasonText.includes('実用効果を検証できない') ||
      reasonText.includes('検証不可') ||
      reasonText.includes('効果未検証')
    ) {
      score -= 15;
      breakdown.push('実用効果を検証できない (-15)');
    }

    // 10. 単なる語尾の違い (-20)
    if (
      params.trivialEndingVariation ||
      reasonText.includes('単なる語尾の違い') ||
      reasonText.includes('語尾の違いのみ') ||
      reasonText.includes('文末表現のみ')
    ) {
      score -= 20;
      breakdown.push('単なる語尾の違い (-20)');
    }

    // 11. 既存教材とほぼ同じ (-30)
    if (
      params.duplicateOfExistingSample ||
      reasonText.includes('既存教材とほぼ同じ') ||
      reasonText.includes('既存教材重複') ||
      reasonText.includes('既存正解が存在')
    ) {
      score -= 30;
      breakdown.push('既存教材とほぼ同じ (-30)');
    }

    // 12. 端末モデルが既に安定して正解する (-30)
    if (
      params.deviceModelStableCorrect ||
      reasonText.includes('安定して正解') ||
      reasonText.includes('端末内解決可能') ||
      reasonText.includes('端末側で正解')
    ) {
      score -= 30;
      breakdown.push('端末モデルが既に安定して正解する (-30)');
    }

    // 特例: 手動テスト要求で何のフラグも一致しなかった場合の初期点
    if (params.source === 'manual' && score === 0 && breakdown.length === 0) {
      score = 25;
      breakdown.push('手動テスト要求 (基準テスト加点 +25)');
    }

    // 不確実性ブレで不確実性スコアが高い場合の補正
    if (params.source === 'uncertainty_divergence' && score === 0 && (params.uncertaintyScore ?? 0) >= 60) {
      score = 20;
      breakdown.push(`高不確実性ブレ (不確実性スコア: ${params.uncertaintyScore}点 -> +20)`);
    }

    return { priority: score, breakdown };
  }

  public enqueueDelayedRequest(params: {
    source?: 'uncertainty_divergence' | 'failure_recurrence' | 'manual';
    targetCapabilityId: string;
    userPrompt: string;
    failureCategory?: string;
    divergenceTypes?: string[];
    uncertaintyScore?: number;
    candidateResponses?: string[];
    recurrenceCount?: number;
    failureReason?: string;
    reasons?: string[];
    userCorrection?: boolean;
    contradictedPreviousExplanation?: boolean;
    missedUserIntent?: boolean;
    outdatedPremise?: boolean;
    missedMultipleConditions?: boolean;
    unnaturalJapanese?: boolean;
    inappropriateResponseLength?: boolean;
    unverifiableEffect?: boolean;
    trivialEndingVariation?: boolean;
    duplicateOfExistingSample?: boolean;
    deviceModelStableCorrect?: boolean;
  }): DelayedTeacherQueueItem | null {
    // 12章: 優先度スコアを計算
    const { priority, breakdown } = this.calculateQueuePriority(params);

    if (priority <= 0) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🚫 [12章 教材要求キュー却下] 優先度不足のため遅延キューへの追加を却下しました (スコア: ${priority}点, 内訳: ${
          breakdown.join(' / ') || '加点なし'
        }): 「${params.userPrompt.slice(0, 40)}...」`
      );
      return null;
    }

    const anonymized = this.anonymizeFailureExample(params.userPrompt);
    const item: DelayedTeacherQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      source: params.source || 'uncertainty_divergence',
      targetCapabilityId: params.targetCapabilityId,
      userPrompt: params.userPrompt,
      anonymizedPrompt: anonymized,
      failureCategory: params.failureCategory || 'chat',
      divergenceTypes: params.divergenceTypes || [],
      uncertaintyScore: params.uncertaintyScore,
      candidateResponses: params.candidateResponses,
      priority,
      enqueuedAt: Date.now(),
      status: 'PENDING',
      retryCount: 0,
    };

    this.delayedQueue = [item, ...this.delayedQueue.slice(0, 99)];
    this.saveState();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📥 [11章/12章/20章 遅延教師キュー追加] 深い睡眠バッチ待機キューへ追加しました (優先度: ${priority}点): ${item.failureCategory} (対象: ${item.targetCapabilityId}) [内訳: ${breakdown.join(', ')}]`
    );

    return item;
  }

  public removeQueueItem(id: string): void {
    this.delayedQueue = this.delayedQueue.filter((q) => q.id !== id);
    this.saveState();
  }

  public clearDelayedQueue(): void {
    this.delayedQueue = [];
    this.saveState();
  }

  /**
   * 深い睡眠 (Deep Sleep) または手動トリガー時に待機キューを一括処理
   */
  public async processDelayedTeacherQueue(maxBatchSize = 3): Promise<{
    processedCount: number;
    succeededCount: number;
    failedCount: number;
    results: Array<{ id: string; success: boolean; error?: string; skeletonId?: string }>;
  }> {
    const pendingItems = this.delayedQueue.filter((q) => q.status === 'PENDING');
    if (pendingItems.length === 0) {
      return { processedCount: 0, succeededCount: 0, failedCount: 0, results: [] };
    }

    // 12章: 合計スコアの高い順 (降順) に並び替えて処理
    pendingItems.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const batch = pendingItems.slice(0, maxBatchSize);
    let succeededCount = 0;
    let failedCount = 0;
    const results: Array<{ id: string; success: boolean; error?: string; skeletonId?: string }> = [];

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `⚡ [遅延教師キュー バッチ処理開始] 対象 ${batch.length}件の遅延要請を優先度スコア順に順次処理します`
    );

    for (const item of batch) {
      // 予算チェック
      const budget = this.checkBudget();
      if (!budget.allowed) {
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `⚠️ [遅延教師キュー中断] 予算制限に到達したため以降のキュー処理を中断します: ${budget.reason}`
        );
        break;
      }

      // ステータスを PROCESSING に更新
      item.status = 'PROCESSING';
      this.saveState();

      try {
        const payload = this.buildTeacherRequestPayload(
          item.anonymizedPrompt || item.userPrompt,
          item.failureCategory || 'chat',
          `20章 不確実性ブレ (スコア: ${item.uncertaintyScore ?? 0}点) / 乖離: ${item.divergenceTypes?.join(', ') || 'none'}`
        );

        const res = await this.requestTeacherMaterial(payload, item.targetCapabilityId);

        item.processedAt = Date.now();
        if (res.success) {
          item.status = 'PROCESSED';
          item.verificationPassed = res.verifiedEffective;
          item.resultSkeletonId = res.savedSkeleton?.pattern_id;
          item.resultMaterialId = res.savedSample?.id;
          succeededCount++;
          results.push({
            id: item.id,
            success: true,
            skeletonId: res.savedSkeleton?.pattern_id,
          });
        } else {
          item.retryCount += 1;
          item.errorMessage = res.error || '不明なエラー';
          if (item.retryCount >= 2) {
            item.status = 'FAILED';
          } else {
            item.status = 'PENDING'; // リトライ待ち
          }
          failedCount++;
          results.push({
            id: item.id,
            success: false,
            error: res.error,
          });
        }
      } catch (err: any) {
        item.retryCount += 1;
        item.errorMessage = err?.message || String(err);
        item.status = item.retryCount >= 2 ? 'FAILED' : 'PENDING';
        failedCount++;
        results.push({
          id: item.id,
          success: false,
          error: item.errorMessage,
        });
      }

      this.saveState();
    }

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `✓ [遅延教師キュー バッチ完了] 処理: ${batch.length}件 (成功: ${succeededCount}件, 失敗: ${failedCount}件)`
    );

    return {
      processedCount: batch.length,
      succeededCount,
      failedCount,
      results,
    };
  }

  // =========================================================================
  // 再発失敗検知・外部教師自動発火パイプライン (設計思想 64章/20章/32章)
  // =========================================================================

  public isAutoRequestEnabled(): boolean {
    return this.autoRequestEnabled;
  }

  public setAutoRequestEnabled(enabled: boolean): void {
    this.autoRequestEnabled = enabled;
    this.saveState();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `⚙️ [外部教師自動発火設定] 再発失敗時の自動要請を${enabled ? '【有効】' : '【無効】'}に切り替えました`
    );
  }

  public getAutoRequestRecords(): AutoTeacherRequestRecord[] {
    return [...this.autoRequestRecords];
  }

  public clearAutoRequestRecords(): void {
    this.autoRequestRecords = [];
    this.saveState();
  }

  public isInFlight(patternKey: string): boolean {
    return this.inFlightPatternKeys.has(patternKey);
  }

  /**
   * 再発する失敗を検知した際の外部教師自動発火パイプライン (設計思想 64章)
   *
   * 1. 「本当に外部教師が必要か」を shouldRequestTeacher() で厳格判定
   *    (①同種失敗が2回以上再発 ②既存教材に同種の正解がない ③端末機械検証だけでは不足)
   * 2. 重複呼び出し防止 (inFlightPatternKeys) & 昇格済み抑止
   * 3. 予算上限時は「遅延キュー (深い睡眠バッチ)」へ自動退避
   * 4. 予算内であれば即時に匿名化・構造化・独立検証・回答骨格生成を非同期実行
   */
  public async handleRecurringFailureAutoRequest(params: {
    patternKey: string;
    recurrenceEntry: FailureRecurrenceEntry;
    failureReason?: string;
    source?: string;
  }): Promise<{
    success: boolean;
    action: 'REQUESTED' | 'QUEUED' | 'SKIPPED';
    reason?: string;
    recordId?: string;
    skeletonId?: string;
  }> {
    const { patternKey, recurrenceEntry, failureReason, source } = params;

    // 1. 自動発火機能の有効性チェック
    if (!this.autoRequestEnabled) {
      return {
        success: false,
        action: 'SKIPPED',
        reason: '再発失敗時の外部教師自動発火が無効に設定されています',
      };
    }

    // 2. 既に同一パターンのリクエストが処理中 (In-Flight) の場合は二重発火を防止
    if (this.inFlightPatternKeys.has(patternKey)) {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `⏳ [外部教師自動発火 スキップ] パターン「${patternKey}」は既に外部教師リクエスト処理中です`
      );
      return {
        success: false,
        action: 'SKIPPED',
        reason: '同一パターンの外部教師リクエストが現在処理中です',
      };
    }

    // 3. 既に学習データ昇格済みの場合は重複要請を防止
    if (recurrenceEntry.promotedToTraining) {
      return {
        success: false,
        action: 'SKIPPED',
        reason: '該当パターンは既に教材化・学習データ昇格済みです',
      };
    }

    // 4. 厳格判定ゲート: 「本当に外部教師が必要か？」(64章の3要件)
    const shouldRequest = this.shouldRequestTeacher({
      patternKey,
      category: recurrenceEntry.category,
      samplePrompt: recurrenceEntry.samplePrompt,
      recurrenceCount: recurrenceEntry.recurrenceCount,
      reason: failureReason || recurrenceEntry.notes || recurrenceEntry.reason,
    });

    if (!shouldRequest) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `ℹ️ [外部教師判定ゲート 却下] パターン「${patternKey}」は端末内解決可能または既存教材が存在するため外部要請をスキップしました`
      );
      return {
        success: false,
        action: 'SKIPPED',
        reason: '端末内解決可能または既存正解教材が存在します',
      };
    }

    const recordId = `autoreq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const promptSnippet = recurrenceEntry.samplePrompt.slice(0, 60);

    // 5. 予算チェック (日次/月次上限)
    const budget = this.checkBudget();

    // 予算上限オーバーの場合 ➔ 諦めず「深い睡眠待機キュー (11章/20章)」へ自動退避
    if (!budget.allowed) {
      const queuedItem = this.enqueueDelayedRequest({
        source: 'failure_recurrence',
        targetCapabilityId: recurrenceEntry.category.toLowerCase().includes('vba')
          ? 'cap_abstract_vba_design'
          : recurrenceEntry.category.toLowerCase().includes('code')
          ? 'cap_code_comprehension'
          : 'cap_logical_priority',
        userPrompt: recurrenceEntry.samplePrompt,
        failureCategory: recurrenceEntry.category,
        divergenceTypes: ['failure_recurrence'],
        candidateResponses: [],
        recurrenceCount: recurrenceEntry.recurrenceCount,
        failureReason: failureReason || recurrenceEntry.notes || recurrenceEntry.reason,
      });

      if (!queuedItem) {
        recurrenceEntry.autoRequested = false;
        recurrenceEntry.autoRequestStatus = 'FAILED';
        recurrenceEntry.autoRequestResult = '12章優先度スコア不足のため遅延キューへの追加が却下されました';
        this.saveState();
        return {
          success: false,
          action: 'SKIPPED',
          reason: '12章優先度スコア不足のため遅延キューへの追加が却下されました (スコア0点以下)',
        };
      }

      recurrenceEntry.autoRequested = true;
      recurrenceEntry.autoRequestedAt = Date.now();
      recurrenceEntry.autoRequestStatus = 'QUEUED';
      recurrenceEntry.autoRequestResult = `予算制限到達のため遅延キューへ自動退避 (優先度: ${queuedItem.priority}点, キューID: ${queuedItem.id})`;

      const autoRecord: AutoTeacherRequestRecord = {
        id: recordId,
        patternKey,
        category: recurrenceEntry.category,
        recurrenceCount: recurrenceEntry.recurrenceCount,
        promptSnippet,
        requestedAt: Date.now(),
        status: 'QUEUED',
        notes: `日次/月次予算上限に達したため睡眠バッチキューへ退避 (優先度: ${queuedItem.priority}点): ${budget.reason}`,
      };
      this.autoRequestRecords = [autoRecord, ...this.autoRequestRecords.slice(0, 99)];
      this.saveState();

      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `📥 [再発検知 外部教師キュー退避] 予算上限のため遅延睡眠キューへ退避しました (優先度: ${queuedItem.priority}点, 再発: ${recurrenceEntry.recurrenceCount}回): 「${promptSnippet}...」`
      );

      return {
        success: true,
        action: 'QUEUED',
        recordId,
        reason: budget.reason,
      };
    }

    // 6. 予算内 ➔ 即時自動発火
    this.inFlightPatternKeys.add(patternKey);
    recurrenceEntry.autoRequested = true;
    recurrenceEntry.autoRequestedAt = Date.now();
    recurrenceEntry.autoRequestStatus = 'IN_FLIGHT';

    const autoRecord: AutoTeacherRequestRecord = {
      id: recordId,
      patternKey,
      category: recurrenceEntry.category,
      recurrenceCount: recurrenceEntry.recurrenceCount,
      promptSnippet,
      requestedAt: Date.now(),
      status: 'IN_FLIGHT',
      notes: `同種失敗が${recurrenceEntry.recurrenceCount}回再発したため自動発火 (発火元: ${source || 'diagnoseFailure'})`,
    };
    this.autoRequestRecords = [autoRecord, ...this.autoRequestRecords.slice(0, 99)];
    this.saveState();

    systemLogger.warn(
      'SELF_IMPROVEMENT',
      `🚀 [再発検知 外部教師自動発火] 同種失敗が${recurrenceEntry.recurrenceCount}回再発したため外部教師へ教材作成を自動要請します: 「${promptSnippet}...」 (カテゴリ: ${recurrenceEntry.category})`
    );

    try {
      // 匿名化と抽象化
      const anonymized = this.anonymizeFailureExample(recurrenceEntry.samplePrompt);
      const payload = this.buildTeacherRequestPayload(
        anonymized,
        recurrenceEntry.category,
        failureReason || recurrenceEntry.notes || recurrenceEntry.reason
      );

      // 外部教師へのリクエスト & 独立検証 & 回答骨格生成
      const res = await this.requestTeacherMaterial(payload, patternKey);

      if (res.success && res.material) {
        recurrenceEntry.autoRequestStatus = 'SUCCESS';
        recurrenceEntry.autoRequestResult = `教材生成・独立検証合格 (骨格: ${res.savedSkeleton?.pattern_id || '未生成'}, 効果検証: ${res.verifiedEffective ? '合格' : '汎化不足'})`;
        recurrenceEntry.promotedToTraining = true;

        autoRecord.status = 'SUCCESS';
        autoRecord.verificationPassed = res.verifiedEffective;
        autoRecord.materialId = res.savedSample?.id;
        autoRecord.skeletonId = res.savedSkeleton?.pattern_id;
        autoRecord.notes = `外部教師リクエスト成功・教材追加完了 (骨格: ${res.savedSkeleton?.pattern_id || 'なし'}, 検証: ${res.verificationNote || '完了'})`;

        this.saveState();

        systemLogger.info(
          'SELF_IMPROVEMENT',
          `🎉 [外部教師自動発火 完了] 再発失敗に対する正解教材・回答骨格の獲得に成功しました (骨格ID: ${res.savedSkeleton?.pattern_id || 'なし'}): 「${promptSnippet}...」`
        );

        return {
          success: true,
          action: 'REQUESTED',
          recordId,
          skeletonId: res.savedSkeleton?.pattern_id,
        };
      } else {
        recurrenceEntry.autoRequestStatus = 'FAILED';
        recurrenceEntry.autoRequestResult = res.error || '教材検証不合格または通信失敗';

        autoRecord.status = 'FAILED';
        autoRecord.error = res.error || '教材検証不合格または通信失敗';

        this.saveState();

        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `⚠️ [外部教師自動発火 失敗] 教材生成または独立検証に合格しませんでした: ${res.error}`
        );

        return {
          success: false,
          action: 'REQUESTED',
          recordId,
          reason: res.error,
        };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      recurrenceEntry.autoRequestStatus = 'FAILED';
      recurrenceEntry.autoRequestResult = errMsg;

      autoRecord.status = 'FAILED';
      autoRecord.error = errMsg;

      this.saveState();

      systemLogger.error(
        'SELF_IMPROVEMENT',
        `❌ [外部教師自動発火 例外] 自動要請パイプラインで例外が発生しました: ${errMsg}`
      );

      return {
        success: false,
        action: 'REQUESTED',
        recordId,
        reason: errMsg,
      };
    } finally {
      this.inFlightPatternKeys.delete(patternKey);
    }
  }
}

export const teacherRequestService = new TeacherRequestService();
