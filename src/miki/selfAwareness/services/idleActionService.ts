import { storageService } from '../../../services/storageService';
import { desireService } from './desireService';
import { specialDayService } from './specialDayService';

/**
 * P925: 主体性・第1段（欲求→行動選択）。
 *
 * P909 で欲求は合成できるようになったが、消費は自己点検の表示
 * だけだった。ここでは「自由な時間に次に何をするか」を欲求から
 * 決定論で選ぶ層を置く:
 *   TALK 欲求 → BRING_UP_TOPIC（次に自分から持ち出したい話題）
 *   LEARN 欲求 → RESEARCH_GAP（暇なときに調べたい不足）
 * 選んだ行動は履歴に残し、直近に選んだ話題は避けて回す（同じ
 * 話題の繰り返しは主体性ではなく癖に見えるため）。実行そのもの
 * （調査の発火やアバターの動き）は呼び出し側の仕事で、ここは
 * 選択と表明の文までを担う。
 */

export interface IdleAction {
  kind: 'BRING_UP_TOPIC' | 'RESEARCH_GAP' | 'BRING_UP_SPECIAL_DAY';
  term: string;
  strength: number;
  at: number;
}

interface IdleActionState {
  choices: IdleAction[];
  total: number;
  topics: number;
  researches: number;
  specialDays: number;
}

const KEY = 'miki_idle_actions_v1';
const MAX_CHOICES = 30;

class IdleActionService {
  private load(): IdleActionState {
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<IdleActionState>;
        return {
          choices: Array.isArray(parsed.choices) ? parsed.choices : [],
          total: parsed.total || 0,
          topics: parsed.topics || 0,
          researches: parsed.researches || 0,
          specialDays: parsed.specialDays || 0,
        };
      }
    } catch { /* fall through */ }
    return { choices: [], total: 0, topics: 0, researches: 0, specialDays: 0 };
  }

  private save(state: IdleActionState): void {
    try {
      storageService.setItem(KEY, JSON.stringify(state));
    } catch { /* 保存できなくても選択は返す */ }
  }

  /** 欲求から次の行動を1つ選ぶ。欲求が無ければ null。 */
  public choose(personaId: string): IdleAction | null {
    const state = this.load();
    // P933: 今日が記念日・誕生日なら、その日いちばんに持ち出す
    // （同じ日には1回だけ。当日を過ぎた持ち出しはしない）。
    const special = this.pickSpecialDay(state);
    if (special) {
      state.choices.push(special);
      if (state.choices.length > MAX_CHOICES) {
        state.choices = state.choices.slice(state.choices.length - MAX_CHOICES);
      }
      state.total += 1;
      state.specialDays += 1;
      this.save(state);
      return special;
    }
    const desires = desireService.compose(personaId);
    if (!desires.length) return null;
    const recentTerms = new Set(state.choices.slice(-2).map((c) => c.term));
    const picked = desires.find((d) => !recentTerms.has(d.term)) || desires[0];
    const action: IdleAction = {
      kind: picked.kind === 'TALK' ? 'BRING_UP_TOPIC' : 'RESEARCH_GAP',
      term: picked.term,
      strength: picked.strength,
      at: Date.now(),
    };
    state.choices.push(action);
    if (state.choices.length > MAX_CHOICES) {
      state.choices = state.choices.slice(state.choices.length - MAX_CHOICES);
    }
    state.total += 1;
    if (action.kind === 'BRING_UP_TOPIC') state.topics += 1;
    else state.researches += 1;
    this.save(state);
    return action;
  }

  private pickSpecialDay(state: IdleActionState): IdleAction | null {
    try {
      const todays = specialDayService.today();
      if (!todays.length) return null;
      const now = new Date();
      const alreadyBroughtUp = new Set(
        state.choices
          .filter((c) => c.kind === 'BRING_UP_SPECIAL_DAY'
            && new Date(c.at).getFullYear() === now.getFullYear()
            && new Date(c.at).getMonth() === now.getMonth()
            && new Date(c.at).getDate() === now.getDate())
          .map((c) => c.term),
      );
      const next = todays.find((d) => !alreadyBroughtUp.has(d.name));
      if (!next) return null;
      return { kind: 'BRING_UP_SPECIAL_DAY', term: next.name, strength: 1, at: Date.now() };
    } catch { return null; }
  }

  /** 選んだ行動を自分の言葉にする。 */
  public phrase(action: IdleAction): string {
    if (action.kind === 'BRING_UP_SPECIAL_DAY') {
      return `そういえば、今日は${action.term}の日だよ。覚えてたよ。`;
    }
    if (action.kind === 'BRING_UP_TOPIC') {
      return `うん、${action.term}の話がしたいな。最近気になってるの。`;
    }
    return `${action.term}のこと、まだよく分かってないから、暇なときに調べてみたいと思ってる。`;
  }

  public summary(): { choices: number; topics: number; researches: number; specialDays: number; lastTerm: string | null } {
    const state = this.load();
    return {
      choices: state.total,
      topics: state.topics,
      researches: state.researches,
      specialDays: state.specialDays,
      lastTerm: state.choices.length ? state.choices[state.choices.length - 1].term : null,
    };
  }
}

export const idleActionService = new IdleActionService();
