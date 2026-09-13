import {
  AnswerContentIR,
  SemanticPreservationInspection,
  ClaimWorld,
  AnswerSkeletonType,
  MultiAxisPersonaConfig,
} from '../types';
import { systemLogger } from './systemLogger';
import { responseSurfacePolicyService } from './responseSurfacePolicyService';
import { responseDesignService } from './responseDesignService';
import { surfaceGrammarAndStyleService } from './surfaceGrammarAndStyleService';

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
    const headings = surfaceGrammarAndStyleService.getSectionHeadings(skeletonType, persona.currentScene);
    const lines: string[] = [];

    const formatItem = (text: string): string => {
      return surfaceGrammarAndStyleService.applyTerminologyLevel(text, persona.technicalTerminology);
    };

    const addList = (title: string, values: string[]) => {
      if (values.length > 0) {
        lines.push(`\n${title}\n${values.map(v => `・${formatItem(v)}`).join('\n')}`);
      }
    };

    const formattedConclusion = formatItem(ir.conclusion);

    // 5.2: 骨格は内容IRを並べ替えるだけ。条件・確実性・世界スコープを生成し直さない。
    switch (skeletonType) {
      case 'RECOMMENDATION':
        lines.push(`${headings.conclusion}\n${formattedConclusion}`);
        if (policy.resolution !== 'BRIEF') addList(headings.reasons, ir.reasons);
        if (policy.resolution === 'DETAILED') addList(headings.exceptions, ir.exceptions);
        if (policy.resolution !== 'BRIEF') addList(headings.conditions, ir.conditions);
        break;
      case 'CORRECTION':
        lines.push(`${headings.conclusion}\n${formattedConclusion}`);
        if (policy.resolution !== 'BRIEF') {
          addList(headings.conditions, ir.conditions);
          addList(headings.exceptions, ir.exceptions);
        }
        break;
      case 'UNKNOWN_INVESTIGATION':
        lines.push(`${headings.conclusion}\n${formattedConclusion}`);
        if (policy.resolution !== 'BRIEF') {
          addList(headings.exceptions, ir.exceptions);
          addList(headings.conditions, ir.conditions);
        }
        addList(headings.nextActions, ir.next_actions);
        break;
      case 'TASK_COMPLETION':
        lines.push(`${headings.conclusion}\n${formattedConclusion}`);
        if (extraArtifactCode && policy.resolution !== 'BRIEF') {
          lines.push(`\n【成果物】\n\`\`\`vba\n${extraArtifactCode.trim()}\n\`\`\``);
        }
        addList(headings.conditions, ir.conditions);
        if (policy.resolution === 'DETAILED') addList(headings.exceptions, ir.exceptions);
        addList(headings.nextActions, ir.next_actions);
        break;
      case 'GENERAL_ANSWER':
      default:
        lines.push(formattedConclusion);
        if (policy.resolution !== 'BRIEF') addList(headings.conditions, ir.conditions);
        if (policy.resolution === 'DETAILED') addList(headings.exceptions, ir.exceptions);
        if (policy.resolution !== 'BRIEF') addList(headings.reasons, ir.reasons);
        addList(headings.nextActions, ir.next_actions);
        break;
    }

    // 接続表現の適用 (currentScene と directness に最適化)
    const activeConnector = surfaceGrammarAndStyleService.getSceneConnector(persona.currentScene, persona.directness) || policy.connector;
    if (lines.length > 1 && activeConnector && !lines[1].startsWith('\n【')) {
      lines[1] = `\n${activeConnector}、${lines[1].trimStart()}`;
    }

    // 慎重さ (prudence) の注記付加
    const prudenceNote = surfaceGrammarAndStyleService.applyPrudenceNote(persona.prudence, persona.currentScene);
    if (prudenceNote) {
      lines.push(`\n${prudenceNote}`);
    }

    // 積極的提案 (proactiveSuggestion) の付加
    const proactiveNote = surfaceGrammarAndStyleService.applyProactiveSuggestion(persona.proactiveSuggestion, persona.currentScene);
    if (proactiveNote && policy.resolution !== 'BRIEF') {
      lines.push(`\n${proactiveNote}`);
    }

    let surfaceText = lines.join('\n').trim();
    if (!surfaceText) surfaceText = (formattedConclusion || '現時点では回答を確定できません。').trim();

    // 温かみ (warmth) とユーモア (humor) の適用
    surfaceText = surfaceGrammarAndStyleService.applyWarmthAndHumor(surfaceText, persona);

    // 活用規則・助詞選択規則の破綻検査と修復
    const grammarInspection = surfaceGrammarAndStyleService.validateGrammarAndParticles(surfaceText);
    if (grammarInspection.hasConjugationError || grammarInspection.hasParticleError) {
      systemLogger.warn(
        'ANSWER_PLAN',
        `文法/助詞の破綻を検出し修復しました: ${[...grammarInspection.conjugationIssues, ...grammarInspection.particleIssues].join(', ')}`
      );
      surfaceText = grammarInspection.repairedText;
    }

    // 2.1 最優先: 重複除去エンジンの接続 (surfaceText → deduplicateResponse → 最終出力)
    const dedup = responseDesignService.deduplicateResponse(surfaceText);
    if (dedup.duplicatesRemovedCount > 0) {
      systemLogger.info(
        'ANSWER_PLAN',
        `[重複除去] duplicatesRemovedCount: ${dedup.duplicatesRemovedCount}件の重複文/行/ループ句を排除しました`,
        { duplicatesRemovedCount: dedup.duplicatesRemovedCount }
      );
    }
    surfaceText = dedup.cleanedText;

    const inspection = this.verifySemanticPreservation(ir, surfaceText);
    systemLogger.info(
      'ANSWER_PLAN',
      `📝 [5.2 表層生成完了] 骨格: ${skeletonType} | 解像度: ${policy.resolution} | 文字数: ${surfaceText.length} | 重複除去: ${dedup.duplicatesRemovedCount}件 | 意味保持合格: ${inspection.isPreserved}`
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
    const safeText = typeof surfaceText === 'string' ? surfaceText : '';
    const lowerText = safeText.toLowerCase();

    // 1. 条件の保持検査 (IRに条件がある場合、表層文に条件提示マーカーがあるか)
    let conditionsPreserved = true;
    if (ir.conditions && ir.conditions.length > 0) {
      const conditionMarkers = ['場合', 'なら', 'であれば', '前提', 'ただし', '条件', 'かつ', 'とき'];
      const hasConditionMarker = conditionMarkers.some((m) => safeText.includes(m));
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
    const isSurfaceNegative = /できない|しない|不要|非推奨|禁止|失敗|不可|ありません|ない/.test(safeText);
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
      const hasOverConfidence = overConfidentMarkers.some((m) => safeText.includes(m));
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
      const hasRealExaggeration = realWorldExaggeration.some((m) => safeText.includes(m));
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
