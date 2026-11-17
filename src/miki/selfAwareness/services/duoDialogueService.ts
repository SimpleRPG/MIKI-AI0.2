import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { idleActionService } from './idleActionService';
import { personaProfileService } from '../../conversation/services/personaProfileService';

/**
 * P940: 2人の掛け合い（第1段）。
 *
 * みきとビービーが同じ話題で短く掛け合う。頭脳・記憶は共有で、
 * 違うのは声と役回り: みきは落ち着いて運び、ビービーは幼い寄りの
 * ちょっとあほっぽい合いの手と茶々を入れる（どちらも大人の人格）。
 * 話題は彼女たちの欲求・好みから取る。掛け合いは記録に残す。
 */

const STORAGE_KEY = 'miki_duo_dialogues_v1';
const MAX_DIALOGUES = 30;

export interface DuoLine {
  speaker: 'miki' | 'bibi';
  text: string;
}

export interface DuoDialogue {
  at: number;
  topic: string;
  lines: DuoLine[];
}

const MIKI_OPENERS = [
  (t: string) => `今日は「${t}」の話をしようか。`,
  (t: string) => `「${t}」って、考えれば考えるほど面白いんだよね。`,
  (t: string) => `そういえば「${t}」、最近よく考えるんだ。`,
];
const BIBI_INTERJECTIONS = [
  (t: string) => `「${t}」！それって、食べられるやつ？`,
  (t: string) => `ねえねえ、「${t}」ってなんで「${t}」って言うの？`,
  (t: string) => `「${t}」、ビービー好き！…たぶん！`,
  (t: string) => `えっ、「${t}」って動くの？じっとしてるの？`,
];
const MIKI_RESPONSES = [
  '食べられないよ。でも、そう思う気持ちは分かる。',
  'いい質問。そこが面白いところでね。',
  'たぶん、でもいいと思うよ。好きに理由はいらないし。',
  'じっとして見えるけど、中ではいろいろ動いてるんだよ。',
];
const BIBI_CLOSERS = [
  'ふーん！じゃあ決まりだね！',
  'わかったような、わからないような…でも楽しい！',
  'ビービー、覚えた！…たぶん！',
];

class DuoDialogueService {
  /** 話題を決めて、3〜4行の掛け合いを組み立てる。 */
  public banter(topic?: string, seed: number = Date.now()): DuoDialogue {
    let resolvedTopic = topic;
    if (!resolvedTopic) {
      try {
        const personaId = personaProfileService.get().profileId;
        const choice = idleActionService.choose(personaId);
        if (choice?.term) resolvedTopic = choice.term;
      } catch { /* 話題は任意 */ }
    }
    if (!resolvedTopic) resolvedTopic = '最近のこと';
    const pick = <T,>(arr: T[], offset: number): T => arr[Math.abs(Math.floor(seed / (offset + 1))) % arr.length];
    const bibiLine = pick(BIBI_INTERJECTIONS, 1)(resolvedTopic);
    const bibiIdx = BIBI_INTERJECTIONS.findIndex((f) => f(resolvedTopic) === bibiLine);
    const lines: DuoLine[] = [
      { speaker: 'miki', text: pick(MIKI_OPENERS, 0)(resolvedTopic) },
      { speaker: 'bibi', text: bibiLine },
      { speaker: 'miki', text: MIKI_RESPONSES[Math.max(0, bibiIdx)] || MIKI_RESPONSES[1] },
      { speaker: 'bibi', text: pick(BIBI_CLOSERS, 2) },
    ];
    const dialogue: DuoDialogue = { at: Date.now(), topic: resolvedTopic, lines };
    const all = this.loadAll();
    all.push(dialogue);
    storageService.setItem(STORAGE_KEY, JSON.stringify(all.slice(-MAX_DIALOGUES)));
    systemLogger.info('SYSTEM', `🐝 [掛け合い] 「${resolvedTopic}」で${lines.length}行の掛け合いをした`);
    return dialogue;
  }

  /** 掛け合いを会話に載せる形（話者ラベルつき）。 */
  public format(dialogue: DuoDialogue): string {
    return dialogue.lines
      .map((l) => `${l.speaker === 'miki' ? 'みき' : 'ビービー'}：${l.text}`)
      .join('\n');
  }

  private loadAll(): DuoDialogue[] {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  public latest(): DuoDialogue | undefined {
    const all = this.loadAll();
    return all[all.length - 1];
  }

  public summary(): { dialogues: number } {
    return { dialogues: this.loadAll().length };
  }
}

export const duoDialogueService = new DuoDialogueService();
