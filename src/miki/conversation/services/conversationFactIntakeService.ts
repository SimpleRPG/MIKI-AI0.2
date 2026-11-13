import type { MemoryItem } from '../../../types';
import { enrichMemoryMetadata } from '../../../utils/memoryRetrieval';
import { scopedVersionedMemoryService } from '../../memory/services/scopedVersionedMemoryService';
import { projectNotebookService } from '../../memory/services/projectNotebookService';
import { intakeMeaningGuardService } from '../../memory/services/intakeMeaningGuardService';
import { roleplaySessionService } from './roleplaySessionService';
import { personaProfileService } from './personaProfileService';
import { userKnowledgeProfileService } from './userKnowledgeProfileService';
import { selfPreferenceService } from '../../selfAwareness/services/selfPreferenceService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { utteranceFeatureService } from '../../memory/services/utteranceFeatureService';
import { systemLogger } from '../../../services/systemLogger';
import { storageService } from '../../../services/storageService';
import { pendingSlotService } from '../../memory/services/pendingSlotService';

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

/**
 * P457 (E): 文末の終助詞（よ・ね）だけを落とす前処理。
 * 「僕のメイン武器は弓だよ」→「…弓だ」のように、抽出パターンが想定する
 * 文末形に寄せる。「〜だよ」が値に残る問題（P456 の留保）と、文末「よ」で
 * 数値パターンに当たらず言い直し置換が失敗する問題の共通の原因対策。
 * 述語そのもの（「倒せないんだ」等）は壊さない。
 */
function stripSentenceTail(sentence: string): string {
  let s = sentence;
  while (/(?:よ|ね)$/.test(s) && s.length > 2) {
    s = s.slice(0, -1);
  }
  return s;
}

/**
 * P457 (E): 値の正規化。抽出された値の末尾に残った丁寧・終助詞を落とす
 * （「1,200だよ」→「1,200」、「逃げ場がないよ」→「逃げ場がない」）。
 */
function normalizeValue(raw: string): string {
  let v = raw.trim();
  for (let i = 0; i < 3; i++) {
    const next = v.replace(/(?:だよ|ですよ|だね|ですね|でした|だった|です|だ|よ|ね)$/, '').trim();
    if (next === v || next.length === 0) break;
    v = next;
  }
  return v;
}

/**
 * P457 (E): 対象表記の正規化。先行する一人称所有（僕の・私の等）を落とし、
 * 「僕のメイン武器」と「メイン武器」の表記ゆれを寄せる。
 * 「僕」単体（一人称そのものが対象）は落とさない。
 */
function normalizeEntity(entity: string): string {
  const m = entity.match(/^(?:僕の|私の|おれの|オレの|ぼくの|自分の)(.+)$/);
  return m ? m[1].trim() : entity;
}

/**
 * P457 (E): 雑談定型だけの文は事実として取り込まない。
 * 「おはよう」が体言止めで「お／よう」に誤分割される過剰抽出の対策。
 * 定型句そのもの、または定型句＋終助詞のみの文を対象にする。
 */
const CASUAL_ONLY_RE = /^(?:おはよう(?:ございます)?|こんにちは|こんばんは|ありがとう(?:ございます)?|お疲れ様(?:です)?|おつかれさま|ただいま|いってきます|おやすみ(?:なさい)?|元気出た|分かった|わかった|そっか|そうなんだ|なるほど|疲れた|つかれた)(?:よ|ね|な)?$/;

/** 「僕は弓を」のように主語が混入した対象表記から、最後の「は」以降を取り出す。 */
function cleanEntity(raw: string): string {
  const trimmed = raw.trim().replace(/^(?:あと|それと|ちなみに)[、,]?/, '');
  const idx = trimmed.lastIndexOf('は');
  const entity = idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
  return normalizeEntity(entity.trim());
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

/**
 * P816: 属性なし事実の「述語の型」。名詞だけの値（学生・会社員）は
 * 'N'、動詞句の値（猫を飼ってる・東京に住んでる）は動詞の語幹で
 * 寄せる。型の違う文は別の事実なので、言い直し（置換）の対象に
 * しない（「猫を飼ってる」の後に「学生だよ」と言っても、飼育の
 * 事実は消えない）。
 */
function attrlessFrameOf(value?: string): string {
  const v = String(value || '').replace(/(だよ|です|ます|だ|よ|ね)+$/, '');
  const m = v.match(/([一-龠ァ-ヶー]{1,4}?)(?:って|んで|いて|して|て)(?:いる|いた|る|た)?$/)
    || v.match(/([一-龠ァ-ヶー]{1,4}?)(?:った|んだ|いた|した|えた|れた)$/);
  return m ? `V:${m[1]}` : 'N';
}

/**
 * P457 (E): 同一発言内で「名前」と「カテゴリ」を同じ対象に結びつける後処理。
 * - 値に『…』を含む同格形（「コンパウンドボウ『逃げ場がない』」）は、
 *   カテゴリ部の事実（属性='カテゴリ'）と名前の事実（属性='名前'）に分ける。
 * - 同じ対象に 名前 の事実と、属性なしの値の事実が両方ある場合、値の事実を
 *   その対象のカテゴリ（属性='カテゴリ'）として確定させる。
 * これにより想起側は「対象の名前」「対象のカテゴリ」「カテゴリから対象」
 * 「名前から対象」の4方向で引ける形になる。
 */
function linkNameAndCategory(facts: ExtractedFact[]): void {
  // 『』同格の分割
  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];
    if (!fact.value || !fact.entity || fact.attribute === '名前') continue;
    const apposition = fact.value.match(/^(.{1,20}?)『(.{1,30}?)』$/);
    if (!apposition) continue;
    const category = apposition[1].trim();
    const name = apposition[2].trim();
    if (!category || !name) continue;
    fact.attribute = 'カテゴリ';
    fact.value = category;
    fact.statement = `${fact.entity}のカテゴリは${category}`;
    fact.summary = fact.statement;
    facts.push({
      kind: 'attribute',
      category: 'user_fact',
      entity: fact.entity,
      attribute: '名前',
      value: name,
      statement: `${fact.entity}の名前は${name}`,
      summary: `${fact.entity}の名前は${name}`,
    });
  }
  // 名前がある対象の、属性なしの値の事実をカテゴリとして確定させる
  const entitiesWithName = new Set(
    facts.filter((f) => f.attribute === '名前' && f.entity).map((f) => f.entity as string)
  );
  if (entitiesWithName.size === 0) return;
  for (const fact of facts) {
    if (!fact.entity || !entitiesWithName.has(fact.entity)) continue;
    if (fact.attribute || !fact.value) continue;
    if (fact.kind !== 'attribute') continue;
    fact.attribute = 'カテゴリ';
    fact.statement = `${fact.entity}のカテゴリは${fact.value}`;
    fact.summary = fact.statement;
  }
}

/** 旧 autoExtractMemory の4パターン（互換カテゴリで取り込む）。 */
/**
 * P692: 「Xの名前は〜」「Xのことは〜って呼んで」の X（持ち主）を返す。
 * 持ち主が相手本人（一人称）のときと、持ち主が無いときは null
 * （＝本人の identity として扱う従来経路）。
 */
function nameOwnerOf(sentence: string, marker: string): string | null {
  const idx = sentence.indexOf(marker);
  if (idx <= 0) return null;
  const prefix = sentence.slice(0, idx).replace(/[、,。\s]+$/g, '');
  const m = prefix.match(/(.+?)の$/);
  if (!m) return null;
  const owner = m[1].trim().split(/[、,]/).pop()?.trim() || '';
  if (!owner || owner.length > 12) return null;
  if (/^(?:僕|私|おれ|俺|自分|あたし|わたし)$/.test(owner)) return null;
  return owner;
}

function extractLegacy(sentence: string): ExtractedFact | null {
  // P638: 苦手・好きじゃないも好みとして取り込む（極性つき）。
  // 好きのパターンより先に見ること（「が好きじゃない」が
  // 「が好き」に部分一致して、逆の意味で覚える事故を防ぐ）。
  let m = sentence.match(/(?:私|僕|自分|おれ|オレ)は?(.+?)(?:が苦手|が嫌い|が好きじゃない|が好きではない|は苦手)/);
  if (m && m[1]) {
    const raw = m[1].trim();
    if (raw.length > 1 && raw.length < 50) {
      const content = `${raw}が苦手・好きじゃない`;
      return { kind: 'preference', category: 'preference', value: raw, statement: content, summary: content.slice(0, 40) };
    }
  }
  m = sentence.match(/(?:私|僕|自分|おれ|オレ)は?(.+?)(?:が好き|が作りたい|を開発したい|に興味がある)/);
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
      // P692: 「猫のことはモチって呼んで」のように持ち主が付いた
      // 呼び名は、相手本人の identity スロットに入れない。
      const owner = nameOwnerOf(sentence, 'ことは');
      if (owner) {
        return { kind: 'identity', category: 'profile', attribute: `${owner}の名前`, value: raw, statement: sentence, summary: `${owner}の名前は${raw}` };
      }
      return { kind: 'identity', category: 'profile', attribute: '名前・呼び名', value: raw, statement: sentence, summary: `呼び名は${raw}` };
    }
  }
  m = sentence.match(/(?:名前|呼び名)は?(.+?)(?:だよ|です|って呼んで)/);
  if (m && m[1]) {
    const raw = m[1].trim();
    if (raw.length > 0 && raw.length < 50) {
      // P692: 「猫の名前はモチ」は猫の名前であって、相手本人の
      // 名前ではない。持ち主つきは持ち主の属性として持つ
      // （本人の名前スロットを別者の名前で汚さない）。
      const owner = nameOwnerOf(sentence, '名前');
      if (owner) {
        return { kind: 'identity', category: 'profile', attribute: `${owner}の名前`, value: raw, statement: sentence, summary: `${owner}の名前は${raw}` };
      }
      return { kind: 'identity', category: 'profile', attribute: '名前・呼び名', value: raw, statement: sentence, summary: `呼び名は${raw}` };
    }
  }
  m = sentence.match(/(?:今日|昨日|最近)(.+?)(?:だった|したよ|があった)/);
  if (m) {
    return { kind: 'daily', category: 'chat', statement: sentence, summary: sentence.slice(0, 40) };
  }
  return null;
}

