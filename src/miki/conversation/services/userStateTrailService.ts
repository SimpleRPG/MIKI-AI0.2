import { storageService } from '../../../services/storageService';

/**
 * P524: 相手の状態の流れ。
 *
 * 疲労や上向きの兆候は、そのターンの戦略選択にしか使われず、
 * 「ここ数日お疲れが続いている」のような流れとしては読まれて
 * いなかった。ここでは兆候だけを小さく記録し、継続の有無を
 * 受け止め方に反映できるようにする。記録は兆候の種類と時刻
 * だけで、発話そのものは残さない。
 */

export type UserStateSignal = 'fatigue' | 'positive' | 'anxiety' | 'hunger';

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
    return FATIGUE_PATTERN.test(String(text || ''));
  }

  /** P573: 不安の言い回しかどうかだけを見る（記録はしない）。 */
  public isAnxietyText(text: string): boolean {
    return ANXIETY_PATTERN.test(String(text || ''));
  }

  /** P573: 空腹の言い回しかどうかだけを見る（記録はしない）。 */
  public isHungerText(text: string): boolean {
    return HUNGER_PATTERN.test(String(text || ''));
  }

  /** 発話から兆候を読み、あれば記録して返す。 */
  public recordFromText(text: string): UserStateSignal | undefined {
    const source = String(text || '');
    const signal: UserStateSignal | undefined = FATIGUE_PATTERN.test(source)
      ? 'fatigue'
      : ANXIETY_PATTERN.test(source)
        ? 'anxiety'
        : HUNGER_PATTERN.test(source)
          ? 'hunger'
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
