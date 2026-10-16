import { executionEventBusService, type ExecutionEvent } from '../../execution/services/executionEventBusService';
import { featureFlagsService } from '../../safety/services/featureFlagsService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';

export type CounterfactualMetric = 'safety' | 'accuracy' | 'performance';
export type CounterfactualMeasurementStatus = 'NOT_EXECUTED' | 'REJECTED' | 'MEASURED';
export type CounterfactualSimulationMeasurementStatus =
  | 'NOT_EXECUTED'
  | 'VALIDATION_BLOCKED'
  | 'PARTIALLY_MEASURED'
  | 'MEASURED';

export interface CounterfactualMeasurementEvidence {
  experimentId: string;
  scenarioId: string;
  factualEventIds: string[];
  alternativeEventIds: string[];
  independentReviewEventId: string;
}

export type CounterfactualExecutionTag =
  | {
      role: 'SAMPLE';
      experimentId: string;
      scenarioId: string;
      arm: 'FACTUAL' | 'ALTERNATIVE';
      metric: CounterfactualMetric;
    }
  | {
      role: 'INDEPENDENT_REVIEW';
      experimentId: string;
      scenarioId: string;
      reviewedEventIds: string[];
    };

export interface CounterfactualMeasuredMetrics {
  baselineSafetyPassRate: number;
  alternativeSafetyPassRate: number;
  baselineAccuracyPassRate: number;
  alternativeAccuracyPassRate: number;
  baselineMedianLatencyMs: number;
  alternativeMedianLatencyMs: number;
  performanceImprovementPercent: number;
  pairedSafetySamples: number;
  pairedAccuracySamples: number;
  pairedPerformanceSamples: number;
  independentReviewerId: string;
  independentReviewDecision: 'APPROVE' | 'REJECT';
  independentReviewEventId: string;
}

export interface CounterfactualPolicyEvaluation {
  scenarioId: string;
  scenarioName: string;
  factualOutcome: string;
  counterfactualOutcome: string;
  safetyScore: number;
  performanceScore: number;
  accuracyScore: number;
  overallDeltaScore: number;
  recommendation: 'ADOPT_COUNTERFACTUAL' | 'MAINTAIN_FACTUAL' | 'INCONCLUSIVE';
  reasoning: string;
  invariantsPassed: boolean;
  measurementStatus: CounterfactualMeasurementStatus;
  measurementEvidenceEventIds: string[];
  measurementRejectionReasons: string[];
  measuredMetrics?: CounterfactualMeasuredMetrics;
}

export interface CounterfactualScenarioInput {
  id: string;
  name: string;
  alternativeChoice: string;
  hypothesis: string;
}

interface MeasurementValidation {
  status: CounterfactualMeasurementStatus;
  reasons: string[];
  eventIds: string[];
  metrics?: CounterfactualMeasuredMetrics;
}

const MIN_PAIRED_TESTS_PER_METRIC = 3;
const MAX_EVENTS_PER_ARM = 90;
const VALID_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const CATEGORY_PATTERN: Record<CounterfactualMetric, RegExp> = {
  safety: /safety|security|privacy|invariant/i,
  accuracy: /accuracy|correctness|quality|assertion/i,
  performance: /performance|latency|throughput|response[_ -]?time/i,
};

