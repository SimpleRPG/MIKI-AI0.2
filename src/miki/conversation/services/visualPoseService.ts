import { storageService } from '../../../services/storageService';
import {
  analyzeImagePixels,
  type ImagePixelFeatures,
} from './conversationImageObservationService';
import { visualFigureService } from './visualFigureService';

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
  private load(): { analyzed: number; verified: number } {
    try {
      const raw = storageService.getJson(KEY, null) as { analyzed?: number; verified?: number } | null;
      if (raw) return { analyzed: raw.analyzed || 0, verified: raw.verified || 0 };
    } catch { /* fall through */ }
    return { analyzed: 0, verified: 0 };
  }

  public summary(): { analyzed: number; verified: number } {
    return this.load();
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

    // 脚の分かれ（股）の開始行と、腰の位置。
    let crotchY = -1;
    for (let y = Math.floor(figTop + figH * 0.5); y <= figBottom; y++) {
      if (rows[y].spans.length >= 2) { crotchY = y; break; }
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
    const armL = armFor('L');
    const armR = armFor('R');
    if (posture === 'SITTING') { /* 座りでは脚は前に伸びる形として扱い、脚の記述は体勢に含める */ }

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
    const description = parts.join('。') + '。';

    const state = this.load();
    state.analyzed++;
    if (verified) state.verified++;
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
      verified,
      fit,
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
