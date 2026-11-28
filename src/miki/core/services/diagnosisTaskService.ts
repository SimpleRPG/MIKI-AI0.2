import { storageService } from '../../../services/storageService';
import {
  isStorageAuthoritativeNow,
  runWhenStorageAuthoritative,
} from '../../../services/deferredStoreLoad';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256Object } from './canonicalSha256Service';
import {
  reusableComponentFactoryService,
  type KnowledgeComponentArtifact,
} from './reusableComponentFactoryService';

/*
 * P3006: 診断タスク（欠陥の証拠からの原因特定）を彼女自身の機能として実装する。
 *
 * 経緯（2026-11-27、きりあの組み込み方針）: EFR検証ハーネスの自己修理チャンネルで
 * ボトルネックは「診断の供給」だった（起草は診断を渡せば形になるが、証拠だけ
 * では診断できない）。診断役は外部LLMから彼女へ移され、診断は彼女のアプリの
 * 機能として、彼女の台帳とゲートに結線される。出題・運用のインターフェースは
 * ゲーム非依存に保ち、ゲーム固有の知識は教材パッケージ側に置く（EFRは第1号）。
 *
 * 形（既存の作法に合わせる）:
 *  - 出題は教師教材パッケージの任意セクション diagnosisCases から、
 *    teacherMaterialIntakeService 経由で届く（教材＝素材、の線引きは同じ）。
 *  - 回答は決定論の証拠分析（LLM不使用）。コード領域の操作手順と証拠パック
 *    （seenTexts / observedNotes / failEvidence）を突き合わせ、欠陥の型を
 *    特定して { status, location, mechanism, evidence, at } を作る
 *    （本番チャンネルの diagnosis フィールドと同形）。
 *  - 引用した証拠は本番 diagnoser と同じ規則で自己検証する（空白正規化した
 *    6文字以上の行が {evidencePack, failEvidence} の JSON に含まれること）。
 *    検証できない・型が特定できない場合は undiagnosable と理由を記録する。
 *  - 試行は全て彼女の台帳（miki_diagnosis_task_ledger_v1）に残る。
 *  - 学習: 診断が立った試行からは、彼女自身の診断文を一般化した
 *    DIAGNOSIS_PATTERN 知識部品（候補・未検証）を部品保管庫へ登録する。
 *    後続のケースでは、型と選択子の形が一致するパターンを先に参照し、
 *    その文面（スロットに今回の証拠の値を入れたもの）で機構を述べる。
 *    スコアや正解が彼女に渡ることはない（採点は外部の試験側だけが行う）。
 *
 * P3008（2026-11-27 21:15-21:22、きりあの設計追加）: 理解は二様式の併用で作る
 * ——(1) 選択（状況→行動のスコア規則。彼女の既存の流儀）と (2) 連結
 * （因果文「◯◯だから◯◯」の連鎖。事実は理由を小さな検証済み因果リンク
 * として持ち、説明・診断はその連鎖を複数段たどる）。その上に予測ループ
 * （行動前に連鎖で予測→実結果と比較→誤ったリンクを改訂）と、反復する
 * 具体リンクの抽象化（転移可能な機構へ）、計画の後方連鎖が載る（後段）。
 * 本スライスの実装範囲: 診断結果を平文の機構だけでなく因果連鎖
 * （DiagnosisCausalLink の列、前提→結論）としても台帳とパターン部品に
 * 残すところまで。予測・改訂・後方連鎖の機械はここでは作らない
 * （LAB_NOTES の設計記録に実施範囲を明記）。
 */

export interface DiagnosisCaseInput {
  id: string;
  family: string;
  targetFile: string;
  gateMetric?: unknown;
  failEvidence: Record<string, unknown>;
  evidencePack: Record<string, unknown>;
  codeRegion: { text: string; startLine?: number; endLine?: number };
}

// P3008: 因果リンク（前提→結論）。診断の機構は平文だけでなく、この
// 「◯◯だから◯◯」の連鎖としても台帳に残す（きりあの二様式設計:
// 選択＝状況→行動のスコア規則、連結＝因果文の連鎖。診断・説明は
// 連鎖をたどる行為であり、予測・改訂の層はこの連鎖の上に載る）。
export interface DiagnosisCausalLink {
  premise: string;
  conclusion: string;
}

