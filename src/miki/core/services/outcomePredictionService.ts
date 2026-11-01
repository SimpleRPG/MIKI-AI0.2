import { storageService } from '../../../services/storageService';
import { canonicalSha256 } from './canonicalSha256Service';

// P373: predictions about task outcomes, made BEFORE a task runs and
// resolved against the observed outcome afterwards. The basis is
// this service's own resolved history for the same deterministic
// plan key, so a prediction exists only once enough comparable tasks
// have actually been observed (cold start = no prediction, never a
// guess). A clear mismatch (predicted SUCCESS, observed FAILURE or
// the reverse) is the learning signal: it marks exactly where the
// current understanding of "what will happen" was wrong.
export interface OutcomePredictionRecord {
  predictionId: string;
  planKey: string;
  goalHash: string;
  /** Absent on observation-only records (P397): outcomes recorded
   *  without a prediction, so history can accumulate from the very
   *  first task instead of only after predictions already exist. */
  predicted?: 'SUCCESS' | 'FAILURE';
  basisSamples: number;
  basisSuccessRate: number;
  /** P397: true when predict() overrode the long-run basis because
   *  the most recent outcomes contradicted it. supersededBasisRate
   *  keeps the overridden long-run rate for audit. */
  basisRevised?: boolean;
  supersededBasisRate?: number;
  observationOnly?: boolean;
  createdAt: number;
  resolvedAt?: number;
  observed?: 'SUCCESS' | 'FAILURE' | 'INCONCLUSIVE';
  matched?: boolean;
  taskId?: string;
}

const KEY = 'miki_outcome_predictions_v1';
const MAX_RECORDS = 500;
const MIN_BASIS_SAMPLES = 3;
// P397: the recent window that can overrule the long-run basis.
const RECENT_WINDOW = 5;
const REVISE_MIN_RECENT = 3;
const REVISE_MIN_GAP = 0.4;

class OutcomePredictionService {
  private records: OutcomePredictionRecord[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = storageService.getItem(KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.records = parsed.filter(
          (record): record is OutcomePredictionRecord =>
            Boolean(record) &&
            typeof record === 'object' &&
            typeof (record as OutcomePredictionRecord).predictionId === 'string'
        );
      }
    } catch {
      this.records = [];
    }
  }

  private save(): void {
    try {
      storageService.setItem(KEY, JSON.stringify(this.records.slice(-MAX_RECORDS)));
    } catch {
      // Prediction history is an accelerator for learning; losing it
      // must never break task execution.
    }
  }

  predict(input: { planKey: string; goal: string }): OutcomePredictionRecord | undefined {
    const history = this.records.filter(
      record =>
        record.planKey === input.planKey &&
        (record.observed === 'SUCCESS' || record.observed === 'FAILURE')
    );
    if (history.length < MIN_BASIS_SAMPLES) return undefined;
    const successes = history.filter(record => record.observed === 'SUCCESS').length;
    const rate = successes / history.length;
    if (rate === 0.5) return undefined;
    // P397: doubt the basis before trusting it. The long-run rate is
    // the standing judgment, but if the most recent outcomes have
    // moved decisively against it, the basis is stale — the world
    // the average describes may no longer be the world the task
    // runs in. Then the prediction is revised to the recent window
    // and the record says so, with the overridden rate kept.
    let basisSamples = history.length;
    let basisSuccessRate = rate;
    let basisRevised = false;
    let supersededBasisRate: number | undefined;
    const recent = history.slice(-RECENT_WINDOW);
    if (recent.length >= REVISE_MIN_RECENT) {
      const recentRate = recent.filter(record => record.observed === 'SUCCESS').length / recent.length;
      const longDirection = rate > 0.5 ? 1 : -1;
      const recentDirection = recentRate > 0.5 ? 1 : recentRate < 0.5 ? -1 : 0;
      if (recentDirection !== 0 && recentDirection !== longDirection && Math.abs(recentRate - rate) >= REVISE_MIN_GAP) {
        basisRevised = true;
        supersededBasisRate = rate;
        basisSamples = recent.length;
        basisSuccessRate = recentRate;
      }
    }
    if (basisSuccessRate === 0.5) return undefined;
    const createdAt = Date.now();
    const record: OutcomePredictionRecord = {
      predictionId: `PRED-${canonicalSha256(`${input.planKey}:${createdAt}:${this.records.length}`).slice(0, 16)}`,
      planKey: input.planKey,
      goalHash: canonicalSha256(input.goal),
      predicted: basisSuccessRate > 0.5 ? 'SUCCESS' : 'FAILURE',
      basisSamples,
      basisSuccessRate,
      ...(basisRevised ? { basisRevised, supersededBasisRate } : {}),
      createdAt,
    };
    this.records.push(record);
    this.save();
    return { ...record };
  }

  /**
   * P397: record an observed task outcome even when no prediction
   * was made for it. Until this existed, history could only be
   * written by resolving predictions — and predictions require
   * history — so on a fresh install the ledger never started.
   * Observations are real outcomes for the plan key and form the
   * basis future predictions stand on; they are never counted as
   * prediction hits or misses.
   */
  observeOutcome(input: {
    planKey: string;
    goal: string;
    observed: 'SUCCESS' | 'FAILURE';
    taskId: string;
  }): OutcomePredictionRecord {
    const now = Date.now();
    const record: OutcomePredictionRecord = {
      predictionId: `OBS-${canonicalSha256(`${input.planKey}:${now}:${this.records.length}`).slice(0, 16)}`,
      planKey: input.planKey,
      goalHash: canonicalSha256(input.goal),
      basisSamples: 0,
      basisSuccessRate: 0,
      observationOnly: true,
      createdAt: now,
      resolvedAt: now,
      observed: input.observed,
      taskId: input.taskId,
    };
    this.records.push(record);
    this.save();
    return { ...record };
  }

  resolve(
    predictionId: string | undefined,
    observed: 'SUCCESS' | 'FAILURE' | 'INCONCLUSIVE',
    taskId: string
  ): { record: OutcomePredictionRecord; matched: boolean } | undefined {
    if (!predictionId) return undefined;
    const record = this.records.find(item => item.predictionId === predictionId);
    if (!record || record.resolvedAt) return undefined;
    record.resolvedAt = Date.now();
    record.observed = observed;
    record.taskId = taskId;
    record.matched = observed === record.predicted;
    this.save();
    return { record: { ...record }, matched: record.matched };
  }

  calibration(planKey?: string): {
    samples: number;
    matched: number;
    mismatched: number;
    accuracy: number | null;
    revisions: number;
  } {
    // Only records that carried a prediction count as calibration
    // samples; observation-only records (P397) are basis, not bets.
    const resolved = this.records.filter(
      record =>
        record.resolvedAt &&
        typeof record.matched === 'boolean' &&
        (record.observed === 'SUCCESS' || record.observed === 'FAILURE') &&
        (!planKey || record.planKey === planKey)
    );
    const matched = resolved.filter(record => record.matched).length;
    return {
      samples: resolved.length,
      matched,
      mismatched: resolved.length - matched,
      accuracy: resolved.length ? matched / resolved.length : null,
      revisions: resolved.filter(record => record.basisRevised).length,
    };
  }
}

export const outcomePredictionService = new OutcomePredictionService();
