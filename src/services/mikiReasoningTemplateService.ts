import {
  AnswerContentIR,
  AnswerSkeletonType,
  ClaimRecord,
  ConversationState,
  ConversationStage,
} from '../types';
import { claimDatabaseService } from './claimDatabaseService';
import { answerContentIrService } from './answerContentIrService';
import { mikiUnifiedLearningContinuumService } from './mikiUnifiedLearningContinuumService';
import { systemLogger } from './systemLogger';

export type ReasoningPatternType = 'COMPARISON' | 'CAUSALITY' | 'CONDITIONAL';

export interface ReasoningTemplate {
  id: string;
  name: string;
  pattern: ReasoningPatternType;
  description: string;
  applicableStages: ConversationStage[];
  criteria: string[];
}

export interface ReasoningMatchResult {
  matched: boolean;
  template: ReasoningTemplate;
  participatingClaims: ClaimRecord[];
  answerIR: AnswerContentIR;
  skeletonType: AnswerSkeletonType;
  explanation: string;
}

/**
 * 統合版指示書 第3章 / 第6章 / 第7章 / 第13章
 * みき自律推論テンプレート・サービス (Miki Reasoning Template Service)
 * 
 * 統計的学習基盤(mikiUnifiedLearningContinuumService)と連携し、
 * LLMに依存せず検証済み主張(VERIFIED Claims)を組み合わせて
 * 比較・因果・条件分岐の複合結論を決定論的に導出・学習する。
 */
export class MikiReasoningTemplateService {
  private static instance: MikiReasoningTemplateService;

  private templates: Map<string, ReasoningTemplate> = new Map([
    [
      'reasoning:comparison',
      {
        id: 'reasoning:comparison',
        name: '多軸比較推論テンプレート',
        pattern: 'COMPARISON',
        description: '2つの対象に関する検証済み主張を照合し、速度・安全性・適用環境の軸で比較結論を合成する',
        applicableStages: ['COMPARISON'],
        criteria: ['SPEED_PERFORMANCE', 'SAFETY_RESOURCE', 'ENVIRONMENT_COMPATIBILITY'],
      },
    ],
    [
      'reasoning:causality',
      {
        id: 'reasoning:causality',
        name: '因果連鎖推論テンプレート',
        pattern: 'CAUSALITY',
        description: '原因・現象の検証済み主張と結果・対策の検証済み主張を連結し、因果連鎖の結論を合成する',
        applicableStages: ['CAUSALITY'],
        criteria: ['CAUSE_EFFECT_CHAIN', 'MECHANISM', 'REMEDY_EFFECTIVENESS'],
      },
    ],
    [
      'reasoning:conditional',
      {
        id: 'reasoning:conditional',
        name: '条件分岐推論テンプレート',
        pattern: 'CONDITIONAL',
        description: '実行環境・デバイス・ランタイムの異なる検証済み主張を比較し、条件ごとの最適結論を合成する',
        applicableStages: ['CONDITIONAL'],
        criteria: ['ENVIRONMENT_SCOPE', 'DEVICE_CONSTRAINTS', 'BRANCHING_POLICY'],
      },
    ],
  ]);

  private constructor() {}

  public static getInstance(): MikiReasoningTemplateService {
    if (!MikiReasoningTemplateService.instance) {
      MikiReasoningTemplateService.instance = new MikiReasoningTemplateService();
    }
    return MikiReasoningTemplateService.instance;
  }

