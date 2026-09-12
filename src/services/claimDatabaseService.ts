import {
  ClaimRecord,
  ClaimWorld,
  ClaimKind,
  ClaimVerificationStatus,
  ClaimMaturity,
  ClaimSelfProvenance,
  ClaimOpenWorldStatus,
  ClaimScope,
} from '../types';
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

const CLAIMS_STORAGE_KEY = 'miki_claim_db_v1';

/**
 * 主張間の関係リンク
 */
export interface ClaimRelation {
  source_claim_id: string;
  target_claim_id: string;
  relation: 'SUPPORTS' | 'CONTRADICTS' | 'PREREQUISITE_FOR' | 'REFINES' | 'SUPERSEDES' | 'ALTERNATIVE_TO';
  weight: number;
}

/**
 * 非LLM中心・自己成長型AIコンパニオン 設計思想指示書(統合版) 第6章
 * 「事実DB」ではなく「主張(claim)DB」
 * 
 * すべてを1つの事実DBに統合して信じることを禁止し、
 * 主張ごとに 世界区分、性質、検証状態、スコープ、出典、成熟度を厳密に管理する。
 */
export class ClaimDatabaseService {
  private static instance: ClaimDatabaseService;
  private claims: Map<string, ClaimRecord> = new Map();
  private relations: ClaimRelation[] = [];
  private counter: number = 1;

  private constructor() {
    this.loadFromStorage();
    this.migrateLegacySeedVerification();
    if (this.claims.size === 0) {
      this.initSeedClaims();
    }
  }

  public static getInstance(): ClaimDatabaseService {
    if (!ClaimDatabaseService.instance) {
      ClaimDatabaseService.instance = new ClaimDatabaseService();
    }
    return ClaimDatabaseService.instance;
  }

  /**
   * シード主張データの初期化 (設計思想 6.2節・14章の実例を包含)
   */
  private initSeedClaims(): void {
    const seedClaims: ClaimRecord[] = [
      {
        claim_id: 'CLM-000001',
        statement: '特定条件で長い入力時にDevice Lostが発生する',
        world: 'REAL',
        kind: 'OBSERVATION',
        status: 'UNVERIFIED',
        scope: { device: 'Galaxy S25', environment: 'Termux', backend: 'Vulkan' },
        source: 'user_observation',
        origin_source_id: 'src_log_vulkan_crash',
        independence_cluster_id: 'cluster_local_device',
        maturity: 'REPRODUCED',
        self_provenance: 'NONE',
        open_world_status: 'SEARCH_INCOMPLETE',
        created_at: Date.now() - 3600000 * 24,
        updated_at: Date.now() - 3600000 * 24,
      },
      {
        claim_id: 'CLM-000002',
        statement: 'VBAでセルを1つずつループ処理すると実行速度が著しく低下する',
        world: 'REAL',
        kind: 'FACT_CLAIM',
        status: 'UNVERIFIED',
        scope: { environment: 'Excel', runtime: 'VBA' },
        source: 'technical_benchmark',
        origin_source_id: 'ms_docs_vba_performance',
        independence_cluster_id: 'cluster_ms_official',
        maturity: 'MATURE',
        self_provenance: 'NONE',
        open_world_status: 'SEARCH_INCOMPLETE',
        created_at: Date.now() - 3600000 * 48,
        updated_at: Date.now() - 3600000 * 48,
      },
      {
        claim_id: 'CLM-000003',
        statement: '配列に一括代入してメモリ上で処理すると10倍以上高速化する',
        world: 'REAL',
        kind: 'FACT_CLAIM',
        status: 'UNVERIFIED',
        scope: { environment: 'Excel', runtime: 'VBA' },
        source: 'technical_benchmark',
        origin_source_id: 'ms_docs_vba_performance',
        independence_cluster_id: 'cluster_ms_official',
        maturity: 'MATURE',
        self_provenance: 'NONE',
        open_world_status: 'SEARCH_INCOMPLETE',
        created_at: Date.now() - 3600000 * 48,
        updated_at: Date.now() - 3600000 * 48,
      },
      {
        claim_id: 'CLM-000004',
        statement: '火星に秘密の軍事基地が存在し宇宙海賊と戦っている',
        world: 'FICTION',
        kind: 'FICTIONAL_STATEMENT',
        status: 'CONTEXT_ONLY',
        scope: { conditions: { context: 'user_creative_story' } },
        source: 'user_prompt',
        maturity: 'DEFINED',
        self_provenance: 'USER_CONFIRMED',
        created_at: Date.now() - 3600000 * 12,
        updated_at: Date.now() - 3600000 * 12,
      },
    ];

    for (const c of seedClaims) {
      this.claims.set(c.claim_id, c);
    }
    this.counter = 5;
    this.saveToStorage();
  }

