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
 * - P926（目・第3段）: 色のつながりを領域に分け、位置・大きさ・
 *   丸さ・四角さ・細長さ・左右対称を測って観察文に含める。
 *   物の同定はまだしない（形の物差しを用意する段）。
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
  // P926（目・第3段）: 色の領域ごとの形の測定。
  regions: ImageRegionFeature[];
}

/**
 * P926: 色でつながった領域1つの形の測定値。位置・大きさ・
 * 丸さ・四角さ・細長さ・左右対称を数値で持ち、印象ラベルも付ける。
 * 物の同定はまだしない（形の物差しを用意する段）。
 */
export interface ImageRegionFeature {
  colorName: string;
  share: number;
  centroidX: number;
  centroidY: number;
  /** 外接矩形の幅・高さ（画像全体に対する 0..1）。P927 で描き直しに使う。 */
  bboxWidth: number;
  bboxHeight: number;
  /** 画像の縁に触れている割合（0..1）。1に近い領域は「地」の側。 */
  borderTouch: number;
  fillRatio: number;
  circularity: number;
  symmetry: number;
  elongation: number;
  shape: '丸に近い' | '四角に近い' | '細長い' | 'いびつな形';
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
  // P927: 形を描き直して照合した結果（任意）。
  shapeVerification?: import('./shapeRenderVerificationService').ShapeVerification;
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
  const binGrid = new Int32Array(pixelCount).fill(-1);
  const binIds = new Map<string, number>();
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
    let binId = binIds.get(key);
    if (binId === undefined) {
      binId = binIds.size;
      binIds.set(key, binId);
    }
    binGrid[i] = binId;
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
  // P948: 画素ノイズのある画像では、細かい色ビンのちらつきで
  // 同じ色の領域が粉々に割れ、領域として拾えなくなる。まず
  // 普通に測り、拾えた領域の合計が画面の97%に届かなければ
  // 「割れている」と判断して、粗いビン（64刻み）で測り直し、
  // より多く拾えた方を採る。色の分布の報告は細かいビンの
  // ままにする——そちらが正直な測定なので。
  let regions = measureRegions(binGrid, rgba, width, height);
  const coveredShare = (rs: ImageRegionFeature[]) => rs.reduce((a, r) => a + r.share, 0);
  if (coveredShare(regions) < 0.97) {
    const coarseGrid = new Int32Array(pixelCount).fill(-1);
    const coarseIds = new Map<string, number>();
    for (let i = 0; i < pixelCount; i++) {
      if (rgba[i * 4 + 3] < 128) continue;
      const key = `${Math.floor(rgba[i * 4] / 64)}-${Math.floor(rgba[i * 4 + 1] / 64)}-${Math.floor(rgba[i * 4 + 2] / 64)}`;
      let id = coarseIds.get(key);
      if (id === undefined) {
        id = coarseIds.size;
        coarseIds.set(key, id);
      }
      coarseGrid[i] = id;
    }
    const coarseRegions = measureRegions(coarseGrid, rgba, width, height);
    if (coveredShare(coarseRegions) > coveredShare(regions)) regions = coarseRegions;
  }

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
    regions,
  };
}

/**
 * P926: 同じ色ビンのつながりを領域として切り分け、形を測る。
 * 面積2%未満の小領域はノイズとして落とし、大きい順に最大5つ。
 */