  public getTemplates(): ReasoningTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplate(id: string): ReasoningTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 推論テンプレートが使用可能か（統計的学習プロファイルに基づく信頼性判定）
   */
  public isTemplateUsable(templateId: string): boolean {
    const profile = mikiUnifiedLearningContinuumService.getProfile(templateId);
    if (!profile) return true; // 新規テンプレートは初期試行可能
    // 失敗数が成功数を大幅に上回る場合は一時抑止
    if (profile.uses >= 3 && profile.failures > profile.successes && profile.confidence < 40) {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `🚫 [推論テンプレート抑止] ${templateId} は統計的信頼度が低下しています (conf=${profile.confidence}%, fail=${profile.failures})`
      );
      return false;
    }
    return true;
  }

  /**
   * 推論テンプレートの適用を試行
   */
  public evaluateAndApply(
    prompt: string,
    state: ConversationState
  ): ReasoningMatchResult | null {
    const stage = state.stage;

    // 1. 比較推論の試行
    if (stage === 'COMPARISON' || /比較|どっち|どちら|違い|vs|メリット|デメリット/i.test(prompt)) {
      const compResult = this.tryComparisonReasoning(prompt, state);
      if (compResult) return compResult;
    }

    // 2. 因果推論の試行
    if (stage === 'CAUSALITY' || /なぜ|どうして|原因|理由|したらどうなる|影響|結果/i.test(prompt)) {
      const causalityResult = this.tryCausalityReasoning(prompt, state);
      if (causalityResult) return causalityResult;
    }

    // 3. 条件分岐推論の試行
    if (stage === 'CONDITIONAL' || /の場合|の条件|の環境|環境によって|条件によって/i.test(prompt)) {
      const conditionalResult = this.tryConditionalReasoning(prompt, state);
      if (conditionalResult) return conditionalResult;
    }

    return null;
  }

  /**
   * 比較推論: 2つの対象に関する検証済み主張を抽出し多軸比較を合成
   */
  private tryComparisonReasoning(
    prompt: string,
    state: ConversationState
  ): ReasoningMatchResult | null {
    const template = this.templates.get('reasoning:comparison')!;
    if (!this.isTemplateUsable(template.id)) return null;

    // 比較対象の抽出 (プロンプトまたはrecentEntities)
    const entities = this.extractComparisonEntities(prompt, state);
    if (!entities || !entities.entityA || !entities.entityB) return null;

    const { entityA, entityB } = entities;

    // 検証済み主張の検索 (SUPPORTED または DEVICE_VERIFIED、またはMATURE成熟度)
    const claims = claimDatabaseService.listClaims({ excludeSuperseded: true });
    const verifiedClaims = claims.filter(
      (c) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED' || (c.maturity === 'MATURE' && c.status !== 'CANDIDATE' && c.status !== 'FALSE')
    );

    const claimA = this.findBestClaimForEntity(verifiedClaims, entityA);
    const claimB = this.findBestClaimForEntity(verifiedClaims, entityB);

    if (!claimA || !claimB || claimA.claim_id === claimB.claim_id) {
      return null;
    }

    // 多軸評価の分析
    const speedA = /高速|速|時間短縮/.test(claimA.statement) ? '高速' : /低下|遅|時間/.test(claimA.statement) ? '低速' : '標準';
    const speedB = /高速|速|時間短縮/.test(claimB.statement) ? '高速' : /低下|遅|時間/.test(claimB.statement) ? '低速' : '標準';
    
    const scopeAStr = this.formatScope(claimA.scope);
    const scopeBStr = this.formatScope(claimB.scope);

    const conclusion = `『${entityA}』と『${entityB}』の多軸検証比較：『${entityA}』は${claimA.statement}の一方で、『${entityB}』は${claimB.statement}です。`;

    const reasons = [
      `[${entityA}の検証事実]: ${claimA.statement} (${claimA.status} / ${claimA.maturity})`,
      `[${entityB}の検証事実]: ${claimB.statement} (${claimB.status} / ${claimB.maturity})`,
      `[性能・速度比較]: ${entityA}=${speedA}、${entityB}=${speedB}`,
      `[適用制約比較]: ${entityA}(${scopeAStr}) vs ${entityB}(${scopeBStr})`,
    ];

    const conditions = [
      `前提として、${entityA}は「${scopeAStr}」、${entityB}は「${scopeBStr}」の条件下で検証されています。`,
    ];

    const answerIR = answerContentIrService.buildAnswerIR({
      conclusion,
      target: `比較: ${entityA} vs ${entityB}`,
      reasons,
      conditions,
      certainty: (claimA.status === 'DEVICE_VERIFIED' && claimB.status === 'DEVICE_VERIFIED') ? 'CERTAIN' : 'HIGH_CONFIDENCE',
      detailLevel: 'STANDARD',
      worldScope: 'REAL',
      nextActions: ['実際の利用要件に合わせて最適な手法を選択してください。'],
    });

    return {
      matched: true,
      template,
      participatingClaims: [claimA, claimB],
      answerIR,
      skeletonType: 'RECOMMENDATION',
      explanation: `多軸比較推論 (${entityA} vs ${entityB}) を適用し、2件の検証済み主張を統合しました。`,
    };
  }

  /**
   * 因果推論: 原因・現象と結果・対策の2つの検証済み主張を連結
   */
  private tryCausalityReasoning(
    prompt: string,
    state: ConversationState
  ): ReasoningMatchResult | null {
    const template = this.templates.get('reasoning:causality')!;
    if (!this.isTemplateUsable(template.id)) return null;

    const claims = claimDatabaseService.listClaims({ excludeSuperseded: true });
    const verifiedClaims = claims.filter(
      (c) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED' || (c.maturity === 'MATURE' && c.status !== 'CANDIDATE' && c.status !== 'FALSE')
    );

    // プロンプトに関係する原因または現象のClaimを探す
    const causeClaim = verifiedClaims.find((c) =>
      /低下|エラー|クラッシュ|問題|原因|発生|失われ|遅/i.test(c.statement) &&
      (prompt.includes(c.scope.environment || '') || prompt.includes(c.scope.runtime || '') || this.matchesKeywords(prompt, c.statement))
    );

    // それに対応する対策または高速化のClaimを探す
    const effectClaim = verifiedClaims.find((c) =>
      c.claim_id !== causeClaim?.claim_id &&
      /高速|解決|改善|対策|防止|代入|一括|メモリ/i.test(c.statement) &&
      (causeClaim ? (c.scope.environment === causeClaim.scope.environment || c.scope.runtime === causeClaim.scope.runtime) : true)
    );

    if (!causeClaim || !effectClaim) return null;

    const conclusion = `「${causeClaim.statement}」という現象・原因に対し、「${effectClaim.statement}」が検証済みの対策・帰結となります。`;

    const reasons = [
      `[現象・原因]: ${causeClaim.statement} (検証状態: ${causeClaim.status})`,
      `[機序・対応策]: ${effectClaim.statement} (検証状態: ${effectClaim.status})`,
      `[因果連鎖]: 原因の発生条件を解消するため、対策の適用が推奨されます。`,
    ];

    const conditions = [
      `前提として、原因環境: ${this.formatScope(causeClaim.scope)}、対策環境: ${this.formatScope(effectClaim.scope)}の条件を確認してください。`,
    ];

    const answerIR = answerContentIrService.buildAnswerIR({
      conclusion,
      target: '因果連鎖の検証',
      reasons,
      conditions,
      certainty: 'HIGH_CONFIDENCE',
      detailLevel: 'STANDARD',
      worldScope: 'REAL',
      nextActions: ['根本原因を避けるための推奨手順を採用してください。'],
    });

    return {
      matched: true,
      template,
      participatingClaims: [causeClaim, effectClaim],
      answerIR,
      skeletonType: 'GENERAL_ANSWER',
      explanation: `因果推論を適用し、原因(ID: ${causeClaim.claim_id})と対策(ID: ${effectClaim.claim_id})を連結しました。`,
    };
  }

  /**
   * 条件分岐推論: 環境・デバイスによる分岐
   */
  private tryConditionalReasoning(
    prompt: string,
    state: ConversationState
  ): ReasoningMatchResult | null {
    const template = this.templates.get('reasoning:conditional')!;
    if (!this.isTemplateUsable(template.id)) return null;

    const claims = claimDatabaseService.listClaims({ excludeSuperseded: true });
    const verifiedClaims = claims.filter(
      (c) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED' || (c.maturity === 'MATURE' && c.status !== 'CANDIDATE' && c.status !== 'FALSE')
    );

    if (verifiedClaims.length < 2) return null;

    // 異なるスコープを持つ2つの主張を選択
    const claim1 = verifiedClaims[0];
    const claim2 = verifiedClaims.find(
      (c) => c.claim_id !== claim1.claim_id &&
        (c.scope.environment !== claim1.scope.environment || c.scope.device !== claim1.scope.device)
    );

    if (!claim1 || !claim2) return null;

    const scope1 = this.formatScope(claim1.scope);
    const scope2 = this.formatScope(claim2.scope);

    const conclusion = `適用環境および実行条件によって、検証された事実・推奨方針が分岐します。`;

    const reasons = [
      `[条件1: ${scope1} の場合]: ${claim1.statement} (${claim1.status})`,
      `[条件2: ${scope2} の場合]: ${claim2.statement} (${claim2.status})`,
    ];

    const conditions = [
      `前提として、実行中の環境および対象プラットフォームを事前に判別してください。`,
    ];

    const answerIR = answerContentIrService.buildAnswerIR({
      conclusion,
      target: '環境・条件分岐判断',
      reasons,
      conditions,
      certainty: 'CONDITIONAL',
      detailLevel: 'STANDARD',
      worldScope: 'REAL',
      nextActions: ['現在の対象環境に合わせて該当の条件方針を選択してください。'],
    });

    return {
      matched: true,
      template,
      participatingClaims: [claim1, claim2],
      answerIR,
      skeletonType: 'GENERAL_ANSWER',
      explanation: `条件分岐推論を適用し、2つの環境スコープ(${scope1} / ${scope2})で条件分岐しました。`,
    };
  }

  /**
   * 比較対象の抽出ヘルパー
   */
  private extractComparisonEntities(
    prompt: string,
    state: ConversationState
  ): { entityA: string; entityB: string } | null {
    // パターン1: 「AとBを比較」「A vs B」「AとBの違い」「『A』と『B』のどっち」
    const match1 = prompt.match(/(?:[「『]([^」』]+)[」』]|([^\sと対vs、,]+?))\s*(?:と|vs|対|よりも)\s*(?:[「『]([^」』]+)[」』]|([^\sをので、,]+?))\s*(?:の|で|を)?\s*(?:比較|どっち|どちら|違い|差|優れ)/i);
    if (match1) {
      const a = (match1[1] || match1[2] || '').trim();
      const b = (match1[3] || match1[4] || '').trim();
      if (a && b && a !== b && a.length >= 2 && b.length >= 2) {
        return { entityA: a, entityB: b };
      }
    }

    // パターン2: キーワードペア
    if (/ループ/.test(prompt) && /配列/.test(prompt)) {
      return { entityA: 'ループ処理', entityB: '配列一括処理' };
    }

    // パターン3: recentEntities
    if (state.recentEntities && state.recentEntities.length >= 2) {
      return {
        entityA: state.recentEntities[state.recentEntities.length - 2],
        entityB: state.recentEntities[state.recentEntities.length - 1],
      };
    }

    return null;
  }

  private extractTokens(str: string): string[] {
    const clean = str.replace(/[^\u4E00-\u9FFF\u30A0-\u30FF\u3040-\u309Fa-zA-Z0-9]/g, '');
    const tokens: string[] = [];
    if (clean.length >= 2) {
      for (let i = 0; i < clean.length - 1; i++) {
        tokens.push(clean.slice(i, i + 2));
      }
    } else if (clean.length === 1) {
      tokens.push(clean);
    }
    return tokens;
  }

  private findBestClaimForEntity(claims: ClaimRecord[], entity: string): ClaimRecord | undefined {
    const eLower = entity.toLowerCase();
    const tokens = this.extractTokens(entity);
    let best: ClaimRecord | undefined;
    let maxMatches = 0;

    for (const c of claims) {
      const sLower = c.statement.toLowerCase();
      let matches = 0;
      if (sLower.includes(eLower)) matches += 10;
      for (const t of tokens) {
        if (sLower.includes(t.toLowerCase())) matches += 2;
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        best = c;
      }
    }

    return maxMatches >= 2 ? best : undefined;
  }

  private matchesKeywords(text: string, statement: string): boolean {
    const tokens = this.extractTokens(text);
    return tokens.some((t) => statement.includes(t));
  }

  private formatScope(scope: ClaimRecord['scope']): string {
    const parts: string[] = [];
    if (scope.environment) parts.push(`環境: ${scope.environment}`);
    if (scope.runtime) parts.push(`ランタイム: ${scope.runtime}`);
    if (scope.device) parts.push(`端末: ${scope.device}`);
    if (scope.backend) parts.push(`バックエンド: ${scope.backend}`);
    return parts.length > 0 ? parts.join(', ') : '汎用';
  }
}

export const mikiReasoningTemplateService = MikiReasoningTemplateService.getInstance();
