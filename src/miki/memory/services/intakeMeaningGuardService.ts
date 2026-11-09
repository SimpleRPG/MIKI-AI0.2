/**
 * P546: 取り込みの意味チェック（共有層）。
 *
 * 記録系の取り込み（決め事・事実など）は、ワードや文の形だけで
 * 発火すると、仮定の話・引用・冗談まで本人の確定事項として
 * 残してしまう。ここでは「形で候補を拾う」段と「記録する」段の
 * あいだに、意味の関門を1つ置く。P493 で意味確定を共有層に置いた
 * のと同じ発想で、判定はここに集約し、取り込み側は結果だけを見る。
 *
 * 関門は「記録しない」方向にだけ働く（安全側）。落とした文は
 * 会話の反応や調査には使える。ここで落とすのは:
 *   QUOTED_OR_HEARSAY: 引用・伝聞（他人の言葉、〜らしい）
 *   HYPOTHETICAL: 仮定・条件（もし、〜たら、〜れば）
 *   QUESTION: 疑問（〜ですか？、だろうか）
 *   JOKE: 冗談の明示（冗談、ネタ、嘘だけど）
 * 否定そのもの（「〜しないことにした」）は本人の意思として通す。
 */

export type IntakeBlockReason = 'HYPOTHETICAL' | 'QUESTION' | 'QUOTED_OR_HEARSAY' | 'JOKE';

export interface IntakeMeaningVerdict {
  ok: boolean;
  reason?: IntakeBlockReason;
}

class IntakeMeaningGuardService {
  public check(sentence: string): IntakeMeaningVerdict {
    const s = String(sentence || '').trim();
    if (!s) return { ok: true };
    if (/「[^」]*」|『[^』]*』/.test(s) || /と言っていた|と言ってた|って言って|らしいです|だそうです|とのことです|って聞いた|と聞いた/.test(s)) {
      return { ok: false, reason: 'QUOTED_OR_HEARSAY' };
    }
    if (/もし|仮に/.test(s) || /たら/.test(s) || /(?:なければ|いれば|あれば|できれば|すれば|なれば)/.test(s) || /なら[、は]/.test(s)) {
      return { ok: false, reason: 'HYPOTHETICAL' };
    }
    if (/[？?]/.test(s) || /だろうか|でしょうか|のかな|ますか|ですか/.test(s)) {
      return { ok: false, reason: 'QUESTION' };
    }
    if (/冗談|ネタとして|ウソだけど|嘘だけど/.test(s)) {
      return { ok: false, reason: 'JOKE' };
    }
    return { ok: true };
  }
}

export const intakeMeaningGuardService = new IntakeMeaningGuardService();
