import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { selfPreferenceService } from './selfPreferenceService';

/**
 * P938: 創作を書いて自分で直す（第1段: 俳句）。
 *
 * 彼女の流儀で測れる形——音数（モーラ）——を制約にして書き、
 * 推敲では「音数が合わない行を組み直す」「同じ語の重なりを
 * 別の語に替える」という、理由を言える直しだけを行う。
 * 初稿と推敲後と変更理由を作品として残す。
 * 材料の語は、彼女が知っている語（好み・育った好み）と
 * 基本の自然語彙から取る。
 */

const STORAGE_KEY = 'miki_creative_works_v1';
const MAX_WORKS = 30;
const PARTICLES = ['は', 'の', 'に', 'へ', 'と', 'も'];
const PALETTE = [
  'つき', 'ほし', 'ゆき', 'はな', 'かぜ', 'うみ', 'そら', 'あめ',
  'やま', 'かわ', 'もり', 'ゆめ', 'こえ', 'かげ', 'あさ', 'ゆう',
  'はる', 'なつ', 'あき', 'ふゆ', 'なみ', 'くも', 'つゆ',
  'ひかり', 'しずく', 'もみじ', 'さくら', 'ほたる',
];

/** モーラ数。小さい ゃゅょ は数えず、っ と ー は数える。 */
export function moraCount(word: string): number {
  let n = 0;
  for (const ch of String(word || '')) {
    if ('ゃゅょ'.includes(ch)) continue;
    n += 1;
  }
  return n;
}

export interface CreativeWork {
  id: string;
  theme?: string;
  draft: string[];
  revised: string[];
  changes: string[];
  at: number;
}

interface LineBuild {
  text: string;
  words: string[];
  mora: number;
}

class CreativeWritingService {
  /** 材料の語: 基本語彙＋彼女の好み（かな表記で音数を数えられるもの）。 */
  private materialPool(personaId: string): string[] {
    const pool = [...PALETTE];
    try {
      const extra = [
        ...selfPreferenceService.listTaught(personaId).map((t) => t.term),
        ...selfPreferenceService.listGrown(personaId).map((g) => g.term),
      ];
      for (const term of extra) {
        if (/^[ぁ-んァ-ヶー]+$/.test(term) && moraCount(term) >= 2 && moraCount(term) <= 5 && !pool.includes(term)) {
          pool.push(term);
        }
      }
    } catch { /* 好みは補助材料 */ }
    return pool;
  }

  /**
   * 目標音数に合う行を組む。allowPairs=false の初稿では
   * 1語か「語＋助詞」まで、推敲では複数語の組み合わせまで使う。
   */
  private buildLine(target: number, pool: string[], used: Set<string>, allowPairs: boolean, mustInclude?: string): LineBuild | null {
    const candidates = pool.filter((w) => !used.has(w));
    const withWord = (words: string[], particle?: string): LineBuild => {
      const text = words.join('') + (particle || '');
      return { text, words, mora: moraCount(text) };
    };
    if (mustInclude && !used.has(mustInclude) && candidates.includes(mustInclude)) {
      const rest = target - moraCount(mustInclude);
      if (rest === 0) return withWord([mustInclude]);
      if (rest === 1) return withWord([mustInclude], PARTICLES[0]);
      if (allowPairs) {
        for (const w of candidates) {
          if (w === mustInclude) continue;
          if (moraCount(w) === rest) return withWord([mustInclude, w]);
          if (moraCount(w) === rest - 1) return withWord([mustInclude, w], PARTICLES[1]);
        }
      }
      // テーマ語を入れると音数が合わない場合はテーマなしで組み直す。
    }
    for (const w of candidates) {
      if (moraCount(w) === target) return withWord([w]);
      if (moraCount(w) === target - 1) return withWord([w], PARTICLES[0]);
    }
    // 「語の語」は初稿でも使う自然な組み方。
    for (const a of candidates) {
      for (const b of candidates) {
        if (a === b) continue;
        if (moraCount(a) + 1 + moraCount(b) === target) {
          return { text: `${a}の${b}`, words: [a, b], mora: target };
        }
      }
    }
    if (allowPairs) {
      for (const a of candidates) {
        for (const b of candidates) {
          if (a === b) continue;
          const sum = moraCount(a) + moraCount(b);
          if (sum === target) return withWord([a, b]);
          if (sum === target - 1) return withWord([a, b], PARTICLES[1]);
          for (const c of candidates) {
            if (c === a || c === b) continue;
            if (sum + moraCount(c) === target) return withWord([a, b, c]);
          }
        }
      }
    }
    // 最後の手段: 一番近い語を置く（推敲で直す前提の初稿）。
    const closest = candidates[0];
    return closest ? withWord([closest]) : null;
  }

