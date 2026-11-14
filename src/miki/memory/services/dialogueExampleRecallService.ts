// P878: 会話例の想起（取り込み口の検索側）。
// 教師教材で登録された会話例（componentType='DIALOGUE_EXAMPLE'、
// 候補・未検証）のうち、話題・場面に合うものを引く。レッスンと
// 同じく保管庫を直接読む（候補は retrieve() の対象外のため）。
import { storageService } from '../../../services/storageService';

const REPO_KEY = 'miki_reusable_component_repository_v1';

export interface DialogueExampleView {
  id: string;
  title: string;
  scene: string;
  turns: Array<{ speaker: string; text: string }>;
  pattern: { herLineCount: number; acts: string[]; opening: string; closing: string };
  subject: string;
  // P879: 使用記録を付けるための部品ID。
  componentId: string;
}

function readExamples(): DialogueExampleView[] {
  try {
    const raw = storageService.getItem(REPO_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    const out: DialogueExampleView[] = [];
    for (const item of items) {
      if (!item || item.componentType !== 'DIALOGUE_EXAMPLE') continue;
      const ex = (item as any).example;
      const pat = (item as any).pattern;
      if (!ex || typeof ex.title !== 'string' || typeof ex.scene !== 'string' || !Array.isArray(ex.turns)) continue;
      out.push({
        id: typeof ex.id === 'string' ? ex.id : '',
        title: ex.title,
        scene: ex.scene,
        turns: ex.turns,
        pattern: {
          herLineCount: Number(pat?.herLineCount ?? 0),
          acts: Array.isArray(pat?.acts) ? pat.acts.map(String) : [],
          opening: typeof pat?.opening === 'string' ? pat.opening : '',
          closing: typeof pat?.closing === 'string' ? pat.closing : '',
        },
        subject: typeof (item as any).packageSubject === 'string' ? (item as any).packageSubject : '',
        componentId: typeof (item as any).componentId === 'string' ? (item as any).componentId : '',
      });
    }
    return out;
  } catch {
    return [];
  }
}

function keysOf(example: DialogueExampleView): string[] {
  const chunks = `${example.scene} ${example.title}`
    .split(/[（）()「」、・／/\s：:はがをにのもへとやの]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  return [...new Set(chunks)];
}

// 状況の言葉から場面の主題語への橋渡し（レッスンの引き方 P873 と
// 同じ考え方）。「拗ねちゃった」→「拗ねた・声かけ」のように、
// 言い方のずれを吸収する。
const CUES: Array<[RegExp, string]> = [
  [/拗ね|すね|不機嫌/, '拗ねた 声かけ 仲直り'],
  [/疲れ|へとへと|ぐったり/, '労い おつかれ 疲れている'],
  [/ケンカ|喧嘩|言い合い/, '拗ねた 声かけ 謝る 仲直り すれ違い'],
  [/記念日|誕生日/, '記念日 祝う'],
  [/落ち込|元気がない|つらそう|辛そう/, '受け止める 聞く'],
  [/帰りが遅|遅く帰/, '労い おかえり'],
];

function expandText(text: string): string {
  let out = text;
  for (const [pattern, extra] of CUES) {
    if (pattern.test(text)) out += ` ${extra}`;
  }
  return out;
}

export const dialogueExampleRecallService = {
  listExamples(): DialogueExampleView[] {
    return readExamples();
  },

  // 話題文に最も合う会話例を1件返す。場面・タイトルのキーが話題に
  // 含まれる数を数え、一致が無ければ undefined。
  findFor(text: string): DialogueExampleView | undefined {
    const examples = readExamples();
    if (examples.length === 0) return undefined;
    const expanded = expandText(text);
    let best: DialogueExampleView | undefined;
    let bestScore = 0;
    for (const example of examples) {
      let score = 0;
      for (const key of keysOf(example)) {
        if (expanded.includes(key)) score += key.length;
      }
      if (score > bestScore) {
        bestScore = score;
        best = example;
      }
    }
    return bestScore >= 3 ? best : undefined;
  },

  // P881: 候補を順位つきで全部返す（引用の回転用）。
  findRanked(text: string): DialogueExampleView[] {
    const examples = readExamples();
    if (examples.length === 0) return [];
    const expanded = expandText(text);
    const scored: Array<{ example: DialogueExampleView; score: number }> = [];
    for (const example of examples) {
      let score = 0;
      for (const key of keysOf(example)) {
        if (expanded.includes(key)) score += key.length;
      }
      if (score >= 3) scored.push({ example, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.example);
  },
};
