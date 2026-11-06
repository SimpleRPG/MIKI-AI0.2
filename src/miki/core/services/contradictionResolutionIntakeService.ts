import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { evidenceService } from '../../memory/services/evidenceService';
import { claimDatabaseService, type BeliefRevisionResult } from '../../memory/services/claimDatabaseService';
import { verifierService } from '../../verification/services/verifierService';
import { contradictionResolutionRequestService } from './contradictionResolutionRequestService';
import { autonomousSelfImprovementLoopService } from './autonomousSelfImprovementLoopService';
import { sha256HexFromText } from './canonicalSha256Service';

/*
 * P453（矛盾解決2）: 教師の一括回答の受入・結び付け検証・証拠への提出。
 *
 * 位置付け: 部品供給の受入（P420 componentSupplyIntakeService）の形を
 * Claim 矛盾へ広げたもの。矛盾解決1が出した要求へ教師が返した返却
 * ZIP（または .zip.txt＝Base64）をユーザーがアプリ内で選ぶと、ここで
 * 解凍・安全化・結び付け検証を行い、回答を「証拠」として既存経路へ
 * 提出する。
 *
 * 線引き（P449 TVE と同じ）: 教師の回答は素材であり、回答だけで Claim
 * を確定させることはしない。決着は既存の関門だけが行う：
 *  - 勝敗の回答は、教師の証言を CLOUD_AI 証拠として勝者に attach し、
 *    証拠の実績から決定的に導いた入力で信念改訂ゲート
 *    （claimDatabaseService.reviseBelief、commit あり）を呼ぶ。改訂が
 *    成立（敗者が SUPERSEDED）した場合にだけ決着とする。入力の導出は
 *    「教師の1クラスタだけでは確定条件を満たさない」ように設計して
 *    ある（candidateVerified は検証器と同じ2クラスタ基準、品質も
 *    1クラスタでは関門の 0.5 に届かない）。
 *  - 統合の回答は、統合 Claim を未検証として登録する既存経路
 *    （registerUnverifiedClaim）に載せ、旧 Claim には同じ改訂ゲートを
 *    試みる。
 *  - 両方誤りの回答は、反証（COUNTEREVIDENCE）として双方に attach
 *    するに留める。Claim を FALSE に確定させる既存経路は無いため、
 *    取り込み側で新設はしない。
 *  - 判断保留（HOLD）は証拠を記録するだけで、ペアにもキューにも
 *    触らない。
 * 処理後は、対象 Claim の park 中のキュー項目の待ちを解き（ループの
 * expedite）、既存の回復経路（証拠取得→再評価→決着の消費）が即時に
 * 走るようにする。取り込み自体が run を完了させることはしない。
 *
 * 信頼水準は部品供給と同じ 'SEMI_TRUSTED_EXTERNAL_AI'。
 */

export type ContradictionResolutionIntakeStatus = 'RECEIVED' | 'REJECTED';

export type ContradictionResolutionIntakeCode =
  | 'SUCCESS'
  | 'EMPTY_INPUT'
  | 'FILE_TOO_LARGE'
  | 'NOT_A_PACKAGE'
  | 'ZIP_READ_FAILED'
  | 'UNSAFE_PATH'
  | 'TOO_MANY_FILES'
  | 'CONTENT_TOO_LARGE'
  | 'MANIFEST_MISSING'
  | 'MANIFEST_INVALID'
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_NOT_ISSUED'
  | 'REQUEST_HASH_MISMATCH';

export type ContradictionVerdict = 'A_STANDS' | 'B_STANDS' | 'BOTH_WRONG' | 'MERGE' | 'HOLD';

export type ContradictionItemOutcome =
  | 'SETTLED'
  | 'EVIDENCE_ATTACHED'
  | 'MERGED_CANDIDATE_REGISTERED'
  | 'HELD'
  | 'ERROR';

export interface ContradictionIntakeTeacher {
  name: string;
  model?: string;
  answeredAt?: string;
}

