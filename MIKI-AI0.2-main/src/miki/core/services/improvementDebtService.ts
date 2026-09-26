import { storageService } from '../../../services/storageService';
export type ImprovementDebtKind='UNEXECUTED_CHECK'|'TEMPORARY_FALLBACK'|'UNMIGRATED_STORAGE'|'UNWIRED_ENTRY'|'COMPATIBILITY_CODE'|'CUMULATIVE_REGRESSION';
export interface ImprovementDebt { debtId:string; runId?:string; kind:ImprovementDebtKind; detail:string; status:'OPEN'|'RESOLVED'; createdAt:number; resolvedAt?:number; }
const KEY='miki_improvement_debt_v1';
class ImprovementDebtService { private rows:ImprovementDebt[]=[]; constructor(){try{this.rows=storageService.getJson(KEY, []);}catch{this.rows=[];}}
 record(kind:ImprovementDebtKind,detail:string,runId?:string){const existing=this.rows.find(x=>x.status==='OPEN'&&x.kind===kind&&x.detail===detail&&x.runId===runId);if(existing)return {...existing};const row={debtId:`DEBT-${Date.now()}-${this.rows.length+1}`,runId,kind,detail,status:'OPEN' as const,createdAt:Date.now()};this.rows.push(row);this.save();return row;}
 listOpen(){return this.rows.filter(x=>x.status==='OPEN').map(x=>({...x}));} resolve(id:string){const row=this.rows.find(x=>x.debtId===id);if(!row)return false;row.status='RESOLVED';row.resolvedAt=Date.now();this.save();return true;} private save(){storageService.setItem(KEY,JSON.stringify(this.rows.slice(-1000)));}}
export const improvementDebtService=new ImprovementDebtService();
