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
  /** P954: 切り出して伸ばした48×48の画素（顔の中身の測定用） */
  pixels: Uint8Array;
}

/** P959: 手の読み（拡大した手で指の分かれを見る） */
export interface HandReading {
  fingersSeparated: boolean;
  maxRuns: number;
  description: string;
  /** P965: 爪（指先の、肌でも背景でもない色のパッチ） */
  nails: { present: boolean; colorLabel: string | null };
  /** P968: 指の本数・広がり・一番長い指の位置 */
  fingers: { count: number; spread: number; longest: 'left' | 'center' | 'right' | null };
}

/** P955: 向きの読み（正面・横向き・後ろ姿） */
export interface ViewpointReading {
  viewpoint: 'front' | 'profile' | 'back';
  description: string;
}

/** P954: 顔の中身の読み（拡大した顔から目と口を読む） */
export interface FaceReading {
  eyes: 0 | 1 | 2;
  mouthShape: 'smile' | 'frown' | 'flat' | 'none';
  mouthWidthRatio: number;
  verified: boolean;
  description: string;
  /** P969: 目の色（目の暗い点の平均色から） */
  eyeColor: string | null;
  /** P978: 眉が見えるか（片方だけ等では null） */
  brows: boolean | null;
  /** P979: 鼻の影が見えるか（影が無くても鼻が無いとは言わない） */
  nose: boolean | null;
}

class VisualZoomService {
  private load(): { analyzed: number; faces: number; viewpoints: number; hands: number; nails: number; fingerDetails: number; eyeColors: number; brows: number; noses: number } {
    try {
      const raw = storageService.getJson(KEY, null) as { analyzed?: number; faces?: number; viewpoints?: number; hands?: number; nails?: number; fingerDetails?: number; eyeColors?: number; brows?: number; noses?: number } | null;
      if (raw) return { analyzed: raw.analyzed || 0, faces: raw.faces || 0, viewpoints: raw.viewpoints || 0, hands: raw.hands || 0, nails: raw.nails || 0, fingerDetails: raw.fingerDetails || 0, eyeColors: raw.eyeColors || 0, brows: raw.brows || 0, noses: raw.noses || 0 };
    } catch { /* fall through */ }
    return { analyzed: 0, faces: 0, viewpoints: 0, hands: 0, nails: 0, fingerDetails: 0, eyeColors: 0, brows: 0, noses: 0 };
  }

  public summary(): { analyzed: number; faces: number; viewpoints: number; hands: number; nails: number; fingerDetails: number; eyeColors: number; brows: number; noses: number } {
    return this.load();
  }

  /**
   * P959: 拡大した手（48×48、手が中心）を読む。
   * axisToArm は「手の中心から腕（手首）の方への単位
   * ベクトル」。腕と反対の方向へ線をずらしながら肌色の
   * 連なりを数え、2つ以上に分かれる線があれば指が
   * 開いていると読む。分かれなければ握っているか
   * 指がくっついている。
   */
  public analyzeHand(pixels: Uint8Array, axisToArm: { x: number; y: number }): HandReading | null {
    const S = OUT;
    const isSkin = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= S || y >= S) return false;
      const i = (y * S + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
    };
    let skinCount = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (isSkin(x, y)) skinCount++;
    if (skinCount < 30) return null;
    const away = { x: -axisToArm.x, y: -axisToArm.y };
    const perp = { x: -away.y, y: away.x };
    const cx = (S - 1) / 2;
    const cy = (S - 1) / 2;
    let maxRuns = 0;
    let tipD = 0;
    let tipCenters: number[] = [];
    let bestD = 0;
    let bestCenters: number[] = [];
    for (let d = 3; d <= 21; d += 2) {
      const lx = cx + away.x * d;
      const ly = cy + away.y * d;
      let runs = 0;
      let inRun = false;
      let runStart = 0;
      const centers: number[] = [];
      for (let t = -17; t <= 17; t++) {
        const s = isSkin(Math.round(lx + perp.x * t), Math.round(ly + perp.y * t));
        if (s && !inRun) { runs++; inRun = true; runStart = t; }
        else if (!s && inRun) { centers.push((runStart + t - 1) / 2); inRun = false; }
      }
      if (inRun) centers.push((runStart + 17) / 2);
      if (runs > maxRuns) { maxRuns = runs; bestD = d; bestCenters = centers; }
      if (centers.length > 0) { tipD = d; tipCenters = centers; }
    }
    const fingersSeparated = maxRuns >= 2;

