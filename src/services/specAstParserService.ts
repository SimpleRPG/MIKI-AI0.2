/**
 * 設計思想 第130章: 設計思想指示書コンパイラ & 規範優先順位 (Specification AST Compiler & Normative Hierarchy)
 *
 * 【目的】
 * 1. 設計思想指示書のテキスト文言をパースし、構造化仕様AST（抽象構文木）を生成する。
 * 2. 複数の仕様要件やユーザー指示が競合した場合、厳密な「規範優先順位（Normative Priority）」に基づいて解決する。
 *    最上位: 不変安全原則（Qwen 3B保護・プライバシー・ロールバック性）
 *    第2位: ユーザーの明示的意図（User Core Intent）
 *    第3位: 推論リソース節約・パフォーマンス最適化
 *    第4位: デフォルト装飾・審美的設定
 */

import { systemLogger } from './systemLogger';

export type NormativePriorityLevel =
  | 'LEVEL_0_INVARIANT_SAFETY' // 絶対不可侵
  | 'LEVEL_1_USER_INTENT'     // ユーザー明示的指示
  | 'LEVEL_2_PERFORMANCE'     // 性能・トークン最適化
  | 'LEVEL_3_AESTHETICS';     // 表記・コスメティック

export interface SpecAstDirectiveNode {
  id: string;
  sourceChapter: number;
  priority: NormativePriorityLevel;
  ruleTitle: string;
  condition: string;
  action: string;
  rawText: string;
}

export interface ConflictResolutionReport {
  conflictingDirectives: [SpecAstDirectiveNode, SpecAstDirectiveNode];
  winningDirective: SpecAstDirectiveNode;
  resolutionReason: string;
}

class SpecAstParserService {
  private parsedDirectives: SpecAstDirectiveNode[] = [];

  constructor() {
    this.initializeCoreDirectives();
  }

  private initializeCoreDirectives(): void {
    this.parsedDirectives = [
      {
        id: 'dir_0_qwen',
        sourceChapter: 0,
        priority: 'LEVEL_0_INVARIANT_SAFETY',
        ruleTitle: 'Qwen 3B 重み不変性保護',
        condition: 'when any modification targets base LLM weights',
        action: 'DENY_AND_PRESERVE_WEIGHTS',
        rawText: '重みを変えずに自然会話を実現する。基盤モデルを絶対保護する。',
      },
      {
        id: 'dir_11_privacy',
        sourceChapter: 11,
        priority: 'LEVEL_0_INVARIANT_SAFETY',
        ruleTitle: '送信境界プライバシーマスキング',
        condition: 'when payload is dispatched to external network',
        action: 'MASK_IDENTIFIERS',
        rawText: '外部送信前の個人情報・機密トークンを自動マスキングする。',
      },
      {
        id: 'dir_28_proficiency',
        sourceChapter: 28,
        priority: 'LEVEL_1_USER_INTENT',
        ruleTitle: '相手の理解度追従説明深度',
        condition: 'when user profile displays beginner/expert',
        action: 'ADAPT_EXPLANATION_DEPTH',
        rawText: 'ユーザーの理解度に応じた説明レベルを自動調整する。',
      },
      {
        id: 'dir_4_token_budget',
        sourceChapter: 4,
        priority: 'LEVEL_2_PERFORMANCE',
        ruleTitle: 'コンテキスト長3層防御',
        condition: 'when context exceeds 80% budget',
        action: 'COMPRESS_OLD_TURNS',
        rawText: 'トークン長を3層で監視し、重要度ベースで自動圧縮する。',
      },
    ];
  }

  /**
   * 指示書テキストをASTノードにパース
   */
  public parseSpecificationText(chapterNumber: number, text: string): SpecAstDirectiveNode[] {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const nodes: SpecAstDirectiveNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      let priority: NormativePriorityLevel = 'LEVEL_1_USER_INTENT';

      if (line.includes('保護') || line.includes('不変') || line.includes('禁止')) {
        priority = 'LEVEL_0_INVARIANT_SAFETY';
      } else if (line.includes('高速') || line.includes('節約') || line.includes('キャッシュ')) {
        priority = 'LEVEL_2_PERFORMANCE';
      } else if (line.includes('表示') || line.includes('色') || line.includes('デザイン')) {
        priority = 'LEVEL_3_AESTHETICS';
      }

      nodes.push({
        id: `ast_c${chapterNumber}_${i}`,
        sourceChapter: chapterNumber,
        priority,
        ruleTitle: line.slice(0, 30),
        condition: 'context_match',
        action: 'ENFORCE_DIRECTIVE',
        rawText: line,
      });
    }

    this.parsedDirectives.push(...nodes);
    systemLogger.info('SELF_IMPROVEMENT', `[第130章 仕様ASTコンパイラ] 第${chapterNumber}章から${nodes.length}件の規範ASTノードを生成`);
    return nodes;
  }

  /**
   * 2つの指示が競合した場合の規範優先順位による解決
   */
  public resolveConflict(d1: SpecAstDirectiveNode, d2: SpecAstDirectiveNode): ConflictResolutionReport {
    const priorityRanks: Record<NormativePriorityLevel, number> = {
      LEVEL_0_INVARIANT_SAFETY: 0,
      LEVEL_1_USER_INTENT: 1,
      LEVEL_2_PERFORMANCE: 2,
      LEVEL_3_AESTHETICS: 3,
    };

    const rank1 = priorityRanks[d1.priority];
    const rank2 = priorityRanks[d2.priority];

    let winning = d1;
    let reason = '';

    if (rank1 < rank2) {
      winning = d1;
      reason = `第${d1.sourceChapter}章の規則 (${d1.priority}) は第${d2.sourceChapter}章の規則 (${d2.priority}) より上位の規範優先度を持ちます。`;
    } else if (rank2 < rank1) {
      winning = d2;
      reason = `第${d2.sourceChapter}章の規則 (${d2.priority}) は第${d1.sourceChapter}章の規則 (${d1.priority}) より上位の規範優先度を持ちます。`;
    } else {
      winning = d1.sourceChapter > d2.sourceChapter ? d1 : d2;
      reason = `同位優先度のため、より新しい章の規則（第${winning.sourceChapter}章）を採用しました。`;
    }

    return {
      conflictingDirectives: [d1, d2],
      winningDirective: winning,
      resolutionReason: reason,
    };
  }

  public getAllDirectives(): SpecAstDirectiveNode[] {
    return this.parsedDirectives;
  }
}

export const specAstParserService = new SpecAstParserService();
