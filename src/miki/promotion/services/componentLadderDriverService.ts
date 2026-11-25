import ts from 'typescript';
import { componentRegistryService } from '../../capability/services/componentRegistryService';
import { componentArtifactStoreService } from '../../capability/services/componentArtifactStoreService';
import { componentPromotionService } from './componentPromotionService';
import { componentRegressionService, RegressionSuite } from '../../verification/services/componentRegressionService';
import { executionRunnerService } from '../../execution/services/executionRunnerService';
import { pureCodeExecutionService } from '../../selfDevelopment/services/pureCodeExecutionService';
import { drillTaskGenerationService, DRILL_BASE_PART_NAMES, type DrillExtraPart } from '../../selfDevelopment/services/drillTaskGenerationService';
import { codeDrillService } from '../../selfDevelopment/services/codeDrillService';
import { specDraftService } from '../../selfDevelopment/services/specDraftService';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';
import { systemLogger } from '../../../services/systemLogger';
import { ComponentStatus, ComponentTxtPackage } from '../../../types';

/**
 * P2013: 部品の正式な梯子（第9.3節）の運転手。
 *
 * ドリルで解題され CANDIDATE で積み上がった部品には、梯子を登らせる
 * 運転手がいなかった（供給部品には P921 の橋があるが、ドリル部品は
 * 対象外）。本サービスは既存の遷移とゲートだけを使い、候補を到達
 * 可能な段まで進める。
 *
 * 仕事の範囲:
 *  1. 復元: 登録簿に無い候補は、成果物 TXT 正本（第9.1節）から
 *     登録簿へ復元する。VM では永続化の都合で登録簿がセッション毎に
 *     痩せ、候補が成果物側にだけ残るため。端末では登録簿が永続する
 *     ので通常は無-op。
 *  2. 分析: 静的解析（TS パース・決定性・契約・ハッシュ照合）と
 *     登録済み受け入れケースの再実行を通った候補だけを、
 *     advanceComponentStatus で CANDIDATE → ANALYZED へ進める。
 *     P449（TVE の静的チェック→ANALYZED）と同じ物差し。
 *  3. 回帰: componentPromotionService.createGate で Suite を作り、
 *     実行 Runner として受け入れケースの再実行を内容に実行する。
 *     Suite のケース生成は既存機械（宣言＋補完）に従う。
 *  4. 判定: validateForLimited で ANALYZED → DEVICE_TESTED へ。
 *
 * やらないこと:
 *  - VERIFIED は絶対に与えない。正式昇格は Canary 実利用を通過した
 *    promoteIfSafeForCanary だけの担当で、実測証拠（実測10件・精度
 *    98%・決定性99%・訂正率2%以下）は端末側の実利用でしか貯まらない。
 *  - ゲート・遷移規則・ケース生成規則は変更しない。
 *
 * Suite の環境は部品が宣言する対応環境そのものを使う（ドリル部品は
 * LOCAL。供給部品の橋が EXTERNAL_RUNNER を使うのと同じ作法で、
 * 部品の宣言に合わせる）。環境の対応チェック自体は従来どおり
 * ExecutionRunner が行う。
 *
 * P2014: 式の課題の文脈つき再生成。
 * P2002 以降、式の課題生成はセッション開始時点の登録部品スナップ
 * ショット（extraParts）に依存する。文脈なしで再生成すると乱数消費が
 * ずれて別課題に化け、文脈依存候補が全件 TASK_TITLE_MISMATCH /
 * ANALYSIS_FAILED で落ちていた（第2回運転: 25件全件）。そこで式の課題は
 * 次の順に再生成を試し、タイトル（PURPOSE とドリル台帳の両方に一致）と
 * 全ケース通過が揃った文脈だけをその候補の検証として採用する:
 *  1. 文脈なし（初期化順バグ時代のセッションは実際に材料なしで生成
 *     されており、従来どおりこれで検証できる）
 *  2. 記録された文脈（codeDrillService に残された、そのセッションの
 *     実スナップショットを成果物正本から解決したもの）
 *  3. 復元した文脈（成果物索引の蓄積開始時点からセッション開始までの
 *     登録部品。VM 側の機械チェック promotion_precheck が実測で
 *     再現を確認したモデルと同じ物差し）
 * どの文脈でも揃わなければ、文脈なし再生成の結果で従来どおりの理由を
 * 付けて止める。文脈は「材料の追加」であって「判定の緩和」ではない:
 * 照合は台帳タイトル照合ぶん従来より厳しくなり、採用された文脈でも
 * ケースの全件通過が必須であることに変わりはない。
 */

const RUNNER_ID = 'component-ladder-driver';

