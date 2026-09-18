import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import {
  queryPatternRepositoryService,
  type QueryPatternRecord,
} from './queryPatternRepositoryService';
import type { EnvironmentFingerprint, QueryIntentType } from './researchQueryPlanningService';

export interface QueryPatternSelection {
  selectionId: string;
  canonicalResearchIntent: string;
  selectedPatternIds: string[];
  excludedPatternIds: string[];
  exclusions: Array<{ patternId: string; reason: string }>;
  selected: QueryPatternRecord[];
  createdAt: number;
  selectionSha256: string;
}

const normalize = (value: string): string => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const environmentAllowed = (
  applicability: string,
  environment: EnvironmentFingerprint,
): boolean => {
  if (['NOT_APPLICABLE', 'CONFLICTING_ENVIRONMENT', 'REQUIRES_EXTERNAL_ENVIRONMENT'].includes(applicability)) {
    return false;
  }
  if (environment.os === 'Android' && applicability === 'REFERENCE_ONLY') {
    return false;
  }
  return true;
};

const relevanceScore = (
  pattern: QueryPatternRecord,
  intent: string,
  desiredIntentTypes: QueryIntentType[],
): number => {
  const normalizedIntent = normalize(intent);
  const intentTokens = new Set(normalizedIntent.split(' ').filter(Boolean));
  const shapeTokens = normalize(pattern.normalizedQueryShape).split(' ').filter(Boolean);
  const overlap = shapeTokens.filter(token => intentTokens.has(token)).length;
  const intentMatch = desiredIntentTypes.includes(pattern.intentType) ? 6 : 0;
  const evidenceStrength = Math.min(pattern.evidenceIds.length, 3);
  const independentStrength = Math.min(pattern.independentPlanIds.length, 3);
  return intentMatch + overlap + evidenceStrength + independentStrength;
};

class QueryPatternSelectionService {
  select(
    canonicalResearchIntent: string,
    desiredIntentTypes: QueryIntentType[],
    environment: EnvironmentFingerprint,
    limit = 3,
  ): QueryPatternSelection {
    const exclusions: Array<{ patternId: string; reason: string }> = [];
    const candidates = queryPatternRepositoryService.list()
      .filter(pattern => {
        if (pattern.lifecycle !== 'ACTIVE') {
          exclusions.push({ patternId: pattern.patternId, reason: `LIFECYCLE_${pattern.lifecycle}` });
          return false;
        }
        if (pattern.failureCount > 0) {
          exclusions.push({ patternId: pattern.patternId, reason: 'FAILURE_HISTORY_PRESENT' });
          return false;
        }
        if (pattern.evidenceIds.length === 0 || pattern.independentPlanIds.length < 3) {
          exclusions.push({ patternId: pattern.patternId, reason: 'INSUFFICIENT_INDEPENDENT_EVIDENCE' });
          return false;
        }
        if (!environmentAllowed(pattern.environmentApplicability, environment)) {
          exclusions.push({ patternId: pattern.patternId, reason: 'ENVIRONMENT_NOT_APPLICABLE' });
          return false;
        }
        return true;
      })
      .map(pattern => ({
        pattern,
        score: relevanceScore(pattern, canonicalResearchIntent, desiredIntentTypes),
      }))
      .filter(item => {
        if (item.score <= 0) {
          exclusions.push({ patternId: item.pattern.patternId, reason: 'INTENT_NOT_RELEVANT' });
          return false;
        }
        return true;
      })
      .sort((left, right) => right.score - left.score || left.pattern.patternId.localeCompare(right.pattern.patternId));

    const selected = candidates.slice(0, Math.max(0, Math.min(10, Math.trunc(limit)))).map(item => item.pattern);
    const createdAt = Date.now();
    const base = {
      canonicalResearchIntent: normalize(canonicalResearchIntent),
      selectedPatternIds: selected.map(pattern => pattern.patternId),
      excludedPatternIds: exclusions.map(item => item.patternId),
      exclusions,
      createdAt,
    };
    const selectionSha256 = canonicalSha256Object(base);
    return {
      selectionId: `QPS-${selectionSha256.slice(0, 20)}`,
      ...base,
      selected,
      selectionSha256,
    };
  }
}

export const queryPatternSelectionService = new QueryPatternSelectionService();
