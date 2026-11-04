import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { componentSupplyRequestService } from './componentSupplyRequestService';
import { improvementIntakeRouterService, type ImprovementIntakeRun } from './improvementIntakeRouterService';
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
  | 'BASELINE_MISMATCH'
  | 'RUN_CREATE_FAILED';

export interface ComponentSupplySupplier {
  name: string;
  model?: string;
  suppliedAt?: string;
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
}

const LEDGER_KEY = 'miki_component_supply_intake_ledger_v1';

// 入力全体の上限。要求側の送出上限（Base64 1,900,000字 ≒ ZIP 1.42MB）
// より少し大きく取り、返却 ZIP（非圧縮の生 .zip も可）を直接選んでも
// 通る範囲にする。これを超える返却物は分割・圧縮を依頼する前提。
const MAX_INPUT_BYTES = 3_000_000;
// 解凍後の安全上限（priority12 の先例と調査報告 §4.1 の目安）。
const MAX_FILES = 100;
const MAX_TOTAL_CONTENT_BYTES = 10 * 1024 * 1024;

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
    const implementationCandidates = candidates.map((candidate) => {
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
      return entry;
    });

    const originRun = improvementIntakeRouterService.get(request.runId);
    const payload: Record<string, unknown> = {
      targetFiles: candidatePaths,
      implementationCandidates,
      supplyRequestId: requestId,
      supplyIntakeId: intakeId,
      supplier: { name: supplier.name, ...(supplier.model ? { model: supplier.model } : {}), ...(supplier.suppliedAt ? { suppliedAt: supplier.suppliedAt } : {}) },
      supplyTrustLevel: 'SEMI_TRUSTED_EXTERNAL_AI',
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

    let run: ImprovementIntakeRun;
    try {
      run = await improvementIntakeRouterService.receive({
        runType: 'USER_REQUEST',
        sourceId: requestId,
        objective: originRun?.objective ?? `部品供給の受入（要求 ${requestId}）`,
        priority: originRun?.priority ?? 50,
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
    };
    this.ledger.set(intakeId, record);
    this.save();
    componentSupplyRequestService.recordStatus(
      requestId,
      'RECEIVED',
      `受入 ${intakeId}（供給者: ${supplier.name}）→ 新規Run ${run.runId}`,
    );
    systemLogger.info('SELF_IMPROVEMENT', `[部品供給 受入] ${intakeId} request=${requestId} supplier=${supplier.name} → 新規Run ${run.runId}（候補は検証待ちの部品候補として生成段へ接続）`, { candidatePaths });
    return {
      ok: true,
      code: 'SUCCESS',
      message: `部品供給の返却を受け付けました。新しい実行 ${run.runId} を作成し、供給された部品は検証待ちの候補として生成段へ接続しました。`,
      reasons: [],
      record: this.clone(record),
      runId: run.runId,
    };
  }
}

export const componentSupplyIntakeService = new ComponentSupplyIntakeService();
