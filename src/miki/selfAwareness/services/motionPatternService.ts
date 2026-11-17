import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P941: 動作学習（第1段）。
 *
 * アバター設計メモ（2026-11-17）の「動きも学習対象にする」に沿う
 * 測定→仮説（パラメータ化）→再現→照合→部品化のループ。質感の
 * 学習（P923〜）の動き版で、入力は重心の軌跡（正規化座標 0..1 の
 * 時系列）。動画理解の層3「動きの記述」が将来この入力になる。
 *
 * 第1段で扱えるのは周期運動と単純な動き（横揺れ・縦跳ね・円回り・
 * 一方向の移動・静止）。パラメータ化できない不規則な動きは、正直に
 * 「まだ覚えられない」として部品にしない。照合は特徴量の一致と、
 * 位相を合わせた再現軌跡との誤差の両方で見る。
 */

const STORAGE_KEY = 'miki_motion_patterns_v1';
const MAX_PATTERNS = 30;
const MIN_SAMPLES = 8;
const MIN_DURATION_MS = 200;
const VERIFY_RMSE_LIMIT = 0.45;
const VERIFY_SIMILARITY = 0.7;
const MATCH_THRESHOLD = 0.7;

export interface MotionSample {
  t: number;
  x: number;
  y: number;
}

export type MotionKind = 'STILL' | 'SWAY' | 'BOUNCE' | 'CIRCLE' | 'DRIFT' | 'IRREGULAR';

export interface MotionFeatures {
  durationMs: number;
  sampleCount: number;
  centerX: number;
  centerY: number;
  rangeX: number;
  rangeY: number;
  cyclesX: number;
  cyclesY: number;
  periodMs: number;
  tempoPerSec: number;
  amplitude: number;
  dispX: number;
  dispY: number;
  kind: MotionKind;
}

export interface MotionPatternRecord {
  name: string;
  kind: MotionKind;
  periodMs: number;
  tempoPerSec: number;
  amplitude: number;
  centerX: number;
  centerY: number;
  rangeX: number;
  rangeY: number;
  similarity: number;
  learnedAt: number;
}

export interface MotionLearnResult {
  ok: boolean;
  reason?: string;
  features?: MotionFeatures;
  similarity?: number;
  record?: MotionPatternRecord;
}

const KIND_LABELS: Record<MotionKind, string> = {
  STILL: '静止',
  SWAY: '横揺れ',
  BOUNCE: '縦跳ね',
  CIRCLE: '円回り',
  DRIFT: '一方向の移動',
  IRREGULAR: '不規則な動き',
};

class MotionPatternService {
  /** 軌跡の測定。測れない入力（サンプル不足など）は null。 */
  public measure(samples: MotionSample[]): MotionFeatures | null {
    if (!Array.isArray(samples) || samples.length < MIN_SAMPLES) return null;
    const sorted = [...samples]
      .filter((s) => Number.isFinite(s?.t) && Number.isFinite(s?.x) && Number.isFinite(s?.y))
      .sort((a, b) => a.t - b.t);
    if (sorted.length < MIN_SAMPLES) return null;
    const durationMs = sorted[sorted.length - 1].t - sorted[0].t;
    if (durationMs < MIN_DURATION_MS) return null;

    const xs = sorted.map((s) => s.x);
    const ys = sorted.map((s) => s.y);
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    const centerX = mean(xs);
    const centerY = mean(ys);
    const rangeX = Math.max(...xs) - Math.min(...xs);
    const rangeY = Math.max(...ys) - Math.min(...ys);
    const periodX = this.estimatePeriod(sorted.map((s) => s.t), xs, centerX, rangeX);
    const periodY = this.estimatePeriod(sorted.map((s) => s.t), ys, centerY, rangeY);
    const cyclesX = periodX > 0 ? durationMs / periodX : this.countCycles(xs, centerX);
    const cyclesY = periodY > 0 ? durationMs / periodY : this.countCycles(ys, centerY);
    const dispX = xs[xs.length - 1] - xs[0];
    const dispY = ys[ys.length - 1] - ys[0];

    const kind = this.classify(sorted, { rangeX, rangeY, cyclesX, cyclesY, dispX, dispY });
    let periodMs = 0;
    if (kind === 'CIRCLE' && periodX > 0 && periodY > 0) periodMs = Math.round((periodX + periodY) / 2);
    else if (rangeX >= rangeY && periodX > 0) periodMs = Math.round(periodX);
    else if (rangeY > rangeX && periodY > 0) periodMs = Math.round(periodY);
    else if (periodX > 0) periodMs = Math.round(periodX);
    else if (periodY > 0) periodMs = Math.round(periodY);
    else {
      const dominantCycles = Math.max(cyclesX, cyclesY);
      periodMs = dominantCycles >= 1 ? Math.round(durationMs / dominantCycles) : 0;
    }
    const amplitude = kind === 'CIRCLE'
      ? (rangeX + rangeY) / 4
      : Math.max(rangeX, rangeY) / 2;
    return {
      durationMs,
      sampleCount: sorted.length,
      centerX: round3(centerX),
      centerY: round3(centerY),
      rangeX: round3(rangeX),
      rangeY: round3(rangeY),
      cyclesX: round2(cyclesX),
      cyclesY: round2(cyclesY),
      periodMs,
      tempoPerSec: periodMs > 0 ? round2(1000 / periodMs) : 0,
      amplitude: round3(amplitude),
      dispX: round3(dispX),
      dispY: round3(dispY),
      kind,
    };
  }

