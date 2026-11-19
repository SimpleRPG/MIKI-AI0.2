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
  /** P1036: 頬の赤み・鼻・耳（読みは拡大側の顔の読みから） */
  blush?: boolean;
  nose?: boolean;
  ears?: boolean;
  /** P1041: 目の形（まつげ線の傾き） */
  eyeShape?: 'tareme' | 'tsurime' | null;
  /** P1042: 口の形（笑い・への字）。読みは拡大側の mouthShape */
  mouthForm?: 'smile' | 'frown' | null;
  /** P1043: 眉の角度（正=眉頭が下がる） */
  browTilt?: number | null;
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
  /** P1015: 上着と下半身の色の実測RGB（色名で潰さず描くため） */
  topRgb?: [number, number, number] | null;
  bottomRgb?: [number, number, number] | null;
  /** P1025: 上下に分かれた服か（胸と腰に服があり、腹が肌）。
   * 色の上下差（twoPiece）とは別に、形としての分かれを見る */
  separated?: boolean | null;
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
  /** P1022: 頭の半径の高さ比（head.r は幅比。縦長画像では別物になる） */
  headRh?: number | null;
  handL: PosePoint | null;
  handR: PosePoint | null;
  /** P959: 肩の位置（手の向き＝腕の軸の算出に使う） */
  shoulderL: PosePoint | null;
  shoulderR: PosePoint | null;
  /** P1053: 腰関節（骨盤）の左右の点。内部の関節推定では
   * 計算されていたが、読みに載せていなかった。 */
  hipL?: PosePoint | null;
  hipR?: PosePoint | null;
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
  /** P1015: 本人の肌色の実測RGB（頭の円の肌らしい画素の平均） */
  skinColor?: [number, number, number] | null;
  /** P1015: 髪の基準色の実測RGB（色名でなく実測で描くため） */
  hairRgb?: [number, number, number] | null;
  /** P1017: 顔の測定値（頭の拡大読みから）。描画の既定の顔は
   * この人の測定値で描く。読めなければ null。 */
  face?: { eyeSize: 'large' | 'small' | null; eyeColor: string | null; mouthSize: 'large' | 'small' | null; brows: boolean | null; blush?: boolean | null; nose?: boolean | null; ears?: boolean | null; parting?: 'center' | 'left' | 'right' | null; eyeShape?: 'tareme' | 'tsurime' | null; mouthForm?: 'smile' | 'frown' | null; browAngle?: number | null } | null;
  /** P960: 服を着ていないらしいか（肌色率から。判定できなければ null） */
  bare: boolean | null;
  bareDescription: string;
  /** P962: 重心（輪郭の重心と、足の支えの中心とのずれ） */
  balance: { centroidX: number; centroidY: number; lean: number; label: 'balanced' | 'left' | 'right' } | null;
  balanceDescription: string;
  /** P964: 髪の長さ。P1007: ツヤの帯と房の数も読む */
  hair: { length: 'short' | 'medium' | 'long'; lengthRatio: number; shine?: boolean | null; clumps?: number | null } | null;
  hairDescription: string;
  /** P966: 鎖骨の影（肌の帯でのみ判定、読めなければ null） */
  collarbone: boolean | null;
  collarboneDescription: string;
  /** P984: 首のくびれが見えるか */
  neck: boolean | null;
  neckDescription: string;
  /** P1038: 首の見える長さ（頭の下から肩が張るまで ÷ 全身） */
  neckLength?: number | null;
  /** P986: 腕の長さ（long=長い / short=短い / null=普通は言わない） */
  armLength: 'long' | 'short' | null;
  armLengthDescription: string;
  /** P987: 脚の長さ（立つ姿勢の時だけ読む） */
  legLength: 'long' | 'short' | null;
  legLengthDescription: string;
  /** P991: 素体プロファイル（部位ごとの幅 ÷ 図の高さ） */
  bodyProfile: { shoulder: number | null; chest: number | null; waist: number | null; hip: number | null; thigh: number | null; calf: number | null; ankle: number | null };
  /** P1019: 胸のふくらみ（0..1、胸と腰の幅の差から測る）。描画の既定に使う */
  bust?: number | null;
  /** P1054: 前髪の下端のライン。顔の横幅を9点に分け、各列で
   * 髪から肌へ変わる行を、頭の中心からの相対位置（半径単位）
   * で持つ。房の形そのものを測るための値。 */
  bangsEdge?: Array<number | null> | null;
  /** P1037: 胸の頂点の位置（胴の上端→腰を0..1とした割合） */
  bustPeak?: number | null;
  /** P1039: 胸の張り（0=なだらか、1=集中した丸み） */
  bustFirm?: number | null;
  /** P1022: 輪郭全体の幅（図の高さ比）。後ろ髪の広がりの既定に使う */
  silhouetteWidth?: number | null;
  /** P1028: 肩の傾き（0=水平に張る、1=首からなだらかに下がる） */
  shoulderSlope?: number | null;
  /** P1030: 腕と胴の間に背景の隙間があるか（左右別） */
  armGap?: { l: boolean; r: boolean } | null;
  /** P1031: 頭の周りの装飾品（耳の装置・髪飾り等） */
  accessories?: { side: 'l' | 'r'; y: number; rgb: [number, number, number]; kind: 'device' | 'ornament' }[] | null;
  /** P1034: 足の末端が少し上の脚より広いか（左右別） */
  footFlare?: { l: boolean; r: boolean } | null;
  /** P1035: アホ毛（頭頂から細く突き出た毛束）があるか */
  ahoge?: boolean | null;
  /** P1045: 手の大きさ（腕の島の下端の幅 ÷ 頭の幅） */
  handSize?: number | null;
  /** P1046: 膝の位置（脚の付け根→足首を 0..1 とした時の節の位置、左右別） */
  legKnee?: { l: number | null; r: number | null } | null;
  /** P1023: 輪郭（外側の境界）。24段それぞれの左端・右端を、
   * 頭の中心からの距離（図の高さ比）で持つ。横幅だけでは
   * 帯の間の曲がりや左右の非対称が落ちるため */
  contour?: { l: (number | null)[]; r: (number | null)[] } | null;
  /** P1024: 中の境界線。24段それぞれの行で、輪郭の内側に
   * 色が変わる位置（服の縁・髪と体の境目など）を持つ */
  innerLines?: (number[] | null)[] | null;
  profileComplete: boolean;
  /** P1001: 輪郭の取り方（bin=色ビン / fine=細かいビン / fill=線で囲む）と詰まり具合 */
  maskMethod: 'bin' | 'fine' | 'fill';
  silhouetteDensity: number;
  /** P1001: 図が画像の下端で見切れているか */
  truncated: boolean;
  /** P1011: 向き（front=正面 / side=横向き / back=後ろ向き / null=不明） */
  viewpoint: 'front' | 'side' | 'back' | null;
  /** P1011: 幅の種別。横向きで測った幅は体の奥行きなので、正面の幅と混ぜない */
  profileKind: 'width' | 'depth';
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
  // P1049: 同じ色の隣り合う領域を繋ぎ直す。自分の描画では
  // 髪の房の線が髪を細い帯に刻んでしまい、領域が小さく
  // 分かれて髪と判定できなかった。色の近い領域同士は
  // 同じ面とみなす（髪と肌は色が離れているので混ざらない）。
  {
    const parent = regions.map((_, i) => i);
    const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const distR = (a: number, b: number): number => Math.abs(regions[a].r - regions[b].r) + Math.abs(regions[a].g - regions[b].g) + Math.abs(regions[a].b - regions[b].b);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = comp[y * width + x];
        if (c < 0) continue;
        if (x + 1 < width) { const n = comp[y * width + x + 1]; if (n >= 0 && n !== c && distR(c, n) <= 25) { const ra = find(c), rb = find(n); if (ra !== rb) parent[ra] = rb; } }
        if (y + 1 < height) { const n = comp[(y + 1) * width + x]; if (n >= 0 && n !== c && distR(c, n) <= 25) { const ra = find(c), rb = find(n); if (ra !== rb) parent[ra] = rb; } }
      }
    }
    const merged = new Map<number, { area: number; r: number; g: number; b: number; touchesBorder: boolean; minX: number; maxX: number; minY: number; maxY: number }>();
    regions.forEach((rg, i) => {
      const root = find(i);
      const m = merged.get(root) ?? { area: 0, r: 0, g: 0, b: 0, touchesBorder: false, minX: width, maxX: -1, minY: height, maxY: -1 };
      m.r += rg.r * rg.area; m.g += rg.g * rg.area; m.b += rg.b * rg.area; m.area += rg.area;
      m.touchesBorder = m.touchesBorder || rg.touchesBorder;
      m.minX = Math.min(m.minX, rg.minX); m.maxX = Math.max(m.maxX, rg.maxX);
      m.minY = Math.min(m.minY, rg.minY); m.maxY = Math.max(m.maxY, rg.maxY);
      merged.set(root, m);
    });
    if (merged.size < regions.length) {
      const remap = new Map<number, number>();
      const next: typeof regions = [];
      for (const [root, m] of merged) {
        remap.set(root, next.length);
        next.push({ area: m.area, r: m.r / Math.max(1, m.area), g: m.g / Math.max(1, m.area), b: m.b / Math.max(1, m.area), touchesBorder: m.touchesBorder, minX: m.minX, maxX: m.maxX, minY: m.minY, maxY: m.maxY });
      }
      for (let i = 0; i < N; i++) if (comp[i] >= 0) comp[i] = remap.get(find(comp[i])) ?? comp[i];
      regions.length = 0;
      regions.push(...next);
    }
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

/**
 * P1055: 領域分割v2。線を壁にする方式（v1）は、平坦な塗りの
 * 描画では壁が足りず、逆に輪郭線と房の線で図の8割が壁に
 * なって領域が芯だけに潰れた（P1049の診断）。v2は色の
 * 近さで育てる：同じ色ビンの連結成分を作り、隣り合う成分を
 * 平均色の近さで順に寄せていく。線は細い成分としてどちらか
 * の面に吸収されるので、面が芯に潰れない。
 */
function segmentBodyMaskV2(rgba: Uint8Array | number[], width: number, height: number): { body: Uint8Array; hair: Uint8Array } | null {
  const N = width * height;
  const comp = new Int32Array(N).fill(-1);
  const keyOf = (i: number): number => (rgba[i * 4] >> 3 << 10) | (rgba[i * 4 + 1] >> 3 << 5) | (rgba[i * 4 + 2] >> 3);
  interface Comp { n: number; r: number; g: number; b: number; border: boolean }
  const comps: Comp[] = [];
  const stack: number[] = [];
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0 || rgba[i * 4 + 3] < 128) continue;
    const id = comps.length;
    const k = keyOf(i);
    let n = 0, r = 0, g = 0, b = 0, border = false;
    stack.length = 0;
    stack.push(i);
    comp[i] = id;
    while (stack.length) {
      const p = stack.pop() as number;
      n++; r += rgba[p * 4]; g += rgba[p * 4 + 1]; b += rgba[p * 4 + 2];
      const px = p % width, py = (p / width) | 0;
      if (px === 0 || py === 0 || px === width - 1 || py === height - 1) border = true;
      // P1057: 8連結にする。輪郭線は1pxの線で面を囲むため、
      // 4連結では面が線の内側の断片に切れてしまう。対角の
      // 接触を通せば、線の角を回って面が繋がる。
      for (let ddy = -1; ddy <= 1; ddy++) for (let ddx = -1; ddx <= 1; ddx++) {
        if (ddx === 0 && ddy === 0) continue;
        const nx = px + ddx, ny = py + ddy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (comp[q] < 0 && rgba[q * 4 + 3] >= 128 && keyOf(q) === k) { comp[q] = id; stack.push(q); }
      }
    }
    comps.push({ n, r, g, b, border });
  }
  if (!comps.length) return null;
  // 隣接ペアを集め、平均色の近い順に union-find で寄せる。
  const parent = comps.map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const avg = (c: Comp): [number, number, number] => [c.r / c.n, c.g / c.n, c.b / c.n];
  const pairs: Array<{ d: number; a: number; b: number }> = [];
  const seenPair = new Set<string>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const a = comp[i];
      if (a < 0) continue;
      for (const j of [x < width - 1 ? i + 1 : -1, y < height - 1 ? i + width : -1]) {
        if (j < 0) continue;
        const b = comp[j];
        if (b < 0 || b === a) continue;
        const pk = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (seenPair.has(pk)) continue;
        seenPair.add(pk);
        const A = avg(comps[a]), B = avg(comps[b]);
        pairs.push({ d: Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]) + Math.abs(A[2] - B[2]), a, b });
      }
    }
  }
  pairs.sort((p, q) => p.d - q.d);
  for (const pr of pairs) {
    if (pr.d > 34) break;
    const ra = find(pr.a), rb = find(pr.b);
    if (ra === rb) continue;
    const A = comps[ra], B = comps[rb];
    A.n += B.n; A.r += B.r; A.g += B.g; A.b += B.b; A.border = A.border || B.border;
    parent[rb] = ra;
  }
  // 背景：縁に触れる最大の塊。
  let bgRoot = -1, bgN = 0;
  for (let i = 0; i < comps.length; i++) {
    if (find(i) !== i) continue;
    if (comps[i].border && comps[i].n > bgN) { bgN = comps[i].n; bgRoot = i; }
  }
  if (bgRoot < 0) return null;
  const rootOf = new Int32Array(N);
  let figN = 0;
  for (let i = 0; i < N; i++) { rootOf[i] = comp[i] >= 0 ? find(comp[i]) : -1; if (rootOf[i] >= 0 && rootOf[i] !== bgRoot) figN++; }
  if (figN < 20) return null;
  // 髪サンプル：上部10%の中央帯の、背景でない画素の平均。
  let hr = 0, hg = 0, hb = 0, hn = 0;
  const topBand = Math.max(1, Math.floor(height * 0.1));
  for (let y = 0; y < topBand; y++) {
    for (let x = Math.floor(width * 0.35); x < Math.floor(width * 0.65); x++) {
      const i = y * width + x;
      if (rootOf[i] < 0 || rootOf[i] === bgRoot) continue;
      hr += rgba[i * 4]; hg += rgba[i * 4 + 1]; hb += rgba[i * 4 + 2]; hn++;
    }
  }
  const isSkinAvg = (r: number, g: number, b: number): boolean => r > 190 && g >= b && r - b >= 12;
  // P1055: 髪サンプルは肌と無彩色（装置）を除いて取る。
  // 上部の帯には顔と装置が混ざり、そのまま平均すると
  // 髪そのものの色から離れてしまうため。
  {
    let r2 = 0, g2 = 0, b2 = 0, n2 = 0;
    for (let y = 0; y < topBand; y++) {
      for (let x = Math.floor(width * 0.35); x < Math.floor(width * 0.65); x++) {
        const i = y * width + x;
        if (rootOf[i] < 0 || rootOf[i] === bgRoot) continue;
        const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
        if (isSkinAvg(r, g, b)) continue;
        if (Math.max(r, g, b) - Math.min(r, g, b) < 14) continue;
        r2 += r; g2 += g; b2 += b; n2++;
      }
    }
    if (n2 >= 10) { hr = r2; hg = g2; hb = b2; hn = n2; }
  }
  if (hn < 10) return null;
  const hairSample: [number, number, number] = [hr / hn, hg / hn, hb / hn];
  // 図の外接範囲（位置の条件に使う）。
  let figTop = height, figBottom = -1, figLeft = width, figRight = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rootOf[y * width + x] >= 0 && rootOf[y * width + x] !== bgRoot) {
      if (y < figTop) figTop = y;
      if (y > figBottom) figBottom = y;
      if (x < figLeft) figLeft = x;
      if (x > figRight) figRight = x;
    }
  }
  const figArea = Math.max(1, figN);
  const rootBox = new Map<number, { minX: number; maxX: number; minY: number; maxY: number }>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rt = rootOf[y * width + x];
    if (rt < 0 || rt === bgRoot) continue;
    const bb = rootBox.get(rt);
    if (!bb) rootBox.set(rt, { minX: x, maxX: x, minY: y, maxY: y });
    else { bb.minX = Math.min(bb.minX, x); bb.maxX = Math.max(bb.maxX, x); bb.minY = Math.min(bb.minY, y); bb.maxY = Math.max(bb.maxY, y); }
  }
  // P1058: 線の塊。暗くて、外接矩形に対して薄い（蛇行して
  // いる）塊は、面ではなく線とみなす。線は体でも髪でも
  // なく、隣接は線を飛び越えて数える（線で切れた面の
  // 断片同士を隣り合わせにするため）。
  const lineRoots = new Set<number>();
  for (const [i, bb] of rootBox) {
    const A = avg(comps[i]);
    const lum = A[0] * 0.3 + A[1] * 0.59 + A[2] * 0.11;
    const boxArea = Math.max(1, (bb.maxX - bb.minX + 1) * (bb.maxY - bb.minY + 1));
    if (lum < 100 && comps[i].n / boxArea < 0.35) lineRoots.add(i);
  }
  const hairRoots = new Set<number>();
  for (let i = 0; i < comps.length; i++) {
    if (find(i) !== i || i === bgRoot || lineRoots.has(i)) continue;
    const c = comps[i];
    const A = avg(c);
    const dist = Math.abs(A[0] - hairSample[0]) + Math.abs(A[1] - hairSample[1]) + Math.abs(A[2] - hairSample[2]);
    if (dist > 80 || isSkinAvg(A[0], A[1], A[2])) continue;
    // 位置の条件（v1踏襲）：上部にある、中心から外れている、
    // または図の2割を超える大きな塊だけを髪とする（胸元の
    // 服のように髪と色の近い中央の塊を髪と誤らないため）。
    const bb = rootBox.get(i);
    const touchesTop = bb !== undefined && bb.minY <= figTop + (figBottom - figTop) * 0.15;
    const offCenter = bb !== undefined && (Math.abs(bb.minX - (figLeft + figRight) / 2) > (figRight - figLeft) * 0.28 || Math.abs(bb.maxX - (figLeft + figRight) / 2) > (figRight - figLeft) * 0.28);
    if (touchesTop || offCenter || c.n > figArea * 0.2) hairRoots.add(i);
  }
  if (!hairRoots.size) return null;
  // P1055: 髪の影色は種から一足では届かない（平坦な2色の
  // 髪では影が種から色距離で100以上離れる）。隣り合う塊へ
  // 1段ずつ広げる（肌色は常に除く。位置の条件は広げた先
  // にも同じく課すので、中央の服は広がっても髪にならない）。
  {
    const rootAvg = new Map<number, [number, number, number]>();
    for (let i = 0; i < comps.length; i++) if (find(i) === i && i !== bgRoot) rootAvg.set(i, avg(comps[i]));
    const adj = new Map<number, Set<number>>();
    const linkAdj = (ra: number, rb: number): void => {
      if (ra === rb || ra === bgRoot || rb === bgRoot || lineRoots.has(ra) || lineRoots.has(rb)) return;
      if (!adj.has(ra)) adj.set(ra, new Set());
      if (!adj.has(rb)) adj.set(rb, new Set());
      (adj.get(ra) as Set<number>).add(rb);
      (adj.get(rb) as Set<number>).add(ra);
    };
    for (const pr of pairs) linkAdj(find(pr.a), find(pr.b));
    // 線の両側の塊同士を隣り合わせにする。
    {
      const lineNbrs = new Map<number, Set<number>>();
      for (const pr of pairs) {
        const ra = find(pr.a), rb = find(pr.b);
        for (const [ln, other] of [[ra, rb], [rb, ra]] as const) {
          if (!lineRoots.has(ln) || other === bgRoot || lineRoots.has(other)) continue;
          if (!lineNbrs.has(ln)) lineNbrs.set(ln, new Set());
          (lineNbrs.get(ln) as Set<number>).add(other);
        }
      }
      for (const ns of lineNbrs.values()) {
        const arr = Array.from(ns);
        for (let x = 0; x < arr.length; x++) for (let y = x + 1; y < arr.length; y++) linkAdj(arr[x], arr[y]);
      }
    }
    const posOk = (i: number): boolean => {
      const bb = rootBox.get(i);
      if (!bb) return false;
      return bb.minY <= figTop + (figBottom - figTop) * 0.15
        || Math.abs(bb.minX - (figLeft + figRight) / 2) > (figRight - figLeft) * 0.28
        || Math.abs(bb.maxX - (figLeft + figRight) / 2) > (figRight - figLeft) * 0.28
        || comps[i].n > figArea * 0.2;
    };
    let grew = true;
    while (grew) {
      grew = false;
      for (const i of Array.from(hairRoots)) {
        for (const j of adj.get(i) ?? []) {
          if (hairRoots.has(j)) continue;
          const A = rootAvg.get(j);
          if (!A || isSkinAvg(A[0], A[1], A[2])) continue;
          const H = rootAvg.get(i);
          if (!H) continue;
          const d = Math.abs(A[0] - H[0]) + Math.abs(A[1] - H[1]) + Math.abs(A[2] - H[2]);
          if (d <= 130 && posOk(j)) { hairRoots.add(j); grew = true; }
        }
      }
    }
  }
  const body = new Uint8Array(N);
  const hair = new Uint8Array(N);
  let bodyN = 0, hairN = 0;
  for (let i = 0; i < N; i++) {
    const rt = rootOf[i];
    if (rt < 0 || rt === bgRoot) continue;
    if (lineRoots.has(rt)) continue;
    if (hairRoots.has(rt)) { hair[i] = 1; hairN++; }
    else { body[i] = 1; bodyN++; }
  }
  const share = bodyN / Math.max(1, bodyN + hairN);
  if (share < 0.12 || share > 0.8) return null;
  // 縦の小さな隙間（3pxまで）を繋ぐ（v1踏襲）。
  for (let x = 0; x < width; x++) {
    let lastFg = -1;
    for (let y = 0; y < height; y++) {
      if (!body[y * width + x]) continue;
      if (lastFg >= 0 && y - lastFg <= 4) for (let yy = lastFg + 1; yy < y; yy++) body[yy * width + x] = 1;
      lastFg = y;
    }
  }
  return { body, hair };
}

export /** P1001: 影色の自動生成。素の色を暗くし、少し冷たく寄せる（色のルール第1段） */
function deriveShadow(c: [number, number, number]): [number, number, number] {
  return [
    Math.max(0, Math.round(c[0] * 0.7 - 6)),
    Math.max(0, Math.round(c[1] * 0.7)),
    Math.min(255, Math.round(c[2] * 0.72 + 10)),
  ];
}

const TARGET_KEY = 'miki_visual_target_v1';
const CORRECTION_KEY = 'miki_visual_corrections_v1';

/** P1001: 目標の素体（見本を測って保存したパラメータ） */
export interface BodyTarget {
  profile: PoseReading['bodyProfile'];
  hairLength: 'short' | 'medium' | 'long' | null;
  hairColor: string | null;
  build: string | null;
  // P1027: 輪郭も目標に持つ（幅の合計だけでは寄せられない形）
  contour?: { l: (number | null)[]; r: (number | null)[] } | null;
  silhouetteWidth?: number | null;
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
  private load(): { analyzed: number; verified: number; motions: number; clothing: number; extras: number; multi: number; holding: number; bare: number; imitations: number; imitationsOk: number; balances: number; qualities: number; hairs: number; collarbones: number; hairShapes: number; necks: number; armLengths: number; legLengths: number; profiles: number; bodies: number; bodiesOk: number; facesDrawn: number; facesOk: number; smooth: number; smoothOk: number; shaded: number; shadedOk: number; curved: number; curvedOk: number; outline: number; outlineOk: number; eyesDrawn: number; eyesOk: number; maskFill: number; cel: number; celOk: number; hairDetail: number; hairDetailOk: number; structured: number; structuredOk: number; contours: number; contoursOk: number; innerLines: number; innerLinesOk: number; bust: number; bustOk: number; targets: number; drills: number; drillsOk: number; clothes: number; clothesOk: number; lineRole: number; lineRoleOk: number; regions: number; frontHair: number; frontHairOk: number; hairReads: number; drillLevel: number; elementDrills: number; elementDrillsOk: number; plateaus: number; graduations: number; sideViews: number; backViews: number; recentLeans: string[]; recentTempos: string[] } {
    try {
      const raw = storageService.getJson(KEY, null) as { analyzed?: number; verified?: number; motions?: number; clothing?: number; extras?: number; multi?: number; holding?: number; bare?: number; imitations?: number; imitationsOk?: number; balances?: number; qualities?: number; hairs?: number; collarbones?: number; hairShapes?: number; necks?: number; armLengths?: number; legLengths?: number; profiles?: number; bodies?: number; bodiesOk?: number; facesDrawn?: number; facesOk?: number; smooth?: number; smoothOk?: number; shaded?: number; shadedOk?: number; curved?: number; curvedOk?: number; outline?: number; outlineOk?: number; eyesDrawn?: number; eyesOk?: number; maskFill?: number; cel?: number; celOk?: number; hairDetail?: number; hairDetailOk?: number; structured?: number; structuredOk?: number; contours?: number; contoursOk?: number; innerLines?: number; innerLinesOk?: number; bust?: number; bustOk?: number; targets?: number; drills?: number; drillsOk?: number; clothes?: number; clothesOk?: number; lineRole?: number; lineRoleOk?: number; regions?: number; frontHair?: number; frontHairOk?: number; hairReads?: number; drillLevel?: number; elementDrills?: number; elementDrillsOk?: number; plateaus?: number; graduations?: number; sideViews?: number; backViews?: number; recentLeans?: string[]; recentTempos?: string[] } | null;
      if (raw) return { analyzed: raw.analyzed || 0, verified: raw.verified || 0, motions: raw.motions || 0, clothing: raw.clothing || 0, extras: raw.extras || 0, multi: raw.multi || 0, holding: raw.holding || 0, bare: raw.bare || 0, imitations: raw.imitations || 0, imitationsOk: raw.imitationsOk || 0, balances: raw.balances || 0, qualities: raw.qualities || 0, hairs: raw.hairs || 0, collarbones: raw.collarbones || 0, hairShapes: raw.hairShapes || 0, necks: raw.necks || 0, armLengths: raw.armLengths || 0, legLengths: raw.legLengths || 0, profiles: raw.profiles || 0, bodies: raw.bodies || 0, bodiesOk: raw.bodiesOk || 0, facesDrawn: raw.facesDrawn || 0, facesOk: raw.facesOk || 0, smooth: raw.smooth || 0, smoothOk: raw.smoothOk || 0, shaded: raw.shaded || 0, shadedOk: raw.shadedOk || 0, curved: raw.curved || 0, curvedOk: raw.curvedOk || 0, outline: raw.outline || 0, outlineOk: raw.outlineOk || 0, eyesDrawn: raw.eyesDrawn || 0, eyesOk: raw.eyesOk || 0, maskFill: raw.maskFill || 0, cel: raw.cel || 0, celOk: raw.celOk || 0, hairDetail: raw.hairDetail || 0, hairDetailOk: raw.hairDetailOk || 0, structured: raw.structured || 0, structuredOk: raw.structuredOk || 0, contours: raw.contours || 0, contoursOk: raw.contoursOk || 0, innerLines: raw.innerLines || 0, innerLinesOk: raw.innerLinesOk || 0, bust: raw.bust || 0, bustOk: raw.bustOk || 0, targets: raw.targets || 0, drills: raw.drills || 0, drillsOk: raw.drillsOk || 0, clothes: raw.clothes || 0, clothesOk: raw.clothesOk || 0, lineRole: raw.lineRole || 0, lineRoleOk: raw.lineRoleOk || 0, regions: raw.regions || 0, frontHair: raw.frontHair || 0, frontHairOk: raw.frontHairOk || 0, hairReads: raw.hairReads || 0, drillLevel: raw.drillLevel || 1, elementDrills: raw.elementDrills || 0, elementDrillsOk: raw.elementDrillsOk || 0, plateaus: raw.plateaus || 0, graduations: raw.graduations || 0, sideViews: raw.sideViews || 0, backViews: raw.backViews || 0, recentLeans: Array.isArray(raw.recentLeans) ? raw.recentLeans : [], recentTempos: Array.isArray(raw.recentTempos) ? raw.recentTempos : [] };
    } catch { /* fall through */ }
    return { analyzed: 0, verified: 0, motions: 0, clothing: 0, extras: 0, multi: 0, holding: 0, bare: 0, imitations: 0, imitationsOk: 0, balances: 0, qualities: 0, hairs: 0, collarbones: 0, hairShapes: 0, necks: 0, armLengths: 0, legLengths: 0, profiles: 0, bodies: 0, bodiesOk: 0, facesDrawn: 0, facesOk: 0, smooth: 0, smoothOk: 0, shaded: 0, shadedOk: 0, curved: 0, curvedOk: 0, outline: 0, outlineOk: 0, eyesDrawn: 0, eyesOk: 0, maskFill: 0, cel: 0, celOk: 0, hairDetail: 0, hairDetailOk: 0, structured: 0, structuredOk: 0, contours: 0, contoursOk: 0, innerLines: 0, innerLinesOk: 0, bust: 0, bustOk: 0, targets: 0, drills: 0, drillsOk: 0, clothes: 0, clothesOk: 0, lineRole: 0, lineRoleOk: 0, regions: 0, frontHair: 0, frontHairOk: 0, hairReads: 0, drillLevel: 1, elementDrills: 0, elementDrillsOk: 0, plateaus: 0, graduations: 0, sideViews: 0, backViews: 0, recentLeans: [], recentTempos: [] };
  }