export interface DiagnosisResult {
  status: 'diagnosed' | 'undiagnosable';
  location?: string;
  mechanism?: string;
  causalChain?: DiagnosisCausalLink[];
  evidence?: string;
  reason?: string;
  at: string;
}

export interface DiagnosisAttemptRecord {
  attemptId: string;
  caseId: string;
  family: string;
  targetFile: string;
  inputSha256: string;
  diagnosis: DiagnosisResult;
  findingKind: string;
  selectorShape: string;
  patternBasisIds: string[];
  patternComponentId: string;
  viaIntakeId: string;
  at: number;
}

type FindingKind = 'CONFIRM_NEVER_CLICKED' | 'LABEL_ABSENT' | 'TERM_HITS_NON_TARGET' | 'FIRST_FRESH_PREPLACED' | '';

interface ClickStep {
  kind: 'includes' | 'exact' | 'other';
  terms: string[];
  lineIndex: number;
  line: string;
}

interface Finding {
  kind: Exclude<FindingKind, ''>;
  stepLine: number;
  location: string;
  slots: Record<string, string>;
  defaultMechanism: string;
  causalChain: DiagnosisCausalLink[];
  evidenceNotes: string[];
}

const LEDGER_KEY = 'miki_diagnosis_task_ledger_v1';
const MAX_LEDGER = 200;

// ---- 証拠検証（本番 diagnoser の evidenceInPack と同じ規則） ----
const normWs = (s: string): string => s.replace(/\s+/g, ' ').trim();
export function diagnosisEvidenceValidates(evidence: string, caseInput: DiagnosisCaseInput): boolean {
  if (!evidence) return false;
  const hay = normWs(JSON.stringify({ evidencePack: caseInput.evidencePack, failEvidence: caseInput.failEvidence }));
  return evidence.split('\n').some((line) => {
    const t = normWs(line);
    return t.length >= 6 && hay.includes(t);
  });
}

// 引用候補を検証し、最初に通ったものを返す。引用は証拠の原文の連続部分
// でなければならない（ASCII の " を含む文は JSON 化でエスケープされ
// そのままでは一致しないため、" で区切った断片も候補にする）。
function pickCitation(candidates: string[], caseInput: DiagnosisCaseInput): string {
  for (const candidate of candidates) {
    const text = candidate.trim();
    if (!text) continue;
    if (diagnosisEvidenceValidates(text, caseInput)) return text;
    for (const segment of text.split('"')) {
      const seg = segment.trim();
      if (seg.length >= 6 && diagnosisEvidenceValidates(seg, caseInput)) return seg;
    }
  }
  return '';
}

function noteSentences(notes: string[]): string[] {
  const out: string[] = [];
  for (const note of notes) {
    const parts = note.split('。');
    for (let i = 0; i < parts.length; i++) {
      const s = (parts[i] + (i < parts.length - 1 ? '。' : '')).trim();
      if (s) out.push(s);
    }
  }
  return out;
}

function extractQuotedStrings(text: string): string[] {
  const out: string[] = [];
  const re = /["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

// コード領域を行単位に読み、クリック手順を抽出する。
function parseSteps(lines: string[]): ClickStep[] {
  const steps: ClickStep[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('clickBtn')) continue;
    const includesMatch = line.match(/includes:\s*\[([^\]]*)\]/);
    const exactMatch = line.match(/exact:\s*["']([^"']+)["']/);
    if (includesMatch) {
      steps.push({ kind: 'includes', terms: extractQuotedStrings(includesMatch[1]), lineIndex: i, line });
    } else if (exactMatch) {
      steps.push({ kind: 'exact', terms: [exactMatch[1]], lineIndex: i, line });
    } else {
      steps.push({ kind: 'other', terms: extractQuotedStrings(line), lineIndex: i, line });
    }
  }
  return steps;
}

// act(...) ブロックの行範囲（欠陥箇所の引用に使う）。
function actBlock(lines: string[], stepLine: number): string {
  let start = stepLine;
  for (let i = stepLine; i >= Math.max(0, stepLine - 4); i--) {
    if (lines[i].includes('act(')) { start = i; break; }
  }
  let end = stepLine;
  for (let i = stepLine; i < Math.min(lines.length, stepLine + 7); i++) {
    if (lines[i].includes('});')) { end = i; break; }
  }
  return lines.slice(start, end + 1).join('\n').trim();
}

