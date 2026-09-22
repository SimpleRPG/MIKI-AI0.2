import { storageService } from '../../../services/storageService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { canonicalSha256 } from './canonicalSha256Service';

export interface CodeUnderstandingEntry {
  path:string; contentHash:string; imports:string[];
  importedBy:string[]; exports:string[];
}
export interface CodeUnderstandingSnapshot {
  repoSha256:string; snapshotSha256:string;
  entries:CodeUnderstandingEntry[]; createdAt:number;
  targetFingerprints:Record<string,string>;
}
export interface CodeUnderstandingResult {
  ready:boolean; reused:boolean; repoSha256:string;
  targetPaths:string[]; relatedPaths:string[];
  reasons:string[]; snapshotSha256?:string;
}

const KEY='miki_code_understanding_snapshot';

class SelfCodeUnderstandingService {
  get():CodeUnderstandingSnapshot|undefined {
    try {
      const raw=storageService.getItem(KEY);
      return raw?JSON.parse(raw):undefined;
    } catch { return undefined; }
  }

  private resolve(m:Map<string,CodeUnderstandingEntry>,from:string,raw:string){
    if(!raw.startsWith('.')) return undefined;
    const base=from.split('/').slice(0,-1).join('/');
    const out:string[]=[];
    for(const x of (base+'/'+raw).split('/')){
      if(!x||x==='.') continue;
      if(x==='..') out.pop(); else out.push(x);
    }
    const s=out.join('/');
    return [s,s+'.ts',s+'.tsx',s+'/index.ts',s+'/index.tsx'].find(x=>m.has(x));
  }

  private parse(f:{path:string;content:string;contentHash:string}){
    const imports=[...f.content.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m=>m[1]||m[2]).filter(Boolean);
    const exports=[...f.content.matchAll(/export\s+(?:default\s+)?(?:class|interface|type|const|function|async\s+function)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
    return {path:f.path,contentHash:f.contentHash,imports:[...new Set(imports)],importedBy:[],exports:[...new Set(exports)]};
  }

  ensure(targetPaths:string[]):CodeUnderstandingResult {
    const files=selfCodeSpaceService.listSourceFiles();
    if(!files.length)return {ready:false,reused:false,repoSha256:'',targetPaths,relatedPaths:[],reasons:['SOURCE_SNAPSHOT_EMPTY']};

    const current=new Map(files.map(f=>[f.path,f]));
    const repoSha256=canonicalSha256(files.map(f=>({path:f.path,sha256:f.contentHash})));
    const previous=this.get();
    const entries=new Map<string,CodeUnderstandingEntry>();

    for(const e of previous?.entries||[]){
      const f=current.get(e.path);
      if(f&&f.contentHash===e.contentHash)entries.set(e.path,{...e,importedBy:[]});
    }
    for(const f of files)if(!entries.has(f.path))entries.set(f.path,this.parse(f));

    for(const e of entries.values())for(const raw of e.imports){
      const x=this.resolve(entries,e.path,raw);
      if(x)entries.get(x)!.importedBy.push(e.path);
    }
    for(const e of entries.values())e.importedBy=[...new Set(e.importedBy)];

    const targets=[...new Set(targetPaths.filter(Boolean))];
    const missing=targets.filter(x=>!entries.has(x));
    if(missing.length)return {ready:false,reused:false,repoSha256,targetPaths:targets,relatedPaths:[],reasons:[`TARGET_NOT_UNDERSTOOD:${missing.join('|')}`]};

    const related=new Set<string>(),queue=[...targets];
    while(queue.length){
      const p=queue.shift()!,e=entries.get(p); if(!e)continue;
      for(const raw of e.imports){
        const x=this.resolve(entries,p,raw);
        if(x&&!targets.includes(x)&&!related.has(x)){related.add(x);queue.push(x);}
      }
      for(const x of e.importedBy){
        if(!targets.includes(x)&&!related.has(x)){related.add(x);queue.push(x);}
      }
    }

    const scope=[...targets,...related].sort();
    const fingerprint=canonicalSha256(scope.map(p=>{
      const e=entries.get(p)!;
      return {path:p,contentHash:e.contentHash,imports:e.imports,exports:e.exports};
    }));
    const key=targets.join('|');
    const reused=Boolean(previous?.targetFingerprints?.[key]===fingerprint);
    const snapshot={repoSha256,snapshotSha256:canonicalSha256([...entries.values()]),entries:[...entries.values()],createdAt:previous?.createdAt||Date.now(),targetFingerprints:{...(previous?.targetFingerprints||{}),[key]:fingerprint}};
    storageService.setItem(KEY,JSON.stringify(snapshot));

    return {ready:true,reused,repoSha256,targetPaths:targets,relatedPaths:[...related].sort(),reasons:[],snapshotSha256:snapshot.snapshotSha256};
  }
}
export const selfCodeUnderstandingService=new SelfCodeUnderstandingService();
