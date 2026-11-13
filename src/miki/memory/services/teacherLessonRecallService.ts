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
      });
    }
    return out;
  } catch {
    return [];
  }
}

// タイトルを検索キーに分解する。助詞や括弧で割り、2文字以上の塊を
// キーにする（「リトライは迅速に（再開の速さが効く）」→ リトライ／
// 迅速／再開／速さ／効く）。タイトル全文は発話にそのまま現れないので、
// 塊単位で照合しないと永遠に一致しない。
function titleKeys(title: string): string[] {
  const chunks = title
    .split(/[（）()「」、・／/\sはがをにのもへとや]/)
    .map((s) => s.trim().replace(/(?:する|した|して|なる|ある|いる|です|ます)$/u, ''))
    .filter((s) => s.length >= 2);
  return [...new Set(chunks)];
}

export const teacherLessonRecallService = {
  listLessons(): TeacherLessonView[] {
    return readLessons();
  },

  // 話題文に最も合うレッスンを1件返す。合うものが無ければ undefined。
  // 一致はタイトルのキーが話題に含まれるかで数え、合計の長さで効かせる
  // （短い語の偶然一致で引かないよう、閾値を設ける）。
  findFor(text: string): TeacherLessonView | undefined {
    const lessons = readLessons();
    if (lessons.length === 0) return undefined;
    let best: TeacherLessonView | undefined;
    let bestScore = 0;
    for (const lesson of lessons) {
      let score = 0;
      for (const key of titleKeys(lesson.title)) {
        if (key.length >= 2 && text.includes(key)) score += key.length;
      }
      if (score > bestScore) {
        bestScore = score;
        best = lesson;
      }
    }
    return bestScore >= 3 ? best : undefined;
  },
};
