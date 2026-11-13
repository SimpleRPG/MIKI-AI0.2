import { utteranceFeatureService } from './utteranceFeatureService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';

/**
 * P840: 話題の舞台（グローバルワークスペース）の共有サービス。
 * 認知アーキテクチャ機能対応表 #5 の第1歩。これまで core 私有だった
 * 「直近の話題の候補」の生成（旧 recentTopicCandidates、P719）を
 * 共有層へ移したもの。ロジックは移設時点で従来と同一。
 * P841: resolveAnaphora の候補プールもこの舞台から取るようになり、
 * 発話の素の文字列から話題を作る topicFromText もここに一本化した
 * （旧 core / nonLlmCore の同名コピー2件を統合）。
 */
class TopicStageService {
  /** 直近の話題の候補（新しい順）。辞書・関係で裏付けられる語だけ。 */
  candidates(state?: any, recentMessages: Array<any> = []): string[] {
    const valid = (t: unknown): t is string => {
      if (typeof t !== 'string' || t.length < 2 || t.length > 12) return false;
      if (/[、。！？!?\s]/.test(t)) return false;
      try {
        return japaneseDictionaryService.has(t) || worldModelGraphService.relationsOf(t).length > 0;
      } catch { return false; }
    };
    const pool: string[] = [];
    for (const m of [...recentMessages].reverse()) {
      if ((m as any).role !== 'user') continue;
      const text = String((m as any).content || (m as any).text || '');
      if (!text) continue;
      try {
        for (const t of utteranceFeatureService.analyze(text).contentTokens) {
          if (valid(t) && !pool.includes(t)) pool.push(t);
        }
      } catch { /* 補助経路 */ }
      if (pool.length >= 6) break;
    }
    const entities: string[] = Array.isArray(state?.recentEntities) ? state.recentEntities : [];
    for (const t of [...entities].reverse()) {
      if (valid(t) && !pool.includes(t)) pool.push(t);
    }
    if (valid(state?.currentTopic) && !pool.includes(state.currentTopic)) pool.unshift(state.currentTopic);
    // P845: 活性化（activationService）はこのプールには混ぜない。
    // プールは「直近に言及された順」という契約で、照応・省略の
    // 消費側が強く依存している。熱い語を末尾に足す案は回帰で
    // 実際に誤解決を起こした（P710/P720/P841）。活性化の消費先は
    // 直近性が意味を持たない選択の場面に限って別途入れる。
    return pool;
  }

  /** 今の話題（候補の先頭）。 */
  current(state?: any, recentMessages: Array<any> = []): string | undefined {
    return this.candidates(state, recentMessages)[0];
  }

  /** P841: 発話の素の文字列から話題ラベルを作る（旧 extractTopic の
   * 2コピーを一本化。呼びかけの前置きを落として先頭80文字）。 */
  topicFromText(prompt: string): string {
    return String(prompt || '').replace(/^(ねえ|ちょっと|みき[、,]?)\s*/i, '').slice(0, 80);
  }
}

export const topicStageService = new TopicStageService();
