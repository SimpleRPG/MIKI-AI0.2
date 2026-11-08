import { lexicalRelationService } from './lexicalRelationService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P493: 主題理解サービス（共有層）。
 *
 * 会話も調査も「考える頭」は同じなのに、理解の段は手順ごとにバラバラ
 * だった（未知語検出は会話側だけ、主題抽出は調査側だけ）。2026-11-05
 * の事故（内部の「Claim矛盾」をそのまま検索し、特許のクレーム文献を
 * 自分の Claim の知識として取り込んだ）の根は、どの手順にも「主題は
 * 何で、この語はどの意味か」を確定する段が無かったことにある。
 *
 * このサービスは、その段を共有部品として提供する：
 *  - stripMachineFields: タスク目的文などに混ざる機械フィールド
 *    （goal= / targetPaths= / synthesisGapReason= / gapDescriptions= 等）
 *    を本文から切り離す。機械フィールドは「テキストの表面」に漏らさない。
 *  - looksLikeFieldSalad: 部品メタデータのフィールド名列挙（検索文の
 *    体を成さない構造だけの文）を検出する。
 *  - assess: 主題文を立て、要の語について「意味を知っているか」
 *    「多義語ならどの意味か（分野・伴走語）」を確定する。主題が構造
 *    だけからは立てられない場合は UNFORMABLE、要の語の意味が分から
 *    ない場合は NEEDS_MEANING_LEARNING を返し、呼び出し側は検索を
 *    発射せず意味の学習へ回す（理解できていない問いを検索しない）。
 *
 * 「人間のような理解」ではなく、理解の手順（主題を中身から立てる／
 * 語の意味を確定する／分からない語は先に学ぶ）をコードで強制する段。
 */

export type SubjectUnderstandingStatus =
  | 'UNDERSTOOD'
  | 'NEEDS_MEANING_LEARNING'
  | 'UNFORMABLE';

export interface SubjectTermAssessment {
  term: string;
  known: boolean;
  polysemous: boolean;
  senseAnchorTerms: string[];
}

export interface SubjectUnderstanding {
  status: SubjectUnderstandingStatus;
  /** 機械フィールドを除いた主題文。 */
  subjectText: string;
  terms: SubjectTermAssessment[];
  /** 意味が確定できなかった語（意味学習へ回すべき語）。 */
  unknownTerms: string[];
  /** 主題の分野（語彙ルールの FIELD で確定できた場合）。 */
  field?: string;
  /** 多義語の意味確定に使った伴走語（分野を指す語）。 */
  senseAnchorTerms: string[];
  reason: string;
}

const normalizeText = (text: string): string =>
  String(text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();

/**
 * 目的文・ギャップ文に混ざる機械フィールドの開始マーカー。最初に
 * 現れたマーカー以降は機械部として切り落とす。
 */
const MACHINE_FIELD_MARKERS = [
  ' goal=',
  '\ngoal=',
  ' targetPaths=',
  '\ntargetPaths=',
  ' synthesisGapReason=',
  ' gapDescriptions=',
  ' gapContract=',
  ' liveTargetSurface=',
  ' targetClaimIds=',
  ' requiredAssets=',
  ' synthesisGap=',
];

export function stripMachineFields(text: string): string {
  const raw = String(text || '');
  let cut = raw.length;
  for (const marker of MACHINE_FIELD_MARKERS) {
    const idx = raw.indexOf(marker);
    if (idx > 0 && idx < cut) cut = idx;
  }
  return normalizeText(raw.slice(0, cut));
}

/** 部品メタデータ由来のフィールド名（検索の主題にはならない内部語）。 */
const FIELD_NAME_TOKENS = new Set([
  'kind', 'syntaxtemplate', 'outputkinds', 'inputkinds', 'slots', 'slot',
  'diagnostic', 'result', 'input', 'name', 'call', 'syntax', 'template',
  'componentid', 'registrystatus', 'returntype', 'parameters', 'fields',
]);

/**
 * フィールド名サラダ検出：camelCase の識別子が複数あり、かつ既知の
 * フィールド名が密に並ぶ文は、部品メタデータの列挙であって主題では
 * ない。日本語の文（助詞・文末がある通常の問い）は対象にしない。
 */
export function looksLikeFieldSalad(text: string): boolean {
  const n = normalizeText(text);
  if (!n) return false;
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return false;
  let camelCase = 0;
  let fieldHits = 0;
  let commandFlags = 0;
  for (const token of tokens) {
    const bare = token.replace(/^[-]+/, '');
    if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(bare)) camelCase++;
    if (FIELD_NAME_TOKENS.has(bare.toLowerCase())) fieldHits++;
    if (token.startsWith('--')) commandFlags++;
  }
  if (camelCase >= 2 && fieldHits >= 3) return true;
  if (fieldHits >= 5) return true;
  if (commandFlags >= 1 && camelCase >= 2 && fieldHits >= 2) return true;
  return false;
}

