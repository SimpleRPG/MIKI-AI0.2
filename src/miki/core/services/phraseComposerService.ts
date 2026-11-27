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
//
// P3015: 合成を「文の列」へ一般化する土台（ComposeSentencePlan /
// composeSentences）を入れ、レッスンのやり方回答（P3012
// lessonHowToAnswer）も合成に載せた。文末は文ごとに予約する。
// この段階では文は1文だけの計画が中心で、複文の計画は次段。
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

// 1文分の計画。closing は文ごとに予約する。文を列にすれば複文の
// 合成になる（emitted は全文が積み上がるので、後の文の採点は
// 前の文すべてに条件づけられる）。
export interface ComposeSentencePlan {
  closing: string;
  steps: ComposeStep[];
}

export interface ComposeTraceStep {
  step: number;
  sentence: number;
  role: string;
  candidates: Array<{ id: string; score: number }>;
  chosenId: string | null;
  emittedAfter: string;
}

export interface ComposeResult {
  text: string;
  trace: ComposeTraceStep[];
}

// 合成の状態機械。文を1つずつ、段を1つずつ進め、単位が出るたびに
// nextUnit() が返す。採点と順序の実装はここ1か所だけにある。
class ComposeRun {
  private queue: ComposeSentencePlan[];
  private readonly facts: ComposeFacts;
  private emitted = '';
  private readonly trace: ComposeTraceStep[] = [];
  private sentenceIdx = -1;
  private stepIdx = 0;
  private sentenceActive = false;

  constructor(plans: ComposeSentencePlan[], facts: ComposeFacts) {
    this.queue = [...plans];
    this.facts = facts;
  }

  private score(candidate: PhraseCandidate): number {
    try { return candidate.score({ emitted: this.emitted, facts: this.facts }); }
    catch { return Number.NEGATIVE_INFINITY; }
  }

  private record(role: string, scored: Array<{ id: string; score: number }>, chosenId: string | null): void {
    this.trace.push({
      step: this.trace.length,
      sentence: this.sentenceIdx,
      role,
      candidates: scored,
      chosenId,
      emittedAfter: this.emitted,
    });
  }

  // 次の単位を出す。もう出なければ null。
  nextUnit(): { emitted: string; unit: string; role: string; sentence: number } | null {
    for (;;) {
      if (!this.sentenceActive) {
        if (this.sentenceIdx + 1 >= this.queue.length) return null;
        this.sentenceIdx += 1;
        this.stepIdx = 0;
        this.sentenceActive = true;
      }
      const plan = this.queue[this.sentenceIdx];
      if (this.stepIdx >= plan.steps.length) {
        this.sentenceActive = false;
        continue;
      }
      const stepDef = plan.steps[this.stepIdx];
      this.stepIdx += 1;
      const scored = stepDef.candidates
        .map((c) => ({ candidate: c, id: c.id, score: this.score(c) }))
        .sort((a, b) => b.score - a.score);
      const best = scored[0];
      const threshold = stepDef.threshold ?? 0;
      let chosenId: string | null = null;
      let unit = '';
      if (best && (stepDef.required || best.score > threshold)) {
        chosenId = best.id;
        unit = stepDef.role === 'BODY' ? best.candidate.text + plan.closing : best.candidate.text;
        this.emitted += unit;
      }
      this.record(stepDef.role, scored.map((s) => ({ id: s.id, score: s.score })), chosenId);
      if (chosenId !== null && unit) {
        return { emitted: this.emitted, unit, role: stepDef.role, sentence: this.sentenceIdx };
      }
      // 見送った段は内部で消費して次の段へ。
    }
  }

  result(): ComposeResult {
    return { text: this.emitted, trace: this.trace };
  }
}

function composeSentences(plans: ComposeSentencePlan[], facts: ComposeFacts): ComposeResult {
  const run = new ComposeRun(plans, facts);
  while (run.nextUnit()) { /* 単位は捨て、全文とトレースだけ返す */ }
  return run.result();
}

function composePhraseReply(plan: ComposePlan, facts: ComposeFacts): ComposeResult {
  return composeSentences([{ closing: plan.closing, steps: plan.steps }], facts);
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

// P3015: レッスンのやり方回答（P3012 lessonHowToAnswer）の計画。
// 従来の固定文字列の組み立てと出力が一致するように作る:
// - 教師検証済み: 「教わったところでは、」＋規則＋引用（文末に予約した
//   CLOSING として付ける）。
// - 未検証: 候補である開示が OPENER に入り、引用は付けない。
export function lessonHowToPlan(facts: ComposeFacts): ComposeSentencePlan[] {
  const verified = facts.verification === 'CLAUDE_VERIFIED';
  const title = String(facts.lessonTitle || '');
  const ruleText = String(facts.ruleText || '');
  const closing = verified ? `（「${title}」というレッスンで教わりました）` : '';
  return [{
    closing,
    steps: [
      {
        role: 'OPENER',
        required: true,
        candidates: [
          {
            id: 'taught-lesson',
            text: '教わったところでは、',
            score: () => (verified ? 10 : -10),
          },
          {
            id: 'candidate-lesson',
            text: `まだ候補として教わった知識ですけど、「${title}」には、こうあります。`,
            score: () => (verified ? -10 : 10),
          },
        ],
      },
      {
        role: 'BODY',
        required: true,
        candidates: [
          {
            id: 'lesson-rule',
            text: ruleText,
            score: () => (ruleText ? 10 : Number.NEGATIVE_INFINITY),
          },
        ],
      },
    ],
  }];
}

export const phraseComposerService = {
  composePhraseReply,
  composeSentences,
  claimRecallPlan,
  lessonHowToPlan,
};
