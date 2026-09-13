/**
 * 証拠付き自己改善ループ (Evidence-Based Self-Improvement Loop) 型定義
 * MIKI-AI 非LLM化 作業指示書 v24 に準拠
 */

// 1. ChangeSetID: Experiment・Snapshot・Patch・Test・Canary・Rollback・Git Commitを一意に追跡
export type ChangeSetID = string;

// 4. Failure Classification (10分類)
export type SelfImprovementFailureCategory =
  | 'requirement_misread'       // 要求誤読
  | 'missing_knowledge'         // 知識不足
  | 'wrong_architecture'        // アーキテクチャ誤り
  | 'wrong_algorithm'           // アルゴリズム誤り
  | 'dependency_problem'        // 依存関係・モジュール不整合
  | 'test_gap'                  // テスト不足・テスト欠陥
  | 'environment_mismatch'      // 環境差異 (Android/Browser/Node等)
  | 'regression'                // 回帰・デグレ
  | 'performance_tradeoff'      // 性能劣化・タイムアウト
  | 'safety_rejection';         // 安全ポリシー・禁止事項抵触

// 13. Git State と Adoption State の分離
export type AdoptionState = 'DRAFT' | 'STAGED' | 'VERIFIED' | 'ADOPTED' | 'REJECTED';
export type DeploymentLifecycleState = 'LOCAL_PATCH' | 'COMMITTED' | 'DEPLOYED' | 'CANARY_PASS' | 'STABLE' | 'ROLLED_BACK';

// 10. No-Change Decision (変更しない判断の理由分類)
export type NoChangeReasonCategory =
  | 'ENVIRONMENTAL_CAUSE'
  | 'AMBIGUOUS_REQUIREMENT'
  | 'EXISTING_IMPLEMENTATION_SUFFICIENT'
  | 'RISK_EXCEEDS_BENEFIT'
  | 'INSUFFICIENT_EVIDENCE';

export interface NoChangeDecision {
  changeSetId: ChangeSetID;
  category: NoChangeReasonCategory;
  rationale: string;
  target: string;
  targetFile?: string;
  reason?: string;
  riskComparison?: string;
  consideredAlternatives: string[];
  timestamp: number;
  evaluatedMetrics?: Record<string, any>;
}

// 7. Mandatory Counterexample Gate (反例探索結果)
export interface CounterexampleFinding {
  testType: 'boundary' | 'abnormal_input' | 'dependency_failure' | 'env_difference' | 'race_condition';
  inputSample: string;
  expectedBehavior: string;
  actualOutcome: string;
  passed: boolean;
  notes?: string;
}

export interface CounterexampleGateResult {
  passed: boolean;
  findings: CounterexampleFinding[];
  testedCount: number;
  failureCount: number;
  summary: string;
  passRate?: number;
  testsPassed?: number;
  testsExecuted?: number;
  scenarios?: { category: string }[];
}

// 8. Generalization Gate (汎化ゲート結果)
export interface GeneralizationGateResult {
  passed: boolean;
  testedScenarios: {
    scenarioName: string;
    context: string;
    passed: boolean;
  }[];
  generalizationScore: number; // 0 - 100
  summary: string;
  verdict?: string;
}

// 6. Causal Improvement Experiment (因果性改善判定)
export interface CausalExperimentResult {
  changeSetId: ChangeSetID;
  isCausal: boolean; // 改善がコード変更によるものか
  baselineTrials: number[];
  interventionTrials: number[];
  baselineMean: number;
  interventionMean: number;
  observedDelta: number;
  averageScoreDelta?: number;
  conclusion?: string;
  confoundingFactorsChecked: string[];
  confidence: number; // 0.0 - 1.0
  reason: string;
}