const INTERNAL_TOKEN_SET = new Set([
  'componentid', 'registrystatus', 'unresolvedcomponentmetadata',
  'syntaxtemplate', 'inputkinds', 'outputkinds', 'kind', 'slots', 'call',
  'background-cycle-review', 'component', 'research', 'missing', 'meaning',
  'claim', 'evidence', 'gap', 'objective',
]);
const INTERNAL_ID_PATTERN = /^(?:[A-Z]{2,4}-[A-Za-z0-9][A-Za-z0-9-]{3,}|bg_[A-Za-z0-9_]+)$/i;
const EN_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were',
  'will', 'would', 'can', 'could', 'should', 'into', 'about', 'over', 'under',
  'between', 'through', 'find', 'needed', 'current', 'context', 'required',
  'official', 'specification', 'documentation', 'independent', 'source',
]);
const JP_STOP_SEGMENTS = new Set([
  'について', 'として', 'により', 'ため', 'こと', 'もの', 'これ', 'それ',
  '場合', '以上', '以下', '今回', '前回', '自分', '相手', '意味', '定義',
  '用語', 'とは', '調べる', '検索', '調査', '確認', '方法', '理由', '違い',
]);

/** 主題文から「要の語」を抜く。内部トークン・内部 ID・機能語は除く。 */
export function extractSubjectTerms(text: string): string[] {
  const normalized = normalizeText(text);
  const terms: string[] = [];
  const push = (value: string) => {
    const term = normalizeText(value);
    if (term && !terms.includes(term)) terms.push(term);
  };
  for (const [token] of normalized.matchAll(/[A-Za-z][A-Za-z0-9_$+#.-]{2,}/g)) {
    if (
      !EN_STOPWORDS.has(token.toLowerCase()) &&
      !INTERNAL_TOKEN_SET.has(token.toLowerCase()) &&
      !INTERNAL_ID_PATTERN.test(token)
    ) {
      push(token);
    }
    if (terms.length >= 14) break;
  }
  for (const m of normalized.matchAll(/[ァ-ヶー]{2,}|[一-龠々]{2,}/g)) {
    if (!JP_STOP_SEGMENTS.has(m[0])) push(m[0]);
    if (terms.length >= 22) break;
  }
  return terms.slice(0, 8);
}

class SubjectUnderstandingService {
  /**
   * 主題の理解を試みる。
   * @param rawText タスク目的文・問い・発話などの生テキスト
   * @param options.isTermKnown 語の意味を知っているかの判定（辞書サービス
   *   など手順側の知識源を渡す）。省略時は語彙ルールに載っている語だけを
   *   「知っている」として扱う（共有層は辞書実装に依存しない）。
   */
  assess(
    rawText: string,
    options: { isTermKnown?: (term: string) => boolean } = {},
  ): SubjectUnderstanding {
    const subjectText = stripMachineFields(rawText);
    const isKnown =
      options.isTermKnown ??
      ((term: string) =>
        lexicalRelationService.sensesOf(term).length > 0 ||
        lexicalRelationService.synonymsOf(term).length > 0 ||
        lexicalRelationService.hypernymsOf(term).length > 0 ||
        lexicalRelationService.translationsOf(term).length > 0);

    if (!subjectText || looksLikeFieldSalad(subjectText)) {
      const salad = looksLikeFieldSalad(subjectText);
      return {
        status: 'UNFORMABLE',
        subjectText,
        terms: [],
        unknownTerms: [],
        senseAnchorTerms: [],
        reason: salad
          ? 'フィールド名の列挙（構造）からは主題を立てられない'
          : '主題になる文が残らなかった',
      };
    }

    const termTexts = extractSubjectTerms(subjectText);
    const terms: SubjectTermAssessment[] = [];
    const unknownTerms: string[] = [];
    const senseAnchorTerms: string[] = [];
    for (const term of termTexts) {
      const senses = lexicalRelationService.sensesOf(term);
      const polysemous = senses.length >= 2;
      const anchors: string[] = [];
      if (polysemous) {
        const sense = lexicalRelationService.disambiguate(term, subjectText);
        if (sense) {
          for (const h of sense.hypernyms) if (!anchors.includes(h)) anchors.push(h);
          if (sense.enLabel && !anchors.includes(sense.enLabel)) anchors.push(sense.enLabel);
        }
      }
      for (const a of anchors) if (!senseAnchorTerms.includes(a)) senseAnchorTerms.push(a);
      const known = isKnown(term);
      if (!known) unknownTerms.push(term);
      terms.push({ term, known, polysemous, senseAnchorTerms: anchors });
    }

    const field =
      lexicalRelationService.fieldsOfText(subjectText)[0] ??
      (terms.length > 0 ? lexicalRelationService.fieldsOf(terms[0].term)[0] : undefined);

    // 意味を求める問い自体（「X 意味」「X とは」）は、未知語が主題でも
    // 止めない。それが意味学習の入口だからである。
    const isMeaningQuery = /(意味|定義|用語|とは)/.test(subjectText);
    if (
      !isMeaningQuery &&
      terms.length > 0 &&
      unknownTerms.length >= Math.ceil(terms.length / 2)
    ) {
      return {
        status: 'NEEDS_MEANING_LEARNING',
        subjectText,
        terms,
        unknownTerms,
        field,
        senseAnchorTerms,
        reason: `主題の要の語の意味が分からない: ${unknownTerms.join(', ')}`,
      };
    }

    return {
      status: 'UNDERSTOOD',
      subjectText,
      terms,
      unknownTerms,
      field,
      senseAnchorTerms,
      reason: '主題を中身から立てた',
    };
  }

  /**
   * 取り込み側の分野照合。主題の分野と文の分野が両方確定していて
   * 交わらない場合だけ false（主題と無関係な文）。どちらか不定なら
   * null（判断しない）。
   */
  fieldMismatch(subjectField: string | undefined, sentenceText: string): boolean | null {
    if (!subjectField) return null;
    const sentenceFields = lexicalRelationService.fieldsOfText(sentenceText);
    if (sentenceFields.length === 0) return null;
    return !sentenceFields.includes(subjectField);
  }

  /** デバッグ・スナップショット用に直近の判定をログへ残す。 */
  logAssessment(source: string, understanding: SubjectUnderstanding): void {
    systemLogger.info(
      'SELF_IMPROVEMENT',
      `🧠 [主題理解/${source}] 状態=${understanding.status} 主題=「${understanding.subjectText.slice(0, 60)}」` +
        (understanding.field ? ` 分野=${understanding.field}` : '') +
        (understanding.unknownTerms.length > 0
          ? ` 未知語=${understanding.unknownTerms.join(', ')}`
          : '') +
        ` 理由=${understanding.reason}`,
    );
  }
}

export const subjectUnderstandingService = new SubjectUnderstandingService();