/**
 * P457 (E): 困りごと系の状態述語。状態・出来事文の取り込み対象を、
 * 助言の材料になる経緯文に絞るための限定リスト。
 */
const TROUBLE_PREDICATE_RE = /硬い|硬く|倒せない|倒せていない|勝てない|死ぬ|死んじゃう|死んでしまう|落ちる|落ちちゃう|進めない|クリアできない|届かない|足りない|間に合わない|勝てていない/;

function extractFromSentence(rawSentence: string, contextEntity?: string): ExtractedFact | null {
  const sentence = stripSentenceTail(rawSentence);
  if (isQuestion(sentence) || UNCERTAIN_RE.test(sentence) || REQUEST_RE.test(sentence)) return null;
  // P457 (E): 雑談定型だけの文は事実化しない（「おはよう」の誤抽出対策）。
  if (CASUAL_ONLY_RE.test(sentence)) return null;

  const legacy = extractLegacy(sentence);
  if (legacy) return legacy;

  // P457 (E): 名前属性。対象と名前を別属性として、同じ対象に結びつける。
  // 「Xの名前はV」は汎用の名詞属性より先に、属性='名前' として取る。
  let m = sentence.match(/^(.{1,24}?)の名前は(.{1,30}?)(?:だ|です|だった|でした)?$/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const value = normalizeValue(m[2]);
    if (entity && value) {
      const statement = `${entity}の名前は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, attribute: '名前', value, statement, summary: statement };
    }
  }
  // 「名前はV」だけの文は、同一発言内の直前の対象への名前として結びつける。
  // 対象の文脈が無い場合は従来どおり entity='名前' の単独事実にする。
  m = sentence.match(/^名前は(.{1,30}?)(?:だ|です|だった|でした)?$/);
  if (m) {
    const value = normalizeValue(m[1]);
    if (value) {
      const entity = contextEntity || '名前';
      const statement = contextEntity ? `${entity}の名前は${value}` : `名前は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, attribute: '名前', value, statement, summary: statement };
    }
  }

  // P749: 日付の値（3月5日・2020年1月2日など）は、数値属性より
  // 先に丸ごと取る。数値パスだと「3」だけが値になって日付が
  // 壊れる（誕生日が「3」として記録されていた）。
  m = sentence.match(/^(.{1,24}?)の([^のはがをにへ]{1,12}?)は\s*(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日|\d{1,2}月|\d{1,2}日)(?:だ|です|だった|でした|だよ|ですよ)?$/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const attribute = m[2].trim();
    const value = m[3];
    if (entity && attribute) {
      const statement = `${entity}の${attribute}は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, attribute, value, statement, summary: statement };
    }
  }

  // 数値属性: Xの属性は数値 / Xは数値
  // P750: 単位は長さ・重さ・年齢のものも丸ごと値に入れる
  // （「身長は175」「体重は60」のように単位が落ちると、後で
  // 何の数字か分からなくなるため）。
  m = sentence.match(/^(.{1,24}?)の([^のはがをにへ]{1,12}?)は\s*([0-9][0-9,]*\.?[0-9]*)\s*(センチメートル|キログラム|センチ|メートル|キロ|グラム|トン|％|%|万|円|個|人|匹|点|歳|才)?/);
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

  // 所有・使用（は形）: XはYを使っている/使ってる 等。
  // 対象 X と対象物 Y を分けて保持し、言い直し置換のキーも X で効かせる。
  m = sentence.match(/^(.{1,24}?)は(.{1,30}?)を(使っている|使用している|装備している|持っている|連れている|プレイしている|遊んでいる|使ってる|装備してる|連れてる)/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const value = normalizeValue(m[2]);
    if (entity && value) {
      const verb = /ってる/.test(m[3]) ? m[3].replace(/てる$/, 'ている') : m[3];
      const statement = `${entity}は${value}を${verb}`;
      return { kind: 'state', category: 'user_fact', entity, attribute: '使用・所持', value, statement, summary: statement };
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
    const value = normalizeValue(m[3]);
    if (entity && attribute && value.length >= 1 && !/^(?:い|な|の|こと|もの)$/.test(value)) {
      // P457 (E): 持ち主が一人称の場合（「僕のメイン武器は弓」）、対象は
      // attribute 側にある。対象を entity に組み替えて保持し、「メイン武器の
      // 名前は〜」形（対象=entity・属性=名前）と保持形を揃える。数値属性
      // （「僕の攻撃力は1,137」）は従来形（持ち主=entity・属性=項目名）を維持。
      if (FIRST_PERSON.has(entity)) {
        const statement = `${attribute}は${value}`;
        return { kind: 'attribute', category: 'user_fact', entity: attribute, value, statement, summary: statement };
      }
      const statement = `${entity}の${attribute}は${value}`;
      return { kind: 'attribute', category: 'user_fact', entity, attribute, value, statement, summary: statement };
    }
  }
  m = sentence.match(/^(.{1,24}?)は(.{1,30}?)(?:だ|です|だった|でした)$/);
  if (m) {
    const entity = cleanEntity(m[1]);
    const value = normalizeValue(m[2]);
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
    const value = normalizeValue(m[2]);
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

  // P457 (E): 状態・出来事（経緯）文。「Xが硬くて倒せない」「Xがすぐ死ぬ」の
  // ような困りごとは、助言の材料として文全体を保持する。述語を限定リストに
  // 絞り、対象（主語）だけを持たせる。置換の対象にはしない（intake 側で
  // kind を見て除外する）。
  m = sentence.match(/^(.{1,20}?)が(.{2,34})$/);
  if (m && TROUBLE_PREDICATE_RE.test(m[2])) {
    const entity = cleanEntity(m[1]);
    if (entity && !/^(?:それ|これ|あれ)$/.test(entity)) {
      return { kind: 'state', category: 'user_fact', entity, statement: sentence, summary: sentence.slice(0, 40) };
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
  public extractUserFacts(text: string): { facts: ExtractedFact[]; invalidations: string[]; correctionPair?: { wrong: string; right: string } } {
    const invalidations: string[] = [];
    let working = text.trim();
    let pendingCorrection: { entity: string; attribute?: string } | null = null;
    let correctionPair: { wrong: string; right: string } | undefined;

    // P768: 予定の変更文（「明日の予定、歯医者じゃなくて美容院に
    // 変えた」）は事実の訂正ではない。予定台帳側で処理するので、
    // ここでは訂正として読まない。
    const isPlanChange = /(?:予定|予約|約束)/.test(working) && /(?:変えた|変更)/.test(working)
      && /(?:明後日|明日|あした|今日|今夜|今週|来週|再来週|週末|今度|(?:来週の|今週の)?[月火水木金土日]曜日|\d{1,2}月\d{1,2}日)/.test(working);
    const correction = isPlanChange ? null : working.match(/(?:^|[、。]\s*)(.{1,30}?)(?:じゃなくて|ではなく(?:て)?)[、,]?(.+)$/);
    if (correction) {
      // P708: 「ごめん、犬じゃなくて猫だった」では、誤り側の切り出しに
      // 「ごめん、」まで含まれて無効化が一致しなかった。区切りの
      // 後ろ側だけを誤りとする。
      const wrong = (correction[1].split(/[、。]/).pop() || correction[1]).trim();
      const wrongFact = wrong ? extractFromSentence(wrong) : null;
      if (wrongFact?.value) {
        // 無効化は値で照合する（旧事実の factValue / content と一致させる）
        invalidations.push(wrongFact.value);
        if (wrongFact.entity) {
          pendingCorrection = { entity: wrongFact.entity, attribute: wrongFact.attribute };
        }
      } else if (wrong) {
        invalidations.push(wrong);
      }
      working = correction[2].trim();
      // P708: 訂正ペア（誤り→正しい値）を記録する。誤り側が裸の値
      // （「犬じゃなくて猫」）だと通常の抽出では新事実が作れないため、
      // 取り込み側で旧事実の枠に正しい値を差し込む材料にする。
      const rightSentence = splitSentences(working)[0] || '';
      const right = normalizeValue(rightSentence.replace(/^(?:それは|値は)/, ''));
      if (wrong && right && right.length <= 20 && right !== wrong) {
        correctionPair = { wrong, right };
      }
    }

    // P715: 「猫を飼ってるよ、名前はモチ」のように、名前の節が読点で
    // 繋がっている場合は文として切り分ける（従来は飼っている事実の
    // 値に名前の節まで飲み込まれ、名前が取り込まれなかった）。
    working = working.replace(/、(?=(?:名前|呼び名)は)/g, '。');

    const facts: ExtractedFact[] = [];
    // P457 (E): 同一発言内の対象の文脈。「名前はV」のような省略文を、
    // 直前に出た対象へ結びつけるために使う。
    let contextEntity: string | undefined;
    for (const sentence of splitSentences(working)) {
      if (facts.length >= MAX_FACTS_PER_UTTERANCE) break;
      // P800: 裸の否定（「僕の身長は170センチじゃない」）は、
      // 数値パスが否定を落として「170センチ」という事実を
      // 作ってしまう事故の元。否定された値は事実として作らず、
      // 既存の一致事実の無効化として扱う（訂正と同じ出口）。
      const bareNeg = sentence.match(/^(.{1,24}?)の([^のはがをにへ]{1,12}?)は\s*([0-9][0-9,.]*)\s*(センチメートル|キログラム|センチ|メートル|キロ|グラム|トン|％|%|万|円|個|人|匹|点|歳|才)?\s*(?:じゃない|ではない|じゃありません|ではありません)(?:よ|ね|です)?[。！!]?$/);
      if (bareNeg) {
        const ent = cleanEntity(bareNeg[1]);
        const val = bareNeg[3].replace(/,/g, '') + (bareNeg[4] || '');
        if (ent) invalidations.push(`${ent}の${bareNeg[2].trim()}は${val}`);
        continue;
      }
      // P804: 名前の否定（「僕の名前はタロウじゃない」）も、名前の
      // 値として「タロウじゃない」を登録してしまう事故の元。
      // 事実を作らず、否定された名前の無効化として扱う。
      const nameNeg = sentence.match(/^(?:(.{1,24}?)の)?名前は(.{1,30}?)(?:じゃない|ではない|じゃありません|ではありません)(?:よ|ね)?[。！!]?$/);
      if (nameNeg) {
        const ent = cleanEntity(nameNeg[1] || '僕');
        if (ent) invalidations.push(`${ent}の名前は${nameNeg[2].trim()}`);
        continue;
      }
      // P804: 複合形「名前はAじゃないよ、Bだよ」は、否定側を無効化し、
      // 肯定側だけを通常の名前取り込みに回す（全体を1つの値として
      // 登録してしまう事故を防ぐ）。
      const nameNegCompound = sentence.match(/^(?:(.{1,24}?)の)?名前は(.{1,30}?)(?:じゃない|ではない)(?:よ|ね)?[、,](.+?)(?:だよ|です)?$/);
      if (nameNegCompound) {
        const ent = cleanEntity(nameNegCompound[1] || '僕');
        if (ent) invalidations.push(`${ent}の名前は${nameNegCompound[2].trim()}`);
        const affirmedFact = extractFromSentence(`${ent}の名前は${nameNegCompound[3].trim()}`, contextEntity);
        if (affirmedFact && intakeMeaningGuardService.check(sentence).ok) {
          facts.push(affirmedFact);
          if (affirmedFact.entity && affirmedFact.entity !== '名前' && !FIRST_PERSON.has(affirmedFact.entity)) contextEntity = affirmedFact.entity;
        }
        continue;
      }
      // P804: 一般の属性でも同じ形を処理する。「XのYはAじゃない」は
      // 無効化のみ、「XのYはAじゃないよ、Bだよ」は否定側を無効化して
      // 肯定側だけを取り込む（値を「Aじゃないよ、B」にしない）。
      const attrNeg = sentence.match(/^(.{1,24}?)の(.{1,16}?)は(.{1,30}?)(?:じゃない|ではない|じゃありません|ではありません)(?:よ|ね)?[。！!]?$/);
      if (attrNeg && attrNeg[2].trim() !== '名前') {
        const ent = cleanEntity(attrNeg[1]);
        if (ent) invalidations.push(`${ent}の${attrNeg[2].trim()}は${attrNeg[3].trim()}`);
        continue;
      }
      const attrNegCompound = sentence.match(/^(.{1,24}?)の(.{1,16}?)は(.{1,30}?)(?:じゃない|ではない)(?:よ|ね)?[、,](.+?)(?:だよ|です)?$/);
      if (attrNegCompound && attrNegCompound[2].trim() !== '名前') {
        const ent = cleanEntity(attrNegCompound[1]);
        if (ent) invalidations.push(`${ent}の${attrNegCompound[2].trim()}は${attrNegCompound[3].trim()}`);
        const affirmedFact = extractFromSentence(`${ent}の${attrNegCompound[2].trim()}は${attrNegCompound[4].trim()}だ`, contextEntity);
        if (affirmedFact && intakeMeaningGuardService.check(sentence).ok) {
          facts.push(affirmedFact);
          if (affirmedFact.entity && affirmedFact.entity !== '名前' && !FIRST_PERSON.has(affirmedFact.entity)) contextEntity = affirmedFact.entity;
        }
        continue;
      }
      const fact = extractFromSentence(sentence, contextEntity);
      if (fact) {
        // P546: 仮定・引用・伝聞・冗談の文から拾えた形でも、本人の
        // 確定した事実としては取り込まない（共有層の意味チェック）。
        if (!intakeMeaningGuardService.check(sentence).ok) continue;
        facts.push(fact);
        // 一人称そのもの（「僕の攻撃力は…」の数値事実など）は対象の文脈にしない。
        if (fact.entity && fact.entity !== '名前' && !FIRST_PERSON.has(fact.entity)) contextEntity = fact.entity;
      }
    }
    linkNameAndCategory(facts);
    // P715: 同じ発言に「Xを飼ってる」と裸の「名前はV」がある場合、
    // その名前は本人の名前ではなく、飼っている動物の名前として
    // 結びつける（本人の名前スロットを汚さない）。
    {
      const petFact = facts.find((f) => /(?:を飼って|を飼育)/.test(String(f.value || '')));
      const animal = petFact ? String(petFact.value).match(/^(.{1,8}?)を(?:飼って|飼育)/)?.[1] : undefined;
      const bareName = facts.find((f) => f.attribute === '名前・呼び名' || (f.entity === '名前' && f.attribute === '名前'));
      if (animal && bareName) {
        bareName.entity = animal;
        bareName.attribute = '名前';
        bareName.statement = `${animal}の名前は${bareName.value}`;
        bareName.summary = bareName.statement;
      }
    }

    // 「攻撃力は1200じゃなくて1137」のように訂正後の値だけが残る場合は、
    // 訂正前の対象＋属性を引き継いで新事実として合成する。
    if (facts.length === 0 && pendingCorrection && working.length > 0 && working.length <= 20 && !isQuestion(working)) {
      const value = normalizeValue(working.replace(/^(?:それは|値は)/, ''));
      if (value) {
        const statement =
          !pendingCorrection.attribute || pendingCorrection.attribute === '数値'
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
    return { facts, invalidations, correctionPair };
  }

  /**
   * 発言を取り込み、更新後の全記憶リストを返す。
   * 保存自体は呼び出し側（App の setMemories / storage）が担う。
   */
  /**
   * P518: 「<語>って／とは、<説明>のこと／という意味」という説明の
   * 言い方から、語と意味を取り出して個人辞書に登録する。会話の中で
   * 教わった語が、その場で「知っている語」になるための入口
   * （意味理解を日常の会話でも育てる）。
   * - 既に gloss のある語（本物の辞書・Web学習由来）は上書きしない。
   * - ユーザーから教わった語だけは、教え直しで差し替える。
   * - なりチャ中は入口自体が閉じる（intakeFromUserText のゲート）。
   */
  private learnTermFromUserExplanation(text: string): void {
    // P579: 説明が短い語（「海鳥」「鳥」等）も拾うため下限は1字。
    // 形自体（〜って、Xのこと）が十分に特定的で、誤認は起きにくい。
    const pattern = /^(.{1,12}?)(?:っていうのは|ってのは|って|とは)、?(.{1,80}?)(?:のこと(?:だ|です|だよ|ですね)?|という意味(?:だ|です|だよ)?|を指す言葉|というもの(?:だ|です)?)[。．]?$/;
    for (const sentence of String(text || '').split(/(?<=。)/)) {
      const m = sentence.trim().match(pattern);
      if (!m) continue;
      const term = m[1].trim();
      const gloss = m[2].trim();
      if (!term || !gloss) continue;
      if (/^(これ|それ|あれ|どれ|何|なに|ここ|そこ|あそこ)$/.test(term)) continue;
      if (/[はがをにへともや、。！？!?「」『』（）()\s]/.test(term)) continue;
      if (/(です|ます|だった|して)$/.test(term)) continue;
      const existing = japaneseDictionaryService.lookup(term);
      const userTaught = existing.find((e) => e.source === 'PERSONAL' && (e.semanticIds || []).includes('learned:user-taught'));
      const anyGloss = existing.find((e) => e.gloss);
      if (anyGloss && !userTaught) continue;
      if (userTaught && userTaught.gloss === gloss) continue;
      japaneseDictionaryService.addPersonal(term, { gloss, semanticIds: ['learned:user-taught'] });
      // P544: 教えた語は「相手が知っている言葉」として記録する。
      try { userKnowledgeProfileService.markKnown(term); } catch { /* 記録は補助経路 */ }
      // P567: 直近に教わった記録（会話側の「覚えました」の材料）。
      try { pendingSlotService.set('miki_recently_taught_v1', { term, gloss, at: Date.now() }, 10 * 60000); } catch { /* 補助経路 */ }
      systemLogger.info('CHAT', `📖 [意味学習] ユーザーから「${term}」の意味を教わりました: ${gloss}`);
      // P727: 定型の教わり経路でも説明を分解する（P726と共通の分解）。
      try { this.decomposeTaughtGloss(term, gloss, `${term}は${gloss}`); } catch { /* 分解は補助経路 */ }
    }
  }

  /**
   * P717: 「XはVだよ／です」の形の事実は、X の説明としても学ぶ。
   * 条件: 属性なしの素の文、X が辞書に無い語、V が説明らしい長さ。
   * 既に意味のある語は上書きしない（教示済み・辞書・Web学習を守る）。
   */
  private learnTermFromPlainStatement(text: string): void {
    if (/[？?]/.test(text)) return;
    const { facts } = this.extractUserFacts(text);
    // P805: 「XはAじゃなくてBだよ」は訂正の形で事実抽出から落ちる
    // （訂正先の事実が無いと丸ごと消える）。Xがまだ未知の語なら、
    // Bを説明とする通常の教示として拾い直す。
    const correctionShape = text.match(/^(.{2,12}?)は(.{1,12}?)(?:じゃなくて|ではなく)(.{1,30}?)(?:だよ|です)?[。！!]?$/);
    if (correctionShape && !facts.some((f) => String(f.entity || '') === correctionShape[1])) {
      const termCandidate = correctionShape[1].trim();
      const existingEntry = japaneseDictionaryService.lookup(termCandidate);
      if (!existingEntry.find((e) => e.gloss)) {
        facts.push({ entity: termCandidate, value: correctionShape[3].trim(), statement: text } as any);
      }
    }
    for (const fact of facts) {
      const term = String(fact.entity || '').trim();
      let gloss = String(fact.value || '').trim();
      // P805: 「鳥ではない、魚」「鳥じゃないよ、獣」のように否定が
      // 混ざった値は、肯定側だけを説明にする（否定された分類は
      // 説明文に残さない）。Claim には元の文が別途残る。
      const negPrefix = gloss.match(/^(.{1,12}?)(?:じゃない|ではない|じゃなくて|ではなく)(?:よ|ね)?[、,]\s*(.+)$/);
      if (negPrefix) gloss = negPrefix[2].trim();
      if (!term || !gloss || fact.attribute) continue;
      if (term.length < 2 || term.length > 12) continue;
      if (/^(僕|私|俺|わたし|あなた|君|名前|今日|昨日|明日|これ|それ|あれ|ここ|そこ|天気|時間)$/.test(term)) continue;
      if (/[はがをにへともや、。！？!?「」『』\s]/.test(term)) continue;
      if (gloss.length > 60) continue;
      // P755: 「ワラルーは鳥だよ」のような分類だけの教示は、値が
      // 短くて通常の条件（4文字以上）で落ちていた。分類語その
      // ものなら、辞書の説明は「〜の一種」の形にして覚え、
      // 分解には元の分類語を渡す（末尾の分類として拾える）。
      let dictionaryGloss = gloss;
      if (gloss.length < 4) {
        if (!/^(?:動物|鳥|魚|虫|植物|獣|哺乳類|爬虫類|両生類|昆虫|食べ物|飲み物|乗り物|道具|場所|人間|人|花|木|草|犬|猫)$/.test(gloss)) continue;
        dictionaryGloss = `${gloss}の一種`;
      }
      if (/^(知らない|わからない|分からない)/.test(gloss)) continue;
      if (!intakeMeaningGuardService.check(String(fact.statement || text)).ok) continue;
      const existing = japaneseDictionaryService.lookup(term);
      if (existing.find((e) => e.gloss)) continue;
      japaneseDictionaryService.addPersonal(term, { gloss: dictionaryGloss, semanticIds: ['learned:user-taught'] });
      try { userKnowledgeProfileService.markKnown(term); } catch { /* 記録は補助経路 */ }
      try { pendingSlotService.set('miki_recently_taught_v1', { term, gloss: dictionaryGloss, at: Date.now() }, 10 * 60000); } catch { /* 補助経路 */ }
      systemLogger.info('CHAT', `📖 [意味学習] ユーザーの説明文から「${term}」の意味を学びました: ${dictionaryGloss}`);
      // P726: 説明を分解して、さらに知識を増やす（下のメソッド）。
      try { this.decomposeTaughtGloss(term, gloss, String(fact.statement || `${term}は${gloss}`)); } catch { /* 分解は補助経路 */ }
    }
  }

  /**
   * P726: 教わった説明を分解して、語彙の登録だけで終わらせない。
   * きりあの本線「知識をルールに分解する」の会話側の入り口:
   * 1. 説明文を Claim として登録する（出所は本人の発言として
   *    CANDIDATE）。これで知識照合・連想グラフ・統合パスの材料に
   *    なる（従来は辞書と事実だけに閉じていた）。
   * 2. 説明の末尾の分類語から、仮の IS_A 関係を世界モデルに載せる
   *    （「〜に住む小さい動物」→ 動物の一種。仮の関係の規律どおり
   *    provisional・低確信度で、確定とは言わない）。
   * 3. 説明の中の知らない語は、その場で聞き返さず（P721）、知識
   *    の欠けとして積んで背景学習に回す。
   */
  private decomposeTaughtGloss(term: string, gloss: string, statement: string): void {
    // 1. Claim 登録（重複は claimDatabaseService 側で抑えられる）。
    // P728: 登録した Claim の ID を覚え、関係の出典に紐付ける
    // （訂正で Claim が差し替わったときに関係も追従できるように）。
    let taughtClaimId = '';
    try {
      const claimText = /です。?$|だ。?$/.test(statement) ? (statement.endsWith('。') ? statement : `${statement}。`) : `${statement}です。`;
      const registered = claimDatabaseService.registerClaim({
        statement: claimText,
        world: 'REAL',
        kind: 'FACT_CLAIM',
        status: 'CANDIDATE',
        source: 'USER_CLAIM',
        self_provenance: 'USER_CONFIRMED',
        maturity: 'DEFINED',
        origin_source_id: 'user_conversation_teaching',
        independence_cluster_id: 'cluster_user_teaching',
      } as any);
      if (registered?.claim_id) taughtClaimId = String(registered.claim_id);
    } catch { /* Claim 登録は補助経路 */ }
    // 説明の内容語を分解する。
    let tokens: string[] = [];
    try { tokens = utteranceFeatureService.analyze(gloss).contentTokens || []; } catch { tokens = []; }
    // P727: 分類語には鳥・魚・木のような1字漢字も多いので、1字は
    // 漢字だけ通す（ひらがな1字は断片として落とす）。
    const clean = tokens.filter((t) => t && (t.length >= 2 || /^[一-龠]$/.test(t)) && t !== term && !/^(こと|もの|ため)$/.test(t));
    // 2. 末尾の分類語 → 仮の IS_A。分類語は説明の最後の名詞らしい
    // 語（「〜に住む小さい動物」の動物）。文頭の場所名（オーストラ
    // リア）などを拾わないよう、後ろから探し、辞書に無い語は
    // 「最後の語で、漢字かカタカナで終わる」場合だけ認める。
    try {
      const category = [...clean].reverse().find((t, idx) => {
        // P728: 形容詞の語幹（「大きさ」の「大」等）は分類語ではない。
        // 後ろに形容詞の活用（き・く・かっ）が続けば語幹とみなす。
        if (new RegExp(`${t}(?:き|く|かっ|くな)`).test(gloss)) return false;
        try {
          const entries = japaneseDictionaryService.lookup(t);
          if (entries.length > 0) return entries.some((e: any) => ['NOUN', 'PROPER_NOUN', 'TECHNICAL', 'UNKNOWN'].includes(String(e?.pos || '')));
        } catch { /* 補助判定 */ }
        return idx === 0 && /[一-龠ァ-ヶー]$/.test(t);
      });
      if (category && category !== term) {
        worldModelGraphService.addRelation({ fromName: term, toName: category, type: 'IS_A', provisional: true, confidence: 0.3, ...(taughtClaimId ? { sourceClaimId: taughtClaimId } : {}) } as any);
      }
    } catch { /* 関係は補助経路 */ }
    // P806: 産物の分解。「白い毛が取れる」「実を食べる」等の形から
    // USED_FOR の仮関係を載せる（従来は IS_A だけで、「何に使うの」
    // に説明文の内容で答えられなかった）。産物は句の最後の名詞語。
    try {
      const productMatch = gloss.match(/(.{1,12}?)(?:が|を)(?:取れる|採れる|獲れる|取れます|採れます)/)
        || gloss.match(/(.{1,12}?)を(?:作る|つくる)/);
      // 「卵を産む」は産卵であって産物ではないので、生む・産むは
      // 産物の形に入れない（P806 初版で誤って関係化した）。
      if (productMatch) {
        const phraseTokens = (utteranceFeatureService.analyze(productMatch[1]).contentTokens || [])
          .filter((t: string) => t && t !== term && !/^(こと|もの|ため)$/.test(t));
        const product = [...phraseTokens].reverse().find((t: string) => /[一-龠ァ-ヶー]$/.test(t));
        if (product && product !== term) {
          worldModelGraphService.addRelation({ fromName: term, toName: product, type: 'USED_FOR', provisional: true, confidence: 0.3, ...(taughtClaimId ? { sourceClaimId: taughtClaimId } : {}) } as any);
        }
      }
    } catch { /* 関係は補助経路 */ }
    // 3. 知らない構成語 → 知識の欠け（背景学習行き）。対象は漢字・
    // カタカナだけの語に限る（動詞・形容詞の語幹は語彙の欠けでは
    // ない）。
    for (const w of clean) {
      try {
        if (w.length < 2) continue; // 1字は分類語専用（欠けにはしない）
        if (japaneseDictionaryService.has(w)) continue;
        if (!/^[一-龠ァ-ヶー]+$/.test(w)) continue;
        knowledgeGapService.detect({
          query: `「${w}」について調べる`,
          reason: `教わった「${term}」の説明の中に出てきた語で、まだ知らないため。`,
          type: 'UNKNOWN_TERM',
          target: w,
          priority: 35,
        } as any);
      } catch { /* 欠けの記録は補助経路 */ }
    }
  }

  /**
   * P567: 聞き返した語への答えを取り込む。彼女が「〜って、どんな
   * ものですか？」と聞いた直後の発言は、その語の説明として読む
   * （P518 の定型でなくてもよい）。保留は一回限りで消費する:
   * 答えでなければ捨て、次の無関係な発言を意味として食わない。
   */
  private learnPendingUnknownTerm(text: string): void {
    // P846/P847: 保留枠組みから消費する（TTL 30分は置く側で設定）。
    const pending = pendingSlotService.consume<{ term?: string }>('miki_unknown_pending_v1');
    if (!pending) return;
    const term = String(pending.term || '');
    if (!term) return;
    const value = String(text || '').trim();
    if (!value) return;
    if (/[？?]/.test(value) || /ですか|ますか|でしょうか/.test(value)) return;
    if (/^(違う|ちがう|いや|じゃなくて|それは違う)/.test(value)) return;
    if (/知らない|わからない|分からない|知らん/.test(value)) return;
    // P742: 別の主題の文（「ルナカエルは〜だよ」）は、聞き返した
    // 語の説明ではない。主題が保留中の語でも「それ」でもない文は
    // 消費しない。ほかの主題の説明が無関係な語に付いてしまう
    // 事故（辞書と関係の汚染）の対策。主題の無い短い答え
    // （「鳥の一種だよ」等）は従来どおり受ける。
    const subjectMatch = value.match(/^(.{1,14}?)(?:は|って|とは)/);
    if (subjectMatch) {
      const subj = subjectMatch[1].replace(/^(?:その|この|あの)/, '').trim();
      if (subj && subj !== term && !/^それ/.test(value)) return;
    }
    if (!intakeMeaningGuardService.check(value).ok) return;
    const firstSentence = value.split(/(?<=。)/)[0].trim();
    let gloss = firstSentence;
    if (gloss.startsWith(term)) {
      gloss = gloss.slice(term.length).replace(/^(は|って|とは|、|,)/, '');
    } else if (/^それは/.test(gloss)) {
      gloss = gloss.replace(/^それは/, '');
    }
    gloss = gloss.replace(/(?:ということ)?(?:だよ|ですね|です|だ)?。?$/, '').trim();
    if (gloss.length < 3 || gloss.length > 80) return;
    // P579: 感想だけの文（「かわいいよね」「好きだよ」等）は意味の
    // 説明ではないので取り込まない。聞き返しへの返事が雑談の
    // 感想だった場合に、感想を意味として登録してしまう事故の対策。
    if (/^(かわいい|すごい|大きい|小さい|高い|安い|美味しい|おいしい|楽しい|嬉しい|うれしい|強い|弱い|速い|早い|遅い|重い|軽い|明るい|暗い|好き|大好き|嫌い)(よね|ね|よ)?$/.test(gloss)) return;
    if (!value.includes(term) && !/^それ/.test(value) && value.length > 40) return;
    const existing = japaneseDictionaryService.lookup(term);
    // 既に意味がある語（本物の辞書・Web学習・教示済み）は上書きしない。
    if (existing.find((e) => e.gloss)) return;
    japaneseDictionaryService.addPersonal(term, { gloss, semanticIds: ['learned:user-taught'] });
    try { userKnowledgeProfileService.markKnown(term); } catch { /* 記録は補助経路 */ }
    try { pendingSlotService.set('miki_recently_taught_v1', { term, gloss, at: Date.now() }, 10 * 60000); } catch { /* 補助経路 */ }
    systemLogger.info('CHAT', `📖 [意味学習] 聞き返した「${term}」の意味を教わりました: ${gloss}`);
    // P727: 聞き返しへの答えの経路でも説明を分解する（P726と共通）。
    try { this.decomposeTaughtGloss(term, gloss, `${term}は${gloss}`); } catch { /* 分解は補助経路 */ }
  }

  /**
   * P544: 相手の知識モデルの材料集め。観測できる信号だけを見る:
   * 「Xって何？」は知らない側、知らない側だった語を普通の文で
   * 使ったら知っている側へ移す。
   */
  /**
   * P578-A: 彼女自身の好みを教わる（「みきはモコロンが好きだよ」）。
   * 主語が彼女を指す形のときだけ記録する（ユーザーの好みと混同しない）。
   * 仮定・迷いの形は意味チェックで落とす。
   */
  private learnSelfPreferenceFromUserText(text: string): void {
    const m = String(text || '').match(/(みき|ビービー|あなた|君|あんた)(?:は|って)、?\s*(.{1,16}?)(が好き|に興味がある|が得意)/);
    if (!m) return;
    if (!intakeMeaningGuardService.check(text).ok) return;
    const who = m[1];
    const term = m[2].trim();
    if (!term || /^(これ|それ|あれ|何|なに)/.test(term)) return;
    const kind = m[3] === 'が好き' ? 'like' : m[3] === 'が得意' ? 'good_at' : 'interest';
    const personaId = who === 'ビービー' ? 'persona-bibi' : who === 'みき' ? 'persona-default' : personaProfileService.get().profileId;
    selfPreferenceService.recordTaught(personaId, term, kind as 'like' | 'interest' | 'good_at');
  }

  private observeUserKnowledgeSignals(text: string): void {
    const value = String(text || '');
    let questionedTerm: string | undefined;
    for (const sentence of value.split(/(?<=。)/)) {
      const trimmed = sentence.trim();
      // P547: 言い回しの変種（なんだっけ／どういうもの／〜の意味は）も拾う。
      const m = trimmed.match(/^(.{1,12}?)(?:っていうのは|ってのは|って|とは)(?:何|なに|なん|どういう意味|どういうもの|どういうこと|どんな)/)
        ?? trimmed.match(/^(.{1,12}?)の意味は/);
      if (!m) continue;
      const term = m[1].trim();
      if (!term) continue;
      if (/^(その|この|あの)/.test(term) && trimmed.includes('の意味は')) continue;
      if (/^(これ|それ|あれ|どれ|何|なに|ここ|そこ|あそこ)$/.test(term)) continue;
      if (/[はがをにへともや、。！？!?「」『』（）()\s]/.test(term)) continue;
      questionedTerm = term;
      userKnowledgeProfileService.markUnknown(term);
    }
    for (const term of userKnowledgeProfileService.listUnknown()) {
      if (term === questionedTerm) continue;
      if (value.includes(term)) userKnowledgeProfileService.markKnown(term);
    }
  }

  /**
   * P752: 「明日の15時に歯医者の予約がある」「来週、旅行に行く
   * 予定」のような予定の発言を、予定として控える。事実の
   * 取り込み（属性・値）には乗らない形のため、専用の控えに
   * 分ける。会話側の planRecallAnswer が「明日の予定は？」に
   * この控えから答える。
   */
  /** P774: 「12月3日」のような明示の日付を解決する（過ぎていれば来年）。 */
  private planExplicitDate(when: string): string | undefined {
    const m = when.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (!m) return undefined;
    const now = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let cand = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
    if (fmt(cand) < fmt(now)) cand = new Date(now.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]));
    return fmt(cand);
  }

  /** P772: 時期の語を実際の日付に解決する（今日/明日/明後日のみ）。 */
  private planDateFor(when: string): string | undefined {
    const explicit = this.planExplicitDate(when);
    if (explicit) return explicit;
    // P773: 曜日も日付に解決する（直近のその曜日、来週指定は+7）。
    const wd = when.match(/^(再来週の|来週の)?(月|火|水|木|金|土|日)曜日$/);
    if (wd) {
      const target = '日月火水木金土'.indexOf(wd[2]);
      const now = new Date();
      let delta = (target - now.getDay() + 7) % 7;
      // P808: 再来週の曜日は+14、来週の曜日は+7。
      if (wd[1] === '再来週の') delta += 14;
      else if (wd[1]) delta += 7;
      const d = new Date(now.getTime() + delta * 86400000);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    }
    const offset = when === '今日' || when === '今夜' ? 0 : when === '明日' ? 1 : when === '明後日' ? 2 : when === '明々後日' ? 3 : -1;
    if (offset < 0) return undefined;
    const d = new Date(Date.now() + offset * 86400000);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  /** P773: 発話から時期の語を取り出す（曜日を優先）。 */
  private planWhenOf(t: string): string | undefined {
    // P774: 明示の日付（12月3日）があればそれを最優先する。
    const ex = t.match(/(\d{1,2})月(\d{1,2})日/);
    if (ex) return `${Number(ex[1])}月${Number(ex[2])}日`;
    const wd = t.match(/(再来週の|来週の|今週の)?(月|火|水|木|金|土|日)曜日/);
    if (wd) return wd[1] === '再来週の' ? `再来週の${wd[2]}曜日` : wd[1] === '来週の' ? `来週の${wd[2]}曜日` : `${wd[2]}曜日`;
    const raw = t.match(/(明後日|明日|あした|今日|今夜|今週|来週|再来週|週末|今度)/)?.[1];
    return raw === 'あした' ? '明日' : raw;
  }

  /** P772: 控えが「その日」に当たるか（日付持ちは日付で、無ければ時期の語で）。 */
  private planInScope(p: { when: string; date?: string }, when: string | undefined, targetDate: string | undefined): boolean {
    if (p.date && targetDate) return p.date === targetDate;
    return !when || p.when === when;
  }

  private recordUserPlanIfAny(text: string): void {
    try {
      const t = String(text || '').trim();
      if (!t || /[？?]/.test(t)) return;
      if (/(?:ですか|ますか|でしょうか|教えて|お願い|してほしい)/.test(t)) return;
      // P816: 日付ずらしの文そのものは控えに残さない（付け替えは
      // moveUserPlanIfAny が行う）。
      if (/(?:予定|予約|約束)/.test(t) && /(?:ずらして|ずらす|移して|移す|延期)/.test(t)) return;
      // P820: 取り消しの文そのものも控えに残さない（従来は
      // 「やっぱり無しにして」が新しい予定として控えられていた）。
      if (/(?:予定|予約|約束)/.test(t) && /(?:無しにして|なしにして|やめにして|取り消して|キャンセル|中止|取り消し|やめた)/.test(t)) return;
      // P768: 予定の変更文そのものは控えに残さない（変更後の
      // 内容だけが changeUserPlanIfAny で控えられる）。
      if (/(?:じゃなくて|ではなく)/.test(t) && /(?:変えた|変更)/.test(t)) return;
      const whenRaw = this.planWhenOf(t);
      if (!whenRaw) return;
      if (!/(?:予定|予約|約束)/.test(t) && !/(?:がある|に行く|へ行く|に行きます|に行くんだ|あるんだ|行くよ)/.test(t)) return;
      const when = whenRaw;
      const key = 'miki_user_plans_v1';
      const raw = storageService.getItem(key);
      const plans: Array<{ when: string; text: string; at: number; date?: string }> = raw ? JSON.parse(raw) : [];
      const cleanText = t.replace(/。$/, '').slice(0, 80);
      if (plans.some((p) => p.when === when && p.text === cleanText)) return;
      plans.push({ when, text: cleanText, at: Date.now(), date: this.planDateFor(when) });
      storageService.setItem(key, JSON.stringify(plans.slice(-20)));
    } catch { /* 予定の控えは補助経路 */ }
  }

  /**
   * P753: 「やっぱり明日の歯医者はキャンセルした」——予定の
   * 取り消しは、控えから該当の予定を外す。合言葉は時期の語と
   * 内容語の重なりで判定し、関係ない予定は残す。
   */
  private cancelUserPlanIfAny(text: string): void {
    try {
      const t = String(text || '').trim();
      if (!t || /[？?]/.test(t)) return;
      if (!/(?:キャンセル|中止|取り消し|取り消した|やめた|無くなった|なくなった|無しになった|なしになった|無しにして|なしにして|やめにして|取り消して|キャンセルして)/.test(t)) return;
      const key = 'miki_user_plans_v1';
      const raw = storageService.getItem(key);
      if (!raw) return;
      const plans: Array<{ when: string; text: string; at: number }> = JSON.parse(raw);
      if (!Array.isArray(plans) || plans.length === 0) return;
      const whenRaw = this.planWhenOf(t);
      const when = whenRaw;
      const tokens = utteranceFeatureService.analyze(t).contentTokens
        .filter((w) => w.length >= 2 && !/^(?:キャンセル|中止|取り消し|予定|予約|約束|明日|今日|今夜|今週|来週|週末|今度|明後日)$/.test(w));
      const targetDate = when ? this.planDateFor(when) : undefined;
      // P820: 「明日の予定、やっぱり無しにして」のように内容を
      // 指さない取り消しは、時期の範囲ごと取り消す（従来は内容の
      // 語が無いと何も消えなかった）。
      const contentTokens = tokens.filter((w) => !/^(?:やっぱり|無し|なし|全部|ぜんぶ|にし|して|した)$/.test(w));
      if (contentTokens.length === 0) {
        if (!when) return;
        const keptAll = plans.filter((p) => !this.planInScope(p as any, when, targetDate));
        if (keptAll.length !== plans.length) storageService.setItem(key, JSON.stringify(keptAll));
        return;
      }
      const kept = plans.filter((p) => {
        if (!this.planInScope(p as any, when, targetDate)) return true;
        return !tokens.some((w) => p.text.includes(w));
      });
      if (kept.length !== plans.length) storageService.setItem(key, JSON.stringify(kept));
    } catch { /* 予定の取り消しは補助経路 */ }
  }

  /**
   * P816: 「明日の予定、明後日にずらして」——予定の日付ずらしは、
   * 控えの日付と時期ラベルを付け替える。ずらす元が書かれていない
   * 場合は、控えの日付が1種類だけの時にその日付を対象にする。
   * 結果はマーカーに残し、会話側が受け答えする。
   */
  private moveUserPlanIfAny(text: string): void {
    try {
      const t = String(text || '').trim();
      if (!t || /[？?]/.test(t)) return;
      // P830: 日の訂正形（「明日じゃなくて明後日だよ」）は、予定の
      // 語が無くてもずらしとして受ける。従来は訂正の受け答えだけが
      // 返って、台帳の日付は直らなかった。
      const corr = t.match(/^(今日|明日|あした|明後日|明々後日|[日月火水木金土]曜日)(?:じゃなくて|じゃなく|ではなく)\s*(今日|明日|明後日|明々後日|[日月火水木金土]曜日)/);
      if (!corr && !/(?:予定|予約|約束)/.test(t)) return;
      const mv = corr
        ? ([corr[0], corr[1], corr[2]] as unknown as RegExpMatchArray)
        : t.match(/(明後日|明々後日|明日|あした|今日|今夜)?の?(?:予定|予約|約束)(?:を|、|,)?\s*(明後日|明々後日|明日|今日|[日月火水木金土]曜日|\d{1,2}月\d{1,2}日|\d{1,2}日)に(?:ずらして|ずらす|移して|移す|延期して|延期する)/);
      if (!mv) return;
      const fromWhen = mv[1] ? (mv[1] === 'あした' ? '明日' : mv[1]) : '';
      const toWhen = mv[2];
      const key = 'miki_user_plans_v1';
      const raw = storageService.getItem(key);
      const plans: Array<{ when: string; text: string; at: number; date?: string }> = raw ? JSON.parse(raw) : [];
      let fromDate: string | undefined;
      if (fromWhen) {
        fromDate = this.planDateFor(fromWhen);
      } else {
        const dates = [...new Set(plans.map((p) => p.date).filter(Boolean))];
        if (dates.length === 1) fromDate = dates[0] as string;
      }
      // P819: 曜日へのずらしは、ずらす元の日の次のその曜日へ
      // （同じ曜日なら翌週）。相対日のずらしは従来どおり。
      // P820: 明示の日付（20日／12月3日）へのずらしも受ける。
      // 元の日より前には戻さず、過ぎていれば翌月・翌年に送る。
      let toDate: string | undefined;
      let toLabel = toWhen;
      const wdTo = toWhen.match(/^([日月火水木金土])曜日$/);
      const dateTo = toWhen.match(/^(?:(\d{1,2})月)?(\d{1,2})日$/);
      if (wdTo) {
        if (!fromDate) return;
        const base = new Date(`${fromDate}T00:00:00`);
        let delta = ('日月火水木金土'.indexOf(wdTo[1]) - base.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        const nd = new Date(base.getTime() + delta * 86400000);
        const mm = String(nd.getMonth() + 1).padStart(2, '0');
        const dd = String(nd.getDate()).padStart(2, '0');
        toDate = `${nd.getFullYear()}-${mm}-${dd}`;
      } else if (dateTo) {
        if (!fromDate) return;
        const base = new Date(`${fromDate}T00:00:00`);
        const dd = Number(dateTo[2]);
        const mm = dateTo[1] ? Number(dateTo[1]) - 1 : base.getMonth();
        let cand = new Date(base.getFullYear(), mm, dd);
        if (cand.getTime() <= base.getTime()) {
          cand = dateTo[1] ? new Date(base.getFullYear() + 1, mm, dd) : new Date(base.getFullYear(), base.getMonth() + 1, dd);
        }
        const cmm = String(cand.getMonth() + 1).padStart(2, '0');
        const cdd = String(cand.getDate()).padStart(2, '0');
        toDate = `${cand.getFullYear()}-${cmm}-${cdd}`;
        toLabel = `${cand.getMonth() + 1}月${cand.getDate()}日`;
      } else {
        toDate = this.planDateFor(toWhen);
      }
      if (!toDate) return;
      let moved = 0;
      if (fromDate) {
        for (const p of plans) {
          if (p.date === fromDate) { p.when = toLabel; p.date = toDate; p.at = Date.now(); moved++; }
        }
      }
      if (moved > 0) storageService.setItem(key, JSON.stringify(plans.slice(-20)));
      // P846: 控えは共通の保留枠組みへ（TTL 60秒、消費は core 側）。
      pendingSlotService.set('miki_recently_moved_plan_v1', { from: fromWhen, to: toLabel, moved }, 60000);
    } catch { /* 予定のずらしは補助経路 */ }
  }

  /**
   * P768: 「明日の予定、歯医者じゃなくて美容院に変えた」——予定の
   * 変更は、古い控えを外して新しい内容で控え直す。事実の訂正
   * （P708）の形と似ているが、対象は予定台帳であり、事実層には
   * 触らない（呼び出し側で訂正読みを止める）。
   */
  /** P831: 「歯医者じゃなくて美容院だよ」——予定の内容の訂正は、
   * 台帳の文そのものを差し替える。従来は訂正の受け答えだけで、
   * 台帳の文は古いまま残っていた。 */
  private correctUserPlanContentIfAny(text: string): void {
    try {
      const t = String(text || '').trim();
      if (!t || /[？?]/.test(t)) return;
      if (/(?:変えた|変更|ずら|移し|延期)/.test(t)) return;
      const cm = t.match(/^(.{1,14}?)(?:じゃなくて|じゃなく|ではなく)(.{1,14}?)(?:だよ|ですよ|です|だ|。)?$/);
      if (!cm) return;
      const wrong = cm[1].replace(/^(?:それは|これは|さっきの|その)/, '').trim();
      const right = cm[2].trim();
      if (!wrong || !right || wrong.length < 2) return;
      // 日の訂正（P830）は、ずらしの経路の担当。
      const DAY = /^(?:今日|明日|あした|明後日|明々後日|[日月火水木金土]曜日)$/;
      if (DAY.test(wrong) || DAY.test(right)) return;
      const key = 'miki_user_plans_v1';
      const raw = storageService.getItem(key);
      const plans: Array<{ when: string; text: string; at: number; date?: string }> = raw ? JSON.parse(raw) : [];
      let fixed = 0;
      for (const p of plans) {
        if (p.text.includes(wrong)) { p.text = p.text.split(wrong).join(right); p.at = Date.now(); fixed++; }
      }
      if (fixed === 0) return;
      storageService.setItem(key, JSON.stringify(plans.slice(-20)));
      pendingSlotService.set('miki_recently_corrected_plan_content_v1', { from: wrong, to: right, fixed }, 60000);
    } catch { /* 予定の内容訂正は補助経路 */ }
  }

  private changeUserPlanIfAny(text: string): void {
    try {
      const t = String(text || '').trim();
      if (!t || /[？?]/.test(t)) return;
      if (!/(?:予定|予約|約束)/.test(t)) return;
      if (!/(?:変えた|変更)/.test(t)) return;
      const ch = t.match(/(.{1,16}?)(?:じゃなくて|ではなく|じゃなしに)(.{1,16}?)(?:に変えた|に変更|にした|に変え)/);
      if (!ch) return;
      const whenRaw = this.planWhenOf(t);
      if (!whenRaw) return;
      const when = whenRaw;
      const wrongTokens = utteranceFeatureService.analyze(ch[1]).contentTokens
        .filter((w) => w.length >= 2 && !/^(?:予定|予約|約束|明日|今日|今夜|今週|来週|週末|今度|明後日)$/.test(w));
      const rightText = ch[2].replace(/^(?:、|\s)+/, '').replace(/(?:よ|ね|です)$/, '').trim();
      if (!rightText) return;
      const key = 'miki_user_plans_v1';
      const raw = storageService.getItem(key);
      const plans: Array<{ when: string; text: string; at: number; date?: string }> = raw ? JSON.parse(raw) : [];
      const targetDate = this.planDateFor(when);
      const kept = plans.filter((p) => !(this.planInScope(p, when, targetDate) && wrongTokens.some((w) => p.text.includes(w))));
      const newText = `${rightText}の予定`;
      if (!kept.some((p) => p.when === when && p.text === newText)) {
        kept.push({ when, text: newText, at: Date.now(), date: targetDate });
      }
      storageService.setItem(key, JSON.stringify(kept.slice(-20)));
    } catch { /* 予定の変更は補助経路 */ }
  }

  public intakeFromUserText(text: string, existingMemories: MemoryItem[]): FactIntakeResult {
    // P816: 予定の日付ずらしは最初に処理する（変更・取り消し・記録より先）。
    this.moveUserPlanIfAny(text);
    // P831: 予定の内容の訂正（「歯医者じゃなくて美容院だよ」）も、
    // 台帳側で先に差し替える。
    this.correctUserPlanContentIfAny(text);
    // P768: 予定の変更は最初に処理する（取り消し・記録より先）。
    this.changeUserPlanIfAny(text);
    // P753: 予定の取り消しは控えから外す（先に処理する）。
    this.cancelUserPlanIfAny(text);
    // P752: 予定の発言は予定の控えにも残す（事実取り込みとは別枠）。
    this.recordUserPlanIfAny(text);
    // P514: なりチャの開始・終了と、セッション中の創作分離。
    // 演じている間の発言は創作であり、本人の現実の事実として
    // 取り込まない。開始・終了の指示文自体も事実にしない。
    try {
      const signal = roleplaySessionService.handleUserText(text, personaProfileService.get().profileId);
      if (signal || roleplaySessionService.isActive()) {
        // P523: セッション中の発言は、あらすじ自動生成の材料として
        // 内容語だけをセッション側に控える（創作として分離したまま）。
        if (!signal && roleplaySessionService.isActive()) {
          try { roleplaySessionService.noteTurn(text); } catch { /* 控えは補助経路 */ }
        }
        return { added: [], updatedMemories: existingMemories, replaced: 0, invalidated: 0 };
      }
    } catch { /* ゲートの失敗で通常の取り込みは止めない */ }
    // P513: プロジェクトの決め事らしい発言はプロジェクトノートにも
    // 取り込む。失敗しても事実取り込み自体は止めない。
    try {
      projectNotebookService.intakeFromUserText(text);
    } catch { /* best-effort */ }
    // P518: 語の意味を説明してくれた発言は、その語の意味として
    // 個人辞書に登録する。失敗しても事実取り込み自体は止めない。
    try {
      this.learnTermFromUserExplanation(text);
    } catch { /* best-effort */ }
    // P717: 「Xは〜だよ」の普通の教え方も、その語の説明として学ぶ
    // （従来は「Xって、〜のこと」の定型だけが対象で、最も自然な
    // 教え方では語彙にならず、直後に聞き返しが起きていた）。
    try {
      this.learnTermFromPlainStatement(text);
    } catch { /* best-effort */ }
    // P567: 直前に聞き返した語（P565）への答えは、説明の定型で
    // なくても意味として取り込む。失敗しても取り込みは止めない。
    try {
      this.learnPendingUnknownTerm(text);
    } catch { /* best-effort */ }
    // P578-A: 彼女自身の好みの教示（「みきはXが好き」）。
    try {
      this.learnSelfPreferenceFromUserText(text);
    } catch { /* best-effort */ }
    // P544: 相手の知識モデル（知っている言葉／知らない言葉）の
    // 材料集め。失敗しても取り込み自体は止めない。
    try {
      this.observeUserKnowledgeSignals(text);
    } catch { /* best-effort */ }
    const { facts, invalidations, correctionPair } = this.extractUserFacts(text);
    const now = Date.now();
    const updated: MemoryItem[] = existingMemories.map((m) => ({ ...m }));
    const added: MemoryItem[] = [];
    let replaced = 0;
    let invalidated = 0;

    const isUserFact = (m: MemoryItem) =>
      m.source === 'user_statement' && m.active !== false && !m.replacedBy;

    // P708: 訂正ペア（「犬じゃなくて猫だった」）で、正しい側が裸の
    // 値しかない場合は通常の抽出で新事実が作れない。無効化される
    // 旧事実の枠（対象・属性・文）を借りて、値だけを差し替えた
    // 事実を合成する。これが無いと、訂正の受け答えだけが
    // 「覚え直します」と言って想起は古いままになっていた。
    if (correctionPair && !facts.some((f) => f.value && f.value.includes(correctionPair.right))) {
      const target = updated.find(
        (m) => isUserFact(m) && m.factValue != null
          && (String(m.factValue).includes(correctionPair.wrong) || String(m.content || '').includes(correctionPair.wrong))
      );
      if (target) {
        let newValue = String(target.factValue).split(correctionPair.wrong).join(correctionPair.right);
        // P755: 文の形の訂正（「ワラルーは鳥じゃなくて動物だよ」）では
        // 間違い（wrong）が文全体で、値はその末尾に埋まっている。
        // 値の中では置換できないので、値そのものを差し替える。
        // （従来は値が古いまま残り、文だけが「動物」に化けていた。）
        if (newValue === String(target.factValue) && correctionPair.wrong.endsWith(String(target.factValue))) {
          newValue = correctionPair.right;
        }
        let newStatement = String(target.content || '').includes(correctionPair.wrong)
          ? String(target.content).split(correctionPair.wrong).join(correctionPair.right)
          : `${target.factEntity || ''}は${newValue}`;
        if (newStatement === correctionPair.right && target.factEntity) {
          newStatement = `${target.factEntity}は${newValue}`;
        }
        facts.push({
          kind: 'attribute',
          category: 'user_fact',
          entity: target.factEntity,
          attribute: target.factAttribute,
          value: newValue,
          statement: newStatement,
          summary: newStatement,
        });
      }
    }

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
          // P462: 訂正を統治メモリにも伝播させる（この事実を出所に持つ
          // 記録を無効化する）。伝播の失敗で取り込み自体は止めない。
          try {
            scopedVersionedMemoryService.invalidateBySource(mem.id, 'ユーザー訂正による無効化');
          } catch { /* 伝播は補助経路 */ }
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
      // P457 (E): 置換は「値を持つ事実」同士に限る。値を持たない状態・出来事文
      // （経緯）は置換の対象にせず、属性事実の言い直しで消したりもしない。
      if (fact.value != null && factKeyOf(fact.entity, fact.attribute)) {
        const key = factKeyOf(fact.entity, fact.attribute);
        const old = updated.find(
          (m) => {
            if (!isUserFact(m) || m.factValue == null) return false;
            if (factKeyOf(m.factEntity, m.factAttribute) !== key) return false;
            // P816: 属性なし事実同士は、述語の型が一致する時だけ
            // 言い直しとみなす。型の違う文（飼育と職業など）は
            // 別の事実として共存させる。
            if (!fact.attribute && !m.factAttribute) {
              return attrlessFrameOf(m.factValue) === attrlessFrameOf(fact.value);
            }
            return true;
          }
        );
        if (old) {
          if (old.factValue === fact.value) return;
          old.replacedBy = id;
          replaced++;
          try {
            scopedVersionedMemoryService.invalidateBySource(old.id, 'ユーザー訂正（言い直し）による置換');
          } catch { /* 伝播は補助経路 */ }
        }
      }

      added.push(item);
      updated.unshift(item);

      // P462: 統治メモリ（scopedVersionedMemory）へも「本人の発言の
      // 証跡」として記録する。これまで読み手（タスク前の文脈構築）だけが
      // あり、通常経路の書き手が存在しなかった。信念ではなく証跡
      // （kind: EVIDENCE）として置き、出所に MemoryItem の id を持たせ、
      // 訂正時の invalidateBySource で辿れるようにする。
      try {
        scopedVersionedMemoryService.propose({
          subject: fact.entity || 'ユーザー発言',
          content: fact.statement,
          kind: 'EVIDENCE',
          scope: { type: 'CONVERSATION', id: 'user' },
          source: { turnIds: [id], fileIds: [], evidenceIds: [] },
          confidence: 0.5,
        });
      } catch { /* 統治メモリへの記録は補助経路 */ }
    });

    // P724: 訂正で事実が差し替わったら、教わって覚えた語の辞書の
    // 説明（gloss）も生かされている事実から作り直す。事実側だけが
    // 直って gloss が古いままだと、彼女は訂正済みの内容を言い続け
    // る（「小さい」と訂正された後も「小さい動物」と答える）。
    try { this.refreshTaughtGlossAfterCorrection(updated, isUserFact); } catch { /* 補助経路 */ }
    // P736: 「Xのことは忘れて」——教わった語を忘れる依頼は、辞書・
    // 知識・関係・事実の全部から外す（定義を読み上げるだけに
    // ならないように）。
    try { this.forgetTaughtTermFromRequest(text, updated); } catch { /* 補助経路 */ }
    // P767: 「僕が犬を飼ってるって話、忘れて」——事実そのものの
    // 忘却依頼（語の忘却とは別）。
    try { this.forgetUserFactFromRequest(text, updated); } catch { /* 補助経路 */ }

    return { added, updatedMemories: updated, replaced, invalidated };
  }

  /** P724: 訂正・置換された事実の対象について、教わった語の gloss を現在の事実から再構築する。 */
  private refreshTaughtGlossAfterCorrection(updated: MemoryItem[], _isUserFact: (m: MemoryItem) => boolean): void {
    // 注: isUserFact は active な事実だけを数える述語なので、無効化
    // された事実の検出には使えない。ここでは factEntity を持つ記録
    // を直接見る。
    const affected = new Set<string>();
    for (const m of updated) {
      if ((m as any).invalidatedByUser || (m as any).replacedBy) {
        const e = String((m as any).factEntity || '').trim();
        if (e) affected.add(e);
      }
    }
    if (affected.size === 0) return;
    for (const entity of affected) {
      const entry = japaneseDictionaryService.listPersonal().find((e: any) => e.surface === entity);
      if (!entry) continue;
      const taught = Array.isArray((entry as any).semanticIds) && (entry as any).semanticIds.some((s: string) => String(s).includes('user-taught'));
      if (!taught) continue;
      const values: string[] = [];
      for (const m of updated) {
        if (m.active === false || (m as any).replacedBy || (m as any).invalidatedByUser) continue;
        if (String((m as any).factEntity || '') !== entity) continue;
        const v = String((m as any).factValue || '').trim();
        if (v && !values.includes(v)) values.push(v);
      }
      if (values.length > 0) {
        japaneseDictionaryService.addPersonal(entity, { gloss: values.join('、'), semanticIds: ['learned:user-taught'], pos: 'UNKNOWN' } as any);
      } else {
        japaneseDictionaryService.removePersonal(entity);
      }
      // P728: 分解の生成物（Claim・仮の関係）も訂正に追従させる。
      try { this.refreshDecompositionAfterCorrection(entity, values); } catch { /* 分解の追従は補助経路 */ }
    }
  }

  /**
   * P728: 訂正で教わった語の説明が作り直されたら、P726 の分解の
   * 生成物も追従させる。古い Claim は新しい Claim へ差し替え
   * （SUPERSEDED）、古い Claim を出典とする仮の関係は外し、
   * 新しい説明から分類を分解し直す。説明が残らなければ、Claim
   * を引退させ仮の関係も外す（訂正前の知識を言い続けない）。
   */
  private refreshDecompositionAfterCorrection(entity: string, values: string[]): void {
    const olds = claimDatabaseService.getAllClaims().filter((c: any) =>
      String(c.origin_source_id || '') === 'user_conversation_teaching'
      && String(c.statement || '').startsWith(`${entity}は`)
      && !(c as any).superseded_by
      && c.status !== 'SUPERSEDED');
    if (olds.length === 0) return;
    if (values.length > 0) {
      const newGloss = values.join('、');
      const registered = claimDatabaseService.registerClaim({
        statement: `${entity}は${newGloss}です。`,
        world: 'REAL',
        kind: 'FACT_CLAIM',
        status: 'CANDIDATE',
        source: 'USER_CLAIM',
        self_provenance: 'USER_CONFIRMED',
        maturity: 'DEFINED',
        origin_source_id: 'user_conversation_teaching',
        independence_cluster_id: 'cluster_user_teaching',
      } as any);
      const newId = registered?.claim_id ? String(registered.claim_id) : '';
      for (const old of olds) {
        if (newId && old.claim_id !== newId) {
          try { claimDatabaseService.supersedeClaim(old.claim_id, newId, '訂正に伴い、教わった説明の知識を差し替え'); } catch { /* 補助経路 */ }
        }
        try { worldModelGraphService.detachClaimFromRelations(old.claim_id); } catch { /* 補助経路 */ }
      }
      // 新しい説明から分類を分解し直す（Claim 登録は重複で抑えられる）。
      try { this.decomposeTaughtGloss(entity, newGloss, `${entity}は${newGloss}`); } catch { /* 補助経路 */ }
    } else {
      this.retireTaughtKnowledge(entity);
    }
  }

  /**
   * P736: 教わった語の知識（Claim）を引退させ、その Claim を出典
   * とする仮の関係を外す。訂正で説明が消えた場合（P728）と、
   * 忘れる依頼の共通処理。
   */
  private retireTaughtKnowledge(term: string): void {
    const olds = claimDatabaseService.getAllClaims().filter((c: any) =>
      String(c.origin_source_id || '') === 'user_conversation_teaching'
      && String(c.statement || '').startsWith(`${term}は`)
      && !(c as any).superseded_by
      && c.status !== 'SUPERSEDED');
    for (const old of olds) {
      try { worldModelGraphService.detachClaimFromRelations(old.claim_id); } catch { /* 補助経路 */ }
      try { claimDatabaseService.setVerificationStatus(old.claim_id, 'SUPERSEDED' as any, '教わった説明の知識を引退'); } catch { /* 補助経路 */ }
    }
  }

  /**
   * P736: 「Xのことは忘れて／消して」という依頼を受けたら、
   * 教わった語を辞書から外し、知識と関係を引退させ、その語の
   * 事実も無効化する。会話側の受け答えのために印を残す。
   * 対象は本人が教えた語だけ（他の忘却の言い方には触れない）。
   */
  private forgetTaughtTermFromRequest(text: string, updated: MemoryItem[]): void {
    const t = String(text || '');
    if (/[？?]/.test(t)) return;
    const verbMatch = t.match(/(?:忘れて|消して|削除して)/);
    if (!verbMatch || verbMatch.index === undefined) return;
    const taught = japaneseDictionaryService.listPersonal().filter((e: any) => Array.isArray(e.semanticIds) && e.semanticIds.includes('learned:user-taught'));
    for (const entry of taught) {
      const term = String(entry.surface || '');
      if (!term) continue;
      const at = t.indexOf(term);
      if (at < 0 || at > verbMatch.index) continue;
      japaneseDictionaryService.removePersonal(term);
      this.retireTaughtKnowledge(term);
      for (const m of updated) {
        if (String((m as any).factEntity || '') === term && m.active !== false) {
          (m as any).active = false;
          (m as any).invalidatedByUser = true;
        }
      }
      try { pendingSlotService.set('miki_recently_forgotten_v1', { term }, 60000); } catch { /* 補助経路 */ }
      systemLogger.info('CHAT', `🗑 [意味学習] 依頼により「${term}」を忘れました`);
      return;
    }
  }

  /**
   * P767: 「僕が犬を飼ってるって話、忘れて」——語ではなく、本人の
   * 事実そのものを消す依頼。発話の内容語と重なる有効な本人事実を
   * 無効化する（語の忘却 P736 とは別の受け口）。
   */
  private forgetUserFactFromRequest(text: string, updated: MemoryItem[]): void {
    const t = String(text || '');
    if (/[？?]/.test(t)) return;
    if (!/(?:忘れて|消して)/.test(t)) return;
    for (const m of updated) {
      if (m.active === false) continue;
      const rec = m as any;
      if (String(rec.source || '') !== 'user_statement') continue;
      // 照合の鍵は事実の側から作る：値そのもの（「犬を飼ってる」）か、
      // 事実文の内容語。内容語は漢字・カタカナなら1文字でも鍵に
      // なる（「犬」は1文字の語）。
      const keys: string[] = [];
      const val = String(rec.factValue || '');
      if (val.length >= 2) keys.push(val);
      try {
        for (const w of utteranceFeatureService.analyze(String(rec.content || '')).contentTokens) {
          if (/^(?:僕|私|俺|話|こと|って|その|この)$/.test(w)) continue;
          if (w.length >= 2 || /^[一-龠ァ-ヶー]$/.test(w)) keys.push(w);
        }
      } catch { /* 値の鍵だけでも照合する */ }
      const hit = keys.some((k) => k && t.includes(k));
      if (!hit) continue;
      rec.active = false;
      rec.invalidatedByUser = true;
      const label = String(rec.factSummary || rec.content || rec.factValue || '').slice(0, 30);
      try { pendingSlotService.set('miki_recently_forgotten_fact_v1', { label }, 60000); } catch { /* 補助経路 */ }
      systemLogger.info('CHAT', `🗑 [事実忘却] 依頼により事実を無効化: ${label}`);
    }
  }
}

export const conversationFactIntakeService = new ConversationFactIntakeService();