  /**
   * 新規主張の登録 (第6.2節・6.3節)
   * 既存主張との矛盾・上書き(SUPERSEDE)関係を自動検出し、整合性を保つ
   */
  public registerClaim(params: {
    statement: string;
    world: ClaimWorld;
    kind: ClaimKind;
    status?: ClaimVerificationStatus;
    scope?: ClaimScope;
    source: string;
    origin_source_id?: string;
    derived_from?: string[];
    independence_cluster_id?: string;
    maturity?: ClaimMaturity;
    self_provenance?: ClaimSelfProvenance;
    open_world_status?: ClaimOpenWorldStatus;
  }): ClaimRecord {
    const claim_id = `CLM-${String(this.counter++).padStart(6, '0')}`;
    const now = Date.now();

    // 6.7 自己生成情報による自己証明の禁止チェック
    let self_prov = params.self_provenance || 'INDEPENDENTLY_SUPPORTED';
    let status = params.status || 'UNVERIFIED';

    if (params.source === 'ai_output' || params.source === 'self_generation') {
      self_prov = 'SELF_SUPPORTED';
      // 自己生成情報は独立した証拠がない限りDEVICE_VERIFIEDやSUPPORTEDにできない
      if (status === 'DEVICE_VERIFIED' || status === 'SUPPORTED') {
        status = 'UNVERIFIED';
        systemLogger.warn(
          'SELF_IMPROVEMENT',
          `⚠️ [6.7 自己証明禁止] AI自己生成出力を単独で検証済み(SUPPORTED/DEVICE_VERIFIED)にすることは禁止されています。UNVERIFIEDとして登録します: ${params.statement}`
        );
      }
    }

    const newClaim: ClaimRecord = {
      claim_id,
      statement: params.statement.trim(),
      world: params.world,
      kind: params.kind,
      status,
      scope: params.scope || {},
      source: params.source,
      origin_source_id: params.origin_source_id,
      derived_from: params.derived_from,
      independence_cluster_id: params.independence_cluster_id || `cluster_${params.origin_source_id || 'unknown'}`,
      maturity: params.maturity || 'DISCOVERED',
      self_provenance: self_prov,
      open_world_status: params.open_world_status || 'FOUND_SUPPORTED',
      created_at: now,
      updated_at: now,
    };

    // 6.4 矛盾の早期検出
    const contradictions = this.detectContradictions(newClaim);
    if (contradictions.length > 0) {
      newClaim.contradicted_by = contradictions.map((c) => c.claim_id);
      newClaim.status = 'DISPUTED';
      for (const old of contradictions) {
        if (!old.contradicted_by) old.contradicted_by = [];
        if (!old.contradicted_by.includes(claim_id)) old.contradicted_by.push(claim_id);
        this.relations.push({
          source_claim_id: claim_id,
          target_claim_id: old.claim_id,
          relation: 'CONTRADICTS',
          weight: 1.0,
        });
      }
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `⚠️ [6.4 矛盾検知] 主張 ${claim_id} と既存主張 [${newClaim.contradicted_by.join(', ')}] の間に矛盾を検出しました`
      );
    }

