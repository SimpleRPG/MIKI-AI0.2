/*
 * P466: 会話の「目」— 画像添付の観察と言葉化。
 *
 * 背景: チャットの添付UIから画像（data URL）は会話コアの入口まで
 * 届いていたが、コア側で一切読まれず捨てられていた。また視覚系の
 * 部品は、実画像をピクセル列にするデコーダが無く、特徴を言葉に
 * する層も無かった。本サービスはその2つ（網膜と言葉化）を担う。
 *
 * できること（決定論的・ローカル完結）:
 * - data URL をデコードし、小さく縮小してピクセル特徴を取る
 * - 主な色（日本語の色名）・明るさ・彩度・色の多さ・縦横比・透明度
 *   を観察文にする
 * - P923（目・第1段）: エッジ密度・ハイライトの鋭さと集中・模様の
 *   周期性・グラデーションの柔らかさを測り、素材パラメータの
 *   仮説（ツヤ・粗さ・繰り返し模様）まで立てる。仮説は印象として
 *   言葉にし、断定はしない。描いて照合する検証は後段の仕事。
 *
 * できないこと（正直に範囲を切る）:
 * - 物体や人物の同定、文字の読み取り（OCR）は手段が無いのでしない。
 *   観察文は「色・明暗・質感の印象」までに限定し、それ以上は
 *   分からないものとして扱う（identityRecognitionAllowed: false の
 *   既存の出所規律と一致）。
 */

export interface ImagePixelFeatures {
  width: number;
  height: number;
  aspect: '横長' | '縦長' | 'ほぼ正方形';
  meanLuma: number;
  meanSaturation: number;
  transparentRatio: number;
  distinctColorBins: number;
  dominantColors: Array<{ name: string; share: number }>;
  // P923（目・第1段）: 質感と模様の測定。設計メモの学習ループの
  // 「測定」にあたる層で、すべて決定論で測れる量だけを足す。
  edgeDensity: number;
  contrastSpread: number;
  highlightRatio: number;
  highlightConcentration: number;
  gradientSoftness: number;
  periodicity: { period: number; strength: number } | null;
}

/**
 * P923: 測定値からの素材パラメータの仮説。仮説は仮説として扱い、
 * 描いて照合する検証（後段）が通るまでは部品化しない。
 */
export interface MaterialHypothesis {
  gloss: 'ツヤが強そう' | 'ツヤは中くらい' | 'ツヤは弱そう';
  roughness: number;
  patternPeriod: number | null;
  softGradient: boolean;
}

export interface ImageObservation {
  text: string;
  features: ImagePixelFeatures;
  material: MaterialHypothesis;
  // P924: 仮説パラメータで描き直して照合した結果（任意）。
  // 型だけここに置き、実体は materialRenderVerificationService が作る
  // （循環参照を避けるため import type で参照する）。
  verification?: import('./materialRenderVerificationService').MaterialVerification;
}

const COLOR_NAMES: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: '赤', rgb: [200, 40, 40] },
  { name: '橙', rgb: [230, 130, 30] },
  { name: '黄', rgb: [230, 200, 40] },
  { name: '黄緑', rgb: [140, 200, 60] },
  { name: '緑', rgb: [40, 160, 70] },
  { name: '青', rgb: [40, 90, 210] },
  { name: '水色', rgb: [90, 180, 220] },
  { name: '紫', rgb: [130, 70, 180] },
  { name: '桃色', rgb: [235, 150, 180] },
  { name: '茶', rgb: [130, 85, 50] },
  { name: '白', rgb: [245, 245, 245] },
  { name: '灰色', rgb: [140, 140, 140] },
  { name: '黒', rgb: [20, 20, 20] },
  { name: '肌色', rgb: [240, 200, 165] },
];