  public summary(): { analyzed: number; verified: number; motions: number; clothing: number; extras: number; multi: number; holding: number; bare: number; imitations: number; imitationsOk: number; balances: number; qualities: number; hairs: number; collarbones: number; hairShapes: number; necks: number; armLengths: number; legLengths: number; profiles: number; bodies: number; bodiesOk: number; facesDrawn: number; facesOk: number; smooth: number; smoothOk: number; shaded: number; shadedOk: number; curved: number; curvedOk: number; outline: number; outlineOk: number; eyesDrawn: number; eyesOk: number; maskFill: number; cel: number; celOk: number; hairDetail: number; hairDetailOk: number; structured: number; structuredOk: number; contours: number; contoursOk: number; innerLines: number; innerLinesOk: number; bust: number; bustOk: number; targets: number; drills: number; drillsOk: number; clothes: number; clothesOk: number; lineRole: number; lineRoleOk: number; regions: number; frontHair: number; frontHairOk: number; hairReads: number; drillLevel: number; elementDrills: number; elementDrillsOk: number; plateaus: number; graduations: number; sideViews: number; backViews: number; leanWindow: number; habit: 'left' | 'balanced' | 'right' | null; qualityWindow: number; motionHabit: 'fast' | 'steady' | 'slow' | null } {
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
    return { analyzed: s.analyzed, verified: s.verified, motions: s.motions, clothing: s.clothing, extras: s.extras, multi: s.multi, holding: s.holding, bare: s.bare, imitations: s.imitations, imitationsOk: s.imitationsOk, balances: s.balances, qualities: s.qualities, hairs: s.hairs, collarbones: s.collarbones, hairShapes: s.hairShapes, necks: s.necks, armLengths: s.armLengths, legLengths: s.legLengths, profiles: s.profiles, bodies: s.bodies, bodiesOk: s.bodiesOk, facesDrawn: s.facesDrawn, facesOk: s.facesOk, smooth: s.smooth, smoothOk: s.smoothOk, shaded: s.shaded, shadedOk: s.shadedOk, curved: s.curved, curvedOk: s.curvedOk, outline: s.outline, outlineOk: s.outlineOk, eyesDrawn: s.eyesDrawn, eyesOk: s.eyesOk, maskFill: s.maskFill, cel: s.cel, celOk: s.celOk, hairDetail: s.hairDetail, hairDetailOk: s.hairDetailOk, structured: s.structured, structuredOk: s.structuredOk, contours: s.contours, contoursOk: s.contoursOk, innerLines: s.innerLines, innerLinesOk: s.innerLinesOk, bust: s.bust, bustOk: s.bustOk, targets: s.targets, drills: s.drills, drillsOk: s.drillsOk, clothes: s.clothes, clothesOk: s.clothesOk, lineRole: s.lineRole, lineRoleOk: s.lineRoleOk, regions: s.regions, frontHair: s.frontHair, frontHairOk: s.frontHairOk, hairReads: s.hairReads, drillLevel: s.drillLevel, elementDrills: s.elementDrills, elementDrillsOk: s.elementDrillsOk, plateaus: s.plateaus, graduations: s.graduations, sideViews: s.sideViews, backViews: s.backViews, leanWindow: s.recentLeans.length, habit, qualityWindow: s.recentTempos.length, motionHabit };
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
    const seg = (a: { x: number; y: number } | null, b: { x: number; y: number } | null, c: [number, number, number], r = 2.8) => {
      if (!a || !b) return;
      const ax = a.x * (S - 1), ay = a.y * (S - 1), bx = b.x * (S - 1), by = b.y * (S - 1);
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let i = 0; i <= steps; i++) stamp(ax + (bx - ax) * (i / steps), ay + (by - ay) * (i / steps), r, c);
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
    // P1065: 胴は線でなく面で描く。棒だけの図は胴の走査が
    // 細い線しか拾えず、肩と手の読みが中央に潰れてしまう。
    // 関節の位置は変えず、首→腰を太く塗って人形にする。
    seg(neck, hipC, BODY, 4.2);
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
  /**
   * P1068: 中の線を描く。読みに残っている内側の境界
   * （髪の房の分かれ・服の縁）を、測った位置に影色の
   * 線で描き戻す。今までは読みに持つだけで描く側が
   * 使わず、測り直しで線がほぼ消えて中の線の照合が
   * 成立しなかった。線の色は左隣の色の影色（セル画の
   * 境目の流儀）で、背景の上には描かない。
   */
  private stampInnerLines(img: Uint8Array, S: number, reading: PoseReading): void {
    if (!reading.innerLines || !reading.head) return;
    const headRh = reading.headRh ?? reading.head.r;
    const topPx = (reading.head.y - headRh) * (S - 1);
    const footYn = Math.max(reading.footL?.y ?? 0, reading.footR?.y ?? 0);
    const figHpPx = Math.max(1, ((footYn > 0 ? footYn : 0.98) - (reading.head.y - headRh)) * (S - 1));
    const cxPx = reading.head.x * (S - 1);
    const bandHalf = figHpPx / 48;
    const bg: [number, number, number] = [img[0], img[1], img[2]];
    const isBg = (x: number, y: number): boolean => {
      const i = (y * S + x) * 4;
      return Math.abs(img[i] - bg[0]) <= 10 && Math.abs(img[i + 1] - bg[1]) <= 10 && Math.abs(img[i + 2] - bg[2]) <= 10;
    };
    for (let i = 0; i < 24; i++) {
      const pts = reading.innerLines[i];
      if (!pts) continue;
      const yC = topPx + ((i + 0.5) / 24) * figHpPx;
      for (const v of pts) {
        const xC = Math.round(cxPx + v * figHpPx);
        if (xC < 1 || xC >= S) continue;
        for (let y = Math.round(yC - bandHalf); y <= Math.round(yC + bandHalf); y++) {
          if (y < 0 || y >= S || isBg(xC, y)) continue;
          const li = (y * S + xC - 1) * 4;
          const ci = (y * S + xC) * 4;
          const base: [number, number, number] = isBg(xC - 1, y) ? [img[ci], img[ci + 1], img[ci + 2]] : [img[li], img[li + 1], img[li + 2]];
          const sh = deriveShadow(base);
          img[ci] = sh[0]; img[ci + 1] = sh[1]; img[ci + 2] = sh[2];
        }
      }
    }
  }

  public renderBody(reading: PoseReading, size = 64, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; bustPeak?: number; bustFirm?: number; frontHair?: boolean; backHair?: boolean; shoulderSlope?: number } | null = null): Uint8Array | null {
    if (!reading.head || !reading.profileComplete) return null;
    const S = size;
    // P1063: 描く側の癖（部位ごとの補正）を寸法にかける。
    // 補正はドリル（drillCorrections）が「寸法どおりに
    // 描いたのに測るとずれる」分を描く側で吸収するために
    // 学んだもので、読み取り値そのものは汚さない。
    const corrTbl = this.getDrawingCorrections();
    const prof: PoseReading['bodyProfile'] = {
      shoulder: reading.bodyProfile.shoulder === null ? null : reading.bodyProfile.shoulder * corrTbl.shoulder,
      chest: reading.bodyProfile.chest === null ? null : reading.bodyProfile.chest * corrTbl.chest,
      waist: reading.bodyProfile.waist === null ? null : reading.bodyProfile.waist * corrTbl.waist,
      hip: reading.bodyProfile.hip === null ? null : reading.bodyProfile.hip * corrTbl.hip,
      thigh: reading.bodyProfile.thigh === null ? null : reading.bodyProfile.thigh * corrTbl.thigh,
      calf: reading.bodyProfile.calf === null ? null : reading.bodyProfile.calf * corrTbl.calf,
      ankle: reading.bodyProfile.ankle === null ? null : reading.bodyProfile.ankle * corrTbl.ankle,
    };
    // P1015: 描くのは「その人」。色の既定は読み取り本人の実測
    // から取る（肌色・髪色・服の色）。ドリルや照合が青いテスト
    // 人形の色条件で訓練することにならないようにするため
    // （2026-11-19にきりあが指摘：1人をどうこうする話）。
    const SKIN: [number, number, number] = reading.skinColor ?? [232, 190, 160];
    const HAIR0: [number, number, number] = colors?.hair ?? reading.hairRgb ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
    const distBg = (c: [number, number, number]): number => Math.abs(c[0] - 245) + Math.abs(c[1] - 245) + Math.abs(c[2] - 245);
    const topRgb = reading.clothing?.topRgb ?? (reading.clothing?.topColor ? EXTRA_COLORS.find((c) => c.name === reading.clothing.topColor)?.rgb : undefined);
    const BODY: [number, number, number] = colors?.body ?? (topRgb && distBg(topRgb) > 40 ? topRgb : (reading.skinColor ?? [40, 40, 120]));
    // 本人の色が背景に近い時は描く板の色を落とす（白い水着や
    // 薄い肌が白い板に溶けて測れなくなるのを防ぐ）。
    const BG_COL: [number, number, number] = Math.min(distBg(BODY), distBg(SKIN), distBg(HAIR0)) <= 60 ? [168, 168, 172] : [245, 245, 245];
    const px: Array<[number, number, number]> = [];
    for (let i = 0; i < S * S; i++) px.push(BG_COL);
    // P1025: 上下が分かれた服は服として描く（胸の帯＝上の色、
    // 腹は肌、腰から下＝下の色、境目には影色の線）。一体の服や
    // 裸の読みでは従来どおり全面BODY。
    const colorTwo = reading.clothing?.twoPiece === true;
    const separated = reading.clothing?.separated === true;
    const twoPiece = (colorTwo || separated) && reading.bare !== true;
    const BOTC: [number, number, number] = reading.clothing?.bottomRgb ?? (reading.clothing?.bottomColor ? EXTRA_COLORS.find((c) => c.name === reading.clothing.bottomColor)?.rgb : undefined) ?? BODY;
    const BODY_SH: [number, number, number] = deriveShadow(BODY);
    const BOTC_SH: [number, number, number] = deriveShadow(BOTC);
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
    const headRh = reading.headRh ?? head.r; // P1022: 大きさは高さ比で測る
    const shoulderY = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.y + reading.shoulderR.y) / 2 : head.y + headRh * 1.6;
    const cxN = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.x + reading.shoulderR.x) / 2 : head.x;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const hipY = shoulderY + (footY - shoulderY) * 0.43;
    const figHn = Math.max(0.1, footY - (head.y - headRh));
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
    // P1065: 腰の幅は最下行でようやく届く形ではなく、手前で
    // 届いて台地になるようにした。股の位置から測る腰の帯が
    // 斜面の途中ばかり拾って細く読めていたため。
    const torsoW = (t: number) => (t < 0.3 ? lerp(shoulderW, chestW, t / 0.3) : t < 0.55 ? lerp(chestW, waistW, (t - 0.3) / 0.25) : t < 0.78 ? waistW : t < 0.93 ? lerp(waistW, hipW, (t - 0.78) / 0.15) : hipW);
    // P1022: 体の後ろに広がる髪の層。長い髪は体の横の板ではなく、
    // 後ろに垂れて下で広がる面として最初に描く（体はその上に
    // 描かれる）。広がりは読みの輪郭幅から取る：サンプルの
    // 輪郭は腰から下の広がりを髪が決めていた（IoU 0.47の主因）。
    if (reading.hair && reading.hair.length === 'long' && shape?.backHair === true) {
      const bkTopY = (head.y - headRh) * (S - 1);
      const bkBottomY = bkTopY + reading.hair.lengthRatio * figHn * (S - 1);
      const headHalf = Math.max(2, headRh * S) * 0.95;
      const maxHalf = reading.silhouetteWidth
        ? reading.silhouetteWidth * figHn * (S - 1) * 0.5 * 0.94
        : Math.max(hipW, shoulderW) * 0.72;
      const bkCx = cxN * (S - 1);
      // 後ろの髪は少し落とした色の面として描く（実物でも後ろ髪は
      // 暗く落ちる。前の髪と同色だと、体との境界に壁が立たず、
      // 自分の描画を測り直す時に髪と体が分離できない。落とし
      // すぎると別の色の布に見えるので、影色へ35%だけ寄せる）。
      const SH = deriveShadow(HAIR0);
      const HAIR_BK: [number, number, number] = [Math.round(HAIR0[0] + (SH[0] - HAIR0[0]) * 0.35), Math.round(HAIR0[1] + (SH[1] - HAIR0[1]) * 0.35), Math.round(HAIR0[2] + (SH[2] - HAIR0[2]) * 0.35)];
      const HAIR_BK2 = SH;
      for (let y = Math.round(bkTopY); y <= Math.round(Math.min(S - 1, bkBottomY)); y++) {
        const t = Math.min(1, Math.max(0, (y - bkTopY) / Math.max(1, bkBottomY - bkTopY)));
        const spread = t < 0.55 ? lerp(headHalf, maxHalf, (t / 0.55) ** 1.2) : t < 0.78 ? lerp(maxHalf, maxHalf * 0.8, (t - 0.55) / 0.23) : lerp(maxHalf * 0.8, maxHalf * 0.42, (t - 0.78) / 0.22);
        for (let x = Math.round(bkCx - spread); x <= Math.round(bkCx + spread); x++) {
          if (t > 0.92) {
            const notch = Math.max(2, Math.round(spread / 3));
            if (Math.round(Math.abs(x - bkCx)) % notch === 0) continue;
          }
          const edge = Math.abs(x - bkCx) / Math.max(1, spread);
          // 腰から上は素の髪色（体に隠れる部分が多く、色の
          // 代表を影に奪われないため）。影の面は腰から下と縁。
          const aboveHip = y < hipY * (S - 1);
          set(x, y, edge > 0.78 ? HAIR_BK2 : aboveHip ? HAIR0 : HAIR_BK);
        }
      }
    }
    // 胴：行ごとに幅を補間して塗る
    const y0 = Math.round(shoulderY * (S - 1)), y1 = Math.round(hipY * (S - 1));
    const bustAmt = shape?.bust ?? reading.bust ?? 0;
    // P1037: 膨らみの中心は読みの頂点位置に合わせる。
    const bustC = shape?.bustPeak ?? reading.bustPeak ?? 0.3;
    // P1039: 張りが強いほど膨らみは鋭く（σが小さい）。
    const bustSigma = 0.13 * (1.3 - 0.55 * (shape?.bustFirm ?? reading.bustFirm ?? 0.5));
    for (let y = y0; y <= y1; y++) {
      const t = y1 > y0 ? (y - y0) / (y1 - y0) : 0;
      let w = torsoW(t);
      // P1028: 肩の傾き。胴の上部は首元ほど狭くして、肩先へ
      // なだらかに広げる（水平な肩は傾き0で従来どおり）。
      const slopeAmt = shape?.shoulderSlope ?? reading.shoulderSlope ?? 0;
      // P1065: 絞りの強さは測定の定義に合わせる。測定は
      // 肩の行の少し下と少し先の幅の比なので、描く側も
      // 肩口で (1 - 傾き) まで絞り、帯の1/4ほどで全幅に
      // 戻す形にすると、読み返しが同じ傾きを返す。
      if (slopeAmt > 0 && t < 0.24) w *= 1 - slopeAmt * (1 - t / 0.24);
      // P1001: 胸の曲線。胸の帯にガウス型のふくらみを足す。
      if (bustAmt > 0) w *= 1 + bustAmt * 0.16 * Math.exp(-(((t - bustC) / bustSigma) ** 2));
      // P1025: 上下二つの服では、帯ごとに色を変える。
      let rowCol: [number, number, number] = BODY;
      if (twoPiece) {
        const tNext = y1 > y0 ? (y + 1 - y0) / (y1 - y0) : 1;
        const tPrev = y1 > y0 ? (y - 1 - y0) / (y1 - y0) : 0;
        // 腹が見えるのは形として分かれた服だけ。色違いの
        // 上下（シャツ＋ズボン等）では腹も上の色で続ける。
        rowCol = t < 0.5 ? BODY : t < 0.85 ? (separated ? SKIN : BODY) : BOTC;
        if (separated && t < 0.5 && tNext >= 0.5) rowCol = BODY_SH; // 上の服の下端の線
        else if (t >= 0.85 && tPrev < 0.85) rowCol = BOTC_SH; // 下の服の上端の線
      }
      for (let x = Math.round(cxN * (S - 1) - w / 2); x <= Math.round(cxN * (S - 1) + w / 2); x++) set(x, y, rowCol);
    }
    // P1032: 鎖骨の線。読みで影が見えた人には、首の付け根から
    // 肩側へ下がる影の線を2本描く（肌の影色）。
    if (reading.collarbone === true) {
      const CB: [number, number, number] = deriveShadow(SKIN);
      const cbY0 = y0 + 1;
      const cbY1 = y0 + figHn * S * 0.045;
      for (const sgn of [-1, 1]) {
        const xA = cxN * (S - 1) + sgn * shoulderW * 0.09;
        const xB = cxN * (S - 1) + sgn * shoulderW * 0.33;
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          stamp(xA + (xB - xA) * t, cbY0 + (cbY1 - cbY0) * t, 0.9, CB);
        }
      }
    }
    // P1001: 胸の下の影の線（前面で胸の丸みとして読める要素）。
    if (bustAmt > 0) {
      const SHADE: [number, number, number] = [Math.max(0, BODY[0] * 0.7 - 6), Math.max(0, BODY[1] * 0.7), Math.min(255, BODY[2] * 0.72 + 10)];
      const by = y0 + (y1 - y0) * Math.min(0.62, bustC + 0.15);
      const bw = torsoW(bustC) * (1 + bustAmt * 0.16) * 0.34;
      for (let x = Math.round(cxN * (S - 1) - bw); x <= Math.round(cxN * (S - 1) + bw); x++) {
        const dip = Math.cos(((x - cxN * (S - 1)) / Math.max(1, bw)) * Math.PI * 0.5) * (y1 - y0) * 0.03;
        set(x, by + dip, SHADE);
        set(x, by + dip + 1, SHADE);
      }
    }
    // 脚：腰から足先へ、太もも→ふくらはぎ→足首と細くする
    const legTop = y1, legBottom = Math.round(footY * (S - 1));
    const legSpanRows = new Map<number, { l?: [number, number]; r?: [number, number] }>();
    for (const sideSign of [-1, 1]) {
      const foot = sideSign < 0 ? reading.footL : reading.footR;
      const hipX = cxN * (S - 1) + sideSign * legSpread;
      const footX = foot ? foot.x * (S - 1) : hipX;
      for (let y = legTop; y <= legBottom; y++) {
        const t = legBottom > legTop ? (y - legTop) / (legBottom - legTop) : 0;
        const w = t < 0.6 ? lerp(thighW, calfW, t / 0.6) : lerp(calfW, ankleW, (t - 0.6) / 0.4);
        const cxp = lerp(hipX, footX, t);
        // P1025: 下の服は脚の付け根だけ（分かれ形）。裾に線。
        let legCol: [number, number, number] = BODY;
        if (twoPiece) {
          if (reading.clothing?.bottom === 'split' && separated) {
            const tPrevL = legBottom > legTop ? (y - 1 - legTop) / (legBottom - legTop) : 0;
            legCol = t < 0.16 ? BOTC : tPrevL < 0.16 ? BOTC_SH : SKIN;
          } else if (reading.clothing?.bottom === 'split' && colorTwo) {
            legCol = BOTC; // ズボンとして脚全体を下の色に
          } else {
            legCol = SKIN;
          }
        }
        // P1029: 足の形。末端は外側へ少し広げ（足の甲）、
        // 最下行は影色にしてつま先の線にする。脚の柱のまま
        // 切り落とさない。
        // P1047: 足首の統計を足の広がり域より上で測るよう
        // 分離したので、広がりの描画を読みに連動させる。
        const flareOn = reading.footFlare ? (sideSign < 0 ? reading.footFlare.l : reading.footFlare.r) : false;
        const footExt = t >= 0.94 && flareOn ? Math.round(w * 0.22) : 0;
        const fx0 = Math.round(cxp - w / 2) - (sideSign < 0 ? footExt : 0);
        const fx1 = Math.round(cxp + w / 2) + (sideSign > 0 ? footExt : 0);
        const rowC: [number, number, number] = y === legBottom ? deriveShadow(legCol) : legCol;
        for (let x = fx0; x <= fx1; x++) set(x, y, rowC);
        const rec = legSpanRows.get(y) ?? {};
        if (sideSign < 0) rec.l = [fx0, fx1]; else rec.r = [fx0, fx1];
        legSpanRows.set(y, rec);
      }
    }
    // P1065: 両脚が触れる／重なる行は、中心に1pxの隙間を
    // 残す。脚の中心は足位置で決まり、幅はプロファイルで
    // 決まるため、太い脚では脚同士が融合して1本の柱に
    // なり、股がどこにも無い絵になっていた（ドリルが
    // 太い目標へ寄せると必ずここで詰まった）。セル画で
    // 脚の間に線を引くのと同じで、隙間があることで
    // 「2本の脚」として測れる形になる。
    {
      const cxPx = Math.round(cxN * (S - 1));
      // 隙間の幅は描く大きさに合わせる（大きい描画を縮小して
      // 作る双子では、1pxの隙間が埋もれて消えてしまうため）。
      const gapHalf = Math.max(0, Math.round(S / 256));
      for (const [y, rec] of legSpanRows) {
        if (rec.l && rec.r && rec.l[1] >= rec.r[0] - 1) {
          for (let gx = cxPx - gapHalf; gx <= cxPx + gapHalf; gx++) set(gx, y, BG_COL);
        }
      }
    }
    // 腕：肩から手へ太い線。P1001: 肩側を太く手首側を細く（テーパー）。
    const armR0 = Math.max(1.4, figHn * S * 0.03);
    const seg = (a: { x: number; y: number } | null, b: { x: number; y: number } | null, gap = false) => {
      if (!a || !b) return;
      const ax = a.x * (S - 1), ay = a.y * (S - 1), bx = b.x * (S - 1), by = b.y * (S - 1);
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      // P1030: 隙間がある腕は、肩の付け根から少しずつ外へ
      // ずらして描く（付け根は胴に残し、下で背景の隙間が
      // 開くように）。手の位置も同じだけずらす。
      const dir = bx >= cxN * (S - 1) ? 1 : -1;
      const gapShift = gap ? armR0 * 0.85 + 1.5 : 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const sh = gapShift * Math.min(1, t / 0.22);
        stamp(ax + (bx - ax) * t + dir * sh, ay + (by - ay) * t, Math.max(1.1, armR0 * (1.18 - 0.48 * t)), separated ? SKIN : BODY);
      }
    };
    seg(reading.shoulderL, reading.handL, reading.armGap?.l === true);
    seg(reading.shoulderR, reading.handR, reading.armGap?.r === true);
    // P1001: 手。腕の先に肌色の楕円＋指の分かれ目を描く。
    // P1016: 指の分かれ目は固定の赤茶でなく本人の肌色の影で
    // 描く（赤い爪のように見えないように）。
    const FINGER: [number, number, number] = deriveShadow(SKIN);
    for (const hand of [reading.handL, reading.handR]) {
      if (!hand) continue;
      const gapH = hand === reading.handL ? reading.armGap?.l === true : reading.armGap?.r === true;
      const hDir = hand.x >= cxN ? 1 : -1;
      const hx = hand.x * (S - 1) + (gapH ? hDir * (armR0 * 0.85 + 1.5) : 0), hy = hand.y * (S - 1);
      // P1045: 手の大きさ。読みの比が 0.31 で従来の大きさに
      // なるよう合わせ、読みが大きい手は大きく描く。
      const hs = reading.handSize ? Math.max(0.75, Math.min(1.7, 0.55 + 1.45 * reading.handSize)) : 1;
      const rx = armR0 * 0.95 * hs, ry = armR0 * 1.7 * hs;
      for (let y = Math.round(hy - ry); y <= Math.round(hy + ry); y++) {
        for (let x = Math.round(hx - rx); x <= Math.round(hx + rx); x++) {
          if (((x - hx) / rx) ** 2 + ((y - hy) / ry) ** 2 <= 1) set(x, y, SKIN);
        }
      }
      // P1029: 親指。体の中心側に小さな丸を出して、手の
      // 左右と向きが分かるようにする。切れ目は3本（指4本）。
      const inward = hx < cxN * (S - 1) ? 1 : -1;
      const tx = hx + inward * rx * 0.8, ty = hy - ry * 0.15, tr = Math.max(1, rx * 0.38);
      for (let y = Math.round(ty - tr); y <= Math.round(ty + tr); y++) {
        for (let x = Math.round(tx - tr); x <= Math.round(tx + tr); x++) {
          if (((x - tx) / tr) ** 2 + ((y - ty) / tr) ** 2 <= 1) set(x, y, SKIN);
        }
      }
      for (const off of [-0.38, 0, 0.38]) {
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
      const HAIR: [number, number, number] = colors?.hair ?? reading.hairRgb ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
      const hairTopY = (head.y - headRh) * (S - 1);
      const hairBottomY = hairTopY + reading.hair.lengthRatio * figHn * (S - 1);
      const hx = head.x * (S - 1), hr = Math.max(2, headRh * S);
      const hy = head.y * (S - 1);
      for (let y = Math.round(hairTopY); y <= Math.round(hairBottomY); y++) {
        const inCap = y <= hy;
        // 上部は頭の丸みに沿わせる（一番上の行が広いと
        // 人の形の門で頭と認められないため）。
        if (inCap) {
          const half = Math.sqrt(Math.max(0, hr * hr - (y - hy) * (y - hy))) * 1.12;
          for (let x = Math.round(hx - half); x <= Math.round(hx + half); x++) set(x, y, HAIR);
        } else {
          // P1016: サイドパネルは毛先に向けて先細りにする
          // （同じ幅の板のまま垂らすと髪に見えないため）。
          // P1020: 外側は影色で落として髪の裏側の面を作り、
          // 毛先は2つに割って房の先らしくする。
          // P1065: パネルの置き場所を組み直した。前髪の房は
          // 体の側面に沿って垂れる：頭の脇では帽子の縁、
          // 胴の脇では胴の縁、脚の脇では脚の縁に沿わせ、
          // 縁の1px外側までを房とする。中心寄りの固定配置
          // （半径の0.55〜0.95倍）は胴の正面を板で削り、
          // 体から離した配置は浮いた板と余分な柱を作った。
          const t = Math.min(1, (y - hy) / Math.max(1, hairBottomY - hy));
          const panelW = Math.max(1.5, hr * 0.45 * (1 - 0.3 * t));
          const HAIR_SH2 = deriveShadow(HAIR);
          const cxPx = cxN * (S - 1);
          for (const sgn of [-1, 1]) {
            let edgeAbs: number;
            if (y <= y0) {
              const capHalf = Math.sqrt(Math.max(0, hr * hr - (y - hy) * (y - hy))) * 1.12;
              const p = Math.min(1, Math.max(0, (y - hy) / Math.max(1, y0 - hy)));
              edgeAbs = cxPx + sgn * lerp(Math.max(capHalf, hr * 0.55), shoulderW / 2, p);
            } else if (y <= y1) {
              edgeAbs = cxPx + sgn * (torsoW((y - y0) / Math.max(1, y1 - y0)) / 2);
            } else {
              const foot = sgn < 0 ? reading.footL : reading.footR;
              const hipX = cxPx + sgn * legSpread;
              const footX = foot ? foot.x * (S - 1) : hipX;
              const legBottom = Math.round(footY * (S - 1));
              const lt = Math.min(1, (y - y1) / Math.max(1, legBottom - y1));
              const cxp = lerp(hipX, footX, lt);
              const w = lt < 0.6 ? lerp(thighW, calfW, lt / 0.6) : lerp(calfW, ankleW, (lt - 0.6) / 0.4);
              edgeAbs = cxp + sgn * (w / 2);
            }
            const outerAbs = edgeAbs + sgn * 1;
            const innerAbs = outerAbs - sgn * panelW;
            const xa = Math.round(Math.min(innerAbs, outerAbs));
            const xb = Math.round(Math.max(innerAbs, outerAbs));
            const centerAbs = (innerAbs + outerAbs) / 2;
            for (let x = xa; x <= xb; x++) {
              if (t > 0.88 && Math.abs(x - centerAbs) <= Math.max(1, hr * 0.06)) continue;
              const frac = Math.abs(x - innerAbs) / panelW;
              set(x, y, frac > 0.7 ? HAIR_SH2 : HAIR);
            }
          }
        }
      }
    }
    // 顔は頭より一回り小さく、少し下に描く（髪が上と脇に残る）。
    if (reading.hair) stamp(head.x * (S - 1), head.y * (S - 1) + Math.max(2, headRh * S) * 0.15, Math.max(2, headRh * S) * 0.8, SKIN);
    else stamp(head.x * (S - 1), head.y * (S - 1), Math.max(2, headRh * S), SKIN);
    const hrPx = Math.max(2, headRh * S);
    const faceR = reading.hair ? hrPx * 0.8 : hrPx;
    const faceCy = head.y * (S - 1) + (reading.hair ? hrPx * 0.15 : 0);
    const hxPx = head.x * (S - 1);
    // P1006: 前髪。顔の上部に、房の先が下がる波形の下端で髪を描く。
    // 房の境目は下端が上がって額の肌が見える（＝房の分かれ）。
    // 顔の中身より先に描くので、眉と目は前髪の上から読める。
    if (shape?.frontHair && reading.hair) {
      const HAIR: [number, number, number] = colors?.hair ?? reading.hairRgb ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
      const hyPx = head.y * (S - 1);
      const strandW = Math.max(3, faceR * 0.55);
      for (let y = Math.round(faceCy - faceR); y <= Math.round(faceCy - faceR * 0.3); y++) {
        const half = Math.sqrt(Math.max(0, hrPx * hrPx - (y - hyPx) * (y - hyPx)));
        for (let x = Math.round(hxPx - Math.min(half, faceR)); x <= Math.round(hxPx + Math.min(half, faceR)); x++) {
          const u = (((x - hxPx) % strandW) + strandW) % strandW / strandW;
          let edge = faceCy - faceR * (0.78 - 0.33 * Math.sin(Math.PI * u));
          // P1054: 本人の前髪の下端が測れていれば、その形で
          // 描く（波形の代わりに、測ったラインを補間する）。
          const be = reading.bangsEdge;
          if (be && be.length === 9) {
            const pos = Math.max(0, Math.min(8, (x - hxPx) / Math.max(1, faceR) * 4 + 4));
            const i0 = Math.floor(pos), i1 = Math.min(8, i0 + 1), fr = pos - i0;
            const v0 = be[i0], v1 = be[i1];
            if (v0 !== null && v1 !== null) edge = faceCy + faceR * (v0 + (v1 - v0) * fr);
            else if (v0 !== null) edge = faceCy + faceR * v0;
            else if (v1 !== null) edge = faceCy + faceR * v1;
          }
          // P1040: 分け目。前髪の下端が分け目の位置で上がり、
          // 額の肌が覗く。
          const parting = reading.face?.parting;
          if (parting) {
            const partX = hxPx + (parting === 'center' ? 0 : parting === 'left' ? -faceR * 0.42 : faceR * 0.42);
            edge -= faceR * 0.38 * Math.exp(-(((x - partX) / Math.max(1.5, faceR * 0.1)) ** 2));
          }
          if (y <= edge) set(x, y, HAIR);
        }
      }
    }
    // P994: 顔の中身（目・眉・口）を指定どおりに描く。
    // P1016: 指定が無い時も目と口は描く（顔の無い人形にしない。
    // 肌と髪の色が近い本人では、顔の部品が無いと顔が溶けて
    // 消えてしまうため）。
    // P1017: 指定が無ければ本人の顔の測定値で描く（目の大きさ・
    // 色、口の大きさ、眉）。測定が無ければ中立の既定。
    const irisRgb = (name: string | null): [number, number, number] | null => (name === '茶色' ? [140, 90, 50] : name === '青' ? [90, 130, 220] : name === '緑' ? [70, 150, 90] : name === 'ピンク' ? [232, 120, 160] : null);
    const faceEff: BodyFaceSpec = face ?? (reading.face ? { eyeSize: reading.face.eyeSize, brows: reading.face.brows ?? false, mouthSize: reading.face.mouthSize, iris: irisRgb(reading.face.eyeColor), irisName: reading.face.eyeColor, blush: reading.face.blush ?? false, nose: reading.face.nose ?? false, ears: reading.face.ears ?? false, eyeShape: reading.face.eyeShape ?? null, mouthForm: reading.face.mouthForm ?? null, browTilt: reading.face.browAngle ?? null } : { eyeSize: null, brows: false, mouthSize: null });
    if (faceEff) {
      const face = faceEff;
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
          // P1041: 目の形。まつげ線を目尻側へ傾ける（垂れ目は
          // 目尻が下がり、つり目は上がる）。
          const away = Math.sign(ex - hxPx) || 1;
          const tilt = face.eyeShape === 'tareme' ? 0.35 : face.eyeShape === 'tsurime' ? -0.35 : 0;
          for (let x = Math.round(ex - eyeR * 1.05); x <= Math.round(ex + eyeR * 1.05); x++) {
            const ly = lashY + (x - ex) * away * tilt;
            for (let y = Math.round(ly - lashT / 2); y <= Math.round(ly + lashT / 2); y++) set(x, y, DARK);
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
        // P1043: 眉の角度。眉頭側が下がる／上がる傾きで描く。
        const bSlope = (face.browTilt ?? 0) * 1.2;
        for (const sgn of [-1, 1]) {
          const bx = hxPx + sgn * eyeDX;
          for (let x = Math.round(bx - faceR * 0.24); x <= Math.round(bx + faceR * 0.24); x++) {
            const ly = browY - (x - bx) * sgn * bSlope;
            for (let y = Math.round(ly - browT / 2); y <= Math.round(ly + browT / 2); y++) set(x, y, DARK);
          }
        }
      }
      // P1036: 耳・頬の赤み・鼻。耳は長い髪では隠れるので
      // 髪が長くない時だけ描く。赤みは肌とピンクの中間色の
      // 楕円、鼻は影色の小さな印。
      if (face.ears && reading.hair?.length !== 'long') {
        for (const sgn of [-1, 1]) {
          const ex2 = hxPx + sgn * faceR * 1.22;
          const ey2 = faceCy - faceR * 0.05;
          for (let y = Math.round(ey2 - faceR * 0.24); y <= Math.round(ey2 + faceR * 0.24); y++) {
            for (let x = Math.round(ex2 - faceR * 0.15); x <= Math.round(ex2 + faceR * 0.15); x++) {
              if (((x - ex2) / (faceR * 0.15)) ** 2 + ((y - ey2) / (faceR * 0.24)) ** 2 <= 1) set(x, y, SKIN);
            }
          }
        }
      }
      if (face.blush) {
        const blushCol: [number, number, number] = [Math.round(SKIN[0] * 0.55 + 245 * 0.45), Math.round(SKIN[1] * 0.55 + 165 * 0.45), Math.round(SKIN[2] * 0.55 + 170 * 0.45)];
        for (const sgn of [-1, 1]) {
          const bx2 = hxPx + sgn * faceR * 0.52;
          const by2 = faceCy + faceR * 0.3;
          for (let y = Math.round(by2 - faceR * 0.15); y <= Math.round(by2 + faceR * 0.15); y++) {
            for (let x = Math.round(bx2 - faceR * 0.3); x <= Math.round(bx2 + faceR * 0.3); x++) {
              if (((x - bx2) / (faceR * 0.3)) ** 2 + ((y - by2) / (faceR * 0.15)) ** 2 <= 1) set(x, y, blushCol);
            }
          }
        }
      }
      if (face.nose) {
        const noseCol = deriveShadow(SKIN);
        stamp(hxPx, faceCy + faceR * 0.26, Math.max(0.8, faceR * 0.05), noseCol);
        stamp(hxPx - faceR * 0.05, faceCy + faceR * 0.34, Math.max(0.8, faceR * 0.05), noseCol);
      }
      const mw = face.mouthSize === 'large' ? faceR * 0.8 : face.mouthSize === 'small' ? faceR * 0.22 : faceR * 0.45;
      const mouthY = faceCy + faceR * 0.55;
      const mouthT = Math.max(1, faceR * 0.12);
      // P1042: 口の形。笑いは口角が上がる弧、への字は逆の弧。
      const arc = face.mouthForm === 'smile' ? faceR * 0.16 : face.mouthForm === 'frown' ? -faceR * 0.16 : 0;
      for (let x = Math.round(hxPx - mw / 2); x <= Math.round(hxPx + mw / 2); x++) {
        const dxn = (x - hxPx) / Math.max(1, mw / 2);
        const yc = mouthY - (dxn * dxn - 0.33) * arc;
        for (let y = Math.round(yc - mouthT / 2); y <= Math.round(yc + mouthT / 2); y++) set(x, y, DARK);
      }
    }
    const image = new Uint8Array(S * S * 4);
    // P1035: アホ毛。頭頂から立ち上がって横へ流れる細い束を
    // 二次曲線で描く。
    // P1071: 先端を最高点にする。旧形は制御点が頂点より高く
    // 曲線が途中で水平に寝て、頂点の行が横に広がり読みの
    // narrow カウントが0になった（往復で読めない）。先端を
    // 最高点にすると各行の束は細いまま残り、読み返せる。
    // 横への流れは控えめにし、ほぼ真上に立つ束にする
    // （横に寝ると先端の行が広がり、同じ理由で読めない）。
    if (reading.ahoge === true) {
      const topY = (head.y - headRh) * (S - 1);
      const cxp = head.x * (S - 1);
      const p0: [number, number] = [cxp, topY + headRh * S * 0.15];
      const p1: [number, number] = [cxp + headRh * S * 0.1, topY - headRh * S * 0.55];
      const p2: [number, number] = [cxp + headRh * S * 0.3, topY - headRh * S * 0.6];
      const aR = Math.max(1, S * 0.009);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const bx = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
        const by = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
        stamp(bx, by, aR, HAIR0);
      }
    }
    // P1031: 装飾品。読みの位置（頭の左右・高さ）と色で描く。
    // 装置は箱、飾りは花びらの丸の集まり。
    if (reading.accessories) {
      for (const acc of reading.accessories) {
        const axp = head.x * (S - 1) + (acc.side === 'l' ? -1 : 1) * headRh * S * 1.02;
        const ayp = acc.y * (S - 1);
        if (acc.kind === 'device') {
          const bw = Math.max(2, headRh * S * 0.5), bh = Math.max(3, headRh * S * 0.75);
          // 縁は影色で囲む（灰色の装置は背景の灰と色の箱が
          // 同じになり、マスクから消えてしまうため）。
          const rim = deriveShadow(acc.rgb);
          for (let y = Math.round(ayp - bh / 2); y <= Math.round(ayp + bh / 2); y++) {
            for (let x = Math.round(axp - bw / 2); x <= Math.round(axp + bw / 2); x++) {
              const edge = x === Math.round(axp - bw / 2) || x === Math.round(axp + bw / 2) || y === Math.round(ayp - bh / 2) || y === Math.round(ayp + bh / 2);
              set(x, y, edge ? rim : acc.rgb);
            }
          }
        } else {
          const pr = Math.max(1.2, headRh * S * 0.16);
          for (const [ox, oy] of [[0, -1], [0.95, -0.3], [0.6, 0.8], [-0.6, 0.8], [-0.95, -0.3]] as const) {
            const cxp = axp + ox * pr * 1.5, cyp = ayp + oy * pr * 1.5;
            for (let y = Math.round(cyp - pr); y <= Math.round(cyp + pr); y++) {
              for (let x = Math.round(cxp - pr); x <= Math.round(cxp + pr); x++) {
                if (((x - cxp) / pr) ** 2 + ((y - cyp) / pr) ** 2 <= 1) set(x, y, acc.rgb);
              }
            }
          }
        }
      }
    }
    px.forEach((c, i) => { image[i * 4] = c[0]; image[i * 4 + 1] = c[1]; image[i * 4 + 2] = c[2]; image[i * 4 + 3] = 255; });
    // P1068: 中の線（読みの内側の境界を描き戻す）
    this.stampInnerLines(image, S, reading);
    return image;
  }

  /** P992: 描いた素体を測り直し、プロファイルの一致で照合する */
  public verifyBody(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const image = this.renderBody(reading, 64);
    if (!image) return null;
    const re = this.analyzePose(image, 64, 64);
    let score = 0;
    let verified = false;
    // P1011: 幅の種別が違う読みとは照合しない（横向きの奥行きを
    // 正面の幅で描いた絵と比べても意味がない）。
    if (re && (reading.profileKind ?? 'width') === (re.profileKind ?? 'width')) {
      const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
      let ok = 0;
      let compared = 0;
      for (const k of keys) {
        const a = reading.bodyProfile[k];
        const b = re.bodyProfile[k];
        if (a === null || b === null) continue;
        compared++;
        if (Math.abs(a - b) <= 0.09 + 1e-9) ok++; // P1009: 値は0.01単位に丸めてあるので、0.09ちょうどの差は浮動小数の誤差で落ちないよう僅かに緩める
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
  public renderBodySmooth(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null): Uint8Array | null {
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
    // P1011: 幅の種別が違う読みとは照合しない（横向きの奥行きを
    // 正面の幅で描いた絵と比べても意味がない）。
    if (re && (reading.profileKind ?? 'width') === (re.profileKind ?? 'width')) {
      const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
      let ok = 0;
      let compared = 0;
      for (const k of keys) {
        const a = reading.bodyProfile[k];
        const b = re.bodyProfile[k];
        if (a === null || b === null) continue;
        compared++;
        if (Math.abs(a - b) <= 0.09 + 1e-9) ok++; // P1009: 値は0.01単位に丸めてあるので、0.09ちょうどの差は浮動小数の誤差で落ちないよう僅かに緩める
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
    // P1011: 幅の種別が違う読みとは照合しない（横向きの奥行きを
    // 正面の幅で描いた絵と比べても意味がない）。
    if (re && (reading.profileKind ?? 'width') === (re.profileKind ?? 'width')) {
      const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
      let ok = 0;
      let compared = 0;
      for (const k of keys) {
        const a = reading.bodyProfile[k];
        const b = re.bodyProfile[k];
        if (a === null || b === null) continue;
        compared++;
        if (Math.abs(a - b) <= 0.09 + 1e-9) ok++; // P1009: 値は0.01単位に丸めてあるので、0.09ちょうどの差は浮動小数の誤差で落ちないよう僅かに緩める
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
  public renderBodyOutline(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null): Uint8Array | null {
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
  public renderBodyCel(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null, baseIn?: Uint8Array | null): Uint8Array | null {
    const base = baseIn ?? this.renderBodySmooth(reading, size, face, colors, shape);
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
  public renderBodyHairDetail(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null, baseIn?: Uint8Array | null): Uint8Array | null {
    const base = this.renderBodyCel(reading, size, face, colors, shape, baseIn);
    if (!base || !reading.head || !reading.hair) return base;
    const out = new Uint8Array(base);
    const HAIR: [number, number, number] = colors?.hair ?? reading.hairRgb ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
    const HAIR_SH = deriveShadow(HAIR);
    // P1018: 髪の判定は排他的にする。本人の肌・服とその影は
    // 髪の影と色が近く、含めてしまうと房の線が体まで引かれて
    // 縦縞になる（全身サンプルで実際に起きた）。
    const SKINc: [number, number, number] = reading.skinColor ?? [232, 190, 160];
    const topRgbC = reading.clothing?.topRgb ?? (reading.clothing?.topColor ? EXTRA_COLORS.find((c) => c.name === reading.clothing.topColor)?.rgb : undefined);
    const BODYc: [number, number, number] = colors?.body ?? (topRgbC && Math.abs(topRgbC[0] - 245) + Math.abs(topRgbC[1] - 245) + Math.abs(topRgbC[2] - 245) > 40 ? topRgbC : SKINc);
    const SKIN_SH = deriveShadow(SKINc);
    const BODY_SH = deriveShadow(BODYc);
    const distTo = (i: number, c: [number, number, number]): number => Math.abs(out[i] - c[0]) + Math.abs(out[i + 1] - c[1]) + Math.abs(out[i + 2] - c[2]);
    const nearHair = (i: number): boolean => {
      // 髪の色の方が肌・服の色より近い時だけ髪とみなす（絶対の
      // 距離で切ると、髪と肌が本当に近い色の人で髪が消える）。
      const dHair = Math.min(distTo(i, HAIR), distTo(i, HAIR_SH));
      if (dHair > 42) return false;
      const dBody = Math.min(distTo(i, SKINc), distTo(i, SKIN_SH), distTo(i, BODYc), distTo(i, BODY_SH));
      return dHair < dBody;
    };
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const figHn = Math.max(0.1, footY - (reading.head.y - (reading.headRh ?? reading.head.r)));
    const hairTopY = (reading.head.y - (reading.headRh ?? reading.head.r)) * (size - 1);
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

  /** P1018: 描いた絵に役割別の線を入れる（外周は太く濃く、内側の境界は細く薄く） */
  private applyOutlineLines(img: Uint8Array, size: number): Uint8Array {
    const bg: [number, number, number] = [img[0], img[1], img[2]];
    const isBg = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= size || y >= size) return true;
      const i = (y * size + x) * 4;
      return Math.abs(img[i] - bg[0]) <= 10 && Math.abs(img[i + 1] - bg[1]) <= 10 && Math.abs(img[i + 2] - bg[2]) <= 10;
    };
    const out = new Uint8Array(img);
    const darken = (x: number, y: number, f: number) => {
      const i = (y * size + x) * 4;
      out[i] = Math.round(img[i] * f); out[i + 1] = Math.round(img[i + 1] * f); out[i + 2] = Math.round(img[i + 2] * f);
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (isBg(x, y)) continue;
        let distBg = 99;
        for (let d = 1; d <= 2; d++) {
          let hit = false;
          for (let dy = -d; dy <= d && !hit; dy++) for (let dx = -d; dx <= d && !hit; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
            if (isBg(x + dx, y + dy)) hit = true;
          }
          if (hit) { distBg = d; break; }
        }
        if (distBg <= 2) { darken(x, y, 0.42); continue; }
        const i = (y * size + x) * 4;
        let inner = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size || isBg(nx, ny)) continue;
          const j = (ny * size + nx) * 4;
          if (Math.abs(img[i] - img[j]) + Math.abs(img[i + 1] - img[j + 1]) + Math.abs(img[i + 2] - img[j + 2]) > 90) { inner = true; break; }
        }
        if (inner) darken(x, y, 0.62);
      }
    }
    return out;
  }

  /**
   * P1018: 構造化した描画（土台）。平らな色面だけの人形でなく、
   * セル影→髪の房とツヤ→線、までを通した1枚を標準の描き方にする。
   * 彼女が絵を測る時に使う手がかり（線と陰影）を、描く側も
   * 最初から持つための土台。
   */
  /**
   * P1060: 測定用の双子。構造化描画の平坦な土台そのもの
   * （詳細処理の前）。完成した描画は面の基色がセル影と房で
   * 塗り替わり、画素からの領域分割が成立しない（P1059の
   * 診断）。自分の描画の再測定はこの双子で測る。外部の
   * 画像は従来どおり画素から測る。
   */
  public renderBodyStructuredTwin(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null): Uint8Array | null {
    const SS = 3;
    const big = this.renderBody(reading, size * SS, face, colors, shape ? { bust: shape.bust, frontHair: shape.frontHair, backHair: shape.backHair } : null);
    if (!big) return null;
    const B = size * SS;
    const flat = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const counts = new Map<number, number>();
        let bestKey = -1, bestN = 0;
        for (let dy = 0; dy < SS; dy++) {
          for (let dx = 0; dx < SS; dx++) {
            const i = ((y * SS + dy) * B + (x * SS + dx)) * 4;
            const key = (big[i] << 16) | (big[i + 1] << 8) | big[i + 2];
            const n = (counts.get(key) ?? 0) + 1;
            counts.set(key, n);
            if (n > bestN) { bestN = n; bestKey = key; }
          }
        }
        const o = (y * size + x) * 4;
        flat[o] = (bestKey >> 16) & 255;
        flat[o + 1] = (bestKey >> 8) & 255;
        flat[o + 2] = bestKey & 255;
        flat[o + 3] = 255;
      }
    }
    return flat;
  }

  /**
   * P1062: 双子専用のパレット分割。自分の描画（平坦な
   * 土台）は、色が描く側のパレットそのものだと分かって
   * いる。閾値で分けるのでなく、役割色（肌・服・髪と
   * それぞれの影色）への照合で分ける。外部の画像には
   * 使わない（そちらは v1/v2 の分割が担当）。
   */
  public segmentTwinPalette(twin: Uint8Array, size: number, reading: PoseReading, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null): { body: Uint8Array; hair: Uint8Array } | null {
    const SKIN: [number, number, number] = reading.skinColor ?? [232, 190, 160];
    const HAIR0: [number, number, number] = colors?.hair ?? reading.hairRgb ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
    const distBg = (c: [number, number, number]): number => Math.abs(c[0] - 245) + Math.abs(c[1] - 245) + Math.abs(c[2] - 245);
    const topRgb = reading.clothing?.topRgb ?? (reading.clothing?.topColor ? EXTRA_COLORS.find((c) => c.name === reading.clothing.topColor)?.rgb : undefined);
    const BODY: [number, number, number] = colors?.body ?? (topRgb && distBg(topRgb) > 40 ? topRgb : (reading.skinColor ?? [40, 40, 120]));
    const BOTC: [number, number, number] = reading.clothing?.bottomRgb ?? (reading.clothing?.bottomColor ? EXTRA_COLORS.find((c) => c.name === reading.clothing.bottomColor)?.rgb : undefined) ?? BODY;
    const BG_COL: [number, number, number] = Math.min(distBg(BODY), distBg(SKIN), distBg(HAIR0)) <= 60 ? [168, 168, 172] : [245, 245, 245];
    const SH_H = deriveShadow(HAIR0);
    const HAIR_BK: [number, number, number] = [Math.round(HAIR0[0] + (SH_H[0] - HAIR0[0]) * 0.35), Math.round(HAIR0[1] + (SH_H[1] - HAIR0[1]) * 0.35), Math.round(HAIR0[2] + (SH_H[2] - HAIR0[2]) * 0.35)];
    const hairSet: Array<[number, number, number]> = [HAIR0, HAIR_BK, SH_H];
    const bodySet: Array<[number, number, number]> = [SKIN, deriveShadow(SKIN), BODY, deriveShadow(BODY), BOTC, deriveShadow(BOTC)];
    const key = (c: [number, number, number]): string => `${c[0]},${c[1]},${c[2]}`;
    const hairKeys = new Set(hairSet.map(key));
    const bodyKeys = new Set(bodySet.map(key));
    const bgKey = key(BG_COL);
    const d1 = (a: [number, number, number], b: [number, number, number]): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const classCache = new Map<string, number>(); // 0=背景 1=体 2=髪
    const classify = (c: [number, number, number]): number => {
      const k = key(c);
      const hit = classCache.get(k);
      if (hit !== undefined) return hit;
      let v: number;
      if (k === bgKey) v = 0;
      else if (hairKeys.has(k)) v = 2;
      else if (bodyKeys.has(k)) v = 1;
      else {
        // パレット外の色（目・装飾・線）は一番近い役割へ。
        // ただし背景に一番近い色は背景として残す。
        let best = Infinity, bv = 0;
        for (const p of bodySet) { const d = d1(c, p); if (d < best) { best = d; bv = 1; } }
        for (const p of hairSet) { const d = d1(c, p); if (d < best) { best = d; bv = 2; } }
        if (d1(c, BG_COL) <= best) bv = 0;
        v = bv;
      }
      classCache.set(k, v);
      return v;
    };
    const body = new Uint8Array(size * size);
    const hair = new Uint8Array(size * size);
    let bn = 0;
    for (let i = 0; i < size * size; i++) {
      const v = classify([twin[i * 4], twin[i * 4 + 1], twin[i * 4 + 2]]);
      if (v === 1) { body[i] = 1; bn++; }
      else if (v === 2) hair[i] = 1;
    }
    return bn >= 50 ? { body, hair } : null;
  }

  public renderBodyStructured(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null): Uint8Array | null {
    // P1057: 構造化描画の土台は「平坦」に作る。平均で縮小
    // すると色が混ざってモザイクになり、自分の描画を領域
    // 分割で読み分けられなくなる（P1056の診断）。3倍で
    // 描いて最頻値で縮小すれば、面の色は元の色のまま残る。
    // P1060: 面の既定投入と双子での照合は試して撤回した
    // （経緯は描画メモ P1060）。土台の切り出しは双子の
    // メソッドに寄せてある。
    const flat = this.renderBodyStructuredTwin(reading, size, face, colors, shape);
    if (!flat) return null;
    const base = this.renderBodyHairDetail(reading, size, face, colors, shape, flat);
    if (!base) return null;
    const outlined = this.applyOutlineLines(base, size);
    // P1068: 中の線（平坦な双子には残らないので仕上げで描く）
    this.stampInnerLines(outlined, size, reading);
    return outlined;
  }

  /**
   * P1066/P1067: 自分の描画（平坦な双子）を、描いた側の
   * パレットで体と髪に分けて読み直す。自分の絵に限っては
   * 役割が正確に分かるので、写真向けの領域分割より確かな
   * 物差しになる。プロファイルが揃わない時は null。
   */
  private paletteReRead(reading: PoseReading, size = 128): PoseReading | null {
    const flat = this.renderBodyStructuredTwin(reading, size);
    if (!flat) return null;
    const pal = this.segmentTwinPalette(flat, size, reading);
    if (!pal) return null;
    let bn = 0, minX = size, maxX = -1, minY = size, maxY = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!pal.body[y * size + x]) continue;
      bn++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const dens = bn / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
    const re = this.analyzePoseWithMask(flat, size, size, pal.body, 'fine', dens, pal.hair);
    return re && re.profileComplete ? re : null;
  }

  /** P1018: 構造化した描画の照合（プロファイルの一致で見る） */
  public verifyBodyStructured(reading: PoseReading): { score: number; verified: boolean; image: Uint8Array; size: number } | null {
    const size = 128;
    const image = this.renderBodyStructured(reading, size);
    if (!image) return null;
    const re = this.analyzePose(image, size, size);
    // P1066: 自分の描画に限っては、どの画素が髪でどれが
    // 体かは描いた側のパレットで正確に分かる。仕上げ済み
    // の描画は髪の作画（ツヤ・房の影）でパレット外の色に
    // 化けるため、構造の測り直しは平坦な双子＋パレット
    // 分割の体マスクでも行い、プロファイルが揃っている
    // 時はそちらの値を優先する（写真で領域分割の読みが
    // 採用されるのと同じ段を、自分の絵では正確なマスク
    // で行う）。同系色の髪と服は通常の再読では分かれず、
    // 肩や髪色が実物と無関係に外れていた。
    const rePal = this.paletteReRead(reading, size);
    const effProfile = (k: 'shoulder' | 'chest' | 'waist' | 'hip' | 'thigh' | 'calf' | 'ankle'): number | null =>
      (rePal?.bodyProfile[k] ?? null) !== null ? rePal!.bodyProfile[k] : (re?.bodyProfile[k] ?? null);
    const effHair = rePal?.hair ?? re?.hair ?? null;
    const effHairColor = rePal?.hairColor ?? re?.hairColor ?? null;
    const effKind = rePal?.profileKind ?? re?.profileKind;
    let score = 0;
    let verified = false;
    if ((re || rePal) && (reading.profileKind ?? 'width') === (effKind ?? 'width')) {
      const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
      let ok = 0;
      let compared = 0;
      for (const k of keys) {
        const a = reading.bodyProfile[k];
        const b = effProfile(k);
        if (a === null || b === null) continue;
        compared++;
        if (Math.abs(a - b) <= 0.09 + 1e-9) ok++;
      }
      if (reading.hair && effHair) {
        compared++;
        if (reading.hair.length === effHair.length) ok++;
      }
      if (reading.hairColor && effHairColor) {
        compared++;
        if (reading.hairColor === effHairColor) ok++;
      }
      if (compared >= 4) {
        score = ok / compared;
        verified = score >= 0.7;
      }
    }
    const state = this.load();
    state.structured++;
    if (verified) state.structuredOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, image, size };
  }

  /** P1001: 髪の作画の照合。ツヤの帯と房の線が入っているか */
  /**
   * P1023: 輪郭の照合。描き直して測り直し、輪郭の曲線同士を
   * 比べる（幅7点の照合では通ってしまう形のずれを見る）。
   * 各段で左右両端が 0.07 以内なら一致とし、16段以上比べて
   * 75%以上一致で verified。
   */
  public verifyBodyContour(reading: PoseReading): { score: number; verified: boolean; compared: number } | null {
    if (!reading.contour || !reading.head) return null;
    // P1027: 長い髪の輪郭は後ろ髪の面を含めて測られている。
    // 描く側も面を出してから比べる（面なしでは下半分の輪郭が
    // 構造的に一致しない）。
    const image = this.renderBody(reading, 128, null, null, reading.hair?.length === 'long' ? { backHair: true } : undefined);
    if (!image) return null;
    const re = this.analyzePose(image, 128, 128);
    if (!re || !re.contour) return null;
    let compared = 0;
    let ok = 0;
    for (let i = 0; i < 24; i++) {
      const a = reading.contour.l[i];
      const b = reading.contour.r[i];
      const c = re.contour.l[i];
      const d = re.contour.r[i];
      if (a === null || a === undefined || b === null || b === undefined || c === null || c === undefined || d === null || d === undefined) continue;
      compared++;
      if (Math.abs(a - c) <= 0.07 + 1e-9 && Math.abs(b - d) <= 0.07 + 1e-9) ok++;
    }
    if (compared === 0) return null;
    const score = ok / compared;
    const verified = compared >= 16 && score >= 0.75;
    const state = this.load();
    state.contours++;
    if (verified) state.contoursOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, compared };
  }

  /**
   * P1024: 中の境界線の照合。描き直して測り直し、各段の
   * 境界位置が再現されているか比べる。元の境界それぞれに
   * 0.05以内の相手があり、本数が1本以内の差ならその段は一致。
   * 12段以上比べて70%以上で verified。
   */
  /**
   * P1028: 肩の傾きの照合。描き直しを測り直して、傾きが
   * 読みの値に近いかを見る。
   */
  public verifyShoulderSlope(reading: PoseReading): { slope: number; reSlope: number; verified: boolean } | null {
    if (reading.shoulderSlope === null || reading.shoulderSlope === undefined || !reading.head) return null;
    const image = this.renderBody(reading, 128);
    if (!image) return null;
    const re = this.analyzePose(image, 128, 128);
    if (!re || re.shoulderSlope === null || re.shoulderSlope === undefined) return null;
    return { slope: reading.shoulderSlope, reSlope: re.shoulderSlope, verified: Math.abs(reading.shoulderSlope - re.shoulderSlope) <= 0.25 + 1e-9 };
  }

  /**
   * P1030: 腕と胴の隙間の照合。描き直しを測り直して、隙間の
   * 有無が左右とも読みと一致するかを見る。
   */
  public verifyArmGap(reading: PoseReading): { l: boolean; r: boolean; reL: boolean; reR: boolean; verified: boolean } | null {
    if (!reading.armGap || !reading.head) return null;
    const image = this.renderBody(reading, 128);
    if (!image) return null;
    const re = this.analyzePose(image, 128, 128);
    if (!re || !re.armGap) return null;
    return { l: reading.armGap.l, r: reading.armGap.r, reL: re.armGap.l, reR: re.armGap.r, verified: reading.armGap.l === re.armGap.l && reading.armGap.r === re.armGap.r };
  }

  /**
   * P1031: 装飾品の照合。描き直しを測り直して、左右・種別が
   * 読みと一致するかを見る。
   */
  public verifyAccessories(reading: PoseReading): { count: number; matched: number; verified: boolean } | null {
    if (!reading.accessories || reading.accessories.length === 0 || !reading.head) return null;
    const image = this.renderBody(reading, 128);
    if (!image) return null;
    const re = this.analyzePose(image, 128, 128);
    if (!re) return null;
    const reAcc = re.accessories ?? [];
    let matched = 0;
    for (const acc of reading.accessories) {
      if (reAcc.some((a) => a.side === acc.side && a.kind === acc.kind)) matched++;
    }
    return { count: reading.accessories.length, matched, verified: matched === reading.accessories.length };
  }

  /** P1034: 足の末端の広がりの照合（描き直しの再読と一致するか） */
  public verifyFootFlare(reading: PoseReading): { l: boolean; r: boolean; reL: boolean | null; reR: boolean | null; verified: boolean } | null {
    if (!reading.footFlare) return null;
    const image = this.renderBody(reading, 128);
    if (!image) return null;
    const re = this.analyzePose(image, 128, 128);
    if (!re || !re.footFlare) return null;
    return { l: reading.footFlare.l, r: reading.footFlare.r, reL: re.footFlare.l, reR: re.footFlare.r, verified: re.footFlare.l === reading.footFlare.l && re.footFlare.r === reading.footFlare.r };
  }

  /** P1071: アホ毛の読み返し照合。P1035では解像度限界のため
   * 対象外だったが、描く側の曲線を先端最高点に直したことで
   * 128でも細い束が頭頂の上に残り、読み返せるようになった。
   * あって読める／なくて読めない、の両方を照合する。 */
  public verifyAhoge(reading: PoseReading): { ahoge: boolean; reAhoge: boolean | null; verified: boolean } | null {
    if (reading.ahoge === null || reading.ahoge === undefined) return null;
    const image = this.renderBody(reading, 128);
    if (!image) return null;
    const re = this.analyzePose(image, 128, 128);
    if (!re || re.ahoge === null || re.ahoge === undefined) return null;
    return { ahoge: reading.ahoge, reAhoge: re.ahoge, verified: re.ahoge === reading.ahoge };
  }

  public verifyBodyInnerLines(reading: PoseReading): { score: number; verified: boolean; compared: number } | null {
    if (!reading.innerLines || !reading.head) return null;
    // P1068: 長い髪は後ろ髪の面込みで描く（輪郭の照合と
    // 同じ。面の内側にある境界線は、面が無いと描く場所
    // 自体が無い）。
    const image = this.renderBody(reading, 128, null, null, reading.hair?.length === 'long' ? { backHair: true } : null);
    if (!image) return null;
    const re = this.analyzePose(image, 128, 128);
    if (!re || !re.innerLines) return null;
    let compared = 0;
    let ok = 0;
    for (let i = 0; i < 24; i++) {
      const a = reading.innerLines[i];
      const b = re.innerLines[i];
      if (!a || !b) continue;
      compared++;
      const allMatched = a.every((v) => b.some((w) => Math.abs(v - w) <= 0.05 + 1e-9));
      if (allMatched && Math.abs(a.length - b.length) <= 1) ok++;
    }
    if (compared === 0) return null;
    const score = ok / compared;
    const verified = compared >= 12 && score >= 0.7;
    const state = this.load();
    state.innerLines++;
    if (verified) state.innerLinesOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { score, verified, compared };
  }

  public verifyBodyHairDetail(reading: PoseReading, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null): { verified: boolean; shine: number; clumps: number; image: Uint8Array } | null {
    const size = 192;
    const base = this.renderBodyCel(reading, size, null, colors);
    const detailed = this.renderBodyHairDetail(reading, size, null, colors);
    if (!base || !detailed || !reading.head || !reading.hair) return null;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const figHn = Math.max(0.1, footY - (reading.head.y - (reading.headRh ?? reading.head.r)));
    const hairTopY = (reading.head.y - (reading.headRh ?? reading.head.r)) * (size - 1);
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
    const shoulderY = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.y + reading.shoulderR.y) / 2 : reading.head.y + (reading.headRh ?? reading.head.r) * 1.6;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const hipY = shoulderY + (footY - shoulderY) * 0.43;
    const y0 = Math.round(shoulderY * (size - 1)), y1 = Math.round(hipY * (size - 1));
    // P1065: 測る行は固定の3割ではなく、読みの胸の頂点の
    // 行。頂点が胴の上寄りにある読みでは、固定行だと
    // ふくらみの裾しか測れず、広がりが届かなかった。
    const cy = Math.round(y0 + (y1 - y0) * (reading.bustPeak ?? 0.3));
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
    // P1011: 横向きの奥行きプロファイルは目標にしない（正面の幅の目標と混ざる）。
    if (reading.profileKind === 'depth') return false;
    const target: BodyTarget = {
      profile: { ...reading.bodyProfile },
      hairLength: reading.hair?.length ?? null,
      hairColor: reading.hairColor,
      build: reading.build?.label ?? null,
      contour: reading.contour ?? null,
      silhouetteWidth: reading.silhouetteWidth ?? null,
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

  /** P1063: 描く側の癖（部位ごとの寸法の補正）を読む */
  public getDrawingCorrections(): { shoulder: number; chest: number; waist: number; hip: number; thigh: number; calf: number; ankle: number } {
    const base = { shoulder: 1, chest: 1, waist: 1, hip: 1, thigh: 1, calf: 1, ankle: 1 };
    try {
      const raw = storageService.getJson(CORRECTION_KEY, null) as Partial<typeof base> | null;
      if (raw) for (const k of Object.keys(base) as Array<keyof typeof base>) {
        const v = raw[k];
        if (typeof v === 'number' && Number.isFinite(v)) base[k] = Math.max(0.5, Math.min(2.5, v));
      }
    } catch { /* fall through */ }
    return base;
  }

  /** P1063: 描く側の癖を保存する */
  public setDrawingCorrections(c: { shoulder: number; chest: number; waist: number; hip: number; thigh: number; calf: number; ankle: number }): void {
    try { storageService.setItem(CORRECTION_KEY, JSON.stringify(c)); } catch { /* 保存できなくても本流は止めない */ }
  }

  /**
   * P1063: 描く側の癖を学ぶドリル。旧ドリル（drillToTarget）は
   * 入力の寸法をずらして詰めたため、数字は少し良くなっても
   * 絵が崩れる隅に逃げた（2026-11-19に実測）。こちらは
   * 読み取り値（目標の寸法）を固定し、描く側の補正だけを
   * 動かす：補正をかけて描く→測り直す→部位ごとに
   * 「目標÷実測」の比で補正を更新する。輪郭の差が悪化する
   * 周は採用しない（形が崩れたら差し戻す守り）。
   */
  public drillCorrections(start: PoseReading, maxRounds = 10): { initialDiff: number; finalDiff: number; improved: boolean; rounds: number; corrections: { shoulder: number; chest: number; waist: number; hip: number; thigh: number; calf: number; ankle: number }; contourDiffInitial: number | null; contourDiffFinal: number | null } | null {
    const target = this.getTarget();
    if (!target || !start.head) return null;
    if (start.profileKind === 'depth') return null;
    const keys = ['shoulder', 'chest', 'waist', 'hip', 'thigh', 'calf', 'ankle'] as const;
    type Corr = { shoulder: number; chest: number; waist: number; hip: number; thigh: number; calf: number; ankle: number };
    const contourGoal = target.contour ?? null;
    const contourDiffOf = (c: PoseReading['contour']): number | null => {
      if (!c || !contourGoal) return null;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 24; i++) {
        const a = contourGoal.l[i];
        const b = contourGoal.r[i];
        const x = c.l[i];
        const y = c.r[i];
        if (a === null || a === undefined || b === null || b === undefined || x === null || x === undefined || y === null || y === undefined) continue;
        sum += (Math.abs(a - x) + Math.abs(b - y)) / 2;
        n++;
      }
      return n >= 12 ? sum / n : null;
    };
    const measure = (corr: Corr): { diff: number; contourDiff: number | null; measured: PoseReading['bodyProfile'] } | null => {
      this.setDrawingCorrections(corr);
      // P1067: 測定はパレット経路（平坦な双子＋パレットの
      // 体マスク、128px）を優先する。64pxの通常読みは粗く
      // て補正に反応せず、P1063では学習が成立しなかった。
      // パレット経路は寸法の摂動に単調に応答する（実測で
      // 確認済み）。使えない時だけ従来経路に落とす。
      let re = this.paletteReRead(start, 128);
      if (!re) {
        const img = this.renderBody(start, 64);
        if (!img) return null;
        re = this.analyzePose(img, 64, 64);
        if (!re) return null;
      }
      let sum = 0;
      let n = 0;
      for (const k of keys) {
        const m = re.bodyProfile[k];
        const g = target.profile[k];
        if (m === null || g === null) continue;
        sum += Math.abs(m - g);
        n++;
      }
      if (n < 3) return null;
      let contourDiff: number | null = null;
      if (contourGoal) {
        const cImg = this.renderBodyStructured(start, 128, null, null, { backHair: true });
        const cRe = cImg ? this.analyzePose(cImg, 128, 128) : null;
        contourDiff = cRe ? contourDiffOf(cRe.contour) : null;
      }
      return { diff: sum, contourDiff, measured: re.bodyProfile };
    };
    let corr: Corr = this.getDrawingCorrections();
    const first = measure(corr);
    if (!first) { this.setDrawingCorrections(corr); return null; }
    let best = first;
    let bestCorr: Corr = { ...corr };
    let rounds = 0;
    for (let round = 0; round < maxRounds; round++) {
      const next: Corr = { ...bestCorr };
      for (const k of keys) {
        const m = best.measured[k];
        const g = target.profile[k];
        if (m === null || g === null || m <= 0.01) continue;
        const ratio = Math.max(0.75, Math.min(1.33, g / m));
        next[k] = Math.max(0.5, Math.min(2.5, bestCorr[k] * (1 + (ratio - 1) * 0.8)));
      }
      const cand = measure(next);
      rounds++;
      if (!cand) break;
      const contourOk = cand.contourDiff === null || best.contourDiff === null || cand.contourDiff <= best.contourDiff + 0.02;
      if (cand.diff < best.diff - 0.005 && contourOk) { best = cand; bestCorr = next; }
      else break;
    }
    this.setDrawingCorrections(bestCorr);
    const state = this.load();
    state.drills++;
    const improved = best.diff < first.diff * 0.8;
    if (improved) state.drillsOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { initialDiff: first.diff, finalDiff: best.diff, improved, rounds, corrections: bestCorr, contourDiffInitial: first.contourDiff, contourDiffFinal: best.contourDiff };
  }

  /**
   * P1001: 目標へのドリル第1段。描く→測り直す→差分を見て
   * プロファイルを目標へ寄せる、を繰り返し、一番差分の
   * 小さかったパラメータを返す（柱4の土台）。
   */
  public drillToTarget(start: PoseReading, maxRounds = 14): { initialDiff: number; finalDiff: number; improved: boolean; rounds: number; plateau: boolean; graduated: boolean; level: number; contourDiffInitial: number | null; contourDiffFinal: number | null; reading: PoseReading } | null {
    const target = this.getTarget();
    if (!target || !start.head) return null;
    // P1011: 奥行きプロファイルからドリルは始めない。
    if (start.profileKind === 'depth') return null;
    // P1013: 停滞は「卒業の許容差分より上で縮まらなくなった」
    // こと。許容差分に届いたあと差分が縮まらなくなるのは到達で
    // あって停滞ではない（測り値の量子化で、届いた値のまま
    // 同じ最良差分が続くことがある）。
    const toleranceAtStart = 0.14 * Math.pow(0.8, this.load().drillLevel - 1);
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
    // P1027: 輪郭のドリル。目標に輪郭があり長い髪なら、後ろ髪の
    // 面の広がり（silhouetteWidth）を輪郭の幅のずれで寄せる。
    // プロファイルは面なしで、輪郭は面ありで、別々に測る
    // （面を入れると脚の幅が髪に化けてプロファイルが狂う）。
    const contourGoal = target.contour ?? null;
    const drillContour = contourGoal !== null && start.hair?.length === 'long';
    let curSilW: number | null = start.silhouetteWidth ?? null;
    let bestSilW: number | null = curSilW;
    let bestContourDiff = Number.POSITIVE_INFINITY;
    let contourDiffInitial: number | null = null;
    const contourDiffOf = (c: PoseReading['contour']): number | null => {
      if (!c || !contourGoal) return null;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < 24; i++) {
        const a = contourGoal.l[i];
        const b = contourGoal.r[i];
        const x = c.l[i];
        const y = c.r[i];
        if (a === null || a === undefined || b === null || b === undefined || x === null || x === undefined || y === null || y === undefined) continue;
        sum += (Math.abs(a - x) + Math.abs(b - y)) / 2;
        n++;
      }
      return n >= 12 ? sum / n : null;
    };
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
      // P1009: 差分は0.01単位に丸めた値の合計なので、0.06ちょうどは
      // 浮動小数の誤差（0.06000000000000005）で収束と判定されず、
      // 床に張り付いたまま停滞に化けることがある。僅かに緩める。
      if (bestDiff <= 0.06 + 1e-9) break;
      if (staleRounds >= 3 && round >= 3) { plateau = bestDiff > toleranceAtStart; break; }
      if (drillContour && curSilW !== null && contourGoal) {
        const cImg = this.renderBody({ ...start, bodyProfile: current, profileComplete: true, silhouetteWidth: curSilW }, 128, null, null, { backHair: true });
        const cRe = cImg ? this.analyzePose(cImg, 128, 128) : null;
        const cd = cRe ? contourDiffOf(cRe.contour) : null;
        if (cd !== null && cRe?.contour) {
          if (contourDiffInitial === null) contourDiffInitial = cd;
          if (cd < bestContourDiff) { bestContourDiff = cd; bestSilW = curSilW; }
          let wErr = 0;
          let wN = 0;
          for (let i = 8; i < 24; i++) {
            const ga = contourGoal.l[i];
            const gb = contourGoal.r[i];
            const gx = cRe.contour.l[i];
            const gy = cRe.contour.r[i];
            if (ga === null || ga === undefined || gb === null || gb === undefined || gx === null || gx === undefined || gy === null || gy === undefined) continue;
            wErr += (gb - ga) - (gy - gx);
            wN++;
          }
          if (wN >= 6) curSilW = Math.max(0.15, Math.min(0.95, curSilW + (wErr / wN) * 0.5));
        }
      }
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
    return { initialDiff, finalDiff: bestDiff, improved, rounds: roundsUsed, plateau, graduated, level, contourDiffInitial, contourDiffFinal: Number.isFinite(bestContourDiff) ? bestContourDiff : null, reading: { ...start, bodyProfile: bestProfile, ...(drillContour && bestSilW !== null ? { silhouetteWidth: bestSilW } : {}) } };
  }

  /**
   * P1005: 要素ドリル。プロファイルの1項目だけを目標へ寄せる。
   * 全体ドリルでは「どの部位が縮まらないのか」が見えないため、
   * 部位ごとに単独で練習し、縮む部位と縮まない部位を分ける。
   */
  public drillElement(start: PoseReading, key: 'shoulder' | 'chest' | 'waist' | 'hip' | 'thigh' | 'calf' | 'ankle', maxRounds = 8): { key: string; initialDiff: number; finalDiff: number; ok: boolean; plateau: boolean } | null {
    const target = this.getTarget();
    if (!target || !start.head) return null;
    // P1011: 奥行きプロファイルからは要素ドリルも始めない。
    if (start.profileKind === 'depth') return null;
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
  public renderClothes(reading: PoseReading, size = 192, garment: { top?: [number, number, number]; bottom?: 'skirt' | 'pants'; bottomColor?: [number, number, number] } | null = null, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null): Uint8Array | null {
    const base = this.renderBodyCel(reading, size, face, colors, shape);
    if (!base || !garment || !reading.head) return base;
    const out = new Uint8Array(base);
    const bg: [number, number, number] = [base[0], base[1], base[2]];
    const isBg = (i: number): boolean => Math.abs(base[i] - bg[0]) <= 10 && Math.abs(base[i + 1] - bg[1]) <= 10 && Math.abs(base[i + 2] - bg[2]) <= 10;
    const HAIR: [number, number, number] = colors?.hair ?? reading.hairRgb ?? EXTRA_COLORS.find((c) => c.name === reading.hairColor)?.rgb ?? [45, 32, 22];
    const near = (i: number, c: [number, number, number], tol: number): boolean => Math.abs(base[i] - c[0]) + Math.abs(base[i + 1] - c[1]) + Math.abs(base[i + 2] - c[2]) <= tol;
    const isHair = (i: number): boolean => near(i, HAIR, 42) || near(i, deriveShadow(HAIR), 42);
    const isSkin = (i: number): boolean => base[i] > 170 && base[i + 1] > 110 && base[i + 1] < 220 && base[i + 2] > 70 && base[i + 2] < 195 && base[i] > base[i + 1] && base[i] - base[i + 2] > 35;
    const shoulderY = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.y + reading.shoulderR.y) / 2 : reading.head.y + (reading.headRh ?? reading.head.r) * 1.6;
    const cxN = reading.shoulderL && reading.shoulderR ? (reading.shoulderL.x + reading.shoulderR.x) / 2 : reading.head.x;
    const footY = reading.footL && reading.footR ? (reading.footL.y + reading.footR.y) / 2 : 0.95;
    const hipY = shoulderY + (footY - shoulderY) * 0.43;
    const S1 = size - 1;
    const ySh = Math.round(shoulderY * S1), yHip = Math.round(hipY * S1), yFoot = Math.round(footY * S1);
    const paint = (x: number, y: number, c: [number, number, number]) => {
      const i = (y * size + x) * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2];
    };
    // P1065: ズボンの境界は胴の描き終わり（肩→足の0.43
    // 補間の線＝読み直し側の腰の線と股の位置）に置く。
    // 股関節の点は別途洗練された値で、読み直しの腰の線
    // （股基準）とは一致しない。境界を関節の線まで下げる
    // と、脚の上部が上の色で塗られ、読み直しの下の服の
    // 色見本（腰の直下）が上の色を拾ってしまう。
    const yHipBottom = yHip;
    if (garment.top) {
      for (let y = ySh; y <= yHipBottom; y++) {
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
      for (let y = yHipBottom; y <= yFoot; y++) {
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
  public renderBodyOutlineRole(reading: PoseReading, size = 192, face: BodyFaceSpec | null = null, colors: { hair?: [number, number, number]; body?: [number, number, number] } | null = null, shape: { bust?: number; frontHair?: boolean; backHair?: boolean } | null = null): Uint8Array | null {
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
    // P1065: 描く大きさは192にする。64では目・眉・小さい
    // 口が画素に潰れて、顔の読み側が大きさや眉を読めな
    // かった（目の照合が192で描く理由と同じ）。
    const image = this.renderBody(reading, 192, face);
    if (!image) return null;
    const crop = visualZoomService.cropAnalyze(image, 192, 192, reading.head.x, reading.head.y, (reading.headRh ?? reading.head.r) * 3.4);
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
  public verifyEyeDetail(reading: PoseReading, face: BodyFaceSpec): { verified: boolean; eyes: number; eyeColor: string | null; eyeSize: 'large' | 'small' | null; image: Uint8Array } | null {
    if (!reading.head) return null;
    // 目の部品は小さいので、大きく描いてから切り出す（64では虹彩が瞳孔に潰れる）。
    const image = this.renderBody(reading, 192, face);
    if (!image) return null;
    const crop = visualZoomService.cropAnalyze(image, 192, 192, reading.head.x, reading.head.y, (reading.headRh ?? reading.head.r) * 3.4);
    if (!crop) return null;
    const fr = visualZoomService.analyzeFace(crop.pixels);
    let verified = false;
    if (fr) {
      // 照合は目の数と虹彩の色、それに目の大きさ（P1010で部品の目でも
      // 読めるようになった：顔の箱を中心の肌の塊で取り、大きさは
      // 虹彩の色画素の横幅で測る）。
      verified = fr.eyes === 2;
      if (face.irisName && fr.eyeColor !== face.irisName) verified = false;
      if (face.eyeSize && fr.eyeSize !== face.eyeSize) verified = false;
    }
    const state = this.load();
    state.eyesDrawn++;
    if (verified) state.eyesOk++;
    try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    return { verified, eyes: fr?.eyes ?? 0, eyeColor: fr?.eyeColor ?? null, eyeSize: fr?.eyeSize ?? null, image };
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
    const crop = visualZoomService.cropAnalyze(image, S, S, reading.head.x, reading.head.y, (reading.headRh ?? reading.head.r) * 3.4);
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
  // P1014: 1つのマスクから人を数える本体。skip は既に読めた
  // 人の箱で、重なる成分は二重に数えない。
  private peopleFromMask(rgba: Uint8Array | number[], width: number, height: number, mask: Uint8Array, skip: Array<{ x0: number; y0: number; x1: number; y1: number }>): { readings: PoseReading[]; imageHands: Array<Array<{ x: number; y: number }>>; boxes: Array<{ x0: number; y0: number; x1: number; y1: number }> } {
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
    const boxes: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
    // P959: 元画像の座標に戻した手の位置（人ごと）
    const imageHands: Array<Array<{ x: number; y: number }>> = [];
    for (const c of comps) {
      if (c.area < width * height * 0.03) continue;
      const bw = c.x1 - c.x0 + 1;
      const bh = c.y1 - c.y0 + 1;
      if (bh < height * 0.15) continue;
      // P1014: 既に読めた人と重なる成分は数え直さない（小さい
      // 方の箱の半分以上が重なれば同一人物と見る）。
      const already = skip.some((b) => {
        const ox = Math.max(0, Math.min(c.x1, b.x1) - Math.max(c.x0, b.x0) + 1);
        const oy = Math.max(0, Math.min(c.y1, b.y1) - Math.max(c.y0, b.y0) + 1);
        const minArea = Math.min(bw * bh, (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1));
        return minArea > 0 && (ox * oy) / minArea >= 0.5;
      });
      if (already) continue;
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
        boxes.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
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
    return { readings, imageHands, boxes };
  }

  public analyzePeople(rgba: Uint8Array | number[], width: number, height: number): { count: number; readings: PoseReading[]; holdingHands: boolean } {
    // P1014: まず色ビン（64刻み）で数える。薄い色の人は肌や髪が
    // 背景と同じビンに溶けて数えられないため、細かいビン
    // （32刻み）でも数え、重ならない人だけ足す。
    const binMask = buildMask(rgba, width, height);
    const first = binMask ? this.peopleFromMask(rgba, width, height, binMask, []) : { readings: [] as PoseReading[], imageHands: [] as Array<Array<{ x: number; y: number }>>, boxes: [] as Array<{ x0: number; y0: number; x1: number; y1: number }> };
    let readings = first.readings;
    let imageHands = first.imageHands;
    const fineMask = buildMaskFine(rgba, width, height);
    if (fineMask) {
      const second = this.peopleFromMask(rgba, width, height, fineMask, first.boxes);
      readings = readings.concat(second.readings);
      imageHands = imageHands.concat(second.imageHands);
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
    // P1065: 細かいビンは常時試す。粗いビンでは薄い髪や肌が
    // 背景と同化して「服だけの人」になり、密度が0.5を超える
    // と細かい取り方が試されず、服の幅だけの読みが残った
    // （薄い人の描き直しで実際に起きた）。どちらを採るかは
    // 従来どおり照合・密度・完全さの調停に任せる。
    if (!chosen || binDensity < 0.5 || fineTaller || fineMask !== null) {
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
        if (!chosen || (r.verified && !chosen.verified) || (r.verified === chosen.verified && (d > chosenDensity || moreComplete ||
          // P1070: 密度がほぼ同じ（誤差範囲）で、片方だけ装飾品を
          // 見つけているならそちらを採る。粗いビンでは桜色の飾りが
          // 背景と同じビンに落ちて見えなくなる（密度はむしろ粗い方
          // が高く出る）が、飾りは図の一部であり、見つけた試行の
          // 方が図を正直に捉えている。
          (Math.abs(d - chosenDensity) < 0.02 && (r.accessories?.length ?? 0) > (chosen.accessories?.length ?? 0))))) {
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
      // P1055: 分割は2方式（線で区切るv1／色で育てるv2）を
      // 両方試し、出来た読みが細い方（＝髪を体と誤っていない
      // 方）を採る。線画ではv1が、平坦な描画ではv2が正直に
      // なるため、画像ごとに選ぶ。
      const seg1 = segmentBodyMask(rgba, width, height);
      const seg2 = segmentBodyMaskV2(rgba, width, height);
      let seg = seg1;
      let rr = seg1 ? this.analyzePoseWithMask(rgba, width, height, seg1.body, chosenMethod, chosen.silhouetteDensity, seg1.hair) : null;
      const segScore = (r: PoseReading | null): number => (r && r.profileComplete ? (r.bodyProfile.chest ?? 9) + (r.bodyProfile.calf ?? 9) : Infinity);
      if (seg2) {
        const rr2 = this.analyzePoseWithMask(rgba, width, height, seg2.body, chosenMethod, chosen.silhouetteDensity, seg2.hair);
        if (rr2 && segScore(rr2) < segScore(rr)) { seg = seg2; rr = rr2; }
      }
      if (seg) {
        // P1015: 髪の実測色は、領域分割の髪マスクの平均が一番
        // 正直（色ビンでは薄い髪と肌が同じビンに混ざり、ビンの
        // 平均が肌色に引っ張られるため）。
        {
          let hr2 = 0, hg2 = 0, hb2 = 0, hn2 = 0;
          for (let i = 0; i < seg.hair.length; i++) {
            if (!seg.hair[i]) continue;
            hr2 += rgba[i * 4]; hg2 += rgba[i * 4 + 1]; hb2 += rgba[i * 4 + 2]; hn2++;
          }
          if (hn2 >= 50) {
            const segAvg: [number, number, number] = [Math.round(hr2 / hn2), Math.round(hg2 / hn2), Math.round(hb2 / hn2)];
            // P1065: 髪マスクに体が混ざると平均が体の色に
            // 引っ張られる（作画髪で髪色が青に化けた）。元の
            // 推定と大きく違う時はマスク側を疑い、採用しない。
            const own = chosen.hairRgb;
            if (!own || Math.abs(segAvg[0] - own[0]) + Math.abs(segAvg[1] - own[1]) + Math.abs(segAvg[2] - own[2]) <= 90) chosen.hairRgb = segAvg;
          }
        }
        // 詰まり具合は元の輪郭のものを渡す（体だけのマスクは
        // 島状で当然まばらなので、その密度で正直さの門にかけない）。
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
          if (figureDirty && chosen.hair?.length === 'long' && neverWider && rr.profileComplete && (!chosen.profileComplete
            || (rr.bodyProfile.chest !== null && chosen.bodyProfile.chest !== null && rr.bodyProfile.chest >= 0.12 && rr.bodyProfile.chest < chosen.bodyProfile.chest - 0.08))) {
            const mergedProfile = { ...rr.bodyProfile };
            // 太ももだけは例外：股の位置は髪でずれやすく、領域側の
            // 帯が胴に入って広がることがある。その時は元の値を残す。
            if (mergedProfile.thigh !== null && chosen.bodyProfile.thigh !== null && mergedProfile.thigh > chosen.bodyProfile.thigh + 0.03) {
              mergedProfile.thigh = chosen.bodyProfile.thigh;
            }
            // P1053: 脚の長さも領域側から採る。髪を除いた側の
            // 股位置でないと、脚の間の髪の房に引っ張られて
            // 股が下がり、脚の長さが測れなくなるため。
            chosen = { ...chosen, bodyProfile: mergedProfile, profileComplete: true, legLength: rr.legLength ?? chosen.legLength, legLengthDescription: rr.legLength ? rr.legLengthDescription : chosen.legLengthDescription, hipL: rr.hipL ?? chosen.hipL, hipR: rr.hipR ?? chosen.hipR };
            regionApplied = true;
          } else if (chosen.hair?.length === 'long' && rr.profileComplete && contaminated(bandRow.calf)) {
            // P1022: 脚だけが髪で膨らんでいる時は、脚の幅だけ
            // 領域側から採る（後ろ髪の層を描くようになって、
            // 胸は無事で脚だけ汚れる形が出てきたため）。
            const legKeys = ['thigh', 'calf', 'ankle'] as const;
            let legDirty = false;
            let legOk = true;
            for (const k of legKeys) {
              const a = chosen.bodyProfile[k];
              const b = rr.bodyProfile[k];
              if (a === null || b === null || b > a + 0.03) { legOk = false; break; }
              if (b < a - 0.08) legDirty = true;
            }
            if (legOk && legDirty) {
              const mergedProfile = { ...chosen.bodyProfile };
              for (const k of legKeys) mergedProfile[k] = rr.bodyProfile[k];
              chosen = { ...chosen, bodyProfile: mergedProfile, profileComplete: true };
              regionApplied = true;
            }
          }
        }
      }
    }
    // P1023: 輪郭（外側の境界）を24段で測って読みに持たせる。
    // 左端・右端を分けて持つので、曲がりと非対称が残る。
    if (chosen && chosen.head && chosen.profileComplete && !chosen.truncated && chosen.profileKind !== 'depth' && chosenMask) {
      const figTop = (chosen.head.y - (chosen.headRh ?? chosen.head.r)) * (height - 1);
      const footYn = Math.max(chosen.footL?.y ?? 0, chosen.footR?.y ?? 0);
      const figBottom = (footYn > 0 ? footYn : 0.98) * (height - 1);
      const figHp = Math.max(1, figBottom - figTop);
      const cxp = chosen.head.x * (width - 1);
      const ls: (number | null)[] = [];
      const rs: (number | null)[] = [];
      for (let i = 0; i < 24; i++) {
        const y = Math.max(0, Math.min(height - 1, Math.round(figTop + ((i + 0.5) / 24) * figHp)));
        let minX = -1;
        let maxX = -1;
        for (let x = 0; x < width; x++) if (chosenMask[y * width + x]) { if (minX < 0) minX = x; maxX = x; }
        if (minX < 0) { ls.push(null); rs.push(null); } else {
          ls.push(Math.round(((minX - cxp) / figHp) * 1000) / 1000);
          rs.push(Math.round(((maxX - cxp) / figHp) * 1000) / 1000);
        }
      }
      chosen = { ...chosen, contour: { l: ls, r: rs } };
      // P1024: 中の境界線。各段の行を輪郭の内側で走査し、
      // 色が大きく変わる位置（服の縁・髪と体の境目）を記録。
      const inner: (number[] | null)[] = [];
      for (let i = 0; i < 24; i++) {
        const y = Math.max(0, Math.min(height - 1, Math.round(figTop + ((i + 0.5) / 24) * figHp)));
        let minX = -1;
        let maxX = -1;
        for (let x = 0; x < width; x++) if (chosenMask[y * width + x]) { if (minX < 0) minX = x; maxX = x; }
        if (minX < 0 || maxX - minX < 4) { inner.push(null); continue; }
        const pts: number[] = [];
        for (let x = minX + 1; x < maxX; x++) {
          // P1068: マスクの内側の穴（色ビンの抜け）で走査を
          // 止めない。輪郭と同じく、その行の図の範囲全体を
          // 内側として色の境界を見る。薄い色の体がビンから
          // 抜けた行で、体の中の境界が丸ごと消えていた。
          const a = (y * width + x - 1) * 4;
          const b = (y * width + x) * 4;
          const d = Math.abs(rgba[a] - rgba[b]) + Math.abs(rgba[a + 1] - rgba[b + 1]) + Math.abs(rgba[a + 2] - rgba[b + 2]);
          if (d > 60) {
            const v = Math.round(((x - cxp) / figHp) * 1000) / 1000;
            if (pts.length === 0 || Math.abs(v - pts[pts.length - 1]) > 0.02) pts.push(v);
            if (pts.length >= 6) break;
          }
        }
        inner.push(pts);
      }
      chosen = { ...chosen, innerLines: inner };
    }
    // P1035: アホ毛は、選ばれたマスクから測る（パスの途中では
    // マスクの取り方で頭の形が揺れて誤検出するため）。
    if (chosen && chosen.head && chosenMask) {
      const cxp2 = chosen.head.x * (width - 1);
      const headCyPx = chosen.head.y * (height - 1);
      let maskTop = -1;
      const rowW: number[] = [];
      for (let y = 0; y < height; y++) {
        // 中心に一番近い run の幅（アホ毛の先は中心から
        // ずれるので、中心を含む run だけ見ると先が消える）。
        let bestW = 0, bestD = Infinity;
        let runStart = -1;
        for (let x = 0; x <= width; x++) {
          const on = x < width && !!chosenMask[y * width + x];
          if (on && runStart < 0) runStart = x;
          if (!on && runStart >= 0) {
            const w = x - runStart;
            const c = (runStart + x - 1) / 2;
            const d = Math.abs(c - cxp2);
            if (d < bestD) { bestD = d; bestW = w; }
            runStart = -1;
          }
        }
        rowW.push(bestW);
        if (bestW > 0 && maskTop < 0) maskTop = y;
      }
      if (maskTop >= 0) {
        let capW = 0;
        for (let y = maskTop; y <= Math.min(height - 1, Math.round(headCyPx)); y++) capW = Math.max(capW, rowW[y]);
        let narrow = 0;
        let firstWideW = 0;
        let wideY = -1;
        // アホ毛は太さがほぼ均一。頭頂の丸みは行ごとに
        // どんどん広がるので、太さの上限は束の太さでも縛る。
        // P1071: 束の太さは先端の1行では測れない（先端の行は
        // 円の端が欠けて細く出る）。先端3行の最大値で測る。
        let strandW = 0;
        for (let y = maskTop; y <= Math.min(height - 1, maskTop + 2); y++) strandW = Math.max(strandW, rowW[y]);
        const wCap = Math.min(capW * 0.35, Math.max(2, strandW * 1.3));
        for (let y = maskTop; y <= Math.min(height - 1, Math.round(headCyPx)); y++) {
          if (rowW[y] === 0) break;
          if (rowW[y] <= wCap) narrow++;
          else { firstWideW = rowW[y]; wideY = y; break; }
        }
        // P1071: 頭は円なので頂点の行は細く、wCap を超えた
        // 直後の行はまだ頭幅の半分に届かない。細い束の下に
        // 頭があることの確認は、数行下までの最大幅で見る。
        // ない時のガードは narrow の長さが担う（変わらず）。
        if (wideY >= 0 && firstWideW < capW * 0.5) {
          for (let y = wideY + 1; y <= Math.min(height - 1, Math.round(headCyPx), wideY + 4); y++) {
            if (rowW[y] === 0) break;
            firstWideW = Math.max(firstWideW, rowW[y]);
          }
        }
        const ahogeV = capW > 0 && narrow >= Math.max(2, Math.round(height * 0.02)) && firstWideW >= capW * 0.5;
        chosen = { ...chosen, ahoge: ahogeV };
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
      if (chosen.hair && (chosen.hair.shine != null || chosen.hair.clumps)) state.hairReads++;
      if (chosen.collarbone === true) state.collarbones++;
      if (chosen.neck === true) state.necks++;
      if (chosen.armLength) state.armLengths++;
      if (chosen.legLength) state.legLengths++;
      if (chosen.profileComplete) state.profiles++;
      if (chosen.viewpoint === 'side') state.sideViews++;
      if (chosen.viewpoint === 'back') state.backViews++;
      if (chosen.hairShape) state.hairShapes++;
      try { storageService.setItem(KEY, JSON.stringify(state)); } catch { /* 保存できなくても本流は止めない */ }
    }
    // P1017: 顔の測定値を読みに持たせる（頭を拡大して読む）。
    // 描画の既定の顔は本人の測定値で描くため。読めなければ
    // null のまま（顔は中立の既定で描く）。
    if (chosen && chosen.head && !chosen.face) {
      try {
        const crop = visualZoomService.cropAnalyze(rgba, width, height, chosen.head.x, chosen.head.y, chosen.head.r * 3.4);
        const fr = crop ? visualZoomService.analyzeFace(crop.pixels) : null;
        if (fr && fr.eyes === 2) chosen.face = { eyeSize: fr.eyeSize, eyeColor: fr.eyeColor, mouthSize: fr.mouthSize, brows: fr.brows, blush: fr.cheekFlush, nose: fr.nose, ears: fr.ears, parting: fr.parting, eyeShape: fr.eyeShape, mouthForm: fr.mouthShape === 'smile' || fr.mouthShape === 'frown' ? fr.mouthShape : null, browAngle: fr.browAngle };
      } catch { /* 顔が読めなくても姿勢の読みは返す */ }
    }
    return chosen;
  }

  /** P1001: 1つのマスクで姿勢を読む本体。記録は呼び出し側が採った読みについてだけ行う */
  private analyzePoseWithMask(rgba: Uint8Array | number[], width: number, height: number, mask: Uint8Array, maskMethod: 'bin' | 'fine' | 'fill', silhouetteDensity: number, noBridgeMask?: Uint8Array | null): PoseReading | null {
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
    // P1053: 「足元まで届くか」は、span の範囲を少しずつ
    // 広げながら下へたどる（脚は下へ行くほど少しずつ内へ
    // 寄るため、同じ列だけ見ると途中で見失う。逆に、脚の
    // 間の髪の房のように途中で終わるものはたどり切れない）。
    const reachesBottom = (sp: { minX: number; maxX: number }, fromY: number): boolean => {
      let lo = sp.minX, hi = sp.maxX;
      const startCx = (sp.minX + sp.maxX) / 2;
      const startW = sp.maxX - sp.minX + 1;
      let prevW = startW;
      for (let y = fromY + 1; y <= figBottom; y++) {
        // P1065: 次の行では、前の範囲と重なる「連続したラン」
        // だけをたどる。窓の中の画素を全部拾うと、1pxの隙間
        // 越しに隣の脚まで飲み込んで中心がずれ、股の検出が
        // 一番下の行まで落ちていた（P987の脚の長さが全部
        // 短く読めた原因）。
        let nlo = -1, nhi = -1;
        {
          const xFrom = Math.max(0, lo - 2), xTo = Math.min(width - 1, hi + 2);
          let runLo = -1, bestOv = 0;
          for (let x = xFrom; x <= xTo + 1; x++) {
            const on = x <= xTo && !!mask[y * width + x];
            if (on && runLo < 0) runLo = x;
            if (!on && runLo >= 0) {
              const runHi = x - 1;
              const ov = Math.min(runHi, hi) - Math.max(runLo, lo) + 1;
              if (ov > bestOv) { bestOv = ov; nlo = runLo; nhi = runHi; }
              runLo = -1;
            }
          }
          if (nlo < 0) return false;
        }
        // 前の行の範囲と重ならない塊へは移らない（隣の部位へ
        // 飛び移らないため）。中心の横移動の総量にも上限を
        // 置く（広がっていく髪の面の縁を脚と誤らないため）。
        if (nhi < lo - 1 || nlo > hi + 1) return false;
        // P1065: 中心の移動は「1行ごとの上限＋累積の上限」で
        // 見る。脚の先細りは1行では少しずつ寄るが累積は
        // そこそこ大きくなる。髪の面の縁をたどる場合は幅が
        // 膨らむので、幅の膨張ガードで区別する（面をたどる
        // と幅が際限なく広がるが、脚は太さが保たれる）。
        // 細くなる行の中心移動は、柱が少し細くなるだけで
        // 大きく見えることがある（合体した脚の柱が分かれる
        // 直前など）ため、広がる方向より緩く許す。
        const ncx = (nlo + nhi) / 2;
        const nw = nhi - nlo + 1;
        const driftCap = nw < prevW ? Math.max(2.2, figW * 0.08) : Math.max(1.2, figW * 0.045);
        if (Math.abs(ncx - (lo + hi) / 2) > driftCap) return false;
        if (Math.abs(ncx - startCx) > figW * 0.22) return false;
        if (nw > startW * 1.6 + 2) return false;
        lo = nlo; hi = nhi; prevW = nw;
      }
      return true;
    };
    // P1053: 走査の開始を図の40%まで下げる。脚の長い人は
    // 股が50%より上にある（全身サンプルでは約46%で、従来の
    // 開始位置では本物の股を飛ばして髪の房を拾っていた）。
    for (let y = Math.floor(figTop + figH * 0.4); y <= figBottom; y++) {
        const spans = rows[y].spans;
        if (spans.length < 2) continue;
        const l = spans[0];
        const r = spans[spans.length - 1];
        if (reachesBottom(l, y) && reachesBottom(r, y)) { crotchY = y; break; }
    }
    // P1050: 股の位置は、脚の間に垂れた髪の房があると房の先まで
    // 下がってしまう（全身サンプルで実際に起き、腰の帯が太ももに
    // 落ちて腰が片脚の幅0.06と読めた）。立位の股は首から図の
    // 高さの44%以内にある、という解剖学の上限で抑える。
    const hipY = crotchY > 0 ? Math.min(crotchY - 2, neckY + figH * 0.44) : neckY + figH * 0.45;

    // 胴と肩：胴の幅は「頭の中心を含む span のうち、頭より下で
    // 最も細い行」から取る（腕が体に付いて下りていても、腕の
    // 無い高さでは胴だけの幅が残る）。肩は、その幅に近い span
    // が最初に現れる行。
    let torsoLeft = figLeft;
    let torsoRight = figRight;
    let shoulderY = Math.min(height - 1, neckY + figH * 0.05);
    // P1053: 走査の開始は首の付け根（頭の中心＋半径）から。
    // 従来の1.5倍では、頭を小さく読んだ分だけ肩の行まで
    // 沈んでいた（全身サンプルで肩関節が胸の位置に出た）。
    const torsoScanFrom = Math.ceil(headCy + headR);
    const torsoScanTo = Math.min(height - 1, crotchY > 0 ? crotchY + 2 : Math.floor(hipY + figH * 0.1));
    // P1016: 胴の幅は「最も細い行」では取らない。首だけの行に
    // 引っ張られると胴が首の幅まで潰れて、肩が首に寄り、髪の
    // 輪郭を「横に広げた腕」と誤る（全身サンプルで実際に
    // 起きた）。首の下の範囲で幅の下位10%を取り（潰れた
    // 1行には引っ張られない）、端はその幅に近い行の中央値で
    // 代表させる。
    let torsoWidth = Infinity;
    {
      const scan: Array<{ y: number; w: number; minX: number; maxX: number }> = [];
      const from = Math.max(torsoScanFrom, Math.floor(neckY + figH * 0.1));
      const to = Math.min(torsoScanTo, Math.floor(hipY + figH * 0.05));
      for (let y = from; y <= to; y++) {
        // P1065: 股から下の行は脚の幅であって胴の幅では
        // ない（描き直しの読み返しで、脚の行が1割を超えて
        // 統計を脚の幅まで引っ張った）。胴の統計からは外す。
        if (crotchY > 0 && y >= crotchY) continue;
        const span = rows[y].spans.find((s) => headCx >= s.minX && headCx <= s.maxX);
        if (span && span.maxX - span.minX + 1 >= 3) scan.push({ y, w: span.maxX - span.minX + 1, minX: span.minX, maxX: span.maxX });
      }
      if (scan.length) {
        const sorted = scan.map((r) => r.w).sort((a, b) => a - b);
        torsoWidth = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.1))];
        // P1065: 下ろした腕が胴と同色でくっつくと、走査の
        // 大半の行が「腕込みの幅」になり、胴の幅まで腕込みに
        // なる（腕が胴の内側に入って下ろした腕が読めない）。
        // 走査の最後の行（腕が終わり、脚が分かれる直前の胴
        // だけの行）の方が細ければ、そちらが胴の幅。
        // 最後の行は「その行が1つの塊だけ」の行を優先する
        // （分かれた脚の片方を胴と誤らないため）。
        const singleRows = scan.filter((r) => rows[r.y].spans.length === 1);
        const lastRow = singleRows.length ? singleRows[singleRows.length - 1] : scan[scan.length - 1];
        if (lastRow && lastRow.w < torsoWidth) torsoWidth = lastRow.w;
        // 端は代表幅ちょうど〜少し上の行から取る（代表幅より
        // 細い行は割れた断片で、その端は体の端ではないため）。
        const bandRows = scan.filter((r) => r.w >= torsoWidth && r.w <= torsoWidth * 1.3);
        const useRows = bandRows.length ? bandRows : scan.filter((r) => r.w <= torsoWidth * 1.15);
        const med = (vals: number[]): number => { const s = [...vals].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
        torsoLeft = med(useRows.map((r) => r.minX));
        torsoRight = med(useRows.map((r) => r.maxX));
      }
    }
    if (torsoWidth !== Infinity) {
      for (let y = torsoScanFrom; y <= torsoScanTo; y++) {
        const span = rows[y].spans.find((s) => headCx >= s.minX && headCx <= s.maxX);
        if (span && span.maxX - span.minX + 1 >= torsoWidth * 0.8) { shoulderY = y; break; }
      }
      // P1065: 肩と決めた行のすぐ下で幅が倍近くに跳ねるなら、
      // その行は肩でなく頭の下部だった（頭の半径の推定が
      // 粗く、走査の開始が頭の中に残る描き直しで起きた）。
      // 跳ねた先の幅に届く最初の行まで肩を下げる。なだらか
      // な肩や髪の面では幅は跳ねないので動かない。
      const widthAtS = (y: number): number => {
        const sp = rows[y]?.spans.find((x) => headCx >= x.minX && headCx <= x.maxX);
        return sp ? sp.maxX - sp.minX + 1 : 0;
      };
      const w0 = widthAtS(shoulderY);
      if (w0 > 0) {
        let wMax = 0;
        let yMax = shoulderY;
        for (let y = shoulderY; y <= Math.min(torsoScanTo, shoulderY + Math.round(figH * 0.08)); y++) {
          const w = widthAtS(y);
          if (w > wMax) { wMax = w; yMax = y; }
        }
        if (wMax >= w0 * 1.8) {
          for (let y = shoulderY; y <= yMax; y++) {
            if (widthAtS(y) >= wMax * 0.8) { shoulderY = y; break; }
          }
        }
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
      if (spreadPt) {
        // P1016: 張り出しの中に、図の上端からその行の直前まで
        // 前景でつながっている列が1本でもあれば、それは垂れた
        // 髪の柱であって横に広げた腕ではない（長い髪の人を
        // 腕を広げていると誤るため）。腕の帯の上は空いている。
        let hanging = false;
        const xFrom = side === 'L' ? spreadPt.x : Math.floor(torsoRight) + 1;
        const xTo = side === 'L' ? Math.ceil(torsoLeft) - 1 : spreadPt.x;
        for (let x = xFrom; x <= xTo && !hanging; x++) {
          let colFg = 0, colAll = 0;
          for (let y = Math.max(0, figTop); y < spreadPt.y - 1; y++) {
            colAll++;
            if (mask[y * width + x]) colFg++;
          }
          if (colAll > 0 && colFg / colAll >= 0.5) hanging = true;
        }
        if (!hanging) return { state: 'SPREAD', hand: spreadPt };
      }
      // 下りている：脚の外側で、腰の少し下までに側帯の前景の末端がある。
      // P1065: 側帯の画素は肩からつながる鎖としてたどる。
      // 鎖が切れた下の画素は脚の外側など別の部位で、手では
      // ない（細い胴の人形では脚の広がりが手に化けていた）。
      let lowPt: PosePoint | null = null;
      const yLimit = Math.min(crotchY > 0 ? crotchY : figBottom, Math.floor(hipY + figH * 0.1));
      let prevSide: { minX: number; maxX: number } | null = null;
      for (let y = Math.floor(shoulderY); y < yLimit; y++) {
        let rowMin = Infinity;
        let rowMax = -Infinity;
        let lastX = -1;
        for (let x = 0; x < width; x++) {
          if (mask[y * width + x] && isSide(x)) { if (x < rowMin) rowMin = x; if (x > rowMax) rowMax = x; lastX = x; }
        }
        if (rowMin === Infinity) { if (prevSide) break; continue; }
        if (prevSide && (rowMin > prevSide.maxX + 3 || rowMax < prevSide.minX - 3)) break;
        prevSide = { minX: rowMin, maxX: rowMax };
        lowPt = { x: lastX, y };
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
    // P1045: 手の大きさ（腕の島の下端の幅 ÷ 頭の幅）。skinHand が拾う。
    let handSizePx: { l: number | null; r: number | null } = { l: null, r: null };
    {
      const isSkinStrict = (idx: number) => {
        const r = rgba[idx]; const g = rgba[idx + 1]; const b = rgba[idx + 2];
        return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
      };
      // P1044: 薄い肌は厳しい判定では肌と数えられず、手の
      // 補強が働かなかった（鎖骨の P1032 と同じ穴）。厳しい
      // 判定で肌がほぼ見つからない時だけ、緩い判定に替える。
      // 淡い髪（g<b）や水着は緩い判定でも肌に入らない。
      let strictSkin = 0;
      for (let i = 0; i < width * height; i++) if (mask[i] && isSkinStrict(i * 4)) strictSkin++;
      const isSkinPx = strictSkin >= 8 ? isSkinStrict : (idx: number) => {
        const r = rgba[idx]; const g = rgba[idx + 1]; const b = rgba[idx + 2];
        return r > 190 && g >= b && r - b >= 12;
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
      if (maskCount > 0 && skinCount >= 8) {
        // 顔の島判定は従来どおり肌が少数派の時だけ。手の補正は
        // 肌が多い体でも要る（P1044：輪郭の手が髪に引っ張ら
        // れるのは肌の多い本人でこそ起きる）。
        if (skinCount / maskCount < 0.35 && faceCount >= 8) skinCues.face = true;
        const skinHand = (side: 'L' | 'R', arm: { state: ArmState; hand: PosePoint | null }): boolean => {
          const pts = sidePixels[side];
          if (pts.length < 4) return false;
          // P1044: 肌の島を縦の塊に分けてから使う。腕と脚の
          // 肌を全部平均すると、手の位置が太ももに引っ張られ
          // て低すぎる所に出る（水着の脚が裸のため）。
          const sorted = [...pts].sort((a, b) => a.y - b.y);
          const clusters: { x: number; y: number }[][] = [];
          for (const p of sorted) {
            const last = clusters[clusters.length - 1];
            if (last && p.y - last[last.length - 1].y <= Math.max(2, figH * 0.04)) last.push(p);
            else clusters.push([p]);
          }
          const rawClusters = clusters.filter((c) => c.length >= 4);
          const usable = rawClusters.map((c) => {
            // 手は腕の島の下端側にある。腕と脚の肌が繋がって
            // 1つの島になることがあるので、島は上から
            // 0.4×全身までで切り、その下半分の重心を取る。
            const ys = c.map((p) => p.y);
            const top = Math.min(...ys);
            const span = Math.min(figH * 0.4, Math.max(...ys) - top);
            const trunc = c.filter((p) => p.y <= top + span);
            const low = trunc.filter((p) => p.y >= top + span * 0.45);
            const use = low.length >= 2 ? low : trunc;
            const cx = use.reduce((a, p) => a + p.x, 0) / use.length;
            const cy = use.reduce((a, p) => a + p.y, 0) / use.length;
            // P1045: 手の幅は島の最下行の、手を含む run の幅。
            // 島全体の幅だと胴の肌まで数えてしまう。
            const maxY = Math.max(...use.map((p) => p.y));
            const band = use.filter((p) => p.y >= maxY - 2).map((p) => p.x).sort((a, b) => a - b);
            let w = 1, runMin = band[0], prev = band[0];
            const runs: [number, number][] = [];
            for (const x of band.slice(1)) {
              if (x - prev <= 1) { prev = x; continue; }
              runs.push([runMin, prev]); runMin = x; prev = x;
            }
            if (band.length) runs.push([runMin, prev]);
            const hit = runs.find(([a, b]) => cx >= a - 1 && cx <= b + 1) ?? runs[0];
            if (hit) w = hit[1] - hit[0] + 1;
            return { cx, cy, w };
          }).filter((c) => c.cy >= shoulderY && c.cy <= hipY + figH * 0.3);
          if (!usable.length) return false;
          const { cx, cy } = usable[0];
          if (side === 'L') handSizePx.l = usable[0].w; else handSizePx.r = usable[0].w;
          if (arm.hand) {
            if (Math.hypot(cx - arm.hand.x, cy - arm.hand.y) <= 8) { arm.hand = { x: cx, y: cy }; return true; }
            // P1044: 輪郭の手が肌の塊より大きく下にある時は、
            // 髪や脚に引っ張られた末端なので肌の塊で置き換える
            // （引っ張られるのは常に下方向）。
            if (arm.hand.y - cy > figH * 0.08) { arm.hand = { x: cx, y: cy }; return true; }
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
    // P1045: 手の大きさ（頭の幅との比）
    let handSize: number | null = null;
    {
      const ws = [handSizePx.l, handSizePx.r].filter((v): v is number => v !== null);
      if (ws.length && headR > 0) handSize = Math.round((ws.reduce((a, b) => a + b, 0) / ws.length / (headR * 2)) * 1000) / 1000;
    }

    // P1030: 腕と胴の隙間。胴の帯の各行で、胴の run の外側に
    // 背景を挟んで別の run（腕）があるかを見る。腕が胴に
    // くっついた絵と、離れた絵とでは輪郭も中の線も変わる。
    let armGap: { l: boolean; r: boolean } | null = null;
    {
      const bandEnd = Math.round(neckY + figH * 0.45);
      const gapMin = Math.max(2, figH * 0.02);
      let rowsN = 0;
      let gapL = 0;
      let gapR = 0;
      for (let y = Math.round(shoulderY) + 2; y <= bandEnd; y++) {
        const row = rows[y];
        if (!row || row.spans.length === 0) continue;
        const torso = row.spans.find((s) => headCx >= s.minX && headCx <= s.maxX);
        if (!torso) continue;
        rowsN++;
        let bestL = -1;
        let bestR = -1;
        for (const s of row.spans) {
          if (s === torso) continue;
          if (s.maxX < torso.minX) bestL = Math.max(bestL, s.maxX);
          if (s.minX > torso.maxX) bestR = bestR < 0 ? s.minX : Math.min(bestR, s.minX);
        }
        if (bestL >= 0 && torso.minX - bestL - 1 >= gapMin) gapL++;
        if (bestR >= 0 && bestR - torso.maxX - 1 >= gapMin) gapR++;
      }
      if (rowsN >= 4) armGap = { l: gapL >= rowsN * 0.4, r: gapR >= rowsN * 0.4 };
    }

    // P1034: 足の末端の広がり。一番下の行の脚の span と、
    // 少し上の脚の span の幅を比べる。脚は中心に近い2本
    // （長い髪が一番下まで届く場合は外側に髪の span が来る）。
    let footFlare: PoseReading['footFlare'] = null;
    if (!figTruncated) {
      const yB = figBottom;
      const yA = Math.max(0, figBottom - Math.max(2, Math.round(figH * 0.03)));
      const legSpansAt = (y: number) => (rows[y]?.spans ?? []).slice().sort((a, b) => Math.abs((a.minX + a.maxX) / 2 - headCx) - Math.abs((b.minX + b.maxX) / 2 - headCx)).slice(0, 2);
      const spansB = legSpansAt(yB);
      const spansA = legSpansAt(yA);
      if (spansB.length === 2 && spansA.length === 2) {
        const flareFor = (sb: { minX: number; maxX: number }, sa: { minX: number; maxX: number }) => (sb.maxX - sb.minX) > (sa.maxX - sa.minX) * 1.12 + 0.5;
        const byCenter = (arr: { minX: number; maxX: number }[]) => arr.slice().sort((a, b) => (a.minX + a.maxX) - (b.minX + b.maxX));
        const bS = byCenter(spansB), aS = byCenter(spansA);
        footFlare = { l: flareFor(bS[0], aS[0]), r: flareFor(bS[1], aS[1]) };
      }
    }

    // P1046: 膝の位置（脚の節の第1段）。脚の span を下から
    // 追い、幅の中ほどの窪みを膝と読む。窪みが無ければ
    // null（なだらかな脚では節は幅からは決まらない）。
    let legKnee: PoseReading['legKnee'] = null;
    if (!figTruncated) {
      const legSpansAt = (y: number) => (rows[y]?.spans ?? []).slice().sort((a, b) => Math.abs((a.minX + a.maxX) / 2 - headCx) - Math.abs((b.minX + b.maxX) / 2 - headCx)).slice(0, 2).sort((a, b) => (a.minX + a.maxX) - (b.minX + b.maxX));
      const prof: { l: number[]; r: number[]; topY: number } = { l: [], r: [], topY: figBottom };
      for (let y = figBottom; y >= Math.max(0, figBottom - Math.round(figH * 0.55)); y--) {
        const sp = legSpansAt(y);
        if (sp.length !== 2 || sp[1].minX - sp[0].maxX < 1) break;
        prof.l.unshift(sp[0].maxX - sp[0].minX + 1);
        prof.r.unshift(sp[1].maxX - sp[1].minX + 1);
        prof.topY = y;
      }
      const n = prof.l.length;
      if (n >= 12) {
        const kneeFor = (w: number[]): number | null => {
          const med = (a: number, b: number) => { const seg = w.slice(Math.floor(n * a), Math.max(Math.floor(n * a) + 1, Math.floor(n * b))).sort((x, y) => x - y); return seg[Math.floor(seg.length / 2)]; };
          const wThigh = med(0.08, 0.25), wCalf = med(0.68, 0.85);
          let bestY = -1, bestW = Infinity;
          for (let i = Math.floor(n * 0.3); i <= Math.floor(n * 0.62); i++) {
            const s = (w[Math.max(0, i - 1)] + w[i] + w[Math.min(n - 1, i + 1)]) / 3;
            if (s < bestW) { bestW = s; bestY = i; }
          }
          const dip = (Math.min(wThigh, wCalf) - bestW) / Math.max(1, Math.min(wThigh, wCalf));
          // ノイズの窪みと区別するため、窪みは深さ18%以上＋
          // 前後3行に対しても窪んでいることを要求する。
          const lo = Math.max(0, bestY - 3), hi = Math.min(n - 1, bestY + 3);
          const sm = (i: number) => (w[Math.max(0, i - 1)] + w[i] + w[Math.min(n - 1, i + 1)]) / 3;
          const isLocal = bestY > 0 && sm(lo) > bestW + 0.4 && sm(hi) > bestW + 0.4;
          return dip >= 0.18 && isLocal ? Math.round((bestY / (n - 1)) * 1000) / 1000 : null;
        };
        legKnee = { l: kneeFor(prof.l), r: kneeFor(prof.r) };
        // 正面の立ち姿では左右の膝はほぼ同じ高さ。大きく
        // ずれる読みは解像度ノイズとして両方落とす。
        if (legKnee.l !== null && legKnee.r !== null && Math.abs(legKnee.l - legKnee.r) > 0.15) legKnee = { l: null, r: null };
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
      if (legRatio >= 0.45) legLength = 'long';
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
    // P1012: 腰の行は、股の間に垂れた髪や壁線で左右に割れることが
    // ある（全身サンプルでは骨盤が2つのスパンに割れ、体の中心が
    // 隙間に落ちて、幅が半分以下に読めた）。中心を含むスパンが
    // ある行は従来どおり。中心が隙間に落ちた行だけ、細い隙間
    // （図の高さの3.5%まで）をまたいで両側のスパンをつなぐ。
    // 横に離れた髪の塊や、隣り合った腕は対象にならない。
    const bridgedWidthAt991 = (y: number): number | null => {
      const row = rows[Math.max(0, Math.min(height - 1, Math.round(y)))];
      if (!row || !row.spans.length) return null;
      // P1050: 中心を含むスパンがある行でも、そのスパンが
      // 壁線で割れた破片のことがある（腰の帯で実際に起きた）。
      // 細い隙間は常につないでから、中心を含む塊を取る。
      const gapMax = Math.max(2, figH * 0.035);
      const merged: Array<{ minX: number; maxX: number }> = [];
      const yIdx = Math.max(0, Math.min(height - 1, Math.round(y)));
      for (const s of row.spans) {
        const last = merged[merged.length - 1];
        let canBridge = last !== undefined && s.minX - last.maxX - 1 <= gapMax;
        // P1060: 隙間に髪があるなら、それは壁線の割れ目では
        // なく髪で隔てられた別の部位（腕と胴の間の面など）
        // なので、つながない。
        if (canBridge && noBridgeMask) {
          for (let gx = (last as { maxX: number }).maxX + 1; gx < s.minX; gx++) {
            if (noBridgeMask[yIdx * width + gx]) { canBridge = false; break; }
          }
        }
        if (canBridge && last) last.maxX = s.maxX;
        else merged.push({ minX: s.minX, maxX: s.maxX });
      }
      const strad = merged.find((m) => headCx >= m.minX && headCx <= m.maxX);
      return strad ? strad.maxX - strad.minX + 1 : spanWidthAt991(y);
    };
    // P1013: 肩の行は、前に垂れた髪や壁線で細かく割れやすい
    // （全身サンプルでは肩の行が5pxの破片になり0.02と読めた）。
    // 肩は常につないで測る：細い隙間（図の高さの3.5%まで）を
    // またいで、中心を含む塊の幅を取る。上げた腕や広げた腕は
    // 隙間が大きいので混ざらない。肩の幅はもともと、その高さの
    // 輪郭の幅（くっついた腕を含む）として測ってきた値と揃える。
    const shoulderWidthAt991 = (y: number): number | null => {
      const row = rows[Math.max(0, Math.min(height - 1, Math.round(y)))];
      if (!row || !row.spans.length) return null;
      const gapMax = Math.max(2, figH * 0.035);
      const merged: Array<{ minX: number; maxX: number }> = [];
      const yIdx = Math.max(0, Math.min(height - 1, Math.round(y)));
      for (const s of row.spans) {
        const last = merged[merged.length - 1];
        let canBridge = last !== undefined && s.minX - last.maxX - 1 <= gapMax;
        // P1060: 隙間に髪があるなら、それは壁線の割れ目では
        // なく髪で隔てられた別の部位（腕と胴の間の面など）
        // なので、つながない。
        if (canBridge && noBridgeMask) {
          for (let gx = (last as { maxX: number }).maxX + 1; gx < s.minX; gx++) {
            if (noBridgeMask[yIdx * width + gx]) { canBridge = false; break; }
          }
        }
        if (canBridge && last) last.maxX = s.maxX;
        else merged.push({ minX: s.minX, maxX: s.maxX });
      }
      let best: { minX: number; maxX: number } | null = null;
      let bestDist = Infinity;
      for (const m of merged) {
        const d = headCx >= m.minX && headCx <= m.maxX ? 0 : Math.min(Math.abs(headCx - m.minX), Math.abs(headCx - m.maxX));
        if (d < bestDist) { bestDist = d; best = m; }
      }
      return best ? best.maxX - best.minX + 1 : null;
    };
    const band991 = (y0: number, y1: number, fn: (y: number) => number | null, mode: 'max' | 'min' | 'p25' | 'median' | 'waistQ'): number | null => {
      if (mode === 'p25' || mode === 'median' || mode === 'waistQ') {
        // P1004: 帯の最小は1行の隙間で壊れるので、下から
        // 25%の行の幅を腰とする（細い行の代表として頑健）。
        // P1013: 肩は中央値。帯の最大は胸へ広がる行を拾って
        // 描画ドリルで肩と胸が連動し、最小は割れた行を拾う。
        const vals: number[] = [];
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
          const v = fn(y);
          if (v !== null) vals.push(v);
        }
        if (!vals.length) return null;
        vals.sort((a, b) => a - b);
        if (mode === 'waistQ') {
          // P1065: 腰の専用統計。中央値と下位四分位の中間。
          // 中央値だけだと数行の潰れが全く数値に現れず、
          // 四分位だけだと帯の下端の斜面に引かれる。
          const med = vals[Math.floor((vals.length - 1) * 0.5)];
          const q25 = vals[Math.floor((vals.length - 1) * 0.25)];
          return med - (med - q25) / 2;
        }
        return mode === 'median' ? vals[Math.floor((vals.length - 1) * 0.5)] : vals[Math.floor((vals.length - 1) * 0.25)];
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
      shoulder: ratio991(band991(shoulderY - figH * 0.01, shoulderY + figH * 0.05, shoulderWidthAt991, 'median')),
      chest: ratio991(band991(neckY + figH * 0.08, hipY - figH * 0.12, bridgedWidthAt991, 'max')),
      // P1009: 腰は帯の最小行でなく下から25%の行で測る。最小行は、領域分割の
      // 壁線などで数行だけ潰れた行に引っ張られて実物より細く出る
      // （全身サンプルで腰0.04。帯の行の多くは14〜16pxなのに最小は9pxだった）。
      // P1050: 腰も橋渡しで測る。腰の帯は骨盤まわりで壁線や
      // 服の紐に割れやすく、中心を含む破片だけだと実物の
      // 半分以下に読めた（全身サンプルで腰0.06←実物は約0.16）。
      // P1065: 腰は中央値と下位四分位の中間で読む
      // （'waistQ'）。四分位だけでは帯の下端が腰→尻の
      // 斜面にかかると斜面に引かれ、中央値だけでは
      // 数行の潰れが数値に現れない。
      waist: ratio991(band991(hipY - figH * 0.18, hipY - figH * 0.02, bridgedWidthAt991, 'waistQ')),
      hip: ratio991(band991(hipY - figH * 0.05, hipY + figH * 0.01, bridgedWidthAt991, 'p25')),
      // P1065: 太ももの帯は最大値でなく下位四分位で読む。
      // 帯の上端には横に垂れた手が入り込むことがあり、
      // 最大値だと手の幅まで太ももに化けた。
      thigh: crotchY > 0 ? ratio991(band991(crotchY + 1, crotchY + figH * 0.12, totalWidthAt991, 'p25')) : null,
      calf: ratio991(totalWidthAt991(figBottom - figH * 0.16)),
      ankle: ratio991(totalWidthAt991(figBottom - figH * 0.07)), // P1047: 足の広がり域より上で測り、足首と足を分ける
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
      const bandMode = (y0: number, y1: number): { key: string; name: string; rgb: [number, number, number] } | null => {
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
        return { key: bestKey, name: nearestExtraColor(best.r / best.n, best.g / best.n, best.b / best.n).name, rgb: [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)] };
      };
      const topBand = bandMode(Math.ceil(neckY), Math.floor(hipRef));
      const bottomBand = bandMode(Math.ceil(hipRef + figH * 0.08), figBottom);
      clothing = {
        bottom,
        twoPiece: topBand && bottomBand ? topBand.key !== bottomBand.key : null,
        topColor: topBand?.name ?? null,
        bottomColor: bottomBand?.name ?? null,
        topRgb: topBand?.rgb ?? null,
        bottomRgb: bottomBand?.rgb ?? null,
      };
      // P1025: 服そのものの色と、上下の分かれを読む。帯全体の
      // 最頻色は肌や髪に奪われるため、胴の内側の肌でない色を
      // 服として拾い、腹の帯が肌かどうかで分かれを判定する。
      {
        const skinLooseC = (r: number, g: number, b: number): boolean => r > 190 && g >= b && r - b >= 12;
        // 本人の肌色（頭の円内の肌の平均）を物差しに、肌を
        // 除外する。緩い肌判定だけだと強い赤のような服の色
        // まで肌に化けるため、肌色との距離と組み合わせる。
        let skinRef: [number, number, number] | null = null;
        {
          let sr = 0, sg = 0, sb = 0, sn = 0;
          const r0 = Math.max(1, headR);
          for (let y = Math.max(0, Math.round(headCy - r0)); y <= Math.min(height - 1, Math.round(headCy + r0)); y++) {
            for (let x = Math.max(0, Math.round(headCx - r0)); x <= Math.min(width - 1, Math.round(headCx + r0)); x++) {
              if ((x - headCx) ** 2 + (y - headCy) ** 2 > r0 * r0) continue;
              const i = (y * width + x) * 4;
              if (skinLooseC(rgba[i], rgba[i + 1], rgba[i + 2])) { sr += rgba[i]; sg += rgba[i + 1]; sb += rgba[i + 2]; sn++; }
            }
          }
          if (sn >= 10) skinRef = [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
        }
        const isSkinForGarment = (r: number, g: number, b: number): boolean => {
          if (!skinRef) return skinLooseC(r, g, b);
          const d = Math.abs(r - skinRef[0]) + Math.abs(g - skinRef[1]) + Math.abs(b - skinRef[2]);
          return d <= 25 || (d <= 60 && skinLooseC(r, g, b));
        };
        const containingSpan = (y: number): { minX: number; maxX: number } | null => {
          const s = rows[y]?.spans;
          if (!s) return null;
          for (const sp of s) if (headCx >= sp.minX && headCx <= sp.maxX) return sp;
          return null;
        };
        // 横の範囲はプロファイルの幅で絞る（後ろ髪まで含めた
        //  run で測ると、腹の肌率が髪に薄まるため）。
        const bandRange = (y: number, halfW: number): { x0: number; x1: number } | null => {
          const sp = containingSpan(y);
          if (!sp) return null;
          return { x0: Math.max(sp.minX, Math.round(headCx - halfW)), x1: Math.min(sp.maxX, Math.round(headCx + halfW)) };
        };
        const garmentBand = (y0: number, y1: number, halfW: number): { rgb: [number, number, number]; name: string; share: number } | null => {
          const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
          let counted = 0;
          for (let y = Math.max(0, Math.round(y0)); y <= Math.min(height - 1, Math.round(y1)); y++) {
            // P1065: 横の範囲は行の全スパンの合併で取る。
            // 中心を含むスパンだけだと、脚の行（中心が脚の
            // 間の空きに落ちる）が丸ごと抜けて、下の服の
            // 色見本が胴の行だけになって上の色に化けていた。
            const sps = rows[y]?.spans;
            if (!sps || !sps.length) continue;
            const rg = { x0: Math.max(Math.min(...sps.map((sp) => sp.minX)), Math.round(headCx - halfW)), x1: Math.min(Math.max(...sps.map((sp) => sp.maxX)), Math.round(headCx + halfW)) };
            if (rg.x1 < rg.x0) continue;
            for (let x = rg.x0; x <= rg.x1; x++) {
              if (!mask[y * width + x]) continue;
              const i = (y * width + x) * 4;
              if (isSkinForGarment(rgba[i], rgba[i + 1], rgba[i + 2])) continue;
              const k = `${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}`;
              const cur = counts.get(k) || { n: 0, r: 0, g: 0, b: 0 };
              cur.n++; cur.r += rgba[i]; cur.g += rgba[i + 1]; cur.b += rgba[i + 2];
              counts.set(k, cur);
              counted++;
            }
          }
          if (counted < 12) return null;
          let best: { n: number; r: number; g: number; b: number } | null = null;
          for (const v of counts.values()) if (!best || v.n > best.n) best = v;
          if (!best) return null;
          const rgb: [number, number, number] = [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
          return { rgb, name: nearestExtraColor(rgb[0], rgb[1], rgb[2]).name, share: best.n / counted };
        };
        const skinShareBand = (y0: number, y1: number, halfW: number): number | null => {
          let skin = 0;
          let total = 0;
          for (let y = Math.max(0, Math.round(y0)); y <= Math.min(height - 1, Math.round(y1)); y++) {
            const rg = bandRange(y, halfW);
            if (!rg) continue;
            for (let x = rg.x0; x <= rg.x1; x++) {
              if (!mask[y * width + x]) continue;
              const i = (y * width + x) * 4;
              total++;
              if (isSkinForGarment(rgba[i], rgba[i + 1], rgba[i + 2])) skin++;
            }
          }
          return total >= 12 ? skin / total : null;
        };
        const halfOf = (v: number | null, fb: number): number => ((v ?? fb) * figH * 0.5) * 1.35;
        const topGarment = garmentBand(neckY + figH * 0.05, neckY + figH * 0.30, halfOf(bodyProfile.chest ?? bodyProfile.shoulder, 0.15));
        // P1065: 下の服の色見本は、実測の腰の線（hipY）の
        // すぐ下で取る。下の服は腰・股を覆う服であり、帯を
        // 上に広げると上の服の広い胴に、下に広げると肌の脚
        // に票を奪われる。境界が腰にあるズボンでも、腰より
        // 上に本体がある分離型の下側でも、腰の直下は下の服。
        const bottomGarment = garmentBand(hipY - figH * 0.02, hipY + figH * 0.10, halfOf(bodyProfile.hip, 0.15));
        if (topGarment && topGarment.share >= 0.2) { clothing.topRgb = topGarment.rgb; clothing.topColor = topGarment.name; }
        if (bottomGarment && bottomGarment.share >= 0.2) { clothing.bottomRgb = bottomGarment.rgb; clothing.bottomColor = bottomGarment.name; }
        // 分かれの判定は割合の固定帯でなく、胴の中心を上から
        // 下へ走査して「服→肌（2行以上）→服」の並びで見る
        // （体の比率が違う図でも同じ物差しで測れるように）。
        {
          const stripHalf = halfOf(bodyProfile.waist, 0.1) * 0.55;
          let phase = 0; // 0=上の服を探す 1=肌の帯を探す 2=下の服を探す
          let skinRun = 0;
          for (let y = Math.round(neckY + figH * 0.06); y <= Math.round(hipRef + figH * 0.10); y++) {
            const sh = skinShareBand(y, y, stripHalf);
            if (sh === null) continue;
            const isGarment = sh <= 0.5;
            const isSkin = sh >= 0.7;
            if (phase === 0 && isGarment) phase = 1;
            else if (phase === 1 && isSkin) { skinRun++; if (skinRun >= 2) phase = 2; }
            else if (phase === 1 && isGarment) skinRun = 0;
            else if (phase === 2 && isGarment) break;
          }
          clothing.separated = phase === 2 && topGarment !== null && bottomGarment !== null;
        }
      }
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
      // P1026: 上下に分かれた服が読めているなら、それは服を
      // 着ている証拠。水着のように肌の多い服を裸と取り違え
      // ない（肌率だけの判定と服の検出が矛盾した時の優先順位）。
      if (clothing.separated === true) bare = false;
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
      const lum966 = (i: number) => 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      // P1032: 帯の基準は首元でなく胴の上端（shoulderY）。
      // 頭の検出位置がずれると、帯が頭の上に乗ってしまうため。
      const by0 = Math.round(shoulderY - figH * 0.02);
      const by1 = Math.round(shoulderY + figH * 0.13);
      const bx0 = Math.round(headCx - figW * 0.34);
      const bx1 = Math.round(headCx + figW * 0.34);
      // P1032: 肌の判定は厳しい側で測り、肌が取れなければ
      // 緩い側で測り直す（薄い肌の人は厳しい側では肌として
      // 数えられず、鎖骨以前に測定が始まらなかった）。
      const measureWith966 = (isSkinPx966: (i: number) => boolean): boolean | null => {
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
        return !!(baseline > 0 && dipL && dipR && dipL.v <= baseline * 0.9 && dipR.v <= baseline * 0.9 && Math.abs(dipL.y - dipR.y) <= Math.max(2, figH * 0.05));
      }
      return null;
      };
      const strict966 = (i: number) => {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        return r > 170 && g > 110 && g < 220 && b > 70 && b < 195 && r > g && g >= b - 5 && r - b > 35;
      };
      const loose966 = (i: number) => {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        return r > 190 && g >= b && r - b >= 12;
      };
      collarbone = measureWith966(strict966);
      if (collarbone === null) collarbone = measureWith966(loose966);
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
    // P1038: 首の長さ。頭の下から、胴が頭の幅近くまで
    // 張り出す行までの距離（髪で隠れていれば0に近い）。
    let neckLength: number | null = null;
    {
      const spanAt1038 = (y: number) => rows[y]?.spans.find((s) => headCx >= s.minX && headCx <= s.maxX);
      let headW = 0;
      for (let y = figTop; y < Math.min(height, Math.floor(neckY)); y++) {
        const s = spanAt1038(y);
        if (s) headW = Math.max(headW, s.maxX - s.minX + 1);
      }
      if (headW >= 4) {
        let len = 0;
        for (let y = Math.max(0, Math.floor(neckY)); y < Math.min(height, neckY + figH * 0.2); y++) {
          const s = spanAt1038(y);
          if (s && s.maxX - s.minX + 1 >= headW * 0.85) break;
          len++;
        }
        neckLength = Math.round((len / Math.max(1, figH)) * 1000) / 1000;
        // P1051: 輪郭では髪が首の両脇を埋めて長さ0になる時、
        // 肌の列で測り直す。首は「頭の下で一番細い肌の帯」で、
        // 顎や胸の広い肌とは幅で区別できる（髪は肌色の判定に
        // 入らないため、両脇の髪に邪魔されない）。
        if (neckLength <= 0.01) {
          const isSkinPx = (x: number, y: number): boolean => {
            const i = (y * width + x) * 4;
            const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
            return r > 190 && g >= b && r - b >= 12;
          };
          const skinW: Array<number | null> = [];
          const yEnd = Math.min(height - 1, Math.floor(neckY + figH * 0.25));
          for (let y = Math.max(0, Math.floor(neckY)); y <= yEnd; y++) {
            // 中心から左右へ連続する肌だけを数える（髪を挟んだ
            // 腕や肩の肌まで幅に入れないため）。
            const cxp = Math.round(headCx);
            if (!isSkinPx(cxp, y)) { skinW.push(null); continue; }
            let lo = cxp, hi = cxp;
            while (lo > 0 && isSkinPx(lo - 1, y)) lo--;
            while (hi < width - 1 && isSkinPx(hi + 1, y)) hi++;
            skinW.push(hi - lo + 1);
          }
          // 首の帯は、頭の下の最初の肌の幅を基準に、緩やかに
          // 広がる間だけ数える（顎から首、肩へとなだらかに
          // つながるため、「一番細い行」を探す方式では取れない）。
          const w0 = skinW.find((w) => w !== null) ?? null;
          if (w0 !== null && w0 <= headW * 0.55) {
            const thresh = w0 * 1.45 + 2;
            let n = 0;
            for (const w of skinW) {
              if (w === null || w > thresh) break;
              n++;
            }
            const skinLen = n / Math.max(1, figH);
            if (skinLen >= 0.02) neckLength = Math.round(skinLen * 1000) / 1000;
          }
        }
      }
    }
    const neckDescription = [neck === true ? '首のくびれが見える' : '', neckLength !== null && neckLength >= 0.06 ? '首が長めに見える' : neckLength !== null && neckLength <= 0.015 ? '首が短めに見える' : ''].filter(Boolean).join('、');

    // P958: 髪の色。頭の範囲で、肌色でない前景の最頻色。
    let hairColor: string | null = null;
    let hairBinKey: string | null = null;
    // P1008: 髪の一族（影色・ツヤ色の変種を束ねた集合）と基準色。
    // 長さ・形・作画読みで共有する。
    let hairFamKeys: Set<string> | null = null;
    let hairBaseAvg: [number, number, number] | null = null;
    {
      const groups = new Map<string, { n: number; r: number; g: number; b: number }>();
      const hr = headR * 1.25;
      for (let y = Math.max(0, Math.floor(headCy - hr)); y <= Math.min(height - 1, Math.ceil(headCy + hr)); y++) {
        for (let x = Math.max(0, Math.floor(headCx - hr)); x <= Math.min(width - 1, Math.ceil(headCx + hr)); x++) {
          if ((x - headCx) ** 2 + (y - headCy) ** 2 > hr * hr) continue;
          // P1065: 色見本は頭の上半分だけ。円の下半分には
          // 顔の暗い部品や首が入り、作画した頭では首の色の
          // 一族が髪の一族より大きくなって地の色を奪った。
          if (y > headCy + headR * 0.15) continue;
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
      hairBinKey = bestH && bestH.n >= 10 ? bestHKey : null;
      if (bestH && bestH.n >= 10) {
        // P1008: 基準色は最頻ビンとは限らない（影色が最頻になる
        // ことがある）。ただし明るさだけで選ぶと頭の縁に入った服や
        // 首の色を拾う。候補の中で「その影色・ツヤ色まで含めた
        // 一族の総量」が一番大きいものを地の色とする（地の色は
        // 変種まで含めて一番多くを説明できる）。
        const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
        const distC = (a: [number, number, number], c: [number, number, number]) => Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]);
        let base: { n: number; r: number; g: number; b: number } | null = null;
        let baseScore = -1;
        for (const v of groups.values()) {
          if (v.n < Math.max(10, bestH.n * 0.25)) continue;
          const cAvg: [number, number, number] = [v.r / v.n, v.g / v.n, v.b / v.n];
          const cShadow = deriveShadow(cAvg);
          const cShine: [number, number, number] = [cAvg[0] + (255 - cAvg[0]) * 0.45, cAvg[1] + (255 - cAvg[1]) * 0.45, cAvg[2] + (255 - cAvg[2]) * 0.45];
          let score = 0;
          for (const w of groups.values()) {
            const wAvg: [number, number, number] = [w.r / w.n, w.g / w.n, w.b / w.n];
            if (distC(wAvg, cAvg) <= 60 || distC(wAvg, cShadow) <= 60 || distC(wAvg, cShine) <= 60) score += w.n;
          }
          if (score > baseScore || (score === baseScore && base && lum(v.r / v.n, v.g / v.n, v.b / v.n) > lum(base.r / base.n, base.g / base.n, base.b / base.n))) { base = v; baseScore = score; }
        }
        const bAvg: [number, number, number] = base ? [base.r / base.n, base.g / base.n, base.b / base.n] : [bestH.r / bestH.n, bestH.g / bestH.n, bestH.b / bestH.n];
        hairBaseAvg = bAvg;
        hairColor = nearestExtraColor(bAvg[0], bAvg[1], bAvg[2]).name;
        // 一族＝地の色・影色・ツヤ色の近くにあるビン全部
        const shadow = deriveShadow(bAvg);
        const shine: [number, number, number] = [bAvg[0] + (255 - bAvg[0]) * 0.45, bAvg[1] + (255 - bAvg[1]) * 0.45, bAvg[2] + (255 - bAvg[2]) * 0.45];
        const nearC = (a: [number, number, number], c: [number, number, number]) => Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]) <= 60;
        const fam = new Set<string>();
        for (const [k, v] of groups) {
          const a: [number, number, number] = [v.r / v.n, v.g / v.n, v.b / v.n];
          if (nearC(a, bAvg) || nearC(a, shadow) || nearC(a, shine)) fam.add(k);
        }
        // ツヤ色は背景とビンが重なってマスクに入らず、グループが
        // できないことがある。色から直接ビンを作って一族に足す。
        const keyOf = (c: [number, number, number]) => `${Math.round(c[0]) >> 6},${Math.round(c[1]) >> 6},${Math.round(c[2]) >> 6}`;
        fam.add(keyOf(bAvg));
        fam.add(keyOf(shadow));
        fam.add(keyOf(shine));
        hairFamKeys = fam;
      }
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
          const bk = `${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}`;
          if (hairFamKeys ? hairFamKeys.has(bk) : bk === hairBinKey) cnt++;
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
    // P1007: 髪の作画の読み取り。描けるようになったツヤの帯と
    // 房の分かれを、読む側でも測る。髪色の平均を基準に、
    // 明るい画素＝ツヤ、暗い画素の縦の連なり＝房の境目とする。
    if (hair && hairBinKey && hairBaseAvg && hairFamKeys) {
      // P1008: 基準色と一族は髪色の段で決めたものを共有する。
      const baseR = hairBaseAvg[0], baseG = hairBaseAvg[1], baseB = hairBaseAvg[2];
      const famKeys = hairFamKeys;
      {
        const baseLum = 0.3 * baseR + 0.59 * baseG + 0.11 * baseB;
        const bandHalf = headR * 2.4;
        const x0 = Math.max(0, Math.floor(headCx - bandHalf)), x1 = Math.min(width - 1, Math.ceil(headCx + bandHalf));
        const yTop = Math.max(0, figTop), yBot = Math.min(height - 1, Math.round(headCy + headR * 2.2));
        // ツヤ色は背景と色ビンが重なるためマスクに入らないことが
        // ある。その行の輪郭の内側にあるかで代用する（内側にある
        // 一族の色は髪とみなす）。
        const rowMin = new Map<number, number>();
        const rowMax = new Map<number, number>();
        for (let y = yTop; y <= yBot; y++) {
          for (let x = x0; x <= x1; x++) {
            if (!mask[y * width + x]) continue;
            if (!rowMin.has(y)) rowMin.set(y, x);
            rowMax.set(y, x);
          }
        }
        const isHairFam = (x: number, y: number): boolean => {
          const lo = rowMin.get(y), hi = rowMax.get(y);
          if (lo === undefined || hi === undefined || x < lo || x > hi) return false;
          const i = (y * width + x) * 4;
          return famKeys.has(`${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}`);
        };
        const lumAt = (x: number, y: number): number => { const i = (y * width + x) * 4; return 0.3 * rgba[i] + 0.59 * rgba[i + 1] + 0.11 * rgba[i + 2]; };
        // ツヤ：髪の上部1割強の帯で、基準より明るい髪画素の割合
        const shineBandBot = Math.min(yBot, Math.round(figTop + figH * 0.14));
        let topHair = 0, topShine = 0;
        for (let y = yTop; y <= shineBandBot; y++) {
          for (let x = x0; x <= x1; x++) {
            if (!isHairFam(x, y)) continue;
            topHair++;
            if (lumAt(x, y) >= baseLum + 28) topShine++;
          }
        }
        if (topHair >= 20) hair.shine = topShine / topHair >= 0.08 ? true : topShine / topHair < 0.03 ? false : null;
        // 房：暗い画素が縦に連なる細い列の群＝房の境目。
        // セル陰影のような幅広い影は境目に数えない（群の幅で区別）。
        // P1065: 行ごとに影のランを数え、3行以上現れる最大の本数を
        // 境目の数とする。列ごとに数えると、パネルの影の帯が肩で
        // 折れ曲がるため1本の帯が2本の列ランに割れて見える（平らな
        // 髪で4本＝房5と誤読した）。行ごとの数え方では斜めの帯も
        // 1行に1本のまま数えられる。両側に髪があるかでの選別は
        // 斜めの帯の内側の分岐（63-66列）を通してしまったため廃止。
        if (x1 - x0 >= 8 && yBot - yTop >= 8) {
          const maxSepW = Math.max(2, (x1 - x0) * 0.12);
          const runSupport = new Map<number, number>();
          const wIn = Math.max(2, Math.ceil(maxSepW));
          for (let y = yTop; y <= yBot; y++) {
            let cur = 0, curStart = -1, hasHair = false;
            const spans: Array<[number, number]> = [];
            for (let x = x0; x <= x1; x++) {
              if (!isHairFam(x, y)) { if (cur > 0) { spans.push([curStart, x - 1]); cur = 0; } continue; }
              hasHair = true;
              if (lumAt(x, y) <= baseLum - 22) { if (cur === 0) curStart = x; cur++; }
              else if (cur > 0) { spans.push([curStart, x - 1]); cur = 0; }
            }
            if (cur > 0) spans.push([curStart, x1]);
            // P1068: 房の境目は「両側に髪がある」線だけを数える。
            // パネルの内側の縁に描かれた線（片側は肌や体）は
            // 中の線であって房の分かれではないのに、影色の
            // ランとして数えられ、平らな髪が房ありに化けた。
            let runs = 0;
            for (const [sx, ex] of spans) {
              if (ex - sx + 1 > maxSepW) continue;
              let leftHair = false, rightHair = false;
              for (let x = Math.max(x0, sx - wIn); x < sx; x++) if (isHairFam(x, y)) { leftHair = true; break; }
              for (let x = ex + 1; x <= Math.min(x1, ex + wIn); x++) if (isHairFam(x, y)) { rightHair = true; break; }
              if (leftHair && rightHair) runs++;
            }
            if (hasHair) runSupport.set(runs, (runSupport.get(runs) ?? 0) + 1);
          }
          let boundaries = 0;
          for (const [n, support] of runSupport) if (support >= 3 && n > boundaries) boundaries = n;
          // P1065: 房として数えるのは境目が3つ以上の時。
          // パネルの先細りで光と影の境界が斜めに横切ると、
          // 影の多い列が左右に1つずつだけできて「房3つ」に
          // 化ける。描かれた房の線は頭の幅いっぱいに何本も
          // 入るので、本数で区別できる。
          if (boundaries >= 3) hair.clumps = Math.min(8, boundaries + 1);
        }
      }
    }
    const hairDescription = hair
      ? (hair.length === 'short' ? '髪は短い' : hair.length === 'medium' ? '髪は肩くらいまである' : '髪は長く垂れている')
        + (hair.shine === true ? '。髪にツヤの帯がある' : '')
        + (hair.clumps ? `。髪は${hair.clumps}房ほどに分かれている` : '')
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
          const bk2 = `${rgba[i] >> 6},${rgba[i + 1] >> 6},${rgba[i + 2] >> 6}`;
          if (hairFamKeys ? hairFamKeys.has(bk2) : bk2 === hairBinKey) bottom = y;
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

    // P1011: 向きと幅の種別。後ろ向きは、頭の円の中に顔の肌が
    // 見えないことで分かる（肌の判定は薄い肌色でも通る緩い方を
    // 使う。通常の肌色判定では全身サンプルの薄い肌が通らず、
    // 正面を後ろ向きと誤るため）。横向きは、脚が重なって
    // 分かれず、胴の脇の帯の片側に腕の出っ張りが無いことで
    // 正面（脚そろえ・スカート）と区別する。横向きで測った幅は
    // 体の奥行きなので、種別を分けて正面の幅と混ぜない。
    let viewpoint: 'front' | 'side' | 'back' | null = null;
    if (posture === 'STANDING' && !figTruncated) {
      let skinN = 0;
      let totN = 0;
      for (let y = Math.max(0, Math.floor(headCy - headR)); y <= Math.min(height - 1, Math.ceil(headCy + headR)); y++) {
        for (let x = Math.max(0, Math.floor(headCx - headR)); x <= Math.min(width - 1, Math.ceil(headCx + headR)); x++) {
          if ((x - headCx) ** 2 + (y - headCy) ** 2 > headR * headR) continue;
          totN++;
          const i = (y * width + x) * 4;
          const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
          if (r > 190 && g >= b && r - b >= 12) skinN++;
        }
      }
      const headSkinShare = totN > 0 ? skinN / totN : 0;
      if (headSkinShare < 0.05) viewpoint = 'back';
      else if (legs === 'TOGETHER' && clothing.bottom !== 'flare') {
        let bandL = 0;
        let bandR = 0;
        for (let y = Math.round(shoulderY); y <= Math.round(hipY); y++) {
          for (let x = 0; x < width; x++) {
            if (!mask[y * width + x]) continue;
            if (x < torsoLeft - 1) bandL++;
            else if (x > torsoRight + 1) bandR++;
          }
        }
        viewpoint = bandL === 0 || bandR === 0 ? 'side' : 'front';
      } else viewpoint = 'front';
    }
    const profileKind: 'width' | 'depth' = viewpoint === 'side' ? 'depth' : 'width';
    if (viewpoint === 'side') parts.push('横向きで、測った幅は体の奥行き');
    else if (viewpoint === 'back') parts.push('後ろ向き');
    const description = parts.join('。') + '。';

    const norm = (p: PosePoint | null): PosePoint | null =>
      (p ? { x: p.x / (width - 1), y: p.y / (height - 1) } : null);
    // P1049: 手が (0,0) の画素にある読みは番兵の漏れ（本物の
    // 手が画像の左上隅ちょうどにあることはない）。描く側で
    // 隅に手が描かれてしまうため、無いものとして落とす。
    const normHand = (p: PosePoint | null): PosePoint | null =>
      (p && p.x <= 0 && p.y <= 0 ? null : norm(p));
    // P1015: 本人の肌色の実測。頭の円の中で肌らしい画素を平均
    // する（緩い判定：薄い肌でも拾える。P1004/P1011と同じ物差し）。
    // 描くときに「その人の色」で描くための材料で、色名では
    // 潰れてしまう実測の色を持つ。
    let skinColor: [number, number, number] | null = null;
    {
      let sr = 0, sg = 0, sb = 0, sn = 0;
      const hr = Math.max(2, headR);
      for (let y = Math.max(0, Math.floor(headCy - hr)); y <= Math.min(height - 1, Math.ceil(headCy + hr)); y++) {
        for (let x = Math.max(0, Math.floor(headCx - hr)); x <= Math.min(width - 1, Math.ceil(headCx + hr)); x++) {
          if ((x - headCx) ** 2 + (y - headCy) ** 2 > hr * hr) continue;
          const i = (y * width + x) * 4;
          const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
          if (r > 190 && g >= b && r - b >= 12) { sr += r; sg += g; sb += b; sn++; }
        }
      }
      if (sn >= 10) skinColor = [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
    }
    // P1019: 胸のふくらみを読みに持たせる（胸と腰の幅の差から）。
    // 描く側の胸の軸は指定制だったため、読みが持たない限り
    // 誰の絵にも描かれなかった。
    let bust: number | null = profileComplete && bodyProfile.chest !== null && bodyProfile.waist !== null
      ? Math.max(0, Math.min(1, (bodyProfile.chest - bodyProfile.waist) / 0.07))
      : null;
    // P1052: 正面では胸は横幅にほとんど出ない（見本は胸が
    // あっても胸と腰の幅がほぼ同じで、幅ベースでは0に潰れた）。
    // 上下に分かれた服がある時は、上の服の帯の縦の広がりで
    // 読む：胸を覆う帯は、胸が大きいほど縦に広い。
    let bustBandCenter: number | null = null;
    if (clothing.topRgb && clothing.separated) {
      const topRgb = clothing.topRgb;
      const yFrom = Math.round(neckY + figH * 0.04);
      const yTo = Math.round(neckY + figH * 0.36);
      let first = -1, last = -1, count = 0;
      for (let y = yFrom; y <= yTo; y++) {
        const row = rows[y];
        if (!row) continue;
        const sp = row.spans.find((q) => headCx >= q.minX && headCx <= q.maxX);
        if (!sp) continue;
        // 服の画素は「服の色に近く、髪の色よりは服に近い」もの。
        // 幅で数える：カップは胴の幅いっぱいに広がるが、
        // 前に垂れた髪の房は細いので、帯とは区別できる。
        let gw = 0;
        for (let x = sp.minX; x <= sp.maxX; x++) {
          if (!mask[y * width + x]) continue;
          const i = (y * width + x) * 4;
          const dTop = Math.abs(rgba[i] - topRgb[0]) + Math.abs(rgba[i + 1] - topRgb[1]) + Math.abs(rgba[i + 2] - topRgb[2]);
          if (dTop > 60) continue;
          if (hairBaseAvg) {
            const dHair = Math.abs(rgba[i] - hairBaseAvg[0]) + Math.abs(rgba[i + 1] - hairBaseAvg[1]) + Math.abs(rgba[i + 2] - hairBaseAvg[2]);
            if (dTop >= dHair) continue;
          }
          gw++;
        }
        const torsoW = sp.maxX - sp.minX + 1;
        if (gw >= Math.max(6, torsoW * 0.4)) { if (first < 0) first = y; last = y; count++; }
      }
      if (first >= 0 && count >= 4 && last < yTo - 2) {
        const extent = (last - first + 1) / Math.max(1, figH);
        const bustG = Math.max(0, Math.min(1, (extent - 0.05) / 0.11));
        // 幅の読みと服の読みのうち、大きい方を採る（正面の
        // 胸はどちらか一方だけでは小さく読めやすいため）。
        if (bust === null || bustG > bust) {
          bust = Math.round(bustG * 1000) / 1000;
          bustBandCenter = (first + last) / 2;
        }
      }
    }
    // P1037: 胸の頂点の位置。胸の帯で胴の幅が最大になる行を
    // 3行平均で探し、胴の上端→腰の割合で持つ（MakeHumanの
    // 胸の位置の軸に相当）。
    let bustPeak: number | null = null;
    if (profileComplete && !figTruncated && bust !== null && bust > 0) {
      const hipRefY = neckY + figH * 0.45;
      const wAt = (y: number): number => {
        const row = rows[Math.max(0, Math.min(height - 1, Math.round(y)))];
        if (!row) return 0;
        for (const sp of row.spans) if (headCx >= sp.minX && headCx <= sp.maxX) return sp.maxX - sp.minX + 1;
        return 0;
      };
      let bestV = -1, bestT = 0.3;
      const yFrom = shoulderY + (hipRefY - shoulderY) * 0.05;
      const yTo = shoulderY + (hipRefY - shoulderY) * 0.55;
      for (let y = yFrom; y <= yTo; y++) {
        const v = (wAt(y - 1) + wAt(y) * 2 + wAt(y + 1)) / 4;
        if (v > bestV) { bestV = v; bestT = (y - shoulderY) / Math.max(1, hipRefY - shoulderY); }
      }
      if (bestV > 0) bustPeak = Math.round(bestT * 1000) / 1000;
      // P1052: 服の帯で読んだ時は、頂点も帯の中心に置く
      // （幅の最大行は腕や腰に引っ張られるため）。
      if (bustBandCenter !== null) {
        const hipRefY3 = neckY + figH * 0.45;
        bustPeak = Math.round(Math.max(0, Math.min(1, (bustBandCenter - shoulderY) / Math.max(1, hipRefY3 - shoulderY))) * 1000) / 1000;
      }
    }
    // P1039: 胸の張り。頂点の前後で幅の盛り上がりがどれだけ
    // 集中しているか（鋭い丸みは集中し、なだらかな丸みは
    // 広がる）。MakeHumanの張りの軸に相当。
    let bustFirm: number | null = null;
    if (bustPeak !== null && bodyProfile.waist !== null) {
      const hipRefY2 = neckY + figH * 0.45;
      const wAt2 = (y: number): number => {
        const row = rows[Math.max(0, Math.min(height - 1, Math.round(y)))];
        if (!row) return 0;
        for (const sp of row.spans) if (headCx >= sp.minX && headCx <= sp.maxX) return sp.maxX - sp.minX + 1;
        return 0;
      };
      // P1065: 張りの土台は下位四分位の腰で取る。張りは
      // 「細い胴の上にどれだけ盛り上がるか」の測定で、
      // 代表値の腰（waistQ）を使うと土台が盛り上がり側に
      // 寄って、なだらかな胸まで集中して見えた。
      const waistW = (band991(hipY - figH * 0.18, hipY - figH * 0.02, bridgedWidthAt991, 'p25') ?? bodyProfile.waist * figH);
      const exAt = (t: number): number => Math.max(0, wAt2(shoulderY + (hipRefY2 - shoulderY) * t) - waistW);
      const exPeak = exAt(bustPeak);
      if (exPeak > 0.5) {
        // P1065: 広がりは頂点の前後 ±0.2 を5点で平均して
        // 見る。両端の2点だけだと、頂点の行で腕と盛り上がり
        // がくっついて幅が跳ねる事故（頂点だけ腕込みの幅に
        // なる）に引っ張られ、緩やかな盛り上がりとの差が
        // 潰れる。平均なら盛り上がりの持続そのものを見る。
        const spread = (exAt(Math.max(0, bustPeak - 0.2)) + exAt(Math.max(0, bustPeak - 0.1)) + exPeak + exAt(Math.min(1, bustPeak + 0.1)) + exAt(Math.min(1, bustPeak + 0.2))) / 5 / exPeak;
        bustFirm = Math.round(Math.max(0, Math.min(1, 1.15 - spread)) * 1000) / 1000;
      }
    }
    // P1028: 肩の傾き。首のすぐ下の胴の幅と、少し下の幅の
    // 比で測る（水平に張る肩はすぐ全幅になり、なだらかな
    // 肩は少しずつ広がる）。髪が混ざらないよう、頭の中心を
    // 含む run（胴そのもの）の幅で見る。
    let shoulderSlope: number | null = null;
    if (profileComplete && !figTruncated) {
      const containingW = (y: number): number => {
        // P1065: 中心が髪や影の線で一瞬途切れる行がある
        // （胸の行で中心が隙間に落ちて幅0になり、傾きが
        // 読めなくなる）。前後2行以内で中心を含む行を探す。
        for (let d = 0; d <= 2; d++) {
          for (const yy of d === 0 ? [y] : [y - d, y + d]) {
            const row = rows[Math.max(0, Math.min(height - 1, Math.round(yy)))];
            if (!row) continue;
            for (const sp of row.spans) if (headCx >= sp.minX && headCx <= sp.maxX) return sp.maxX - sp.minX + 1;
          }
        }
        return 0;
      };
      // P1065: 窓の起点は首ではなく肩の行。首の付け根から
      // 測ると、首そのものの細さが傾きに混ざる（首が読める
      // ようになってから、水平な肩の描き直しで首の段差を
      // 傾きと誤るようになった）。
      const wNear = containingW(shoulderY + figH * 0.01);
      const wFar = containingW(shoulderY + figH * 0.08);
      if (wFar > 0 && wNear > 0) shoulderSlope = Math.round(Math.max(0, Math.min(1, 1 - wNear / wFar)) * 1000) / 1000;
    }
    // P1031: 装飾品の枠。頭の周り（顔の円の外）で、肌でも髪でも
    // ない色の塊を探す。耳の横の装置や髪飾りは、その人を
    // その人たらしめる手がかりなので、読みに持たせる。
    let accessories: PoseReading['accessories'] = null;
    {
      // 髪の代表色は頭頂の帯で取る（色名の代表色では本人の髪と
      // ずれるため）。帯には顔の上部（肌）も入るので、平均では
      // 髪色が肌に引っ張られる。P1070: 帯の中で一番多い色ビン
      // （髪が多数派）の平均を髪色とする。平均のままだと髪その
      // ものが「肌でも髪でもない色」と読め、髪の縁が装飾品に
      // 誤読された（P1031の図でも髪色の device が出ていた）。
      // 帯は頭の中心寄りの列だけに限る（耳横の飾り・装置や首元の
      // 服が帯に入ると、髪より多くなって髪色を奪うため。飾りは
      // 頭の中心から 0.7 半径より外にある）。
      const hairBins = new Map<number, { n: number; r: number; g: number; b: number }>();
      const hairBandX0 = Math.max(0, Math.floor(headCx - headR * 0.7));
      const hairBandX1 = Math.min(width - 1, Math.ceil(headCx + headR * 0.7));
      for (let y = Math.max(0, Math.round(figTop)); y <= Math.min(height - 1, Math.round(figTop + figH * 0.06)); y++) {
        for (let x = hairBandX0; x <= hairBandX1; x++) {
          if (!mask[y * width + x]) continue;
          const i = (y * width + x) * 4;
          const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
          let e = hairBins.get(key);
          if (!e) { e = { n: 0, r: 0, g: 0, b: 0 }; hairBins.set(key, e); }
          e.n++; e.r += rgba[i]; e.g += rgba[i + 1]; e.b += rgba[i + 2];
        }
      }
      let hairRef: [number, number, number] | null = null;
      {
        // P1070: 肌らしいビンを除く案はやめた。暖かい淡色の髪
        // （描き直しの髪色 [243,214,210] など）は肌の判定
        // （r>190・g>=b・r-b>=12）に当てはまってしまい、髪色が
        // 取れなくなった。帯は頭の中心寄り・頭頂だけに限ってある
        // ので、多数派は髪であり、肌が多数派になるのは髪が無い図
        // だけ（その場合は髪色＝肌色でも飾りは読める）ため、素直
        // に最頻ビンを髪色とする。
        let bestN = 0;
        for (const e of hairBins.values()) {
          if (e.n <= bestN) continue;
          bestN = e.n;
          hairRef = [e.r / e.n, e.g / e.n, e.b / e.n];
        }
        // P1070: 帯が狭く髪の色が影色に分かれる描き直しでは、最頻
        // ビンが10pxに届かず髪色が取れないことがある（淡色の描き
        // 直しの再読で実際に起きた）。5pxまで緩める。帯は中心寄
        // りに限ってあるので、5pxの最頻ビンが飾りや服になることは
        // ない。
        if (bestN < 5) hairRef = null;
      }
      const skinRefA = skinColor ?? [232, 190, 160];
      if (hairRef) {
        const cand = new Set<number>();
        // 範囲は耳の高さまで（首から下は肩や腕の服を拾うため）。
        // P1070: 0.9 だと首元の服の上端が入り、顔の縁にかかる
        // 飾りとくっついて1つの塊になり、色の2群分けの30%規則
        // で弾かれて飾りごと消えた。耳の高さは頭の中心から
        // 0.65 半径までで足りる（P1031 の装置は 0.36 半径）。
        const yEnd = Math.min(height - 1, Math.round(headCy + headR * 0.65));
        for (let y = Math.max(0, Math.round(figTop)); y <= yEnd; y++) {
          for (let x = 0; x < width; x++) {
            const p = y * width + x;
            if (!mask[p]) continue;
            const dx = x - headCx;
            const dy = y - headCy;
            if (Math.abs(dx) <= headR * 0.55 && dy > -headR * 0.5) continue; // 顔の内側は除く
            const i = p * 4;
            const dSkin = Math.abs(rgba[i] - skinRefA[0]) + Math.abs(rgba[i + 1] - skinRefA[1]) + Math.abs(rgba[i + 2] - skinRefA[2]);
            const dHair = Math.abs(rgba[i] - hairRef[0]) + Math.abs(rgba[i + 1] - hairRef[1]) + Math.abs(rgba[i + 2] - hairRef[2]);
            if (dSkin > 70 && dHair > 70) cand.add(p);
          }
        }
        const minSize = Math.max(6, Math.round(figH * width * 0.0008));
        const found: NonNullable<PoseReading['accessories']> = [];
        const seen = new Set<number>();
        for (const start of cand) {
          if (seen.has(start)) continue;
          const queue = [start];
          seen.add(start);
          const pts: number[] = [];
          while (queue.length) {
            const p = queue.pop() as number;
            pts.push(p);
            const px0 = p % width;
            const py0 = Math.floor(p / width);
            for (const [nx, ny] of [[px0 - 1, py0], [px0 + 1, py0], [px0, py0 - 1], [px0, py0 + 1]] as const) {
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const np = ny * width + nx;
              if (cand.has(np) && !seen.has(np)) { seen.add(np); queue.push(np); }
            }
          }
          if (pts.length < minSize) continue;
          // P1033: 塊の中で色が2群に分かれるなら分ける（耳の
          // 装置に桜の飾りがくっついて1つの塊になるため）。
          const emitAcc = (group: number[]) => {
            let sr = 0, sg = 0, sb = 0, sx = 0, sy = 0;
            for (const p of group) {
              const i = p * 4;
              sr += rgba[i]; sg += rgba[i + 1]; sb += rgba[i + 2];
              sx += p % width; sy += Math.floor(p / width);
            }
            const n = group.length;
            const rgb: [number, number, number] = [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
            // 分けた群も、平均色が肌・髪から離れていなければ
            // 装飾品ではない（髪の一部を切り出しただけ）。
            const dSkinG = Math.abs(rgb[0] - skinRefA[0]) + Math.abs(rgb[1] - skinRefA[1]) + Math.abs(rgb[2] - skinRefA[2]);
            const dHairG = Math.abs(rgb[0] - hairRef[0]) + Math.abs(rgb[1] - hairRef[1]) + Math.abs(rgb[2] - hairRef[2]);
            if (dSkinG <= 70 || dHairG <= 70) return;
            // 群の中の色のばらつきが大きいものは、髪などが
            // 混ざった塊なので装飾品として数えない。
            let dev = 0;
            for (const p of group) { const i = p * 4; dev += Math.abs(rgba[i] - rgb[0]) + Math.abs(rgba[i + 1] - rgb[1]) + Math.abs(rgba[i + 2] - rgb[2]); }
            if (dev / n > 45) return;
            // P1070: 細い線（描き直しの中の線など）は装飾品では
            // ない。外接矩形に対してまばらな塊は、線の集まりと
            // みなして数えない（花びらの丸の集まりは 0.5 以上。顔の縁に
            // かかる飾りは候補範囲で下半分が切れて 0.3 台になるため、
            // 0.3 まで緩める。線の集まりは 0.2 未満なので弾ける）。
            let gx0 = width, gx1 = -1, gy0 = height, gy1 = -1;
            for (const p of group) { const px = p % width, py = Math.floor(p / width); if (px < gx0) gx0 = px; if (px > gx1) gx1 = px; if (py < gy0) gy0 = py; if (py > gy1) gy1 = py; }
            if (n < 0.3 * (gx1 - gx0 + 1) * (gy1 - gy0 + 1)) return;
            const spread = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]);
            found.push({ side: sx / n < headCx ? 'l' : 'r', y: Math.round(((sy / n) / Math.max(1, height - 1)) * 1000) / 1000, rgb, kind: spread < 28 ? 'device' : 'ornament' });
          };
          const colOf = (p: number): [number, number, number] => { const i = p * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]]; };
          const dCol = (a: [number, number, number], b: [number, number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
          let seedA = colOf(pts[0]);
          let seedB = seedA;
          let bestD = -1;
          for (const p of pts) { const d = dCol(colOf(p), seedA); if (d > bestD) { bestD = d; seedB = colOf(p); } }
          if (bestD >= 70) {
            let gA: number[] = [], gB: number[] = [];
            for (let iter = 0; iter < 3; iter++) {
              gA = []; gB = [];
              for (const p of pts) (dCol(colOf(p), seedA) <= dCol(colOf(p), seedB) ? gA : gB).push(p);
              if (!gA.length || !gB.length) break;
              const avg = (g: number[]): [number, number, number] => { let r = 0, gg = 0, b = 0; for (const p of g) { const c = colOf(p); r += c[0]; gg += c[1]; b += c[2]; } return [r / g.length, gg / g.length, b / g.length]; };
              seedA = avg(gA); seedB = avg(gB);
            }
            // P1070: 分ける側の最小を30%から15%へ。描き直しの中の
            // 線が飾りにくっついたとき、線は飾りの2割ほどしか
            // なく、30%では分けられず飾りごと消えた（往復が通ら
            // なかった）。分けた後の細い線の群は、上のまばらさ
            // の検査で弾く。
            if (gA.length >= Math.max(5, pts.length * 0.15) && gB.length >= Math.max(5, pts.length * 0.15) && dCol(seedA, seedB) >= 70) {
              emitAcc(gA); emitAcc(gB);
              continue;
            }
          }
          emitAcc(pts);
        }
        // P1070: 桜の飾りの形での分離。淡色の髪では飾りの色が髪と
        // ほぼ同じ（色の差3）で、色では髪から分けられない。頭の高さ
        // の帯で、左右それぞれの輪郭の外端を上下になぞる。飾りは
        // 髪の輪郭から外へ張り出した膨らみなので、その行の外端が
        // 前後4行の中央値（滑らかな髪の輪郭）より1.5px以上外へ出た
        // 行を種にし、1px以上の行でつなげて run とする。頭の円から
        // の距離では、髪の中の飾りが頭の中心をずらして髪の縁その
        // ものを膨らみと誤読したため、輪郭の形だけを見る。房は下へ
        // 続くので膨らみの戻りが無く、頭頂の丸みは中央値に吸収され
        // て種にならない。色で見つかった飾り・装置と重なるものは
        // 重複として出さない。
        {
          const bandEnd = Math.round(headCy + headR);
          const edgeLo = Math.max(0, Math.round(figTop));
          const edgeHi = Math.min(height - 1, bandEnd + 4);
          const leftEdge = new Map<number, number>();
          const rightEdge = new Map<number, number>();
          for (let y = edgeLo; y <= edgeHi; y++) {
            let mn = -1, mx = -1;
            for (let x = 0; x < width; x++) if (mask[y * width + x]) { if (mn < 0) mn = x; mx = x; }
            if (mn >= 0) { leftEdge.set(y, mn); rightEdge.set(y, mx); }
          }
          const maxSpan = Math.max(4, Math.round(figH * 0.18));
          for (const [edges, dir] of [[leftEdge, -1], [rightEdge, 1]] as const) {
            const baseline = (y: number): number | null => {
              const vals: number[] = [];
              for (let d = -4; d <= 4; d++) {
                if (d >= -1 && d <= 1) continue;
                const v = edges.get(y + d);
                if (v !== undefined) vals.push(v);
              }
              if (vals.length < 3) return null;
              vals.sort((a, b) => a - b);
              return (vals[(vals.length - 1) >> 1] + vals[vals.length >> 1]) / 2;
            };
            const dent = (y: number): number | null => {
              const e = edges.get(y);
              const b = baseline(y);
              if (e === undefined || b === null) return null;
              return dir < 0 ? b - e : e - b;
            };
            const candRows: number[] = [];
            for (let y = edgeLo; y <= bandEnd; y++) {
              const d = dent(y);
              if (d !== null && d >= 1) candRows.push(y);
            }
            const runs: number[][] = [];
            for (const y of candRows) {
              if (runs.length && y === runs[runs.length - 1][runs[runs.length - 1].length - 1] + 1) runs[runs.length - 1].push(y);
              else runs.push([y]);
            }
            for (const run of runs) {
              if (run.length < 2 || run.length > maxSpan) continue;
              if (!run.some((y) => (dent(y) ?? 0) >= 1.5)) continue;
              let sr = 0, sg = 0, sb = 0, sx = 0, sy = 0, n = 0;
              for (const y of run) {
                const b = baseline(y);
                if (b === null) continue;
                for (let x = 0; x < width; x++) {
                  if (!mask[y * width + x]) continue;
                  if (dir < 0 ? x >= b : x <= b) continue;
                  const i = (y * width + x) * 4;
                  sr += rgba[i]; sg += rgba[i + 1]; sb += rgba[i + 2];
                  sx += x; sy += y; n++;
                }
              }
              if (n < minSize) continue;
              const cyN = Math.round(((sy / n) / Math.max(1, height - 1)) * 1000) / 1000;
              const side = sx / n < headCx ? 'l' : 'r';
              if (found.some((a) => a.side === side && Math.abs(a.y - cyN) <= 0.08)) continue;
              found.push({ side, y: cyN, rgb: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)], kind: 'ornament' });
            }
          }
        }
        found.sort((a, b) => a.side.localeCompare(b.side) || a.y - b.y);
        if (found.length) accessories = found.slice(0, 4);
      }
    }
    // P1054: 頭の範囲を顎で切り直す。仮説の頭は首の付け根
    // まで含むため、中心が下がり半径が大きく出る。顔の肌の
    // 幅は顎で一度細くなるので、その一番細い行を顎として、
    // 髪のてっぺんから顎までを頭とする（内部の測定の錨は
    // 変えず、読みに出す頭だけを直す）。
    let headOut = { x: headCx / (width - 1), y: headCy / (height - 1), r: headR / width };
    let headRhOut = Math.round((headR / Math.max(1, height - 1)) * 1000) / 1000;
    let bangsEdgeOut: Array<number | null> | null = null;
    {
      const isSkinPx = (x: number, y: number): boolean => {
        const i = (y * width + x) * 4;
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        return r > 190 && g >= b && r - b >= 12;
      };
      const cxp = Math.round(headCx);
      const skinRunW = (y: number): number => {
        if (y < 0 || y >= height || !isSkinPx(cxp, y)) return 0;
        let lo = cxp, hi = cxp;
        while (lo > 0 && isSkinPx(lo - 1, y)) lo--;
        while (hi < width - 1 && isSkinPx(hi + 1, y)) hi++;
        return hi - lo + 1;
      };
      let faceMax = 0;
      for (let y = figTop; y <= Math.min(height - 1, Math.round(headCy + headR * 0.5)); y++) faceMax = Math.max(faceMax, skinRunW(y));
      if (faceMax >= 5) {
        let chinRow = -1, chinW = Infinity;
        for (let y = Math.round(headCy + headR * 0.3); y <= Math.min(height - 1, Math.round(neckY) + 2); y++) {
          const w = skinRunW(y);
          if (w > 0 && w < chinW) { chinW = w; chinRow = y; }
        }
        if (chinRow > 0 && chinW <= faceMax * 0.62) {
          const newR = (chinRow - figTop) / 2;
          if (newR >= 3 && newR < headR * 1.05) {
            headOut = { x: headCx / (width - 1), y: ((figTop + chinRow) / 2) / (height - 1), r: newR / width };
            headRhOut = Math.round((newR / Math.max(1, height - 1)) * 1000) / 1000;
          }
        }
        // P1054: 前髪の下端。各列で上から走査し、髪（肌でない
        // 画素）があってから最初に肌になる行を、その列の
        // 下端とする。房の列では房の先が、房の間の列では
        // 生え際が、それぞれ下端になる。
        const edgeRows: Array<number | null> = [];
        let edgeHits = 0;
        for (let k = 0; k < 9; k++) {
          const x = Math.round(headCx + (k - 4) * headR * 0.18);
          let sawHair = false;
          let edgeY = -1;
          for (let y = figTop; y <= Math.min(height - 1, Math.round(neckY)); y++) {
            if (isSkinPx(x, y)) { if (sawHair) { edgeY = y; break; } }
            else if (mask[y * width + x]) sawHair = true;
          }
          if (edgeY > 0) { edgeRows.push(edgeY); edgeHits++; }
          else edgeRows.push(null);
        }
        if (edgeHits >= 5) {
          // 返す頭（顎で切り直した後の中心と半径）に合わせて
          // 相対位置へ直す。描く側は返した頭で描くため。
          const cyPx = headOut.y * (height - 1);
          const rPx = headRhOut * Math.max(1, height - 1);
          bangsEdgeOut = edgeRows.map((ey) => (ey === null ? null : Math.round(((ey - cyPx) / Math.max(1, rPx)) * 1000) / 1000));
        }
      }
    }
    return {
      head: headOut,
      headRh: headRhOut,
      bangsEdge: bangsEdgeOut,
      handL: normHand(armL.hand),
      handR: normHand(armR.hand),
      shoulderL: norm(joints.shoulderL),
      shoulderR: norm(joints.shoulderR),
      hipL: norm(joints.hipL),
      hipR: norm(joints.hipR),
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
      handSize,
      legKnee,
      clothing,
      clothingDescription,
      extras,
      extrasDescription,
      hairColor,
      skinColor,
      hairRgb: hairBaseAvg ? [Math.round(hairBaseAvg[0]), Math.round(hairBaseAvg[1]), Math.round(hairBaseAvg[2])] as [number, number, number] : null,
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
      neckLength,
      armLength,
      armLengthDescription,
      legLength,
      legLengthDescription,
      bodyProfile,
      bust,
      bustPeak,
      bustFirm,
      shoulderSlope,
      armGap,
      accessories,
      footFlare,
      silhouetteWidth: figH > 0 ? Math.round((figW / figH) * 100) / 100 : null,
      profileComplete,
      maskMethod,
      silhouetteDensity,
      truncated: figTruncated,
      viewpoint,
      profileKind,
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
