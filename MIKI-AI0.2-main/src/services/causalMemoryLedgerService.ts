/** 設計思想 第160章: 因果記憶。経験→判断→結果→訂正の因果鎖を同一Mikiで共有する。 */
import { storageService } from './storageService';
import { systemLogger } from './systemLogger';

export type CausalKind = 'DECISION'|'RESULT'|'CORRECTION'|'TRANSFER';
export interface CausalRecord { id:string; timestamp:number; requestId?:string; experienceId?:string; kind:CausalKind; causeId?:string; subject:string; outcome:'SUCCESS'|'FAILURE'|'INCONCLUSIVE'; verified:boolean; reuseCount:number; misdirectionCount:number; replacedBy?:string; source?:string; }
const KEY='miki_causal_memory_ledger_v1';
function h(s:string){let x=2166136261;for(let i=0;i<s.length;i++){x^=s.charCodeAt(i);x=Math.imul(x,16777619)}return(x>>>0).toString(16)}
class CausalMemoryLedgerService {
 private records:CausalRecord[]=[]; constructor(){this.load()}
 private load(){try{const r=storageService.getItem(KEY);if(r)this.records=JSON.parse(r)}catch{this.records=[]}}
 private save(){storageService.setItem(KEY,JSON.stringify(this.records.slice(-1500)))}
 public append(input:Omit<CausalRecord,'id'|'timestamp'|'reuseCount'|'misdirectionCount'> & {id?:string}){const key=`${input.requestId||''}|${input.experienceId||''}|${input.kind}|${input.subject}|${input.causeId||''}`; const existing=this.records.find(r=>r.id===h(key)); if(existing)return existing; const r={...input,id:input.id||`CAUSAL-${h(key)}`,timestamp:Date.now(),reuseCount:0,misdirectionCount:0};this.records.push(r);this.save();return r;}
 public linkDecisionResult(requestId:string,decision:string,result:'SUCCESS'|'FAILURE'|'INCONCLUSIVE',verified:boolean,experienceId?:string){const d=this.append({requestId,experienceId,kind:'DECISION',subject:decision,outcome:'INCONCLUSIVE',verified});return this.append({requestId,experienceId,kind:'RESULT',causeId:d.id,subject:decision,outcome:result,verified});}
 public recordCorrection(causeId:string,subject:string,verified:boolean){return this.append({kind:'CORRECTION',causeId,subject,outcome:verified?'SUCCESS':'INCONCLUSIVE',verified});}
 public markReuse(id:string,misdirected=false){const r=this.records.find(x=>x.id===id);if(!r)return null;if(misdirected)r.misdirectionCount++;else r.reuseCount++;this.save();return r;}
 public forgetCandidates(limit=20){return this.records.filter(r=>r.reuseCount===0&&r.misdirectionCount>0).sort((a,b)=>b.misdirectionCount-a.misdirectionCount).slice(0,limit).map(r=>({...r}));}
 public list(limit=100){return this.records.slice(-Math.max(1,limit)).reverse().map(r=>({...r}));}
 public stats(){return {records:this.records.length,verified:this.records.filter(r=>r.verified).length,corrections:this.records.filter(r=>r.kind==='CORRECTION').length,forgetCandidates:this.forgetCandidates(100).length};}
}
export const causalMemoryLedgerService=new CausalMemoryLedgerService();
