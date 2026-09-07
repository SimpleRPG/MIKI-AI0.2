/**
 * 設計思想 第31章 31.1: ライブ会話リペア (Live Conversation Repair)
 * 
 * 【目的】
 * ユーザーが「違う」「そうじゃない」「長すぎる」「結論は？」と指摘した際、
 * 単なる低評価扱いではなく、直前の意図・制約・回答長を即座に再計算して
 * インラインで修正版を生成・再提示する。
 * 修正前後の差分（意図の誤解 ➔ 修正意図）を自己改善・LoRA用高品質教材候補として記録する。
 */

import { LiveRepairRecord, LiveRepairTriggerType, Message } from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const REPAIR_HISTORY_KEY = 'miki_live_repair_history_v1';

// 指摘パターンの正規表現マッピング
const TRIGGER_PATTERNS: { type: LiveRepairTriggerType; regex: RegExp; intentSummary: string }[] = [
  {
    type: 'TOO_LONG',
    regex: /(長すぎる|長い|もっと短く|要約して|1行で|簡潔に|3行で)/i,
    intentSummary: '回答が長大すぎる。前置きや解説を削除し、要点と結論のみを短縮提示する。',
  },
  {
    type: 'WANT_CONCLUSION',
    regex: /(結論は|結論から|結論だけ|で、どうすれば|結局どうなの|何が言いたいの)/i,
    intentSummary: '結論が不明瞭。前置きを廃して「結論」「手順」「具体値」を冒頭に最速提示する。',
  },
  {
    type: 'WRONG_PREMISE',
    regex: /(そうじゃなくて|そうじゃない|前提が違う|勘違い|話が噛み合ってない|そういう意味じゃない)/i,
    intentSummary: '前提条件やスコープの誤解。直前の前提を破棄し、ユーザーの本来の意図に合わせ再構成する。',
  },
  {
    type: 'DISAGREE',
    regex: /(違う|違います|ちがう|合ってない|間違ってる|正しくない|ダメ)/i,
    intentSummary: '提示内容の正誤不一致。提示した事実・結論を再検証し、代替の正しい回答へ修正する。',
  },
  {
    type: 'INCORRECT_CODE',
    regex: /(エラー|動かない|実行できない|バグ|動かん|コンパイルエラー)/i,
    intentSummary: 'コード実行不能・構文エラー。第16章/第51章安全規則に基づき動く安全コードへ置換する。',
  },
];

export class LiveConversationRepairService {
  private history: LiveRepairRecord[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      const raw = storageService.getItem(REPAIR_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.history = parsed;
        }
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory() {
    try {
      storageService.setItem(REPAIR_HISTORY_KEY, JSON.stringify(this.history.slice(-50)));
    } catch (e) {
      console.warn('Failed to save repair history:', e);
    }
  }

  public getHistory(): LiveRepairRecord[] {
    return [...this.history];
  }

  /**
   * ユーザー発話からリペアトリガーを検知 (31.1)
   */
  public detectRepairTrigger(userText: string): {
    isRepair: boolean;
    triggerType?: LiveRepairTriggerType;
    intentAdvice?: string;
  } {
    const trimmed = userText.trim();
    // 短文（50文字以内）で指摘キーワードが含まれる場合に高確率でリペア判定
    if (trimmed.length > 80) return { isRepair: false };

    for (const pat of TRIGGER_PATTERNS) {
      if (pat.regex.test(trimmed)) {
        return {
          isRepair: true,
          triggerType: pat.type,
          intentAdvice: pat.intentSummary,
        };
      }
    }

    return { isRepair: false };
  }

  /**
   * 直前のAI回答とユーザーの訂正からリペアレコードを登録 (31.1)
   */
  public recordRepair(
    turnId: string,
    userCorrectionText: string,
    triggerType: LiveRepairTriggerType,
    originalAnswer: string,
    revisedAnswer: string,
    intentDelta: string
  ): LiveRepairRecord {
    const record: LiveRepairRecord = {
      id: `repair_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      turnId,
      userCorrectionText,
      triggerType,
      originalAnswer,
      revisedAnswer,
      intentDelta,
      lengthDeltaWords: revisedAnswer.length - originalAnswer.length,
      learningCandidateId: `learn_repair_${Date.now()}`,
      timestamp: Date.now(),
    };

    this.history.unshift(record);
    this.saveHistory();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[第31.1章 ライブ会話リペア] トリガー [${triggerType}] を検知し修正回答を生成。学習候補として登録しました。`
    );

    return record;
  }

  /**
   * 修正用ディレクティブプロンプトの生成
   */
  public generateRepairSystemPrompt(
    triggerType: LiveRepairTriggerType,
    lastAiAnswerSnippet: string,
    userCorrectionText: string
  ): string {
    let advice = 'ユーザーの意図を再確認して回答を即座に修正してください。';
    if (triggerType === 'TOO_LONG') {
      advice = '【第31章 ライブリペア: 徹底短縮】前置き、相づち、挨拶、詳細解説をすべて省き、3行以内または箇条書きで結論のみを返してください。';
    } else if (triggerType === 'WANT_CONCLUSION') {
      advice = '【第31章 ライブリペア: 結論先出し】1行目に直接の「結論」または「回答」を提示し、その後に必要最小限の理由を1文だけ添えてください。';
    } else if (triggerType === 'WRONG_PREMISE') {
      advice = `【第31章 ライブリペア: 前提訂正】ユーザーから「${userCorrectionText}」と指摘されました。直前の前提認識を取り下げ、ユーザーの指定した新前提に基づいて回答を作り直してください。`;
    } else if (triggerType === 'DISAGREE') {
      advice = `【第31章 ライブリペア: 回答再検証】直前の回答の誤りを認め、「〜だね、ごめん！」と素直に受け止めた上で、正しい内容に差し替えてください。`;
    } else if (triggerType === 'INCORRECT_CODE') {
      advice = '【第31章 ライブリペア: コード修復】構文エラーや例外を回避する安全で動作保証のあるコードスニペットのみを提示してください。';
    }

    return `\n\n【第31.1章 ライブ会話リペア発火中】\n${advice}\n直前回答スニペット: "${lastAiAnswerSnippet.slice(0, 100)}..."\n`;
  }
}

export const liveConversationRepairService = new LiveConversationRepairService();
