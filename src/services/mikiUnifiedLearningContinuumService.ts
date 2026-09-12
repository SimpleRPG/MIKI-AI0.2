import { storageService } from './storageService';
import { systemLogger } from './systemLogger';
import { unifiedMikiExperienceService, UnifiedExperienceDomain, UnifiedOutcome } from './unifiedMikiExperienceService';

/**
 * Miki Unified Learning Continuum
 *
 * 会話/RPG/実行/調査/コードを別々の「学習器」にせず、同一Mikiの
 * 共通概念・手続き・成功率・鮮度を集約する決定論的なメタ学習層。
 * 生成モデルは使用せず、観測された経験だけから優先度を更新する。
 */
export interface LearningProfile {
  key: string;
  uses: number;
  successes: number;
  failures: number;
  verified: number;
  lastObservedAt: number;
  confidence: number;
  domains: Record<UnifiedExperienceDomain, number>;
}

export interface MikiLearningSnapshot {
  version: 1;
  updatedAt: number;
  profiles: LearningProfile[];
  crossDomainLinks: Array<{ concept: string; domains: UnifiedExperienceDomain[]; strength: number }>;
  recommendedCapabilities: Array<{ capabilityId: string; score: number; reason: string }>;
}

const KEY = 'miki_unified_learning_continuum_v1';
const MAX_PROFILES = 800;

const domains = (): Record<UnifiedExperienceDomain, number> => ({
  conversation: 0, rpg: 0, execution: 0, research: 0, code: 0, system: 0,
});

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160);
}

export class MikiUnifiedLearningContinuumService {
  private profiles = new Map<string, LearningProfile>();
  private initialized = false;

  constructor() { this.load(); }

  private load() {
    try {
      const raw = storageService.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      for (const p of Array.isArray(parsed?.profiles) ? parsed.profiles : []) {
        if (p?.key) this.profiles.set(p.key, { ...p, domains: { ...domains(), ...(p.domains || {}) } });
      }
    } catch { this.profiles.clear(); }
  }

  private save() {
    try {
      const profiles = [...this.profiles.values()].sort((a, b) => b.lastObservedAt - a.lastObservedAt).slice(0, MAX_PROFILES);
      storageService.setItem(KEY, JSON.stringify({ version: 1, updatedAt: Date.now(), profiles }));
    } catch (error) { systemLogger.warn('PERSISTENCE', `[LearningContinuum] save failed: ${String(error)}`); }
  }

  public initialize() {
    if (this.initialized) return;
    this.initialized = true;
    systemLogger.info('SELF_IMPROVEMENT', '🧠 [LearningContinuum] unified Miki learning initialized');
  }

  public observe(input: {
    domain: UnifiedExperienceDomain;
    key: string;
    outcome: UnifiedOutcome;
    verified: boolean;
    capabilityIds?: string[];
    concepts?: string[];
  }) {
    const now = Date.now();
    const keys = Array.from(new Set([normalizeKey(input.key), ...(input.concepts || []).map(normalizeKey).filter(Boolean)])).filter(Boolean).slice(0, 20);
    for (const key of keys) {
      const current = this.profiles.get(key) || { key, uses: 0, successes: 0, failures: 0, verified: 0, lastObservedAt: 0, confidence: 0, domains: domains() };
      current.uses += 1;
      if (input.outcome === 'SUCCESS') current.successes += 1;
      if (input.outcome === 'FAILURE') current.failures += 1;
      if (input.verified) current.verified += 1;
      current.lastObservedAt = now;
      current.domains[input.domain] += 1;
      const successRate = current.successes / Math.max(1, current.successes + current.failures);
      const verificationRate = current.verified / Math.max(1, current.uses);
      current.confidence = Math.round(Math.min(100, successRate * 65 + verificationRate * 35) * 100) / 100;
      this.profiles.set(key, current);
    }
    for (const id of input.capabilityIds || []) {
      const key = `capability:${normalizeKey(id)}`;
      this.observe({ domain: input.domain, key, outcome: input.outcome, verified: input.verified });
    }
    this.save();
  }

  /** 過去経験を能力選択に反映する。ただしVERIFIED能力のみ返す。 */
  public rankCapabilities(capabilityIds: string[], query: string): Array<{ capabilityId: string; score: number; reason: string }> {
    const q = normalizeKey(query);
    return capabilityIds.map(id => {
      const p = this.profiles.get(`capability:${normalizeKey(id)}`);
      const direct = p ? p.confidence : 0;
      const related = [...this.profiles.values()]
        .filter(x => x.key !== `capability:${normalizeKey(id)}` && q && q.includes(x.key))
        .reduce((s, x) => s + x.confidence * 0.15, 0);
      const usage = p ? Math.min(20, p.uses) : 0;
      const score = Math.round((direct + related + usage) * 100) / 100;
      return { capabilityId: id, score, reason: p ? `共通経験 uses=${p.uses}, success=${p.successes}, verified=${p.verified}, confidence=${p.confidence}` : '共通経験なし。新規候補として扱う' };
    }).sort((a, b) => b.score - a.score);
  }

  /** 8層記憶へ渡せる「学習要約」。事実DBを汚さず、経験/手続き/メタ学習として扱う。 */
  public buildMemoryLayerSummary() {
    const all = [...this.profiles.values()];
    const top = all.filter(p => p.uses >= 2).sort((a, b) => b.confidence - a.confidence || b.uses - a.uses).slice(0, 24);
    return {
      episodic_buffer: all.length,
      short_term: all.filter(p => Date.now() - p.lastObservedAt < 24 * 60 * 60 * 1000).length,
      working_agenda: all.filter(p => p.failures > p.successes).slice(0, 20).map(p => p.key),
      episodic: all.length,
      semantic_core: top.filter(p => p.verified > 0).slice(0, 12).map(p => p.key),
      structural: top.filter(p => Object.keys(p.domains).filter(d => p.domains[d as UnifiedExperienceDomain] > 0).length >= 2).slice(0, 12).map(p => p.key),
      procedural: top.filter(p => p.successes >= 2 && p.confidence >= 60).slice(0, 20).map(p => p.key),
      meta_memory: top.slice(0, 20).map(p => ({ key: p.key, confidence: p.confidence, uses: p.uses })),
    };
  }

  public getSnapshot(): MikiLearningSnapshot {
    const all = [...this.profiles.values()];
    const links = all.map(p => ({ concept: p.key, domains: (Object.keys(p.domains) as UnifiedExperienceDomain[]).filter(d => p.domains[d] > 0), strength: Math.min(100, p.uses * 10 + p.verified * 10) }))
      .filter(x => x.domains.length >= 2).sort((a, b) => b.strength - a.strength).slice(0, 100);
    const caps = all.filter(p => p.key.startsWith('capability:')).sort((a, b) => b.confidence - a.confidence).slice(0, 50)
      .map(p => ({ capabilityId: p.key.slice('capability:'.length), score: p.confidence, reason: `uses=${p.uses}; success=${p.successes}; verified=${p.verified}` }));
    return { version: 1, updatedAt: Date.now(), profiles: all.slice(0, MAX_PROFILES), crossDomainLinks: links, recommendedCapabilities: caps };
  }

  public syncFromUnifiedExperience() {
    const recent = unifiedMikiExperienceService.getRecent(120);
    for (const e of recent) this.observe({ domain: e.domain, key: e.action, outcome: e.outcome, verified: e.verified, capabilityIds: e.capabilityIds, concepts: e.concepts.slice(0, 12) });
    return this.getSnapshot();
  }
}

export const mikiUnifiedLearningContinuumService = new MikiUnifiedLearningContinuumService();
