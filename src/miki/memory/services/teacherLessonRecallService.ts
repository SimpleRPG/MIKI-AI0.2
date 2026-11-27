// P872: 教師レッスンの想起（原則を使う受け口の検索側）。
// 教師教材で登録された知識部品（componentType='TEACHER_LESSON'、候補・
// 未検証）のうち、話題に合うものを引く。部品は reusableComponentFactory
// の retrieve() では候補ステータスのため対象外になるので、保管庫を直接
// 読む。引く側は「候補の知識であること」を出し方で明示する前提。
// 2026-11-08 の設計原則どおり、共有で持つべき検索は共有層に置く。
import { componentRepositoryCacheService } from './componentRepositoryCacheService';

export interface TeacherLessonView {
  id: string;
  title: string;
  rule: string;
  subject: string;
  // P879: 使用記録を付けるための部品ID。
  componentId: string;
}

// P895: 用語→レッスン位置の逆引き索引。台帳（P893 のパース済み配列）の
// 参照が同じ間は索引とビューを使い回し、想起は「広げた話題文にキーが
// 現れる候補」だけをスコアリングする。スコア計算は従来どおりなので、
// 引き結果は全件走査と一致する（閾値を超えるには最低1キーの一致が
// 必要なため、索引で落とす候補は必ず不合格側）。
interface LessonStore {
  itemsRef: unknown;
  views: TeacherLessonView[];
  byKey: Map<string, number[]>;
}
let lessonStore: LessonStore | null = null;

function currentLessonStore(): LessonStore {
  const items = componentRepositoryCacheService.readAll();
  if (lessonStore && lessonStore.itemsRef === items) return lessonStore;
  const views: TeacherLessonView[] = [];
  const byKey = new Map<string, number[]>();
  try {
    for (const item of items) {
      if (!item || item.componentType !== 'TEACHER_LESSON') continue;
      const lesson = (item as any).lesson;
      if (!lesson || typeof lesson.title !== 'string' || typeof lesson.rule !== 'string') continue;
      const pos = views.length;
      views.push({
        id: typeof lesson.id === 'string' ? lesson.id : '',
        title: lesson.title,
        rule: lesson.rule,
        subject: typeof (item as any).packageSubject === 'string' ? (item as any).packageSubject : '',
        componentId: typeof (item as any).componentId === 'string' ? (item as any).componentId : '',
      });
      for (const key of titleKeys(lesson.title)) {
        const arr = byKey.get(key);
        if (arr) arr.push(pos); else byKey.set(key, [pos]);
      }
    }
  } catch {
    lessonStore = { itemsRef: items, views: [], byKey: new Map() };
    return lessonStore;
  }
  lessonStore = { itemsRef: items, views, byKey };
  return lessonStore;
}

function readLessons(): TeacherLessonView[] {
  return currentLessonStore().views;
}

