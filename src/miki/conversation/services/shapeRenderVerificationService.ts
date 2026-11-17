import {
  analyzeImagePixels,
  type ImagePixelFeatures,
  type ImageRegionFeature,
} from './conversationImageObservationService';

/**
 * P927: 目・第4段＋描く・第2段「形を描いて照合する」。
 *
 * P924 の素材版と同じ型を形にも適用する：測った領域（位置・
 * 大きさ・形の印象）を自分の描画で再現し、描いた側を同じ物差し
 * で測って、位置・大きさ・形ラベルが一致するか照合する。一致
 * した形の読みだけが、次の「同定」の土台として信用できる。
 * いびつな形は楕円で近似して描く（近似であることは照合の数値に
 * 現れる）。
 */

export interface ShapeVerification {
  verified: boolean;
  score: number;
  regions: Array<{
    target: ImageRegionFeature;
    rendered: ImageRegionFeature | null;
    match: boolean;
  }>;
}

const SHAPE_COLOR: [number, number, number] = [200, 40, 40];
const BG_COLOR: [number, number, number] = [15, 15, 15];

/** 領域1つを、測った位置と外接矩形で描き直す（赤 on 黒）。 */
export function renderRegionShape(
  region: ImageRegionFeature,
  size = 48,
): { rgba: Uint8Array; width: number; height: number } {
  const rgba = new Uint8Array(size * size * 4);
  const cx = region.centroidX * (size - 1);
  const cy = region.centroidY * (size - 1);
  const halfW = Math.max(1, (region.bboxWidth * size) / 2);
  const halfH = Math.max(1, (region.bboxHeight * size) / 2);
  const ellipse = region.shape === '丸に近い' || region.shape === 'いびつな形';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / halfW;
      const dy = (y - cy) / halfH;
      const inside = ellipse
        ? dx * dx + dy * dy <= 1
        : Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      const [r, g, b] = inside ? SHAPE_COLOR : BG_COLOR;
      const i = (y * size + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return { rgba, width: size, height: size };
}

/** 測った領域と描き直した領域が「同じ形の読み」か比べる。 */
export function compareRegionShape(
  target: ImageRegionFeature,
  rendered: ImageRegionFeature,
): boolean {
  if (target.shape !== rendered.shape) return false;
  const centroidDistance = Math.hypot(
    target.centroidX - rendered.centroidX,
    target.centroidY - rendered.centroidY,
  );
  if (centroidDistance > 0.09) return false;
  const shareRatio = rendered.share / Math.max(0.001, target.share);
  if (shareRatio < 0.6 || shareRatio > 1.5) return false;
  return true;
}

/**
 * 主な「物」候補（縁をぐるりと囲まない最大の領域）を描き直して
 * 照合する。地の側の領域は形として描き直す対象にしない。
 */
export function verifyShapesByRendering(features: ImagePixelFeatures): ShapeVerification {
  const candidates = features.regions.filter((r) => r.borderTouch < 0.9);
  // 「地」は他の領域を外接矩形に含む側なので、含む側を避けて
  // 最も大きい「物」候補を選ぶ。
  const containsOther = (r: ImageRegionFeature): boolean => {
    const minX = r.centroidX - r.bboxWidth / 2;
    const maxX = r.centroidX + r.bboxWidth / 2;
    const minY = r.centroidY - r.bboxHeight / 2;
    const maxY = r.centroidY + r.bboxHeight / 2;
    return candidates.some((o) => o !== r
      && o.centroidX >= minX && o.centroidX <= maxX
      && o.centroidY >= minY && o.centroidY <= maxY);
  };
  const main = candidates.find((r) => !containsOther(r)) || candidates[0];
  const targets = main ? [main] : [];
  const regions = targets.map((target) => {
    const swatch = renderRegionShape(target);
    const renderedFeatures = analyzeImagePixels(swatch.rgba, swatch.width, swatch.height);
    const rendered = renderedFeatures.regions.find((r) => r.colorName === '赤')
      || renderedFeatures.regions[0]
      || null;
    return {
      target,
      rendered,
      match: rendered ? compareRegionShape(target, rendered) : false,
    };
  });
  const matched = regions.filter((r) => r.match).length;
  return {
    verified: regions.length > 0 && matched === regions.length,
    score: regions.length ? matched / regions.length : 0,
    regions,
  };
}
