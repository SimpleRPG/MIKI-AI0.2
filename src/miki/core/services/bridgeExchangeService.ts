import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { apiUrl } from '../../../services/api';
import { evidenceService } from '../../memory/services/evidenceService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { verifierService } from '../../verification/services/verifierService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { webTermLearningService } from '../../research/services/webTermLearningService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { componentSupplyRequestService } from './componentSupplyRequestService';
import { componentSupplyIntakeService } from './componentSupplyIntakeService';
import { sha256HexFromText } from './canonicalSha256Service';

/*
 * P2001: アプリ⇄VM橋（BeBe-bridge）のアプリ側交換サービス。
 *
 * 位置付け: 端末のみきと VM 2台を GitHub の橋リポジトリ
 * （SimpleRPG/BeBe-bridge）で繋ぐ「橋」の、アプリ側の読み書き口。
 * 設計の正本は muse-sync の shared/bridge-design.md、プロトコルは
 * 橋リポジトリの PROTOCOL.md（封筒 v1: {v, kind, id, createdAt, from,
 * payload}、1件=1ファイル、追記と移動のみ）。
 *
 * 線引き（設計どおり）:
 *  - アプリは git を触らない。読み書きは端末内の交換フォルダ
 *    （~/miki-bridge-exchange の out/ と in/）だけで、その実アクセスは
 *    Termux サーバーの /api/bridge/* 経由。運搬（git）そのものは
 *    サーバー側の担当であり（P2003 でサーバーへ組み込み）、ここでは
 *    行わない。ここから行うのはサーバーへの即時運搬の要請まで。
 *  - 戻りは全て「材料」。取り込みは既存の入口を通す: 部品・教師
 *    パッケージは componentSupplyIntakeService の受入台帳（結び付け
 *    検証・ベースライン照合・TVE 検証は全て既存のまま）、知識は
 *    Evidence→未検証 Claim の発見登録、語彙は webTermLearningService
 *    の学習経路。検証を通さず知識・部品へ直接書き込むことはしない。
 *  - 橋は補助線。サーバー不達・監査遮断・取り込み失敗のいずれでも、
 *    呼び出し元の本線（調査・改善ループ・背景サイクル）を止めない。
 *  - 送出側も既存の規律に倣う: 調査依頼と同期送出は送出前に
 *    privacyGuardrailService の監査（autoSanitize:false、検出1件でも
 *    遮断）を通す。部品要求パッケージは createPackage 側で監査済み。
 *
 * 呼び出し口:
 *  - 調査の並行 dispatch: requiredAssetAcquisitionService の証拠取得が
 *    本サービスへも同じクエリを投げる（端末 SearXNG と VM の両方へ）。
 *  - 定期巡回: backgroundWorkerService の背景サイクルが
 *    runBackgroundExchange() を呼ぶ（返送取り込み・ログ返送・同期送出）。
 *  - 軽い取り込み: アプリ起動時・前景復帰時と段梯子タイマーが
 *    runLightIntake() を呼ぶ（返送取り込みのみ。P2004 で深い
 *    サイクル相乗りから分離）。P2008 で、取り込みのついでに
 *    ログ返送の時間判定（前回返送から6時間）と依頼フラグの
 *    確認もここで行う（返送自体は既存の exportLogBundle）。
 *    VM からのログ返送依頼は kind 'log' の封筒として sync の
 *    down-*.json で届き、取り込み時に1回だけ消費される。
 */

export type BridgeEnvelopeKind = 'research' | 'parts' | 'fieldtest' | 'teacher' | 'sync' | 'log';

export interface BridgeEnvelope<P = Record<string, unknown>> {
  v: 1;
  kind: BridgeEnvelopeKind;
  id: string;
  createdAt: string;
  from: 'device' | 'vm-main' | 'vm-worker';
  payload: P;
}

export interface BridgeResearchRequestPayload {
  question: string;
  purpose: string;
  /** 発信元の識別（gap ID 等）。返答との対応付けは封筒 id で行う。 */
  sourceRef?: string;
}

export interface BridgeResearchSource {
  title?: string;
  url?: string;
  snippet?: string;
}

export interface BridgeResearchResultPayload {
  question?: string;
  /** 依頼側の sourceRef の写し。gap への接続（P2012）に使う。 */
  sourceRef?: string;
  /** VM 側の組成した回答（文字列または構造化オブジェクト）。材料として Evidence 化する。 */
  answer?: unknown;
  sources?: BridgeResearchSource[];
  /** Claim 候補として発見登録する文。sourceIndex は sources への添字。 */
  findings?: Array<{ statement: string; sourceIndex?: number }>;
  notes?: string[];
}

export interface BridgePartsRequestPayload {
  supplyRequestId: string;
  runId: string;
  objective: string;
  gapReason: string;
  targetFiles: Array<{ path: string; baselineSha256: string }>;
  requestZipSha256: string;
  packageFileName: string;
  /** 要求パッケージ（.zip.txt の Base64 テキスト）。createPackage の監査済み成果物。 */
  packageZipTxt?: string;
}

export interface BridgePartsResultPayload {
  /** 返却 ZIP のバイナリを Base64 化したもの（supply_reply を含む ZIP）。 */
  supplyReplyZipBase64?: string;
  /** 返却物の .zip.txt 形（Base64 テキストそのもの）。 */
  supplyReplyZipTxt?: string;
}

export interface BridgeSyncUpPayload {
  claims: Array<Record<string, unknown>>;
  vocabulary: Array<Record<string, unknown>>;
}

export interface BridgeSyncDownPayload {
  knowledge?: Array<{ statement: string; sourceTitle?: string; sourceUrl?: string; sourceName?: string }>;
  vocabulary?: Array<{ term: string; gloss?: string; reading?: string; sourceUrl?: string }>;
}

/**
 * P2008: VM からのログ返送依頼（kind 'log'、sync の down-*.json で届く）。
 * 端末は取り込み時に exportLogBundle を1回走らせて消費する（台帳の
 * 重複排除で同じ依頼が二度効くことはない）。
 */
export interface BridgeLogRequestPayload {
  /** 'EXPORT_LOGS' のみ対応。それ以外は取り込み側で UNSUPPORTED_ACTION。 */
  action: 'EXPORT_LOGS';
  /** 依頼理由（任意。診断用に短く）。 */
  reason?: string;
}

export interface BridgeFieldTestPayload {
  testKind: string;
  title: string;
  instructions?: string;
  input?: unknown;
}

export interface BridgeFieldTestResultPayload {
  inResponseTo: string;
  testKind: string;
  status: 'PASSED' | 'FAILED' | 'ERROR';
  detail?: string;
}

export type BridgeWriteCode =
  | 'SUCCESS'
  | 'SERVER_UNAVAILABLE'
  | 'WRITE_FAILED'
  | 'PRIVACY_BLOCKED'
  | 'SUPPLY_CREATE_FAILED'
  | 'EMPTY';

export interface BridgeWriteResult {
  ok: boolean;
  code: BridgeWriteCode;
  message: string;
  fileName?: string;
  envelopeId?: string;
  /** 書き出し先: 'EXCHANGE'（サーバー経由）か 'DOWNLOADS_FALLBACK'。 */
  via?: 'EXCHANGE' | 'DOWNLOADS_FALLBACK';
  detail?: unknown;
}

export interface BridgeInboxOutcome {
  fileName: string;
  kind: string;
  status: string;
  note?: string;
}

