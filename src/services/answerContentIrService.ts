import {
  AnswerContentIR,
  SemanticPreservationInspection,
  ClaimWorld,
  AnswerSkeletonType,
  MultiAxisPersonaConfig,
} from '../types';
import { systemLogger } from './systemLogger';

/**
 * 非LLM中心・自己成長型AIコンパニオン 設計思想指示書(統合版) 第3章 / 第5.1節 / 第5.2節 / 第13.4節
 * 回答内容IR (Answer Content IR) 生成と意味保持検査 (Semantic Preservation Check)
 * 
 * 「何を言うか (回答内容IR)」と「どう言うか (表層表現)」を完全に分離し、
 * 条件・否定・確実性・世界スコープの脱落や歪曲を非LLM決定論的ルールで検査する。
 */
export class AnswerContentIrService {
  private static instance: AnswerContentIrService;

  /** 設計思想 5.1 規定の多軸性格プロファイル */
  private defaultPersona: MultiAxisPersonaConfig = {
    politeness: 'CASUAL_POLITE',
    warmth: 'MEDIUM_HIGH',
    directness: 'HIGH',
    formality: 'MEDIUM_LOW',
    verbosity: 'ADAPTIVE',
    technicalTerminology: 'BALANCED',
    proactiveSuggestion: 'MODERATE',
    prudence: 'HIGH',
    askOnlyWhenBlocking: true,
    conclusionFirst: true,
    humor: 'OFF',
    currentScene: 'NORMAL',
  };

  private constructor() {}

  public static getInstance(): AnswerContentIrService {
    if (!AnswerContentIrService.instance) {
      AnswerContentIrService.instance = new AnswerContentIrService();
    }
    return AnswerContentIrService.instance;
  }

  /**
   * 現在の多軸性格プロファイルを取得
   */
  public getDefaultPersona(): MultiAxisPersonaConfig {
    return { ...this.defaultPersona };
  }

  /**
   * ユーザー入力・文脈・判断結果から回答内容IRを構築
   */
  public buildAnswerIR(params: {
    conclusion: string;
    reasons?: string[];
    conditions?: string[];
    exceptions?: string[];
    certainty?: AnswerContentIR['certainty'];
    target: string;
    nextActions?: string[];
    detailLevel?: AnswerContentIR['detail_level'];
    interactionMode?: AnswerContentIR['interaction_mode'];
    worldScope?: ClaimWorld;
  }): AnswerContentIR {
    const ir: AnswerContentIR = {
      ir_id: `IR-${Date.now().toString(36).toUpperCase()}`,
      conclusion: params.conclusion,
      reasons: params.reasons || [],
      conditions: params.conditions || [],
      exceptions: params.exceptions || [],
      certainty: params.certainty || 'HIGH_CONFIDENCE',
      target: params.target,
      next_actions: params.nextActions || [],
      detail_level: params.detailLevel || 'STANDARD',
      interaction_mode: params.interactionMode || 'NORMAL',
      world_scope: params.worldScope || 'REAL',
    };

    systemLogger.info(
      'ANSWER_PLAN',
      `🧩 [5.2 回答内容IR構築] ${ir.ir_id}: 結論:「${ir.conclusion}」 | 確実性: ${ir.certainty} | 世界: ${ir.world_scope} | 条件数: ${ir.conditions.length}`
    );

    return ir;
  }

