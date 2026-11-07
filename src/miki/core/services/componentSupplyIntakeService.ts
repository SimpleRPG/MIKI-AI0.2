import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { evidenceService } from '../../memory/services/evidenceService';
import { componentSupplyRequestService } from './componentSupplyRequestService';
import { teacherVerificationEvidenceService, type TeacherVerificationRound } from '../../verification/services/teacherVerificationEvidenceService';
import { improvementIntakeRouterService, type ImprovementIntakeRun } from './improvementIntakeRouterService';
import { autonomousSelfImprovementLoopService, TEACHER_RETURN_PRIORITY } from './autonomousSelfImprovementLoopService';
import { taskBlackboardService } from './taskBlackboardService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { sha256HexFromText } from './canonicalSha256Service';

/*
 * P420（供給2）: 部品供給パッケージの受入・結び付け検証・候補受け口への接続。
 *
 * 位置付け: 外部（ChatGPT / Claude / Muse 等）は「素材供給」まで。
 * 供給1（componentSupplyRequestService）が出した要求へ外部AIが返した
 * 返却 ZIP（または .zip.txt＝Base64）をユーザーがアプリ内で選ぶと、
 * ここで解凍・安全化・結合検証・ベースライン照合を行い、通った候補だけを
 * 新規の改善 run の payload.implementationCandidates に載せて
 * improvementIntakeRouterService.receive() で投入する。生成段の受け口
 * （parseImplementationCandidates）は P419 以前から実装済みだが入力配線が
 * 無かった「死に口」であり、本サービスがその蛇口になる。
 *
 * 直接採用は構造的に起きない: 候補は run 経由で GENERATE_CANDIDATE に
 * 入り、CODE Component CANDIDATE（検証待ち）としてのみ登録される
 * （検証・採用の関門は既存経路のまま一切変更しない）。
 *
 * run の種別は USER_REQUEST とする。prepareForRun の実態確認に基づく:
 *  - EXTERNAL_DIRECTIVE 分岐は準備段で AI ドラフト（ファイル丸ごと
 *    差し替え案）を必須とし、隔離ワークスペースへ入れる別系統である。
 *  - USER_REQUEST 分岐は payload.targetFiles から対象を解決でき、
 *    DiscoveredIssue を要求しない。生成段の部品候補経路
 *    （payload.implementationCandidates）はこの種別でそのまま通る。
 *
 * 信頼水準は externalReviewIntakeService の先例どおり
 * 'SEMI_TRUSTED_EXTERNAL_AI'（半信頼の外部AI素材）として受入記録と
 * run の payload に刻む。出所（supplier の申告）は受入台帳に残す。
 */

/**
 * P476: ユーザー信頼ルール（2026-11-07）の供給者判定。
 * 「教師一般」ではなく Muse 個人への信頼であり、他の AI（ChatGPT
 * 等）は対象外。供給者名が Muse を指す場合にだけ、その供給に付いた
 * 検証済み TVE をクラウド検証として扱う（candidateCodeGeneration
 * Service の P476 昇格）。名前の判定は申告ベースであり、パッケージは
 * ユーザー本人が手渡す運用を前提とする。
 */
export function isClaudeVerifierName(name: string): boolean {
  const normalized = String(name || '').trim().toLowerCase();
  return (
    normalized === 'claude' ||
    normalized.startsWith('claude ') ||
    normalized.startsWith('claude(') ||
    normalized.startsWith('claude（')
  );
}

export type ComponentSupplyIntakeStatus = 'RECEIVED' | 'REJECTED';

export type ComponentSupplyIntakeCode =
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
  | 'REQUEST_HASH_MISMATCH'
  | 'CANDIDATE_PATH_OUT_OF_SCOPE'
  | 'CANDIDATE_FILE_MISSING'
  | 'CANDIDATE_FIELDS_MISSING'
  | 'TEACHER_VERIFICATION_INVALID'
  | 'BASELINE_MISMATCH'
  | 'RUN_CREATE_FAILED';

export interface ComponentSupplySupplier {
  name: string;
  model?: string;
  suppliedAt?: string;
}

/*
 * P458: 材料保全の状態。受入れた候補は run の payload にしか存在せず、
 * run がキューから drop されると材料ごと消えた（LOG_6: 001 が
 * BLACKBOARD_TASK_NOT_RESUMABLE、002 が MAX_ATTEMPTS_REACHED で喪失）。
 * 受入時点で候補実体と payload を台帳へ複製し（PRESERVED）、run が
 * 孤児になったら台帳から再投入する。候補が検証の梯子側へ渡り切ったら
 * CONSUMED、再投入の上限に達したら EXHAUSTED（材料自体は台帳に残る）。
 */
export interface ComponentSupplyPreservation {
  status: 'PRESERVED' | 'CONSUMED' | 'EXHAUSTED';
  requeueCount: number;
  lastRequeuedAt?: number;
  lastRequeueRunId?: string;
  orphanDetectedAt?: number;
  consumedBy?: string;
}

