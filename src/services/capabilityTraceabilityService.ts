/**
 * 仕様書と実能力のトレーサビリティ可視化サービス (優先度C - 3.4)
 *
 * 仕様書170章の各項目と、実際に処理で使われている
 * keyword → capabilityId → rule → responseSkeleton
 * という経路の対応表を保持し、「仕様書の量」と「実際に効いている能力」の差を可視化する。
 */

import { FULL_SPECIFICATION_REGISTRY } from '../data/specificationRegistryData';
import { capabilityGapService } from './capabilityGapService';
import { answerPlanService } from './answerPlanService';
import { autonomousEvolutionService } from './autonomousEvolutionService';

export interface TraceabilityMappingEntry {
  chapterNumber: number;
  chapterTitle: string;
  keywords: string[];
  capabilityId?: string;
  heuristicRuleId?: string;
  responseSkeletonId?: string;
  executionLayer: 'NON_LLM_CORE_ROUTING' | 'GUARDRAIL_INVARIANT' | 'AUTONOMOUS_CYCLE' | 'SPECIFICATION_ONLY';
  isActiveInRuntime: boolean;
  actualImpactSummary: string;
  evidenceCount?: number;
}

export interface TraceabilitySummaryReport {
  totalSpecChapters: number;
  activeRuntimeChapters: number;
  specOnlyChapters: number;
  runtimeCoveragePercent: number;
  keyActivePipelines: TraceabilityMappingEntry[];
  unmappedSpecHighlights: { chapterNumber: number; title: string; note: string }[];
}

