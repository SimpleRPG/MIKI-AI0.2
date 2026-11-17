import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { episodeMemoryService } from './episodeMemoryService';

export interface DistilledTopic {
  topic: string;
  days: number;
  at: number;
}

const LEDGER_KEY = 'miki_distilled_topics_v1';
const MIN_DAYS = 3;

/**
 * P905（対応表#12 相補学習系の蒸留）: 日々のエピソード（高速な
 * 記録）から、繰り返し現れる話題をゆっくり意味知識へ蒸留する。
 *
 * 3 日以上にわたって現れた話題は「定着した話題」として、Claim
 * 候補（CANDIDATE）に登録し、蒸留台帳にも残す。昇格は既存の
 * 検証フローの領分で、ここで検証済みにはしない（自己証明禁止
 * と整合）。状態のような時間で腐る内容は蒸留しない。
 */
class EpisodeDistillationService {
  private loadLedger(): DistilledTopic[] {
    try {
      const parsed = JSON.parse(storageService.getItem(LEDGER_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private saveLedger(items: DistilledTopic[]): void {
    try { storageService.setItem(LEDGER_KEY, JSON.stringify(items.slice(-100))); } catch { /* 台帳は補助経路 */ }
  }

  public listDistilled(): DistilledTopic[] {
    return this.loadLedger();
  }

  /** 話題ごとに現れた日数（distinct な日）を数える。 */
  public topicDayCounts(): Array<{ topic: string; days: number }> {
    const byTopic = new Map<string, Set<string>>();
    for (const ep of episodeMemoryService.storedEpisodes()) {
      for (const topic of ep.topics || []) {
        const t = String(topic || '').trim();
        if (t.length < 2) continue;
        if (!byTopic.has(t)) byTopic.set(t, new Set<string>());
        byTopic.get(t)!.add(ep.day);
      }
    }
    return [...byTopic.entries()]
      .map(([topic, days]) => ({ topic, days: days.size }))
      .sort((a, b) => b.days - a.days || a.topic.localeCompare(b.topic));
  }

  /**
   * 蒸留を 1 回行う。3 日以上現れた話題のうち未蒸留のものを
   * 最大 limit 件まで Claim 候補化する。戻り値は今回蒸留した話題。
   */
  public distill(limit = 3): DistilledTopic[] {
    const ledger = this.loadLedger();
    const done = new Set(ledger.map((d) => d.topic));
    const out: DistilledTopic[] = [];
    for (const cand of this.topicDayCounts()) {
      if (out.length >= limit) break;
      if (cand.days < MIN_DAYS || done.has(cand.topic)) continue;
      try {
        claimDatabaseService.registerClaim({
          statement: `「${cand.topic}」は繰り返し話題になっている`,
          world: 'REAL',
          kind: 'FACT_CLAIM',
          status: 'CANDIDATE',
          source: 'episode_distillation',
          self_provenance: 'SELF_SUPPORTED',
          maturity: 'DISCOVERED',
          origin_source_id: `episode_distillation:${cand.topic}`,
          independence_cluster_id: 'cluster_episode_distillation',
        } as any);
        const entry: DistilledTopic = { topic: cand.topic, days: cand.days, at: Date.now() };
        ledger.push(entry);
        done.add(cand.topic);
        out.push(entry);
        systemLogger.info('SELF_IMPROVEMENT', `🌗 [蒸留] 繰り返し話題を知識候補へ蒸留しました: 「${cand.topic}」（${cand.days}日）`);
      } catch { /* 1件の失敗で全体は止めない */ }
    }
    if (out.length > 0) this.saveLedger(ledger);
    return out;
  }
}

export const episodeDistillationService = new EpisodeDistillationService();
