import { ClaimRecord, ClaimVerificationStatus } from '../../../types';
import { claimDatabaseService } from '../../../services/claimDatabaseService';
import { evidenceService, EvidenceRecord } from '../../../services/evidenceService';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimVerificationEventService } from './claimVerificationEventService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { isTrustedVerifierName } from '../../core/services/trustedVerifier';

// P440 D5: 勉強の測定値の置き場所（reusableComponentFactoryService・
// domainIntegrationBootstrapService・researchService と同じキー・同じ形）。
const STUDY_MEASUREMENT_KEY = 'miki_study_measurement_v1';

export type VerificationOutcome =
  | 'SUPPORTED'
  | 'DEVICE_VERIFIED'
  | 'CONTRADICTED'
  | 'UNRESOLVED';

export interface VerificationResult {
  claimId: string;
  outcome: VerificationOutcome;
  previousStatus: ClaimVerificationStatus;
  independentEvidenceCount: number;
  evidenceCount: number;
  executionEvidenceCount: number;
  contradictionCount: number;
  stale: boolean;
  reasons: string[];
  promoted: boolean;
  // P463: 一次・公式情報（PRIMARY / OFFICIAL ロール）が admissible に
  // 含まれていたか。検証台帳にも残す。
  hasPrimaryOrOfficialSource: boolean;
  // P477: ユーザー信頼ルールにより、Muse の検証証言（trusted_verifier
  // 刻印のある CLOUD_AI 証拠）が admissible に含まれていたか。
  trustedVerifierAttested: boolean;
}

/*
 * P1144: 主張の要の語（アンカー語）の抽出と、証拠の関連性判定。
 * これまでの昇格判定は、主張に紐づいた証拠のクラスタ数だけを
 * 数えていて、その証拠が本当にその主張を裏付ける内容かを見て
 * いなかった（調査で集めた証拠が全部くっつくと、無関係な出典
 * でも数がそろってしまう）。WEB / DOCUMENT 証拠については、
 * 主張の要の語が証拠の本文（タイトル・抜粋・要約）に含まれる
 * ものだけを、昇格の数えに入れる。
 */
