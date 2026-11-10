import { storageService } from '../../../services/storageService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';

/**
 * P669: しりとりの継続。彼女の語彙（辞書の名詞＋読み）がそのまま
 * 遊びの材料になる——語彙が育つほど彼女は強くなる。
 *
 * ルール（ゆるい家庭ルール）：
 * - 濁点の有無は区別しない（ご＝こ、ざ＝さ 等）。
 * - 小さい ゃゅょ は大きい文字として数える。
 * - 語尾の「ー」は、その前の音で数える。
 * - 「ん」で終わる言葉を言った側の負け。
 * - 読みが分からない漢字の言葉は、ひらがなで聞き返す（状態は保つ）。
 */

const KEY = 'miki_shiritori_v1';
const LAST_RESULT_KEY = 'miki_shiritori_last_result_v1';

/** P689: 終わったしりとりの勝敗を残す（後から聞かれたときに答える）。 */
function recordOutcome(winner: 'miki' | 'user' | 'stopped', usedCount: number): void {
  try {
    storageService.setItem(LAST_RESULT_KEY, JSON.stringify({ winner, usedCount, at: Date.now() }));
  } catch { /* 勝敗の記録は補助 */ }
}
const TIMEOUT_MS = 30 * 60_000;

interface ShiritoriState {
  active: boolean;
  /** 照合用キー（濁点を落としたかな）。 */
  requiredKana: string;
  /** 表示用のかな（濁点つき）。 */
  requiredDisplay: string;
  used: string[];
  updatedAt: number;
}

const DAKUTEN: Record<string, string> = {
  'が': 'か', 'ぎ': 'き', 'ぐ': 'く', 'げ': 'け', 'ご': 'こ',
  'ざ': 'さ', 'じ': 'し', 'ず': 'す', 'ぜ': 'せ', 'ぞ': 'そ',
  'だ': 'た', 'ぢ': 'ち', 'づ': 'つ', 'で': 'て', 'ど': 'と',
  'ば': 'は', 'び': 'ひ', 'ぶ': 'ふ', 'べ': 'へ', 'ぼ': 'ほ',
  'ぱ': 'は', 'ぴ': 'ひ', 'ぷ': 'ふ', 'ぺ': 'へ', 'ぽ': 'ほ',
  'ゔ': 'う',
};
const SMALL: Record<string, string> = {
  'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
  'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'っ': 'つ', 'ゎ': 'わ',
};

