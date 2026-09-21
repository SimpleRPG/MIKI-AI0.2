import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

/**
 * Miki Unified Experience Core
 *
 * 会話・ゲーム・実行タスクを別人格/別学習系に分離せず、同じ「経験」として扱う。
 * ここは生成器ではなく、観測・記憶・再利用優先度を決める決定論的な経験層。
 *
 * 不変条件:
 * - 未検証の事実を学習済み真実へ昇格しない
 * - 実装ハッシュ/ゲームfingerprintのような検証情報はそのまま保持する
 * - 動的コード実行をしない
 * - 同じ入力列から同じ集計結果を得られる
 */

export type UnifiedExperienceDomain = 'conversation' | 'rpg' | 'execution' | 'research' | 'code' | 'system';
export type UnifiedOutcome = 'SUCCESS' | 'FAILURE' | 'UNKNOWN' | 'BLOCKED';

export interface UnifiedExperience {
  id: string;
  timestamp: number;
  domain: UnifiedExperienceDomain;
  action: string;
  inputFingerprint: string;
  outcome: UnifiedOutcome;
  verified: boolean;
  sourceFingerprint?: string;
  capabilityIds: string[];
  concepts: string[];
  lesson?: string;
}

export interface UnifiedMikiState {
  totalExperiences: number;
  domainCounts: Record<UnifiedExperienceDomain, number>;
  successCounts: Record<UnifiedExperienceDomain, number>;
  failureCounts: Record<UnifiedExperienceDomain, number>;
  conceptCounts: Record<string, number>;
  capabilityUseCounts: Record<string, number>;
  recent: UnifiedExperience[];
  lastUpdatedAt: number;
}

const STORAGE_KEY = 'miki_unified_experience_v1';
const MAX_RECENT = 120;
const MAX_CONCEPTS = 600;

const EMPTY_COUNTS = (): Record<UnifiedExperienceDomain, number> => ({
  conversation: 0, rpg: 0, execution: 0, research: 0, code: 0, system: 0,
});

function stableHash(raw: string): string {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[\n\r\t]+/g, ' ');
  const chunks = normalized.split(/[^\p{L}\p{N}_-]+/u).filter(Boolean);
  const jp = Array.from(normalized.matchAll(/[一-龯ぁ-んァ-ヶー]{2,}/g)).map(m => m[0]);
  return Array.from(new Set([...chunks, ...jp])).slice(0, 24);
}

export class UnifiedMikiExperienceService {
  private state: UnifiedMikiState = {
    totalExperiences: 0,
    domainCounts: EMPTY_COUNTS(),
    successCounts: EMPTY_COUNTS(),
    failureCounts: EMPTY_COUNTS(),
    conceptCounts: {},
    capabilityUseCounts: {},
    recent: [],
    lastUpdatedAt: 0,
  };