  /**
   * 周期の推定。山と谷の間隔から読む（3点平滑化つき）。
   * 平均またぎの数え方より、途中で終わる周期や位相のずれに強い。
   * 山・谷が1つずつしか無ければ、その間隔の2倍を周期とみなす。
   */
  private estimatePeriod(times: number[], values: number[], center: number, range: number): number {
    if (range <= 0 || values.length < 5) return 0;
    const s = values.map((v, i) => {
      const prev = values[Math.max(0, i - 1)];
      const next = values[Math.min(values.length - 1, i + 1)];
      return (prev + v + next) / 3;
    });
    const amp = range / 2;
    const peaks: number[] = [];
    const troughs: number[] = [];
    for (let i = 1; i < s.length - 1; i++) {
      if (s[i] > s[i - 1] && s[i] >= s[i + 1] && s[i] > center + 0.3 * amp) peaks.push(times[i]);
      if (s[i] < s[i - 1] && s[i] <= s[i + 1] && s[i] < center - 0.3 * amp) troughs.push(times[i]);
    }
    const estimates: number[] = [];
    if (peaks.length >= 2) estimates.push((peaks[peaks.length - 1] - peaks[0]) / (peaks.length - 1));
    if (troughs.length >= 2) estimates.push((troughs[troughs.length - 1] - troughs[0]) / (troughs.length - 1));
    if (!estimates.length && peaks.length === 1 && troughs.length === 1) {
      estimates.push(2 * Math.abs(peaks[0] - troughs[0]));
    }
    if (!estimates.length) return 0;
    return estimates.reduce((a, b) => a + b, 0) / estimates.length;
  }

  /** 平均をまたぐ回数から周期の数を数える（符号が続く間は数えない）。 */
  private countCycles(values: number[], center: number): number {
    let crossings = 0;
    let lastSign = 0;
    for (const v of values) {
      const d = v - center;
      const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (sign !== 0) {
        if (lastSign !== 0 && sign !== lastSign) crossings++;
        lastSign = sign;
      }
    }
    return crossings / 2;
  }

  /** 2階差分の荒さ。滑らかな周期運動では小さく、雑音では大きくなる。 */
  private roughness(values: number[], center: number, amplitude: number): number {
    if (values.length < 3 || amplitude <= 0) return 0;
    let sum = 0;
    for (let i = 1; i < values.length - 1; i++) {
      sum += Math.abs(values[i - 1] - 2 * values[i] + values[i + 1]);
    }
    return (sum / (values.length - 2)) / (2 * amplitude);
  }

