import {
  AnswerSkeletonType,
  MultiAxisPersonaConfig,
  ResponseLength,
} from '../types';
import { systemLogger } from './systemLogger';
import { surfaceVariationService } from './surfaceVariationService';

/**
 * 設計思想 5.2節「11部品」の表層文法・性格・文末表現エンジン
 *
 * 1. 回答骨格 (段落構成)
 * 2. 意味別の文型 (肯定/否定/仮定/理由/提案/指示/確認)
 * 3. 語彙候補 (専門用語レベル・平易化置換)
 * 4. 接続表現 (シーン・ダイレクトネスに応じた接続詞)
 * 5. 文末表現 (敬体/常体/感情語/親和表現)
 * 6. 活用規則・破綻検出 (敬体常体混交・連体接続破綻の検出)
 * 7. 助詞選択規則・破綻検出 (格助詞連続誤用・二重助詞衝突の検出)
 * 8. 性格設定8軸 (warmth/technical/proactive/prudence/humor/scene等)
 * 9. 回答長設定 (BRIEF/STANDARD/DETAILED)
 * 10. 重複除去 (responseDesignService.deduplicateResponse)
 * 11. 保持検査 (verifySemanticPreservation)
 */

export interface GrammarValidationResult {
  hasConjugationError: boolean;
  hasParticleError: boolean;
  conjugationIssues: string[];
  particleIssues: string[];
  repairedText: string;
}

export class SurfaceGrammarAndStyleService {
  private static instance: SurfaceGrammarAndStyleService;

  /** 専門用語の平易化マッピング辞書 (technicalTerminology === 'MINIMAL' 用) */
  private static readonly TERMINOLOGY_SIMPLIFICATION_MAP: [RegExp, string][] = [
    [/\bIR\b|中間表現/g, '内部データ形式'],
    [/\bAST\b|抽象構文木/g, 'プログラム構造の解析データ'],
    [/スキーマ(?:定義)?/g, 'データ構造のルール'],
    [/トランザクション/g, '一括確定処理'],
    [/デッドロック/g, '処理同士の競合による膠着状態'],
    [/冪等性/g, '何度実行しても結果が変わらない性質'],
    [/ヒューリスティクス/g, '経験則に基づく推論ルール'],
    [/パイプライン/g, '一連の処理工程'],
    [/インターフェース/g, '接続の取り決め'],
    [/非同期処理/g, 'バックグラウンド並行処理'],
    [/リファクタリング/g, '動作を変えずにコード構造を整理すること'],
  ];

  public static getInstance(): SurfaceGrammarAndStyleService {
    if (!SurfaceGrammarAndStyleService.instance) {
      SurfaceGrammarAndStyleService.instance = new SurfaceGrammarAndStyleService();
    }
    return SurfaceGrammarAndStyleService.instance;
  }

  /**
   * 1. 専門用語レベルの適用 (technicalTerminology)
   */
  public applyTerminologyLevel(
    text: string,
    level: MultiAxisPersonaConfig['technicalTerminology']
  ): string {
    if (level === 'RIGOROUS') {
      // 専門用語をそのまま厳密に維持
      return text;
    }
    if (level === 'MINIMAL') {
      // 平易な言葉に置換
      let simplified = text;
      for (const [regex, replacement] of SurfaceGrammarAndStyleService.TERMINOLOGY_SIMPLIFICATION_MAP) {
        simplified = simplified.replace(regex, replacement);
      }
      return simplified;
    }
    // BALANCED: デフォルトは維持
    return text;
  }

  /**
   * 2. シーン別見出しの生成 (currentScene)
   * 設計思想 19.2節: 30種類以上のプールから非重複選択 (4大シーンは固定)
   */
  public getSectionHeadings(
    skeleton: AnswerSkeletonType,
    scene: MultiAxisPersonaConfig['currentScene']
  ): {
    conclusion: string;
    reasons: string;
    conditions: string;
    exceptions: string;
    nextActions: string;
  } {
    return surfaceVariationService.getSectionHeadings(skeleton, scene);
  }

  /**
   * 3. シーンとダイレクトネスに応じた接続詞の取得 (30種以上から非重複選択)
   */
  public getSceneConnector(
    scene: MultiAxisPersonaConfig['currentScene'],
    directness: MultiAxisPersonaConfig['directness']
  ): string {
    return surfaceVariationService.getConnector(scene, directness).text;
  }

  /**
   * 4. 慎重さ (prudence) の適用: リスク警告や検証前提の付加 (30種以上から非重複選択)
   */
  public applyPrudenceNote(
    prudence: MultiAxisPersonaConfig['prudence'],
    scene: MultiAxisPersonaConfig['currentScene']
  ): string | null {
    return surfaceVariationService.getPrudenceNote(prudence, scene)?.text || null;
  }

  /**
   * 5. 積極的提案 (proactiveSuggestion) の適用 (30種以上から非重複選択)
   */
  public applyProactiveSuggestion(
    proactiveSuggestion: MultiAxisPersonaConfig['proactiveSuggestion'],
    scene: MultiAxisPersonaConfig['currentScene']
  ): string | null {
    return surfaceVariationService.getProactiveSuggestion(proactiveSuggestion, scene)?.text || null;
  }

