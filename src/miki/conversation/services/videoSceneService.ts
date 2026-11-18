import { storageService } from '../../../services/storageService';
import {
  analyzeImagePixels,
  type ImagePixelFeatures,
} from './conversationImageObservationService';
import { visualPatternService } from './visualPatternService';
import { visualScenePatternService } from './visualScenePatternService';
import { visualFigureService } from './visualFigureService';
import { selectMainObjectRegion } from './shapeRenderVerificationService';
import { motionPatternService, type MotionSample } from '../../selfAwareness/services/motionPatternService';

/**
 * P946: 動画理解・第3層の第1段「場面分解」。
 *
 * 映像そのものの理解への入口。フレーム列を彼女の物差し
 * （P923 の特徴量）で測り、隣り合うフレームの距離が大きく
 * 跳ねた所をカットとして場面に切り分ける。各場面には
 * 代表フレーム（場面内の他のフレームとの距離の合計が最小
 * のもの）を選び、目（P928/P929/P945）で同定を試み、
 * 字幕・ASR の区間と時刻で対応づける。
 *
 * これで「この場面では何が見えていて、何が話されていたか」
 * を並べて持てるようになる。画面の文字を読むのは次の段。
 *
 * P947: 第4段「動きの記述」。場面ごとに主対象（地でない最大の
 * 領域）の重心軌跡を取り、動作部品（P941）と照合する。覚えた
 * 動作に似ていればその名前で、無ければ測定の言葉（横揺れ・
 * 静止など）で記述する。軌跡の点が8つ未満の場面は記述しない。
 * 周期の読みには1周期あたり6点以上のサンプリングが要る
 * （粗いと不規則と読む——実測で確認した彼女の物差しの限界）。
 *
 * 守る線:
 * - カット判定は硬い切り替わりだけ（距離 >= 0.42）。
 *   ゆっくりした遷移は第1段では拾わない。
 * - 同定は見本がある物だけ。無い物は色と領域の記述まで。
 * - フレームの実抽出（動画要素からの取り込み）はアプリ側の
 *   仕事で、この部品はフレーム列を受け取る所までを持つ。
 */

const KEY = 'miki_video_scenes_v1';
const CUT_THRESHOLD = 0.42;

export interface VideoFrameInput {
  tMs: number;
  rgba: Uint8Array;
  width: number;
  height: number;
}

export interface VideoSubtitleSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface VideoScene {
  index: number;
  startMs: number;
  endMs: number;
  representativeTMs: number;
  dominantColors: string[];
  identifications: string[];
  subtitleText: string;
  /** P947: 場面内の主対象の動きの記述（軌跡が取れた場面だけ）。 */
  motionText?: string;
}

/** 特徴量どうしの距離（0..1）。色・領域・明るさ・エッジの合成。 */
export function frameFeatureDistance(a: ImagePixelFeatures, b: ImagePixelFeatures): number {
  const colorMap = (f: ImagePixelFeatures) => {
    const m = new Map<string, number>();
    for (const c of f.dominantColors) m.set(c.name, (m.get(c.name) || 0) + c.share);
    return m;
  };
  const histDistance = (x: Map<string, number>, y: Map<string, number>) => {
    let sum = 0;
    for (const k of new Set([...x.keys(), ...y.keys()])) sum += Math.abs((x.get(k) || 0) - (y.get(k) || 0));
    return Math.min(1, sum / 2);
  };
  const regionMap = (f: ImagePixelFeatures) => {
    const m = new Map<string, number>();
    for (const r of f.regions) m.set(r.colorName, (m.get(r.colorName) || 0) + r.share);
    return m;
  };
  const colorDist = histDistance(colorMap(a), colorMap(b));
  const regionDist = histDistance(regionMap(a), regionMap(b));
  const lumaDist = Math.min(1, Math.abs(a.meanLuma - b.meanLuma));
  const edgeDist = Math.min(1, Math.abs(a.edgeDensity - b.edgeDensity));
  return 0.35 * colorDist + 0.25 * regionDist + 0.2 * lumaDist + 0.2 * edgeDist;
}

