import type { MemoryItem } from '../../../types';
import { enrichMemoryMetadata } from '../../../utils/memoryRetrieval';

/**
 * P452: 会話の理解の土台 ― ユーザー発言からの事実取り込み。
 *
 * きりあの考え「理解さえすれば数値や経緯を踏まえて返せる」に基づく取り込み口。
 * ユーザーの発言から事実・数値・経緯を決定論的に抽出し、既存の MemoryItem の
 * 枠組みに「事実候補」として保存する。新しい保存の仕組みは作らない。
 *
 * 未検証の扱いの線引き（重要）:
 * - 本人が自分のことを言った事実は、その発言自体が出所であり根拠。
 *   `source: 'user_statement'`、`approved: false` のまま保持する。
 * - 会話の文脈として「あなたが言っていた〜」と参照することは、
 *   世界の事実を断定することとは別。断定への利用・承認への昇格は
 *   既存の厳格ゲート（strictMemoryPromotionGateService）に委ね、ここでは行わない。
 * - 言い直し（同じ対象＋属性で新しい値）は訂正として扱い、旧事実を
 *   `replacedBy` で置換する（searchPipeline が最新版へ自動差し替えする既存流儀）。
 *   「AじゃなくてB」型の明示訂正では A に一致する既存事実を無効化する。
 */

export interface ExtractedFact {
  kind: 'attribute' | 'state' | 'event' | 'preference' | 'identity' | 'daily';
  /** 記憶カテゴリ。旧 autoExtract 互換分は従来カテゴリ、それ以外は 'user_fact'。 */
  category: string;
  entity?: string;
  attribute?: string;
  value?: string;
  /** 記憶の content になる正規化済み文。 */
  statement: string;
  /** 会話状態に蓄積する短い要約。 */
  summary: string;
}

export interface FactIntakeResult {
  added: MemoryItem[];
  updatedMemories: MemoryItem[];
  replaced: number;
  invalidated: number;
}

const MAX_FACTS_PER_UTTERANCE = 3;
const UNCERTAIN_RE = /かも|かもしれない|はず|と思う|気がする|たぶん|多分|おそらく/;
const REQUEST_RE = /教えて|調べて|聞きたい|知りたい|お願い/;

function isQuestion(sentence: string): boolean {
  return /[？?]\s*$/.test(sentence) || /ですか|ますか|でしょうか|なの[？?]|だっけ/.test(sentence);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[。！\n])/)
    .map((s) => s.trim().replace(/。$/, ''))
    .filter((s) => s.length >= 3);
}

/** 「僕は弓を」のように主語が混入した対象表記から、最後の「は」以降を取り出す。 */
function cleanEntity(raw: string): string {
  const trimmed = raw.trim().replace(/^(?:あと|それと|ちなみに)[、,]?/, '');
  const idx = trimmed.lastIndexOf('は');
  const entity = idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
  return entity.trim();
}

function buildSummary(entity?: string, attribute?: string, value?: string, fallback?: string): string {
  if (entity && attribute && value) return `${entity}の${attribute}は${value}`;
  if (entity && value) return `${entity}は${value}`;
  return (fallback || '').slice(0, 40);
}

const FIRST_PERSON = new Set(['僕', '私', '自分', 'おれ', 'オレ', 'ぼく', 'わたし']);

/**
 * 言い直し（訂正）の置換判定キー。
 * - 属性名が取れている事実は属性をキーにする。主語が一人称（僕・私など）の
 *   場合は主語をキーに含めない（「僕の攻撃力」と「攻撃力」の揺れを寄せる）。
 *   一人称でない対象（梟の攻撃力など）は対象もキーに含め、別対象と衝突させない。
 * - 属性が数値プレースホルダ（'数値'）の事実は、entity 自体が対象名なので
 *   属性キーとして扱う（「攻撃力は1200」→ キーは攻撃力）。
 * - 属性が無い事実（体言止め・所有など）は entity をキーにする。
 * - キーが作れない事実（出来事など）は置換の対象にしない。
 */