export interface ContradictionIntakeItemResult {
  itemId: string;
  claimAId: string;
  claimBId: string;
  verdict: ContradictionVerdict;
  outcome: ContradictionItemOutcome;
  reason: string;
  evidenceIds: string[];
  revisionStatus?: string;
  mergedClaimId?: string;
}

export interface ContradictionResolutionIntakeRecord {
  intakeId: string;
  requestId: string;
  status: ContradictionResolutionIntakeStatus;
  code: ContradictionResolutionIntakeCode;
  reasons: string[];
  sourceFileName: string;
  sourceType: 'ZIP' | 'ZIPTXT';
  fileSizeBytes: number;
  packageSha256: string;
  manifestSha256: string;
  teacher?: ContradictionIntakeTeacher;
  trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI';
  items: ContradictionIntakeItemResult[];
  expeditedCount: number;
  receivedAt: number;
}

export interface ContradictionResolutionIntakeResult {
  ok: boolean;
  code: ContradictionResolutionIntakeCode;
  message: string;
  reasons: string[];
  record?: ContradictionResolutionIntakeRecord;
}

interface ReplyVerdict {
  itemId?: unknown;
  verdict?: unknown;
  rationale?: unknown;
  mergedStatement?: unknown;
  supportingSources?: unknown;
}

const LEDGER_KEY = 'miki_contradiction_resolution_intake_ledger_v1';

// 部品供給の受入と同じ上限。
const MAX_INPUT_BYTES = 3_000_000;
const MAX_FILES = 100;
const MAX_TOTAL_CONTENT_BYTES = 10 * 1024 * 1024;

const VERDICTS: ContradictionVerdict[] = ['A_STANDS', 'B_STANDS', 'BOTH_WRONG', 'MERGE', 'HOLD'];

const textEncoder = new TextEncoder();
const byteLength = (text: string): number => textEncoder.encode(text).length;

/** 部品供給の受入と同じパス安全化。 */
const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error('UNSAFE_ARTIFACT_PATH');
  }
  return normalized;
};

class ContradictionResolutionIntakeService {
  private ledger = new Map<string, ContradictionResolutionIntakeRecord>();
  private sequence = 0;

  constructor() {
    this.load();
  }

  // ------------------------------------------------------------------
  // 受入台帳（部品供給の受入台帳と同じ作法）
  // ------------------------------------------------------------------
  private load(): void {
    try {
      const raw = storageService.getItem(LEDGER_KEY);
      const values = raw ? JSON.parse(raw) : [];
      if (Array.isArray(values)) {
        for (const value of values) {
          if (value && typeof value.intakeId === 'string') {
            this.ledger.set(value.intakeId, value as ContradictionResolutionIntakeRecord);
          }
        }
      }
      this.sequence = this.ledger.size;
    } catch {
      this.ledger.clear();
    }
  }

