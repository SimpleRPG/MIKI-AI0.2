import { storageService } from '../../../services/storageService';

/**
 * P932: 記念日・約束の日を覚える。
 *
 * 誕生日や記念日のような「毎年その日に意味がある日」を、
 * 教わったときに登録しておく土台。彼女が自分から持ち出す
 * （挨拶や話題として切り出す）のは次の段で、ここでは
 * 「覚える・今日／近日の分を引ける・聞かれたら答える」まで。
 */

export interface SpecialDay {
  id: string;
  name: string;
  month: number;
  day: number;
  note: string;
  createdAt: number;
}

const KEY = 'miki_special_days_v1';

class SpecialDayService {
  private load(): SpecialDay[] {
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as SpecialDay[];
      }
    } catch { /* fall through */ }
    return [];
  }

  private save(days: SpecialDay[]): void {
    try {
      storageService.setItem(KEY, JSON.stringify(days));
    } catch { /* 保存できなくても本流は止めない */ }
  }

  public register(name: string, month: number, day: number, note = ''): SpecialDay | null {
    const clean = name.trim();
    if (!clean || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const days = this.load().filter((d) => !(d.name === clean && d.month === month && d.day === day));
    const entry: SpecialDay = {
      id: `special-${month}-${day}-${clean}`,
      name: clean,
      month,
      day,
      note: note.trim(),
      createdAt: Date.now(),
    };
    days.push(entry);
    this.save(days);
    return entry;
  }

  public list(): SpecialDay[] {
    return this.load();
  }

  public onDate(month: number, day: number): SpecialDay[] {
    return this.load().filter((d) => d.month === month && d.day === day);
  }

  public today(now = Date.now()): SpecialDay[] {
    const date = new Date(now);
    return this.onDate(date.getMonth() + 1, date.getDate());
  }

  /** 今日から withinDays 日以内にある特別な日（年またぎ対応）。 */
  public upcoming(now = Date.now(), withinDays = 7): Array<{ day: SpecialDay; inDays: number }> {
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    const found: Array<{ day: SpecialDay; inDays: number }> = [];
    for (const entry of this.load()) {
      for (let offset = 0; offset <= withinDays; offset++) {
        const probe = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
        if (probe.getMonth() + 1 === entry.month && probe.getDate() === entry.day) {
          found.push({ day: entry, inDays: offset });
          break;
        }
      }
    }
    return found.sort((a, b) => a.inDays - b.inDays);
  }

  public summary(): { days: number } {
    return { days: this.load().length };
  }
}

export const specialDayService = new SpecialDayService();