function factKeyOf(entity?: string, attribute?: string): string | null {
  if (attribute && attribute !== '数値') {
    if (!entity || FIRST_PERSON.has(entity)) return `attr:${attribute}`;
    return `attr:${entity}:${attribute}`;
  }
  if (attribute === '数値' && entity) return `attr:${entity}`;
  if (entity) return `entity:${entity}`;
  return null;
}

/** 旧 autoExtractMemory の4パターン（互換カテゴリで取り込む）。 */
function extractLegacy(sentence: string): ExtractedFact | null {
  let m = sentence.match(/(?:私|僕|自分|おれ|オレ)は?(.+?)(?:が好き|が作りたい|を開発したい|に興味がある)/);
  if (m && m[1]) {
    const raw = m[1].trim();
    if (raw.length > 1 && raw.length < 50) {
      const content = `${raw}が好き・興味がある`;
      return { kind: 'preference', category: 'preference', value: raw, statement: content, summary: content.slice(0, 40) };
    }
  }
  m = sentence.match(/(?:ジャンルは|好みなのは)(.+?)(?:がいい|が好き|にして)/);
  if (m && m[1]) {
    const raw = m[1].trim();
    if (raw.length > 1 && raw.length < 50) {
      const content = `${raw}のジャンルが好き`;
      return { kind: 'preference', category: 'preference', value: raw, statement: content, summary: content.slice(0, 40) };
    }
  }
  m = sentence.match(/(?:ことは|のことは)(.+?)(?:って呼んで|と呼んで|って呼ぶ)/);
  if (m && m[1]) {
    const raw = m[1].trim();
    if (raw.length > 0 && raw.length < 50) {
      return { kind: 'identity', category: 'profile', attribute: '名前・呼び名', value: raw, statement: sentence, summary: `呼び名は${raw}` };
    }
  }
  m = sentence.match(/(?:名前|呼び名)は?(.+?)(?:だよ|です|って呼んで)/);
  if (m && m[1]) {
    const raw = m[1].trim();
    if (raw.length > 0 && raw.length < 50) {
      return { kind: 'identity', category: 'profile', attribute: '名前・呼び名', value: raw, statement: sentence, summary: `呼び名は${raw}` };
    }
  }
  m = sentence.match(/(?:今日|昨日|最近)(.+?)(?:だった|したよ|があった)/);
  if (m) {
    return { kind: 'daily', category: 'chat', statement: sentence, summary: sentence.slice(0, 40) };
  }
  return null;
}