interface AnalysisContext {
  caseInput: DiagnosisCaseInput;
  lines: string[];
  steps: ClickStep[];
  seenTexts: string[];
  notes: string[];
  sentences: string[];
  notesText: string;
  fails: number;
  family: string;
}

function buildContext(caseInput: DiagnosisCaseInput): AnalysisContext {
  const pack = caseInput.evidencePack || {};
  const seenTexts = Array.isArray(pack.seenTexts) ? pack.seenTexts.filter((t): t is string => typeof t === 'string') : [];
  const notes = Array.isArray(pack.observedNotes) ? pack.observedNotes.filter((t): t is string => typeof t === 'string') : [];
  const probeSteps = (pack.probeSteps && typeof pack.probeSteps === 'object' ? pack.probeSteps : {}) as Record<string, unknown>;
  const failsRaw = (caseInput.failEvidence?.windowFails ?? pack.windowFails ?? probeSteps.attempts) as unknown;
  const fails = typeof failsRaw === 'number' && Number.isFinite(failsRaw) ? failsRaw : 0;
  return {
    caseInput,
    lines: String(caseInput.codeRegion?.text || '').split('\n'),
    steps: parseSteps(String(caseInput.codeRegion?.text || '').split('\n')),
    seenTexts,
    notes,
    sentences: noteSentences(notes),
    notesText: notes.join('\n'),
    fails,
    family: caseInput.family || '',
  };
}

const termInSeen = (ctx: AnalysisContext, term: string): boolean =>
  ctx.seenTexts.some((t) => t === term || t.includes(term));

// F4: モーダル/ダイアログを開くクリックの後に、確定クリックが無い。
function findConfirmNeverClicked(ctx: AnalysisContext): Finding | null {
  if (!/モーダル|ダイアログ/.test(ctx.notesText)) return null;
  const openerMatch = ctx.notesText.match(/「([^」]+)」を押すと[^。]*(モーダル|ダイアログ)/);
  if (!openerMatch) return null;
  const openerTerm = openerMatch[1];
  const dialogWord = openerMatch[2];
  const step = ctx.steps.find((s) => s.terms.includes(openerTerm));
  if (!step) return null;
  const confirmAction = ctx.notesText.match(/data-action="([^"]*[Cc]onfirm[^"]*)"/)?.[1] || '';
  const confirmLabel = ctx.seenTexts.find((t) => t === 'OK' || /確認|確定/.test(t)) || '';
  const allTerms = ctx.steps.flatMap((s) => s.terms);
  const regionText = ctx.lines.join('\n');
  const clicksConfirm =
    (confirmAction !== '' && regionText.includes(confirmAction)) ||
    (confirmLabel !== '' && allTerms.includes(confirmLabel)) ||
    allTerms.some((t) => /確認|確定/.test(t));
  if (clicksConfirm) return null;
  const confirmRef = confirmAction
    ? `確定ボタン（data-action="${confirmAction}"${confirmLabel ? `、「${confirmLabel}」` : ''}）`
    : '確定ボタン';
  const slots: Record<string, string> = {
    openerTerm, dialogWord, confirmAction, confirmLabel,
    family: ctx.family, fails: String(ctx.fails),
  };
  const mechanism =
    `「${openerTerm}」は${dialogWord}を開く操作であり、このコードは${dialogWord}を開いた時点で処理を終えており、` +
    `${confirmRef}を押していない。そのため${ctx.family}は実行されず、状態が変わらない（no_effect が ${ctx.fails} 回記録されている）。`;
  const causalChain: DiagnosisCausalLink[] = [
    { premise: `「${openerTerm}」は${dialogWord}を開く操作であり、このコードは${dialogWord}を開いた時点で処理を終えている`, conclusion: `${confirmRef}は押されない` },
    { premise: `${confirmRef}が押されない`, conclusion: `${ctx.family}は実行されない` },
    { premise: `${ctx.family}が実行されない`, conclusion: `状態が変わらず、no_effect が ${ctx.fails} 回記録される` },
  ];
  return {
    kind: 'CONFIRM_NEVER_CLICKED',
    stepLine: step.lineIndex,
    location: actBlock(ctx.lines, step.lineIndex),
    slots,
    defaultMechanism: mechanism,
    causalChain,
    evidenceNotes: ctx.sentences.filter((s) => s.includes('モーダル') || s.includes('ダイアログ') || s.includes('フッター')),
  };
}