/*
 * P2014: 成果物索引の蓄積開始時点（2026-11-23T15:26:49.323Z、autoPart47581_0
 * の saved_at）。初期化順修正の検証時に索引が再構築され、この登録以降の分が
 * セッションから見える集合として蓄積され始めた。これより前のセッションは
 * 初期化順バグで材料が常に見えず（文脈なし生成）、これ以降のセッションの
 * スナップショットは [この時点, セッション開始) の登録部品と一致する
 * （VM 側の機械チェック promotion_precheck が保留63件の切り分けで実測
 * 確認したモデル。本ドライバーも同じ物差しで復元する）。
 */
const ARTIFACT_INDEX_EPOCH_MS = 1795447609323;

export interface LadderArtifactRef {
  version: string;
  implementationHash: string;
}

export interface LadderCaseResult {
  testCaseId: string;
  category: string;
  requestStatus: string;
  assertionStatus?: string;
  detail?: string;
}

export interface LadderDriveResult {
  componentId: string;
  entryPoint?: string;
  restored: boolean;
  previousStatus?: ComponentStatus;
  finalStatus?: ComponentStatus;
  analysis?: {
    parseOk: boolean;
    deterministic: boolean;
    contractOk: boolean;
    hashOk: boolean;
    acceptancePassed?: number;
    acceptanceTotal?: number;
  };
  suiteId?: string;
  suiteStatus?: string;
  cases: LadderCaseResult[];
  gateAccepted?: boolean;
  /** P2014: 受け入れケースの再生成が採用した文脈（式の課題のみ） */
  contextSource?: 'none' | 'recorded' | 'reconstructed';
  /** 到達した段（最終状態と同じ。止まった場合は止まった理由が reason に入る） */
  reached: string;
  reason: string;
}

interface AcceptanceCase {
  args: number[];
  expected: number;
  tolerance?: number;
}

type ContextSource = 'none' | 'recorded' | 'reconstructed';

/** P2014: 成果物正本から取り出した部品の記録（文脈復元の材料）。 */
interface ArtifactPartRecord {
  name: string;
  content: string;
  saved_at: number;
  seed?: number;
  component_id: string;
}

/**
 * P2014: 1つの文脈での再生成の試行結果。pass は「タイトル照合（PURPOSE と
 * 台帳の両方）と全ケース通過が揃った」ことを指す。title / no-task は文脈が
 * 違えば起こりうる段階で、exec はタイトルは合ったが候補の実物がケースを
 * 通せなかった段階（候補側の問題なので、文脈を変えても採用しない）。
 */
type RegenAttempt =
  | { stage: 'pass'; cases: AcceptanceCase[]; expression?: string }
  | { stage: 'no-task' }
  | { stage: 'title' }
  | { stage: 'exec'; cases: AcceptanceCase[]; expression?: string };

class ComponentLadderDriverService {
  private static instance: ComponentLadderDriverService;
  private constructor() {}
  public static getInstance(): ComponentLadderDriverService {
    if (!this.instance) this.instance = new ComponentLadderDriverService();
    return this.instance;
  }

