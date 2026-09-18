import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { researchQueryPlanningService, QueryReadiness } from './researchQueryPlanningService';
import { queryPatternRepositoryService } from './queryPatternRepositoryService';

export type QueryOutcomeStatus =
  | 'EVIDENCE_GAINED'
  | 'NO_RESULTS'
  | 'LOW_QUALITY_RESULTS'
  | 'ENVIRONMENT_MISMATCH'
  | 'DUPLICATE_RESULTS'
  | 'PRIVACY_BLOCKED'
  | 'BUDGET_EXHAUSTED'
  | 'FAILED';

export interface ResearchQueryOutcome {
  outcomeId: string;
  queryPlanId: string;
  queryId: string;
  queryText: string;
  status: QueryOutcomeStatus;
  candidateUrlCount: number;
  renderedPageCount: number;
  admissibleIndependentSourceCount: number;
  primarySourceCount: number;
  counterevidenceChecked: boolean;
  evidenceIds: string[];
  failureReasons: string[];
  environmentApplicability: string;
  executionTimeMs: number;
  attempt: number;
  observedAt: number;
  outcomeSha256: string;
}

export interface QueryRevisionRecommendation {
  recommendationId: string;
  queryPlanId: string;
  queryId: string;
  shouldRevise: boolean;
  readiness: QueryReadiness;
  reason: string;
  revisedQuery?: string;
  blockedUntil?: number;
  recommendationSha256: string;
}

const QUERY_OUTCOME_PERSISTENCE_FAILED = 'QUERY_OUTCOME_PERSISTENCE_FAILED';
const OUTCOME_KEY = 'miki_research_query_outcome_v79';
const MAX_OUTCOMES = 1000;

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();
const unique = (items: string[]): string[] => [...new Set(items.filter(Boolean))];

class ResearchQueryOutcomeLearningService {
  list(queryPlanId?: string): ResearchQueryOutcome[] {
    const all = storageService.getItem<ResearchQueryOutcome[]>(OUTCOME_KEY, []);
    return queryPlanId ? all.filter(item => item.queryPlanId === queryPlanId) : all;
  }

  record(input: Omit<ResearchQueryOutcome, 'outcomeId' | 'observedAt' | 'outcomeSha256'>): ResearchQueryOutcome {
    const plan = researchQueryPlanningService.listPlans().find(item => item.queryPlanId === input.queryPlanId);
    const query = plan?.queries.find(item => item.queryId === input.queryId);
    if (!plan || !query) {
      throw new Error('QUERY_PLAN_OR_QUERY_NOT_FOUND');
    }
    if (normalize(query.queryText) !== normalize(input.queryText)) {
      throw new Error('QUERY_TEXT_MISMATCH');
    }
    const base = {
      ...input,
      candidateUrlCount: Math.max(0, Math.floor(input.candidateUrlCount)),
      renderedPageCount: Math.max(0, Math.floor(input.renderedPageCount)),
      admissibleIndependentSourceCount: Math.max(0, Math.floor(input.admissibleIndependentSourceCount)),
      primarySourceCount: Math.max(0, Math.floor(input.primarySourceCount)),
      evidenceIds: unique(input.evidenceIds),
      failureReasons: unique(input.failureReasons.map(normalize)),
      executionTimeMs: Math.max(0, Math.floor(input.executionTimeMs)),
      attempt: Math.max(1, Math.floor(input.attempt)),
      observedAt: Date.now(),
    };
    const outcomeSha256 = canonicalSha256Object(base);
    const outcome: ResearchQueryOutcome = {
      ...base,
      outcomeId: `RQO-${outcomeSha256.slice(0, 20)}`,
      outcomeSha256,
    };
    const stored = [outcome, ...this.list().filter(item => item.outcomeId !== outcome.outcomeId)].slice(0, MAX_OUTCOMES);
    storageService.setItem(OUTCOME_KEY, stored);
    const reloaded = storageService.getItem<ResearchQueryOutcome[]>(OUTCOME_KEY, []).find(item => item.outcomeId === outcome.outcomeId);
    if (!reloaded || reloaded.outcomeSha256 !== outcome.outcomeSha256) {
      throw new Error(QUERY_OUTCOME_PERSISTENCE_FAILED);
    }
    const persistedPlan = researchQueryPlanningService.listPlans().find(item => item.queryPlanId === outcome.queryPlanId);
    const persistedQuery = persistedPlan?.queries.find(item => item.queryId === outcome.queryId);
    if (persistedQuery) {
      queryPatternRepositoryService.observe(reloaded, persistedQuery.intentType);
    }
    return outcome;
  }