function nearestColorName(r: number, g: number, b: number): string {
  let best = '灰色';
  let bestDistance = Infinity;
  for (const candidate of COLOR_NAMES) {
    const d =
      (r - candidate.rgb[0]) ** 2 + (g - candidate.rgb[1]) ** 2 + (b - candidate.rgb[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate.name;
    }
  }
  return best;
}

/** ピクセル列（RGBA）から特徴を計算する純粋関数。 */
export function analyzeImagePixels(
  rgba: Uint8Array | number[],
  width: number,
  height: number,
): ImagePixelFeatures {
  const pixelCount = width * height;
  let lumaSum = 0;
  let saturationSum = 0;
  let transparent = 0;
  const lumaGrid = new Float32Array(pixelCount).fill(-1);
  const bins = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixelCount; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    if (a < 128) {
      transparent++;
      continue;
    }
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lumaGrid[i] = luma;
    lumaSum += luma;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    saturationSum += max === 0 ? 0 : (max - min) / max;
    const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
    const bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bin.count++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  const visible = Math.max(1, pixelCount - transparent);
  const dominantColors = [...bins.values()]
    .sort((x, y) => y.count - x.count)
    .slice(0, 3)
    .map((bin) => ({
      name: nearestColorName(bin.r / bin.count, bin.g / bin.count, bin.b / bin.count),
      share: bin.count / visible,
    }))
    .filter((color, index, all) => all.findIndex((c) => c.name === color.name) === index);
  // P923: 輝度グリッドからの質感・模様の測定（透明セルは平均で埋める）。
  const meanLumaRaw = lumaSum / visible;
  for (let i = 0; i < pixelCount; i++) {
    if (lumaGrid[i] < 0) lumaGrid[i] = meanLumaRaw;
  }
  let varianceSum = 0;
  let highlightCount = 0;
  let highlightCoreCount = 0;
  let highlightBaseCount = 0;
  for (let i = 0; i < pixelCount; i++) {
    const l = lumaGrid[i];
    varianceSum += (l - meanLumaRaw) ** 2;
    if (l >= 235) highlightCount++;
    if (l >= 250) highlightCoreCount++;
    if (l >= 217) highlightBaseCount++;
  }
  const contrastSpread = Math.sqrt(varianceSum / pixelCount) / 255;
  const highlightRatio = highlightCount / pixelCount;
  const highlightConcentration = highlightBaseCount > 0 ? highlightCoreCount / highlightBaseCount : 0;
  let gradientSum = 0;
  let gradientCount = 0;
  let firstDiffSum = 0;
  let secondDiffSum = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = Math.abs(lumaGrid[i + 1] - lumaGrid[i - 1]);
      const gy = Math.abs(lumaGrid[i + width] - lumaGrid[i - width]);
      gradientSum += (gx + gy) / 2;
      gradientCount++;
      firstDiffSum += gx;
      secondDiffSum += Math.abs(lumaGrid[i + 1] - 2 * lumaGrid[i] + lumaGrid[i - 1]);
    }
  }
  const edgeDensity = gradientCount > 0 ? gradientSum / gradientCount / 255 : 0;
  const gradientSoftness = firstDiffSum > 0
    ? Math.max(0, Math.min(1, 1 - (secondDiffSum / firstDiffSum) * 0.5))
    : 1;
  const periodicity = detectPeriodicity(lumaGrid, width, height);

  return {
    width,
    height,
    aspect: width > height * 1.2 ? '横長' : height > width * 1.2 ? '縦長' : 'ほぼ正方形',
    meanLuma: lumaSum / visible / 255,
    meanSaturation: saturationSum / visible,
    transparentRatio: transparent / pixelCount,
    distinctColorBins: bins.size,
    dominantColors,
    edgeDensity,
    contrastSpread,
    highlightRatio,
    highlightConcentration,
    gradientSoftness,
    periodicity,
  };
}

/**
 * P923: 行・列方向の平均輝度プロファイルの自己相関から、繰り返し
 * 模様の周期を推定する。最も相関の高いラグが十分強ければ周期として
 * 返す（織り目・レンガ等の規則模様の検出）。
 */
function detectPeriodicity(
  lumaGrid: Float32Array,
  width: number,
  height: number,
): { period: number; strength: number } | null {
  const profile = (length: number, at: (i: number) => number): number[] => {
    const values: number[] = [];
    for (let i = 0; i < length; i++) values.push(at(i));
    return values;
  };
  const columnProfile = profile(width, (x) => {
    let sum = 0;
    for (let y = 0; y < height; y++) sum += lumaGrid[y * width + x];
    return sum / Math.max(1, height);
  });
  const rowProfile = profile(height, (y) => {
    let sum = 0;
    for (let x = 0; x < width; x++) sum += lumaGrid[y * width + x];
    return sum / Math.max(1, width);
  });
  let best: { period: number; strength: number } | null = null;
  for (const rawValues of [columnProfile, rowProfile]) {
    const n = rawValues.length;
    if (n < 8) continue;
    // P924: 大きな明暗のうねり（ハイライト等）が小さいラグの相関を
    // 持ち上げて周期を埋めるため、移動平均のトレンドを引いてから
    // 相関を取る。
    const values = rawValues.map((v, i) => {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, i - 6); k <= Math.min(n - 1, i + 6); k++) {
        sum += rawValues[k];
        count++;
      }
      return v - sum / Math.max(1, count);
    });
    const mean = values.reduce((a, b) => a + b, 0) / n;
    let denom = 0;
    for (const v of values) denom += (v - mean) ** 2;
    if (denom <= 0) continue;
    const maxLag = Math.min(16, Math.floor(n / 2));
    // ラグ2はデトレンド残差の揺れを拾いやすく、48px 級の縮小画像で
    // 1px 市松はノイズと区別できないため、周期は3以上を対象にする。
    // また、なめらかな明暗のうねりの残差は小さいラグほど相関が
    // 単調に高いため、「前のラグより明確に盛り上がったピーク」だけを
    // 周期とみなす（本物の繰り返しは半周期で相関が沈む）。
    const strengths: number[] = [0];
    for (let lag = 1; lag <= maxLag; lag++) {
      let num = 0;
      for (let i = 0; i + lag < n; i++) num += (values[i] - mean) * (values[i + lag] - mean);
      strengths.push(num / denom);
    }
    for (let lag = 3; lag <= maxLag; lag++) {
      const strength = strengths[lag];
      if (strength >= 0.5 && strength - strengths[lag - 1] >= 0.05
        && (!best || strength > best.strength)) {
        best = { period: lag, strength };
      }
    }
  }
  return best;
}