export function claimAnchorTerms1144(statement: string): string[] {
  const text = String(statement || '');
  const chunks = text
    .replace(/[「」『』（）()【】]/g, ' ')
    .split(/[\sのをにへがはとや、。・:：/／|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  const ascii = text.match(/[A-Za-z][A-Za-z0-9_.-]{2,}/g) || [];
  return [...new Set([...chunks, ...ascii])].slice(0, 8);
}

export function evidenceRelevantToClaim1144(
  evidence: { title?: string; snippet?: string; metadata?: { result_summary?: string } },
  anchorTerms: string[],
): boolean {
  if (anchorTerms.length === 0) return true;
  const haystack = `${evidence.title || ''} ${evidence.snippet || ''} ${evidence.metadata?.result_summary || ''}`.toLowerCase();
  return anchorTerms.some((term) => haystack.includes(term.toLowerCase()));
}

/**
 * Evidence -> verification boundary.
 *
 * Rules:
 * - 1 source is never enough for SUPPORTED.
 * - Multiple independent evidence clusters can promote UNVERIFIED -> SUPPORTED.
 * - DEVICE_VERIFIED requires explicit admissible EXECUTION evidence.
 * - Contradiction blocks promotion.
 * - Stale evidence cannot establish a fresh claim.
 * - This service is the only normal path that promotes evidence-derived claims.
 */
export class VerifierService {
  private static instance: VerifierService;

  private constructor() {}

  public static getInstance(): VerifierService {
    if (!VerifierService.instance) VerifierService.instance = new VerifierService();
    return VerifierService.instance;
  }

  public verifyClaim(params: {
    claimId: string;
    evidenceIds?: string[];
    executionEvidenceIds?: string[];
    requireFresh?: boolean;
    maxAgeDays?: number;
  }): VerificationResult {
    const claim = claimDatabaseService.getClaim(params.claimId);
    if (!claim) {
      // P2010: 検証対象が無い異常も UNRESOLVED の理由として残す。
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `[VerifierUnresolved] ${params.claimId}: NOT_FOUND -> UNRESOLVED independent=0 admissible=0 execution=0 reasons=対象Claimが存在しません。`
      );
      return {
        claimId: params.claimId,
        outcome: 'UNRESOLVED',
        previousStatus: 'UNRESOLVED',
        independentEvidenceCount: 0,
        evidenceCount: 0,
        executionEvidenceCount: 0,
        contradictionCount: 0,
        stale: false,
        reasons: ['対象Claimが存在しません。'],
        promoted: false,
        hasPrimaryOrOfficialSource: false,
        trustedVerifierAttested: false,
      };
    }

    const previousStatus = claim.status;
    const evidence = this.collectEvidence(params.claimId, params.evidenceIds);
    const executionEvidence = this.collectEvidence(params.claimId, params.executionEvidenceIds)
      .filter((e) => e.kind === 'EXECUTION');

    // P481: ペア解消の判断証拠（pair_dissolution）は真偽の証拠ではない
    // ため、反証と同じく裏付けの数えから外す。
    const admissible = evidence.filter((e) => e.status === 'ADMISSIBLE' && e.metadata?.research_source_role !== 'COUNTEREVIDENCE' && e.metadata?.pair_dissolution !== true);
    // P1144: WEB / DOCUMENT 証拠は、主張の要の語を含むものだけを
    // 昇格の数えに入れる（関連性ゲート）。実行証拠・教師証言・
    // ユーザー証拠など他の種別は従来どおり数える。要の語が
    // 抽出できない主張ではゲートは素通り（判定材料が無い）。
    // P1145: 要の語は翻訳対応語でも展開する。日本語の主張に
    // 英語の証拠が付いた場合でも、対応する英語の語で関連を
    // 判定できるようにするため。
    const anchorTerms = lexicalRelationService.expandTermsBilingual(claimAnchorTerms1144(claim.statement), 16);
    const relevantAdmissible = admissible.filter((e) =>
      e.kind !== 'WEB' && e.kind !== 'DOCUMENT'
        ? true
        : evidenceRelevantToClaim1144(e, anchorTerms),
    );
    // P1136: LOCAL_CLAIM 証拠は「自分の知識ベースに既にあった」という
    // 照合結果であり、外部からの独立した裏付けではない。独立クラスタ
    // 数には数えない（昇格の根拠から外す）。証拠件数や鮮度判定には
    // 従来どおり含める。
    const independentClusters = new Set(relevantAdmissible.filter((e) => e.kind !== 'LOCAL_CLAIM').map((e) => e.independence_cluster_id));
    // P463: 一次資料の判定接続。収集ポリシーでは一次資料が必須でも、
    // 判定段の昇格条件には入っていなかった。証拠全件に役割が明示されて
    // いる場合（研究経由）に限り、一次・公式情報なしでは確定しない。
    // 役割が未記録の証拠が混ざる経路は従来どおり（クラスタ数で判定）。
    const hasPrimaryOrOfficialSource = relevantAdmissible.some((e) => {
      const role = e.metadata?.research_source_role;
      return role === 'PRIMARY' || role === 'OFFICIAL';
    });
    const allEvidenceRolesClassified =
      admissible.length > 0 &&
      admissible.every((e) => {
        const role = e.metadata?.research_source_role;
        return typeof role === 'string' && role !== 'UNCLASSIFIED';
      });
    const contradictionCount = (claim.contradicted_by || []).filter((id) => {
      const other = claimDatabaseService.getClaim(id);
      return !!other && other.status !== 'SUPERSEDED' && other.status !== 'FALSE';
    }).length;
    // P477: ユーザー信頼ルール（2026-11-07）。Muse の検証証言は、
    // trusted_verifier 刻印のある CLOUD_AI 証拠として届く。制約保留
    // （P475 の teacher_constraint）は判断ではないので数えない。
    // 反証ロールは admissible の時点で除外済み。信頼は Muse 個人へ
    // のもので、他の AI の証言にはこの扱いは無い。
    const trustedVerifierAttested = admissible.some(
      (e) =>
        e.kind === 'CLOUD_AI' &&
        isTrustedVerifierName(e.metadata?.trusted_verifier ?? '') &&
        e.metadata?.teacher_constraint !== true,
    );

    const maxAgeDays = Math.max(1, params.maxAgeDays ?? 365);
    const stale = params.requireFresh === true && this.isStale(admissible, maxAgeDays);
    const reasons: string[] = [];
    let outcome: VerificationOutcome = 'UNRESOLVED';

    if (claim.status === 'FALSE' || claim.status === 'SUPERSEDED') {
      reasons.push(`Claim状態が${claim.status}のため昇格できません。`);
    } else if (contradictionCount > 0) {
      outcome = 'CONTRADICTED';
      reasons.push(`反証関係が${contradictionCount}件あります。`);
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'CONTRADICTED', 'Verifier: contradiction detected');
    } else if (stale) {
      reasons.push(`証拠が${maxAgeDays}日を超えて古いため、最新性を要求するClaimは確定しません。`);
    } else if (executionEvidence.length > 0 && executionEvidence.every((e) => e.status === 'ADMISSIBLE')) {
      outcome = 'DEVICE_VERIFIED';
      reasons.push('明示的なEXECUTION証拠が確認されました。');
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'DEVICE_VERIFIED', 'Verifier: admissible execution evidence');
    } else if (trustedVerifierAttested) {
      // P477: Muse の検証証言による確定。反証がある場合は上の分岐で
      // 既に止まっており（信頼は彼女自身の矛盾検出を上書きしない）、
      // DEVICE_VERIFIED（実機実行の証拠）も従来どおり別格のまま。
      outcome = 'SUPPORTED';
      reasons.push('Muse の検証証言により確定しました（ユーザー信頼ルール P477）。');
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'SUPPORTED', 'Verifier: trusted verifier (Claude) attestation');
    } else if (independentClusters.size >= 2 && allEvidenceRolesClassified && !hasPrimaryOrOfficialSource) {
      reasons.push('独立クラスターは足りていますが、一次・公式情報が含まれていません。二次情報のみでは確定しません。');
    } else if (independentClusters.size >= 2) {
      outcome = 'SUPPORTED';
      reasons.push(`独立証拠クラスター${independentClusters.size}件を確認しました。`);
      claimDatabaseService.setVerificationStatus(claim.claim_id, 'SUPPORTED', 'Verifier: independent evidence');
    } else {
      reasons.push(`独立証拠クラスターが${independentClusters.size}件しかありません。SUPPORTEDには2件以上必要です。`);
    }

    if (relevantAdmissible.length < admissible.length) {
      reasons.push(`主張の要の語を含まない証拠${admissible.length - relevantAdmissible.length}件を、昇格の数えから外しました。`);
    }

    const promoted = outcome === 'SUPPORTED' || outcome === 'DEVICE_VERIFIED';

    // P440 D5: 検証結果の内訳を永続化カウンタに残す（測定の集計層）。
    // UNRESOLVED の内訳（クラスタ不足／ADMISSIBLE なし／反証あり／鮮度）
    // も区別して残す。測定の永続化失敗は検証結果を変えない。
    this.incrementStudyMeasurement(
      outcome === 'SUPPORTED'
        ? { supportedPromotions: 1 }
        : outcome === 'DEVICE_VERIFIED'
          ? { deviceVerifiedPromotions: 1 }
          : outcome === 'CONTRADICTED'
            ? { contradictedPromotions: 1 }
            : stale
              ? { unresolvedStale: 1 }
              : admissible.length === 0
                ? { unresolvedNoAdmissible: 1 }
                : { unresolvedClusterShortage: 1 },
    );

    // P463: 判定の根拠を Claim 単位で読み返せる台帳に残す（従来は
    // ログと集計カウンタしか残らなかった）。台帳の失敗は判定を変えない。
    try {
      const ledgerKey = 'miki_claim_verification_ledger_v1';
      const rawLedger = storageService.getItem(ledgerKey);
      const parsedLedger: unknown = rawLedger ? JSON.parse(rawLedger) : [];
      const entries: unknown[] = Array.isArray(parsedLedger) ? parsedLedger : [];
      entries.push({
        claimId: claim.claim_id,
        outcome,
        reasons: [...reasons],
        evidenceIds: admissible.map((e) => e.evidence_id),
        independentClusters: independentClusters.size,
        hasPrimaryOrOfficialSource,
        trustedVerifierAttested,
        contradictionCount,
        stale,
        verifiedAt: Date.now(),
      });
      storageService.setItem(ledgerKey, JSON.stringify(entries.slice(-300)));
    } catch { /* 台帳は補助記録 */ }

    claimVerificationEventService.publish({
      claimId: claim.claim_id,
      outcome,
      promoted,
      verifiedAt: Date.now(),
      reasons: [...reasons],
    });

    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🔐 [Verifier] ${claim.claim_id}: ${claim.status} -> ${outcome} / independent=${independentClusters.size} / execution=${executionEvidence.length}`
    );

    // P2010: UNRESOLVED の時は、遷移理由と判定に使った値を WARN で
    // 残す（ユーザーの許可に基づく失敗経路のみのログ拡充）。従来は
    // 理由が検証台帳と集計カウンタにしか残らず、返送ログからは
    // 「なぜ確定しなかったか」が読めなかった。昇格・反証の経路は
    // 従来どおり（上の INFO 行と台帳）で、量は増やさない。
    if (outcome === 'UNRESOLVED') {
      systemLogger.warn(
        'SELF_IMPROVEMENT',
        `[VerifierUnresolved] ${claim.claim_id}: ${previousStatus} -> UNRESOLVED independent=${independentClusters.size} admissible=${admissible.length} relevant=${relevantAdmissible.length} execution=${executionEvidence.length} contradictions=${contradictionCount} stale=${stale} primaryOrOfficial=${hasPrimaryOrOfficialSource} trustedVerifier=${trustedVerifierAttested} reasons=${reasons.join(' / ').slice(0, 600)}`
      );
    }

    return {
      claimId: claim.claim_id,
      outcome,
      previousStatus,
      independentEvidenceCount: independentClusters.size,
      evidenceCount: admissible.length,
      executionEvidenceCount: executionEvidence.length,
      contradictionCount,
      stale,
      reasons,
      promoted,
      hasPrimaryOrOfficialSource,
      trustedVerifierAttested,
    };
  }

  public verifyMany(params: {
    claimIds: string[];
    requireFresh?: boolean;
    maxAgeDays?: number;
  }): VerificationResult[] {
    return params.claimIds.map((claimId) =>
      this.verifyClaim({
        claimId,
        requireFresh: params.requireFresh,
        maxAgeDays: params.maxAgeDays,
      })
    );
  }

  // P440 D5: 勉強の測定値の累計。数値だけを置く。
  private incrementStudyMeasurement(patch: Record<string, number>): void {
    try {
      const raw = storageService.getItem(STUDY_MEASUREMENT_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      const current: Record<string, number> =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, number>)
          : {};
      const next: Record<string, number> = { ...current };
      for (const [key, value] of Object.entries(patch)) {
        const base = typeof next[key] === 'number' ? next[key] : 0;
        next[key] = base + value;
      }
      next.updatedAt = Date.now();
      storageService.setItem(STUDY_MEASUREMENT_KEY, JSON.stringify(next));
    } catch {
      // 測定の永続化失敗は検証結果を変えない。
    }
  }

  private collectEvidence(claimId: string, evidenceIds?: string[]): EvidenceRecord[] {
    const records = evidenceService.list({ claimId });
    if (!evidenceIds || evidenceIds.length === 0) return records;
    const wanted = new Set(evidenceIds);
    return records.filter((record) => wanted.has(record.evidence_id));
  }

  private isStale(records: EvidenceRecord[], maxAgeDays: number): boolean {
    if (records.length === 0) return false;
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const dated = records
      .map((record) => {
        if (!record.published_date) return undefined;
        const time = Date.parse(record.published_date);
        return Number.isFinite(time) ? time : undefined;
      })
      .filter((time): time is number => typeof time === 'number');

    // Unknown publication date is not treated as proof of staleness.
    if (dated.length === 0) return false;
    return dated.every((time) => now - time > maxAgeMs);
  }
}

export const verifierService = VerifierService.getInstance();
