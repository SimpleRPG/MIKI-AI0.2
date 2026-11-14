// P872: 教師レッスンの想起（原則を使う受け口の検索側）。
// 教師教材で登録された知識部品（componentType='TEACHER_LESSON'、候補・
// 未検証）のうち、話題に合うものを引く。部品は reusableComponentFactory
// の retrieve() では候補ステータスのため対象外になるので、保管庫を直接
// 読む。引く側は「候補の知識であること」を出し方で明示する前提。
// 2026-11-08 の設計原則どおり、共有で持つべき検索は共有層に置く。
import { storageService } from '../../../services/storageService';

const REPO_KEY = 'miki_reusable_component_repository_v1';

export interface TeacherLessonView {
  id: string;
  title: string;
  rule: string;
  subject: string;
  // P879: 使用記録を付けるための部品ID。
  componentId: string;
}

function readLessons(): TeacherLessonView[] {
  try {
    const raw = storageService.getItem(REPO_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    const out: TeacherLessonView[] = [];
    for (const item of items) {
      if (!item || item.componentType !== 'TEACHER_LESSON') continue;
      const lesson = (item as any).lesson;
      if (!lesson || typeof lesson.title !== 'string' || typeof lesson.rule !== 'string') continue;
      out.push({
        id: typeof lesson.id === 'string' ? lesson.id : '',
        title: lesson.title,
        rule: lesson.rule,
        subject: typeof (item as any).packageSubject === 'string' ? (item as any).packageSubject : '',
        componentId: typeof (item as any).componentId === 'string' ? (item as any).componentId : '',
      });
    }
    return out;
  } catch {
    return [];
  }
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
function titleKeys(title: string): string[] {
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
    const lessons = readLessons();
    if (lessons.length === 0) return undefined;
    const expanded = expandText(text);
    let best: TeacherLessonView | undefined;
    let bestScore = 0;
    let bestCount = 0;
    let bestOrder: [number, number] = [999, 999];
    for (const lesson of lessons) {
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
};
