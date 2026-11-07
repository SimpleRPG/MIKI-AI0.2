import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { knowledgeConnectivityService } from '../../memory/services/knowledgeConnectivityService';
import { evidenceService, type EvidenceRecord } from '../../memory/services/evidenceService';
import { autonomousIssueDiscoveryService } from './autonomousIssueDiscoveryService';
import { autonomousSelfImprovementLoopService } from './autonomousSelfImprovementLoopService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { sha256HexFromText } from './canonicalSha256Service';

/*
 * P453（矛盾解決1）: Claim 矛盾の一括質問パッケージの生成・台帳・送出。
 *
 * 位置付け: 部品供給（P419 componentSupplyRequestService）の形を Claim
 * 矛盾へ広げたもの。キューに滞留する CLAIM_CONTRADICTION の実体は
 * Claim DB の未決着ペア（contradicted_by を持ち合い、双方とも
 * SUPERSEDED／FALSE でないもの）であり、その一覧・根拠（attach 済み
 * 証拠）・不足している証拠・park の文脈を 1 つの要求パッケージ
 * （ZIP を Base64 化した .zip.txt）に束ね、ユーザーが外部AI（教師）
 * へ手渡せる形で Downloads へ保存する。返ってきた回答の取り込みは
 * 矛盾解決2（contradictionResolutionIntakeService）であり、ここでは
 * 行わない。
 *
 * v1 の範囲:
 *  - 対象は未決着の矛盾ペアのみ。決着済み（片方が SUPERSEDED／FALSE）
 *    のペアは含めない。
 *  - 1 パッケージ最大 50 ペア。超える分は入れず、件数を manifest と
 *    台帳に明記する（残りは次のパッケージで出す。黙って落とさない）。
 *  - 発火は手動（自律改善ホームからの操作）。自動発火はしない。
 *  - 送出前にプライバシー検査を通し、検出したら送出を止めて理由を返す
 *    （部品供給と同じ作法）。
 *  - 証拠 snippet は1件 300 字で切り、切った旨を明記する。文脈の
 *    肥大化で黙って切り捨てることはしない（上限超過は理由を明示して
 *    失敗する）。
 */

export type ContradictionResolutionRequestStatus = 'ISSUED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';

export type ContradictionResolutionCreateCode =
  | 'SUCCESS'
  | 'NO_UNRESOLVED_CONTRADICTIONS'
  | 'PACKAGE_TOO_LARGE'
  | 'PRIVACY_BLOCKED'
  | 'ZIP_BUILD_FAILED'
  | 'ZIP_VERIFY_FAILED';

export interface ContradictionResolutionLedgerItem {
  itemId: string;
  claimAId: string;
  claimBId: string;
}

export interface ContradictionResolutionLedgerRecord {
  requestId: string;
  status: ContradictionResolutionRequestStatus;
  issuedAt: number;
  updatedAt: number;
  fileName: string;
  zipSha256: string;
  zipSizeBytes: number;
  base64Length: number;
  items: ContradictionResolutionLedgerItem[];
  /** パッケージに入らなかった未決着ペアの件数（上限超過分）。 */
  omittedPairCount: number;
  statusNote?: string;
}

export interface ContradictionResolutionArtifact extends ContradictionResolutionLedgerRecord {
  base64: string;
  entries: Array<{ name: string; sha256: string; sizeBytes: number }>;
}

export interface ContradictionResolutionCreateResult {
  ok: boolean;
  code: ContradictionResolutionCreateCode;
  message: string;
  reasons?: string[];
  artifact?: ContradictionResolutionArtifact;
}

// ClaimRecord は types.ts で any のため、ここで読む欄だけを構造として持つ。
interface ClaimShape {
  claim_id: string;
  statement: string;
  world?: string;
  kind?: string;
  status?: string;
  scope?: Record<string, unknown>;
  source?: string;
  origin_source_id?: string;
  independence_cluster_id?: string;
  maturity?: string;
  contradicted_by?: string[];
  created_at?: number;
  updated_at?: number;
}

interface ContradictionPair {
  pairKey: string;
  claimA: ClaimShape;
  claimB: ClaimShape;
  hasOpenIssue: boolean;
  oldestUpdatedAt: number;
}

const LEDGER_KEY = 'miki_contradiction_resolution_request_ledger_v1';

