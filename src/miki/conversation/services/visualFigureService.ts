import { storageService } from '../../../services/storageService';
import {
  analyzeImagePixels,
  type ImagePixelFeatures,
  type ImageRegionFeature,
} from './conversationImageObservationService';
import { visualScenePatternService } from './visualScenePatternService';

/**
 * P945: 目・第7段「人間の同定」。
 *
 * 物・人間への道筋（2026-11-18 合意）の最終段。人は1つの形では
 * なく「頭らしい丸い領域が上に、体らしい大きな領域が下に」
 * という配置と比率でできている、という仮説を彼女の物差しで
 * 検証する：
 *
 *   仮説：頭（丸に近い・小さい）が体の上にあり、左右のずれが
 *         小さく、頭の高さが全体の 8%〜32%。
 *   照合：その比率で人形を描き直し、自分の測定で同じ仮説が
 *         立つか確かめる（P927/P929 と同じ描き直しの門）。
 *   同定：仮説が立った場面は「人の形らしい配置」と呼ぶ。
 *         断定はしない——「らしい」までが彼女の正直さ。
 *
 * 立っている姿だけを扱う第1段。座る・横たわる姿は比率が
 * 変わるので、後の段で例から増やす。
 */

const KEY = 'miki_visual_figures_v1';
const MAX_FIGURES = 20;
const IDENTIFY_THRESHOLD = 0.62;
const HEAD_RATIO_MIN = 0.08;
const HEAD_RATIO_MAX = 0.32;

export interface FigureHypothesis {
  head: ImageRegionFeature;
  body: ImageRegionFeature;
  headRatio: number;
  score: number;
}

export interface FigureRecord {
  name: string;
  headRatio: number;
  score: number;
  at: number;
}

const top = (r: ImageRegionFeature) => r.centroidY - r.bboxHeight / 2;
const bottom = (r: ImageRegionFeature) => r.centroidY + r.bboxHeight / 2;

class VisualFigureService {
  /** 頭と体の配置仮説を立てる。立てなければ null。 */
  public hypothesizeFigure(features: ImagePixelFeatures): FigureHypothesis | null {
    const regions = features.regions.filter((r) => r.borderTouch < 0.9);
    let best: FigureHypothesis | null = null;
    for (const head of regions) {
      if (head.shape !== '丸に近い') continue;
      for (const body of regions) {
        if (body === head) continue;
        if (head.share >= body.share) continue;
        if (bottom(head) > top(body) + 0.04) continue; // 頭は体の上
        if (body.bboxHeight < body.bboxWidth * 0.8) continue; // 立っている体は縦長寄り
        const dx = Math.abs(head.centroidX - body.centroidX);
        if (dx > body.bboxWidth * 0.6 + 0.02) continue; // 左右のずれが小さい
        const figureHeight = bottom(body) - top(head);
        if (figureHeight <= 0) continue;
        const headRatio = head.bboxHeight / figureHeight;
        if (headRatio < HEAD_RATIO_MIN || headRatio > HEAD_RATIO_MAX) continue;
        const alignPart = 1 - Math.min(1, dx / (body.bboxWidth * 0.6 + 0.02));
        const ratioPart = 1 - Math.min(1, Math.abs(headRatio - 0.18) / 0.15);
        const score = Math.round((0.4 * head.circularity + 0.3 * alignPart + 0.3 * ratioPart) * 100) / 100;
        if (!best || score > best.score) best = { head, body, headRatio: Math.round(headRatio * 1000) / 1000, score };
      }
    }
    return best;
  }

  /** 比率どおりに人形を描く（照合用、48×48）。 */
  private renderFigure(headRatio: number): { rgba: Uint8Array; width: number; height: number } {
    const W = 48;
    const H = 48;
    const rgba = new Uint8Array(W * H * 4);
    const figTop = 0.12 * H;
    const figBottom = 0.88 * H;
    const figHeight = figBottom - figTop;
    const headH = Math.max(3, headRatio * figHeight);
    const headCx = W / 2;
    const headCy = figTop + headH / 2;
    const headR = headH / 2;
    const bodyHalfW = 0.18 * W;
    const bodyTop = figTop + headH + 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const inHead = (x - headCx) ** 2 + (y - headCy) ** 2 <= headR * headR;
        const inBody = Math.abs(x - headCx) <= bodyHalfW && y >= bodyTop && y <= figBottom;
        const v = inHead || inBody ? 30 : 240;
        rgba[i] = v;
        rgba[i + 1] = v;
        rgba[i + 2] = v;
        rgba[i + 3] = 255;
      }
    }
    return { rgba, width: W, height: H };
  }

  /** 仮説の比率で描き直し、自分の測定で同じ仮説が立つか確かめる。 */
  public verifyFigure(features: ImagePixelFeatures): boolean {
    const hypothesis = this.hypothesizeFigure(features);
    if (!hypothesis) return false;
    const rendered = this.renderFigure(hypothesis.headRatio);
    const renderedFeatures = analyzeImagePixels(rendered.rgba, rendered.width, rendered.height);
    const remeasured = this.hypothesizeFigure(renderedFeatures);
    if (!remeasured) return false;
    return Math.abs(remeasured.headRatio - hypothesis.headRatio) <= 0.08;
  }

  /** 人の形らしい配置があれば、その読みを返す。 */
  public identifyFigure(features: ImagePixelFeatures): { headRatio: number; score: number; description: string } | null {
    const hypothesis = this.hypothesizeFigure(features);
    if (!hypothesis || hypothesis.score < IDENTIFY_THRESHOLD) return null;
    return {
      headRatio: hypothesis.headRatio,
      score: hypothesis.score,
      description: `人の形らしい配置（頭らしい丸い領域が上に、体らしい大きな領域が下に。頭は全体の約${Math.round(hypothesis.headRatio * 100)}%）`,
    };
  }

  /**
   * 人の見本を登録する。仮説が立ち、比率の描き直し照合
   * （verifyFigure）を通ったときだけ残す。配置の見本（P929）
   * への登録も試みるが、小さい頭は P927 の形の門に画素の
   * 粗さで落ちることがあるため、そちらは通れば併せて残す
   * 扱いにして、人の登録そのものの門にはしない。
   */
  public registerFigureExample(name: string, features: ImagePixelFeatures): FigureRecord | null {
    const hypothesis = this.hypothesizeFigure(features);
    if (!hypothesis) return null;
    if (!this.verifyFigure(features)) return null;
    try { visualScenePatternService.registerScene(name, features); } catch { /* 配置台帳は併せ残し */ }
    const record: FigureRecord = {
      name,
      headRatio: hypothesis.headRatio,
      score: hypothesis.score,
      at: Date.now(),
    };
    const records = this.load().filter((r) => r.name !== name);
    records.push(record);
    try {
      storageService.setItem(KEY, JSON.stringify(records.slice(-MAX_FIGURES)));
    } catch { /* 保存できなくても登録の成否は返す */ }
    return record;
  }

  private load(): FigureRecord[] {
    try {
      const parsed = JSON.parse(storageService.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  public list(): FigureRecord[] {
    return this.load();
  }

  public summary(): { figures: number } {
    return { figures: this.load().length };
  }
}

export const visualFigureService = new VisualFigureService();