    // P968: 指の本数と、一本ごとの長さ。分かれが一番
    // よく見える走査線の並びを指の列とし、各指について
    // 肌がどこまで続くか（その指の先端）を測る。
    let fingers: HandReading['fingers'] = { count: 0, spread: 0, longest: null };
    if (bestCenters.length > 0) {
      const spread = bestCenters.length >= 2
        ? (bestCenters[bestCenters.length - 1] - bestCenters[0]) / S
        : 0;
      let longestT: number | null = null;
      let longestTip = -1;
      for (const t of bestCenters) {
        let ownTip = bestD;
        for (let d = bestD; d <= 23; d++) {
          const sx = Math.round(cx + away.x * d + perp.x * t);
          const sy = Math.round(cy + away.y * d + perp.y * t);
          if (isSkin(sx, sy)) ownTip = d;
        }
        if (ownTip > longestTip) { longestTip = ownTip; longestT = t; }
      }
      fingers = {
        count: bestCenters.length,
        spread,
        longest: longestT === null ? null : Math.abs(longestT) <= 5 ? 'center' : longestT < 0 ? 'left' : 'right',
      };
    }

    // P965: 爪。爪は肌の走査が止まる先端の、少し先にある。
    // 先端の2〜4先で、肌でも背景でもない色のパッチが
    // まとまっていれば爪と読む。
    let nails: HandReading['nails'] = { present: false, colorLabel: null };
    if (tipD >= 6 && tipCenters.length > 0) {
      let cr = 0, cg = 0, cb = 0, cn = 0;
      let found = false;
      for (const t of tipCenters) {
        let bestCand = 0;
        let bsr = 0, bsg = 0, bsb = 0;
        for (const dN of [tipD + 2, tipD + 4]) {
          const px0 = Math.round(cx + away.x * dN + perp.x * t);
          const py0 = Math.round(cy + away.y * dN + perp.y * t);
          let cand = 0;
          let sr = 0, sg = 0, sb = 0;
          for (let yy = py0 - 1; yy <= py0 + 1; yy++) {
            for (let xx = px0 - 1; xx <= px0 + 1; xx++) {
              if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
              if (isSkin(xx, yy)) continue;
              const i = (yy * S + xx) * 4;
              const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
              if (r > 235 && g > 235 && b > 235) continue;
              cand++; sr += r; sg += g; sb += b;
            }
          }
          if (cand > bestCand) { bestCand = cand; bsr = sr; bsg = sg; bsb = sb; }
        }
        if (bestCand >= 5) { found = true; cr += bsr; cg += bsg; cb += bsb; cn += bestCand; }
      }
      if (found && cn > 0) {
        const r = cr / cn, g = cg / cn, b = cb / cn;
        const colorLabel = r > 210 && g > 165 && b > 155 && r - g < 60 ? '薄いピンク'
          : r > 150 && r > g + 50 && r > b + 50 ? '赤い'
          : r > 200 && g > 200 && b > 200 ? '白っぽい'
          : r < 110 && g < 110 && b < 110 ? '暗い色の' : '色のある';
        nails = { present: true, colorLabel };
      }
    }

