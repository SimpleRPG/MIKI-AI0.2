/** 設計思想 第31章 31.9: オフライン知識パック */
import { storageService } from './storageService';
export interface OfflineKnowledgePack { id: string; title: string; version: string; source: string; license: string; acquiredAt: number; revalidateAt: number; entries: Array<{ term: string; summary: string; tags: string[] }>; }
const KEY='miki_offline_knowledge_packs_v1';
class OfflineKnowledgePackService {
  private packs: OfflineKnowledgePack[]=[];
  constructor(){ try { const raw=storageService.getItem(KEY); if(raw) this.packs=JSON.parse(raw); } catch { this.packs=[]; } }
  private save(){ try{storageService.setItem(KEY,JSON.stringify(this.packs));}catch{} }
  public register(pack: Omit<OfflineKnowledgePack,'acquiredAt'> & {acquiredAt?:number}): OfflineKnowledgePack { const now=Date.now(); const full={...pack,acquiredAt:pack.acquiredAt||now}; this.packs=this.packs.filter(p=>p.id!==pack.id); this.packs.push(full); this.save(); return full; }
  public list(){return [...this.packs].sort((a,b)=>b.acquiredAt-a.acquiredAt);}
  public lookup(term:string){const q=term.toLowerCase(); return this.packs.flatMap(p=>p.entries.filter(e=>e.term.toLowerCase().includes(q)).map(e=>({...e,packId:p.id,version:p.version,license:p.license,source:p.source})));}
  public getRevalidationDue(now=Date.now()){return this.packs.filter(p=>p.revalidateAt<=now);}
}
export const offlineKnowledgePackService=new OfflineKnowledgePackService();
