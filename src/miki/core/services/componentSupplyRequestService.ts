import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { improvementIntakeRouterService, type ImprovementIntakeRun } from './improvementIntakeRouterService';
import { taskBlackboardService } from './taskBlackboardService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { privacyGuardrailService } from '../../safety/services/privacyGuardrailService';
import { sha256HexFromText } from './canonicalSha256Service';

/*
 * P419（供給1）: 部品供給パッケージの要求生成・台帳・送出。
 *
 * 位置付け: 外部（ChatGPT / Claude / Muse 等）は「素材供給」まで。
 * MIKI が候補生成で部品不足（candidateGenerationGap）に陥った run を起点に、
 * 不足の内訳・対象ファイル全文・関連抜粋・制約・返却形式を 1 つの要求
 * パッケージ（ZIP を Base64 化した .zip.txt）に束ね、ユーザーが外部AIへ
 * 手渡せる形で Downloads へ保存する。返ってきた素材の受入・検証・候補
 * 接続は供給2（別サービス）であり、ここでは行わない。生成段の受け口
 * （run.payload.implementationCandidates → parseImplementationCandidates）
 * へ接続できるよう、replySpec は supply_reply.json の確定形をそのまま
 * 記載する。
 *
 * v1 の範囲:
 *  - 対象は既存ファイルのみ。新規ファイル対象は理由を明示して弾く
 *    （対象決定の入口が既存ファイル前提のため。供給パッケージ側で
 *    先行して許可すると受入側で行き止まりになる）。
 *  - 発火は手動（改善UIからの操作）。自動発火はしない。
 *  - 送出前にプライバシー検査を通し、検出したら送出を止めて理由を返す。
 *  - 文脈が上限を超える場合は黙って切り捨てず、理由を明示して失敗する
 *    （対象ファイル単体の超過だけはシグネチャ抜粋へ切り替え、その旨を
 *    manifest に明記する）。
 *  - P421（供給3）: 不足記録に契約欄（不足発生時点で生成段が確定させた
 *    期待インターフェース）があれば、wantedComponents の構築では
 *    その記録済み契約を優先し、索引からの再構成は契約が無い場合の
 *    フォールバックとする。supply_request.json の形は変えない。
 *  - P434: 不足記録に P433 の「作るべき部品の仕様」
 *    （missingComponentSpecs）があれば、供給パッケージ
 *    （supply_request.json と INSTRUCTIONS.md）へそのまま載せる。
 *    仕様が無ければ何も足さない。
 */

export type ComponentSupplyRequestStatus = 'ISSUED' | 'RECEIVED' | 'REJECTED' | 'CANCELLED';

export type ComponentSupplyCreateCode =
  | 'SUCCESS'
  | 'RUN_NOT_FOUND'
  | 'GAP_NOT_FOUND'
  | 'NO_TARGET_FILES'
  | 'TARGET_FILE_NOT_FOUND'
  | 'CONTEXT_TOO_LARGE'
  | 'PACKAGE_TOO_LARGE'
  | 'PRIVACY_BLOCKED'
  | 'ZIP_BUILD_FAILED'
  | 'ZIP_VERIFY_FAILED';

export interface ComponentSupplyTargetFile {
  path: string;
  baselineSha256: string;
}

export interface ComponentSupplyLedgerRecord {
  requestId: string;
  runId: string;
  taskId?: string;
  objective: string;
  status: ComponentSupplyRequestStatus;
  issuedAt: number;
  updatedAt: number;
  fileName: string;
  zipSha256: string;
  zipSizeBytes: number;
  base64Length: number;
  targetFiles: ComponentSupplyTargetFile[];
  gapReason: string;
  statusNote?: string;
}

export interface ComponentSupplyArtifact extends ComponentSupplyLedgerRecord {
  base64: string;
  entries: Array<{ name: string; sha256: string; sizeBytes: number }>;
}

export interface ComponentSupplyCreateResult {
  ok: boolean;
  code: ComponentSupplyCreateCode;
  message: string;
  reasons?: string[];
  artifact?: ComponentSupplyArtifact;
}

interface CandidateGenerationGapContractSignatureRecord {
  name?: string;
  kind?: string;
  parameters?: string[];
  returnType?: string;
}

interface CandidateGenerationGapContractTargetRecord {
  path?: string;
  exports?: string[];
  signatures?: CandidateGenerationGapContractSignatureRecord[];
  imports?: string[];
}

interface CandidateGenerationGapContractRecord {
  targets?: CandidateGenerationGapContractTargetRecord[];
  missingSlots?: Array<{ knowledgeId?: string; slotName?: string; inputKinds?: string[] }>;
  missingComponentIds?: string[];
}

// P434: P433で不足記録に載るようになった「作るべき部品の仕様」
// （読み取り専用の写し。正の定義は missingComponentSpecService の
// MissingComponentSpec）。
interface MissingComponentSpecRecord {
  name?: string;
  targetPath?: string;
  inputKinds?: string[];
  expectedBehavior?: string;
  source?: string;
  knowledgeId?: string;
  slotName?: string;
  missingComponentId?: string;
}

