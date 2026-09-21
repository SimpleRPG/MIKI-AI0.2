import { storageService } from '../../../services/storageService';
import { improvementIntakeRouterService, type ImprovementIntakeRun } from './improvementIntakeRouterService';
import { autonomousSelfImprovementLoopService } from './autonomousSelfImprovementLoopService';
import { parseDirectiveText } from './unifiedDirectiveParser';
export type ExternalDirectiveStatus='RECEIVED'|'PARSED'|'VALIDATED'|'QUEUED'|'IN_PROGRESS'|'CANDIDATE_READY'|'VALIDATION_FAILED'|'REVIEW_READY'|'REJECTED';
export interface ExternalDirective { directiveId:string; title:string; sourceFileName:string; sourceHash:string; rawText:string; objective:string; targetFiles:string[]; requirements:string[]; prohibitions:string[]; invariants:string[]; validationRequirements:string[]; deliveryRequirements:string[]; relatedIssueIds:string[]; status:ExternalDirectiveStatus; receivedAt:number; runId?:string; }
const KEY='miki_external_directives_v1';
class ExternalDirectiveIntakeService{
 private rows=new Map<string,ExternalDirective>();private sequence=0;constructor(){this.load();}
 async receive(input:{sourceFileName:string;title?:string;rawText:string;objective:string;targetFiles?:string[];requirements?:string[];prohibitions?:string[];invariants?:string[];validationRequirements?:string[];deliveryRequirements?:string[];relatedIssueIds?:string[]}):Promise<{directive:ExternalDirective;run:ImprovementIntakeRun}>{if(!input.rawText.trim()||!input.objective.trim())throw new Error('EXTERNAL_DIRECTIVE_REQUIRED_FIELDS_MISSING');const sourceHash=await this.sha(input.rawText);const existing=[...this.rows.values()].find(x=>x.sourceHash===sourceHash&&x.status!=='REJECTED');if(existing&&existing.runId){const run=improvementIntakeRouterService.get(existing.runId);if(run)return {directive:this.clone(existing),run};}const now=Date.now();this.sequence+=1;const directive:ExternalDirective={directiveId:`DIR-${now}-${String(this.sequence).padStart(6,'0')}`,title:input.title?.trim()||input.objective.trim().slice(0,80)||input.sourceFileName,sourceFileName:input.sourceFileName,sourceHash,rawText:input.rawText,objective:input.objective,targetFiles:[...(input.targetFiles||[])],requirements:[...(input.requirements||[])],prohibitions:[...(input.prohibitions||[])],invariants:[...(input.invariants||[])],validationRequirements:[...(input.validationRequirements||[])],deliveryRequirements:[...(input.deliveryRequirements||[])],relatedIssueIds:[...(input.relatedIssueIds||[])],status:'VALIDATED',receivedAt:now};const run=await improvementIntakeRouterService.receive({runType:'EXTERNAL_DIRECTIVE',sourceId:directive.directiveId,objective:directive.objective,priority:100,payload:{directiveId:directive.directiveId,sourceHash,targetFiles:directive.targetFiles,requirements:directive.requirements,prohibitions:directive.prohibitions,invariants:directive.invariants,validationRequirements:directive.validationRequirements,deliveryRequirements:directive.deliveryRequirements,relatedIssueIds:directive.relatedIssueIds}});directive.runId=run.runId;directive.status='QUEUED';this.rows.set(directive.directiveId,directive);this.save();return {directive:this.clone(directive),run};}

 async receiveTextFile(sourceFileName:string,rawText:string):Promise<{directive:ExternalDirective;run:ImprovementIntakeRun}>{
  const parsed=parseDirectiveText(rawText,sourceFileName);
  return this.receive({sourceFileName,title:parsed.title,rawText,objective:parsed.objective,targetFiles:parsed.targetFiles,requirements:parsed.requirements,prohibitions:parsed.prohibitions,invariants:parsed.invariants,validationRequirements:parsed.validationRequirements,deliveryRequirements:parsed.deliveryRequirements,relatedIssueIds:parsed.relatedIssueIds});
 }

 get(id:string){const row=this.rows.get(id);return row?this.clone(row):undefined;}list(){return [...this.rows.values()].sort((a,b)=>b.receivedAt-a.receivedAt).map(x=>this.clone(x));}
 deleteDirective(directiveId:string){
  const directive=this.rows.get(directiveId);
  if(!directive)return;
  if(directive.runId){
   const run=improvementIntakeRouterService.get(directive.runId);
   const cancellation=autonomousSelfImprovementLoopService.cancelByRunId(directive.runId);
   if(cancellation.active)throw new Error('DIRECTIVE_DELETE_BLOCKED_ACTIVE_RUN');
   if(run&&run.status!=='COMPLETED'&&run.status!=='REJECTED')improvementIntakeRouterService.reject(directive.runId);
  }
  this.rows.delete(directiveId);
  this.save();
 }

 private clone(x:ExternalDirective):ExternalDirective{return {...x,targetFiles:[...x.targetFiles],requirements:[...x.requirements],prohibitions:[...x.prohibitions],invariants:[...x.invariants],validationRequirements:[...x.validationRequirements],deliveryRequirements:[...x.deliveryRequirements],relatedIssueIds:[...x.relatedIssueIds]};}
 private async sha(text:string){const data=new TextEncoder().encode(text);if(typeof crypto!=='undefined'&&crypto.subtle){const hash=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');}let h=2166136261;for(const v of data){h^=v;h=Math.imul(h,16777619);}return `fallback-${(h>>>0).toString(16).padStart(8,'0')}`;}
 private save(){storageService.setItem(KEY,JSON.stringify(this.list().slice(0,200)));}private load(){try{const raw=storageService.getItem(KEY);const rows=raw?JSON.parse(raw):[];if(Array.isArray(rows))for(const row of rows){if(row&&row.directiveId)this.rows.set(row.directiveId,{...row,title:row.title||row.objective||row.sourceFileName||'作業指示'});}}catch{this.rows.clear();}}
}
export const externalDirectiveIntakeService=new ExternalDirectiveIntakeService();
