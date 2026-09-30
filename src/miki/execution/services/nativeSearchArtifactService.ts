import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

export interface NativeSearchInputFile { path:string; content:string; }
export interface NativeSearchHit { path:string; line:number; column:number; preview:string; }
export interface ArtifactExpectation { name:string; byteLength:number; sha256:string; }
export interface ArtifactObservation extends ArtifactExpectation { actualByteLength:number; actualSha256:string; matched:boolean; }

class NativeSearchArtifactService {
  searchText(query:string,files:NativeSearchInputFile[],limit=500):NativeSearchHit[]{
    const needle=query.trim();
    if(!needle)throw new Error('SEARCH_QUERY_REQUIRED');
    const output:NativeSearchHit[]=[];
    for(const file of [...files].sort((a,b)=>a.path.localeCompare(b.path))){
      const lines=file.content.split(/\r?\n/);
      for(let index=0;index<lines.length;index++){
        const column=lines[index].indexOf(needle);
        if(column<0)continue;
        output.push({path:file.path,line:index+1,column:column+1,preview:lines[index].slice(Math.max(0,column-80),column+needle.length+80)});
        if(output.length>=Math.max(1,Math.min(5000,limit)))return output;
      }
    }
    return output;
  }
  verifyArtifact(expectation:ArtifactExpectation,bytes:Uint8Array):ArtifactObservation{
    const actualSha256=canonicalSha256(bytes);
    const actualByteLength=bytes.byteLength;
    return {...expectation,actualByteLength,actualSha256,matched:expectation.byteLength===actualByteLength&&expectation.sha256===actualSha256};
  }
}
export const nativeSearchArtifactService=new NativeSearchArtifactService();
