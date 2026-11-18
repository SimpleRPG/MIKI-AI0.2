import { storageService } from '../../../services/storageService';
import {
  analyzeImagePixels,
  type ImagePixelFeatures,
} from './conversationImageObservationService';
import { visualFigureService } from './visualFigureService';
import { motionPatternService, type MotionSample } from '../../selfAwareness/services/motionPatternService';

/**
 * P950: 姿勢・第1段「関節で姿勢を読む」。
 *
 * ポーズを1つずつ見本で覚える方式は組み合わせが爆発する。
 * 代わりに、体を部品と関節の相対位置に分解して読む：
 * 輪郭（前景マスク）から行ごとの横幅プロファイルを取り、
 * 頭・肩・腰・手・足の位置を推定し、腕と脚と体勢を
 * 測定量で記述する。色が体と同化した手足も、輪郭の
 * 形からは拾える（色で分けるルートの弱点の対策）。
 * 読みは棒人間を描き直して輪郭に重ね、線が体の内側に
 * 収まるかで照合する（仮説→描く→測るの輪）。
 * 関節の数値は体の相対座標なので、将来はアバター側の
 * 関節駆動（真似）にもそのまま使える表現になっている。
 */

export type ArmState = 'RAISED' | 'SPREAD' | 'DOWN' | 'UNKNOWN';
export type LegState = 'SPLIT' | 'TOGETHER' | 'UNKNOWN';
export type PostureState = 'STANDING' | 'SITTING' | 'UNKNOWN';

export interface PosePoint { x: number; y: number }

export interface PoseBuild {
  label: '細い' | '中肉' | 'がっしり' | '不明';
  /** 肩幅 ÷ 全体の高さ */
  shoulderRatio: number;
  /** 腰の細さ ÷ 肩幅 */
  waistRatio: number | null;
  /** 腰幅 ÷ 全体の高さ */
  hipRatio: number | null;
  /** 腕の太さ ÷ 全体の高さ */
  armThickness: number | null;
  /** 太ももの太さ ÷ 全体の高さ */
  legThickness: number | null;
  /** 足首 ÷ 太もも（関節の細り） */
  ankleRatio: number | null;
}

export interface PoseMotionReading {
  frames: number;
  readFrames: number;
  verifiedFrames: number;
  description: string;
  handSwingL: boolean;
  handSwingR: boolean;
  wavingL: boolean;
  wavingR: boolean;
  walking: boolean;
  jumping: boolean;
}

/** P957: 持ち物と重なりの読み（色の名前が入る） */
export interface PoseExtras {
  heldL: string | null;
  heldR: string | null;
  frontPatch: string | null;
}

const EXTRA_COLORS: Array<{ name: string; adj: string; rgb: [number, number, number] }> = [
  { name: '赤', adj: '赤い', rgb: [200, 50, 50] },
  { name: '青', adj: '青い', rgb: [50, 60, 180] },
  { name: '緑', adj: '緑の', rgb: [50, 160, 60] },
  { name: '黄', adj: '黄色い', rgb: [230, 200, 60] },
  { name: '白', adj: '白い', rgb: [240, 240, 240] },
  { name: '黒', adj: '黒い', rgb: [30, 30, 30] },
  { name: '茶', adj: '茶色い', rgb: [130, 85, 50] },
  { name: 'ピンク', adj: 'ピンクの', rgb: [240, 150, 180] },
  { name: '紫', adj: '紫の', rgb: [140, 80, 180] },
  { name: 'オレンジ', adj: 'オレンジの', rgb: [240, 140, 40] },
  { name: '灰', adj: '灰色の', rgb: [140, 140, 140] },
];

