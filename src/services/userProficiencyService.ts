/**
 * 設計思想 第28章 28.4: ユーザー理解度追従型・説明レベル自動調整
 * (User Proficiency-Adaptive Explanation Depth)
 * 
 * 【目的】
 * ユーザー自身の発話に含まれる専門用語や構文の出現頻度から、ドメイン別の理解度(0-100)を移動平均で推定。
 * ペルソナの口調（タメ口・親しみやすさ）は一切変えずに、説明の詳細度や前置きの有無をユーザーの熟練度に最適化する。
 */

import {
  UserProficiencyScore,
  ProficiencyDomain,
  ExplanationAdjustmentAdvice,
  ExplanationLevel,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const PROFICIENCY_STORAGE_KEY = 'miki_user_proficiency_scores_v1';

// ドメイン別判定キーワード辞書
const DOMAIN_TECHNICAL_KEYWORDS: Record<ProficiencyDomain, string[]> = {
  vba: [
    'dim', 'range', 'cells', 'worksheet', 'workbook', 'end(xlup)', 'ubound', 'lbound',
    'variant', 'byval', 'byref', 'sub', 'function', 'long', 'integer', 'boolean',
    'specialcells', 'autofilter', 'on error resume next', 'err.number', 'screenupdating',
  ],
  typescript: [
    'interface', 'type', 'generics', 'promise', 'async', 'await', 'useeffect', 'usestate',
    'readonly', 'as const', 'keyof', 'typeof', 'union', 'discriminated union', 'eslint',
  ],
  general_programming: [
    'ast', 'メモリ', '計算量', 'o(n)', 'ポインタ', 'スタック', 'キュー', 'ハッシュマップ',
    '非同期', 'トランザクション', '正規表現', 'デッドロック', 'リグレッション',
  ],
  ai_terminology: [
    'lora', 'qwen', '旧ローカル生成ランタイム', 'gguf', '量子化', 'コンテキスト長', '埋め込み', 'コサイン類似度',
    'パープレキシティ', 'トークン', 'ファインチューニング', '推論時間', 'ハルシネーション',
  ],
  general: [],
};

export class UserProficiencyService {
  private scores: Record<ProficiencyDomain, UserProficiencyScore>;

  constructor() {
    this.scores = this.loadScores();
  }

  private loadScores(): Record<ProficiencyDomain, UserProficiencyScore> {
    const defaultScores: Record<ProficiencyDomain, UserProficiencyScore> = {
      vba: { domain: 'vba', score: 50, interactionCount: 0, technicalTermMatches: [], lastCalculatedAt: Date.now() },
      typescript: { domain: 'typescript', score: 50, interactionCount: 0, technicalTermMatches: [], lastCalculatedAt: Date.now() },
      general_programming: { domain: 'general_programming', score: 50, interactionCount: 0, technicalTermMatches: [], lastCalculatedAt: Date.now() },
      ai_terminology: { domain: 'ai_terminology', score: 50, interactionCount: 0, technicalTermMatches: [], lastCalculatedAt: Date.now() },
      general: { domain: 'general', score: 50, interactionCount: 0, technicalTermMatches: [], lastCalculatedAt: Date.now() },
    };

    try {
      const raw = storageService.getItem(PROFICIENCY_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          return { ...defaultScores, ...saved };
        }
      }
      return defaultScores;
    } catch {
      return defaultScores;
    }
  }

  private saveScores() {
    try {
      storageService.setItem(PROFICIENCY_STORAGE_KEY, JSON.stringify(this.scores));
    } catch (e) {
      console.warn('Failed to save proficiency scores:', e);
    }
  }

  public getScore(domain: ProficiencyDomain): UserProficiencyScore {
    return this.scores[domain] || {
      domain,
      score: 50,
      interactionCount: 0,
      technicalTermMatches: [],
      lastCalculatedAt: Date.now(),
    };
  }

  public getAllScores(): Record<ProficiencyDomain, UserProficiencyScore> {
    return { ...this.scores };
  }

  /**
   * ユーザーの発話から専門用語をスキャンし、ドメイン別スコアを更新 (移動平均平滑化) (28.4)
   */
  public analyzeUserUtterance(userText: string): void {
    const lower = userText.toLowerCase();

    for (const [domainKey, keywords] of Object.entries(DOMAIN_TECHNICAL_KEYWORDS) as [ProficiencyDomain, string[]][]) {
      const matched = keywords.filter((kw) => lower.includes(kw));
      if (matched.length === 0) continue;

      const current = this.scores[domainKey];
      current.interactionCount++;

      // 発話内の専門用語数に応じた瞬間スコア (1用語=60, 3用語以上=85+)
      const rawInstScore = Math.min(100, 50 + matched.length * 15);

      // 移動平均 (直近10回の重み付き平滑化: 急激なノイズ変動を防止 第28.4項)
      const alpha = 0.2; // 平滑化係数
      const smoothed = Math.round(current.score * (1 - alpha) + rawInstScore * alpha);

      // 直近マッチ用語の記録 (最新5件)
      const mergedTerms = Array.from(new Set([...matched, ...current.technicalTermMatches])).slice(0, 8);

      current.score = Math.max(0, Math.min(100, smoothed));
      current.technicalTermMatches = mergedTerms;
      current.lastCalculatedAt = Date.now();
    }

    this.saveScores();
  }

  /**
   * 現在のユーザー理解度に基づいた回答説明レベルの推奨事項を生成 (28.4)
   */
  public getExplanationAdvice(domain: ProficiencyDomain): ExplanationAdjustmentAdvice {
    const prof = this.getScore(domain);
    const score = prof.score;

    let recommendedLevel: ExplanationLevel = 'INTERMEDIATE_STANDARD';
    let skipPreamble = false;
    let addConcreteExamples = false;
    let simplifiedTerminology = false;
    let reason = '';

    if (score >= 70) {
      // エキスパート (第28.4項: スコア70超)
      recommendedLevel = 'EXPERT_CONCISE';
      skipPreamble = true;
      addConcreteExamples = false;
      simplifiedTerminology = false;
      reason = `熟練度高 (スコア: ${score}点)。基礎用語の前置きを省略し、核心とコードの差分を直接提示します。`;
    } else if (score < 35) {
      // 初学者 (第28.4項: スコア30未満/初期段階)
      recommendedLevel = 'BEGINNER_DETAILED';
      skipPreamble = false;
      addConcreteExamples = true;
      simplifiedTerminology = true;
      reason = `初学者向け (スコア: ${score}点)。専門用語に簡潔な補足を添え、具体例を交えて段階的に説明します。`;
    } else {
      // 標準 (35〜69点)
      recommendedLevel = 'INTERMEDIATE_STANDARD';
      skipPreamble = false;
      addConcreteExamples = false;
      simplifiedTerminology = false;
      reason = `中級標準 (スコア: ${score}点)。過度な前置きを避けつつ、自然なタメ口で要点を明快に説明します。`;
    }

    return {
      domain,
      proficiencyScore: score,
      recommendedLevel,
      skipPreamble,
      addConcreteExamples,
      simplifiedTerminology,
      reason,
    };
  }

  /**
   * システムプロンプトへの追従ディレクティブ生成
   */
  public getSystemPromptDirective(currentDomain: ProficiencyDomain): string {
    const advice = this.getExplanationAdvice(currentDomain);
    if (advice.recommendedLevel === 'EXPERT_CONCISE') {
      return `【第28章 理解度追従: エキスパートモード】ユーザーは${currentDomain}の高度な用語を使いこなせます。初歩的な概念説明や挨拶の前置きは不要。結論・要点・コード本体を最速で提示してください。`;
    }
    if (advice.recommendedLevel === 'BEGINNER_DETAILED') {
      return `【第28章 理解度追従: 丁寧ガイドモード】ユーザーは${currentDomain}を学習中です。難しい専門用語には括弧や平易な言葉で補足を添え、1つのコード例を分かりやすく解説してください。`;
    }
    return '';
  }
}

export const userProficiencyService = new UserProficiencyService();
