import { japaneseAnalysisService } from '../../research/services/japaneseAnalysisService';
import { storageService } from '../../../services/storageService';

/**
 * P609: 発話の「出来事」を、文字列のパターン列挙ではなく
 * 形態素の特徴（動詞の語幹クラス × 相 × 否定 × 主題・対象の役割）で
 * 分類する土台。
 *
 * 旧方式（会話コアの正規表現チェーン）は「財布なくした」にしか効かず、
 * 「財布を落としてしまった」のような言い換えで外れた。ここでは
 * 解析器が出す語幹トークンと意味役割を見て判定するので、対象語が
 * 初めて聞く物でも、動詞のクラスさえ分かれば分類できる。
 *
 * 動詞クラス表はシード＋保存された拡張（P610）の合成。拡張は
 * registerVerbClass で足せて、再起動後も残る。教師や学習ループが
 * 後からクラスを育てられるようにするための受け口。
 */

export type UtteranceEventClass =
  | 'LOSS'            // 落とした・なくした（対象は何でもよい）
  | 'SETBACK'         // 叱られた・失敗した・試験に落ちた/受からなかった
  | 'ACHIEVEMENT'     // クリアした・倒せた・勝った・受かった
  | 'CONFLICT'        // 喧嘩した
  | 'CHORE_DONE'      // 掃除・洗濯・片付け・料理をした
  | 'TRANSIT_TROUBLE' // 電車が遅れた・止まった・渋滞・人身事故
  | 'PAYDAY';         // 給料日・ボーナス（名詞出来事）

export interface UtteranceEventResult {
  eventClass: UtteranceEventClass;
  negated: boolean;
  aspect: 'COMPLETED' | 'ONGOING' | 'OTHER';
  /** 判定に使った語幹（説明・台帳用）。 */
  matchedStem?: string;
  /** 主題・対象として拾えた語（説明用）。 */
  subject?: string;
  object?: string;
}

const EXTENSION_KEY = 'miki_verb_event_classes_v1';
const MEASURE_KEY = 'miki_measure_nouns_v1';

/** 語幹（解析器が出す形）→ 出来事クラス。活用は語幹側で吸収する。 */
const SEED_VERB_CLASSES: Record<string, UtteranceEventClass> = {
  // 喪失
  '落とし': 'LOSS', '落とす': 'LOSS', '落とし物': 'LOSS',
  'なくし': 'LOSS', '失くし': 'LOSS', '無くし': 'LOSS',
  '失い': 'LOSS', '紛失': 'LOSS',
  // 後退（名詞系の失敗報告も含む）
  '失敗': 'SETBACK', 'ミス': 'SETBACK', 'やらかし': 'SETBACK', 'やらか': 'SETBACK',
  // 達成
  '倒し': 'ACHIEVEMENT', '倒せ': 'ACHIEVEMENT',
  '勝ち': 'ACHIEVEMENT', '勝て': 'ACHIEVEMENT',
  '達成': 'ACHIEVEMENT', '合格': 'ACHIEVEMENT', '昇格': 'ACHIEVEMENT', '当選': 'ACHIEVEMENT',
  '受か': 'ACHIEVEMENT', // 否定形は SETBACK に倒す（classify 内）
  // 対立
  '喧嘩': 'CONFLICT', 'けんか': 'CONFLICT', 'ケンカ': 'CONFLICT',
  // 家事（完了の相と組で CHORE_DONE）
  '掃除': 'CHORE_DONE', '洗濯': 'CHORE_DONE', '片付け': 'CHORE_DONE', '料理': 'CHORE_DONE',
};

/** 受身で受けると後退になる動詞の語幹。 */
const PASSIVE_SETBACK_STEMS = ['怒', '叱', '怒鳴', '叱責'];
/** 落ちる が後退になる文脈の名詞。 */
const EXAM_CONTEXT = ['試験', '受験', '面接', '入試', 'テスト', '検定'];
/** 上がる が達成になる「量・段階」の名詞（主題）。 */
const SEED_MEASURE_NOUNS = ['レベル', 'スコア', '順位', '段位', 'ランク', '段階', '学年'];
/** 交通の主体。 */
const TRANSIT_SUBJECTS = ['電車', 'バス', '飛行機', '新幹線', '列車', '船'];
const TRANSIT_STEMS = ['遅れ', '止ま', '止', '運休', '遅延', '渋滞', '人身事故'];

