import { japaneseAnalysisService } from '../../research/services/japaneseAnalysisService';

/**
 * P615: 発話の特徴量を一元化する共有サービス。
 *
 * 相・否定・受身・疑問の形といった「文の特徴」は、出来事分類
 * （P609）・状態の読み取り・対話行為の判定など、複数の場所が
 * それぞれ正規表現で再計算していた（P604 の痛み誤爆もその一例）。
 * 特徴はここで一度だけ計算し、消費側は特徴で判断する。
 * 共有で持たなければいけないものは共有層に置く、という設計原則に
 * 沿って memory 層に置く。
 */

export type UtteranceAspect = 'COMPLETED' | 'ONGOING' | 'DESIDERATIVE' | 'OBLIGATION' | 'VOLITIONAL' | 'OTHER';
export type QuestionForm = 'WH' | 'YESNO' | 'NONE';

export interface UtteranceFeatures {
  aspect: UtteranceAspect;
  negated: boolean;
  passive: boolean;
  questionForm: QuestionForm;
  imperative: boolean;
  /** P631: 訂正の合図（違う・そうじゃない・伝わってない等）。 */
  correction: boolean;
  /** P632: 社交行為（挨拶・別れ・感謝・謝罪）。 */
  socialAct?: 'GREETING' | 'FAREWELL' | 'THANKS' | 'APOLOGY';
  /** P658: 発話全体が相槌・感動詞だけかどうか。 */
  backchannel: boolean;
  /** WORD トークンの surface（語幹を含む）。 */
  tokens: string[];
  contentTokens: string[];
  subject?: string;
  object?: string;
  topic?: string;
}

class UtteranceFeatureService {
  private static instance: UtteranceFeatureService;
  public static getInstance(): UtteranceFeatureService {
    if (!UtteranceFeatureService.instance) {
      UtteranceFeatureService.instance = new UtteranceFeatureService();
    }
    return UtteranceFeatureService.instance;
  }

  public analyze(prompt: string): UtteranceFeatures {
    const text = String(prompt || '');
    const fallback: UtteranceFeatures = {
      aspect: 'OTHER', negated: false, passive: false, questionForm: 'NONE',
      imperative: false, correction: false, backchannel: false, tokens: [], contentTokens: [],
    };
    if (!text) return fallback;
    let tokens: string[] = [];
    let contentTokens: string[] = [];
    let subject: string | undefined;
    let object: string | undefined;
    let topic: string | undefined;
    let hasQuestion = false;
    let hasCorrection = false;
    try {
      const analysis = japaneseAnalysisService.analyze(text);
      tokens = analysis.tokens.filter((t) => t.kind === 'WORD').map((t) => t.surface);
      contentTokens = analysis.contentTokens;
      subject = analysis.semanticRoles.find((r) => r.role === 'SUBJECT')?.token;
      object = analysis.semanticRoles.find((r) => r.role === 'OBJECT')?.token;
      topic = analysis.semanticRoles.find((r) => r.role === 'TOPIC')?.token;
      hasQuestion = analysis.hasQuestion;
      hasCorrection = analysis.hasCorrection;
    } catch { /* 解析できない場合は文字列の特徴だけで判定する */ }

    const negated = /(?:なかっ|なかった|ません|できない|できなかった|ではない|じゃない)/.test(text) || /(?:^|[がはも、。！!？?\s])ない/.test(text);
    const passive = /(?:られた|られる|られました|れます|られて)/.test(text);
    // P666: 文末の「んだ／のだ」は説明の形で、その「だ」は過去では
    // ない（「好きなんだ」が完了相になり家事完了と誤判定されて
    // いた）。完了の判定では末尾の んだ／のだ を除いてから見る
    // （「作ったんだ」は「た」が残るので完了のまま）。
    const aspectText = text.replace(/(?:んだ|のだ)(?=[。！!？?]|よ|ね|$)/, '');
    const aspect: UtteranceAspect =
      /(?:たい|ほしい|欲しい)(?:[。！!？?]|な|の|です|けど|が|$)/.test(text) ? 'DESIDERATIVE'
      : /(?:なきゃ|なければ|ないと(?:いけない)?|なあかん)/.test(text) ? 'OBLIGATION'
      : /(?:てる|ている|てます|でる)(?:[。！!？?]|よ|ね|$)/.test(text) ? 'ONGOING'
      : /(?:た|だ|した|できた|ました)(?:[。！!？?]|よ|ね|$)/.test(aspectText) || /(?:た|だ)$/.test(aspectText.trim()) ? 'COMPLETED'
      : /(?:しよう|しましょう|ようと思う)/.test(text) ? 'VOLITIONAL'
      : 'OTHER';
    const questionForm: QuestionForm =
      !hasQuestion && !/[？?]/.test(text) ? 'NONE'
      : /(?:何|なに|どこ|いつ|誰|だれ|なぜ|どうして|どれ|いくら|いくつ|どんな|どちら|なんの)/.test(text) ? 'WH'
      : 'YESNO';
    // P630: 命令・依頼の形の知識はここ（特徴の層）に集約する。
    // 以前は対話行為の分類（conversationStateService）の中に同等の
    // パターンが別にあり、判定が二重化していた。
    const imperative = /(?:ください|なさい|てごらん|ってみて)/.test(text)
      || /(?:て|して|せて)(?:ください|くれ|ほしい|もらえ|いただけ)/.test(text)
      || /(?:してください|お願いします|頼む|してくれ|やってくれ|やって|して|しろ|やれ)[。！!]?$/.test(text.trim())
      || /(?:てほしい|してほしい|お願い)[。！!]?$/.test(text.trim())
      || /(?:教えて|見せて|聞かせて|読ませて|開けて|閉めて|歌って|書いて|読んで|作って|買って|持って|取って|連れて|座って|描いて|言って)(?:よ|ね)?[。！!]?$/.test(text.trim())
      || /(?:手伝って|待って|見て|聞いて|止まって)(?:よ|ね)?[。！!]?$/.test(text.trim())
      || /(?:てて|てきて)(?:よ|ね)?[。！!]?$/.test(text.trim());
    // P631: 訂正の合図も形の知識としてここに集約する（以前は
    // 対話行為の分類と受け止め誤爆の記録で別々に判定していた）。
    const correction = hasCorrection
      || /(?:違う|そうじゃない|そういうことじゃ|そういう意味じゃ|ではなくて|じゃなくて|伝わってない|わかってない|分かってない)/.test(text);
    // P632: 社交行為の言い回しも形の知識としてここに置く（挨拶の
    // 添え・締めの判定が各所の正規表現に散っていた）。
    const socialAct: UtteranceFeatures['socialAct'] =
      /(?:おはよ|こんにちは|こんばんは|ただいま|やあ|おっす|ハロー)/.test(text) ? 'GREETING'
      : /(?:おやすみ|また明日|またね|バイバイ|行ってきます|お先に|じゃあね|さようなら|失礼します)/.test(text) ? 'FAREWELL'
      : /(?:ありがとう|ありがと|感謝|サンキュー)/.test(text) ? 'THANKS'
      : /(?:ごめん|すみません|申し訳)/.test(text) ? 'APOLOGY'
      : undefined;
    // P658: 相槌の判定も形の知識としてここに集約する（P656/P657 で
    // 話題の反響と話題の記録に別々に入れた停止リストを一本化）。
    const backchannel = isBackchannelText(text);
    return { aspect, negated, passive, questionForm, imperative, correction, socialAct, backchannel, tokens, contentTokens, subject, object, topic };
  }

