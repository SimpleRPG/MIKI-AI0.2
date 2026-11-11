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
      // P749: 「誕生日っていつだっけ」の「いつ」は疑問の枠で、
      // キー（属性名）には含めない。
      .replace(/(?:は|って)?いつ$/, '')
      // P750: 「身長はどのくらい？」「体重って何キロだっけ？」の
      // 量の聞き方も疑問の枠として落とし、属性名だけをキーにする。
      .replace(/(?:は|って)?(?:どのくらい|どれくらい)$/, '')
      .replace(/(?:は|って)?何(?:キログラム|キロ|グラム|センチメートル|センチ|メートル|歳|才|匹|個)$/, '')
      // P751: 「出身ってどこだっけ？」「彼女って誰だっけ？」の
      // 場所・人の聞き方も疑問の枠として落とす。
      .replace(/(?:は|って)?(?:どこ|どちら|誰|だれ)$/, '')
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
  // P755: 状態サマリは過去のターンの写しで、訂正で無効化された
  // 事実の写しが残り続ける（「犬じゃなくて猫」と直しても、犬の
  // サマリから犬が想起に復活していた）。死んだ事実の文と重なる
  // サマリ候補は、候補に入れない。
  const normText = (t: unknown): string => String(t || '').replace(/[。．.\s、,]/g, '');
  const deadTexts = new Set<string>();
  for (const m of memories || []) {
    if (m?.source === 'user_statement' && (m?.active === false || m?.replacedBy)) {
      for (const t of [m.content, m.summary, (m as any).factSummary]) {
        const n = normText(t);
        if (n) deadTexts.add(n);
      }
    }
  }
  const seen = new Set(candidates.map((c) => c.summary));
  for (const s of stateSummaries || []) {
    const cand = candidateFromSummary(String(s));
    if (cand && !seen.has(cand.summary)) {
      const n = normText(cand.summary);
      let dead = false;
      for (const d of deadTexts) {
        if (n && (n === d || n.includes(d) || d.includes(n))) { dead = true; break; }
      }
      if (dead) continue;
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

function buildMatch(chosen: UserFactCandidate): UserFactRecallMatch {
  const topicLabel = topicLabelOf(chosen);
  const answerText =
    chosen.value && chosen.value !== chosen.entity
      ? `あなたが言っていた${topicLabel}は「${chosen.value}」だよ。`
      : `あなたが話していたのは「${chosen.summary}」だよ。`;
  return { candidate: chosen, topicLabel, answerText, reasonLabel: chosen.reasonLabel };
}

export class ConversationUserFactRecallService {
  /**
   * 本人が伝えた事実への聞き返しに、保持済みの事実で答えられるかを判定する。
   * 答えられる場合だけ一致を返し、それ以外は null（従来経路へ）。
   */
  public matchRecall(prompt: string, memories: any[], stateSummaries?: string[]): UserFactRecallMatch | null {
    if (!isRecallForm(prompt)) return null;
    const candidates = collectCandidates(memories, stateSummaries);
    if (candidates.length === 0) return null;

    // P593: 好みの聞き返し（「僕の好きなものは？」）。好みの事実は
    // 対象・属性を持たない形で取り込まれるため、通常のキー照合では
    // 引けない。値を持つ好み候補をまとめて答える。彼女自身の好み
    // （「みきの好きなものは？」）は対象外（自己照会の領分）。
    // P638: 苦手なものの聞き返し。極性（苦手・好きじゃない）を
    // 含む要約だけを対象にする。
    if (/(?:苦手なもの|苦手なこと|嫌いなもの|嫌いなこと)/.test(prompt) && !/(?:みき|ビービー|あなた|君)の/.test(prompt)) {
      const dislikes = candidates.filter((c) => c.value && /苦手|好きじゃない|嫌い/.test(c.summary));
      if (dislikes.length > 0) {
        const values = [...new Set(dislikes.map((c) => c.value as string))].slice(0, 3);
        return {
          candidate: dislikes[0],
          topicLabel: '苦手なもの',
          answerText: `前に言っていた苦手なものは「${values.join('」と「')}」だよ。`,
          reasonLabel: dislikes[0].reasonLabel,
        };
      }
    }
    // P672: 飼っている動物の聞き返し（「僕が飼ってる動物なんだっ
    // け？」）。事実は「猫を飼ってる」の形の値で取り込まれるため、
    // 好みと同じく専用の枝で引く。
    if (/(?:飼ってる|飼っている|飼ってた|ペット)/.test(prompt) && !/(?:みき|ビービー|あなた|君)の/.test(prompt)) {
      // P750: 「何匹飼ってたっけ？」には数で答える。値は
      // 「猫を2匹飼ってる」の形で、匹数の分だけ正規表現を広げる。
      if (/何(?:匹|頭|羽)/.test(prompt)) {
        for (const c of candidates) {
          const cm = String(c.value || c.summary || '').match(/(.+?)を(\d+)\s*(匹|頭|羽)/);
          if (cm) {
            return {
              candidate: c,
              topicLabel: '飼っている動物の数',
              answerText: `前に言っていた飼っている${cm[1]}は「${cm[2]}${cm[3]}」だよ。`,
              reasonLabel: c.reasonLabel,
            };
          }
        }
      }
      const pets: string[] = [];
      for (const c of candidates) {
        const m = String(c.value || c.summary || '').match(/(.+?)を(?:\d+\s*(?:匹|頭|羽))?\s*飼って/);
        if (m && m[1] && !pets.includes(m[1])) pets.push(m[1]);
      }
      if (pets.length > 0) {
        return {
          candidate: candidates[0],
          topicLabel: '飼っている動物',
          answerText: `前に言っていた飼っている動物は「${pets.slice(0, 3).join('」と「')}」だよ。`,
          reasonLabel: candidates[0].reasonLabel,
        };
      }
    }
    if (/(?:好きなもの|好きなこと|好物|好み|趣味)/.test(prompt) && !/(?:みき|ビービー|あなた|君)の/.test(prompt)) {
      // P638: 苦手の要約（「Xが苦手・好きじゃない」）は「好き」を
      // 含むため、極性で除外しないと好きとして逆に答えてしまう。
      const prefs = candidates.filter((c) => c.value && /好き|興味がある/.test(c.summary) && !/苦手|じゃない|ではない/.test(c.summary));
      if (prefs.length > 0) {
        const values = [...new Set(prefs.map((c) => c.value as string))].slice(0, 3);
        return {
          candidate: prefs[0],
          topicLabel: '好きなもの',
          answerText: `前に言っていた好きなものは「${values.join('」と「')}」だよ。`,
          reasonLabel: prefs[0].reasonLabel,
        };
      }
    }

    // P457 (E): 値からの逆引き。「逃げ場がないって何の武器だっけ？」のように
    // 保持済みの値（名前など）そのものを指す聞き返しは、値の完全一致で引く。
    const byValue = this.matchByValue(prompt, candidates);
    if (byValue) return byValue;

    const key = extractRecallKey(prompt);
    if (!key) return null;

    // P457 (E): 「AのB」分解照合。直接（対象=A・属性=B）が無ければ、
    // カテゴリ経由（値=A の事実の対象が持つ属性=B）を引く。
    // 例:「弓の名前は？」→ 値「弓」の対象=メイン武器 → その名前属性を引く。
    const decomposed = key.match(/^(.+?)の(.+)$/);
    if (decomposed) {
      const [, a, b] = decomposed;
      const direct = candidates.find((c) => c.entity === a && c.attribute === b);
      if (direct) return buildMatch(direct);
      const bridge = candidates.find((c) => c.value === a && c.entity);
      if (bridge?.entity) {
        const via = candidates.find((c) => c.entity === bridge.entity && c.attribute === b);
        if (via) return buildMatch(via);
      }
    }

    const matches = candidates.filter((c) => matchesKey(key, c));
    if (matches.length === 0) return null;
    let chosen = matches[0];
    if (/いくつ/.test(prompt)) {
      const numeric = matches.find((c) => c.value && /[0-9]/.test(c.value));
      if (numeric) chosen = numeric;
    } else if (!decomposed) {
      // P457 (E): 対象そのものへの聞き返し（「メイン武器って何だっけ？」）では、
      // 名前などの属性事実より、対象の値そのもの（属性なし→カテゴリの順）を優先する。
      const plain = matches.find((c) => !c.attribute);
      const category = matches.find((c) => c.attribute === 'カテゴリ');
      if (plain) chosen = plain;
      else if (category && chosen.attribute && chosen.attribute !== 'カテゴリ') chosen = category;
    }
    return buildMatch(chosen);
  }

  /**
   * P457 (E): 値の完全一致による逆引き。値を持つ候補に対象が結びついて
   * いるときだけ答え、対象のない候補では従来経路へ委ねる（null）。
   * 答えには対象と属性を明示し、カテゴリの事実があれば併記する。
   */
  private matchByValue(prompt: string, candidates: UserFactCandidate[]): UserFactRecallMatch | null {
    const m = prompt.trim().match(/^(.{2,24}?)(?:って|は)(?:何|なに)/);
    if (!m) return null;
    const subject = m[1]
      .replace(/^(?:じゃあ|それじゃあ|ねえ|そういえば|あのさ)[、,]?\s*/, '')
      .replace(/^(?:僕の|私の|おれの|オレの|ぼくの|自分の)/, '')
      .trim();
    if (!subject) return null;
    const hit = candidates.find((c) => c.value === subject && c.entity);
    if (!hit || !hit.entity) return null;
    const topicLabel = hit.attribute && hit.attribute !== '数値' ? `${hit.entity}の${hit.attribute}` : hit.entity;
    let answerText =
      hit.attribute && hit.attribute !== '数値'
        ? `あなたが言っていた「${hit.value}」は、${hit.entity}の${hit.attribute}だよ。`
        : `あなたが言っていた「${hit.value}」は、${hit.entity}のことだよ。`;
    const category = candidates.find((c) => c.entity === hit.entity && c.attribute === 'カテゴリ');
    if (category?.value && category.value !== hit.value) {
      answerText += `${hit.entity}のカテゴリは「${category.value}」だよ。`;
    }
    return { candidate: hit, topicLabel, answerText, reasonLabel: hit.reasonLabel };
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
