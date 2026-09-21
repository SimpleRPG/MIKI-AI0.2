/** 設計思想 第161章: 知識半減期・陳腐化予測。再検証優先度だけを計算し、VERIFIED状態を直接変更しない。 */
import { storageService } from './storageService';
export type KnowledgeStability='FIXED'|'ENVIRONMENT'|'VERSION'|'TIME'|'USER_POLICY'|'HYPOTHESIS';
export interface HalfLifeRecord { key:string; stability:KnowledgeStability; importance:number; uses:number; failures:number; lastVerifiedAt:number; lastObservedAt:number; changeRisk:number; halfLifeDays:number; dueAt:number; revalidationRequired:boolean; }
const KEY='miki_knowledge_half_life_v1';
class KnowledgeHalfLifeService {
 private records:Record<string,HalfLifeRecord>={}; constructor(){try{const r=storageService.getItem(KEY);if(r)this.records=JSON.parse(r)}catch{}}
 private save(){storageService.setItem(KEY,JSON.stringify(this.records))}
 public classify(key:string, input:{stability?:KnowledgeStability;importance?:number;changeRisk?:number;verifiedAt?:number}={}){
  const now=Date.now(), old=this.records[key]; const stability=input.stability||old?.stability||this.infer(key); const importance=Math.max(0,Math.min(100,input.importance??old?.importance??50)); const changeRisk=Math.max(0,Math.min(100,input.changeRisk??old?.changeRisk??40));
  const base={FIXED:3650,ENVIRONMENT:30,VERSION:45,TIME:14,USER_POLICY:21,HYPOTHESIS:7}[stability]; const halfLifeDays=Math.max(1,Math.round(base*(1.25-importance/200)*(1.2-changeRisk/250)));
  const lastVerifiedAt=input.verifiedAt??old?.lastVerifiedAt??now; const rec:HalfLifeRecord={key,stability,importance,uses:old?.uses||0,failures:old?.failures||0,lastVerifiedAt,lastObservedAt:now,changeRisk,halfLifeDays,dueAt:lastVerifiedAt+halfLifeDays*86400000,revalidationRequired:now>=lastVerifiedAt+halfLifeDays*86400000};this.records[key]=rec;this.save();return {...rec};
 }
 public observe(key:string,outcome:'SUCCESS'|'FAILURE',verified=false){const r=this.records[key]||this.classify(key);r.uses++;if(outcome==='FAILURE')r.failures++;r.lastObservedAt=Date.now();if(verified){r.lastVerifiedAt=r.lastObservedAt;r.dueAt=r.lastVerifiedAt+r.halfLifeDays*86400000;r.revalidationRequired=false}this.records[key]=r;this.save();return {...r};}
 public due(limit=20){const now=Date.now();return Object.values(this.records).filter(r=>r.dueAt<=now||r.revalidationRequired).sort((a,b)=>this.priority(b,now)-this.priority(a,now)).slice(0,limit).map(r=>({...r}));}
 private priority(r:HalfLifeRecord,now:number){return r.importance*0.5+r.changeRisk*0.3+Math.min(100,r.failures*10)+(now>=r.dueAt?25:0)}
 public list(limit=100){return Object.values(this.records).sort((a,b)=>b.lastObservedAt-a.lastObservedAt).slice(0,limit).map(r=>({...r}));}
 private infer(k:string):KnowledgeStability{if(/policy|ユーザー|user/i.test(k))return'USER_POLICY';if(/version|v\d|api/i.test(k))return'VERSION';if(/network|android|device|environment/i.test(k))return'ENVIRONMENT';return'FIXED';}
}
export const knowledgeHalfLifeService=new KnowledgeHalfLifeService();