function extractFromSentence(sentence: string): ExtractedFact | null {
  if (isQuestion(sentence) || UNCERTAIN_RE.test(sentence) || REQUEST_RE.test(sentence)) return null;

  const legacy = extractLegacy(sentence);
  if (legacy) return legacy;

  // 数値属性: Xの属性は数値 / Xは数値
  let m = sentence.match(/^(.{1,24}?)の([^のはがをにへ]{1,12}?)は\s*([0-9][0-9,]*\.?[0-9]*)\s*(%|％|万|円|個|人|匹|点)?/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const attribute = m[2].trim();
    const value = m[3] + (m[4] || '');
    if (entity && attribute) {
      const statement = `${entity}の${attribute}は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, attribute, value, statement, summary: statement };
    }
  }
  m = sentence.match(/^(.{1,24}?)は\s*([0-9][0-9,]*\.?[0-9]*)\s*(%|％|万|円|個|人|匹)?(?:だ|です|だった|でした)?$/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const value = m[2] + (m[3] || '');
    if (entity && !/^(?:それ|これ|あれ|今日|昨日|今)$/.test(entity)) {
      const statement = `${entity}は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, attribute: '数値', value, statement, summary: statement };
    }
  }

  // 所有・使用: Xを使っている/装備している/持っている/連れている/プレイしている
  m = sentence.match(/^(.{1,30}?)を(使っている|使用している|装備している|持っている|連れている|プレイしている|遊んでいる)/);
  if (m) {
    const entity = cleanEntity(m[1]);
    if (entity) {
      const statement = `${entity}を${m[2]}`;
      return { kind: 'state', category: 'user_fact', entity, attribute: '使用・所持', value: entity, statement, summary: statement };
    }
  }

  // 名詞属性・状態: XのYはZだ / XはZだ
  m = sentence.match(/^(.{1,24}?)の([^のはがをにへ]{1,12}?)は(.{1,30}?)(?:だ|です|だった|でした)$/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const attribute = m[2].trim();
    const value = m[3].trim();
    if (entity && attribute && value.length >= 1 && !/^(?:い|な|の|こと|もの)$/.test(value)) {
      const statement = `${entity}の${attribute}は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, attribute, value, statement, summary: statement };
    }
  }
  m = sentence.match(/^(.{1,24}?)は(.{1,30}?)(?:だ|です|だった|でした)$/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const value = m[2].trim();
    if (
      entity &&
      value.length >= 1 &&
      !/^(?:それ|これ|あれ)$/.test(entity) &&
      !/(?:たい|ほしい|でしょう|ます)$/.test(value)
    ) {
      const statement = `${entity}は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, value, statement, summary: statement };
    }
  }
  // 体言止め: 「メイン武器は逃げ場がない」のような名詞句で終わる短い断定文。
  // 値が短く、助詞や動詞語尾で終わらない場合だけ拾い、誤抽出を抑える。
  m = sentence.match(/^(.{1,24}?)は(.{1,16}?)$/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const value = m[2].trim();
    if (
      entity &&
      value.length >= 2 &&
      !/^(?:それ|これ|あれ|今日|昨日|今|明日)$/.test(entity) &&
      !/(?:は|が|を|に|へ|の|も|と|や)$/.test(value) &&
      !/(?:じゃない|ではない|では無い|する|した|して|れる|られる|せる|させる)$/.test(value)
    ) {
      const statement = `${entity}は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, value, statement, summary: statement };
    }
  }

  // 出来事（経緯）: 文末が完了表現で終わる文は、文全体を経緯として保持する。
  if (sentence.length >= 4 && /(?:した|買った|行った|始めた|作った|倒した|クリアした|終わった|着いた)(?:よ|ね)?$/.test(sentence)) {
    return { kind: 'event', category: 'user_fact', statement: sentence, summary: sentence.slice(0, 40) };
  }

  return null;
}

export class ConversationFactIntakeService {
  /**
   * 発言文から事実候補と訂正対象を抽出する（純粋関数）。
   * invalidations は「AじゃなくてB」の A 部分で、既存事実の無効化に使う。
   */
  public extractUserFacts(text: string): { facts: ExtractedFact[]; invalidations: string[] } {
    const invalidations: string[] = [];
    let working = text.trim();
    let pendingCorrection: { entity: string; attribute: string } | null = null;

    const correction = working.match(/(?:^|[、。]\s*)(.{1,30}?)(?:じゃなくて|ではなく(?:て)?)[、,]?(.+)$/);
    if (correction) {
      const wrong = correction[1].trim();
      const wrongFact = wrong ? extractFromSentence(wrong) : null;
      if (wrongFact?.value) {
        // 無効化は値で照合する（旧事実の factValue / content と一致させる）
        invalidations.push(wrongFact.value);
        if (wrongFact.entity && wrongFact.attribute) {
          pendingCorrection = { entity: wrongFact.entity, attribute: wrongFact.attribute };
        }
      } else if (wrong) {
        invalidations.push(wrong);
      }
      working = correction[2].trim();
    }

    const facts: ExtractedFact[] = [];
    for (const sentence of splitSentences(working)) {
      if (facts.length >= MAX_FACTS_PER_UTTERANCE) break;
      const fact = extractFromSentence(sentence);
      if (fact) facts.push(fact);
    }

    // 「攻撃力は1200じゃなくて1137」のように訂正後の値だけが残る場合は、
    // 訂正前の対象＋属性を引き継いで新事実として合成する。
    if (facts.length === 0 && pendingCorrection && working.length > 0 && working.length <= 20 && !isQuestion(working)) {
      const value = working.replace(/^(?:それは|値は)/, '').replace(/(?:だ|です|だった|でした)$/, '').trim();
      if (value) {
        const statement =
          pendingCorrection.attribute === '数値'
            ? `${pendingCorrection.entity}は${value}`
            : `${pendingCorrection.entity}の${pendingCorrection.attribute}は${value}`;
        facts.push({
          kind: 'attribute',
          category: 'user_fact',
          entity: pendingCorrection.entity,
          attribute: pendingCorrection.attribute,
          value,
          statement,
          summary: statement,
        });
      }
    }
    return { facts, invalidations };
  }

  /**
   * 発言を取り込み、更新後の全記憶リストを返す。
   * 保存自体は呼び出し側（App の setMemories / storage）が担う。
   */
  public intakeFromUserText(text: string, existingMemories: MemoryItem[]): FactIntakeResult {
    const { facts, invalidations } = this.extractUserFacts(text);
    const now = Date.now();
    const updated: MemoryItem[] = existingMemories.map((m) => ({ ...m }));
    const added: MemoryItem[] = [];
    let replaced = 0;
    let invalidated = 0;

    const isUserFact = (m: MemoryItem) =>
      m.source === 'user_statement' && m.active !== false && !m.replacedBy;

    // 明示訂正: 一致する既存事実を無効化する
    for (const wrong of invalidations) {
      for (const mem of updated) {
        if (!isUserFact(mem)) continue;
        const haystack = [mem.factValue, mem.factEntity, mem.content].filter(Boolean).join(' ');
        const valueHit = Boolean(mem.factValue) && wrong.includes(String(mem.factValue));
        if (haystack.includes(wrong) || valueHit) {
          mem.active = false;
          (mem as any).invalidatedByUser = true;
          invalidated++;
        }
      }
    }

    facts.forEach((fact, index) => {
      // 同一 statement の重複は取り込まない
      if (updated.some((m) => isUserFact(m) && m.content === fact.statement)) return;

      const id = `mem_fact_${now}_${index}`;
      // destination は明示する。本人の発言が出所の事実は、出典不明の外部情報の
      // 混入防止を目的とする隔離（quarantine）の対象ではなく、通常の長期記憶に
      // 置いて文脈参照できるようにする（承認は false のままで線引きは保つ）。
      // enrichMemoryMetadata はフィールド列挙型の返却でカスタムフィールドを
      // 落とすため、fact 系フィールドは enrich の後に付け直す。
      const item: MemoryItem = {
        ...enrichMemoryMetadata(
          {
            id,
            category: fact.category,
            content: fact.statement,
            importance: 3,
            pinned: false,
            active: true,
            approved: false,
            source: 'user_statement',
            timestamp: now,
            destination: 'long_term_memory',
            tags: ['user_stated', 'unverified', fact.kind],
          } as Partial<MemoryItem> & { content: string },
          { rawUserText: text, sourceRef: 'user_chat', existingMemories: updated }
        ),
        factStatus: 'user_stated',
        factEntity: fact.entity,
        factAttribute: fact.attribute,
        factValue: fact.value,
        factSummary: fact.summary,
      };

      // 言い直し（訂正）の置換判定キー。「僕の攻撃力は1137」と「攻撃力は1200」の
      // ように主語の有無で entity が揺れても、属性名が取れている場合は属性を
      // キーにして同一事実として寄せる。属性が数値プレースホルダ（'数値'）の
      // ときは entity をキーにする。
      if (factKeyOf(fact.entity, fact.attribute)) {
        const key = factKeyOf(fact.entity, fact.attribute);
        const old = updated.find(
          (m) => isUserFact(m) && factKeyOf(m.factEntity, m.factAttribute) === key
        );
        if (old) {
          if (old.factValue === fact.value) return;
          old.replacedBy = id;
          replaced++;
        }
      }

      added.push(item);
      updated.unshift(item);
    });

    return { added, updatedMemories: updated, replaced, invalidated };
  }
}

export const conversationFactIntakeService = new ConversationFactIntakeService();
