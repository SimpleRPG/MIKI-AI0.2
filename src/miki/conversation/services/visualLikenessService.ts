/**
 * P1110: 見た目の物差し（知覚プロファイル）。
 *
 * 寸法の照合（bodyProfile）は「測って合う」ことしか見ない。
 * こちらは見え方に相関する量を測る：輪郭の柔らかさ
 * （隣接画素の色差がなだらかな遷移か、硬い段差か）と、
 * 真っ黒な平坦色の割合。P1107（腕の縁）と P1108（顔の印象）で
 * 手で数えて効いた物差しを、見本と描き直しで同じ土俵で
 * 比べられる形にしたもの。比較の符号つき差分は、将来ドリルが
 * 「見た目も見本に寄せる」ための入力になる。
 */

export interface PerceptualProfile {
  softTransitions: number;
  hardEdges: number;
  /** 柔らかい遷移 ÷（柔らかい遷移＋硬い段差）。1に近いほど輪郭がなだらか */
  softRatio: number;
  /** 輝度40未満の画素の割合（真っ黒な平坦色の多さ） */
  darkFlatShare: number;
  pixels: number;
}

export interface PerceptualDiff {
  softRatio: number;
  darkFlatShare: number;
  hardEdges: number;
}

const diffOf = (a: Uint8Array, i: number, b: Uint8Array, j: number): number =>
  (Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2])) / 3;

class VisualLikenessService {
  public perceptualProfile(
    rgba: Uint8Array,
    width: number,
    height: number,
    region?: { x0: number; y0: number; x1: number; y1: number },
  ): PerceptualProfile {
    const x0 = Math.max(0, region?.x0 ?? 0);
    const y0 = Math.max(0, region?.y0 ?? 0);
    const x1 = Math.min(width - 1, region?.x1 ?? width - 1);
    const y1 = Math.min(height - 1, region?.y1 ?? height - 1);
    let soft = 0;
    let hard = 0;
    let dark = 0;
    let pixels = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * width + x) * 4;
        pixels++;
        const lum = rgba[i] * 0.3 + rgba[i + 1] * 0.59 + rgba[i + 2] * 0.11;
        if (lum < 40) dark++;
        if (x < x1) {
          const d = diffOf(rgba, i, rgba, i + 4);
          if (d >= 2 && d <= 20) soft++;
          else if (d > 20) hard++;
        }
        if (y < y1) {
          const d = diffOf(rgba, i, rgba, i + width * 4);
          if (d >= 2 && d <= 20) soft++;
          else if (d > 20) hard++;
        }
      }
    }
    return {
      softTransitions: soft,
      hardEdges: hard,
      softRatio: soft + hard > 0 ? soft / (soft + hard) : 0,
      darkFlatShare: pixels > 0 ? dark / pixels : 0,
      pixels,
    };
  }

  /** b − a の符号つき差分（描き直し b を見本 a に寄せる向き） */
  public comparePerceptual(a: PerceptualProfile, b: PerceptualProfile): PerceptualDiff {
    return {
      softRatio: b.softRatio - a.softRatio,
      darkFlatShare: b.darkFlatShare - a.darkFlatShare,
      hardEdges: b.hardEdges - a.hardEdges,
    };
  }

  /** 頭の切り出し（顔の読みと同じ倍率）に対応する画素の箱。
   * P1124: 中心 x は幅比、中心 y と半径は高さ比（headRh は高さ比で
   * 測る決まり）で別々に換算する。以前は最大辺で全部を換算して
   * いたため、縦長の見本（128×256）では中心 x がずれて頭部の
   * 知覚比較が額面通り読めなかった。 */
  public headRegion(reading: { head: { x: number; y: number; r: number } | null; headRh?: number | null }, width: number, height: number = width): { x0: number; y0: number; x1: number; y1: number } | null {
    if (!reading.head) return null;
    const hr = (reading.headRh ?? reading.head.r) * height * 1.7;
    const cx = reading.head.x * (width - 1);
    const cy = reading.head.y * (height - 1);
    return {
      x0: Math.round(cx - hr),
      y0: Math.round(cy - hr),
      x1: Math.round(cx + hr),
      y1: Math.round(cy + hr),
    };
  }
}

export const visualLikenessService = new VisualLikenessService();
