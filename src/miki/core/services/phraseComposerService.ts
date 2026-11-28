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
// P3016: 複文の合成。文計画に関門（gate）を追加し、グラフ想起の
// 答えを複文計画（claimRecallMultiPlan）にした。文をまたいでも
// emitted（既出の全文）が条件づけに効く: 第2文の関門は第1文を含む
// 全文で採点され、接続の言い回しも前半を見て選ばれる。
// P3017: 文の合間のグラフ再参照（hooks.reconsult）。文が1つ終わる
// たびに再参照の受け口が呼ばれ、返ってきた文計画がキューの末尾に
// 足される。合成開始時点の活性化では届かなかったノードが、既出の
// 文を種にして初めて関係が見えることがある——そのための受け口。
// 再参照で入った文も通常の関門・スコア条件づけを受ける（既出と
// 重なる内容は関門で落ちる）。再参照の記録は結果の events に残る。
// P3018: 非同期合成（composeSentencesAsync）と単位の受け口
// （hooks.onUnit）。単位が出るたびに、その時点までの全文が表示側へ
// 渡り、チャット画面が文節単位で段階表示できる。合成そのもの
// （候補・スコア・順序）は同期版と同一の状態機械（ComposeRun）が
// 担い、非同期版は「単位ごとに間を置いて渡す」だけ。文字単位の
// 疑似ストリーミングではない。受け口が無ければ従来どおり同期で
// 合成して全文だけを返す。
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
// 前の文すべてに条件づけられる）。gate がある文は任意文で、
// 関門候補のスコアが 0 を超えた時だけ文全体を合成する（スコアは
// emitted 全文＝前の文すべて＋今の文の前半で計算される）。
export interface ComposeSentencePlan {
  closing: string;
  steps: ComposeStep[];
  gate?: PhraseCandidate;
}

export interface ComposeTraceStep {
  step: number;
  sentence: number;
  role: string;
  candidates: Array<{ id: string; score: number }>;
  chosenId: string | null;
  emittedAfter: string;
}

export interface ComposeTraceEvent {
  type: 'reconsult';
  afterSentence: number;
  admitted: number;
}

export interface ComposeResult {
  text: string;
  trace: ComposeTraceStep[];
  events: ComposeTraceEvent[];
}

export interface ComposeUnitInfo {
  // この単位を出した直後の全文（表示側はこれを段階表示する）。
  emitted: string;
  // 今回出た単位そのもの（BODY は予約した文末を含む）。
  unit: string;
  role: string;
  sentence: number;
}

export interface ComposeHooks {
  // 文が1つ終わるたびに呼ばれる再参照の受け口（P3017）。新しい
  // 文の計画を返せばキューの末尾に足される。返された文も通常の
  // 関門・スコア条件づけを受ける。
  reconsult?: (ctx: { emitted: string; facts: ComposeFacts; sentenceIndex: number }) => ComposeSentencePlan[] | undefined;
  // 単位が出るたびに呼ばれる受け口（P3018 の段階表示用）。同期版
  // では戻り値の Promise は待たない。非同期版では await する。
  onUnit?: (info: ComposeUnitInfo) => void | Promise<void>;
  // 非同期版で単位と単位の間に置く間隔（ms）。表示が段階として
  // 目に見えるための間隔であり、合成の内容には影響しない。
  paceMs?: number;
}

// 合成の状態機械。文を1つずつ、段を1つずつ進め、単位が出るたびに
// nextUnit() が返す。採点と順序の実装はここ1か所だけにある。
class ComposeRun {
  private queue: ComposeSentencePlan[];
  private readonly facts: ComposeFacts;
  private readonly hooks: ComposeHooks;
  private emitted = '';
  private readonly trace: ComposeTraceStep[] = [];
  private readonly events: ComposeTraceEvent[] = [];
  private sentenceIdx = -1;
  private stepIdx = 0;
  private gateDone = false;
  private sentenceActive = false;
  private reconsultUsed = 0;
  private readonly maxSentences: number;

