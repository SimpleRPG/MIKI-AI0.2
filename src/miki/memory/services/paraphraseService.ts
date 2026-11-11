import { lexicalRelationService } from './lexicalRelationService';
import { subjectUnderstandingService, extractSubjectTerms } from './subjectUnderstandingService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P495: 言い換え（生成＋意味保存チェック）。
 *
 * 目的は2つ: (1) 覚えた意味を辞書の丸写しではなく自分の言葉で
 * 言えること（自然な会話）、(2) 言い直して意味が保たれるかを
 * 自分で確かめること（理解の検証＝ハルシネーション対策）。
 * そのため生成とチェックは必ずセットで、チェックを通らない
 * 言い換えは採用せず元の文を返す。
 *
 * 生成 v1 の範囲（保守的に絞る）:
 * - PARAPHRASE 関係（方向あり: 硬い/長い → 口語/短い）の置換。
 *   動詞対は活用を合わせて置換する（利用して→使って）。
 * - 文末の口語化（である→だよ、ではない→じゃないよ 等）。
 * 同義語は方向（どちらが口語か）が型に無いため、生成には使わず
 * チェック側の「意味が保たれている」判定にだけ使う。
 */

export interface ParaphraseCheck {
  ok: boolean;
  reasons: string[];
}

export interface ParaphraseResult {
  text: string;
  changed: boolean;
  check: ParaphraseCheck;
}

interface VerbForms {
  dict: string;
  te: string;
  ta: string;
  nai: string;
  masu: string;
}

// るで終わるが五段活用する主な動詞（形だけでは一段と区別できない）。
const GODAN_RU_EXCEPTIONS = new Set([
  '帰る', '入る', '知る', '切る', '走る', '要る', '減る', '焦る', '蹴る',
  '滑る', '喋る', '限る', '握る', '練る', '散る', '参る', '罵る', '遮る',
]);
const EI_ROW_KANA = 'えけげせぜてでねへべぺめれいきぎしじちぢにひびぴみり';

function verbForms(dictForm: string): VerbForms | undefined {
  const d = (dictForm || '').trim();
  if (d.length < 2) return undefined;
  if (d === '来る') return { dict: d, te: '来て', ta: '来た', nai: '来ない', masu: '来ます' };
  if (d === 'くる') return { dict: d, te: 'きて', ta: 'きた', nai: 'こない', masu: 'きます' };
  if (d === 'する') return { dict: d, te: 'して', ta: 'した', nai: 'しない', masu: 'します' };
  if (d.endsWith('する')) {
    const stem = d.slice(0, -2);
    if (!stem) return undefined;
    return { dict: d, te: `${stem}して`, ta: `${stem}した`, nai: `${stem}しない`, masu: `${stem}します` };
  }
  if (d.endsWith('る') && d.length >= 3) {
    const before = d[d.length - 2];
    const stem = d.slice(0, -1);
    if (EI_ROW_KANA.includes(before) && !GODAN_RU_EXCEPTIONS.has(d)) {
      // 一段活用
      return { dict: d, te: `${stem}て`, ta: `${stem}た`, nai: `${stem}ない`, masu: `${stem}ます` };
    }
    // 五段（る）
    return { dict: d, te: `${stem}って`, ta: `${stem}った`, nai: `${stem}らない`, masu: `${stem}ります` };
  }
  const last = d[d.length - 1];
  const stem = d.slice(0, -1);
  const godan: Record<string, [string, string, string, string]> = {
    'う': ['って', 'った', 'わない', 'います'],
    'く': ['いて', 'いた', 'かない', 'きます'],
    'ぐ': ['いで', 'いだ', 'がない', 'ぎます'],
    'す': ['して', 'した', 'さない', 'します'],
    'つ': ['って', 'った', 'たない', 'ちます'],
    'ぬ': ['んで', 'んだ', 'なない', 'にます'],
    'ぶ': ['んで', 'んだ', 'ばない', 'びます'],
    'む': ['んで', 'んだ', 'まない', 'みます'],
  };
  const row = godan[last];
  if (!row) return undefined;
  return { dict: d, te: stem + row[0], ta: stem + row[1], nai: stem + row[2], masu: stem + row[3] };
}

