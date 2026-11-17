import { storageService } from '../../../services/storageService';
import {
  analyzeImagePixels,
  type ImagePixelFeatures,
  type ImageRegionFeature,
} from './conversationImageObservationService';
import { compareRegionShape, renderRegionShape } from './shapeRenderVerificationService';

/**
 * P929: 目・第6段「配置の同定」。
 *
 * 物や人は1つの形ではなく、複数の領域の並び（配置）でできて
 * いる。ここでは見本を「最大3つの領域＋最大領域からの相対位置
 * と大きさの比」として記録し、並びが似た場面を名前で呼べる
 * ようにする。登録の門は P927 と同じ描き直し照合（各領域が
 * 描いて再現できること）。人間への入口はこの配置の層。
 */

export interface SceneRegionSignature {
  shape: string;
  colorName: string;
  /** 最大領域の重心からの相対位置（画像幅・高さに対する比） */
  relDx: number;
  relDy: number;
  /** 最大領域の面積に対する比 */
  shareRatio: number;
  elongation: number;
  circularity: number;
}

export interface VisualScenePattern {
  name: string;
  regions: SceneRegionSignature[];
  at: number;
}

const KEY = 'miki_visual_scene_patterns_v1';
const MATCH_THRESHOLD = 0.7;

function sceneCandidates(features: ImagePixelFeatures): ImageRegionFeature[] {
  return features.regions
    .filter((r) => r.borderTouch < 0.9)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);
}

function toSignatures(regions: ImageRegionFeature[]): SceneRegionSignature[] {
  const main = regions[0];
  return regions.map((r) => ({
    shape: r.shape,
    colorName: r.colorName,
    relDx: r.centroidX - main.centroidX,
    relDy: r.centroidY - main.centroidY,
    shareRatio: r.share / Math.max(0.001, main.share),
    elongation: r.elongation,
    circularity: r.circularity,
  }));
}

class VisualScenePatternService {
  private load(): VisualScenePattern[] {
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as VisualScenePattern[];
      }
    } catch { /* fall through */ }
    return [];
  }

  private save(patterns: VisualScenePattern[]): void {
    try {
      storageService.setItem(KEY, JSON.stringify(patterns));
    } catch { /* 保存できなくても本流は止めない */ }
  }

  /**
   * 配置の見本を登録する。領域が2つ以上あり、各領域が描き直し
   * 照合を通ったときだけ登録する。
   */
  public registerScene(name: string, features: ImagePixelFeatures): VisualScenePattern | null {
    const regions = sceneCandidates(features);
    if (regions.length < 2) return null;
    for (const region of regions) {
      const swatch = renderRegionShape(region);
      const rendered = analyzeImagePixels(swatch.rgba, swatch.width, swatch.height);
      const renderedRegion = rendered.regions.find((r) => r.colorName === '赤');
      if (!renderedRegion || !compareRegionShape(region, renderedRegion)) return null;
    }
    const pattern: VisualScenePattern = {
      name,
      regions: toSignatures(regions),
      at: Date.now(),
    };
    const patterns = this.load().filter((p) => p.name !== name);
    patterns.push(pattern);
    this.save(patterns);
    return pattern;
  }

  public list(): VisualScenePattern[] {
    return this.load();
  }

  /** 場面と見本の配置を比べ、最も似ている名前を返す。 */
  public matchScene(features: ImagePixelFeatures): { name: string; score: number } | null {
    const regions = sceneCandidates(features);
    if (regions.length < 2) return null;
    const signatures = toSignatures(regions);
    let best: { name: string; score: number } | null = null;
    for (const pattern of this.load()) {
      const used = new Set<number>();
      let total = 0;
      for (const expected of pattern.regions) {
        let pairScore = 0;
        let pairIndex = -1;
        for (let i = 0; i < signatures.length; i++) {
          if (used.has(i)) continue;
          const actual = signatures[i];
          let s = 1;
          if (expected.shape !== actual.shape) s -= 0.45;
          if (expected.colorName !== actual.colorName) s -= 0.15;
          s -= (Math.abs(expected.relDx - actual.relDx) + Math.abs(expected.relDy - actual.relDy)) * 0.8;
          s -= Math.abs(expected.shareRatio - actual.shareRatio) * 0.3;
          s -= (Math.abs(expected.elongation - actual.elongation) / 3) * 0.15;
          s -= Math.abs(expected.circularity - actual.circularity) * 0.15;
          s = Math.max(0, s);
          if (s > pairScore) {
            pairScore = s;
            pairIndex = i;
          }
        }
        if (pairIndex >= 0) used.add(pairIndex);
        total += pairScore;
      }
      const score = total / Math.max(1, pattern.regions.length);
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { name: pattern.name, score };
      }
    }
    return best;
  }

  public summary(): { scenes: number } {
    return { scenes: this.load().length };
  }
}

export const visualScenePatternService = new VisualScenePatternService();