// F1: 探索文言が観測された画面文言に無く、ゲーム内にも存在しない。
function findLabelAbsent(ctx: AnalysisContext): Finding | null {
  for (const step of ctx.steps) {
    if (step.kind === 'other' || step.terms.length !== 1) continue;
    const term = step.terms[0];
    if (termInSeen(ctx, term)) continue;
    const absenceSentence = ctx.sentences.find((s) => s.includes(term) && /(存在しない|0件|見つからない|どこにもない)/.test(s));
    const mentioned = ctx.notesText.includes(term);
    if (!absenceSentence && mentioned) continue;
    const realLabel = ctx.notesText.match(/文言は「([^」]+)」/)?.[1] || '';
    const realAction = ctx.notesText.match(/data-action="([^"]+)"/)?.[1] || '';
    const absencePhrase = absenceSentence
      ? (/全文検索で0件/.test(absenceSentence) ? '全文検索で0件であり、ゲーム内に存在しない' : 'ゲーム内に存在しないと観測されている')
      : '観測された証拠の範囲では実在が確認できない';
    const realRef = realAction || realLabel
      ? `実在するボタンは${realAction ? ` data-action="${realAction}" で` : ''}${realLabel ? `文言は「${realLabel}」であり、` : ''}`
      : '';
    const slots: Record<string, string> = {
      term, realAction, realLabel, family: ctx.family, fails: String(ctx.fails),
    };
    const mechanism =
      `クリック対象の探索文言「${term}」は、観測された画面文言の中に無く、${absencePhrase}。` +
      `${realRef}「${term}」を探すクリックは永遠に見つからない。` +
      `そのため${ctx.family}の操作は実行されず、状態が変わらない（no_effect が ${ctx.fails} 回記録されている）。`;
    const causalChain: DiagnosisCausalLink[] = [
      { premise: `探索文言「${term}」は観測された画面文言の中に無く、${absencePhrase}`, conclusion: `「${term}」を探すクリックは対象を見つけられない` },
      { premise: `クリックが対象を見つけられない`, conclusion: `${ctx.family}の操作は実行されない` },
      { premise: `${ctx.family}の操作が実行されない`, conclusion: `状態が変わらず、no_effect が ${ctx.fails} 回記録される` },
    ];
    return {
      kind: 'LABEL_ABSENT',
      stepLine: step.lineIndex,
      location: actBlock(ctx.lines, step.lineIndex),
      slots,
      defaultMechanism: mechanism,
      causalChain,
      evidenceNotes: absenceSentence ? [absenceSentence, ...ctx.notes] : [...ctx.notes],
    };
  }
  return null;
}

// F2: テキスト一致が、同じ文言を持つ非対象の操作要素（タブ自体・売買モード切替）に当たる。
function findTermHitsNonTarget(ctx: AnalysisContext): Finding | null {
  for (const step of ctx.steps) {
    if (step.kind !== 'includes') continue;
    for (const term of step.terms) {
      if (!termInSeen(ctx, term)) continue;
      const roleSentence = ctx.sentences.find((s) => s.includes(term) && /(タブ|モード切替|切替ボタン|売買)/.test(s));
      if (!roleSentence) continue;
      const isModeToggle = /モード切替|売買/.test(roleSentence);
      const roleAction = roleSentence.match(/data-action="([^"]+)"/)?.[1] || '';
      const allActions = [...ctx.notesText.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]);
      const realAction = allActions.find((a) => a !== roleAction) || '';
      const slots: Record<string, string> = {
        term, roleAction, realAction, family: ctx.family, fails: String(ctx.fails),
      };
      let mechanism: string;
      let firstLink: DiagnosisCausalLink;
      if (isModeToggle) {
        mechanism =
          `includes の「${term}」は、商品ボタンではなく売買モード切替ボタン${roleAction ? `（data-action="${roleAction}"）` : ''}の文言に一致する。` +
          `クリックしてもモードが切り替わるだけで、${realAction ? `商品の購入ボタン（data-action="${realAction}"）` : '本来の対象ボタン'}には到達せず、何も買わない。` +
          `そのため${ctx.family}は実行されず、状態が変わらない（no_effect が ${ctx.fails} 回記録されている）。`;
        firstLink = {
          premise: `includes の「${term}」は売買モード切替ボタン${roleAction ? `（data-action="${roleAction}"）` : ''}の文言に一致する`,
          conclusion: `クリックはモード切替に当たり、本来の対象ボタンに到達しない`,
        };
      } else {
        mechanism =
          `includes の「${term}」は、パネルのタブボタン自体の文言でもある。` +
          `テキスト一致のクリックはタブボタン自体に一致し、タブを切り替えるだけで、本来の対象ボタンには到達しない。` +
          `そのため${ctx.family}は実行されず、状態が変わらない（no_effect が ${ctx.fails} 回記録されている）。`;
        firstLink = {
          premise: `includes の「${term}」はパネルのタブボタン自体の文言でもある`,
          conclusion: `クリックはタブボタン自体に当たり、本来の対象ボタンに到達しない`,
        };
      }
      const causalChain: DiagnosisCausalLink[] = [
        firstLink,
        { premise: `本来の対象ボタンに到達しない`, conclusion: `${ctx.family}は実行されない` },
        { premise: `${ctx.family}が実行されない`, conclusion: `状態が変わらず、no_effect が ${ctx.fails} 回記録される` },
      ];
      return {
        kind: 'TERM_HITS_NON_TARGET',
        stepLine: step.lineIndex,
        location: step.line.trim(),
        slots,
        defaultMechanism: mechanism,
        causalChain,
        evidenceNotes: [roleSentence, ...ctx.notes],
      };
    }
  }
  return null;
}

