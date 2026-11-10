import { storageService } from '../../../services/storageService';
import { utteranceFeatureService } from '../../memory/services/utteranceFeatureService';

/**
 * P524: 相手の状態の流れ。
 *
 * 疲労や上向きの兆候は、そのターンの戦略選択にしか使われず、
 * 「ここ数日お疲れが続いている」のような流れとしては読まれて
 * いなかった。ここでは兆候だけを小さく記録し、継続の有無を
 * 受け止め方に反映できるようにする。記録は兆候の種類と時刻
 * だけで、発話そのものは残さない。
 */

export type UserStateSignal = 'fatigue' | 'positive' | 'anxiety' | 'hunger' | 'loneliness' | 'thirst' | 'pain';

interface UserStateTrailEntry {
  signal: UserStateSignal;
  at: number;
}

const STORAGE_KEY = 'miki_user_state_trail_v1';
const MAX_ENTRIES = 40;
const RETENTION_MS = 7 * 24 * 3600_000;

const FATIGUE_PATTERN = /(?:疲れた|しんどい|もう無理|だるい|つらい|嫌になった|最悪|やってられない|勘弁して|眠い|眠たい|ねむたい|限界|へろへろ|へとへと|クタクタ)/;
const POSITIVE_PATTERN = /(?:嬉しい|うれしい|楽しい|よかった|やった|最高|面白い|気持ちいい)/;
// P573: 不安と空腹も「状態」として流れに残す（受け止めの継続判定に使う）。
const ANXIETY_PATTERN = /(?:不安|心配|緊張|ドキドキ|気がかり|怖い|こわい)/;
const HUNGER_PATTERN = /(?:お腹すいた|おなかすいた|お腹空いた|お腹が空いた|腹減った|はらへった|腹ペコ|はらぺこ)/;
// P584: 寂しさと喉の渇きも状態として受ける。
const LONELINESS_PATTERN = /(?:寂しい|さみしい|淋しい|孤独|ひとりぼっち|一人ぼっち|会いたい|あいたい)/;
const THIRST_PATTERN = /(?:喉乾いた|のど乾いた|喉かわいた|喉が渇いた|のどかわいた|水分)/;
// P591: 痛みも状態として受ける（「頭痛い」に「頭痛、そうなんですね」とだけ返っていた）。
// P604: かなの「いたい」は、助詞の後か文頭のときだけ痛みとみなす
// （「飼いたい」「買いたい」のような〜たい（希望）に誤爆していた）。
const PAIN_PATTERN = /(?:頭痛|腹痛|歯痛|腰痛|肩こり|痛い|痛み|痛く|ズキズキ|疼|(?:^|[がはも、。！!？?\s])いたい)/;

// P620: 状態語が否定されている箇所（痛くない・不安じゃない・心配ない等）は
// 兆候として数えない。否定の形の知識は共有の特徴サービス（P615）に寄せ、
// 状態語の語彙だけをここに持ち、否定された言及を取り除いてから
// 語彙パターンを当てる（移行前は「痛くないよ」が痛みの受け止めに、
// 「心配ないよ」が不安の継続形になっていた）。
const STATE_STEMS = ['疲れ', 'しんど', 'だる', '眠', 'ねむ', '痛', '不安', '心配', '寂し', 'さみし', '孤独', '緊張', '怖', 'こわ'];

function affirmedText(text: string): string {
  try {
    return utteranceFeatureService.maskNegatedMentions(String(text || ''), STATE_STEMS);
  } catch {
    return String(text || '');
  }
}

export class UserStateTrailService {
  private static instance: UserStateTrailService;

  private constructor() {}

  public static getInstance(): UserStateTrailService {
    if (!UserStateTrailService.instance) {
      UserStateTrailService.instance = new UserStateTrailService();
    }
    return UserStateTrailService.instance;
  }

  private load(): UserStateTrailEntry[] {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as UserStateTrailEntry[];
      if (!Array.isArray(parsed)) return [];
      const since = Date.now() - RETENTION_MS;
      return parsed.filter((e) => e && typeof e.at === 'number' && e.at >= since);
    } catch {
      return [];
    }
  }

  private save(entries: UserStateTrailEntry[]): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch { /* 記録は補助経路 */ }
  }

  /** P547: 疲労の言い回しかどうかだけを見る（記録はしない）。判定の語彙はここに集約する。 */
  public isFatigueText(text: string): boolean {
    return FATIGUE_PATTERN.test(affirmedText(text));
  }

  /** P573: 不安の言い回しかどうかだけを見る（記録はしない）。 */
  public isAnxietyText(text: string): boolean {
    return ANXIETY_PATTERN.test(affirmedText(text));
  }

  /** P573: 空腹の言い回しかどうかだけを見る（記録はしない）。 */
  public isHungerText(text: string): boolean {
    return HUNGER_PATTERN.test(affirmedText(text));
  }

  /** P584: 寂しさの言い回しかどうかだけを見る（記録はしない）。 */
  public isLonelinessText(text: string): boolean {
    return LONELINESS_PATTERN.test(affirmedText(text));
  }

  /** P584: 喉の渇きの言い回しかどうかだけを見る（記録はしない）。 */
  public isThirstText(text: string): boolean {
    return THIRST_PATTERN.test(affirmedText(text));
  }

  /** P591: 痛みの言い回しかどうかだけを見る（記録はしない）。 */
  public isPainText(text: string): boolean {
    return PAIN_PATTERN.test(affirmedText(text));
  }

  /** 発話から兆候を読み、あれば記録して返す。 */
  public recordFromText(text: string): UserStateSignal | undefined {
    const source = affirmedText(text);
    const signal: UserStateSignal | undefined = FATIGUE_PATTERN.test(source)
      ? 'fatigue'
      : ANXIETY_PATTERN.test(source)
        ? 'anxiety'
        : PAIN_PATTERN.test(source)
          ? 'pain'
          : HUNGER_PATTERN.test(source)
            ? 'hunger'
            : LONELINESS_PATTERN.test(source)
              ? 'loneliness'
              : THIRST_PATTERN.test(source)
                ? 'thirst'
                : POSITIVE_PATTERN.test(source)
                  ? 'positive'
                  : undefined;
    if (!signal) return undefined;
    const entries = this.load();
    entries.push({ signal, at: Date.now() });
    this.save(entries);
    return signal;
  }

  /** 直近 withinHours 時間以内の、その兆候の記録数。 */
  public recentCount(signal: UserStateSignal, withinHours: number): number {
    const since = Date.now() - withinHours * 3600_000;
    return this.load().filter((e) => e.signal === signal && e.at >= since).length;
  }
}

export const userStateTrailService = UserStateTrailService.getInstance();
