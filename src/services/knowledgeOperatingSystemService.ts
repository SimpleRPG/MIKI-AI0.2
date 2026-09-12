import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

/** 第62章: 知識オペレーティングシステム
 * 「知識」を単一の真実レコードにせず、出典・主張・根拠・概念・関係・手順・条件・反例・評価問題へ分離する。
 */
export type KnowledgeObjectType =
  | 'SOURCE' | 'CLAIM' | 'EVIDENCE' | 'CONCEPT' | 'RELATION'
  | 'PROCEDURE' | 'CONDITION' | 'COUNTEREXAMPLE' | 'EVALUATION_QUESTION';

export interface KnowledgeObject {
  id: string;
  type: KnowledgeObjectType;
  title: string;
  content: string;
  sourceIds: string[];
  evidenceIds: string[];
  dependsOn: string[];
  replaces: string[];
  replacedBy?: string;
  conditions: string[];
  confidence: number;
  freshness: number;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, string | number | boolean>;
}

const KEY = 'miki_knowledge_os_v1';

export class KnowledgeOperatingSystemService {
  private objects = new Map<string, KnowledgeObject>();
  private counter = 1;

  constructor() { this.load(); }

  private load(): void {
    try {
      const raw = storageService.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) for (const o of parsed) if (o?.id && o?.type) this.objects.set(o.id, o);
      this.counter = this.objects.size + 1;
    } catch { this.objects.clear(); }
  }

  private save(): void {
    storageService.setItem(KEY, JSON.stringify([...this.objects.values()].slice(-5000)));
  }

  public register(input: Omit<KnowledgeObject, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): KnowledgeObject {
    const now = Date.now();
    const id = input.id || `KOS-${String(this.counter++).padStart(7, '0')}`;
    const object: KnowledgeObject = {
      ...input,
      id,
      sourceIds: [...new Set(input.sourceIds || [])],
      evidenceIds: [...new Set(input.evidenceIds || [])],
      dependsOn: [...new Set(input.dependsOn || [])],
      replaces: [...new Set(input.replaces || [])],
      conditions: [...new Set(input.conditions || [])],
      confidence: Math.max(0, Math.min(1, input.confidence ?? 0)),
      freshness: Math.max(0, Math.min(1, input.freshness ?? 1)),
      createdAt: now,
      updatedAt: now,
    };
    this.objects.set(id, object);
    this.save();
    return object;
  }

  public link(fromId: string, toId: string, relation: 'DEPENDS_ON' | 'REPLACES' | 'SUPPORTED_BY' | 'DERIVED_FROM' | 'APPLIES_TO'): boolean {
    const from = this.objects.get(fromId); const to = this.objects.get(toId);
    if (!from || !to || fromId === toId) return false;
    if (relation === 'DEPENDS_ON') from.dependsOn = [...new Set([...from.dependsOn, toId])];
    if (relation === 'REPLACES') { from.replaces = [...new Set([...from.replaces, toId])]; to.replacedBy = fromId; }
    if (relation === 'SUPPORTED_BY') from.evidenceIds = [...new Set([...from.evidenceIds, toId])];
    if (relation === 'DERIVED_FROM') from.sourceIds = [...new Set([...from.sourceIds, toId])];
    if (relation === 'APPLIES_TO') from.conditions = [...new Set([...from.conditions, to.content])];
    from.updatedAt = Date.now(); this.save(); return true;
  }

  public get(id: string): KnowledgeObject | undefined { return this.objects.get(id); }
  public list(type?: KnowledgeObjectType): KnowledgeObject[] {
    return [...this.objects.values()].filter(o => !type || o.type === type);
  }
  public search(query: string, type?: KnowledgeObjectType): KnowledgeObject[] {
    const q = query.trim().toLowerCase(); if (!q) return this.list(type);
    return this.list(type).filter(o => `${o.title} ${o.content} ${o.conditions.join(' ')}`.toLowerCase().includes(q));
  }

  /** 原資料→主張→根拠の鎖が成立しているかを確認する。成立しても真実とは昇格させない。 */
  public provenanceAudit(id: string): { valid: boolean; missing: string[] } {
    const o = this.objects.get(id); if (!o) return { valid: false, missing: ['OBJECT_NOT_FOUND'] };
    const missing: string[] = [];
    if (o.type === 'CLAIM' && o.sourceIds.length === 0) missing.push('SOURCE');
    if (o.type === 'CLAIM' && o.evidenceIds.length === 0) missing.push('EVIDENCE');
    for (const dep of o.dependsOn) if (!this.objects.has(dep)) missing.push(`DEPENDENCY:${dep}`);
    return { valid: missing.length === 0, missing };
  }

  public ageAndRefresh(now = Date.now()): number {
    let changed = 0;
    for (const o of this.objects.values()) {
      const ageDays = Math.max(0, (now - o.updatedAt) / 86400000);
      const next = Math.max(0, Math.min(1, Math.exp(-ageDays / 90)));
      if (Math.abs(next - o.freshness) > 0.01) { o.freshness = next; o.updatedAt = now; changed++; }
    }
    if (changed) { this.save(); systemLogger.info('SELF_IMPROVEMENT', `[第62章 KOS] 鮮度更新: ${changed}件`); }
    return changed;
  }
}

export const knowledgeOperatingSystemService = new KnowledgeOperatingSystemService();