// F3: 「新たに現れたボタン」の先頭 [0] が、最初から配置済みの施設。
function findFirstFreshPlaced(ctx: AnalysisContext): Finding | null {
  const regionText = ctx.lines.join('\n');
  const hasFreshDiff = regionText.includes('!prev.includes') || regionText.includes('!beforeTexts') || /fresh/i.test(regionText);
  if (!hasFreshDiff) return null;
  let pickLine = -1;
  let listVar = '';
  let pickVar = '';
  for (let i = 0; i < ctx.lines.length; i++) {
    const m = ctx.lines[i].match(/(\w+)\s*=\s*(\w+)\[0\]/);
    if (m && (/fresh/i.test(m[2]) || regionText.includes('!prev.includes') || regionText.includes('!beforeTexts'))) {
      pickVar = m[1];
      listVar = m[2];
      pickLine = i;
      break;
    }
  }
  if (pickLine < 0) return null;
  const firstText = ctx.notesText.match(/先頭(?:は|が)「([^」]+)」/)?.[1]
    || (ctx.seenTexts[0] && ctx.seenTexts[0].includes('設置済み') ? ctx.seenTexts[0] : '');
  if (!firstText || !firstText.includes('設置済み')) return null;
  const facilityName = (firstText.replace(/^[^\s]+\s+/, '').match(/^([^\s・]+)/)?.[1] || firstText).trim();
  let endLine = pickLine;
  for (let i = pickLine; i < Math.min(ctx.lines.length, pickLine + 14); i++) {
    if (ctx.lines[i].includes('.click()')) { endLine = i; break; }
    endLine = i;
  }
  const slots: Record<string, string> = {
    listVar, firstFreshText: firstText, facilityName, family: ctx.family, fails: String(ctx.fails),
  };
  const mechanism =
    `新たに現れたボタンの先頭（${listVar}[0]）は、観測では繰り返し「${firstText}」であり、これは最初から配置済みの${facilityName}である。` +
    `設置済みの施設のボタンをクリックしても選択されるだけで配置にはならず、状態が変わらない（no_effect が ${ctx.fails} 回記録されている）。` +
    `欠陥は、設置済みのものを候補から除外していないことにある。`;
  const causalChain: DiagnosisCausalLink[] = [
    { premise: `新たに現れたボタンの先頭（${listVar}[0]）は繰り返し「${firstText}」であり、最初から配置済みの${facilityName}である`, conclusion: `クリックは設置済みの施設ボタンに当たる` },
    { premise: `設置済みの施設ボタンがクリックされる`, conclusion: `選択されるだけで配置にはならず、状態が変わらない（no_effect が ${ctx.fails} 回記録される）` },
    { premise: `設置済みのものが候補に残り続ける`, conclusion: `欠陥は、設置済みのものを候補から除外していないことにある` },
  ];
  return {
    kind: 'FIRST_FRESH_PREPLACED',
    stepLine: pickLine,
    location: ctx.lines.slice(pickLine, endLine + 1).join('\n').trim(),
    slots,
    defaultMechanism: mechanism,
    causalChain,
    evidenceNotes: ctx.sentences.filter((s) => s.includes('先頭')),
  };
}

