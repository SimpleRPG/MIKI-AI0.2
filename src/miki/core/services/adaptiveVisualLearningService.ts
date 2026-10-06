import { canonicalSha256Object } from './canonicalSha256Service';

export type MotionKind='WALK'|'RUN'|'GARMENT_SWAY'|'HAIR_SWAY'|'LIMB_TRAJECTORY'|'SPEED_CHANGE'|'ANTICIPATION'|'TURN'|'CAMERA_MOVE';
export interface SparseMotionObservation{kind:MotionKind;sourceSha256:string;frameCount:number;durationMs?:number;features:Record<string,number>;quality:number;}
export interface MotionTrend{kind:MotionKind;sampleCount:number;frameCount:number;confidence:number;status:'PROVISIONAL'|'GROWING'|'STABLE';means:Record<string,number>;ranges:Record<string,{min:number;max:number}>;sourceSha256List:string[];trendSha256:string;}
export interface VisualQualitySpec{width:number;height:number;paletteSize:number;paletteIndexBits:8|16;frameCount:number;directions:number;estimatedIndexBytes:number;warnings:string[];specSha256:string;}

class AdaptiveVisualLearningService{
  learnSparseMotion(observations:SparseMotionObservation[]):MotionTrend[]{
    const groups=new Map<MotionKind,SparseMotionObservation[]>();
    for(const item of observations){if(!item.sourceSha256||item.frameCount<1||item.quality<0||item.quality>1)throw new Error('INVALID_MOTION_OBSERVATION');const group=groups.get(item.kind)||[];group.push(item);groups.set(item.kind,group);}
    return [...groups.entries()].map(([kind,items])=>{
      const keys=[...new Set(items.flatMap(item=>Object.keys(item.features)))].sort();
      const means=Object.fromEntries(keys.map(key=>{const values=items.map(item=>item.features[key]).filter(Number.isFinite);return[key,values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length)];}));
      const ranges=Object.fromEntries(keys.map(key=>{const values=items.map(item=>item.features[key]).filter(Number.isFinite);return[key,{min:Math.min(...values),max:Math.max(...values)}];}));
      const evidenceWeight=items.reduce((sum,item)=>sum+item.quality*Math.min(1,item.frameCount/8),0);
      const confidence=Math.max(.05,Math.min(.99,1-Math.exp(-evidenceWeight/3)));
      const status:MotionTrend['status']=confidence>=.8?'STABLE':confidence>=.45?'GROWING':'PROVISIONAL';
      const seed={kind,sampleCount:items.length,frameCount:items.reduce((sum,item)=>sum+item.frameCount,0),confidence,status,means,ranges,sourceSha256List:items.map(item=>item.sourceSha256).sort()};
      return{...seed,trendSha256:canonicalSha256Object(seed)};
    }).sort((a,b)=>a.kind.localeCompare(b.kind));
  }

  merge(existing:MotionTrend|undefined,incoming:SparseMotionObservation[]):MotionTrend{
    const learned=this.learnSparseMotion(incoming);if(learned.length!==1)throw new Error('SINGLE_MOTION_KIND_REQUIRED');if(!existing)return learned[0];if(existing.kind!==learned[0].kind)throw new Error('MOTION_KIND_MISMATCH');
    const next=learned[0];const total=existing.sampleCount+next.sampleCount;const keys=[...new Set([...Object.keys(existing.means),...Object.keys(next.means)])].sort();
    const means=Object.fromEntries(keys.map(key=>[key,((existing.means[key]||0)*existing.sampleCount+(next.means[key]||0)*next.sampleCount)/total]));
    const ranges=Object.fromEntries(keys.map(key=>[key,{min:Math.min(existing.ranges[key]?.min??Infinity,next.ranges[key]?.min??Infinity),max:Math.max(existing.ranges[key]?.max??-Infinity,next.ranges[key]?.max??-Infinity)}]));
    const confidence=Math.max(existing.confidence,next.confidence,Math.min(.99,1-Math.exp(-(existing.frameCount+next.frameCount)/32)));
    const status:MotionTrend['status']=confidence>=.8?'STABLE':confidence>=.45?'GROWING':'PROVISIONAL';const seed={kind:existing.kind,sampleCount:total,frameCount:existing.frameCount+next.frameCount,confidence,status,means,ranges,sourceSha256List:[...new Set([...existing.sourceSha256List,...next.sourceSha256List])].sort()};return{...seed,trendSha256:canonicalSha256Object(seed)};
  }

  qualitySpec(input:{width:number;height:number;paletteSize:number;frameCount?:number;directions?:number}):VisualQualitySpec{
    const width=Math.trunc(input.width),height=Math.trunc(input.height),paletteSize=Math.trunc(input.paletteSize),frameCount=Math.trunc(input.frameCount??1),directions=Math.trunc(input.directions??1);
    if(width<1||height<1||width>4096||height>4096)throw new Error('VISUAL_RESOLUTION_OUT_OF_RANGE');
    if(paletteSize<2||paletteSize>65536)throw new Error('PALETTE_SIZE_OUT_OF_RANGE');
    if(frameCount<1||frameCount>4096||directions<1||directions>32)throw new Error('ANIMATION_SPEC_OUT_OF_RANGE');
    const paletteIndexBits:8|16=paletteSize<=256?8:16;const estimatedIndexBytes=width*height*frameCount*directions*(paletteIndexBits/8);const warnings:string[]=[];
    if(width*height>4_194_304)warnings.push('HIGH_PIXEL_COUNT');if(paletteSize>4096)warnings.push('VERY_LARGE_PALETTE');if(estimatedIndexBytes>256*1024*1024)warnings.push('HIGH_MEMORY_ESTIMATE');
    const seed={width,height,paletteSize,paletteIndexBits,frameCount,directions,estimatedIndexBytes,warnings};return{...seed,specSha256:canonicalSha256Object(seed)};
  }
}
export const adaptiveVisualLearningService=new AdaptiveVisualLearningService();
