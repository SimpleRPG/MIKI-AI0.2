import { visualPoseService } from './visualPoseService';

/**
 * P1109: 言葉による部位編集。
 *
 * 「足をちょっと太くして」のような言葉の指示を、描く側の
 * 部位補正（drillCorrections と同じ保存先）への変更に変換する。
 * 部位の言葉→補正キー、方向の言葉→拡縮、量の言葉→倍率。
 * 解釈できない文には null を返し、会話の本流には触らない。
 * 補正は「彼女自身の手の癖の記憶」と同じ場所に積まれるので、
 * 編集は次に描く絵すべてに効く（元に戻すのも言葉でできる：
 * 逆方向の指示を出せばよい）。
 */

export type BodyEditKey = 'shoulder' | 'chest' | 'waist' | 'hip' | 'thigh' | 'calf' | 'ankle';

export interface BodyEditParse {
  keys: BodyEditKey[];
  label: string;
  factor: number;
  amountWord: string;
  widen: boolean;
}

export interface BodyEditResult {
  label: string;
  changes: { key: BodyEditKey; before: number; after: number }[];
  reply: string;
}

// 具体的な部位を先に置く（「足首」が「足」に食われないように）。
const PARTS: { re: RegExp; keys: BodyEditKey[]; label: string }[] = [
  { re: /ふくらはぎ/, keys: ['calf'], label: 'ふくらはぎ' },
  { re: /足首/, keys: ['ankle'], label: '足首' },
  { re: /太もも|太腿|腿|もも/, keys: ['thigh'], label: '太もも' },
  { re: /足全体|脚全体/, keys: ['thigh', 'calf', 'ankle'], label: '脚全体' },
  { re: /脚|足/, keys: ['thigh'], label: '足' },
  { re: /肩/, keys: ['shoulder'], label: '肩' },
  { re: /胸|バスト/, keys: ['chest'], label: '胸' },
  { re: /ウエスト|腰|お腹/, keys: ['waist'], label: 'ウエスト' },
  { re: /お尻|おしり|尻|ヒップ/, keys: ['hip'], label: 'お尻' },
];

const AMOUNTS: { re: RegExp; mag: number; word: string }[] = [
  { re: /とても|すごく|大幅に|ぐっと|思い切り/, mag: 1.32, word: 'ぐっと' },
  { re: /かなり|もっと|だいぶ/, mag: 1.18, word: 'かなり' },
  { re: /ちょっと|少し|ほんの/, mag: 1.08, word: 'ちょっと' },
];

class BodyEditByWordsService {
  public parseEdit(text: string): BodyEditParse | null {
    const p = String(text || '');
    const part = PARTS.find((e) => e.re.test(p));
    if (!part) return null;
    const widen = /太く|太めに|大きく|広く/.test(p);
    const narrow = /細く|細めに|小さく|狭く|ほっそり/.test(p);
    if (widen === narrow) return null;
    const amt = AMOUNTS.find((e) => e.re.test(p));
    const mag = amt ? amt.mag : 1.12;
    return {
      keys: part.keys,
      label: part.label,
      factor: widen ? mag : 1 / mag,
      amountWord: amt ? amt.word : '',
      widen,
    };
  }

  public applyEdit(text: string): BodyEditResult | null {
    const parsed = this.parseEdit(text);
    if (!parsed) return null;
    const cur = visualPoseService.getDrawingCorrections();
    const next = { ...cur };
    const changes: BodyEditResult['changes'] = [];
    for (const k of parsed.keys) {
      const before = cur[k];
      const after = Math.max(0.5, Math.min(2.5, Math.round(before * parsed.factor * 1000) / 1000));
      next[k] = after;
      changes.push({ key: k, before, after });
    }
    visualPoseService.setDrawingCorrections(next);
    const dirWord = parsed.widen ? '太く' : '細く';
    const reply = parsed.amountWord
      ? `${parsed.label}を${parsed.amountWord}${dirWord}したよ。`
      : `${parsed.label}を${dirWord}したよ。`;
    return { label: parsed.label, changes, reply };
  }
}

export const bodyEditByWordsService = new BodyEditByWordsService();