function measureRegions(
  binGrid: Int32Array,
  rgba: Uint8Array | number[],
  width: number,
  height: number,
): ImageRegionFeature[] {
  const total = width * height;
  const visited = new Uint8Array(total);
  const regions: ImageRegionFeature[] = [];
  const stack: number[] = [];
  for (let start = 0; start < total; start++) {
    const bin = binGrid[start];
    if (bin < 0 || visited[start]) continue;
    const cells: number[] = [];
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      cells.push(cur);
      const cx = cur % width;
      const cy = Math.floor(cur / width);
      if (cx > 0 && !visited[cur - 1] && binGrid[cur - 1] === bin) { visited[cur - 1] = 1; stack.push(cur - 1); }
      if (cx < width - 1 && !visited[cur + 1] && binGrid[cur + 1] === bin) { visited[cur + 1] = 1; stack.push(cur + 1); }
      if (cy > 0 && !visited[cur - width] && binGrid[cur - width] === bin) { visited[cur - width] = 1; stack.push(cur - width); }
      if (cy < height - 1 && !visited[cur + width] && binGrid[cur + width] === bin) { visited[cur + width] = 1; stack.push(cur + width); }
    }
    const share = cells.length / total;
    if (share < 0.02) continue;
    const cellSet = new Set(cells);
    let sumX = 0;
    let sumY = 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let borderCells = 0;
    for (const c of cells) {
      const x = c % width;
      const y = Math.floor(c / width);
      sumX += x;
      sumY += y;
      rSum += rgba[c * 4];
      gSum += rgba[c * 4 + 1];
      bSum += rgba[c * 4 + 2];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) borderCells++;
    }
    const bboxW = maxX - minX + 1;
    const bboxH = maxY - minY + 1;
    const fillRatio = cells.length / (bboxW * bboxH);
    // 円形度は周長ベースだと格子の階段で歪むため、重心から最も
    // 遠い点までの距離（フェレ径の近似）で出す（P927 で差し替え）。
    const centroidCellX = sumX / cells.length;
    const centroidCellY = sumY / cells.length;
    let maxDistSq = 0;
    for (const c of cells) {
      const x = c % width;
      const y = Math.floor(c / width);
      const dSq = (x - centroidCellX) ** 2 + (y - centroidCellY) ** 2;
      if (dSq > maxDistSq) maxDistSq = dSq;
    }
    const circularity = Math.min(1, cells.length / Math.max(1, Math.PI * maxDistSq));
    const borderTouch = borderCells / Math.max(1, 2 * width + 2 * height - 4);
    let mirrorHit = 0;
    for (const c of cells) {
      const x = c % width;
      const y = Math.floor(c / width);
      const mx = minX + (maxX - x);
      if (cellSet.has(y * width + mx)) mirrorHit++;
    }
    const elongation = Math.max(bboxW, bboxH) / Math.max(1, Math.min(bboxW, bboxH));
    regions.push({
      colorName: nearestColorName(rSum / cells.length, gSum / cells.length, bSum / cells.length),
      share,
      centroidX: (sumX / cells.length) / Math.max(1, width - 1),
      centroidY: (sumY / cells.length) / Math.max(1, height - 1),
      bboxWidth: bboxW / Math.max(1, width),
      bboxHeight: bboxH / Math.max(1, height),
      borderTouch,
      fillRatio,
      circularity,
      symmetry: mirrorHit / cells.length,
      elongation,
      shape: elongation >= 2.5 ? '細長い' : fillRatio >= 0.85 ? '四角に近い' : circularity >= 0.65 ? '丸に近い' : 'いびつな形',
    });
  }
  return regions.sort((a, b) => b.share - a.share).slice(0, 5);
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
  // P926: 形の手がかり（大きな領域を最大2つ、位置と形の印象で）。
  const regionText = features.regions.slice(0, 2).map((r) => {
    const h = r.centroidX < 0.36 ? '左' : r.centroidX > 0.64 ? '右' : '';
    const v = r.centroidY < 0.36 ? '上' : r.centroidY > 0.64 ? '下' : '';
    const pos = h + v || '中央';
    return `${pos}に${r.colorName}の${r.shape}領域（約${Math.round(r.share * 100)}%）`;
  }).join('、');
  const shapes = regionText ? `。形の手がかり：${regionText}がある` : '';
  return `画像の観察：${features.aspect}の画像。全体に${brightness}。${vividness}。${colorCount}。${colors}${transparency}。${material.gloss}${pattern}${gradient}${shapes}。具体的な物や文字までは読み取れない。`;
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
      // P927: 形も描き直して照合する。
      let shapeVerification: ImageObservation['shapeVerification'];
      try {
        const { verifyShapesByRendering } = await import('./shapeRenderVerificationService');
        shapeVerification = verifyShapesByRendering(features);
      } catch { shapeVerification = undefined; }
      // P928: 見本と照合して同定する（似ているときだけ名前で呼ぶ）。
      // P929: 配置の見本が合えばそちらを優先する。
      // P945: 人の形らしい配置は、どの見本よりも先に読む。
      let text = verbalizeImageFeatures(features);
      let figureMatched = false;
      try {
        const { visualFigureService } = await import('./visualFigureService');
        const figure = visualFigureService.identifyFigure(features);
        if (figure) {
          text = text.replace(
            '。具体的な物や文字までは読み取れない。',
            `。${figure.description}が見える。具体的な物や文字までは読み取れない。`,
          );
          figureMatched = true;
        }
      } catch { /* 人の同定ができなくても観察は返す */ }
      if (!figureMatched) {
        try {
          const { visualScenePatternService } = await import('./visualScenePatternService');
          const sceneMatch = visualScenePatternService.matchScene(features);
          if (sceneMatch) {
            text = text.replace(
              '。具体的な物や文字までは読み取れない。',
              `。配置としては「${sceneMatch.name}」に似ている。具体的な物や文字までは読み取れない。`,
            );
          } else {
            const { visualPatternService } = await import('./visualPatternService');
            const match = visualPatternService.match(features);
            if (match) {
              text = text.replace(
                '。具体的な物や文字までは読み取れない。',
                `。形としては「${match.name}」に似ている。具体的な物や文字までは読み取れない。`,
              );
            }
          }
        } catch { /* 同定できなくても観察は返す */ }
      }
      return { text, features, material: hypothesizeMaterial(features), verification, shapeVerification };
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
