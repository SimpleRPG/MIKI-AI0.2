import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256Object } from '../../core/services/canonicalSha256Service';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { evidenceService } from '../../memory/services/evidenceService';

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
  /**
   * P479: 未検証 Claim から抽出した「仮の関係」。事実としては扱わず
   * （仮説生成には使わない）、調査・検証の当たりを付ける地図として
   * 保持する。検証済み Claim が同じ関係を支持したら確定へ昇格する。
   */
  provisional?: boolean;
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

/**
 * P478: 部品と実体の橋。Claim（知っていること）と部品（できること）は
 * 台帳も検証の物差しも別だが、実行の瞬間には結びついていなければ
 * ならない。このリンクは「この部品は、この実体（の振る舞い・用途）に
 * 関わる」という対応で、由来は2通り:
 * - KNOWLEDGE_REF: 部品の検証記録にある knowledge=<id> 参照（末尾
 *   セグメントを概念実体として登録してリンク）
 * - TEXT_MATCH: 既存の実体名が部品の名前・目的・検証記録などに現れる
 * リンクは同期のたびに現在の部品台帳から作り直す（陳腐化させない）。
 */
export interface WorldComponentLink {
  componentId: string;
  componentName: string;
  entityName: string;
  basis: 'KNOWLEDGE_REF' | 'TEXT_MATCH';
  matchedText: string;
  componentStatus: string;
  /**
   * P479: リンクの強さ。CONFIRMED は「実体が確定した関係に属し、部品
   * も CLOUD_TESTED 以上」の両端とも裏付けがある場合のみ。それ以外
   * （名前一致だけ、知識が未検証、部品が未検証）は PROVISIONAL＝
   * 「かも」のリンクとして区別し、検証・調査の手がかりに使う。
   */
  strength: 'CONFIRMED' | 'PROVISIONAL';
  updatedAt: number;
}

export interface WorldComponentHit {
  componentId: string;
  componentName: string;
  componentStatus: string;
  entityName: string;
  basis: 'KNOWLEDGE_REF' | 'TEXT_MATCH';
  strength: 'CONFIRMED' | 'PROVISIONAL';
  /** 関係経由で見つかった場合、起点になった実体名。直接リンクでは無し。 */
  viaEntity?: string;
}