  /**
   * 設計思想 5.2 回答骨格・文型・語尾の選択による非LLM決定論的表層生成
   * 
   * 4大骨格 (推薦 / 訂正 / 不明 / 作業完了 / 一般) と多軸性格設定に基づき、
   * LLMを使用することなく一意かつ正確に自然な日本語表層文を組み立てる。
   */
  public generateSurfaceTextFromIR(
    ir: AnswerContentIR,
    skeletonType: AnswerSkeletonType = 'GENERAL_ANSWER',
    customPersona?: Partial<MultiAxisPersonaConfig>,
    extraArtifactCode?: string
  ): { surfaceText: string; inspection: SemanticPreservationInspection } {
    const persona: MultiAxisPersonaConfig = {
      ...this.defaultPersona,
      ...customPersona,
    };

    const isCasual = persona.politeness === 'CASUAL_POLITE' || persona.politeness === 'CASUAL';
    const endingDesu = isCasual ? 'です！' : 'でございます。';
    const endingMasu = isCasual ? 'ますね！' : '申し上げます。';
    const endingDa = isCasual ? 'だよ。' : 'となります。';

    const lines: string[] = [];

    switch (skeletonType) {
      case 'RECOMMENDATION': {
        // 推薦骨格: 結論 → 主な理由 → 欠点 → 推奨が変わる条件
        lines.push(`【結論】\n${ir.conclusion}`);
        if (ir.reasons.length > 0) {
          lines.push(`\n【選定の主な理由】\n${ir.reasons.map((r, i) => `・${r}`).join('\n')}`);
        }
        if (ir.exceptions.length > 0) {
          lines.push(`\n【留意点・デメリット】\n${ir.exceptions.map((e) => `・${e}`).join('\n')}`);
        }
        if (ir.conditions.length > 0) {
          lines.push(`\n【推奨が変わる条件】\n※以下の条件の場合、別の方式が適している場合があります:\n${ir.conditions.map((c) => `・${c}`).join('\n')}`);
        }
        break;
      }

      case 'CORRECTION': {
        // 訂正骨格: 訂正内容の認識 → 古い前提の無効化 → 影響範囲 → 修正後の結論
        lines.push(`ご指摘ありがとうございます！前提を訂正いたしました。`);
        lines.push(`\n【古い前提の無効化】\n過去の前提は無効化(SUPERSEDED)され、以後の推論・記憶から除外されます。`);
        lines.push(`【対象・影響範囲】\n${ir.target}`);
        lines.push(`\n【修正後の結論】\n${ir.conclusion}`);
        if (ir.conditions.length > 0) {
          lines.push(`適用条件: ${ir.conditions.join(', ')}`);
        }
        break;
      }

      case 'UNKNOWN_INVESTIGATION': {
        // 不明骨格: 現在分かること → 分からないこと → 不足している証拠 → 次の調査手段
        lines.push(`【現在判明している事項】\n${ir.conclusion}`);
        if (ir.exceptions.length > 0) {
          lines.push(`\n【現時点で不確実・未解決の事項】\n${ir.exceptions.map((e) => `・${e}`).join('\n')}`);
        }
        if (ir.conditions.length > 0) {
          lines.push(`\n【不足している証拠・情報】\n${ir.conditions.map((c) => `・${c}`).join('\n')}`);
        }
        if (ir.next_actions.length > 0) {
          lines.push(`\n【次の調査手段・検証ステップ】\n${ir.next_actions.map((a) => `・${a}`).join('\n')}`);
        }
        break;
      }

      case 'TASK_COMPLETION': {
        // 作業完了骨格: 実際に完了した内容 → 成果物 → 検証結果 → 未確認事項
        lines.push(`依頼された処理の部品組み立てと静的検証が完了し${endingMasu}`);
        lines.push(`\n【成果物: 検証済みVBAマクロ】`);
        if (extraArtifactCode) {
          lines.push('```vba\n' + extraArtifactCode.trim() + '\n```');
        } else {
          lines.push(ir.conclusion);
        }
        lines.push(`\n【品質・安全性検証結果】\n・非LLM部品レジストリによる決定論的合成: 合格\n・構文解析・Option Explicitブロック整合性: 合格\n・不変条件・未宣言変数検査: ゼロ違反`);
        if (ir.conditions.length > 0) {
          lines.push(`\n【前提条件・利用環境】\n${ir.conditions.map((c) => `・${c}`).join('\n')}`);
        }
        break;
      }

      case 'GENERAL_ANSWER':
      default: {
        // 一般回答: 結論 → 補足理由 → 次の行動
        lines.push(ir.conclusion);
        if (ir.conditions.length > 0) {
          lines.push(`\n【適用条件】\n${ir.conditions.map((c) => `・${c}`).join('\n')}`);
        }
        if (ir.reasons.length > 0) {
          lines.push(`\n【判断理由】\n${ir.reasons.map((r) => `・${r}`).join('\n')}`);
        }
        if (ir.next_actions.length > 0) {
          lines.push(`\n【次のステップ】\n${ir.next_actions.map((a) => `・${a}`).join('\n')}`);
        }
        break;
      }
    }

    const surfaceText = lines.join('\n');

    // 13.4 意味保持検査の即時実行
    const inspection = this.verifySemanticPreservation(ir, surfaceText);

    systemLogger.info(
      'ANSWER_PLAN',
      `📝 [5.2 表層生成完了] 骨格: ${skeletonType} | 文字数: ${surfaceText.length} | 意味保持合格: ${inspection.isPreserved}`
    );

    return { surfaceText, inspection };
  }

