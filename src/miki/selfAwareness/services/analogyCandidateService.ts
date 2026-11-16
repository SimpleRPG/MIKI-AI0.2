import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { worldModelGraphService } from './worldModelGraphService';
import { predictionLedgerService } from '../../memory/services/predictionLedgerService';

export interface AnalogyCandidateRecord {
  from: string;
  type: string;
  to: string;
  basedOn: string[];
  createdAt: number;
}

const STORAGE_KEY = 'miki_analogy_candidates_v1';
const MAX_ITEMS = 200;

/**
 * P902（ブレイクスルー③ 類推からの自己生成 v1）: 世界モデルの
 * 類推で候補関係を自分で生成する。
 *
 * 確定した IS_A で同じ分類に属する兄弟が持つ確定関係を、まだ
 * 持っていない兄弟へ「候補」として写す。候補は PROVISIONAL
 * （確信度 0.2、教わった仮関係より弱い）で入り、同時に予測台帳へ
 * 登録される。後で証拠が来て同じ関係が確定すれば予測ループが
 * CONFIRMED として候補を強め、外れれば弱める。「自分の検証を
 * 通ったものだけが強くなる」形。
 *
 * 守る線（P900 と同じ）:
 * - 材料は確定関係だけ。仮関係からは類推しない。
 * - IS_A そのものは生成しない（分類の積み増しはしない）。
 * - 既にその種類の関係がある実体には作らない（穴だけ埋める）。
 */
class AnalogyCandidateService {
  private load(): AnalogyCandidateRecord[] {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  private save(items: AnalogyCandidateRecord[]): void {
    try { storageService.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS))); } catch { /* 台帳は補助経路 */ }
  }

  public list(): AnalogyCandidateRecord[] {
    return this.load();
  }

  /** 類推候補を最大 limit 件まで生成し、作った分を返す。 */
  public generateCandidates(limit = 3): AnalogyCandidateRecord[] {
    const relations = worldModelGraphService.relations();
    const confirmed = relations.filter((r) => !r.provisional);
    // 確定 IS_A による分類グループ。
    const groups = new Map<string, Set<string>>();
    for (const r of confirmed) {
      if (r.type !== 'IS_A') continue;
      const set = groups.get(r.to) || new Set<string>();
      set.add(r.from);
      groups.set(r.to, set);
    }
    const existingTypes = new Set(relations.map((r) => `${r.from}|${r.type}`));
    const existingTriples = new Set(relations.map((r) => `${r.from}|${r.type}|${r.to}`));
    const ledger = this.load();
    const ledgerKeys = new Set(ledger.map((c) => `${c.from}|${c.type}|${c.to}`));

    type Cand = { from: string; type: string; to: string; basedOn: string[] };
    const cands: Cand[] = [];
    for (const members of groups.values()) {
      const memberList = [...members];
      if (memberList.length < 2) continue;
      // 兄弟が持つ関係のパターン（種類→行き先）と保持者。
      const patterns = new Map<string, { type: string; to: string; holders: string[] }>();
      for (const m of memberList) {
        for (const r of confirmed) {
          if (r.from !== m || r.type === 'IS_A') continue;
          const key = `${r.type}|${r.to}`;
          const p = patterns.get(key) || { type: r.type as string, to: r.to, holders: [] as string[] };
          if (!p.holders.includes(m)) p.holders.push(m);
          patterns.set(key, p);
        }
      }
      for (const x of memberList) {
        for (const p of patterns.values()) {
          if (p.holders.includes(x)) continue;
          if (existingTypes.has(`${x}|${p.type}`)) continue;
          const triple = `${x}|${p.type}|${p.to}`;
          if (existingTriples.has(triple) || ledgerKeys.has(triple)) continue;
          if (p.to === x) continue;
          cands.push({ from: x, type: p.type, to: p.to, basedOn: p.holders });
        }
      }
    }
    // 共有する兄弟が多いパターンから先に作る。
    cands.sort((a, b) => b.basedOn.length - a.basedOn.length);

    const created: AnalogyCandidateRecord[] = [];
    for (const c of cands) {
      if (created.length >= limit) break;
      try {
        worldModelGraphService.addRelation({ fromName: c.from, toName: c.to, type: c.type as any, provisional: true, confidence: 0.2 } as any);
        predictionLedgerService.predictCandidate(c.from, c.type, c.to);
        const rec: AnalogyCandidateRecord = { ...c, createdAt: Date.now() };
        ledger.push(rec);
        ledgerKeys.add(`${c.from}|${c.type}|${c.to}`);
        created.push(rec);
        systemLogger.info('SELF_IMPROVEMENT', `🔗 [類推] 「${c.from}」に候補関係 ${c.type}→${c.to} を生成しました（兄弟 ${c.basedOn.join('・')} からの類推）`);
      } catch { /* 1件の失敗で全体は止めない */ }
    }
    if (created.length > 0) this.save(ledger);
    return created;
  }
}

export const analogyCandidateService = new AnalogyCandidateService();
