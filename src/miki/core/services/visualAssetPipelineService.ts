import { canonicalSha256Object } from './canonicalSha256Service';
import type { PixelArtCandidate } from './pixelArtCandidateService';
import type { RgbaFrame } from './visualStyleLearningService';
export interface BodyClothingTrend{headToBodyRatio:number;shoulderWidthRatio:number;torsoLengthRatio:number;armLengthRatio:number;legLengthRatio:number;silhouetteComplexity:number;garmentCoverageRatio:number;layerCount:number;patternDensity:number;accessoryCount:number;dominantGarmentTypes:string[];}
export interface EncodedVisualAsset{mimeType:'image/png'|'image/jpeg'|'image/webp';bytes:Uint8Array;sourceSha256:string;}
export interface SpriteSheetCandidate{frameWidth:number;frameHeight:number;columns:number;rows:number;frames:PixelArtCandidate[];sheetSha256:string;}
export interface TileSetCandidate{tileSize:number;tiles:PixelArtCandidate[];adjacency:Array<{from:number;to:number;direction:'N'|'E'|'S'|'W'}>;sha256:string;}
export interface TileMapCandidate{width:number;height:number;tileIndices:number[];tileSetSha256:string;sha256:string;}
class VisualAssetPipelineService{
 supportedMimeTypes(){return['image/png','image/jpeg','image/webp'] as const;}
 decodeInBrowser(asset:EncodedVisualAsset){if(!this.supportedMimeTypes().includes(asset.mimeType))throw new Error('UNSUPPORTED_IMAGE_FORMAT');return{decoder:'createImageBitmap+OffscreenCanvas',sourceSha256:asset.sourceSha256,mimeType:asset.mimeType};}
 sampleVideo(frames:RgbaFrame[],timestampsMs:number[],intervalMs:number){if(frames.length!==timestampsMs.length||intervalMs<1)throw new Error('INVALID_VIDEO_SAMPLE_INPUT');let next=0;return frames.filter((_,index)=>{if(timestampsMs[index]<next)return false;next=timestampsMs[index]+intervalMs;return true;});}
 keyframes(frames:RgbaFrame[],differenceThreshold=.08){if(!frames.length)return[];const output=[frames[0]];for(let i=1;i<frames.length;i+=1)if(this.frameDifference(output[output.length-1],frames[i])>=differenceThreshold)output.push(frames[i]);return output;}
 spriteSheet(frames:PixelArtCandidate[],columns:number):SpriteSheetCandidate{if(!frames.length||columns<1)throw new Error('INVALID_SPRITE_SHEET');const seed={frameWidth:frames[0].width,frameHeight:frames[0].height,columns,rows:Math.ceil(frames.length/columns),frames};return{...seed,sheetSha256:canonicalSha256Object(seed)};}
 tileSet(tiles:PixelArtCandidate[],tileSize:number,adjacency:TileSetCandidate['adjacency']):TileSetCandidate{const seed={tileSize,tiles,adjacency};return{...seed,sha256:canonicalSha256Object(seed)};}
 tileMap(width:number,height:number,tileIndices:number[],tileSetSha256:string):TileMapCandidate{if(tileIndices.length!==width*height)throw new Error('INVALID_TILE_MAP');const seed={width,height,tileIndices,tileSetSha256};return{...seed,sha256:canonicalSha256Object(seed)};}
 canvasRendererCode(){return `export function drawIndexedAsset(ctx:CanvasRenderingContext2D,asset:{width:number;height:number;palette:string[];indices:number[]},x:number,y:number,scale=1){ctx.imageSmoothingEnabled=false;for(let py=0;py<asset.height;py+=1)for(let px=0;px<asset.width;px+=1){const index=asset.indices[py*asset.width+px];if(index<0)continue;ctx.fillStyle=asset.palette[index];ctx.fillRect(x+px*scale,y+py*scale,scale,scale);}}`;}
 animationController(frameCount:number,frameDurationMs:number){if(frameCount<1||frameDurationMs<1)throw new Error('INVALID_ANIMATION');return{frameAt:(elapsedMs:number)=>Math.floor(elapsedMs/frameDurationMs)%frameCount,frameCount,frameDurationMs};}
 similarity(left:PixelArtCandidate,right:PixelArtCandidate){if(left.width!==right.width||left.height!==right.height)return 0;let same=0;for(let i=0;i<left.indices.length;i+=1)if(left.indices[i]===right.indices[i])same+=1;return same/left.indices.length;}
 similarityGate(candidate:PixelArtCandidate,sources:PixelArtCandidate[],max=.92){const highest=Math.max(0,...sources.map(source=>this.similarity(candidate,source)));return{passed:highest<max,highestSimilarity:highest,threshold:max,reasons:highest<max?[]:['VISUAL_SIMILARITY_TOO_HIGH']};}
 reviewPackageManifest(input:{profileSha256:string;assets:Array<{name:string;sha256:string;kind:string}>;provenanceSha256List:string[]}){const seed={formatVersion:1,...input};return{...seed,manifestSha256:canonicalSha256Object(seed)};}
 private frameDifference(a:RgbaFrame,b:RgbaFrame){if(a.width!==b.width||a.height!==b.height)return 1;let sum=0;for(let i=0;i<a.rgba.length;i+=4)sum+=(Math.abs(a.rgba[i]-b.rgba[i])+Math.abs(a.rgba[i+1]-b.rgba[i+1])+Math.abs(a.rgba[i+2]-b.rgba[i+2]))/(255*3);return sum/(a.width*a.height);}
}
export const visualAssetPipelineService=new VisualAssetPipelineService();
