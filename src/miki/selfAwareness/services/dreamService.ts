import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { creativeWritingService } from './creativeWritingService';
import { gamePlayService } from './gamePlayService';
import { specialDayService } from './specialDayService';

/**
 * P939: 夢を見る（第1段）。
 *
 * 眠って整理する時間（P931）の中で、その日の材料（会話の話題・
 * 特別な日・遊んだゲーム・書いた作品）を組み合わせて夢を作る。
 * 夢は知識ではない——Claim には絶対に入れず、夢としてだけ残し、
 * 聞かれたら「夢の中で」と前置きして話す。材料が無ければ見ない。
 */

const STORAGE_KEY = 'miki_dreams_v1';
const EPISODES_KEY = 'miki_episodes_v1';
const MAX_DREAMS = 30;

const TRANSFORMS = [
  '空を飛んでいた',
  'いつもよりずっと大きく見えた',
  '声が聞こえた気がした',
  '色がゆっくり変わっていた',
  '上下が逆さまになっていた',
  '水の上を歩いていた',
];
const CLOSINGS = [
  'なんだか懐かしい感じがした',
  '目が覚めても覚えている',
  '不思議だったけど、嫌じゃなかった',
  'もう少し見ていたかった',
];

export interface DreamRecord {
  date: string;
  text: string;
  materials: string[];
  at: number;
}

class DreamService {
  private localDate(now: number): string {
    const d = new Date(now);
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  /** 夢の材料: 直近の話題・特別な日・遊んだゲーム・書いた作品。 */
  private gatherMaterials(now: number): string[] {
    const materials: string[] = [];
    try {
      const episodes = JSON.parse(storageService.getItem(EPISODES_KEY) || '[]');
      if (Array.isArray(episodes)) {
        for (const ep of episodes.slice(-3)) {
          for (const topic of (ep?.topics || [])) {
            const t = String(topic || '').trim();
            if (t && !materials.includes(t)) materials.push(t);
          }
        }
      }
    } catch { /* 材料は任意 */ }
    try {
      for (const day of specialDayService.today(now)) {
        if (!materials.includes(day.name)) materials.push(day.name);
      }
    } catch { /* 材料は任意 */ }
    try {
      const lastGame = gamePlayService.lastSession();
      if (lastGame && !materials.includes(lastGame.title)) materials.push(lastGame.title);
      const work = creativeWritingService.latest();
      if (work?.theme && !materials.includes(work.theme)) materials.push(work.theme);
    } catch { /* 材料は任意 */ }
    return materials.slice(0, 8);
  }

  /** 今夜の夢。同じ日は1つだけ。材料が無ければ null。 */
  public dreamTonight(now = Date.now()): DreamRecord | null {
    const date = this.localDate(now);
    const dreams = this.loadDreams();
    const existing = dreams.find((d) => d.date === date);
    if (existing) return existing;
    const materials = this.gatherMaterials(now);
    if (!materials.length) return null;
    const seed = Math.floor(now / 86400000);
    const primary = materials[seed % materials.length];
    const secondary = materials.length > 1 ? materials[(seed >> 2) % materials.length] : undefined;
    const transform = TRANSFORMS[seed % TRANSFORMS.length];
    const closing = CLOSINGS[seed % CLOSINGS.length];
    const secondSentence = secondary && secondary !== primary
      ? `${secondary}も出てきて、`
      : '';
    const record: DreamRecord = {
      date,
      text: `夢の中で、${primary}が${transform}。${secondSentence}${closing}。`,
      materials,
      at: now,
    };
    dreams.push(record);
    storageService.setItem(STORAGE_KEY, JSON.stringify(dreams.slice(-MAX_DREAMS)));
    systemLogger.info('SYSTEM', `💤 [夢] ${record.text}`);
    return record;
  }

  private loadDreams(): DreamRecord[] {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  public latest(): DreamRecord | undefined {
    const dreams = this.loadDreams();
    return dreams[dreams.length - 1];
  }

  public summary(): { dreams: number } {
    return { dreams: this.loadDreams().length };
  }
}

export const dreamService = new DreamService();