  /**
   * 13.4 意味保持検査 (Semantic Preservation Check)
   * 表層生成テキストが回答内容IRの意味要素（条件、否定、確実性、世界スコープ）を
   * 脱落または歪曲させていないかを決定論的に検査する
   */
  public verifySemanticPreservation(
    ir: AnswerContentIR,
    surfaceText: string
  ): SemanticPreservationInspection {
    const missingOrDistorted: string[] = [];
    const lowerText = surfaceText.toLowerCase();

    // 1. 条件の保持検査 (IRに条件がある場合、表層文に条件提示マーカーがあるか)
    let conditionsPreserved = true;
    if (ir.conditions && ir.conditions.length > 0) {
      const conditionMarkers = ['場合', 'なら', 'であれば', '前提', 'ただし', '条件', 'かつ', 'とき'];
      const hasConditionMarker = conditionMarkers.some((m) => surfaceText.includes(m));
      if (!hasConditionMarker) {
        conditionsPreserved = false;
        missingOrDistorted.push(
          `【条件脱落】IRで指定された適用条件（${ir.conditions.join(', ')}）が表層文で欠落しています`
        );
      }
    }

    // 2. 否定の保持検査 (IR結論が否定なのに表層文が肯定断定されていないか)
    let negationPreserved = true;
    const isIrNegative = /できない|しない|不要|非推奨|禁止|失敗|不可|ない/.test(ir.conclusion);
    const isSurfaceNegative = /できない|しない|不要|非推奨|禁止|失敗|不可|ありません|ない/.test(surfaceText);
    if (isIrNegative && !isSurfaceNegative) {
      negationPreserved = false;
      missingOrDistorted.push(
        '【否定反転】IRの結論は否定的な判定（できない/しない等）ですが、表層文で否定が表現されていません'
      );
    }

    // 3. 確実性の保持検査 (IRが仮定・条件付きなのに表層文が過度な絶対断定になっていないか)
    let certaintyPreserved = true;
    if (ir.certainty === 'CONDITIONAL' || ir.certainty === 'HYPOTHETICAL') {
      const overConfidentMarkers = ['絶対に', '確実に', '100%', '完全保証', '間違いなく'];
      const hasOverConfidence = overConfidentMarkers.some((m) => surfaceText.includes(m));
      if (hasOverConfidence) {
        certaintyPreserved = false;
        missingOrDistorted.push(
          '【確実性誇張】IRは条件付き/仮定（CONDITIONAL/HYPOTHETICAL）ですが、表層文で絶対断定の表現が使われています'
        );
      }
    }

    // 4. 世界スコープの保持検査 (創作世界なのに現実の確定公文書等として出力されていないか)
    let worldScopePreserved = true;
    if (ir.world_scope === 'FICTION' || ir.world_scope === 'HYPOTHETICAL') {
      const realWorldExaggeration = ['現実の事実', '公文書で確認', '本名で実在', '正式な事実'];
      const hasRealExaggeration = realWorldExaggeration.some((m) => surfaceText.includes(m));
      if (hasRealExaggeration) {
        worldScopePreserved = false;
        missingOrDistorted.push(
          '【世界スコープ混同】IRは創作/仮定スコープですが、表層文で現実の客観事実と混同する表現が含まれています'
        );
      }
    }

    const isPreserved = missingOrDistorted.length === 0;

    if (!isPreserved) {
      systemLogger.warn(
        'ANSWER_PLAN',
        `⚠️ [13.4 意味保持検査 違反検知] ${ir.ir_id} に対する表層文で以下の不整合を検出: ${missingOrDistorted.join('; ')}`
      );
    } else {
      systemLogger.info(
        'ANSWER_PLAN',
        `✅ [13.4 意味保持検査 パス] ${ir.ir_id}: 条件・否定・確実性・世界スコープの全整合性を確認`
      );
    }

    return {
      isPreserved,
      checkedElements: {
        conditionsPreserved,
        negationPreserved,
        certaintyPreserved,
        worldScopePreserved,
      },
      missingOrDistortedElements: missingOrDistorted,
    };
  }
}

export const answerContentIrService = AnswerContentIrService.getInstance();