export interface BridgePollResult {
  ok: boolean;
  code: 'SUCCESS' | 'SERVER_UNAVAILABLE';
  listed: number;
  processed: number;
  skipped: number;
  outcomes: BridgeInboxOutcome[];
}

export interface BridgeBackgroundResult {
  inbox: BridgePollResult;
  logExported: boolean;
  syncExported: boolean;
}

type BridgeFieldTestRunner = (
  envelope: BridgeEnvelope<BridgeFieldTestPayload>,
) => Promise<{ status: 'PASSED' | 'FAILED' | 'ERROR'; detail?: string }>;

interface BridgeProcessedRecord {
  fileName: string;
  sha256: string;
  kind: string;
  status: string;
  note?: string;
  processedAt: number;
}

interface BridgePendingRecord {
  envelopeId: string;
  kind: BridgeEnvelopeKind;
  fileName: string;
  createdAt: number;
  summary: string;
}

interface BridgeFieldTestRecord {
  envelopeId: string;
  testKind: string;
  title: string;
  status: 'RECEIVED' | 'RUNNING' | 'DONE' | 'ERROR';
  receivedAt: number;
  resultFileName?: string;
  detail?: string;
}

interface BridgeLedgerState {
  processedIn: BridgeProcessedRecord[];
  pendingOut: BridgePendingRecord[];
  sentSyncHashes: string[];
  fieldTests: BridgeFieldTestRecord[];
  logRequested: boolean;
  logRequestReason?: string;
  lastLogExportAt: number;
}

const LEDGER_KEY = 'miki_bridge_exchange_ledger_v1';
const MAX_PROCESSED_RECORDS = 200;
const MAX_PENDING_RECORDS = 100;
const MAX_SENT_SYNC_HASHES = 4000;
const MAX_FIELD_TEST_RECORDS = 50;

/** ログ返送の定期間隔（設計メモ: 定期トリガー。電池配慮で日次級）。 */
export const BRIDGE_LOG_EXPORT_INTERVAL_MS = 24 * 60 * 60 * 1000;
/**
 * P2008: 軽い取り込みのついでに行うログ返送の時間判定の閾値。
 * 深いサイクルの24時間周期だけでは実機で一度も発火しなかった
 * （背景サイクル自体が電池適応＋ユーザー操作中の停止で滅多に
 * 回らない）ため、軽い発火口（起動・前景復帰・前景約10分）でも
 * 前回返送からの経過を見て、超えていたら既存の exportLogBundle
 * で1回だけ送る。最終返送時刻は深いサイクルと共通（state の
 * lastLogExportAt）なので、二重返送にはならない。
 * 6時間は調整可能な判断点（正本 P2008 記録）: 短くすれば診断の
 * 鮮度は上がるが、橋の往復と電池の消費が増える。
 */
export const BRIDGE_LOG_EXPORT_LIGHT_INTERVAL_MS = 6 * 60 * 60 * 1000;
/**
 * P2004: 軽い取り込み（pollInbox のみ）の段梯子周期。前景にいる間は
 * 約10分、背景では約30分。起動時・前景復帰時は即時（runLightIntake
 * の immediate）。深い背景サイクルの電池適応（15〜60分）は重い仕事
 * のためのもので、取り込み自体は端末内サーバーへの軽い読みに
 * 過ぎないため、ここでは梯子を独立に持つ。
 */
export const BRIDGE_LIGHT_INTAKE_FOREGROUND_MS = 10 * 60 * 1000;
export const BRIDGE_LIGHT_INTAKE_BACKGROUND_MS = 30 * 60 * 1000;
const BRIDGE_LIGHT_INTAKE_TICK_MS = 60 * 1000;
const BRIDGE_LIGHT_INTAKE_IMMEDIATE_DEDUPE_MS = 30 * 1000;
/** ログ束の上限（プロトコル: 1束 5MB）。本文組み立ては余裕を見て 4.5MB で切る。 */
const LOG_BUNDLE_MAX_BYTES = 5 * 1024 * 1024;
const LOG_TEXT_BUDGET_BYTES = Math.floor(4.5 * 1024 * 1024);
const LOG_DETAIL_MAX_CHARS = 400;
/**
 * P2010: 失敗・異常エントリの詳細だけ上限を広げる（ユーザーの許可
 * 「問題があるところはログ増やしてもいい」に基づく）。ERROR 級
 * （本基盤の最高レベルで FATAL 級に相当）と、タスク失敗を表す
 * マーカーを含むエントリが対象。通常エントリは従来どおり 400 字。
 * 書き込み側の上限（systemLogger の ERROR 級 4,000 字）と揃えて
 * あり、失敗の理由連鎖が束の外まで届く。
 */
const LOG_DETAIL_MAX_CHARS_FAILURE = 4000;
const LOG_FAILURE_MESSAGE_MARKERS = [
  '[RUNTIME_FAILURE]',
  '[CandidateGenerationRejection]',
  '[VerifierUnresolved]',
  'AutonomousLoop drop',
];
const isFailureLogEntry = (entry: { level: string; message: string }): boolean =>
  entry.level === 'ERROR' || LOG_FAILURE_MESSAGE_MARKERS.some((marker) => entry.message.includes(marker));
/** 同期送出の1束あたり上限。 */
const SYNC_UP_MAX_CLAIMS = 50;
const SYNC_UP_MAX_VOCABULARY = 100;

const textEncoder = new TextEncoder();
const byteLength = (text: string): number => textEncoder.encode(text).length;

/*
 * P2012: answer だけの返送から Claim 候補を切り出す（決定論）。
 * 文字列ならその文、構造化オブジェクトなら summary → meaning の順に
 * 最初の文字列フィールドを採る。切り出した文は registerUnverifiedClaim
 * 側で P2007 の整形（診断文除去・切り詰め）を通る。answer の残りの
 * 項目（語源・用法等）は answer Evidence の材料として残り、ここでは
 * 主張化しない。
 */