    const state = this.load();
    state.hands++;
    if (nails.present) state.nails++;
    if (fingers.count >= 2) state.fingerDetails++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return {
      fingersSeparated,
      maxRuns,
      nails,
      fingers,
      description: fingersSeparated ? '指が分かれて見える' : '指は分かれて見えない（握っているか、指がくっついているようだ）',
    };
  }

  /**
   * P955: 向きを読む。目が2つ見えれば正面、1つなら横向き、
   * 頭の拡大に肌色がまったく無ければ（髪に覆われた頭）
   * 後ろ姿。どれにも当たらなければ決めない。
   */
  public classifyViewpoint(cues: { eyes: number | null; headSkinShare: number | null }): ViewpointReading | null {
    let vp: ViewpointReading | null = null;
    if (cues.eyes === 2) {
      vp = { viewpoint: 'front', description: '正面を向いているように見える' };
    } else if (cues.eyes === 1) {
      vp = { viewpoint: 'profile', description: '横向きで、顔の片側が見えているように見える' };
    } else if (cues.headSkinShare !== null && cues.headSkinShare < 0.02) {
      vp = { viewpoint: 'back', description: '後ろ姿のように見える（頭に顔の肌が見えない）' };
    }
    if (vp) {
      const state = this.load();
      state.viewpoints++;
      try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    }
    return vp;
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
    return { crop: { x: x0, y: y0, side }, scale: OUT / side, features, pixels: out };
  }

  /**
   * P954: 拡大した顔（48×48）の中身を読む。
   * 肌色の広がりを顔とみて、その内側の暗い点から目と口を拾う。
   * 口元は中心と両端の高さ比べで、上がっている（笑い）か
   * 下がっているかを弱く読む。読みは模式図に描き直して
   * 同じ測定にかけ、同じ読みが返るときだけ verified にする。
   */
  public analyzeFace(pixels: Uint8Array): FaceReading | null {
    const raw = this.measureFace(pixels);
    if (!raw) return null;
    // 描き直し照合：読み通りの模式図を作り、同じ読みが返るか。
    const schematic = this.renderFaceSchematic(raw);
    const again = schematic ? this.measureFace(schematic) : null;
    const verified = !!again && again.eyes === raw.eyes && again.mouthShape === raw.mouthShape;
    // P969: 目の色。目として拾った暗い点の平均色から読む。
    let eyeColor: string | null = null;
    if (raw.eyePts.length >= 2) {
      let sr = 0, sg = 0, sb = 0;
      for (const p of raw.eyePts) {
        const i = (p.y * OUT + p.x) * 4;
        sr += pixels[i]; sg += pixels[i + 1]; sb += pixels[i + 2];
      }
      const r = sr / raw.eyePts.length, g = sg / raw.eyePts.length, b = sb / raw.eyePts.length;
      const lum = r * 0.3 + g * 0.59 + b * 0.11;
      eyeColor = lum < 55 ? '黒'
        : b > r + 15 && b > g ? '青'
        : g >= r && g >= b ? '緑'
        : r > g && g > b && r - b > 25 ? '茶色'
        : '暗い色';
    }
    const parts: string[] = [];
    if (raw.eyes === 2) parts.push('目が2つ見える');
    else if (raw.eyes === 1) parts.push('目が1つ見える');
    if (eyeColor) parts.push(`目の色は${eyeColor}`);
    if (raw.brows === true) parts.push('眉が見える');
    if (raw.nose === true) parts.push('鼻の影が見える');
    if (raw.mouthShape !== 'none') parts.push('口が見える');
    let description = parts.join('。');
    if (description) description += '。';
    if (raw.mouthShape === 'smile') description += '口元が上がっていて、笑っているように見える。';
    else if (raw.mouthShape === 'frown') description += '口元が下がっているように見える。';
    const state = this.load();
    state.faces++;
    if (eyeColor) state.eyeColors++;
    if (raw.brows === true) state.brows++;
    if (raw.nose === true) state.noses++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { ...raw, verified, description, eyeColor };
  }

  private measureFace(pixels: Uint8Array): { eyes: 0 | 1 | 2; mouthShape: FaceReading['mouthShape']; mouthWidthRatio: number; eyePts: { x: number; y: number }[]; mouthPts: { x: number; y: number }[]; brows: boolean | null; nose: boolean | null; faceBox: { x0: number; y0: number; x1: number; y1: number } } | null {
    const S = OUT;
    const isSkin = (i: number) => {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
    };
    const isDark = (i: number) => {
      const lum = pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
      return lum < 95 && !isSkin(i);
    };
    let sx0 = S, sy0 = S, sx1 = -1, sy1 = -1, skinCount = 0;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (isSkin((y * S + x) * 4)) {
          skinCount++;
          if (x < sx0) sx0 = x;
          if (x > sx1) sx1 = x;
          if (y < sy0) sy0 = y;
          if (y > sy1) sy1 = y;
        }
      }
    }
    if (skinCount < 40 || sx1 - sx0 < 9 || sy1 - sy0 < 9) return null;
    const fw = sx1 - sx0 + 1;
    const fh = sy1 - sy0 + 1;
    const cx = (sx0 + sx1) / 2;
    // 顔の内側の暗い点だけを拾う：少し離れた輪（距離3）が
    // 肌色に囲まれていること。これがないと、顔の輪郭の
    // 外側にある髪を目と誤る。輪で見るのは、細い線（口）や
    // 小さい点（目）でも内側と判定できるようにするため。
    const skinAt = (x: number, y: number) => x >= 0 && y >= 0 && x < S && y < S && isSkin((y * S + x) * 4);
    const ringSkinShare = (x: number, y: number) => {
      let skin = 0;
      let total = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== 3) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
          total++;
          if (skinAt(nx, ny)) skin++;
        }
      }
      return total > 0 ? skin / total : 0;
    };
    const isFacialDark = (x: number, y: number) => isDark((y * S + x) * 4) && ringSkinShare(x, y) >= 0.7;
    // P971: 明るい色の目。暗くないが色のついた点（青い虹彩など）も、
    // 肌色の輪に囲まれていれば目の候補にする。
    const isColoredEyePx = (x: number, y: number) => {
      const i = (y * S + x) * 4;
      if (isSkin(i) || isDark(i)) return false;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const lum = r * 0.3 + g * 0.59 + b * 0.11;
      if (lum >= 240) return false;
      return Math.max(r, g, b) - Math.min(r, g, b) >= 40;
    };
    const isFacialColored = (x: number, y: number) => isColoredEyePx(x, y) && ringSkinShare(x, y) >= 0.7;
    // 目：顔の上寄りの帯にある暗い点・色の点（左右に分けて数える）
    const eyeBand = { y0: sy0 + fh * 0.2, y1: sy0 + fh * 0.52 };
    const eyePts: { x: number; y: number }[] = [];
    for (let y = Math.floor(eyeBand.y0); y <= Math.ceil(eyeBand.y1); y++) {
      for (let x = sx0; x <= sx1; x++) {
        if (isFacialDark(x, y) || isFacialColored(x, y)) eyePts.push({ x, y });
      }
    }
    const leftEyes = eyePts.filter((p) => p.x < cx);
    const rightEyes = eyePts.filter((p) => p.x >= cx);
    const eyes = ((leftEyes.length >= 2 ? 1 : 0) + (rightEyes.length >= 2 ? 1 : 0)) as 0 | 1 | 2;
    // P978: 眉。目の帯のすぐ上にある暗い点の集まり。
    // 上側は髪に触れることがあるので、輪の肌色率は
    // 目（0.7）より緩めて 0.5 にする。髪そのものの内側は
    // 輪が髪だらけになるため、この条件で落ちる。
    let browL = 0;
    let browR = 0;
    for (let y = Math.ceil(sy0 + fh * 0.02); y <= Math.floor(eyeBand.y0 - 1); y++) {
      for (let x = sx0; x <= sx1; x++) {
        if (isDark((y * S + x) * 4) && ringSkinShare(x, y) >= 0.5) {
          if (x < cx) browL++; else browR++;
        }
      }
    }
    const brows: boolean | null = browL >= 3 && browR >= 3 ? true : browL === 0 && browR === 0 ? false : null;
    // P979: 鼻。目と口の間の中心の帯で、肌の明るさが
    // 両脇（頬）より落ちていれば、鼻筋・鼻の下の影と読む。
    // 影が無くても鼻が無いとは言えないので、読めない時は null。
    let nose: boolean | null = null;
    {
      const lum = (i: number) => pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
      let cSum = 0, cN = 0, sSum = 0, sN = 0;
      const y0 = Math.ceil(eyeBand.y1);
      const y1 = Math.floor(sy0 + fh * 0.6);
      for (let y = y0; y <= y1; y++) {
        for (let x = sx0; x <= sx1; x++) {
          const i = (y * S + x) * 4;
          if (!isSkin(i)) continue;
          const dxn = Math.abs(x - cx) / Math.max(1, fw);
          if (dxn <= 0.09) { cSum += lum(i); cN++; }
          else if (dxn >= 0.18 && dxn <= 0.34) { sSum += lum(i); sN++; }
        }
      }
      if (cN >= 6 && sN >= 6) {
        const cMean = cSum / cN;
        const sMean = sSum / sN;
        if (sMean > 0 && cMean <= sMean * 0.94) nose = true;
      }
    }
    // 口：顔の下寄りの帯にある暗い点
    const mouthBand = { y0: sy0 + fh * 0.6, y1: sy0 + fh * 0.94 };
    const mouthPts: { x: number; y: number }[] = [];
    for (let y = Math.floor(mouthBand.y0); y <= Math.ceil(mouthBand.y1); y++) {
      for (let x = sx0; x <= sx1; x++) {
        if (isFacialDark(x, y)) mouthPts.push({ x, y });
      }
    }
    let mouthShape: FaceReading['mouthShape'] = 'none';
    let mouthWidthRatio = 0;
    if (mouthPts.length >= 3) {
      const mx0 = Math.min(...mouthPts.map((p) => p.x));
      const mx1 = Math.max(...mouthPts.map((p) => p.x));
      mouthWidthRatio = (mx1 - mx0 + 1) / fw;
      const third = (mx1 - mx0) / 3;
      const center = mouthPts.filter((p) => p.x >= mx0 + third && p.x <= mx1 - third);
      const sides = mouthPts.filter((p) => p.x < mx0 + third || p.x > mx1 - third);
      if (center.length && sides.length) {
        const cY = center.reduce((a, p) => a + p.y, 0) / center.length;
        const sY = sides.reduce((a, p) => a + p.y, 0) / sides.length;
        // 笑い口は両端が上がる＝中心が相対的に下（yが大きい）
        mouthShape = cY > sY + 0.6 ? 'smile' : cY < sY - 0.6 ? 'frown' : 'flat';
      } else {
        mouthShape = 'flat';
      }
    }
    return { eyes, mouthShape, mouthWidthRatio, eyePts, mouthPts, brows, nose, faceBox: { x0: sx0, y0: sy0, x1: sx1, y1: sy1 } };
  }

  /** 読み通りの模式図（肌色の四角＋目の点＋口の弧）を描く */
  private renderFaceSchematic(reading: { eyes: 0 | 1 | 2; mouthShape: FaceReading['mouthShape']; mouthWidthRatio: number; faceBox: { x0: number; y0: number; x1: number; y1: number } }): Uint8Array | null {
    const S = OUT;
    const out = new Uint8Array(S * S * 4);
    for (let i = 0; i < S * S; i++) { out[i * 4] = 245; out[i * 4 + 1] = 245; out[i * 4 + 2] = 245; out[i * 4 + 3] = 255; }
    const { x0, y0, x1, y1 } = reading.faceBox;
    const set = (x: number, y: number, c: [number, number, number]) => {
      if (x < 0 || y < 0 || x >= S || y >= S) return;
      const i = (y * S + x) * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
    };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, [232, 190, 160]);
    const fw = x1 - x0 + 1;
    const fh = y1 - y0 + 1;
    const cx = (x0 + x1) / 2;
    const eyeY = Math.round(y0 + fh * 0.36);
    const dark: [number, number, number] = [30, 30, 30];
    const dot = (ex: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(Math.round(ex) + dx, eyeY + dy, dark); };
    if (reading.eyes === 2) { dot(cx - fw * 0.22); dot(cx + fw * 0.22); }
    else if (reading.eyes === 1) { dot(cx - fw * 0.22); }
    if (reading.mouthShape !== 'none') {
      const mw = Math.max(4, reading.mouthWidthRatio * fw);
      const mx0 = cx - mw / 2;
      const my = y0 + fh * 0.78;
      for (let x = 0; x <= mw; x++) {
        const t = x / mw;
        const arc = reading.mouthShape === 'smile' ? Math.sin(t * Math.PI) * 2 : reading.mouthShape === 'frown' ? -Math.sin(t * Math.PI) * 2 : 0;
        set(Math.round(mx0 + x), Math.round(my + arc), dark);
        set(Math.round(mx0 + x), Math.round(my + arc) + 1, dark);
      }
    }
    return out;
  }
}

export const visualZoomService = new VisualZoomService();
