import { storageService } from '../../../services/storageService';

/**
 * P911: 外した形の学習（意図推定の一般化・第1段）。
 *
 * 解釈が「陳述（STATEMENT）＋意味未確定」に落ちた発話は、
 * 言い回しの形（内容語を除いた骨格）だけを一時記録する。
 * 次のターンで本人が言い直し、内容語が重なる発話が強い
 * 対話行為として通ったら、骨格→行為の対応を台帳へ昇格する。
 * 以後、同じ骨格の発話が陳述に落ちたら台帳の行為で解釈する。
 *
 * 境界:
 * - 昇格は本人の言い直しという会話の証拠があるときだけ
 *   （推測で形を増やさない。自己証明なし）。
 * - 消費は陳述に落ちた場合だけ。分類器の積極判定
 *   （質問・訂正・依頼など）は台帳で上書きしない。
 * - 骨格は機能語3つ以上ある形だけを対象にする
 *   （短い骨格は一般的すぎて誤爆する）。
 */

export interface LearnedForm {
  skeleton: string;
  act: string;
  at: number;
  hits: number;
  // P914: 出所。'rephrase' = 本人の言い直し（P911）、'teacher' = 教師教材。
  source?: string;
}

export interface PendingMiss {
  skeleton: string;
  contentTokens: string[];
  at: number;
}

interface MissedFormStore {
  learned: LearnedForm[];
  pending: Record<string, PendingMiss>;
}

const STORAGE_KEY = 'miki_missed_forms_v1';
const LEARNED_CAP = 100;
const PENDING_FRESH_MS = 60 * 60 * 1000;

class MissedFormLearningService {
  private load(): MissedFormStore {
    try {
      const raw = storageService.getItem(STORAGE_KEY);
      if (!raw) return { learned: [], pending: {} };
      const parsed = JSON.parse(raw);
      return {
        learned: Array.isArray(parsed?.learned) ? parsed.learned : [],
        pending: parsed?.pending && typeof parsed.pending === 'object' ? parsed.pending : {},
      };
    } catch {
      return { learned: [], pending: {} };
    }
  }

