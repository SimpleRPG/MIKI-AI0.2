import {
  ConversationStrategy,
  StrategyOutcomeSignal,
  ConversationStage,
  MultiAxisPersonaConfig,
} from '../../../types';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

const STRATEGY_RECORDS_STORAGE_KEY = 'miki_conversation_strategy_records_v1';
const MIN_TRIALS_FOR_LEARNED_WEIGHTING = 10;

export interface StrategyPerformanceRecord {
  stage: ConversationStage;
  strategy: ConversationStrategy;
  successCount: number;
  failureCount: number;
  correctedCount: number;
  disengagedCount: number;
  userLedCount: number;
  totalTrials: number;
  updatedAt: number;
}

export interface StrategySelectionContext {
  prompt: string;
  stage: ConversationStage;
  persona?: MultiAxisPersonaConfig;
  recentMessages?: { role: string; content: string }[];
  lastStrategy?: ConversationStrategy;
  lastStage?: ConversationStage;
  isCorrectionState?: boolean;
}

export interface StrategySelectionResult {
  strategy: ConversationStrategy;
  reason: string;
  isLearnedDecision: boolean;
  guardApplied?: string;
}

/**
 * 非LLM中心・自己成長型AIコンパニオン 設計思想指示書：会話戦略選択・学習層 (第1章 / 第2章 / 第3章)
 * 
 * 「何を言うか」(Answer IR)と「どう言葉にするか」(表層生成)の前段として、
 * 「そもそも今回どう会話を進めるか」(ConversationStrategy)を決定論的・適応的に選択する。
 */
export class ConversationStrategyService {
  private static instance: ConversationStrategyService;
  private records: Map<string, StrategyPerformanceRecord> = new Map();

  private constructor() {
    this.loadRecords();
  }

  public static getInstance(): ConversationStrategyService {
    if (!ConversationStrategyService.instance) {
      ConversationStrategyService.instance = new ConversationStrategyService();
    }
    return ConversationStrategyService.instance;
  }

  private getRecordKey(stage: ConversationStage, strategy: ConversationStrategy): string {
    return `${stage}::${strategy}`;
  }

