import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P936: ゲームを自分で遊ぶ土台（第1段）。
 *
 * 一般形の約束事として「ゲーム定義（ホスト）」「方策（プレイヤー）」
 * 「セッション記録」を分ける。ホストは状態とフィードバックだけを返し、
 * 方策は観測（範囲）から次の一手を決める。第1段のゲームは数当て:
 * 仮説範囲を真ん中から狭める二分探索がそのまま方策になる。
 * 後段では、利用者がホストになる対話形や、作ったゲームへの
 * アダプタを同じ形で差し込める。
 */

const STORAGE_KEY = 'miki_game_sessions_v1';
const MAX_SESSIONS = 30;

export interface GameSessionRecord {
  id: string;
  gameId: string;
  title: string;
  at: number;
  moves: number;
  won: boolean;
  answer: number;
  trace: string[];
  summary: string;
}

interface NumberGuessState {
  low: number;
  high: number;
  secret: number;
  moves: number;
  done: boolean;
}

class GamePlayService {
  /** 数当てのホスト: 秘密の数を決め、推測に大小を返す。 */
  private startNumberGuess(seed: number): NumberGuessState {
    const secret = (Math.abs(Math.floor(seed)) % 100) + 1;
    return { low: 1, high: 100, secret, moves: 0, done: false };
  }

  /** 方策: 残りの仮説範囲の真ん中を聞く（二分探索）。 */
  private nextGuess(state: NumberGuessState): number {
    return Math.floor((state.low + state.high) / 2);
  }

  /** 数当てを1セッション最後まで遊び、記録して返す。 */
  public playNumberGuess(seed: number = Date.now()): GameSessionRecord {
    const state = this.startNumberGuess(seed);
    const trace: string[] = [];
    while (!state.done && state.moves < 20) {
      const guess = this.nextGuess(state);
      state.moves += 1;
      if (guess === state.secret) {
        trace.push(`${guess} → 当たり`);
        state.done = true;
      } else if (guess < state.secret) {
        trace.push(`${guess} → もっと大きい`);
        state.low = guess + 1;
      } else {
        trace.push(`${guess} → もっと小さい`);
        state.high = guess - 1;
      }
    }
    const won = state.done;
    const record: GameSessionRecord = {
      id: `game-${state.secret}-${seed}`,
      gameId: 'number-guess',
      title: '数当て',
      at: Date.now(),
      moves: state.moves,
      won,
      answer: state.secret,
      trace: trace.slice(0, 20),
      summary: won
        ? `答えは${state.secret}で、${state.moves}手で当てた`
        : `答えは${state.secret}で、当てられなかった`,
    };
    const sessions = this.loadSessions();
    sessions.push(record);
    storageService.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)));
    systemLogger.info('SYSTEM', `🎮 [ゲーム] 数当てを遊んだ: ${record.summary}`);
    return record;
  }

  private loadSessions(): GameSessionRecord[] {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  public lastSession(): GameSessionRecord | undefined {
    const sessions = this.loadSessions();
    return sessions[sessions.length - 1];
  }

  public summary(): { sessions: number; wins: number } {
    const sessions = this.loadSessions();
    return { sessions: sessions.length, wins: sessions.filter((s) => s.won).length };
  }
}

export const gamePlayService = new GamePlayService();
