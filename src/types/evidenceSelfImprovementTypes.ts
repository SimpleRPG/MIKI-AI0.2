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
}

export interface RequirementContract {
  contractId: string;
  requirementId: string;
  title: string;
  sourceDirectiveId: string;
  acceptanceCriteria: string[];
  requiredBehaviors: string[];
  forbiddenBehaviors: string[];
  observableMetrics: string[];
  verdict: 'UNTESTED' | 'PASSED' | 'FAILED';
  [key: string]: any;
}

export type AdoptionState = 'CANDIDATE' | 'STAGED' | 'ADOPTED' | 'REJECTED' | 'ROLLED_BACK';
export type DeploymentLifecycleState = 'SANDBOX' | 'CANARY' | 'PRODUCTION' | 'QUARANTINE';

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
  | 'UNKNOWN';

export type NoChangeReasonCategory =
  | 'NO_BETTER_PROPOSAL'
  | 'COUNTEREXAMPLE_BLOCKED'
  | 'REGRESSION_RISK'
  | 'SPECIFICATION_SATISFIED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'SYSTEM_STABLE';

export interface NoChangeDecision {
  decisionId: string;
  timestamp: number;
  reason: string;
  category: NoChangeReasonCategory;
  checkedProposals?: string[];
  metricsSnapshot?: Record<string, any>;
}

export interface CounterexampleFinding {
  input: any;
  expected: any;
  actual: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface CounterexampleGateResult {
  passed: boolean;
  checkedCount: number;
  findings: CounterexampleFinding[];
  durationMs?: number;
}

export interface GeneralizationGateResult {
  passed: boolean;
  syntheticCasesChecked: number;
  passRate: number;
  unseenDomainPass: boolean;
}

export interface CausalExperimentResult {
  isCausal: boolean;
  baselineScore: number;
  interventionScore: number;
  effectSize: number;
  pValue?: number;
  confidence: number;
}

export interface StopPolicyCheckResult {
  shouldStop: boolean;
  reason?: string;
  diminishingReturnsDetected?: boolean;
}

export interface ImplementationEvidence {
  evidenceId: string;
  changeSetId: ChangeSetID;
  timestamp: number;
  contractsEvaluated: string[];
  unitTestResults?: { total: number; passed: number; failed: number };
  counterexampleGate?: CounterexampleGateResult;
  generalizationGate?: GeneralizationGateResult;
  causalExperiment?: CausalExperimentResult;
  adoptionState: AdoptionState;
  lifecycleState: DeploymentLifecycleState;
  [key: string]: any;
}

export interface SelfImprovementStrategy {
  id: string;
  name: string;
  description: string;
  successRate: number;
  attemptsCount: number;
  [key: string]: any;
}

export type ImprovementStrategyRecord = SelfImprovementStrategy;

export interface LearningUsageEvidence {
  evidenceId: string;
  strategyId: string;
  invokedAt: number;
  result: 'SUCCESS' | 'FAILURE';
  feedbackScore?: number;
}