export interface ComponentSupplyIntakeRecord {
  intakeId: string;
  requestId: string;
  status: ComponentSupplyIntakeStatus;
  code: ComponentSupplyIntakeCode;
  reasons: string[];
  sourceFileName: string;
  sourceType: 'ZIP' | 'ZIPTXT';
  fileSizeBytes: number;
  /** 返却 ZIP バイナリ全体の SHA-256。 */
  packageSha256: string;
  /** supply_reply.json 本文の平文 SHA-256。 */
  manifestSha256: string;
  supplier?: ComponentSupplySupplier;
  trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI';
  candidatePaths: string[];
  originRunId?: string;
  newRunId?: string;
  receivedAt: number;
  /** P449: 受入時に検証済みの TVE（教師検証証拠）の要約。候補ごと。 */
  teacherVerification?: Array<{
    path: string;
    verifier: string;
    verifiedAt: string;
    rounds: number;
    implementationSha256: string;
  }>;
  /** P449: TVE が無効だったため候補単位で落とした理由。 */
  teacherVerificationDropped?: string[];
  /*
   * P458: drop 保全。候補実体（TVE ラウンド込み）の複製。run の payload
   * とは独立に台帳へ残すため、キュー項目が drop されても材料は消えない。
   */
  preservedCandidates?: Array<Record<string, unknown>>;
  /*
   * P458: drop 保全。再投入に使う run payload の複製。
   * sourceSnapshotSha256 は receive() が現在値で付け直すため含めない。
   */
  preservedPayload?: Record<string, unknown>;
  /** P458: drop 保全。再投入時の objective（元 run のものを保持）。 */
  preservedObjective?: string;
  /** P458: 保全の状態（再投入回数・消費済み・上限到達）。 */
  preservation?: ComponentSupplyPreservation;
}

export interface ComponentSupplyIntakeResult {
  ok: boolean;
  code: ComponentSupplyIntakeCode;
  message: string;
  reasons: string[];
  record?: ComponentSupplyIntakeRecord;
  runId?: string;
}

interface ReplyCandidate {
  path?: unknown;
  file?: unknown;
  purpose?: unknown;
  componentType?: unknown;
  inputs?: unknown;
  outputs?: unknown;
  prerequisites?: unknown;
  dependencies?: unknown;
  supportedEnvironments?: unknown;
  entryPoint?: unknown;
  exports?: unknown;
  imports?: unknown;
  publicInterfaces?: unknown;
  tests?: unknown;
  validation?: unknown;
  /** P449: 教師検証証拠（TVE）。任意。1ラウンド分。 */
  teacherVerification?: unknown;
  /** P449: 追加の TVE ラウンド（Canary 用の新規検証ラウンド等）。任意。 */
  teacherVerificationRounds?: unknown;
}

const LEDGER_KEY = 'miki_component_supply_intake_ledger_v1';

// 入力全体の上限。要求側の送出上限（Base64 1,900,000字 ≒ ZIP 1.42MB）
// より少し大きく取り、返却 ZIP（非圧縮の生 .zip も可）を直接選んでも
// 通る範囲にする。これを超える返却物は分割・圧縮を依頼する前提。
const MAX_INPUT_BYTES = 3_000_000;
// 解凍後の安全上限（priority12 の先例と調査報告 §4.1 の目安）。
const MAX_FILES = 100;
const MAX_TOTAL_CONTENT_BYTES = 10 * 1024 * 1024;

// P458: 1受入あたりの自動再投入の上限。起動のたびに無条件で戻すと
// 「失敗→drop→再投入→失敗」が起動回数分だけ繰り返されるため、
// 回数で止める。材料自体は台帳に残り、手動再投入は上限の対象外。
export const MAX_SUPPLY_PRESERVATION_REQUEUES = 5;

const textEncoder = new TextEncoder();
const byteLength = (text: string): number => textEncoder.encode(text).length;

/** priority12ArtifactWorkspaceService の normalizePath と同じ作法。 */
const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error('UNSAFE_ARTIFACT_PATH');
  }
  return normalized;
};

class ComponentSupplyIntakeService {
  private ledger = new Map<string, ComponentSupplyIntakeRecord>();
  private sequence = 0;

  constructor() {
    this.load();
  }

