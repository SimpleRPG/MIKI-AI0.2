/**
 * P456: ユーザー発言ドメインの出口 ― 事実想起（A）と受領応答（B）。
 *
 * P452 で「本人の発言から事実を取り込んで保持する」入口はできたが、実証で
 * `recentUserFactSummaries` の読み手が全ソース中でゼロ＝想起の回答経路が
 * 存在しないことが判明した。ここはその読み手。
 *
 * 線引き（P452 と同じ）:
 * - 対象は本人の発言由来の事実（source: 'user_statement'、active で
 *   replacedBy 無し）だけ。世界の事実として断定せず、答えも根拠も
 *   「あなたが話していた内容」として提示する。検証ゲートの対象ではない。
 * - 聞き返しの形をしていて、保持済みの事実に実際に一致したときだけ答える。
 *   一致しなければ null を返し、従来経路（分からないと言う姿勢）に委ねる。
 * - セッション跨ぎ: 会話状態の要約だけでなく、永続化された記憶
 *   （MemoryItem の fact 系フィールド）からも引く。要約文字列は保険として
 *   解析して使う。
 */

export interface UserFactCandidate {
  entity?: string;
  attribute?: string;
  value?: string;
  summary: string;
  /** 根拠欄の出所表記（P452 の memoryReasonLabel と同じ形）。 */
  reasonLabel: string;
}

export interface UserFactRecallMatch {
  candidate: UserFactCandidate;
  topicLabel: string;
  answerText: string;
  reasonLabel: string;
}

/** App が当ターンの P452 intake 結果を会話コアへ渡すための形。 */
export interface UserFactIntakeSummary {
  addedSummaries: string[];
  replaced: number;
  invalidated: number;
}

const FIRST_PERSON = new Set(['僕', '私', '自分', 'おれ', 'オレ', 'ぼく', 'わたし']);

/** 聞き返しらしい形か（本判定は「キー抽出＋事実一致」が担う）。 */
function isRecallForm(prompt: string): boolean {
  return /だっけ|だったっけ|[？?]|教えて|何|なに|いくつ/.test(prompt);
}

/** B（受領）を出してはいけない、問いかけ・依頼の混ざった発話か。 */
export function looksInterrogative(text: string): boolean {
  return /(?:[？?]|ですか|ますか|でしょうか|だっけ|教えて|調べて|知りたい|聞きたい|お願い)/.test(text);
}

/**
 * 聞き返し文から照合キーを取り出す。
 * 「僕のメイン武器って何だっけ？」→「メイン武器」
 * 「じゃあ、僕の攻撃力はいくつ？」→「攻撃力」
 * 「メイン武器は何？」→「メイン武器」
 * 「僕のメイン武器を教えて」→「メイン武器」
 */
function extractRecallKey(prompt: string): string | null {
  let p = prompt.trim().replace(/[？?。！!]\s*$/, '');
  p = p.replace(/^(?:じゃあ|それじゃあ|ねえ|そういえば|あのさ)[、,]?\s*/, '');
  p = p.replace(/^(?:僕の|私の|おれの|オレの|ぼくの|自分の)/, '');
  let prev = '';
  while (p !== prev && p.length > 0) {
    prev = p;
    p = p
      .replace(/(?:って|は|の)?(?:何だっけ|なんだっけ|何だった|なんだった|何でしたっけ|何でした|何です|何ですか|何|なに)$/, '')
      .replace(/(?:は|って)?(?:いくつだった|いくつでした|いくつだっけ|いくつですか|いくつです|いくつ)$/, '')
      .replace(/(?:を)?(?:教えて|おしえて)(?:ください)?$/, '')
      .replace(/だっけ$/, '')
      .replace(/(?:は|って)$/, '')
      .trim();
  }
  return p.length >= 1 ? p : null;
}

function candidateFromMemory(m: any): UserFactCandidate | null {
  const summary = String(m?.factSummary || m?.content || '').trim();
  if (!summary) return null;
  return {
    entity: m?.factEntity ? String(m.factEntity) : undefined,
    attribute: m?.factAttribute ? String(m.factAttribute) : undefined,
    value: m?.factValue ? String(m.factValue) : undefined,
    summary,
    reasonLabel: `あなたが話していた内容: ${String(m?.content || summary).slice(0, 100)}`,
  };
}

