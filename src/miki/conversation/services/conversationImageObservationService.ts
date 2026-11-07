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
 *
 * できないこと（正直に範囲を切る）:
 * - 物体や人物の同定、文字の読み取り（OCR）は手段が無いのでしない。
 *   観察文は「色・明暗・大まかな形」までに限定し、それ以上は
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
}

export interface ImageObservation {
  text: string;
  features: ImagePixelFeatures;
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
    lumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
  return {
    width,
    height,
    aspect: width > height * 1.2 ? '横長' : height > width * 1.2 ? '縦長' : 'ほぼ正方形',
    meanLuma: lumaSum / visible / 255,
    meanSaturation: saturationSum / visible,
    transparentRatio: transparent / pixelCount,
    distinctColorBins: bins.size,
    dominantColors,
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
  return `画像の観察：${features.aspect}の画像。全体に${brightness}。${vividness}。${colorCount}。${colors}${transparency}。具体的な物や文字までは読み取れない。`;
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
      return { text: verbalizeImageFeatures(features), features };
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