interface WorldModelState {
  entities: WorldEntity[];
  relations: WorldRelation[];
  hypotheses: WorldHypothesisRecord[];
  componentLinks: WorldComponentLink[];
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
          componentLinks: Array.isArray(p.componentLinks) ? p.componentLinks : [],
        };
        return this.state;
      }
    } catch { /* 破損時は空から始める */ }
    this.state = { entities: [], relations: [], hypotheses: [], componentLinks: [] };
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
    provisional?: boolean;
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
      // P479: 仮の関係が検証済みの裏付けを得たら確定へ昇格させる。
      if (existing.provisional && params.provisional !== true) {
        existing.provisional = false;
        existing.confidence = Math.max(existing.confidence, params.confidence ?? 0.8);
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
      confidence: params.confidence ?? (params.provisional ? 0.3 : 0.8),
      createdAt: Date.now(),
      ...(params.provisional ? { provisional: true } : {}),
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

  // ------------------------------------------------------------------
  // P478: 知識（Claim）と部品の橋
  // ------------------------------------------------------------------

  public componentLinks(): WorldComponentLink[] {
    return [...(this.load().componentLinks || [])];
  }

  /**
   * 現在の部品台帳から、部品—実体リンクを作り直す。REJECTED の部品は
   * 除外。1部品あたり最大8リンク（長い実体名を優先し、部分一致の
   * 誤爆を抑える）。
   */
  public syncComponentLinks(): { components: number; links: number } {
    const state = this.load();
    const components = (componentRegistryService.getAllComponents() as any[]).filter(
      (c) => c && c.component_id && c.status !== 'REJECTED',
    );
    const entityNames = state.entities
      .map((e) => e.name)
      .filter((n) => n.length >= 2)
      .sort((a, b) => b.length - a.length);
    // P479: 確定した関係に属する実体（＝知識側が裏付け済みの実体）。
    const confirmedEntities = new Set<string>();
    for (const r of state.relations) {
      if (r.provisional) continue;
      confirmedEntities.add(r.from);
      confirmedEntities.add(r.to);
    }
    const componentVerifiedish = (status: string): boolean =>
      status === 'VERIFIED' || status === 'DEVICE_TESTED' || status === 'CLOUD_TESTED';
    const next: WorldComponentLink[] = [];
    const now = Date.now();
    for (const comp of components) {
      const text = [
        comp.component_id,
        comp.name,
        comp.purpose,
        comp.description,
        comp.validation_txt,
        comp.history_txt,
        Array.isArray(comp.appliesWhen) ? comp.appliesWhen.join(' ') : '',
      ]
        .map((v) => String(v || ''))
        .join('\n');
      const linked = new Set<string>();
      const push = (entityName: string, basis: WorldComponentLink['basis'], matchedText: string) => {
        if (linked.has(entityName) || linked.size >= 8) return;
        linked.add(entityName);
        next.push({
          componentId: String(comp.component_id),
          componentName: String(comp.name || comp.component_id),
          entityName,
          basis,
          matchedText,
          componentStatus: String(comp.status || ''),
          // P479: 両端（知識・部品）とも裏付けがある場合だけ CONFIRMED。
          strength:
            confirmedEntities.has(entityName) && componentVerifiedish(String(comp.status || ''))
              ? 'CONFIRMED'
              : 'PROVISIONAL',
          updatedAt: now,
        });
      };
      // KNOWLEDGE_REF: knowledge=<id> の末尾セグメントを概念実体にする
      const knowledgeRefs = new Set<string>();
      for (const m of text.matchAll(/knowledge=([a-zA-Z0-9._-]+)/g)) knowledgeRefs.add(m[1]);
      for (const ref of knowledgeRefs) {
        const segment = ref.split('.').pop() || ref;
        const entity = this.registerEntity(segment);
        if (entity) push(entity.name, 'KNOWLEDGE_REF', ref);
      }
      // TEXT_MATCH: 既存の実体名が部品のテキストに現れる
      for (const name of entityNames) {
        if (linked.size >= 8) break;
        if (text.includes(name)) push(name, 'TEXT_MATCH', name);
      }
    }
    state.componentLinks = next;
    this.save();
    if (next.length > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `🌐🧩 [WorldModel] 部品—知識リンクを同期: 部品${components.length}件中リンク${next.length}件`);
    }
    return { components: components.length, links: next.length };
  }

  /**
   * 実体に関わる部品を引く。直接リンクに加え、関係で隣り合う実体に
   * リンクされた部品も「関係経由（viaEntity）」として候補に入れる。
   * 並びは直接リンク優先、次に部品の検証段階が高い順。
   */
  public componentsForEntity(entityName: string): WorldComponentHit[] {
    const state = this.load();
    const links = state.componentLinks || [];
    const hits = new Map<string, WorldComponentHit>();
    const addHits = (name: string, via?: string) => {
      for (const link of links) {
        if (link.entityName !== name) continue;
        const hit: WorldComponentHit = {
          componentId: link.componentId,
          componentName: link.componentName,
          componentStatus: link.componentStatus,
          entityName: name,
          basis: link.basis,
          strength: link.strength || 'PROVISIONAL',
          ...(via ? { viaEntity: via } : {}),
        };
        const prev = hits.get(link.componentId);
        if (!prev || (prev.viaEntity && !via)) hits.set(link.componentId, hit);
      }
    };
    addHits(entityName);
    const neighbors = new Set<string>();
    for (const r of state.relations) {
      if (r.from === entityName) neighbors.add(r.to);
      if (r.to === entityName) neighbors.add(r.from);
    }
    for (const n of neighbors) addHits(n, entityName);
    const rank = (s: string): number =>
      ({ VERIFIED: 0, DEVICE_TESTED: 1, CLOUD_TESTED: 2, ANALYZED: 3, CANDIDATE: 4, COLLECTED: 5 } as Record<string, number>)[s] ?? 6;
    return [...hits.values()].sort(
      (a, b) =>
        (a.viaEntity ? 1 : 0) - (b.viaEntity ? 1 : 0) ||
        (a.strength === 'CONFIRMED' ? 0 : 1) - (b.strength === 'CONFIRMED' ? 0 : 1) ||
        rank(a.componentStatus) - rank(b.componentStatus) ||
        a.componentId.localeCompare(b.componentId),
    );
  }

  /** Claim から、その知識を実装する部品を引く（Claim→関係→実体→部品）。 */
  public componentsForClaim(claimId: string): WorldComponentHit[] {
    const state = this.load();
    const entities = new Set<string>();
    for (const r of state.relations) {
      if (r.sourceClaimIds.includes(claimId)) {
        entities.add(r.from);
        entities.add(r.to);
      }
    }
    const byId = new Map<string, WorldComponentHit>();
    for (const name of entities) {
      for (const hit of this.componentsForEntity(name)) {
        if (!byId.has(hit.componentId)) byId.set(hit.componentId, hit);
      }
    }
    return [...byId.values()];
  }

  /** 部品から、その根拠になっている知識（Claim）を引く（部品→実体→関係→Claim）。 */
  public claimsForComponent(componentId: string): Array<{ claimId: string; statement: string; status: string }> {
    const state = this.load();
    const entities = new Set(
      (state.componentLinks || []).filter((l) => l.componentId === componentId).map((l) => l.entityName),
    );
    const claimIds = new Set<string>();
    for (const r of state.relations) {
      if (entities.has(r.from) || entities.has(r.to)) {
        for (const id of r.sourceClaimIds) claimIds.add(id);
      }
    }
    return [...claimIds].map((id) => {
      const claim: any = claimDatabaseService.getClaim(id);
      return {
        claimId: id,
        statement: claim ? String(claim.statement || '') : '',
        status: claim ? String(claim.status || '') : '',
      };
    });
  }

  /** 目標テキストに実体名が含まれる部品候補（計画層が使う素朴な入口）。 */
  public suggestComponentsForGoal(goalText: string): WorldComponentHit[] {
    const state = this.load();
    const byId = new Map<string, WorldComponentHit>();
    for (const e of state.entities) {
      if (e.name.length < 2 || !goalText.includes(e.name)) continue;
      for (const hit of this.componentsForEntity(e.name)) {
        if (!byId.has(hit.componentId)) byId.set(hit.componentId, hit);
      }
    }
    return [...byId.values()];
  }

  /**
   * 能力計画のスコア付け用: 目標に現れる実体へリンクされた部品への
   * 加点表。CONFIRMED の直接リンク 25、関係経由 12（既存の知識
   * ブーストと同程度の「候補に割り込む」強さに留め、支配はしない）。
   * P479: PROVISIONAL（仮）リンクは弱く効かせる（直接 10、経由 5）。
   * 計画が拾うのは VERIFIED 部品だけなので、仮リンクの加点は
   * 「検証済み部品同士の並び替え」にしか作用しない。
   */
  public rankComponentsForGoal(goalText: string): Map<string, number> {
    const state = this.load();
    const boost = new Map<string, number>();
    for (const e of state.entities) {
      if (e.name.length < 2 || !goalText.includes(e.name)) continue;
      for (const hit of this.componentsForEntity(e.name)) {
        const value =
          hit.strength === 'CONFIRMED' ? (hit.viaEntity ? 12 : 25) : hit.viaEntity ? 5 : 10;
        boost.set(hit.componentId, Math.max(boost.get(hit.componentId) || 0, value));
      }
    }
    return boost;
  }

  /**
   * P479: 検証・調査のリード（当たり）。仮リンクは「ここを確かめれば
   * 橋が確定する」場所を示す:
   * - claimsNearComponents: 部品に繋がっているのに未検証の知識。
   *   これを裏付ければ、知識と部品の両方が確定側に寄る。
   * - componentsNearKnowledge: 知識は確定しているのに部品が未検証。
   *   カナリア（実機確認）の優先候補。
   */
  public verificationLeads(limit = 20): {
    claimsNearComponents: Array<{ claimId: string; statement: string; componentIds: string[] }>;
    componentsNearKnowledge: Array<{ componentId: string; componentName: string; componentStatus: string; entityNames: string[] }>;
  } {
    const state = this.load();
    const links = state.componentLinks || [];
    const confirmedEntities = new Set<string>();
    for (const r of state.relations) {
      if (r.provisional) continue;
      confirmedEntities.add(r.from);
      confirmedEntities.add(r.to);
    }

    const componentLeads = new Map<string, { componentName: string; componentStatus: string; entityNames: Set<string> }>();
    for (const link of links) {
      if (link.strength !== 'PROVISIONAL') continue;
      if (!confirmedEntities.has(link.entityName)) continue;
      if (link.componentStatus === 'VERIFIED') continue;
      const entry =
        componentLeads.get(link.componentId) ||
        { componentName: link.componentName, componentStatus: link.componentStatus, entityNames: new Set<string>() };
      entry.entityNames.add(link.entityName);
      componentLeads.set(link.componentId, entry);
    }

    const claimLeads = new Map<string, Set<string>>();
    for (const r of state.relations) {
      if (!r.provisional) continue;
      const componentIds = new Set<string>();
      for (const hit of this.componentsForEntity(r.from)) componentIds.add(hit.componentId);
      for (const hit of this.componentsForEntity(r.to)) componentIds.add(hit.componentId);
      if (componentIds.size === 0) continue;
      for (const claimId of r.sourceClaimIds) {
        const claim: any = claimDatabaseService.getClaim(claimId);
        if (!claim || claim.status !== 'UNVERIFIED') continue;
        const entry = claimLeads.get(claimId) || new Set<string>();
        for (const id of componentIds) entry.add(id);
        claimLeads.set(claimId, entry);
      }
    }

    return {
      claimsNearComponents: [...claimLeads.entries()].slice(0, limit).map(([claimId, componentIds]) => {
        const claim: any = claimDatabaseService.getClaim(claimId);
        return {
          claimId,
          statement: claim ? String(claim.statement || '') : '',
          componentIds: [...componentIds],
        };
      }),
      componentsNearKnowledge: [...componentLeads.entries()].slice(0, limit).map(([componentId, entry]) => ({
        componentId,
        componentName: entry.componentName,
        componentStatus: entry.componentStatus,
        entityNames: [...entry.entityNames],
      })),
    };
  }

  private static readonly RELATION_PATTERNS: Array<{ type: WorldRelationType; regex: RegExp }> = [
    { type: 'IS_A', regex: /^(.{1,30}?)は(.{1,30}?)の一種/ },
    { type: 'IS_A', regex: /^(.{1,30}?)は(.{1,30}?)の仲間/ },
    { type: 'USED_FOR', regex: /^(.{1,30}?)は(.{1,30}?)に使われ/ },
    { type: 'USED_FOR', regex: /^(.{1,30}?)は(.{1,30}?)用(?:の|だ|で)/ },
    { type: 'CAUSES', regex: /^(.{1,30}?)が原因で(.{1,30}?)が/ },
    { type: 'CAUSES', regex: /^(.{1,30}?)すると(.{1,30}?)になる/ },
    { type: 'PART_OF', regex: /^(.{1,30}?)は(.{1,30}?)の一部/ },
    { type: 'ENABLES', regex: /^(.{1,30}?)は(.{1,30}?)を可能に/ },
  ];

  private extractFromClaims(claims: any[], provisional: boolean): number {
    let added = 0;
    for (const claim of claims) {
      const statement = String(claim.statement || '').replace(/。$/, '');
      for (const { type, regex } of WorldModelGraphService.RELATION_PATTERNS) {
        const match = statement.match(regex);
        if (!match) continue;
        const before = this.load().relations.length;
        const relation = this.addRelation({
          fromName: match[1],
          toName: match[2],
          type,
          sourceClaimId: claim.claim_id,
          provisional,
        });
        if (relation && this.load().relations.length > before) added++;
        break;
      }
    }
    return added;
  }

  /**
   * Claim の文面から、型つき関係を決定論的に抽出する。
   *
   * 確定パス（従来どおり）: 検証済み Claim だけを世界の事実として
   * 取り込む。
   *
   * P479 仮パス: 未検証 Claim からも「仮の関係」を抽出して地図に
   * 載せる。ただし無差別には載せない（未検証の在庫にはノイズが
   * 多い）: 出所が web_search 以外（会話・教師・運用由来）か、
   * ADMISSIBLE な証拠が付いている Claim に限る。仮の関係は仮説
   * 生成には使わず、予測では「仮」と明示して確信度を半分にする。
   * 役割は、調査・検証の当たりを付けることと、部品との仮リンクで
   * 「どこを確かめれば橋が確定するか」を見えるようにすること。
   * 仮の関係の総数は上限（800）で抑える。
   */
  public extractRelationsFromClaims(): { added: number; scanned: number; provisionalAdded: number; provisionalScanned: number } {
    const all = claimDatabaseService.getAllClaims().filter((c: any) => c);
    const verified = all.filter((c: any) => c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED');
    const added = this.extractFromClaims(verified as any[], false);

    const admissibleCache = new Map<string, boolean>();
    const hasAdmissible = (claimId: string): boolean => {
      const cached = admissibleCache.get(claimId);
      if (cached !== undefined) return cached;
      let result = false;
      try {
        result = evidenceService.list({ claimId }).some((e) => e.status === 'ADMISSIBLE');
      } catch { /* 証拠が読めなければ仮パスには載せない */ }
      admissibleCache.set(claimId, result);
      return result;
    };
    const provisionalCount = this.load().relations.filter((r) => r.provisional).length;
    const provisionalCandidates =
      provisionalCount >= 800
        ? []
        : all.filter(
            (c: any) =>
              c.status === 'UNVERIFIED' &&
              ((c.source && c.source !== 'web_search') || hasAdmissible(c.claim_id)),
          );
    const provisionalAdded = this.extractFromClaims(provisionalCandidates as any[], true);

    if (added > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `🌐 [WorldModel] 検証済みClaimから関係を${added}件抽出（実体${this.load().entities.length}件・関係${this.load().relations.length}件）`);
    }
    if (provisionalAdded > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `🌐 [WorldModel] 未検証Claimから仮の関係を${provisionalAdded}件抽出（調査・検証の当たり付け用）`);
    }
    // P478: 世界が育つたびに部品との橋も張り直す（定期経路に相乗り）。
    try {
      this.syncComponentLinks();
    } catch { /* 橋の同期失敗は抽出を止めない */ }
    return { added, scanned: verified.length, provisionalAdded, provisionalScanned: provisionalCandidates.length };
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

    // P479: 仮説は確定した関係からのみ生成する（仮×仮の増殖を防ぐ）。
    const isA = state.relations.filter((r) => r.type === 'IS_A' && !r.provisional);
    const others = state.relations.filter((r) => r.type !== 'IS_A' && !r.provisional);

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
  public predict(entityName: string, maxDepth = 2): Array<{ entity: string; path: string[]; type: WorldRelationType; confidence: number; provisional: boolean }> {
    const state = this.load();
    const results: Array<{ entity: string; path: string[]; type: WorldRelationType; confidence: number; provisional: boolean }> = [];
    const queue: Array<{ name: string; path: string[]; confidence: number; depth: number; provisional: boolean }> = [
      { name: entityName, path: [entityName], confidence: 1, depth: 0, provisional: false },
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
        // P479: 仮の関係を通る予測は「仮」と明示し、確信度を半分にする。
        const provisional = current.provisional || relation.provisional === true;
        const confidence = current.confidence * relation.confidence * (relation.provisional ? 0.5 : 1);
        const path = [...current.path, relation.to];
        results.push({ entity: relation.to, path, type: relation.type, confidence, provisional });
        queue.push({ name: relation.to, path, confidence, depth: current.depth + 1, provisional });
      }
    }
    return results;
  }

  /**
   * P478: 予測に「使える部品」を付けて返す。「木を殴るとどうなる？」
   * への予測（果物が落ちる）と、それを担える部品が、知識と道具の橋を
   * 渡って一組で返る。予測がモデルの推測である点は predict と同じ。
   */
  public predictWithComponents(
    entityName: string,
    maxDepth = 2,
  ): {
    entity: string;
    components: WorldComponentHit[];
    predictions: Array<{ entity: string; path: string[]; type: WorldRelationType; confidence: number; provisional: boolean; components: WorldComponentHit[] }>;
  } {
    const predictions = this.predict(entityName, maxDepth);
    return {
      entity: entityName,
      components: this.componentsForEntity(entityName),
      predictions: predictions.map((p) => ({ ...p, components: this.componentsForEntity(p.entity) })),
    };
  }
}

export const worldModelGraphService = new WorldModelGraphService();
