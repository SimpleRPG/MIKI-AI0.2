import JSZip from 'jszip';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256Object, sha256HexFromText } from './canonicalSha256Service';
import {
  reusableComponentFactoryService,
  type KnowledgeComponentArtifact,
} from './reusableComponentFactoryService';

/*
 * P472: 教師教材パッケージの受け口。
 *
 * 背景（2026-11-07、実機で判明）: 教師教材（MIKI_TEACHER_MATERIAL_*.zip）は
 * 「矛盾の回答を取り込む」へ入れても MANIFEST_MISSING で却下された。
 * 既存の受け口はどちらも要求への返却専用（部品供給は supply_reply.json、
 * 矛盾解決は contradiction_reply.json と requestId / requestSha256 の
 * 結び付けが必須）で、要求に結び付かない教材の受け口が存在しなかった。
 * 教材の INSTRUCTIONS.md に書かれていた「同じ受け口で受け取ってください」
 * は未検証の前提であり、本サービスがその受け口を実装する。
 *
 * 線引き（他の受け口と同じ）:
 *  - 教材は素材であり、レッスンは CANDIDATE / UNVERIFIED の知識部品として
 *    登録するだけ。教材が届いたこと自体で主張が確定することはない。
 *  - 要求への結び付けは無い代わりに、出所（teacher.name、パッケージの
 *    SHA-256、マニフェストの SHA-256）を台帳へ必ず記録する。
 *  - 同梱の参照画像は data URL として保管し、観察（目）の材料にする。
 *
 * 形式: ZIP（または .zip.txt = Base64）のルートに teacher_material.json。
 * { formatVersion: 1, packageType: 'TEACHER_MATERIAL', teacher: { name },
 *   subject?, lessons: [{ id, title, rule, reason?, howToJudge?, example?, antiPattern? }] }
 * 参照画像は references/ 以下に .png / .jpg / .jpeg / .webp で同梱できる。
 */

export type TeacherMaterialIntakeStatus = 'RECEIVED' | 'REJECTED';

export type TeacherMaterialIntakeCode =
  | 'OK'
  | 'EMPTY_INPUT'
  | 'FILE_TOO_LARGE'
  | 'NOT_A_PACKAGE'
  | 'ZIP_READ_FAILED'
  | 'TOO_MANY_FILES'
  | 'CONTENT_TOO_LARGE'
  | 'UNSAFE_PATH'
  | 'MANIFEST_MISSING'
  | 'MANIFEST_INVALID';

export interface TeacherMaterialReferenceRecord {
  path: string;
  sha256: string;
  bytes: number;
  storageKey: string;
}

export interface TeacherMaterialIntakeRecord {
  intakeId: string;
  status: TeacherMaterialIntakeStatus;
  code: TeacherMaterialIntakeCode;
  reasons: string[];
  sourceFileName: string;
  sourceType: 'ZIP' | 'ZIPTXT';
  fileSizeBytes: number;
  packageSha256: string;
  manifestSha256: string;
  teacherName: string;
  subject: string;
  lessonCount: number;
  componentIds: string[];
  references: TeacherMaterialReferenceRecord[];
  receivedAt: number;
}

export interface TeacherMaterialIntakeResult {
  ok: boolean;
  code: TeacherMaterialIntakeCode;
  message: string;
  reasons: string[];
  record: TeacherMaterialIntakeRecord;
}

interface TeacherLesson {
  id: string;
  title: string;
  rule: string;
  reason?: string;
  howToJudge?: string;
  example?: string;
  antiPattern?: string;
}

const LEDGER_KEY = 'miki_teacher_material_intake_ledger_v1';
const REF_KEY_PREFIX = 'miki_teacher_material_ref_v1:';
const MAX_INPUT_BYTES = 8_000_000;
const MAX_FILES = 100;
const MAX_TOTAL_CONTENT_BYTES = 16 * 1024 * 1024;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const textEncoder = new TextEncoder();
const byteLength = (text: string): number => textEncoder.encode(text).length;

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error('UNSAFE_ARTIFACT_PATH');
  }
  return normalized;
};

