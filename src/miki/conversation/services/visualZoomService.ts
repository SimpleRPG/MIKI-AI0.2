import { storageService } from '../../../services/storageService';
import { analyzeImagePixels, type ImagePixelFeatures } from './conversationImageObservationService';

/**
 * P953: 拡大測定の土台（2段構えの目の第1段）。
 *
 * 全体像は最大48pxに縮小して測るため、頭のような小さい
 * 部分は9pxほどしかなく、顔の中身は画素以下になる。
 * そこで、全体を粗く測って注目先（頭など）を決めたら、
 * 元の解像度の画素からその範囲だけを切り出して48pxに
 * 伸ばし、測り直す。これが表情と手・指の前提になる。
 * 切り出しは正方形で、画像の端では内側へ寄せる。
 */

const KEY = 'miki_visual_zooms_v1';
const OUT = 48;

export interface ZoomResult {
  /** 元画像での切り出し範囲（px） */
  crop: { x: number; y: number; side: number };
  /** 拡大率（48 ÷ 切り出しの一辺） */
  scale: number;
  features: ImagePixelFeatures;
}

class VisualZoomService {
  private load(): { analyzed: number } {
    try {
      const raw = storageService.getJson(KEY, null) as { analyzed?: number } | null;
      if (raw) return { analyzed: raw.analyzed || 0 };
    } catch { /* fall through */ }
    return { analyzed: 0 };
  }

  public summary(): { analyzed: number } {
    return this.load();
  }

  /**
   * 中心（正規化座標）と一辺（幅に対する比率）を指定して
   * 切り出し、48×48に伸ばして測り直す。
   */
  public cropAnalyze(
    rgba: Uint8Array | number[],
    width: number,
    height: number,
    cxNorm: number,
    cyNorm: number,
    sideNorm: number,
  ): ZoomResult | null {
    if (width < 4 || height < 4) return null;
    const side = Math.max(4, Math.min(Math.min(width, height), Math.round(sideNorm * width)));
    const cx = cxNorm * (width - 1);
    const cy = cyNorm * (height - 1);
    const x0 = Math.max(0, Math.min(width - side, Math.round(cx - side / 2)));
    const y0 = Math.max(0, Math.min(height - side, Math.round(cy - side / 2)));
    const out = new Uint8Array(OUT * OUT * 4);
    for (let oy = 0; oy < OUT; oy++) {
      for (let ox = 0; ox < OUT; ox++) {
        const sx = x0 + Math.min(side - 1, Math.floor((ox * side) / OUT));
        const sy = y0 + Math.min(side - 1, Math.floor((oy * side) / OUT));
        const si = (sy * width + sx) * 4;
        const di = (oy * OUT + ox) * 4;
        out[di] = rgba[si];
        out[di + 1] = rgba[si + 1];
        out[di + 2] = rgba[si + 2];
        out[di + 3] = rgba[si + 3];
      }
    }
    const features = analyzeImagePixels(out, OUT, OUT);
    const state = this.load();
    state.analyzed++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { crop: { x: x0, y: y0, side }, scale: OUT / side, features };
  }
}

export const visualZoomService = new VisualZoomService();