function metadataText(event: ExecutionEvent, key: string): string {
  const value = event.metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function rejected(reason: string): MeasurementValidation {
  return { status: 'REJECTED', reasons: [reason], eventIds: [] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function validateCounterfactualRunnerTag(
  tag: CounterfactualExecutionTag | undefined,
  testCaseId: string,
  testCategory: string
): { allowed: boolean; tag?: CounterfactualExecutionTag; reason?: string } {
  if (!tag) return { allowed: true };

  if (!VALID_ID.test(tag.experimentId) || !VALID_ID.test(tag.scenarioId)) {
    return { allowed: false, reason: 'COUNTERFACTUAL_INVALID_EXPERIMENT_OR_SCENARIO_ID' };
  }

  if (tag.role === 'SAMPLE') {
    if (tag.arm !== 'FACTUAL' && tag.arm !== 'ALTERNATIVE') {
      return { allowed: false, reason: 'COUNTERFACTUAL_INVALID_ARM' };
    }
    if (!['safety', 'accuracy', 'performance'].includes(tag.metric)) {
      return { allowed: false, reason: 'COUNTERFACTUAL_INVALID_METRIC' };
    }
    if (!VALID_ID.test(testCaseId) || !CATEGORY_PATTERN[tag.metric].test(testCategory)) {
      return { allowed: false, reason: 'COUNTERFACTUAL_TEST_CATEGORY_OR_CASE_MISMATCH' };
    }
    return { allowed: true, tag: { ...tag } };
  }

  if (tag.role === 'INDEPENDENT_REVIEW') {
    const reviewed = Array.isArray(tag.reviewedEventIds) ? tag.reviewedEventIds : [];
    if (
      testCaseId !== tag.scenarioId ||
      testCategory.trim().toLowerCase() !== 'counterfactual_independent_review' ||
      reviewed.length < MIN_PAIRED_TESTS_PER_METRIC * 3 * 2 ||
      reviewed.length > MAX_EVENTS_PER_ARM * 2 ||
      reviewed.some(id => typeof id !== 'string' || !VALID_ID.test(id)) ||
      new Set(reviewed).size !== reviewed.length
    ) {
      return { allowed: false, reason: 'COUNTERFACTUAL_INDEPENDENT_REVIEW_REQUEST_INVALID' };
    }
    return {
      allowed: true,
      tag: { ...tag, reviewedEventIds: [...reviewed].sort() },
    };
  }

  return { allowed: false, reason: 'COUNTERFACTUAL_UNKNOWN_TAG_ROLE' };
}

export function counterfactualEventMetadata(
  tag: CounterfactualExecutionTag | undefined,
  reviewDecision?: 'APPROVE' | 'REJECT',
  reviewerId?: string
): Record<string, string | number | boolean> {
  if (!tag) return {};

  if (tag.role === 'SAMPLE') {
    return {
      counterfactual_role: 'SAMPLE',
      counterfactual_experiment_id: tag.experimentId,
      counterfactual_scenario_id: tag.scenarioId,
      counterfactual_arm: tag.arm,
      counterfactual_metric: tag.metric,
    };
  }

  return {
    counterfactual_role: 'INDEPENDENT_REVIEW',
    counterfactual_review_role: 'INDEPENDENT_REVIEW',
    counterfactual_experiment_id: tag.experimentId,
    counterfactual_scenario_id: tag.scenarioId,
    counterfactual_reviewed_event_ids: [...tag.reviewedEventIds].sort().join(','),
    counterfactual_review_decision: reviewDecision || '',
    counterfactual_reviewer_id: reviewerId || '',
  };
}

export function auditCounterfactualScenario(
  alternativeChoice: string,
  hypothesis: string
): { invariantsPassed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = `${alternativeChoice || ''} ${hypothesis || ''}`;

  const mutatesProtectedRuntime =
    /\b(?:delete|remove|disable|drop|unload|replace|strip|bypass)\b[\s\S]{0,64}\b(?:qwen|anchor|protected runtime|base model|model weights)\b/i.test(text) ||
    /\b(?:qwen|anchor|protected runtime|base model|model weights)\b[\s\S]{0,64}\b(?:delete|remove|disable|drop|unload|replace|strip|bypass)\b/i.test(text);

  const bypassesPrivacy =
    /\b(?:bypass|disable|skip|evade|turn off)\b[\s\S]{0,48}\bprivacy(?: guardrail| boundary| audit)?\b/i.test(text) ||
    /\bprivacy(?: guardrail| boundary| audit)?\b[\s\S]{0,48}\b(?:bypass|disable|skip|evade|turn off)\b/i.test(text);

  const reintroducesLocalModel =
    /\b(?:on-device|on device|local|offline)\b[\s\S]{0,48}\b(?:llm|language model|generative model|qwen|llama)\b/i.test(text) ||
    /(?:オンデバイス|ローカル).{0,32}(?:LLM|モデル生成|生成系ランタイム)/i.test(text);

  if (mutatesProtectedRuntime) reasons.push('PROTECTED_RUNTIME_MUTATION');
  if (bypassesPrivacy) reasons.push('PRIVACY_BYPASS_INTENT');
  if (reintroducesLocalModel) reasons.push('LOCAL_LLM_PRIMARY_PATH_PROHIBITED');

  try {
    const flags = featureFlagsService.getFlags();
    if (!flags || flags.PRIVACY_GUARDRAIL === 'DISABLED') {
      reasons.push('PRIVACY_GUARDRAIL_DISABLED');
    }

    const audit = privacyGuardrailService.auditOutboundContent(
      text,
      'counterfactual_measurement_policy',
      { autoSanitize: false }
    );
    if (!audit.allowed) reasons.push('PRIVACY_AUDIT_BLOCKED');
  } catch {
    reasons.push('PRIVACY_AUDIT_UNAVAILABLE');
  }

  return {
    invariantsPassed: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

function validateCounterfactualMeasurement(
  scenario: CounterfactualScenarioInput,
  evidence?: CounterfactualMeasurementEvidence
): MeasurementValidation {
  if (!evidence) {
    return {
      status: 'NOT_EXECUTED',
      reasons: ['MEASUREMENT_EVIDENCE_NOT_PROVIDED'],
      eventIds: [],
    };
  }

  if (
    !VALID_ID.test(evidence.experimentId) ||
    !VALID_ID.test(evidence.scenarioId) ||
    evidence.scenarioId !== scenario.id ||
    !VALID_ID.test(evidence.independentReviewEventId)
  ) {
    return rejected('MEASUREMENT_REFERENCE_INVALID');
  }

  const factualIds = evidence.factualEventIds;
  const alternativeIds = evidence.alternativeEventIds;
  if (
    !Array.isArray(factualIds) ||
    !Array.isArray(alternativeIds) ||
    factualIds.length < MIN_PAIRED_TESTS_PER_METRIC * 3 ||
    alternativeIds.length < MIN_PAIRED_TESTS_PER_METRIC * 3 ||
    factualIds.length > MAX_EVENTS_PER_ARM ||
    alternativeIds.length > MAX_EVENTS_PER_ARM ||
    [...factualIds, ...alternativeIds].some(id => typeof id !== 'string' || !VALID_ID.test(id))
  ) {
    return rejected('MEASUREMENT_SAMPLE_COUNT_OR_ID_INVALID');
  }

  const sampleIds = [...factualIds, ...alternativeIds];
  const allIds = [...sampleIds, evidence.independentReviewEventId];
  if (new Set(allIds).size !== allIds.length) {
    return rejected('MEASUREMENT_EVENT_IDS_DUPLICATED');
  }

  const history = executionEventBusService.list();
  const byId = new Map<string, ExecutionEvent>();
  for (const event of history) byId.set(event.event_id, event);

  const allEvents = allIds.map(id => byId.get(id));
  if (allEvents.some(event => !event)) {
    return rejected('MEASUREMENT_EXECUTION_EVENT_NOT_FOUND_OR_EXPIRED');
  }

  const factualEvents = factualIds.map(id => byId.get(id)!);
  const alternativeEvents = alternativeIds.map(id => byId.get(id)!);
  const review = byId.get(evidence.independentReviewEventId)!;
  const sampleEvents = [...factualEvents, ...alternativeEvents];

  const allRequestIds = allEvents.map(event => event!.request_id);
  if (
    allRequestIds.some(id => typeof id !== 'string' || !id.trim()) ||
    new Set(allRequestIds).size !== allRequestIds.length
  ) {
    return rejected('MEASUREMENT_REQUEST_IDS_INVALID_OR_DUPLICATED');
  }

  function validateSample(
    event: ExecutionEvent,
    expectedArm: 'FACTUAL' | 'ALTERNATIVE'
  ): boolean {
    const metric = metadataText(event, 'counterfactual_metric');
    const terminalMatches =
      (event.type === 'execution.completed' && event.passed === true) ||
      (event.type === 'execution.failed' && event.passed === false);

    if (
      !terminalMatches ||
      !['safety', 'accuracy', 'performance'].includes(metric) ||
      !CATEGORY_PATTERN[metric as CounterfactualMetric].test(event.test_category) ||
      metadataText(event, 'counterfactual_role') !== 'SAMPLE' ||
      metadataText(event, 'counterfactual_experiment_id') !== evidence.experimentId ||
      metadataText(event, 'counterfactual_scenario_id') !== evidence.scenarioId ||
      metadataText(event, 'counterfactual_arm') !== expectedArm ||
      metadataText(event, 'assertion_status') !== (event.passed ? 'PASS' : 'FAIL') ||
      !event.component_id ||
      !event.implementation_hash ||
      !event.environment ||
      !event.test_case_id ||
      !event.runner_id
    ) {
      return false;
    }

    if (
      metric === 'performance' &&
      (!Number.isFinite(event.duration_ms) || (event.duration_ms || 0) <= 0)
    ) {
      return false;
    }

    return true;
  }

  if (
    !factualEvents.every(event => validateSample(event, 'FACTUAL')) ||
    !alternativeEvents.every(event => validateSample(event, 'ALTERNATIVE'))
  ) {
    return rejected('MEASUREMENT_SAMPLE_EVENT_CONTRACT_INVALID');
  }

  const allSampleRunners = new Set(sampleEvents.map(event => event.runner_id!));
  const factualHashes = new Set(factualEvents.map(event => event.implementation_hash));
  const alternativeHashes = new Set(alternativeEvents.map(event => event.implementation_hash));
  const allEnvironments = new Set(sampleEvents.map(event => event.environment));
  const factualComponents = new Set(factualEvents.map(event => event.component_id));
  const alternativeComponents = new Set(alternativeEvents.map(event => event.component_id));

  if (
    factualHashes.size !== 1 ||
    alternativeHashes.size !== 1 ||
    [...factualHashes][0] === [...alternativeHashes][0] ||
    allEnvironments.size !== 1 ||
    factualComponents.size !== 1 ||
    alternativeComponents.size !== 1
  ) {
    return rejected('MEASUREMENT_BUILD_ENVIRONMENT_OR_COMPONENT_MISMATCH');
  }

  function pairKey(event: ExecutionEvent): string {
    return `${metadataText(event, 'counterfactual_metric')}|${event.test_case_id}|${event.environment}`;
  }

  const factualByKey = new Map<string, ExecutionEvent>();
  const alternativeByKey = new Map<string, ExecutionEvent>();

  for (const event of factualEvents) {
    const key = pairKey(event);
    if (factualByKey.has(key)) return rejected('DUPLICATE_FACTUAL_TEST_CASE');
    factualByKey.set(key, event);
  }
  for (const event of alternativeEvents) {
    const key = pairKey(event);
    if (alternativeByKey.has(key)) return rejected('DUPLICATE_ALTERNATIVE_TEST_CASE');
    alternativeByKey.set(key, event);
  }

  if (
    factualByKey.size !== alternativeByKey.size ||
    [...factualByKey.keys()].some(key => !alternativeByKey.has(key)) ||
    [...alternativeByKey.keys()].some(key => !factualByKey.has(key))
  ) {
    return rejected('FACTUAL_ALTERNATIVE_TEST_CASES_NOT_PAIRED');
  }

  const samplesByMetric: Record<CounterfactualMetric, Array<[ExecutionEvent, ExecutionEvent]>> = {
    safety: [],
    accuracy: [],
    performance: [],
  };

  for (const [key, factual] of factualByKey.entries()) {
    const alternative = alternativeByKey.get(key)!;
    const metric = metadataText(factual, 'counterfactual_metric') as CounterfactualMetric;
    if (metadataText(alternative, 'counterfactual_metric') !== metric) {
      return rejected('PAIRED_METRIC_MISMATCH');
    }
    samplesByMetric[metric].push([factual, alternative]);
  }

  for (const metric of ['safety', 'accuracy', 'performance'] as CounterfactualMetric[]) {
    if (samplesByMetric[metric].length < MIN_PAIRED_TESTS_PER_METRIC) {
      return rejected(`INSUFFICIENT_PAIRED_${metric.toUpperCase()}_TESTS`);
    }
  }

  const reviewDecision = metadataText(review, 'counterfactual_review_decision');
  const expectedReviewedIds = [...sampleIds].sort().join(',');
  const reviewContractPassed =
    review.type === 'execution.completed' &&
    review.passed === true &&
    review.test_category.trim().toLowerCase() === 'counterfactual_independent_review' &&
    review.test_case_id === evidence.scenarioId &&
    review.environment === [...allEnvironments][0] &&
    Boolean(review.runner_id) &&
    Boolean(review.implementation_hash) &&
    !allSampleRunners.has(review.runner_id || '') &&
    metadataText(review, 'counterfactual_review_role') === 'INDEPENDENT_REVIEW' &&
    metadataText(review, 'counterfactual_role') === 'INDEPENDENT_REVIEW' &&
    metadataText(review, 'counterfactual_experiment_id') === evidence.experimentId &&
    metadataText(review, 'counterfactual_scenario_id') === evidence.scenarioId &&
    metadataText(review, 'counterfactual_reviewer_id') === review.runner_id &&
    metadataText(review, 'counterfactual_reviewed_event_ids') === expectedReviewedIds &&
    (reviewDecision === 'APPROVE' || reviewDecision === 'REJECT') &&
    metadataText(review, 'assertion_status') === 'PASS';

  if (!reviewContractPassed) {
    return rejected('INDEPENDENT_REVIEW_EVENT_INVALID_OR_NOT_INDEPENDENT');
  }

  const passRate = (pairs: Array<[ExecutionEvent, ExecutionEvent]>, arm: 0 | 1) =>
    pairs.filter(pair => pair[arm].passed === true).length / pairs.length * 100;

  const factualLatency = samplesByMetric.performance.map(pair => pair[0].duration_ms!);
  const alternativeLatency = samplesByMetric.performance.map(pair => pair[1].duration_ms!);
  const baselineMedianLatencyMs = median(factualLatency);
  const alternativeMedianLatencyMs = median(alternativeLatency);

  if (baselineMedianLatencyMs <= 0 || alternativeMedianLatencyMs <= 0) {
    return rejected('MEASURED_LATENCY_INVALID');
  }

  const performanceImprovementPercent =
    ((baselineMedianLatencyMs - alternativeMedianLatencyMs) / baselineMedianLatencyMs) * 100;

  const metrics: CounterfactualMeasuredMetrics = {
    baselineSafetyPassRate: passRate(samplesByMetric.safety, 0),
    alternativeSafetyPassRate: passRate(samplesByMetric.safety, 1),
    baselineAccuracyPassRate: passRate(samplesByMetric.accuracy, 0),
    alternativeAccuracyPassRate: passRate(samplesByMetric.accuracy, 1),
    baselineMedianLatencyMs,
    alternativeMedianLatencyMs,
    performanceImprovementPercent,
    pairedSafetySamples: samplesByMetric.safety.length,
    pairedAccuracySamples: samplesByMetric.accuracy.length,
    pairedPerformanceSamples: samplesByMetric.performance.length,
    independentReviewerId: review.runner_id!,
    independentReviewDecision: reviewDecision as 'APPROVE' | 'REJECT',
    independentReviewEventId: review.event_id,
  };

  return { status: 'MEASURED', reasons: [], eventIds: allIds, metrics };
}

export function evaluateCounterfactualScenarioPolicy(
  factualDecision: string,
  scenario: CounterfactualScenarioInput,
  evidence?: CounterfactualMeasurementEvidence
): CounterfactualPolicyEvaluation {
  const audit = auditCounterfactualScenario(
    scenario.alternativeChoice,
    scenario.hypothesis
  );

  const measurement = audit.invariantsPassed
    ? validateCounterfactualMeasurement(scenario, evidence)
    : {
        status: 'REJECTED' as const,
        reasons: audit.reasons,
        eventIds: [] as string[],
      };

  let safetyScore = 0;
  let performanceScore = 0;
  let accuracyScore = 0;
  let overallDeltaScore = 0;
  let recommendation: 'ADOPT_COUNTERFACTUAL' | 'MAINTAIN_FACTUAL' | 'INCONCLUSIVE' =
    audit.invariantsPassed ? 'INCONCLUSIVE' : 'MAINTAIN_FACTUAL';

  let reasoning = !audit.invariantsPassed
    ? `シナリオを却下しました: ${audit.reasons.join(', ')}`
    : measurement.status === 'NOT_EXECUTED'
      ? '代替案の実行・観測・独立レビューが未実施のため判定保留。数値0は未測定を表し、実測値ではない。'
      : measurement.status === 'REJECTED'
        ? `計測証拠を受理できないため判定保留: ${measurement.reasons.join(', ')}`
        : '実行イベントから測定値を算出しました。';

  let measuredMetrics: CounterfactualMeasuredMetrics | undefined;

  if (measurement.status === 'MEASURED' && measurement.metrics) {
    measuredMetrics = measurement.metrics;
    const m = measuredMetrics;

    safetyScore = Math.round(m.alternativeSafetyPassRate);
    accuracyScore = Math.round(m.alternativeAccuracyPassRate);
    performanceScore = Math.round(
      m.baselineMedianLatencyMs / m.alternativeMedianLatencyMs * 100
    );

    const safetyDelta = m.alternativeSafetyPassRate - m.baselineSafetyPassRate;
    const accuracyDelta = m.alternativeAccuracyPassRate - m.baselineAccuracyPassRate;

    overallDeltaScore = Math.round(
      safetyDelta * 0.4 +
      m.performanceImprovementPercent * 0.3 +
      accuracyDelta * 0.3
    );

    if (m.independentReviewDecision === 'REJECT') {
      recommendation = 'MAINTAIN_FACTUAL';
      reasoning = '実測イベントは検証できましたが、レビューイベントが代替案を却下したため事実選択を維持します。';
    } else if (
      m.alternativeSafetyPassRate < m.baselineSafetyPassRate ||
      m.alternativeAccuracyPassRate < m.baselineAccuracyPassRate
    ) {
      recommendation = 'MAINTAIN_FACTUAL';
      reasoning = '実測で安全性または正確性の低下を確認したため事実選択を維持します。';
    } else if (m.alternativeSafetyPassRate < 100) {
      recommendation = 'INCONCLUSIVE';
      reasoning = '代替案の安全性テストがすべてPASSしていないため、採用推奨を保留します。';
    } else if (m.performanceImprovementPercent >= 5 && overallDeltaScore > 0) {
      recommendation = 'ADOPT_COUNTERFACTUAL';
      reasoning = `対応する実測テストとレビューイベントに合格しました。中央値レイテンシ改善=${m.performanceImprovementPercent.toFixed(2)}%、安全性差=${safetyDelta.toFixed(2)}pt、正確性差=${accuracyDelta.toFixed(2)}pt。`;
    } else {
      recommendation = 'INCONCLUSIVE';
      reasoning = `実測はありますが、採用基準（性能改善5%以上、安全性非低下、正確性非低下、レビュー承認）を満たさないため判定保留です。性能改善=${m.performanceImprovementPercent.toFixed(2)}%。`;
    }
  }

  const isMeasured = measurement.status === 'MEASURED' && Boolean(measuredMetrics);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    factualOutcome: `実際の選択: ${factualDecision}`,
    counterfactualOutcome: isMeasured
      ? `実測結果: factual median=${measuredMetrics!.baselineMedianLatencyMs}ms, alternative median=${measuredMetrics!.alternativeMedianLatencyMs}ms`
      : `反実仮想仮説: ${scenario.hypothesis}（未実行・未測定）`,
    safetyScore,
    performanceScore,
    accuracyScore,
    overallDeltaScore,
    recommendation,
    reasoning,
    invariantsPassed: audit.invariantsPassed,
    measurementStatus: measurement.status,
    measurementEvidenceEventIds: [...measurement.eventIds],
    measurementRejectionReasons: [...measurement.reasons],
    measuredMetrics,
  };
}

export function aggregateCounterfactualMeasurementStatus(
  evaluations: Array<{ measurementStatus: CounterfactualMeasurementStatus }>
): CounterfactualSimulationMeasurementStatus {
  if (evaluations.length === 0) return 'NOT_EXECUTED';
  const measuredCount = evaluations.filter(x => x.measurementStatus === 'MEASURED').length;
  if (measuredCount === evaluations.length) return 'MEASURED';
  if (measuredCount > 0) return 'PARTIALLY_MEASURED';
  if (evaluations.every(x => x.measurementStatus === 'REJECTED')) return 'VALIDATION_BLOCKED';
  if (evaluations.every(x => x.measurementStatus === 'NOT_EXECUTED')) return 'NOT_EXECUTED';
  return 'PARTIALLY_MEASURED';
}
