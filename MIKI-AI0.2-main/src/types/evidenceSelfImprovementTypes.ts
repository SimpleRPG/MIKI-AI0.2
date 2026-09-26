/**
 * Evidence-Based Self-Improvement Types
 */

export type ChangeSetID = string;

export interface StructuredDirective {
  directiveId: string;
  title: string;
  rawText: string;
  goal: string;
  targets: string[];
  requirements: string[];
  forbiddenBehaviors: string[];
  forbiddenItems?: string[];
  completionCriteria: string[];
  acceptanceCriteria?: string[];
  parsedAt: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  executionChangeSetId?: string;
  resultSummary?: string;
}

export interface RequirementContract {
  contractId: string;
  requirementId: string;
  title: string;
  sourceDirectiveId?: string;
  acceptanceCriteria: string[];
  requiredBehaviors: string[];
  forbiddenBehaviors: string[];
  observableMetrics: string[];
  verdict: 'UNTESTED' | 'PASSED' | 'FAILED' | 'SATISFIED' | 'PARTIALLY_MET' | 'VIOLATED';
  [key: string]: any;
}

export type AdoptionState = 'CANDIDATE' | 'STAGED' | 'ADOPTED' | 'VERIFIED' | 'REJECTED' | 'ROLLED_BACK';
export type DeploymentLifecycleState = 'SANDBOX' | 'CANARY' | 'PRODUCTION' | 'QUARANTINE' | 'STABLE' | 'LOCAL_PATCH' | 'COMMITTED';

export type SelfImprovementFailureCategory =
  | 'SYNTAX_ERROR'
  | 'TYPE_ERROR'
  | 'LOGIC_FAILURE'
  | 'COUNTEREXAMPLE_FOUND'
  | 'REGRESSION_DETECTED'
  | 'RESOURCE_EXHAUSTED'
  | 'SECURITY_VIOLATION'
  | 'GENERALIZATION_FAILED'
  | 'CAUSALITY_UNPROVEN'
  | 'UNKNOWN'
  | 'requirement_misread'
  | 'safety_rejection'
  | 'regression'
  | 'test_gap'
  | 'wrong_algorithm'
  | 'wrong_architecture'
  | 'performance_tradeoff'
  | 'dependency_problem'
  | 'environment_mismatch'
  | 'missing_knowledge';

export type NoChangeReasonCategory =
  | 'NO_BETTER_PROPOSAL'
  | 'COUNTEREXAMPLE_BLOCKED'
  | 'REGRESSION_RISK'
  | 'SPECIFICATION_SATISFIED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'SYSTEM_STABLE' | 'RISK_EXCEEDS_BENEFIT';

export interface NoChangeDecision {
  decisionId?: string;
  timestamp: number;
  reason?: string;
  category: NoChangeReasonCategory;
  checkedProposals?: string[];
  metricsSnapshot?: Record<string, any>;
  changeSetId?: ChangeSetID;
  rationale?: string;
  target?: string;
  targetFile?: string;
  riskComparison?: string;
  consideredAlternatives?: string[];
  evaluatedMetrics?: Record<string, any>;
}

export interface CounterexampleFinding {
  testType?: string;
  inputSample?: any;
  expectedBehavior?: any;
  actualOutcome?: any;
  passed?: boolean;
  input?: any;
  expected?: any;
  actual?: any;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  description?: string;
}

export interface CounterexampleGateResult {
  passed: boolean;
  findings: CounterexampleFinding[];
  testedCount?: number;
  failureCount?: number;
  passRate?: number;
  testsPassed?: number;
  testsExecuted?: number;
  scenarios?: Array<Record<string, any>>;
  summary?: string;
  checkedCount?: number;
  durationMs?: number;
}

export interface GeneralizationGateResult {
  passed: boolean;
  testedScenarios?: Array<Record<string, any>>;
  generalizationScore?: number;
  verdict?: 'PASSED' | 'FAILED';
  summary?: string;
  syntheticCasesChecked?: number;
  passRate?: number;
  unseenDomainPass?: boolean;
}

export interface CausalExperimentResult {
  changeSetId?: ChangeSetID;
  isCausal: boolean;
  baselineTrials?: number[];
  interventionTrials?: number[];
  baselineMean?: number;
  interventionMean?: number;
  observedDelta?: number;
  averageScoreDelta?: number;
  confoundingFactorsChecked?: string[];
  confidence: number;
  reason?: string;
  conclusion?: string;
  baselineScore?: number;
  interventionScore?: number;
  effectSize?: number;
  pValue?: number;
}

export interface StopPolicyCheckResult {
  shouldStop: boolean;
  trigger: string;
  reason?: string;
  diminishingReturnsDetected?: boolean;
}

export interface ImplementationEvidence {
  evidenceId: string;
  changeSetId: ChangeSetID;
  timestamp: number;
  contractsEvaluated?: string[];
  unitTestResults?: { total: number; passed: number; failed: number };
  counterexampleGate?: CounterexampleGateResult;
  generalizationGate?: GeneralizationGateResult;
  causalExperiment?: CausalExperimentResult;
  adoptionState: AdoptionState;
  lifecycleState?: DeploymentLifecycleState;
  [key: string]: any;
}

export interface SelfImprovementStrategy {
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
  id?: string;
  name?: string;
  successRate?: number;
  attemptsCount?: number;
  [key: string]: any;
}

export type ImprovementStrategyRecord = SelfImprovementStrategy;

export interface LearningUsageEvidence {
  evidenceId?: string;
  strategyId?: string;
  learningId: string;
  learningType: string;
  invokedAt?: number;
  result?: 'SUCCESS' | 'FAILURE';
  feedbackScore?: number;
  retrievalCount: number;
  selectedCount: number;
  appliedCount: number;
  lastUsedCaseId?: string;
  lastUsedTimestamp?: number;
  status: 'USED' | 'FREQUENTLY_USED' | 'LEARNED_BUT_NEVER_USED' | string;
}
