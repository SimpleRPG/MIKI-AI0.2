import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from './claimDatabaseService';
import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';

/**
 * P541: 連想グラフ（広さ）。世界モデルは「事実の関係」だけを持つ
 * ため、明示的な関係が無い場所には連想が届かなかった。ここでは
 * 「一緒に現れた」ことから作る緩い連想の層を別に持ち、事実の層
 * とは混ぜない。連想は会話で「〜のことも思い出します」の形で
 * のみ出し、事実として主張することは決してしない。
 *
 * 材料（既存の台帳からのみ作る。新しい情報は取り込まない）:
 *   - 同じ Claim の文に一緒に載った実体同士（重み +2）
 *   - 同じ親を持つ兄弟の実体同士（IS_A の親が同じ、重み +1）
 * 成長ループから定期的に作り直すため陳腐化しない（部品リンクの
 * 同期と同じ方式）。上限は重みの高い順に 500 件。
 */

export interface AssociationEdge {
  a: string;
  b: string;
  weight: number;
}

interface AssociationGraphState {
  builtAt: number;
  edges: AssociationEdge[];
}

const STORAGE_KEY = 'miki_association_graph_v1';
const MAX_EDGES = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

class AssociationGraphService {
  private state: AssociationGraphState | null = null;

  private load(): AssociationGraphState {
    if (this.state) return this.state;
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as AssociationGraphState) : null;
      this.state = parsed && Array.isArray(parsed.edges) ? parsed : { builtAt: 0, edges: [] };
    } catch {
      this.state = { builtAt: 0, edges: [] };
    }
    return this.state;
  }

  private save(): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch { /* 保存できなくても今回の連想は使える */ }
  }

  /** 台帳と世界モデルから連想を作り直す。作り直した辺の数を返す。 */
  public rebuild(now = Date.now()): { edges: number } {
    const names = worldModelGraphService.entities().map((e) => e.name).filter((n) => n && n.length >= 2);
    const weights = new Map<string, AssociationEdge>();
    const add = (a: string, b: string, w: number) => {
      if (a === b) return;
      const [x, y] = a < b ? [a, b] : [b, a];
      const key = `${x}\u0001${y}`;
      const cur = weights.get(key);
      if (cur) cur.weight += w;
      else weights.set(key, { a: x, b: y, weight: w });
    };

    try {
      for (const claim of claimDatabaseService.listClaims()) {
        if (claim.status === 'SUPERSEDED') continue;
        if ((claim as { archived?: boolean }).archived) continue;
        const stmt = String(claim.statement || '');
        if (!stmt) continue;
        const present = names.filter((n) => stmt.includes(n));
        for (let i = 0; i < present.length; i++) {
          for (let j = i + 1; j < present.length; j++) add(present[i], present[j], 2);
        }
      }
    } catch { /* 台帳が読めなければ兄弟だけから作る */ }

    try {
      const childrenByParent = new Map<string, string[]>();
      for (const rel of worldModelGraphService.relations()) {
        if (rel.type !== 'IS_A' || rel.provisional) continue;
        const list = childrenByParent.get(rel.to) || [];
        if (!list.includes(rel.from)) list.push(rel.from);
        childrenByParent.set(rel.to, list);
      }
      for (const children of childrenByParent.values()) {
        for (let i = 0; i < children.length; i++) {
          for (let j = i + 1; j < children.length; j++) add(children[i], children[j], 1);
        }
      }
    } catch { /* 世界モデルが読めなければ共起だけから作る */ }

    const edges = [...weights.values()].sort((p, q) => q.weight - p.weight).slice(0, MAX_EDGES);
    const previousCount = this.load().edges.length;
    this.state = { builtAt: now, edges };
    this.save();
    if (edges.length !== previousCount) {
      systemLogger.info('SELF_IMPROVEMENT', `🕸️ [連想] 連想グラフを作り直しました（辺 ${edges.length} 件）`);
    }
    return { edges: edges.length };
  }

  public rebuildIfDue(now = Date.now()): void {
    if (now - this.load().builtAt < DAY_MS) return;
    this.rebuild(now);
  }

  public ensureBuilt(): void {
    if (this.load().edges.length === 0 && this.load().builtAt === 0) this.rebuild();
  }

  /** ある名前の連想先を、重みの高い順に返す。 */
  public associations(name: string, limit = 3): Array<{ name: string; weight: number }> {
    const out: Array<{ name: string; weight: number }> = [];
    for (const e of this.load().edges) {
      if (e.a === name) out.push({ name: e.b, weight: e.weight });
      else if (e.b === name) out.push({ name: e.a, weight: e.weight });
    }
    return out.sort((p, q) => q.weight - p.weight).slice(0, limit);
  }

  public edgeCount(): number {
    return this.load().edges.length;
  }
}

export const associationGraphService = new AssociationGraphService();