// 1 パッケージに束ねる矛盾ペアの上限。教師が1回で判断できる量と、
// パッケージの送出上限（Base64）の両方から決めた v1 の値。
const MAX_PAIRS_PER_PACKAGE = 50;
// 証拠 snippet の同梱上限（1件あたり）。全文が必要な場合は、その旨を
// 回答の notes に書いてもらう前提で、切り捨てを明記する。
const EVIDENCE_SNIPPET_LIMIT_CHARS = 300;
const EVIDENCE_PER_CLAIM_LIMIT = 10;
// 送出上限: 部品供給と同じ実用上限（ネイティブ保存の 2,000,000 字に
// 対する安全側の値）。
const MAX_PACKAGE_TEXT_CHARS = 1_900_000;

const textEncoder = new TextEncoder();
const byteLength = (text: string): number => textEncoder.encode(text).length;

class ContradictionResolutionRequestService {
  private ledger = new Map<string, ContradictionResolutionLedgerRecord>();
  private sequence = 0;

  constructor() {
    this.load();
  }

  // ------------------------------------------------------------------
  // 台帳（部品供給の要求台帳と同じ作法）
  // ------------------------------------------------------------------
  private load(): void {
    try {
      const raw = storageService.getItem(LEDGER_KEY);
      const values = raw ? JSON.parse(raw) : [];
      if (Array.isArray(values)) {
        for (const value of values) {
          if (value && typeof value.requestId === 'string') {
            this.ledger.set(value.requestId, value as ContradictionResolutionLedgerRecord);
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
      const records = [...this.ledger.values()].sort((a, b) => b.issuedAt - a.issuedAt).slice(0, 100);
      storageService.setItem(LEDGER_KEY, JSON.stringify(records));
      return true;
    } catch {
      return false;
    }
  }

  private clone(record: ContradictionResolutionLedgerRecord): ContradictionResolutionLedgerRecord {
    return { ...record, items: record.items.map((item) => ({ ...item })) };
  }

  public list(): ContradictionResolutionLedgerRecord[] {
    return [...this.ledger.values()]
      .sort((a, b) => b.issuedAt - a.issuedAt)
      .map((record) => this.clone(record));
  }

  public get(requestId: string): ContradictionResolutionLedgerRecord | undefined {
    const record = this.ledger.get(requestId);
    return record ? this.clone(record) : undefined;
  }

  /** 矛盾解決2（受入）が状態遷移を足すための口。 */
  public recordStatus(requestId: string, status: ContradictionResolutionRequestStatus, note?: string): boolean {
    const record = this.ledger.get(requestId);
    if (!record) return false;
    record.status = status;
    record.updatedAt = Date.now();
    if (note) record.statusNote = note;
    this.ledger.set(requestId, record);
    return this.save();
  }

  // ------------------------------------------------------------------
  // 未決着ペアの列挙
  // ------------------------------------------------------------------
  private enumeratePairs(): ContradictionPair[] {
    const claims = claimDatabaseService.getAllClaims() as ClaimShape[];
    const byId = new Map(claims.map((claim) => [claim.claim_id, claim]));
    const openIssueClaimIds = new Set(
      autonomousIssueDiscoveryService
        .list(200)
        .filter((issue) => issue.kind === 'CLAIM_CONTRADICTION' && !issue.resolvedAt)
        .map((issue) => issue.sourceId),
    );
    const pairs = new Map<string, ContradictionPair>();
    for (const claim of claims) {
      if (claim.status === 'SUPERSEDED' || claim.status === 'FALSE') continue;
      for (const otherId of claim.contradicted_by ?? []) {
        const other = byId.get(otherId);
        if (!other) continue;
        if (other.status === 'SUPERSEDED' || other.status === 'FALSE') continue;
        const [first, second] = [claim, other].sort((a, b) => a.claim_id.localeCompare(b.claim_id));
        const pairKey = `${first.claim_id}|${second.claim_id}`;
        if (pairs.has(pairKey)) continue;
        pairs.set(pairKey, {
          pairKey,
          claimA: first,
          claimB: second,
          hasOpenIssue: openIssueClaimIds.has(first.claim_id) || openIssueClaimIds.has(second.claim_id),
          oldestUpdatedAt: Math.min(first.updated_at ?? 0, second.updated_at ?? 0),
        });
      }
    }
    // 決定的な並び: 未解決の発見項目を持つペアを先に、次に古い順、最後にペアキー。
    return [...pairs.values()].sort((a, b) =>
      Number(b.hasOpenIssue) - Number(a.hasOpenIssue) ||
      a.oldestUpdatedAt - b.oldestUpdatedAt ||
      a.pairKey.localeCompare(b.pairKey)
    );
  }

  /** 現在の未決着ペア数（UI の件数表示用）。 */
  public countUnresolvedPairs(): number {
    return this.enumeratePairs().length;
  }

  // ------------------------------------------------------------------
  // 文脈の組み立て
  // ------------------------------------------------------------------
  private evidenceSummary(claimId: string): { evidence: Array<Record<string, unknown>>; independentClusters: number } {
    const records = evidenceService.list({ claimId });
    const clusters = new Set(
      records.filter((record) => record.status === 'ADMISSIBLE').map((record) => record.independence_cluster_id),
    );
    const evidence = records.slice(0, EVIDENCE_PER_CLAIM_LIMIT).map((record: EvidenceRecord) => {
      const truncated = record.snippet.length > EVIDENCE_SNIPPET_LIMIT_CHARS;
      return {
        evidenceId: record.evidence_id,
        kind: record.kind,
        status: record.status,
        title: record.title,
        snippet: truncated ? record.snippet.slice(0, EVIDENCE_SNIPPET_LIMIT_CHARS) : record.snippet,
        snippetTruncated: truncated,
        source: record.source,
        ...(record.url ? { url: record.url } : {}),
        independenceClusterId: record.independence_cluster_id,
      };
    });
    return { evidence, independentClusters: clusters.size };
  }

  private claimView(claim: ClaimShape): Record<string, unknown> {
    const { evidence, independentClusters } = this.evidenceSummary(claim.claim_id);
    return {
      claimId: claim.claim_id,
      statement: claim.statement,
      world: claim.world ?? '',
      kind: claim.kind ?? '',
      status: claim.status ?? '',
      scope: claim.scope ?? {},
      source: claim.source ?? '',
      originSourceId: claim.origin_source_id ?? '',
      independenceClusterId: claim.independence_cluster_id ?? '',
      maturity: claim.maturity ?? '',
      createdAt: claim.created_at ?? 0,
      updatedAt: claim.updated_at ?? 0,
      independentEvidenceClusters: independentClusters,
      evidence,
    };
  }

  private queueContextFor(pair: ContradictionPair): Record<string, unknown> | undefined {
    const queue = autonomousSelfImprovementLoopService.getState().queue;
    const targetIds = new Set([pair.claimA.claim_id, pair.claimB.claim_id]);
    for (const item of queue) {
      const context = item.payload?.claimContext as Record<string, unknown> | undefined;
      if (!context || typeof context.claimId !== 'string' || !targetIds.has(context.claimId)) continue;
      return {
        queueRequestId: item.id,
        trigger: item.trigger,
        waitKind: item.waitKind ?? '',
        waitReason: item.waitReason ?? '',
        evidenceWaitCount: item.evidenceWaitCount ?? 0,
        attempts: item.attempts,
      };
    }
    const issue = autonomousIssueDiscoveryService
      .list(200)
      .find((item) => item.kind === 'CLAIM_CONTRADICTION' && !item.resolvedAt && targetIds.has(item.sourceId));
    if (issue) {
      return {
        issueId: issue.id,
        detail: issue.detail,
        lastOutcome: issue.lastOutcome ?? '',
        occurrences: issue.occurrences,
      };
    }
    return undefined;
  }

  private missingEvidenceFor(pair: ContradictionPair, clustersA: number, clustersB: number): string[] {
    const missing: string[] = [];
    const describe = (claim: ClaimShape, clusters: number) => {
      if (clusters < 2) {
        missing.push(`${claim.claim_id}: 独立証拠クラスタは現在 ${clusters} 件。検証器が SUPPORTED にするには2件以上の独立した裏付けが必要です。`);
      }
    };
    describe(pair.claimA, clustersA);
    describe(pair.claimB, clustersB);
    missing.push(
      '矛盾相手が有効な間は検証器はどちらも昇格させません。決着には、片方を正しいとして信念改訂で他方を置換（SUPERSEDED）できるだけの裏付けか、誤っている側を確定できる証拠が必要です。現在の自動調査では INDEPENDENT_EVIDENCE_CONFIRMATION_MISSING（独立した裏付けの確認不足）で証拠待ちになっています。',
    );
    return missing;
  }

  // ------------------------------------------------------------------
  // 要求パッケージ生成（本体）
  // ------------------------------------------------------------------
  private logCreateBlocked(code: ContradictionResolutionCreateCode, message: string, reasons?: string[]): void {
    systemLogger.warn('SELF_IMPROVEMENT', `[矛盾解決 要求作成却下] code=${code} ${message}`, { reasons: reasons ?? [] });
  }

  public async createPackage(): Promise<ContradictionResolutionCreateResult> {
    const enumerated = this.enumeratePairs();
    // P474: 接続性で並び替える。会話・タスク・gap に繋がる Claim を
    // 含むペアを先にし、両側とも孤立したペアは後ろへ（上限で切り捨て
    // られる場合も孤立ペアから落ちる）。教師の判断コストを、使われ
    // 見込みのある知識に先に使うための順序付けで、除外ではない。
    const allPairs = enumerated
      .map((pair, index) => ({
        pair,
        index,
        rank: Math.min(
          knowledgeConnectivityService.rankOf(pair.claimA.claim_id),
          knowledgeConnectivityService.rankOf(pair.claimB.claim_id),
        ),
      }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((entry) => entry.pair);
    if (allPairs.length === 0) {
      this.logCreateBlocked('NO_UNRESOLVED_CONTRADICTIONS', '未決着の Claim 矛盾がありません');
      return {
        ok: false,
        code: 'NO_UNRESOLVED_CONTRADICTIONS',
        message: '未決着の Claim 矛盾がありません。矛盾パッケージは、矛盾したまま滞留している Claim のペアがある場合にだけ作成できます。',
      };
    }
    const included = allPairs.slice(0, MAX_PAIRS_PER_PACKAGE);
    const omittedPairCount = allPairs.length - included.length;

    const issuedAt = Date.now();
    this.sequence += 1;
    const requestId = `CR-REQ-${issuedAt}-${String(this.sequence).padStart(3, '0')}`;
    const fileName = `MIKI_CONTRADICTION_REQUEST_${requestId}.zip.txt`;

    const items = included.map((pair, index) => {
      const itemId = `CR-${String(index + 1).padStart(3, '0')}`;
      const viewA = this.claimView(pair.claimA);
      const viewB = this.claimView(pair.claimB);
      const queueContext = this.queueContextFor(pair);
      return {
        itemId,
        claimA: viewA,
        claimB: viewB,
        missingEvidence: this.missingEvidenceFor(
          pair,
          Number(viewA.independentEvidenceClusters ?? 0),
          Number(viewB.independentEvidenceClusters ?? 0),
        ),
        ...(queueContext ? { queueContext } : {}),
      };
    });

    const contradictionRequest = {
      formatVersion: 1,
      requestId,
      createdAt: new Date(issuedAt).toISOString(),
      kind: 'CLAIM_CONTRADICTION_RESOLUTION',
      summary: [
        `MIKI の知識（Claim）の中で、矛盾したまま自動調査では決着できずに滞留しているペアが ${items.length} 件あります。`,
        'それぞれについて、どちらの主張が立つか（または両方とも誤りか、統合できるか、判断保留か）を、理由とともに返してください。',
        '返された回答は MIKI 側で証拠として記録され、既存の検証・信念改訂の関門を通った場合にだけ矛盾が解消されます。回答だけで主張が無条件に確定することはありません。',
        omittedPairCount > 0 ? `なお、未決着のペアは他に ${omittedPairCount} 件あります（このパッケージには含めていません。次回に回します）。` : '',
      ].filter(Boolean).join('\n'),
      items,
      replySpec: {
        format: 'ZIP ファイル 1 つで返却してください（ファイル名の目安: MIKI_CONTRADICTION_REPLY_' + requestId + '.zip）。ZIP のルートに contradiction_reply.json を置いてください（.zip.txt＝Base64 形式でも受け付けます）。',
        manifestFile: 'contradiction_reply.json（ZIP のルートに置くこと）',
        manifest: {
          formatVersion: 1,
          requestId,
          requestSha256: '受け取った要求 .zip.txt を Base64 復号した ZIP バイナリ全体の SHA-256（16進小文字）。改変検出のため必須です。',
          teacher: { name: '回答者名（例: Claude / ChatGPT）', model: 'モデル名（任意）', answeredAt: 'ISO 8601 の日時（任意）' },
          verdicts: [
            {
              itemId: '要求の items[].itemId のいずれか',
              verdict: 'A_STANDS | B_STANDS | BOTH_WRONG | MERGE | HOLD のいずれか',
              rationale: '必須・空不可。判断の理由。具体的に書いてください（この文章が MIKI 側で証拠・学習素材として保存されます）。',
              mergedStatement: 'verdict が MERGE のとき必須。両者を統合した新しい主張文。',
              supportingSources: [{ title: '出典のタイトル', url: 'URL（任意）', excerpt: '根拠となる抜粋（任意）' }],
            },
          ],
          notes: '回答者から MIKI への申し送り（任意）。',
        },
        verdictMeanings: {
          A_STANDS: 'claimA が正しく、claimB が誤り（または古い）。',
          B_STANDS: 'claimB が正しく、claimA が誤り（または古い）。',
          BOTH_WRONG: '両方とも誤り。理由を rationale に書いてください。',
          MERGE: '両者は統合できる（条件や範囲を分ければ両立する等）。mergedStatement に統合後の主張文を書いてください。',
          HOLD: '提示された材料だけでは判断できません。何が足りないかを rationale に書いてください。保留は正しい回答として扱われます。教師側の制約で判断できない場合は、rationale の冒頭に「教師制約：」と明記してください。',
        },
        rules: [
          'contradiction_reply.json の requestId は要求のものをそのまま返してください。',
          'requestSha256 には、受け取った要求 ZIP（Base64 復号後）の SHA-256 を入れてください。',
          'verdicts は items のすべてについて返してください（判断できないものは HOLD）。',
          'rationale は必須です。空の回答は受け付けません。',
          '出典を挙げる場合は supportingSources に書いてください。存在しない出典を作らないでください。',
          '材料が不足して判断できない場合は、推測で決めず HOLD にしてください。',
          '教師側の制約（ポリシー・運用上の理由）で判断できない場合は、正誤の判断をせず HOLD とし、rationale の冒頭に「教師制約：」と明記してください。制約は知識の正誤ではなく、材料不足の保留とも区別して記録されます。',
        ],
      },
      provenance: {
        issuedBy: 'MIKI',
        appVersion: storageService.getItem('miki_app_version') || 'unknown',
        generator: 'contradictionResolutionRequestService (P453)',
      },
    };

    const instructions = this.buildInstructions(contradictionRequest, items, omittedPairCount);

    // ---- 送出前プライバシー検査（部品供給と同じパート別監査） ----
    const auditParts: Array<{ name: string; text: string }> = [
      { name: 'contradiction_request.json', text: JSON.stringify(contradictionRequest, null, 2) },
      { name: 'INSTRUCTIONS.md', text: instructions },
    ];
    const privacyReasons: string[] = [];
    const privacyMessages: string[] = [];
    for (const part of auditParts) {
      const audit = privacyGuardrailService.auditOutboundContent(part.text, 'contradiction_resolution_package', { autoSanitize: false });
      if (audit.allowed) continue;
      for (const violation of audit.violations) {
        const violationMessage = String(violation?.message || '');
        if (violationMessage && !privacyMessages.includes(violationMessage)) privacyMessages.push(violationMessage);
        const masked = `${String(violation?.snippet ?? '').slice(0, 3)}***`;
        privacyReasons.push(`${part.name}: ${violationMessage}（${masked}）`);
      }
    }
    if (privacyReasons.length > 0) {
      this.logCreateBlocked('PRIVACY_BLOCKED', '送出前プライバシー検査で検出がありました', privacyReasons);
      return {
        ok: false,
        code: 'PRIVACY_BLOCKED',
        message: `送出前プライバシー検査で検出があったため、パッケージを作成しませんでした。 セキュリティ境界違反: ${privacyMessages.slice(0, 2).join(', ')}`,
        reasons: privacyReasons,
      };
    }

    // ---- ZIP 組み立て ----
    let zipBytes: Uint8Array;
    let sumsText: string;
    const requestJson = JSON.stringify(contradictionRequest, null, 2);
    try {
      const zip = new JSZip();
      const filesForSums: Array<{ name: string; content: string }> = [
        { name: 'contradiction_request.json', content: requestJson },
        { name: 'INSTRUCTIONS.md', content: instructions },
      ];
      for (const file of filesForSums) zip.file(file.name, file.content);
      sumsText = filesForSums.map((file) => `${sha256HexFromText(file.content)}  ${file.name}`).join('\n') + '\n';
      zip.file('SHA256SUMS.txt', sumsText);
      zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    } catch (error) {
      return { ok: false, code: 'ZIP_BUILD_FAILED', message: `矛盾パッケージの ZIP 生成に失敗しました: ${error instanceof Error ? error.message : String(error)}` };
    }

    const base64 = this.toBase64(zipBytes);
    if (base64.length > MAX_PACKAGE_TEXT_CHARS) {
      return {
        ok: false,
        code: 'PACKAGE_TOO_LARGE',
        message: `パッケージが送出上限を超えました（Base64 ${base64.length} 字 / 上限 ${MAX_PACKAGE_TEXT_CHARS} 字）。`,
      };
    }
    const zipSha256 = await this.sha256Hex(zipBytes);

    // ---- 読み戻し検証（SHA256SUMS と実ファイルの照合） ----
    try {
      const check = await JSZip.loadAsync(zipBytes);
      const sumsEntry = check.file('SHA256SUMS.txt');
      if (!sumsEntry) throw new Error('SHA256SUMS.txt missing');
      const sums = await sumsEntry.async('string');
      for (const line of sums.split('\n').filter(Boolean)) {
        const [expected, name] = line.split(/\s{2}/);
        const entry = name ? check.file(name) : null;
        if (!entry) throw new Error(`entry missing: ${name}`);
        const actual = sha256HexFromText(await entry.async('string'));
        if (actual !== expected) throw new Error(`hash mismatch: ${name}`);
      }
      if (!check.file('contradiction_request.json') || !check.file('INSTRUCTIONS.md')) throw new Error('required entry missing');
    } catch (error) {
      return { ok: false, code: 'ZIP_VERIFY_FAILED', message: `生成したパッケージの読み戻し検証に失敗しました: ${error instanceof Error ? error.message : String(error)}` };
    }

    // ---- 台帳へ ISSUED で記録 ----
    const record: ContradictionResolutionLedgerRecord = {
      requestId,
      status: 'ISSUED',
      issuedAt,
      updatedAt: issuedAt,
      fileName,
      zipSha256,
      zipSizeBytes: zipBytes.length,
      base64Length: base64.length,
      items: items.map((item) => ({
        itemId: item.itemId,
        claimAId: String((item.claimA as Record<string, unknown>).claimId ?? ''),
        claimBId: String((item.claimB as Record<string, unknown>).claimId ?? ''),
      })),
      omittedPairCount,
      ...(omittedPairCount > 0 ? { statusNote: `未決着ペアのうち ${omittedPairCount} 件は上限のため次回に回しました` } : {}),
    };
    this.ledger.set(requestId, record);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[矛盾解決 要求作成] ${requestId} items=${items.length} omitted=${omittedPairCount} file=${fileName}`);

    const artifact: ContradictionResolutionArtifact = {
      ...this.clone(record),
      base64,
      entries: [
        { name: 'contradiction_request.json', sha256: sha256HexFromText(requestJson), sizeBytes: byteLength(requestJson) },
        { name: 'INSTRUCTIONS.md', sha256: sha256HexFromText(instructions), sizeBytes: byteLength(instructions) },
        { name: 'SHA256SUMS.txt', sha256: sha256HexFromText(sumsText), sizeBytes: byteLength(sumsText) },
      ],
    };
    return {
      ok: true,
      code: 'SUCCESS',
      message: `矛盾パッケージを作成しました（要求ID: ${requestId}、矛盾 ${items.length} 件）。`,
      artifact,
    };
  }

  /** Downloads への保存（部品供給と同じネイティブ経路）。 */
  public async savePackageToDownloads(artifact: ContradictionResolutionArtifact): Promise<boolean> {
    return systemLogger.saveTextFileToDownloads(artifact.fileName, artifact.base64);
  }

  // ------------------------------------------------------------------
  // 内部ユーティリティ
  // ------------------------------------------------------------------
  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  private async sha256Hex(bytes: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  private buildInstructions(
    request: Record<string, unknown>,
    items: Array<Record<string, unknown>>,
    omittedPairCount: number,
  ): string {
    const claimLines = (label: string, claim: Record<string, unknown>): string[] => {
      const evidence = Array.isArray(claim.evidence) ? (claim.evidence as Array<Record<string, unknown>>) : [];
      return [
        `### ${label}: ${String(claim.claimId ?? '')}`,
        '',
        `主張: ${String(claim.statement ?? '')}`,
        `- 状態: ${String(claim.status ?? '')} / 種別: ${String(claim.kind ?? '')} / 世界: ${String(claim.world ?? '')} / 成熟度: ${String(claim.maturity ?? '')}`,
        `- 出典: ${String(claim.source ?? '')}（${String(claim.originSourceId ?? '')}）`,
        `- 独立証拠クラスタ: ${String(claim.independentEvidenceClusters ?? 0)} 件`,
        evidence.length > 0 ? '- 根拠（attach 済み証拠）:' : '- 根拠（attach 済み証拠）: なし',
        ...evidence.map((item) => `  - [${String(item.kind ?? '')}/${String(item.status ?? '')}] ${String(item.title ?? '')}: ${String(item.snippet ?? '')}${item.url ? ` (${String(item.url)})` : ''}`),
        '',
      ];
    };
    const itemSections: string[] = [];
    for (const item of items) {
      itemSections.push(
        `## ${String(item.itemId ?? '')}: ${String((item.claimA as Record<string, unknown>).claimId ?? '')} vs ${String((item.claimB as Record<string, unknown>).claimId ?? '')}`,
        '',
        ...claimLines('主張A', item.claimA as Record<string, unknown>),
        ...claimLines('主張B', item.claimB as Record<string, unknown>),
        '不足しているもの:',
        ...((item.missingEvidence as string[] | undefined) ?? []).map((line) => `- ${line}`),
        '',
      );
    }
    return [
      '# MIKI Claim矛盾への一括回答のお願い',
      '',
      'あなたは、スマートフォンアプリ「MIKI」の知識（Claim）の矛盾解消を手伝う**教師**の役割です。',
      'MIKI の中では、互いに矛盾する主張のペアが、自動調査では決着できずに滞留しています。',
      'それぞれのペアについて、どちらの主張が立つかを判断し、理由とともに返してください。',
      '',
      '返された回答は MIKI 側で**証拠**として記録され、既存の検証・信念改訂の関門を通った場合にだけ矛盾が解消されます。',
      '回答だけで主張が無条件に「正しい」と確定することはありません。だからこそ、理由（rationale）を具体的に書いてください。',
      '材料が不足して判断できないペアは、推測で決めずに HOLD（判断保留）にしてください。HOLD は正しい回答として扱われます。',
      '教師側の制約（ポリシー・運用上の理由）で判断できない場合は、正誤の判断をせず、HOLD にしたうえで rationale の冒頭に「教師制約：」と明記してください。制約は知識の正誤ではありません。制約による保留は、材料不足による保留と区別して記録されます。',
      '',
      '## このファイルの開き方',
      '',
      '受け取ったファイル（.zip.txt の中身）は Base64 文字列です。まず Base64 復号して ZIP として開いてください。',
      'ZIP の中身:',
      '- contradiction_request.json … 機械可読な要求本体（矛盾ペア、根拠、不足している証拠、返却形式）',
      '- INSTRUCTIONS.md … この文書（全ペアの内容を文章でも列挙しています）',
      '- SHA256SUMS.txt … 同梱ファイルの SHA-256 一覧',
      '',
      `## 対象の矛盾（${items.length} 件${omittedPairCount > 0 ? `／他に ${omittedPairCount} 件ありますが今回は含めていません` : ''}）`,
      '',
      ...itemSections,
      '## 返し方',
      '',
      'ZIP ファイル 1 つで返却してください。中身は contradiction_reply.json（ZIP のルート）だけです。',
      '形式の正本は contradiction_request.json の replySpec です。要点:',
      `- requestId は要求のもの（${String(request.requestId)}）をそのまま返すこと`,
      '- requestSha256 には、受け取った要求 ZIP（Base64 復号後バイナリ）の SHA-256（16進小文字）を入れること',
      '- verdicts には全 item についての回答を入れること。各 verdict には itemId、verdict、rationale（必須）が要ります',
      '- verdict の意味: A_STANDS＝主張Aが正しい／B_STANDS＝主張Bが正しい／BOTH_WRONG＝両方とも誤り／MERGE＝統合できる（mergedStatement に統合後の主張文を書くこと）／HOLD＝判断保留（何が足りないかを rationale に書くこと）',
      '- 出典を挙げる場合は supportingSources に書くこと。存在しない出典を作らないこと',
      '- teacher.name（回答者名。例: Claude）と、できれば answeredAt（ISO 8601）を入れること',
      '',
    ].join('\n');
  }
}

export const contradictionResolutionRequestService = new ContradictionResolutionRequestService();