/** P923: 測定値から素材パラメータの仮説を立てる（決定論の規則）。 */
export function hypothesizeMaterial(features: ImagePixelFeatures): MaterialHypothesis {
  let gloss: MaterialHypothesis['gloss'];
  let roughness: number;
  if (features.highlightRatio >= 0.002 && features.highlightConcentration >= 0.3) {
    gloss = 'ツヤが強そう';
    roughness = 0.15;
  } else if (features.highlightRatio >= 0.0005 || features.highlightConcentration >= 0.15) {
    gloss = 'ツヤは中くらい';
    roughness = 0.45;
  } else {
    gloss = 'ツヤは弱そう';
    roughness = features.edgeDensity >= 0.12 ? 0.9 : 0.75;
  }
  return {
    gloss,
    roughness,
    patternPeriod: features.periodicity ? features.periodicity.period : null,
    softGradient: features.gradientSoftness >= 0.8 && features.edgeDensity < 0.08,
  };
}

/** 特徴を日本語の観察文にする（決定論的）。 */
export function verbalizeImageFeatures(features: ImagePixelFeatures): string {
  const brightness = features.meanLuma > 0.66 ? '明るい' : features.meanLuma < 0.33 ? '暗い' : '中くらいの明るさ';
  const vividness = features.meanSaturation > 0.45 ? '色は鮮やか' : features.meanSaturation < 0.18 ? '色は落ち着いている' : '色の鮮やかさは中くらい';
  const colorCount = features.distinctColorBins >= 40 ? '色数は多い' : features.distinctColorBins >= 12 ? '色数は中くらい' : '色数は少ない';
  const colors = features.dominantColors.length
    ? `主な色は${features.dominantColors.map((c) => `${c.name}（約${Math.round(c.share * 100)}%）`).join('、')}`
    : '主な色は読み取れなかった';
  const transparency = features.transparentRatio > 0.05 ? '、透明な部分がある' : '';
  // P923: 質感と模様の印象（測定からの仮説なので断定しない）。
  const material = hypothesizeMaterial(features);
  const pattern = material.patternPeriod !== null
    ? `。${material.patternPeriod <= 5 ? '細かい' : 'はっきりした'}繰り返し模様がありそう`
    : '';
  const gradient = material.softGradient ? '。色の移り変わりはなめらか' : '';
  return `画像の観察：${features.aspect}の画像。全体に${brightness}。${vividness}。${colorCount}。${colors}${transparency}。${material.gloss}${pattern}${gradient}。具体的な物や文字までは読み取れない。`;
}

class ConversationImageObservationService {
  /**
   * data URL の画像を観察する。デコード手段が無い環境や失敗時は
   * null を返し、会話は通常どおり続ける。
   */
  public async observe(dataUrl: string): Promise<ImageObservation | null> {
    try {
      const bitmap = await this.decode(dataUrl);
      if (!bitmap) return null;
      const { rgba, width, height } = bitmap;
      const features = analyzeImagePixels(rgba, width, height);
      // P924: 仮説で描き直して照合する（失敗しても観察自体は返す）。
      let verification: ImageObservation['verification'];
      try {
        const { verifyMaterialByRendering } = await import('./materialRenderVerificationService');
        verification = verifyMaterialByRendering(features);
      } catch { verification = undefined; }
      return { text: verbalizeImageFeatures(features), features, material: hypothesizeMaterial(features), verification };
    } catch {
      return null;
    }
  }

  private async decode(
    dataUrl: string,
  ): Promise<{ rgba: Uint8Array; width: number; height: number } | null> {
    const maxSide = 48;
    // createImageBitmap が使える環境ではそれを使う
    if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const bitmap = await createImageBitmap(blob);
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.drawImage(bitmap, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height);
        return { rgba: new Uint8Array(data.data), width, height };
      } catch { /* 次の手段へ */ }
    }
    // フォールバック: Image 要素経由
    if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('image load failed'));
          img.src = dataUrl;
        });
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.drawImage(image, 0, 0, width, height);
        const data = context.getImageData(0, 0, width, height);
        return { rgba: new Uint8Array(data.data), width, height };
      } catch { /* デコード不能 */ }
    }
    return null;
  }
}

export const conversationImageObservationService = new ConversationImageObservationService();