function applyPair(text: string, a: string, b: string): string {
  const fa = verbForms(a);
  const fb = verbForms(b);
  if (fa && fb) {
    let out = text;
    const keys: Array<keyof VerbForms> = ['te', 'ta', 'nai', 'masu', 'dict'];
    const ordered = keys
      .map((k) => [fa[k], fb[k]] as [string, string])
      .filter(([x, y]) => x !== y && x.length >= 2)
      .sort((x, y) => y[0].length - x[0].length);
    for (const [from, to] of ordered) {
      if (out.includes(from)) out = out.split(from).join(to);
    }
    return out;
  }
  if (a.length >= 2 && text.includes(a)) return text.split(a).join(b);
  return text;
}

function casualizeEndings(text: string, forVoice = false): string {
  let out = text;
  out = out.split('ではありません。').join('じゃないよ。');
  out = out.split('ではない。').join('じゃないよ。');
  // P596: い形容詞と「たい」の直後の「です」は「だよ」にしない
  // （「嬉しいだよ」「増やしていきたいだよ」は不自然なため）。
  // 汎用の「です。→だよ。」より先に処理する。
  out = out.split('たいです。').join('たいな。');
  out = out.split('ほしいです。').join('ほしいな。');
  out = out.split('嬉しいです。').join('嬉しいよ。');
  out = out.split('楽しいです。').join('楽しいよ。');
  out = out.split('難しいです。').join('難しいよ。');
  out = out.split('ないです。').join('ないよ。');
  out = out.split('いいです。').join('いいよ。');
  out = out.split('どうですか？').join('どう？');
  out = out.split('どうですか。').join('どう。');
  // P716: い形容詞・「たい」「ない」の直後の「ですね／ですよ」は、
  // 「だ」を挟まず「です」を落とす（「気持ちがいいだね」のような
  // 崩れ防止）。汎用のですね→だね変換より先に処理する。
  out = out.replace(/([一-龠ぁ-んァ-ヶ]{0,6}?(?:いい|嬉しい|楽しい|難しい|暑い|寒い|忙しい|面白い|すごい|眠い|痛い|かゆい|重い|軽い|高い|安い|新しい|古い|近い|遠い|早い|遅い|多い|少ない|強い|弱い|明るい|暗い|広い|狭い|長い|短い|太い|細い|厚い|薄い|ほしい|たい|ない|らしい))です(ね|よ)?(?=[、。！？]|$)/g, '$1$2');
  // P506: 人格の口調として使う場合は「かもしれない→かも」を
  // 使わない。可能性の表現を落とすと意味保存チェックの
  // 否定カウントにも触れてしまうため、安全側に倒す。
  if (!forVoice) out = out.split('かもしれない。').join('かも。');
  out = out.split('である。').join('だよ。');
  // P559: 依頼・共感の丁寧な文末も口調に寄せる（意味保存チェックが
  // 通るものだけが採用される）。
  out = out.split('ないでくださいね。').join('ないでね。');
  out = out.split('てくださいね。').join('てね。');
  // P671: 遊び系の答えで残っていた丁寧形も寄せる（誘いの「ましょ
  // う」、了承の「分かりました」、感謝の「ありがとうございまし
  // た」、読点で続く文中の「ですよ、」）。いずれも丁寧さだけの
  // 違いで、意味保存チェックが通るものだけ採用される。
  out = out.split('ありがとうございました。').join('ありがとう！');
  out = out.split('ありがとうございました！').join('ありがとう！');
  out = out.split('分かりました。').join('わかったよ。');
  out = out.split('分かりました！').join('わかったよ！');
  out = out.split('分かりました、').join('わかったよ、');
  out = out.split('ましょう。').join('ましょ。');
  out = out.split('ましょう！').join('ましょ！');
  out = out.split('ですよ、').join('だよ、');
  out = out.split('ですよ！').join('だよ！');
  out = out.split('ですよ。').join('だよ。');
  // P686: 新しい受け口の答えで残っていた形（読点つきの「ですね、」、
  // 「どうしましたか？」「何ですか？」）も寄せる。
  out = out.split('どうしましたか？').join('どうしたの？');
  out = out.split('何ですか？').join('何なの？');
  out = out.split('ですね、').join('だね、');
  out = out.split('ですね。').join('だね。');
  out = out.split('です。').join('だよ。');
  out = out.split('だろう。').join('だろうね。');
  if (out.endsWith('である')) out = `${out.slice(0, -3)}だよ`;
  else if (out.endsWith('ましょう')) out = `${out.slice(0, -4)}ましょ`;
  else if (out.endsWith('たいです')) out = `${out.slice(0, -4)}たいな`;
  else if (out.endsWith('しいです')) out = `${out.slice(0, -2)}よ`;
  else if (out.endsWith('ないです')) out = `${out.slice(0, -4)}ないよ`;
  else if (out.endsWith('ですよ')) out = `${out.slice(0, -3)}だよ`;
  else if (out.endsWith('ですね')) out = `${out.slice(0, -3)}だね`;
  else if (out.endsWith('です')) out = `${out.slice(0, -2)}だよ`;
  return out;
}