class VideoSceneService {
  /** フレーム列を場面に切り分け、代表フレームの同定と字幕の対応づけを行う。 */
  public decompose(frames: VideoFrameInput[], segments: VideoSubtitleSegment[] = []): { scenes: VideoScene[]; cutsMs: number[] } {
    const sorted = [...(frames || [])].sort((x, y) => x.tMs - y.tMs);
    if (!sorted.length) return { scenes: [], cutsMs: [] };
    const features = sorted.map((f) => analyzeImagePixels(f.rgba, f.width, f.height));

    // カット位置（フレームのインデックス）を見つける。
    const cutAt: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      if (frameFeatureDistance(features[i - 1], features[i]) >= CUT_THRESHOLD) cutAt.push(i);
    }
    const bounds = [0, ...cutAt, sorted.length];
    const scenes: VideoScene[] = [];
    for (let s = 0; s + 1 < bounds.length; s++) {
      const from = bounds[s];
      const to = bounds[s + 1] - 1;
      // 代表フレーム: 場面内の他フレームとの距離合計が最小のもの。
      let rep = from;
      let repCost = Number.POSITIVE_INFINITY;
      for (let i = from; i <= to; i++) {
        let cost = 0;
        for (let j = from; j <= to; j++) {
          if (j !== i) cost += frameFeatureDistance(features[i], features[j]);
        }
        if (cost < repCost) { repCost = cost; rep = i; }
      }
      const startMs = sorted[from].tMs;
      const endMs = s + 2 < bounds.length ? sorted[bounds[s + 1]].tMs : sorted[to].tMs;
      const repFeatures = features[rep];
      const identifications: string[] = [];
      try {
        const figure = visualFigureService.identifyFigure(repFeatures);
        if (figure) identifications.push(figure.description);
        if (!identifications.length) {
          const sceneMatch = visualScenePatternService.matchScene(repFeatures);
          if (sceneMatch) identifications.push(`配置「${sceneMatch.name}」に似ている`);
        }
        if (!identifications.length) {
          const shapeMatch = visualPatternService.match(repFeatures);
          if (shapeMatch) identifications.push(`形「${shapeMatch.name}」に似ている`);
        }
      } catch { /* 同定できなくても場面は残す */ }
      const subtitleText = (segments || [])
        .filter((seg) => seg.endMs > startMs && seg.startMs < endMs)
        .map((seg) => seg.text.trim())
        .filter(Boolean)
        .join(' ');
      // P947: 場面内の主対象の重心軌跡を取り、動きを記述する。
      let motionText: string | undefined;
      try {
        const samples: MotionSample[] = [];
        for (let i = from; i <= to; i++) {
          const main = selectMainObjectRegion(features[i]);
          if (main) samples.push({ t: sorted[i].tMs, x: main.centroidX, y: main.centroidY });
        }
        if (samples.length >= 8) {
          const matched = motionPatternService.match(samples);
          const described = matched
            ? `動きは覚えた動作「${matched.name}」に似ている`
            : motionPatternService.describe(samples)?.replace(/。$/, '');
          if (described) motionText = described;
        }
      } catch { /* 軌跡が取れなくても場面は残す */ }
      scenes.push({
        index: s,
        startMs,
        endMs,
        representativeTMs: sorted[rep].tMs,
        dominantColors: repFeatures.dominantColors.slice(0, 3).map((c) => c.name),
        identifications,
        subtitleText,
        motionText,
      });
    }

    try {
      const state = this.loadState();
      state.runs += 1;
      state.scenesTotal += scenes.length;
      state.motionsTotal += scenes.filter((sc) => sc.motionText).length;
      state.lastSceneCount = scenes.length;
      storageService.setItem(KEY, JSON.stringify(state));
    } catch { /* 台帳は補助経路 */ }
    return { scenes, cutsMs: cutAt.map((i) => sorted[i].tMs) };
  }

  /** 場面の並びを文章にする（会話や日記の材料）。 */
  public describeScenes(scenes: VideoScene[]): string {
    if (!scenes.length) return '場面は切り分けられなかった。';
    const fmt = (ms: number) => {
      const sec = Math.floor(ms / 1000);
      return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    };
    return scenes.map((s) => {
      const parts = [`場面${s.index + 1}（${fmt(s.startMs)}–${fmt(s.endMs)}）: 主な色は${s.dominantColors.join('・') || '不明'}`];
      if (s.identifications.length) parts.push(s.identifications.join('。'));
      if (s.motionText) parts.push(s.motionText);
      if (s.subtitleText) parts.push(`字幕「${s.subtitleText}」`);
      return parts.join('。');
    }).join('\n');
  }

  private loadState(): { runs: number; scenesTotal: number; motionsTotal: number; lastSceneCount: number } {
    try {
      const parsed = JSON.parse(storageService.getItem(KEY) || '{}');
      return {
        runs: Number(parsed.runs || 0),
        scenesTotal: Number(parsed.scenesTotal || 0),
        motionsTotal: Number(parsed.motionsTotal || 0),
        lastSceneCount: Number(parsed.lastSceneCount || 0),
      };
    } catch {
      return { runs: 0, scenesTotal: 0, motionsTotal: 0, lastSceneCount: 0 };
    }
  }

  public summary(): { runs: number; scenesTotal: number; motionsTotal: number } {
    const state = this.loadState();
    return { runs: state.runs, scenesTotal: state.scenesTotal, motionsTotal: state.motionsTotal };
  }
}

export const videoSceneService = new VideoSceneService();