  /**
   * 成果物 TXT 正本から登録簿へ復元する。登録簿は実行時状態で、
   * 正本は TXT（第9.1節）という既存の役割分担に基づく復旧で、
   * 状態は正本の記録どおり CANDIDATE から始まる。
   * 復元する package の形は、ドリル登録の正本である
   * reusableComponentFactoryService.createCodeComponentCandidate が
   * P1103 の登録で作る形に合わせる。
   */
  public restoreFromArtifact(
    componentId: string,
    ref: LadderArtifactRef,
  ): { ok: boolean; reason: string; component?: ComponentTxtPackage } {
    const existing = componentRegistryService.getComponent(componentId);
    if (existing) return { ok: true, reason: 'ALREADY_IN_REGISTRY', component: existing };
    const snapshotKey = `miki_component_artifact_v2:${encodeURIComponent(componentId)}@${encodeURIComponent(ref.version)}#${encodeURIComponent(ref.implementationHash)}`;
    const record = componentArtifactStoreService.getBySnapshotKey(snapshotKey);
    if (!record) return { ok: false, reason: 'ARTIFACT_NOT_FOUND' };
    if (canonicalSha256(record.implementation_txt) !== record.implementation_hash) {
      return { ok: false, reason: 'ARTIFACT_HASH_MISMATCH' };
    }
    const parsed = ComponentLadderDriverService.parsePartRecord(record.component_txt, record.implementation_txt);
    if (!parsed) return { ok: false, reason: 'NOT_A_PART_FILE' };
    if (!/STATUS:\s*CANDIDATE/.test(record.component_txt)) return { ok: false, reason: 'NOT_A_CANDIDATE' };
    const fn = pureCodeExecutionService.compileFunction(parsed.content, parsed.name);
    if (!fn) return { ok: false, reason: 'COMPILE_FAILED' };
    const arity = Math.max(1, fn.length);
    const pkg: ComponentTxtPackage = {
      component_id: record.component_id,
      version: record.version,
      status: 'CANDIDATE',
      purpose: parsed.purpose,
      inputs: new Array(arity).fill('number'),
      outputs: ['number'],
      preconditions: [],
      postconditions: [],
      side_effects: [],
      dependencies: [],
      supported_environments: ['LOCAL'],
      entry_point: parsed.name,
      failure_behavior: 'RETURN_BLOCKED_RESULT',
      security_class: 'STANDARD',
      idempotent: false,
      deterministic: true,
      component_txt: record.component_txt,
      implementation_txt: record.implementation_txt,
      tests_txt: record.tests_txt,
      validation_txt: record.validation_txt,
      implementation_hash: record.implementation_hash,
      validation_hash: record.validation_hash,
      test_count: 1,
      validation_count: 1,
      success_count: 0,
      failure_count: 0,
      created_at: record.saved_at,
      updated_at: record.saved_at,
      source_episode_ids: [],
      source_learning_artifact_ids: [],
      componentKind: 'CODE',
      componentType: 'FUNCTION',
      exports: [parsed.name],
      imports: [],
      publicInterfaces: [],
      coreIngressPoints: [],
      domainOwnership: ['selfDevelopment'],
      persistenceKeys: [],
      uiEventEntrypoints: [],
    };
    componentRegistryService.registerComponent(pkg);
    return { ok: true, reason: 'RESTORED', component: pkg };
  }

  /** compositionDrillService.parseArtifactPart と同じ物差しで部品を取り出す。 */
  private static parsePartRecord(
    componentTxt: string,
    implementationTxt: string,
  ): { name: string; content: string; purpose: string } | null {
    const entry = /ENTRY_POINT:\s*([A-Za-z0-9_]+)/.exec(componentTxt)?.[1];
    const target = /TARGET_PATH:\s*([^\s\\]+)/.exec(componentTxt)?.[1];
    const purpose = /PURPOSE:\s*([^\n\\]+)/.exec(componentTxt)?.[1]?.trim() ?? '';
    if (!entry || !target) return null;
    if (target !== `src/miki/core/parts/${entry}Part.ts`) return null;
    const begin = implementationTxt.indexOf('FILE_CONTENT_BEGIN');
    const end = implementationTxt.indexOf('FILE_CONTENT_END');
    if (begin < 0 || end < 0 || end <= begin) return null;
    const content = implementationTxt
      .slice(begin + 'FILE_CONTENT_BEGIN'.length, end)
      .replace(/^(?:\s|\\n)+/, '')
      .replace(/(?:\s|\\n)+$/, '');
    return content ? { name: entry, content, purpose } : null;
  }

  private static extractContent(implementationTxt: string): string | null {
    const begin = implementationTxt.indexOf('FILE_CONTENT_BEGIN');
    const end = implementationTxt.indexOf('FILE_CONTENT_END');
    if (begin < 0 || end < 0 || end <= begin) return null;
    const content = implementationTxt
      .slice(begin + 'FILE_CONTENT_BEGIN'.length, end)
      .replace(/^(?:\s|\\n)+/, '')
      .replace(/(?:\s|\\n)+$/, '');
    return content || null;
  }

  // P2014: 文脈復元の材料（成果物正本の部品記録）のキャッシュ。
  // 索引の総数（現在＋履歴のマニフェスト数）が変わったら作り直す。
  private partRecordsCache: { signature: number; records: ArtifactPartRecord[] } | null = null;
  private arityCache = new Map<string, number>();