function negationCount(text: string): number {
  return (text.match(/ない|ません|ありません|ずに/g) || []).length;
}

function numbersOf(text: string): string[] {
  const half = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return (half.match(/\d+(?:\.\d+)?/g) || []).sort();
}

class ParaphraseService {
  /** 意味保存チェック。生成とは独立に、任意の2文の検査にも使う。 */
  public check(originalRaw: string, candidateRaw: string): ParaphraseCheck {
    const original = (originalRaw || '').trim();
    const candidate = (candidateRaw || '').trim();
    const reasons: string[] = [];
    if (!candidate) reasons.push('言い換え結果が空');
    if (negationCount(original) !== negationCount(candidate)) {
      reasons.push('否定の数が変わっている');
    }
    if (JSON.stringify(numbersOf(original)) !== JSON.stringify(numbersOf(candidate))) {
      reasons.push('数値が変わっている');
    }
    const originalTerms = extractSubjectTerms(original);
    // 反対語の混入は、語の抽出単位に頼らず対そのものを文面で走査
    // する（「上がる」のような漢字1字＋送り仮名の動詞は、主題語の
    // 抽出では拾えないため）。
    for (const [a, b] of lexicalRelationService.antonymPairs()) {
      if (original.includes(a) && candidate.includes(b) && !original.includes(b)) {
        reasons.push(`反対の語「${b}」が混入している`);
      }
      if (original.includes(b) && candidate.includes(a) && !original.includes(a)) {
        reasons.push(`反対の語「${a}」が混入している`);
      }
    }
    if (originalTerms.length > 0) {
      // フレーズ圧縮（言い換え対 a→b）で a の中に含まれて消えた語は、
      // b が候補にあれば「置き換えられた」として覆われた扱いにする。
      const pairs = lexicalRelationService.paraphrasePairs();
      // 言い換え先 b は活用した形で現れる（終わる→終わった）ため、
      // 辞書形だけでなく活用形でも候補に含まれているかを見る。
      const pairTargetPresent = (b: string): boolean => {
        if (candidate.includes(b)) return true;
        const forms = verbForms(b);
        if (!forms) return false;
        return [forms.te, forms.ta, forms.nai, forms.masu].some((f) => candidate.includes(f));
      };
      const covered = originalTerms.filter(
        (term) =>
          candidate.includes(term) ||
          lexicalRelationService.synonymsOf(term).some((s) => candidate.includes(s)) ||
          lexicalRelationService.paraphrasesOf(term).some((p) => candidate.includes(p)) ||
          lexicalRelationService.hypernymsOf(term).some((h) => candidate.includes(h)) ||
          pairs.some(([a, b]) => (a.includes(term) || term.includes(a)) && pairTargetPresent(b)),
      );
      if (covered.length / originalTerms.length < 0.75) {
        reasons.push('主題の語が落ちている');
      }
    }
    const originalField = subjectUnderstandingService.assess(original).field;
    const candidateField = subjectUnderstandingService.assess(candidate).field;
    if (originalField && candidateField && originalField !== candidateField) {
      reasons.push('分野が変わっている');
    }
    return { ok: reasons.length === 0, reasons };
  }

