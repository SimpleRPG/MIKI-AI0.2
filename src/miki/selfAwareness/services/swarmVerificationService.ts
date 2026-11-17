import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { conversationFactIntakeService } from '../../conversation/services/conversationFactIntakeService';
import { analogyCandidateService } from './analogyCandidateService';

/**
 * P944: ビービーの群れによる並列検証（第1段）。
 *
 * 成長速度の仕組み（能力リスト 2026-11-17）で唯一残っていた
 * 「ビービーの群れによる仮説の並列検証」。ビービーは部品・
 * コード・バグの群れというイメージで、独立した検証を小さな
 * 担当（bee）に分け持たせ、1件の遅さが全体を止めない形にする。
 *
 * 実行は単一スレッドなので、並列は「決定的なラウンドロビン」
 * として実装する：文を bee に順に割り当て、各 bee が自分の
 * 列を独立に処理し、結果を合流させる。検証の中身は P937
 * （根拠つき反論）と同じ物差し——属性つきの事実だけを、
 * 検証済み Claim と照合する。属性の無い文は「判定できない」
 * として正直に返す。
 *
 * 判定は4つ：記録と一致（CONSISTENT）／記録と食い違う
 * （CONTRADICTED）／記録が無い（NO_RECORD）／判定できない
 * （UNCHECKABLE）。群れは判定を下すだけで、知識そのものは
 * 書き換えない（確定・反証の確定は予測ループ等の既存の
 * 仕組みの仕事）。
 *
 * 夜の統合（P931）では、類推候補（P902）の言い換え文を
 * 群れで点検する受け皿として使う。
 */

const STORAGE_KEY = 'miki_swarm_verifications_v1';
const MAX_RUNS = 10;
const DEFAULT_BEES = 4;

export type SwarmVerdict = 'CONSISTENT' | 'CONTRADICTED' | 'NO_RECORD' | 'UNCHECKABLE';

export interface SwarmItemResult {
  statement: string;
  verdict: SwarmVerdict;
  bee: string;
  claimStatement?: string;
}

export interface SwarmRun {
  at: number;
  total: number;
  consistent: number;
  contradicted: number;
  noRecord: number;
  uncheckable: number;
  bees: Array<{ bee: string; checked: number }>;
  items: SwarmItemResult[];
}

interface SwarmState {
  runs: SwarmRun[];
  totalRuns: number;
  totalChecked: number;
  totalContradicted: number;
}

class SwarmVerificationService {
  /** 1文を検証済み Claim と照合する（P937 と同じ物差し）。 */
  private verifyOne(statement: string): { verdict: SwarmVerdict; claimStatement?: string } {
    let facts: Array<{ entity?: string; attribute?: string; value?: string }> = [];
    try {
      facts = conversationFactIntakeService.extractUserFacts(statement).facts || [];
    } catch { /* 事実が取れなければ判定できない */ }
    const checkable = facts.filter((f) => f.entity && f.attribute && f.value);
    if (!checkable.length) return { verdict: 'UNCHECKABLE' };
    for (const fact of checkable) {
      let claims: any[] = [];
      try {
        claims = claimDatabaseService.searchClaims(String(fact.entity), 8) || [];
      } catch { /* 検索できなければ記録なし扱い */ }
      for (const claim of claims) {
        if (claim.status !== 'SUPPORTED' && claim.status !== 'DEVICE_VERIFIED') continue;
        let claimFacts: Array<{ entity?: string; attribute?: string; value?: string }> = [];
        try {
          claimFacts = conversationFactIntakeService.extractUserFacts(String(claim.statement || '')).facts || [];
        } catch { /* 読めない Claim は照合対象にしない */ }
        for (const cf of claimFacts) {
          if (cf.entity !== fact.entity || cf.attribute !== fact.attribute || !cf.value) continue;
          if (cf.value !== fact.value) {
            return { verdict: 'CONTRADICTED', claimStatement: String(claim.statement || '') };
          }
          return { verdict: 'CONSISTENT', claimStatement: String(claim.statement || '') };
        }
      }
    }
    return { verdict: 'NO_RECORD' };
  }

  /**
   * 文の束を群れで検証する。割り当てはラウンドロビンで決定的。
   * 結果は台帳に残す。
   */
  public verifyBatch(statements: string[], beeCount = DEFAULT_BEES, now = Date.now()): SwarmRun {
    const cleaned = (statements || []).map((s) => String(s || '').trim()).filter(Boolean);
    const bees = Math.max(1, Math.min(beeCount, Math.max(1, cleaned.length)));
    const perBee = new Map<string, number>();
    const items: SwarmItemResult[] = cleaned.map((statement, i) => {
      const bee = `bibi-${(i % bees) + 1}`;
      perBee.set(bee, (perBee.get(bee) || 0) + 1);
      const { verdict, claimStatement } = this.verifyOne(statement);
      return { statement, verdict, bee, claimStatement };
    });
    const run: SwarmRun = {
      at: now,
      total: items.length,
      consistent: items.filter((i) => i.verdict === 'CONSISTENT').length,
      contradicted: items.filter((i) => i.verdict === 'CONTRADICTED').length,
      noRecord: items.filter((i) => i.verdict === 'NO_RECORD').length,
      uncheckable: items.filter((i) => i.verdict === 'UNCHECKABLE').length,
      bees: [...perBee.entries()].map(([bee, checked]) => ({ bee, checked })),
      items,
    };
    try {
      const state = this.loadState();
      state.runs = [...state.runs, run].slice(-MAX_RUNS);
      state.totalRuns += 1;
      state.totalChecked += run.total;
      state.totalContradicted += run.contradicted;
      storageService.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* 台帳は補助経路 */ }
    if (run.contradicted > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `🐝 [群れ検証] ${run.total}件中${run.contradicted}件が記録と食い違った`);
    }
    return run;
  }

  /**
   * 類推候補（P902）を言い換え文にして群れで点検する。
   * 候補が無ければ null。候補そのものは書き換えない。
   */
  public verifyAnalogyCandidates(limit = 8, now = Date.now()): SwarmRun | null {
    const candidates = analogyCandidateService.list().slice(-limit);
    if (!candidates.length) return null;
    const statements = candidates.map((c) => `${c.from}の${c.type}は${c.to}だ`);
    return this.verifyBatch(statements, DEFAULT_BEES, now);
  }

  private loadState(): SwarmState {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '{}');
      return {
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
        totalRuns: Number(parsed.totalRuns || 0),
        totalChecked: Number(parsed.totalChecked || 0),
        totalContradicted: Number(parsed.totalContradicted || 0),
      };
    } catch {
      return { runs: [], totalRuns: 0, totalChecked: 0, totalContradicted: 0 };
    }
  }

  public latestRun(): SwarmRun | undefined {
    const runs = this.loadState().runs;
    return runs[runs.length - 1];
  }

  public summary(): { runs: number; checked: number; contradicted: number } {
    const state = this.loadState();
    return { runs: state.totalRuns, checked: state.totalChecked, contradicted: state.totalContradicted };
  }
}

export const swarmVerificationService = new SwarmVerificationService();