class UtteranceEventClassifierService {
  private static instance: UtteranceEventClassifierService;
  public static getInstance(): UtteranceEventClassifierService {
    if (!UtteranceEventClassifierService.instance) {
      UtteranceEventClassifierService.instance = new UtteranceEventClassifierService();
    }
    return UtteranceEventClassifierService.instance;
  }

  /** P610: 動詞クラス表の拡張（教師・学習ループからの登録口）。 */
  public registerVerbClass(stem: string, eventClass: UtteranceEventClass): void {
    try {
      const map = this.loadExtensions();
      map[stem] = eventClass;
      storageService.setItem(EXTENSION_KEY, JSON.stringify(map));
    } catch { /* 保存できなくても分類は続ける */ }
  }

  public registerMeasureNoun(noun: string): void {
    try {
      const list = this.loadMeasureExtensions();
      if (!list.includes(noun)) {
        list.push(noun);
        storageService.setItem(MEASURE_KEY, JSON.stringify(list.slice(-100)));
      }
    } catch { /* 同上 */ }
  }

  private loadExtensions(): Record<string, UtteranceEventClass> {
    try {
      return JSON.parse(storageService.getItem(EXTENSION_KEY) || '{}') as Record<string, UtteranceEventClass>;
    } catch { return {}; }
  }