function toHiragana(text: string): string {
  return String(text || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function kanaKey(ch: string): string {
  const h = toHiragana(ch);
  return DAKUTEN[h] || SMALL[h] || h;
}

function firstKana(reading: string): string {
  const h = toHiragana(reading);
  return h ? kanaKey(h[0]) : '';
}

function lastKana(reading: string): string {
  const d = lastKanaDisplay(reading);
  return d ? kanaKey(d) : '';
}

/** 末尾のかな（表示用：小さい文字は大きくし、濁点は残す）。 */
function lastKanaDisplay(reading: string): string {
  const chars = [...toHiragana(reading)];
  while (chars.length > 0 && chars[chars.length - 1] === 'ー') chars.pop();
  if (chars.length === 0) return '';
  const last = chars[chars.length - 1];
  return SMALL[last] || last;
}

function load(): ShiritoriState | undefined {
  try {
    const raw = storageService.getItem(KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as ShiritoriState;
    if (!s.active || Date.now() - (s.updatedAt || 0) > TIMEOUT_MS) return undefined;
    return s;
  } catch { return undefined; }
}

function save(s: ShiritoriState | undefined): void {
  try {
    if (s) storageService.setItem(KEY, JSON.stringify(s));
    else storageService.setItem(KEY, JSON.stringify({ active: false, requiredKana: '', requiredDisplay: '', used: [], updatedAt: 0 }));
  } catch { /* 遊びの状態は補助 */ }
}

class ShiritoriService {
  /** P689: 直近のしりとりの勝敗（終わったもの）。 */
  lastResult(): { winner: 'miki' | 'user' | 'stopped'; usedCount: number } | undefined {
    try {
      const raw = JSON.parse(storageService.getItem(LAST_RESULT_KEY) || 'null');
      if (raw && (raw.winner === 'miki' || raw.winner === 'user' || raw.winner === 'stopped')) return raw;
    } catch { /* 無ければ undefined */ }
    return undefined;
  }

  isActive(): boolean {
    return !!load();
  }

  /** 対戦状態を畳む（別の遊びへの切り替え時）。 */
  end(): void {
    save(undefined);
  }

  /** 開始：最初の言葉（りんご）を出して状態を作る。 */
  start(): string {
    save({ active: true, requiredKana: 'こ', requiredDisplay: 'ご', used: ['りんご'], updatedAt: Date.now() });
    return 'いいですよ、しりとり！じゃあ私から言いますね。「りんご」。次は「ご」から始まる言葉ですよ。';
  }

  /**
   * 対戦中の1手。単語らしい発話のときだけ応じ、それ以外は
   * undefined を返して通常の会話に譲る（対戦状態は保つ）。
   */
  respond(prompt: string): string | undefined {
    const state = load();
    if (!state) return undefined;
    const text = String(prompt || '').trim().replace(/[。！!]+$/g, '');
    if (/(?:やめる|おわり|終わり|もういい|やめたい|やめた)/.test(text)) {
      save(undefined);
      recordOutcome('stopped', state.used.length);
      return '分かりました、ここまでにしましょう。遊んでくれてありがとうございました！';
    }
    // 単語らしい形（短く、文の印が無い）でなければ会話に譲る。
    if (text.length > 10 || /[？?はがをにのともへで、。\s]/.test(text)) return undefined;

    // 読みの確定：全部かなならそのまま、辞書にあればその読み。
    let reading = '';
    if (/^[ぁ-んァ-ヶー]+$/.test(text)) {
      reading = toHiragana(text);
    } else {
      const entries = japaneseDictionaryService.lookup(text);
      const withReading = entries.find((e) => e.reading);
      if (withReading?.reading) reading = toHiragana(withReading.reading);
    }
    if (!reading) {
      return `「${text}」の読みが分からないんです。ひらがなで教えてくれますか？`;
    }
    if (state.used.some((u) => toHiragana(u) === toHiragana(text))) {
      return `「${text}」は、もう出ましたよ。次は「${state.requiredDisplay}」から始まる言葉です。`;
    }
    if (firstKana(reading) !== state.requiredKana) {
      return `それは「${state.requiredDisplay}」から始まってないですよ。もう一回どうぞ。`;
    }
    if (lastKana(reading) === 'ん') {
      save(undefined);
      recordOutcome('miki', state.used.length + 1);
      return `あっ、「${text}」は「ん」で終わっちゃいましたね。今回は私の勝ちです！また遊びましょう。`;
    }

    const used = [...state.used, text];
    const need = lastKana(reading);
    const candidates = japaneseDictionaryService.listPlayableWords()
      .filter((w) => firstKana(w.reading) === need)
      .filter((w) => !used.some((u) => toHiragana(u) === toHiragana(w.surface)))
      .filter((w) => lastKana(w.reading) !== 'ん')
      .sort((a, b) => a.reading.localeCompare(b.reading, 'ja'));
    const pick = candidates[0];
    if (!pick) {
      save(undefined);
      recordOutcome('user', used.length);
      return `「${lastKanaDisplay(reading)}」から始まる言葉が、思いつかないです……。参りました、私の負けです！`;
    }
    const nextNeed = lastKana(pick.reading);
    const nextDisplay = lastKanaDisplay(pick.reading);
    save({ active: true, requiredKana: nextNeed, requiredDisplay: nextDisplay, used: [...used, pick.surface], updatedAt: Date.now() });
    return `じゃあ私は「${pick.surface}」。次は「${nextDisplay}」からですよ。`;
  }
}

export const shiritoriService = new ShiritoriService();
