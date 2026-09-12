/** 第66章: 変更前のバックアップ・復元手順・停止点を共通化。実際の変更は呼出側の権限境界で行う。 */
import {storageService} from './storageService';
export interface ReversibilityPlan{id:string;target:string;scope:string[];backup:string[];restoreSteps:string[];stopPoints:string[];status:'PLANNED'|'BACKED_UP'|'RESTORED'|'COMMITTED';createdAt:number;}
const KEY='miki_reversibility_plans_v1';
class ReversibilityService{private xs:ReversibilityPlan[]=[];constructor(){try{const r=storageService.getItem(KEY);if(r)this.xs=JSON.parse(r)}catch{}}
 private save(){try{storageService.setItem(KEY,JSON.stringify(this.xs.slice(-300)))}catch{}}
 plan(target:string,scope:string[],backup:string[]=[]){const x={id:`REV-${Date.now()}`,target,scope,backup,restoreSteps:backup.map(b=>`restore:${b}`),stopPoints:['pre-change','post-backup','pre-commit'],status:'PLANNED' as const,createdAt:Date.now()};this.xs.push(x);this.save();return x;}
 mark(id:string,status:ReversibilityPlan['status']){const x=this.xs.find(y=>y.id===id);if(x){x.status=status;this.save()}return x;}
 get(id:string){return this.xs.find(x=>x.id===id)} list(){return [...this.xs].sort((a,b)=>b.createdAt-a.createdAt)}}
export const reversibilityService=new ReversibilityService();
