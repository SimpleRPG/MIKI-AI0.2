import { storageService } from '../../../services/storageService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';

/**
 * P670: クイズの継続。出題の材料は彼女自身の世界モデル（IS_A＝
 * 何の仲間か、USED_FOR＝何に使うか）で、知識が育つほど問題が
 * 増える。答え合わせまで通して行い、材料が尽きたら成績を
 * 伝えて終わる。
 */

const KEY = 'miki_quiz_v1';
const TIMEOUT_MS = 30 * 60_000;

interface QuizQuestion {
  from: string;
  kind: 'IS_A' | 'USED_FOR';
  answer: string;
}

interface QuizState {
  active: boolean;
  queue: QuizQuestion[];
  current?: QuizQuestion;
  asked: number;
  correct: number;
  updatedAt: number;
}

function buildQuestions(): QuizQuestion[] {
  try {
    const rels = worldModelGraphService.relations()
      .filter((r) => (r.type === 'IS_A' || r.type === 'USED_FOR') && r.from && r.to)
      .sort((a, b) => `${a.from}${a.type}`.localeCompare(`${b.from}${b.type}`, 'ja'));
    const confirmed = rels.filter((r) => !r.provisional);
    const pool = confirmed.length > 0 ? confirmed : rels;
    return pool.map((r) => ({ from: r.from, kind: r.type as 'IS_A' | 'USED_FOR', answer: r.to }));
  } catch { return []; }
}

function questionText(q: QuizQuestion): string {
  return q.kind === 'IS_A'
    ? `「${q.from}」は何の仲間でしょう？`
    : `「${q.from}」は何に使われるでしょう？`;
}

function load(): QuizState | undefined {
  try {
    const raw = storageService.getItem(KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as QuizState;
    if (!s.active || !s.current || Date.now() - (s.updatedAt || 0) > TIMEOUT_MS) return undefined;
    return s;
  } catch { return undefined; }
}

function save(s: QuizState | undefined): void {
  try {
    storageService.setItem(KEY, JSON.stringify(s ?? { active: false, queue: [], asked: 0, correct: 0, updatedAt: 0 }));
  } catch { /* 遊びの状態は補助 */ }
}

class QuizService {
  isActive(): boolean {
    return !!load();
  }

  start(): string {
    const queue = buildQuestions();
    if (queue.length === 0) {
      return 'クイズの材料がまだ無いんです。ものの関係を覚えたら、出せるようになります。';
    }
    const [current, ...rest] = queue;
    save({ active: true, queue: rest, current, asked: 1, correct: 0, updatedAt: Date.now() });
    return `いいですよ、クイズです！第1問。${questionText(current)}`;
  }

  respond(prompt: string): string | undefined {
    const state = load();
    if (!state || !state.current) return undefined;
    const text = String(prompt || '').trim();
    if (/(?:やめる|おわり|終わり|もういい|やめたい)/.test(text)) {
      save(undefined);
      return `分かりました、ここまでにしましょう。${state.asked - 1}問答えて、${state.correct}問正解でした。また遊びましょう！`;
    }
    if (text.length > 24 || /[？?]/.test(text)) return undefined;

    const answer = state.current.answer;
    const guess = text.replace(/[。！!]+$/g, '').replace(/(?:だよ|です|だ|ね|よ)$/g, '');
    const isCorrect = guess === answer || (answer.length >= 2 && guess.includes(answer));
    const verdict = isCorrect
      ? `正解です！「${state.current.from}」は${answer}です。`
      : `残念、正解は「${answer}」でした。`;
    const correct = state.correct + (isCorrect ? 1 : 0);

    const [next, ...rest] = state.queue;
    if (!next) {
      save(undefined);
      return `${verdict}\n問題はここまでです。${state.asked}問中${correct}問正解でした！`;
    }
    save({ active: true, queue: rest, current: next, asked: state.asked + 1, correct, updatedAt: Date.now() });
    return `${verdict}\n第${state.asked + 1}問。${questionText(next)}`;
  }
}

export const quizService = new QuizService();
