import {
  AnswerContentIR,
  SemanticPreservationInspection,
  ClaimWorld,
  AnswerSkeletonType,
  MultiAxisPersonaConfig,
} from '../types';
import { systemLogger } from './systemLogger';
import { responseSurfacePolicyService } from './responseSurfacePolicyService';

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
    const persona: MultiAxisPersonaConfig = { ...this.defaultPersona, ...customPersona };
    const policy = responseSurfacePolicyService.choosePolicy(
      skeletonType,
      ir.detail_level === 'BRIEF' ? 'short' : ir.detail_level === 'DETAILED' ? 'detailed' : 'standard',
      persona,
    );
    const lines: string[] = [];
    const addList = (title: string, values: string[]) => {
      if (values.length > 0) lines.push(`\n【${title}】\n${values.map(v => `・${v}`).join('\n')}`);
    };

    // 5.2: 骨格は内容IRを並べ替えるだけ。条件・確実性・世界スコープを生成し直さない。
    switch (skeletonType) {
      case 'RECOMMENDATION':
        lines.push(`【結論】\n${ir.conclusion}`);
        if (policy.resolution !== 'BRIEF') addList('選定の主な理由', ir.reasons);
        if (policy.resolution === 'DETAILED') addList('留意点・例外', ir.exceptions);
        if (policy.resolution !== 'BRIEF') addList('推奨が変わる条件', ir.conditions);
        break;
      case 'CORRECTION':
        lines.push(`【訂正後の結論】\n${ir.conclusion}`);
        if (policy.resolution !== 'BRIEF') {
          addList('訂正に関係する条件', ir.conditions);
          addList('影響・例外', ir.exceptions);
        }
        break;
      case 'UNKNOWN_INVESTIGATION':
        lines.push(`【現在判明している事項】\n${ir.conclusion}`);
        if (policy.resolution !== 'BRIEF') {
          addList('現時点で不確実・未解決の事項', ir.exceptions);
          addList('不足している証拠・情報', ir.conditions);
        }
        addList('次の調査・検証', ir.next_actions);
        break;
      case 'TASK_COMPLETION':
        lines.push(`【実施結果】\n${ir.conclusion}`);
        if (extraArtifactCode && policy.resolution !== 'BRIEF') {
          lines.push(`\n【成果物】\n\`\`\`vba\n${extraArtifactCode.trim()}\n\`\`\``);
        }
        addList('検証・成立条件', ir.conditions);
        if (policy.resolution === 'DETAILED') addList('未確認・例外', ir.exceptions);
        addList('次の確認事項', ir.next_actions);
        break;
      case 'GENERAL_ANSWER':
      default:
        lines.push(ir.conclusion);
        if (policy.resolution !== 'BRIEF') addList('適用条件', ir.conditions);
        if (policy.resolution === 'DETAILED') addList('補足・例外', ir.exceptions);
        if (policy.resolution !== 'BRIEF') addList('判断理由', ir.reasons);
        addList('次のステップ', ir.next_actions);
        break;
    }

    // 結論先行・冗長な定型挨拶を避け、接続表現は内容ではなく表層だけに使用する。
    if (lines.length > 1 && policy.connector && !lines[1].startsWith('\n【')) {
      lines[1] = `\n${policy.connector}、${lines[1].trimStart()}`;
    }

    let surfaceText = lines.join('\n').trim();
    // 語尾は既存の文を無理に書き換えず、空の断片にのみ適用する。意味保持を優先する。
    if (!surfaceText) surfaceText = (ir.conclusion || '現時点では回答を確定できません。').trim();

    const inspection = this.verifySemanticPreservation(ir, surfaceText);
    systemLogger.info(
      'ANSWER_PLAN',
      `📝 [5.2 表層生成完了] 骨格: ${skeletonType} | 解像度: ${policy.resolution} | 文字数: ${surfaceText.length} | 意味保持合格: ${inspection.isPreserved}`
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
