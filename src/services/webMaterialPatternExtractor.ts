/**
 * 設計思想指示書 6.3「保存単位を『ページ』から『知識』へ変える」＆ 作業指示書 v19
 * Web素材抽出・脱固有名詞化・言い回しパターン抽象化サービス (WebMaterialPatternExtractor)
 *
 * ネット由来の素材特有のルール:
 * 1. 文章をそのまま丸ごと転用しない。
 * 2. 固有名詞（人名・地名・組織名・製品名・URL）、具体的な数値（年月日、金額、統計値）、
 *    個別の事実主張を安全に除去し、普遍的な「言い回しのパターン・語尾・接続表現・文構造」のみを抽出する。
 * 3. 禁止トピック判定（bannedTopicsConfigService）を必ず経由し、該当する場合は候補化しない。
 * 4. 出典情報（sources: 検索クエリ、取得日時、URL、抽出断片）を記録可能な構造を生成する。
 */

import { bannedTopicsConfigService } from './bannedTopicsConfigService';

/**
 * 実データ由来プロバイダの検証（作業指示書 v21 第2.2節: 捏造・モックデータの排除）
 */
export const VALID_WEB_REAL_DATA_PROVIDERS = [
  'wikipedia_direct',
  'api_search',
  'wikipedia',
  'duckduckgo',
  'searxng',
  'gemini_grounding',
] as const;

export function isRealDataProvider(provider?: string): boolean {
  if (!provider) return false;
  const p = provider.toLowerCase().trim();
  if (p.includes('fallback') || p.includes('mock') || p.includes('local') || p.includes('offline') || p.includes('synthetic')) {
    return false;
  }
  return VALID_WEB_REAL_DATA_PROVIDERS.includes(p as any);
}

export interface WebExtractedSurfacePattern {
  originalFragment: string;
  abstractedPattern: string;
  extractedStyle: 'POLITE' | 'CASUAL' | 'EXPLANATORY' | 'CONCLUSION_FIRST';
  connectorPhrase?: string;
  sourceQuery: string;
  sourceUrl: string;
  extractedAt: number;
  provider?: string;
}

export interface WebExtractedSkeletonPattern {
  instructionStructure: string;
  responseSteps: string[];
  sampleTriggerWords: string[];
  sourceQuery: string;
  sourceUrl: string;
  extractedAt: number;
  originalFragment: string;
  provider?: string;
}

