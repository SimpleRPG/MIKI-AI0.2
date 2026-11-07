import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';

/*
 * P465: 世界モデル（実体と型つき関係のグラフ）。
 *
 * 既存の worldModelService は「自分の行動の予測と誤差」のエンジンで、
 * 外の世界（もの・関係・因果）を表す層は無かった。本サービスはその
 * 生成側を担う：
 *
 * - 実体レジストリと、型つき関係（IS_A / PART_OF / CAUSES / ENABLES /
 *   USED_FOR）のグラフを、検証済み Claim から決定論的に抽出して育てる。
 * - 関係のパターンから仮説を生成する（継承：AがBの一種で B が C に
 *   使われるなら、A も C に使われるかもしれない／類推：同じ親を持つ
 *   兄弟の関係を、もう一方にも当てはめてみる）。
 * - 仮説は必ず HYPOTHETICAL の Claim（UNVERIFIED）として登録し、
 *   Knowledge Gap 経由で既存の調査・検証パイプラインに流す。
 *   仮説を事実として保持することはしない（自己証明の禁止と整合）。
 * - predict() は CAUSES / ENABLES の連鎖をたどる「これはどうなるか」
 *   の読み取り専用の予測で、結果は常に「モデルの予測」と分かる形で返す。
 *
 * 調査は「ゼロから」ではなく「予測の確認」から始められるようになる
 * ことが、この層の目的である。
 */

export type WorldRelationType =
  | 'IS_A'
  | 'PART_OF'
  | 'CAUSES'
  | 'ENABLES'
  | 'USED_FOR';

export interface WorldEntity {
  id: string;
  name: string;
  createdAt: number;
}

export interface WorldRelation {
  id: string;
  from: string;
  to: string;
  type: WorldRelationType;
  sourceClaimIds: string[];
  confidence: number;
  createdAt: number;
}

export interface WorldHypothesisRecord {
  key: string;
  from: string;
  to: string;
  type: WorldRelationType;
  basis: 'INHERITANCE' | 'SIBLING_ANALOGY';
  claimId: string;
  gapId: string;
  createdAt: number;
}

interface WorldModelState {
  entities: WorldEntity[];
  relations: WorldRelation[];
  hypotheses: WorldHypothesisRecord[];
}

const STORAGE_KEY = 'miki_world_model_graph_v1';
const MAX_RELATIONS = 2000;
const STOP_ENTITY = /^(これ|それ|あれ|何|なに|もの|こと|ため|よう|はず|つもり)$/;

const STATEMENT_TEMPLATES: Record<WorldRelationType, (from: string, to: string) => string> = {
  IS_A: (from, to) => `${from}は${to}の一種かもしれない`,
  PART_OF: (from, to) => `${from}は${to}の一部かもしれない`,
  CAUSES: (from, to) => `${from}すると${to}になるかもしれない`,
  ENABLES: (from, to) => `${from}は${to}を可能にするかもしれない`,
  USED_FOR: (from, to) => `${from}は${to}に使われるかもしれない`,
};

function entityId(name: string): string {
  return `ENT-${canonicalSha256Object({ name }).slice(0, 16)}`;
}

function relationId(from: string, to: string, type: WorldRelationType): string {
  return `REL-${canonicalSha256Object({ from, to, type }).slice(0, 16)}`;
}

function cleanEntity(raw: string): string | null {
  const name = raw.replace(/^[「『（(\s]+|[」』）)\s。]+$/g, '').trim();
  if (!name || name.length > 30) return null;
  if (STOP_ENTITY.test(name)) return null;
  if (/^(私|僕|俺|あなた|彼|彼女)$/.test(name)) return null;
  return name;
}

class WorldModelGraphService {
  private state: WorldModelState | null = null;

