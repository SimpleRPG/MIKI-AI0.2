import { storageService } from '../../../services/storageService';
import { utteranceFeatureService } from '../../memory/services/utteranceFeatureService';
import { dayKeyOf } from '../../memory/services/dayKeyService';

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
const RESOLVED_KEY = 'miki_user_state_resolved_v1';
const MAX_ENTRIES = 40;
const RETENTION_MS = 7 * 24 * 3600_000;

const FATIGUE_PATTERN = /(?:疲れた|しんどい|もう無理|だるい|つらい|嫌になった|最悪|やってられない|勘弁して|眠い|眠たい|ねむたい|限界|へろへろ|へとへと|クタクタ)/;
// P697: ワクワクとドキドキは、期待・高揚の側の状態（ドキドキを
// 不安に入れていたため「ドキドキする」に心配の受け止めが返り、
// 状態の流れにも心配として積まれていた）。
const POSITIVE_PATTERN = /(?:嬉しい|うれしい|楽しい|よかった|やった|最高|面白い|気持ちいい|ワクワク|ドキドキ|楽しみ)/;
// P573: 不安と空腹も「状態」として流れに残す（受け止めの継続判定に使う）。
const ANXIETY_PATTERN = /(?:不安|心配|緊張|気がかり|怖い|こわい)/;
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
  /** P625: その兆候が最後に記録された時刻（無ければ undefined）。 */
  public lastRecordedAt(signal: UserStateSignal): number | undefined {
    const hits = this.load().filter((e) => e.signal === signal);
    if (hits.length === 0) return undefined;
    return hits[hits.length - 1].at;
  }

  /** P648: 指定した日（YYYY-MM-DD）にその兆候が何回記録されたか。 */
  public countOnDay(signal: UserStateSignal, day: string): number {
    return this.load().filter((e) => e.signal === signal && dayKeyOf(e.at) === day).length;
  }

  /** P634: その兆候が「解消した」と言われた時刻（無ければ undefined）。 */
  public resolvedAt(signal: UserStateSignal): number | undefined {
    try {
      const map = JSON.parse(storageService.getItem(RESOLVED_KEY) || '{}') as Record<string, number>;
      return typeof map[signal] === 'number' ? map[signal] : undefined;
    } catch { return undefined; }
  }

  private markResolved(signal: UserStateSignal): void {
    try {
      const map = JSON.parse(storageService.getItem(RESOLVED_KEY) || '{}') as Record<string, number>;
      map[signal] = Date.now();
      storageService.setItem(RESOLVED_KEY, JSON.stringify(map));
    } catch { /* 補助経路 */ }
  }

  public recordFromText(text: string): UserStateSignal | undefined {
    const source = affirmedText(text);
    // P634: 回復の宣言（「疲れ取れた」）は兆候の記録ではなく解消
    // として扱う。移行前は、回復を言っただけで疲れの兆候がもう
    // 1件積まれ、継続の判定（P524）や経過の想起（P625）が逆転
    // していた。疑問形（「疲れ取れた？」）は宣言ではないので対象外。
    try {
      if (utteranceFeatureService.analyze(source).questionForm === 'NONE'
        && /(?:取れた|抜けた|治った|良くなった|落ち着いた|回復した)/.test(source)) {
        // 兆候パターンは「疲れた」のような報告形に寄っているため、
        // 解消の照合は語幹で行う（「疲れ取れた」の疲れ等）。
        const resolving: UserStateSignal | undefined = /(?:疲れ|眠気|だる|しんど)/.test(source) ? 'fatigue'
          : /(?:痛|頭痛|腹痛|歯痛|腰痛)/.test(source) ? 'pain'
            : /(?:不安|心配|緊張)/.test(source) ? 'anxiety'
              : undefined;
        if (resolving) {
          this.markResolved(resolving);
          return undefined;
        }
      }
    } catch { /* 解消の判定は補助。失敗したら通常の記録に進む */ }
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

  /** 直近 withinHours 時間以内の、その兆候の記録数。
   * P634: 解消が記録されている兆候は、解消より前の記録を数えない。 */
  public recentCount(signal: UserStateSignal, withinHours: number): number {
    const resolved = this.resolvedAt(signal) || 0;
    const since = Math.max(Date.now() - withinHours * 3600_000, resolved);
    return this.load().filter((e) => e.signal === signal && e.at >= since && e.at > resolved).length;
  }
}

export const userStateTrailService = UserStateTrailService.getInstance();
