import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

/*
 * P449: 教師検証証拠（Teacher Verification Evidence, TVE）の保管・検証。
 *
 * 教師（Muse）が行った検証の記録を、供給パッケージから受け取って
 * 部品 ID 引きで保管し、Gate 時に1ラウンドずつ取り出して既存の
 * submitResult 経路へ提出する。TVE は検証の証拠であり、VERIFIED の
 * 印ではない。梯子の関門（Suite・ハッシュ・artifact・Canary・実測10件）
 * はすべて残り、TVE だけでは何も通らない。
 *
 * 1ラウンド＝1回の Gate 分の検査記録。同じ記録の再提示は重複として
 * 却下する（ラウンドは消費され、同じラウンドは2つの Gate には使えない）。
 * Canary の標本は「教師の新規検証ラウンド」（同じ検査の再実行で、新しい
 * verifiedAt を持つ別の記録）で作る（§8 決めること2の案イ）。
 */

export type TeacherVerificationCheckKind = 'TYPECHECK' | 'IMPORT_CHECK' | 'SMOKE_EXECUTION';

export interface TeacherVerificationCheck {
  kind: TeacherVerificationCheckKind;
  /** 対応する宣言テストケース（SMOKE_EXECUTION のみ）。 */
  testCase?: string;
  /** 実行したコマンド。allow-list にあるものだけ。 */
  command: string;
  exitCode: number;
  outputSha256: string;
  /** 出力の抜粋。SMOKE_EXECUTION では ASSERT のマーカーを含む。 */
  outputExcerpt: string;
  passed: boolean;
}

export interface TeacherVerificationRound {
  /** 決定論的な ID（実装ハッシュ＋検証時刻＋検査出力から作る）。 */
  roundId: string;
  verifier: string;
  verifierModel?: string;
  verifiedAt: string;
  implementationSha256: string;
  targetPath: string;
  checks: TeacherVerificationCheck[];
}

interface StoredRound extends TeacherVerificationRound {
  consumed: boolean;
}

const STORAGE_KEY = 'miki_teacher_verification_evidence_v1';
const MAX_COMPONENTS = 200;
const MAX_ROUNDS_PER_COMPONENT = 10;

const CHECK_KINDS: TeacherVerificationCheckKind[] = ['TYPECHECK', 'IMPORT_CHECK', 'SMOKE_EXECUTION'];

/** componentTestCaseService の ALL_CATEGORIES と同じ集合。 */
const TEST_CATEGORIES = [
  'NORMAL', 'BOUNDARY', 'EMPTY', 'INVALID', 'MISSING_DEPENDENCY',
  'PERMISSION', 'TIMEOUT', 'INTERRUPTION', 'LARGE_INPUT', 'DUPLICATE', 'REGRESSION',
];

/**
 * 検査コマンドの allow-list。教師が「実行した」と主張できるのは
 * 次のものだけ。任意コマンドは不可。
 * - TYPECHECK: `npx tsc --noEmit`（固定）
 * - IMPORT_CHECK: `node scripts/check_imports.mjs`（固定）
 * - SMOKE_EXECUTION: `npx tsx <スクリプト>.ts`（1ファイルのみ。シェルの
 *   メタ文字 `;` `&` `|` `` ` `` `$` は不可）
 */