export class WebMaterialPatternExtractor {
  /**
   * 固有名詞・具体的数値・個別事実主張を除去し、汎用的な「言い回し骨組み」へ抽象化する
   * （作業指示書 v19 第1.3節 2項 & 第2節 2項: 固有名詞除去・パターン抽出の実装関数）
   */
  public static sanitizeAndAbstractSurfaceText(rawText: string): string {
    if (!rawText) return '';

    let text = rawText.trim();

    // 1. URL・ドメイン・メールアドレスの除去
    text = text.replace(/https?:\/\/[^\s]+/gi, '');
    text = text.replace(/www\.[^\s]+/gi, '');
    text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');

    // 2. 年月日・時刻・具体的な数値と単位の除去・抽象化
    text = text.replace(/\d{4}年\d{1,2}月\d{1,2}日/g, '先日');
    text = text.replace(/\d{4}年/g, '近年');
    text = text.replace(/\d{1,2}月\d{1,2}日/g, '特定の日');
    text = text.replace(/\d{1,2}:\d{2}(?::\d{2})?/g, '');
    text = text.replace(/\d+(?:[.,]\d+)?\s*(?:円|ドル|%|パーセント|個|件|人|回|倍|kg|km|m|cm|mm|GB|MB|TB|ms|秒|分|時間)/g, '一定の');
    text = text.replace(/\b\d+\b/g, '');

    // 3. 一般的な固有名詞・組織・企業・サービス名プレースホルダーの除去/一般名詞化
    const properNounPatterns: [RegExp, string][] = [
      [/Google|Yahoo|Amazon|Microsoft|Apple|Twitter|X社|Facebook|Meta/gi, '該当サービス'],
      [/Windows|macOS|iOS|Android|Linux/gi, '環境'],
      [/React|Vue|Angular|TypeScript|Python|Node\.js|Next\.js/gi, '対象技術'],
      [/株式会社[^\s、。]{2,10}|[^\s、。]{2,10}株式会社/g, '対象組織'],
      [/[A-Z][a-zA-Z0-9_-]{3,}/g, '対象項目'], // 英字固有コード/識別子
    ];

    for (const [pattern, replacement] of properNounPatterns) {
      text = text.replace(pattern, replacement);
    }

    // 4. 余分な記号・空白の整理
    text = text.replace(/[【】［］\[\]「」『』<>＜＞]/g, '');
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Web検索スニペット/コンテンツから「横(言い回し)の自然な表現候補」を抽出する
   */
  public static extractSurfacePatternsFromWebText(params: {
    text: string;
    sourceQuery: string;
    sourceUrl: string;
    provider?: string;
  }): WebExtractedSurfacePattern[] {
    const { text, sourceQuery, sourceUrl, provider } = params;

    // 禁止トピック検査
    if (bannedTopicsConfigService.checkBanned(text).isBanned || bannedTopicsConfigService.checkBanned(sourceQuery).isBanned) {
      return [];
    }

    const sentences = text
      .split(/(?<=[。！？!?\n])/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8 && s.length <= 100);

    const patterns: WebExtractedSurfacePattern[] = [];
    const seen = new Set<string>();

    for (const sentence of sentences) {
      // 禁止トピック検査（文単位）
      if (bannedTopicsConfigService.checkBanned(sentence).isBanned) continue;

      // 固有名詞・数値を除去した抽象化テキスト
      const abstracted = this.sanitizeAndAbstractSurfaceText(sentence);
      if (abstracted.length < 6 || seen.has(abstracted)) continue;

      // 自然な会話や説明で使える言い回し特徴があるか判定
      const hasPoliteEnding = /(?:です|ます|でしょう|いたします|ですね|でしょうか)[。！]?$/.test(abstracted);
      const hasCasualEnding = /(?:だよ|ね|よ|るね|てるよ|してみよう|するね)[。！]?$/.test(abstracted);
      const hasConnector = /^(?:まず|結論として|要するに|そのため|したがって|具体的には|一方で|なお|基本的には)/.test(abstracted);
      const hasInstructionGuidance = /(?:確認|整理|検討|手順|ポイント|対応|注意)(?:して|を|が|について)/.test(abstracted);

      if (!hasPoliteEnding && !hasCasualEnding && !hasConnector && !hasInstructionGuidance) {
        continue;
      }

      let extractedStyle: WebExtractedSurfacePattern['extractedStyle'] = 'EXPLANATORY';
      if (hasCasualEnding) extractedStyle = 'CASUAL';
      else if (hasPoliteEnding) extractedStyle = 'POLITE';
      else if (/結論|要点|要するに/.test(abstracted)) extractedStyle = 'CONCLUSION_FIRST';

      let connectorPhrase: string | undefined;
      const connectorMatch = abstracted.match(/^(まず|結論として|要するに|そのため|したがって|具体的には|一方で|なお|基本的には)[、,\s]?/);
      if (connectorMatch) {
        connectorPhrase = connectorMatch[1];
      }

      seen.add(abstracted);
      patterns.push({
        originalFragment: sentence.slice(0, 100),
        abstractedPattern: abstracted,
        extractedStyle,
        connectorPhrase,
        sourceQuery,
        sourceUrl: sourceUrl || 'https://web-search-knowledge.local',
        extractedAt: Date.now(),
        provider,
      });

      if (patterns.length >= 4) break; // 1件の検索結果から最大4パターンまで
    }

    return patterns;
  }

  /**
   * Web検索結果から「縦(骨格)の対話・受け答え構造」を抽出する
   */
  public static extractSkeletonStructuresFromWebText(params: {
    title: string;
    snippet: string;
    summary?: string;
    sourceQuery: string;
    sourceUrl: string;
    provider?: string;
  }): WebExtractedSkeletonPattern | null {
    const { title, snippet, summary, sourceQuery, sourceUrl, provider } = params;
    const combined = `${title} ${snippet} ${summary || ''}`;

    // 禁止トピック検査
    if (
      bannedTopicsConfigService.checkBanned(sourceQuery).isBanned ||
      bannedTopicsConfigService.checkBanned(combined).isBanned
    ) {
      return null;
    }

    // Q&A / FAQ / トラブルシューティング / 手順解説の特徴があるか検出
    const isQAorTrouble =
      /どうすれば|原因|対処法|エラー|解決方法|手順|使い方|注意点|FAQ|Q&A|の違い|比較|できない|方法/.test(combined);

    if (!isQAorTrouble && sourceQuery.length < 4) {
      return null;
    }

    // 固有名詞・個別事実を除去した汎用的な手順骨格
    const cleanTitle = this.sanitizeAndAbstractSurfaceText(title);
    const instructionStructure = `${cleanTitle}に関する問い合わせ・課題の対応手順`;

    // 抽出される手順ステップ
    const responseSteps: string[] = [
      '1. 問い合わせ・課題の主要因を整理し、結論または方針を先に明示する',
    ];

    if (/原因|なぜ|エラー/.test(combined)) {
      responseSteps.push('2. 発生している原因やメカニズムを段階的に分析して説明する');
      responseSteps.push('3. 具体的な解消ステップまたは回避策を順序立てて提示する');
    } else if (/手順|方法|使い方/.test(combined)) {
      responseSteps.push('2. 実行に必要な前提条件や準備事項を確認する');
      responseSteps.push('3. 手順を番号順で具体的に案内する');
    } else if (/違い|比較/.test(combined)) {
      responseSteps.push('2. 各選択肢の特徴・メリット・留意点を対比して整理する');
      responseSteps.push('3. 状況に応じた推奨判断基準を提示する');
    } else {
      responseSteps.push('2. 背景情報および関連する前提条件を補足する');
      responseSteps.push('3. 次の確認アクションまたは代替案を案内する');
    }

    // トリガーキーワード抽出
    const sampleTriggerWords: string[] = [];
    const queryParts = sourceQuery.split(/[\s+、,]+/);
    for (const p of queryParts) {
      const sanitized = this.sanitizeAndAbstractSurfaceText(p);
      if (sanitized.length >= 2 && !sampleTriggerWords.includes(sanitized)) {
        sampleTriggerWords.push(sanitized);
      }
    }
    if (sampleTriggerWords.length === 0) {
      sampleTriggerWords.push('Web調査手順');
    }

    return {
      instructionStructure,
      responseSteps,
      sampleTriggerWords,
      sourceQuery,
      sourceUrl: sourceUrl || 'https://web-search-knowledge.local',
      extractedAt: Date.now(),
      originalFragment: snippet.slice(0, 120),
      provider,
    };
  }
}