    this.claims.set(claim_id, newClaim);
    this.saveToStorage();

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📝 [主張DB登録] ${claim_id}: 「${newClaim.statement}」 [${newClaim.world} / ${newClaim.kind} / ${newClaim.status}]`
    );

    return newClaim;
  }

  /**
   * 6.4 訂正・改訂処理: 古い主張をSUPERSEDEDにし、新しい主張で更新
   * 上書きで消すのではなく、変更履歴として両方を残す
   */
  public supersedeClaim(oldClaimId: string, newClaimId: string, reason: string): boolean {
    const oldClaim = this.claims.get(oldClaimId);
    const newClaim = this.claims.get(newClaimId);
    if (!oldClaim || !newClaim) return false;

    oldClaim.status = 'SUPERSEDED';
    oldClaim.superseded_by = newClaimId;
    oldClaim.updated_at = Date.now();

    newClaim.superseded_from = oldClaimId;
    newClaim.updated_at = Date.now();

    this.relations.push({
      source_claim_id: newClaimId,
      target_claim_id: oldClaimId,
      relation: 'SUPERSEDES',
      weight: 1.0,
    });

    this.saveToStorage();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔄 [6.4 主張改訂] ${oldClaimId} は ${newClaimId} により置換(SUPERSEDED)されました。理由: ${reason}`
    );
    return true;
  }

  /**
   * 6.4 矛盾検出ロジック (決定論的・非LLM)
   */
  public detectContradictions(candidate: ClaimRecord): ClaimRecord[] {
    const contradictoryList: ClaimRecord[] = [];
    const candStmt = candidate.statement.toLowerCase();

    for (const [, existing] of this.claims) {
      if (existing.status === 'SUPERSEDED' || existing.status === 'FALSE') continue;

      // 創作世界と現実世界は矛盾とみなさず共存可能 (世界区分チェック)
      if (candidate.world !== existing.world) {
        // 但し、同一エンティティについて現実と創作を混同している発言は警告
        if (candidate.world === 'REAL' && existing.world === 'FICTION') {
          if (candStmt.includes(existing.statement.toLowerCase())) {
            contradictoryList.push(existing);
          }
        }
        continue;
      }

      // 同一世界内での論理的否定・対立検出
      const existingStmt = existing.statement.toLowerCase();
      const isOppositeCondition =
        (candStmt.includes('発生する') && existingStmt.includes('発生しない')) ||
        (candStmt.includes('発生しない') && existingStmt.includes('発生する')) ||
        (candStmt.includes('できない') && existingStmt.includes('できる')) ||
        (candStmt.includes('できる') && existingStmt.includes('できない')) ||
        (candStmt.includes('高速化する') && existingStmt.includes('低速化する')) ||
        (candStmt.includes('低速化する') && existingStmt.includes('高速化する')) ||
        (candStmt.includes('推奨') && existingStmt.includes('非推奨')) ||
        (candStmt.includes('非推奨') && existingStmt.includes('推奨')) ||
        (candStmt.includes('真') && existingStmt.includes('偽')) ||
        (candStmt.includes('偽') && existingStmt.includes('真'));

      if (isOppositeCondition) {
        // スコープが完全重複しているか確認
        const scopeOverlap = this.isScopeOverlapping(candidate.scope, existing.scope);
        if (scopeOverlap) {
          contradictoryList.push(existing);
        }
      }
    }

    return contradictoryList;
  }

  /**
   * スコープの重複度合いを判定
   */
  private isScopeOverlapping(s1: ClaimScope, s2: ClaimScope): boolean {
    if (s1.device && s2.device && s1.device !== s2.device) return false;
    if (s1.environment && s2.environment && s1.environment !== s2.environment) return false;
    if (s1.backend && s2.backend && s1.backend !== s2.backend) return false;
    if (s1.runtime && s2.runtime && s1.runtime !== s2.runtime) return false;
    return true;
  }

  /**
   * 6.6 出典の実質的独立性 (独立根拠数) の計算
   * 異なるURLでも同一クラスターであれば独立な証拠として多重カウントしない
   */
  public getIndependentEvidenceCount(statementKeyword: string): {
    totalMentions: number;
    independentClusters: number;
    clusterIds: string[];
  } {
    const matchingClaims = Array.from(this.claims.values()).filter((c) =>
      c.statement.includes(statementKeyword) && c.status !== 'SUPERSEDED' && c.status !== 'FALSE'
    );

    const clusterSet = new Set<string>();
    for (const c of matchingClaims) {
      if (c.independence_cluster_id) {
        clusterSet.add(c.independence_cluster_id);
      }
    }

    return {
      totalMentions: matchingClaims.length,
      independentClusters: clusterSet.size,
      clusterIds: Array.from(clusterSet),
    };
  }

  /**
   * 6.8 知識の成熟度プロモーション
   * DISCOVERED → DEFINED → CONNECTED → APPLIED → REPRODUCED → TRANSFERRED → MATURE
   */
  public promoteMaturity(claimId: string, nextMaturity: ClaimMaturity, reason: string): boolean {
    const claim = this.claims.get(claimId);
    if (!claim) return false;

    const maturityRanks: Record<ClaimMaturity, number> = {
      DISCOVERED: 1,
      DEFINED: 2,
      CONNECTED: 3,
      APPLIED: 4,
      REPRODUCED: 5,
      TRANSFERRED: 6,
      MATURE: 7,
      RESTRICTED: 0,
    };

    if (maturityRanks[nextMaturity] > maturityRanks[claim.maturity]) {
      const prev = claim.maturity;
      claim.maturity = nextMaturity;
      claim.updated_at = Date.now();
      this.saveToStorage();
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `📈 [6.8 成熟度昇格] ${claimId}: ${prev} ➔ ${nextMaturity} (理由: ${reason})`
      );
      return true;
    }

    return false;
  }

  /**
   * クエリ・フィルタリング
   */
  public queryClaims(filter?: {
    world?: ClaimWorld;
    kind?: ClaimKind;
    status?: ClaimVerificationStatus;
    keyword?: string;
    excludeSuperseded?: boolean;
  }): ClaimRecord[] {
    let list = Array.from(this.claims.values());

    if (filter?.excludeSuperseded !== false) {
      list = list.filter((c) => c.status !== 'SUPERSEDED');
    }
    if (filter?.world) {
      list = list.filter((c) => c.world === filter.world);
    }
    if (filter?.kind) {
      list = list.filter((c) => c.kind === filter.kind);
    }
    if (filter?.status) {
      list = list.filter((c) => c.status === filter.status);
    }
    if (filter?.keyword) {
      const kw = filter.keyword.toLowerCase();
      list = list.filter((c) => c.statement.toLowerCase().includes(kw));
    }

    return list.sort((a, b) => b.updated_at - a.updated_at);
  }

  /**
   * 自然言語の問いかけから主張DB内の最適な主張を照合・抽出
   * 設計思想指示書 第3章 ルートB / 第6章 / 第7章
   */
  public findBestMatchingClaim(query: string): {
    hasMatch: boolean;
    bestClaim?: ClaimRecord;
    supportingClaims: ClaimRecord[];
    contradictingClaims: ClaimRecord[];
    confidence: 'CERTAIN' | 'PROBABLE' | 'HYPOTHETICAL' | 'UNVERIFIED';
    world: ClaimWorld;
    scopeNotes: string[];
    suggestedAction: 'DIRECT_ANSWER' | 'TRIGGER_WEB_SEARCH' | 'ESCALATE_TO_TEACHER';
    unmetReason?: string;
  } {
    const qLower = query.toLowerCase();
    const activeClaims = Array.from(this.claims.values()).filter(
      (c) => c.status !== 'SUPERSEDED' && c.status !== 'FALSE'
    );

    // 1. スコアリング (キーワード一致、重要語、成熟度、検証状態)
    const scored = activeClaims.map((claim) => {
      let score = 0;
      const stmtLower = claim.statement.toLowerCase();

      // トークン分割マッチング
      const words = qLower.split(/[\s,、。？！?!\-_/]+/i).filter((w) => w.length >= 2);
      for (const w of words) {
        if (stmtLower.includes(w)) {
          score += 15;
        }
      }

      // ドメイン・スコープキーワードの一致
      if (claim.scope) {
        for (const val of Object.values(claim.scope)) {
          if (typeof val === 'string' && val.length >= 2 && qLower.includes(val.toLowerCase())) {
            score += 20;
          }
        }
      }

      // 成熟度加点
      if (claim.maturity === 'MATURE') score += 15;
      else if (claim.maturity === 'REPRODUCED' || claim.maturity === 'TRANSFERRED') score += 10;
      else if (claim.maturity === 'APPLIED') score += 5;

      // 検証状態加点
      if (claim.status === 'DEVICE_VERIFIED') score += 20;
      else if (claim.status === 'SUPPORTED') score += 15;
      else if (claim.status === 'DISPUTED' || claim.status === 'CONTRADICTED') score -= 20;
      else if (claim.status === 'UNVERIFIED') score -= 5;

      return { claim, score };
    });

    // スコア順にソート
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];

    // マッチ判定のしきい値
    if (!top || top.score < 20) {
      return {
        hasMatch: false,
        supportingClaims: [],
        contradictingClaims: [],
        confidence: 'UNVERIFIED',
        world: 'UNKNOWN_CONTEXT',
        scopeNotes: [],
        suggestedAction: 'TRIGGER_WEB_SEARCH',
        unmetReason: '主張DB内に十分な確信度を持つ該当主張が存在しないため、第7章 自律Web調査が必要です',
      };
    }

    const bestClaim = top.claim;
    const scopeNotes: string[] = [];
    if (bestClaim.scope.device) scopeNotes.push(`対象デバイス: ${bestClaim.scope.device}`);
    if (bestClaim.scope.environment) scopeNotes.push(`実行環境: ${bestClaim.scope.environment}`);
    if (bestClaim.scope.backend) scopeNotes.push(`バックエンド: ${bestClaim.scope.backend}`);
    if (bestClaim.scope.runtime) scopeNotes.push(`ランタイム: ${bestClaim.scope.runtime}`);

    // 確信度の算出
    let confidence: 'CERTAIN' | 'PROBABLE' | 'HYPOTHETICAL' | 'UNVERIFIED' = 'PROBABLE';
    if (bestClaim.status === 'DEVICE_VERIFIED' && (bestClaim.maturity === 'MATURE' || bestClaim.maturity === 'REPRODUCED')) {
      confidence = 'CERTAIN';
    } else if (bestClaim.world === 'FICTION' || bestClaim.world === 'HYPOTHETICAL') {
      confidence = 'HYPOTHETICAL';
    } else if (bestClaim.status === 'UNVERIFIED') {
      confidence = 'UNVERIFIED';
    }

    // 矛盾主張の取得
    const contradictingClaims = (bestClaim.contradicted_by || [])
      .map((id) => this.claims.get(id))
      .filter((c): c is ClaimRecord => !!c);

    return {
      hasMatch: true,
      bestClaim,
      supportingClaims: [bestClaim],
      contradictingClaims,
      confidence,
      world: bestClaim.world,
      scopeNotes,
      suggestedAction: confidence === 'UNVERIFIED' ? 'TRIGGER_WEB_SEARCH' : 'DIRECT_ANSWER',
    };
  }

  /**
   * 検証状態の変更はVerifierService等の明示的な検証経路からのみ行う。
   * AI自己生成だけではSUPPORTED/DEVICE_VERIFIEDへ昇格できない。
   */
  public setVerificationStatus(
    claimId: string,
    status: ClaimVerificationStatus,
    reason: string
  ): boolean {
    const claim = this.claims.get(claimId);
    if (!claim) return false;

    if ((status === 'SUPPORTED' || status === 'DEVICE_VERIFIED') && claim.self_provenance === 'SELF_SUPPORTED') {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `⚠️ [6.7 自己証明禁止] ${claimId} は自己生成由来のため ${status} に昇格できません。`
      );
      return false;
    }

    claim.status = status;
    claim.updated_at = Date.now();
    this.saveToStorage();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔐 [検証状態変更] ${claimId}: ${status} (理由: ${reason})`
    );
    return true;
  }

  public getClaim(claim_id: string): ClaimRecord | undefined {
    return this.claims.get(claim_id);
  }

  public searchClaims(query: string, limit = 5): Array<ClaimRecord & { claimText?: string; confidence?: number }> {
    const qLower = query.toLowerCase();
    const tokens = qLower.split(/[^\p{L}\p{N}_-]+/u).filter((t: string) => t.length >= 2);
    const active = Array.from(this.claims.values()).filter((c) => c.status !== 'SUPERSEDED');
    const scored = active.map((c) => {
      const text = c.statement.toLowerCase();
      let matches = 0;
      for (const t of tokens) {
        if (text.includes(t)) matches++;
      }
      return {
        ...c,
        claimText: c.statement,
        confidence: c.confidence_score,
        _score: matches,
      };
    }).filter((c) => c._score > 0 || tokens.length === 0)
      .sort((a, b) => b._score - a._score || (b.confidence_score ?? 0) - (a.confidence_score ?? 0));
    return scored.slice(0, limit);
  }

  public getAllClaims(): ClaimRecord[] {
    return Array.from(this.claims.values());
  }

  public getSummaryStats(): {
    total: number;
    byWorld: Record<ClaimWorld, number>;
    byStatus: Record<ClaimVerificationStatus, number>;
    byMaturity: Record<ClaimMaturity, number>;
  } {
    const byWorld: Record<ClaimWorld, number> = {
      REAL: 0,
      FICTION: 0,
      HYPOTHETICAL: 0,
      UNKNOWN_CONTEXT: 0,
    };
    const byStatus: Record<ClaimVerificationStatus, number> = {
      UNVERIFIED: 0,
      SUPPORTED: 0,
      DEVICE_VERIFIED: 0,
      CONTRADICTED: 0,
      DISPUTED: 0,
      FALSE: 0,
      SUPERSEDED: 0,
      CONTEXT_ONLY: 0,
      UNRESOLVED: 0,
    };
    const byMaturity: Record<ClaimMaturity, number> = {
      DISCOVERED: 0,
      DEFINED: 0,
      CONNECTED: 0,
      APPLIED: 0,
      REPRODUCED: 0,
      TRANSFERRED: 0,
      MATURE: 0,
      RESTRICTED: 0,
    };

    for (const c of this.claims.values()) {
      byWorld[c.world] = (byWorld[c.world] || 0) + 1;
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byMaturity[c.maturity] = (byMaturity[c.maturity] || 0) + 1;
    }

    return {
      total: this.claims.size,
      byWorld,
      byStatus,
      byMaturity,
    };
  }

  private loadFromStorage(): void {
    try {
      const raw = storageService.getItem(CLAIMS_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const c of data) {
            this.claims.set(c.claim_id, c);
          }
          const maxIdNum = data.reduce((max, c) => {
            const match = c.claim_id.match(/CLM-(\d+)/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
          }, 0);
          this.counter = maxIdNum + 1;
        }
      }
    } catch {
      // Fallback
    }
  }

  /**
   * 旧版のサンプル主張に残る自己検証済み状態を既存インストールでも無効化。
   * 実ユーザーの主張を巻き込まないよう、既知のIDかつ旧seed由来の特徴だけを対象にする。
   */
  private migrateLegacySeedVerification(): void {
    const markers: Record<string, string> = {
      'CLM-000001': 'src_log_vulkan_crash',
      'CLM-000002': 'ms_docs_vba_performance',
      'CLM-000003': 'ms_docs_vba_performance',
    };
    let changed = false;
    for (const [id, origin] of Object.entries(markers)) {
      const claim = this.claims.get(id);
      if (!claim || claim.origin_source_id !== origin) continue;
      const wasSeedVerified = claim.status === 'DEVICE_VERIFIED' || claim.self_provenance === 'SELF_GENERATED';
      if (!wasSeedVerified) continue;
      claim.status = 'UNVERIFIED';
      claim.self_provenance = 'NONE';
      claim.open_world_status = 'SEARCH_INCOMPLETE';
      claim.updated_at = Date.now();
      changed = true;
    }
    if (changed) this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      storageService.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(Array.from(this.claims.values())));
    } catch {
      // Ignore
    }
  }
}

export const claimDatabaseService = ClaimDatabaseService.getInstance();