const bridgeAnswerClaimCandidate = (answer: unknown): string | undefined => {
  if (typeof answer === 'string') return answer.trim() || undefined;
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) {
    const record = answer as Record<string, unknown>;
    for (const key of ['summary', 'meaning']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return undefined;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** プロトコルのファイル名用タイムスタンプ（端末ローカル時刻 YYYYMMDDHHmmss）。 */
const fileTimestamp = (date = new Date()): string =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;

const shortId = (): string => {
  const rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `${Date.now().toString(36).slice(-4)}${rand}`;
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => {
  const binary = atob(text.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const hostOf = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).host || undefined;
  } catch {
    return undefined;
  }
};

class BridgeExchangeService {
  private state: BridgeLedgerState = {
    processedIn: [],
    pendingOut: [],
    sentSyncHashes: [],
    fieldTests: [],
    logRequested: false,
    lastLogExportAt: 0,
  };
  private fieldTestRunners = new Map<string, BridgeFieldTestRunner>();
  private transportDownLogged = false;
  private lightIntakeRunning = false;
  private lastLightIntakeAt = 0;
  private lightIntakeTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.load();
  }

  // ------------------------------------------------------------------
  // 台帳（供給台帳と同じ作法: メモリ＋storageService 永続化）
  // ------------------------------------------------------------------
  private load(): void {
    try {
      const raw = storageService.getJson<Partial<BridgeLedgerState>>(LEDGER_KEY);
      if (raw && typeof raw === 'object') {
        this.state = {
          processedIn: Array.isArray(raw.processedIn) ? raw.processedIn : [],
          pendingOut: Array.isArray(raw.pendingOut) ? raw.pendingOut : [],
          sentSyncHashes: Array.isArray(raw.sentSyncHashes) ? raw.sentSyncHashes : [],
          fieldTests: Array.isArray(raw.fieldTests) ? raw.fieldTests : [],
          logRequested: raw.logRequested === true,
          logRequestReason: typeof raw.logRequestReason === 'string' ? raw.logRequestReason : undefined,
          lastLogExportAt: typeof raw.lastLogExportAt === 'number' ? raw.lastLogExportAt : 0,
        };
      }
    } catch {
      /* 台帳が壊れていたら空から始める（橋は補助線） */
    }
  }

  private save(): void {
    try {
      const state: BridgeLedgerState = {
        ...this.state,
        processedIn: this.state.processedIn.slice(-MAX_PROCESSED_RECORDS),
        pendingOut: this.state.pendingOut.slice(-MAX_PENDING_RECORDS),
        sentSyncHashes: this.state.sentSyncHashes.slice(-MAX_SENT_SYNC_HASHES),
        fieldTests: this.state.fieldTests.slice(-MAX_FIELD_TEST_RECORDS),
      };
      this.state = state;
      storageService.setItem(LEDGER_KEY, JSON.stringify(state));
    } catch {
      /* 永続化失敗でも本線は止めない */
    }
  }

  public listPending(): BridgePendingRecord[] {
    return this.state.pendingOut.map((record) => ({ ...record }));
  }

  public listProcessed(): BridgeProcessedRecord[] {
    return [...this.state.processedIn].reverse().map((record) => ({ ...record }));
  }

  public listFieldTests(): BridgeFieldTestRecord[] {
    return this.state.fieldTests.map((record) => ({ ...record }));
  }

  // ------------------------------------------------------------------
  // 運搬（Termux サーバー /api/bridge/* 経由のみ。git には触れない）
  // ------------------------------------------------------------------
  private async fetchBridge(path: string, init?: RequestInit, timeoutMs = 5000): Promise<Response | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(apiUrl(path), { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return null;
    }
  }

  private noteTransportFailure(what: string): void {
    if (!this.transportDownLogged) {
      this.transportDownLogged = true;
      systemLogger.info('SYSTEM', `[橋] Termux サーバーへ届かないため ${what} を見送りました（橋は補助線）`);
    }
  }

  private noteTransportRecovery(): void {
    if (this.transportDownLogged) {
      this.transportDownLogged = false;
      systemLogger.info('SYSTEM', '[橋] Termux サーバーへの接続が回復しました');
    }
  }

  /**
   * サーバーへ即時運搬を頼む（P2003、fire-and-forget）。
   * サーバー側に組み込まれた運搬（POST /api/bridge/courier）を1回回して
   * もらう。本線は待たず、失敗は無視する（定期運搬が次に拾う）。
   */
  private requestCourierNow(): void {
    void this.fetchBridge('/api/bridge/courier', { method: 'POST' }, 30000).then((res) => {
      if (res && res.ok) this.noteTransportRecovery();
    });
  }

  /** out/ へ1ファイルを書き出す。テキストか Base64（バイナリ用）のどちらか。 */
  private async writeOutbox(fileName: string, body: { text?: string; base64?: string }): Promise<BridgeWriteResult> {
    const res = await this.fetchBridge('/api/bridge/out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fileName, text: body.text, base64: body.base64 }),
    });
    if (res && res.ok) {
      this.noteTransportRecovery();
      return { ok: true, code: 'SUCCESS', message: '交換フォルダ out/ へ書き出しました', fileName, via: 'EXCHANGE' };
    }
    this.noteTransportFailure(`out/ への書き出し（${fileName}）`);
    // フォールバック: テキストなら Downloads へ退避し、材料を失わない
    // （ユーザーが手で out/ へ移せる。台帳には経路を残す）。
    if (typeof body.text === 'string') {
      const saved = await systemLogger.saveTextFileToDownloads(fileName, body.text);
      if (saved) {
        return { ok: true, code: 'SUCCESS', message: 'サーバー不達のため Downloads へ退避しました', fileName, via: 'DOWNLOADS_FALLBACK' };
      }
    }
    return { ok: false, code: 'SERVER_UNAVAILABLE', message: 'Termux サーバーへ届かず、書き出せませんでした', fileName };
  }

  private async listInboxFiles(): Promise<string[] | null> {
    const res = await this.fetchBridge('/api/bridge/in', undefined, 4000);
    if (!res || !res.ok) return null;
    try {
      const data = (await res.json()) as { files?: unknown };
      if (!Array.isArray(data.files)) return null;
      return data.files.filter((name): name is string => typeof name === 'string');
    } catch {
      return null;
    }
  }

  private async readInboxFile(fileName: string): Promise<string | null> {
    const res = await this.fetchBridge(`/api/bridge/in/${encodeURIComponent(fileName)}`, undefined, 8000);
    if (!res || !res.ok) return null;
    try {
      return await res.text();
    } catch {
      return null;
    }
  }

  /** 送出前監査（供給パッケージと同じ規律: autoSanitize:false、検出で完全遮断）。 */
  private auditOutbound(text: string, what: string): { allowed: boolean; reasons: string[] } {
    const result = privacyGuardrailService.auditOutboundContent(text, 'bebe_bridge', { autoSanitize: false });
    if (result.allowed) return { allowed: true, reasons: [] };
    return {
      allowed: false,
      reasons: result.violations.map((v) => `${what}: ${v.type} ${v.message}`),
    };
  }

  private recordPending(envelope: { id: string; kind: BridgeEnvelopeKind }, fileName: string, summary: string): void {
    this.state.pendingOut = this.state.pendingOut.filter((record) => record.envelopeId !== envelope.id);
    this.state.pendingOut.push({
      envelopeId: envelope.id,
      kind: envelope.kind,
      fileName,
      createdAt: Date.now(),
      summary: summary.slice(0, 120),
    });
    this.save();
  }

  private async writeEnvelope<P>(
    prefix: string,
    envelope: BridgeEnvelope<P>,
    summary: string,
  ): Promise<BridgeWriteResult> {
    const fileName = `${prefix}-${fileTimestamp()}-${envelope.id}.json`;
    const result = await this.writeOutbox(fileName, { text: JSON.stringify(envelope, null, 2) });
    if (result.ok) {
      this.recordPending(envelope, fileName, summary);
      // research／parts の依頼は out/ へ書いた直後に即時運搬を頼む
      // （定期運搬を待たずに VM 側へ届ける。Downloads 退避時は対象外）。
      if (result.via !== 'DOWNLOADS_FALLBACK') this.requestCourierNow();
      return { ...result, envelopeId: envelope.id };
    }
    return result;
  }

  // ------------------------------------------------------------------
  // 送出1: 調査依頼（research）
  // ------------------------------------------------------------------
  public async createResearchRequest(input: {
    question: string;
    purpose: string;
    sourceRef?: string;
  }): Promise<BridgeWriteResult> {
    const question = (input.question || '').trim();
    const purpose = (input.purpose || '').trim();
    if (!question) {
      return { ok: false, code: 'EMPTY', message: '調査の質問が空です' };
    }
    const audit = this.auditOutbound(`${question}\n${purpose}`, '調査依頼');
    if (!audit.allowed) {
      systemLogger.warn('PRIVACY', `[橋] 調査依頼の送出を監査で遮断しました`, { reasons: audit.reasons });
      return { ok: false, code: 'PRIVACY_BLOCKED', message: '送出前プライバシー監査で遮断されました', detail: audit.reasons };
    }
    const envelope: BridgeEnvelope<BridgeResearchRequestPayload> = {
      v: 1,
      kind: 'research',
      id: shortId(),
      createdAt: new Date().toISOString(),
      from: 'device',
      payload: { question, purpose, sourceRef: input.sourceRef },
    };
    const result = await this.writeEnvelope('research', envelope, question);
    if (result.ok) {
      systemLogger.info('SYSTEM', `[橋] 調査依頼を送出しました id=${envelope.id} via=${result.via ?? 'EXCHANGE'}`);
    }
    return result;
  }

  // ------------------------------------------------------------------
  // 送出2: 部品要求（parts）— 既存の部品供給パッケージを橋へ載せる
  // ------------------------------------------------------------------
  /**
   * run の部品不足から要求パッケージを作成し（監査・台帳は既存の
   * componentSupplyRequestService が担う）、橋の封筒として送出する。
   * VM 側はこの封筒を手元の要求として扱い、返却 ZIP を parts 返答で返す。
   */
  public async createPartsRequest(runId: string): Promise<BridgeWriteResult> {
    const created = await componentSupplyRequestService.createPackage(runId);
    if (!created.ok || !created.artifact) {
      return {
        ok: false,
        code: 'SUPPLY_CREATE_FAILED',
        message: created.message,
        detail: created.reasons ?? created.code,
      };
    }
    const artifact = created.artifact;
    const envelope: BridgeEnvelope<BridgePartsRequestPayload> = {
      v: 1,
      kind: 'parts',
      id: shortId(),
      createdAt: new Date().toISOString(),
      from: 'device',
      payload: {
        supplyRequestId: artifact.requestId,
        runId: artifact.runId,
        objective: artifact.objective,
        gapReason: artifact.gapReason,
        targetFiles: artifact.targetFiles.map((file) => ({ path: file.path, baselineSha256: file.baselineSha256 })),
        requestZipSha256: artifact.zipSha256,
        packageFileName: artifact.fileName,
        packageZipTxt: artifact.base64,
      },
    };
    const result = await this.writeEnvelope('parts', envelope, `部品要求 ${artifact.requestId}`);
    if (result.ok) {
      systemLogger.info('SYSTEM', `[橋] 部品要求を送出しました supplyRequestId=${artifact.requestId} envelope=${envelope.id}`);
    }
    return result;
  }

  /**
   * 発行済みの部品供給要求について、パッケージ実体なしの「不足の申告」
   * だけを橋へ出す（VM 側が自前のリポジトリ複製で対象を読める場合用）。
   */
  public async createPartsShortageNotice(supplyRequestId: string): Promise<BridgeWriteResult> {
    const record = componentSupplyRequestService.get(supplyRequestId);
    if (!record) {
      return { ok: false, code: 'SUPPLY_CREATE_FAILED', message: `要求ID ${supplyRequestId} は部品供給台帳にありません` };
    }
    if (record.status !== 'ISSUED') {
      return { ok: false, code: 'SUPPLY_CREATE_FAILED', message: `要求ID ${supplyRequestId} は発行中ではありません（状態: ${record.status}）` };
    }
    const envelope: BridgeEnvelope<BridgePartsRequestPayload> = {
      v: 1,
      kind: 'parts',
      id: shortId(),
      createdAt: new Date().toISOString(),
      from: 'device',
      payload: {
        supplyRequestId: record.requestId,
        runId: record.runId,
        objective: record.objective,
        gapReason: record.gapReason,
        targetFiles: record.targetFiles.map((file) => ({ path: file.path, baselineSha256: file.baselineSha256 })),
        requestZipSha256: record.zipSha256,
        packageFileName: record.fileName,
      },
    };
    return this.writeEnvelope('parts', envelope, `部品不足の申告 ${record.requestId}`);
  }

  // ------------------------------------------------------------------
  // 送出3: ログ返送（診断範囲のみ。会話本文は含めない）
  // ------------------------------------------------------------------
  /** 依頼フラグを立てる（アプリ側が異常を自覚した時の経路）。 */
  public requestLogExport(reason?: string): void {
    this.state.logRequested = true;
    this.state.logRequestReason = reason?.slice(0, 120);
    this.save();
    systemLogger.info('SYSTEM', `[橋] ログ返送の依頼フラグを立てました${reason ? `: ${reason}` : ''}`);
  }

  public isLogExportRequested(): boolean {
    return this.state.logRequested;
  }

  /**
   * ランタイムログを診断範囲に切って1束の ZIP にし、out/ へ置く。
   * - CHAT カテゴリは丸ごと除外する（会話本文を持ちうるため）。
   * - details は1件400字まで（P2010: 失敗・異常エントリは4,000字
   *   まで保持）、束の本文は新しい側を優先して 4.5MB で切る。
   * - 定期（SCHEDULED）、アプリ側の依頼フラグ（REQUESTED）、
   *   橋経由の VM 依頼（BRIDGE_REQUESTED、P2008）の3トリガーを受ける。
   *   成功したら最終返送時刻を共通の台帳へ刻み、依頼フラグも落とす
   *   （どの経路で送れても「送る必要」は満たされるため）。
   */
  public async exportLogBundle(trigger: 'SCHEDULED' | 'REQUESTED' | 'BRIDGE_REQUESTED'): Promise<BridgeWriteResult> {
    const id = shortId();
    const createdAt = new Date().toISOString();
    const entries = systemLogger.getLogs().filter((entry) => entry.category !== 'CHAT');
    const lines: string[] = [];
    let usedBytes = 0;
    let truncated = false;
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      let line = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
      if (entry.details !== undefined) {
        let detailText = '';
        try {
          detailText = typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details);
        } catch {
          detailText = '';
        }
        if (detailText) {
          const detailLimit = isFailureLogEntry(entry) ? LOG_DETAIL_MAX_CHARS_FAILURE : LOG_DETAIL_MAX_CHARS;
          line += ` | ${detailText.slice(0, detailLimit)}`;
        }
      }
      const lineBytes = byteLength(line) + 1;
      if (usedBytes + lineBytes > LOG_TEXT_BUDGET_BYTES) {
        truncated = true;
        break;
      }
      usedBytes += lineBytes;
      lines.push(line);
    }
    lines.reverse();
    const header = [
      `miki bridge log bundle`,
      `createdAt: ${createdAt}`,
      `trigger: ${trigger}`,
      `entries: ${lines.length}${truncated ? ` (truncated at ${LOG_TEXT_BUDGET_BYTES} bytes, newest kept)` : ''}`,
      `excludedCategories: CHAT`,
      '',
    ].join('\n');
    const zip = new JSZip();
    zip.file('runtime-log.txt', header + lines.join('\n'));
    zip.file('bundle.json', JSON.stringify({ v: 1, kind: 'log', id, createdAt, from: 'device', trigger, entryCount: lines.length, truncated }, null, 2));
    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    if (zipBytes.length > LOG_BUNDLE_MAX_BYTES) {
      return { ok: false, code: 'WRITE_FAILED', message: `ログ束が上限を超えました（${zipBytes.length} バイト）`, envelopeId: id };
    }
    const fileName = `log-${fileTimestamp()}-${id}.zip`;
    const result = await this.writeOutbox(fileName, { base64: toBase64(zipBytes) });
    if (result.ok) {
      this.state.lastLogExportAt = Date.now();
      if (trigger === 'REQUESTED' || trigger === 'BRIDGE_REQUESTED') {
        this.state.logRequested = false;
        this.state.logRequestReason = undefined;
      }
      this.save();
      systemLogger.info('SYSTEM', `[橋] ログ束を送出しました ${fileName} (${zipBytes.length} バイト, ${lines.length} 件, trigger=${trigger})`);
      return { ...result, envelopeId: id };
    }
    return result;
  }

  // ------------------------------------------------------------------
  // 送出4: 語彙・知識の差分（sync up、正本は端末）
  // ------------------------------------------------------------------
  /**
   * 端末側の増分を up として書き出す。送出済みハッシュは台帳に残し、
   * 同じ増分を二重に送らない。対象は REAL 世界の Claim（FICTION は
   * 送らない）と個人辞書の語彙。送出前に監査を通す。
   */
  public async exportSyncUp(): Promise<BridgeWriteResult> {
    const sent = new Set(this.state.sentSyncHashes);
    const claimItems: Array<Record<string, unknown>> = [];
    const claims = claimDatabaseService.getAllClaims() as Array<Record<string, unknown>>;
    const sortedClaims = [...claims].sort((a, b) => Number(a.updated_at ?? 0) - Number(b.updated_at ?? 0));
    for (const claim of sortedClaims) {
      if (claimItems.length >= SYNC_UP_MAX_CLAIMS) break;
      if (claim.world !== 'REAL' || typeof claim.claim_id !== 'string' || typeof claim.statement !== 'string') continue;
      const hash = sha256HexFromText(`claim:${claim.claim_id}:${String(claim.updated_at ?? '')}:${String(claim.status ?? '')}:${String(claim.maturity ?? '')}:${claim.statement}`);
      if (sent.has(hash)) continue;
      sent.add(hash);
      claimItems.push({
        claimId: claim.claim_id,
        statement: claim.statement,
        kind: claim.kind,
        status: claim.status,
        maturity: claim.maturity,
        source: claim.source,
        originSourceId: claim.origin_source_id,
        independenceClusterId: claim.independence_cluster_id,
        createdAt: claim.created_at,
        updatedAt: claim.updated_at,
        syncHash: hash,
      });
    }
    const vocabularyItems: Array<Record<string, unknown>> = [];
    for (const entry of japaneseDictionaryService.listPersonal()) {
      if (vocabularyItems.length >= SYNC_UP_MAX_VOCABULARY) break;
      const hash = sha256HexFromText(`vocab:${entry.normalized}:${entry.gloss ?? ''}:${entry.reading ?? ''}`);
      if (sent.has(hash)) continue;
      sent.add(hash);
      vocabularyItems.push({
        surface: entry.surface,
        normalized: entry.normalized,
        lemma: entry.lemma,
        reading: entry.reading,
        pos: entry.pos,
        gloss: entry.gloss,
        semanticIds: entry.semanticIds,
        syncHash: hash,
      });
    }
    if (claimItems.length === 0 && vocabularyItems.length === 0) {
      return { ok: false, code: 'EMPTY', message: '送出する増分がありません' };
    }
    const envelope: BridgeEnvelope<BridgeSyncUpPayload> = {
      v: 1,
      kind: 'sync',
      id: shortId(),
      createdAt: new Date().toISOString(),
      from: 'device',
      payload: { claims: claimItems, vocabulary: vocabularyItems },
    };
    const text = JSON.stringify(envelope, null, 2);
    const audit = this.auditOutbound(text, '同期送出');
    if (!audit.allowed) {
      systemLogger.warn('PRIVACY', `[橋] 同期送出を監査で遮断しました`, { reasons: audit.reasons });
      return { ok: false, code: 'PRIVACY_BLOCKED', message: '送出前プライバシー監査で遮断されました', detail: audit.reasons, envelopeId: envelope.id };
    }
    const fileName = `up-${fileTimestamp()}-${envelope.id}.json`;
    const result = await this.writeOutbox(fileName, { text });
    if (result.ok) {
      // 送れた分だけ送出済みに刻む（次回の差分から外れる）。
      this.state.sentSyncHashes = [...sent];
      this.recordPending(envelope, fileName, `同期送出 Claim${claimItems.length}件・語彙${vocabularyItems.length}件`);
      this.save();
      systemLogger.info('SYSTEM', `[橋] 同期差分を送出しました Claim ${claimItems.length} 件 / 語彙 ${vocabularyItems.length} 件`);
      return { ...result, envelopeId: envelope.id };
    }
    return result;
  }

  // ------------------------------------------------------------------
  // 受信: in/ の巡回と種類ごとの既存入口への接続
  // ------------------------------------------------------------------
  public async pollInbox(): Promise<BridgePollResult> {
    const files = await this.listInboxFiles();
    if (files === null) {
      this.noteTransportFailure('in/ の巡回');
      return { ok: false, code: 'SERVER_UNAVAILABLE', listed: 0, processed: 0, skipped: 0, outcomes: [] };
    }
    this.noteTransportRecovery();
    const outcomes: BridgeInboxOutcome[] = [];
    let processed = 0;
    let skipped = 0;
    for (const fileName of files.sort()) {
      if (!fileName.endsWith('.json')) {
        skipped += 1;
        continue;
      }
      const text = await this.readInboxFile(fileName);
      if (text === null) {
        skipped += 1;
        continue;
      }
      const sha256 = sha256HexFromText(text);
      const already = this.state.processedIn.find((record) => record.fileName === fileName && record.sha256 === sha256);
      if (already) {
        skipped += 1;
        continue;
      }
      const outcome = await this.intakeInboxFile(fileName, text);
      this.state.processedIn.push({
        fileName,
        sha256,
        kind: outcome.kind,
        status: outcome.status,
        note: outcome.note,
        processedAt: Date.now(),
      });
      this.save();
      outcomes.push(outcome);
      processed += 1;
    }
    if (processed > 0) {
      systemLogger.info('SYSTEM', `[橋] 返送を取り込みました ${processed} 件`, { outcomes });
    }
    return { ok: true, code: 'SUCCESS', listed: files.length, processed, skipped, outcomes };
  }

  private async intakeInboxFile(fileName: string, text: string): Promise<BridgeInboxOutcome> {
    let envelope: BridgeEnvelope;
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      envelope = parsed as BridgeEnvelope;
      if (envelope.v !== 1 || typeof envelope.kind !== 'string' || typeof envelope.id !== 'string') {
        throw new Error('envelope shape');
      }
    } catch {
      return { fileName, kind: 'unknown', status: 'INVALID_ENVELOPE', note: '封筒として読めませんでした' };
    }
    // 自分の送出が写ってきた場合は取り込まない（出所で判定）。
    if (envelope.from === 'device') {
      return { fileName, kind: envelope.kind, status: 'SKIPPED_OWN', note: '端末自身の送出のため取り込みません' };
    }
    try {
      switch (envelope.kind) {
        case 'research':
          return await this.intakeResearchResult(fileName, envelope as unknown as BridgeEnvelope<BridgeResearchResultPayload>);
        case 'parts':
        case 'teacher':
          return await this.intakePartsResult(fileName, envelope as unknown as BridgeEnvelope<BridgePartsResultPayload>);
        case 'sync':
          return await this.intakeSyncDown(fileName, envelope as unknown as BridgeEnvelope<BridgeSyncDownPayload>);
        case 'fieldtest':
          return await this.intakeFieldTest(fileName, envelope as unknown as BridgeEnvelope<BridgeFieldTestPayload>);
        case 'log':
          return await this.intakeLogRequest(fileName, envelope as unknown as BridgeEnvelope<BridgeLogRequestPayload>);
        default:
          return { fileName, kind: envelope.kind, status: 'UNSUPPORTED_KIND', note: `未対応の kind: ${envelope.kind}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      systemLogger.warn('SYSTEM', `[橋] 返送の取り込みに失敗しました ${fileName}`, { error: message });
      return { fileName, kind: envelope.kind, status: 'INTAKE_ERROR', note: message.slice(0, 200) };
    }
  }

  /** 調査結果: 出所を Evidence 化し、所見文は未検証 Claim として発見登録する。 */
  private async intakeResearchResult(
    fileName: string,
    envelope: BridgeEnvelope<BridgeResearchResultPayload>,
  ): Promise<BridgeInboxOutcome> {
    const payload = envelope.payload ?? {};
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const evidenceIds: string[] = [];
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      const title = (source.title || source.url || `橋の調査出典 ${i + 1}`).trim();
      const record = evidenceService.recordWebEvidence({
        title,
        snippet: (source.snippet || '').slice(0, 1000),
        source: hostOf(source.url) || 'bebe-bridge-vm',
        url: source.url,
        sourceId: `bridge:${envelope.id}:${i}`,
        metadata: { external_bundle_id: envelope.id, trust_boundary: 'UNTRUSTED_EXTERNAL_AI' },
      });
      if (record.status !== 'REJECTED') evidenceIds.push(record.evidence_id);
    }
    let answerEvidenceId: string | undefined;
    if (payload.answer !== undefined && payload.answer !== null && payload.answer !== '') {
      const answerText = typeof payload.answer === 'string' ? payload.answer : JSON.stringify(payload.answer);
      if (answerText.trim()) {
        const record = evidenceService.recordCloudAiEvidence({
          title: (payload.question || `橋の調査結果 ${envelope.id}`).slice(0, 200),
          snippet: answerText.slice(0, 2000),
          source: envelope.from,
          sourceId: `bridge:${envelope.id}`,
          metadata: { external_bundle_id: envelope.id, trust_boundary: 'UNTRUSTED_EXTERNAL_AI' },
        });
        answerEvidenceId = record.evidence_id;
      }
    }
    let claimsRegistered = 0;
    const registeredClaimIds: string[] = [];
    const findings = Array.isArray(payload.findings) ? payload.findings : [];
    for (const finding of findings) {
      const statement = typeof finding?.statement === 'string' ? finding.statement.trim() : '';
      if (!statement) continue;
      const evidenceId =
        (typeof finding.sourceIndex === 'number' ? evidenceIds[finding.sourceIndex] : undefined) ?? answerEvidenceId ?? evidenceIds[0];
      if (!evidenceId) continue;
      const claimId = evidenceService.registerUnverifiedClaim(evidenceId, statement);
      if (claimId) {
        claimsRegistered += 1;
        registeredClaimIds.push(claimId);
      }
    }

    // P2012: findings が無く answer だけの返送（VM の組成回答はこの形）
    // では、従来は Claim が1件も生まれず、材料が検証にも gap の完了
    // 判定にも一切届かなかった。answer の要約文を Claim 候補として
    // 発見登録し（登録は従来どおり未検証主張として、P2007 の整形を
    // 通る）、返送が宣言する出典 Evidence をその Claim へ紐付ける。
    // 裏付けの成否は検証器が従来どおり独立クラスタ数と関連性で
    // 判定する（橋の材料を無条件に昇格させることはしない）。
    if (registeredClaimIds.length === 0 && answerEvidenceId) {
      const candidate = bridgeAnswerClaimCandidate(payload.answer);
      if (candidate) {
        const claimId = evidenceService.registerUnverifiedClaim(answerEvidenceId, candidate);
        if (claimId) {
          claimsRegistered += 1;
          registeredClaimIds.push(claimId);
          for (const sourceEvidenceId of evidenceIds) {
            evidenceService.attachEvidenceToClaim(sourceEvidenceId, claimId);
          }
        }
      }
    }

    // P2012: sourceRef が gap を指す返送は、その gap の調査材料として
    // 接続する。従来は sourceRef を読まず、材料が gap にも再検証にも
    // 接続されないまま、ラン側が「主張 DB に変化なし」と判断して
    // 同じ依頼を出し続けていた（2026-11-23 実機で同一 gap へ5回）。
    // 検証は acquireEvidence の Claim 経路と同じく verifierService の
    // 通常判定で行い、登録した Claim が全件確定した場合だけ、
    // VERIFY_RESEARCH_CLAIMS 経路と同じ意味論で gap を解決する。
    // 一部でも未確定なら gap は開いたままにし、材料は gap の
    // researchClaimIds に残して後続の検証に委ねる。
    let gapResolution: string | undefined;
    const sourceRef = typeof payload.sourceRef === 'string' ? payload.sourceRef.trim() : '';
    if (sourceRef && registeredClaimIds.length > 0) {
      const gap = knowledgeGapService.getById(sourceRef);
      if (gap && gap.status !== 'RESOLVED') {
        knowledgeGapService.attachResearchClaims(gap.id, registeredClaimIds);
        knowledgeGapService.advanceResolutionPlan(gap.id, 'VERIFY');
        const outcomes = registeredClaimIds.map((claimId) => verifierService.verifyClaim({ claimId }));
        const allVerified = outcomes.every(
          (outcome) => outcome.outcome === 'SUPPORTED' || outcome.outcome === 'DEVICE_VERIFIED',
        );
        if (allVerified) {
          knowledgeGapService.advanceResolutionPlan(gap.id, 'RESOLVE');
          knowledgeGapService.markResolved(gap.id);
          gapResolution = 'RESOLVED';
        } else {
          gapResolution = 'VERIFYING';
        }
        systemLogger.info(
          'SYSTEM',
          `[P2012] 橋の調査材料を gap へ接続: gap=${gap.id} claims=${registeredClaimIds.join(',')} verification=${outcomes.map((outcome) => outcome.outcome).join(',')} gap=${gapResolution}`,
        );
      }
    }

    // 対応する送出があれば pending から外す（結果が届いた）。
    this.state.pendingOut = this.state.pendingOut.filter((record) => record.envelopeId !== envelope.id);
    this.save();
    return {
      fileName,
      kind: 'research',
      status: 'INTAKEN',
      note: `Evidence ${evidenceIds.length + (answerEvidenceId ? 1 : 0)} 件 / Claim候補 ${claimsRegistered} 件${gapResolution ? ` / gap ${sourceRef} ${gapResolution}` : ''}`,
    };
  }

  /** 部品・教師パッケージ: 返却 ZIP を既存の受入台帳へそのまま渡す。 */
  private async intakePartsResult(
    fileName: string,
    envelope: BridgeEnvelope<BridgePartsResultPayload>,
  ): Promise<BridgeInboxOutcome> {
    const payload = envelope.payload ?? {};
    let bytes: Uint8Array | undefined;
    let replyFileName = 'MIKI_SUPPLY_REPLY_BRIDGE.zip';
    if (typeof payload.supplyReplyZipBase64 === 'string' && payload.supplyReplyZipBase64.trim()) {
      try {
        bytes = fromBase64(payload.supplyReplyZipBase64);
      } catch {
        bytes = undefined;
      }
    } else if (typeof payload.supplyReplyZipTxt === 'string' && payload.supplyReplyZipTxt.trim()) {
      bytes = textEncoder.encode(payload.supplyReplyZipTxt);
      replyFileName = 'MIKI_SUPPLY_REPLY_BRIDGE.zip.txt';
    }
    if (!bytes || bytes.length === 0) {
      return { fileName, kind: envelope.kind, status: 'REJECTED', note: '返却 ZIP（supplyReplyZipBase64 / supplyReplyZipTxt）がありません' };
    }
    const result = await componentSupplyIntakeService.receiveReply({ fileName: replyFileName, bytes });
    return {
      fileName,
      kind: envelope.kind,
      status: result.ok ? 'INTAKEN' : 'REJECTED',
      note: `${result.code}: ${result.message}`.slice(0, 240),
    };
  }

  /** 同期 down: 候補としてだけ取り込む。端末側の既存項目は上書きしない。 */
  private async intakeSyncDown(
    fileName: string,
    envelope: BridgeEnvelope<BridgeSyncDownPayload>,
  ): Promise<BridgeInboxOutcome> {
    const payload = envelope.payload ?? {};
    let knowledgeTaken = 0;
    let vocabularyTaken = 0;
    let keptDevice = 0;
    const knowledge = Array.isArray(payload.knowledge) ? payload.knowledge : [];
    for (const item of knowledge) {
      const statement = typeof item?.statement === 'string' ? item.statement.trim() : '';
      if (!statement) continue;
      const record = item.sourceUrl
        ? evidenceService.recordWebEvidence({
            title: (item.sourceTitle || statement.slice(0, 80)).slice(0, 200),
            snippet: statement.slice(0, 1000),
            source: hostOf(item.sourceUrl) || 'bebe-bridge-vm',
            url: item.sourceUrl,
            sourceId: `bridge:${envelope.id}`,
            metadata: { external_bundle_id: envelope.id, trust_boundary: 'UNTRUSTED_EXTERNAL_AI' },
          })
        : evidenceService.recordCloudAiEvidence({
            title: (item.sourceTitle || statement.slice(0, 80)).slice(0, 200),
            snippet: statement.slice(0, 1000),
            source: item.sourceName || envelope.from,
            sourceId: `bridge:${envelope.id}`,
            metadata: { external_bundle_id: envelope.id, trust_boundary: 'UNTRUSTED_EXTERNAL_AI' },
          });
      if (record.status === 'REJECTED') continue;
      // registerUnverifiedClaim は同一文面の既存 Claim を返す（端末側が
      // 正本であり、down 候補で上書きは起きない）。
      const claimId = evidenceService.registerUnverifiedClaim(record.evidence_id, statement);
      if (claimId) knowledgeTaken += 1;
    }
    const vocabulary = Array.isArray(payload.vocabulary) ? payload.vocabulary : [];
    for (const item of vocabulary) {
      const term = typeof item?.term === 'string' ? item.term.trim() : '';
      const gloss = typeof item?.gloss === 'string' ? item.gloss.trim() : '';
      if (!term || !gloss) continue;
      if (japaneseDictionaryService.has(term)) {
        // 端末が正本: 既に知っている語は down 候補で置き換えない。
        keptDevice += 1;
        continue;
      }
      // 学習経路（definitionPatternService）が拾う明示定義の形に整える:
      // 「Xとは、〜である。」は最強の定義形として扱われる既存の作法。
      const definitionText = `${term}とは、${gloss}である。`;
      const record = evidenceService.recordCloudAiEvidence({
        title: `語彙候補: ${term}`,
        snippet: definitionText,
        source: 'bebe-bridge-vm',
        sourceId: `bridge:${envelope.id}`,
        metadata: { external_bundle_id: envelope.id, trust_boundary: 'UNTRUSTED_EXTERNAL_AI' },
      });
      if (record.status === 'REJECTED') continue;
      const learned = webTermLearningService.learnPage({
        text: definitionText,
        url: item.sourceUrl || `bebe-bridge://sync/${envelope.id}`,
        evidenceId: record.evidence_id,
        priorityTerms: [term],
      });
      const learnedIt =
        learned.learnedDefinitions.some((def) => def.term === term) ||
        learned.terms.some((learnedTerm) => learnedTerm.term === term && Boolean(learnedTerm.gloss));
      if (learnedIt) vocabularyTaken += 1;
    }
    return {
      fileName,
      kind: 'sync',
      status: 'INTAKEN',
      note: `知識候補 ${knowledgeTaken} 件 / 語彙候補 ${vocabularyTaken} 件 / 端末優先で見送り ${keptDevice} 件`,
    };
  }

  // ------------------------------------------------------------------
  // ログ返送依頼（P2008）: VM から kind 'log' の封筒が sync の
  // down-*.json で届いたら、その場でログ束を1回送って消費する
  // ------------------------------------------------------------------
  /**
   * 消費は台帳の重複排除（ファイル名＋sha256）が担保する: 同じ依頼
   * ファイルが in/ に残っていても二度目は処理されない。書き出しに
   * 失敗した場合は、アプリ側の依頼フラグへ落として次の発火口
   * （軽い取り込み／深いサイクル）で再試行させる。
   */
  private async intakeLogRequest(
    fileName: string,
    envelope: BridgeEnvelope<BridgeLogRequestPayload>,
  ): Promise<BridgeInboxOutcome> {
    const payload = envelope.payload ?? ({} as BridgeLogRequestPayload);
    if (payload.action !== 'EXPORT_LOGS') {
      return {
        fileName,
        kind: 'log',
        status: 'UNSUPPORTED_ACTION',
        note: `未対応の action: ${typeof payload.action === 'string' ? payload.action : '(なし)'}`,
      };
    }
    const reason = typeof payload.reason === 'string' ? payload.reason.slice(0, 120) : undefined;
    systemLogger.info('SYSTEM', `[橋] VM からログ返送の依頼を受けました${reason ? `: ${reason}` : ''}`);
    const result = await this.exportLogBundle('BRIDGE_REQUESTED');
    if (!result.ok) {
      this.requestLogExport('橋経由の依頼（書き出し失敗のため再試行）');
      return { fileName, kind: 'log', status: 'LOG_EXPORT_FAILED', note: result.message };
    }
    return {
      fileName,
      kind: 'log',
      status: 'LOG_EXPORTED',
      note: `依頼によりログ束を送出しました${reason ? `: ${reason}` : ''}`,
    };
  }

  // ------------------------------------------------------------------
  // 実地試験（fieldtest）: 枠のみ。個別の試験は後続束が runner を登録する
  // ------------------------------------------------------------------
  public registerFieldTestRunner(testKind: string, runner: BridgeFieldTestRunner): void {
    this.fieldTestRunners.set(testKind, runner);
  }

  private async intakeFieldTest(
    fileName: string,
    envelope: BridgeEnvelope<BridgeFieldTestPayload>,
  ): Promise<BridgeInboxOutcome> {
    const payload = envelope.payload ?? ({} as BridgeFieldTestPayload);
    const testKind = typeof payload.testKind === 'string' ? payload.testKind : '';
    const title = typeof payload.title === 'string' ? payload.title : '';
    if (!testKind || !title) {
      return { fileName, kind: 'fieldtest', status: 'REJECTED', note: 'testKind / title が不足しています' };
    }
    const record: BridgeFieldTestRecord = {
      envelopeId: envelope.id,
      testKind,
      title,
      status: 'RECEIVED',
      receivedAt: Date.now(),
    };
    this.state.fieldTests.push(record);
    this.save();
    const runner = this.fieldTestRunners.get(testKind);
    if (!runner) {
      return { fileName, kind: 'fieldtest', status: 'RECEIVED', note: `試験「${title}」を受領（runner 未登録のため保留）` };
    }
    const runOutcome = await this.runFieldTest(envelope, record, runner);
    return { fileName, kind: 'fieldtest', status: runOutcome.status, note: runOutcome.note };
  }

  private async runFieldTest(
    envelope: BridgeEnvelope<BridgeFieldTestPayload>,
    record: BridgeFieldTestRecord,
    runner: BridgeFieldTestRunner,
  ): Promise<{ status: string; note: string }> {
    record.status = 'RUNNING';
    this.save();
    let result: { status: 'PASSED' | 'FAILED' | 'ERROR'; detail?: string };
    try {
      result = await runner(envelope);
    } catch (error) {
      result = { status: 'ERROR', detail: error instanceof Error ? error.message : String(error) };
    }
    const resultEnvelope: BridgeEnvelope<BridgeFieldTestResultPayload> = {
      v: 1,
      kind: 'fieldtest',
      id: shortId(),
      createdAt: new Date().toISOString(),
      from: 'device',
      payload: {
        inResponseTo: envelope.id,
        testKind: record.testKind,
        status: result.status,
        detail: result.detail?.slice(0, 1000),
      },
    };
    const fileName = `fieldtest-${fileTimestamp()}-${resultEnvelope.id}.json`;
    const written = await this.writeOutbox(fileName, { text: JSON.stringify(resultEnvelope, null, 2) });
    record.status = result.status === 'ERROR' ? 'ERROR' : 'DONE';
    record.resultFileName = written.ok ? fileName : undefined;
    record.detail = result.detail?.slice(0, 300);
    this.save();
    return {
      status: result.status,
      note: `試験「${record.title}」を実行: ${result.status}${written.ok ? '' : '（結果の書き出しに失敗）'}`,
    };
  }

  // ------------------------------------------------------------------
  // 背景サイクル用の一括交換（backgroundWorkerService から呼ばれる）
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // 軽い取り込み（P2004）: 返送取り込みだけを深い背景サイクルから分離
  // ------------------------------------------------------------------
  /**
   * 段梯子: 起動時・前景復帰時は即時、前景にいる間は約10分間隔、
   * 背景では約30分間隔で pollInbox だけを回す。従来は取り込みが
   * 深いサイクル（電池適応15〜60分＋ユーザー操作中は停止）相乗りで、
   * 通常使用では長時間止まっていた。同期送出は従来どおり
   * runBackgroundExchange（深いサイクル）だけが行う。
   * ログ返送は P2008 で軽い側にも発火口を持った: 取り込みのついでに
   * 依頼フラグと「前回返送からの経過（閾値6時間）」を判定し、
   * 既存の exportLogBundle を1回だけ走らせる（maybeExportLogOnLightCycle）。
   * 背景の30分は WebView の JS が生きている範囲での周期であり、
   * OS に止められた場合は前景復帰時の即時取り込みで回収する。
   * 失敗しても呼び出し元へは投げない（橋は補助線）。
   */
  public async runLightIntake(options?: { immediate?: boolean }): Promise<BridgePollResult | null> {
    this.ensureLightIntakeSchedule();
    if (this.lightIntakeRunning) return null;
    const now = Date.now();
    const elapsed = now - this.lastLightIntakeAt;
    if (options?.immediate) {
      // 起動と前景復帰が重なっても二重に走らせない。
      if (elapsed < BRIDGE_LIGHT_INTAKE_IMMEDIATE_DEDUPE_MS) return null;
    } else if (elapsed < this.lightIntakeIntervalMs()) {
      return null;
    }
    this.lightIntakeRunning = true;
    this.lastLightIntakeAt = now;
    try {
      this.requestCourierNow();
      const result = await this.pollInbox();
      // P2008: 取り込みのついでにログ返送の判定（軽い判定のみ。
      // 実際の返送は条件を満たした時だけ既存経路で1回）。
      // 取り込みの中で VM 依頼により返送済みなら、最終返送時刻が
      // 更新されているため、ここでは何も起きない。
      await this.maybeExportLogOnLightCycle();
      return result;
    } catch {
      return null;
    } finally {
      this.lightIntakeRunning = false;
    }
  }

  /**
   * P2008: 軽いサイクル側のログ返送判定。優先順位は
   * (1) アプリ側の依頼フラグ (2) 前回返送から閾値（6時間）超過。
   * どちらも既存の exportLogBundle を再利用し、成功すれば最終
   * 返送時刻が共通台帳に刻まれるため、深いサイクル側と二重に
   * 送ることはない。失敗しても次回の発火口で再判定される。
   */
  private async maybeExportLogOnLightCycle(): Promise<void> {
    try {
      if (this.state.logRequested) {
        await this.exportLogBundle('REQUESTED');
      } else if (Date.now() - this.state.lastLogExportAt >= BRIDGE_LOG_EXPORT_LIGHT_INTERVAL_MS) {
        await this.exportLogBundle('SCHEDULED');
      }
    } catch {
      /* 橋は補助線: 返送の失敗で取り込み側を巻き込まない */
    }
  }

  private lightIntakeIntervalMs(): number {
    try {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return BRIDGE_LIGHT_INTAKE_BACKGROUND_MS;
      }
    } catch { /* DOM の無い環境では前景扱い */ }
    return BRIDGE_LIGHT_INTAKE_FOREGROUND_MS;
  }

  private ensureLightIntakeSchedule(): void {
    if (this.lightIntakeTimer) return;
    try {
      this.lightIntakeTimer = setInterval(() => { void this.runLightIntake(); }, BRIDGE_LIGHT_INTAKE_TICK_MS);
      const timer = this.lightIntakeTimer as unknown as { unref?: () => void };
      if (typeof timer.unref === 'function') timer.unref();
    } catch { /* タイマーが張れない環境では即時発火口だけが働く */ }
  }

  public async runBackgroundExchange(): Promise<BridgeBackgroundResult> {
    // 取り込みの開始時に即時運搬を頼み、新着が in/ へ届く機会を増やす
    // （fire-and-forget。今回の pollInbox に間に合わなくても次回に回る）。
    this.requestCourierNow();
    const inbox = await this.pollInbox();
    let logExported = false;
    if (this.state.logRequested) {
      const result = await this.exportLogBundle('REQUESTED');
      logExported = result.ok;
    } else if (Date.now() - this.state.lastLogExportAt >= BRIDGE_LOG_EXPORT_INTERVAL_MS) {
      const result = await this.exportLogBundle('SCHEDULED');
      logExported = result.ok;
    }
    const sync = await this.exportSyncUp();
    return { inbox, logExported, syncExported: sync.ok };
  }
}

export const bridgeExchangeService = new BridgeExchangeService();
