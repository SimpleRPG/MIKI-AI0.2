import { storageService } from '../../../services/storageService';

export interface MikiCodeSpaceFile {
  path:string;
  content:string;
  language:string;
  contentHash:string;
  updatedAt:number;
}

export interface MikiCodeSpaceManifest {
  version:1;
  syncedAt:number;
  files:MikiCodeSpaceFile[];
}

const KEY='miki_code_space_v1';

class MikiCodeSpaceService {
  private files=new Map<string,MikiCodeSpaceFile>();

  constructor(){this.load();}

  sync(files:Array<{path:string;content:string;language?:string}>):void{
    const next=new Map<string,MikiCodeSpaceFile>();
    for(const file of files){
      if(!file.path||typeof file.content!=='string')continue;
      next.set(file.path,{
        path:file.path,
        content:file.content,
        language:file.language||this.language(file.path),
        contentHash:this.hash(file.content),
        updatedAt:Date.now()
      });
    }
    this.files=next;
    this.save();
  }

  getFiles():MikiCodeSpaceFile[]{
    return [...this.files.values()].map(file=>({...file}));
  }

  getFile(path:string):MikiCodeSpaceFile|undefined{
    const file=this.files.get(path);
    return file?{...file}:undefined;
  }

  getManifest():MikiCodeSpaceManifest{
    return {version:1,syncedAt:Date.now(),files:this.getFiles()};
  }

  hasFiles():boolean{return this.files.size>0;}

  private save():void{
    storageService.setItem(KEY,JSON.stringify(this.getManifest()));
  }

  private load():void{
    try{
      const raw=storageService.getItem(KEY);
      const data=raw?JSON.parse(raw):undefined;
      if(Array.isArray(data?.files)){
        for(const file of data.files)this.files.set(file.path,file);
      }
    }catch{
      this.files.clear();
    }
  }

  private language(path:string):string{
    const ext=path.split('.').pop()?.toLowerCase();
    return ext==='tsx'?'typescriptreact':ext==='ts'?'typescript':ext||'text';
  }

  private hash(text:string):string{
    let hash=2166136261;
    for(let i=0;i<text.length;i++){
      hash^=text.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;
  }
}

export const mikiCodeSpaceService=new MikiCodeSpaceService();