/** 要約文字列（「XのYはZ」「XはZ」）を候補へ戻す保険的な解析。 */
function candidateFromSummary(summary: string): UserFactCandidate | null {
  const s = summary.trim();
  if (!s) return null;
  let m = s.match(/^(.+?)の(.{1,12}?)は(.+)$/);
  if (m) {
    return { entity: m[1], attribute: m[2], value: m[3], summary: s, reasonLabel: `あなたが話していた内容: ${s.slice(0, 100)}` };
  }
  m = s.match(/^(.+?)は(.+)$/);
  if (m) {
    return { entity: m[1], value: m[2], summary: s, reasonLabel: `あなたが話していた内容: ${s.slice(0, 100)}` };
  }
  return { summary: s, reasonLabel: `あなたが話していた内容: ${s.slice(0, 100)}` };
}

function collectCandidates(memories: any[], stateSummaries?: string[]): UserFactCandidate[] {
  const fromMemories: { cand: UserFactCandidate; ts: number }[] = [];
  for (const m of memories || []) {
    if (m?.source !== 'user_statement' || m?.active === false || m?.replacedBy) continue;
    const cand = candidateFromMemory(m);
    if (cand) fromMemories.push({ cand, ts: Number(m?.timestamp ?? m?.createdAt ?? 0) });
  }
  fromMemories.sort((a, b) => b.ts - a.ts);
  const candidates = fromMemories.map((x) => x.cand);
  const seen = new Set(candidates.map((c) => c.summary));
  for (const s of stateSummaries || []) {
    const cand = candidateFromSummary(String(s));
    if (cand && !seen.has(cand.summary)) {
      candidates.push(cand);
      seen.add(cand.summary);
    }
  }
  return candidates;
}

function matchesKey(key: string, c: UserFactCandidate): boolean {
  const { entity, attribute } = c;
  if (attribute && attribute !== '数値') {
    if (key === attribute) return true;
    if (entity && key === entity) return true;
    if (entity && !FIRST_PERSON.has(entity) && key === `${entity}の${attribute}`) return true;
    return false;
  }
  // 属性が数値プレースホルダ（'数値'）の事実は entity 自体が対象名。
  // 属性なしの事実（体言止め等）も entity で照合する。
  if (entity && key === entity) return true;
  return false;
}

function topicLabelOf(c: UserFactCandidate): string {
  if (c.attribute && c.attribute !== '数値') {
    if (!c.entity || FIRST_PERSON.has(c.entity)) return c.attribute;
    return `${c.entity}の${c.attribute}`;
  }
  return c.entity || c.attribute || c.summary;
}

export class ConversationUserFactRecallService {
  /**
   * 本人が伝えた事実への聞き返しに、保持済みの事実で答えられるかを判定する。
   * 答えられる場合だけ一致を返し、それ以外は null（従来経路へ）。
   */
  public matchRecall(prompt: string, memories: any[], stateSummaries?: string[]): UserFactRecallMatch | null {
    if (!isRecallForm(prompt)) return null;
    const key = extractRecallKey(prompt);
    if (!key) return null;
    const candidates = collectCandidates(memories, stateSummaries);
    const matches = candidates.filter((c) => matchesKey(key, c));
    if (matches.length === 0) return null;
    let chosen = matches[0];
    if (/いくつ/.test(prompt)) {
      const numeric = matches.find((c) => c.value && /[0-9]/.test(c.value));
      if (numeric) chosen = numeric;
    }
    const topicLabel = topicLabelOf(chosen);
    const answerText =
      chosen.value && chosen.value !== chosen.entity
        ? `あなたが言っていた${topicLabel}は「${chosen.value}」だよ。`
        : `あなたが話していたのは「${chosen.summary}」だよ。`;
    return { candidate: chosen, topicLabel, answerText, reasonLabel: chosen.reasonLabel };
  }

  /**
   * B: 当ターンに事実が取り込まれたときの受領応答の文面。
   * 取り込みが無い・要約が無い場合は null。
   */
  public buildAcknowledgementText(intake?: UserFactIntakeSummary | null): string | null {
    if (!intake) return null;
    const summaries = (intake.addedSummaries || []).map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3);
    if (summaries.length === 0) return null;
    const quoted = summaries.map((s) => `「${s}」`).join('、');
    if (intake.replaced > 0 || intake.invalidated > 0) {
      return `訂正ありがとう。今の内容は${quoted}で覚えているよ。`;
    }
    if (summaries.length === 1) {
      return `うん、${quoted}だね。覚えておいたよ。`;
    }
    return `うん、覚えておいたよ。${quoted}。`;
  }
}

export const conversationUserFactRecallService = new ConversationUserFactRecallService();
