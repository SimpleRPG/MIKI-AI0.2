import { storageService } from '../../../services/storageService';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import type { QueryIntentType } from './researchQueryPlanningService';
import type { ResearchQueryOutcome } from './researchQueryOutcomeLearningService';

export type QueryPatternLifecycle = 'CANDIDATE' | 'TESTED' | 'ACTIVE' | 'SUSPENDED';

export interface QueryPatternRecord {
  patternId: string;
  intentType: QueryIntentType;
  normalizedQueryShape: string;
  environmentApplicability: string;
  lifecycle: QueryPatternLifecycle;
  successCount: number;
  failureCount: number;
  independentPlanIds: string[];
  evidenceIds: string[];
  lastOutcomeId: string;
  lastObservedAt: number;
  canonicalSha256: string;
}

const STORAGE_KEY = 'miki_query_pattern_repository_v80';
const MAX_PATTERNS = 500;

const normalizeShape = (query: string): string => query
  .toLowerCase()
  .replace(/https?:\/\/\S+/g, '<url>')
  .replace(/\b\d+(?:\.\d+)*\b/g, '<number>')
  .replace(/\s+/g, ' ')
  .trim();

const unique = (items: string[]): string[] => [...new Set(items.filter(Boolean))];

class QueryPatternRepositoryService {
  list(): QueryPatternRecord[] {
    const raw=storageService.getItem(STORAGE_KEY);try{return raw?JSON.parse(raw) as QueryPatternRecord[]:[];}catch{return [];}
  }

  observe(outcome: ResearchQueryOutcome, intentType: QueryIntentType): QueryPatternRecord {
    const normalizedQueryShape = normalizeShape(outcome.queryText);
    const patternKey = canonicalSha256Object({ intentType, normalizedQueryShape, environmentApplicability: outcome.environmentApplicability });
    const patternId = `QPT-${patternKey.slice(0, 20)}`;
    const existing = this.list().find(item => item.patternId === patternId);
    const success = outcome.status === 'EVIDENCE_GAINED' && outcome.evidenceIds.length > 0;
    const hardFailure = ['PRIVACY_BLOCKED', 'ENVIRONMENT_MISMATCH', 'FAILED'].includes(outcome.status);
    const independentPlanIds = unique([...(existing?.independentPlanIds ?? []), outcome.queryPlanId]);
    const successCount = (existing?.successCount ?? 0) + (success ? 1 : 0);
    const failureCount = (existing?.failureCount ?? 0) + (success ? 0 : 1);
    let lifecycle: QueryPatternLifecycle = existing?.lifecycle ?? 'CANDIDATE';

    if (hardFailure) {
      lifecycle = 'SUSPENDED';
    } else if (successCount >= 3 && independentPlanIds.length >= 3 && failureCount === 0) {
      lifecycle = 'ACTIVE';
    } else if (successCount > 0 || failureCount > 0) {
      lifecycle = 'TESTED';
    }

    const base = {
      patternId,
      intentType,
      normalizedQueryShape,
      environmentApplicability: outcome.environmentApplicability,
      lifecycle,
      successCount,
      failureCount,
      independentPlanIds,
      evidenceIds: unique([...(existing?.evidenceIds ?? []), ...outcome.evidenceIds]),
      lastOutcomeId: outcome.outcomeId,
      lastObservedAt: outcome.observedAt,
    };
    const record: QueryPatternRecord = { ...base, canonicalSha256: canonicalSha256Object(base) };
    const stored = [record, ...this.list().filter(item => item.patternId !== patternId)].slice(0, MAX_PATTERNS);
    storageService.setItem(STORAGE_KEY, JSON.stringify(stored));
    return record;
  }

  findActive(intentType: QueryIntentType, environmentApplicability?: string): QueryPatternRecord[] {
    return this.list().filter(item => item.lifecycle === 'ACTIVE'
      && item.intentType === intentType
      && (!environmentApplicability || item.environmentApplicability === environmentApplicability));
  }
}

export const queryPatternRepositoryService = new QueryPatternRepositoryService();
