import { storageService } from '../../../services/storageService';
export type CandidateWorkspaceStatus='ISOLATED'|'VALIDATING'|'SHADOW_PASSED'|'PROMOTABLE'|'EXPORTED'|'REJECTED';
export interface CandidateFile { path:string; baselineContent:string; candidateContent:string; baselineSha256:string; candidateSha256:string; evidenceIds:string[]; }
export interface CandidateWorkspace { workspaceId:string; issueId:string; status:CandidateWorkspaceStatus; files:CandidateFile[]; createdAt:number; updatedAt:number; }
const KEY='miki_isolated_candidate_workspaces_v1';
class IsolatedCandidateWorkspaceService{
 private items=new Map<string,CandidateWorkspace>();private sequence=0;
 constructor(){this.load();}
 async create(issueId:string,files:Array<{path:string;baselineContent:string;candidateContent:string;evidenceIds?:string[]}>):Promise<CandidateWorkspace>{const now=Date.now();this.sequence+=1;const workspaceId=`CWS-${now}-${String(this.sequence).padStart(6,'0')}`;const mapped:CandidateFile[]=[];for(const file of files)mapped.push({...file,evidenceIds:[...(file.evidenceIds||[])],baselineSha256:await this.sha(file.baselineContent),candidateSha256:await this.sha(file.candidateContent)});const item={workspaceId,issueId,status:'ISOLATED' as const,files:mapped,createdAt:now,updatedAt:now};this.items.set(workspaceId,item);this.save();return this.clone(item);}
 setStatus(id:string,status:CandidateWorkspaceStatus){const item=this.items.get(id);if(!item)return undefined;item.status=status;item.updatedAt=Date.now();this.save();return this.clone(item);}
 get(id:string){const item=this.items.get(id);return item?this.clone(item):undefined;}
 list(){return [...this.items.values()].sort((a,b)=>b.updatedAt-a.updatedAt).map(x=>this.clone(x));}
 private clone(x:CandidateWorkspace):CandidateWorkspace{return {...x,files:x.files.map(f=>({...f,evidenceIds:[...f.evidenceIds]}))};}
 private async sha(text:string):Promise<string>{const data=new TextEncoder().encode(text);if(typeof crypto!=='undefined'&&crypto.subtle){const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}let h=2166136261;for(const value of data){h^=value;h=Math.imul(h,16777619);}return `fallback-${(h>>>0).toString(16).padStart(8,'0')}`;}
 private save(){storageService.setItem(KEY,JSON.stringify(this.list().slice(0,100)));}
 private load(){try{const raw=storageService.getItem(KEY);const all=raw?JSON.parse(raw):[];if(Array.isArray(all))for(const x of all)this.items.set(x.workspaceId,x);}catch{this.items.clear();}}
}
export const isolatedCandidateWorkspaceService=new IsolatedCandidateWorkspaceService();
