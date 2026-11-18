import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { worldModelGraphService } from './worldModelGraphService';
import { conversationOpenTopicService } from '../../conversation/services/conversationOpenTopicService';
import { predictionLedgerService } from '../../memory/services/predictionLedgerService';
import { knowledgeGapService } from '../../unknown/services/knowledgeGapService';
import { mistakeNotebookService } from './mistakeNotebookService';
import { dreamService } from './dreamService';
import { avatarPresenceService } from './avatarPresenceService';
import { swarmVerificationService } from './swarmVerificationService';
import { videoSceneService } from '../../conversation/services/videoSceneService';

/**
 * P542: 統合パス（寝ている間の整理）。成長ループから1日1回まで
 * で回り、その日の学習を頭の中でつなぎ直す:
 *   1. 全 Claim に関係抽出をかけ直す。取り込み経路によっては
 *      抽出が漏れるため、世界モデルへの反映を取りこぼさない。
 *   2. 図式の抽出。同じ親を持つ実体が3つ以上そろい、さらに別の
 *      関係（種類と相手）まで共有していたら、「共通の型」を
 *      仮の知識（kind=SCHEMA / UNVERIFIED）として立てる。確定は
 *      しない。検証は通常の Claim の流れに任せる。
 *   3. P843: エピソードの蒸留（相補学習系の「出来事→意味」側）。
 *      複数の日に繰り返し現れた話題は、その日の出来事ではなく
 *      「続いている関心」なので、開いた話題へ重み付きで戻し、
 *      後日の拾い直しに残るようにする。
 */

const LAST_RUN_KEY = 'miki_consolidation_last_run_v1';
const REPORT_KEY = 'miki_sleep_report_v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SCHEMAS_PER_RUN = 3;

/** P931: 眠って整理した結果の報告（朝に彼女が語れる形で残す）。 */
export interface SleepReport {
  at: number;
  runs: number;
  relationsAdded: number;
  schemas: number;
  distilled: number;
  predictionsConfirmed: number;
  predictionsRefuted: number;
  relearnGaps: number;
  mistakesReviewed: number;
  mistakeRelearnGaps: number;
}

const SHARED_RELATION_PHRASE: Record<string, (to: string) => string> = {
  USED_FOR: (to) => `${to}に使われます`,
  CAUSES: (to) => `${to}を引き起こします`,
  ENABLES: (to) => `${to}を可能にします`,
  PART_OF: (to) => `${to}の一部です`,
};

class KnowledgeConsolidationService {
  public runIfDue(now = Date.now()): { relationsAdded: number; schemas: number; distilled: number; predictions: { confirmed: number; refuted: number; refutedTargets: string[] }; relearnGaps: number } | undefined {
    let last = 0;
    try { last = parseInt(storageService.getItem(LAST_RUN_KEY) || '0', 10) || 0; } catch { /* 読めなければ今回回す */ }
    if (now - last < DAY_MS) return undefined;
    return this.run(now);
  }

  /** P931: 「おやすみ」で今すぐ眠る（1日1回の門を飛ばして整理する）。 */
  public sleepNow(now = Date.now()): SleepReport {
    this.run(now);
    return this.lastReport() as SleepReport;
  }