function candidatePositions(store: LessonStore, expanded: string): number[] {
  const set = new Set<number>();
  for (const [key, positions] of store.byKey) {
    if (!expanded.includes(key)) continue;
    for (const p of positions) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

// タイトルにほぼ必ず出る一般語はキーにしない（「ゲーム」が一致した
// だけで無関係なレッスンが勝ってしまうため、P873で実測して追加）。
const STOP_KEYS = new Set(['ゲーム', 'こと', 'もの', 'とき', 'ため']);

// 状況の言葉から、章の主題語へ橋渡しする対応表。タイトルに直接
// 現れない言い方（「手応えがない」→ヒットストップ、「得られない」
// →ご褒美）でも引けるようにする。型は教師側で供給する前提。
const CUES: Array<[RegExp, string]> = [
  [/手応え|もっさり|打撃感/, 'ヒットストップ 攻撃 モーション'],
  [/得られない|得るものがない|報酬がない|つまらなく|つまらない/, 'ご褒美 報酬'],
  [/見づらい|見にくい|ごちゃごちゃ|分かりにくい|わかりにくい/, 'UI HUD 分かりやすさ 画面'],
  [/BGM|音楽|曲/, 'BGM サウンド テンポ'],
  [/音|効果音/, 'サウンド 効果音 ヒット'],
  [/難しすぎ|簡単すぎ|詰/, '難易度 救済'],
  [/遅い|重い|テンポが悪/, 'テンポ リトライ 速度'],
  [/飽き|単調/, 'ご褒美 テンポ ランダム'],
];

function expandText(text: string): string {
  let out = text;
  for (const [pattern, extra] of CUES) {
    if (pattern.test(text)) out += ` ${extra}`;
  }
  return out;
}
// P3012: グラフ層（knowledgeGraphService）が同じキー抽出で判別力を
// 数えるため公開する。抽出規則の正本はここ。
export function titleKeys(title: string): string[] {
  const chunks = title
    .split(/[（）()「」、・／/\s：:はがをにのもへとや]/)
    .map((s) => s.trim().replace(/(?:する|した|して|なる|ある|いる|です|ます)$/u, ''))
    .filter((s) => s.length >= 2 && !STOP_KEYS.has(s));
  return [...new Set(chunks)];
}

// レッスンID（TM9-16 など）を (巻, 番号) にする。同点の最後の決め手に
// 「教材の並びが前の＝基礎寄りの原則」を優先するためのもの。
function idOrder(id: string): [number, number] {
  const m = id.match(/(\d+)\D+(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [999, 999];
}

export const teacherLessonRecallService = {
  listLessons(): TeacherLessonView[] {
    return readLessons();
  },

  // 話題文に最も合うレッスンを1件返す。合うものが無ければ undefined。
  // 得点の作り（P873で実教材112件に対して実測して調整）：
  // - 本人の言葉に直接出たキーの一致は2倍、状況語の橋渡し（CUES）だけ
  //   で一致したキーは1倍。
  // - タイトルの先頭キー（その原則の主題）が一致したら +2。
  // - 同点は、一致キーの数が多い方→教材の並びが前（基礎寄り）な方。
  findFor(text: string): TeacherLessonView | undefined {
    const store = currentLessonStore();
    if (store.views.length === 0) return undefined;
    const expanded = expandText(text);
    let best: TeacherLessonView | undefined;
    let bestScore = 0;
    let bestCount = 0;
    let bestOrder: [number, number] = [999, 999];
    for (const pos of candidatePositions(store, expanded)) {
      const lesson = store.views[pos];
      const keys = titleKeys(lesson.title);
      let score = 0;
      let count = 0;
      keys.forEach((key, idx) => {
        if (!expanded.includes(key)) return;
        count += 1;
        score += key.length * (text.includes(key) ? 2 : 1);
        if (idx === 0) score += 2;
      });
      const order = idOrder(lesson.id);
      const wins =
        score > bestScore ||
        (score === bestScore && count > bestCount) ||
        (score === bestScore && count === bestCount &&
          (order[0] < bestOrder[0] || (order[0] === bestOrder[0] && order[1] < bestOrder[1])));
      if (wins) {
        bestScore = score;
        bestCount = count;
        bestOrder = order;
        best = lesson;
      }
    }
    return bestScore >= 4 || bestCount >= 2 ? best : undefined;
  },

  // P881: 候補を順位つきで全部返す。直前に出した原則と別のものを
  // 出したい（引用の回転）ときに使う。並びは findFor と同じ基準。
  findRanked(text: string): TeacherLessonView[] {
    const store = currentLessonStore();
    if (store.views.length === 0) return [];
    const expanded = expandText(text);
    const scored: Array<{ lesson: TeacherLessonView; score: number; count: number; order: [number, number] }> = [];
    for (const pos of candidatePositions(store, expanded)) {
      const lesson = store.views[pos];
      const keys = titleKeys(lesson.title);
      let score = 0;
      let count = 0;
      keys.forEach((key, idx) => {
        if (!expanded.includes(key)) return;
        count += 1;
        score += key.length * (text.includes(key) ? 2 : 1);
        if (idx === 0) score += 2;
      });
      if (score >= 4 || count >= 2) scored.push({ lesson, score, count, order: idOrder(lesson.id) });
    }
    scored.sort((a, b) =>
      b.score - a.score ||
      b.count - a.count ||
      a.order[0] - b.order[0] ||
      a.order[1] - b.order[1]);
    return scored.map((s) => s.lesson);
  },

  // P895: 索引が選ぶ候補数（診断・検証用）。
  indexCandidates(text: string): number {
    return candidatePositions(currentLessonStore(), expandText(text)).length;
  },
};
