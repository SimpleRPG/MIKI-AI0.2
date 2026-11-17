import {
  analyzeImagePixels,
  hypothesizeMaterial,
  type ImagePixelFeatures,
  type MaterialHypothesis,
} from './conversationImageObservationService';

/**
 * P924: 目・第2段＋描く・第1段「描いて照合する」。
 *
 * 設計メモの学習ループの検証段：素材仮説（P923）のパラメータで
 * 自分で描き（決定論の手続き描画）、描いた側からも同じ特徴量を
 * 測って、元の測定と数値で照合する。言い換えの意味保存チェック
 * の画像版。照合が通った描き方だけが部品化の候補になる（部品化
 * 自体は次段）。描画はピクセル列への純粋関数で、端末の Canvas
 * 実装に依存しない。
 */

export interface MaterialRenderParams {
  /** 0..1 の平均輝度（色ではなく質感の照合が目的なので無彩色で描く） */
  baseLuma: number;
  roughness: number;
  patternPeriod: number | null;
  softGradient: boolean;
}

export interface MaterialVerification {
  verified: boolean;
  score: number;
  hypothesis: MaterialHypothesis;
  renderedHypothesis: MaterialHypothesis;
  checks: {
    glossMatch: boolean;
    patternMatch: boolean;
    gradientMatch: boolean;
    edgeDensityDiff: number;
  };
}

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/**
 * 素材パラメータから見本（スウォッチ）を描く決定論の描画。
 * - 粗さが小さいほどハイライトは小さく鋭く、大きいほど広く鈍い
 * - 周期があれば明暗の繰り返し模様を描く
 * - softGradient なら横方向になめらかな明暗の移ろいを付ける
 */
export function renderMaterialSwatch(
  params: MaterialRenderParams,
  size = 48,
): { rgba: Uint8Array; width: number; height: number } {
  const rgba = new Uint8Array(size * size * 4);
  const base = Math.max(0.15, Math.min(0.6, params.baseLuma)) * 255;
  const cx = size * 0.46;
  const cy = size * 0.46;
  // ハイライトの形：粗さが小さいほど核のある小さな反射（中心は
  // ほぼ白、縁で落ちる）、粗さ 0.6 以上では核は消えて広く薄い
  // 明るみに変わる。測定側の「集中度」が分かれる形にしてある。
  const coreRadius = (1 - params.roughness) * 3;
  const fullRadius = coreRadius + 1 + params.roughness * 8;
  const glowPeak = (255 - base) * 0.25 * Math.max(0, 1 - params.roughness);
  const glowSigma = size * 0.24;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = base;
      if (params.patternPeriod !== null && params.patternPeriod >= 2) {
        const phase = x % params.patternPeriod;
        v *= phase < params.patternPeriod / 2 ? 0.72 : 1.18;
      }
      if (params.softGradient) {
        v *= 0.78 + 0.44 * (x / Math.max(1, size - 1));
      }
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (params.roughness < 0.6) {
        if (d <= coreRadius) {
          v = 254;
        } else if (d < fullRadius) {
          const t = (d - coreRadius) / Math.max(1, fullRadius - coreRadius);
          v = v + (254 - v) * (1 - t) * (1 - t);
        }
      } else {
        const falloff = Math.exp(-(d * d) / (2 * glowSigma * glowSigma));
        v += glowPeak * falloff;
      }
      const i = (y * size + x) * 4;
      const c = clamp255(v);
      rgba[i] = c;
      rgba[i + 1] = c;
      rgba[i + 2] = c;
      rgba[i + 3] = 255;
    }
  }
  return { rgba, width: size, height: size };
}

/**
 * 元画像の測定から立てた仮説で描き直し、描いた側の測定と照合する。
 * 3つの質感判定（ツヤ・周期・なめらかさ）がすべて一致したら
 * 「描いて再現できた」として verified にする。
 */
export function verifyMaterialByRendering(features: ImagePixelFeatures): MaterialVerification {
  const hypothesis = hypothesizeMaterial(features);
  const swatch = renderMaterialSwatch({
    baseLuma: features.meanLuma,
    roughness: hypothesis.roughness,
    patternPeriod: hypothesis.patternPeriod,
    softGradient: hypothesis.softGradient,
  });
  const renderedFeatures = analyzeImagePixels(swatch.rgba, swatch.width, swatch.height);
  const renderedHypothesis = hypothesizeMaterial(renderedFeatures);
  const checks = {
    glossMatch: renderedHypothesis.gloss === hypothesis.gloss,
    patternMatch: renderedHypothesis.patternPeriod === hypothesis.patternPeriod,
    gradientMatch: renderedHypothesis.softGradient === hypothesis.softGradient,
    edgeDensityDiff: Math.abs(renderedFeatures.edgeDensity - features.edgeDensity),
  };
  const matched = [checks.glossMatch, checks.patternMatch, checks.gradientMatch]
    .filter(Boolean).length;
  return {
    verified: matched === 3,
    score: matched / 3,
    hypothesis,
    renderedHypothesis,
    checks,
  };
}
