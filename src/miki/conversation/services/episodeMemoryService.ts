import { storageService } from '../../../services/storageService';
import { conversationOpenTopicService } from './conversationOpenTopicService';
import { userStateTrailService } from './userStateTrailService';
import { dayKeyOf, yesterdayKey, daysAgoKey } from '../../memory/services/dayKeyService';

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
    return this.ensureEpisode(yesterdayKey());
  }

  /** P645: N日前のエピソードを（未構築なら今構築して）返す。 */
  public episodeDaysAgo(daysAgo: number): Episode | undefined {
    if (daysAgo <= 0) return undefined;
    return this.ensureEpisode(daysAgoKey(daysAgo));
  }

  /** P646: N〜M日前のエピソードを日付順に返す（先週の振り返り用）。 */
  public episodesInRange(fromDaysAgo: number, toDaysAgo: number): Episode[] {
    const out: Episode[] = [];
    for (let i = toDaysAgo; i >= fromDaysAgo; i--) {
      const ep = this.ensureEpisode(daysAgoKey(i));
      if (ep) out.push(ep);
    }
    return out.sort((a, b) => a.day.localeCompare(b.day));
  }

  /**
   * P848: 内容（話題）でエピソードを引く（事例ベースの想起）。
   * 日付でしか引けなかったエピソードに、話題の一致で引く経路を
   * 足す。一致した話題が多い順、同数なら新しい順。今日の分は
   * 対象外（当日の振り返りは別の経路の領分）。
   */
  public episodesMatching(terms: string[]): Array<{ episode: Episode; hits: string[]; daysAgo: number }> {
    const wanted = (terms || []).filter((t) => t && t.length >= 2);
    if (wanted.length === 0) return [];
    const out: Array<{ episode: Episode; hits: string[]; daysAgo: number }> = [];
    for (const ep of this.loadEpisodes()) {
      const hits = wanted.filter((t) => (ep.topics || []).some((topic) => topic === t || topic.includes(t) || t.includes(topic)));
      if (hits.length === 0) continue;
      let daysAgo = 0;
      for (let n = 1; n <= 14; n++) { if (daysAgoKey(n) === ep.day) { daysAgo = n; break; } }
      if (daysAgo === 0) continue;
      out.push({ episode: ep, hits, daysAgo });
    }
    return out.sort((a, b) => b.hits.length - a.hits.length || a.daysAgo - b.daysAgo);
  }

  /** P627: 過去7日分のエピソードを（組めるものは組んで）日付順に返す。 */
  public recentEpisodes(days = 7): Episode[] {
    const out: Episode[] = [];
    const now = new Date();
    for (let i = days; i >= 1; i--) {
      const key = daysAgoKey(i);
      const ep = this.ensureEpisode(key);
      if (ep) out.push(ep);
    }
    return out.sort((a, b) => a.day.localeCompare(b.day));
  }

  private ensureEpisode(day: string): Episode | undefined {
    const existing = this.loadEpisodes().find((e) => e.day === day);
    if (existing) return existing;
    try {
      const built = JSON.parse(storageService.getItem(BUILT_KEY) || '[]') as string[];
      if (Array.isArray(built) && built.includes(day)) return undefined;
    } catch { /* 読めなければ構築を試す */ }
    const episode = this.buildFor(day);
    try {
      const built = JSON.parse(storageService.getItem(BUILT_KEY) || '[]') as string[];
      const next = Array.isArray(built) ? [...built, day] : [day];
      storageService.setItem(BUILT_KEY, JSON.stringify(next.slice(-14)));
    } catch { /* 補助経路 */ }
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
      const lastAtBySignal = new Map<string, number>();
      for (const e of trail) {
        if (dayKeyOf(Number(e.at || 0)) !== day) continue;
        counts.set(e.signal, (counts.get(e.signal) || 0) + 1);
        lastAtBySignal.set(e.signal, Math.max(lastAtBySignal.get(e.signal) || 0, Number(e.at || 0)));
      }
      // P635: その日のうちに解消した兆候は、その日の色にしない
      // （夕方に持ち直した日を「お疲れ気味の一日」とまとめない）。
      for (const [signal, lastAt] of lastAtBySignal.entries()) {
        try {
          const resolved = userStateTrailService.resolvedAt(signal as never);
          if (resolved && dayKeyOf(resolved) === day && resolved >= lastAt) counts.delete(signal);
        } catch { /* 解消が読めなければ従来どおり */ }
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