// 主要章と実ルーティング経路の確固たる対応表定義
export const CORE_TRACEABILITY_MAPPINGS: TraceabilityMappingEntry[] = [
  {
    chapterNumber: 9,
    chapterTitle: '回答骨格と思考節約 (Response Skeleton & Budgeting)',
    keywords: ['訂正', '前提が違う', 'そうじゃなくて', '変わっ', '間違い'],
    capabilityId: 'cap_correction',
    responseSkeletonId: 'PATTERN-CORRECTION-01',
    executionLayer: 'NON_LLM_CORE_ROUTING',
    isActiveInRuntime: true,
    actualImpactSummary: 'answerPlanService.matchSkeleton()経由でNon-LLM Coreが最優先適用。訂正認識・旧前提無効化を即座に遂行。',
  },
  {
    chapterNumber: 20,
    chapterTitle: '対策の汎化不足と骨格変種 (Generalization Gap & Variations)',
    keywords: ['例外', '除外', '優先', 'フラグ', '三重', '優先順位'],
    capabilityId: 'cap_logical_priority',
    responseSkeletonId: 'PATTERN-LOGICAL-PRIORITY-01',
    executionLayer: 'NON_LLM_CORE_ROUTING',
    isActiveInRuntime: true,
    actualImpactSummary: '決定表フラット化・最上位除外フラグ優先判定により、多重例外時の優先順位逆転を抑制。',
  },
  {
    chapterNumber: 21,
    chapterTitle: '能力の習得状態と飽和判定 (Capability Mastery Profiles)',
    keywords: ['直接', '結論', '要点', '一言で'],
    capabilityId: 'cap_direct_answer',
    responseSkeletonId: 'PATTERN-DIRECT-SHORT-01',
    executionLayer: 'NON_LLM_CORE_ROUTING',
    isActiveInRuntime: true,
    actualImpactSummary: 'capabilityGapServiceにてSATURATED状態を監視。結論先行での思考浪費回避を実行。',
  },
  {
    chapterNumber: 17,
    chapterTitle: '送信境界プライバシーガードレール (Privacy Guardrails)',
    keywords: ['sk-', 'api_key', 'token', 'パスワード', '機密', '@example.com'],
    capabilityId: 'cap_privacy_boundary',
    executionLayer: 'GUARDRAIL_INVARIANT',
    isActiveInRuntime: true,
    actualImpactSummary: 'formalConstraintSolverService(CSP)およびprivacyGuardrailServiceにより外部送信を決定論的遮断。',
  },
  {
    chapterNumber: 25,
    chapterTitle: '安全・品質境界と要確認キュー (Safety & Review Queue)',
    keywords: ['TRPG', 'ロールプレイ', 'フィクション', '設定上'],
    capabilityId: 'cap_safety_review',
    executionLayer: 'GUARDRAIL_INVARIANT',
    isActiveInRuntime: true,
    actualImpactSummary: 'selfImprovementService.checkSampleSafety()のneedsReview判定により、フィクション文脈をreviewQueueへ自動保留。',
  },
  {
    chapterNumber: 27,
    chapterTitle: 'エピソード知恵蒸留と卒業試験 (Heuristic Rules & Graduation)',
    keywords: ['Option Explicit', 'On Error GoTo', 'Select', 'VBA'],
    capabilityId: 'cap_code_comprehension',
    heuristicRuleId: 'rule_vba_best_practices',
    executionLayer: 'AUTONOMOUS_CYCLE',
    isActiveInRuntime: true,
    actualImpactSummary: 'autonomousEvolutionService.distillHeuristicRules()にてエピソード記憶から恒久知恵を蒸留、graduationStatus管理。',
  },
  {
    chapterNumber: 28,
    chapterTitle: '親友ペルソナ・ユーザーコミュニケーション維持',
    keywords: ['タメ口', '親友', 'みき', '自然な会話'],
    capabilityId: 'cap_friendly_persona',
    heuristicRuleId: 'rule_friendly_tone',
    executionLayer: 'NON_LLM_CORE_ROUTING',
    isActiveInRuntime: true,
    actualImpactSummary: 'ロボット的敬語(承知いたしました等)を排除し、親愛度・自然なタメ口方針を維持。',
  },
  {
    chapterNumber: 29,
    chapterTitle: '自己改善コントロールプレーンと安全変更契約 (Self-Code Architect)',
    keywords: ['self_code', 'change_contract', 'rollback', 'audit'],
    capabilityId: 'cap_self_code_architecture',
    executionLayer: 'GUARDRAIL_INVARIANT',
    isActiveInRuntime: true,
    actualImpactSummary: 'ChangeContractによるファイル制限、ロールバック手順、不変条件検査の実走を統括。',
  },
  {
    chapterNumber: 30,
    chapterTitle: '不変条件エンジン (Invariant Engine & Anchor Protection)',
    keywords: ['INV_01_ANCHOR_ASSET_PROTECTION', 'INV_02_PRIVACY_BOUNDARY'],
    capabilityId: 'cap_invariant_engine',
    executionLayer: 'GUARDRAIL_INVARIANT',
    isActiveInRuntime: true,
    actualImpactSummary: '互換/検証用アンカー資産保護、模擬機密遮断、ロールバック保証を毎サイクル自動検証。',
  },
  {
    chapterNumber: 36,
    chapterTitle: '反実仮想反省推論 (Counterfactual Reflection)',
    keywords: ['predictionError', 'counterfactual', 'rootCause'],
    capabilityId: 'cap_counterfactual_reflection',
    executionLayer: 'AUTONOMOUS_CYCLE',
    isActiveInRuntime: true,
    actualImpactSummary: 'worldModelServiceの予測誤差から理想応答を決定論的検証し、verifiedEffectiveフラグ付きで学習データへ接続。',
  },
  {
    chapterNumber: 37,
    chapterTitle: '外部教師パイプラインと中立的検証 (External Teacher Verification)',
    keywords: ['external_teacher', 'teacherRequest', 'independent_verification'],
    capabilityId: 'cap_external_teacher_verification',
    executionLayer: 'NON_LLM_CORE_ROUTING',
    isActiveInRuntime: true,
    actualImpactSummary: '外部教師の教材は自動マージせず、approved: falseおよびsource: external_teacher_proposedとして中立待機。',
  },
];

export class CapabilityTraceabilityService {
  public generateTraceabilityReport(): TraceabilitySummaryReport {
    const totalSpecChapters = FULL_SPECIFICATION_REGISTRY.length;
    const activeMappings = CORE_TRACEABILITY_MAPPINGS.filter((m) => m.isActiveInRuntime);
    const activeRuntimeChapters = activeMappings.length;
    const specOnlyChapters = totalSpecChapters - activeRuntimeChapters;
    const runtimeCoveragePercent = Math.round((activeRuntimeChapters / totalSpecChapters) * 100);

    const mappedChapterNums = new Set(CORE_TRACEABILITY_MAPPINGS.map((m) => m.chapterNumber));
    const unmappedSpecHighlights = FULL_SPECIFICATION_REGISTRY
      .filter((c) => !mappedChapterNums.has(c.chapterNumber))
      .slice(0, 15)
      .map((c) => ({
        chapterNumber: c.chapterNumber,
        title: c.title,
        note: `仕様書の概念としては定義済み（ステータス: ${c.status}）だが、端末内Non-LLM Coreの常時keywordルーティングテーブルへの直接配備は未完了。`,
      }));

    return {
      totalSpecChapters,
      activeRuntimeChapters,
      specOnlyChapters,
      runtimeCoveragePercent,
      keyActivePipelines: CORE_TRACEABILITY_MAPPINGS,
      unmappedSpecHighlights,
    };
  }
}

export const capabilityTraceabilityService = new CapabilityTraceabilityService();