  private load(): WorldModelState {
    if (this.state) return this.state;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Partial<WorldModelState>;
        this.state = {
          entities: Array.isArray(p.entities) ? p.entities : [],
          relations: Array.isArray(p.relations) ? p.relations : [],
          hypotheses: Array.isArray(p.hypotheses) ? p.hypotheses : [],
        };
        return this.state;
      }
    } catch { /* 破損時は空から始める */ }
    this.state = { entities: [], relations: [], hypotheses: [] };
    return this.state;
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.load()));
    } catch { /* 保存失敗は蓄積を止めない */ }
  }

  public registerEntity(name: string): WorldEntity | null {
    const clean = cleanEntity(name);
    if (!clean) return null;
    const state = this.load();
    const id = entityId(clean);
    const existing = state.entities.find((e) => e.id === id);
    if (existing) return existing;
    const entity: WorldEntity = { id, name: clean, createdAt: Date.now() };
    state.entities.push(entity);
    return entity;
  }

  public addRelation(params: {
    fromName: string;
    toName: string;
    type: WorldRelationType;
    sourceClaimId?: string;
    confidence?: number;
  }): WorldRelation | null {
    const from = this.registerEntity(params.fromName);
    const to = this.registerEntity(params.toName);
    if (!from || !to || from.id === to.id) return null;
    const state = this.load();
    const id = relationId(from.name, to.name, params.type);
    const existing = state.relations.find((r) => r.id === id);
    if (existing) {
      if (params.sourceClaimId && !existing.sourceClaimIds.includes(params.sourceClaimId)) {
        existing.sourceClaimIds.push(params.sourceClaimId);
      }
      this.save();
      return existing;
    }
    const relation: WorldRelation = {
      id,
      from: from.name,
      to: to.name,
      type: params.type,
      sourceClaimIds: params.sourceClaimId ? [params.sourceClaimId] : [],
      confidence: params.confidence ?? 0.8,
      createdAt: Date.now(),
    };
    state.relations.push(relation);
    if (state.relations.length > MAX_RELATIONS) {
      state.relations = state.relations.slice(-MAX_RELATIONS);
    }
    this.save();
    return relation;
  }

  public entities(): WorldEntity[] {
    return [...this.load().entities];
  }

  public relations(): WorldRelation[] {
    return [...this.load().relations];
  }

  public relationsOf(entityName: string, type?: WorldRelationType): WorldRelation[] {
    return this.load().relations.filter(
      (r) => (r.from === entityName || r.to === entityName) && (!type || r.type === type),
    );
  }

  /**
   * 検証済み Claim の文面から、型つき関係を決定論的に抽出する。
   * 未検証の主張は世界の事実として取り込まない。
   */
  public extractRelationsFromClaims(): { added: number; scanned: number } {
    const claims = claimDatabaseService
      .getAllClaims()
      .filter((c: any) => c && (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED'));
    let added = 0;
    const patterns: Array<{ type: WorldRelationType; regex: RegExp }> = [
      { type: 'IS_A', regex: /^(.{1,30}?)は(.{1,30}?)の一種/ },
      { type: 'IS_A', regex: /^(.{1,30}?)は(.{1,30}?)の仲間/ },
      { type: 'USED_FOR', regex: /^(.{1,30}?)は(.{1,30}?)に使われ/ },
      { type: 'USED_FOR', regex: /^(.{1,30}?)は(.{1,30}?)用(?:の|だ|で)/ },
      { type: 'CAUSES', regex: /^(.{1,30}?)が原因で(.{1,30}?)が/ },
      { type: 'CAUSES', regex: /^(.{1,30}?)すると(.{1,30}?)になる/ },
      { type: 'PART_OF', regex: /^(.{1,30}?)は(.{1,30}?)の一部/ },
      { type: 'ENABLES', regex: /^(.{1,30}?)は(.{1,30}?)を可能に/ },
    ];
    for (const claim of claims as any[]) {
      const statement = String(claim.statement || '').replace(/。$/, '');
      for (const { type, regex } of patterns) {
        const match = statement.match(regex);
        if (!match) continue;
        const before = this.load().relations.length;
        const relation = this.addRelation({
          fromName: match[1],
          toName: match[2],
          type,
          sourceClaimId: claim.claim_id,
        });
        if (relation && this.load().relations.length > before) added++;
        break;
      }
    }
    if (added > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `🌐 [WorldModel] 検証済みClaimから関係を${added}件抽出（実体${this.load().entities.length}件・関係${this.load().relations.length}件）`);
    }
    return { added, scanned: claims.length };
  }

  /**
   * 関係のパターンから仮説を生成し、検証パイプラインへ流す。
   * 生成した仮説は Claim（HYPOTHETICAL / UNVERIFIED）と Knowledge Gap
   * として登録され、既存の調査が裏付けを担う。
   */
  public generateHypotheses(limit = 5): WorldHypothesisRecord[] {
    this.extractRelationsFromClaims();
    const state = this.load();
    const existingKeys = new Set(state.hypotheses.map((h) => h.key));
    const hasRelation = (from: string, to: string, type: WorldRelationType) =>
      state.relations.some((r) => r.from === from && r.to === to && r.type === type);
    const candidates: Array<{ from: string; to: string; type: WorldRelationType; basis: 'INHERITANCE' | 'SIBLING_ANALOGY' }> = [];

    const isA = state.relations.filter((r) => r.type === 'IS_A');
    const others = state.relations.filter((r) => r.type !== 'IS_A');

    // 継承: A IS_A B かつ B -R-> C なら A -R-> C を仮説にする
    for (const isa of isA) {
      for (const rel of others) {
        if (rel.from !== isa.to) continue;
        if (hasRelation(isa.from, rel.to, rel.type)) continue;
        candidates.push({ from: isa.from, to: rel.to, type: rel.type, basis: 'INHERITANCE' });
      }
    }
    // 類推: A IS_A B かつ A' IS_A B かつ A -R-> C なら A' -R-> C を仮説にする
    for (const isaA of isA) {
      for (const isaB of isA) {
        if (isaA.to !== isaB.to || isaA.from === isaB.from) continue;
        for (const rel of others) {
          if (rel.from !== isaA.from) continue;
          if (hasRelation(isaB.from, rel.to, rel.type)) continue;
          candidates.push({ from: isaB.from, to: rel.to, type: rel.type, basis: 'SIBLING_ANALOGY' });
        }
      }
    }

    const created: WorldHypothesisRecord[] = [];
    for (const candidate of candidates) {
      if (created.length >= limit) break;
      const key = relationId(candidate.from, candidate.to, candidate.type);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      const statement = STATEMENT_TEMPLATES[candidate.type](candidate.from, candidate.to);
      try {
        const claim: any = claimDatabaseService.registerClaim({
          statement,
          world: 'HYPOTHETICAL',
          kind: 'FACT',
          status: 'UNVERIFIED',
          source: 'world_model_graph',
        });
        const gap = knowledgeGapService.detect({
          query: `${candidate.from} ${candidate.to} ${candidate.type === 'CAUSES' ? '因果 効果' : '関係 事実'}`,
          type: candidate.type === 'CAUSES' ? 'UNKNOWN_EFFECT' : 'UNKNOWN_RELATION',
          claimIds: claim?.claim_id ? [claim.claim_id] : [],
          target: candidate.from,
          missingContent: `世界モデルの仮説「${statement}」の裏付け`,
          priority: 40,
        });
        const record: WorldHypothesisRecord = {
          key,
          from: candidate.from,
          to: candidate.to,
          type: candidate.type,
          basis: candidate.basis,
          claimId: claim?.claim_id || '',
          gapId: (gap as any)?.id || '',
          createdAt: Date.now(),
        };
        state.hypotheses.push(record);
        created.push(record);
        systemLogger.info('SELF_IMPROVEMENT', `🌐 [WorldModel] 仮説を生成し検証へ: ${statement}（${candidate.basis}）`);
      } catch { /* 仮説登録の失敗は生成を止めない */ }
    }
    if (created.length > 0) this.save();
    return created;
  }

  /**
   * 「これはどうなるか」の予測。CAUSES / ENABLES の連鎖をたどる。
   * 返るのはモデルの予測であり、事実ではない。
   */
  public predict(entityName: string, maxDepth = 2): Array<{ entity: string; path: string[]; type: WorldRelationType; confidence: number }> {
    const state = this.load();
    const results: Array<{ entity: string; path: string[]; type: WorldRelationType; confidence: number }> = [];
    const queue: Array<{ name: string; path: string[]; confidence: number; depth: number }> = [
      { name: entityName, path: [entityName], confidence: 1, depth: 0 },
    ];
    const seen = new Set<string>([entityName]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;
      for (const relation of state.relations) {
        if (relation.from !== current.name) continue;
        if (relation.type !== 'CAUSES' && relation.type !== 'ENABLES') continue;
        if (seen.has(relation.to)) continue;
        seen.add(relation.to);
        const confidence = current.confidence * relation.confidence;
        const path = [...current.path, relation.to];
        results.push({ entity: relation.to, path, type: relation.type, confidence });
        queue.push({ name: relation.to, path, confidence, depth: current.depth + 1 });
      }
    }
    return results;
  }
}

export const worldModelGraphService = new WorldModelGraphService();
