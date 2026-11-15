// P878: 会話例の想起（取り込み口の検索側）。
// 教師教材で登録された会話例（componentType='DIALOGUE_EXAMPLE'、
// 候補・未検証）のうち、話題・場面に合うものを引く。レッスンと
// 同じく保管庫を直接読む（候補は retrieve() の対象外のため）。
import { componentRepositoryCacheService } from './componentRepositoryCacheService';

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

// P895: 用語→会話例位置の逆引き索引（レッスン側と同じ形）。台帳の
// 参照が同じ間は使い回し、想起はキーが現れる候補だけをスコアする。
interface ExampleStore {
  itemsRef: unknown;
  views: DialogueExampleView[];
  byKey: Map<string, number[]>;
}
let exampleStore: ExampleStore | null = null;

function currentExampleStore(): ExampleStore {
  const items = componentRepositoryCacheService.readAll();
  if (exampleStore && exampleStore.itemsRef === items) return exampleStore;
  const views: DialogueExampleView[] = [];
  const byKey = new Map<string, number[]>();
  try {
    for (const item of items) {
      if (!item || item.componentType !== 'DIALOGUE_EXAMPLE') continue;
      const ex = (item as any).example;
      const pat = (item as any).pattern;
      if (!ex || typeof ex.title !== 'string' || typeof ex.scene !== 'string' || !Array.isArray(ex.turns)) continue;
      const view: DialogueExampleView = {
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
      };
      const pos = views.length;
      views.push(view);
      for (const key of keysOf(view)) {
        const arr = byKey.get(key);
        if (arr) arr.push(pos); else byKey.set(key, [pos]);
      }
    }
  } catch {
    exampleStore = { itemsRef: items, views: [], byKey: new Map() };
    return exampleStore;
  }
  exampleStore = { itemsRef: items, views, byKey };
  return exampleStore;
}

function readExamples(): DialogueExampleView[] {
  return currentExampleStore().views;
}

function candidatePositions(store: ExampleStore, expanded: string): number[] {
  const set = new Set<number>();
  for (const [key, positions] of store.byKey) {
    if (!expanded.includes(key)) continue;
    for (const p of positions) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
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
    const store = currentExampleStore();
    if (store.views.length === 0) return undefined;
    const expanded = expandText(text);
    let best: DialogueExampleView | undefined;
    let bestScore = 0;
    for (const pos of candidatePositions(store, expanded)) {
      const example = store.views[pos];
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
    const store = currentExampleStore();
    if (store.views.length === 0) return [];
    const expanded = expandText(text);
    const scored: Array<{ example: DialogueExampleView; score: number }> = [];
    for (const pos of candidatePositions(store, expanded)) {
      const example = store.views[pos];
      let score = 0;
      for (const key of keysOf(example)) {
        if (expanded.includes(key)) score += key.length;
      }
      if (score >= 3) scored.push({ example, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.example);
  },

  // P895: 索引が選ぶ候補数（診断・検証用）。
  indexCandidates(text: string): number {
    return candidatePositions(currentExampleStore(), expandText(text)).length;
  },
};