  /**
   * 6. 温かみ (warmth) とユーモア (humor) による結び表現の適用 (30種以上から非重複選択)
   */
  public applyWarmthAndHumor(
    baseText: string,
    persona: MultiAxisPersonaConfig
  ): string {
    let result = baseText;

    // 災害復旧やエラー報告シーンでは、ユーモアや過度な感情語は自動抑制（安全設計）
    const isCriticalScene = persona.currentScene === 'DISASTER_RECOVERY' || persona.currentScene === 'ERROR_REPORT';

    // 6.1 ユーモア (humor) の付加 (30種以上から選択)
    if (!isCriticalScene && persona.humor !== 'OFF') {
      const humorItem = surfaceVariationService.getHumorLine(persona.humor);
      if (humorItem) {
        result += `\n\n${humorItem.text}`;
      }
    }

    // 6.2 温かみ (warmth) の付加 (30種以上から選択)
    if (!isCriticalScene) {
      if (persona.warmth === 'HIGH') {
        const closingItem = surfaceVariationService.getWarmthClosing(persona.politeness);
        result += ` ${closingItem.text}`;
      } else if (persona.warmth === 'LOW') {
        // LOWの場合は感嘆符や親密語尾を抑制し、端正な句点に整える
        result = result.replace(/！+/g, '。').replace(/いつでも頼ってね[！。]?/g, '');
      }
    }

    return result;
  }

  /**
   * 7. 活用規則・破綻検出 (Conjugation Disruption Check)
   * 敬体（です・ます）と常体（だ・である）の不自然な衝突や、連体形接続の破綻を検出
   */
  public detectConjugationDisruption(text: string): {
    hasError: boolean;
    issues: string[];
    repairedText: string;
  } {
    const issues: string[] = [];
    let repaired = text;

    // 破綻パターン1: 「〜ですである」「〜だでした」「〜ましただ」「〜であるです」などの直接接続ミス
    const clashingPatterns: [RegExp, string, string][] = [
      [/ですである/g, 'である', '「ですである」という敬体・常体の直接重複'],
      [/だでした/g, 'でした', '「だでした」という断定の重複'],
      [/ましただ/g, 'ました', '「ましただ」という過去形と断定の重複'],
      [/であるです/g, 'です', '「であるです」という常体・敬体の直接重複'],
      [/でしたである/g, 'であった', '「でしたである」という活用混交'],
    ];

    for (const [pattern, fix, label] of clashingPatterns) {
      if (pattern.test(repaired)) {
        issues.push(`【活用不整合】${label}`);
        repaired = repaired.replace(pattern, fix);
      }
    }

    // 破綻パターン2: 連体形接続の破綻（「だこと」「だため」など。正しくは「なこと」「であるため」）
    const rentaiClashes: [RegExp, string, string][] = [
      [/だこと(?=[はがをにも])/g, 'なこと', '体言「こと」への「だ」の不自然な接続（「なこと」が適切）'],
      [/だため(?=[はがをにも、\n])/g, 'であるため', '形式名詞「ため」への「だ」の不自然な接続（「であるため」が適切）'],
    ];

    for (const [pattern, fix, label] of rentaiClashes) {
      if (pattern.test(repaired)) {
        issues.push(`【連体形接続不整合】${label}`);
        repaired = repaired.replace(pattern, fix);
      }
    }

    return {
      hasError: issues.length > 0,
      issues,
      repairedText: repaired,
    };
  }

  /**
   * 8. 助詞選択規則・破綻検出 (Particle Disruption Check)
   * 連続する格助詞の誤用（「をを」「がが」「にに」等）や、重なり衝突（「についてについて」「を対象にしてを」等）を検出
   */
  public detectParticleDisruption(text: string): {
    hasError: boolean;
    issues: string[];
    repairedText: string;
  } {
    const issues: string[] = [];
    let repaired = text;

    // 破綻パターン1: 同一格助詞の直前連続（「をを」「がが」「にに」「でで」「へへ」「からから」など）
    const duplicateParticleRegex = /([をがにでへっと])\1+/g;
    let match: RegExpExecArray | null;
    while ((match = duplicateParticleRegex.exec(repaired)) !== null) {
      issues.push(`【二重助詞誤用】助詞「${match[1]}」が連続して重複しています（「${match[0]}」）`);
    }
    repaired = repaired.replace(duplicateParticleRegex, '$1');

    // 破綻パターン2: 複合格助詞のループ重複・衝突（「についてについて」「に対してに対して」「てのがお」「をが」など）
    const compoundLoopPatterns: [RegExp, string, string][] = [
      [/についてについて/g, 'について', '「について」のループ重複'],
      [/に対してに対して/g, 'に対して', '「に対して」のループ重複'],
      [/としてとして/g, 'として', '「として」のループ重複'],
      [/によってによって/g, 'によって', '「によって」のループ重複'],
      [/を対象にしてを/g, 'を対象にして', '「を」の二重付与と脱落衝突'],
      [/へを(?=[\s\S])/g, 'へ', '「へを」という方向助詞と格助詞の不自然な衝突'],
      [/(?:て|で)のが(?=[おいうえあかがきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわを])/g, 'て', '接続助詞「て/で」直後の不自然な「のが」誤用'],
      [/(?:をが|がを|のを|にが|がに|でが)(?=[おいうえあかがきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわを])/g, '', '格助詞の不自然な連続衝突'],
    ];

    for (const [pattern, fix, label] of compoundLoopPatterns) {
      if (pattern.test(repaired)) {
        issues.push(`【助詞衝突誤用】${label}`);
        repaired = repaired.replace(pattern, fix);
      }
    }

    return {
      hasError: issues.length > 0,
      issues,
      repairedText: repaired,
    };
  }

  /**
   * 文法・助詞の総合検査
   */
  public validateGrammarAndParticles(text: string): GrammarValidationResult {
    const conj = this.detectConjugationDisruption(text);
    const part = this.detectParticleDisruption(conj.repairedText);

    return {
      hasConjugationError: conj.hasError,
      hasParticleError: part.hasError,
      conjugationIssues: conj.issues,
      particleIssues: part.issues,
      repairedText: part.repairedText,
    };
  }
}

export const surfaceGrammarAndStyleService = SurfaceGrammarAndStyleService.getInstance();