  private classify(
    sorted: MotionSample[],
    m: { rangeX: number; rangeY: number; cyclesX: number; cyclesY: number; dispX: number; dispY: number },
  ): MotionKind {
    const maxRange = Math.max(m.rangeX, m.rangeY);
    if (maxRange < 0.01) return 'STILL';
    const xs = sorted.map((s) => s.x);
    const ys = sorted.map((s) => s.y);
    const roughX = this.roughness(xs, meanOf(xs), m.rangeX / 2);
    const roughY = this.roughness(ys, meanOf(ys), m.rangeY / 2);
    const dominantRough = m.rangeX >= m.rangeY ? roughX : roughY;
    if (dominantRough > 0.5) return 'IRREGULAR';
    const cyclesDominant = Math.max(m.cyclesX, m.cyclesY);
    if (m.cyclesX >= 1.5 && m.cyclesY >= 1.5) {
      const ratio = Math.min(m.rangeX, m.rangeY) / Math.max(m.rangeX, m.rangeY);
      if (ratio >= 0.4) return 'CIRCLE';
    }
    if (cyclesDominant >= 1.5) return m.rangeX >= m.rangeY ? 'SWAY' : 'BOUNCE';
    const dispDominant = m.rangeX >= m.rangeY ? Math.abs(m.dispX) : Math.abs(m.dispY);
    if (maxRange >= 0.05 && dispDominant >= 0.6 * maxRange) return 'DRIFT';
    return 'IRREGULAR';
  }

  /** パラメータから軌跡を再現する（照合用）。位相は phaseRad でずらせる。 */
  public reproduce(features: MotionFeatures, times: number[], phaseRad = 0): MotionSample[] {
    const t0 = times[0] || 0;
    const omega = features.periodMs > 0 ? (2 * Math.PI) / features.periodMs : 0;
    return times.map((t) => {
      const phase = omega * (t - t0) + phaseRad;
      let x = features.centerX;
      let y = features.centerY;
      switch (features.kind) {
        case 'SWAY':
          x = features.centerX + features.amplitude * Math.sin(phase);
          break;
        case 'BOUNCE':
          y = features.centerY + features.amplitude * Math.sin(phase);
          break;
        case 'CIRCLE':
          x = features.centerX + (features.rangeX / 2) * Math.sin(phase);
          y = features.centerY + (features.rangeY / 2) * Math.cos(phase);
          break;
        case 'DRIFT': {
          const ratio = features.durationMs > 0 ? (t - t0) / features.durationMs : 0;
          x = features.centerX + features.dispX * (ratio - 0.5);
          y = features.centerY + features.dispY * (ratio - 0.5);
          break;
        }
        default:
          break; // STILL は中心のまま
      }
      return { t, x, y };
    });
  }

  /** 特徴量同士の近さ（0..1）。種類が違えば 0。 */
  private featureSimilarity(a: MotionFeatures, b: MotionFeatures): number {
    if (a.kind !== b.kind) return 0;
    let score = 1;
    if (a.periodMs > 0 && b.periodMs > 0) {
      score -= 0.4 * Math.min(1, Math.abs(a.periodMs - b.periodMs) / a.periodMs);
    }
    const ampErr = Math.abs(a.amplitude - b.amplitude) / Math.max(a.amplitude, b.amplitude, 0.02);
    score -= 0.4 * Math.min(1, ampErr);
    const centerDist = Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
    score -= 0.2 * Math.min(1, centerDist * 5);
    return Math.max(0, round2(score));
  }

  /** 位相を合わせて再現軌跡と実測軌跡の誤差を見る（振幅で正規化）。 */
  private bestPhaseRmse(features: MotionFeatures, samples: MotionSample[]): number {
    const sorted = [...samples].sort((a, b) => a.t - b.t);
    const times = sorted.map((s) => s.t);
    const denom = Math.max(features.amplitude, 0.02);
    const rmseFor = (phase: number) => {
      const repro = this.reproduce(features, times, phase);
      let sum = 0;
      for (let i = 0; i < sorted.length; i++) {
        const dx = sorted[i].x - repro[i].x;
        const dy = sorted[i].y - repro[i].y;
        sum += features.kind === 'CIRCLE' || features.kind === 'DRIFT'
          ? dx * dx + dy * dy
          : (features.kind === 'BOUNCE' ? dy * dy : dx * dx);
      }
      return Math.sqrt(sum / sorted.length) / denom;
    };
    if (features.periodMs <= 0) return rmseFor(0);
    let best = Infinity;
    for (let i = 0; i < 24; i++) {
      best = Math.min(best, rmseFor((i / 24) * 2 * Math.PI));
    }
    return best;
  }