// 彼女自身の診断文を、スロット付きの再利用可能な型へ一般化する。
function generalizeMechanism(mechanism: string, slots: Record<string, string>): string {
  let out = mechanism;
  const keys = Object.keys(slots).filter((k) => slots[k]).sort((a, b) => slots[b].length - slots[a].length);
  for (const key of keys) {
    out = out.split(slots[key]).join(`{{${key}}}`);
  }
  return out;
}

function fillTemplate(template: string, slots: Record<string, string>): string | null {
  const needed = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  for (const key of needed) {
    if (!slots[key]) return null;
  }
  let out = template;
  for (const key of needed) out = out.split(`{{${key}}}`).join(slots[key]);
  return out;
}

// 因果連鎖も機構文と同じスロット一般化で型として残す（P3008）。
function generalizeChain(chain: DiagnosisCausalLink[], slots: Record<string, string>): DiagnosisCausalLink[] {
  return chain.map((link) => ({
    premise: generalizeMechanism(link.premise, slots),
    conclusion: generalizeMechanism(link.conclusion, slots),
  }));
}

function fillChainTemplate(template: DiagnosisCausalLink[], slots: Record<string, string>): DiagnosisCausalLink[] | null {
  const out: DiagnosisCausalLink[] = [];
  for (const link of template) {
    const premise = fillTemplate(link.premise, slots);
    const conclusion = fillTemplate(link.conclusion, slots);
    if (premise === null || conclusion === null) return null;
    out.push({ premise, conclusion });
  }
  return out;
}

interface DiagnosisPattern {
  findingKind: string;
  selectorShape: string;
  mechanismTemplate: string;
  causalChainTemplate?: DiagnosisCausalLink[];
}

class DiagnosisTaskService {
  private ledger = new Map<string, DiagnosisAttemptRecord>();
  private sequence = 0;
  // P3022: 権威ある初回読み込みが済むまでは true。この間は台帳の
  // 保存を行わない（保留中の試行記録はメモリにだけ残る）。
  private loadPending = false;

  constructor() {
    if (isStorageAuthoritativeNow()) {
      this.load();
    } else {
      // P3022: ストレージ初期化より先に構築された。P3021 の保存時
      // 合体は「保存の瞬間に永続側が読める」ことが前提で、未ハイ
      // ドレーションの窓では読み直しも null になるため守り切れ
      // ない。読み込み自体を権威ある状態まで遅らせる。
      this.loadPending = true;
      runWhenStorageAuthoritative(() => {
        // 保留中に記録された試行を退避し、権威ある読み込みの後で
        // （読み込めた側に無いものだけ）合体させる。
        const provisional = [...this.ledger.values()];
        this.ledger.clear();
        this.load();
        let mergedProvisional = false;
        for (const record of provisional) {
          if (!this.ledger.has(record.attemptId)) {
            this.ledger.set(record.attemptId, record);
            mergedProvisional = true;
          }
        }
        this.loadPending = false;
        if (mergedProvisional) {
          this.save();
          systemLogger.info(
            'SELF_IMPROVEMENT',
            '🔐 [P3022 診断台帳] 保留中に記録された試行を、権威ある読み込みへ合体しました'
          );
        }
      });
    }
  }

  private load(): void {
    try {
      const raw = storageService.getItem(LEDGER_KEY);
      if (raw) {
        const records = JSON.parse(raw) as DiagnosisAttemptRecord[];
        for (const record of records) this.ledger.set(record.attemptId, record);
      }
    } catch {
      // 台帳が読めなくても診断自体は動かす
    }
  }