  /**
   * 言い換えを生成し、意味保存チェックを通った場合だけ採用する。
   * 通らなければ元の文をそのまま返す（changed=false）。
   */
  public restate(textRaw: string, options?: { style?: 'casual' | 'plain' }): ParaphraseResult {
    const original = (textRaw || '').trim();
    if (!original) return { text: original, changed: false, check: { ok: true, reasons: [] } };
    let out = original;
    let substitutions = 0;
    const pairs = [...lexicalRelationService.paraphrasePairs()].sort((x, y) => y[0].length - x[0].length);
    for (const [a, b] of pairs) {
      if (substitutions >= 8) break;
      const next = applyPair(out, a, b);
      if (next !== out) {
        out = next;
        substitutions++;
      }
    }
    if ((options?.style ?? 'casual') === 'casual') {
      out = casualizeEndings(out);
    }
    if (out === original) {
      return { text: original, changed: false, check: { ok: true, reasons: [] } };
    }
    const check = this.check(original, out);
    if (!check.ok) {
      systemLogger.info('SELF_IMPROVEMENT', `📖 [言い換え却下] 意味保存チェックで不採用: ${check.reasons.join(' / ')}`);
      return { text: original, changed: false, check };
    }
    systemLogger.info('SELF_IMPROVEMENT', `📖 [言い換え] 「${original.slice(0, 40)}」→「${out.slice(0, 40)}」`);
    return { text: out, changed: true, check };
  }

  /**
   * P496: 文章全体（回答文）への言い換え適用。文ごとに置換のみを
   * 行い、文末の文体には触らない（口調は人格・文体サービスの領分）。
   * コード・URL・記号を含む文は対象外。チェックを通らない文は
   * 元のまま残るため、文章全体としては「安全な文だけ言い換わった」
   * 状態になる。
   */
  /**
   * P506: 人格の口調（幼いタメ口）を文末にだけ適用する。文ごとに
   * 変換し、意味保存チェックを通った文だけを採用する（通らない
   * 文は元の文体のまま）。コード・URL・記号を含む文は対象外。
   * 動詞の「ます」形は活用の誤りが入りやすいため触らない。
   */
  public applyCasualVoice(textRaw: string): ParaphraseResult {
    const original = textRaw || '';
    if (!original.trim()) return { text: original, changed: false, check: { ok: true, reasons: [] } };
    const sentences = original.split(/(?<=[。！？!?])\s*/u).filter((s) => s.length > 0);
    let changed = false;
    const out = sentences
      .map((sentence) => {
        // P559: 短い文（「大丈夫ですよ。」等）こそ口調が出るので、下限は4文字に。
        if (sentence.trim().length < 4) return sentence;
        if (/https?:\/\/|`|\{|\}|\[|\]/.test(sentence)) return sentence;
        const voiced = casualizeEndings(sentence, true);
        if (voiced === sentence) return sentence;
        const check = this.check(sentence, voiced);
        if (!check.ok) return sentence;
        changed = true;
        return voiced;
      })
      .join('');
    return { text: out, changed, check: { ok: true, reasons: [] } };
  }

  public restateProse(textRaw: string): ParaphraseResult {
    const original = textRaw || '';
    if (!original.trim()) return { text: original, changed: false, check: { ok: true, reasons: [] } };
    const sentences = original.split(/(?<=[。！？!?])\s*/u).filter((s) => s.length > 0);
    let changed = false;
    const out = sentences
      .map((sentence) => {
        if (sentence.trim().length < 8) return sentence;
        if (/https?:\/\/|`|\{|\}|\[|\]/.test(sentence)) return sentence;
        const r = this.restate(sentence, { style: 'plain' });
        if (r.changed) {
          changed = true;
          return r.text;
        }
        return sentence;
      })
      .join('');
    return { text: out, changed, check: { ok: true, reasons: [] } };
  }
}

export const paraphraseService = new ParaphraseService();