// 3. Implementation Evidence (1つの証拠オブジェクトに集約)
export interface ImplementationEvidence {
  evidenceId: string;
  changeSetId: ChangeSetID;
  requirementId: string;
  targetFile: string;
  beforeHash: string;
  afterHash: string;
  beforeImplementationHash?: string;
  afterImplementationHash?: string;
  targetSymbols?: string[];
  linesAdded?: number;
  changedSymbols: string[];
  linesCount: number;
  testResults: {
    syntaxPassed: boolean;
    unitTestsPassed: boolean;
    unitTestsDetails?: string;
    mutationKillRate?: number;
    counterexampleResult?: CounterexampleGateResult;
    generalizationResult?: GeneralizationGateResult;
  };
  testsExecuted?: Array<{
    testId: string;
    testType: string;
    targetComponent: string;
    passed: boolean;
    executionDurationMs: number;
    message: string;
  }>;
  counterexampleGate?: CounterexampleGateResult;
  generalizationGate?: GeneralizationGateResult;
  causalExperiment?: CausalExperimentResult;
  causalResult?: CausalExperimentResult;
  canaryResult?: {
    passed: boolean;
    observationMs: number;
    errorCount: number;
  };
  downstreamImpact: {
    affectedModules: string[];
    breakingChangesDetected: boolean;
  };
  invariantsMaintained?: boolean;
  adoptionState: AdoptionState;
  deploymentState: DeploymentLifecycleState;
  finalVerdict: 'ADOPT' | 'HOLD' | 'REJECT';
  failureCategory?: SelfImprovementFailureCategory;
  createdAt: number;
  timestamp?: number;
}

// 2. Requirement Contract (要求契約)
export interface RequirementContract {
  contractId: string;
  requirementId: string;
  title: string;
  sourceDirectiveId?: string;
  acceptanceCriteria: string[];     // 受入基準
  requiredBehaviors: string[];      // 必須挙動
  forbiddenBehaviors: string[];     // 禁止挙動
  observableMetrics: string[];      // 観測可能指標
  evidence?: ImplementationEvidence;
  verdict: 'SATISFIED' | 'PARTIALLY_MET' | 'VIOLATED' | 'UNTESTED';
  verdictReason?: string;
  evaluatedAt?: number;
}

// 5. Self-Improvement Strategy Memory (どう直すか戦略)
export interface ImprovementStrategyRecord {
  strategyId: string;
  strategyName: string;
  description: string;
  targetDomain: string;
  applicableConditions: string[];
  successCount: number;
  failureCount: number;
  knownSideEffects: string[];
  lastUsedAt: number;
  useCount: number;
  retrievalCount: number;
  selectedCount: number;
  effectivenessScore?: number;
}

export type SelfImprovementStrategy = ImprovementStrategyRecord;

// 9. Learning Usage Evidence (学習教訓・戦略の使用追跡)
export interface LearningUsageEvidence {
  learningId: string;
  learningType: 'STRATEGY' | 'LESSON' | 'COUNTEREXAMPLE_RULE';
  retrievalCount: number;
  selectedCount: number;
  appliedCount: number;
  lastUsedCaseId?: string;
  lastUsedTimestamp?: number;
  status: 'FREQUENTLY_USED' | 'USED' | 'LEARNED_BUT_NEVER_USED';
}

// 11. Stop Policy (自動停止理由)
export type StopPolicyTrigger =
  | 'NONE'
  | 'IMPROVEMENT_BELOW_THRESHOLD'
  | 'REGRESSION_DETECTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'REPEATED_FAILURE'
  | 'COUNTEREXAMPLE_UNRESOLVED'
  | 'EXCESSIVE_RESOURCE_COST'
  | 'VERIFIED_CAPABILITY_IMPACT';

export interface StopPolicyCheckResult {
  shouldStop: boolean;
  trigger: StopPolicyTrigger;
  reason: string;
}

// ── 作業指示テキスト取り込み (Directive Ingestion) ──
export interface StructuredDirective {
  directiveId: string;
  title: string;
  rawText: string;
  goal: string;                      // 目的
  targets: string[];                 // 対象 (ファイル、章、モジュール)
  requirements: string[];            // 要求内容
  forbiddenBehaviors: string[];      // 禁止事項
  forbiddenItems?: string[];         // 互換エイリアス
  completionCriteria: string[];      // 完了条件
  acceptanceCriteria?: string[];     // 互換エイリアス
  parsedAt: number;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  executionChangeSetId?: ChangeSetID;
  resultSummary?: string;
  executionNote?: string;
}