  // ------------------------------------------------------------------
  // 受入台帳（要求台帳と同じ作法: メモリ Map＋storageService 永続化）
  // ------------------------------------------------------------------
  private load(): void {
    try {
      const raw = storageService.getItem(LEDGER_KEY);
      const values = raw ? JSON.parse(raw) : [];
      if (Array.isArray(values)) {
        for (const value of values) {
          if (value && typeof value.intakeId === 'string') {
            this.ledger.set(value.intakeId, value as ComponentSupplyIntakeRecord);
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

  private clone(record: ComponentSupplyIntakeRecord): ComponentSupplyIntakeRecord {
    return {
      ...record,
      reasons: [...record.reasons],
      candidatePaths: [...record.candidatePaths],
      supplier: record.supplier ? { ...record.supplier } : undefined,
      teacherVerification: record.teacherVerification ? record.teacherVerification.map((item) => ({ ...item })) : undefined,
      teacherVerificationDropped: record.teacherVerificationDropped ? [...record.teacherVerificationDropped] : undefined,
      // P458: 保全物は run やキューの側と参照を共有しない（JSON 複製）。
      preservedCandidates: record.preservedCandidates ? JSON.parse(JSON.stringify(record.preservedCandidates)) as Array<Record<string, unknown>> : undefined,
      preservedPayload: record.preservedPayload ? JSON.parse(JSON.stringify(record.preservedPayload)) as Record<string, unknown> : undefined,
      preservation: record.preservation ? { ...record.preservation } : undefined,
    };
  }

  public list(): ComponentSupplyIntakeRecord[] {
    return [...this.ledger.values()]
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .map((record) => this.clone(record));
  }

  public get(intakeId: string): ComponentSupplyIntakeRecord | undefined {
    const record = this.ledger.get(intakeId);
    return record ? this.clone(record) : undefined;
  }

  public listByRequest(requestId: string): ComponentSupplyIntakeRecord[] {
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

  private stringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map((x) => x.trim())
      : [];
  }

  /**
   * 生成段 parseImplementationCandidates は inputs / outputs を文字列配列
   * としてのみ読み取る（this.strings）。返却仕様の {name, type} 形は
   * そのままでは落ちてしまうため、"name: type" の文字列へ変換して残す。
   */
  private namedTypeStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        if (item.trim()) result.push(item.trim());
        continue;
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name.trim() : '';
        if (!name) continue;
        const type = typeof record.type === 'string' && record.type.trim() ? record.type.trim() : 'unknown';
        result.push(`${name}: ${type}`);
      }
    }
    return result;
  }

  private async resolveCurrentContent(path: string): Promise<string | undefined> {
    const held = selfCodeSpaceService.readFile(path);
    if (held && typeof held.content === 'string') return held.content;
    const fetched = await selfCodeSpaceService.ensureFileContents([path]);
    const content = fetched.get(path);
    return typeof content === 'string' ? content : undefined;
  }

  // ------------------------------------------------------------------
  // 受入本体
  // ------------------------------------------------------------------
  public async receiveReply(input: { fileName: string; bytes: Uint8Array }): Promise<ComponentSupplyIntakeResult> {
    const receivedAt = Date.now();
    this.sequence += 1;
    const intakeId = `SUP-IN-${receivedAt}-${String(this.sequence).padStart(3, '0')}`;
    const sourceFileName = input.fileName || '';
    const sourceType: 'ZIP' | 'ZIPTXT' = sourceFileName.toLowerCase().endsWith('.zip.txt') ? 'ZIPTXT' : 'ZIP';

    // 却下の共通処理: 受入台帳へ REJECTED で記録し、要求が特定できて
    // なお ISSUED の場合だけ要求台帳も REJECTED にする（この要求への
    // 返却としては受け付けなかった、の確定。やり直しは要求の再発行）。
    // 既に RECEIVED 済みの要求（二重受入）は RECEIVED を壊さない。
    const reject = (
      code: ComponentSupplyIntakeCode,
      message: string,
      reasons: string[],
      ctx: Partial<ComponentSupplyIntakeRecord> = {},
    ): ComponentSupplyIntakeResult => {
      const record: ComponentSupplyIntakeRecord = {
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
        supplier: ctx.supplier,
        trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI',
        candidatePaths: ctx.candidatePaths ?? [],
        originRunId: ctx.originRunId,
        receivedAt,
      };
      this.ledger.set(intakeId, record);
      this.save();
      // RUN_CREATE_FAILED は MIKI 側の一時的な失敗（自己コード未同期等）
      // であり、返却物自体の却下ではないため、要求は ISSUED のまま残す。
      if (record.requestId && code !== 'RUN_CREATE_FAILED') {
        const request = componentSupplyRequestService.get(record.requestId);
        if (request && request.status === 'ISSUED') {
          componentSupplyRequestService.recordStatus(
            record.requestId,
            'REJECTED',
            `受入 ${intakeId} で却下（${code}）: ${reasons[0] ?? message}`,
          );
        }
      }
      systemLogger.warn('SELF_IMPROVEMENT', `[部品供給 受入却下] ${intakeId} code=${code} file=${sourceFileName}`, { reasons });
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
      // .zip.txt（Base64）として復号を試みる。
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(input.bytes);
        zipBytes = this.fromBase64(text);
      } catch {
        return reject('NOT_A_PACKAGE', '返却ファイルを解釈できませんでした。ZIP ファイル、または Base64 の .zip.txt を選んでください。', ['PK マジックが無く、Base64 としても復号できませんでした']);
      }
      resolvedSourceType = 'ZIPTXT';
      if (!(zipBytes[0] === 0x50 && zipBytes[1] === 0x4b)) {
        return reject('NOT_A_PACKAGE', 'Base64 復号後の内容が ZIP ではありませんでした。要求パッケージではなく、返却パッケージ（MIKI_SUPPLY_REPLY_*.zip）を選んでください。', ['復号後の先頭が PK マジックではありません']);
      }
    }
    const packageSha256 = await this.sha256Hex(zipBytes);

    // ---- 解凍と安全化（zip-slip・件数・総量） ----
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
    const manifestText = files.get('supply_reply.json');
    if (manifestText === undefined) {
      return reject('MANIFEST_MISSING', '返却 ZIP のルートに supply_reply.json がありません。要求パッケージの INSTRUCTIONS.md の形式で返却してください。', ['supply_reply.json が見つかりません'], { sourceType: resolvedSourceType, packageSha256 });
    }
    const manifestSha256 = sha256HexFromText(manifestText);
    const manifestCtx = { sourceType: resolvedSourceType, packageSha256, manifestSha256 };
    let manifest: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(manifestText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      manifest = parsed as Record<string, unknown>;
    } catch {
      return reject('MANIFEST_INVALID', 'supply_reply.json が JSON として読めませんでした。', ['JSON パースに失敗しました'], manifestCtx);
    }
    const requestId = typeof manifest.requestId === 'string' ? manifest.requestId.trim() : '';
    const identifiedCtx = { ...manifestCtx, requestId };
    if (manifest.formatVersion !== 1) {
      return reject('MANIFEST_INVALID', `supply_reply.json の formatVersion が対応範囲外です（受け取った値: ${String(manifest.formatVersion)}）。`, ['formatVersion は 1 でなければなりません'], identifiedCtx);
    }
    if (!requestId) {
      return reject('MANIFEST_INVALID', 'supply_reply.json に requestId がありません。要求の requestId をそのまま返してください。', ['requestId が空です'], manifestCtx);
    }
    const requestSha256 = typeof manifest.requestSha256 === 'string' ? manifest.requestSha256.trim().toLowerCase() : '';
    if (!requestSha256) {
      return reject('MANIFEST_INVALID', 'supply_reply.json に requestSha256 がありません。受け取った要求 ZIP（Base64 復号後）の SHA-256 を入れてください。', ['requestSha256 が空です'], identifiedCtx);
    }
    const rawSupplier = manifest.supplier && typeof manifest.supplier === 'object' && !Array.isArray(manifest.supplier)
      ? manifest.supplier as Record<string, unknown>
      : undefined;
    const supplierName = typeof rawSupplier?.name === 'string' ? rawSupplier.name.trim() : '';
    if (!supplierName) {
      return reject('MANIFEST_INVALID', 'supply_reply.json の supplier.name（供給者名）がありません。出所の記録のため必須です。', ['supplier.name が空です'], identifiedCtx);
    }
    const supplier: ComponentSupplySupplier = {
      name: supplierName,
      model: typeof rawSupplier?.model === 'string' && rawSupplier.model.trim() ? rawSupplier.model.trim() : undefined,
      suppliedAt: typeof rawSupplier?.suppliedAt === 'string' && rawSupplier.suppliedAt.trim() ? rawSupplier.suppliedAt.trim() : undefined,
    };
    const supplierCtx = { ...identifiedCtx, supplier };
    const rawCandidates = manifest.candidates;
    if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
      return reject('MANIFEST_INVALID', 'supply_reply.json の candidates が空です。供給する部品を少なくとも1件入れてください。', ['candidates が空配列または未設定です'], supplierCtx);
    }
    const candidates = rawCandidates.map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? item as ReplyCandidate : {} as ReplyCandidate));
    const seenPaths = new Set<string>();
    for (const candidate of candidates) {
      const path = typeof candidate.path === 'string' ? candidate.path.trim() : '';
      if (path && seenPaths.has(path)) {
        return reject('MANIFEST_INVALID', `candidates に同じ path が重複しています: ${path}`, [`重複した候補 path: ${path}`], supplierCtx);
      }
      if (path) seenPaths.add(path);
    }

    // ---- 結び付け検証（台帳との照合） ----
    const request = componentSupplyRequestService.get(requestId);
    if (!request) {
      return reject('REQUEST_NOT_FOUND', `要求ID ${requestId} は MIKI の部品供給台帳にありません。別の端末・別の要求への返却ではないか確認してください。`, [`台帳に無い requestId: ${requestId}`], supplierCtx);
    }
    const boundCtx = { ...supplierCtx, originRunId: request.runId };
    if (request.status !== 'ISSUED') {
      return reject('REQUEST_NOT_ISSUED', `要求ID ${requestId} は受付可能な状態ではありません（現在の状態: ${request.status}）。既に受入済み、または却下・取消済みの要求への返却は受け付けません。`, [`要求の状態が ${request.status} です`], boundCtx);
    }
    if (requestSha256 !== request.zipSha256.toLowerCase()) {
      return reject('REQUEST_HASH_MISMATCH', 'requestSha256 が要求パッケージと一致しません。返却が、MIKI が出した要求に対するものか確認してください（要求 .zip.txt を Base64 復号した ZIP 全体の SHA-256 が必要です）。', [`manifest: ${requestSha256}`, `台帳: ${request.zipSha256}`], boundCtx);
    }

    // ---- 候補の範囲・実体・必須項目 ----
    const targetPaths = request.targetFiles.map((file) => file.path);
    const targetSet = new Set(targetPaths);
    const candidatePaths: string[] = [];
    const fieldReasons: string[] = [];
    const scopeReasons: string[] = [];
    const fileReasons: string[] = [];
    const contents = new Map<string, string>();
    // P449: 候補ごとに検証済みの TVE ラウンド（1ラウンド目＋追加ラウンド）。
    const verifiedTve = new Map<string, { round: TeacherVerificationRound; extraRounds: TeacherVerificationRound[] }>();
    const tveReasons: string[] = [];
    for (const candidate of candidates) {
      const path = typeof candidate.path === 'string' ? candidate.path.trim() : '';
      if (!path) {
        fieldReasons.push('path が空の候補があります');
        continue;
      }
      candidatePaths.push(path);
      if (!targetSet.has(path)) {
        scopeReasons.push(`${path} は要求の対象ファイルではありません`);
        continue;
      }
      const tests = typeof candidate.tests === 'string' ? candidate.tests : '';
      const validation = typeof candidate.validation === 'string' ? candidate.validation : '';
      if (!tests.trim()) fieldReasons.push(`${path}: tests が空です（必須）`);
      if (!validation.trim()) fieldReasons.push(`${path}: validation が空です（必須）`);
      const fileRef = typeof candidate.file === 'string' ? candidate.file.trim() : '';
      if (!fileRef) {
        fileReasons.push(`${path}: file（実体ファイルの指定）がありません`);
        continue;
      }
      let normalizedRef: string;
      try {
        normalizedRef = normalizePath(fileRef);
      } catch {
        fileReasons.push(`${path}: file のパスが安全ではありません: ${fileRef}`);
        continue;
      }
      if (!normalizedRef.startsWith('files/')) {
        fileReasons.push(`${path}: file は files/ 配下でなければなりません: ${fileRef}`);
        continue;
      }
      const content = files.get(normalizedRef);
      if (content === undefined) {
        fileReasons.push(`${path}: 実体ファイルが ZIP にありません: ${fileRef}`);
        continue;
      }
      if (!content.trim()) {
        fileReasons.push(`${path}: 実体ファイルが空です: ${fileRef}`);
        continue;
      }
      contents.set(path, content);

      /*
       * P449: TVE（教師検証証拠）の検証。候補単位で行う。
       * teacherVerification / teacherVerificationRounds が無い候補は
       * 従来どおり（TVE なし）で通す。TVE があるのに検証に通らない
       * 候補は、その候補だけを落とす（パッケージ全体の却下ではない）。
       * 検証条件は teacherVerificationEvidenceService.parseRound に集約。
       */
      if (candidate.teacherVerification !== undefined || candidate.teacherVerificationRounds !== undefined) {
        const parsed = teacherVerificationEvidenceService.parseRound(candidate.teacherVerification, {
          candidateContent: content,
          targetPaths,
        });
        if (parsed.ok === false) {
          tveReasons.push(`${path}: TVE の検証に失敗しました（${parsed.reason}）`);
          contents.delete(path);
          const at = candidatePaths.indexOf(path);
          if (at >= 0) candidatePaths.splice(at, 1);
          continue;
        }
        const extraRounds: TeacherVerificationRound[] = [];
        let extraFailed: string | undefined;
        if (candidate.teacherVerificationRounds !== undefined) {
          if (!Array.isArray(candidate.teacherVerificationRounds)) {
            extraFailed = 'teacherVerificationRounds が配列ではありません';
          } else {
            for (const rawRound of candidate.teacherVerificationRounds) {
              const parsedExtra = teacherVerificationEvidenceService.parseRound(rawRound, {
                candidateContent: content,
                targetPaths,
              });
              if (parsedExtra.ok === false) {
                extraFailed = parsedExtra.reason;
                break;
              }
              extraRounds.push(parsedExtra.round);
            }
          }
        }
        if (extraFailed) {
          tveReasons.push(`${path}: 追加の TVE ラウンドの検証に失敗しました（${extraFailed}）`);
          contents.delete(path);
          const at = candidatePaths.indexOf(path);
          if (at >= 0) candidatePaths.splice(at, 1);
          continue;
        }
        verifiedTve.set(path, { round: parsed.round, extraRounds });
      }
    }
    if (scopeReasons.length > 0) {
      return reject('CANDIDATE_PATH_OUT_OF_SCOPE', '要求の対象ファイル以外の候補が含まれています。対象外のファイルは受け付けません。', scopeReasons, { ...boundCtx, candidatePaths });
    }
    if (fieldReasons.length > 0) {
      return reject('CANDIDATE_FIELDS_MISSING', '候補の必須項目（tests / validation 等）が不足しています。', fieldReasons, { ...boundCtx, candidatePaths });
    }
    if (fileReasons.length > 0) {
      return reject('CANDIDATE_FILE_MISSING', '候補の実体ファイルに問題があります。', fileReasons, { ...boundCtx, candidatePaths });
    }
    if (tveReasons.length > 0 && candidatePaths.length === 0) {
      return reject('TEACHER_VERIFICATION_INVALID', '教師検証証拠（TVE）の検証に通った候補が1件もありません。TVE のハッシュ・コマンド・検証結果を確認してください。', tveReasons, { ...boundCtx, candidatePaths });
    }

    // ---- ベースライン照合（古い前提で作られた返却を混ぜない） ----
    const baselineByPath = new Map(request.targetFiles.map((file) => [file.path, file.baselineSha256]));
    const baselineReasons: string[] = [];
    for (const path of candidatePaths) {
      const current = await this.resolveCurrentContent(path);
      if (current === undefined) {
        baselineReasons.push(`${path}: 現在の内容を自己コード空間から取得できず、ベースライン照合ができません`);
        continue;
      }
      const currentHash = sha256HexFromText(current);
      const baseline = baselineByPath.get(path) ?? '';
      if (currentHash !== baseline) {
        baselineReasons.push(`${path}: 要求時点から内容が変わっています（要求時 ${baseline.slice(0, 12)}… / 現在 ${currentHash.slice(0, 12)}…）`);
      }
    }
    if (baselineReasons.length > 0) {
      return reject('BASELINE_MISMATCH', '対象ファイルが要求を出した時点から変わっているため、この返却は古い前提で作られたものとして受け付けません。要求パッケージを再発行して、最新の内容で作り直してください。', baselineReasons, { ...boundCtx, candidatePaths });
    }

    // ---- 候補受け口への接続（新規 run の payload へ） ----
    // 出所の刻印: 各候補に供給エピソード（この受入記録）を刻む。
    // 生成段はこれを部品候補の sourceEpisodeIds へそのまま引き継ぐ。
    // P449: TVE の検証で落とした候補は run payload に載せない。落とした候補は
    // candidatePaths から外れている（contents からも消えている）ため、生き残った
    // candidatePaths のものだけを載せる。素通しで map すると、落とした候補が
    // 空の candidateContent で生成段へ届いてしまう。
    const survivingPaths = new Set(candidatePaths);
    const implementationCandidates = candidates.filter((candidate) => survivingPaths.has(String(candidate.path).trim())).map((candidate) => {
      const path = String(candidate.path).trim();
      const entry: Record<string, unknown> = {
        path,
        candidateContent: contents.get(path) ?? '',
        tests: String(candidate.tests ?? ''),
        validation: String(candidate.validation ?? ''),
        inputs: this.namedTypeStrings(candidate.inputs),
        outputs: this.namedTypeStrings(candidate.outputs),
        prerequisites: this.stringList(candidate.prerequisites),
        dependencies: this.stringList(candidate.dependencies),
        exports: this.stringList(candidate.exports),
        imports: this.stringList(candidate.imports),
        publicInterfaces: this.stringList(candidate.publicInterfaces),
        sourceEpisodeIds: [intakeId],
      };
      if (typeof candidate.componentType === 'string' && candidate.componentType.trim()) entry.componentType = candidate.componentType.trim();
      const environments = this.stringList(candidate.supportedEnvironments);
      if (environments.length > 0) entry.supportedEnvironments = environments;
      if (typeof candidate.entryPoint === 'string' && candidate.entryPoint.trim()) entry.entryPoint = candidate.entryPoint.trim();
      if (typeof candidate.purpose === 'string' && candidate.purpose.trim()) entry.purpose = candidate.purpose.trim();
      // P449: 検証済みの TVE ラウンドを run payload へ載せて generate() へ運ぶ。
      const tve = verifiedTve.get(path);
      if (tve) {
        entry.teacherVerification = tve.round;
        if (tve.extraRounds.length > 0) entry.teacherVerificationRounds = tve.extraRounds;
        // P476: 供給者が Muse の場合のみ、信頼の刻印を候補へ載せる。
        // 生成段はこの刻印がある候補の TVE をクラウド検証として扱う。
        if (isClaudeVerifierName(supplier.name)) entry.trustedVerifier = 'Claude';
      }
      return entry;
    });

    const originRun = improvementIntakeRouterService.get(request.runId);
    const payload: Record<string, unknown> = {
      targetFiles: candidatePaths,
      implementationCandidates,
      supplyRequestId: requestId,
      supplyIntakeId: intakeId,
      // P453: 教師返却由来の刻印。キュー側（ループ）が同点時の並び順と
      // 復元時の引き上げで識別するための印。
      teacherReturn: true,
      supplier: { name: supplier.name, ...(supplier.model ? { model: supplier.model } : {}), ...(supplier.suppliedAt ? { suppliedAt: supplier.suppliedAt } : {}) },
      // P476: Muse からの供給はユーザー信頼ルールにより区分する。
      supplyTrustLevel: isClaudeVerifierName(supplier.name) ? 'TRUSTED_VERIFIER_CLAUDE' : 'SEMI_TRUSTED_EXTERNAL_AI',
      ...(typeof manifest.notes === 'string' && manifest.notes.trim() ? { supplyNotes: manifest.notes.trim() } : {}),
    };
    // 元 run の制約（要件・禁止事項・不変条件・検証/納品条件）は新しい
    // run の生成・検証文脈として引き継ぐ。
    if (originRun) {
      for (const key of ['requirements', 'prohibitions', 'invariants', 'validationRequirements', 'deliveryRequirements'] as const) {
        const carried = this.stringList(originRun.payload?.[key]);
        if (carried.length > 0) payload[key] = carried;
      }
    }

    // P436: 受入記録自体を EXECUTION 証拠として登録し、run payload に
    // 載せる。P369 と同じ手口（検証実行証拠の登録）。受入の事実が証拠
    // として残り、生成の返却に含められるようになる。登録に失敗しても
    // 受入自体は止めない（証拠なしの従来どおりの payload で進む）。
    // 学習の発動は VALIDATE_CANDIDATE 経由のまま（sources に
    // selfDevelopment は足さない）。
    const supplyEvidenceIds: string[] = [];
    try {
      const supplyEvidence = evidenceService.recordExecutionEvidence({
        title: `部品供給の受入 ${intakeId}`,
        snippet: `供給要求 ${requestId} の返却パッケージ ${sourceFileName} を受け付け、候補 ${implementationCandidates.length} 件を検証待ちとして新規実行へ接続した（供給者: ${supplier.name}）。${isClaudeVerifierName(supplier.name) ? '供給者は Muse のため、ユーザー信頼ルール（P476）により検証済み TVE はクラウド検証として扱われる。' : ''}`,
        source: 'component_supply_intake',
        sourceId: intakeId,
      });
      supplyEvidenceIds.push(supplyEvidence.evidence_id);
    } catch {
      // 証拠の登録に失敗しても受入は続ける。
    }
    if (supplyEvidenceIds.length > 0) payload.supplyEvidenceIds = supplyEvidenceIds;

    let run: ImprovementIntakeRun;
    try {
      run = await improvementIntakeRouterService.receive({
        runType: 'USER_REQUEST',
        sourceId: requestId,
        objective: originRun?.objective ?? `部品供給の受入（要求 ${requestId}）`,
        // P453: 教師から返ってきた素材の run は優先度を返却帯
        // （TEACHER_RETURN_PRIORITY）以上にする。元 run の優先度が
        // それより高い場合は元の値を尊重する。
        priority: Math.max(originRun?.priority ?? 50, TEACHER_RETURN_PRIORITY),
        relatedRunIds: [request.runId],
        payload,
      });
    } catch (error) {
      return reject('RUN_CREATE_FAILED', `候補を受け取る新しい実行の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`, ['improvementIntakeRouterService.receive が失敗しました。要求は ISSUED のまま残るため、自己コードの同期後に再試行できます'], { ...boundCtx, candidatePaths });
    }

    const record: ComponentSupplyIntakeRecord = {
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
      supplier,
      trustLevel: 'SEMI_TRUSTED_EXTERNAL_AI',
      candidatePaths,
      originRunId: request.runId,
      newRunId: run.runId,
      receivedAt,
      ...(verifiedTve.size > 0
        ? {
            teacherVerification: [...verifiedTve.entries()].map(([path, tve]) => ({
              path,
              verifier: tve.round.verifier,
              verifiedAt: tve.round.verifiedAt,
              rounds: 1 + tve.extraRounds.length,
              implementationSha256: tve.round.implementationSha256,
            })),
          }
        : {}),
      ...(tveReasons.length > 0 ? { teacherVerificationDropped: tveReasons } : {}),
      /*
       * P458: 材料の保全。候補実体（TVE ラウンド込み）と payload を
       * 台帳へ複製する。run の payload とは参照を共有しない JSON 複製で、
       * キュー項目の drop や router の run レコードの窓溢れ（500件）でも
       * 材料が残るようにする。再投入は reconcilePreservedSupplyRuns が担う。
       */
      preservedCandidates: JSON.parse(JSON.stringify(implementationCandidates)) as Array<Record<string, unknown>>,
      preservedPayload: JSON.parse(JSON.stringify(payload)) as Record<string, unknown>,
      preservedObjective: run.objective,
      preservation: { status: 'PRESERVED', requeueCount: 0 },
    };
    this.ledger.set(intakeId, record);
    this.save();
    componentSupplyRequestService.recordStatus(
      requestId,
      'RECEIVED',
      `受入 ${intakeId}（供給者: ${supplier.name}）→ 新規Run ${run.runId}`,
    );
    if (verifiedTve.size > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `[P449] TVE verified: ${[...verifiedTve.entries()].map(([path, tve]) => `${path} rounds=${1 + tve.extraRounds.length} checks=${tve.round.checks.length}`).join(', ')}`, { intakeId });
    }
    systemLogger.info('SELF_IMPROVEMENT', `[部品供給 受入] ${intakeId} request=${requestId} supplier=${supplier.name} → 新規Run ${run.runId}（候補は検証待ちの部品候補として生成段へ接続）`, { candidatePaths });
    // P458: 保全が台帳に残ったことをログでも確認できるようにする。
    systemLogger.info('SELF_IMPROVEMENT', `[P458] 供給材料を保全: intake=${intakeId} candidates=${implementationCandidates.length} tve=${verifiedTve.size > 0 ? 'あり' : 'なし'} — run が drop されても受入台帳から再投入できます`);
    return {
      ok: true,
      code: 'SUCCESS',
      message: `部品供給の返却を受け付けました。新しい実行 ${run.runId} を作成し、供給された部品は検証待ちの候補として生成段へ接続しました。`,
      reasons: [],
      record: this.clone(record),
      runId: run.runId,
    };
  }

  // ------------------------------------------------------------------
  // P458: 材料保全の照合と再投入
  //
  // 供給 run は USER_REQUEST で、AUTONOMOUS_DISCOVERY のような定期
  // リコンサイラが無い。キュー項目が drop されると run レコードは
  // QUEUED のまま残り、誰にも拾われない（LOG_6 の喪失の正体）。
  // ここでは「run が終端でないのにキューに対応項目が無い」孤児を
  // 検出し、台帳の保全物から既存の receive() 経路で再投入する。
  // 検証の梯子・ゲートには一切触らない（材料を入口へ戻すだけ）。
  // ------------------------------------------------------------------

  /** 保全対象の run に対応するキュー項目がまだ生きているか。 */
  private isPreservedRunQueued(record: ComponentSupplyIntakeRecord): boolean {
    const queue = autonomousSelfImprovementLoopService.getState().queue;
    return queue.some((item) =>
      (record.newRunId !== undefined && item.runId === record.newRunId) ||
      item.payload?.supplyIntakeId === record.intakeId,
    );
  }

  /*
   * 材料が検証の梯子側へ渡り切っているかの判定。渡り切っていれば
   * 再投入は不要（CONSUMED）。判定は既存の記録だけで行う:
   * - run 自体が COMPLETED
   * - run のブラックボードタスクが COMPLETED
   * - 保全候補の全件が、供給エピソード（intakeId）を刻んだ部品として
   *   レジストリに登録済み（生成段が createCodeComponentCandidate で
   *   CANDIDATE 登録した状態。entry_point が候補と一致するもの）
   */
  private preservedMaterialConsumedBy(record: ComponentSupplyIntakeRecord): string | undefined {
    const run = record.newRunId ? improvementIntakeRouterService.get(record.newRunId) : undefined;
    if (run?.status === 'COMPLETED') return 'RUN_COMPLETED';
    if (run?.taskId) {
      const task = taskBlackboardService.get(run.taskId);
      if (task?.status === 'COMPLETED') return 'TASK_COMPLETED';
    }
    const candidates = record.preservedCandidates ?? [];
    if (candidates.length > 0) {
      const components = componentRegistryService.getAllComponents();
      const allRegistered = candidates.every((candidate) => {
        const entryPoint = typeof candidate.entryPoint === 'string' && candidate.entryPoint
          ? candidate.entryPoint
          : typeof candidate.path === 'string' ? candidate.path : '';
        if (!entryPoint) return false;
        return components.some((component) => {
          const carrier = component as { entry_point?: unknown; source_episode_ids?: unknown };
          return carrier.entry_point === entryPoint
            && Array.isArray(carrier.source_episode_ids)
            && carrier.source_episode_ids.includes(record.intakeId);
        });
      });
      if (allRegistered) return 'REGISTERED_AS_COMPONENT';
    }
    return undefined;
  }

  /*
   * P458 以前の受入（保全物が無い）でも、router の run レコードが
   * まだ残っていれば、その payload から保全へ複製する（バックフィル）。
   * run レコード自体が窓溢れで消えている場合は複製元が無く、対象外。
   */
  private ensurePreservedMaterial(record: ComponentSupplyIntakeRecord): boolean {
    if (record.preservedPayload && (record.preservedCandidates?.length ?? 0) > 0) return true;
    const run = record.newRunId ? improvementIntakeRouterService.get(record.newRunId) : undefined;
    const candidates = run?.payload?.implementationCandidates;
    if (!run || !Array.isArray(candidates) || candidates.length === 0) return false;
    const rest: Record<string, unknown> = { ...(run.payload ?? {}) };
    delete rest.sourceSnapshotSha256;
    record.preservedPayload = JSON.parse(JSON.stringify(rest)) as Record<string, unknown>;
    record.preservedCandidates = JSON.parse(JSON.stringify(candidates)) as Array<Record<string, unknown>>;
    record.preservedObjective = run.objective;
    record.preservation = record.preservation ?? { status: 'PRESERVED', requeueCount: 0 };
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[P458] 旧受入の材料を run の payload から保全へ複製: intake=${record.intakeId} run=${run.runId} candidates=${candidates.length}`);
    return true;
  }

  /**
   * 保全した材料を、新しい run としてキューへ再投入する。
   * 既にキューに居る／消費済みの場合は何もしない。旧 run は先に
   * REJECTED へ閉じる（receive() の sourceHash 重複判定は REJECTED を
   * 除外するため、閉じないと同一 payload の再投入が重複として
   * 弾かれ、孤児 run が返ってきてしまう）。
   */
  public async requeuePreservedRun(
    intakeId: string,
    reason: string,
    options?: { manual?: boolean },
  ): Promise<{ requeued: boolean; runId?: string; detail: string }> {
    const record = this.ledger.get(intakeId);
    if (!record || record.status !== 'RECEIVED') return { requeued: false, detail: 'INTAKE_NOT_RECEIVED' };
    if (!this.ensurePreservedMaterial(record)) return { requeued: false, detail: 'NO_PRESERVED_MATERIAL' };
    const preservation = record.preservation ?? (record.preservation = { status: 'PRESERVED', requeueCount: 0 });
    if (preservation.status === 'CONSUMED') return { requeued: false, detail: 'ALREADY_CONSUMED' };
    if (this.isPreservedRunQueued(record)) return { requeued: false, detail: 'STILL_QUEUED' };
    const consumedBy = this.preservedMaterialConsumedBy(record);
    if (consumedBy) {
      preservation.status = 'CONSUMED';
      preservation.consumedBy = consumedBy;
      this.save();
      systemLogger.info('SELF_IMPROVEMENT', `[P458] 供給材料は消費済みのため再投入しません: intake=${intakeId} consumedBy=${consumedBy}`);
      return { requeued: false, detail: consumedBy };
    }
    // ここまで来たら孤児（run が終端でなく、キューにも居ない）。
    preservation.orphanDetectedAt = Date.now();
    if (!options?.manual && preservation.requeueCount >= MAX_SUPPLY_PRESERVATION_REQUEUES) {
      if (preservation.status !== 'EXHAUSTED') {
        preservation.status = 'EXHAUSTED';
        this.save();
      }
      systemLogger.error('SELF_IMPROVEMENT', `[P458] 供給材料の自動再投入が上限（${MAX_SUPPLY_PRESERVATION_REQUEUES}回）に達しました: intake=${intakeId} run=${record.newRunId ?? '-'} — 材料は受入台帳に保全されたままです。手動再投入は requeuePreservedRun の manual 指定で可能です`);
      return { requeued: false, detail: 'REQUEUE_LIMIT_REACHED' };
    }
    const previousRunId = record.newRunId;
    const previousRun = previousRunId ? improvementIntakeRouterService.get(previousRunId) : undefined;
    if (previousRun && previousRun.status !== 'REJECTED' && previousRun.status !== 'COMPLETED') {
      improvementIntakeRouterService.reject(previousRunId as string);
    }
    let run: ImprovementIntakeRun;
    try {
      run = await improvementIntakeRouterService.receive({
        runType: 'USER_REQUEST',
        sourceId: record.requestId,
        objective: record.preservedObjective ?? `部品供給の受入（要求 ${record.requestId}）`,
        // 再投入も教師返却の優先帯で戻す（初回受入と同じ扱い）。
        priority: TEACHER_RETURN_PRIORITY,
        relatedRunIds: [...new Set([record.originRunId, previousRunId].filter((x): x is string => typeof x === 'string' && x.length > 0))],
        payload: JSON.parse(JSON.stringify(record.preservedPayload)) as Record<string, unknown>,
      });
    } catch (error) {
      // 自己コード空間の未同期など MIKI 側の一時要因。保全は残るため
      // 次回の照合で再試行できる。回数は消費しない。
      this.save();
      systemLogger.warn('SELF_IMPROVEMENT', `[P458] 供給材料の再投入に失敗（次回照合で再試行）: intake=${intakeId} reason=${reason}: ${error instanceof Error ? error.message : String(error)}`);
      return { requeued: false, detail: 'RUN_CREATE_FAILED' };
    }
    if (previousRunId && run.runId === previousRunId) {
      this.save();
      return { requeued: false, detail: 'RECEIVE_DEDUPED_TO_ORPHAN' };
    }
    record.newRunId = run.runId;
    preservation.status = 'PRESERVED';
    preservation.requeueCount += 1;
    preservation.lastRequeuedAt = Date.now();
    preservation.lastRequeueRunId = run.runId;
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[P458] 供給材料を再投入: intake=${intakeId} oldRun=${previousRunId ?? '-'} newRun=${run.runId} reason=${reason} requeue=${preservation.requeueCount} candidates=${record.preservedCandidates?.length ?? 0}`);
    return { requeued: true, runId: run.runId, detail: 'REQUEUED' };
  }

  /**
   * 保全済みの全受入を照合し、孤児になった供給 run を再投入する。
   * 起動時（bootstrap）に呼ばれる。再投入・消費済み・上限到達の
   * 内訳を返し、ログにも残す。1件の失敗で全体は止めない。
   */
  public async reconcilePreservedSupplyRuns(): Promise<{ checked: number; requeued: number; consumed: number; exhausted: number }> {
    let checked = 0;
    let requeued = 0;
    let consumed = 0;
    let exhausted = 0;
    for (const record of [...this.ledger.values()]) {
      if (record.status !== 'RECEIVED') continue;
      checked += 1;
      try {
        const result = await this.requeuePreservedRun(record.intakeId, 'STARTUP_RECONCILE');
        if (result.requeued) requeued += 1;
        else if (result.detail === 'RUN_COMPLETED' || result.detail === 'TASK_COMPLETED' || result.detail === 'REGISTERED_AS_COMPONENT' || result.detail === 'ALREADY_CONSUMED') consumed += 1;
        else if (result.detail === 'REQUEUE_LIMIT_REACHED') exhausted += 1;
      } catch (error) {
        systemLogger.warn('SELF_IMPROVEMENT', `[P458] 保全材料の照合に失敗: intake=${record.intakeId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (checked > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `[P458] 供給材料の保全照合: checked=${checked} requeued=${requeued} consumed=${consumed} exhausted=${exhausted}`);
    }
    return { checked, requeued, consumed, exhausted };
  }
}

export const componentSupplyIntakeService = new ComponentSupplyIntakeService();
