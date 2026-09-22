import { storageService } from '../../../services/storageService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { canonicalSha256 } from './canonicalSha256Service';

export interface CodeUnderstandingEntry {
  path:string;
  contentHash:string;
  imports:string[];
  importedBy:string[];
  exports:string[];
}

export interface CodeUnderstandingSnapshot {
  repoSha256:string;
  snapshotSha256:string;
  entries:CodeUnderstandingEntry[];
  createdAt:number;
}

export interface CodeUnderstandingResult {
  ready:boolean;
  reused:boolean;
  repoSha256:string;
  targetPaths:string[];
  relatedPaths:string[];
  reasons:string[];
  snapshotSha256?:string;
}

const KEY='miki_code_understanding_snapshot';

class SelfCodeUnderstandingService {
  get():CodeUnderstandingSnapshot|undefined {
    try {
      const raw=storageService.getItem(KEY);
      return raw?JSON.parse(raw):undefined;
    } catch { return undefined; }
  }

  ensure(targetPaths:string[]):CodeUnderstandingResult {
    const files=selfCodeSpaceService.listSourceFiles();
    if(files.length===0) {
      return {ready:false,reused:false,repoSha256:'',targetPaths,relatedPaths:[],reasons:['SOURCE_SNAPSHOT_EMPTY']};
    }

    const repoSha256=canonicalSha256(files.map(f=>({path:f.path,sha256:f.contentHash})));
    const previous=this.get();
    let snapshot=previous;
    let reused=Boolean(previous?.repoSha256===repoSha256);

    if(!snapshot || snapshot.repoSha256!==repoSha256) {
      const entries:CodeUnderstandingEntry[]=files.map(file=>{
        const imports=[...file.content.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)]
          .map(m=>m[1]||m[2]).filter(Boolean);
        const exports=[...file.content.matchAll(/export\s+(?:default\s+)?(?:class|interface|type|const|function|async\s+function)\s+([A-Za-z_$][\w$]*)/g)]
          .map(m=>m[1]);
        return {path:file.path,contentHash:file.contentHash,imports:[...new Set(imports)],importedBy:[],exports:[...new Set(exports)]};
      });

      const byPath=new Map(files.map(f=>[f.path,f.path]));
      const resolve=(from:string,raw:string)=>{
        if(!raw.startsWith('.')) return undefined;
        const base=from.split('/').slice(0,-1).join('/');
        const parts=(base+'/'+raw).split('/');
        const out:string[]=[];
        for(const part of parts){
          if(!part||part==='.') continue;
          if(part==='..') out.pop(); else out.push(part);
        }
        const stem=out.join('/');
        return [stem,`${stem}.ts`,`${stem}.tsx`,`${stem}/index.ts`,`${stem}/index.tsx`].find(x=>byPath.has(x));
      };

      const map=new Map(entries.map(e=>[e.path,e]));
      for(const entry of entries) {
        for(const raw of entry.imports) {
          const resolved=resolve(entry.path,raw);
          if(resolved) map.get(resolved)?.importedBy.push(entry.path);
        }
        entry.importedBy=[...new Set(entry.importedBy)];
      }

      snapshot={
        repoSha256,
        snapshotSha256:canonicalSha256(entries),
        entries,
        createdAt:Date.now()
      };
      storageService.setItem(KEY,JSON.stringify(snapshot));
      reused=false;
    }

    const targets=[...new Set(targetPaths.filter(Boolean))];
    const entryMap=new Map(snapshot.entries.map(e=>[e.path,e]));
    const missing=targets.filter(path=>!entryMap.has(path));
    if(missing.length) {
      return {
        ready:false,reused,repoSha256,targetPaths:targets,relatedPaths:[],
        reasons:[`TARGET_NOT_UNDERSTOOD:${missing.join('|')}`],
        snapshotSha256:snapshot.snapshotSha256
      };
    }

    const related=new Set<string>();
    for(const path of targets) {
      const entry=entryMap.get(path)!;
      entry.importedBy.forEach(x=>related.add(x));
      entry.imports.forEach(raw=>{
        const resolved=entryMap.has(raw)?raw:undefined;
        if(resolved) related.add(resolved);
      });
    }

    return {
      ready:true,reused,repoSha256,targetPaths:targets,
      relatedPaths:[...related].sort(),
      reasons:[],
      snapshotSha256:snapshot.snapshotSha256
    };
  }
}

export const selfCodeUnderstandingService=new SelfCodeUnderstandingService();