  constructor() { this.load(); }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.state = {
        ...this.state,
        ...parsed,
        domainCounts: { ...EMPTY_COUNTS(), ...(parsed.domainCounts || {}) },
        successCounts: { ...EMPTY_COUNTS(), ...(parsed.successCounts || {}) },
        failureCounts: { ...EMPTY_COUNTS(), ...(parsed.failureCounts || {}) },
        conceptCounts: parsed.conceptCounts || {},
        capabilityUseCounts: parsed.capabilityUseCounts || {},
        recent: Array.isArray(parsed.recent) ? parsed.recent.slice(-MAX_RECENT) : [],
      };
    } catch { /* safe defaults */ }
  }

  private save(): void {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (error) {
      systemLogger.warn('PERSISTENCE', `[UnifiedExperience] save failed: ${String(error)}`);
    }
  }

  public observe(input: {
    domain: UnifiedExperienceDomain;
    action: string;
    input?: string;
    outcome?: UnifiedOutcome;
    verified?: boolean;
    sourceFingerprint?: string;
    capabilityIds?: string[];
    lesson?: string;
    timestamp?: number;
  }): UnifiedExperience {
    const concepts = tokenize(`${input.input || ''} ${input.lesson || ''}`);
    // actionも概念として残す。会話とゲームで同じ概念を共有できるようにする。
    const actionTokens = tokenize(input.action || '');
    const mergedConcepts = Array.from(new Set([...concepts, ...actionTokens])).slice(0, 24);
    const outcome = input.outcome || 'UNKNOWN';
    const timestamp = input.timestamp || Date.now();
    const fingerprint = stableHash(`${input.domain}|${input.action}|${input.input || ''}|${input.sourceFingerprint || ''}`);
    const id = `EXP-${stableHash(`${timestamp}|${fingerprint}|${this.state.totalExperiences}`)}`;
    const experience: UnifiedExperience = {
      id, timestamp, domain: input.domain, action: input.action,
      inputFingerprint: fingerprint, outcome,
      verified: input.verified === true,
      sourceFingerprint: input.sourceFingerprint,
      capabilityIds: Array.from(new Set(input.capabilityIds || [])).slice(0, 20),
      concepts: mergedConcepts,
      lesson: input.lesson,
    };

    this.state.totalExperiences += 1;
    this.state.domainCounts[input.domain] += 1;
    if (outcome === 'SUCCESS') this.state.successCounts[input.domain] += 1;
    if (outcome === 'FAILURE') this.state.failureCounts[input.domain] += 1;
    for (const concept of mergedConcepts) this.state.conceptCounts[concept] = (this.state.conceptCounts[concept] || 0) + 1;
    for (const id of experience.capabilityIds) this.state.capabilityUseCounts[id] = (this.state.capabilityUseCounts[id] || 0) + 1;
    this.state.recent = [...this.state.recent, experience].slice(-MAX_RECENT);

    const conceptEntries = Object.entries(this.state.conceptCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CONCEPTS);
    this.state.conceptCounts = Object.fromEntries(conceptEntries);
    this.state.lastUpdatedAt = timestamp;
    this.save();
    return experience;
  }

  public observeConversation(input: { prompt: string; outcome?: UnifiedOutcome; verified?: boolean; capabilityIds?: string[]; lesson?: string }): UnifiedExperience {
    return this.observe({ domain: 'conversation', action: 'turn', input: input.prompt, outcome: input.outcome, verified: input.verified, capabilityIds: input.capabilityIds, lesson: input.lesson });
  }

  public observeRpg(input: { action: string; input?: string; outcome: UnifiedOutcome; verified?: boolean; sourceFingerprint?: string; capabilityIds?: string[]; lesson?: string }): UnifiedExperience {
    return this.observe({ domain: 'rpg', action: input.action, input: input.input || input.action, outcome: input.outcome, verified: input.verified, sourceFingerprint: input.sourceFingerprint, capabilityIds: input.capabilityIds, lesson: input.lesson });
  }

  public observeExecution(input: { action: string; goal: string; outcome: UnifiedOutcome; verified?: boolean; capabilityIds?: string[]; lesson?: string }): UnifiedExperience {
    return this.observe({ domain: 'execution', action: input.action, input: input.goal, outcome: input.outcome, verified: input.verified, capabilityIds: input.capabilityIds, lesson: input.lesson });
  }

  public getState(): UnifiedMikiState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public getRecent(limit = 20): UnifiedExperience[] {
    return this.state.recent.slice(-Math.max(1, Math.min(100, limit)));
  }

  /** 会話でもゲームでも同じ概念を使っているかを決定論的に確認する。 */
  public sharedConcepts(query: string, limit = 8): Array<{ concept: string; count: number; domains: UnifiedExperienceDomain[] }> {
    const tokens = new Set(tokenize(query));
    return Object.keys(this.state.conceptCounts)
      .filter(c => tokens.has(c))
      .map(concept => ({
        concept,
        count: this.state.conceptCounts[concept],
        domains: Array.from(new Set(this.state.recent.filter(e => e.concepts.includes(concept)).map(e => e.domain))),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /** 現在の要求に対して、過去経験が多く成功している領域を優先する。 */
  public rankDomains(query: string): Array<{ domain: UnifiedExperienceDomain; score: number }> {
    const tokens = new Set(tokenize(query));
    return (Object.keys(this.state.domainCounts) as UnifiedExperienceDomain[])
      .map(domain => {
        const related = this.state.recent.filter(e => e.domain === domain && e.concepts.some(c => tokens.has(c)));
        const success = related.filter(e => e.outcome === 'SUCCESS').length;
        const verified = related.filter(e => e.verified).length;
        return { domain, score: related.length * 10 + success * 25 + verified * 15 };
      })
      .sort((a, b) => b.score - a.score);
  }

  public getCapabilityUsage(capabilityId: string): number {
    return this.state.capabilityUseCounts[capabilityId] || 0;
  }
}

export const unifiedMikiExperienceService = new UnifiedMikiExperienceService();
