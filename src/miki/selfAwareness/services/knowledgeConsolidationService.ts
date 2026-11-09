import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { worldModelGraphService } from './worldModelGraphService';

/**
 * P542: 統合パス（寝ている間の整理）。成長ループから1日1回まで
 * で回り、その日の学習を頭の中でつなぎ直す:
 *   1. 全 Claim に関係抽出をかけ直す。取り込み経路によっては
 *      抽出が漏れるため、世界モデルへの反映を取りこぼさない。
 *   2. 図式の抽出。同じ親を持つ実体が3つ以上そろい、さらに別の
 *      関係（種類と相手）まで共有していたら、「共通の型」を
 *      仮の知識（kind=SCHEMA / UNVERIFIED）として立てる。確定は
 *      しない。検証は通常の Claim の流れに任せる。
 */

const LAST_RUN_KEY = 'miki_consolidation_last_run_v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SCHEMAS_PER_RUN = 3;

const SHARED_RELATION_PHRASE: Record<string, (to: string) => string> = {
  USED_FOR: (to) => `${to}に使われます`,
  CAUSES: (to) => `${to}を引き起こします`,
  ENABLES: (to) => `${to}を可能にします`,
  PART_OF: (to) => `${to}の一部です`,
};

class KnowledgeConsolidationService {
  public runIfDue(now = Date.now()): { relationsAdded: number; schemas: number } | undefined {
    let last = 0;
    try { last = parseInt(storageService.getItem(LAST_RUN_KEY) || '0', 10) || 0; } catch { /* 読めなければ今回回す */ }
    if (now - last < DAY_MS) return undefined;
    try { storageService.setItem(LAST_RUN_KEY, String(now)); } catch { /* 書けなくても今回は回す */ }

    let relationsAdded = 0;
    try {
      relationsAdded = worldModelGraphService.extractRelationsFromClaims().added;
    } catch { /* 抽出できなくても図式の段は試す */ }

    const schemas = this.extractSchemas();
    systemLogger.info('SELF_IMPROVEMENT', `🌙 [統合] 関係の再抽出で ${relationsAdded} 件を追加し、図式を ${schemas} 件立てました`);
    return { relationsAdded, schemas };
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
