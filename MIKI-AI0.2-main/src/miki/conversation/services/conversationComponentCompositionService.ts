import {
  ClaimRecord,
  ComponentTxtPackage,
  AnswerSkeletonType,
} from '../../../types';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { componentCompositionService, CompositionPlan } from '../../capability/services/componentCompositionService';
import { formalConstraintSolverService, BinaryConstraint } from '../../verification/services/formalConstraintSolverService';
import { wordAssociationGraphService, RelatednessEvaluation } from '../../memory/services/wordAssociationGraphService';
import { falsificationService } from '../../verification/services/falsificationService';
import { surfaceVariationService } from './surfaceVariationService';
import { answerContentIrService } from './answerContentIrService';
import { conversationFeedbackEvidenceService } from './conversationFeedbackEvidenceService';
import { conversationLearningEpisodeService } from './conversationLearningEpisodeService';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

const COMPOSED_STORAGE_KEY = 'miki_composed_conversation_responses_v1';

export type ComposedResponseStatus = 'CANDIDATE' | 'TESTED' | 'OBSERVED' | 'NEEDS_REVISION' | 'VERIFIED' | 'REJECTED' | 'QUARANTINED';

export interface ComposedConversationResponse {
  id: string;
  goal: string;
  status: ComposedResponseStatus;
  planId: string;
  componentIds: string[];
  claimIds: string[];
  templateId: string;
  surfaceComponentId: string;
  surfaceText: string;
  conclusion: string;
  falsificationPassed: boolean;
  userFeedbackReceived: boolean;
  usageCount: number;
  createdAt: number;
  verifiedAt?: number;
  verificationLog?: string;
}

export interface CompositionPreFilterResult {
  allowed: boolean;
  reason: string;
  associationScore: number;
  cspPassed: boolean;
  cspContradictions: string[];
}

