import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { causalMemoryLedgerService } from '../../memory/services/causalMemoryLedgerService';

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

export interface SelfCodeExperienceDetail {
  id?: string;
  target: string;
  chapterNumber?: number;
  targetFile?: string;
  problem: string;
  rootCause: string;
  hypothesis: string;
  improvementMethod: string;
  knowledgeUsed: string[];
  changeDetails: {
    linesCount: number;
    summary: string;
    snippet?: string;
  };
  metricsBefore: {
    failureRate?: number;
    openGaps?: number;
    complianceScore?: number;
    stableCases?: number;
  };
  metricsAfter: {
    failureRate?: number;
    openGaps?: number;
    complianceScore?: number;
    stableCases?: number;
  };
  scoreDelta: number;
  testResults: {
    syntaxPassed: boolean;
    testsPassed: boolean;
    mutationKillRate?: number;
    testSummary?: string;
  };
  operationalResult: string;
  verdict: 'ADOPT' | 'HOLD' | 'REJECT';
  sideEffects: string[];
  rolledBack: boolean;
  rollbackReason?: string;
  timestamp?: number;
}

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
  selfCodeDetail?: SelfCodeExperienceDetail;
}

export interface UnifiedMikiState {
  totalExperiences: number;
  domainCounts: Record<UnifiedExperienceDomain, number>;
  successCounts: Record<UnifiedExperienceDomain, number>;
  failureCounts: Record<UnifiedExperienceDomain, number>;
  conceptCounts: Record<string, number>;
  capabilityUseCounts: Record<string, number>;
  recent: UnifiedExperience[];
  selfCodeExperiences: SelfCodeExperienceDetail[];
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
    selfCodeExperiences: [],
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
        selfCodeExperiences: Array.isArray(parsed.selfCodeExperiences) ? parsed.selfCodeExperiences.slice(-60) : [],
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

    // 設計思想 第160章: 経験を因果記憶レジャーへ記録し、判断→結果の因果鎖を同一Mikiで共有
    try {
      causalMemoryLedgerService.append({
        experienceId: experience.id,
        kind: 'DECISION',
        subject: `${input.domain}:${input.action}`,
        outcome: outcome === 'SUCCESS' ? 'SUCCESS' : outcome === 'FAILURE' ? 'FAILURE' : 'INCONCLUSIVE',
        verified: experience.verified,
        source: input.domain,
      });
    } catch { /* best effort */ }

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

  /**
   * 自己コード改善の1サイクルを独立した経験記録としてUnified Learning層へ接続 (指示書 1.1)
   * 改善対象・問題・根本原因・仮説・使用した改善方法・知識・変更内容・指標前後・テスト結果・採用判定・副作用・ロールバック有無を保持
   */
  public observeSelfCodeImprovement(detail: SelfCodeExperienceDetail): UnifiedExperience {
    const timestamp = detail.timestamp || Date.now();
    const outcome: UnifiedOutcome = detail.verdict === 'ADOPT'
      ? 'SUCCESS'
      : detail.verdict === 'HOLD'
      ? 'UNKNOWN'
      : 'FAILURE';

    const lesson = `[自己コード改善:${detail.target}] 判定:${detail.verdict}, スコア変動:${detail.scoreDelta >= 0 ? '+' : ''}${detail.scoreDelta}pt, 手法:${detail.improvementMethod}. 仮説:${detail.hypothesis} -> 結果:${detail.operationalResult}`;
    const inputStr = `${detail.target} ${detail.problem} ${detail.rootCause} ${detail.improvementMethod} ${detail.knowledgeUsed.join(' ')}`;

    const experience = this.observe({
      domain: 'code',
      action: 'self_code_improvement',
      input: inputStr,
      outcome,
      verified: detail.testResults.syntaxPassed && detail.testResults.testsPassed && !detail.rolledBack,
      sourceFingerprint: detail.targetFile || `chap_${detail.chapterNumber || 'unknown'}`,
      capabilityIds: ['self_code_architect', 'continuous_evolution', ...(detail.chapterNumber ? [`chapter_${detail.chapterNumber}`] : [])],
      lesson,
      timestamp,
    });

    // 詳細メタデータを紐づけて保存
    const enrichedDetail: SelfCodeExperienceDetail = {
      ...detail,
      id: detail.id || `SCEXP-${experience.id}`,
      timestamp,
    };
    experience.selfCodeDetail = enrichedDetail;

    this.state.selfCodeExperiences = [
      ...this.state.selfCodeExperiences,
      enrichedDetail,
    ].slice(-60);
    this.save();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🧠 [UnifiedLearning 接続] 自己コード改善経験を記録: ${detail.target} -> Verdict: ${detail.verdict} (${detail.scoreDelta >= 0 ? '+' : ''}${detail.scoreDelta}pt)`
    );

    return experience;
  }

  public getSelfCodeExperiences(limit = 20): SelfCodeExperienceDetail[] {
    return this.state.selfCodeExperiences.slice(-Math.max(1, Math.min(60, limit)));
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