function nearestExtraColor(r: number, g: number, b: number): { name: string; adj: string } {
  let best = EXTRA_COLORS[0];
  let bestD = Infinity;
  for (const c of EXTRA_COLORS) {
    const d = (r - c.rgb[0]) ** 2 + (g - c.rgb[1]) ** 2 + (b - c.rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** P956: 服の形の読み */
export interface PoseClothing {
  /** flare=スカート状の広がり / split=ズボン状の分かれ */
  bottom: 'flare' | 'split' | 'unknown';
  /** 上下で色が違うか（測れなければ null） */
  twoPiece: boolean | null;
  /** P958: 上着と下半身の色の名前（個体識別の署名に使う） */
  topColor: string | null;
  bottomColor: string | null;
}

/** P958: 人の特徴署名（同じ人かどうかの見分けに使う） */
export interface PersonSignature {
  build: string | null;
  topColor: string | null;
  bottomColor: string | null;
  hairColor: string | null;
  shoulderRatio: number | null;
}

export interface PoseReading {
  head: (PosePoint & { r: number }) | null;
  handL: PosePoint | null;
  handR: PosePoint | null;
  footL: PosePoint | null;
  footR: PosePoint | null;
  armL: ArmState;
  armR: ArmState;
  legs: LegState;
  posture: PostureState;
  description: string;
  /** P951: 肉付き（アバターの体格パラメータにそのまま使える形） */
  build: PoseBuild | null;
  buildDescription: string;
  /** P951: 肌の色の島から得た補強（顔の確認・手の位置） */
  skinCues: { face: boolean; handL: boolean; handR: boolean };
  /** P956: 服の形 */
  clothing: PoseClothing;
  clothingDescription: string;
  /** P957: 持ち物と重なり */
  extras: PoseExtras;
  extrasDescription: string;
  /** P958: 髪の色の名前（頭の肌色でない部分の最頻色） */
  hairColor: string | null;
  verified: boolean;
  fit: number;
}

const KEY = 'miki_visual_poses_v1';

interface RowSpan { minX: number; maxX: number; spans: Array<{ minX: number; maxX: number }> }

function buildMask(rgba: Uint8Array | number[], width: number, height: number): Uint8Array | null {
  // 背景＝最も多い色ビン。それ以外を前景（人の輪郭）とみなす。
  const bins = new Map<string, number>();
  const keyGrid = new Array<string>(width * height).fill('');
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    // 輪郭用途は粗いビン（64刻み）で画素ノイズの割れを防ぐ。
    keyGrid[i] = `${Math.floor(rgba[i * 4] / 64)}-${Math.floor(rgba[i * 4 + 1] / 64)}-${Math.floor(rgba[i * 4 + 2] / 64)}`;
    bins.set(keyGrid[i], (bins.get(keyGrid[i]) || 0) + 1);
  }
  let bgKey = '';
  let bgCount = -1;
  for (const [k, c] of bins) if (c > bgCount) { bgCount = c; bgKey = k; }
  const mask = new Uint8Array(width * height);
  let fg = 0;
  for (let i = 0; i < width * height; i++) {
    if (keyGrid[i] && keyGrid[i] !== bgKey) { mask[i] = 1; fg++; }
  }
  const share = fg / (width * height);
  if (share < 0.02 || share > 0.8) return null;
  return mask;
}

function rowSpans(mask: Uint8Array, width: number, y: number): RowSpan {
  // 1px の隙間でも span を分ける（両脚の間の細い隙間が信号になる）。
  const spans: Array<{ minX: number; maxX: number }> = [];
  let start = -1;
  for (let x = 0; x < width; x++) {
    if (mask[y * width + x]) {
      if (start < 0) start = x;
    } else if (start >= 0) {
      spans.push({ minX: start, maxX: x - 1 });
      start = -1;
    }
  }
  if (start >= 0) spans.push({ minX: start, maxX: width - 1 });
  if (!spans.length) return { minX: -1, maxX: -1, spans };
  return { minX: spans[0].minX, maxX: spans[spans.length - 1].maxX, spans };
}

class VisualPoseService {
  private load(): { analyzed: number; verified: number; motions: number; clothing: number; extras: number; multi: number } {
    try {
      const raw = storageService.getJson(KEY, null) as { analyzed?: number; verified?: number; motions?: number; clothing?: number; extras?: number; multi?: number } | null;
      if (raw) return { analyzed: raw.analyzed || 0, verified: raw.verified || 0, motions: raw.motions || 0, clothing: raw.clothing || 0, extras: raw.extras || 0, multi: raw.multi || 0 };
    } catch { /* fall through */ }
    return { analyzed: 0, verified: 0, motions: 0, clothing: 0, extras: 0, multi: 0 };
  }

  public summary(): { analyzed: number; verified: number; motions: number; clothing: number; extras: number; multi: number } {
    return this.load();
  }

  /** P958: 姿勢読みから特徴署名を作る */
  public personSignature(reading: PoseReading): PersonSignature {
    return {
      build: reading.build?.label ?? null,
      topColor: reading.clothing.topColor,
      bottomColor: reading.clothing.bottomColor,
      hairColor: reading.hairColor,
      shoulderRatio: reading.build?.shoulderRatio ?? null,
    };
  }

  /** P958: 署名同士を比べて、同じ人らしいかを返す */
  public compareSignatures(a: PersonSignature, b: PersonSignature): { score: number; same: boolean; compared: number } {
    const items: Array<{ w: number; hit: number | null }> = [];
    const colorHit = (x: string | null, y: string | null) => (x && y ? (x === y ? 1 : 0) : null);
    items.push({ w: 0.3, hit: colorHit(a.topColor, b.topColor) });
    items.push({ w: 0.25, hit: colorHit(a.bottomColor, b.bottomColor) });
    items.push({ w: 0.2, hit: colorHit(a.hairColor, b.hairColor) });
    items.push({ w: 0.15, hit: a.build && b.build ? (a.build === b.build ? 1 : 0) : null });
    items.push({
      w: 0.1,
      hit: a.shoulderRatio !== null && b.shoulderRatio !== null
        ? (Math.abs(a.shoulderRatio - b.shoulderRatio) <= 0.05 ? 1 : Math.abs(a.shoulderRatio - b.shoulderRatio) <= 0.1 ? 0.5 : 0)
        : null,
    });
    let wSum = 0;
    let score = 0;
    let compared = 0;
    for (const it of items) {
      if (it.hit === null) continue;
      wSum += it.w;
      score += it.w * it.hit;
      compared++;
    }
    const norm = wSum > 0 ? score / wSum : 0;
    return { score: norm, same: compared >= 3 && norm >= 0.75, compared };
  }

  /**
   * P958: 複数人を読む。輪郭の連結成分ごとに切り分けて、
   * それぞれに姿勢読みをかける。重なって輪郭がくっついた
   * 人は分けられない（その場合は1人として読まれる）。
   */
  public analyzePeople(rgba: Uint8Array | number[], width: number, height: number): { count: number; readings: PoseReading[] } {
    const mask = buildMask(rgba, width, height);
    if (!mask) return { count: 0, readings: [] };
    const label = new Int32Array(width * height).fill(-1);
    const comps: Array<{ id: number; area: number; x0: number; y0: number; x1: number; y1: number }> = [];
    const stack: number[] = [];
    for (let s = 0; s < width * height; s++) {
      if (!mask[s] || label[s] >= 0) continue;
      const id = comps.length;
      let area = 0;
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      stack.push(s);
      label[s] = id;
      while (stack.length) {
        const p = stack.pop() as number;
        const x = p % width;
        const y = Math.floor(p / width);
        area++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        const nb = [p - 1, p + 1, p - width, p + width];
        for (const q of nb) {
          if (q < 0 || q >= width * height || !mask[q] || label[q] >= 0) continue;
          if (Math.abs((q % width) - x) > 1) continue;
          label[q] = id;
          stack.push(q);
        }
      }
      comps.push({ id, area, x0, y0, x1, y1 });
    }
    const bg: [number, number, number] = [rgba[0], rgba[1], rgba[2]];
    const readings: PoseReading[] = [];
    for (const c of comps) {
      if (c.area < width * height * 0.03) continue;
      const bw = c.x1 - c.x0 + 1;
      const bh = c.y1 - c.y0 + 1;
      if (bh < height * 0.15) continue;
      // 背景色で余白を足してから切り出す。余白が無いと、
      // 服の色が画面の最頻色になって「背景」と誤判定され、
      // 輪郭が反転して読めなくなるため。
      const pad = Math.max(4, Math.round(Math.min(bw, bh) * 0.25));
      const sw = bw + pad * 2;
      const sh = bh + pad * 2;
      const sub = new Uint8Array(sw * sh * 4);
      for (let i = 0; i < sw * sh; i++) {
        sub[i * 4] = bg[0]; sub[i * 4 + 1] = bg[1]; sub[i * 4 + 2] = bg[2]; sub[i * 4 + 3] = 255;
      }
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const sp = (c.y0 + y) * width + (c.x0 + x);
          if (label[sp] !== c.id) continue;
          const di = ((y + pad) * sw + (x + pad)) * 4;
          sub[di] = rgba[sp * 4]; sub[di + 1] = rgba[sp * 4 + 1]; sub[di + 2] = rgba[sp * 4 + 2]; sub[di + 3] = 255;
        }
      }
      const reading = this.analyzePose(sub, sw, sh);
      if (reading && reading.verified) readings.push(reading);
    }
    if (readings.length >= 2) {
      const state = this.load();
      state.multi++;
      try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    }
    return { count: readings.length, readings };
  }

  /** 画像から姿勢を読む。人らしい輪郭でなければ null。 */
  public analyzePose(rgba: Uint8Array | number[], width: number, height: number): PoseReading | null {
    const mask = buildMask(rgba, width, height);
    if (!mask) return null;
    const features: ImagePixelFeatures = analyzeImagePixels(rgba, width, height);
    const rows: RowSpan[] = [];
    let figTop = -1; let figBottom = -1; let figLeft = width; let figRight = -1;
    for (let y = 0; y < height; y++) {
      const row = rowSpans(mask, width, y);
      rows.push(row);
      if (row.minX >= 0) {
        if (figTop < 0) figTop = y;
        figBottom = y;
        figLeft = Math.min(figLeft, row.minX);
        figRight = Math.max(figRight, row.maxX);
      }
    }
    if (figTop < 0) return null;
    const figH = figBottom - figTop + 1;
    const figW = figRight - figLeft + 1;
    const figCx = (figLeft + figRight) / 2;

    // 門：頭らしい上部（狭く中央寄り）＋下部の構造（脚の分かれ
    // か、最後の行の広い span）がある輪郭だけを人として読む。
    const topRow = rows[figTop];
    const topWidth = topRow.maxX - topRow.minX + 1;
    const topCentered = Math.abs((topRow.minX + topRow.maxX) / 2 - figCx) <= figW * 0.18;
    const headLikeTop = topWidth <= figW * 0.45 && topCentered;
    const bottomRow = rows[figBottom];
    const bottomWide = (bottomRow.maxX - bottomRow.minX + 1) >= figW * 0.35;
    const bottomSplit = bottomRow.spans.length >= 2;
    const figure = visualFigureService.hypothesizeFigure(features);
    if (!figure && !(headLikeTop && (bottomWide || bottomSplit))) return null;

    // 頭：人の形の仮説があればその頭、なければ上部の重心。
    let headCx: number; let headCy: number; let headR: number;
    if (figure) {
      headCx = figure.head.centroidX * (width - 1);
      headCy = figure.head.centroidY * (height - 1);
      headR = Math.max(2, (figure.head.bboxHeight * height) / 2);
    } else {
      let sx = 0; let sy = 0; let n = 0;
      const headBand = Math.max(2, Math.round(figH * 0.18));
      for (let y = figTop; y < Math.min(height, figTop + headBand); y++) {
        for (let x = 0; x < width; x++) if (mask[y * width + x]) { sx += x; sy += y; n++; }
      }
      if (!n) return null;
      headCx = sx / n; headCy = sy / n; headR = Math.max(2, headBand / 2);
    }
    const headTop = headCy - headR;
    const neckY = headCy + headR;

    // 脚の分かれ（股）の開始行と、腰の位置。腕と胴の間の
    // 隙間を股と誤らないよう、両端の span の中心列が
    // 足元まで届いている行だけを股と認める。
    let crotchY = -1;
    const reachesBottom = (cx: number) => {
      for (let y = Math.max(0, figBottom - 2); y <= figBottom; y++) if (mask[y * width + Math.round(cx)]) return true;
      return false;
    };
    for (let y = Math.floor(figTop + figH * 0.5); y <= figBottom; y++) {
      const spans = rows[y].spans;
      if (spans.length < 2) continue;
      const l = spans[0];
      const r = spans[spans.length - 1];
      if (reachesBottom((l.minX + l.maxX) / 2) && reachesBottom((r.minX + r.maxX) / 2)) { crotchY = y; break; }
    }
    const hipY = crotchY > 0 ? crotchY - 2 : neckY + figH * 0.45;

    // 胴と肩：胴の幅は「頭の中心を含む span のうち、頭より下で
    // 最も細い行」から取る（腕が体に付いて下りていても、腕の
    // 無い高さでは胴だけの幅が残る）。肩は、その幅に近い span
    // が最初に現れる行。
    let torsoLeft = figLeft;
    let torsoRight = figRight;
    let shoulderY = Math.min(height - 1, neckY + figH * 0.05);
    const torsoScanFrom = Math.ceil(headCy + headR * 1.5);
    const torsoScanTo = Math.min(height - 1, crotchY > 0 ? crotchY + 2 : Math.floor(hipY + figH * 0.1));
    let torsoWidth = Infinity;
    for (let y = torsoScanFrom; y <= torsoScanTo; y++) {
      const span = rows[y].spans.find((s) => headCx >= s.minX && headCx <= s.maxX);
      if (span && span.maxX - span.minX + 1 >= 3 && span.maxX - span.minX + 1 < torsoWidth) {
        torsoWidth = span.maxX - span.minX + 1;
        torsoLeft = span.minX;
        torsoRight = span.maxX;
      }
    }
    if (torsoWidth !== Infinity) {
      for (let y = torsoScanFrom; y <= torsoScanTo; y++) {
        const span = rows[y].spans.find((s) => headCx >= s.minX && headCx <= s.maxX);
        if (span && span.maxX - span.minX + 1 >= torsoWidth * 0.8) { shoulderY = y; break; }
      }
    }

    // 足：最下行の span から。
    let footL: PosePoint | null = null;
    let footR: PosePoint | null = null;
    let legs: LegState = 'UNKNOWN';
    if (bottomRow.spans.length >= 2) {
      const l = bottomRow.spans[0];
      const r = bottomRow.spans[bottomRow.spans.length - 1];
      footL = { x: (l.minX + l.maxX) / 2, y: figBottom };
      footR = { x: (r.minX + r.maxX) / 2, y: figBottom };
      legs = 'SPLIT';
    } else if (bottomWide) {
      const cx = (bottomRow.minX + bottomRow.maxX) / 2;
      const w = (bottomRow.maxX - bottomRow.minX + 1) / 4;
      footL = { x: cx - w, y: figBottom };
      footR = { x: cx + w, y: figBottom };
      legs = 'TOGETHER';
    }

    // 体勢：座りは「下の行が広く、縦横比が低く、股の分かれが無い」。
    let posture: PostureState = 'UNKNOWN';
    if (figH < figW * 1.05 && crotchY < 0 && bottomWide) posture = 'SITTING';
    else if (figH >= figW * 0.9 && legs !== 'UNKNOWN') posture = 'STANDING';

    // 腕：側帯（胴の外側）にある前景の出方で読む。
    const armFor = (side: 'L' | 'R'): { state: ArmState; hand: PosePoint | null } => {
      const isSide = (x: number) => (side === 'L' ? x < torsoLeft - 0.5 : x > torsoRight + 0.5);
      // 上がっている：頭のてっぺんより上に、頭の横帯より外の前景。
      let topPt: PosePoint | null = null;
      for (let y = 0; y < Math.floor(headTop); y++) {
        for (let x = 0; x < width; x++) {
          if (mask[y * width + x] && Math.abs(x - headCx) > headR * 1.1) {
            if (side === 'L' ? x < headCx : x > headCx) { topPt = { x, y }; y = height; break; }
          }
        }
      }
      if (topPt) return { state: 'RAISED', hand: topPt };
      // 横に広がっている：肩の高さで、胴幅の6割以上も外へ
      // 張り出す（体に付いて下りた腕の数pxの張り出しと区別）。
      let spreadPt: PosePoint | null = null;
      for (let y = Math.floor(neckY); y <= Math.min(height - 1, Math.floor(shoulderY + figH * 0.08)); y++) {
        const row = rows[y];
        if (row.minX < 0) continue;
        if (side === 'L' && torsoLeft - row.minX >= torsoWidth * 0.6) spreadPt = { x: row.minX, y };
        if (side === 'R' && row.maxX - torsoRight >= torsoWidth * 0.6) spreadPt = { x: row.maxX, y };
      }
      if (spreadPt) return { state: 'SPREAD', hand: spreadPt };
      // 下りている：脚の外側で、腰の少し下までに側帯の前景の末端がある。
      let lowPt: PosePoint | null = null;
      const yLimit = Math.min(crotchY > 0 ? crotchY : figBottom, Math.floor(hipY + figH * 0.1));
      for (let y = Math.floor(shoulderY); y < yLimit; y++) {
        for (let x = 0; x < width; x++) {
          if (mask[y * width + x] && isSide(x)) lowPt = { x, y };
        }
      }
      if (lowPt) return { state: 'DOWN', hand: lowPt };
      return { state: 'UNKNOWN', hand: null };
    };
    let armL = armFor('L');
    let armR = armFor('R');

    // P951: 肌の色の島で補強する。手の島は領域の2%床より
    // 小さいことが多いので、画素を直接数える。肌が図の
    // 大部分を占める場合は「島」ではないので使わない
    // （その場合は輪郭ルートが受け持つ）。
    const skinCues = { face: false, handL: false, handR: false };
    {
      const isSkinPx = (idx: number) => {
        const r = rgba[idx]; const g = rgba[idx + 1]; const b = rgba[idx + 2];
        return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
      };
      let skinCount = 0; let maskCount = 0;
      let faceCount = 0;
      const sidePixels: Record<'L' | 'R', { x: number; y: number }[]> = { L: [], R: [] };
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!mask[y * width + x]) continue;
          maskCount++;
          if (!isSkinPx((y * width + x) * 4)) continue;
          skinCount++;
          if (Math.hypot(x - headCx, y - headCy) <= headR * 1.2) { faceCount++; continue; }
          if (y > neckY) sidePixels[x < headCx ? 'L' : 'R'].push({ x, y });
        }
      }
      if (maskCount > 0 && skinCount / maskCount < 0.35) {
        if (faceCount >= 8) skinCues.face = true;
        const skinHand = (side: 'L' | 'R', arm: { state: ArmState; hand: PosePoint | null }): boolean => {
          const pts = sidePixels[side];
          if (pts.length < 4) return false;
          const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
          const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
          if (arm.hand) {
            if (Math.hypot(cx - arm.hand.x, cy - arm.hand.y) <= 8) { arm.hand = { x: cx, y: cy }; return true; }
            return false;
          }
          if (arm.state === 'UNKNOWN' && cy >= shoulderY && cy <= hipY + figH * 0.18) {
            arm.state = 'DOWN';
            arm.hand = { x: cx, y: cy };
            return true;
          }
          return false;
        };
        skinCues.handL = skinHand('L', armL);
        skinCues.handR = skinHand('R', armR);
      }
    }

    // P951: 肉付き。横幅プロファイルから肩まわり・腰・
    // 手足の太さを測り、アバターの体格パラメータの形にする。
    const spanContaining = (y: number) => {
      const row = rows[Math.max(0, Math.min(height - 1, y))];
      return row ? row.spans.find((s) => headCx >= s.minX && headCx <= s.maxX) || null : null;
    };
    const chestSpan = spanContaining(Math.round(shoulderY));
    const chestW = chestSpan ? chestSpan.maxX - chestSpan.minX + 1 : (torsoRight - torsoLeft + 1);
    // 腰は「腕が終わった下の胴だけの行」を混ぜないよう、
    // 下りた手の先までの範囲で測る（腕込み同士で比べる）。
    const handEndY = Math.max(
      armL.state === 'DOWN' && armL.hand ? armL.hand.y : -1,
      armR.state === 'DOWN' && armR.hand ? armR.hand.y : -1,
    );
    const waistEnd = Math.min(Math.round(hipY), handEndY > 0 ? Math.round(handEndY) : Math.round(hipY));
    let waistW: number | null = null;
    for (let y = Math.round(shoulderY + (hipY - shoulderY) * 0.4); y <= waistEnd; y++) {
      const s = spanContaining(y);
      if (s) { const w = s.maxX - s.minX + 1; if (waistW === null || w < waistW) waistW = w; }
    }
    const hipRow = rows[Math.max(0, Math.min(height - 1, Math.round(hipY)))];
    const hipW = hipRow && hipRow.minX >= 0 ? hipRow.maxX - hipRow.minX + 1 : null;
    let legThickness: number | null = null;
    let ankleRatio: number | null = null;
    {
      // 太ももは脚の上半分で一番太い所（分かれる前の行は
      // 両脚まとめて半分と見積もる。ただし腕込みの胴の行は
      // 除外）。足首は下から3行目。
      const legTop = Math.round(hipY);
      const midLeg = Math.round((legTop + figBottom) / 2);
      let thighW: number | null = null;
      let thighCenter: number | null = null;
      for (let y = legTop; y <= midLeg; y++) {
        const row = rows[y];
        if (!row || !row.spans.length) continue;
        const s = row.spans[0];
        if (row.spans.length < 2 && (s.maxX - s.minX + 1) > chestW * 0.8) continue;
        const w = row.spans.length >= 2 ? (s.maxX - s.minX + 1) : (s.maxX - s.minX + 1) / 2;
        if (thighW === null || w > thighW) { thighW = w; thighCenter = (s.minX + s.maxX) / 2; }
      }
      if (thighW !== null && thighCenter !== null && figBottom - legTop >= 4) {
        legThickness = thighW / figH;
        const ankleRow = rows[Math.max(0, figBottom - 3)];
        if (ankleRow && ankleRow.spans.length) {
          const s = ankleRow.spans.find((sp) => Math.abs((sp.minX + sp.maxX) / 2 - (thighCenter as number)) <= 4) || ankleRow.spans[0];
          const aw = ankleRow.spans.length >= 2 ? (s.maxX - s.minX + 1) : (s.maxX - s.minX + 1) / 2;
          ankleRatio = aw / Math.max(1, thighW);
        }
      }
    }
    let armThickness: number | null = null;
    if (armL.state === 'DOWN' || armR.state === 'DOWN') {
      let ext = 0;
      for (let y = Math.round(shoulderY); y <= Math.round(hipY); y++) {
        const row = rows[y];
        if (row.minX < 0) continue;
        ext = Math.max(ext, torsoLeft - row.minX, row.maxX - torsoRight);
      }
      if (ext > 0) armThickness = ext / figH;
    }
    const frameW = torsoWidth !== Infinity ? torsoWidth : chestW;
    const frameRatio = frameW / figH;
    const chestRatio = chestW / figH;
    const taperRatio = chestW > 0 ? frameW / chestW : 1;
    const buildLabel: PoseBuild['label'] = frameRatio >= 0.3 || (taperRatio <= 0.45 && chestRatio >= 0.3)
      ? 'がっしり'
      : frameRatio <= 0.17 ? '細い' : '中肉';
    const build: PoseBuild = {
      label: buildLabel,
      shoulderRatio: chestRatio,
      waistRatio: waistW !== null && chestW > 0 ? Math.min(1.5, waistW / chestW) : null,
      hipRatio: hipW !== null ? hipW / figH : null,
      armThickness,
      legThickness,
      ankleRatio,
    };
    const buildParts: string[] = [`体格は${buildLabel}寄り`];
    if (build.waistRatio !== null && build.waistRatio <= 0.78) buildParts.push('腰が細くなっている');
    if (build.waistRatio !== null && build.waistRatio >= 0.95) buildParts.push('腰は肩とほぼ同じ幅');
    if (ankleRatio !== null && ankleRatio <= 0.8) buildParts.push('足首が太ももより細くなっている');
    const buildDescription = buildParts.join('。') + '。';

    // 股の位置：分かれ始めの行の span の中心。分かれが無ければ胴幅から。
    let hipL: PosePoint = { x: (torsoLeft + torsoRight) / 2 - (torsoRight - torsoLeft) / 4, y: hipY };
    let hipR: PosePoint = { x: (torsoLeft + torsoRight) / 2 + (torsoRight - torsoLeft) / 4, y: hipY };
    if (crotchY > 0 && rows[crotchY].spans.length >= 2) {
      const l = rows[crotchY].spans[0];
      const r = rows[crotchY].spans[rows[crotchY].spans.length - 1];
      hipL = { x: (l.minX + l.maxX) / 2, y: hipY };
      hipR = { x: (r.minX + r.maxX) / 2, y: hipY };
    }
    const joints = {
      head: { x: headCx, y: headCy, r: headR },
      neck: { x: headCx, y: neckY },
      shoulderL: { x: torsoLeft, y: shoulderY },
      shoulderR: { x: torsoRight, y: shoulderY },
      hipCenter: { x: (torsoLeft + torsoRight) / 2, y: hipY },
      hipL,
      hipR,
      handL: armL.hand,
      handR: armR.hand,
      footL,
      footR,
    };
    const fit = this.fitScore(mask, width, height, joints);
    const verified = fit >= 0.7;

    const armText = (state: ArmState, sideLabel: string) =>
      state === 'RAISED' ? `${sideLabel}腕が上に上がっている`
        : state === 'SPREAD' ? `${sideLabel}腕が横に広がっている`
          : state === 'DOWN' ? `${sideLabel}腕が下りている` : `${sideLabel}腕の位置ははっきりしない`;
    const parts: string[] = [];
    if (posture === 'STANDING') parts.push('立っている');
    else if (posture === 'SITTING') parts.push('座っているような姿勢');
    if (armL.state === armR.state && armL.state !== 'UNKNOWN') {
      parts.push(armText(armL.state, '両'));
    } else {
      if (armL.state !== 'UNKNOWN' || armR.state !== 'UNKNOWN') {
        parts.push(armText(armL.state, '左'));
        parts.push(armText(armR.state, '右'));
      } else parts.push('腕の位置ははっきりしない');
    }
    if (posture === 'STANDING') {
      if (legs === 'SPLIT') parts.push('脚は左右に分かれている');
      else if (legs === 'TOGETHER') parts.push('脚はそろっている');
    }
    // P956: 服の形。下半身の広がり（股の分かれが無く、腰から
    // 裾へ広がるならスカート状）と、上下の色の違いを読む。
    let clothing: PoseClothing = { bottom: 'unknown', twoPiece: null, topColor: null, bottomColor: null };
    {
      const rowWidth = (y: number) => {
        const s = rows[y]?.spans;
        if (!s || !s.length) return 0;
        return s[s.length - 1].maxX - s[0].minX + 1;
      };
      // 腰の基準は股の位置に引きずられない解剖学的な位置で取る
      // （股は hipY の算出に使われていて循環するため）。
      const hipRef = neckY + figH * 0.45;
      const waistW = rowWidth(Math.round(neckY + figH * 0.32));
      let bottom: PoseClothing['bottom'] = 'unknown';
      if (crotchY > 0 && crotchY <= hipRef + figH * 0.12) {
        // 股が腰のすぐ下から分かれている＝ズボン状。
        bottom = 'split';
      } else {
        // 分かれが無いか、分かれの直前まで広がっている＝スカート状。
        const flareY = crotchY > 0 ? crotchY - 2 : Math.floor(figBottom - figH * 0.05);
        const flareW = rowWidth(flareY);
        if (waistW > 0 && flareW > waistW * 1.12) bottom = 'flare';
        else if (crotchY > 0) bottom = 'split';
      }
      const bandMode = (y0: number, y1: number): { key: string; name: string } | null => {
        const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
        let total = 0;
        for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y++) {
          for (let x = 0; x < width; x += 2) {
            if (!mask[y * width + x]) continue;
            const i = (y * width + x) * 4;
            const k = `${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}`;
            const cur = counts.get(k) || { n: 0, r: 0, g: 0, b: 0 };
            cur.n++;
            cur.r += rgba[i]; cur.g += rgba[i + 1]; cur.b += rgba[i + 2];
            counts.set(k, cur);
            total++;
          }
        }
        if (total < 20) return null;
        let bestKey: string | null = null;
        let best: { n: number; r: number; g: number; b: number } | null = null;
        for (const [k, v] of counts) if (!best || v.n > best.n) { best = v; bestKey = k; }
        if (!best || !bestKey) return null;
        return { key: bestKey, name: nearestExtraColor(best.r / best.n, best.g / best.n, best.b / best.n).name };
      };
      const topBand = bandMode(Math.ceil(neckY), Math.floor(hipRef));
      const bottomBand = bandMode(Math.ceil(hipRef + figH * 0.08), figBottom);
      clothing = {
        bottom,
        twoPiece: topBand && bottomBand ? topBand.key !== bottomBand.key : null,
        topColor: topBand?.name ?? null,
        bottomColor: bottomBand?.name ?? null,
      };
    }
    const clothingParts: string[] = [];
    if (clothing.bottom === 'flare') clothingParts.push('下半身はスカートのように広がっている');
    else if (clothing.bottom === 'split') clothingParts.push('下半身はズボンのように脚が分かれている');
    if (clothing.twoPiece === true) clothingParts.push('服は上下で色が違う');
    else if (clothing.twoPiece === false && clothing.bottom !== 'unknown') clothingParts.push('服は上下が同じ色');
    const clothingDescription = clothingParts.length ? clothingParts.join('。') + '。' : '';

    // P958: 髪の色。頭の範囲で、肌色でない前景の最頻色。
    let hairColor: string | null = null;
    {
      const groups = new Map<string, { n: number; r: number; g: number; b: number }>();
      const hr = headR * 1.25;
      for (let y = Math.max(0, Math.floor(headCy - hr)); y <= Math.min(height - 1, Math.ceil(headCy + hr)); y++) {
        for (let x = Math.max(0, Math.floor(headCx - hr)); x <= Math.min(width - 1, Math.ceil(headCx + hr)); x++) {
          if ((x - headCx) ** 2 + (y - headCy) ** 2 > hr * hr) continue;
          const p = y * width + x;
          if (!mask[p]) continue;
          const i = p * 4;
          const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
          if (r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35) continue;
          const k = `${r >> 6},${g >> 6},${b >> 6}`;
          const cur = groups.get(k) || { n: 0, r: 0, g: 0, b: 0 };
          cur.n++;
          cur.r += r; cur.g += g; cur.b += b;
          groups.set(k, cur);
        }
      }
      let bestH: { n: number; r: number; g: number; b: number } | null = null;
      for (const v of groups.values()) if (!bestH || v.n > bestH.n) bestH = v;
      if (bestH && bestH.n >= 10) hairColor = nearestExtraColor(bestH.r / bestH.n, bestH.g / bestH.n, bestH.b / bestH.n).name;
    }

    // P957: 持ち物と重なり。体の最頻色（服）と肌色を除いて、
    // 手の周りや体の前にまとまった別の色があれば、それは
    // 持っている物や前に重なった物と読む。
    let extras: PoseExtras = { heldL: null, heldR: null, frontPatch: null };
    {
      const binOf = (i: number) => `${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}`;
      const isSkinPx = (i: number) => {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
      };
      // 体全体の最頻色ビン（服の色）
      const allBins = new Map<string, number>();
      for (let p = 0; p < width * height; p++) {
        if (!mask[p] || isSkinPx(p * 4)) continue;
        const k = binOf(p * 4);
        allBins.set(k, (allBins.get(k) || 0) + 1);
      }
      let domBin: string | null = null;
      let domN = 0;
      for (const [k, n] of allBins) if (n > domN) { domBin = k; domN = n; }
      // 指定範囲で、服とも肌とも違う最頻色の塊を探す
      const alienBlob = (cx: number, cy: number, radius: number, minPx: number, minShare: number): string | null => {
        const groups = new Map<string, { n: number; r: number; g: number; b: number }>();
        let fg = 0;
        for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++) {
          for (let x = Math.max(0, cx - radius); x <= Math.min(width - 1, cx + radius); x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
            const p = y * width + x;
            if (!mask[p]) continue;
            fg++;
            const i = p * 4;
            if (isSkinPx(i) || binOf(i) === domBin) continue;
            const k = binOf(i);
            const cur = groups.get(k) || { n: 0, r: 0, g: 0, b: 0 };
            cur.n++;
            cur.r += rgba[i]; cur.g += rgba[i + 1]; cur.b += rgba[i + 2];
            groups.set(k, cur);
          }
        }
        let best: { n: number; r: number; g: number; b: number } | null = null;
        for (const g of groups.values()) if (!best || g.n > best.n) best = g;
        if (!best || best.n < minPx || fg === 0 || best.n / fg < minShare) return null;
        return nearestExtraColor(best.r / best.n, best.g / best.n, best.b / best.n).adj;
      };
      const discR = Math.max(3, Math.round(figH * 0.11));
      if (armL.hand) extras.heldL = alienBlob(Math.round(armL.hand.x), Math.round(armL.hand.y), discR, 8, 0.3);
      if (armR.hand) extras.heldR = alienBlob(Math.round(armR.hand.x), Math.round(armR.hand.y), discR, 8, 0.3);
      // 体の前：胴の範囲を矩形として同じ探し方をする
      const hipRefE = neckY + figH * 0.45;
      const torsoCx = Math.round((torsoLeft + torsoRight) / 2);
      const torsoCy = Math.round((neckY + hipRefE) / 2);
      const torsoR = Math.max(4, Math.round(Math.max(torsoRight - torsoLeft, hipRefE - neckY) / 2));
      extras.frontPatch = alienBlob(torsoCx, torsoCy, torsoR, 15, 0.12);
      // 手の塊と胴の塊が同じ物を二重に数えないよう、胴側が
      // 手の検出と重なる場合は胴側を優先しない（手側を残す）。
      if (extras.frontPatch && (extras.heldL || extras.heldR)) {
        const nearHand = (armL.hand && Math.abs(armL.hand.x - torsoCx) <= torsoR && Math.abs(armL.hand.y - torsoCy) <= torsoR)
          || (armR.hand && Math.abs(armR.hand.x - torsoCx) <= torsoR && Math.abs(armR.hand.y - torsoCy) <= torsoR);
        if (nearHand && extras.frontPatch === (extras.heldL || extras.heldR)) extras.frontPatch = null;
      }
    }
    const extrasParts: string[] = [];
    if (extras.heldL) extrasParts.push(`左手に${extras.heldL}ものを持っているようだ`);
    if (extras.heldR) extrasParts.push(`右手に${extras.heldR}ものを持っているようだ`);
    if (extras.frontPatch) extrasParts.push(`体の前に${extras.frontPatch}ものがあるようだ`);
    const extrasDescription = extrasParts.length ? extrasParts.join('。') + '。' : '';

    const description = parts.join('。') + '。';

    const state = this.load();
    state.analyzed++;
    if (verified) state.verified++;
    if (clothingDescription) state.clothing++;
    if (extrasDescription) state.extras++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }

    const norm = (p: PosePoint | null): PosePoint | null =>
      (p ? { x: p.x / (width - 1), y: p.y / (height - 1) } : null);
    return {
      head: { x: headCx / (width - 1), y: headCy / (height - 1), r: headR / width },
      handL: norm(armL.hand),
      handR: norm(armR.hand),
      footL: norm(footL),
      footR: norm(footR),
      armL: armL.state,
      armR: armR.state,
      legs,
      posture,
      description,
      build,
      buildDescription,
      skinCues,
      clothing,
      clothingDescription,
      extras,
      extrasDescription,
      hairColor,
      verified,
      fit,
    };
  }

  /**
   * P952: 姿勢・第2段b「関節軌跡で動作を読む」。
   * フレーム列に姿勢読みをかけ、関節の軌跡から動作を
   * 記述する。手の軌跡は P941 の動きの測定（measure）に
   * 通し、周期と振幅で「振っている」を判定する。歩行は
   * 両足の間隔の符号変化、跳躍は足が地面から離れる量で
   * 読む。読みが照合を通ったフレームが半分未満なら、
   * 動作は読めないとして null を返す（正直さ）。
   */
  public analyzePoseMotion(
    frames: { rgba: Uint8Array | number[]; width: number; height: number; t: number }[],
  ): PoseMotionReading | null {
    if (frames.length < 3) return null;
    const readings: (PoseReading | null)[] = frames.map((f) => this.analyzePose(f.rgba, f.width, f.height));
    const valid = readings.filter((r): r is PoseReading => r !== null);
    if (valid.length < 3) return null;
    const verifiedFrames = valid.filter((r) => r.verified).length;
    if (verifiedFrames < valid.length / 2) return null;

    const traj = (pick: (r: PoseReading) => PosePoint | null): MotionSample[] => {
      const out: MotionSample[] = [];
      readings.forEach((r, i) => {
        if (!r) return;
        const p = pick(r);
        if (p) out.push({ t: frames[i].t, x: p.x, y: p.y });
      });
      return out;
    };
    const headTraj = traj((r) => r.head);
    const handLTraj = traj((r) => r.handL);
    const handRTraj = traj((r) => r.handR);
    const headY = headTraj.length ? headTraj.reduce((a, s) => a + s.y, 0) / headTraj.length : 0;

    const dirChanges = (vals: number[]) => {
      let changes = 0;
      let prev = 0;
      for (let i = 1; i < vals.length; i++) {
        const d = vals[i] - vals[i - 1];
        const s = d > 0.004 ? 1 : d < -0.004 ? -1 : 0;
        if (s !== 0 && prev !== 0 && s !== prev) changes++;
        if (s !== 0) prev = s;
      }
      return changes;
    };
    const isOscillating = (samples: MotionSample[]) => {
      if (samples.length < 4) return false;
      const f = motionPatternService.measure(samples);
      if (!f || Math.max(f.rangeX, f.rangeY) < 0.06) return false;
      return dirChanges(samples.map((s) => s.x)) >= 2 || dirChanges(samples.map((s) => s.y)) >= 2;
    };
    const waving = (samples: MotionSample[]) => {
      if (samples.length < 4) return false;
      const above = samples.filter((s) => s.y < headY).length / samples.length;
      if (above < 0.6) return false;
      const f = motionPatternService.measure(samples);
      return !!f && f.rangeX >= 0.04 && dirChanges(samples.map((s) => s.x)) >= 2;
    };
    const wavingL = waving(handLTraj);
    const wavingR = waving(handRTraj);
    const handSwingL = !wavingL && !!isOscillating(handLTraj);
    const handSwingR = !wavingR && !!isOscillating(handRTraj);

    // 跳躍：両足のうち低い方（画面の下側）が、地面の位置
    // からどれだけ離れるか。
    let jumping = false;
    {
      const lows: number[] = [];
      for (const r of valid) {
        const feet = [r.footL, r.footR].filter((p): p is PosePoint => p !== null);
        if (feet.length) lows.push(Math.max(...feet.map((p) => p.y)));
      }
      if (lows.length >= 3) {
        const ground = Math.max(...lows);
        const lift = ground - Math.min(...lows);
        jumping = lift >= 0.06;
      }
    }
    // 歩行：両足の間隔が開閉を繰り返す（脚の前後の交代。
    // 足の左右は画像の位置で付けられるため、符号ではなく
    // 間隔の大きさの振動で読む）。
    let walking = false;
    {
      const seps: MotionSample[] = [];
      readings.forEach((r, i) => {
        if (r?.footL && r?.footR) seps.push({ t: frames[i].t, x: Math.abs(r.footR.x - r.footL.x), y: 0 });
      });
      if (seps.length >= 4) {
        const f = motionPatternService.measure(seps);
        walking = !!f && f.rangeX >= 0.08 && dirChanges(seps.map((s) => s.x)) >= 2 && !jumping;
      }
    }
    const headFeat = headTraj.length >= 4 ? motionPatternService.measure(headTraj) : null;
    const bodySway = !!headFeat && headFeat.kind === 'SWAY' && headFeat.rangeX >= 0.03 && !walking;

    const parts: string[] = [];
    if (jumping) parts.push('跳んでいる（足が地面から離れる）');
    if (walking) parts.push('歩いているような脚の動きをしている');
    if (wavingL) parts.push('左手を振っている');
    if (wavingR) parts.push('右手を振っている');
    if (handSwingL) parts.push('左腕を振っている');
    if (handSwingR) parts.push('右腕を振っている');
    if (bodySway) parts.push('上体が左右に揺れている');
    const description = (parts.length ? parts.join('。') : '大きな動きは見られない') + '。';

    const state = this.load();
    state.motions = (state.motions || 0) + 1;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }

    return {
      frames: frames.length,
      readFrames: valid.length,
      verifiedFrames,
      description,
      handSwingL, handSwingR, wavingL, wavingR, walking, jumping,
    };
  }

  /** 棒人間を描き直し、線が輪郭の内側に収まる割合で照合する。 */
  private fitScore(
    mask: Uint8Array,
    width: number,
    height: number,
    j: {
      head: { x: number; y: number; r: number };
      neck: PosePoint;
      shoulderL: PosePoint;
      shoulderR: PosePoint;
      hipCenter: PosePoint;
      hipL: PosePoint;
      hipR: PosePoint;
      handL: PosePoint | null;
      handR: PosePoint | null;
      footL: PosePoint | null;
      footR: PosePoint | null;
    },
  ): number {
    const drawn = new Uint8Array(width * height);
    const plot = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = Math.round(x) + dx; const py = Math.round(y) + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) drawn[py * width + px] = 1;
      }
    };
    const line = (a: PosePoint, b: PosePoint) => {
      const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let i = 0; i <= steps; i++) plot(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    };
    for (let y = -Math.ceil(j.head.r); y <= Math.ceil(j.head.r); y++) {
      for (let x = -Math.ceil(j.head.r); x <= Math.ceil(j.head.r); x++) {
        if (x * x + y * y <= j.head.r * j.head.r) plot(j.head.x + x, j.head.y + y);
      }
    }
    line(j.neck, j.hipCenter);
    if (j.handL) line(j.shoulderL, j.handL);
    if (j.handR) line(j.shoulderR, j.handR);
    if (j.footL) line(j.hipL, j.footL);
    if (j.footR) line(j.hipR, j.footR);
    // 評価は輪郭を 1px 膨らませた側で行う（棒人間の線は
    // 関節の近似で、1px 程度のずれは読み違いではないため）。
    const dilated = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y * width + x]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx; const py = y + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) dilated[py * width + px] = 1;
        }
      }
    }
    let inside = 0; let total = 0;
    for (let i = 0; i < width * height; i++) {
      if (drawn[i]) { total++; if (dilated[i]) inside++; }
    }
    return total ? inside / total : 0;
  }
}

export const visualPoseService = new VisualPoseService();
