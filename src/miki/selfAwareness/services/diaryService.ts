import { storageService } from '../../../services/storageService';
import { knowledgeConsolidationService } from './knowledgeConsolidationService';
import { mistakeNotebookService } from './mistakeNotebookService';
import { specialDayService } from './specialDayService';

/**
 * P934: 日記を書く。
 *
 * 1日の終わりに、その日の材料（特別な日・会話の話題・直した
 * 間違い・眠って整理した内容）から短い日記を書く。書くのは
 * 「おやすみ」のタイミング（眠って整理と同時）。内容は測れる
 * 材料だけで組み、材料が無い日は静かな一日として正直に書く。
 * 同じ日は1件（書き直しは上書き）。
 */

export interface DiaryEntry {
  date: string;
  text: string;
  at: number;
}

const KEY = 'miki_diary_v1';
const MAX_ENTRIES = 90;

function dateKey(now: number): string {
  const d = new Date(now);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

class DiaryService {
  private load(): DiaryEntry[] {
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as DiaryEntry[];
      }
    } catch { /* fall through */ }
    return [];
  }

  private save(entries: DiaryEntry[]): void {
    try {
      storageService.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch { /* 保存できなくても本流は止めない */ }
  }

  /** その日の材料から日記の本文を組む。 */
  public compose(now = Date.now()): string {
    const parts: string[] = [];
    try {
      const specials = specialDayService.today(now);
      for (const day of specials) {
        parts.push(`今日は「${day.name}」の日だった。`);
      }
    } catch { /* 材料が無ければ省く */ }
    try {
      const raw = storageService.getItem('miki_episodes_v1');
      const episodes: Array<{ day?: string; topics?: string[] }> = raw ? JSON.parse(raw) : [];
      const todayKey = dateKey(now);
      const topics: string[] = [];
      for (const ep of episodes) {
        if (!ep || ep.day !== todayKey || !Array.isArray(ep.topics)) continue;
        for (const topic of ep.topics) {
          if (typeof topic === 'string' && topic && !topics.includes(topic)) topics.push(topic);
        }
      }
      if (topics.length) {
        parts.push(`${topics.slice(0, 3).join('と')}の話をした。`);
      }
    } catch { /* 材料が無ければ省く */ }
    try {
      const todaysMistakes = mistakeNotebookService.list(50)
        .filter((e) => e.kind === 'CORRECTION' && sameDay(e.lastAt, now));
      for (const entry of todaysMistakes.slice(0, 2)) {
        parts.push(`「${entry.wrong}」を「${entry.right}」に直した。`);
      }
    } catch { /* 材料が無ければ省く */ }
    try {
      const report = knowledgeConsolidationService.lastReport();
      if (report && sameDay(report.at, now)) {
        const bits: string[] = [];
        if (report.relationsAdded > 0) bits.push(`関係を${report.relationsAdded}件つなぎ直した`);
        if (report.schemas > 0) bits.push(`共通の型を${report.schemas}件立てた`);
        if (report.mistakesReviewed > 0) bits.push(`間違い帳を${report.mistakesReviewed}件見直した`);
        if (bits.length) parts.push(`寝る前に整理して、${bits.join('、')}。`);
      }
    } catch { /* 材料が無ければ省く */ }
    if (!parts.length) parts.push('静かな一日だった。');
    return parts.join('');
  }

  /** 今日の日記を書く（同じ日は書き直して1件に保つ）。 */
  public writeToday(now = Date.now()): DiaryEntry {
    const entry: DiaryEntry = { date: dateKey(now), text: this.compose(now), at: now };
    const entries = this.load().filter((e) => e.date !== entry.date);
    entries.push(entry);
    this.save(entries);
    return entry;
  }

  public latest(): DiaryEntry | null {
    const entries = this.load();
    return entries.length ? entries[entries.length - 1] : null;
  }

  public list(limit = 7): DiaryEntry[] {
    return [...this.load()].slice(-limit).reverse();
  }

  public summary(): { entries: number } {
    return { entries: this.load().length };
  }
}

export const diaryService = new DiaryService();