  /**
   * P620: 渡された語幹が否定の連なりを伴う箇所を取り除いた文を返す。
   * 「痛くない」「不安じゃない」「心配ない」のような、語彙としては
   * 状態語を含むが意味は否定、という箇所を数えないために使う。
   * 語彙（どの語が状態語か）は呼び出し側の領分で、否定の形の知識は
   * ここ（特徴の層）に集約する。
   */
  public maskNegatedMentions(text: string, stems: string[]): string {
    const source = String(text || '');
    if (!source || stems.length === 0) return source;
    const escaped = stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const span = new RegExp(`(?:${escaped})(?:い|く|て|では|じゃ)?(?:ない|なかった|ありません|ません)`, 'g');
    return source.replace(span, '');
  }
}

export const utteranceFeatureService = UtteranceFeatureService.getInstance();

/**
 * P658: 相槌・感動詞の語群。「話題ではない反応」の知識はここが
 * 唯一の出所（話題の反響 P656・話題の記録 P657 が消費する）。
 * 語単体にも発話全体にも使う（末尾の句読点は無視する）。
 */
const BACKCHANNEL_SET = new Set([
  'うん', 'うんうん', 'ううん', 'へー', 'へえ', 'ふーん', 'ふうん', 'はい', 'なるほど',
  'おー', 'あー', 'えー', 'ええ', 'まじ', 'まじで', 'そうか', 'そっか', 'そうね', 'そうだね',
  'ほんと', '本当', 'すごい', 'やばい', 'わー', 'わあ',
]);

export function isBackchannelText(text: string): boolean {
  const t = String(text || '').trim().replace(/[。、！!？?\s]+$/g, '');
  if (!t) return false;
  if (BACKCHANNEL_SET.has(t)) return true;
  if (/^(うん)+$/.test(t) || /^へー+$/.test(t) || /^ふーん$/.test(t)) return true;
  // P661: 笑いの反応（ｗｗｗ・「わらう」だけ等）と、記号・絵文字だけの
  // 入力も話題ではない（「www、そうなんですね」という反響になって
  // いた）。相槌と同じ「話題ではない反応」としてここで判定する。
  if (/^[wｗ]+$/i.test(t)) return true;
  if (/^(わらう|笑う|わらた|笑った)$/.test(t)) return true;
  if (!/[ぁ-んァ-ヶ一-龠a-zA-Z0-9]/.test(t)) return true;
  return false;
}
