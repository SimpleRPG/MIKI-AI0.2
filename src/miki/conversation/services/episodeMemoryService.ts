import { storageService } from '../../../services/storageService';
import { conversationOpenTopicService } from './conversationOpenTopicService';

/**
 * P623: 1日の会話を「エピソード」として残す。
 *
 * 前日の話題の拾い直し（P522）は話題の文字列だけだったので、
 * 「昨日はどんな一日だったか」の形にならなかった。ここでは
 * 日付が変わった最初の挨拶のときに、前日の開いた話題と状態の
 * 兆候から短いエピソードを組み立てて保存し、彼女の側の
 * 「昨日のこと」として返せるようにする。材料は既存の記録
 * （開いた話題・状態の流れ）だけで、新しい収集はしない。
 */

const EPISODES_KEY = 'miki_episodes_v1';
const BUILT_KEY = 'miki_episode_built_day_v1';

interface Episode {
  day: string;
  topics: string[];
  dominantState?: string;
  summary: string;
}

const STATE_LABELS: Record<string, string> = {
  fatigue: 'お疲れ気味',
  anxiety: '心配事が多め',
  pain: '痛みの訴えが多め',
  positive: '上向きな話が多め',
  hunger: 'お腹の空いた日',
  loneliness: '寂しさの話が多め',
  thirst: '喉の渇きの話が多め',
};

function dayKeyOf(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const now = new Date();
  return dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime());
}

class EpisodeMemoryService {
  private static instance: EpisodeMemoryService;
  public static getInstance(): EpisodeMemoryService {
    if (!EpisodeMemoryService.instance) {
      EpisodeMemoryService.instance = new EpisodeMemoryService();
    }
    return EpisodeMemoryService.instance;
  }

  private loadEpisodes(): Episode[] {
    try {
      const parsed = JSON.parse(storageService.getItem(EPISODES_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  /** 前日のエピソードを（未構築なら今構築して）返す。無ければ undefined。 */
  public yesterdayEpisode(): Episode | undefined {
    const yk = yesterdayKey();
    const existing = this.loadEpisodes().find((e) => e.day === yk);
    if (existing) return existing;
    try {
      if (storageService.getItem(BUILT_KEY) === yk) return undefined;
    } catch { /* 読めなければ構築を試す */ }
    const episode = this.buildFor(yk);
    try { storageService.setItem(BUILT_KEY, yk); } catch { /* 補助経路 */ }
    if (!episode) return undefined;
    const episodes = this.loadEpisodes();
    episodes.push(episode);
    try { storageService.setItem(EPISODES_KEY, JSON.stringify(episodes.slice(-14))); } catch { /* 補助経路 */ }
    return episode;
  }

  private buildFor(day: string): Episode | undefined {
    let topics: string[] = [];
    try {
      topics = conversationOpenTopicService.listPending()
        .filter((r) => r.openedDay === day)
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .map((r) => r.topic)
        .filter(Boolean)
        .slice(0, 2);
    } catch { topics = []; }
    let dominantState: string | undefined;
    try {
      const trail = JSON.parse(storageService.getItem('miki_user_state_trail_v1') || '[]') as Array<{ signal: string; at: number }>;
      const counts = new Map<string, number>();
      for (const e of trail) {
        if (dayKeyOf(Number(e.at || 0)) !== day) continue;
        counts.set(e.signal, (counts.get(e.signal) || 0) + 1);
      }
      // 状態は2回以上の兆候があるときだけ口にする（過剰に決めつけない）。
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 2 && STATE_LABELS[top[0]]) dominantState = top[0];
    } catch { /* 状態が無ければ話題だけ */ }
    if (topics.length === 0 && !dominantState) return undefined;
    const parts: string[] = [];
    if (topics.length > 0) parts.push(`「${topics.join('」や「')}」の話をしましたね`);
    if (dominantState) parts.push(`${STATE_LABELS[dominantState]}の一日でしたね`);
    const summary = `昨日は、${parts.join('。')}。`;
    return { day, topics, dominantState, summary };
  }
}

export const episodeMemoryService = EpisodeMemoryService.getInstance();