class TeacherMaterialIntakeService {
  private ledger = new Map<string, TeacherMaterialIntakeRecord>();
  private sequence = 0;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = storageService.getItem(LEDGER_KEY);
      if (raw) {
        const records = JSON.parse(raw) as TeacherMaterialIntakeRecord[];
        for (const record of records) this.ledger.set(record.intakeId, record);
      }
    } catch {
      // 台帳が読めなくても受け口自体は動かす
    }
  }

  private save(): void {
    try {
      const records = [...this.ledger.values()].slice(-100);
      storageService.setItem(LEDGER_KEY, JSON.stringify(records));
    } catch {
      // 保存失敗は受入結果に影響させない
    }
  }

  public list(): TeacherMaterialIntakeRecord[] {
    return [...this.ledger.values()].sort((a, b) => b.receivedAt - a.receivedAt);
  }

  /** 保管した参照画像の data URL を返す（観察の材料）。 */
  public getReferenceDataUrl(storageKey: string): string | null {
    const value = storageService.getItem(storageKey);
    return typeof value === 'string' && value.startsWith('data:image/') ? value : null;
  }

  private async sha256Hex(bytes: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  private fromBase64(text: string): Uint8Array {
    const binary = atob(text.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  public async receivePackage(input: { fileName: string; bytes: Uint8Array }): Promise<TeacherMaterialIntakeResult> {
    const receivedAt = Date.now();
    this.sequence += 1;
    const intakeId = `TM-IN-${receivedAt}-${String(this.sequence).padStart(3, '0')}`;
    const sourceFileName = input.fileName || '';
    const sourceType: 'ZIP' | 'ZIPTXT' = sourceFileName.toLowerCase().endsWith('.zip.txt') ? 'ZIPTXT' : 'ZIP';

    const reject = (
      code: TeacherMaterialIntakeCode,
      message: string,
      reasons: string[],
      ctx: Partial<TeacherMaterialIntakeRecord> = {},
    ): TeacherMaterialIntakeResult => {
      const record: TeacherMaterialIntakeRecord = {
        intakeId,
        status: 'REJECTED',
        code,
        reasons,
        sourceFileName,
        sourceType: ctx.sourceType ?? sourceType,
        fileSizeBytes: input.bytes?.length ?? 0,
        packageSha256: ctx.packageSha256 ?? '',
        manifestSha256: ctx.manifestSha256 ?? '',
        teacherName: ctx.teacherName ?? '',
        subject: ctx.subject ?? '',
        lessonCount: 0,
        componentIds: [],
        references: [],
        receivedAt,
      };
      this.ledger.set(intakeId, record);
      this.save();
      systemLogger.warn('SELF_IMPROVEMENT', `[教師教材 受入却下] ${intakeId} code=${code} file=${sourceFileName}`, { reasons });
      return { ok: false, code, message, reasons, record: { ...record } };
    };

    // ---- 入力の形: ZIP バイナリか、Base64 の .zip.txt か ----
    if (!input.bytes || input.bytes.length === 0) {
      return reject('EMPTY_INPUT', '選択されたファイルが空です。教材パッケージのファイルを選んでください。', ['入力バイト数が0です']);
    }
    if (input.bytes.length > MAX_INPUT_BYTES) {
      return reject('FILE_TOO_LARGE', `教材ファイルが大きすぎます（${input.bytes.length} バイト / 上限 ${MAX_INPUT_BYTES} バイト）。`, ['入力サイズが上限を超えています']);
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
        return reject('NOT_A_PACKAGE', 'ファイルを解釈できませんでした。ZIP ファイル、または Base64 の .zip.txt を選んでください。', ['PK マジックが無く、Base64 としても復号できませんでした']);
      }
      resolvedSourceType = 'ZIPTXT';
      if (!(zipBytes[0] === 0x50 && zipBytes[1] === 0x4b)) {
        return reject('NOT_A_PACKAGE', 'Base64 復号後の内容が ZIP ではありませんでした。', ['復号後の先頭が PK マジックではありません']);
      }
    }
    const packageSha256 = await this.sha256Hex(zipBytes);
    const baseCtx: Partial<TeacherMaterialIntakeRecord> = { sourceType: resolvedSourceType, packageSha256 };

    // ---- 解凍と安全化 ----
    let archive: JSZip;
    try {
      archive = await JSZip.loadAsync(zipBytes, { checkCRC32: true });
    } catch (error) {
      return reject('ZIP_READ_FAILED', `ZIP の読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`, ['JSZip.loadAsync が失敗しました'], baseCtx);
    }
    const textFiles = new Map<string, string>();
    const imageFiles: { path: string; base64: string }[] = [];
    let totalBytes = 0;
    let fileCount = 0;
    for (const [rawPath, entry] of Object.entries(archive.files)) {
      if (entry.dir) continue;
      fileCount += 1;
      if (fileCount > MAX_FILES) {
        return reject('TOO_MANY_FILES', `教材 ZIP のファイル数が上限（${MAX_FILES}件）を超えています。`, [`ファイル数 ${fileCount} 件`], baseCtx);
      }
      let safePath: string;
      try {
        safePath = normalizePath(rawPath);
      } catch {
        return reject('UNSAFE_PATH', `教材 ZIP に安全でないパスが含まれています: ${rawPath}`, [`UNSAFE_ARTIFACT_PATH: ${rawPath}`], baseCtx);
      }
      const lower = safePath.toLowerCase();
      const imageExt = IMAGE_EXTENSIONS.find((ext) => lower.endsWith(ext));
      if (imageExt) {
        const base64 = await entry.async('base64');
        totalBytes += base64.length;
        imageFiles.push({ path: safePath, base64 });
      } else {
        const content = await entry.async('string');
        totalBytes += byteLength(content);
        textFiles.set(safePath, content);
      }
      if (totalBytes > MAX_TOTAL_CONTENT_BYTES) {
        return reject('CONTENT_TOO_LARGE', `教材 ZIP の解凍後サイズが上限（${MAX_TOTAL_CONTENT_BYTES} バイト）を超えています。`, [`解凍後合計 ${totalBytes} バイト`], baseCtx);
      }
    }

    // ---- manifest の取得と形式検証 ----
    const manifestText = textFiles.get('teacher_material.json');
    if (manifestText === undefined) {
      return reject('MANIFEST_MISSING', '教材 ZIP のルートに teacher_material.json がありません。教師教材パッケージの形式で作り直してください。', ['teacher_material.json が見つかりません'], baseCtx);
    }
    const manifestSha256 = sha256HexFromText(manifestText);
    const manifestCtx: Partial<TeacherMaterialIntakeRecord> = { ...baseCtx, manifestSha256 };
    let manifest: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(manifestText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      manifest = parsed as Record<string, unknown>;
    } catch {
      return reject('MANIFEST_INVALID', 'teacher_material.json が JSON として読めませんでした。', ['JSON パースに失敗しました'], manifestCtx);
    }
    if (manifest.formatVersion !== 1) {
      return reject('MANIFEST_INVALID', `teacher_material.json の formatVersion が対応範囲外です（受け取った値: ${String(manifest.formatVersion)}）。`, ['formatVersion は 1 でなければなりません'], manifestCtx);
    }
    if (manifest.packageType !== 'TEACHER_MATERIAL') {
      return reject('MANIFEST_INVALID', 'teacher_material.json の packageType が TEACHER_MATERIAL ではありません。', [`packageType: ${String(manifest.packageType)}`], manifestCtx);
    }
    const rawTeacher = manifest.teacher && typeof manifest.teacher === 'object' && !Array.isArray(manifest.teacher)
      ? manifest.teacher as Record<string, unknown>
      : undefined;
    const teacherName = typeof rawTeacher?.name === 'string' ? rawTeacher.name.trim() : '';
    if (!teacherName) {
      return reject('MANIFEST_INVALID', 'teacher_material.json に teacher.name（教師名）がありません。出所の記録のため必須です。', ['teacher.name が空です'], manifestCtx);
    }
    const subject = typeof manifest.subject === 'string' ? manifest.subject : '';
    const identifiedCtx: Partial<TeacherMaterialIntakeRecord> = { ...manifestCtx, teacherName, subject };
    const rawLessons = manifest.lessons;
    if (!Array.isArray(rawLessons) || rawLessons.length === 0) {
      return reject('MANIFEST_INVALID', 'teacher_material.json の lessons が空です。少なくとも1件のレッスンを入れてください。', ['lessons が空配列または未設定です'], identifiedCtx);
    }
    const lessons: TeacherLesson[] = [];
    for (const item of rawLessons) {
      const lesson = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {};
      const id = typeof lesson.id === 'string' ? lesson.id.trim() : '';
      const title = typeof lesson.title === 'string' ? lesson.title.trim() : '';
      const rule = typeof lesson.rule === 'string' ? lesson.rule.trim() : '';
      if (!id || !title || !rule) {
        return reject('MANIFEST_INVALID', 'lessons に id / title / rule の欠けたレッスンがあります。', [`不完全なレッスン: ${id || '(id無し)'}`], identifiedCtx);
      }
      lessons.push({
        id,
        title,
        rule,
        reason: typeof lesson.reason === 'string' ? lesson.reason : undefined,
        howToJudge: typeof lesson.howToJudge === 'string' ? lesson.howToJudge : undefined,
        example: typeof lesson.example === 'string' ? lesson.example : undefined,
        antiPattern: typeof lesson.antiPattern === 'string' ? lesson.antiPattern : undefined,
      });
    }

    // ---- レッスンを知識部品（候補・未検証）として登録 ----
    const componentIds: string[] = [];
    for (const lesson of lessons) {
      const body = {
        componentKind: 'KNOWLEDGE' as const,
        componentType: 'TEACHER_LESSON',
        purpose: `Teacher lesson ${lesson.id}: ${lesson.title}`,
        interfaceContract: {
          input: 'situation the lesson applies to',
          output: 'procedure (rule) to follow, with judgement criteria',
        },
        inputs: ['lesson rule', 'current situation'],
        outputs: ['applied procedure'],
        prerequisites: [],
        dependencies: ['teacher-material-intake'],
        appliesWhen: [subject || 'general'],
        doesNotApplyWhen: ['lesson not yet verified'],
        sourceEpisodeIds: [],
        sourceLearningArtifactIds: [],
        environmentFingerprint: 'unknown',
        lifecycleStatus: 'CANDIDATE' as const,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        claimIds: [],
        evidenceRefs: [],
        sourceUrls: [],
        sourceArtifactIds: [],
        verificationStatus: 'UNVERIFIED' as const,
        contradictionRefs: [],
        freshnessPolicy: 'REVALIDATE_ON_ENVIRONMENT_CHANGE',
        lesson,
        teacherName,
        packageSubject: subject,
        intakePackageSha256: packageSha256,
      };
      const canonicalSha256 = canonicalSha256Object(body);
      const component = {
        ...body,
        componentId: `RC-KNOWLEDGE-LESSON-${canonicalSha256.slice(0, 18)}`,
        canonicalSha256,
        createdAt: receivedAt,
        updatedAt: receivedAt,
      } as unknown as KnowledgeComponentArtifact;
      reusableComponentFactoryService.storeCandidates([component]);
      componentIds.push(component.componentId);
    }

    // ---- 参照画像を保管（観察の材料） ----
    const references: TeacherMaterialReferenceRecord[] = [];
    for (const image of imageFiles) {
      const ext = IMAGE_EXTENSIONS.find((e) => image.path.toLowerCase().endsWith(e)) ?? '.png';
      const storageKey = `${REF_KEY_PREFIX}${manifestSha256.slice(0, 16)}:${image.path}`;
      try {
        storageService.setItem(storageKey, `data:${IMAGE_MIME[ext]};base64,${image.base64}`);
      } catch {
        // 保管できなくてもレッスンの受入は成立させる
        continue;
      }
      references.push({
        path: image.path,
        sha256: sha256HexFromText(image.base64),
        bytes: Math.floor((image.base64.length * 3) / 4),
        storageKey,
      });
    }

    const record: TeacherMaterialIntakeRecord = {
      intakeId,
      status: 'RECEIVED',
      code: 'OK',
      reasons: [],
      sourceFileName,
      sourceType: resolvedSourceType,
      fileSizeBytes: input.bytes.length,
      packageSha256,
      manifestSha256,
      teacherName,
      subject,
      lessonCount: lessons.length,
      componentIds,
      references,
      receivedAt,
    };
    this.ledger.set(intakeId, record);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[教師教材 受入] ${intakeId} teacher=${teacherName} lessons=${lessons.length} refs=${references.length}`, { subject });
    return { ok: true, code: 'OK', message: `教師教材を受け付けました（レッスン ${lessons.length} 件、参照画像 ${references.length} 件）。`, reasons: [], record: { ...record } };
  }
}

export const teacherMaterialIntakeService = new TeacherMaterialIntakeService();
