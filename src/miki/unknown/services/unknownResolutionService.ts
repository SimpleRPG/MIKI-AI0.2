import { storageService } from '../../../services/storageService';

const KEY = 'miki_unknown_resolution_v2';

export interface UnknownResolutionAttempt {
  route: string;
  query?: string;
  provider?: string;
  resultCount?: number;
  evidenceIds?: string[];
  failureReason?: string;
  attemptedAt: number;
}

export interface UnknownResolutionItem {
  id: string;
  question: string;
  classification: string;
  routes: string[];
  budget: number;
  attempts: number;
  attemptHistory: UnknownResolutionAttempt[];
  evidenceIds: string[];
  experienceIds: string[];
  capabilityGapIds: string[];
  knowledgeGapIds: string[];
  claimIds: string[];
  status: 'OPEN' | 'RESOLVED' | 'BLOCKED';
  confidence: number;
  verificationStatus: 'UNVERIFIED' | 'SUPPORTED' | 'CONFLICTED' | 'STALE';
  createdAt: number;
  updatedAt: number;
  currentRoute?: string;
  answer?: string;
  resolvedAt?: number;
  blockedReason?: string;
}

export class UnknownResolutionService {
  private xs: UnknownResolutionItem[] = [];
  private persistenceError?: string;

  constructor() {
    this.load();
  }

  open(question: string, budget = 6): UnknownResolutionItem {
    const existing = this.findReusable(question);
    if (existing) return existing;
    const now = Date.now();
    const x: UnknownResolutionItem = {
      id: `UNK-${now}`,
      question,
      classification: this.classify(question),
      routes: ['SOURCE', 'CODE', 'TEST', 'WEB', 'TOOL', 'USER', 'STOP'],
      budget,
      attempts: 0,
      attemptHistory: [],
      evidenceIds: [],
      experienceIds: [],
      capabilityGapIds: [],
      knowledgeGapIds: [],
      claimIds: [],
      status: 'OPEN',
      confidence: 0,
      verificationStatus: 'UNVERIFIED',
      createdAt: now,
      updatedAt: now,
    };
    this.xs.push(x);
    this.save();
    return x;
  }

  attempt(id: string, route: string, result?: string, meta?: any): UnknownResolutionItem | undefined {
    const x = this.xs.find((y) => y.id === id);
    if (!x || x.status !== 'OPEN') return x;
    x.attempts++;
    x.currentRoute = route;
    x.updatedAt = Date.now();
    x.attemptHistory.push({
      route,
      query: meta?.query,
      provider: meta?.provider,
      resultCount: meta?.resultCount,
      evidenceIds: meta?.evidenceIds || [],
      failureReason: meta?.failureReason,
      attemptedAt: Date.now(),
    });
    x.evidenceIds = Array.from(new Set([...x.evidenceIds, ...(meta?.evidenceIds || [])]));
    if (result) {
      x.answer = result;
      x.status = 'RESOLVED';
      x.confidence = Math.max(x.confidence, 0.45);
      x.resolvedAt = Date.now();
    } else if (x.attempts >= x.budget) {
      x.status = 'BLOCKED';
      x.blockedReason = meta?.failureReason || '試行予算を使い切りました';
    }
    this.save();
    return x;
  }

  link(id: string, links: { experienceIds?: string[]; capabilityGapIds?: string[]; knowledgeGapIds?: string[]; claimIds?: string[]; evidenceIds?: string[] }): UnknownResolutionItem | undefined {
    const x = this.xs.find((y) => y.id === id);
    if (!x) return;
    x.experienceIds = Array.from(new Set([...x.experienceIds, ...(links.experienceIds || [])]));
    x.capabilityGapIds = Array.from(new Set([...x.capabilityGapIds, ...(links.capabilityGapIds || [])]));
    x.knowledgeGapIds = Array.from(new Set([...x.knowledgeGapIds, ...(links.knowledgeGapIds || [])]));
    x.claimIds = Array.from(new Set([...x.claimIds, ...(links.claimIds || [])]));
    x.evidenceIds = Array.from(new Set([...x.evidenceIds, ...(links.evidenceIds || [])]));
    x.updatedAt = Date.now();
    this.save();
    return x;
  }

  markVerification(id: string, status: 'UNVERIFIED' | 'SUPPORTED' | 'CONFLICTED' | 'STALE', confidence: number): UnknownResolutionItem | undefined {
    const x = this.xs.find((y) => y.id === id);
    if (!x) return;
    x.verificationStatus = status;
    x.confidence = Math.max(0, Math.min(1, confidence));
    x.updatedAt = Date.now();
    this.save();
    return x;
  }

  get(id: string): UnknownResolutionItem | undefined {
    return this.xs.find((x) => x.id === id);
  }

