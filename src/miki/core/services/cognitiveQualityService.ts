import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { mikiUnifiedLearningContinuumService } from '../../learning/services/mikiUnifiedLearningContinuumService';
import type { MikiDomain } from './crossDomainCirculationService';

export interface ClarificationCandidate {
  id?: string;
  question: string;
  informationGain?: number;
  decisionImpact?: number;
  answerCost?: number;
  resolves?: string[];
  required?: boolean;
}
export interface ClarificationPlan {
  selected: { id: string; question: string; score: number; resolves: string[] } | null;
  ranked: Array<{ id: string; question: string; score: number; resolves: string[] }>;
  reason: string;
}
export interface ExplanationPlan {
  level: 'BRIEF' | 'STANDARD' | 'DETAILED';
  rationale: string[];
  requestedLevel: string;
}

const normalize = (value: string) => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s　]+/g, ' ').trim();
const bounded = (value: unknown, fallback: number) => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : fallback));

class CognitiveQualityService {
  selectClarification(candidates: ClarificationCandidate[] = []): ClarificationPlan {
    const ranked = candidates
      .filter(item => item && typeof item.question === 'string' && item.question.trim())
      .map((item, index) => {
        const informationGain = bounded(item.informationGain, item.required ? 0.8 : 0.35);
        const impact = bounded(item.decisionImpact, item.required ? 0.9 : 0.5);
        const cost = Math.max(0.1, Math.min(1, Number(item.answerCost) || 0.35));
        const score = Math.round((informationGain * impact / cost) * 1000) / 1000;
        return { id: String(item.id || `clarify-${index + 1}`), question: item.question.trim(), score, resolves: [...new Set((item.resolves || []).filter((x): x is string => typeof x === 'string' && Boolean(x.trim())))] };
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const selected = ranked[0] && ranked[0].score >= 0.35 ? ranked[0] : null;
    return { selected: selected || null, ranked, reason: selected ? 'MAX_INFORMATION_GAIN_PER_USER_COST' : 'NO_DECISION_CHANGING_QUESTION' };
  }

  planExplanation(input: { goal: string; requestedLevel?: unknown; userLevel?: unknown }): ExplanationPlan {
    const requestedLevel = String(input.requestedLevel ?? 'auto').toUpperCase();
    const rationale: string[] = [];
    if (['BRIEF', 'STANDARD', 'DETAILED'].includes(requestedLevel)) {
      rationale.push('USER_EXPLICITLY_REQUESTED_LEVEL');
      return { level: requestedLevel as ExplanationPlan['level'], rationale, requestedLevel };
    }
    const goal = String(input.goal || '');
    const technical = /実装|設計|コード|検証|証拠|因果|アーキテクチャ|型|エラー|比較|手順|仕様|原因/.test(goal);
    const long = goal.length >= 120;
    const multi = /そして|さらに|また|も|かつ|;|\n/.test(goal);
    const novice = String(input.userLevel || '').toUpperCase() === 'BEGINNER';
    const expert = String(input.userLevel || '').toUpperCase() === 'EXPERT';
    let level: ExplanationPlan['level'] = 'STANDARD';
    if (novice) { level = 'DETAILED'; rationale.push('USER_LEVEL_BEGINNER'); }
    else if (expert) { level = 'BRIEF'; rationale.push('USER_LEVEL_EXPERT'); }
    else if (technical || long || multi) { level = 'DETAILED'; rationale.push(technical ? 'TECHNICAL_TASK' : long ? 'LONG_REQUEST' : 'MULTI_PART_REQUEST'); }
    else rationale.push('DEFAULT_STANDARD_DETAIL');
    return { level, rationale, requestedLevel: String(input.requestedLevel ?? 'auto') };
  }

  predictPotentialUnknowns(goal: string, limit = 12): Array<{ term: string; status: 'POTENTIAL_UNKNOWN'; reason: string; confidence: number }> {
    const terms = String(goal || '').normalize('NFKC').match(/[一-龯々〆ヵヶぁ-んァ-ヶA-Za-z][一-龯々〆ヵヶぁ-んァ-ヶA-Za-z0-9_-]{1,}/g) || [];
    const unique = [...new Set(terms.map(x => x.trim()).filter(x => x.length >= 2))];
    const candidates: Array<{ term: string; status: 'POTENTIAL_UNKNOWN'; reason: string; confidence: number }> = [];
    for (const term of unique) {
      const claimMatch=claimDatabaseService.findBestMatchingClaim(term);
      const knownClaim=claimMatch.hasMatch&&claimMatch.suggestedAction==='DIRECT_ANSWER'&&claimMatch.confidence!=='UNVERIFIED';
      const dictionaryMatches = japaneseDictionaryService.lookup(term).length > 0;
      if (knownClaim || dictionaryMatches) continue;
      const freshnessDue=claimMatch.freshness?.status==='REVALIDATION_DUE'||claimMatch.unmetReason==='MATCHING_CLAIM_REVALIDATION_REQUIRED';
      candidates.push({ term, status: 'POTENTIAL_UNKNOWN', reason: freshnessDue?'LOCAL_CLAIM_REQUIRES_REVALIDATION; RESEARCH_AND_VERIFICATION_REQUIRED':'NO_CONFIDENT_LOCAL_CLAIM_OR_DICTIONARY_MATCH; RESEARCH_AND_VERIFICATION_REQUIRED', confidence: freshnessDue?0.65:0.35 });
      if (candidates.length >= Math.max(1, Math.min(40, limit))) break;
    }
    return candidates;
  }

  discoverLearningOpportunities(goal: string, activeDomains: MikiDomain[]) {
    const query = normalize(goal);
    const active = new Set(activeDomains.map(domain => this.learningDomain(domain)).filter((x): x is 'conversation' | 'rpg' | 'execution' | 'research' | 'code' | 'system' => Boolean(x)));
    return mikiUnifiedLearningContinuumService.getSnapshot().crossDomainLinks
      .filter(link => link.strength >= 20 && link.domains.some(domain => !active.has(domain)) && link.domains.some(domain => active.has(domain)) && (query.includes(normalize(link.concept)) || normalize(link.concept).split(/[\s:_-]+/).some(part => part.length >= 3 && query.includes(part))))
      .slice(0, 12)
      .map(link => ({ concept: link.concept, sourceDomains: link.domains.filter(domain => !active.has(domain)), activeDomains: link.domains.filter(domain => active.has(domain)), strength: link.strength, status: 'LEARNING_OPPORTUNITY_CANDIDATE', requiresOutcomeEvaluation: true, promotedToFact: false }));
  }

  crossDomainTransferCandidates(goal: string, activeDomains: MikiDomain[], verifiedOutcome: boolean) {
    const query = normalize(goal);
    const targetDomains = new Set(activeDomains.map(domain => this.learningDomain(domain)).filter((x): x is 'conversation' | 'rpg' | 'execution' | 'research' | 'code' | 'system' => Boolean(x)));
    const profiles = mikiUnifiedLearningContinuumService.getSnapshot().profiles;
    const candidates = profiles.filter(profile => {
      if (profile.verified < 1 || profile.uses < 2 || !profile.key || profile.key.startsWith('capability:')) return false;
      const key = normalize(profile.key);
      const intersectsGoal = key.length >= 3 && (query.includes(key) || key.split(/[\s:_-]+/).some(part => part.length >= 3 && query.includes(part)));
      const sourceDomains = Object.entries(profile.domains).filter(([, count]) => count > 0).map(([domain]) => domain);
      return intersectsGoal && sourceDomains.some(domain => !targetDomains.has(domain as never)) && [...targetDomains].some(domain => profile.domains[domain] === 0);
    }).slice(0, 20).map(profile => ({ key: profile.key, sourceDomains: Object.entries(profile.domains).filter(([, count]) => count > 0).map(([domain]) => domain), targetDomains: [...targetDomains], confidence: profile.confidence, status: verifiedOutcome ? 'TRANSFER_OUTCOME_REQUIRES_CAUSAL_CONFIRMATION' : 'TRANSFER_CANDIDATE', causalPromotionAllowed: false }));
    return candidates;
  }

  private learningDomain(domain: MikiDomain): 'conversation' | 'rpg' | 'execution' | 'research' | 'code' | 'system' | undefined {
    if (domain === 'conversation') return 'conversation';
    if (domain === 'research' || domain === 'unknown' || domain === 'memory') return 'research';
    if (domain === 'execution' || domain === 'capability') return 'execution';
    if (domain === 'selfDevelopment' || domain === 'improvement' || domain === 'promotion') return 'code';
    if (domain === 'core' || domain === 'safety' || domain === 'verification' || domain === 'strategy' || domain === 'learning' || domain === 'experience' || domain === 'data' || domain === 'autonomy' || domain === 'selfAwareness') return 'system';
    return undefined;
  }
}

export const cognitiveQualityService = new CognitiveQualityService();