interface CandidateGenerationGapRecord {
  operation?: string;
  runId?: string;
  reason?: string;
  synthesisGapReason?: string;
  blockedReason?: string;
  constructionGaps?: string[];
  unknownQuestions?: string[];
  targetPaths?: string[];
  // P433で不足記録に載るようになった「作るべき部品の仕様」。
  missingComponentSpecs?: MissingComponentSpecRecord[];
  // P421: 不足発生時点で生成段が確定させた契約欄（読み取り専用の写し。
  // 正の定義は candidateCodeGenerationService の CandidateGenerationGapContract）。
  contract?: CandidateGenerationGapContractRecord;
}

interface ContextEntry {
  name: string;
  path: string;
  kind: 'TARGET_FULL' | 'TARGET_EXCERPT' | 'RELATED_EXCERPT';
  content: string;
  truncated: boolean;
  originalBytes: number;
  includedBytes: number;
  sha256: string;
}

const LEDGER_KEY = 'miki_component_supply_request_ledger_v1';

// 対象ファイル全文の上限（報告書 §2 の目安: 1ファイル 60KB）。
// 超過した対象はシグネチャ中心の抜粋へ切り替え、truncated を明記する。
const TARGET_FULL_LIMIT_BYTES = 60 * 1024;
const TARGET_EXCERPT_LIMIT_BYTES = 24 * 1024;
// 関連抜粋は1ファイル 8KB、合計 40KB まで。
const RELATED_EXCERPT_LIMIT_BYTES = 8 * 1024;
const RELATED_TOTAL_LIMIT_BYTES = 40 * 1024;
// 文脈（context/ 配下）の合計上限の目安（報告書 §2 の試算 ~110KB）。
// 対象ファイルだけでこれを超える場合は抜粋化でごまかさず失敗する。
const CONTEXT_BUDGET_BYTES = 110 * 1024;
// 送出上限: ネイティブ保存（writeDownloadTextFile）は 2,000,000 字まで。
// Base64 化したテキストがその上限に収まるよう、安全側に 1,900,000 字を
// 実用上限とする（ZIP 本体では約 1.42MB 相当）。
const MAX_PACKAGE_TEXT_CHARS = 1_900_000;

const textEncoder = new TextEncoder();
const byteLength = (text: string): number => textEncoder.encode(text).length;

const SIGNATURE_LINE =
  /^\s*(import\s|export\s|export\s+default|interface\s|type\s|class\s|abstract\s|function\s|const\s|let\s|var\s|public\s|private\s|protected\s|static\s|async\s|declare\s|enum\s|@\w+)/;

class ComponentSupplyRequestService {
  private ledger = new Map<string, ComponentSupplyLedgerRecord>();
  private sequence = 0;

  constructor() {
    this.load();
  }