  recommendRevision(queryPlanId: string, queryId: string): QueryRevisionRecommendation {
    const plan = researchQueryPlanningService.listPlans().find(item => item.queryPlanId === queryPlanId);
    const query = plan?.queries.find(item => item.queryId === queryId);
    if (!plan || !query) {
      throw new Error('QUERY_PLAN_OR_QUERY_NOT_FOUND');
    }
    const outcomes = this.list(queryPlanId).filter(item => item.queryId === queryId);
    const latest = outcomes[0];
    const revisions = researchQueryPlanningService.listRevisionPairs().filter(item => item.queryId === queryId);
    const exhausted = revisions.length >= plan.policy.maxRevisionPerQuery;
    let shouldRevise = false;
    let readiness: QueryReadiness = query.readiness;
    let reason = 'OUTCOME_REQUIRED';
    let revisedQuery: string | undefined;

    if (latest) {
      if (latest.status === 'PRIVACY_BLOCKED') {
        readiness = 'PRIVACY_BLOCKED';
        reason = 'PRIVACY_BLOCKED';
      } else if (exhausted || latest.status === 'BUDGET_EXHAUSTED') {
        reason = 'REVISION_BUDGET_EXHAUSTED';
      } else if (latest.status === 'NO_RESULTS' || latest.status === 'LOW_QUALITY_RESULTS') {
        shouldRevise = true;
        readiness = 'READY';
        reason = latest.status;
        revisedQuery = normalize(`${query.queryText} official documentation ${plan.environment.os} ${plan.environment.architecture}`);
      } else if (latest.status === 'ENVIRONMENT_MISMATCH') {
        shouldRevise = true;
        readiness = 'ENVIRONMENT_MISMATCH';
        reason = latest.status;
        revisedQuery = normalize(`${plan.canonicalResearchIntent} Android Galaxy S25 arm64 Capacitor WebView`);
      } else if (latest.status === 'DUPLICATE_RESULTS') {
        shouldRevise = true;
        readiness = 'DUPLICATE_QUERY';
        reason = latest.status;
        revisedQuery = normalize(`${query.queryText} limitations counterevidence alternative`);
      } else if (latest.status === 'EVIDENCE_GAINED') {
        reason = 'EVIDENCE_GAINED_NO_REVISION';
      } else {
        reason = latest.status;
      }
    }

    const base = { queryPlanId, queryId, shouldRevise, readiness, reason, revisedQuery };
    const recommendationSha256 = canonicalSha256Object(base);
    return {
      ...base,
      recommendationId: `QRR-${recommendationSha256.slice(0, 20)}`,
      recommendationSha256,
    };
  }

  createRevisionFromLatestOutcome(queryPlanId: string, queryId: string) {
    const recommendation = this.recommendRevision(queryPlanId, queryId);
    if (!recommendation.shouldRevise || !recommendation.revisedQuery) {
      throw new Error(recommendation.reason);
    }
    const latest = this.list(queryPlanId).find(item => item.queryId === queryId);
    if (!latest) {
      throw new Error('QUERY_OUTCOME_REQUIRED');
    }
    return researchQueryPlanningService.reviseQuery(
      queryPlanId,
      queryId,
      recommendation.revisedQuery,
      recommendation.reason,
      latest as unknown as Record<string, unknown>,
    );
  }
}

export const researchQueryOutcomeLearningService = new ResearchQueryOutcomeLearningService();
