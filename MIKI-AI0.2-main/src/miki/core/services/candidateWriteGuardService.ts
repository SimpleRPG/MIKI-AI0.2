import { storageService } from '../../../services/storageService';

export interface CandidateWriteGuard {
  guardId:string; issueId:string; baseSnapshotSha256:string; candidateRevisionSha256:string;
  targetPaths:string[]; targetSetSha256:string; stageGuardBeforeWrite:true; rollbackGuardBeforeWrite:true;
  status:'STAGED'|'CONSUMED'|'ROLLED_BACK'; createdAt:number; consumedAt?:number; rollbackAt?:number;
}
const KEY='miki_candidate_write_guards_v1';
class CandidateWriteGuardService {
 private guards=new Map<string,CandidateWriteGuard>(); private sequence=0;
 constructor(){this.load();}
 async stage(issueId:string,files:Array<{path:string;baselineContent:string;candidateContent:string}>):Promise<CandidateWriteGuard>{
  if(!issueId.trim()||files.length===0)throw new Error('CANDIDATE_WRITE_GUARD_INPUT_REQUIRED');
  const targets=[...new Set(files.map(file=>file.path.trim()).filter(Boolean))].sort();
  if(targets.length!==files.length)throw new Error('CANDIDATE_WRITE_TARGET_INVALID');
  const baseSnapshotSha256=await this.sha(files.map(file=>`${file.path}\n${file.baselineContent}`).join('\n---\n'));
  const candidateRevisionSha256=await this.sha(files.map(file=>`${file.path}\n${file.candidateContent}`).join('\n---\n'));
  const targetSetSha256=await this.sha(targets.join('\n'));
  const now=Date.now(); this.sequence+=1;
  const guard:CandidateWriteGuard={guardId:`CWG-${now}-${String(this.sequence).padStart(6,'0')}`,issueId,baseSnapshotSha256,candidateRevisionSha256,targetPaths:targets,targetSetSha256,stageGuardBeforeWrite:true,rollbackGuardBeforeWrite:true,status:'STAGED',createdAt:now};
  this.guards.set(guard.guardId,guard);this.save();return this.clone(guard);
 }
 consume(guardId:string,issueId:string,targetPaths:string[]):CandidateWriteGuard{
  const guard=this.guards.get(guardId);if(!guard)throw new Error('CANDIDATE_WRITE_GUARD_NOT_FOUND');
  if(guard.status!=='STAGED')throw new Error('CANDIDATE_WRITE_GUARD_NOT_STAGED');
  const targets=[...new Set(targetPaths)].sort();
  if(guard.issueId!==issueId||JSON.stringify(guard.targetPaths)!==JSON.stringify(targets))throw new Error('CANDIDATE_WRITE_GUARD_SCOPE_MISMATCH');
  guard.status='CONSUMED';guard.consumedAt=Date.now();this.save();return this.clone(guard);
 }
 rollback(guardId:string):CandidateWriteGuard|undefined{const guard=this.guards.get(guardId);if(!guard)return undefined;guard.status='ROLLED_BACK';guard.rollbackAt=Date.now();this.save();return this.clone(guard);}
 get(guardId:string){const guard=this.guards.get(guardId);return guard?this.clone(guard):undefined;}
 verify(guardId:string,issueId:string,targetPaths:string[]):boolean{const guard=this.guards.get(guardId);if(!guard||guard.status==='ROLLED_BACK')return false;const targets=[...new Set(targetPaths)].sort();return guard.issueId===issueId&&guard.stageGuardBeforeWrite===true&&guard.rollbackGuardBeforeWrite===true&&JSON.stringify(guard.targetPaths)===JSON.stringify(targets)&&Boolean(guard.baseSnapshotSha256)&&Boolean(guard.candidateRevisionSha256)&&Boolean(guard.targetSetSha256);}
 private clone(guard:CandidateWriteGuard):CandidateWriteGuard{return {...guard,targetPaths:[...guard.targetPaths]};}
 private async sha(text:string):Promise<string>{const bytes=new TextEncoder().encode(text);if(typeof crypto!=='undefined'&&crypto.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');}let hash=2166136261;for(const value of bytes){hash^=value;hash=Math.imul(hash,16777619);}return `fnv1a-${(hash>>>0).toString(16).padStart(8,'0')}`;}
 private save(){storageService.setItem(KEY,JSON.stringify([...this.guards.values()].slice(-1000)));}
 private load(){try{const raw=storageService.getItem(KEY);const rows:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(rows))return;for(const row of rows)if(this.isGuard(row))this.guards.set(row.guardId,row);}catch{this.guards.clear();}}
 private isGuard(value:unknown):value is CandidateWriteGuard{if(typeof value!=='object'||value===null)return false;const guard=value as Partial<CandidateWriteGuard>;return typeof guard.guardId==='string'&&typeof guard.issueId==='string'&&typeof guard.baseSnapshotSha256==='string'&&typeof guard.candidateRevisionSha256==='string'&&Array.isArray(guard.targetPaths)&&typeof guard.targetSetSha256==='string'&&guard.stageGuardBeforeWrite===true&&guard.rollbackGuardBeforeWrite===true&&(guard.status==='STAGED'||guard.status==='CONSUMED'||guard.status==='ROLLED_BACK')&&typeof guard.createdAt==='number';}
}
export const candidateWriteGuardService=new CandidateWriteGuardService();
