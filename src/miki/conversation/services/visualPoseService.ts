import { storageService } from '../../../services/storageService';
import {
  analyzeImagePixels,
  type ImagePixelFeatures,
} from './conversationImageObservationService';
import { visualFigureService } from './visualFigureService';
import { visualZoomService } from './visualZoomService';

/** P994: 素体に描く顔の指定 */
export interface BodyFaceSpec {
  eyeSize: 'large' | 'small' | null;
  brows: boolean;
  mouthSize: 'large' | 'small' | null;
  /** P1000: 虹彩の色。指定すると目を部品として描く（まつげ線・虹彩・瞳孔・ハイライト） */
  iris?: [number, number, number] | null;
  /** P1000: 虹彩の色の名前（読み側の目の色と照合するための期待値） */
  irisName?: string | null;
}
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
  /** P963: 動きの質（速さとなめらかさ） */
  quality: { speed: number; tempo: 'fast' | 'slow' | 'steady'; smoothness: 'smooth' | 'jerky' | 'normal' } | null;
  qualityDescription: string;
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
  { name: '桜色', adj: '桜色の', rgb: [244, 206, 216] },
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
  /** P959: 肩の位置（手の向き＝腕の軸の算出に使う） */
  shoulderL: PosePoint | null;
  shoulderR: PosePoint | null;
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
  /** P960: 服を着ていないらしいか（肌色率から。判定できなければ null） */
  bare: boolean | null;
  bareDescription: string;
  /** P962: 重心（輪郭の重心と、足の支えの中心とのずれ） */
  balance: { centroidX: number; centroidY: number; lean: number; label: 'balanced' | 'left' | 'right' } | null;
  balanceDescription: string;
  /** P964: 髪の長さ */
  hair: { length: 'short' | 'medium' | 'long'; lengthRatio: number } | null;
  hairDescription: string;
  /** P966: 鎖骨の影（肌の帯でのみ判定、読めなければ null） */
  collarbone: boolean | null;
  collarboneDescription: string;
  /** P984: 首のくびれが見えるか */
  neck: boolean | null;
  neckDescription: string;
  /** P986: 腕の長さ（long=長い / short=短い / null=普通は言わない） */
  armLength: 'long' | 'short' | null;
  armLengthDescription: string;
  /** P987: 脚の長さ（立つ姿勢の時だけ読む） */
  legLength: 'long' | 'short' | null;
  legLengthDescription: string;
  /** P991: 素体プロファイル（部位ごとの幅 ÷ 図の高さ） */
  bodyProfile: { shoulder: number | null; chest: number | null; waist: number | null; hip: number | null; thigh: number | null; calf: number | null; ankle: number | null };
  profileComplete: boolean;
  /** P1001: 輪郭の取り方（bin=色ビン / fine=細かいビン / fill=線で囲む）と詰まり具合 */
  maskMethod: 'bin' | 'fine' | 'fill';
  silhouetteDensity: number;
  /** P1001: 図が画像の下端で見切れているか */
  truncated: boolean;
  /** P973: 髪の形（下端のばらつきから） */
  hairShape: 'straight' | 'wavy' | 'curly' | null;
  hairShapeDescription: string;
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

/**
 * P1001: マスクの取り方・その2「線で囲まれた内側を塗る」。
 * 薄い色で描かれた線画は、色ビンでは肌が背景と同化して輪郭が
 * 細切れになる。暗い線を壁とみて、画像の縁からたどれる所を
 * 外側、それ以外（線＋囲まれた内側）を図とみなす。
 */
function buildMaskFill(rgba: Uint8Array | number[], width: number, height: number): Uint8Array | null {
  const line = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const lum = rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11;
    if (lum < 185) line[i] = 1;
  }
  // 1px 膨張で線の切れ目を塞ぐ。
  const wall = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!line[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx; const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) wall[ny * width + nx] = 1;
        }
      }
    }
  }
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) { stack.push(x); stack.push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { stack.push(y * width); stack.push(y * width + width - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    if (outside[p] || wall[p]) continue;
    outside[p] = 1;
    const x = p % width; const y = Math.floor(p / width);
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }
  const mask = new Uint8Array(width * height);
  let fg = 0;
  for (let i = 0; i < width * height; i++) if (!outside[i]) { mask[i] = 1; fg++; }
  const share = fg / (width * height);
  if (share < 0.02 || share > 0.8) return null;
  return mask;
}

/**
 * P1001: マスクの取り方・その3「細かい色ビン＋縁の色を背景に」。
 * 薄い肌色は粗いビンでは背景と同化する。32刻みのビンで分け、
 * 背景は画像の縁で一番多いビンとする。
 */
function buildMaskFine(rgba: Uint8Array | number[], width: number, height: number): Uint8Array | null {
  const keyGrid = new Array<string>(width * height).fill('');
  const borderBins = new Map<string, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (rgba[i * 4 + 3] < 128) continue;
      keyGrid[i] = `${Math.floor(rgba[i * 4] / 32)}-${Math.floor(rgba[i * 4 + 1] / 32)}-${Math.floor(rgba[i * 4 + 2] / 32)}`;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        borderBins.set(keyGrid[i], (borderBins.get(keyGrid[i]) || 0) + 1);
      }
    }
  }
  let bgKey = '';
  let bgCount = -1;
  for (const [k, c] of borderBins) if (c > bgCount) { bgCount = c; bgKey = k; }
  if (!bgKey) return null;
  const mask = new Uint8Array(width * height);
  let fg = 0;
  for (let i = 0; i < width * height; i++) {
    if (keyGrid[i] && keyGrid[i] !== bgKey) { mask[i] = 1; fg++; }
  }
  const share = fg / (width * height);
  if (share < 0.02 || share > 0.8) return null;
  return mask;
}

/**
 * P1003: 線による領域分割の第1段。暗い線（輪郭線）を壁として
 * 領域に区切り、髪の領域を取り除いた「体だけのマスク」を返す。
 * 後ろ髪が体の幅に混ざる問題は色では分けられないため、
 * 線で区切った領域の単位で髪と体を分ける。
 * 髪の判定：図の上部1割の平均色に近く、肌色でない領域。
 */
function segmentBodyMask(rgba: Uint8Array | number[], width: number, height: number): { body: Uint8Array; hair: Uint8Array } | null {
  const N = width * height;
  const lumArr = new Float32Array(N);
  for (let i = 0; i < N; i++) lumArr[i] = rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11;
  const wall = new Uint8Array(N);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (rgba[i * 4 + 3] < 128) { wall[i] = 1; continue; }
      // 線とは「近傍よりはっきり暗い画素」。暗い色の服の内側は
      // 近傍も同じ暗さなので線にならない（面と線の区別）。
      let sum = 0; let n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        sum += lumArr[ny * width + nx]; n++;
      }
      if (lumArr[i] < sum / Math.max(1, n) - 22) wall[i] = 1;
    }
  }
  // 壁を1px膨らませて、線の切れ目を塞ぐ。
  const wallDil = new Uint8Array(wall);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!wall[y * width + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx; const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) wallDil[ny * width + nx] = 1;
      }
    }
  }
  wall.set(wallDil);
  const comp = new Int32Array(N).fill(-1);
  const regions: Array<{ area: number; r: number; g: number; b: number; touchesBorder: boolean; minX: number; maxX: number; minY: number; maxY: number }> = [];
  const stack: number[] = [];
  for (let s = 0; s < N; s++) {
    if (wall[s] || comp[s] >= 0) continue;
    const id = regions.length;
    let area = 0; let r = 0; let g = 0; let b = 0; let touchesBorder = false; let minX = width; let maxX = -1; let minY = height; let maxY = -1;
    stack.length = 0;
    stack.push(s);
    comp[s] = id;
    while (stack.length) {
      const cur = stack.pop() as number;
      const cx = cur % width; const cy = Math.floor(cur / width);
      area++;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      r += rgba[cur * 4]; g += rgba[cur * 4 + 1]; b += rgba[cur * 4 + 2];
      if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) touchesBorder = true;
      const nb = [cx > 0 ? cur - 1 : -1, cx < width - 1 ? cur + 1 : -1, cy > 0 ? cur - width : -1, cy < height - 1 ? cur + width : -1];
      for (const n of nb) if (n >= 0 && !wall[n] && comp[n] < 0) { comp[n] = id; stack.push(n); }
    }
    regions.push({ area, r: r / Math.max(1, area), g: g / Math.max(1, area), b: b / Math.max(1, area), touchesBorder, minX, maxX, minY, maxY });
  }
  if (!regions.length) return null;
  // 背景＝縁に触れる最大の領域
  let bgId = -1; let bgArea = -1;
  regions.forEach((rg, i) => { if (rg.touchesBorder && rg.area > bgArea) { bgArea = rg.area; bgId = i; } });
  if (bgId < 0) return null;
  // 図の範囲（背景以外の領域の外接）
  let figTop = height; let figBottom = -1; let figLeft = width; let figRight = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = comp[y * width + x];
    if (c >= 0 && c !== bgId) { if (y < figTop) figTop = y; if (y > figBottom) figBottom = y; if (x < figLeft) figLeft = x; if (x > figRight) figRight = x; }
  }
  if (figBottom < 0) return null;
  const figH = figBottom - figTop + 1;
  // 髪色の見本：図の上部1割・中央寄りの非背景画素の平均
  let hr = 0; let hg = 0; let hb = 0; let hn = 0;
  const cxMid = (figLeft + figRight) / 2;
  for (let y = figTop; y <= Math.min(figBottom, figTop + figH * 0.1); y++) {
    for (let x = Math.max(0, Math.floor(cxMid - (figRight - figLeft) * 0.3)); x <= Math.min(width - 1, Math.ceil(cxMid + (figRight - figLeft) * 0.3)); x++) {
      const c = comp[y * width + x];
      if (c < 0 || c === bgId) continue;
      hr += rgba[(y * width + x) * 4]; hg += rgba[(y * width + x) * 4 + 1]; hb += rgba[(y * width + x) * 4 + 2]; hn++;
    }
  }
  if (hn < 10) return null;
  hr /= hn; hg /= hn; hb /= hn;
  // 肌は r ≥ g ≥ b の順で、ピンクの髪（g < b）と区別する。薄い肌にも効く形。
  const isSkinAvg = (r: number, g: number, b: number): boolean => r > 190 && g >= b && r - b >= 12;
  const hairIds = new Set<number>();
  const figCxEst = (figLeft + figRight) / 2;
  const figWEst = figRight - figLeft + 1;
  regions.forEach((rg, i) => {
    if (i === bgId || rg.area < 12) return;
    // 髪らしい場所：頭の上部にあるか、中心から横にずれている。
    // 体の中心にある領域は水着などの服として守る。
    const centerX = (rg.minX + rg.maxX) / 2;
    const inTopBand = rg.minY <= figTop + figH * 0.12;
    const offCenter = Math.abs(centerX - figCxEst) > figWEst * 0.18;
    // 図の面積の2割を超える大きな領域は服ではない（背後の髪など）。
    const huge = rg.area > figWEst * figH * 0.2;
    if (!inTopBand && !offCenter && !huge) return;
    const dist = Math.abs(rg.r - hr) + Math.abs(rg.g - hg) + Math.abs(rg.b - hb);
    if (dist <= 80 && !isSkinAvg(rg.r, rg.g, rg.b)) hairIds.add(i);
  });
  if (!hairIds.size) return null;
  const mask = new Uint8Array(N);
  const hairMask = new Uint8Array(N);
  let fg = 0;
  for (let i = 0; i < N; i++) {
    const c = comp[i];
    if (c >= 0 && hairIds.has(c)) hairMask[i] = 1;
    if (c >= 0 && c !== bgId && !hairIds.has(c)) { mask[i] = 1; fg++; }
  }
  const bboxArea = (figRight - figLeft + 1) * figH;
  const share = fg / Math.max(1, bboxArea);
  if (share < 0.12 || share > 0.8) return null;
  // 髪で隠れた首など、縦の小さな隙間（3pxまで）を繋ぐ。
  for (let x = 0; x < width; x++) {
    let lastFg = -1;
    for (let y = 0; y < height; y++) {
      if (!mask[y * width + x]) continue;
      if (lastFg >= 0 && y - lastFg <= 4) {
        for (let yy = lastFg + 1; yy < y; yy++) mask[yy * width + x] = 1;
      }
      lastFg = y;
    }
  }
  return { body: mask, hair: hairMask };
}

/** P1001: 影色の自動生成。素の色を暗くし、少し冷たく寄せる（色のルール第1段） */
function deriveShadow(c: [number, number, number]): [number, number, number] {
  return [
    Math.max(0, Math.round(c[0] * 0.7 - 6)),
    Math.max(0, Math.round(c[1] * 0.7)),
    Math.min(255, Math.round(c[2] * 0.72 + 10)),
  ];
}

const TARGET_KEY = 'miki_visual_target_v1';

/** P1001: 目標の素体（見本を測って保存したパラメータ） */
export interface BodyTarget {
  profile: PoseReading['bodyProfile'];
  hairLength: 'short' | 'medium' | 'long' | null;
  hairColor: string | null;
  build: string | null;
}

