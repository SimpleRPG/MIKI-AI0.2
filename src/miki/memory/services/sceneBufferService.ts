import { storageService } from '../../../services/storageService';
import { dayKeyOf, todayKey } from './dayKeyService';
import { topicStageService } from './topicStageService';
import { conversationOpenTopicService } from '../../conversation/services/conversationOpenTopicService';
import { userStateTrailService } from '../../conversation/services/userStateTrailService';
import { roleplaySessionService } from '../../conversation/services/roleplaySessionService';

/**
 * P852（認知アーキテクチャ対応表 #11 Baddeley のエピソード・バッファ）:
 * 「今の場面」を1つの束として保つ共有サービス。
 *
 * 場面の要素（今日の話題・主な状態・なりチャの役と場面）は、これまで
 * エピソード構築・スナップショット・場面進行がそれぞれ別々に組み立てて
 * いた。ここに束の組み立てを寄せ、通常会話となりチャの両方が同じ
 * 「今の場面」を参照できるようにする。保存は持たず、既存の記録
 * （開いた話題・状態の trail・役セッション）から都度組み立てる。
 */

export interface SceneBundle {
  day: string;
  /** 今の話題（話題の舞台の先頭）。 */
  topic?: string;
  /** 今日開いている話題（重み順、最大3）。 */
  topics: string[];
  /** 今日ここまでの主な状態兆候（2回以上・その日のうちに未解消）。 */
  dominantState?: string;
  /** なりチャ中なら、その役と場面。 */
  roleplay?: { roleName: string; scene: string };
}

class SceneBufferService {
  /** その日に開いた話題（重み順、最大2）。エピソード構築と共有する。 */
  public topicsFor(day: string): string[] {
    try {
      return conversationOpenTopicService.listPending()
        .filter((r) => r.openedDay === day)
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .map((r) => r.topic)
        .filter(Boolean)
        .slice(0, 2);
    } catch { return []; }
  }

  /**
   * その日の主な状態兆候。trail を集計し、その日のうちに解消した
   * 兆候は除く（P635）。2回以上の兆候があるときだけ返す。
   */
  public dominantStateFor(day: string): string | undefined {
    try {
      const trail = JSON.parse(storageService.getItem('miki_user_state_trail_v1') || '[]') as Array<{ signal: string; at: number }>;
      const counts = new Map<string, number>();
      const lastAtBySignal = new Map<string, number>();
      for (const e of trail) {
        if (dayKeyOf(Number(e.at || 0)) !== day) continue;
        counts.set(e.signal, (counts.get(e.signal) || 0) + 1);
        lastAtBySignal.set(e.signal, Math.max(lastAtBySignal.get(e.signal) || 0, Number(e.at || 0)));
      }
      for (const [signal, lastAt] of lastAtBySignal.entries()) {
        try {
          const resolved = userStateTrailService.resolvedAt(signal as never);
          if (resolved && dayKeyOf(resolved) === day && resolved >= lastAt) counts.delete(signal);
        } catch { /* 解消が読めなければ従来どおり */ }
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return top && top[1] >= 2 ? top[0] : undefined;
    } catch { return undefined; }
  }

  /** 今の場面の束。 */
  public current(state?: any, recentMessages: Array<any> = []): SceneBundle {
    const day = todayKey();
    let topics: string[] = [];
    try {
      topics = conversationOpenTopicService.listPending()
        .slice()
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .map((r) => r.topic)
        .filter(Boolean)
        .slice(0, 3);
    } catch { topics = []; }
    let roleplay: SceneBundle['roleplay'];
    try {
      const session = roleplaySessionService.getSession();
      if (session && roleplaySessionService.isActive()) {
        roleplay = { roleName: session.roleName, scene: session.scene || '' };
      }
    } catch { roleplay = undefined; }
    return {
      day,
      topic: topicStageService.current(state, recentMessages),
      topics,
      dominantState: this.dominantStateFor(day),
      roleplay,
    };
  }
}

export const sceneBufferService = new SceneBufferService();