  /**
   * P2014: 成果物正本の全スナップショットから部品の記録を集める。
   * スナップショットキーで重複を除き、saved_at の昇順（同点は名前順）に
   * 並べる。機械チェック（promotion_precheck）が台帳ダンプを走査するのと
   * 同じ集合を、製品側では成果物ストアの索引から辿る。
   */
  private artifactPartRecords(): ArtifactPartRecord[] {
    const manifests = componentArtifactStoreService.getAllManifests();
    const all = [...manifests];
    for (const m of manifests) {
      for (const h of componentArtifactStoreService.getHistory(m.component_id)) all.push(h);
    }
    if (this.partRecordsCache && this.partRecordsCache.signature === all.length) {
      return this.partRecordsCache.records;
    }
    const seen = new Set<string>();
    const records: ArtifactPartRecord[] = [];
    for (const m of all) {
      if (seen.has(m.snapshot_key)) continue;
      seen.add(m.snapshot_key);
      const rec = componentArtifactStoreService.getBySnapshotKey(m.snapshot_key);
      if (!rec) continue;
      const parsed = ComponentLadderDriverService.parsePartRecord(rec.component_txt, rec.implementation_txt);
      if (!parsed) continue;
      const seedM = /^autoPart(\d+)_\d+$/.exec(parsed.name) ?? /^specShape(\d+)x\d+$/.exec(parsed.name);
      records.push({
        name: parsed.name,
        content: parsed.content,
        saved_at: rec.saved_at,
        seed: seedM ? Number(seedM[1]) : undefined,
        component_id: rec.component_id,
      });
    }
    records.sort((a, b) => (a.saved_at - b.saved_at) || a.name.localeCompare(b.name));
    this.partRecordsCache = { signature: all.length, records };
    return records;
  }

  /** 部品名ごとのセッション開始時刻（その seed の最古の登録時刻）。 */
  private sessionStartBySeed(records: ArtifactPartRecord[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const r of records) {
      if (r.seed === undefined) continue;
      const cur = map.get(r.seed);
      if (cur === undefined || r.saved_at < cur) map.set(r.seed, r.saved_at);
    }
    return map;
  }

  private compileArity(content: string, name: string): number {
    const key = `${name}:${content.length}:${content.slice(0, 48)}`;
    const hit = this.arityCache.get(key);
    if (hit !== undefined) return hit;
    let arity = 0;
    try {
      const fn = pureCodeExecutionService.compileFunction(content, name);
      if (fn && fn.length >= 1) arity = fn.length;
    } catch { arity = 0; }
    this.arityCache.set(key, arity);
    return arity;
  }

