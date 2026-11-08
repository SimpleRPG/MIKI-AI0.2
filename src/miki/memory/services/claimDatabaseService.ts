import type {
  ClaimRecord,
  ClaimWorld,
  ClaimKind,
  ClaimVerificationStatus,
  ClaimMaturity,
  ClaimSelfProvenance,
  ClaimOpenWorldStatus,
  ClaimScope,
} from '../../../types';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { knowledgeHalfLifeService, type KnowledgeStability } from './knowledgeHalfLifeService';
import { lexicalRelationService } from './lexicalRelationService';

const CLAIMS_STORAGE_KEY = 'miki_claim_db_v1';
// P492: 採番の high-water mark と整合性所見の保存キー。Claim 配列本体の
// 保存が遅延・失敗しても採番が巻き戻らないよう、本体とは別に持つ。
const CLAIM_ID_HIGH_WATER_KEY = 'miki_claim_id_high_water_v1';
const CLAIM_ID_INTEGRITY_KEY = 'miki_claim_id_integrity_v1';

/*
 * P459: Claim の重複排除で使う「同一性」。
 * 文面は研究経路の既存正規化（researchService.normalizeClaimStatement）と
 * 同系（小文字化・空白圧縮・句読点／引用符の除去）に NFKC を足し、全角／
 * 半角の揺れも同一視する。小数点や桁区切りは保持する（「1.5倍」と
 * 「15倍」のような別物を畳まない）。同一性の残りは world・kind・source
 * の一致と scope の安定文字列化の一致で、出典（origin_source_id）や
 * クラスタの違いは同一性を妨げない（別出典の同じ文は、既存 Claim へ
 * 証拠が集まる形になる。検証器はクラスタを Set で数えるため、同一
 * クラスタの証拠が増えても二重計上にはならない）。
 */