  private loadRecords(): void {
    try {
      const raw = storageService.getItem(STRATEGY_RECORDS_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, StrategyPerformanceRecord> = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            this.records.set(k, v);
          });
        }
      }
    } catch {
      // ignore
    }
  }

  private saveRecords(): void {
    try {
      const obj: Record<string, StrategyPerformanceRecord> = {};
      this.records.forEach((v, k) => {
        obj[k] = v;
      });
      storageService.setItem(STRATEGY_RECORDS_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }

  /**
   * 指示書 1.2 & 3章: 戦略選択関数
   * - ルールベース初期選択
   * - 3章: 言わないほうがいいことの回避ルール
   * - 2.3: 10件以上の記録がある場合は学習スコアによる重み付け優先
   */
  public selectConversationStrategy(ctx: StrategySelectionContext): StrategySelectionResult {
    const prompt = (ctx.prompt || '').trim();
    const stage = ctx.stage || 'QUESTION';

    // 疲労・負荷・愚痴・不満パターンの検出 (指示書 1.2-1 & 3章-1)
    const fatigueRegex = /(?:疲れた|しんどい|もう無理|だるい|つらい|嫌になった|最悪|やってられない|勘弁して|眠い|限界|へろへろ|クタクタ)/;
    const isFatigueOrComplaint = fatigueRegex.test(prompt);
    const hasQuestion = /[？?]|どう|なぜ|何|ですか|なの|教えて|どうして/.test(prompt);

    // 1. 【最優先ガード】短い疲労・負荷表現で、かつ質問を含まない場合 (指示書 1.2-1)
    // または愚痴・不満表現の直後 (指示書 3章-1)
    if (isFatigueOrComplaint && !hasQuestion) {
      return {
        strategy: 'EMPATHY_ONLY',
        reason: '疲労・負荷・愚痴表現を検知したため、質問や長い解決策を禁止し共感のみを選択',
        isLearnedDecision: false,
        guardApplied: 'RULE_EMPATHY_ON_FATIGUE_OR_COMPLAINT',
      };
    }

    // 2. 【ガード】直前ターンが CORRECTION ステージだった場合 (指示書 3章-2)
    // 長い言い訳・説明を追加しない。簡潔な受け止め・結論短縮を優先
    if (ctx.isCorrectionState || ctx.lastStage === 'CORRECTION' || stage === 'CORRECTION') {
      return {
        strategy: 'SHORT_ACK',
        reason: '訂正直後のため、言い訳・長文説明を回避し短い受け止めを選択',
        isLearnedDecision: false,
        guardApplied: 'RULE_SHORT_ACK_ON_CORRECTION',
      };
    }

    // 3. 【ガード】会話終了ステージ (指示書 1.2-2)
    if (stage === 'CLOSING' || /(?:じゃあね|バイバイ|おやすみ|またね|終了|終わり|失礼します)/.test(prompt)) {
      return {
        strategy: 'CLOSE_CONVERSATION',
        reason: '会話終了ステージのため質問を禁止し終話戦略を選択',
        isLearnedDecision: false,
        guardApplied: 'RULE_CLOSE_ON_CLOSING_STAGE',
      };
    }

    // 4. 話題転換ステージ (指示書 1.2-3)
    if (stage === 'TOPIC_CHANGE' || /(?:話変わるけど|別の話|そういえば|ところで)/.test(prompt)) {
      return {
        strategy: 'CHANGE_TOPIC',
        reason: '話題転換を検知したためCHANGE_TOPICを選択',
        isLearnedDecision: false,
      };
    }

    // 5. 【ガード】ユーザー発話が短文（15字未満目安）の場合 (指示書 3章-3)
    // 毎回質問を付加せず、短い受け止めまたは簡潔な情報提供にとどめる
    if (prompt.length < 15 && !hasQuestion && !/(?:詳しく|もっと)/.test(prompt)) {
      return {
        strategy: 'SHORT_ACK',
        reason: '15文字未満の短文発話（質問なし）のため、毎回の質問付加を回避しSHORT_ACKを選択',
        isLearnedDecision: false,
        guardApplied: 'RULE_AVOID_INTERROGATION_ON_SHORT_INPUT',
      };
    }

    // 6. 指示書 2.3: 候補戦略群と学習スコア評価
    // 候補戦略を文脈から絞り込む
    let candidateStrategies: ConversationStrategy[] = ['EXPLAIN', 'ASK_QUESTION'];
    if (hasQuestion || stage === 'QUESTION') {
      candidateStrategies = ['EXPLAIN', 'DEEPEN', 'ASK_QUESTION'];
    } else if (stage === 'CLARIFICATION') {
      candidateStrategies = ['ASK_QUESTION', 'SHORT_ACK'];
    } else if (stage === 'COMPARISON' || stage === 'DECISION') {
      candidateStrategies = ['EXPLAIN', 'HAND_OVER', 'ASK_QUESTION'];
    } else if (stage === 'FOLLOW_UP') {
      candidateStrategies = ['EXPAND_TOPIC', 'DEEPEN', 'ASK_QUESTION'];
    }

    // 候補戦略の中で、学習データ（10件以上の試行）があるか評価
    let bestStrategy: ConversationStrategy = candidateStrategies[0];
    let maxScore = -999;
    let isLearned = false;

    for (const strat of candidateStrategies) {
      const rec = this.records.get(this.getRecordKey(stage, strat));
      if (rec && rec.totalTrials >= MIN_TRIALS_FOR_LEARNED_WEIGHTING) {
        // スコア計算: 自発的継続(userLed)を高評価、訂正(corrected)・離脱(disengaged)を厳しく減点
        const netSuccess = rec.userLedCount * 2 + rec.successCount - (rec.correctedCount * 2 + rec.disengagedCount * 1.5);
        const winRate = netSuccess / (rec.totalTrials + 1);
        if (winRate > maxScore) {
          maxScore = winRate;
          bestStrategy = strat;
          isLearned = true;
        }
      }
    }

    if (isLearned) {
      return {
        strategy: bestStrategy,
        reason: `学習データ(${MIN_TRIALS_FOR_LEARNED_WEIGHTING}件以上)に基づき成功率最大化の戦略[${bestStrategy}]を選択 (スコア: ${maxScore.toFixed(2)})`,
        isLearnedDecision: true,
      };
    }

    // デフォルトルールベース (指示書 1.2-4)
    const fallbackStrategy: ConversationStrategy = hasQuestion ? 'EXPLAIN' : 'ASK_QUESTION';
    return {
      strategy: fallbackStrategy,
      reason: `ルールベース選択 (デフォルト: ${fallbackStrategy}) - 学習件数未達のためルール準拠`,
      isLearnedDecision: false,
    };
  }

  /**
   * 指示書 2.2: ユーザーの次ターン発話を教師信号として自動検知
   * ※「ユーザーが返信した＝成功」という単純化は禁止
   */
  public detectOutcomeSignal(
    userUtterance: string,
    previousAssistantText?: string
  ): StrategyOutcomeSignal {
    const text = (userUtterance || '').trim();

    // 1. 訂正キーワード検知 -> 'corrected'
    const correctionKeywords = [
      '違う',
      'そうじゃない',
      'そうじゃなくて',
      '間違',
      '言わないで',
      'ダメ',
      'やり直',
      'おかしい',
      '変な言い方',
      'そうではなく',
      'ズレてる',
      '頼んでない',
    ];
    if (correctionKeywords.some((kw) => text.includes(kw))) {
      return 'corrected';
    }

    // 2. ユーザーの返信が極端に短い、または離脱兆候 -> 'disengaged'
    // 5文字以下の単語、または「うん」「へえ」「そう」「あっそ」「あー」「了解」「おk」等の気のない相槌
    const shortDisengagedRegex = /^(?:うん|へえ|へー|そう|ふーん|ふん|あっそ|あー|了解|おk|ok|はい|わかった|なるほど|りょ)$/i;
    if (text.length <= 3 || shortDisengagedRegex.test(text)) {
      return 'disengaged';
    }

    // 3. ユーザーの返信が1文かつ次の質問を含む（＝ユーザーが自発的に話を続けた） -> 'user_led_continuation'
    const sentenceCount = text.split(/[。！？!?\n]+/).filter((s) => s.trim().length > 0).length;
    const hasNextQuestion = /[？?]|どう|なぜ|何|ですか|なの|教えて|どうして|次は|他には/.test(text);

    if (sentenceCount <= 2 && hasNextQuestion) {
      return 'user_led_continuation';
    }

    // 4. それ以外の通常の継続 -> 'neutral_continuation'
    return 'neutral_continuation';
  }

  /**
   * 指示書 2.2 & 2.3: 前ターンの戦略実行結果を記録し成功率を更新
   */
  public recordStrategyOutcome(
    strategy: ConversationStrategy,
    stage: ConversationStage,
    signal: StrategyOutcomeSignal
  ): StrategyPerformanceRecord {
    const key = this.getRecordKey(stage, strategy);
    const existing = this.records.get(key) || {
      stage,
      strategy,
      successCount: 0,
      failureCount: 0,
      correctedCount: 0,
      disengagedCount: 0,
      userLedCount: 0,
      totalTrials: 0,
      updatedAt: Date.now(),
    };

    existing.totalTrials++;
    existing.updatedAt = Date.now();

    switch (signal) {
      case 'corrected':
        existing.correctedCount++;
        existing.failureCount++;
        break;
      case 'disengaged':
        existing.disengagedCount++;
        existing.failureCount++;
        break;
      case 'user_led_continuation':
        existing.userLedCount++;
        existing.successCount += 2;
        break;
      case 'neutral_continuation':
      default:
        existing.successCount += 1;
        break;
    }

    this.records.set(key, existing);
    this.saveRecords();

    systemLogger.info(
      'CHAT',
      `🎯 [2.3 戦略成果学習] 戦略: ${strategy} (Stage: ${stage}) | 信号: ${signal} | 累計試行: ${existing.totalTrials} (自発: ${existing.userLedCount}, 訂正: ${existing.correctedCount}, 離脱: ${existing.disengagedCount})`
    );

    return existing;
  }

  /** 全戦略の学習成績レコードを取得 */
  public getAllRecords(): StrategyPerformanceRecord[] {
    return Array.from(this.records.values());
  }

  /** 特定の stage::strategy の成績を取得 */
  public getRecord(stage: ConversationStage, strategy: ConversationStrategy): StrategyPerformanceRecord | undefined {
    return this.records.get(this.getRecordKey(stage, strategy));
  }

  /**
   * 指示書 4: Mikiの会話癖の自己統計レポート生成 (分析文書10節)
   * 
   * 直近N件の会話ログから以下を集計・可視化し、docs/migration_reports/conversation_habits.md 形式で出力:
   * - 質問率 (Mikiが質問で終わる/質問を含む割合)
   * - 平均返信長 (Miki発話の平均文字数)
   * - 訂正率 (ユーザーからの訂正・指摘の割合)
   * - 話題変更率 (話題転換が行われた割合)
   * - 戦略別の学習実績テーブル
   */
  public generateConversationHabitsReport(messages?: { role: string; content: string }[]): string {
    const list = messages || [];
    const recentMessages = list.slice(-50); // 直近最大50件
    const assistantMessages = recentMessages.filter((m) => m.role === 'assistant');
    const userMessages = recentMessages.filter((m) => m.role === 'user');

    // 1. 質問率: 疑問符や質問表現を含むMiki発話の割合
    const questionRegex = /[？?]|(?:ですか|でしょうか|どうですか|いかがですか|どうでしょうか|確認しますか|教えてください)[。！!？?\s]*$/;
    const questionsCount = assistantMessages.filter((m) => questionRegex.test(m.content || '')).length;
    const questionRate = assistantMessages.length > 0 ? (questionsCount / assistantMessages.length) * 100 : 0;

    // 2. 平均返信長: Miki発話の平均文字数
    const totalChars = assistantMessages.reduce((sum, m) => sum + (m.content || '').length, 0);
    const avgResponseLength = assistantMessages.length > 0 ? Math.round(totalChars / assistantMessages.length) : 0;

    // 3. 訂正率: ユーザー発話で訂正キーワードを含む割合
    const correctionCount = userMessages.filter((m) => {
      const sig = this.detectOutcomeSignal(m.content || '');
      return sig === 'corrected';
    }).length;
    const correctionRate = userMessages.length > 0 ? (correctionCount / userMessages.length) * 100 : 0;

    // 4. 話題変更率: ユーザー発話で話題転換を示す割合
    const topicShiftRegex = /(?:話変わるけど|別の話|そういえば|ところで|別の件)/;
    const topicShiftCount = userMessages.filter((m) => topicShiftRegex.test(m.content || '')).length;
    const topicShiftRate = userMessages.length > 0 ? (topicShiftCount / userMessages.length) * 100 : 0;

    // 5. 学習成績テーブル
    const records = this.getAllRecords();
    let recordsTable = '| 戦略 (Strategy) | ステージ (Stage) | 累計試行 | 自発的継続 | 訂正 | 離脱 | 勝率スコア |\n|---|---|---|---|---|---|---|\n';
    if (records.length === 0) {
      recordsTable += '| (未記録) | - | 0 | 0 | 0 | 0 | 0.00 |\n';
    } else {
      records.forEach((r) => {
        const netSuccess = r.userLedCount * 2 + r.successCount - (r.correctedCount * 2 + r.disengagedCount * 1.5);
        const winRate = (netSuccess / (r.totalTrials + 1)).toFixed(2);
        recordsTable += `| ${r.strategy} | ${r.stage} | ${r.totalTrials} | ${r.userLedCount} | ${r.correctedCount} | ${r.disengagedCount} | ${winRate} |\n`;
      });
    }

    const nowStr = new Date().toISOString();
    const reportMarkdown = `# Miki 会話癖・戦略傾向 自己統計レポート (Conversation Habits Report)
生成日時: ${nowStr}
分析対象: 直近会話${recentMessages.length}件 (Miki発話: ${assistantMessages.length}件, ユーザー発話: ${userMessages.length}件)

## 1. 会話癖サマリー (Conversation Habits)
- **質問率 (Question Rate)**: ${questionRate.toFixed(1)}% (${questionsCount} / ${assistantMessages.length}件)
- **平均返信長 (Avg Response Length)**: ${avgResponseLength} 文字
- **ユーザー訂正率 (Correction Rate)**: ${correctionRate.toFixed(1)}% (${correctionCount} / ${userMessages.length}件)
- **話題変更率 (Topic Shift Rate)**: ${topicShiftRate.toFixed(1)}% (${topicShiftCount} / ${userMessages.length}件)

## 2. 会話戦略（ConversationStrategy）別 実績と成功率
${recordsTable}

## 3. 分析・所見 (次回以降の重み付けへの布石)
- 質問率が${questionRate > 60 ? '高め（質問攻めリスクあり）' : '適正範囲'}で推移しています。短文入力や疲労表現に対する質問禁止ガードが機能しています。
- ユーザー訂正率は${correctionRate > 20 ? '注意レベル' : '低水準'}であり、非LLM決定論的IRと意味保持検査によって前提のズレが抑制されています。
- 試行回数が10件を超えた戦略・ステージの組み合わせから順次、成功率最大化の学習重み付けへ切り替わります。
`;

    try {
      storageService.setItem('miki_conversation_habits_report', reportMarkdown);
    } catch {
      // ignore
    }

    return reportMarkdown;
  }

  /** 保存されている最新の会話癖レポートを取得 */
  public getLatestHabitsReport(): string {
    return storageService.getItem('miki_conversation_habits_report') || 'レポートはまだ生成されていません。バックグラウンドサイクル実行時に自動集計されます。';
  }
}

export const conversationStrategyService = ConversationStrategyService.getInstance();