  private save(): boolean {
    try {
      const records = [...this.ledger.values()].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 100);
      storageService.setItem(LEDGER_KEY, JSON.stringify(records));
      return true;
    } catch {
      return false;
    }
  }

  private clone(record: ContradictionResolutionIntakeRecord): ContradictionResolutionIntakeRecord {
    return {
      ...record,
      reasons: [...record.reasons],
      teacher: record.teacher ? { ...record.teacher } : undefined,
      items: record.items.map((item) => ({ ...item, evidenceIds: [...item.evidenceIds] })),
    };
  }

  public list(): ContradictionResolutionIntakeRecord[] {
    return [...this.ledger.values()]
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .map((record) => this.clone(record));
  }

  public get(intakeId: string): ContradictionResolutionIntakeRecord | undefined {
    const record = this.ledger.get(intakeId);
    return record ? this.clone(record) : undefined;
  }

  public listByRequest(requestId: string): ContradictionResolutionIntakeRecord[] {
    return this.list().filter((record) => record.requestId === requestId);
  }

  // ------------------------------------------------------------------
  // 内部ユーティリティ
  // ------------------------------------------------------------------
  private async sha256Hex(bytes: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  private fromBase64(text: string): Uint8Array {
    const binary = atob(text.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /** ADMISSIBLE な証拠の独立クラスタ集合（検証器と同じ数え方）。 */
  private independentClustersOf(claimId: string): string[] {
    const clusters = new Set<string>();
    for (const record of evidenceService.list({ claimId })) {
      if (record.status === 'ADMISSIBLE') clusters.add(record.independence_cluster_id);
    }
    return [...clusters];
  }

  /**
   * 信念改訂ゲートへの入力を、証拠の実績から決定的に導く。
   * 教師の証言は独立クラスタ1件として数えるが、それだけでは
   * candidateVerified（検証器の SUPPORTED と同じ2件基準）にも
   * 品質の下限（0.5）にも届かない。教師の回答＋既存の独立した
   * 裏付けが揃ったときだけ、ゲートが改訂を成立させ得る。
   */
  private revisionInputsFor(candidateClaimId: string): {
    independentlyObservedClusterIds: string[];
    candidateVerified: boolean;
    candidateEvidenceQuality: number;
  } {
    const clusters = this.independentClustersOf(candidateClaimId);
    return {
      independentlyObservedClusterIds: clusters,
      candidateVerified: clusters.length >= 2,
      candidateEvidenceQuality: Math.min(0.9, 0.25 + 0.2 * clusters.length),
    };
  }

  private supportingSourcesText(value: unknown): string {
    if (!Array.isArray(value)) return '';
    const lines: string[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === 'string' ? record.title.trim() : '';
      if (!title) continue;
      const url = typeof record.url === 'string' && record.url.trim() ? ` ${record.url.trim()}` : '';
      const excerpt = typeof record.excerpt === 'string' && record.excerpt.trim() ? `: ${record.excerpt.trim()}` : '';
      lines.push(`- ${title}${url}${excerpt}`);
    }
    return lines.length > 0 ? `\n根拠として挙げられた出典（MIKI 未取得・未検証）:\n${lines.join('\n')}` : '';
  }

  // ------------------------------------------------------------------
  // verdict の処理（既存経路への提出）
  // ------------------------------------------------------------------
  private processVerdict(params: {
    intakeId: string;
    teacherName: string;
    itemId: string;
    claimAId: string;
    claimBId: string;
    verdict: ContradictionVerdict;
    rationale: string;
    mergedStatement?: string;
    supportingSourcesText: string;
  }): ContradictionIntakeItemResult {
    const { intakeId, teacherName, itemId, claimAId, claimBId, verdict } = params;
    const base: ContradictionIntakeItemResult = {
      itemId,
      claimAId,
      claimBId,
      verdict,
      outcome: 'ERROR',
      reason: '',
      evidenceIds: [],
    };
    try {
      // 教師の理由は常に CLOUD_AI 証拠として記録する（学習素材）。
      // クラスタは教師ごとの1件（recordCloudAiEvidence の既定）。
      const evidence = evidenceService.recordCloudAiEvidence({
        title: `教師回答 ${itemId}（${verdict}）: ${claimAId} vs ${claimBId}`,
        snippet: params.rationale + params.supportingSourcesText,
        source: teacherName,
        sourceId: `${intakeId}:${itemId}`,
        metadata: {
          trust_boundary: 'UNTRUSTED_EXTERNAL_AI',
          external_bundle_id: intakeId,
          ...(verdict === 'BOTH_WRONG' ? { research_source_role: 'COUNTEREVIDENCE' as const } : {}),
        },
      });
      base.evidenceIds.push(evidence.evidence_id);

      if (verdict === 'HOLD') {
        base.outcome = 'HELD';
        base.reason = '教師が判断保留としたため、証拠の記録のみ行い、ペアとキューには触れませんでした。';
        return base;
      }

      if (verdict === 'BOTH_WRONG') {
        // 反証として双方へ attach（昇格の数えには入らない）。FALSE への
        // 確定は既存経路が無いため行わない。
        evidenceService.attachEvidenceToClaim(evidence.evidence_id, claimAId);
        evidenceService.attachEvidenceToClaim(evidence.evidence_id, claimBId);
        verifierService.verifyClaim({ claimId: claimAId });
        verifierService.verifyClaim({ claimId: claimBId });
        base.outcome = 'EVIDENCE_ATTACHED';
        base.reason = '両方誤りという証言を反証として双方に記録しました。Claim を FALSE に確定させる既存経路は無いため、決着はしませんでした。';
        return base;
      }

      if (verdict === 'MERGE') {
        const mergedClaimId = evidenceService.registerUnverifiedClaim(evidence.evidence_id, params.mergedStatement);
        if (!mergedClaimId) {
          base.outcome = 'EVIDENCE_ATTACHED';
          base.reason = '統合 Claim を登録できませんでした（統合文が短すぎる等）。教師の証言は証拠として記録しました。';
          return base;
        }
        base.mergedClaimId = mergedClaimId;
        // 旧 Claim それぞれについて、候補＝統合 Claim で改訂ゲートを試みる。
        // 統合 Claim の裏付けは開始時点で教師の1クラスタのみのため、
        // 通常はゲート不成立（非破壊の記録のみ）になる。
        let settledCount = 0;
        let lastRevision: BeliefRevisionResult | undefined;
        for (const oldClaimId of [claimAId, claimBId]) {
          const inputs = this.revisionInputsFor(mergedClaimId);
          lastRevision = claimDatabaseService.reviseBelief({
            existingClaimId: oldClaimId,
            candidateClaimId: mergedClaimId,
            ...inputs,
            commit: true,
          });
          if (claimDatabaseService.getClaim(oldClaimId)?.status === 'SUPERSEDED') settledCount += 1;
        }
        verifierService.verifyClaim({ claimId: claimAId });
        verifierService.verifyClaim({ claimId: claimBId });
        verifierService.verifyClaim({ claimId: mergedClaimId });
        base.revisionStatus = lastRevision?.status;
        if (settledCount === 2) {
          base.outcome = 'SETTLED';
          base.reason = `統合 Claim ${mergedClaimId} を登録し、信念改訂で旧 Claim 2件とも置換されました。`;
        } else {
          base.outcome = 'MERGED_CANDIDATE_REGISTERED';
          base.reason = `統合 Claim ${mergedClaimId} を未検証として登録しました。旧 Claim の置換は信念改訂ゲートの条件（独立した裏付け2件以上）を満たさず成立しませんでした（${lastRevision?.status ?? ''}: ${lastRevision?.reason ?? ''}）。`;
        }
        return base;
      }

      // A_STANDS / B_STANDS: 勝者に証言を attach し、改訂ゲートを通す。
      const winnerId = verdict === 'A_STANDS' ? claimAId : claimBId;
      const loserId = verdict === 'A_STANDS' ? claimBId : claimAId;
      evidenceService.attachEvidenceToClaim(evidence.evidence_id, winnerId);
      const inputs = this.revisionInputsFor(winnerId);
      const revision = claimDatabaseService.reviseBelief({
        existingClaimId: loserId,
        candidateClaimId: winnerId,
        ...inputs,
        commit: true,
      });
      base.revisionStatus = revision.status;
      const settled = claimDatabaseService.getClaim(loserId)?.status === 'SUPERSEDED';
      // 改訂の後に再評価する（敗者が置換されていれば、勝者は矛盾の
      // 数えから外れて昇格し得る。検証器の既存経路）。
      verifierService.verifyClaim({ claimId: winnerId });
      verifierService.verifyClaim({ claimId: loserId });
      if (settled) {
        base.outcome = 'SETTLED';
        base.reason = `信念改訂が成立し、${loserId} が ${winnerId} により置換（SUPERSEDED）されました（${revision.reason}）。`;
      } else {
        base.outcome = 'EVIDENCE_ATTACHED';
        base.reason = `教師の証言を ${winnerId} に証拠として attach しましたが、信念改訂は成立しませんでした（${revision.status}: ${revision.reason}）。ペアは未決着のまま残ります。`;
      }
      return base;
    } catch (error) {
      base.outcome = 'ERROR';
      base.reason = `処理中に失敗しました: ${error instanceof Error ? error.message : String(error)}`;
      return base;
    }
  }

  // ------------------------------------------------------------------
  // 受入本体
  // ------------------------------------------------------------------
  public async receiveReply(input: { fileName: string; bytes: Uint8Array }): Promise<ContradictionResolutionIntakeResult> {
    const receivedAt = Date.now();
    this.sequence += 1;
    const intakeId = `CR-IN-${receivedAt}-${String(this.sequence).padStart(3, '0')}`;
    const sourceFileName = input.fileName || '';
    const sourceType: 'ZIP' | 'ZIPTXT' = sourceFileName.toLowerCase().endsWith('.zip.txt') ? 'ZIPTXT' : 'ZIP';

    // 却下の共通処理（部品供給と同じ）: 受入台帳へ REJECTED で記録し、
    // 要求が特定できてなお ISSUED の場合だけ要求台帳も REJECTED にする。
    // 既に RECEIVED 済みの要求（二重取込）は RECEIVED を壊さない。
    const reject = (
      code: ContradictionResolutionIntakeCode,
      message: string,
      reasons: string[],
      ctx: Partial<ContradictionResolutionIntakeRecord> = {},
    ): ContradictionResolutionIntakeResult => {
      const record: ContradictionResolutionIntakeRecord = {
        intakeId,
        requestId: ctx.requestId ?? '',
        status: 'REJECTED',
        code,
        reasons,
        sourceFileName,
        sourceType: ctx.sourceType ?? sourceType,
        fileSizeBytes: input.bytes.length,
        packageSha256: ctx.packageSha256 ?? '',
        manifestSha256: ctx.manifestSha256 ?? '',
        teacher: ctx.teacher,
        trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI',
        items: [],
        expeditedCount: 0,
        receivedAt,
      };
      this.ledger.set(intakeId, record);
      this.save();
      if (record.requestId) {
        const request = contradictionResolutionRequestService.get(record.requestId);
        if (request && request.status === 'ISSUED') {
          contradictionResolutionRequestService.recordStatus(
            record.requestId,
            'REJECTED',
            `受入 ${intakeId} で却下（${code}）: ${reasons[0] ?? message}`,
          );
        }
      }
      systemLogger.warn('SELF_IMPROVEMENT', `[矛盾解決 受入却下] ${intakeId} code=${code} file=${sourceFileName}`, { reasons });
      return { ok: false, code, message, reasons, record: this.clone(record) };
    };

    // ---- 入力の形: ZIP バイナリか、Base64 の .zip.txt か ----
    if (!input.bytes || input.bytes.length === 0) {
      return reject('EMPTY_INPUT', '選択されたファイルが空です。返却パッケージのファイルを選んでください。', ['入力バイト数が0です']);
    }
    if (input.bytes.length > MAX_INPUT_BYTES) {
      return reject('FILE_TOO_LARGE', `返却ファイルが大きすぎます（${input.bytes.length} バイト / 上限 ${MAX_INPUT_BYTES} バイト）。`, ['入力サイズが上限を超えています']);
    }
    let zipBytes: Uint8Array;
    let resolvedSourceType = sourceType;
    if (input.bytes[0] === 0x50 && input.bytes[1] === 0x4b) {
      zipBytes = input.bytes;
      resolvedSourceType = 'ZIP';
    } else {
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
        zipBytes = this.fromBase64(text);
      } catch {
        return reject('NOT_A_PACKAGE', '返却ファイルを解釈できませんでした。ZIP ファイル、または Base64 の .zip.txt を選んでください。', ['PK マジックが無く、Base64 としても復号できませんでした']);
      }
      resolvedSourceType = 'ZIPTXT';
      if (!(zipBytes[0] === 0x50 && zipBytes[1] === 0x4b)) {
        return reject('NOT_A_PACKAGE', 'Base64 復号後の内容が ZIP ではありませんでした。要求パッケージではなく、返却パッケージ（MIKI_CONTRADICTION_REPLY_*.zip）を選んでください。', ['復号後の先頭が PK マジックではありません']);
      }
    }
    const packageSha256 = await this.sha256Hex(zipBytes);

    // ---- 解凍と安全化 ----
    let archive: JSZip;
    try {
      archive = await JSZip.loadAsync(zipBytes, { checkCRC32: true });
    } catch (error) {
      return reject('ZIP_READ_FAILED', `ZIP の読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`, ['JSZip.loadAsync が失敗しました'], { sourceType: resolvedSourceType, packageSha256 });
    }
    const files = new Map<string, string>();
    let totalBytes = 0;
    let fileCount = 0;
    for (const [rawPath, entry] of Object.entries(archive.files)) {
      if (entry.dir) continue;
      fileCount += 1;
      if (fileCount > MAX_FILES) {
        return reject('TOO_MANY_FILES', `返却 ZIP のファイル数が上限（${MAX_FILES}件）を超えています。`, [`ファイル数 ${fileCount} 件`], { sourceType: resolvedSourceType, packageSha256 });
      }
      let safePath: string;
      try {
        safePath = normalizePath(rawPath);
      } catch {
        return reject('UNSAFE_PATH', `返却 ZIP に安全でないパスが含まれています: ${rawPath}`, [`UNSAFE_ARTIFACT_PATH: ${rawPath}`], { sourceType: resolvedSourceType, packageSha256 });
      }
      const content = await entry.async('string');
      totalBytes += byteLength(content);
      if (totalBytes > MAX_TOTAL_CONTENT_BYTES) {
        return reject('CONTENT_TOO_LARGE', `返却 ZIP の解凍後サイズが上限（${MAX_TOTAL_CONTENT_BYTES} バイト）を超えています。`, [`解凍後合計 ${totalBytes} バイト`], { sourceType: resolvedSourceType, packageSha256 });
      }
      files.set(safePath, content);
    }

    // ---- manifest の取得と形式検証 ----
    const manifestText = files.get('contradiction_reply.json');
    if (manifestText === undefined) {
      return reject('MANIFEST_MISSING', '返却 ZIP のルートに contradiction_reply.json がありません。要求パッケージの INSTRUCTIONS.md の形式で返却してください。', ['contradiction_reply.json が見つかりません'], { sourceType: resolvedSourceType, packageSha256 });
    }
    const manifestSha256 = sha256HexFromText(manifestText);
    const manifestCtx = { sourceType: resolvedSourceType, packageSha256, manifestSha256 };
    let manifest: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(manifestText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      manifest = parsed as Record<string, unknown>;
    } catch {
      return reject('MANIFEST_INVALID', 'contradiction_reply.json が JSON として読めませんでした。', ['JSON パースに失敗しました'], manifestCtx);
    }
    const requestId = typeof manifest.requestId === 'string' ? manifest.requestId.trim() : '';
    const identifiedCtx = { ...manifestCtx, requestId };
    if (manifest.formatVersion !== 1) {
      return reject('MANIFEST_INVALID', `contradiction_reply.json の formatVersion が対応範囲外です（受け取った値: ${String(manifest.formatVersion)}）。`, ['formatVersion は 1 でなければなりません'], identifiedCtx);
    }
    if (!requestId) {
      return reject('MANIFEST_INVALID', 'contradiction_reply.json に requestId がありません。要求の requestId をそのまま返してください。', ['requestId が空です'], manifestCtx);
    }
    const requestSha256 = typeof manifest.requestSha256 === 'string' ? manifest.requestSha256.trim().toLowerCase() : '';
    if (!requestSha256) {
      return reject('MANIFEST_INVALID', 'contradiction_reply.json に requestSha256 がありません。受け取った要求 ZIP（Base64 復号後）の SHA-256 を入れてください。', ['requestSha256 が空です'], identifiedCtx);
    }
    const rawTeacher = manifest.teacher && typeof manifest.teacher === 'object' && !Array.isArray(manifest.teacher)
      ? manifest.teacher as Record<string, unknown>
      : undefined;
    const teacherName = typeof rawTeacher?.name === 'string' ? rawTeacher.name.trim() : '';
    if (!teacherName) {
      return reject('MANIFEST_INVALID', 'contradiction_reply.json の teacher.name（回答者名）がありません。出所の記録のため必須です。', ['teacher.name が空です'], identifiedCtx);
    }
    const teacher: ContradictionIntakeTeacher = {
      name: teacherName,
      model: typeof rawTeacher?.model === 'string' && rawTeacher.model.trim() ? rawTeacher.model.trim() : undefined,
      answeredAt: typeof rawTeacher?.answeredAt === 'string' && rawTeacher.answeredAt.trim() ? rawTeacher.answeredAt.trim() : undefined,
    };
    const teacherCtx = { ...identifiedCtx, teacher };
    const rawVerdicts = manifest.verdicts;
    if (!Array.isArray(rawVerdicts) || rawVerdicts.length === 0) {
      return reject('MANIFEST_INVALID', 'contradiction_reply.json の verdicts が空です。少なくとも1件の回答を入れてください。', ['verdicts が空配列または未設定です'], teacherCtx);
    }
    const verdicts = rawVerdicts.map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? item as ReplyVerdict : {} as ReplyVerdict));

    // ---- 結び付け検証（要求台帳との照合） ----
    const request = contradictionResolutionRequestService.get(requestId);
    if (!request) {
      return reject('REQUEST_NOT_FOUND', `要求ID ${requestId} は MIKI の矛盾解決台帳にありません。別の端末・別の要求への返却ではないか確認してください。`, [`台帳に無い requestId: ${requestId}`], teacherCtx);
    }
    if (request.status !== 'ISSUED') {
      return reject('REQUEST_NOT_ISSUED', `要求ID ${requestId} は受付可能な状態ではありません（現在の状態: ${request.status}）。既に受入済み、または却下・取消済みの要求への返却は受け付けません。`, [`要求の状態が ${request.status} です`], teacherCtx);
    }
    if (requestSha256 !== request.zipSha256.toLowerCase()) {
      return reject('REQUEST_HASH_MISMATCH', 'requestSha256 が要求パッケージと一致しません。返却が、MIKI が出した要求に対するものか確認してください（要求 .zip.txt を Base64 復号した ZIP 全体の SHA-256 が必要です）。', [`manifest: ${requestSha256}`, `台帳: ${request.zipSha256}`], teacherCtx);
    }

    // ---- verdict の項目別検証（形式不備はパッケージ単位で却下） ----
    const requestItems = new Map(request.items.map((item) => [item.itemId, item]));
    const verdictReasons: string[] = [];
    const seenItemIds = new Set<string>();
    for (const verdict of verdicts) {
      const itemId = typeof verdict.itemId === 'string' ? verdict.itemId.trim() : '';
      if (!itemId || !requestItems.has(itemId)) {
        verdictReasons.push(`要求に無い itemId への回答があります: ${itemId || '(空)'}`);
        continue;
      }
      if (seenItemIds.has(itemId)) {
        verdictReasons.push(`itemId が重複しています: ${itemId}`);
        continue;
      }
      seenItemIds.add(itemId);
      const verdictValue = typeof verdict.verdict === 'string' ? verdict.verdict.trim() : '';
      if (!VERDICTS.includes(verdictValue as ContradictionVerdict)) {
        verdictReasons.push(`${itemId}: verdict が語彙外です: ${verdictValue || '(空)'}`);
        continue;
      }
      const rationale = typeof verdict.rationale === 'string' ? verdict.rationale : '';
      if (!rationale.trim()) {
        verdictReasons.push(`${itemId}: rationale が空です（必須）`);
        continue;
      }
      if (verdictValue === 'MERGE') {
        const merged = typeof verdict.mergedStatement === 'string' ? verdict.mergedStatement : '';
        if (!merged.trim()) verdictReasons.push(`${itemId}: MERGE には mergedStatement が必須です`);
      }
    }
    if (verdictReasons.length > 0) {
      return reject('MANIFEST_INVALID', '回答の形式に不備があります。要求パッケージの replySpec の形式で返却してください。', verdictReasons, teacherCtx);
    }

    // ---- verdict の処理（既存経路への提出） ----
    const itemResults: ContradictionIntakeItemResult[] = [];
    const expediteClaimIds = new Set<string>();
    for (const verdict of verdicts) {
      const itemId = String(verdict.itemId).trim();
      const requestItem = requestItems.get(itemId)!;
      const result = this.processVerdict({
        intakeId,
        teacherName,
        itemId,
        claimAId: requestItem.claimAId,
        claimBId: requestItem.claimBId,
        verdict: String(verdict.verdict).trim() as ContradictionVerdict,
        rationale: String(verdict.rationale ?? '').trim(),
        mergedStatement: typeof verdict.mergedStatement === 'string' ? verdict.mergedStatement.trim() : undefined,
        supportingSourcesText: this.supportingSourcesText(verdict.supportingSources),
      });
      itemResults.push(result);
      systemLogger.info('SELF_IMPROVEMENT', `[矛盾解決] ${itemId} verdict=${result.verdict} outcome=${result.outcome} ${result.reason}`);
      if (result.verdict !== 'HOLD') {
        expediteClaimIds.add(result.claimAId);
        expediteClaimIds.add(result.claimBId);
        if (result.mergedClaimId) expediteClaimIds.add(result.mergedClaimId);
      }
    }

    // 受入の事実自体を EXECUTION 証拠として残す（部品供給受入の P436 と
    // 同じ作法。Claim には attach しない）。失敗しても受入は止めない。
    try {
      evidenceService.recordExecutionEvidence({
        title: `矛盾解決の受入 ${intakeId}`,
        snippet: `矛盾解決要求 ${requestId} の一括回答 ${sourceFileName} を受け付け、回答 ${itemResults.length} 件を証拠として既存の検証・信念改訂経路へ提出した（回答者: ${teacherName}）。`,
        source: 'contradiction_resolution_intake',
        sourceId: intakeId,
      });
    } catch {
      // 証拠の登録に失敗しても受入は続ける。
    }

    // 対象 Claim の park 中項目の待ちを解き、既存の回復経路を即時に走らせる。
    let expeditedCount = 0;
    if (expediteClaimIds.size > 0) {
      try {
        expeditedCount = autonomousSelfImprovementLoopService.expediteRequestsForClaims([...expediteClaimIds]);
      } catch {
        expeditedCount = 0;
      }
    }

    const settledCount = itemResults.filter((item) => item.outcome === 'SETTLED').length;
    const attachedCount = itemResults.filter((item) => item.outcome === 'EVIDENCE_ATTACHED' || item.outcome === 'MERGED_CANDIDATE_REGISTERED').length;
    const heldCount = itemResults.filter((item) => item.outcome === 'HELD').length;
    const unansweredCount = request.items.length - itemResults.length;

    const record: ContradictionResolutionIntakeRecord = {
      intakeId,
      requestId,
      status: 'RECEIVED',
      code: 'SUCCESS',
      reasons: [],
      sourceFileName,
      sourceType: resolvedSourceType,
      fileSizeBytes: input.bytes.length,
      packageSha256,
      manifestSha256,
      teacher,
      trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI',
      items: itemResults,
      expeditedCount,
      receivedAt,
    };
    this.ledger.set(intakeId, record);
    this.save();
    contradictionResolutionRequestService.recordStatus(
      requestId,
      'RECEIVED',
      `受入 ${intakeId}（回答者: ${teacherName}）決着 ${settledCount} 件／証拠付加 ${attachedCount} 件／保留 ${heldCount} 件${unansweredCount > 0 ? `／未回答 ${unansweredCount} 件は次回パッケージで再送` : ''}`,
    );
    systemLogger.info('SELF_IMPROVEMENT', `[矛盾解決 受入] ${intakeId} request=${requestId} teacher=${teacherName} settled=${settledCount} attached=${attachedCount} held=${heldCount} expedited=${expeditedCount}`);
    return {
      ok: true,
      code: 'SUCCESS',
      message: `矛盾への一括回答を受け付けました（決着 ${settledCount} 件／証拠付加 ${attachedCount} 件／保留 ${heldCount} 件）。決着した矛盾は、背景ループの再評価で実行の完了へ進みます。`,
      reasons: [],
      record: this.clone(record),
    };
  }
}

export const contradictionResolutionIntakeService = new ContradictionResolutionIntakeService();