/** P1001: マスクの詰まり具合（前景画素 ÷ 外接矩形の面積）。輪郭の細切れ検出に使う */
function maskDensity(mask: Uint8Array, width: number, height: number): number {
  let fg = 0; let minX = width; let maxX = -1; let minY = height; let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      fg++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (fg === 0 || maxX < 0) return 0;
  return fg / ((maxX - minX + 1) * (maxY - minY + 1));
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
  private load(): { analyzed: number; verified: number; motions: number; clothing: number; extras: number; multi: number; holding: number; bare: number; imitations: number; imitationsOk: number; balances: number; qualities: number; hairs: number; collarbones: number; hairShapes: number; necks: number; armLengths: number; legLengths: number; profiles: number; bodies: number; bodiesOk: number; facesDrawn: number; facesOk: number; smooth: number; smoothOk: number; shaded: number; shadedOk: number; curved: number; curvedOk: number; outline: number; outlineOk: number; eyesDrawn: number; eyesOk: number; maskFill: number; cel: number; celOk: number; hairDetail: number; hairDetailOk: number; bust: number; bustOk: number; targets: number; drills: number; drillsOk: number; clothes: number; clothesOk: number; lineRole: number; lineRoleOk: number; regions: number; frontHair: number; frontHairOk: number; drillLevel: number; elementDrills: number; elementDrillsOk: number; plateaus: number; graduations: number; recentLeans: string[]; recentTempos: string[] } {
    try {
      const raw = storageService.getJson(KEY, null) as { analyzed?: number; verified?: number; motions?: number; clothing?: number; extras?: number; multi?: number; holding?: number; bare?: number; imitations?: number; imitationsOk?: number; balances?: number; qualities?: number; hairs?: number; collarbones?: number; hairShapes?: number; necks?: number; armLengths?: number; legLengths?: number; profiles?: number; bodies?: number; bodiesOk?: number; facesDrawn?: number; facesOk?: number; smooth?: number; smoothOk?: number; shaded?: number; shadedOk?: number; curved?: number; curvedOk?: number; outline?: number; outlineOk?: number; eyesDrawn?: number; eyesOk?: number; maskFill?: number; cel?: number; celOk?: number; hairDetail?: number; hairDetailOk?: number; bust?: number; bustOk?: number; targets?: number; drills?: number; drillsOk?: number; clothes?: number; clothesOk?: number; lineRole?: number; lineRoleOk?: number; regions?: number; frontHair?: number; frontHairOk?: number; drillLevel?: number; elementDrills?: number; elementDrillsOk?: number; plateaus?: number; graduations?: number; recentLeans?: string[]; recentTempos?: string[] } | null;
      if (raw) return { analyzed: raw.analyzed || 0, verified: raw.verified || 0, motions: raw.motions || 0, clothing: raw.clothing || 0, extras: raw.extras || 0, multi: raw.multi || 0, holding: raw.holding || 0, bare: raw.bare || 0, imitations: raw.imitations || 0, imitationsOk: raw.imitationsOk || 0, balances: raw.balances || 0, qualities: raw.qualities || 0, hairs: raw.hairs || 0, collarbones: raw.collarbones || 0, hairShapes: raw.hairShapes || 0, necks: raw.necks || 0, armLengths: raw.armLengths || 0, legLengths: raw.legLengths || 0, profiles: raw.profiles || 0, bodies: raw.bodies || 0, bodiesOk: raw.bodiesOk || 0, facesDrawn: raw.facesDrawn || 0, facesOk: raw.facesOk || 0, smooth: raw.smooth || 0, smoothOk: raw.smoothOk || 0, shaded: raw.shaded || 0, shadedOk: raw.shadedOk || 0, curved: raw.curved || 0, curvedOk: raw.curvedOk || 0, outline: raw.outline || 0, outlineOk: raw.outlineOk || 0, eyesDrawn: raw.eyesDrawn || 0, eyesOk: raw.eyesOk || 0, maskFill: raw.maskFill || 0, cel: raw.cel || 0, celOk: raw.celOk || 0, hairDetail: raw.hairDetail || 0, hairDetailOk: raw.hairDetailOk || 0, bust: raw.bust || 0, bustOk: raw.bustOk || 0, targets: raw.targets || 0, drills: raw.drills || 0, drillsOk: raw.drillsOk || 0, clothes: raw.clothes || 0, clothesOk: raw.clothesOk || 0, lineRole: raw.lineRole || 0, lineRoleOk: raw.lineRoleOk || 0, regions: raw.regions || 0, frontHair: raw.frontHair || 0, frontHairOk: raw.frontHairOk || 0, drillLevel: raw.drillLevel || 1, elementDrills: raw.elementDrills || 0, elementDrillsOk: raw.elementDrillsOk || 0, plateaus: raw.plateaus || 0, graduations: raw.graduations || 0, recentLeans: Array.isArray(raw.recentLeans) ? raw.recentLeans : [], recentTempos: Array.isArray(raw.recentTempos) ? raw.recentTempos : [] };
    } catch { /* fall through */ }
    return { analyzed: 0, verified: 0, motions: 0, clothing: 0, extras: 0, multi: 0, holding: 0, bare: 0, imitations: 0, imitationsOk: 0, balances: 0, qualities: 0, hairs: 0, collarbones: 0, hairShapes: 0, necks: 0, armLengths: 0, legLengths: 0, profiles: 0, bodies: 0, bodiesOk: 0, facesDrawn: 0, facesOk: 0, smooth: 0, smoothOk: 0, shaded: 0, shadedOk: 0, curved: 0, curvedOk: 0, outline: 0, outlineOk: 0, eyesDrawn: 0, eyesOk: 0, maskFill: 0, cel: 0, celOk: 0, hairDetail: 0, hairDetailOk: 0, bust: 0, bustOk: 0, targets: 0, drills: 0, drillsOk: 0, clothes: 0, clothesOk: 0, lineRole: 0, lineRoleOk: 0, regions: 0, frontHair: 0, frontHairOk: 0, drillLevel: 1, elementDrills: 0, elementDrillsOk: 0, plateaus: 0, graduations: 0, recentLeans: [], recentTempos: [] };
  }

  public summary(): { analyzed: number; verified: number; motions: number; clothing: number; extras: number; multi: number; holding: number; bare: number; imitations: number; imitationsOk: number; balances: number; qualities: number; hairs: number; collarbones: number; hairShapes: number; necks: number; armLengths: number; legLengths: number; profiles: number; bodies: number; bodiesOk: number; facesDrawn: number; facesOk: number; smooth: number; smoothOk: number; shaded: number; shadedOk: number; curved: number; curvedOk: number; outline: number; outlineOk: number; eyesDrawn: number; eyesOk: number; maskFill: number; cel: number; celOk: number; hairDetail: number; hairDetailOk: number; bust: number; bustOk: number; targets: number; drills: number; drillsOk: number; clothes: number; clothesOk: number; lineRole: number; lineRoleOk: number; regions: number; frontHair: number; frontHairOk: number; drillLevel: number; elementDrills: number; elementDrillsOk: number; plateaus: number; graduations: number; leanWindow: number; habit: 'left' | 'balanced' | 'right' | null; qualityWindow: number; motionHabit: 'fast' | 'steady' | 'slow' | null } {
    const s = this.load();
    // P967: 姿勢の癖。最近20件の傾きのうち、10件以上あって
    // 6割以上が同じ向きなら、それを癖と読む。
    let habit: 'left' | 'balanced' | 'right' | null = null;
    if (s.recentLeans.length >= 10) {
      const counts = { left: 0, balanced: 0, right: 0 };
      for (const l of s.recentLeans) {
        if (l === 'left' || l === 'balanced' || l === 'right') counts[l]++;
      }
      const top = (Object.entries(counts) as [keyof typeof counts, number][]).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / s.recentLeans.length >= 0.6) habit = top[0];
    }
    // P975: 動きの癖。姿勢の癖と同じ物差しで、最近の
    // 動きの速さの傾向を読む。
    let motionHabit: 'fast' | 'steady' | 'slow' | null = null;
    if (s.recentTempos.length >= 10) {
      const counts = { fast: 0, steady: 0, slow: 0 };
      for (const t of s.recentTempos) {
        if (t === 'fast' || t === 'steady' || t === 'slow') counts[t]++;
      }
      const top = (Object.entries(counts) as [keyof typeof counts, number][]).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / s.recentTempos.length >= 0.6) motionHabit = top[0];
    }
    return { analyzed: s.analyzed, verified: s.verified, motions: s.motions, clothing: s.clothing, extras: s.extras, multi: s.multi, holding: s.holding, bare: s.bare, imitations: s.imitations, imitationsOk: s.imitationsOk, balances: s.balances, qualities: s.qualities, hairs: s.hairs, collarbones: s.collarbones, hairShapes: s.hairShapes, necks: s.necks, armLengths: s.armLengths, legLengths: s.legLengths, profiles: s.profiles, bodies: s.bodies, bodiesOk: s.bodiesOk, facesDrawn: s.facesDrawn, facesOk: s.facesOk, smooth: s.smooth, smoothOk: s.smoothOk, shaded: s.shaded, shadedOk: s.shadedOk, curved: s.curved, curvedOk: s.curvedOk, outline: s.outline, outlineOk: s.outlineOk, eyesDrawn: s.eyesDrawn, eyesOk: s.eyesOk, maskFill: s.maskFill, cel: s.cel, celOk: s.celOk, hairDetail: s.hairDetail, hairDetailOk: s.hairDetailOk, bust: s.bust, bustOk: s.bustOk, targets: s.targets, drills: s.drills, drillsOk: s.drillsOk, clothes: s.clothes, clothesOk: s.clothesOk, lineRole: s.lineRole, lineRoleOk: s.lineRoleOk, regions: s.regions, frontHair: s.frontHair, frontHairOk: s.frontHairOk, drillLevel: s.drillLevel, elementDrills: s.elementDrills, elementDrillsOk: s.elementDrillsOk, plateaus: s.plateaus, graduations: s.graduations, leanWindow: s.recentLeans.length, habit, qualityWindow: s.recentTempos.length, motionHabit };
  }

  /**
   * P961: 真似の第1段。姿勢読みの関節から棒人間を描き直し、
   * 描いた側を読み直して関節のずれで照合する。アバターの
   * 関節駆動の土台（測る→描く→測って比べる、の「描く」）。
   */
  public imitatePose(reading: PoseReading, size = 64): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    if (!reading.head) return null;
    const S = size;
    const px: Array<[number, number, number]> = [];
    for (let i = 0; i < S * S; i++) px.push([245, 245, 245]);
    const BODY: [number, number, number] = [40, 40, 120];
    const SKIN: [number, number, number] = [232, 190, 160];
    const stamp = (cx: number, cy: number, r: number, c: [number, number, number]) => {
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(S - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(S - 1, Math.ceil(cx + r)); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * S + x] = c;
        }
      }
    };
    const seg = (a: { x: number; y: number } | null, b: { x: number; y: number } | null, c: [number, number, number]) => {
      if (!a || !b) return;
      const ax = a.x * (S - 1), ay = a.y * (S - 1), bx = b.x * (S - 1), by = b.y * (S - 1);
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let i = 0; i <= steps; i++) stamp(ax + (bx - ax) * (i / steps), ay + (by - ay) * (i / steps), 1.6, c);
    };
    const head = reading.head;
    stamp(head.x * (S - 1), head.y * (S - 1), Math.max(2, head.r * S), SKIN);
    const neck = reading.shoulderL && reading.shoulderR
      ? { x: (reading.shoulderL.x + reading.shoulderR.x) / 2, y: (reading.shoulderL.y + reading.shoulderR.y) / 2 }
      : { x: head.x, y: head.y + head.r };
    const footMid = reading.footL && reading.footR
      ? { x: (reading.footL.x + reading.footR.x) / 2, y: (reading.footL.y + reading.footR.y) / 2 }
      : null;
    const hipC = footMid ? { x: neck.x + (footMid.x - neck.x) * 0.2, y: neck.y + (footMid.y - neck.y) * 0.45 } : null;
    seg(neck, reading.shoulderL, BODY);
    seg(neck, reading.shoulderR, BODY);
    seg(reading.shoulderL, reading.handL, BODY);
    seg(reading.shoulderR, reading.handR, BODY);
    seg(neck, hipC, BODY);
    seg(hipC, reading.footL, BODY);
    seg(hipC, reading.footR, BODY);
    const image = new Uint8Array(S * S * 4);
    px.forEach((c, i) => { image[i * 4] = c[0]; image[i * 4 + 1] = c[1]; image[i * 4 + 2] = c[2]; image[i * 4 + 3] = 255; });
    const re = this.analyzePose(image, S, S);
    let score = 0;
    let verified = false;
    if (re) {
      const pairs: Array<[{ x: number; y: number } | null, { x: number; y: number } | null]> = [
        [reading.head, re.head], [reading.handL, re.handL], [reading.handR, re.handR],
        [reading.footL, re.footL], [reading.footR, re.footR],
      ];
      let sum = 0;
      let n = 0;
      for (const [a, b] of pairs) {
        if (!a || !b) continue;
        sum += Math.hypot(a.x - b.x, a.y - b.y);
        n++;
      }
      if (n >= 3) {
        score = Math.max(0, 1 - (sum / n) / 0.25);
        verified = re.verified && score >= 0.7 && re.posture === reading.posture;
      }
    }
    const state = this.load();
    state.imitations++;
    if (verified) state.imitationsOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, image, size: S };
  }

  /**
   * P992: 素体レンダラ第1段。姿勢読みの関節と素体プロファイルから、
   * 塗りのある体の輪郭を描く。描いた側を測り直してプロファイルが
   * 一致するかで照合する（verifyBody）。服はまだ着せない。
   * P993: 髪も描く（読みの髪の長さに合わせ、照合にも含める）。
   * P995: 色の指定（髪は読みの色名から、体は指定色で描く）。
   */
  public renderBody(reading: PoseReading, size = 64, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean } | null = null): Uint8Array | null {
    if (!reading.head || !reading.profileComplete) return null;
    const S = size;
    const prof = reading.bodyProfile;
    const px: Array<[number, number, number]> = [];
    for (let i = 0; i < S * S; i++) px.push([245, 245, 245]);
    const BODY: [number, number, number] = colors?.body ?? [40, 40, 120];
    const SKIN: [number, number, number] = [232, 190, 160];
    const set = (x: number, y: number, c: [number, number, number]) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi >= 0 && xi < S && yi >= 0 && yi < S) px[yi * S + xi] = c;
    };
    const stamp = (cx: number, cy: number, r: number, c: [number, number, number]) => {
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(S - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(S - 1, Math.ceil(cx + r)); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px[y * S + x] = c;
        }
      }
    };
    const head = reading.head;
    const shoulderY = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.y + reading.shoulderR.y) / 2 : head.y + head.r * 1.6;
    const cxN = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.x + reading.shoulderR.x) / 2 : head.x;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const hipY = shoulderY + (footY - shoulderY) * 0.43;
    const figHn = Math.max(0.1, footY - (head.y - head.r));
    const W = (ratio: number | null, fallback: number) => (ratio !== null ? ratio * figHn * (S - 1) : fallback);
    const shoulderW = W(prof.shoulder, (S - 1) * 0.3);
    const chestW = W(prof.chest, shoulderW);
    const waistW = W(prof.waist, chestW);
    const hipW = W(prof.hip, waistW);
    // 脚の幅はプロファイルでは両脚の合計幅。1本分は合計の
    // 0.42倍、中心は ±0.27倍に置いて、股の隙間を残す。
    const thighW = W(prof.thigh, hipW) * 0.42;
    const calfW = W(prof.calf, thighW) * 0.42;
    const ankleW = W(prof.ankle, calfW) * 0.42;
    const legSpread = W(prof.thigh, hipW) * 0.27;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const torsoW = (t: number) => (t < 0.3 ? lerp(shoulderW, chestW, t / 0.3) : t < 0.55 ? lerp(chestW, waistW, (t - 0.3) / 0.25) : t < 0.85 ? waistW : lerp(waistW, hipW, (t - 0.85) / 0.15));
    // 胴：行ごとに幅を補間して塗る
    const y0 = Math.round(shoulderY * (S - 1)), y1 = Math.round(hipY * (S - 1));
    const bustAmt = shape?.bust ?? 0;
    for (let y = y0; y <= y1; y++) {
      const t = y1 > y0 ? (y - y0) / (y1 - y0) : 0;
      let w = torsoW(t);
      // P1001: 胸の曲線。胸の帯にガウス型のふくらみを足す。
      if (bustAmt > 0) w *= 1 + bustAmt * 0.16 * Math.exp(-(((t - 0.3) / 0.13) ** 2));
      for (let x = Math.round(cxN * (S - 1) - w / 2); x <= Math.round(cxN * (S - 1) + w / 2); x++) set(x, y, BODY);
    }
    // P1001: 胸の下の影の線（前面で胸の丸みとして読める要素）。
    if (bustAmt > 0) {
      const SHADE: [number, number, number] = [Math.max(0, BODY[0] * 0.7 - 6), Math.max(0, BODY[1] * 0.7), Math.min(255, BODY[2] * 0.72 + 10)];
      const by = y0 + (y1 - y0) * 0.45;
      const bw = torsoW(0.3) * (1 + bustAmt * 0.16) * 0.34;
      for (let x = Math.round(cxN * (S - 1) - bw); x <= Math.round(cxN * (S - 1) + bw); x++) {
        const dip = Math.cos(((x - cxN * (S - 1)) / Math.max(1, bw)) * Math.PI * 0.5) * (y1 - y0) * 0.03;
        set(x, by + dip, SHADE);
        set(x, by + dip + 1, SHADE);
      }
    }
    // 脚：腰から足先へ、太もも→ふくらはぎ→足首と細くする
    const legTop = y1, legBottom = Math.round(footY * (S - 1));
    for (const sideSign of [-1, 1]) {
      const foot = sideSign < 0 ? reading.footL : reading.footR;
      const hipX = cxN * (S - 1) + sideSign * legSpread;
      const footX = foot ? foot.x * (S - 1) : hipX;
      for (let y = legTop; y <= legBottom; y++) {
        const t = legBottom > legTop ? (y - legTop) / (legBottom - legTop) : 0;
        const w = t < 0.6 ? lerp(thighW, calfW, t / 0.6) : lerp(calfW, ankleW, (t - 0.6) / 0.4);
        const cxp = lerp(hipX, footX, t);
        for (let x = Math.round(cxp - w / 2); x <= Math.round(cxp + w / 2); x++) set(x, y, BODY);
      }
    }
    // 腕：肩から手へ太い線。P1001: 肩側を太く手首側を細く（テーパー）。
    const armR0 = Math.max(1.4, figHn * S * 0.03);
    const seg = (a: { x: number; y: number } | null, b: { x: number; y: number } | null) => {
      if (!a || !b) return;
      const ax = a.x * (S - 1), ay = a.y * (S - 1), bx = b.x * (S - 1), by = b.y * (S - 1);
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        stamp(ax + (bx - ax) * t, ay + (by - ay) * t, Math.max(1.1, armR0 * (1.18 - 0.48 * t)), BODY);
      }
    };
    seg(reading.shoulderL, reading.handL);
    seg(reading.shoulderR, reading.handR);
    // P1001: 手。腕の先に肌色の楕円＋指の分かれ目を描く。
    const FINGER: [number, number, number] = [150, 110, 82];
    for (const hand of [reading.handL, reading.handR]) {
      if (!hand) continue;
      const hx = hand.x * (S - 1), hy = hand.y * (S - 1);
      const rx = armR0 * 0.95, ry = armR0 * 1.7;
      for (let y = Math.round(hy - ry); y <= Math.round(hy + ry); y++) {
        for (let x = Math.round(hx - rx); x <= Math.round(hx + rx); x++) {
          if (((x - hx) / rx) ** 2 + ((y - hy) / ry) ** 2 <= 1) set(x, y, SKIN);
        }
      }
      for (const off of [-0.35, 0.35]) {
        for (let y = Math.round(hy + ry * 0.2); y <= Math.round(hy + ry * 0.95); y++) set(hx + rx * off, y, FINGER);
      }
    }
    // 首と頭。首は影の色で描く（肌色で描くと顔の読みで
    // 顔の範囲に首が混ざり、目と口の帯がずれるため）。
    const NECK: [number, number, number] = [168, 118, 92];
    const neckW = shoulderW * 0.3;
    for (let y = Math.round(head.y * (S - 1)); y <= y0; y++) {
      for (let x = Math.round(cxN * (S - 1) - neckW / 2); x <= Math.round(cxN * (S - 1) + neckW / 2); x++) set(x, y, NECK);
    }
    // P993: 髪。読みの髪の長さに合わせて、頭の上と両脇を覆う。
    // 顔の部分は肌の頭を後から描いて出す。
    // P995: 髪の色は読みの色名から引く（指定があればそちら）。
    if (reading.hair) {
      const HAIR: [number, number, number] = colors?.hair ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
      const hairTopY = (head.y - head.r) * (S - 1);
      const hairBottomY = hairTopY + reading.hair.lengthRatio * figHn * (S - 1);
      const hx = head.x * (S - 1), hr = Math.max(2, head.r * S);
      const hy = head.y * (S - 1);
      for (let y = Math.round(hairTopY); y <= Math.round(hairBottomY); y++) {
        const inCap = y <= hy;
        // 上部は頭の丸みに沿わせる（一番上の行が広いと
        // 人の形の門で頭と認められないため）。
        const half = inCap ? Math.sqrt(Math.max(0, hr * hr - (y - hy) * (y - hy))) * 1.12 : hr * 0.95;
        for (let x = Math.round(hx - half); x <= Math.round(hx + half); x++) {
          if (!inCap && Math.abs(x - hx) < hr * 0.55) continue;
          set(x, y, HAIR);
        }
      }
    }
    // 顔は頭より一回り小さく、少し下に描く（髪が上と脇に残る）。
    if (reading.hair) stamp(head.x * (S - 1), head.y * (S - 1) + Math.max(2, head.r * S) * 0.15, Math.max(2, head.r * S) * 0.8, SKIN);
    else stamp(head.x * (S - 1), head.y * (S - 1), Math.max(2, head.r * S), SKIN);
    const hrPx = Math.max(2, head.r * S);
    const faceR = reading.hair ? hrPx * 0.8 : hrPx;
    const faceCy = head.y * (S - 1) + (reading.hair ? hrPx * 0.15 : 0);
    const hxPx = head.x * (S - 1);
    // P1006: 前髪。顔の上部に、房の先が下がる波形の下端で髪を描く。
    // 房の境目は下端が上がって額の肌が見える（＝房の分かれ）。
    // 顔の中身より先に描くので、眉と目は前髪の上から読める。
    if (shape?.frontHair && reading.hair) {
      const HAIR: [number, number, number] = colors?.hair ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
      const hyPx = head.y * (S - 1);
      const strandW = Math.max(3, faceR * 0.55);
      for (let y = Math.round(faceCy - faceR); y <= Math.round(faceCy - faceR * 0.3); y++) {
        const half = Math.sqrt(Math.max(0, hrPx * hrPx - (y - hyPx) * (y - hyPx)));
        for (let x = Math.round(hxPx - Math.min(half, faceR)); x <= Math.round(hxPx + Math.min(half, faceR)); x++) {
          const u = (((x - hxPx) % strandW) + strandW) % strandW / strandW;
          const edge = faceCy - faceR * (0.78 - 0.33 * Math.sin(Math.PI * u));
          if (y <= edge) set(x, y, HAIR);
        }
      }
    }
    // P994: 顔の中身（目・眉・口）を指定どおりに描く。
    if (face) {
      const DARK: [number, number, number] = [30, 30, 30];
      const eyeY = faceCy - faceR * 0.1;
      const eyeDX = faceR * 0.42;
      const eyeR = face.eyeSize === 'large' ? faceR * 0.22 : face.eyeSize === 'small' ? faceR * 0.1 : faceR * 0.15;
      if (face.iris) {
        // P1000: 目を部品として描く。まつげ線（太い上の線）→虹彩→瞳孔→ハイライト。
        const WHITE: [number, number, number] = [250, 250, 250];
        for (const sgn of [-1, 1]) {
          const ex = hxPx + sgn * eyeDX;
          // まつげ線：目の上の太い線（眉の帯と混ざらないよう目に寄せる）
          const lashY = eyeY - eyeR * 1.05;
          const lashT = Math.max(1, eyeR * 0.4);
          for (let y = Math.round(lashY - lashT / 2); y <= Math.round(lashY + lashT / 2); y++) {
            for (let x = Math.round(ex - eyeR * 1.05); x <= Math.round(ex + eyeR * 1.05); x++) set(x, y, DARK);
          }
          stamp(ex, eyeY, eyeR, face.iris);
          stamp(ex, eyeY, Math.max(1, eyeR * 0.4), DARK);
          stamp(ex - eyeR * 0.3, eyeY - eyeR * 0.3, Math.max(1, eyeR * 0.24), WHITE);
        }
      } else {
        stamp(hxPx - eyeDX, eyeY, eyeR, DARK);
        stamp(hxPx + eyeDX, eyeY, eyeR, DARK);
      }
      if (face.brows) {
        const browY = faceCy - faceR * 0.68;
        const browT = Math.max(1, faceR * 0.07);
        for (const sgn of [-1, 1]) {
          for (let y = Math.round(browY - browT / 2); y <= Math.round(browY + browT / 2); y++) {
            for (let x = Math.round(hxPx + sgn * eyeDX - faceR * 0.24); x <= Math.round(hxPx + sgn * eyeDX + faceR * 0.24); x++) set(x, y, DARK);
          }
        }
      }
      const mw = face.mouthSize === 'large' ? faceR * 0.8 : face.mouthSize === 'small' ? faceR * 0.22 : faceR * 0.45;
      const mouthY = faceCy + faceR * 0.55;
      const mouthT = Math.max(1, faceR * 0.12);
      for (let y = Math.round(mouthY - mouthT / 2); y <= Math.round(mouthY + mouthT / 2); y++) {
        for (let x = Math.round(hxPx - mw / 2); x <= Math.round(hxPx + mw / 2); x++) set(x, y, DARK);
      }
    }
    const image = new Uint8Array(S * S * 4);
    px.forEach((c, i) => { image[i * 4] = c[0]; image[i * 4 + 1] = c[1]; image[i * 4 + 2] = c[2]; image[i * 4 + 3] = 255; });
    return image;
  }

  /** P992: 描いた素体を測り直し、プロファイルの一致で照合する */
  public verifyBody(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const image = this.renderBody(reading, 64);
    if (!image) return null;
    const re = this.analyzePose(image, 64, 64);
    let score = 0;
    let verified = false;
    if (re) {
      const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
      let ok = 0;
      let compared = 0;
      for (const k of keys) {
        const a = reading.bodyProfile[k];
        const b = re.bodyProfile[k];
        if (a === null || b === null) continue;
        compared++;
        if (Math.abs(a - b) <= 0.09) ok++;
      }
      // P993: 髪の長さの一致も照合に含める。
      if (reading.hair && re.hair) {
        compared++;
        if (reading.hair.length === re.hair.length) ok++;
      }
      // P995: 髪の色の一致も照合に含める。
      if (reading.hairColor && re.hairColor) {
        compared++;
        if (reading.hairColor === re.hairColor) ok++;
      }
      if (compared >= 4) {
        score = ok / compared;
        verified = score >= 0.7;
      }
    }
    const state = this.load();
    state.bodies++;
    if (verified) state.bodiesOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, image, size: 64 };
  }

  /**
   * P996: 滑らか描画の第1段。3倍の大きさで描いてから
   * 平均で縮小し、輪郭の階段を消す（アンチエイリアス）。
   * パラメータは解像度に依存しないので、読みはそのまま使える。
   */
  public renderBodySmooth(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean } | null = null): Uint8Array | null {
    const SS = 3;
    const big = this.renderBody(reading, size * SS, face, colors, shape);
    if (!big) return null;
    const B = size * SS;
    const out = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * B + (x * SS + dx)) * 4;
            r += big[i]; g += big[i + 1]; b += big[i + 2];
          }
        }
        const o = (y * size + x) * 4;
        out[o] = Math.round(r / (SS * SS));
        out[o + 1] = Math.round(g / (SS * SS));
        out[o + 2] = Math.round(b / (SS * SS));
        out[o + 3] = 255;
      }
    }
    return out;
  }

  /** P996: 滑らかに描いた素体も、測り直して同じ読みになるか */
  public verifyBodySmooth(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const image = this.renderBodySmooth(reading, 192);
    if (!image) return null;
    const re = this.analyzePose(image, 192, 192);
    let score = 0;
    let verified = false;
    if (re) {
      const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
      let ok = 0;
      let compared = 0;
      for (const k of keys) {
        const a = reading.bodyProfile[k];
        const b = re.bodyProfile[k];
        if (a === null || b === null) continue;
        compared++;
        if (Math.abs(a - b) <= 0.09) ok++;
      }
      if (reading.hair && re.hair) {
        compared++;
        if (reading.hair.length === re.hair.length) ok++;
      }
      if (compared >= 4) {
        score = ok / compared;
        verified = score >= 0.7;
      }
    }
    const state = this.load();
    state.smooth++;
    if (verified) state.smoothOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, image, size: 192 };
  }

  /**
   * P997: 陰影の第1段。平らに描いた素体の各行の塊に、
   * 円筒として光を当てる（中央が明るく、縁ほど暗く）。
   * 輪郭は変えず、明るさだけを付ける。
   */
  public renderBodyShaded(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, light = 0.3): Uint8Array | null {
    const SS = 3;
    const B = size * SS;
    const big = this.renderBody(reading, B, face, colors);
    if (!big) return null;
    const bg: [number, number, number] = [big[0], big[1], big[2]];
    const shaded = new Uint8Array(B * B * 4);
    for (let y = 0; y < B; y++) {
      let x = 0;
      while (x < B) {
        const i = (y * B + x) * 4;
        if (big[i] === bg[0] && big[i + 1] === bg[1] && big[i + 2] === bg[2]) {
          shaded[i] = bg[0]; shaded[i + 1] = bg[1]; shaded[i + 2] = bg[2]; shaded[i + 3] = 255;
          x++;
          continue;
        }
        let x1 = x;
        while (x1 < B) {
          const j = (y * B + x1) * 4;
          if (big[j] === bg[0] && big[j + 1] === bg[1] && big[j + 2] === bg[2]) break;
          x1++;
        }
        const cx = (x + x1 - 1) / 2;
        const hw = Math.max(1, (x1 - x) / 2);
        for (let xx = x; xx < x1; xx++) {
          const j = (y * B + xx) * 4;
          const t = (xx - cx) / hw;
          const f = 1 - light * t * t;
          shaded[j] = Math.max(0, Math.min(255, Math.round(big[j] * f)));
          shaded[j + 1] = Math.max(0, Math.min(255, Math.round(big[j + 1] * f)));
          shaded[j + 2] = Math.max(0, Math.min(255, Math.round(big[j + 2] * f)));
          shaded[j + 3] = 255;
        }
        x = x1;
      }
    }
    // 3倍から縮小（平均）
    const out = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * B + (x * SS + dx)) * 4;
            r += shaded[i]; g += shaded[i + 1]; b += shaded[i + 2];
          }
        }
        const o = (y * size + x) * 4;
        out[o] = Math.round(r / (SS * SS));
        out[o + 1] = Math.round(g / (SS * SS));
        out[o + 2] = Math.round(b / (SS * SS));
        out[o + 3] = 255;
      }
    }
    return out;
  }

  /** P997: 陰影を付けても輪郭は変わらず、縁が中央より暗いか */
  public verifyBodyShaded(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const size = 192;
    const flat = this.renderBodySmooth(reading, size);
    const shaded = this.renderBodyShaded(reading, size);
    if (!flat || !shaded) return null;
    const bgF: [number, number, number] = [flat[0], flat[1], flat[2]];
    const bgS: [number, number, number] = [shaded[0], shaded[1], shaded[2]];
    const isBg = (img: Uint8Array, bg: [number, number, number], i: number): boolean => Math.abs(img[i] - bg[0]) <= 4 && Math.abs(img[i + 1] - bg[1]) <= 4 && Math.abs(img[i + 2] - bg[2]) <= 4;
    let rowsAgree = 0;
    let rowsTotal = 0;
    let centerSum = 0;
    let edgeSum = 0;
    let shadeCount = 0;
    for (let y = 0; y < size; y++) {
      // 平らな描画の塊（行の前景の範囲）
      let fx0 = -1;
      let fx1 = -1;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (!isBg(flat, bgF, i)) { if (fx0 < 0) fx0 = x; fx1 = x; }
      }
      if (fx0 < 0) continue;
      rowsTotal++;
      let sx0 = -1;
      let sx1 = -1;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (!isBg(shaded, bgS, i)) { if (sx0 < 0) sx0 = x; sx1 = x; }
      }
      if (sx0 >= 0 && Math.abs(sx0 - fx0) <= 2 && Math.abs(sx1 - fx1) <= 2) rowsAgree++;
      if (fx1 - fx0 >= 12) {
        const ci = (y * size + Math.round((fx0 + fx1) / 2)) * 4;
        const ei = (y * size + fx0 + 1) * 4;
        centerSum += shaded[ci] + shaded[ci + 1] + shaded[ci + 2];
        edgeSum += shaded[ei] + shaded[ei + 1] + shaded[ei + 2];
        shadeCount++;
      }
    }
    const geom = rowsTotal > 0 ? rowsAgree / rowsTotal : 0;
    const shadingPresent = shadeCount >= 10 && edgeSum < centerSum * 0.97;
    const score = geom;
    const verified = geom >= 0.9 && shadingPresent;
    const state = this.load();
    state.shaded++;
    if (verified) state.shadedOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, image: shaded, size };
  }

  /**
   * P998: 輪郭の曲線化の第1段。平らに描いた素体のマスクを
   * ぼかしてから半分で切り直し、角と折れ目を丸める。
   * 色は元の絵から取り、輪郭だけを滑らかにする。
   */
  public renderBodyCurved(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null): Uint8Array | null {
    const SS = 3;
    const B = size * SS;
    const big = this.renderBody(reading, B, face, colors);
    if (!big) return null;
    const bg: [number, number, number] = [big[0], big[1], big[2]];
    const isBgAt = (idx: number): boolean => big[idx * 4] === bg[0] && big[idx * 4 + 1] === bg[1] && big[idx * 4 + 2] === bg[2];
    let mask = new Float32Array(B * B);
    for (let i = 0; i < B * B; i++) mask[i] = isBgAt(i) ? 0 : 1;
    // 箱ぼかし（横→縦）を2回かけて輪郭を丸める
    const R = SS;
    const blurOnce = (src: Float32Array): Float32Array => {
      const tmp = new Float32Array(B * B);
      const dst = new Float32Array(B * B);
      for (let y = 0; y < B; y++) {
        for (let x = 0; x < B; x++) {
          let sum = 0;
          let n = 0;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= B) continue;
            sum += src[y * B + xx];
            n++;
          }
          tmp[y * B + x] = sum / n;
        }
      }
      for (let y = 0; y < B; y++) {
        for (let x = 0; x < B; x++) {
          let sum = 0;
          let n = 0;
          for (let dy = -R; dy <= R; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= B) continue;
            sum += tmp[yy * B + x];
            n++;
          }
          dst[y * B + x] = sum / n;
        }
      }
      return dst;
    };
    const blurred = blurOnce(blurOnce(mask));
    mask = blurred as typeof mask;
    // 0.5で切り直し、色は元の絵（新規に内側になる画素は行内で一番近い前景）から取る
    const curved = new Uint8Array(B * B * 4);
    for (let y = 0; y < B; y++) {
      for (let x = 0; x < B; x++) {
        const idx = y * B + x;
        const o = idx * 4;
        if (mask[idx] < 0.5) {
          curved[o] = bg[0]; curved[o + 1] = bg[1]; curved[o + 2] = bg[2]; curved[o + 3] = 255;
          continue;
        }
        if (!isBgAt(idx)) {
          curved[o] = big[o]; curved[o + 1] = big[o + 1]; curved[o + 2] = big[o + 2]; curved[o + 3] = 255;
          continue;
        }
        // 元は背景だった画素：同じ行で一番近い前景の色を借りる
        let done = false;
        for (let d = 1; d <= R * 3 && !done; d++) {
          for (const xx of [x - d, x + d]) {
            if (xx < 0 || xx >= B) continue;
            const j = (y * B + xx) * 4;
            if (!(big[j] === bg[0] && big[j + 1] === bg[1] && big[j + 2] === bg[2])) {
              curved[o] = big[j]; curved[o + 1] = big[j + 1]; curved[o + 2] = big[j + 2]; curved[o + 3] = 255;
              done = true;
              break;
            }
          }
        }
        if (!done) { curved[o] = bg[0]; curved[o + 1] = bg[1]; curved[o + 2] = bg[2]; curved[o + 3] = 255; }
      }
    }
    // 3倍から縮小（平均）
    const out = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * B + (x * SS + dx)) * 4;
            r += curved[i]; g += curved[i + 1]; b += curved[i + 2];
          }
        }
        const o = (y * size + x) * 4;
        out[o] = Math.round(r / (SS * SS));
        out[o + 1] = Math.round(g / (SS * SS));
        out[o + 2] = Math.round(b / (SS * SS));
        out[o + 3] = 255;
      }
    }
    return out;
  }

  /** P998: 輪郭を曲線化しても、測り直すと同じ読みになるか */
  public verifyBodyCurved(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const image = this.renderBodyCurved(reading, 192);
    if (!image) return null;
    const re = this.analyzePose(image, 192, 192);
    let score = 0;
    let verified = false;
    if (re) {
      const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
      let ok = 0;
      let compared = 0;
      for (const k of keys) {
        const a = reading.bodyProfile[k];
        const b = re.bodyProfile[k];
        if (a === null || b === null) continue;
        compared++;
        if (Math.abs(a - b) <= 0.09) ok++;
      }
      if (reading.hair && re.hair) {
        compared++;
        if (reading.hair.length === re.hair.length) ok++;
      }
      if (compared >= 4) {
        score = ok / compared;
        verified = score >= 0.7;
      }
    }
    const state = this.load();
    state.curved++;
    if (verified) state.curvedOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, image, size: 192 };
  }

  /**
   * P999: 線画の第1段。素体の輪郭に線を引く。線の色は真っ黒ではなく、
   * 触れている領域の色を濃くした色線にする（LIN-05）。
   * 線は輪郭の内側に引き、輪郭そのものは変えない。
   */
  public renderBodyOutline(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean } | null = null): Uint8Array | null {
    const SS = 3;
    const B = size * SS;
    const big = this.renderBody(reading, B, face, colors, shape);
    if (!big) return null;
    const bg: [number, number, number] = [big[0], big[1], big[2]];
    const isBg = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= B || y >= B) return true;
      const i = (y * B + x) * 4;
      return big[i] === bg[0] && big[i + 1] === bg[1] && big[i + 2] === bg[2];
    };
    const w = SS; // 線の厚み（大きい側で約3px＝縮小後に約1px）
    const lined = new Uint8Array(big);
    for (let y = 0; y < B; y++) {
      for (let x = 0; x < B; x++) {
        if (isBg(x, y)) continue;
        // 背景までの距離が w 以内なら輪郭帯
        let nearBg = false;
        for (let dy = -w; dy <= w && !nearBg; dy++) {
          for (let dx = -w; dx <= w; dx++) {
            if (isBg(x + dx, y + dy)) { nearBg = true; break; }
          }
        }
        if (!nearBg) continue;
        const i = (y * B + x) * 4;
        lined[i] = Math.round(big[i] * 0.42);
        lined[i + 1] = Math.round(big[i + 1] * 0.42);
        lined[i + 2] = Math.round(big[i + 2] * 0.42);
        lined[i + 3] = 255;
      }
    }
    // 3倍から縮小（平均）
    const out = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * B + (x * SS + dx)) * 4;
            r += lined[i]; g += lined[i + 1]; b += lined[i + 2];
          }
        }
        const o = (y * size + x) * 4;
        out[o] = Math.round(r / (SS * SS));
        out[o + 1] = Math.round(g / (SS * SS));
        out[o + 2] = Math.round(b / (SS * SS));
        out[o + 3] = 255;
      }
    }
    return out;
  }

  /** P999: 線を引いても輪郭は変わらず、輪郭帯が内側より暗いか */
  public verifyBodyOutline(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const size = 192;
    const flat = this.renderBodySmooth(reading, size);
    const lined = this.renderBodyOutline(reading, size);
    if (!flat || !lined) return null;
    const bgF: [number, number, number] = [flat[0], flat[1], flat[2]];
    const bgL: [number, number, number] = [lined[0], lined[1], lined[2]];
    const isBg = (img: Uint8Array, bg: [number, number, number], i: number): boolean => Math.abs(img[i] - bg[0]) <= 4 && Math.abs(img[i + 1] - bg[1]) <= 4 && Math.abs(img[i + 2] - bg[2]) <= 4;
    let rowsAgree = 0;
    let rowsTotal = 0;
    let bandSum = 0;
    let innerSum = 0;
    let bandCount = 0;
    for (let y = 0; y < size; y++) {
      let fx0 = -1;
      let fx1 = -1;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (!isBg(flat, bgF, i)) { if (fx0 < 0) fx0 = x; fx1 = x; }
      }
      if (fx0 < 0) continue;
      rowsTotal++;
      let lx0 = -1;
      let lx1 = -1;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (!isBg(lined, bgL, i)) { if (lx0 < 0) lx0 = x; lx1 = x; }
      }
      if (lx0 >= 0 && Math.abs(lx0 - fx0) <= 2 && Math.abs(lx1 - fx1) <= 2) rowsAgree++;
      if (fx1 - fx0 >= 16) {
        const bi = (y * size + fx0 + 1) * 4;
        const ci = (y * size + Math.round((fx0 + fx1) / 2)) * 4;
        bandSum += lined[bi] + lined[bi + 1] + lined[bi + 2];
        innerSum += lined[ci] + lined[ci + 1] + lined[ci + 2];
        bandCount++;
      }
    }
    const geom = rowsTotal > 0 ? rowsAgree / rowsTotal : 0;
    const linePresent = bandCount >= 10 && bandSum < innerSum * 0.8;
    const verified = geom >= 0.9 && linePresent;
    const state = this.load();
    state.outline++;
    if (verified) state.outlineOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score: geom, verified, image: lined, size };
  }

  /**
   * P1001: 2段陰影（セルシェーディング）。滑らか描画の各行の
   * 右側3割を、その画素の素の色から自動生成した影色に置く。
   * 影は色の領域として描く（グラデーションではない）。
   * 暗い特徴（目や口）は影に巻き込まない。
   */
  public renderBodyCel(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean } | null = null): Uint8Array | null {
    const base = this.renderBodySmooth(reading, size, face, colors, shape);
    if (!base) return null;
    const out = new Uint8Array(base);
    const bg: [number, number, number] = [base[0], base[1], base[2]];
    const isFg = (i: number): boolean => Math.abs(out[i] - bg[0]) + Math.abs(out[i + 1] - bg[1]) + Math.abs(out[i + 2] - bg[2]) > 12;
    for (let y = 0; y < size; y++) {
      let x = 0;
      while (x < size) {
        const i0 = (y * size + x) * 4;
        if (!isFg(i0)) { x++; continue; }
        let x1 = x;
        while (x1 + 1 < size && isFg((y * size + x1 + 1) * 4)) x1++;
        const spanW = x1 - x + 1;
        const shadowFrom = x + Math.floor(spanW * 0.7);
        for (let sx = shadowFrom; sx <= x1; sx++) {
          const i = (y * size + sx) * 4;
          const lum = out[i] * 0.3 + out[i + 1] * 0.59 + out[i + 2] * 0.11;
          if (lum < 95) continue;
          const sh = deriveShadow([out[i], out[i + 1], out[i + 2]]);
          out[i] = sh[0]; out[i + 1] = sh[1]; out[i + 2] = sh[2];
        }
        x = x1 + 1;
      }
    }
    return out;
  }

  /** P1001: セルシェーディングの照合。輪郭の一致＋右側が影色になっているか */
  public verifyBodyCel(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const size = 192;
    const flat = this.renderBodySmooth(reading, size);
    const cel = this.renderBodyCel(reading, size);
    if (!flat || !cel) return null;
    const bg: [number, number, number] = [flat[0], flat[1], flat[2]];
    const isBg = (img: Uint8Array, i: number): boolean => Math.abs(img[i] - bg[0]) <= 10 && Math.abs(img[i + 1] - bg[1]) <= 10 && Math.abs(img[i + 2] - bg[2]) <= 10;
    let rowsTotal = 0;
    let rowsAgree = 0;
    let rightFlat = 0;
    let rightCel = 0;
    let rightN = 0;
    let leftFlat = 0;
    let leftCel = 0;
    let leftN = 0;
    for (let y = 0; y < size; y++) {
      let fx0 = -1; let fx1 = -1; let cx0 = -1; let cx1 = -1;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (!isBg(flat, i)) { if (fx0 < 0) fx0 = x; fx1 = x; }
        if (!isBg(cel, i)) { if (cx0 < 0) cx0 = x; cx1 = x; }
      }
      if (fx0 < 0) continue;
      rowsTotal++;
      if (cx0 >= 0 && Math.abs(cx0 - fx0) <= 2 && Math.abs(cx1 - fx1) <= 2) rowsAgree++;
      if (fx1 - fx0 >= 24) {
        const li = (y * size + fx0 + 3) * 4;
        const ri = (y * size + fx1 - 3) * 4;
        leftFlat += flat[li] + flat[li + 1] + flat[li + 2];
        leftCel += cel[li] + cel[li + 1] + cel[li + 2];
        leftN++;
        const fl = flat[ri] * 0.3 + flat[ri + 1] * 0.59 + flat[ri + 2] * 0.11;
        if (fl >= 95) {
          rightFlat += flat[ri] + flat[ri + 1] + flat[ri + 2];
          rightCel += cel[ri] + cel[ri + 1] + cel[ri + 2];
          rightN++;
        }
      }
    }
    const geom = rowsTotal > 0 ? rowsAgree / rowsTotal : 0;
    const shadowed = rightN >= 10 && rightCel < rightFlat * 0.85;
    const leftSame = leftN >= 10 && Math.abs(leftCel - leftFlat) <= leftFlat * 0.08;
    const verified = geom >= 0.9 && shadowed && leftSame;
    const state = this.load();
    state.cel++;
    if (verified) state.celOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score: geom, verified, image: cel, size };
  }

  /**
   * P1001: 髪の作画部品。セル描画の髪に、ツヤの帯（頭の上の
   * 明るい帯）と房の分かれ目（影色の細い線）を入れる。
   */
  public renderBodyHairDetail(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean } | null = null): Uint8Array | null {
    const base = this.renderBodyCel(reading, size, face, colors, shape);
    if (!base || !reading.head || !reading.hair) return base;
    const out = new Uint8Array(base);
    const HAIR: [number, number, number] = colors?.hair ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
    const HAIR_SH = deriveShadow(HAIR);
    const nearHair = (i: number): boolean => {
      const d1 = Math.abs(out[i] - HAIR[0]) + Math.abs(out[i + 1] - HAIR[1]) + Math.abs(out[i + 2] - HAIR[2]);
      const d2 = Math.abs(out[i] - HAIR_SH[0]) + Math.abs(out[i + 1] - HAIR_SH[1]) + Math.abs(out[i + 2] - HAIR_SH[2]);
      return Math.min(d1, d2) <= 42;
    };
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const figHn = Math.max(0.1, footY - (reading.head.y - reading.head.r));
    const hairTopY = (reading.head.y - reading.head.r) * (size - 1);
    const bandY0 = hairTopY + figHn * (size - 1) * 0.03;
    const bandY1 = hairTopY + figHn * (size - 1) * 0.11;
    for (let y = 0; y < size; y++) {
      // 行ごとの髪スパンを房に分ける
      let x = 0;
      while (x < size) {
        const i0 = (y * size + x) * 4;
        if (!nearHair(i0)) { x++; continue; }
        let x1 = x;
        while (x1 + 1 < size && nearHair((y * size + x1 + 1) * 4)) x1++;
        const spanW = x1 - x + 1;
        const clumpW = Math.max(6, spanW / 4);
        for (let sx = x; sx <= x1; sx++) {
          const i = (y * size + sx) * 4;
          if (y >= bandY0 && y <= bandY1) {
            // ツヤの帯：白へ寄せる
            out[i] = Math.round(out[i] + (255 - out[i]) * 0.45);
            out[i + 1] = Math.round(out[i + 1] + (255 - out[i + 1]) * 0.45);
            out[i + 2] = Math.round(out[i + 2] + (255 - out[i + 2]) * 0.45);
          } else if (y > bandY1) {
            // 房の分かれ目：境界の近くを影色に
            const pos = (sx - x) % clumpW;
            if (pos <= 1) {
              const sh = deriveShadow([out[i], out[i + 1], out[i + 2]]);
              out[i] = sh[0]; out[i + 1] = sh[1]; out[i + 2] = sh[2];
            }
          }
        }
        x = x1 + 1;
      }
    }
    return out;
  }

  /** P1001: 髪の作画の照合。ツヤの帯と房の線が入っているか */
  public verifyBodyHairDetail(reading: PoseReading, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null): { verified: boolean; shine: number; clumps: number; image: Uint8Array } | null {
    const size = 192;
    const base = this.renderBodyCel(reading, size, null, colors);
    const detailed = this.renderBodyHairDetail(reading, size, null, colors);
    if (!base || !detailed || !reading.head || !reading.hair) return null;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const figHn = Math.max(0.1, footY - (reading.head.y - reading.head.r));
    const hairTopY = (reading.head.y - reading.head.r) * (size - 1);
    const bandY1 = hairTopY + figHn * (size - 1) * 0.11;
    let shine = 0;
    let clumps = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const d = (detailed[i] + detailed[i + 1] + detailed[i + 2]) - (base[i] + base[i + 1] + base[i + 2]);
        if (y <= bandY1 && d > 30) shine++;
        if (y > bandY1 && d < -30) clumps++;
      }
    }
    const verified = shine >= 15 && clumps >= 15;
    const state = this.load();
    state.hairDetail++;
    if (verified) state.hairDetailOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, shine, clumps, image: detailed };
  }

  /** P1001: 胸の曲線の照合。bust を上げると胸の行の幅が広がるか */
  public verifyBust(reading: PoseReading): { verified: boolean; w0: number; w1: number } | null {
    if (!reading.head) return null;
    const size = 128;
    // 腕が胴にくっつくと行の幅が腕に引っ張られるので、腕を広げた読みで測る。
    const spread: PoseReading = {
      ...reading,
      handL: reading.handL ? { x: 0.03, y: reading.handL.y } : reading.handL,
      handR: reading.handR ? { x: 0.97, y: reading.handR.y } : reading.handR,
    };
    const img0 = this.renderBody(spread, size, null, null, { bust: 0 });
    const img1 = this.renderBody(spread, size, null, null, { bust: 1 });
    if (!img0 || !img1) return null;
    const shoulderY = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.y + reading.shoulderR.y) / 2 : reading.head.y + reading.head.r * 1.6;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const hipY = shoulderY + (footY - shoulderY) * 0.43;
    const y0 = Math.round(shoulderY * (size - 1)), y1 = Math.round(hipY * (size - 1));
    const cy = Math.round(y0 + (y1 - y0) * 0.3);
    const cx = Math.round((reading.shoulderL && reading.shoulderR ? (reading.shoulderL.x + reading.shoulderR.x) / 2 : reading.head.x) * (size - 1));
    const widthAt = (img: Uint8Array): number => {
      // 中心を含む連なり（胴そのもの）の幅。髪や腕の広がりに引っ張られない。
      const bg: [number, number, number] = [img[0], img[1], img[2]];
      const isBgAt = (x: number): boolean => {
        const i = (cy * size + x) * 4;
        return Math.abs(img[i] - bg[0]) <= 10 && Math.abs(img[i + 1] - bg[1]) <= 10 && Math.abs(img[i + 2] - bg[2]) <= 10;
      };
      if (isBgAt(cx)) return 0;
      let x0 = cx; let x1 = cx;
      while (x0 > 0 && !isBgAt(x0 - 1)) x0--;
      while (x1 < size - 1 && !isBgAt(x1 + 1)) x1++;
      return x1 - x0 + 1;
    };
    const w0 = widthAt(img0);
    const w1 = widthAt(img1);
    const verified = w0 > 0 && w1 >= w0 * 1.06;
    const state = this.load();
    state.bust++;
    if (verified) state.bustOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, w0, w1 };
  }

  /** P1001: 見本の読みを目標として保存する */
  public setTarget(reading: PoseReading): boolean {
    const target: BodyTarget = {
      profile: { ...reading.bodyProfile },
      hairLength: reading.hair?.length ?? null,
      hairColor: reading.hairColor,
      build: reading.build?.label ?? null,
    };
    try {
      storageService.setItem(TARGET_KEY, JSON.stringify(target));
      const state = this.load();
      state.targets++;
      try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
      return true;
    } catch {
      return false;
    }
  }

  /** P1001: 保存した目標を読む */
  public getTarget(): BodyTarget | null {
    try {
      const raw = storageService.getJson(TARGET_KEY, null) as BodyTarget | null;
      if (raw && raw.profile) return raw;
    } catch { /* fall through */ }
    return null;
  }

  /**
   * P1001: 目標へのドリル第1段。描く→測り直す→差分を見て
   * プロファイルを目標へ寄せる、を繰り返し、一番差分の
   * 小さかったパラメータを返す（柱4の土台）。
   */
  public drillToTarget(start: PoseReading, maxRounds = 14): { initialDiff: number; finalDiff: number; improved: boolean; rounds: number; plateau: boolean; graduated: boolean; level: number; reading: PoseReading } | null {
    const target = this.getTarget();
    if (!target || !start.head) return null;
    const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
    const diffOf = (p: PoseReading['bodyProfile']): number | null => {
      let sum = 0;
      let n = 0;
      for (const k of keys) {
        const a = p[k];
        const b = target.profile[k];
        if (a === null || b === null) continue;
        sum += Math.abs(a - b);
        n++;
      }
      return n >= 3 ? sum : null;
    };
    let current: PoseReading['bodyProfile'] = { ...start.bodyProfile };
    let bestProfile = current;
    let bestDiff = Number.POSITIVE_INFINITY;
    let initialDiff: number | null = null;
    // P1005: 停滞の検出。最良差分が3ラウンド続けて
    // 0.004未満しか縮まなければ、これ以上回しても縮まない
    // （＝今の部品と測り方の限界）と見て打ち切る。
    let staleRounds = 0;
    let plateau = false;
    let roundsUsed = 0;
    for (let round = 0; round <= maxRounds; round++) {
      const candidate: PoseReading = { ...start, bodyProfile: current, profileComplete: true };
      // 測る大きさは64（照合で一致が取れている大きさ。96では
      // 頭と肩の読みがずれて、差分の帰還が発散した）。
      const img = this.renderBody(candidate, 64);
      if (!img) break;
      const re = this.analyzePose(img, 64, 64);
      if (!re) break;
      const d = diffOf(re.bodyProfile);
      if (d === null) break;
      roundsUsed = round + 1;
      if (initialDiff === null) initialDiff = d;
      if (d < bestDiff - 0.004) { bestDiff = d; bestProfile = current; staleRounds = 0; }
      else if (d < bestDiff) { bestDiff = d; bestProfile = current; staleRounds++; }
      else staleRounds++;
      if (bestDiff <= 0.06) break;
      if (staleRounds >= 3 && round >= 3) { plateau = true; break; }
      const next: PoseReading['bodyProfile'] = { ...current };
      for (const k of keys) {
        const measured = re.bodyProfile[k];
        const goal = target.profile[k];
        if (measured === null || goal === null || current[k] === null) continue;
        next[k] = Math.max(0.02, Math.min(0.9, (current[k] as number) + (goal - measured) * 0.9));
      }
      current = next;
    }
    if (initialDiff === null || !Number.isFinite(bestDiff)) return null;
    const state = this.load();
    state.drills++;
    const improved = bestDiff < initialDiff * 0.6;
    if (improved) state.drillsOk++;
    if (plateau) state.plateaus++;
    // P1005: 卒業判定。レベルが上がるほど合格の許容差分は
    // 狭くなる（0.14 → ×0.8ずつ）。卒業したらレベルを上げる。
    const tolerance = 0.14 * Math.pow(0.8, state.drillLevel - 1);
    const graduated = bestDiff <= tolerance;
    if (graduated) { state.graduations++; state.drillLevel++; }
    const level = state.drillLevel;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { initialDiff, finalDiff: bestDiff, improved, rounds: roundsUsed, plateau, graduated, level, reading: { ...start, bodyProfile: bestProfile } };
  }

  /**
   * P1005: 要素ドリル。プロファイルの1項目だけを目標へ寄せる。
   * 全体ドリルでは「どの部位が縮まらないのか」が見えないため、
   * 部位ごとに単独で練習し、縮む部位と縮まない部位を分ける。
   */
  public drillElement(start: PoseReading, key: 'shoulder' | 'chest' | 'waist' | 'hip' | 'thigh' | 'calf' | 'ankle', maxRounds = 8): { key: string; initialDiff: number; finalDiff: number; ok: boolean; plateau: boolean } | null {
    const target = this.getTarget();
    if (!target || !start.head) return null;
    const goal = target.profile[key];
    if (goal === null || start.bodyProfile[key] === null) return null;
    let current: PoseReading['bodyProfile'] = { ...start.bodyProfile };
    let bestDiff = Number.POSITIVE_INFINITY;
    let initialDiff: number | null = null;
    let staleRounds = 0;
    let plateau = false;
    for (let round = 0; round <= maxRounds; round++) {
      const candidate: PoseReading = { ...start, bodyProfile: current, profileComplete: true };
      const img = this.renderBody(candidate, 64);
      if (!img) break;
      const re = this.analyzePose(img, 64, 64);
      if (!re) break;
      const measured = re.bodyProfile[key];
      if (measured === null) break;
      const d = Math.abs(measured - goal);
      if (initialDiff === null) initialDiff = d;
      if (d < bestDiff - 0.004) { bestDiff = d; staleRounds = 0; }
      else if (d < bestDiff) { bestDiff = d; staleRounds++; }
      else staleRounds++;
      if (bestDiff <= 0.01) break;
      if (staleRounds >= 3 && round >= 3) { plateau = true; break; }
      const next: PoseReading['bodyProfile'] = { ...current };
      next[key] = Math.max(0.02, Math.min(0.9, (current[key] as number) + (goal - measured) * 0.9));
      current = next;
    }
    if (initialDiff === null || !Number.isFinite(bestDiff)) return null;
    const ok = bestDiff <= 0.03 || bestDiff < initialDiff * 0.6;
    const state = this.load();
    state.elementDrills++;
    if (ok) state.elementDrillsOk++;
    if (plateau) state.plateaus++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { key, initialDiff, finalDiff: bestDiff, ok, plateau };
  }

  /**
   * P1002: 服の描画第1段。素体（セル描画）の上に服を着せる。
   * トップスは肩から腰の帯の輪郭を服色に、スカートは腰から
   * 台形に広げて脚の分かれを隠し、ズボンは脚の輪郭を服色にする。
   * 髪と肌（手・脚）は服で塗らない。
   */
  public renderClothes(reading: PoseReading, size = 192, garment: { top?: [number, number, number]; bottom?: 'skirt' | 'pants'; bottomColor?: [number, number, number] } | null = null, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean } | null = null): Uint8Array | null {
    const base = this.renderBodyCel(reading, size, face, colors, shape);
    if (!base || !garment || !reading.head) return base;
    const out = new Uint8Array(base);
    const bg: [number, number, number] = [base[0], base[1], base[2]];
    const isBg = (i: number): boolean => Math.abs(base[i] - bg[0]) <= 10 && Math.abs(base[i + 1] - bg[1]) <= 10 && Math.abs(base[i + 2] - bg[2]) <= 10;
    const HAIR: [number, number, number] = colors?.hair ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
    const near = (i: number, c: [number, number, number], tol: number): boolean => Math.abs(base[i] - c[0]) + Math.abs(base[i + 1] - c[1]) + Math.abs(base[i + 2] - c[2]) <= tol;
    const isHair = (i: number): boolean => near(i, HAIR, 42) || near(i, deriveShadow(HAIR), 42);
    const isSkin = (i: number): boolean => base[i] > 170 && base[i + 1] > 110 && base[i + 1] < 220 && base[i + 2] > 70 && base[i + 2] < 195 && base[i] > base[i + 1] && base[i] - base[i + 2] > 35;
    const shoulderY = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.y + reading.shoulderR.y) / 2 : reading.head.y + reading.head.r * 1.6;
    const cxN = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.x + reading.shoulderR.x) / 2 : reading.head.x;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const hipY = shoulderY + (footY - shoulderY) * 0.43;
    const S1 = size - 1;
    const ySh = Math.round(shoulderY * S1), yHip = Math.round(hipY * S1), yFoot = Math.round(footY * S1);
    const paint = (x: number, y: number, c: [number, number, number]) => {
      const i = (y * size + x) * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2];
    };
    if (garment.top) {
      for (let y = ySh; y <= yHip; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          if (isBg(i) || isHair(i) || isSkin(i)) continue;
          paint(x, y, garment.top);
        }
      }
    }
    if (garment.bottom === 'skirt' && garment.bottomColor) {
      const hemY = Math.round(yHip + (yFoot - yHip) * 0.45);
      // 腰の行の輪郭幅を台形の上辺にする
      let hipHalf = 0;
      for (let x = 0; x < size; x++) { const i = (yHip * size + x) * 4; if (!isBg(i)) hipHalf = Math.max(hipHalf, Math.abs(x - cxN * S1)); }
      for (let y = yHip; y <= hemY; y++) {
        const t = hemY > yHip ? (y - yHip) / (hemY - yHip) : 0;
        const half = hipHalf * (1 + t * 0.6);
        for (let x = Math.round(cxN * S1 - half); x <= Math.round(cxN * S1 + half); x++) {
          if (x < 0 || x >= size) continue;
          const i = (y * size + x) * 4;
          if (isHair(i)) continue;
          paint(x, y, garment.bottomColor);
        }
      }
    } else if (garment.bottom === 'pants' && garment.bottomColor) {
      for (let y = yHip; y <= yFoot; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          if (isBg(i) || isHair(i)) continue;
          paint(x, y, garment.bottomColor);
        }
      }
    }
    return out;
  }

  /** P1002: 服の照合。着せた姿を読み直し、服の読みが指定と一致するか */
  public verifyClothes(reading: PoseReading, garment: { top?: [number, number, number]; bottom?: 'skirt' | 'pants'; bottomColor?: [number, number, number] }): { verified: boolean; bottom: string; topColor: string | null; bottomColor: string | null; image: Uint8Array } | null {
    const size = 192;
    const image = this.renderClothes(reading, size, garment);
    if (!image) return null;
    const re = this.analyzePose(image, size, size);
    let verified = false;
    if (re) {
      verified = true;
      if (garment.bottom === 'skirt' && re.clothing.bottom !== 'flare') verified = false;
      if (garment.bottom === 'pants' && re.clothing.bottom !== 'split') verified = false;
      if (garment.top && re.clothing.topColor !== nearestExtraColor(garment.top[0], garment.top[1], garment.top[2]).name) verified = false;
      if (garment.bottom === 'pants' && garment.bottomColor && re.clothing.bottomColor !== nearestExtraColor(garment.bottomColor[0], garment.bottomColor[1], garment.bottomColor[2]).name) verified = false;
    }
    const state = this.load();
    state.clothes++;
    if (verified) state.clothesOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, bottom: re?.clothing.bottom ?? 'unknown', topColor: re?.clothing.topColor ?? null, bottomColor: re?.clothing.bottomColor ?? null, image };
  }

  /**
   * P1002: 線の太さの役割別。外周の輪郭線は太く（2段）、
   * 内側の境界（髪と体の境目など色の変わり目）は細く薄く引く。
   */
  public renderBodyOutlineRole(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean } | null = null): Uint8Array | null {
    const SS = 3;
    const B = size * SS;
    const big = this.renderBody(reading, B, face, colors, shape);
    if (!big) return null;
    const bg: [number, number, number] = [big[0], big[1], big[2]];
    const isBg = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= B || y >= B) return true;
      const i = (y * B + x) * 4;
      return Math.abs(big[i] - bg[0]) <= 10 && Math.abs(big[i + 1] - bg[1]) <= 10 && Math.abs(big[i + 2] - bg[2]) <= 10;
    };
    const out = new Uint8Array(big);
    const darken = (x: number, y: number, f: number) => {
      const i = (y * B + x) * 4;
      out[i] = Math.round(big[i] * f); out[i + 1] = Math.round(big[i + 1] * f); out[i + 2] = Math.round(big[i + 2] * f);
    };
    for (let y = 0; y < B; y++) {
      for (let x = 0; x < B; x++) {
        if (isBg(x, y)) continue;
        // 外周までの距離（チェビシェフ）。通常の輪郭線（3段）より
        // 太く、5段までを外周の線とする。
        let distBg = 99;
        for (let d = 1; d <= 5; d++) {
          let hit = false;
          for (let dy = -d; dy <= d && !hit; dy++) for (let dx = -d; dx <= d && !hit; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
            if (isBg(x + dx, y + dy)) hit = true;
          }
          if (hit) { distBg = d; break; }
        }
        if (distBg <= 5) { darken(x, y, 0.42); continue; }
        // 内側の境界：隣の画素と色が大きく違う所を細く薄く
        const i = (y * B + x) * 4;
        let inner = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= B || ny >= B || isBg(nx, ny)) continue;
          const j = (ny * B + nx) * 4;
          if (Math.abs(big[i] - big[j]) + Math.abs(big[i + 1] - big[j + 1]) + Math.abs(big[i + 2] - big[j + 2]) > 90) { inner = true; break; }
        }
        if (inner) darken(x, y, 0.62);
      }
    }
    // 縮小（renderBodySmooth と同じ平均）
    const small = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let r = 0, g = 0, b = 0;
        for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * B + (x * SS + dx)) * 4;
          r += out[i]; g += out[i + 1]; b += out[i + 2];
        }
        const o = (y * size + x) * 4;
        small[o] = Math.round(r / (SS * SS)); small[o + 1] = Math.round(g / (SS * SS)); small[o + 2] = Math.round(b / (SS * SS)); small[o + 3] = 255;
      }
    }
    return small;
  }

  /** P1002: 役割別の線の照合。外周の線の帯が通常の輪郭線より太いか */
  public verifyOutlineRole(reading: PoseReading): { verified: boolean; outerBand: number; plainBand: number; image: Uint8Array } | null {
    const size = 192;
    const role = this.renderBodyOutlineRole(reading, size);
    const plain = this.renderBodyOutline(reading, size);
    if (!role || !plain) return null;
    const bandOf = (img: Uint8Array): number => {
      // 輪郭の内側で「自分の色より暗くなっている」画素の数
      const flat = this.renderBodySmooth(reading, size);
      if (!flat) return 0;
      let n = 0;
      for (let i = 0; i < size * size * 4; i += 4) {
        const d = (flat[i] + flat[i + 1] + flat[i + 2]) - (img[i] + img[i + 1] + img[i + 2]);
        if (d > 25) n++;
      }
      return n;
    };
    const outerBand = bandOf(role);
    const plainBand = bandOf(plain);
    const verified = outerBand > plainBand * 1.3 && plainBand > 0;
    const state = this.load();
    state.lineRole++;
    if (verified) state.lineRoleOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, outerBand, plainBand, image: role };
  }

  /**
   * P994: 顔の描画の照合。顔つきを指定して素体を描き、頭を
   * 切り出して顔の読みにかけ、目と口の読みが指定と一致するか。
   */
  public verifyFace(reading: PoseReading, face: BodyFaceSpec): { verified: boolean; eyes: number; mouthSize: string | null; image: Uint8Array } | null {
    if (!reading.head) return null;
    const image = this.renderBody(reading, 64, face);
    if (!image) return null;
    const crop = visualZoomService.cropAnalyze(image, 64, 64, reading.head.x, reading.head.y, reading.head.r * 3.4);
    if (!crop) return null;
    const fr = visualZoomService.analyzeFace(crop.pixels);
    let verified = false;
    if (fr) {
      verified = fr.eyes === 2;
      if (face.mouthSize !== null && fr.mouthSize !== face.mouthSize) verified = false;
      if (face.eyeSize !== null && fr.eyeSize !== face.eyeSize) verified = false;
      if (face.brows && fr.brows !== true) verified = false;
    }
    const state = this.load();
    state.facesDrawn++;
    if (verified) state.facesOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, eyes: fr?.eyes ?? 0, mouthSize: fr?.mouthSize ?? null, image };
  }

  /**
   * P1000: 目の作画の照合。虹彩つきで顔を描き、頭を切り出して
   * 顔の読みにかけ、目の数と目の色が指定と一致するか。
   */
  public verifyEyeDetail(reading: PoseReading, face: BodyFaceSpec): { verified: boolean; eyes: number; eyeColor: string | null; image: Uint8Array } | null {
    if (!reading.head) return null;
    // 目の部品は小さいので、大きく描いてから切り出す（64では虹彩が瞳孔に潰れる）。
    const image = this.renderBody(reading, 192, face);
    if (!image) return null;
    const crop = visualZoomService.cropAnalyze(image, 192, 192, reading.head.x, reading.head.y, reading.head.r * 3.4);
    if (!crop) return null;
    const fr = visualZoomService.analyzeFace(crop.pixels);
    let verified = false;
    if (fr) {
      // 照合は目の数と虹彩の色。目の大きさの読みは部品の目では
      // クラスタの形が変わって読みが安定しないため、P994の丸い目の照合に任せる。
      verified = fr.eyes === 2;
      if (face.irisName && fr.eyeColor !== face.irisName) verified = false;
    }
    const state = this.load();
    state.eyesDrawn++;
    if (verified) state.eyesOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, eyes: fr?.eyes ?? 0, eyeColor: fr?.eyeColor ?? null, image };
  }

  /**
   * P1006: 前髪の照合。192で前髪つきで描き、額の帯（顔の上部）に
   * 髪色の画素が房として入っているかと、頭の切り出しで目が
   * 2つ読める（前髪が目を壊していない）かを確かめる。
   */
  public verifyFrontHair(reading: PoseReading, face: BodyFaceSpec): { verified: boolean; bangShare: number; eyes: number; image: Uint8Array } | null {
    if (!reading.head || !reading.hair) return null;
    const S = 192;
    const image = this.renderBody(reading, S, face, null, { frontHair: true });
    if (!image) return null;
    const HAIR: [number, number, number] = EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
    const SHADE = deriveShadow(HAIR);
    const near = (i: number, c: [number, number, number]): boolean => Math.abs(image[i] - c[0]) + Math.abs(image[i + 1] - c[1]) + Math.abs(image[i + 2] - c[2]) <= 42;
    const hrPx = Math.max(2, reading.head.r * S);
    const faceR = hrPx * 0.8;
    const faceCy = reading.head.y * (S - 1) + hrPx * 0.15;
    const hxPx = reading.head.x * (S - 1);
    let band = 0;
    let bang = 0;
    for (let y = Math.round(faceCy - faceR * 0.95); y <= Math.round(faceCy - faceR * 0.3); y++) {
      for (let x = Math.round(hxPx - faceR * 0.7); x <= Math.round(hxPx + faceR * 0.7); x++) {
        if (x < 0 || x >= S || y < 0 || y >= S) continue;
        band++;
        const i = (y * S + x) * 4;
        if (near(i, HAIR) || near(i, SHADE)) bang++;
      }
    }
    const bangShare = band > 0 ? bang / band : 0;
    const crop = visualZoomService.cropAnalyze(image, S, S, reading.head.x, reading.head.y, reading.head.r * 3.4);
    const fr = crop ? visualZoomService.analyzeFace(crop.pixels) : null;
    const verified = bangShare >= 0.25 && fr?.eyes === 2;
    const state = this.load();
    state.frontHair++;
    if (verified) state.frontHairOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, bangShare, eyes: fr?.eyes ?? 0, image };
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
  public analyzePeople(rgba: Uint8Array | number[], width: number, height: number): { count: number; readings: PoseReading[]; holdingHands: boolean } {
    const mask = buildMask(rgba, width, height);
    if (!mask) return { count: 0, readings: [], holdingHands: false };
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
    // P959: 元画像の座標に戻した手の位置（人ごと）
    const imageHands: Array<Array<{ x: number; y: number }>> = [];
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
      if (reading && reading.verified) {
        readings.push(reading);
        const hands: Array<{ x: number; y: number }> = [];
        for (const h of [reading.handL, reading.handR]) {
          if (!h) continue;
          hands.push({
            x: (c.x0 - pad + h.x * (sw - 1)) / Math.max(1, width - 1),
            y: (c.y0 - pad + h.y * (sh - 1)) / Math.max(1, height - 1),
          });
        }
        imageHands.push(hands);
      }
    }
    // P959: 別々の人の手同士が重なる位置にあれば、手を
    // つないでいるサインとして読む。
    let holdingHands = false;
    for (let i = 0; i < imageHands.length && !holdingHands; i++) {
      for (let j = i + 1; j < imageHands.length && !holdingHands; j++) {
        for (const a of imageHands[i]) {
          for (const b of imageHands[j]) {
            if (Math.hypot(a.x - b.x, a.y - b.y) < 0.055) { holdingHands = true; break; }
          }
          if (holdingHands) break;
        }
      }
    }
    if (readings.length >= 2) {
      const state = this.load();
      state.multi++;
      if (holdingHands) state.holding++;
      try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    }
    return { count: readings.length, readings, holdingHands };
  }

  /**
   * 画像から姿勢を読む。人らしい輪郭でなければ null。
   * P1001: 測り方の使い分け。まず色ビンで読み、読めなかった時と
   * 輪郭が細切れな時だけ、細かいビン→線で囲む、を試す。採るのは
   * 「照合を通った読み」優先、次に詰まり具合のよい方。線画の
   * 反転マスク（詰まり具合が高すぎる囲み）は採らない。
   */
  public analyzePose(rgba: Uint8Array | number[], width: number, height: number): PoseReading | null {
    const binMask = buildMask(rgba, width, height);
    if (!binMask) return null;
    const binDensity = maskDensity(binMask, width, height);
    let chosen = this.analyzePoseWithMask(rgba, width, height, binMask, 'bin', binDensity);
    let chosenMask = binMask;
    let chosenMethod: 'bin' | 'fine' | 'fill' = 'bin';
    let chosenDensity = binDensity;
    const bboxH = (m: Uint8Array): number => {
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (m[y * width + x]) { if (top < 0) top = y; bottom = y; break; }
        }
      }
      return top < 0 ? 0 : bottom - top + 1;
    };
    let chosenBBoxH = bboxH(binMask);
    // 細かいビンで図が縦に伸びるなら、色ビンでは頭などが消えている。
    const fineMask = buildMaskFine(rgba, width, height);
    const fineTaller = fineMask !== null && bboxH(fineMask) > chosenBBoxH * 1.15;
    if (!chosen || binDensity < 0.5 || fineTaller) {
      const tries: Array<[Uint8Array | null, 'fine' | 'fill']> = [
        [fineMask, 'fine'],
        [binDensity < 0.28 || !chosen ? buildMaskFill(rgba, width, height) : null, 'fill'],
      ];
      for (const [m, method] of tries) {
        if (!m) continue;
        const d = maskDensity(m, width, height);
        if (method === 'fill' && d > 0.62) continue;
        const r = this.analyzePoseWithMask(rgba, width, height, m, method, d);
        if (!r) continue;
        const mh = bboxH(m);
        // 別の取り方で図が縦に伸びる＝色ビンでは頭など一部が消えていた。
        const moreComplete = mh > chosenBBoxH * 1.15;
        if (!chosen || (r.verified && !chosen.verified) || (r.verified === chosen.verified && (d > chosenDensity || moreComplete))) {
          chosen = r;
          chosenMask = m;
          chosenMethod = method;
          chosenDensity = d;
          chosenBBoxH = mh;
        }
      }
    }
    // P1003/P1004: 長い髪がある時は、線で区切った領域から髪を
    // 除いたマスクでも測り直し、部位ごとに差し替える。差し替えは
    // 「領域側が細い」時だけ。潰れた値（元の35%未満）は、その行の
    // 輪郭が実際に髪で汚れている時だけ採る。
    let regionApplied = false;
    if (chosen && chosen.hair?.length === 'long') {
      const seg = segmentBodyMask(rgba, width, height);
      if (seg) {
        // 詰まり具合は元の輪郭のものを渡す（体だけのマスクは
        // 島状で当然まばらなので、その密度で正直さの門にかけない）。
        const rr = this.analyzePoseWithMask(rgba, width, height, seg.body, chosenMethod, chosen.silhouetteDensity);
        if (rr && rr.posture === chosen.posture) {
          const S1w = width - 1;
          const S1h = height - 1;
          const headCx = chosen.head ? chosen.head.x * S1w : width / 2;
          const figTop = chosen.head ? (chosen.head.y - chosen.head.r) * S1h : 0;
          const footYn = Math.max(chosen.footL?.y ?? 0, chosen.footR?.y ?? 0);
          const figBottom = (footYn > 0 ? footYn : 0.98) * S1h;
          const figHn = Math.max(1, figBottom - figTop);
          const neckY = chosen.head ? (chosen.head.y + chosen.head.r) * S1h : figTop + figHn * 0.15;
          const shoulderY = chosen.shoulderL && chosen.shoulderR ? ((chosen.shoulderL.y + chosen.shoulderR.y) / 2) * S1h : neckY + figHn * 0.05;
          const hipY = neckY + figHn * 0.45;
          const bandRow: Record<'shoulder' | 'chest' | 'waist' | 'hip' | 'thigh' | 'calf' | 'ankle', number> = {
            shoulder: shoulderY, chest: neckY + figHn * 0.2, waist: hipY - figHn * 0.1, hip: hipY,
            thigh: hipY + figHn * 0.08, calf: figBottom - figHn * 0.16, ankle: figBottom - figHn * 0.03,
          };
          // その行で、髪を除くと輪郭が2割以上細くなるか
          // （＝その行の幅は髪で膨らんでいた、という汚れの判定）。
          const rowExtent = (m: Uint8Array, y: number): number => {
            const yy = Math.max(0, Math.min(height - 1, Math.round(y)));
            let minX = -1;
            let maxX = -1;
            for (let x = 0; x < width; x++) if (m[yy * width + x]) { if (minX < 0) minX = x; maxX = x; }
            return minX < 0 ? 0 : maxX - minX + 1;
          };
          const contaminated = (y: number): boolean => {
            const sil = rowExtent(chosenMask, y);
            const bod = rowExtent(seg.body, y);
            return sil > 0 && bod > 0 && bod < sil * 0.8;
          };
          // 図全体が髪で膨らんでいる時だけ、領域側のプロファイル
          // を丸ごと採る（部位ごとに混ぜると、描く時の寸法として
          // 自己矛盾する）。判定は胸とふくらはぎの2行で、髪を
          // 除くと輪郭が2割以上細くなること。
          const figureDirty = contaminated(bandRow.chest) && contaminated(bandRow.calf);
          // 広がってはいけないのは胸と脚の合計幅（分割の失敗の印）。
          // 肩は1行で測るため、多少の揺れは許す。
          let neverWider = true;
          for (const k of ['chest', 'calf', 'ankle'] as const) {
            const a = chosen.bodyProfile[k];
            const b = rr.bodyProfile[k];
            if (a !== null && b !== null && b > a + 0.03) { neverWider = false; break; }
          }
          if (figureDirty && neverWider && rr.profileComplete && (!chosen.profileComplete
            || (rr.bodyProfile.chest !== null && chosen.bodyProfile.chest !== null && rr.bodyProfile.chest >= 0.12 && rr.bodyProfile.chest < chosen.bodyProfile.chest - 0.08))) {
            const mergedProfile = { ...rr.bodyProfile };
            // 太ももだけは例外：股の位置は髪でずれやすく、領域側の
            // 帯が胴に入って広がることがある。その時は元の値を残す。
            if (mergedProfile.thigh !== null && chosen.bodyProfile.thigh !== null && mergedProfile.thigh > chosen.bodyProfile.thigh + 0.03) {
              mergedProfile.thigh = chosen.bodyProfile.thigh;
            }
            chosen = { ...chosen, bodyProfile: mergedProfile, profileComplete: true };
            regionApplied = true;
          }
        }
      }
    }
    if (chosen) {
      const state = this.load();
      state.analyzed++;
      if (chosenMethod !== 'bin') state.maskFill++;
      if (regionApplied) state.regions++;
      if (chosen.verified) state.verified++;
      if (chosen.clothingDescription) state.clothing++;
      if (chosen.extrasDescription) state.extras++;
      if (chosen.bare === true) state.bare++;
      if (chosen.balance) {
        state.balances++;
        state.recentLeans.push(chosen.balance.label);
        if (state.recentLeans.length > 20) state.recentLeans = state.recentLeans.slice(-20);
      }
      if (chosen.hair) state.hairs++;
      if (chosen.collarbone === true) state.collarbones++;
      if (chosen.neck === true) state.necks++;
      if (chosen.armLength) state.armLengths++;
      if (chosen.legLength) state.legLengths++;
      if (chosen.profileComplete) state.profiles++;
      if (chosen.hairShape) state.hairShapes++;
      try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    }
    return chosen;
  }

  /** P1001: 1つのマスクで姿勢を読む本体。記録は呼び出し側が採った読みについてだけ行う */
  private analyzePoseWithMask(rgba: Uint8Array | number[], width: number, height: number, mask: Uint8Array, maskMethod: 'bin' | 'fine' | 'fill', silhouetteDensity: number): PoseReading | null {
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
    // P1001: 図が下端に届いていれば見切れ（脚の長さ等は判定しない）。
    const figTruncated = figBottom >= height - 1;

    // 門：頭らしい上部（狭く中央寄り）＋下部の構造（脚の分かれ
    // か、最後の行の広い span）がある輪郭だけを人として読む。
    const topRow = rows[figTop];
    const topWidth = topRow.maxX - topRow.minX + 1;
    const topCentered = Math.abs((topRow.minX + topRow.maxX) / 2 - figCx) <= figW * 0.18;
    let headLikeTop = topWidth <= figW * 0.45 && topCentered;
    if (!headLikeTop) {
      // P1001: 髪の帽子が四角い等で最上行が広くても、上部3割の
      // どこかに「狭く中央寄りのスパン（顔）」があれば頭とみなす。
      for (let y = figTop; y <= Math.min(figBottom, figTop + figH * 0.3); y++) {
        const hit = rows[y].spans.some((sp) => (sp.maxX - sp.minX + 1) <= figW * 0.5 && Math.abs((sp.minX + sp.maxX) / 2 - figCx) <= figW * 0.18);
        if (hit) { headLikeTop = true; break; }
      }
    }
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

    // 体勢：座りは「下の行が広く、縦横比が低い」。股の分かれが
    // 無いか、あっても下の方（座った時のすねの分かれ）なら座り。
    let posture: PostureState = 'UNKNOWN';
    const crotchLow = crotchY > 0 && figH > 0 && (crotchY - figTop) / figH >= 0.75;
    if (figH < figW * 1.05 && (crotchY < 0 || crotchLow) && bottomWide) posture = 'SITTING';
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

    // P986: 腕の長さ。下りた腕について、側帯の列のうち
    // 肩の高さから始まる列の一番下までを測る。手の点は
    // 腰の少し下までしか探さないので、長い腕はマスクから
    // 直接測る。図の高さとの比で長い／短いを読む。
    let armLength: 'long' | 'short' | null = null;
    {
      const ratios: number[] = [];
      for (const side of ['L', 'R'] as const) {
        const arm = side === 'L' ? armL : armR;
        if (arm.state !== 'DOWN') continue;
        let best = 0;
        for (let x = 0; x < width; x++) {
          const inBand = side === 'L' ? x < torsoLeft - 0.5 : x > torsoRight + 0.5;
          if (!inBand) continue;
          let top = -1;
          for (let y = Math.max(0, Math.floor(shoulderY - figH * 0.05)); y <= Math.floor(shoulderY + figH * 0.12); y++) {
            if (mask[y * width + x]) { top = y; break; }
          }
          if (top < 0) continue;
          let bottom = top;
          let gap = 0;
          for (let y = top; y < height; y++) {
            if (mask[y * width + x]) { bottom = y; gap = 0; }
            else if (++gap > 2) break;
          }
          best = Math.max(best, bottom - shoulderY);
        }
        if (best > 0) ratios.push(best / figH);
      }
      if (ratios.length) {
        const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        if (avg >= 0.42) armLength = 'long';
        else if (avg <= 0.22) armLength = 'short';
      }
    }
    const armLengthDescription = armLength === 'long' ? '腕が長い' : armLength === 'short' ? '腕が短い' : '';

    // P987: 脚の長さ。立っている時だけ、腰から図の下端までを
    // 図の高さとの比で読む。
    let legLength: 'long' | 'short' | null = null;
    if (posture === 'STANDING' && legs !== 'UNKNOWN' && figH > 0) {
      const legRatio = (figBottom - hipY) / figH;
      if (legRatio >= 0.5) legLength = 'long';
      else if (legRatio <= 0.35) legLength = 'short';
    }
    if (figTruncated) legLength = null;
    const legLengthDescription = legLength === 'long' ? '脚が長い' : legLength === 'short' ? '脚が短い' : '';

    // P991: 素体プロファイル。部位ごとの輪郭の幅を、図の高さで
    // 割った数値表にする。服はこの素体との差分として読むのが
    // 次の段（2026-11-18にきりあと合意した素体優先の方針）。
    const spanWidthAt991 = (y: number): number | null => {
      const yy = Math.max(0, Math.min(height - 1, Math.round(y)));
      const row = rows[yy];
      if (!row) return null;
      let s = row.spans.find((sp) => headCx >= sp.minX - 0.5 && headCx <= sp.maxX + 0.5);
      if (!s || s.maxX - s.minX + 1 < figW * 0.12) {
        // P1001: 中心のスパンが細すぎる（髪の分け目など）→中心近くの最大スパンで代用。
        let bestS: { minX: number; maxX: number } | undefined;
        for (const sp of row.spans) {
          const c = (sp.minX + sp.maxX) / 2;
          if (Math.abs(c - headCx) <= figW * 0.22 && (!bestS || sp.maxX - sp.minX > bestS.maxX - bestS.minX)) bestS = sp;
        }
        if (bestS) s = bestS;
      }
      return s ? s.maxX - s.minX + 1 : null;
    };
    const totalWidthAt991 = (y: number): number | null => {
      const row = rows[Math.max(0, Math.min(height - 1, Math.round(y)))];
      if (!row || row.minX < 0) return null;
      return row.maxX - row.minX + 1;
    };
    const band991 = (y0: number, y1: number, fn: (y: number) => number | null, mode: 'max' | 'min' | 'p25'): number | null => {
      if (mode === 'p25') {
        // P1004: 帯の最小は1行の隙間で壊れるので、下から
        // 25%の行の幅を腰とする（細い行の代表として頑健）。
        const vals: number[] = [];
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
          const v = fn(y);
          if (v !== null) vals.push(v);
        }
        if (!vals.length) return null;
        vals.sort((a, b) => a - b);
        return vals[Math.floor((vals.length - 1) * 0.25)];
      }
      let best: number | null = null;
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const v = fn(y);
        if (v === null) continue;
        if (best === null || (mode === 'max' ? v > best : v < best)) best = v;
      }
      return best;
    };
    const ratio991 = (v: number | null): number | null => (v === null || figH <= 0 ? null : Math.round((v / figH) * 100) / 100);
    const bodyProfile = {
      shoulder: ratio991(spanWidthAt991(shoulderY)),
      chest: ratio991(band991(neckY + figH * 0.08, hipY - figH * 0.12, spanWidthAt991, 'max')),
      waist: ratio991(band991(hipY - figH * 0.18, hipY - figH * 0.02, spanWidthAt991, 'min')),
      hip: ratio991(spanWidthAt991(hipY)),
      thigh: crotchY > 0 ? ratio991(band991(crotchY + 1, crotchY + figH * 0.12, totalWidthAt991, 'max')) : null,
      calf: ratio991(totalWidthAt991(figBottom - figH * 0.16)),
      ankle: ratio991(totalWidthAt991(figBottom - figH * 0.03)),
    };
    let profileComplete = bodyProfile.shoulder !== null && bodyProfile.chest !== null && bodyProfile.waist !== null && bodyProfile.hip !== null;
    // P1001: 輪郭が細切れのままなら、幅の数値は信用できないので出さない。
    if (silhouetteDensity < 0.2) {
      bodyProfile.shoulder = null;
      bodyProfile.chest = null;
      bodyProfile.waist = null;
      bodyProfile.hip = null;
      bodyProfile.thigh = null;
      bodyProfile.calf = null;
      bodyProfile.ankle = null;
      profileComplete = false;
    }

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

    // P960: 裸の状態。体全体の肌色率と、胴の帯の肌色率の
    // 両方が高いときだけ「服を着ていない」と読む。水着の
    // ように胴が覆われていれば、脚や腕が肌でも裸とは
    // 読まない。肌色率が低ければ服を着ている。
    let bare: boolean | null = null;
    {
      const isSkinPx = (i: number) => {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
      };
      let skinN = 0;
      let maskN = 0;
      let torsoSkin = 0;
      let torsoN = 0;
      const hipRefB = neckY + figH * 0.45;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          if (!mask[p]) continue;
          maskN++;
          const skin = isSkinPx(p * 4);
          if (skin) skinN++;
          if (y >= neckY && y <= hipRefB) {
            torsoN++;
            if (skin) torsoSkin++;
          }
        }
      }
      if (maskN > 0) {
        const share = skinN / maskN;
        const torsoShare = torsoN >= 20 ? torsoSkin / torsoN : 0;
        if (share >= 0.5 && torsoShare >= 0.5) bare = true;
        else if (share <= 0.35) bare = false;
      }
    }
    const bareDescription = bare === true ? '服は着ていないようだ（肌が広く見えている）' : '';

    // P962: 重心。輪郭の重心と、足の支えの中心とのずれで
    // 傾きを読む。
    let balance: PoseReading['balance'] = null;
    {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (mask[y * width + x]) { sx += x; sy += y; n++; }
        }
      }
      if (n > 0 && figW > 0) {
        const cxp = sx / n;
        const cyp = sy / n;
        const supportX = footL && footR ? (footL.x + footR.x) / 2 : figCx;
        const lean = (cxp - supportX) / figW;
        const label = Math.abs(lean) <= 0.06 ? 'balanced' : lean > 0 ? 'right' : 'left';
        balance = { centroidX: cxp / (width - 1), centroidY: cyp / (height - 1), lean, label };
      }
    }
    const balanceDescription = balance
      ? balance.label === 'balanced'
        ? '重心はほぼ真ん中で、まっすぐ立っている'
        : balance.label === 'right' ? '重心が右に寄って傾いている' : '重心が左に寄って傾いている'
      : '';

    // P966: 鎖骨の影。首の下の胸の帯が肌のとき、左右で
    // 対称な位置にある暗い影（明るさの谷）を鎖骨と読む。
    // 影でしか見えない部位の測り方の第1段。
    let collarbone: boolean | null = null;
    {
      const isSkinPx966 = (i: number) => {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
      };
      const lum966 = (i: number) => 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      const by0 = Math.round(neckY + figH * 0.03);
      const by1 = Math.round(neckY + figH * 0.16);
      const bx0 = Math.round(headCx - figW * 0.34);
      const bx1 = Math.round(headCx + figW * 0.34);
      let skinN = 0;
      let totN = 0;
      for (let y = by0; y <= by1; y++) {
        for (let x = bx0; x <= bx1; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          totN++;
          const p = y * width + x;
          if (mask[p] && isSkinPx966(p * 4)) skinN++;
        }
      }
      if (totN > 0 && skinN >= 30 && skinN / totN >= 0.4) {
        // 基準は帯の中で一番明るい行（影のない肌の行）。
        // 左右それぞれで、その行より1割以上暗い行が
        // ほぼ同じ高さにあれば鎖骨の影と読む。
        const rowMean = (y: number, xa: number, xb: number): number | null => {
          let n = 0;
          let s = 0;
          for (let x = xa; x <= xb; x++) {
            if (x < 0 || x >= width) continue;
            const p = y * width + x;
            if (mask[p] && isSkinPx966(p * 4)) { n++; s += lum966(p * 4); }
          }
          return n >= 5 ? s / n : null;
        };
        let baseline = 0;
        for (let y = by0; y <= by1; y++) {
          const v = rowMean(y, bx0, bx1);
          if (v !== null && v > baseline) baseline = v;
        }
        const halfDip = (xa: number, xb: number): { y: number; v: number } | null => {
          let best: { y: number; v: number } | null = null;
          for (let y = by0; y <= by1; y++) {
            const v = rowMean(y, xa, xb);
            if (v !== null && (!best || v < best.v)) best = { y, v };
          }
          return best;
        };
        const midX = Math.round(headCx);
        const dipL = halfDip(bx0, midX - 1);
        const dipR = halfDip(midX + 1, bx1);
        collarbone = !!(baseline > 0 && dipL && dipR && dipL.v <= baseline * 0.9 && dipR.v <= baseline * 0.9 && Math.abs(dipL.y - dipR.y) <= Math.max(2, figH * 0.05));
      }
    }
    const collarboneDescription = collarbone === true ? '鎖骨の影が見える' : '';

    // P984: 首のくびれ。頭の帯で中心を含む span の最大幅と、
    // 頭のすぐ下の行で中心を含む span の最小幅を比べる。
    // 首は頭より細い、という形の読みの第1段。
    let neck: boolean | null = null;
    {
      const spanAt984 = (y: number) => rows[y]?.spans.find((s) => headCx >= s.minX && headCx <= s.maxX);
      let headW = 0;
      for (let y = figTop; y < Math.min(height, Math.floor(neckY)); y++) {
        const s = spanAt984(y);
        if (s) headW = Math.max(headW, s.maxX - s.minX + 1);
      }
      let neckW = Infinity;
      const ny1 = Math.min(height - 1, Math.floor(neckY + figH * 0.08));
      for (let y = Math.max(0, Math.floor(neckY)); y <= ny1; y++) {
        const s = spanAt984(y);
        if (s) neckW = Math.min(neckW, s.maxX - s.minX + 1);
      }
      if (headW >= 4 && neckW < Infinity) {
        const ratio = neckW / headW;
        if (ratio <= 0.75) neck = true;
        else if (ratio >= 0.95) neck = false;
      }
    }
    const neckDescription = neck === true ? '首のくびれが見える' : '';

    // P958: 髪の色。頭の範囲で、肌色でない前景の最頻色。
    let hairColor: string | null = null;
    let hairBinKey: string | null = null;
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
      let bestHKey: string | null = null;
      for (const [k, v] of groups) if (!bestH || v.n > bestH.n) { bestH = v; bestHKey = k; }
      if (bestH && bestH.n >= 10) hairColor = nearestExtraColor(bestH.r / bestH.n, bestH.g / bestH.n, bestH.b / bestH.n).name;
      hairBinKey = bestH && bestH.n >= 10 ? bestHKey : null;
    }

    // P964: 髪の長さ。髪色の領域が頭から下へどこまで
    // 続いているか（途切れたらそこまで）を測る。
    let hair: PoseReading['hair'] = null;
    if (hairBinKey) {
      const bandHalf = headR * 2.4;
      let hairBottom = Math.round(headCy + headR);
      let gap = 0;
      for (let y = Math.round(headCy + headR); y <= figBottom; y++) {
        let cnt = 0;
        for (let x = Math.max(0, Math.floor(headCx - bandHalf)); x <= Math.min(width - 1, Math.ceil(headCx + bandHalf)); x++) {
          const p = y * width + x;
          if (!mask[p]) continue;
          const i = p * 4;
          if (`${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}` === hairBinKey) cnt++;
        }
        if (cnt >= 2) { hairBottom = y; gap = 0; }
        else {
          gap++;
          if (gap > 2) break;
        }
      }
      const lengthRatio = figH > 0 ? (hairBottom - figTop) / figH : 0;
      const length = lengthRatio <= 0.28 ? 'short' : lengthRatio <= 0.55 ? 'medium' : 'long';
      hair = { length, lengthRatio };
    }
    const hairDescription = hair
      ? hair.length === 'short' ? '髪は短い' : hair.length === 'medium' ? '髪は肩くらいまである' : '髪は長く垂れている'
      : '';

    // P973: 髪の形。垂れた髪の下端が列ごとにどれだけ
    // ばらつくかで、まっすぐか、うねっているかを読む。
    // 短い髪では下端の形が意味を持たないので読まない。
    let hairShape: PoseReading['hairShape'] = null;
    if (hairBinKey && hair && hair.length !== 'short') {
      const bandHalf = headR * 1.8;
      const bottoms: number[] = [];
      for (let x = Math.max(0, Math.floor(headCx - bandHalf)); x <= Math.min(width - 1, Math.ceil(headCx + bandHalf)); x++) {
        let bottom = -1;
        for (let y = Math.round(headCy + headR); y <= figBottom; y++) {
          const p = y * width + x;
          if (!mask[p]) continue;
          const i = p * 4;
          if (`${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}` === hairBinKey) bottom = y;
        }
        if (bottom >= 0) bottoms.push(bottom);
      }
      if (bottoms.length >= 6 && figH > 0) {
        const mean = bottoms.reduce((a, b) => a + b, 0) / bottoms.length;
        const std = Math.sqrt(bottoms.reduce((a, b) => a + (b - mean) ** 2, 0) / bottoms.length);
        const ratio = std / figH;
        hairShape = ratio <= 0.02 ? 'straight' : ratio <= 0.05 ? 'wavy' : 'curly';
      }
    }
    const hairShapeDescription = hairShape
      ? hairShape === 'straight' ? '髪はまっすぐ垂れている' : hairShape === 'wavy' ? '髪は少しうねっている' : '髪はうねりが強い'
      : '';

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

    // P1001: 測れなかった所は、測れたふりをせずに言う。
    if (silhouetteDensity < 0.2) parts.push('輪郭が細切れで体の幅は測れなかった');
    if (figTruncated) parts.push('下半身が見切れている');
    const description = parts.join('。') + '。';

    const norm = (p: PosePoint | null): PosePoint | null =>
      (p ? { x: p.x / (width - 1), y: p.y / (height - 1) } : null);
    return {
      head: { x: headCx / (width - 1), y: headCy / (height - 1), r: headR / width },
      handL: norm(armL.hand),
      handR: norm(armR.hand),
      shoulderL: norm(joints.shoulderL),
      shoulderR: norm(joints.shoulderR),
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
      bare,
      bareDescription,
      balance,
      balanceDescription,
      hair,
      hairDescription,
      collarbone,
      collarboneDescription,
      neck,
      neckDescription,
      armLength,
      armLengthDescription,
      legLength,
      legLengthDescription,
      bodyProfile,
      profileComplete,
      maskMethod,
      silhouetteDensity,
      truncated: figTruncated,
      hairShape,
      hairShapeDescription,
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

    // P963: 動きの質。一番よく動いた関節の軌跡から、
    // 速さ（経路÷時間）と、なめらかさ（方向転換の頻度）
    // を読む。
    let quality: PoseMotionReading['quality'] = null;
    let qualityDescription = '';
    {
      const candidates = [handLTraj, handRTraj, headTraj].filter((t) => t.length >= 4);
      let best: MotionSample[] | null = null;
      let bestPath = 0;
      for (const t of candidates) {
        let p = 0;
        for (let i = 1; i < t.length; i++) p += Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y);
        if (p > bestPath) { bestPath = p; best = t; }
      }
      if (best && bestPath >= 0.05) {
        const durationS = Math.max(0.1, (best[best.length - 1].t - best[0].t) / 1000);
        const speed = bestPath / durationS;
        const tempo = speed >= 0.4 ? 'fast' : speed <= 0.3 ? 'slow' : 'steady';
        const reversals = dirChanges(best.map((s) => s.x)) + dirChanges(best.map((s) => s.y));
        const revRatio = reversals / Math.max(1, best.length - 1);
        const smoothness = revRatio >= 0.5 ? 'jerky' : revRatio <= 0.3 ? 'smooth' : 'normal';
        quality = { speed, tempo, smoothness };
        const table: Record<string, string> = {
          'fast/smooth': '速く、なめらかに動いている',
          'fast/jerky': '速く、ぎくしゃくした動きだ',
          'fast/normal': '速く動いている',
          'slow/smooth': 'ゆっくり、なめらかに動いている',
          'slow/jerky': 'ゆっくりだが、ぎくしゃくした動きだ',
          'slow/normal': 'ゆっくり動いている',
          'steady/smooth': 'なめらかに動いている',
          'steady/jerky': 'ぎくしゃくした動きだ',
          'steady/normal': '',
        };
        qualityDescription = table[`${tempo}/${smoothness}`] || '';
      }
    }

    const parts: string[] = [];
    if (jumping) parts.push('跳んでいる（足が地面から離れる）');
    if (walking) parts.push('歩いているような脚の動きをしている');
    if (wavingL) parts.push('左手を振っている');
    if (wavingR) parts.push('右手を振っている');
    if (handSwingL) parts.push('左腕を振っている');
    if (handSwingR) parts.push('右腕を振っている');
    if (bodySway) parts.push('上体が左右に揺れている');
    if (qualityDescription) parts.push(qualityDescription);
    const description = (parts.length ? parts.join('。') : '大きな動きは見られない') + '。';

    const state = this.load();
    state.motions = (state.motions || 0) + 1;
    if (quality) {
      state.qualities = (state.qualities || 0) + 1;
      // P975: 動きの速さの履歴（癖の材料）。
      state.recentTempos.push(quality.tempo);
      if (state.recentTempos.length > 20) state.recentTempos = state.recentTempos.slice(-20);
    }
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }

    return {
      frames: frames.length,
      readFrames: valid.length,
      verifiedFrames,
      description,
      handSwingL, handSwingR, wavingL, wavingR, walking, jumping,
      quality,
      qualityDescription,
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