  private save(store: MissedFormStore): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch { /* 形の学習は補助経路 */ }
  }

  /** 発話の骨格（内容語を除いた機能語の並び）。短すぎる形は空を返す。 */
  public skeletonOf(analysis: { tokens?: Array<{ surface: string }>; contentTokens?: string[] }): string {
    const content = new Set(analysis?.contentTokens || []);
    const parts = (analysis?.tokens || [])
      .map((t) => t.surface)
      .filter((s) => s && !content.has(s));
    if (parts.length < 3) return '';
    return parts.join('|');
  }

  /**
   * P1117: 社交形キー。純粋な社交の形（「おひさしぶり？」等）は
   * 内容語を持たず骨格が空になり、従来は台帳に載らなかった。
   * 正規化した表層そのものをキーにして、同じ台帳に載せる。
   */
  public socialKeyOf(text: string): string {
    const normalized = String(text || '').replace(/[\s　]/g, '').replace(/[？！?!。、…]+$/g, '').trim();
    if (!normalized || normalized.length > 25) return '';
    // 内容のある質問（用語・知識・依頼）は社交形ではないのでキーにしない。
    if (/何|なに|誰|どこ|いつ|どう|なぜ|知ってる|教えて|して|ください/.test(normalized)) return '';
    return `social:${normalized}`;
  }

  /** P1117: 社交形の外しは内容語が無いので、専用の保留記録を使う。
   * 骨格側の保留が既にある場合は上書きしない（昇格の流れを壊さない）。 */
  public noteSocialMiss(key: string, socialKey: string): void {
    if (!socialKey || !socialKey.startsWith('social:')) return;
    const store = this.load();
    if (store.pending[key]) return;
    store.pending[key] = { skeleton: socialKey, contentTokens: [], at: Date.now() };
    this.save(store);
  }

  public noteMiss(key: string, skeleton: string, contentTokens: string[]): void {
    if (!skeleton || !contentTokens || contentTokens.length === 0) return;
    const store = this.load();
    store.pending[key] = { skeleton, contentTokens: [...contentTokens], at: Date.now() };
    this.save(store);
  }

  public pendingFor(key: string): PendingMiss | undefined {
    const p = this.load().pending[key];
    if (!p) return undefined;
    if (Date.now() - p.at > PENDING_FRESH_MS) return undefined;
    return p;
  }

  public clearPending(key: string): void {
    const store = this.load();
    if (store.pending[key]) {
      delete store.pending[key];
      this.save(store);
    }
  }

  /** 言い直しが通ったので、保留中の外しを台帳へ昇格する。 */
  public promote(key: string, act: string): boolean {
    const store = this.load();
    const p = store.pending[key];
    if (!p) return false;
    delete store.pending[key];
    const existing = store.learned.find((l) => l.skeleton === p.skeleton);
    if (existing) {
      existing.act = act;
      existing.at = Date.now();
      existing.source = 'rephrase';
    } else {
      store.learned.push({ skeleton: p.skeleton, act, at: Date.now(), hits: 0, source: 'rephrase' });
      while (store.learned.length > LEARNED_CAP) store.learned.shift();
    }
    this.save(store);
    return true;
  }

  public lookup(skeleton: string): string | undefined {
    if (!skeleton) return undefined;
    const store = this.load();
    const hit = store.learned.find((l) => l.skeleton === skeleton);
    if (!hit) return undefined;
    hit.hits++;
    this.save(store);
    return hit.act;
  }

  /**
   * P914: 教師教材からの直接登録（意図推定の一般化・第2段）。
   * 言い直しの証拠を待たず、教師印の形を台帳へ入れる。
   */
  public learnForm(skeleton: string, act: string, source: string): boolean {
    const skel = (skeleton || '').trim();
    const a = (act || '').trim();
    if (!skel || !a) return false;
    // P1117: 社交形キー（social:）は表層そのものがキーなので、骨格の
    // 部品数チェックの対象外。
    if (!skel.startsWith('social:') && skel.split('|').filter(Boolean).length < 3) return false;
    const store = this.load();
    const existing = store.learned.find((l) => l.skeleton === skel);
    if (existing) {
      existing.act = a;
      existing.at = Date.now();
      existing.source = source;
    } else {
      store.learned.push({ skeleton: skel, act: a, at: Date.now(), hits: 0, source });
      while (store.learned.length > LEARNED_CAP) store.learned.shift();
    }
    this.save(store);
    return true;
  }

  /**
   * P914: 類推一般化（保守版）。完全一致が無いとき、台帳の形と
   * 「部分列の関係にある」または「トークン編集距離1」の形だけを
   * 候補にする。末尾トークンが同じことが条件で、別行為の候補が
   * 同格に並んだら棄権する（例:「知りたい」と「終わりにしたい」は
   * 距離が遠く、そもそも候補にならない）。
   */
  public lookupSimilar(skeleton: string): string | undefined {
    if (!skeleton) return undefined;
    const q = skeleton.split('|').filter(Boolean);
    if (q.length < 3) return undefined;
    const store = this.load();
    const isSubseq = (small: string[], big: string[]): boolean => {
      let i = 0;
      for (const t of big) {
        if (t === small[i]) i++;
        if (i >= small.length) return true;
      }
      return i >= small.length;
    };
    const editDistance = (a: string[], b: string[]): number => {
      let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
      for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
      }
      return prev[b.length];
    };
    let bestRank = Number.POSITIVE_INFINITY;
    let bestEntry: LearnedForm | undefined;
    let conflict = false;
    for (const l of store.learned) {
      const t = l.skeleton.split('|').filter(Boolean);
      if (t.length < 3) continue;
      if (t[t.length - 1] !== q[q.length - 1]) continue;
      let rank = Number.POSITIVE_INFINITY;
      if (isSubseq(t, q) || isSubseq(q, t)) rank = 0;
      else if (editDistance(q, t) <= 1) rank = 1;
      if (!Number.isFinite(rank)) continue;
      if (rank < bestRank) {
        bestRank = rank;
        bestEntry = l;
        conflict = false;
      } else if (rank === bestRank && bestEntry && bestEntry.act !== l.act) {
        conflict = true;
      }
    }
    if (conflict || !bestEntry) return undefined;
    bestEntry.hits++;
    this.save(store);
    return bestEntry.act;
  }

  public learnedForms(): LearnedForm[] {
    return this.load().learned;
  }
}

export const missedFormLearningService = new MissedFormLearningService();