  // ------------------------------------------------------------------
  // 台帳（reviewZipExportService の台帳パターンに倣う）
  // ------------------------------------------------------------------
  private load(): void {
    try {
      const raw = storageService.getItem(LEDGER_KEY);
      const values = raw ? JSON.parse(raw) : [];
      if (Array.isArray(values)) {
        for (const value of values) {
          if (value && typeof value.requestId === 'string') {
            this.ledger.set(value.requestId, value as ComponentSupplyLedgerRecord);
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

  private clone(record: ComponentSupplyLedgerRecord): ComponentSupplyLedgerRecord {
    return { ...record, targetFiles: record.targetFiles.map((file) => ({ ...file })) };
  }

  public list(): ComponentSupplyLedgerRecord[] {
    return [...this.ledger.values()]
      .sort((a, b) => b.issuedAt - a.issuedAt)
      .map((record) => this.clone(record));
  }

  public get(requestId: string): ComponentSupplyLedgerRecord | undefined {
    const record = this.ledger.get(requestId);
    return record ? this.clone(record) : undefined;
  }

  /** 供給2（受入）が状態遷移を足すための口。ISSUED 以降の遷移はここを通す。 */
  public recordStatus(requestId: string, status: ComponentSupplyRequestStatus, note?: string): boolean {
    const record = this.ledger.get(requestId);
    if (!record) return false;
    record.status = status;
    record.updatedAt = Date.now();
    if (note) record.statusNote = note;
    this.ledger.set(requestId, record);
    return this.save();
  }

  // ------------------------------------------------------------------
  // 起点 run と不足記録の解決
  // ------------------------------------------------------------------
  private findGap(run: ImprovementIntakeRun): CandidateGenerationGapRecord | undefined {
    if (!run.taskId) return undefined;
    const task = taskBlackboardService.get(run.taskId);
    if (!task) return undefined;
    let found: CandidateGenerationGapRecord | undefined;
    for (const entry of task.entries) {
      if (entry.kind !== 'OBSERVATION' || entry.key !== 'candidateGenerationGap') continue;
      const value = entry.value as CandidateGenerationGapRecord | null;
      if (value && value.runId === run.runId) found = value;
    }
    return found;
  }

  private payloadStrings(run: ImprovementIntakeRun, key: string): string[] {
    const value = run.payload?.[key];
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
      : [];
  }

  private resolveTargetPaths(run: ImprovementIntakeRun, gap: CandidateGenerationGapRecord): string[] {
    const candidates = [
      ...(Array.isArray(gap.targetPaths) ? gap.targetPaths : []),
      ...(run.implementationPlan?.targetPaths ?? []),
      ...this.payloadStrings(run, 'targetFiles'),
    ];
    const seen = new Set<string>();
    const resolved: string[] = [];
    for (const path of candidates) {
      if (typeof path !== 'string' || !path.trim() || seen.has(path)) continue;
      seen.add(path);
      resolved.push(path);
    }
    return resolved;
  }

  // ------------------------------------------------------------------
  // 抜粋（シグネチャ中心・決定的）
  // ------------------------------------------------------------------
  private signatureExcerpt(content: string, maxBytes: number, originalBytes: number): { text: string; truncated: boolean } {
    const lines = content.split('\n');
    const kept: string[] = [];
    lines.forEach((line, index) => {
      if (index < 12 || SIGNATURE_LINE.test(line)) kept.push(line);
    });
    let body = kept.join('\n');
    let truncated = true;
    if (byteLength(body) > maxBytes) {
      const cut: string[] = [];
      let used = 0;
      for (const line of kept) {
        const size = byteLength(line) + 1;
        if (used + size > maxBytes) break;
        cut.push(line);
        used += size;
      }
      body = cut.join('\n');
    }
    const header = [
      '/*',
      ' * [MIKI 部品供給パッケージ抜粋] このファイルは大きいため、シグネチャ中心の抜粋です。',
      ` * 元サイズ: ${originalBytes} bytes / 抜粋後: ${byteLength(body)} bytes`,
      ' * 実装の詳細が必要な場合は、抜粋に無い部分を推測で補わず、その旨を supply_reply.json の notes に書いてください。',
      ' */',
    ].join('\n');
    return { text: `${header}\n${body}`, truncated };
  }

  // ------------------------------------------------------------------
  // 欲しい部品（wantedComponents）の構造化
  // ------------------------------------------------------------------
  private normalizeNamedTypes(values: unknown): Array<{ name: string; type: string }> {
    if (!Array.isArray(values)) return [];
    const result: Array<{ name: string; type: string }> = [];
    for (const value of values) {
      if (typeof value === 'string') {
        const [name, ...rest] = value.split(':');
        result.push({ name: name.trim(), type: rest.join(':').trim() || 'unknown' });
      } else if (value && typeof value === 'object') {
        const item = value as Record<string, unknown>;
        const name = typeof item.name === 'string' ? item.name : '';
        if (!name) continue;
        result.push({ name, type: typeof item.type === 'string' ? item.type : 'unknown' });
      }
    }
    return result;
  }

  private stringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
      : [];
  }

  private parseConstructionGap(raw: string): { kind: string; id: string } {
    const body = raw.startsWith('CONSTRUCTION_GAP:') ? raw.slice('CONSTRUCTION_GAP:'.length) : raw;
    const [kind, id] = body.split(':');
    return { kind: kind || 'UNKNOWN_GAP', id: id || '' };
  }

  // ------------------------------------------------------------------
  // 要求パッケージ生成（本体）
  // ------------------------------------------------------------------
  public async createPackage(runId: string): Promise<ComponentSupplyCreateResult> {
    const run = improvementIntakeRouterService.get(runId);
    if (!run) {
      return { ok: false, code: 'RUN_NOT_FOUND', message: `受付Runが見つかりません: ${runId}` };
    }
    const gap = this.findGap(run);
    if (!gap) {
      return {
        ok: false,
        code: 'GAP_NOT_FOUND',
        message: 'この Run には候補生成の不足記録（candidateGenerationGap）がありません。部品供給パッケージは、生成段が部品不足で止まった Run からだけ作成できます。',
      };
    }

    const targetPaths = this.resolveTargetPaths(run, gap);
    if (targetPaths.length === 0) {
      return { ok: false, code: 'NO_TARGET_FILES', message: '対象ファイルが特定できません（不足記録・計画・payload のいずれにも対象がありません）。' };
    }

    // v1 は既存ファイルのみ: 自己コード空間に実在し、内容を解決できる
    // ファイルだけを対象にする。解決できない対象は理由付きで弾く。
    const targetContents = new Map<string, string>();
    const missing: string[] = [];
    const manifestPaths = new Set((selfCodeSpaceService.getLightManifest()?.files ?? []).map((file) => file.path));
    for (const path of targetPaths) {
      const held = selfCodeSpaceService.readFile(path);
      if (held && typeof held.content === 'string') {
        targetContents.set(path, held.content);
        continue;
      }
      if (manifestPaths.has(path)) {
        const fetched = await selfCodeSpaceService.ensureFileContents([path]);
        const content = fetched.get(path);
        if (typeof content === 'string') {
          targetContents.set(path, content);
          continue;
        }
        missing.push(`${path}（自己コード空間に存在しますが、内容を取得できませんでした）`);
        continue;
      }
      missing.push(`${path}（自己コード空間に存在しないファイルです）`);
    }
    if (missing.length > 0) {
      return {
        ok: false,
        code: 'TARGET_FILE_NOT_FOUND',
        message: '部品供給パッケージ v1 の対象は既存ファイルのみです。新規ファイルや未同期のファイルを含む Run からは作成できません。',
        reasons: missing,
      };
    }

    // 自己コード索引: 期待インターフェースと関連ファイルの材料。
    const understanding = selfCodeUnderstandingService.ensure(targetPaths, selfCodeSpaceService.listSourceFiles());
    const snapshot = selfCodeUnderstandingService.getSnapshot();
    const entriesByPath = new Map((snapshot?.entries ?? []).map((entry) => [entry.path, entry]));

    // ---- 文脈の組み立て ----
    const contextEntries: ContextEntry[] = [];
    const baseName = (path: string) => path.split('/').pop() || 'file';
    const safeName = (path: string) => baseName(path).replace(/[^\w.\-]+/g, '_');
    let targetBytes = 0;
    targetPaths.forEach((path, index) => {
      const content = targetContents.get(path)!;
      const originalBytes = byteLength(content);
      if (originalBytes <= TARGET_FULL_LIMIT_BYTES) {
        contextEntries.push({
          name: `context/target_${index + 1}_${safeName(path)}`,
          path, kind: 'TARGET_FULL', content, truncated: false,
          originalBytes, includedBytes: originalBytes, sha256: sha256HexFromText(content),
        });
        targetBytes += originalBytes;
      } else {
        const excerpt = this.signatureExcerpt(content, TARGET_EXCERPT_LIMIT_BYTES, originalBytes);
        contextEntries.push({
          name: `context/target_${index + 1}_${safeName(path)}`,
          path, kind: 'TARGET_EXCERPT', content: excerpt.text, truncated: true,
          originalBytes, includedBytes: byteLength(excerpt.text), sha256: sha256HexFromText(excerpt.text),
        });
        targetBytes += byteLength(excerpt.text);
      }
    });
    if (targetBytes > CONTEXT_BUDGET_BYTES) {
      return {
        ok: false,
        code: 'CONTEXT_TOO_LARGE',
        message: `対象ファイルの文脈だけで上限（約${Math.round(CONTEXT_BUDGET_BYTES / 1024)}KB）を超えました。黙って切り捨てず、作成を中止します。対象を絞ってから再実行してください。`,
        reasons: contextEntries.map((entry) => `${entry.path}: ${entry.includedBytes} bytes`),
      };
    }

    const omittedRelatedPaths: string[] = [];
    let relatedBytes = 0;
    let relatedIndex = 0;
    for (const relatedPath of understanding.relatedPaths) {
      if (targetContents.has(relatedPath)) continue;
      const held = selfCodeSpaceService.readFile(relatedPath);
      if (!held || typeof held.content !== 'string') {
        omittedRelatedPaths.push(relatedPath);
        continue;
      }
      const excerpt = this.signatureExcerpt(held.content, RELATED_EXCERPT_LIMIT_BYTES, byteLength(held.content));
      const excerptBytes = byteLength(excerpt.text);
      if (relatedBytes + excerptBytes > Math.min(RELATED_TOTAL_LIMIT_BYTES, CONTEXT_BUDGET_BYTES - targetBytes)) {
        omittedRelatedPaths.push(relatedPath);
        continue;
      }
      relatedIndex += 1;
      relatedBytes += excerptBytes;
      contextEntries.push({
        name: `context/related_${relatedIndex}_${safeName(relatedPath)}`,
        path: relatedPath, kind: 'RELATED_EXCERPT', content: excerpt.text, truncated: true,
        originalBytes: byteLength(held.content), includedBytes: excerptBytes, sha256: sha256HexFromText(excerpt.text),
      });
    }

    // ---- 制約（run.payload と計画から） ----
    const constraints = {
      requirements: this.payloadStrings(run, 'requirements'),
      prohibitions: this.payloadStrings(run, 'prohibitions'),
      invariants: this.payloadStrings(run, 'invariants'),
      validationRequirements: this.payloadStrings(run, 'validationRequirements'),
      deliveryRequirements: this.payloadStrings(run, 'deliveryRequirements'),
      forbiddenExpansion: run.implementationPlan?.forbiddenExpansion ?? [],
    };

    // ---- gapSummary ----
    const constructionGaps = Array.isArray(gap.constructionGaps) ? gap.constructionGaps : [];
    const unknownQuestions = Array.isArray(gap.unknownQuestions) ? gap.unknownQuestions : [];
    const gapSummary = {
      reason: gap.reason || 'CODE_COMPOSITION_PLAN_UNAVAILABLE',
      synthesisGapReason: gap.synthesisGapReason || '',
      blockedReason: gap.blockedReason || '',
      constructionGaps,
      unknownQuestions,
      summary: [
        `改善目的: ${run.objective}`,
        gap.synthesisGapReason ? `合成が止まった理由: ${gap.synthesisGapReason}` : '',
        constructionGaps.length ? `不足の内訳: ${constructionGaps.join(' / ')}` : '',
        unknownQuestions.length ? `未解決の問い: ${unknownQuestions.join(' / ')}` : '',
        'MIKI 自身のコード生成では上記の部品が揃わず、候補を作成できませんでした。その部品の素材供給を依頼します。',
      ].filter(Boolean).join('\n'),
    };

    // P434: P433で不足記録に載るようになった「作るべき部品の仕様」
    // を、仕様がある場合だけ供給パッケージへ載せる。仕様が無ければ
    // 何も足さない（従来どおり）。名前・対象ファイルが無い仕様は
    // 載せない（推測で補わない）。仕様が持つのは名前・対象ファイル・
    // 期待する入力種別・期待する振る舞いまでであり、出力や前提／
    // 事後条件は仕様に無いので足さない。
    const missingComponentSpecs = (Array.isArray(gap.missingComponentSpecs) ? gap.missingComponentSpecs : [])
      .filter((spec) =>
        Boolean(spec) && typeof spec.name === 'string' && Boolean(spec.name.trim()) &&
        typeof spec.targetPath === 'string' && Boolean(spec.targetPath.trim()))
      .map((spec) => ({
        name: (spec.name as string).trim(),
        targetPath: (spec.targetPath as string).trim(),
        inputKinds: this.stringList(spec.inputKinds),
        expectedBehavior: typeof spec.expectedBehavior === 'string' ? spec.expectedBehavior : '',
        source: typeof spec.source === 'string' ? spec.source : '',
        ...(typeof spec.knowledgeId === 'string' && spec.knowledgeId ? { knowledgeId: spec.knowledgeId } : {}),
        ...(typeof spec.slotName === 'string' && spec.slotName ? { slotName: spec.slotName } : {}),
        ...(typeof spec.missingComponentId === 'string' && spec.missingComponentId ? { missingComponentId: spec.missingComponentId } : {}),
      }));

    // ---- wantedComponents ----
    // P421: 不足記録に契約欄があれば、それを期待インターフェースの
    // 正とする（不足発生時点の確定値であり、対象ファイルがその後に
    // 変わっていても要求は不足時点の契約で出す）。契約欄が無い
    // 対象・部品については、従来どおり索引／レジストリから再構成する。
    const contractTargets = new Map<string, CandidateGenerationGapContractTargetRecord>();
    for (const target of gap.contract?.targets ?? []) {
      if (target && typeof target.path === 'string' && target.path) contractTargets.set(target.path, target);
    }
    const contractSlotFor = (id: string) =>
      (gap.contract?.missingSlots ?? []).find((slot) => slot && slot.knowledgeId === id);
    const wantedComponents: Array<Record<string, unknown>> = [];
    for (const rawGap of constructionGaps) {
      const { kind, id } = this.parseConstructionGap(rawGap);
      if (!id || (kind !== 'CODE_COMPONENT_MISSING' && kind !== 'CONSTRUCTION_DEFINITION_MISSING' && kind !== 'CODE_COMPONENT_UNLINKED')) continue;
      const registered = componentRegistryService.getComponent(id) as Record<string, unknown> | undefined;
      const registeredInputs = this.normalizeNamedTypes(registered?.inputs);
      // レジストリに入力情報が無い部品については、契約欄のスロット
      // 期待（不足時点で確定した期待入力種別）で補う。
      const slot = registeredInputs.length === 0 ? contractSlotFor(id) : undefined;
      const missingInputs = slot
        ? this.stringList(slot.inputKinds).map((inputKind) => ({
            name: typeof slot.slotName === 'string' && slot.slotName ? slot.slotName : 'input',
            type: inputKind,
          }))
        : [];
      wantedComponents.push({
        componentKey: `${kind}:${id}`,
        kind,
        componentId: id,
        targetPath: targetPaths[0] ?? '',
        purpose: (typeof registered?.purpose === 'string' && registered.purpose) || `未解決の部品 ${id} の実装素材`,
        implementationApproach: gapSummary.summary,
        expectedInterface: {
          inputs: registeredInputs.length > 0 ? registeredInputs : missingInputs,
          outputs: this.normalizeNamedTypes(registered?.outputs),
          entryPoint: typeof registered?.entry_point === 'string' ? registered.entry_point : (typeof registered?.entryPoint === 'string' ? registered.entryPoint : ''),
          exports: this.stringList(registered?.exports),
          publicInterfaces: this.stringList(registered?.public_interfaces ?? registered?.publicInterfaces),
        },
        dependencies: this.stringList(registered?.dependencies),
        constraints: [...constraints.prohibitions, ...constraints.invariants],
        testClues: constraints.validationRequirements,
      });
    }
    for (const path of targetPaths) {
      const entry = entriesByPath.get(path);
      // P421: 契約欄に対象の記録があれば、その公開面（不足発生時点の
      // 確定値）を優先する。無ければ索引の現在の項目から再構成する。
      const contractTarget = contractTargets.get(path);
      const surfaceSymbols: Array<{ name: string; parameters: string[]; returnType?: string }> = contractTarget
        ? (contractTarget.signatures ?? [])
            .filter((signature) => signature && typeof signature.name === 'string')
            .map((signature) => ({
              name: signature.name as string,
              parameters: this.stringList(signature.parameters),
              returnType: typeof signature.returnType === 'string' ? signature.returnType : undefined,
            }))
        : (entry?.symbols ?? [])
            .filter((symbol) => symbol.exported)
            .map((symbol) => ({ name: symbol.name, parameters: symbol.parameters ?? [], returnType: symbol.returnType }));
      const surfaceExports = contractTarget ? this.stringList(contractTarget.exports) : (entry?.exports ?? []);
      const surfaceImports = contractTarget ? this.stringList(contractTarget.imports) : (entry?.imports ?? []);
      const inputs: Array<{ name: string; type: string }> = [];
      const outputs: Array<{ name: string; type: string }> = [];
      for (const symbol of surfaceSymbols) {
        for (const parameter of symbol.parameters ?? []) {
          const [name, ...rest] = String(parameter).split(':');
          const item = { name: name.trim(), type: rest.join(':').trim() || 'unknown' };
          if (item.name && !inputs.some((x) => x.name === item.name)) inputs.push(item);
        }
        if (symbol.returnType) {
          const item = { name: `${symbol.name}()`, type: symbol.returnType };
          if (!outputs.some((x) => x.name === item.name)) outputs.push(item);
        }
      }
      wantedComponents.push({
        componentKey: `TARGET:${path}`,
        kind: 'TARGET_FILE_COMPLETION',
        targetPath: path,
        purpose: `対象ファイル ${path} の不足部分を補う実装素材（不足の詳細は gapSummary を参照）`,
        implementationApproach: gapSummary.summary,
        expectedInterface: {
          inputs,
          outputs,
          entryPoint: surfaceSymbols[0]?.name ?? '',
          exports: surfaceExports,
          publicInterfaces: surfaceExports,
        },
        dependencies: surfaceImports,
        constraints: [...constraints.prohibitions, ...constraints.invariants],
        testClues: constraints.validationRequirements,
      });
    }

    // ---- 要求本体 ----
    const issuedAt = Date.now();
    this.sequence += 1;
    const requestId = `SUP-REQ-${issuedAt}-${String(this.sequence).padStart(3, '0')}`;
    const fileName = `MIKI_SUPPLY_REQUEST_${requestId}.zip.txt`;
    const supplyRequest = {
      formatVersion: 1,
      requestId,
      createdAt: new Date(issuedAt).toISOString(),
      origin: { taskId: run.taskId ?? '', runId: run.runId, taskGoal: run.objective },
      gapSummary,
      wantedComponents,
      ...(missingComponentSpecs.length > 0 ? { missingComponentSpecs } : {}),
      targetFiles: targetPaths.map((path) => ({
        path,
        baselineSha256: sha256HexFromText(targetContents.get(path)!),
        role: '既存ファイル。返却候補はこのファイルの完全な置き換え、または不足部分を補う実装として提出してください。',
      })),
      contextFiles: contextEntries.map((entry) => ({
        entry: entry.name, path: entry.path, kind: entry.kind,
        truncated: entry.truncated, originalBytes: entry.originalBytes, includedBytes: entry.includedBytes, sha256: entry.sha256,
      })),
      omittedRelatedPaths,
      constraints,
      replySpec: {
        format: 'ZIP ファイル 1 つで返却してください（ファイル名の目安: MIKI_SUPPLY_REPLY_' + requestId + '.zip）。',
        manifestFile: 'supply_reply.json（ZIP のルートに置くこと）',
        manifest: {
          formatVersion: 1,
          requestId,
          requestSha256: '受け取った要求 .zip.txt を Base64 復号した ZIP バイナリ全体の SHA-256（16進小文字）。改変検出のため必須です。',
          supplier: { name: '供給者名（例: ChatGPT / Claude / Muse）', model: 'モデル名（任意）', suppliedAt: 'ISO 8601 の日時' },
          candidates: [
            {
              path: '要求の targetFiles[].path のいずれか（それ以外は受け付けません）',
              file: 'files/<targetPath と同じ相対パス>（コード実体はこのファイルに置くこと）',
              purpose: 'この候補が何を実装するかの説明',
              inputs: [{ name: '入力名', type: '型' }],
              outputs: [{ name: '出力名', type: '型' }],
              prerequisites: ['前提条件'],
              dependencies: ['依存する既存モジュール等'],
              supportedEnvironments: ['想定環境'],
              entryPoint: '入口となる関数・クラス名',
              exports: ['公開する名前'],
              imports: ['使う import'],
              publicInterfaces: ['公開インターフェース'],
              tests: '必須・空不可。この部品が正しいことを MIKI がどう確かめればよいか（テストコード、または具体的な検証手順）。',
              validation: '必須・空不可。満たすべき検証要件と、その確認方法。',
            },
          ],
          notes: '供給者から MIKI への申し送り（任意）。抜粋で読めなかった部分の推測などがあればここに書くこと。',
        },
        rules: [
          'supply_reply.json の requestId は要求のものをそのまま返してください。',
          'supply_reply.json の requestSha256 には、受け取った要求 ZIP（Base64 復号後）の SHA-256 を入れてください。',
          'candidates[].path は要求の targetFiles のいずれかでなければなりません。',
          'candidates[].tests と candidates[].validation は必須です（空文字は受け付けません）。',
          '新規ファイルは作らないでください（v1 の前提）。対象ファイル以外は変更しないでください。',
          '新しい外部依存（npm パッケージ等）を追加しないでください。',
          '詳細な手順は同梱の INSTRUCTIONS.md に従ってください。',
        ],
      },
      provenance: {
        issuedBy: 'MIKI',
        appVersion: storageService.getItem('miki_app_version') || (typeof process !== 'undefined' ? process.env.npm_package_version : '') || 'unknown',
        sourceSnapshotSha256: typeof run.payload?.sourceSnapshotSha256 === 'string' ? run.payload.sourceSnapshotSha256 : '',
        generator: 'componentSupplyRequestService (P419)',
      },
    };

    const instructions = this.buildInstructions(supplyRequest);

    // ---- 送出前プライバシー検査（検出したら止める） ----
    // P430: パート別（要求本体／手順書／文脈ファイルごと）に監査する。
    // 検出パターンはいずれも改行を跨がないため、パート別監査の検出は
    // 従来の結合監査（'\n' 区切り）と等価である。遮断時は理由に
    // 「パート名＋違反の種類＋伏せた断片（先頭最大3文字＋***）」を残し、
    // 値そのものは理由にも出さない。
    const auditParts: Array<{ name: string; text: string }> = [
      { name: 'supply_request.json', text: JSON.stringify(supplyRequest, null, 2) },
      { name: 'INSTRUCTIONS.md', text: instructions },
      ...contextEntries.map((entry) => ({ name: entry.name, text: entry.content })),
    ];
    const privacyReasons: string[] = [];
    const privacyMessages: string[] = [];
    for (const part of auditParts) {
      const audit = privacyGuardrailService.auditOutboundContent(part.text, 'component_supply_package', { autoSanitize: false });
      if (audit.allowed) continue;
      for (const violation of audit.violations) {
        const violationMessage = String(violation?.message || '');
        if (violationMessage && !privacyMessages.includes(violationMessage)) privacyMessages.push(violationMessage);
        const masked = `${String(violation?.snippet ?? '').slice(0, 3)}***`;
        privacyReasons.push(`${part.name}: ${violationMessage}（${masked}）`);
      }
    }
    if (privacyReasons.length > 0) {
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
    try {
      const zip = new JSZip();
      const filesForSums: Array<{ name: string; content: string }> = [
        { name: 'supply_request.json', content: JSON.stringify(supplyRequest, null, 2) },
        { name: 'INSTRUCTIONS.md', content: instructions },
        ...contextEntries.map((entry) => ({ name: entry.name, content: entry.content })),
      ];
      for (const file of filesForSums) zip.file(file.name, file.content);
      sumsText = filesForSums.map((file) => `${sha256HexFromText(file.content)}  ${file.name}`).join('\n') + '\n';
      zip.file('SHA256SUMS.txt', sumsText);
      zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    } catch (error) {
      return { ok: false, code: 'ZIP_BUILD_FAILED', message: `要求パッケージの ZIP 生成に失敗しました: ${error instanceof Error ? error.message : String(error)}` };
    }

    const base64 = this.toBase64(zipBytes);
    if (base64.length > MAX_PACKAGE_TEXT_CHARS) {
      return {
        ok: false,
        code: 'PACKAGE_TOO_LARGE',
        message: `パッケージが送出上限を超えました（Base64 ${base64.length} 字 / 上限 ${MAX_PACKAGE_TEXT_CHARS} 字）。対象を絞ってから再実行してください。`,
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
      if (!check.file('supply_request.json') || !check.file('INSTRUCTIONS.md')) throw new Error('required entry missing');
    } catch (error) {
      return { ok: false, code: 'ZIP_VERIFY_FAILED', message: `生成したパッケージの読み戻し検証に失敗しました: ${error instanceof Error ? error.message : String(error)}` };
    }

    // ---- 台帳へ ISSUED で記録 ----
    const record: ComponentSupplyLedgerRecord = {
      requestId,
      runId: run.runId,
      taskId: run.taskId,
      objective: run.objective,
      status: 'ISSUED',
      issuedAt,
      updatedAt: issuedAt,
      fileName,
      zipSha256,
      zipSizeBytes: zipBytes.length,
      base64Length: base64.length,
      targetFiles: supplyRequest.targetFiles.map((file) => ({ path: file.path, baselineSha256: file.baselineSha256 })),
      gapReason: gapSummary.reason,
    };
    this.ledger.set(requestId, record);
    this.save();

    const artifact: ComponentSupplyArtifact = {
      ...this.clone(record),
      base64,
      entries: [
        { name: 'supply_request.json', sha256: sha256HexFromText(JSON.stringify(supplyRequest, null, 2)), sizeBytes: byteLength(JSON.stringify(supplyRequest, null, 2)) },
        { name: 'INSTRUCTIONS.md', sha256: sha256HexFromText(instructions), sizeBytes: byteLength(instructions) },
        ...contextEntries.map((entry) => ({ name: entry.name, sha256: entry.sha256, sizeBytes: entry.includedBytes })),
        { name: 'SHA256SUMS.txt', sha256: sha256HexFromText(sumsText), sizeBytes: byteLength(sumsText) },
      ],
    };
    return {
      ok: true,
      code: 'SUCCESS',
      message: `部品供給パッケージを作成しました（要求ID: ${requestId}）。`,
      artifact,
    };
  }

  /** Downloads への保存（ネイティブ経路のみ。Blob 方式は実機不達のため使わない）。 */
  public async savePackageToDownloads(artifact: ComponentSupplyArtifact): Promise<boolean> {
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

  private buildInstructions(supplyRequest: Record<string, unknown>): string {
    const origin = supplyRequest.origin as { taskGoal: string };
    const gapSummary = supplyRequest.gapSummary as { summary: string };
    const constraints = supplyRequest.constraints as {
      prohibitions: string[]; invariants: string[]; validationRequirements: string[];
    };
    const targetFiles = supplyRequest.targetFiles as Array<{ path: string }>;
    const listOr = (items: string[], fallback: string) => (items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${fallback}`);
    // P434: 仕様がある場合だけ、手順書にも「作るべき部品の仕様」を載せる。
    // 仕様が無ければ何も足さない。
    const missingSpecs = (supplyRequest.missingComponentSpecs as Array<{ name: string; targetPath: string; inputKinds: string[]; expectedBehavior: string }> | undefined) ?? [];
    const missingSpecLines = missingSpecs.length > 0
      ? [
          '',
          '## 作るべき部品の仕様（不足部品）',
          '',
          'MIKI の生成段が「どういう部品がないか」を名前付きで特定したものです。この仕様に沿う部品の素材を優先してください。詳細は supply_request.json の missingComponentSpecs を読んでください。',
          ...missingSpecs.map((spec) => `- ${spec.name}（対象: ${spec.targetPath}）${Array.isArray(spec.inputKinds) && spec.inputKinds.length ? ` / 期待する入力: ${spec.inputKinds.join(', ')}` : ''}${typeof spec.expectedBehavior === 'string' && spec.expectedBehavior ? ` / 期待する振る舞い: ${spec.expectedBehavior}` : ''}`),
        ]
      : [];
    return [
      '# MIKI 部品供給リクエストへの回答方法',
      '',
      'あなたは、スマートフォンアプリ「MIKI」の自己コード改善に対して、**部品の素材を供給する**役割です。',
      '完成品の納品ではありません。供給された素材は MIKI 側で分解・検証され、検証を通らない部品は使われません。',
      'その前提で、検証しやすい形で素材を返してください。',
      '',
      '## このファイルの開き方',
      '',
      '受け取ったファイル（.zip.txt の中身）は Base64 文字列です。まず Base64 復号して ZIP として開いてください。',
      'ZIP の中身:',
      '- supply_request.json … 機械可読な要求本体（不足の内訳、欲しい部品、対象ファイル、制約、返却形式）',
      '- INSTRUCTIONS.md … この文書',
      '- context/ … 対象ファイルの現在内容（全文。大きい場合は抜粋で、その旨がファイル冒頭と supply_request.json の contextFiles に明記されています）と関連ファイルの抜粋',
      '- SHA256SUMS.txt … 同梱ファイルの SHA-256 一覧',
      '',
      '## 何を作るか',
      '',
      `改善目的: ${origin.taskGoal}`,
      '',
      gapSummary.summary,
      '',
      '詳細は supply_request.json の gapSummary / wantedComponents を読んでください。',
      'wantedComponents の expectedInterface（inputs / outputs / entryPoint / exports）が、部品に期待する契約です。',
      ...missingSpecLines,
      '',
      '## 返し方',
      '',
      'ZIP ファイル 1 つで返却してください。中身:',
      '- supply_reply.json（ZIP のルート）',
      '- files/<対象ファイルと同じ相対パス> … コード実体',
      '',
      'supply_reply.json の形式は supply_request.json の replySpec.manifest と同じです。必須事項:',
      `- requestId は要求のもの（${supplyRequest.requestId}）をそのまま返すこと`,
      '- requestSha256 には、受け取った要求 ZIP（Base64 復号後バイナリ）の SHA-256（16進小文字）を入れること',
      `- candidates[].path は次のいずれかであること: ${targetFiles.map((file) => file.path).join(' / ')}`,
      '- candidates[].tests と candidates[].validation は必須です。空にはしないでください。「この部品が正しいことを MIKI がどう確かめればよいか」を具体的に書いてください（テストコードでも、検証手順の記述でも構いません）',
      '- 供給者名（supplier.name。例: ChatGPT / Claude / Muse）と suppliedAt（ISO 8601）を入れること',
      '',
      '## 制約（必ず守ること）',
      '',
      '### 禁止事項',
      listOr(constraints.prohibitions, '特記事項なし（ただし下記の一般制約は守ること）'),
      '',
      '### 不変条件',
      listOr(constraints.invariants, '特記事項なし'),
      '',
      '### 検証要件',
      listOr(constraints.validationRequirements, '特記事項なし'),
      '',
      '### 一般制約',
      '- 対象ファイル以外は作らない・変えないでください。**新規ファイルは作らないでください**（今回の前提です）。',
      '- 新しい外部依存（npm パッケージ等）を追加しないでください。使えるのは既存の依存の範囲内です。',
      '- 既存コードの流儀（言語、モジュール形式、import の書き方、命名）を context の抜粋から読み取り、それに合わせてください。',
      '- 抜粋で読めなかった部分は推測で断定せず、その旨を supply_reply.json の notes に書いてください。',
      '',
    ].join('\n');
  }
}

export const componentSupplyRequestService = new ComponentSupplyRequestService();