  private save(): void {
    // P3022: 権威ある読み込みが済むまでの保存は、provisional な
    // 部分像で実台帳を上書きするため拒否する（P3021 の保存時合体
    // は保存時点の再読込が前提で、その前提が崩れる窓がここ）。
    if (this.loadPending) return;
    try {
      // P3021: 保存時の再読込＋合体（P3011 の台帳保護と同型の
      // 保存側バリアント）。このサービスにはシード分岐が無く、
      // 喪失の形は「構築時に台帳が空で読めた（未ハイドレーショ
      // ン）まま診断が走り、その回の記録だけで全体を上書きする」
      // もの。存在を証明するカウンタ類も無いため、構築側ガード
      // ではなく保存側で守る：保存の瞬間に永続側を読み直し、読
      // めるなら既存記録と合体してから書くことで、構築時に読み
      // 損ねた記録を巻き込まない。永続側に値があるのに配列とし
      // て読めない場合は、上書き自体を拒否する（P3020 の拒否
      // ガードと同じ）。
      const persistedRaw = storageService.getItem(LEDGER_KEY);
      if (persistedRaw) {
        let persistedRecords: DiagnosisAttemptRecord[] | null = null;
        try {
          const parsed = JSON.parse(persistedRaw);
          if (Array.isArray(parsed)) persistedRecords = parsed as DiagnosisAttemptRecord[];
        } catch {
          persistedRecords = null;
        }
        if (persistedRecords === null) {
          systemLogger.warn(
            'SELF_IMPROVEMENT',
            '🔐 [P3021 診断台帳保護] 永続側の診断台帳が配列として読めないため、上書き保存を見送りました（メモリ上の記録は保持されます）'
          );
          return;
        }
        // 既存記録を土台に、メモリ側の記録を attemptId で重ねる
        // （同一 attemptId はメモリ側が新しい。attemptId は時刻＋
        // 連番で発行されるため、セッションを跨いだ衝突は実質ない）。
        const merged = new Map<string, DiagnosisAttemptRecord>();
        for (const record of persistedRecords) {
          if (record && typeof record.attemptId === 'string') merged.set(record.attemptId, record);
        }
        for (const record of this.ledger.values()) merged.set(record.attemptId, record);
        const records = [...merged.values()].slice(-MAX_LEDGER);
        storageService.setItem(LEDGER_KEY, JSON.stringify(records));
        return;
      }
      const records = [...this.ledger.values()].slice(-MAX_LEDGER);
      storageService.setItem(LEDGER_KEY, JSON.stringify(records));
    } catch {
      // 保存失敗は診断結果に影響させない
    }
  }

  public listAttempts(): DiagnosisAttemptRecord[] {
    return [...this.ledger.values()].sort((a, b) => a.at - b.at);
  }

  public listForCase(caseId: string): DiagnosisAttemptRecord[] {
    return this.listAttempts().filter((r) => r.caseId === caseId);
  }

  private storedPatterns(): Array<{ componentId: string; pattern: DiagnosisPattern }> {
    try {
      return reusableComponentFactoryService.list()
        .filter((c) => (c as unknown as Record<string, unknown>).componentType === 'DIAGNOSIS_PATTERN')
        .map((c) => {
          const rec = c as unknown as Record<string, unknown>;
          return { componentId: String(rec.componentId || ''), pattern: rec.diagnosisPattern as DiagnosisPattern };
        })
        .filter((x) => x.componentId && x.pattern && typeof x.pattern.mechanismTemplate === 'string');
    } catch {
      return [];
    }
  }