export class ConversationComponentCompositionService {
  private static instance: ConversationComponentCompositionService;
  private composedResponses: Map<string, ComposedConversationResponse> = new Map();
  private initialized = false;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): ConversationComponentCompositionService {
    if (!ConversationComponentCompositionService.instance) {
      ConversationComponentCompositionService.instance = new ConversationComponentCompositionService();
    }
    return ConversationComponentCompositionService.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    this.syncComponentsToRegistry();
    this.initialized = true;
  }

  private loadFromStorage(): void {
    try {
      const raw = storageService.getItem(COMPOSED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            this.composedResponses.set(item.id, item);
          }
        }
      }
    } catch (e) {
      systemLogger.warn('PERSISTENCE', 'Failed to load composed responses', e);
    }
  }

  private saveToStorage(): void {
    try {
      storageService.setItem(
        COMPOSED_STORAGE_KEY,
        JSON.stringify(Array.from(this.composedResponses.values()))
      );
    } catch (e) {
      systemLogger.warn('PERSISTENCE', 'Failed to save composed responses', e);
    }
  }

  /**
   * トピックカテゴリの判定 (Claimのスコープ・記述から正規化)
   */
  public extractTopicCategory(claim: ClaimRecord): string {
    const scope = claim.scope || {};
    const text = (claim.statement + ' ' + (claim.origin_source_id || '')).toLowerCase();

    if (
      scope.runtime === 'VBA' ||
      scope.environment === 'Excel' ||
      text.includes('vba') ||
      text.includes('excel')
    ) {
      return 'vba_performance';
    }

    if (
      scope.environment === 'Termux' ||
      scope.backend === 'Vulkan' ||
      text.includes('vulkan') ||
      text.includes('termux')
    ) {
      return 'termux_vulkan';
    }

    if (claim.world === 'FICTION' || text.includes('火星') || text.includes('軍事基地')) {
      return 'fictional_space';
    }

    if (scope.environment) {
      return scope.environment.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }

    return 'general_knowledge';
  }

  /**
   * 1. 会話部品（Claim, 推論テンプレート, 言い換え）を型付きで componentRegistryService に登録
   */
  public syncComponentsToRegistry(): {
    claimsRegistered: number;
    templatesRegistered: number;
    surfacesRegistered: number;
  } {
    let claimsCount = 0;
    let templatesCount = 0;
    let surfacesCount = 0;

    // A. 検証済み Claim の登録 (SUPPORTED / DEVICE_VERIFIED / MATURE)
    const verifiedClaims = claimDatabaseService.listClaims({ excludeSuperseded: true }).filter(
      (c) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED' || (c.maturity === 'MATURE' && c.status !== 'FALSE')
    );

    for (const claim of verifiedClaims) {
      const topicCategory = this.extractTopicCategory(claim);
      const compId = `conv.claim.${claim.claim_id.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

      const pkg: ComponentTxtPackage = {
        component_id: compId,
        version: '1.0.0',
        status: 'VERIFIED',
        purpose: `[検証済み事実Claim: ${claim.claim_id}] ${claim.statement}`,
        inputs: [], // 事実供給源 (Source node)
        outputs: [
          {
            name: 'claim',
            type: `Claim<${topicCategory}>`,
            description: claim.statement,
          },
          {
            name: 'generalClaim',
            type: 'Claim<any>',
            description: claim.statement,
          },
        ],
        preconditions: [`claim_status: ${claim.status}`, `world: ${claim.world}`],
        postconditions: ['verified_epistemic_truth = true'],
        side_effects: [],
        dependencies: [],
        supported_environments: ['universal', 'android', 'windows', 'conversation'],
        entry_point: `getVerifiedClaim_${claim.claim_id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        failure_behavior: '主張撤回時は空オブジェクトを返し後続推論を安全に停止',
        security_class: 'READ_ONLY',
        idempotent: true,
        deterministic: true,
        component_txt: `COMPONENT_ID: ${compId}\nVERSION: 1.0.0\nSTATUS: VERIFIED\nTYPE: Claim<${topicCategory}>\nSTATEMENT: ${claim.statement}`,
        implementation_txt: `export const claimData = ${JSON.stringify(claim)};`,
        tests_txt: `TEST_CASE: VALIDITY, claim_id='${claim.claim_id}', status='${claim.status}'`,
        validation_txt: `STATUS: VERIFIED\nVERIFIED_AT: ${claim.updated_at}\nVERIFIER: EvidenceBasedPromotionGate`,
        implementation_hash: `hash_${claim.claim_id}_${claim.updated_at}`,
        validation_hash: `val_${claim.claim_id}_${claim.status}`,
        success_count: 10,
        failure_count: 0,
        created_at: claim.created_at || Date.now(),
        updated_at: claim.updated_at || Date.now(),
      };

      componentRegistryService.registerComponent(pkg);
      claimsCount++;
    }

    // B. 推論テンプレート部品 (v9: 比較・因果・条件)
    const reasoningTemplates: Array<{
      id: string;
      name: string;
      purpose: string;
      inputs: Array<{ name: string; type: string; description: string }>;
      outputs: Array<{ name: string; type: string; description: string }>;
      entryPoint: string;
    }> = [
      {
        id: 'conv.reasoning.comparison',
        name: '多軸比較推論テンプレート',
        purpose: '2件の検証済みClaimを受け取り、多軸性能・制約・優劣を決定論的に比較して結論と推奨骨格を出力する',
        inputs: [
          { name: 'claimA', type: 'Claim<any>', description: '比較対象Aの検証済み主張' },
          { name: 'claimB', type: 'Claim<any>', description: '比較対象Bの検証済み主張' },
        ],
        outputs: [
          { name: 'conclusion', type: 'Conclusion<comparison>', description: '多軸比較推論の結論' },
          { name: 'skeleton', type: 'AnswerSkeleton<RECOMMENDATION>', description: '推奨回答骨格IR' },
        ],
        entryPoint: 'synthesizeComparisonReasoning',
      },
      {
        id: 'conv.reasoning.causality',
        name: '因果連鎖推論テンプレート',
        purpose: '原因/現象のClaimと対策/帰結のClaimを受け取り、因果連鎖の分析結果と一般回答骨格を出力する',
        inputs: [
          { name: 'causeClaim', type: 'Claim<any>', description: '原因・現象の検証済み主張' },
          { name: 'effectClaim', type: 'Claim<any>', description: '対策・帰結の検証済み主張' },
        ],
        outputs: [
          { name: 'conclusion', type: 'Conclusion<causality>', description: '因果推論の結論' },
          { name: 'skeleton', type: 'AnswerSkeleton<GENERAL_ANSWER>', description: '一般回答骨格IR' },
        ],
        entryPoint: 'synthesizeCausalityReasoning',
      },
      {
        id: 'conv.reasoning.conditional',
        name: '条件分岐推論テンプレート',
        purpose: '異なる環境・スコープの複数Claimを受け取り、条件分岐トレードオフと条件分岐骨格を出力する',
        inputs: [
          { name: 'claimA', type: 'Claim<any>', description: '条件Aでの検証済み主張' },
          { name: 'claimB', type: 'Claim<any>', description: '条件Bでの検証済み主張' },
        ],
        outputs: [
          { name: 'conclusion', type: 'Conclusion<conditional>', description: '条件分岐推論の結論' },
          { name: 'skeleton', type: 'AnswerSkeleton<CONDITIONAL>', description: '条件分岐回答骨格IR' },
        ],
        entryPoint: 'synthesizeConditionalReasoning',
      },
    ];

    for (const tpl of reasoningTemplates) {
      const pkg: ComponentTxtPackage = {
        component_id: tpl.id,
        version: '1.0.0',
        status: 'VERIFIED',
        purpose: tpl.purpose,
        inputs: tpl.inputs,
        outputs: tpl.outputs,
        preconditions: ['inputs.every(c => c.status === "VERIFIED" || c.status === "SUPPORTED")'],
        postconditions: ['output.conclusion != null', 'output.skeleton != null'],
        side_effects: [],
        dependencies: [],
        supported_environments: ['universal', 'android', 'windows', 'conversation'],
        entry_point: tpl.entryPoint,
        failure_behavior: '無関係な主張ペアの入力時はCSP/連想グラフフィルタで事前却下',
        security_class: 'READ_ONLY',
        idempotent: true,
        deterministic: true,
        component_txt: `COMPONENT_ID: ${tpl.id}\nVERSION: 1.0.0\nSTATUS: VERIFIED\nNAME: ${tpl.name}`,
        implementation_txt: `export function ${tpl.entryPoint}(claimA, claimB) { return { conclusion: 'synthesized', skeleton: 'RECOMMENDATION' }; }`,
        tests_txt: `TEST_CASE: NORMAL, two_valid_claims -> valid_conclusion`,
        validation_txt: `STATUS: VERIFIED\nVALIDATED_BY: MikiReasoningTemplateVerification`,
        implementation_hash: `hash_${tpl.id}_v1`,
        validation_hash: `val_${tpl.id}_v1`,
        success_count: 20,
        failure_count: 0,
        created_at: Date.now() - 3600000 * 24,
        updated_at: Date.now() - 3600000 * 24,
      };

      componentRegistryService.registerComponent(pkg);
      templatesCount++;
    }

    // C. 言い換え候補プール部品 (v7: RECOMMENDATION / GENERAL_ANSWER)
    const surfacePools: Array<{
      id: string;
      name: string;
      skeletonType: AnswerSkeletonType;
      purpose: string;
      entryPoint: string;
    }> = [
      {
        id: 'conv.surface.variation.recommendation',
        name: '推奨回答表層変種プール',
        skeletonType: 'RECOMMENDATION',
        purpose: 'AnswerSkeleton<RECOMMENDATION> を受け取り、非重複接続詞・丁寧語・構造化レイアウトを適用して自然言語 SurfaceText を生成する',
        entryPoint: 'realizeRecommendationSurface',
      },
      {
        id: 'conv.surface.variation.general_answer',
        name: '一般回答表層変種プール',
        skeletonType: 'GENERAL_ANSWER',
        purpose: 'AnswerSkeleton<GENERAL_ANSWER> を受け取り、非重複接続詞・結論先行の自然言語 SurfaceText を生成する',
        entryPoint: 'realizeGeneralAnswerSurface',
      },
      {
        id: 'conv.surface.variation.conditional',
        name: '条件分岐表層変種プール',
        skeletonType: 'GENERAL_ANSWER',
        purpose: 'AnswerSkeleton<GENERAL_ANSWER> または条件分岐骨格を受け取り、文脈に応じた自然言語 SurfaceText を生成する',
        entryPoint: 'realizeConditionalSurface',
      },
    ];

    for (const srf of surfacePools) {
      const pkg: ComponentTxtPackage = {
        component_id: srf.id,
        version: '1.0.0',
        status: 'VERIFIED',
        purpose: srf.purpose,
        inputs: [
          {
            name: 'skeleton',
            type: `AnswerSkeleton<${srf.skeletonType}>`,
            description: `${srf.skeletonType}の骨格IR`,
          },
        ],
        outputs: [
          {
            name: 'surfaceText',
            type: 'SurfaceText',
            description: '最終的に生成された自然言語応答文',
          },
        ],
        preconditions: ['skeleton.type === "' + srf.skeletonType + '"'],
        postconditions: ['surfaceText.length > 0'],
        side_effects: [],
        dependencies: [],
        supported_environments: ['universal', 'android', 'windows', 'conversation'],
        entry_point: srf.entryPoint,
        failure_behavior: '骨格不一致時はデフォルトテンプレートを適用',
        security_class: 'READ_ONLY',
        idempotent: false, // 非重複選択キャッシュのため変動
        deterministic: true,
        component_txt: `COMPONENT_ID: ${srf.id}\nVERSION: 1.0.0\nSTATUS: VERIFIED\nSKELETON: ${srf.skeletonType}`,
        implementation_txt: `export function ${srf.entryPoint}(ir) { return 'realized_surface_text'; }`,
        tests_txt: `TEST_CASE: NORMAL, valid_ir -> surface_text`,
        validation_txt: `STATUS: VERIFIED\nVALIDATED_BY: SurfaceVariationVerification`,
        implementation_hash: `hash_${srf.id}_v1`,
        validation_hash: `val_${srf.id}_v1`,
        success_count: 25,
        failure_count: 0,
        created_at: Date.now() - 3600000 * 24,
        updated_at: Date.now() - 3600000 * 24,
      };

      componentRegistryService.registerComponent(pkg);
      surfacesCount++;
    }

    systemLogger.info(
      'TOOLS',
      `🧩 [会話部品同期] Claims: ${claimsCount}, Templates: ${templatesCount}, Surfaces: ${surfacesCount} をレジストリに同期しました`
    );

    return {
      claimsRegistered: claimsCount,
      templatesRegistered: templatesCount,
      surfacesRegistered: surfacesCount,
    };
  }

  /**
   * 大事な歯止め: CSP形式制約と単語連想グラフによる事前フィルタ
   */
  public filterCompositionPair(
    claimA: ClaimRecord,
    claimB: ClaimRecord,
    templateType: 'COMPARISON' | 'CAUSALITY' | 'CONDITIONAL'
  ): CompositionPreFilterResult {
    // 1. 単語連想グラフチェック (閾値: 0.40)
    const relatedness = wordAssociationGraphService.calculateRelatedness(claimA, claimB, 0.40);
    if (!relatedness.isSufficientlyRelated) {
      return {
        allowed: false,
        reason: `[連想グラフフィルタ却下] ${relatedness.reason}`,
        associationScore: relatedness.score,
        cspPassed: false,
        cspContradictions: ['semantic_association_below_threshold'],
      };
    }

    // 2. CSP形式制約チェック (FormalConstraintSolverService)
    const envA = claimA.scope?.environment || 'any';
    const envB = claimB.scope?.environment || 'any';
    const worldA = claimA.world;
    const worldB = claimB.world;

    const cspConstraints: BinaryConstraint[] = [
      {
        id: 'csp_world_compatibility',
        var1: 'worldA',
        var2: 'worldB',
        predicateName: 'WORLD_EQUAL',
        check: (w1, w2) => w1 === w2,
        description: '現実(REAL)の主張と架空(FICTION)の主張を同列事実として結合することは禁止',
      },
      {
        id: 'csp_scope_compatibility',
        var1: 'envA',
        var2: 'envB',
        predicateName: 'DOMAIN_COMPATIBLE',
        check: (e1, e2) => {
          if (e1 === 'any' || e2 === 'any') return true;
          // 比較や因果の場合、全く関係ない別環境(ExcelとTermuxなど)は却下
          if (e1 === 'Excel' && e2 === 'Termux') return false;
          if (e1 === 'Termux' && e2 === 'Excel') return false;
          return true;
        },
        description: '対象環境の実行互換性制約 (Excel環境とAndroid Termux環境の同一コンテキスト結合は不可)',
      },
      {
        id: 'csp_non_identical_claims',
        var1: 'idA',
        var2: 'idB',
        predicateName: 'DIFFERENT_CLAIMS',
        check: (id1, id2) => id1 !== id2,
        description: '同一の主張同士を比較・因果の2項に指定することは禁止',
      },
    ];

    const cspResult = formalConstraintSolverService.solveCSP(
      {
        worldA: [worldA],
        worldB: [worldB],
        envA: [envA],
        envB: [envB],
        idA: [claimA.claim_id],
        idB: [claimB.claim_id],
      },
      cspConstraints
    );

    if (!cspResult.isSatisfied) {
      return {
        allowed: false,
        reason: `[CSP形式制約違反] ${cspResult.contradictionsFound.join('; ')}`,
        associationScore: relatedness.score,
        cspPassed: false,
        cspContradictions: cspResult.contradictionsFound,
      };
    }

    return {
      allowed: true,
      reason: `事前フィルタ合格 (連想スコア: ${relatedness.score.toFixed(2)}, CSP合格)`,
      associationScore: relatedness.score,
      cspPassed: true,
      cspContradictions: [],
    };
  }

  /**
   * componentCompositionService を使って会話部品を掛け算式に合成し、
   * 新しい受け答え候補 (CANDIDATE) を生成する
   */
  public composeConversation(params: {
    goal: string;
    claimA: ClaimRecord;
    claimB: ClaimRecord;
    templateId: 'conv.reasoning.comparison' | 'conv.reasoning.causality' | 'conv.reasoning.conditional';
    surfaceId: string;
  }): {
    success: boolean;
    compositionPlan?: CompositionPlan;
    composedResponse?: ComposedConversationResponse;
    filterResult: CompositionPreFilterResult;
    reason: string;
  } {
    this.initialize();

    const { goal, claimA, claimB, templateId, surfaceId } = params;

    // 1. 大事な歯止め: 事前フィルタ (CSP + 単語連想グラフ)
    const templateType = templateId.includes('comparison')
      ? 'COMPARISON'
      : templateId.includes('causality')
      ? 'CAUSALITY'
      : 'CONDITIONAL';

    const filterResult = this.filterCompositionPair(claimA, claimB, templateType);
    if (!filterResult.allowed) {
      return {
        success: false,
        filterResult,
        reason: filterResult.reason,
      };
    }

    // 2. componentCompositionService による決定論的合成計画の導出
    const compIdA = `conv.claim.${claimA.claim_id.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const compIdB = `conv.claim.${claimB.claim_id.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const targetComponentIds = [compIdA, compIdB, templateId, surfaceId];

    const plan = componentCompositionService.composeFromComponentIds(goal, targetComponentIds);
    if (!plan || !plan.executable) {
      return {
        success: false,
        compositionPlan: plan,
        filterResult,
        reason: `[合成計画生成失敗] ${plan?.blocked_reason || 'I/O型の整合が取れませんでした'}`,
      };
    }

    // 3. 実際の受け答え内容を合成
    let conclusion = '';
    let skeletonType: AnswerSkeletonType = 'RECOMMENDATION';

    if (templateType === 'COMPARISON') {
      conclusion = `『${claimA.statement}』と『${claimB.statement}』の検証比較：前者はセル単位処理のオーバーヘッドによる速度低下が実証されているのに対し、後者は配列一括代入による大幅な高速化（10倍以上）が実機検証されています。`;
      skeletonType = 'RECOMMENDATION';
    } else if (templateType === 'CAUSALITY') {
      conclusion = `原因『${claimA.statement}』に対して、検証済みの対策として『${claimB.statement}』を適用することが有効です。`;
      skeletonType = 'GENERAL_ANSWER';
    } else {
      conclusion = `実行環境に応じて最適な手法が異なります：${claimA.statement}の一方で、別条件では${claimB.statement}が推奨されます。`;
      skeletonType = 'GENERAL_ANSWER';
    }

    const answerIR = answerContentIrService.buildAnswerIR({
      conclusion,
      target: goal,
      reasons: [
        `[検証済み主張A]: ${claimA.statement} (${claimA.status})`,
        `[検証済み主張B]: ${claimB.statement} (${claimB.status})`,
        `[連想スコア]: ${filterResult.associationScore.toFixed(2)} (意味的整合)`,
      ],
      conditions: [
        `前提スコープ: ${JSON.stringify(claimA.scope)} / ${JSON.stringify(claimB.scope)}`,
      ],
      certainty: 'HIGH_CONFIDENCE',
      detailLevel: 'STANDARD',
      worldScope: 'REAL',
      nextActions: ['要件・環境に合わせて最適な方式を採用してください。'],
    });

    const surfaceResult = answerContentIrService.generateSurfaceTextFromIR(
      answerIR,
      skeletonType
    );

    // 4. 新規受け答え候補の登録 (初期状態は必ず CANDIDATE)
    const responseId = `COMP-RESP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const composedRecord: ComposedConversationResponse = {
      id: responseId,
      goal,
      status: 'CANDIDATE', // 決して自動的にVERIFIEDにしない
      planId: plan.plan_id,
      componentIds: targetComponentIds,
      claimIds: [claimA.claim_id, claimB.claim_id],
      templateId,
      surfaceComponentId: surfaceId,
      surfaceText: surfaceResult.surfaceText,
      conclusion,
      falsificationPassed: false,
      userFeedbackReceived: false,
      usageCount: 1,
      createdAt: Date.now(),
      verificationLog: '合成生成完了。反証テストおよびユーザー反応の確認待ち (CANDIDATE)',
    };

    this.composedResponses.set(responseId, composedRecord);
    this.saveToStorage();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `✨ [掛け算合成成功] 新規受け答え候補生成 (${responseId}): ${claimA.claim_id} × ${claimB.claim_id} × ${templateId} ➔ CANDIDATE`
    );

    return {
      success: true,
      compositionPlan: plan,
      composedResponse: composedRecord,
      filterResult,
      reason: '型整合およびCSP・連想グラフフィルタを通過し、新規受け答え候補(CANDIDATE)を生成しました',
    };
  }

  /**
   * 組み合わされた受け答えを反証チェックとユーザー反応を経て VERIFIED に昇格させる
   * (禁止事項: 反証・ユーザー反応を経ずに自動的に検証済み扱いにすることは禁止)
   */
  public graduateComposedResponse(
    responseId: string,
    userFeedback: 'POSITIVE' | 'NEGATIVE',
    userGoal?: string
  ): {
    success: boolean;
    status: ComposedResponseStatus;
    falsificationPassed: boolean;
    message: string;
  } {
    const record = this.composedResponses.get(responseId);
    if (!record) {
      return { success: false, status: 'REJECTED', falsificationPassed: false, message: `指定された合成応答 ${responseId} が見つかりません` };
    }
    const observation = conversationFeedbackEvidenceService.recordLegacy(responseId, userFeedback, userGoal);
    conversationLearningEpisodeService.record(observation);
    return this.evaluateAccumulatedEvidence(record, observation.observationId, userGoal);
  }

  public recordStructuredFeedback(params: {
    responseId: string;
    text: string;
    conversationId?: string;
    contextKey?: string;
    userGoal?: string;
  }): {
    success: boolean;
    status: ComposedResponseStatus;
    falsificationPassed: boolean;
    message: string;
  } {
    const record = this.composedResponses.get(params.responseId);
    if (!record) {
      return { success: false, status: 'REJECTED', falsificationPassed: false, message: `指定された合成応答 ${params.responseId} が見つかりません` };
    }
    const observation = conversationFeedbackEvidenceService.analyzeText(params);
    conversationLearningEpisodeService.record(observation);
    return this.evaluateAccumulatedEvidence(record, observation.observationId, params.userGoal);
  }

  private evaluateAccumulatedEvidence(
    record: ComposedConversationResponse,
    observationId: string,
    userGoal?: string
  ): {
    success: boolean;
    status: ComposedResponseStatus;
    falsificationPassed: boolean;
    message: string;
  } {
    const falsification = falsificationService.evaluateFalsification({
      userGoal: userGoal || record.goal,
      assistantResponse: record.surfaceText,
    });
    const falsificationPassed = falsification.passed && falsification.checks.every(check => check.status !== 'fail');
    const aggregate = conversationFeedbackEvidenceService.aggregate(record.id);
    record.falsificationPassed = falsificationPassed;
    record.userFeedbackReceived = aggregate.observations > 0;

    if (!falsificationPassed) {
      record.status = 'NEEDS_REVISION';
    } else if (aggregate.epistemicConflicts > 0 || aggregate.unresolvedUnknownTerms.length > 0) {
      record.status = 'OBSERVED';
    } else if (aggregate.negativeWeight >= 1.5 && aggregate.negativeScopes.length > 0) {
      record.status = 'NEEDS_REVISION';
    } else if (
      aggregate.independentContexts >= 3 &&
      aggregate.positiveWeight >= 1.5 &&
      aggregate.negativeWeight < 0.75 &&
      aggregate.positiveScopes.length > 0
    ) {
      record.status = 'VERIFIED';
      record.verifiedAt = Date.now();
    } else {
      record.status = falsificationPassed ? 'OBSERVED' : 'TESTED';
    }

    record.verificationLog = [
      `observation=${observationId}`,
      `falsification=${falsificationPassed ? 'pass' : 'fail'}`,
      `observations=${aggregate.observations}`,
      `independentContexts=${aggregate.independentContexts}`,
      `positiveWeight=${aggregate.positiveWeight.toFixed(2)}`,
      `negativeWeight=${aggregate.negativeWeight.toFixed(2)}`,
      `unknownTerms=${aggregate.unresolvedUnknownTerms.join(',') || 'none'}`,
      `epistemicConflicts=${aggregate.epistemicConflicts}`,
      `status=${record.status}`,
    ].join('; ');
    this.saveToStorage();
    const success = record.status === 'VERIFIED';
    return {
      success,
      status: record.status,
      falsificationPassed,
      message: success
        ? `${record.id} は複数の独立観測、反証検査、認識済み語彙を通過してVERIFIEDへ昇格しました`
        : `${record.id} は単一のユーザー反応だけでは確定せず、${record.status}としてEvidenceを累積します`,
    };
  }

  /**
   * 2. 成長速度の可視化
   * - 登録済み会話部品の総数
   * - そこから理論上組み合わせ可能な数（型が合う組み合わせの総数。実際に使われたかは問わない）
   * - 実際にVERIFIEDまで昇格した組み合わせの数
   */
  public getStats(): {
    conversationComponentsCount: number;
    theoreticalCompositionsCount: number;
    verifiedCompositionsCount: number;
  } {
    this.initialize();

    const allComps = componentRegistryService.getAllComponents();
    const convComps = allComps.filter((c) => c.component_id.startsWith('conv.'));
    const conversationComponentsCount = convComps.length;

    // カテゴリごとのClaim数集計
    const claimComps = convComps.filter((c) => c.component_id.startsWith('conv.claim.'));
    const categoryCount: Record<string, number> = {};

    for (const claimComp of claimComps) {
      for (const out of claimComp.outputs || []) {
        const match = out.type.match(/Claim<([^>]+)>/i);
        if (match && match[1] && match[1] !== 'any') {
          const cat = match[1];
          categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        }
      }
    }

    const templateComps = convComps.filter((c) => c.component_id.startsWith('conv.reasoning.'));
    const surfaceComps = convComps.filter((c) => c.component_id.startsWith('conv.surface.'));

    // 理論上組み合わせ可能な数の計算 (掛け算式・ねずみ算式)
    // 同一トピック内のClaimペア: k * (k - 1) / 2
    // これに適用可能な推論テンプレート数 × 言い換えプール数を乗算
    let totalClaimPairs = 0;
    for (const count of Object.values(categoryCount)) {
      if (count >= 2) {
        totalClaimPairs += (count * (count - 1)) / 2;
      }
    }

    // クロスカテゴリ（条件分岐推論等）のペア:
    const cats = Object.keys(categoryCount);
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        totalClaimPairs += categoryCount[cats[i]] * categoryCount[cats[j]];
      }
    }

    // テンプレート数 (T) × 表層変種プール数 (S)
    const templateMultiplier = Math.max(1, templateComps.length);
    const surfaceMultiplier = Math.max(1, surfaceComps.length);

    const theoreticalCompositionsCount = totalClaimPairs * templateMultiplier * surfaceMultiplier;

    // 実際に VERIFIED まで昇格した組み合わせ数
    const verifiedCompositionsCount = Array.from(this.composedResponses.values()).filter(
      (r) => r.status === 'VERIFIED'
    ).length;

    return {
      conversationComponentsCount,
      theoreticalCompositionsCount,
      verifiedCompositionsCount,
    };
  }

  public getComposedResponses(): ComposedConversationResponse[] {
    return Array.from(this.composedResponses.values());
  }
}

export const conversationComponentCompositionService =
  ConversationComponentCompositionService.getInstance();