export const normalizeClaimStatementForDedup = (text: string): string =>
  // P491: NFKC で吸収できない表記ゆれ（サーバ／サーバー等）は
  // 語彙ルールの VARIANT で正形に寄せてから同一性を判定する。
  lexicalRelationService.foldVariants(
    String(text || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s　]+/g, ' ')
      .replace(/[「」『』“”\"'、。！？!?]/g, '')
      .trim(),
  );

const stableStringifyForScope = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringifyForScope).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringifyForScope(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

export const claimDedupIdentityKey = (parts: {
  statement: string;
  world: string;
  kind: string;
  source: string;
  scope?: unknown;
}): string =>
  [
    normalizeClaimStatementForDedup(parts.statement),
    parts.world,
    parts.kind,
    parts.source,
    stableStringifyForScope(parts.scope ?? {}),
  ].join('\u0001');

/** P459: フォールドで正本を選ぶ際の status の強さ（決定的な順序付け）。 */
const CLAIM_DEDUP_STATUS_RANK: Record<string, number> = {
  DEVICE_VERIFIED: 6,
  SUPPORTED: 5,
  CANDIDATE: 4,
  UNVERIFIED: 3,
  DISPUTED: 3,
  CONTEXT_ONLY: 2,
  CONTRADICTED: 1,
  UNRESOLVED: 1,
};

/**
 * 主張間の関係リンク
 */
export type BeliefRevisionStatus='ACTIVE'|'UNDER_REVIEW'|'CONTRADICTED'|'SUPERSEDED'|'QUARANTINED';

export interface BeliefRevisionResult {
  status:'COEXIST'|'QUARANTINE_NEW'|'UNDER_REVIEW_BOTH'|'SUPERSEDE_EXISTING';
  existingClaimId:string;
  candidateClaimId:string;
  existingConfidence:number;
  candidateConfidence:number;
  reason:string;
  independentEvidenceClusters:string[];
  committed:boolean;
}

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
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private relations: ClaimRelation[] = [];
  private counter: number = 1;
  // P459: 文面は登録後に変わらないため、正規化結果を claim_id で保持する。
  private normalizedStatementCache: Map<string, string> = new Map();
  // P492: 読み込み時に検出した採番まわりの整合性所見。
  private integrityFindings: string[] = [];

  private constructor() {
    this.loadFromStorage();
    this.migrateLegacySeedVerification();
    this.foldDuplicateClaims();
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
   *
   * P459: 登録時の重複排除。文面の正規化形・world・kind・source・scope
   * が全て一致し、終端（SUPERSEDED／FALSE）でない既存 Claim があれば、
   * 新規作成せずその Claim を返す（矛盾検出も行わない）。重複登録の
   * 試みは [P459] ログに残す。呼び出し側が別 Claim として意図的に
   * 分けたい場合（研究の反証パス）だけ allowDuplicate を指定する。
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
    allowDuplicate?: boolean;
  }): ClaimRecord {
    if (!params.allowDuplicate) {
      const duplicate = this.findDuplicateClaim(params);
      if (duplicate) {
        systemLogger.info(
          'SELF_IMPROVEMENT',
          `[P459] [主張DB重複排除] 既存の主張 ${duplicate.claim_id} と同一（正規化文面・world・kind・source・scope が一致）のため新規登録せず既存を返します: 「${String(params.statement || '').trim().slice(0, 80)}」`
        );
        return duplicate;
      }
    }

    // P492: 発行済み ID の再配布を防ぐ。カウンタが既存 ID と衝突して
    // いたら空きまで進める（既存 Claim を黙って上書きしない）。採番した
    // 番号は Claim 本体の保存より先に high-water として永続化するので、
    // 本体の保存が遅れた状態で終了・再起動しても巻き戻らない。
    let allocatedNum = this.counter;
    let skipped = 0;
    while (this.claims.has(`CLM-${String(allocatedNum).padStart(6, '0')}`)) {
      allocatedNum++;
      skipped++;
    }
    if (skipped > 0) {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `🔐 [Claim ID採番] カウンタが既存 Claim と衝突したため ${skipped} 件読み飛ばしました (next=${allocatedNum})`
      );
    }
    this.counter = allocatedNum + 1;
    try {
      storageService.setItem(CLAIM_ID_HIGH_WATER_KEY, String(allocatedNum + 1));
    } catch {
      // high-water が書けなくても、読み込み時に Claim 配列の最大値から回復できる。
    }
    const claim_id = `CLM-${String(allocatedNum).padStart(6, '0')}`;
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
    // P438: 出典・クラスタ／種別が違う「弱い矛盾」は DISPUTED にしない。
    // contradicted_by にも relations にも入れず、ログにだけ残す。
    const hardContradictions = contradictions.filter((c) => !c.suppressedReason);
    const suppressedContradictions = contradictions.filter((c) => c.suppressedReason);
    if (hardContradictions.length > 0) {
      newClaim.contradicted_by = hardContradictions.map((c) => c.claim.claim_id);
      newClaim.status = 'DISPUTED';
      for (const item of hardContradictions) {
        const old = item.claim;
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
        `⚠️ [6.4 矛盾検知] 主張 ${claim_id} と既存主張 [${newClaim.contradicted_by.join(', ')}] の間に矛盾を検出しました pair=${hardContradictions.map((c) => c.matchedPair).join(', ')}`
      );
    }
    if (suppressedContradictions.length > 0) {
      systemLogger.info(
        'SELF_IMPROVEMENT',
        `🔎 [6.4 弱い矛盾] 主張 ${claim_id} と既存主張 [${suppressedContradictions.map((c) => c.claim.claim_id).join(', ')}] は対立語（pair=${suppressedContradictions.map((c) => c.matchedPair).join(', ')}）が一致しましたが、${suppressedContradictions.map((c) => c.suppressedReason).join('／')} のため DISPUTED にしませんでした`
      );
    }

    this.claims.set(claim_id, newClaim);
    this.saveToStorage();
    this.ensureClaimFreshness(newClaim);

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `📝 [主張DB登録] ${claim_id}: 「${newClaim.statement}」 [${newClaim.world} / ${newClaim.kind} / ${newClaim.status}]`
    );

    return newClaim;
  }

  /**
   * P459: 同一性の一致する既存 Claim を探す。終端（SUPERSEDED／FALSE）
   * の Claim は同一視しない（置換済みの文面は改めて登録できる）。
   * 複数残っている場合（フォールド前の旧データ等）は、正本の選び方
   * （status の強さ→古い順→ID 順）で決定的に1件を選ぶ。
   */
  private findDuplicateClaim(params: {
    statement: string;
    world: ClaimWorld;
    kind: ClaimKind;
    scope?: ClaimScope;
    source: string;
  }): ClaimRecord | undefined {
    const targetKey = claimDedupIdentityKey({
      statement: params.statement,
      world: params.world,
      kind: params.kind,
      source: params.source,
      scope: params.scope ?? {},
    });
    const matches: ClaimRecord[] = [];
    for (const claim of this.claims.values()) {
      if (claim.status === 'SUPERSEDED' || claim.status === 'FALSE') continue;
      if (claim.world !== params.world || claim.kind !== params.kind || claim.source !== params.source) continue;
      if (this.dedupIdentityKeyOfClaim(claim) === targetKey) matches.push(claim);
    }
    if (matches.length === 0) return undefined;
    matches.sort(
      (a, b) =>
        (CLAIM_DEDUP_STATUS_RANK[b.status] ?? 0) - (CLAIM_DEDUP_STATUS_RANK[a.status] ?? 0) ||
        a.created_at - b.created_at ||
        a.claim_id.localeCompare(b.claim_id)
    );
    return matches[0];
  }

  private dedupIdentityKeyOfClaim(claim: ClaimRecord): string {
    let normalized = this.normalizedStatementCache.get(claim.claim_id);
    if (normalized === undefined) {
      normalized = normalizeClaimStatementForDedup(claim.statement);
      this.normalizedStatementCache.set(claim.claim_id, normalized);
    }
    return [
      normalized,
      claim.world,
      claim.kind,
      claim.source,
      stableStringifyForScope(claim.scope ?? {}),
    ].join('\u0001');
  }

  /**
   * P459: 既存データの重複掃除（ロード時に1回、決定的・冪等）。
   * 同一性が一致する非終端 Claim のグループについて、正本を1件決め、
   * 他を SUPERSEDED にして superseded_by で正本を指す。Claim 自体は
   * 削除しない。参照の張り替えは Claim DB の内側に閉じる
   * （contradicted_by／derived_from／superseded_by／superseded_from を
   * 正本へ寄せ、重複と自己参照を除く）。証拠レコード側の claim_ids は
   * supersedeClaim の既存作法と同じく張り替えない（履歴として残り、
   * SUPERSEDED な Claim は検証・パッケージ作成の対象から外れる）。
   * relations はセッション内のみの保持でロード時点では空のため対象外。
   * SUPERSEDED は同一視の対象外なので、再起動で再実行されても何も
   * 起きない。
   */
  private foldDuplicateClaims(): void {
    const groups = new Map<string, ClaimRecord[]>();
    for (const claim of this.claims.values()) {
      if (claim.status === 'SUPERSEDED' || claim.status === 'FALSE') continue;
      const key = this.dedupIdentityKeyOfClaim(claim);
      const group = groups.get(key);
      if (group) group.push(claim);
      else groups.set(key, [claim]);
    }

    const dupToCanonical = new Map<string, string>();
    let foldedGroups = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const sorted = [...group].sort(
        (a, b) =>
          (CLAIM_DEDUP_STATUS_RANK[b.status] ?? 0) - (CLAIM_DEDUP_STATUS_RANK[a.status] ?? 0) ||
          a.created_at - b.created_at ||
          a.claim_id.localeCompare(b.claim_id)
      );
      const canonical = sorted[0];
      foldedGroups += 1;
      for (const dup of sorted.slice(1)) {
        dupToCanonical.set(dup.claim_id, canonical.claim_id);
      }
    }
    if (dupToCanonical.size === 0) return;

    const now = Date.now();
    for (const [dupId, canonicalId] of dupToCanonical) {
      const dup = this.claims.get(dupId);
      if (!dup) continue;
      dup.status = 'SUPERSEDED';
      (dup as ClaimRecord & { beliefStatus?: BeliefRevisionStatus }).beliefStatus = 'SUPERSEDED';
      dup.superseded_by = canonicalId;
      dup.updated_at = now;
    }

    const remap = (id: string): string => dupToCanonical.get(id) ?? id;
    for (const claim of this.claims.values()) {
      if (claim.contradicted_by) {
        claim.contradicted_by = [...new Set(claim.contradicted_by.map(remap))].filter(
          (id) => id !== claim.claim_id
        );
      }
      if (claim.derived_from) {
        claim.derived_from = [...new Set(claim.derived_from.map(remap))].filter(
          (id) => id !== claim.claim_id
        );
      }
      if (claim.superseded_from && dupToCanonical.has(claim.superseded_from)) {
        const next = remap(claim.superseded_from);
        claim.superseded_from = next === claim.claim_id ? undefined : next;
      }
      if (claim.superseded_by && dupToCanonical.has(claim.superseded_by)) {
        const next = remap(claim.superseded_by);
        if (next !== claim.claim_id) claim.superseded_by = next;
      }
    }

    this.saveToStorage();
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `[P459] [主張DB重複掃除] 同一主張の重複 ${dupToCanonical.size} 件を ${foldedGroups} 件の正本へ寄せました（SUPERSEDED化し、DB内の参照は正本へ張り替え）`
    );
  }

  /**
   * Knowledge / Belief Revisionの正式規則。
   * 矛盾検出だけでは新Claimを真実扱いせず、独立Evidence・検証状態・成熟度を再評価する。
   * commit=falseでは判断のみを返し、状態を書き換えない。
   */
  public reviseBelief(params:{
    existingClaimId:string;
    candidateClaimId:string;
    independentlyObservedClusterIds?:string[];
    candidateVerified?:boolean;
    candidateEvidenceQuality?:number;
    commit?:boolean;
  }):BeliefRevisionResult {
    const existing=this.claims.get(params.existingClaimId);
    const candidate=this.claims.get(params.candidateClaimId);
    if(!existing||!candidate)throw new Error('BELIEF_REVISION_CLAIM_NOT_FOUND');

    const independentEvidenceClusters=[...new Set((params.independentlyObservedClusterIds||[]).filter(Boolean))];
    const existingClusters=existing.independence_cluster_id?[existing.independence_cluster_id]:[];
    const candidateVerified=params.candidateVerified===true;
    const evidenceQuality=Math.max(0,Math.min(1,Number(params.candidateEvidenceQuality??0)));

    const maturityScore=(claim:ClaimRecord)=>{
      const rank:Record<ClaimMaturity,number>={DISCOVERED:10,DEFINED:20,CONNECTED:30,APPLIED:45,REPRODUCED:60,TRANSFERRED:70,MATURE:80,RESTRICTED:0};
      return rank[claim.maturity]||0;
    };
    const statusScore=(claim:ClaimRecord)=>{
      const rank:Record<ClaimVerificationStatus,number>={
      UNRESOLVED: 0,
        UNVERIFIED:10,CANDIDATE:15,SUPPORTED:45,DEVICE_VERIFIED:65,DISPUTED:20,CONTRADICTED:5,FALSE:0,SUPERSEDED:0,CONTEXT_ONLY:25
      };
      return rank[claim.status]||0;
    };
    const existingConfidence=Math.round(Math.max(0,Math.min(100,statusScore(existing)+maturityScore(existing)/4+(existingClusters.length>0?10:0)))*100)/100;
    const candidateConfidence=Math.round(Math.max(0,Math.min(100,statusScore(candidate)+maturityScore(candidate)/4+evidenceQuality*20+(independentEvidenceClusters.length>0?15:0)+(candidateVerified?15:0)))*100)/100;

    const contradiction=this.detectContradictions(candidate).some(x=>!x.suppressedReason && x.claim.claim_id===existing.claim_id)
      || existing.contradicted_by?.includes(candidate.claim_id)
      || candidate.contradicted_by?.includes(existing.claim_id);

    if(!contradiction){
      return {status:'COEXIST',existingClaimId:existing.claim_id,candidateClaimId:candidate.claim_id,existingConfidence,candidateConfidence,reason:'Claims are not contradictory in the current scope/world comparison; preserve both.',independentEvidenceClusters,committed:false};
    }

    let status:BeliefRevisionResult['status']='UNDER_REVIEW_BOTH';
    let reason='Contradiction detected; neither claim is promoted solely from contradiction.';
    if(!candidateVerified || independentEvidenceClusters.length===0 || evidenceQuality<0.5){
      status='QUARANTINE_NEW';
      reason='Candidate lacks independently verified support; quarantine without replacing the existing claim.';
    }else if(candidateConfidence>existingConfidence){
      status='SUPERSEDE_EXISTING';
      reason='Candidate has verified support and stronger independent evidence; explicit revision may supersede the existing claim.';
    }

    let committed=false;
    if(params.commit){
      if(status==='QUARANTINE_NEW'){
        (candidate as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefStatus='QUARANTINED';
        (candidate as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefConfidence=candidateConfidence;
      }else if(status==='UNDER_REVIEW_BOTH'){
        (existing as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefStatus='UNDER_REVIEW';
        (candidate as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefStatus='UNDER_REVIEW';
        (existing as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefConfidence=existingConfidence;
        (candidate as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefConfidence=candidateConfidence;
      }else if(status==='SUPERSEDE_EXISTING'){
        this.supersedeClaim(existing.claim_id,candidate.claim_id,'Belief Revision: verified independent evidence outweighed existing claim');
        (candidate as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefStatus='ACTIVE';
        (candidate as ClaimRecord & {beliefStatus?:BeliefRevisionStatus;beliefConfidence?:number}).beliefConfidence=candidateConfidence;
      }
      this.saveToStorage();
      committed=true;
    }

    return {status,existingClaimId:existing.claim_id,candidateClaimId:candidate.claim_id,existingConfidence,candidateConfidence,reason,independentEvidenceClusters,committed};
  }

  /** ClaimのBelief Statusを取得する。旧レコードはACTIVEとして互換扱いする。 */
  public getBeliefStatus(claimId:string):BeliefRevisionStatus|undefined {
    const claim=this.claims.get(claimId);
    if(!claim)return undefined;
    return (claim as ClaimRecord & {beliefStatus?:BeliefRevisionStatus}).beliefStatus||'ACTIVE';
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
    (oldClaim as ClaimRecord & {beliefStatus?:BeliefRevisionStatus}).beliefStatus = 'SUPERSEDED';
    oldClaim.superseded_by = newClaimId;
    oldClaim.updated_at = Date.now();

    newClaim.superseded_from = oldClaimId;
    (newClaim as ClaimRecord & {beliefStatus?:BeliefRevisionStatus}).beliefStatus = 'ACTIVE';
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
   *
   * P438: 返り値を「一致した対立語ペア」と「抑制理由」を含む形に変えた。
   * 出典・クラスタが異なるペア（話題が違う可能性が高い）は DISPUTED に
   * せず、「弱い矛盾」として suppressedReason 付きで返す。信号は捨てず、
   * 呼び出し側がログに残す。kind が異なる場合も同様に弱い矛盾扱いにする。
   */
  public detectContradictions(candidate: ClaimRecord): Array<{ claim: ClaimRecord; matchedPair: string; suppressedReason?: string }> {
    const contradictoryList: Array<{ claim: ClaimRecord; matchedPair: string; suppressedReason?: string }> = [];
    const candStmt = candidate.statement.toLowerCase();

    for (const [, existing] of this.claims) {
      if (existing.status === 'SUPERSEDED' || existing.status === 'FALSE') continue;

      // 創作世界と現実世界は矛盾とみなさず共存可能 (世界区分チェック)
      if (candidate.world !== existing.world) {
        // 但し、同一エンティティについて現実と創作を混同している発言は警告
        if (candidate.world === 'REAL' && existing.world === 'FICTION') {
          if (candStmt.includes(existing.statement.toLowerCase())) {
            contradictoryList.push({ claim: existing, matchedPair: '世界区分の混同' });
          }
        }
        continue;
      }

      // 同一世界内での論理的否定・対立検出
      const existingStmt = existing.statement.toLowerCase();
      const matchedPair = this.matchedOppositePair(candStmt, existingStmt);

      if (matchedPair) {
        // スコープが完全重複しているか確認
        const scopeOverlap = this.isScopeOverlapping(candidate.scope, existing.scope);
        if (scopeOverlap) {
          // P438: 出典・クラスタ／種別による話題の区別。出典が違う
          // ペアは「矛盾」と断定せず弱い矛盾として残す。
          const suppressedReason = this.topicMismatchReason(candidate, existing, matchedPair);
          contradictoryList.push(
            suppressedReason
              ? { claim: existing, matchedPair, suppressedReason }
              : { claim: existing, matchedPair }
          );
        }
      }
    }

    return contradictoryList;
  }

  /**
   * P438: 一致した対立語ペアを1つ返す。一致がなければ '' を返す。
   * 10通りのペアは P436 時点のものと同じ。
   */
  private matchedOppositePair(candStmt: string, existingStmt: string): string {
    const pairs: Array<[string, string, string]> = [
      ['発生する', '発生しない', '発生する／発生しない'],
      ['できない', 'できる', 'できない／できる'],
      ['高速化する', '低速化する', '高速化する／低速化する'],
      ['推奨', '非推奨', '推奨／非推奨'],
      ['真', '偽', '真／偽'],
    ];
    // P490: 語彙ルールに登録された反対語も対立ペアに使う。固定の
    // 5組だけでは「増加する／減少する」「成功／失敗」のような
    // 典型的な対立をそもそも検出できなかった。ルールは種＋
    // Wikidata 学習で増えるため、検出範囲が語彙の成長と一緒に
    // 広がる。
    for (const [a, b] of lexicalRelationService.antonymPairs()) {
      pairs.push([a, b, `${a}／${b}`]);
    }
    for (const [a, b, label] of pairs) {
      if (
        (this.hasBoundaryTerm(candStmt, a) && this.hasBoundaryTerm(existingStmt, b)) ||
        (this.hasBoundaryTerm(candStmt, b) && this.hasBoundaryTerm(existingStmt, a))
      ) {
        return label;
      }
    }
    return '';
  }

  /**
   * P438: 話題が違う可能性が高いペアかどうかを、出典・クラスタと種別
   * で判定する。研究経路の主張では independence_cluster_id が
   * `cluster_${origin_source_id}` になるため、クラスタの違いは出典の
   * 違いとほぼ同義。抑制する場合は理由文を返し、しない場合は undefined。
   * 「矛盾がないと断定する」のではなく「このペアだけでは矛盾と断定
   * しない」という扱いであり、未検証のものを検証済みとして扱う変更
   * ではない。
   */
  private topicMismatchReason(candidate: ClaimRecord, existing: ClaimRecord, matchedPair?: string): string | undefined {
    if (candidate.kind !== existing.kind) {
      return `種別不一致（${candidate.kind} vs ${existing.kind}）`;
    }
    if (
      candidate.independence_cluster_id !== existing.independence_cluster_id &&
      candidate.origin_source_id !== existing.origin_source_id
    ) {
      return `出典不一致（${candidate.independence_cluster_id || 'unknown'} vs ${existing.independence_cluster_id || 'unknown'}）`;
    }
    // P481: 対立語以外の内容語（主題を担う語）を共有しないペアは、
    // 別の主題の文同士が対立語だけで結ばれた誤検出として弱い矛盾に
    // 留める（実例: アンテナ審判の文と LISP の文が「できる／できない」
    // だけで結ばれる）。教師パッケージ10件全件がこの型の誤検出だった。
    // P490 改善: 内容語の共有判定の前に、一致した対立語そのものを
    // 両文から取り除く。対立語の語尾や語幹（下がる／上がる の
    // 「がる」、発生する／発生しない の「発生」）が「共有する内容語」
    // に化けて、P481 の抑制が効かなくなるため。本来の意図は
    // 「対立語以外の内容語」の共有を見ること。
    const stripPair = (text: string): string => {
      let out = String(text || '');
      if (matchedPair) {
        for (const term of matchedPair.split('／')) {
          if (term) out = out.split(term).join('');
        }
      }
      return out;
    };
    if (
      !this.sharesContentToken(stripPair(candidate.statement), stripPair(existing.statement)) &&
      !this.hasSynonymBridge(candidate.statement, existing.statement)
    ) {
      return '内容語の共有なし（対立語のみの一致）';
    }
    return undefined;
  }

  /**
   * P490: 片方の文の語が、もう片方では同義語に置き換わっている
   * 場合に「主題は同じ」とみなす橋。表記が違うだけで同じ主題の
   * 文を、内容語の不一致として弱い矛盾に落とさないために使う。
   * 汎用動詞（調べる／使う／作る等）の対は橋に使わない（どの文
   * にも現れるため、主題の根拠にならない）。
   */
  private hasSynonymBridge(aRaw: string, bRaw: string): boolean {
    const generic = new Set(['調べる', '検索する', '使う', '使用する', '用いる', '作る', '作成する', '教える', '伝える']);
    const a = String(aRaw || '');
    const b = String(bRaw || '');
    for (const [x, y] of lexicalRelationService.synonymPairs()) {
      if (generic.has(x) || generic.has(y)) continue;
      if ((a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))) return true;
    }
    return false;
  }

  /**
   * P481: 両文が主題を担う内容語を共有するか。漢字・かな・英数の
   * 2文字以上の語を拾い、対立語と一般語を除いて一致を見る。形態素
   * 解析は使わない簡易判定（3文字以上の語は先頭2文字での部分一致も
   * 共有とみなし、表記の揺れを吸収する）。
   */
  private sharesContentToken(a: string, b: string): boolean {
    const stop = new Set([
      'できる', 'できない', '発生する', '発生しない', '高速化する', '低速化する',
      '推奨', '非推奨', 'これ', 'それ', 'あれ', 'ため', 'こと', 'もの', 'よう',
      '場合', '以上', '以下', '関する', 'ための', 'について', 'において', 'よって',
    ]);
    const tokens = (text: string): string[] => {
      const found: string[] = [];
      for (const m of String(text || '').matchAll(/[a-zA-Z0-9]{2,}|[一-龯]{2,}|[ぁ-んァ-ヶ]{2,}/g)) {
        if (!stop.has(m[0])) found.push(m[0]);
      }
      return found;
    };
    const bText = String(b || '');
    const bTokens = new Set(tokens(bText));
    for (const token of tokens(a)) {
      if (bTokens.has(token)) return true;
      if (token.length >= 3 && bText.includes(token.slice(0, 2))) return true;
    }
    return false;
  }

  /**
   * P481: 2つの Claim の間の contradicted_by リンクを双方向に外す。
   * 教師が「対立する命題が無い（誤検出）」と判断したペアの排出路。
   * Claim 自体と真偽の状態には触れない。リンクが実在して外れたら true。
   */
  public removeContradictionLink(claimAId: string, claimBId: string): boolean {
    const a = this.claims.get(claimAId);
    const b = this.claims.get(claimBId);
    let removed = false;
    if (a?.contradicted_by?.includes(claimBId)) {
      a.contradicted_by = a.contradicted_by.filter((id) => id !== claimBId);
      removed = true;
    }
    if (b?.contradicted_by?.includes(claimAId)) {
      b.contradicted_by = b.contradicted_by.filter((id) => id !== claimAId);
      removed = true;
    }
    if (removed) {
      this.relations = this.relations.filter(
        (r) =>
          !(
            r.relation === 'CONTRADICTS' &&
            ((r.source_claim_id === claimAId && r.target_claim_id === claimBId) ||
              (r.source_claim_id === claimBId && r.target_claim_id === claimAId))
          ),
      );
      this.saveToStorage();
    }
    return removed;
  }

  /**
   * P436: 対立語の一致は部分文字列ではなく語境界付きで行う。
   * 「信頼できる」の「できる」や「できるだけ」の「できる」のような、
   * 別の語の一部としての出現を除外する。日本語の形態素解析は重いため、
   * 出現の直後の文字で判定する簡易な境界チェックとする。直後が文末・
   * 句読点・空白・助詞・動詞「する」の活用（す／し／せ）のいずれかで
   * あれば、その出現は対立語としての使用とみなす。
   * 「推奨」は直前に「非」が付く出現（＝「非推奨」）を「推奨」として
   * 数えない。完全な解決にはならないが、誤検出を減らすための絞り込みである。
   *
   * P438: 独立語（推奨／非推奨、真／偽、発生する／発生しない、
   * 高速化する／低速化する）に限定して、直前の文字も見る両側チェック
   * を足す。対立語が別の語の末尾として使われている出現を除外する。
   * 「できる／できない」は動詞の接尾辞として正しく使われるため、
   * 前方境界チェックは適用しない。
   */
  private hasBoundaryTerm(statement: string, term: string): boolean {
    // P438: 両側チェックの対象は独立語に限定する。
    const twoSidedTerms = new Set(['推奨', '非推奨', '真', '偽', '発生する', '発生しない', '高速化する', '低速化する']);
    const checkBefore = twoSidedTerms.has(term);
    let index = statement.indexOf(term);
    while (index >= 0) {
      if (term === '推奨' && index > 0 && statement[index - 1] === '非') {
        index = statement.indexOf(term, index + term.length);
        continue;
      }
      const after = statement[index + term.length];
      if (
        after === undefined ||
        /[\s、。！？「」『』（）［］｛｝・…—―,.;:!?]/.test(after) ||
        'はがをにへともでかのはやよなさ'.includes(after) ||
        after === 'す' || after === 'し' || after === 'せ'
      ) {
        if (checkBefore && index > 0) {
          const before = statement[index - 1];
          const beforeOk =
            /[\s、。！？「」『』（）［］｛｝・…—―,.;:!?]/.test(before) ||
            'はがをにへともでかのはや'.includes(before);
          if (!beforeOk) {
            index = statement.indexOf(term, index + term.length);
            continue;
          }
        }
        return true;
      }
      index = statement.indexOf(term, index + term.length);
    }
    return false;
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

  public listClaims(filter?: {
    world?: ClaimWorld;
    kind?: ClaimKind;
    status?: ClaimVerificationStatus;
    keyword?: string;
    excludeSuperseded?: boolean;
  }): ClaimRecord[] {
    return this.queryClaims(filter);
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
    freshness?: { status:'CURRENT'|'REVALIDATION_DUE'; stability:KnowledgeStability; halfLifeDays:number; dueAt:number; lastVerifiedAt:number };
  } {
    const qLower = query.toLowerCase();
    const activeClaims = Array.from(this.claims.values()).filter(
      (c) => c.status !== 'SUPERSEDED' && c.status !== 'FALSE'
        && (c as ClaimRecord & {beliefStatus?:BeliefRevisionStatus}).beliefStatus !== 'QUARANTINED'
    );

    // 1. スコアリング (キーワード一致、重要語、成熟度、検証状態)
    const scored = activeClaims.map((claim) => {
      let score = 0;
      let matchedQuery = false;
      const stmtLower = claim.statement.toLowerCase();

      // トークン分割マッチング
      const words = qLower.split(/[\s,、。？！?!\-_/]+/i).filter((w) => w.length >= 2);
      for (const w of words) {
        if (stmtLower.includes(w)) {
          score += 15;
          matchedQuery = true;
        }
      }

      // ドメイン・スコープキーワードの一致
      if (claim.scope) {
        for (const val of Object.values(claim.scope)) {
          if (typeof val === 'string' && val.length >= 2 && qLower.includes(val.toLowerCase())) {
            score += 20;
            matchedQuery = true;
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
      else if (claim.status === 'UNVERIFIED' || claim.status === 'CANDIDATE') score -= 5;

      const freshness=matchedQuery?this.ensureClaimFreshness(claim):knowledgeHalfLifeService.get(`claim:${claim.claim_id}`);
      if(claim.world==='REAL'&&freshness?.revalidationRequired)score-=25;
      return { claim, score, freshness };
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
    } else if (bestClaim.status === 'UNVERIFIED' || bestClaim.status === 'CANDIDATE') {
      confidence = 'UNVERIFIED';
    }
    const freshness=this.ensureClaimFreshness(bestClaim);
    const freshnessDue=bestClaim.world==='REAL'&&Boolean(freshness?.revalidationRequired);
    if(freshnessDue)confidence='UNVERIFIED';

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
      suggestedAction: confidence === 'UNVERIFIED' || freshnessDue ? 'TRIGGER_WEB_SEARCH' : 'DIRECT_ANSWER',
      ...(freshness?{freshness:{status:freshnessDue?'REVALIDATION_DUE' as const:'CURRENT' as const,stability:freshness.stability,halfLifeDays:freshness.halfLifeDays,dueAt:freshness.dueAt,lastVerifiedAt:freshness.lastVerifiedAt}}:{}),
      ...(freshnessDue?{unmetReason:'MATCHING_CLAIM_REVALIDATION_REQUIRED'}:{}),
    };
  }

  /**
   * 旧バージョンから永続化されているClaimへも鮮度ポリシーを段階適用する。
   * 一回の監査で全件を走査せず、未分類のREAL Claimだけを上限付きで索引化する。
   */
  /** P363: 鮮度索引の滞留量（可視化専用。処理は indexMissingFreshness の上限付き方式のまま）。 */
  public freshnessBacklog(): { candidates: number; indexed: number; missing: number } {
    const candidates = Array.from(this.claims.values()).filter(claim => claim.world === 'REAL' && !['FALSE', 'SUPERSEDED', 'CONTEXT_ONLY'].includes(claim.status));
    let missing = 0;
    for (const claim of candidates) {
      if (!knowledgeHalfLifeService.get(`claim:${claim.claim_id}`)) missing++;
    }
    return { candidates: candidates.length, indexed: candidates.length - missing, missing };
  }

  public indexMissingFreshness(limit=24):number {
    // Reclassify a bounded, round-robin slice. This migrates prior FIXED/10-year records
    // created by older policy revisions as well as records with no freshness entry, without
    // making an audit scan unbounded or repeatedly starving later Claim IDs.
    const max=Math.max(1,Math.min(200,Math.floor(limit)||24));
    const candidates=Array.from(this.claims.values()).filter(claim=>claim.world==='REAL'&&!['FALSE','SUPERSEDED','CONTEXT_ONLY'].includes(claim.status));
    if(candidates.length===0)return 0;
    const cursorKey='miki_claim_freshness_migration_cursor_v1';
    const previousCursor=storageService.getItem(cursorKey)||'';
    const previousIndex=candidates.findIndex(claim=>claim.claim_id===previousCursor);
    const start=previousIndex<0?0:(previousIndex+1)%candidates.length;
    let indexed=0;
    const scanned=Math.min(max,candidates.length);
    for(let offset=0;offset<scanned;offset++){
      const claim=candidates[(start+offset)%candidates.length];
      const key=`claim:${claim.claim_id}`;
      const previous=knowledgeHalfLifeService.get(key);
      const next=this.ensureClaimFreshness(claim);
      if(next&&(!previous||previous.stability!==next.stability||previous.importance!==next.importance||previous.changeRisk!==next.changeRisk||previous.halfLifeDays!==next.halfLifeDays))indexed++;
      storageService.setItem(cursorKey,claim.claim_id);
    }
    return indexed;
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
    const freshness=this.ensureClaimFreshness(claim);
    if(freshness){
      try{
        if(status==='SUPPORTED'||status==='DEVICE_VERIFIED')knowledgeHalfLifeService.observe(`claim:${claimId}`,'SUCCESS',true);
        else if(status==='FALSE'||status==='DISPUTED'||status==='CONTRADICTED')knowledgeHalfLifeService.observe(`claim:${claimId}`,'FAILURE',false);
      }catch(error){systemLogger.warn('PERSISTENCE',`[KnowledgeHalfLife] Claim feedback could not be persisted for ${claimId}: ${String(error)}`);}
    }
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔐 [検証状態変更] ${claimId}: ${status} (理由: ${reason})`
    );
    return true;
  }

  private ensureClaimFreshness(claim:ClaimRecord){
    const key=`claim:${claim.claim_id}`;
    try{
      const statement=String(claim.statement||'');
      let stability:KnowledgeStability='TIME';
      if(claim.world==='FICTION')stability='FIXED';
      else if(claim.world==='HYPOTHETICAL'||claim.status==='UNVERIFIED'||claim.status==='CANDIDATE'||claim.status==='UNRESOLVED')stability='HYPOTHESIS';
      else if(/policy|規約|法律|法令|ユーザー設定|user preference|利用規約|運用方針/i.test(statement))stability='USER_POLICY';
      else if(/version|バージョン|API|依存関係|SDK|ランタイム|提供終了|サポート期限|互換性/i.test(statement))stability='VERSION';
      else if(claim.scope?.environment||claim.scope?.device||claim.scope?.backend||claim.scope?.runtime)stability='ENVIRONMENT';
      else if(/current|currently|latest|today|now|as of|price|pricing|stock|available|availability|open now|president|ceo|役職|現職|現在|最新|今日|価格|料金|在庫|提供中|営業中|就任|退任|所在地|人口|ランキング|相場|為替|スケジュール/i.test(statement))stability='TIME';
      // Real-world statements with no reliable immutability signal default to TIME, never FIXED.
      const importance=claim.status==='DEVICE_VERIFIED'?90:claim.status==='SUPPORTED'?75:claim.status==='DISPUTED'||claim.status==='CONTRADICTED'?65:45;
      const changeRisk=stability==='FIXED'?10:stability==='VERSION'?75:stability==='ENVIRONMENT'?70:stability==='USER_POLICY'?65:stability==='TIME'?85:90;
      const verified=claim.status==='SUPPORTED'||claim.status==='DEVICE_VERIFIED';
      const existing=knowledgeHalfLifeService.get(key);
      if(existing&&existing.stability===stability&&existing.importance===importance&&existing.changeRisk===changeRisk)return existing;
      return knowledgeHalfLifeService.classify(key,{stability,importance,changeRisk,verifiedAt:verified?claim.updated_at:existing?.lastVerifiedAt??claim.created_at});
    }catch(error){
      systemLogger.warn('PERSISTENCE',`[KnowledgeHalfLife] Claim freshness unavailable for ${claim.claim_id}: ${String(error)}`);
      return undefined;
    }
  }

  public getClaim(claim_id: string): ClaimRecord | undefined {
    return this.claims.get(claim_id);
  }

  /*
   * P425 B1: 矛盾・未解決の検証結果が改善ループへ運ばれるとき、
   * 主張の内容そのものを文脈として組み立てる。以前は claimId と
   * 結果語だけが流れ、主張文・矛盾相手は入口で落ちていたため、
   * 下流では「どの主張が何と矛盾しているのか」が分からず、証拠
   * 取得が汎用テンプレートに落ちていた。文脈の形はここを正本と
   * し、購読側（bootstrap）と証拠取得側（requiredAssetAcquisition）
   * はこの形だけを見る。主張が引けない場合は undefined を返す
   * （呼び出し側は従来経路へ落ちる）。
   */
  public buildClaimContext(claim_id: string): {
    claimId: string;
    statement: string;
    scope?: ClaimScope;
    source?: string;
    originSourceId?: string;
    contradictedBy: Array<{ claimId: string; statement: string }>;
  } | undefined {
    const claim = this.claims.get(claim_id);
    if (!claim) return undefined;
    const contradictedBy: Array<{ claimId: string; statement: string }> = [];
    for (const otherId of claim.contradicted_by || []) {
      const other = this.claims.get(otherId);
      if (other) contradictedBy.push({ claimId: other.claim_id, statement: other.statement });
    }
    return {
      claimId: claim.claim_id,
      statement: claim.statement,
      scope: claim.scope,
      source: claim.source,
      originSourceId: claim.origin_source_id,
      contradictedBy,
    };
  }

  public searchClaims(query: string, limit = 5): Array<ClaimRecord & { claimText?: string; confidence?: number; freshnessStatus?:'CURRENT'|'REVALIDATION_DUE' }> {
    const qLower = query.toLowerCase();
    const tokens = qLower.split(/[^\p{L}\p{N}_-]+/u).filter((t: string) => t.length >= 2);
    const active = Array.from(this.claims.values()).filter((c) => c.status !== 'SUPERSEDED');
    const scored = active.map((c) => {
      const text = c.statement.toLowerCase();
      let matches = 0;
      for (const t of tokens) {
        if (text.includes(t)) matches++;
      }
      const freshness=matches>0?this.ensureClaimFreshness(c):knowledgeHalfLifeService.get(`claim:${c.claim_id}`);
      const freshnessDue=c.world==='REAL'&&Boolean(freshness?.revalidationRequired);
      return {
        ...c,
        claimText: c.statement,
        confidence: c.confidence_score,
        freshnessStatus:freshnessDue?'REVALIDATION_DUE' as const:'CURRENT' as const,
        _score: matches-(freshnessDue?2:0),
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
      CANDIDATE: 0,
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
          // P492: Map に畳む前に、同一 claim_id で異なる文面のレコードが
          // 保存配列に混ざっていないか検出する。過去の採番巻き戻しで
          // 上書きされた Claim の痕跡は、ここでしか掴めない。
          const statementById = new Map<string, string>();
          for (const c of data) {
            const prev = statementById.get(c.claim_id);
            if (prev !== undefined && prev !== c.statement) {
              this.integrityFindings.push(
                `duplicate claim_id ${c.claim_id} with divergent statements in stored array`
              );
            }
            statementById.set(c.claim_id, c.statement);
            this.claims.set(c.claim_id, c);
          }
          const maxIdNum = data.reduce((max, c) => {
            const match = c.claim_id.match(/CLM-(\d+)/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
          }, 0);
          // P492: 採番は保存済み Claim の最大値だけに依存させない。
          // 2026-11-05 に CLM-000080〜105 が二重発番された事故は、本体
          // 配列の保存が間に合わない状態で再起動し、最大値が巻き戻った
          // ことが原因。high-water mark と最大値の大きい方から進める。
          let highWater = 0;
          try {
            highWater = parseInt(storageService.getItem(CLAIM_ID_HIGH_WATER_KEY) || '0', 10) || 0;
          } catch {
            highWater = 0;
          }
          if (highWater > maxIdNum + 1) {
            this.integrityFindings.push(
              `claim id high-water (${highWater}) exceeds stored max id (${maxIdNum}); a past rollback likely overwrote claims`
            );
          }
          this.counter = Math.max(maxIdNum + 1, highWater);
          if (this.integrityFindings.length > 0) {
            try {
              const prevRaw = storageService.getItem(CLAIM_ID_INTEGRITY_KEY);
              const prev: string[] = prevRaw ? JSON.parse(prevRaw) : [];
              const merged = [...new Set([...prev, ...this.integrityFindings])].slice(-50);
              storageService.setItem(CLAIM_ID_INTEGRITY_KEY, JSON.stringify(merged));
            } catch {
              // 整合性記録は補助。書けなくても読み込みは続ける。
            }
            systemLogger.warn(
              'SELF_IMPROVEMENT',
              `🔐 [Claim ID整合性] ${this.integrityFindings.join(' ／ ')}`
            );
          }
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

  /** P492: 採番の整合性所見（重複 ID・巻き戻しの痕跡）と現在のカウンタ。 */
  public getClaimIdIntegrityReport(): { counter: number; findings: string[] } {
    return { counter: this.counter, findings: [...this.integrityFindings] };
  }

  /**
   * P492: 矛盾パッケージ生成（contradictionResolutionRequestService の
   * enumeratePairs）と同一基準で「生きている矛盾相手」を返す。タスク側と
   * パッケージ側が別々の物差しで数えると、実在しないペアを追うタスクが
   * 空転する（CLM-000104 の事例）。基準は contradicted_by の相互リンクと
   * 両側が SUPERSEDED／FALSE でないこと。
   */
  public liveContradictionPartners(claimId: string): string[] {
    const self = this.claims.get(claimId);
    if (!self || self.status === 'SUPERSEDED' || self.status === 'FALSE') return [];
    const partners = new Set<string>();
    for (const otherId of self.contradicted_by ?? []) {
      const other = this.claims.get(otherId);
      if (other && other.status !== 'SUPERSEDED' && other.status !== 'FALSE') {
        partners.add(otherId);
      }
    }
    for (const other of this.claims.values()) {
      if (other.claim_id === claimId) continue;
      if (other.status === 'SUPERSEDED' || other.status === 'FALSE') continue;
      if ((other.contradicted_by ?? []).includes(claimId)) partners.add(other.claim_id);
    }
    partners.delete(claimId);
    return [...partners];
  }

  private saveToStorage(): void {
    // P499: 保存を短い窓でまとめる。調査は Claim を連続で登録
    // するため、従来は1件ごとに全件を JSON 化して保存しており、
    // 台帳が育つほど学習ループの書き込みが重くなっていた。
    // メモリ上の Map が正で、永続化だけをバッチ化する。
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        storageService.setItem(CLAIMS_STORAGE_KEY, JSON.stringify(Array.from(this.claims.values())));
      } catch {
        // Ignore
      }
    }, 150);
  }
}

export const claimDatabaseService = ClaimDatabaseService.getInstance();
