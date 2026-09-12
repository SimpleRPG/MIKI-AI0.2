/** Chapter 58: causal hypotheses, falsification, low-impact test ordering and observation updates. */
import {storageService} from './storageService';
export interface CausalHypothesis{id:string;problem:string;cause:string;observations:string[];falsifiers:string[];tests:string[];weight:number;status:'OPEN'|'SUPPORTED'|'WEAKENED'|'REJECTED';}
export interface CausalInvestigation{id:string;problem:string;hypotheses:CausalHypothesis[];createdAt:number;updatedAt:number;}
const KEY='miki_causal_investigations_v1';
class CausalInvestigationService{
 private xs:CausalInvestigation[]=[];
 constructor(){try{const r=storageService.getItem(KEY);if(r)this.xs=JSON.parse(r)}catch{}}
 private save(){try{storageService.setItem(KEY,JSON.stringify(this.xs.slice(-100)))}catch{}}
 create(problem:string,causes:string[]){
  const now=Date.now();
  const x={id:`CAUSE-${now}`,problem,hypotheses:causes.map((cause,i)=>({id:`H-${now}-${i}`,problem,cause,observations:[],falsifiers:[`観測が原因[${cause}]と両立しない`],tests:[`原因[${cause}]だけを変える低影響試験`],weight:1/Math.max(1,causes.length),status:'OPEN' as const})),createdAt:now,updatedAt:now};
  this.xs.push(x);this.save();return x;
 }
 /** Tests are ordered by low impact first, then by discriminating power. */
 planTests(id:string){const x=this.get(id);if(!x)throw new Error('CAUSAL_INVESTIGATION_NOT_FOUND');return x.hypotheses.flatMap(h=>h.tests.map((test,i)=>({hypothesisId:h.id,cause:h.cause,test,impact:i===0?'LOW':'MEDIUM',priority:h.weight/(i+1)}))).sort((a,b)=>b.priority-a.priority);}
 updateHypothesis(id:string,observation:string,consistent:boolean){for(const x of this.xs){const h=x.hypotheses.find(y=>y.id===id);if(h){h.observations.push(observation);h.weight=Math.max(.01,Math.min(.99,h.weight*(consistent?1.25:.65)));h.status=consistent?'SUPPORTED':'WEAKENED';if(!consistent&&h.weight<=.02)h.status='REJECTED';x.updatedAt=Date.now();}}this.normalize();this.save();}
 addFalsifier(id:string,falsifier:string){for(const x of this.xs){const h=x.hypotheses.find(y=>y.id===id);if(h&&!h.falsifiers.includes(falsifier)){h.falsifiers.push(falsifier);x.updatedAt=Date.now();}}this.save();}
 private normalize(){for(const x of this.xs){const active=x.hypotheses.filter(h=>h.status!=='REJECTED');const s=active.reduce((a,h)=>a+h.weight,0)||1;active.forEach(h=>h.weight/=s);x.hypotheses.filter(h=>h.status==='REJECTED').forEach(h=>h.weight=0);}}
 get(id:string){return this.xs.find(x=>x.id===id)} list(){return [...this.xs].sort((a,b)=>b.updatedAt-a.updatedAt)}
}
export const causalInvestigationService=new CausalInvestigationService();