  constructor(plans: ComposeSentencePlan[], facts: ComposeFacts, hooks: ComposeHooks = {}) {
    this.queue = [...plans];
    this.facts = facts;
    this.hooks = hooks;
    // 再参照で際限なく文が増えないための上限（当初の文＋3文まで）。
    this.maxSentences = plans.length + 3;
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

  // 文の終わりで再参照を1回かけ、返ってきた文計画をキューへ足す。
  private reconsultIfAny(): void {
    if (!this.hooks.reconsult) return;
    if (this.reconsultUsed >= 3) return;
    let extra: ComposeSentencePlan[] | undefined;
    try {
      extra = this.hooks.reconsult({ emitted: this.emitted, facts: this.facts, sentenceIndex: this.sentenceIdx });
    } catch { extra = undefined; }
    const admitted = extra && extra.length > 0 ? extra.length : 0;
    if (extra) for (const p of extra) this.queue.push(p);
    this.reconsultUsed += 1;
    this.events.push({ type: 'reconsult', afterSentence: this.sentenceIdx, admitted });
  }

  // 次の単位を出す。もう出なければ null。
  nextUnit(): ComposeUnitInfo | null {
    for (;;) {
      if (!this.sentenceActive) {
        if (this.sentenceIdx + 1 >= this.queue.length) return null;
        if (this.sentenceIdx + 1 >= this.maxSentences) return null;
        this.sentenceIdx += 1;
        this.stepIdx = 0;
        this.gateDone = false;
        this.sentenceActive = true;
      }
      const plan = this.queue[this.sentenceIdx];
      if (!this.gateDone) {
        this.gateDone = true;
        if (plan.gate) {
          const s = this.score(plan.gate);
          const pass = s > 0;
          this.record('GATE', [{ id: plan.gate.id, score: s }], pass ? plan.gate.id : null);
          if (!pass) {
            this.sentenceActive = false;
            this.reconsultIfAny();
            continue;
          }
        }
      }
      if (this.stepIdx >= plan.steps.length) {
        this.sentenceActive = false;
        this.reconsultIfAny();
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
    return { text: this.emitted, trace: this.trace, events: this.events };
  }
}

function composeSentences(plans: ComposeSentencePlan[], facts: ComposeFacts, hooks: ComposeHooks = {}): ComposeResult {
  const run = new ComposeRun(plans, facts, hooks);
  for (;;) {
    const unit = run.nextUnit();
    if (!unit) break;
    if (hooks.onUnit) {
      try {
        const r = hooks.onUnit(unit);
        if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
      } catch { /* 表示は補助経路 */ }
    }
  }
  return run.result();
}

// P3018: 非同期版。単位ごとに onUnit を await し、paceMs の間を
// 置くので、表示側は単位の境界で実際に画面を更新できる。合成の
// 中身は同期版と同一（同じ ComposeRun）。受け口が無い呼び出しは
// 従来どおり同期版でよく、こちらは段階表示が要る経路専用。
async function composeSentencesAsync(plans: ComposeSentencePlan[], facts: ComposeFacts, hooks: ComposeHooks = {}): Promise<ComposeResult> {
  const run = new ComposeRun(plans, facts, hooks);
  const pace = hooks.paceMs && hooks.paceMs > 0 ? hooks.paceMs : 0;
  for (;;) {
    const unit = run.nextUnit();
    if (!unit) break;
    if (hooks.onUnit) {
      try { await hooks.onUnit(unit); } catch { /* 表示は補助経路 */ }
    }
    if (pace > 0) await new Promise((r) => setTimeout(r, pace));
  }
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

// 連想文（第2文）の関門スコア。第1文を含む全文への条件づけ:
// 内容キーが既出なら重複として落とし、長くなりすぎたら簡潔さを優先。
function assocGateScore(ctx: ComposeStepContext, assocText: string): number {
  if (!assocText) return -10;
  let s = 2;
  const assocKeys = titleKeys(assocText).filter((k) => k.length >= 3);
  if (assocKeys.some((k) => ctx.emitted.includes(k))) s -= 3;
  if (ctx.emitted.length > 110) s -= 1;
  return s;
}

// P3016: グラフ想起の答えを複文で合成する計画。
// 第1文＝本体の Claim（開示＋本文＋検証状態で予約した文末）。
// 第2文＝連想の Claim（任意文・関門つき）。接続の言い回しは前半を
// 見て選ぶ: 第1文で既に「調べた話では」と言っていたら繰り返さない。
// 第2文の文末は連想側の検証状態で予約する（本体とは独立）。
export function claimRecallMultiPlan(facts: ComposeFacts): ComposeSentencePlan[] {
  const verified = facts.verification === 'SELF_GATED';
  const closing = verified ? '、と分かっています。' : '、とされています。';
  const assocText = String(facts.assocText || '');
  const assocVerified = facts.assocVerification === 'SELF_GATED';
  const assocClosing = assocVerified ? '、と分かっています。' : '、とされています。';
  return [
    {
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
      ],
    },
    {
      closing: assocClosing,
      gate: {
        id: 'assoc-gate',
        text: '',
        score: (ctx) => assocGateScore(ctx, assocText),
      },
      steps: [
        {
          role: 'OPENER',
          required: true,
          candidates: [
            {
              id: 'same-source',
              text: '同じ出典の話では、',
              // 続きの文として出す時だけ意味を持つ言い回し。
              score: (ctx) => (ctx.emitted ? 10 : -10),
            },
            {
              id: 'repeat-research',
              text: '前に調べた話では、',
              // 第1文で既に言った言い回しは繰り返さない。
              score: (ctx) => (ctx.emitted.includes('調べた話では') ? -5 : 3),
            },
          ],
        },
        {
          role: 'BODY',
          required: true,
          candidates: [
            {
              id: 'assoc-claim',
              text: assocText,
              score: () => (assocText ? 10 : Number.NEGATIVE_INFINITY),
            },
          ],
        },
      ],
    },
  ];
}

// P3017: 合成の途中の再参照で初めて入ってきた Claim の文計画。
// 関門は連想文と同じ規律（既出と重なれば落とす）。言い回しは
// 「関連する話」——再参照は、既に出した内容とつながる話題として
// ノードを拾うので、その関係をそのまま出す。
export function claimFollowupPlan(facts: ComposeFacts): ComposeSentencePlan[] {
  const verified = facts.verification === 'SELF_GATED';
  const closing = verified ? '、と分かっています。' : '、とされています。';
  const text = String(facts.mainText || '');
  return [{
    closing,
    gate: {
      id: 'followup-gate',
      text: '',
      score: (ctx) => {
        if (!text) return -10;
        let s = 2;
        const keys = titleKeys(text).filter((k) => k.length >= 3);
        if (keys.some((k) => ctx.emitted.includes(k))) s -= 3;
        if (ctx.emitted.length > 160) s -= 1;
        return s;
      },
    },
    steps: [
      {
        role: 'OPENER',
        required: true,
        candidates: [
          {
            id: 'related',
            text: '関連する話では、',
            score: (ctx) => (ctx.emitted ? 10 : -10),
          },
        ],
      },
      {
        role: 'BODY',
        required: true,
        candidates: [
          {
            id: 'followup-claim',
            text,
            score: () => (text ? 10 : Number.NEGATIVE_INFINITY),
          },
        ],
      },
    ],
  }];
}

export const phraseComposerService = {
  composePhraseReply,
  composeSentences,
  composeSentencesAsync,
  claimRecallPlan,
  lessonHowToPlan,
  claimRecallMultiPlan,
  claimFollowupPlan,
};