  /**
   * P2014: snapshotRegisteredParts + resolveExtraParts と同じ規則で材料を
   * 組む: 土台の語彙は除き、名前ごとに最初に compile できた記録を正とし、
   * 名前順に並べる。
   */
  private buildExtraParts(recs: ArtifactPartRecord[]): DrillExtraPart[] {
    const byName = new Map<string, ArtifactPartRecord>();
    for (const r of recs) {
      if (DRILL_BASE_PART_NAMES.has(r.name) || byName.has(r.name)) continue;
      if (this.compileArity(r.content, r.name) < 1) continue;
      byName.set(r.name, r);
    }
    const out: DrillExtraPart[] = [];
    for (const r of [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const fn = pureCodeExecutionService.compileFunction(r.content, r.name);
      if (fn) out.push({ name: r.name, arity: fn.length, fn: fn as (...a: number[]) => number });
    }
    return out;
  }

  /** 候補自身の成果物が保存された時刻（文脈記録との対応づけに使う）。 */
  private candidateSavedAt(component: ComponentTxtPackage): number {
    try {
      const rec = componentArtifactStoreService.get(component.component_id, component.version, component.implementation_hash);
      if (rec) return rec.saved_at;
      const manifest = componentArtifactStoreService.getManifest(component.component_id);
      if (manifest) return manifest.saved_at;
    } catch { /* 引けなければ登録時刻で代用する */ }
    return component.created_at;
  }

  /**
   * P2014: 記録された文脈。その候補のセッション（同じ seed で、候補の
   * 保存直後に記録されたもの）の実スナップショットを、成果物正本から
   * 解決する。1件でも解決できない名前があれば文脈として使わない
   * （生成の材料集合は厳密でなければならない）。
   */
  private recordedContextFor(seed: number, savedAt: number): DrillExtraPart[] | null {
    const rec = codeDrillService.getSessionContexts()
      .filter((c) => c.seed === seed && c.at >= savedAt && c.at - savedAt < 3600_000)
      .sort((a, b) => a.at - b.at)[0];
    if (!rec) return null;
    const records = this.artifactPartRecords();
    const out: DrillExtraPart[] = [];
    for (const item of rec.extraParts) {
      const src = records.find((p) => p.name === item.name);
      const fn = src ? pureCodeExecutionService.compileFunction(src.content, src.name) : null;
      if (!src || !fn) return null;
      out.push({ name: item.name, arity: fn.length, fn: fn as (...a: number[]) => number });
    }
    return out;
  }

  /**
   * P2014: 復元した文脈。[ARTIFACT_INDEX_EPOCH_MS, セッション開始) に
   * 登録された部品が、そのセッションのスナップショットと一致する
   * （機械チェックで実測確認済みのモデル）。
   */
  private reconstructedContextFor(seed: number): DrillExtraPart[] | null {
    const records = this.artifactPartRecords();
    const start = this.sessionStartBySeed(records).get(seed);
    if (start === undefined || start <= ARTIFACT_INDEX_EPOCH_MS) return null;
    return this.buildExtraParts(records.filter((p) => p.saved_at >= ARTIFACT_INDEX_EPOCH_MS && p.saved_at < start));
  }

  /**
   * P2014: 1つの文脈での受け入れケース再生成の試行。タイトルは部品の
   * PURPOSE とドリル台帳の両方と照合し（機械チェックと同じ物差し）、
   * 候補の実物が全ケースを通したときだけ pass とする。
   */
  private tryRegenerate(
    component: ComponentTxtPackage,
    content: string,
    seed: number,
    idx: number,
    extraParts?: DrillExtraPart[],
  ): RegenAttempt {
    const name = component.entry_point;
    const tasks = drillTaskGenerationService.generateTasks(seed, idx + 1, extraParts);
    const task = tasks[idx];
    if (!task || task.entryPoint !== name) return { stage: 'no-task' };
    if (!String(component.purpose).includes(task.title)) return { stage: 'title' };
    const ledgerTitle = codeDrillService.getRecord(`auto-${seed}-${idx}`)?.title;
    if (ledgerTitle !== undefined && ledgerTitle !== task.title) return { stage: 'title' };
    const cases: AcceptanceCase[] = task.cases.map((c) => ({ args: [...c.args], expected: c.expected as number }));
    const ev = pureCodeExecutionService.execute(content, name, cases);
    if (!ev.passed) return { stage: 'exec', cases, expression: task.generatingExpression };
    return { stage: 'pass', cases, expression: task.generatingExpression };
  }

  /**
   * 受け入れケースの復元。課題生成は seed 決定的なので、部品名に
   * 埋め込まれた seed から元の課題を再生成する（Phase 1 の機械
   * チェックと同じ物差し）。仕様課題は公差 0.02 をケースへ載せる。
   * 式の課題は P2014 の文脈つき再生成（文脈なし→記録→復元の順）で
   * 復元する。
   */
  private regenerateAcceptanceCases(component: ComponentTxtPackage): { cases: AcceptanceCase[]; expression?: string; contextSource?: ContextSource } | { error: string } {
    const name = component.entry_point;
    const exprM = /^autoPart(\d+)_(\d+)$/.exec(name);
    const specM = /^specShape(\d+)x(\d+)$/.exec(name);
    if (exprM) {
      const seed = Number(exprM[1]);
      const idx = Number(exprM[2]);
      const content = ComponentLadderDriverService.extractContent(component.implementation_txt);
      if (!content) return { error: 'FILE_CONTENT_NOT_FOUND' };
      let attempt = this.tryRegenerate(component, content, seed, idx, undefined);
      let contextSource: ContextSource = 'none';
      if (attempt.stage !== 'pass') {
        const recorded = this.recordedContextFor(seed, this.candidateSavedAt(component));
        if (recorded) {
          const o = this.tryRegenerate(component, content, seed, idx, recorded);
          if (o.stage === 'pass') { attempt = o; contextSource = 'recorded'; }
        }
      }
      if (attempt.stage !== 'pass') {
        const reconstructed = this.reconstructedContextFor(seed);
        if (reconstructed && reconstructed.length) {
          const o = this.tryRegenerate(component, content, seed, idx, reconstructed);
          if (o.stage === 'pass') { attempt = o; contextSource = 'reconstructed'; }
        }
      }
      if (attempt.stage === 'pass') {
        return { cases: attempt.cases, expression: attempt.expression, contextSource };
      }
      // どの文脈でも揃わなければ、文脈なし再生成の結果で従来どおり止める。
      const finalAttempt = attempt;
      if (finalAttempt.stage === 'no-task') return { error: 'TASK_REGEN_MISMATCH' };
      if (finalAttempt.stage === 'title') return { error: 'TASK_TITLE_MISMATCH' };
      // タイトルは一致したが実物がケースを通せなかった。ケース自体は
      // 復元できているので、判定は分析段の実行判定（ANALYSIS_FAILED）に
      // 従来どおり委ねる。
      return { cases: finalAttempt.cases, expression: finalAttempt.expression, contextSource: 'none' };
    }
    if (specM) {
      const seed = Number(specM[1]);
      const idx = Number(specM[2]);
      const tasks = drillTaskGenerationService.generateSpecTasks(seed, idx + 1);
      const task = tasks[idx];
      if (!task || task.name !== name) return { error: 'SPEC_REGEN_MISMATCH' };
      if (!String(component.purpose).includes(task.description)) return { error: 'SPEC_PURPOSE_MISMATCH' };
      const drafted = specDraftService.draftPointsFromDescription(task.description);
      if (!drafted) return { error: 'SPEC_POINTS_UNAVAILABLE' };
      const record = specDraftService.draftAndSolve({ name, description: task.description, points: drafted.points });
      if (!record) return { error: 'SPEC_DRAFT_FAILED' };
      if (record.discrimination !== 'STRONG') return { error: 'SPEC_WEAK_ON_REGEN' };
      return {
        cases: record.cases.map((c) => ({ args: [...c.args], expected: c.expected, tolerance: 0.02 })),
        expression: record.expression,
      };
    }
    return { error: 'NAME_UNRECOGNIZED' };
  }

  /** 静的解析。generatedComponentVerificationRegistrationService と同じ物差し。 */
  private staticAnalysis(content: string): { parseOk: boolean; deterministic: boolean } {
    const parsed = ts.createSourceFile('part.ts', content, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const diagnostics = ((parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics || []);
    const deterministic = !/Date\.now|Math\.random|fetch\(|XMLHttpRequest|eval\(/.test(content);
    return { parseOk: diagnostics.length === 0, deterministic };
  }

  /**
   * 候補を1件、到達可能な段まで登らせる。止まる場合は理由を返す。
   * VERIFIED には絶対に進めない（Canary と実測は端末側の仕事）。
   */
  public drive(componentId: string, ref?: LadderArtifactRef): LadderDriveResult {
    const result: LadderDriveResult = {
      componentId, restored: false, cases: [], reached: 'NONE', reason: '',
    };
    let component = componentRegistryService.getComponent(componentId);
    if (!component && ref) {
      const restored = this.restoreFromArtifact(componentId, ref);
      if (!restored.ok) {
        result.reason = `RESTORE_FAILED: ${restored.reason}`;
        return result;
      }
      result.restored = restored.reason === 'RESTORED';
      component = restored.component;
    }
    if (!component) {
      result.reason = 'COMPONENT_NOT_FOUND';
      return result;
    }
    result.entryPoint = component.entry_point;
    result.previousStatus = component.status;

    const content = ComponentLadderDriverService.extractContent(component.implementation_txt);
    if (!content) {
      result.reason = 'FILE_CONTENT_NOT_FOUND';
      result.finalStatus = component.status;
      return result;
    }
    const fn = pureCodeExecutionService.compileFunction(content, component.entry_point) as ((...args: number[]) => number) | null;
    if (!fn) {
      result.reason = 'COMPILE_FAILED';
      result.finalStatus = component.status;
      return result;
    }

    // --- 分析 (CANDIDATE → ANALYZED) ---
    if (component.status === 'CANDIDATE') {
      const regen = this.regenerateAcceptanceCases(component);
      if ('error' in regen) {
        result.reason = `ACCEPTANCE_REGEN_FAILED: ${regen.error}`;
        result.finalStatus = component.status;
        return result;
      }
      result.contextSource = regen.contextSource;
      const staticResult = this.staticAnalysis(content);
      const evidence = pureCodeExecutionService.execute(content, component.entry_point, regen.cases);
      const analysis = {
        parseOk: staticResult.parseOk,
        deterministic: staticResult.deterministic,
        contractOk: (component.inputs?.length ?? 0) > 0 && (component.outputs?.length ?? 0) > 0 && !!component.entry_point,
        hashOk: canonicalSha256(component.implementation_txt) === component.implementation_hash,
        acceptancePassed: evidence.passedCount,
        acceptanceTotal: evidence.total,
      };
      result.analysis = analysis;
      if (!analysis.parseOk || !analysis.deterministic || !analysis.contractOk || !analysis.hashOk || !evidence.passed) {
        result.reason = `ANALYSIS_FAILED: parse=${analysis.parseOk} deterministic=${analysis.deterministic} contract=${analysis.contractOk} hash=${analysis.hashOk} acceptance=${evidence.passedCount}/${evidence.total}`;
        result.finalStatus = component.status;
        return result;
      }
      const advanced = componentRegistryService.advanceComponentStatus(
        componentId,
        'ANALYZED',
        `[P2013 LadderDriver] 静的解析（パース・決定性・契約・ハッシュ照合）通過、受け入れケース再実行 ${evidence.passedCount}/${evidence.total} 全件通過（式: ${regen.expression ?? '不明'}）${regen.contextSource && regen.contextSource !== 'none' ? `（文脈: ${regen.contextSource}）` : ''}`,
      );
      if (!advanced.success) {
        result.reason = `ANALYZED_TRANSITION_FAILED: ${advanced.message}`;
        result.finalStatus = componentRegistryService.getComponent(componentId)?.status;
        return result;
      }
      component = componentRegistryService.getComponent(componentId)!;
      systemLogger.info('TOOLS', `🪜 [P2013 LadderDriver] ${componentId}: CANDIDATE -> ANALYZED (acceptance ${evidence.passedCount}/${evidence.total})`);
    }
    if (component.status !== 'ANALYZED') {
      result.reason = `NOT_DRIVABLE_STATUS: ${component.status}`;
      result.finalStatus = component.status;
      result.reached = component.status;
      return result;
    }

    // --- 回帰 Suite の作成と実行 ---
    const environment = (component.supported_environments || [])[0];
    if (!environment) {
      result.reason = 'NO_SUPPORTED_ENVIRONMENT';
      result.finalStatus = component.status;
      return result;
    }
    const suite = componentPromotionService.createGate(componentId, environment as RegressionSuite['environment']);
    if (!suite) {
      result.reason = 'GATE_UNAVAILABLE';
      result.finalStatus = component.status;
      return result;
    }
    result.suiteId = suite.suite_id;
    const regen = this.regenerateAcceptanceCases(component);
    const cases: AcceptanceCase[] = 'cases' in regen ? regen.cases : [];
    result.cases = this.executeSuite(component, suite, content, fn, cases);
    const refreshed = componentRegressionService.refresh(suite.suite_id);
    result.suiteStatus = refreshed?.status;

    // --- 判定 (ANALYZED → DEVICE_TESTED) ---
    const gate = componentPromotionService.validateForLimited(suite.suite_id);
    result.gateAccepted = gate.accepted;
    const finalComponent = componentRegistryService.getComponent(componentId);
    result.finalStatus = finalComponent?.status;
    result.reached = finalComponent?.status ?? 'UNKNOWN';
    result.reason = gate.reason;
    systemLogger.info('TOOLS', `🪜 [P2013 LadderDriver] ${componentId}: suite=${result.suiteStatus} gate=${gate.accepted} -> ${result.finalStatus}`);
    return result;
  }

  /**
   * Suite の各ケースを Runner として実行する。実行内容は登録済み
   * 受け入れケースの再実行を正とする（NORMAL=先頭ケース、
   * BOUNDARY=最も大きな入力のケース、REGRESSION=全ケース、
   * PERMISSION=先頭ケース（純粋関数は権限を要しないことの確認）、
   * INVALID=NaN 入力で有効な結果を返さないことの確認）。
   * 実行できないカテゴリは要求を QUEUED のまま残し、Suite が
   * PASSED にならない形で正直に止める。
   */
  private executeSuite(
    component: ComponentTxtPackage,
    suite: RegressionSuite,
    content: string,
    fn: (...args: number[]) => number,
    cases: AcceptanceCase[],
  ): LadderCaseResult[] {
    const out: LadderCaseResult[] = [];
    const refreshed = componentRegressionService.refresh(suite.suite_id) ?? suite;
    const bindings = refreshed.case_bindings?.length
      ? refreshed.case_bindings
      : refreshed.request_ids.map((request_id) => ({ test_case_id: '', request_id }));
    for (const binding of bindings) {
      const request = executionRunnerService.getRequest(binding.request_id);
      if (!request) {
        out.push({ testCaseId: binding.test_case_id, category: '?', requestStatus: 'MISSING' });
        continue;
      }
      const category = request.test_category;
      if (request.status !== 'QUEUED') {
        out.push({ testCaseId: binding.test_case_id, category, requestStatus: request.status, detail: request.reason });
        continue;
      }
      const started = Date.now();
      const outcome = this.executeCase(category, content, component.entry_point, fn, cases);
      if (!outcome) {
        out.push({ testCaseId: binding.test_case_id, category, requestStatus: request.status, detail: 'CATEGORY_NOT_EXECUTED' });
        continue;
      }
      executionRunnerService.markSubmitted(request.request_id);
      const submitted = executionRunnerService.submitResult({
        request_id: request.request_id,
        passed: outcome.passed,
        output_summary: outcome.output,
        error_message: outcome.error,
        duration_ms: Math.max(0, Date.now() - started),
        environment: suite.environment,
        runner_id: RUNNER_ID,
        implementation_hash: component.implementation_hash,
        artifact_snapshot_key: request.artifact_snapshot_key,
        test_case_id: binding.test_case_id,
      });
      const after = executionRunnerService.getRequest(request.request_id);
      out.push({
        testCaseId: binding.test_case_id,
        category,
        requestStatus: after?.status ?? 'UNKNOWN',
        assertionStatus: after?.assertion_status,
        detail: submitted.accepted ? undefined : submitted.reason,
      });
    }
    return out;
  }

  private executeCase(
    category: string,
    content: string,
    entryPoint: string,
    fn: (...args: number[]) => number,
    cases: AcceptanceCase[],
  ): { passed: boolean; output: string; error?: string } | null {
    const runMatches = (c: AcceptanceCase): { passed: boolean; output: string; error?: string } => {
      try {
        const value = fn(...c.args);
        const tol = c.tolerance ?? 0;
        const passed = typeof value === 'number' && Number.isFinite(value) && Math.abs(value - c.expected) <= tol;
        return {
          passed,
          output: `RESULT: ${String(value)}`,
          error: passed ? undefined : `expected ${c.expected} (tol ${tol}) but got ${String(value)}`,
        };
      } catch (e) {
        return { passed: false, output: 'EXCEPTION', error: e instanceof Error ? e.message : String(e) };
      }
    };
    switch (category) {
      case 'NORMAL':
      case 'PERMISSION':
        return cases.length ? runMatches(cases[0]) : { passed: false, output: '', error: 'NO_ACCEPTANCE_CASES' };
      case 'BOUNDARY': {
        if (!cases.length) return { passed: false, output: '', error: 'NO_ACCEPTANCE_CASES' };
        const boundary = cases.reduce((a, b) =>
          (b.args.reduce((s, v) => s + Math.abs(v), 0) > a.args.reduce((s, v) => s + Math.abs(v), 0) ? b : a), cases[0]);
        return runMatches(boundary);
      }
      case 'REGRESSION': {
        if (!cases.length) return { passed: false, output: '', error: 'NO_ACCEPTANCE_CASES' };
        const evidence = pureCodeExecutionService.execute(content, entryPoint, cases);
        return {
          passed: evidence.passed,
          output: `ACCEPTANCE_REGRESSION: ${evidence.passedCount}/${evidence.total} cases passed`,
          error: evidence.passed ? undefined : `acceptance re-execution failed: ${evidence.passedCount}/${evidence.total}`,
        };
      }
      case 'INVALID': {
        const arity = Math.max(1, fn.length);
        const args = new Array(arity).fill(NaN);
        try {
          const value = fn(...args);
          if (typeof value === 'number' && Number.isFinite(value)) {
            return {
              passed: false,
              output: `RESULT: ${String(value)}`,
              error: 'INVALID_INPUT_ACCEPTED: NaN input produced a finite result',
            };
          }
          return {
            passed: true,
            output: `SAFE_FAILURE_OBSERVED: NaN input -> non-finite result (${String(value)}); no valid output, no side effects (RETURN_BLOCKED_RESULT)`,
          };
        } catch (e) {
          return {
            passed: false,
            output: 'EXCEPTION_ON_INVALID_INPUT',
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }
      default:
        return null;
    }
  }

  /**
   * 候補をまとめて登らせる。1件の失敗で全体は止めない。
   * P2014: 並びはセッション開始時刻の昇順に整える。文脈に使われる部品は
   * それを使うセッションより前に登録されているため、セッション開始順は
   * クラスターの依存順（葉→頂点）と一致する。開始時刻が引けない対象は
   * 末尾に置き、相対順序は保つ（安定ソート）。
   */
  public driveMany(targets: Array<{ componentId: string; ref?: LadderArtifactRef }>): LadderDriveResult[] {
    const records = this.artifactPartRecords();
    const starts = this.sessionStartBySeed(records);
    const seedOf = new Map<string, number>();
    for (const r of records) {
      if (r.seed !== undefined && !seedOf.has(r.component_id)) seedOf.set(r.component_id, r.seed);
    }
    const keyOf = (componentId: string): number => {
      const seed = seedOf.get(componentId);
      const start = seed === undefined ? undefined : starts.get(seed);
      return start === undefined ? Number.POSITIVE_INFINITY : start;
    };
    const ordered = targets
      .map((t, i) => ({ t, i, k: keyOf(t.componentId) }))
      .sort((a, b) => (a.k - b.k) || (a.i - b.i))
      .map((x) => x.t);
    const results: LadderDriveResult[] = [];
    for (const target of ordered) {
      try {
        results.push(this.drive(target.componentId, target.ref));
      } catch (e) {
        results.push({
          componentId: target.componentId,
          restored: false,
          cases: [],
          reached: 'ERROR',
          reason: `DRIVE_EXCEPTION: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
    return results;
  }
}

export const componentLadderDriverService = ComponentLadderDriverService.getInstance();