  /**
   * 動きを1つ覚える。測定→パラメータ化→再現→照合を通ったものだけ
   * 「動作部品」として台帳に残す。
   */
  public learn(name: string, samples: MotionSample[], now = Date.now()): MotionLearnResult {
    const label = String(name || '').trim();
    if (!label) return { ok: false, reason: '名前がない' };
    const features = this.measure(samples);
    if (!features) return { ok: false, reason: 'サンプルが足りなくて測れない' };
    if (features.kind === 'IRREGULAR') {
      return { ok: false, reason: '不規則でパラメータ化できない', features };
    }
    const sorted = [...samples].sort((a, b) => a.t - b.t);
    const reproduced = this.reproduce(features, sorted.map((s) => s.t));
    const remeasured = this.measure(reproduced);
    if (!remeasured) return { ok: false, reason: '再現を測り直せない', features };
    const featureScore = this.featureSimilarity(features, remeasured);
    const rmse = this.bestPhaseRmse(features, sorted);
    const similarity = round2(Math.max(0, 0.5 * featureScore + 0.5 * (1 - Math.min(1, rmse))));
    if (featureScore <= 0 || rmse > VERIFY_RMSE_LIMIT || similarity < VERIFY_SIMILARITY) {
      return { ok: false, reason: '再現と照合が合わない', features, similarity };
    }
    const record: MotionPatternRecord = {
      name: label,
      kind: features.kind,
      periodMs: features.periodMs,
      tempoPerSec: features.tempoPerSec,
      amplitude: features.amplitude,
      centerX: features.centerX,
      centerY: features.centerY,
      rangeX: features.rangeX,
      rangeY: features.rangeY,
      similarity,
      learnedAt: now,
    };
    const patterns = this.loadPatterns().filter((p) => p.name !== label);
    patterns.push(record);
    storageService.setItem(STORAGE_KEY, JSON.stringify(patterns.slice(-MAX_PATTERNS)));
    systemLogger.info('SYSTEM', `🕺 [動作学習] 「${label}」を${KIND_LABELS[features.kind]}として覚えた（類似度 ${similarity}）`);
    return { ok: true, features, similarity, record };
  }

  /** 覚えた動きの中から、この軌跡に一番近いものを同定する。 */
  public match(samples: MotionSample[]): { name: string; kind: MotionKind; score: number } | null {
    const features = this.measure(samples);
    if (!features || features.kind === 'IRREGULAR') return null;
    let best: { name: string; kind: MotionKind; score: number } | null = null;
    for (const p of this.loadPatterns()) {
      if (p.kind !== features.kind) continue;
      const asFeatures = { ...features, periodMs: p.periodMs, amplitude: p.amplitude, centerX: p.centerX, centerY: p.centerY };
      const score = this.featureSimilarity(features, asFeatures as MotionFeatures);
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { name: p.name, kind: p.kind, score };
      }
    }
    return best;
  }

  /** 測定結果を言葉にする（動画の動きの記述の受け口）。 */
  public describe(samples: MotionSample[]): string | null {
    const f = this.measure(samples);
    if (!f) return null;
    if (f.kind === 'STILL') return 'ほとんど動いていない。';
    if (f.kind === 'IRREGULAR') return '動きはあるけど、周期のない不規則な動き。';
    if (f.kind === 'DRIFT') return '一方向へ移動している。';
    const periodText = f.periodMs >= 1000
      ? `約${round2(f.periodMs / 1000)}秒周期`
      : `約${f.periodMs}ミリ秒周期`;
    return `${KIND_LABELS[f.kind]}の動き。${periodText}で繰り返している。`;
  }

  private loadPatterns(): MotionPatternRecord[] {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  public list(): MotionPatternRecord[] {
    return this.loadPatterns();
  }

  public summary(): { patterns: number } {
    return { patterns: this.loadPatterns().length };
  }
}

function meanOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export const motionPatternService = new MotionPatternService();