  list(limit = 100): UnknownResolutionItem[] {
    return this.xs.slice(-Math.max(1, limit)).reverse();
  }

  findReusable(question: string): UnknownResolutionItem | undefined {
    const key = this.normalize(question);
    return [...this.xs]
      .reverse()
      .find(
        (x) =>
          x.status === 'RESOLVED' &&
          x.verificationStatus === 'SUPPORTED' &&
          (this.normalize(x.question) === key || this.similarity(x.question, question) >= 0.72)
      );
  }

  shouldRetryQuery(id: string, query: string, provider?: string): boolean {
    const x = this.xs.find((y) => y.id === id);
    if (!x) return true;
    const now = Date.now();
    return !x.attemptHistory.some(
      (a) =>
        a.route === 'WEB' &&
        this.normalize(a.query || '') === this.normalize(query) &&
        (a.provider || '') === (provider || '') &&
        !!a.failureReason &&
        now - a.attemptedAt < 30 * 60 * 1000
    );
  }

  shouldAskUser(x: UnknownResolutionItem): boolean {
    return x.status === 'OPEN' && x.routes.includes('USER') && x.attempts >= 4 && x.attempts < x.budget;
  }

  classify(q: string): string {
    if (/古い|最新|現在|バージョン/.test(q)) return 'STALE_INFORMATION';
    if (/矛盾|違う|一致しない/.test(q)) return 'CONFLICTING_EVIDENCE';
    if (/コード|ファイル|関数|VBA|TypeScript/.test(q)) return 'MISSING_CODE_CONTEXT';
    if (/テスト|検証/.test(q)) return 'MISSING_TEST';
    if (/できない|未対応|能力/.test(q)) return 'MISSING_CAPABILITY';
    if (/どれ|どちら|曖昧/.test(q)) return 'AMBIGUOUS_REQUEST';
    if (/環境|権限|依存/.test(q)) return 'ENVIRONMENT_BLOCKED';
    if (/とは|って何|意味/.test(q)) return 'UNKNOWN_TERM';
    return 'MISSING_FACT';
  }

  normalize(v: string): string {
    return v
      .toLowerCase()
      .replace(/[\s、。,.!?！？・]/g, '')
      .replace(/とは|って何|について|教えて/g, '')
      .slice(0, 240);
  }

  similarity(a: string, b: string): number {
    const ta = new Set(this.tokens(a));
    const tb = new Set(this.tokens(b));
    if (!ta.size || !tb.size) return 0;
    let common = 0;
    for (const x of ta) if (tb.has(x)) common++;
    return common / Math.max(ta.size, tb.size);
  }

  tokens(v: string): string[] {
    const n = this.normalize(v);
    const out: string[] = [];
    for (let i = 0; i < Math.max(1, n.length - 1); i++) out.push(n.slice(i, i + 2));
    return out;
  }

  load(): void {
    try {
      const r = storageService.getItem(KEY) || storageService.getItem('miki_unknown_resolution_v1');
      if (r) {
        const a = JSON.parse(r);
        this.xs = (Array.isArray(a) ? a : []).map((x: any) => ({
          ...x,
          classification: x.classification || this.classify(x.question || ''),
          attemptHistory: x.attemptHistory || [],
          evidenceIds: x.evidenceIds || [],
          experienceIds: x.experienceIds || [],
          capabilityGapIds: x.capabilityGapIds || [],
          knowledgeGapIds: x.knowledgeGapIds || [],
          claimIds: x.claimIds || [],
          confidence: x.confidence || 0,
          verificationStatus: x.verificationStatus || 'UNVERIFIED',
          updatedAt: x.updatedAt || x.createdAt || Date.now(),
        }));
      }
    } catch {
      this.xs = [];
    }
  }

  async ensurePersistent(): Promise<{ persisted: boolean; backend?: string; error?: string }> {
    const backend = (storageService as any).getBackendName?.() || 'unknown';
    if (backend === 'memory') return { persisted: false, backend, error: 'MEMORY_ONLY' };
    try {
      await (storageService as any).flushNow?.();
      return { persisted: true, backend };
    } catch (error) {
      return { persisted: false, backend, error: String(error) };
    }
  }

  getPersistenceStatus(): { persisted: boolean; error?: string } {
    return { persisted: !this.persistenceError, error: this.persistenceError };
  }

  save(): void {
    try {
      storageService.setItem(KEY, JSON.stringify(this.xs.slice(-500)));
      this.persistenceError = undefined;
    } catch (error) {
      this.persistenceError = String(error);
      console.error('[UnknownResolution] persistence failed', error);
    }
  }
}

export const unknownResolutionService = new UnknownResolutionService();