  private loadMeasureExtensions(): string[] {
    try {
      const v = JSON.parse(storageService.getItem(MEASURE_KEY) || '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch { return []; }
  }

  private verbClasses(): Record<string, UtteranceEventClass> {
    return { ...SEED_VERB_CLASSES, ...this.loadExtensions() };
  }

  private measureNouns(): Set<string> {
    return new Set([...SEED_MEASURE_NOUNS, ...this.loadMeasureExtensions()]);
  }

  public classify(prompt: string): UtteranceEventResult | undefined {
    const text = String(prompt || '');
    if (!text) return undefined;
    let analysis;
    try { analysis = japaneseAnalysisService.analyze(text); } catch { return undefined; }
    const tokens = analysis.tokens.filter((t) => t.kind === 'WORD').map((t) => t.surface);
    const tokenSet = new Set(tokens);
    const subject = analysis.semanticRoles.find((r) => r.role === 'SUBJECT')?.token;
    const object = analysis.semanticRoles.find((r) => r.role === 'OBJECT')?.token;
    const negated = /(?:なかっ|ない|なかった|ません|できなかった)/.test(text);
    const aspect: UtteranceEventResult['aspect'] =
      /(?:てる|ている|てます|てた)/.test(text) ? 'ONGOING'
      : /(?:た|だ|した|できた|ました)(?:[。！!？?]|よ|ね|$)/.test(text) || /(?:た|だ)$/.test(text.trim()) ? 'COMPLETED'
      : 'OTHER';
    const has = (stem: string) => tokenSet.has(stem) || tokens.some((t) => t.length > stem.length && t.endsWith(stem));

    // 名詞出来事（動詞が無い報告）。
    if (/(?:給料日|ボーナス)/.test(text)) {
      return { eventClass: 'PAYDAY', negated, aspect, matchedStem: '給料日', subject, object };
    }

    // 交通：主体＋遅れ系、または渋滞・人身事故そのもの。
    if (TRANSIT_STEMS.some((s) => has(s)) && (TRANSIT_SUBJECTS.some((s) => tokenSet.has(s)) || has('渋滞') || has('人身事故') || has('遅延'))) {
      return { eventClass: 'TRANSIT_TROUBLE', negated, aspect, matchedStem: '遅延系', subject, object };
    }

    // 受身の叱責は後退。
    if (PASSIVE_SETBACK_STEMS.some((s) => tokenSet.has(s)) && /(?:られ|られました|られた|れます)/.test(text)) {
      return { eventClass: 'SETBACK', negated, aspect, matchedStem: '叱責（受身）', subject, object };
    }

    // 試験文脈の「落ちた」と、否定された達成（受からなかった）は後退。
    if (EXAM_CONTEXT.some((s) => tokenSet.has(s)) && (has('落ち') || has('落第'))) {
      return { eventClass: 'SETBACK', negated, aspect, matchedStem: '落ち（試験）', subject, object };
    }

    // 動詞クラス表による判定。
    const classes = this.verbClasses();
    for (const [stem, eventClass] of Object.entries(classes)) {
      if (!has(stem)) continue;
      // 否定された達成は、達成として祝わない（後退として受ける）。
      if (eventClass === 'ACHIEVEMENT' && negated) {
        return { eventClass: 'SETBACK', negated, aspect, matchedStem: stem, subject, object };
      }
      // 家事は完了の相のときだけ「済ませた報告」とする。
      if (eventClass === 'CHORE_DONE' && aspect !== 'COMPLETED') continue;
      return { eventClass, negated, aspect, matchedStem: stem, subject, object };
    }

    // 「失くす」は語幹が「失」+「くし」に割れる。
    if (tokenSet.has('失') && /(?:くし|くす|くした)/.test(text)) {
      return { eventClass: 'LOSS', negated, aspect, matchedStem: '失（くす）', subject, object };
    }
    // 「受かる」は語幹が「受」+「から」に割れる。試験文脈・否定・
    // 「受かった」形のときだけ達成/後退として扱う（受ける全般は対象外）。
    if (tokenSet.has('受') && (EXAM_CONTEXT.some((s) => tokenSet.has(s)) || negated || /受か(?:っ|り)/.test(text))) {
      return { eventClass: negated ? 'SETBACK' : 'ACHIEVEMENT', negated, aspect, matchedStem: '受（かる）', subject, object };
    }
    // 「当たった」は語幹が「当」+「たった」に割れる（抽選・チケットの当選）。
    if (tokenSet.has('当') && /当た(?:っ|り)/.test(text)) {
      return { eventClass: 'ACHIEVEMENT', negated, aspect, matchedStem: '当（たる）', subject, object };
    }
    // 物を「忘れた」は置き忘れ＝喪失寄り（約束・名前など情報系は除く）。
    if (has('忘れ') && aspect === 'COMPLETED') {
      const idx = tokens.indexOf('忘れ');
      const before = idx > 0 ? tokens[idx - 1] : undefined;
      if (before && !['約束', 'こと', 'もの', '名前', '宿題', '仕事', '用事'].includes(before)) {
        return { eventClass: 'LOSS', negated, aspect, matchedStem: '忘れ（置き忘れ）', subject, object };
      }
    }
    // 「なくした」は語幹が「なく」+「した」に割れる。
    if (tokenSet.has('なく') && /(?:した|しまった)/.test(text)) {
      return { eventClass: 'LOSS', negated, aspect, matchedStem: 'なく', subject, object };
    }
    // クリアは複合語（ゲームクリア等）の中にも現れる。
    if (tokens.some((t) => t.includes('クリア')) && aspect === 'COMPLETED') {
      return { eventClass: 'ACHIEVEMENT', negated, aspect, matchedStem: 'クリア', subject, object };
    }
    // 量の名詞が主題で「上がった」は達成（名詞側は分割に備えて原文でも照合）。
    if (has('上') && /(?:上がっ|あがっ)/.test(text) && [...this.measureNouns()].some((n) => tokenSet.has(n) || text.includes(n))) {
      return { eventClass: 'ACHIEVEMENT', negated, aspect, matchedStem: '上が（量）', subject, object };
    }
    return undefined;
  }
}

export const utteranceEventClassifierService = UtteranceEventClassifierService.getInstance();
