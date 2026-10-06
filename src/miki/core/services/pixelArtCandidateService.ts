import { canonicalSha256Object } from './canonicalSha256Service';
import type { RgbaFrame } from './visualStyleLearningService';
export interface PixelArtCandidate { width:number; height:number; palette:string[]; indices:number[]; sourceSha256:string; candidateSha256:string; }
class PixelArtCandidateService {
  generate(frame:RgbaFrame,width:number,height:number,palette:string[]):PixelArtCandidate {
    if(width<1||height<1||palette.length<2) throw new Error('INVALID_PIXEL_ART_SPEC');
    const colors=palette.map(this.hexToRgb); const indices:number[]=[];
    for(let y=0;y<height;y+=1) for(let x=0;x<width;x+=1){
      const sourceX=Math.min(frame.width-1,Math.floor((x+.5)*frame.width/width));
      const sourceY=Math.min(frame.height-1,Math.floor((y+.5)*frame.height/height));
      const offset=(sourceY*frame.width+sourceX)*4;
      if(frame.rgba[offset+3]===0){indices.push(-1);continue;}
      const pixel=frame.rgba.slice(offset,offset+3); let best=0; let distance=Number.POSITIVE_INFINITY;
      colors.forEach((color,index)=>{const value=(pixel[0]-color[0])**2+(pixel[1]-color[1])**2+(pixel[2]-color[2])**2;if(value<distance){distance=value;best=index;}}); indices.push(best);
    }
    const seed={width,height,palette,indices,sourceSha256:frame.provenance.contentSha256};
    return {...seed,candidateSha256:canonicalSha256Object(seed)};
  }
  private hexToRgb(value:string){const hex=value.replace('#','');if(!/^[0-9a-fA-F]{6}$/.test(hex))throw new Error('INVALID_PALETTE_COLOR');return[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16));}
}
export const pixelArtCandidateService=new PixelArtCandidateService();
