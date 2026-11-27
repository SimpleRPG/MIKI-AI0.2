// P3014: 発話の逐次合成（sequential composition）。
//
// 設計（LAB_NOTES P3014）: LLM のような文字単位のストリーミングが
// 本質ではない。大事なのは「次の一節が、その時点の文脈・想起した
// グラフの内容・既に出した前半に条件づけられて選ばれる」こと。
// 丸ごとの定型文を1つ選ぶのではなく、文節単位でスコア選択を
// 段ごとに適用する（彼女の既存の作法＝候補＋スコア＋ゲートの、
// 文への適用）。
//
// 日本語は head-final（述語・文末が最後）なので、左から素朴に
// 積むと文末で詰む。そこで CLOSING（文末の形）は step 0 で
// 事実（検証状態など）から先に予約し、BODY は予約した文末を
// 付けて出す。文は「終わり方を決めてから」組み立てる。
// 各候補のスコアは { facts, emitted（既出の前半）} の関数であり、
// 前半に既出の語を含む連想節は減点されて落ちる（同じことを
// 二度言わない）——前半への条件づけが挙動として見える。
import { titleKeys } from '../../memory/services/teacherLessonRecallService';

export interface ComposeFacts {
  verification?: string;
  mainText?: string;
  assocText?: string;
  [key: string]: unknown;
}

export interface ComposeStepContext {
  emitted: string;
  facts: ComposeFacts;
}

export interface PhraseCandidate {
  id: string;
  text: string;
  score: (ctx: ComposeStepContext) => number;
}

export interface ComposeStep {
  role: 'OPENER' | 'BODY' | 'ASSOCIATION';
  candidates: PhraseCandidate[];
  // required な段は最高スコアの候補を必ず出す。任意の段は
  // スコアが threshold（既定 0）を超えた時だけ出す。
  required?: boolean;
  threshold?: number;
}

export interface ComposePlan {
  // step 0 で予約する文末。BODY の候補テキストの末尾に付けて出す。
  closing: string;
  steps: ComposeStep[];
}

export interface ComposeTraceStep {
  step: number;
  role: string;
  candidates: Array<{ id: string; score: number }>;
  chosenId: string | null;
  emittedAfter: string;
}

export interface ComposeResult {
  text: string;
  trace: ComposeTraceStep[];
}

function composePhraseReply(plan: ComposePlan, facts: ComposeFacts): ComposeResult {
  let emitted = '';
  const trace: ComposeTraceStep[] = [];
  plan.steps.forEach((stepDef, idx) => {
    const scored = stepDef.candidates.map((c) => {
      let s = 0;
      try { s = c.score({ emitted, facts }); } catch { s = Number.NEGATIVE_INFINITY; }
      return { candidate: c, id: c.id, score: s };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const threshold = stepDef.threshold ?? 0;
    let chosenId: string | null = null;
    if (best && (stepDef.required || best.score > threshold)) {
      chosenId = best.id;
      emitted += stepDef.role === 'BODY' ? best.candidate.text + plan.closing : best.candidate.text;
    }
    trace.push({
      step: idx,
      role: stepDef.role,
      candidates: scored.map((s) => ({ id: s.id, score: s.score })),
      chosenId,
      emittedAfter: emitted,
    });
  });
  return { text: emitted, trace };
}

// このスライスで逐次合成に載せる返答タイプ（1つだけ）:
// グラフ想起の答え（P3013 graphRecallAnswer）の組み立て計画。
// - CLOSING は検証状態で先に決める（head-final の予約）。
// - OPENER は検証状態に条件づけ（未検証なら開示を先に言う）。
// - ASSOCIATION は、既出の前半に内容キーが既に含まれていたら
//   減点して落とす（重複回避）／長くなりすぎたら落とす（簡潔さ）。
export function claimRecallPlan(facts: ComposeFacts): ComposePlan {
  const verified = facts.verification === 'SELF_GATED';
  const closing = verified ? '、と分かっています。' : '、とされています。';
  return {
    closing,
    steps: [
      {
        role: 'OPENER',
        required: true,
        candidates: [
          {
            id: 'unverified-disclosure',
            text: 'まだ裏取りはできていない話ですけど、前に調べた話では、',
            score: () => (verified ? -10 : 10),
          },
          {
            id: 'plain-research',
            text: '前に調べた話では、',
            score: () => (verified ? 10 : -10),
          },
        ],
      },
      {
        role: 'BODY',
        required: true,
        candidates: [
          {
            id: 'main-claim',
            text: String(facts.mainText || ''),
            score: () => (facts.mainText ? 10 : Number.NEGATIVE_INFINITY),
          },
        ],
      },
      {
        role: 'ASSOCIATION',
        required: false,
        threshold: 0,
        candidates: [
          {
            id: 'same-source-assoc',
            text: `同じ出典の話では、${String(facts.assocText || '')}、とされています。`,
            score: (ctx) => {
              if (!facts.assocText) return -10;
              let s = 2;
              const assocKeys = titleKeys(String(facts.assocText)).filter((k) => k.length >= 3);
              if (assocKeys.some((k) => ctx.emitted.includes(k))) s -= 3;
              if (ctx.emitted.length > 110) s -= 1;
              return s;
            },
          },
        ],
      },
    ],
  };
}

export const phraseComposerService = {
  composePhraseReply,
  claimRecallPlan,
};