  /** P931: 直近の整理の報告を読む。 */
  public lastReport(): SleepReport | null {
    try {
      const raw = storageService.getItem(REPORT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.at === 'number') return parsed as SleepReport;
      }
    } catch { /* fall through */ }
    return null;
  }

  private run(now: number): { relationsAdded: number; schemas: number; distilled: number; predictions: { confirmed: number; refuted: number; refutedTargets: string[] }; relearnGaps: number } {
    try { storageService.setItem(LAST_RUN_KEY, String(now)); } catch { /* 書けなくても今回は回す */ }

    let relationsAdded = 0;
    try {
      relationsAdded = worldModelGraphService.extractRelationsFromClaims().added;
    } catch { /* 抽出できなくても図式の段は試す */ }

    const schemas = this.extractSchemas();
    const distilled = this.distillEpisodes();
    // P844: 立てておいた予測を、育った世界モデルと照合する。
    const predictions = predictionLedgerService.settleAll(now);
    // P854: 外れた予測は「学び直し」の知識ギャップへ戻す（予測→
    // 照合→外れ→再学習のループを閉じる）。1回の統合で最大2件。
    let relearnGaps = 0;
    try {
      for (const target of predictions.refutedTargets.slice(0, 2)) {
        const gap = knowledgeGapService.detect({
          query: `「${target}」の関係を調べ直す`,
          reason: '予測が外れたため、関係を学び直す',
          type: 'UNKNOWN_RELATION',
          target,
          priority: 60,
        });
        if (gap && gap.status === 'OPEN') relearnGaps++;
      }
    } catch { /* ギャップ化できなくても統合は止めない */ }
    // P931: 間違い帳の見直し。繰り返した誤りは学び直しの不足へ
    // 戻す（1回の整理で最大2件）。寝ることは、間違いと向き合う
    // 時間でもある。
    let mistakesReviewed = 0;
    let mistakeRelearnGaps = 0;
    try {
      const recurring = mistakeNotebookService.list(50)
        .filter((e) => !e.resolved && e.occurrences >= 2);
      mistakesReviewed = recurring.length;
      for (const entry of recurring.slice(0, 2)) {
        if (!entry.right) continue;
        const gap = knowledgeGapService.detect({
          query: `「${entry.wrong}」ではなく「${entry.right}」であることを学び直す`,
          reason: '同じ間違いを繰り返したため、眠って整理する中で学び直す',
          type: 'UNKNOWN_TERM',
          target: entry.right,
          priority: 55,
        });
        if (gap && gap.status === 'OPEN') mistakeRelearnGaps++;
      }
    } catch { /* 見直しできなくても統合は止めない */ }
    // P939: 整理の仕上げに夢を見る（その日の材料の組み合わせ。
    // 知識には入れない）。材料が無ければ見ない。
    try { dreamService.dreamTonight(now); } catch { /* 夢が見られなくても統合は止めない */ }
    // P942: 整理の間は2人とも寝ている（アバターの存在状態）。
    try {
      avatarPresenceService.noteSleep('miki', now);
      avatarPresenceService.noteSleep('bibi', now);
    } catch { /* 存在状態が書けなくても統合は止めない */ }
    // P944: 類推候補をビービーの群れで点検する（判定だけ。知識は書き換えない）。
    try { swarmVerificationService.verifyAnalogyCandidates(8, now); } catch { /* 群れが止まっても統合は止めない */ }
    // P974: 動画の字幕対応で育った名前の候補を、未検証の
    // 主張として登録する（検証待ちとして残すのが第2段）。
    try { videoSceneService.promoteCandidates(); } catch { /* 昇格が止まっても統合は止めない */ }
    systemLogger.info('SELF_IMPROVEMENT', `🌙 [統合] 関係の再抽出で ${relationsAdded} 件を追加し、図式を ${schemas} 件立て、繰り返しの話題を ${distilled} 件蒸留し、予測を ${predictions.confirmed + predictions.refuted} 件照合しました（外れ ${predictions.refuted} 件）`);
    // P931: 報告を残す（朝、聞かれたら語れるように）。
    try {
      const previous = this.lastReport();
      const report: SleepReport = {
        at: now,
        runs: (previous?.runs || 0) + 1,
        relationsAdded,
        schemas,
        distilled,
        predictionsConfirmed: predictions.confirmed,
        predictionsRefuted: predictions.refuted,
        relearnGaps,
        mistakesReviewed,
        mistakeRelearnGaps,
      };
      storageService.setItem(REPORT_KEY, JSON.stringify(report));
    } catch { /* 報告が残せなくても統合自体は済んでいる */ }
    return { relationsAdded, schemas, distilled, predictions, relearnGaps };
  }

  /**
   * P843: エピソード（miki_episodes_v1）を通読し、2つ以上の異なる
   * 日に現れた話題を「続いている関心」として開いた話題へ戻す。
   * 今まさに開いている話題は対象外（蒸留するまでもない）。1回の
   * 統合で戻すのは最大2件まで。
   */
  private distillEpisodes(): number {
    let distilled = 0;
    try {
      const raw = storageService.getItem('miki_episodes_v1');
      const episodes: Array<{ day?: string; topics?: string[] }> = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(episodes)) return 0;
      const daysByTopic = new Map<string, Set<string>>();
      for (const ep of episodes) {
        if (!ep || typeof ep.day !== 'string' || !Array.isArray(ep.topics)) continue;
        for (const topic of ep.topics) {
          if (typeof topic !== 'string' || !topic) continue;
          const days = daysByTopic.get(topic) || new Set<string>();
          days.add(ep.day);
          daysByTopic.set(topic, days);
        }
      }
      const pending = new Set(conversationOpenTopicService.listPending().map((r) => r.topic));
      const recurring = [...daysByTopic.entries()]
        .filter(([topic, days]) => days.size >= 2 && !pending.has(topic))
        .sort((a, b) => b[1].size - a[1].size);
      for (const [topic] of recurring) {
        if (distilled >= 2) break;
        conversationOpenTopicService.record(topic, 3);
        if (conversationOpenTopicService.listPending().some((r) => r.topic === topic)) distilled++;
      }
    } catch { /* 蒸留できなくても統合の他の段は済んでいる */ }
    return distilled;
  }

  private extractSchemas(): number {
    let created = 0;
    try {
      const relations = worldModelGraphService.relations().filter((r) => !r.provisional);
      const childrenByParent = new Map<string, string[]>();
      for (const rel of relations) {
        if (rel.type !== 'IS_A') continue;
        const list = childrenByParent.get(rel.to) || [];
        if (!list.includes(rel.from)) list.push(rel.from);
        childrenByParent.set(rel.to, list);
      }
      const existing = new Set(claimDatabaseService.listClaims().map((c) => String(c.statement || '').trim()));
      for (const [parent, children] of childrenByParent) {
        if (created >= MAX_SCHEMAS_PER_RUN) break;
        if (children.length < 3) continue;
        // 子同士が共有する「もう1つの関係」を数える。
        const signatureCount = new Map<string, { type: string; to: string; children: string[] }>();
        for (const child of children) {
          for (const rel of relations) {
            if (rel.from !== child || rel.type === 'IS_A') continue;
            const key = `${rel.type}\u0001${rel.to}`;
            const entry = signatureCount.get(key) || { type: rel.type, to: rel.to, children: [] };
            if (!entry.children.includes(child)) entry.children.push(child);
            signatureCount.set(key, entry);
          }
        }
        for (const entry of signatureCount.values()) {
          if (created >= MAX_SCHEMAS_PER_RUN) break;
          if (entry.children.length < 3) continue;
          const phrase = SHARED_RELATION_PHRASE[entry.type]?.(entry.to);
          if (!phrase) continue;
          const statement = `${parent}の仲間（${entry.children.join('、')}）は、いずれも${phrase}。`;
          if (existing.has(statement)) continue;
          claimDatabaseService.registerClaim({
            statement,
            world: 'REAL',
            kind: 'SCHEMA',
            status: 'UNVERIFIED',
            source: 'consolidation',
          });
          existing.add(statement);
          created++;
        }
      }
    } catch { /* 図式が作れなくても統合の他の段は済んでいる */ }
    return created;
  }
}

export const knowledgeConsolidationService = new KnowledgeConsolidationService();
