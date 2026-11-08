import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { autonomousSearchService } from '../../research/services/autonomousSearchService';

/**
 * P488: 自分のログを読むためのサービス。
 *
 * これまで彼女のログは「書く」一方で、読むコードがどこにも
 * なかった（エクスポートは人間のためだけ）。このサービスは
 * systemLogger の保持する直近エントリを集計し、件数と繰り返し
 * パターンに変える。調査の第一歩（実物の記録を数える）を、
 * 彼女自身が自分のログに対して行えるようにするもの。
 */

export interface RuntimeLogPattern {
  template: string;
  count: number;
  example: string;
}

export interface RuntimeLogSummary {
  windowMinutes: number;
  total: number;
  errors: number;
  warnings: number;
  searchSuccess: number;
  searchEmpty: number;
  runtimeFailures: number;
  capRefusals: number;
  selfDiagnoses: number;
  subjectBlocks: number;
  worldModelGrowths: number;
  topPatterns: RuntimeLogPattern[];
}

export interface RuntimeSelfReview {
  at: number;
  summary: RuntimeLogSummary;
  findings: string[];
}

const REVIEW_KEY = 'miki_runtime_self_review_v1';
const MAX_REVIEWS = 20;

function toTemplate(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<id>')
    .replace(/\b(?:CLM|GAP|EVD|TASK|RUN|RQP|RQI|RQ|DEBT|SUP|TM|CR)-[A-Za-z0-9-]+/g, '<id>')
    .replace(/\d+(?:\.\d+)?\s*(?:ms|秒|件|回|分|%)/g, '<n>')
    .replace(/\d+/g, '<n>')
    .slice(0, 120);
}

class RuntimeLogReviewService {
  public summarize(windowMinutes = 60): RuntimeLogSummary {
    const since = Date.now() - windowMinutes * 60_000;
    const entries = systemLogger.getLogs().filter(entry => entry.epoch >= since);
    const has = (entry: { message: string }, needle: string) => entry.message.includes(needle);
    const countWhere = (pred: (entry: { message: string; level: string }) => boolean) => entries.filter(pred).length;
    const patterns = new Map<string, RuntimeLogPattern>();
    for (const entry of entries) {
      const template = toTemplate(entry.message);
      const pattern = patterns.get(template) ?? { template, count: 0, example: entry.message.slice(0, 160) };
      pattern.count++;
      patterns.set(template, pattern);
    }
    return {
      windowMinutes,
      total: entries.length,
      errors: countWhere(entry => entry.level === 'ERROR'),
      warnings: countWhere(entry => entry.level === 'WARN'),
      searchSuccess: countWhere(entry => has(entry, '[SearXNG] 検索成功')),
      searchEmpty: countWhere(entry => has(entry, '[SearXNG] 検索結果0件')),
      runtimeFailures: countWhere(entry => has(entry, '[RUNTIME_FAILURE]')),
      capRefusals: countWhere(entry => has(entry, '上限') && has(entry, '却下')),
      selfDiagnoses: countWhere(entry => has(entry, '[自己診断]')),
      subjectBlocks: countWhere(entry => has(entry, '[主題理解]')),
      worldModelGrowths: countWhere(entry => entry.message.includes('🌐')),
      topPatterns: [...patterns.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    };
  }

  /**
   * 集計し、注目すべきパターンを「所見」として残す。検索の空転は、
   * 自己診断（P485）が生きていて理由を説明できる間は所見にしない
   * ——それは原因不明ではなく、彼女の結論である。
   */
  public review(windowMinutes = 60): RuntimeSelfReview {
    const summary = this.summarize(windowMinutes);
    const findings: string[] = [];
    const failurePattern = summary.topPatterns.find(
      pattern => pattern.template.includes('[RUNTIME_FAILURE]') && pattern.count >= 3,
    );
    if (failurePattern) {
      findings.push(`同じ形のタスク停止が${failurePattern.count}回: ${failurePattern.example}`);
    }
    if (summary.capRefusals >= 5) {
      findings.push(`キュー上限の却下が${summary.capRefusals}回（未解決在庫の滞留の疑い）`);
    }
    let liveDiagnosis: string | null = null;
    try {
      const diagnosis = autonomousSearchService.getSearchSelfDiagnosis();
      if (
        (diagnosis.cause === 'UPSTREAM_SUSPENDED' || diagnosis.cause === 'BUDGET_EXHAUSTED') &&
        (!diagnosis.until || diagnosis.until > Date.now())
      ) {
        liveDiagnosis = diagnosis.cause;
      }
    } catch {
      // 診断が読めなくてもレビュー自体は続ける。
    }
    if (summary.searchEmpty >= 5 && summary.searchSuccess === 0 && !liveDiagnosis) {
      findings.push(`検索結果0件が${summary.searchEmpty}回・成功0回で、自己診断に説明がない（原因不明）`);
    }
    if (summary.subjectBlocks > 0) {
      findings.push(`主題を特定できず検索しなかった調査が${summary.subjectBlocks}回`);
    }
    const record: RuntimeSelfReview = { at: Date.now(), summary, findings };
    try {
      const saved = storageService.getItem(REVIEW_KEY);
      const rows: RuntimeSelfReview[] = saved ? JSON.parse(saved) : [];
      rows.push(record);
      storageService.setItem(REVIEW_KEY, JSON.stringify(rows.slice(-MAX_REVIEWS)));
    } catch {
      // レビュー記録は補助。書けなくても集計結果は返す。
    }
    if (findings.length > 0) {
      systemLogger.info('SELF_IMPROVEMENT', `🔎 [自己レビュー] 直近${windowMinutes}分: ${findings.join(' ／ ')}`);
    }
    return record;
  }

  public latestReview(): RuntimeSelfReview | null {
    try {
      const saved = storageService.getItem(REVIEW_KEY);
      const rows: RuntimeSelfReview[] = saved ? JSON.parse(saved) : [];
      return rows.length ? rows[rows.length - 1] : null;
    } catch {
      return null;
    }
  }
}

export const runtimeLogReviewService = new RuntimeLogReviewService();
