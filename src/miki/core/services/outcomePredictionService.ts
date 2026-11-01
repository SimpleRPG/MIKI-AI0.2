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
  predicted: 'SUCCESS' | 'FAILURE';
  basisSamples: number;
  basisSuccessRate: number;
  createdAt: number;
  resolvedAt?: number;
  observed?: 'SUCCESS' | 'FAILURE' | 'INCONCLUSIVE';
  matched?: boolean;
  taskId?: string;
}

const KEY = 'miki_outcome_predictions_v1';
const MAX_RECORDS = 500;
const MIN_BASIS_SAMPLES = 3;

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
    const createdAt = Date.now();
    const record: OutcomePredictionRecord = {
      predictionId: `PRED-${canonicalSha256(`${input.planKey}:${createdAt}:${this.records.length}`).slice(0, 16)}`,
      planKey: input.planKey,
      goalHash: canonicalSha256(input.goal),
      predicted: rate > 0.5 ? 'SUCCESS' : 'FAILURE',
      basisSamples: history.length,
      basisSuccessRate: rate,
      createdAt,
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
  } {
    const resolved = this.records.filter(
      record =>
        record.resolvedAt &&
        (record.observed === 'SUCCESS' || record.observed === 'FAILURE') &&
        (!planKey || record.planKey === planKey)
    );
    const matched = resolved.filter(record => record.matched).length;
    return {
      samples: resolved.length,
      matched,
      mismatched: resolved.length - matched,
      accuracy: resolved.length ? matched / resolved.length : null,
    };
  }
}

export const outcomePredictionService = new OutcomePredictionService();