  /** 俳句を1首書く。初稿→推敲（音数と重なりの修正）→保存。 */
  public writeHaiku(personaId: string, theme?: string, seed: number = Date.now()): CreativeWork | null {
    const basePool = this.materialPool(personaId);
    if (theme && /^[ぁ-んァ-ヶー]+$/.test(theme) && !basePool.includes(theme)) basePool.unshift(theme);
    const shift = Math.abs(Math.floor(seed)) % Math.max(1, basePool.length);
    const pool = [...basePool.slice(shift), ...basePool.slice(0, shift)];
    const targets = [5, 7, 5];

    // 初稿: 簡単な組み方だけ。
    const draftUsed = new Set<string>();
    const draft: LineBuild[] = [];
    targets.forEach((target, i) => {
      const line = this.buildLine(target, pool, draftUsed, false, i === 0 ? theme : undefined);
      if (line) { draft.push(line); line.words.forEach((w) => draftUsed.add(w)); }
    });
    if (draft.length < 3) return null;

    // 推敲: 音数が合わない行は組み直し、語の重なりは替えを試す。
    const changes: string[] = [];
    const revisedUsed = new Set<string>();
    const revised: LineBuild[] = [];
    draft.forEach((line, i) => {
      const target = targets[i];
      const repeated = line.words.some((w) => revisedUsed.has(w));
      const themeMissing = i === 0 && !!theme && /^[ぁ-んァ-ヶー]+$/.test(theme)
        && pool.includes(theme) && !line.words.includes(theme);
      if (line.mora !== target || repeated || themeMissing) {
        const fixed = this.buildLine(target, pool, revisedUsed, true, i === 0 ? theme : undefined);
        if (fixed && (fixed.text !== line.text)) {
          changes.push(line.mora !== target
            ? `${i + 1}行目が${line.mora}音だったので、組み直して${target}音にした`
            : repeated
              ? `${i + 1}行目の語が重なったので、別の語に替えた`
              : `1行目にテーマの「${theme}」を入れた`);
          revised.push(fixed);
          fixed.words.forEach((w) => revisedUsed.add(w));
          return;
        }
      }
      revised.push(line);
      line.words.forEach((w) => revisedUsed.add(w));
    });

    const work: CreativeWork = {
      id: `work-${seed}`,
      theme,
      draft: draft.map((l) => l.text),
      revised: revised.map((l) => l.text),
      changes,
      at: Date.now(),
    };
    const works = this.loadWorks();
    works.push(work);
    storageService.setItem(STORAGE_KEY, JSON.stringify(works.slice(-MAX_WORKS)));
    systemLogger.info('SYSTEM', `✍ [創作] 俳句を書いた: ${work.revised.join(' / ')}（推敲${changes.length}件）`);
    return work;
  }

  private loadWorks(): CreativeWork[] {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  public latest(): CreativeWork | undefined {
    const works = this.loadWorks();
    return works[works.length - 1];
  }

  public summary(): { works: number; revisions: number } {
    const works = this.loadWorks();
    return { works: works.length, revisions: works.reduce((s, w) => s + w.changes.length, 0) };
  }
}

export const creativeWritingService = new CreativeWritingService();
