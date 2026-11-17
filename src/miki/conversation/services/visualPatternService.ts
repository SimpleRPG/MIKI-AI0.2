import { storageService } from '../../../services/storageService';
import type { ImagePixelFeatures } from './conversationImageObservationService';
import { selectMainObjectRegion, verifyShapesByRendering } from './shapeRenderVerificationService';

/**
 * P928: 目・第5段「見本からの同定」。
 *
 * 同定は「描いて再現できた」形の読みを、名前つきの見本として
 * 記録し、次に似た形が来たら名前で呼ぶ仕組み。見本は測った
 * 領域の特徴量（形ラベル・細長さ・充填率・円形度・対称・色・
 * 大きさ）で、登録は描き直し照合が通ったものだけ（検証の刻印）。
 * 照合は重みつき距離で、形ラベルの一致を強く見る。似ていない
 * ものには名前を付けない（0.7 未満は null）。
 */

export interface VisualPattern {
  name: string;
  shape: string;
  colorName: string;
  elongation: number;
  fillRatio: number;
  circularity: number;
  symmetry: number;
  share: number;
  regionCount: number;
  at: number;
}

export interface VisualMatch {
  name: string;
  score: number;
}

const KEY = 'miki_visual_patterns_v1';
const MATCH_THRESHOLD = 0.7;

class VisualPatternService {
  private load(): VisualPattern[] {
    try {
      const raw = storageService.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as VisualPattern[];
      }
    } catch { /* fall through */ }
    return [];
  }

  private save(patterns: VisualPattern[]): void {
    try {
      storageService.setItem(KEY, JSON.stringify(patterns));
    } catch { /* 保存できなくても本流は止めない */ }
  }

  /**
   * 見本を登録する。描き直し照合が通っていない測定は登録しない
   * （検証を通った読みだけが名前を持つ）。
   */
  public register(name: string, features: ImagePixelFeatures): VisualPattern | null {
    const main = selectMainObjectRegion(features);
    if (!main) return null;
    const verification = verifyShapesByRendering(features);
    if (!verification.verified) return null;
    const pattern: VisualPattern = {
      name,
      shape: main.shape,
      colorName: main.colorName,
      elongation: main.elongation,
      fillRatio: main.fillRatio,
      circularity: main.circularity,
      symmetry: main.symmetry,
      share: main.share,
      regionCount: features.regions.length,
      at: Date.now(),
    };
    const patterns = this.load().filter((p) => p.name !== name);
    patterns.push(pattern);
    this.save(patterns);
    return pattern;
  }

  public list(): VisualPattern[] {
    return this.load();
  }

  /** 新しい測定と見本を比べ、最も似ている名前を返す（似ていなければ null）。 */
  public match(features: ImagePixelFeatures): VisualMatch | null {
    const main = selectMainObjectRegion(features);
    if (!main) return null;
    let best: VisualMatch | null = null;
    for (const pattern of this.load()) {
      let score = 1;
      if (pattern.shape !== main.shape) score -= 0.45;
      if (pattern.colorName !== main.colorName) score -= 0.15;
      score -= (Math.abs(pattern.elongation - main.elongation) / 3) * 0.25;
      score -= Math.abs(pattern.fillRatio - main.fillRatio) * 0.2;
      score -= Math.abs(pattern.circularity - main.circularity) * 0.2;
      score -= Math.abs(pattern.symmetry - main.symmetry) * 0.15;
      score -= Math.abs(pattern.share - main.share) * 0.1;
      score = Math.max(0, Math.min(1, score));
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { name: pattern.name, score };
      }
    }
    return best;
  }

  public summary(): { patterns: number } {
    return { patterns: this.load().length };
  }
}

export const visualPatternService = new VisualPatternService();
