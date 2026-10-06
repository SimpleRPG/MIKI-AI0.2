import { canonicalSha256Object } from './canonicalSha256Service';

export type VisualAssetLicense = 'OWNED' | 'CC0' | 'PUBLIC_DOMAIN' | 'PERMISSIVE' | 'EXPLICIT_PERMISSION';
export interface VisualAssetProvenance {
  assetId: string;
  contentSha256: string;
  mediaKind: 'IMAGE' | 'VIDEO_FRAME';
  license: VisualAssetLicense;
  sourceLabel: string;
  identityRecognitionAllowed: false;
}
export interface RgbaFrame { width: number; height: number; rgba: number[]; provenance: VisualAssetProvenance; }
export interface NormalizedFaceStructure {
  faceWidthRatio: number;
  faceHeightRatio: number;
  eyeSpacingRatio: number;
  eyeSizeRatio: number;
  noseLengthRatio: number;
  mouthWidthRatio: number;
  outlineStrength: number;
  shadingSteps: number;
}
export interface NormalizedBodyClothingStructure { headToBodyRatio:number; shoulderWidthRatio:number; torsoLengthRatio:number; armLengthRatio:number; legLengthRatio:number; silhouetteComplexity:number; garmentCoverageRatio:number; layerCount:number; patternDensity:number; accessoryCount:number; dominantGarmentTypes:string[]; }
export interface VisualStyleSample {
  frame: RgbaFrame;
  faceStructure?: NormalizedFaceStructure;
  bodyClothingStructure?: NormalizedBodyClothingStructure;
}
export interface VisualStyleProfile {
  sampleCount: number;
  dominantPalette: string[];
  averageSaturation: number;
  averageLuminance: number;
  transparentPixelRatio: number;
  faceTrend?: NormalizedFaceStructure;
  bodyClothingTrend?: NormalizedBodyClothingStructure;
  provenanceSha256List: string[];
  profileSha256: string;
}

class VisualStyleLearningService {
  learn(samples: VisualStyleSample[], paletteSize = 16): VisualStyleProfile {
    if (samples.length === 0) throw new Error('VISUAL_SAMPLES_REQUIRED');
    for (const sample of samples) this.validateFrame(sample.frame);
    const palette = this.palette(samples.flatMap(sample => this.opaquePixels(sample.frame)), paletteSize);
    const colorStats = this.colorStats(samples);
    const faceSamples = samples.map(sample => sample.faceStructure).filter((value): value is NormalizedFaceStructure => Boolean(value));
    const bodySamples=samples.map(sample=>sample.bodyClothingStructure).filter((value):value is NormalizedBodyClothingStructure=>Boolean(value));
    const seed = {
      sampleCount: samples.length,
      dominantPalette: palette,
      ...colorStats,
      faceTrend: faceSamples.length > 0 ? this.averageFaces(faceSamples) : undefined,
      bodyClothingTrend: bodySamples.length ? this.averageBody(bodySamples) : undefined,
      provenanceSha256List: samples.map(sample => sample.frame.provenance.contentSha256).sort()
    };
    return { ...seed, profileSha256: canonicalSha256Object(seed) };
  }

  private validateFrame(frame: RgbaFrame) {
    if (frame.width < 1 || frame.height < 1 || frame.rgba.length !== frame.width * frame.height * 4) throw new Error('INVALID_RGBA_FRAME');
    if (!frame.provenance.contentSha256 || frame.provenance.identityRecognitionAllowed !== false) throw new Error('INVALID_VISUAL_PROVENANCE');
  }

  private opaquePixels(frame: RgbaFrame) {
    const pixels: number[][] = [];
    for (let index = 0; index < frame.rgba.length; index += 4) if (frame.rgba[index + 3] > 0) pixels.push(frame.rgba.slice(index, index + 3));
    return pixels;
  }

  private palette(pixels: number[][], paletteSize: number) {
    const bins = new Map<string, { count: number; r: number; g: number; b: number }>();
    for (const [r, g, b] of pixels) {
      const key = `${Math.round(r / 32)}:${Math.round(g / 32)}:${Math.round(b / 32)}`;
      const row = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      row.count += 1; row.r += r; row.g += g; row.b += b; bins.set(key, row);
    }
    return [...bins.values()].sort((a, b) => b.count - a.count).slice(0, Math.max(2, Math.min(64, paletteSize))).map(row => {
      const hex = [row.r, row.g, row.b].map(value => Math.round(value / row.count).toString(16).padStart(2, '0')).join('');
      return `#${hex}`;
    });
  }

  private colorStats(samples: VisualStyleSample[]) {
    let count = 0; let saturation = 0; let luminance = 0; let transparent = 0; let total = 0;
    for (const { frame } of samples) for (let index = 0; index < frame.rgba.length; index += 4) {
      total += 1;
      if (frame.rgba[index + 3] === 0) { transparent += 1; continue; }
      const rgb = frame.rgba.slice(index, index + 3).map(value => value / 255);
      const max = Math.max(...rgb); const min = Math.min(...rgb);
      saturation += max === 0 ? 0 : (max - min) / max;
      luminance += 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; count += 1;
    }
    return { averageSaturation: count ? saturation / count : 0, averageLuminance: count ? luminance / count : 0, transparentPixelRatio: total ? transparent / total : 0 };
  }

  private averageBody(values:NormalizedBodyClothingStructure[]):NormalizedBodyClothingStructure{const numeric=['headToBodyRatio','shoulderWidthRatio','torsoLengthRatio','armLengthRatio','legLengthRatio','silhouetteComplexity','garmentCoverageRatio','layerCount','patternDensity','accessoryCount'] as const;const result:any={};for(const key of numeric)result[key]=values.reduce((sum,value)=>sum+value[key],0)/values.length;const counts=new Map<string,number>();values.flatMap(value=>value.dominantGarmentTypes).forEach(value=>counts.set(value,(counts.get(value)||0)+1));result.dominantGarmentTypes=[...counts].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,8);return result;}

  private averageFaces(values: NormalizedFaceStructure[]): NormalizedFaceStructure {
    const keys = Object.keys(values[0]) as Array<keyof NormalizedFaceStructure>;
    return Object.fromEntries(keys.map(key => [key, values.reduce((sum, value) => sum + value[key], 0) / values.length])) as unknown as NormalizedFaceStructure;
  }
}
export const visualStyleLearningService = new VisualStyleLearningService();
