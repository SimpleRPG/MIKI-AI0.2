/**
 * Hardening -> Regression candidate bridge.
 *
 * 7.3の未来質問/Red Teamで見つかった弱点を「次回回帰試験候補」に変換する。
 * ここではコード生成・実行・VERIFIED化を行わない。候補は明示的なTest Case
 * としてRegression層から利用できるだけで、実行結果がPASSするまで証拠にはならない。
 */
import { storageService } from './storageService';
import { ComponentTestCategory } from '../types';

export interface HardeningRegressionCandidate {
  candidate_id: string;
  source_kind: 'FUTURE_SCENARIO' | 'RED_TEAM';
  source_id: string;
  component_id: string;
  category: ComponentTestCategory;
  description: string;
  expected_summary: string;
  created_at: number;
  status: 'PROPOSED' | 'CONSUMED' | 'REJECTED';
}

const STORAGE_KEY = 'miki_hardening_regression_candidates_v1';

export class HardeningRegressionCandidateService {
  private static instance: HardeningRegressionCandidateService;
  private candidates = new Map<string, HardeningRegressionCandidate>();

  private constructor() { this.load(); }
  public static getInstance(): HardeningRegressionCandidateService {
    if (!this.instance) this.instance = new HardeningRegressionCandidateService();
    return this.instance;
  }

  public propose(params: Omit<HardeningRegressionCandidate, 'candidate_id' | 'created_at' | 'status'>): HardeningRegressionCandidate {
    const existing = this.list().find(c =>
      c.source_kind === params.source_kind &&
      c.source_id === params.source_id &&
      c.component_id === params.component_id
    );
    if (existing) return existing;

    const now = Date.now();
    const candidate: HardeningRegressionCandidate = {
      ...params,
      candidate_id: `HRC-${this.hash(`${params.source_kind}|${params.source_id}|${params.component_id}|${params.description}`)}`,
      created_at: now,
      status: 'PROPOSED',
    };
    this.candidates.set(candidate.candidate_id, candidate);
    this.save();
    return candidate;
  }

  public get(candidateId: string) { return this.candidates.get(candidateId); }
  public list(componentId?: string): HardeningRegressionCandidate[] {
    return Array.from(this.candidates.values())
      .filter(c => !componentId || c.component_id === componentId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  public markConsumed(candidateId: string): boolean {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) return false;
    candidate.status = 'CONSUMED';
    this.save();
    return true;
  }

  private load() {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return;
      const items = JSON.parse(raw) as HardeningRegressionCandidate[];
      if (Array.isArray(items)) for (const item of items) {
        if (item?.candidate_id && item.component_id && item.source_id) this.candidates.set(item.candidate_id, item);
      }
    } catch { this.candidates.clear(); }
  }

  private save() {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(this.list().slice(0, 500))); } catch { /* audit support only */ }
  }

  private hash(raw: string) {
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

export const hardeningRegressionCandidateService = HardeningRegressionCandidateService.getInstance();