const isAllowedCommand = (kind: TeacherVerificationCheckKind, command: string): boolean => {
  if (kind === 'TYPECHECK') return command === 'npx tsc --noEmit';
  if (kind === 'IMPORT_CHECK') return command === 'node scripts/check_imports.mjs';
  if (kind === 'SMOKE_EXECUTION') {
    if (/[;&|`$]/.test(command)) return false;
    return /^npx tsx \S+\.ts$/.test(command);
  }
  return false;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isHex64 = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

const roundIdFor = (round: Omit<TeacherVerificationRound, 'roundId'>): string =>
  `TVE-${canonicalSha256({
    implementationSha256: round.implementationSha256,
    verifiedAt: round.verifiedAt,
    checks: round.checks.map((check) => check.outputSha256),
  }).slice(0, 20)}`;

class TeacherVerificationEvidenceService {
  private rounds = new Map<string, StoredRound[]>();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (!isRecord(parsed)) return;
      for (const [componentId, value] of Object.entries(parsed)) {
        if (!Array.isArray(value)) continue;
        const stored = value
          .filter(isRecord)
          .map((item) => item as unknown as StoredRound)
          .filter((item) => typeof item.roundId === 'string' && Array.isArray(item.checks));
        if (stored.length > 0) this.rounds.set(componentId, stored.slice(0, MAX_ROUNDS_PER_COMPONENT));
      }
    } catch {
      this.rounds.clear();
    }
  }

  private save(): void {
    try {
      const entries = [...this.rounds.entries()].slice(0, MAX_COMPONENTS);
      storageService.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // 保管の永続化失敗は呼び出し元の処理を止めない。
    }
  }

  /**
   * 生の TVE 記録1件を検証し、正規化して返す。検証する条件（設計書 §5.2）：
   * (a) implementationSha256 が canonicalSha256(candidateContent) と一致する、
   * (b) checks のコマンドが allow-list にある、(c) すべての check が
   * passed: true かつ exitCode: 0、(d) targetPath が要求の対象ファイルの
   * いずれかと一致する。加えて verifier・verifiedAt・checks の形も見る。
   */
  public parseRound(
    value: unknown,
    expected: { candidateContent: string; targetPaths: string[] },
  ): { ok: true; round: TeacherVerificationRound } | { ok: false; reason: string } {
    if (!isRecord(value)) return { ok: false, reason: 'teacherVerification がオブジェクトではありません' };
    const verifier = typeof value.verifier === 'string' ? value.verifier.trim() : '';
    if (!verifier) return { ok: false, reason: 'teacherVerification.verifier が空です' };
    const verifiedAt = typeof value.verifiedAt === 'string' ? value.verifiedAt.trim() : '';
    if (!verifiedAt || Number.isNaN(Date.parse(verifiedAt))) {
      return { ok: false, reason: 'teacherVerification.verifiedAt が ISO 8601 の日時ではありません' };
    }
    const implementationSha256 = typeof value.implementationSha256 === 'string' ? value.implementationSha256.trim().toLowerCase() : '';
    if (!isHex64(implementationSha256)) {
      return { ok: false, reason: 'teacherVerification.implementationSha256 が SHA-256（16進64字）ではありません' };
    }
    if (implementationSha256 !== canonicalSha256(expected.candidateContent)) {
      return { ok: false, reason: 'teacherVerification.implementationSha256 が候補内容のハッシュと一致しません' };
    }
    const targetPath = typeof value.targetPath === 'string' ? value.targetPath.trim() : '';
    if (!targetPath || !expected.targetPaths.includes(targetPath)) {
      return { ok: false, reason: `teacherVerification.targetPath が要求の対象ファイルではありません: ${targetPath}` };
    }
    if (!Array.isArray(value.checks) || value.checks.length === 0) {
      return { ok: false, reason: 'teacherVerification.checks が空です' };
    }
    const checks: TeacherVerificationCheck[] = [];
    for (const rawCheck of value.checks) {
      if (!isRecord(rawCheck)) return { ok: false, reason: 'teacherVerification.checks の要素がオブジェクトではありません' };
      const kind = rawCheck.kind as TeacherVerificationCheckKind;
      if (!CHECK_KINDS.includes(kind)) {
        return { ok: false, reason: `teacherVerification.checks の kind が不正です: ${String(rawCheck.kind)}` };
      }
      const command = typeof rawCheck.command === 'string' ? rawCheck.command.trim() : '';
      if (!isAllowedCommand(kind, command)) {
        return { ok: false, reason: `teacherVerification.checks の command が allow-list にありません: ${command}` };
      }
      if (rawCheck.exitCode !== 0 || rawCheck.passed !== true) {
        return { ok: false, reason: `teacherVerification.checks の ${kind} が成功していません（exitCode=${String(rawCheck.exitCode)} passed=${String(rawCheck.passed)}）` };
      }
      if (!isHex64(rawCheck.outputSha256)) {
        return { ok: false, reason: `teacherVerification.checks の ${kind} の outputSha256 が SHA-256 ではありません` };
      }
      const outputExcerpt = typeof rawCheck.outputExcerpt === 'string' ? rawCheck.outputExcerpt : '';
      if (!outputExcerpt.trim()) {
        return { ok: false, reason: `teacherVerification.checks の ${kind} の outputExcerpt が空です` };
      }
      let testCase: string | undefined;
      if (kind === 'SMOKE_EXECUTION') {
        testCase = typeof rawCheck.testCase === 'string' ? rawCheck.testCase.trim().toUpperCase() : '';
        if (!TEST_CATEGORIES.includes(testCase)) {
          return { ok: false, reason: `teacherVerification.checks の SMOKE_EXECUTION の testCase が不正です: ${testCase}` };
        }
      }
      checks.push({
        kind,
        ...(testCase ? { testCase } : {}),
        command,
        exitCode: 0,
        outputSha256: String(rawCheck.outputSha256),
        outputExcerpt,
        passed: true,
      });
    }
    const round: TeacherVerificationRound = {
      roundId: '',
      verifier,
      ...(typeof value.verifierModel === 'string' && value.verifierModel.trim()
        ? { verifierModel: value.verifierModel.trim() }
        : {}),
      verifiedAt,
      implementationSha256,
      targetPath,
      checks,
    };
    round.roundId = roundIdFor(round);
    return { ok: true, round };
  }

  /** ラウンドを部品 ID 引きで保管する。同じ roundId は重複して入れない。 */
  public storeRounds(componentId: string, rounds: TeacherVerificationRound[]): number {
    if (!componentId || rounds.length === 0) return 0;
    const existing = this.rounds.get(componentId) ?? [];
    const known = new Set(existing.map((item) => item.roundId));
    let added = 0;
    for (const round of rounds) {
      if (known.has(round.roundId)) continue;
      existing.push({ ...round, consumed: false });
      known.add(round.roundId);
      added += 1;
    }
    this.rounds.set(componentId, existing.slice(0, MAX_ROUNDS_PER_COMPONENT));
    if (added > 0) this.save();
    return added;
  }

  /** 保管済みのラウンドがあるか（消費済みを含む）。 */
  public hasRounds(componentId: string): boolean {
    return (this.rounds.get(componentId) ?? []).length > 0;
  }

  /** 未消費のラウンドが残っているか。 */
  public hasUnusedRound(componentId: string): boolean {
    return (this.rounds.get(componentId) ?? []).some((item) => !item.consumed);
  }

  /** 現在のラウンド（未消費の先頭）。Gate 1回分に使う。 */
  public getCurrentRound(componentId: string): TeacherVerificationRound | undefined {
    const current = (this.rounds.get(componentId) ?? []).find((item) => !item.consumed);
    return current ? { ...current, checks: current.checks.map((check) => ({ ...check })) } : undefined;
  }

  /** 現在のラウンドのうち、指定カテゴリの実行チェックを返す。 */
  public getCheckForCategory(componentId: string, category: string): TeacherVerificationCheck | undefined {
    const current = this.getCurrentRound(componentId);
    if (!current) return undefined;
    return current.checks.find(
      (check) => check.kind === 'SMOKE_EXECUTION' && check.testCase === category,
    );
  }

  /** 現在のラウンドを消費済みにする（新しい Gate を作るときに呼ぶ）。 */
  public advanceRound(componentId: string): boolean {
    const stored = this.rounds.get(componentId);
    if (!stored) return false;
    const current = stored.find((item) => !item.consumed);
    if (!current) return false;
    current.consumed = true;
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[P449] TVE round consumed: ${componentId} round=${current.roundId}`);
    return true;
  }

  /** 静的チェック（TYPECHECK / IMPORT_CHECK）がすべて通っているか。 */
  public staticChecksPassed(round: TeacherVerificationRound): boolean {
    const staticChecks = round.checks.filter(
      (check) => check.kind === 'TYPECHECK' || check.kind === 'IMPORT_CHECK',
    );
    return staticChecks.length > 0 && staticChecks.every((check) => check.passed && check.exitCode === 0);
  }
}

export const teacherVerificationEvidenceService = new TeacherVerificationEvidenceService();