  private registerPattern(
    finding: Finding,
    selectorShape: string,
    caseInput: DiagnosisCaseInput,
    attemptId: string,
  ): string {
    try {
      const pattern: DiagnosisPattern = {
        findingKind: finding.kind,
        selectorShape,
        mechanismTemplate: generalizeMechanism(finding.defaultMechanism, finding.slots),
        causalChainTemplate: generalizeChain(finding.causalChain, finding.slots),
      };
      const body = {
        componentKind: 'KNOWLEDGE' as const,
        componentType: 'DIAGNOSIS_PATTERN',
        purpose: `Diagnosis pattern ${finding.kind}/${selectorShape}: defect shape learned from an own diagnosis`,
        interfaceContract: {
          input: 'defect case (evidence pack + broken code region)',
          output: 'diagnosis { location, mechanism, evidence }',
        },
        inputs: ['evidence pack', 'code region'],
        outputs: ['diagnosis'],
        prerequisites: [],
        dependencies: ['diagnosis-task'],
        appliesWhen: [caseInput.family || 'general'],
        doesNotApplyWhen: ['pattern not yet verified'],
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
        diagnosisPattern: pattern,
        sourceCaseId: caseInput.id,
        sourceAttemptId: attemptId,
      };
      const canonicalSha256 = canonicalSha256Object(body);
      const component = {
        ...body,
        componentId: `RC-KNOWLEDGE-DIAGNOSIS-${canonicalSha256.slice(0, 18)}`,
        canonicalSha256,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as KnowledgeComponentArtifact;
      reusableComponentFactoryService.storeCandidates([component]);
      return component.componentId;
    } catch {
      return '';
    }
  }

  /** ケースを受け取り、診断して台帳に記録する。出題は教材取り込み経由。 */
  public submitCase(caseInput: DiagnosisCaseInput, via: { intakeId?: string } = {}): DiagnosisAttemptRecord {
    const at = Date.now();
    this.sequence += 1;
    const attemptId = `DG-AT-${at}-${String(this.sequence).padStart(3, '0')}`;
    const inputSha256 = canonicalSha256Object(caseInput as unknown as Record<string, unknown>);
    const ctx = buildContext(caseInput);

    const findings = [
      findConfirmNeverClicked(ctx),
      findLabelAbsent(ctx),
      findTermHitsNonTarget(ctx),
      findFirstFreshPlaced(ctx),
    ].filter((f): f is Finding => f !== null);
    const priority: Record<string, number> = { CONFIRM_NEVER_CLICKED: 4, LABEL_ABSENT: 3, TERM_HITS_NON_TARGET: 2, FIRST_FRESH_PREPLACED: 1 };
    findings.sort((a, b) => (b.stepLine - a.stepLine) || ((priority[b.kind] || 0) - (priority[a.kind] || 0)));
    const finding = findings[0];

    let diagnosis: DiagnosisResult;
    let findingKind: FindingKind = '';
    let selectorShape = '';
    let patternBasisIds: string[] = [];
    let patternComponentId = '';

    if (!finding) {
      diagnosis = {
        status: 'undiagnosable',
        reason: 'no_finding_matched: selector terms, first-pick and sequence were checked against the evidence pack without a conclusive defect shape',
        at: new Date(at).toISOString(),
      };
    } else {
      findingKind = finding.kind;
      const decisiveStep = ctx.steps.find((s) => s.lineIndex === finding.stepLine);
      selectorShape = finding.kind === 'FIRST_FRESH_PREPLACED'
        ? 'first-of-fresh'
        : finding.kind === 'CONFIRM_NEVER_CLICKED'
          ? 'sequence'
          : (decisiveStep?.kind || 'other');

      // 蓄えたパターン（候補・未検証）を先に参照する。一致すれば、その
      // 文面に今回の証拠の値を入れて機構を述べる（彼女自身の過去の診断
      // の一般化であり、外部の正解ではない）。
      let mechanism = finding.defaultMechanism;
      let causalChain = finding.causalChain;
      const stored = this.storedPatterns();
      const matched = stored.find((x) => x.pattern.findingKind === finding.kind && x.pattern.selectorShape === selectorShape);
      if (matched) {
        const filled = fillTemplate(matched.pattern.mechanismTemplate, finding.slots);
        if (filled) {
          mechanism = filled;
          patternBasisIds = [matched.componentId];
          if (matched.pattern.causalChainTemplate) {
            const filledChain = fillChainTemplate(matched.pattern.causalChainTemplate, finding.slots);
            if (filledChain) causalChain = filledChain;
          }
        }
      }

      const citationCandidates: string[] = [];
      for (const note of finding.evidenceNotes) citationCandidates.push(note);
      for (const note of ctx.notes) citationCandidates.push(note);
      for (const t of ctx.seenTexts) citationCandidates.push(t);
      const evidence = pickCitation(citationCandidates, caseInput);

      if (!evidence) {
        diagnosis = {
          status: 'undiagnosable',
          reason: 'evidence_not_in_pack',
          at: new Date(at).toISOString(),
        };
      } else {
        diagnosis = {
          status: 'diagnosed',
          location: finding.location,
          mechanism,
          causalChain,
          evidence,
          at: new Date(at).toISOString(),
        };
        patternComponentId = this.registerPattern(finding, selectorShape, caseInput, attemptId);
      }
    }

    const record: DiagnosisAttemptRecord = {
      attemptId,
      caseId: caseInput.id,
      family: caseInput.family,
      targetFile: caseInput.targetFile,
      inputSha256,
      diagnosis,
      findingKind,
      selectorShape,
      patternBasisIds,
      patternComponentId,
      viaIntakeId: via.intakeId || '',
      at,
    };
    this.ledger.set(attemptId, record);
    this.save();
    systemLogger.info('SELF_IMPROVEMENT', `[診断タスク] ${attemptId} case=${caseInput.id} status=${diagnosis.status} finding=${findingKind || '-'} patternBasis=${patternBasisIds.length}`, {});
    return record;
  }
}

export const diagnosisTaskService = new DiagnosisTaskService();
